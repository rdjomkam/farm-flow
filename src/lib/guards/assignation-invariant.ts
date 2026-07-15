/**
 * Post-write guard — vérifie l'invariant de conservation AssignationBac.
 *
 * Règle : après chaque transaction métier, pour chaque AssignationBac active
 * (dateFin IS NULL) modifiée, on recalcule le nombre de poissons attendu à
 * partir des relevés persistés et on le compare à nombreActuel.
 *
 * Algorithme :
 *  - Point de départ : nombrePoissonsInitial (AssignationBac.nombreInitial)
 *  - Si un relevé COMPTAGE existe, il devient la base ; on rejoue uniquement
 *    les opérations POSTÉRIEURES à sa date.
 *  - Opérations déduites : MORTALITE (-nombreMorts), VENTE (-nombreVendus),
 *    TRANSFERT sortant (-nombreTransferes), TRANSFERT entrant (+nombreTransferes)
 *  - Opérations ajoutées : ARRIVAGE (+nombreCompte)
 *
 * La discrimination TRANSFERT entrant/sortant se fait PAR RELEVÉ (pas par bac) :
 * pour chaque relevé TRANSFERT, on résout son TransfertGroupe (via
 * transfertGroupeId) et on compare r.bacId à bacSourceId/bacDestId. Un bac
 * peut être source d'un TransfertGroupe et destination d'un autre dans la
 * même vague ; discriminer par bac produirait un signe faux pour l'un des
 * deux relevés (BUG-049).
 *
 * Tolérance : 0 strict — aucune perte de tête autorisée.
 *
 * Doit être appelé À L'INTÉRIEUR de prisma.$transaction (R4).
 *
 * Règles respectées :
 * - R3 : PrismaTransactionClient aligné sur le type Prisma réel
 * - R4 : doit être appelé dans la transaction pour déclencher le rollback
 * - R7 : nullabilité explicite sur tous les champs
 * - R8 : siteId toujours présent
 */

import { prisma } from "@/lib/db";
import { ConservationError } from "@/lib/errors";
import { TypeReleve } from "@/types";

// Type extrait dynamiquement du client Prisma (identique au pattern assignation-bac.ts)
type PrismaTransactionClient = Parameters<
  Parameters<typeof prisma.$transaction>[0]
>[0];

/**
 * Vérifie l'invariant de conservation sur une liste de bacs après une écriture.
 *
 * Throws ConservationError (→ rollback) si AssignationBac.nombreActuel ne correspond
 * pas au cumul des opérations persistées pour ce bac.
 *
 * @param tx      - Client Prisma de transaction (PAS le client global).
 * @param siteId  - Identifiant du site (filtre multi-tenant R8).
 * @param vagueId - Identifiant de la vague dont on vérifie les bacs.
 * @param bacIds  - Bacs à vérifier (typiquement : bacs source + destination modifiés).
 */
export async function verifyAssignationInvariant(
  tx: PrismaTransactionClient,
  siteId: string,
  vagueId: string,
  bacIds: string[],
): Promise<void> {
  if (bacIds.length === 0) return;

  // -------------------------------------------------------------------------
  // 1. Charger les AssignationBac actives pour les bacs demandés
  // -------------------------------------------------------------------------
  const assignations = await tx.assignationBac.findMany({
    where: {
      siteId,
      vagueId,
      bacId: { in: bacIds },
      dateFin: null,
    },
    select: {
      id: true,
      bacId: true,
      nombreActuel: true,
      nombreInitial: true,
      dateAssignation: true,
    },
  });

  if (assignations.length === 0) return;

  // -------------------------------------------------------------------------
  // 2. Charger tous les relevés affectant ces bacs pour cette vague
  // -------------------------------------------------------------------------
  const releves = await tx.releve.findMany({
    where: {
      siteId,
      vagueId,
      bacId: { in: bacIds },
      typeReleve: {
        in: [
          TypeReleve.MORTALITE,
          TypeReleve.COMPTAGE,
          TypeReleve.ARRIVAGE,
          TypeReleve.TRANSFERT,
          TypeReleve.VENTE,
        ],
      },
    },
    select: {
      bacId: true,
      typeReleve: true,
      date: true,
      nombreMorts: true,
      nombreCompte: true,
      nombreTransferes: true,
      nombreVendus: true,
      transfertGroupeId: true,
    },
    orderBy: { date: "asc" },
  });

  // -------------------------------------------------------------------------
  // 3. Identifier, PAR RELEVÉ, si un TRANSFERT est entrant ou sortant.
  //    On ne peut pas discriminer par bac : un bac peut être source d'un
  //    TransfertGroupe et destination d'un autre dans la même vague (BUG-049).
  //    On charge donc les TransfertGroupe référencés par les relevés et on
  //    compare bacId du relevé à bacSourceId/bacDestId du groupe.
  // -------------------------------------------------------------------------
  const transfertGroupeIds = Array.from(
    new Set(
      releves
        .map((r) => r.transfertGroupeId)
        .filter((id): id is string => id !== null && id !== undefined),
    ),
  );
  const transfertGroupes = transfertGroupeIds.length
    ? await tx.transfertGroupe.findMany({
        where: { id: { in: transfertGroupeIds } },
        select: { id: true, bacSourceId: true, bacDestId: true },
      })
    : [];
  const tgById = new Map(
    transfertGroupes.map((tg) => [
      tg.id,
      { bacSourceId: tg.bacSourceId, bacDestId: tg.bacDestId },
    ]),
  );

  // -------------------------------------------------------------------------
  // 4. Pour chaque assignation active, recalculer le nombre attendu
  //    et le comparer à nombreActuel
  // -------------------------------------------------------------------------
  // Map dateAssignation par bacId pour filtrer les relevés antérieurs à l'assignation.
  // Si dateAssignation est null/undefined → pas de filtre (on rejoue tout depuis nombreInitial).
  const dateAssignationByBac = new Map(
    assignations.map((ab) => {
      const d = (ab as { dateAssignation?: Date | string | null }).dateAssignation;
      return [ab.bacId, d ? new Date(d) : null];
    }),
  );

  for (const ab of assignations) {
    const assignationDate = dateAssignationByBac.get(ab.bacId) ?? null;
    // On rejoue les relevés POSTÉRIEURS OU SIMULTANÉS à dateAssignation.
    // Les relevés strictement antérieurs sont supposés appartenir à une assignation
    // précédente déjà clôturée — leur effet est déjà incorporé dans nombreInitial.
    // CX.2 : >= pour inclure les relevés créés au même instant que l'assignation
    // (ex. calibrage qui crée AssignationBac + COMPTAGE simultanément).
    const releveBac = releves.filter((r) => {
      if (r.bacId !== ab.bacId) return false;
      if (assignationDate === null) return true;
      const releveDate = r.date ? new Date(r.date) : new Date(0);
      // CX.2 : >=  pour inclure les relevés créés au même instant que l'assignation
      // (ex. calibrage qui crée AssignationBac + COMPTAGE simultanément).
      return releveDate >= assignationDate;
    });
    // Discrimination TRANSFERT entrant/sortant PAR RELEVÉ (pas par bac) :
    // un bac peut être source d'un TransfertGroupe et destination d'un autre
    // dans la même vague, donc deux relevés TRANSFERT du même bac peuvent
    // avoir des signes opposés (BUG-049).
    const transfertSigne = (r: (typeof releveBac)[number]): number => {
      const tg = r.transfertGroupeId ? tgById.get(r.transfertGroupeId) : null;
      if (tg?.bacDestId === r.bacId) return 1; // entrant
      if (tg?.bacSourceId === r.bacId) return -1; // sortant
      // Fallback orphelin (transfertGroupeId null / SetNull ou groupe introuvable) :
      // on traite comme sortant pour préserver la sémantique historique et
      // éviter les faux positifs (comportement pré-fix conservé par défaut).
      return -1;
    };

    // Trouver le dernier COMPTAGE (override de base de calcul)
    let lastComptageDate: Date | null = null;
    let lastComptageValue: number | null = null;
    for (const r of releveBac) {
      if (r.typeReleve === TypeReleve.COMPTAGE && r.nombreCompte !== null) {
        const d = r.date ? new Date(r.date) : new Date(0);
        if (lastComptageDate === null || d > lastComptageDate) {
          lastComptageDate = d;
          lastComptageValue = r.nombreCompte;
        }
      }
    }

    let expected: number;

    if (lastComptageValue !== null && lastComptageDate !== null) {
      // Base = dernier COMPTAGE + replay des opérations postérieures
      expected = lastComptageValue;
      for (const r of releveBac) {
        const d = r.date ? new Date(r.date) : new Date(0);
        if (d <= lastComptageDate) continue; // antérieur ou égal au comptage : ignoré

        if (r.typeReleve === TypeReleve.MORTALITE) {
          expected -= r.nombreMorts ?? 0;
        } else if (r.typeReleve === TypeReleve.VENTE) {
          expected -= r.nombreVendus ?? 0;
        } else if (r.typeReleve === TypeReleve.TRANSFERT) {
          expected += transfertSigne(r) * (r.nombreTransferes ?? 0);
        } else if (r.typeReleve === TypeReleve.ARRIVAGE) {
          expected += r.nombreCompte ?? 0;
        }
      }
    } else {
      // Pas de comptage : replay complet depuis l'initial
      expected = ab.nombreInitial ?? 0;
      for (const r of releveBac) {
        if (r.typeReleve === TypeReleve.MORTALITE) {
          expected -= r.nombreMorts ?? 0;
        } else if (r.typeReleve === TypeReleve.VENTE) {
          expected -= r.nombreVendus ?? 0;
        } else if (r.typeReleve === TypeReleve.TRANSFERT) {
          expected += transfertSigne(r) * (r.nombreTransferes ?? 0);
        } else if (r.typeReleve === TypeReleve.ARRIVAGE) {
          expected += r.nombreCompte ?? 0;
        }
      }
    }

    const actual = ab.nombreActuel ?? 0;

    if (expected !== actual) {
      const ecart = actual - expected;
      throw new ConservationError(
        `Invariant cassé sur le bac ${ab.bacId} (vague ${vagueId}) : ` +
          `AssignationBac.nombreActuel=${actual} mais le calcul des opérations donne ${expected} ` +
          `(écart ${ecart > 0 ? "+" : ""}${ecart}).`,
        expected,
        actual,
        ecart,
        0,
      );
    }
  }
}
