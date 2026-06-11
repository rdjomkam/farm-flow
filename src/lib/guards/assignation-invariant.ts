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
 * La discrimination TRANSFERT entrant/sortant s'appuie sur TransfertGroupe.bacDestId :
 * si le bac figure comme destination d'un TransfertGroupe pour cette vague,
 * les TRANSFERT sont traités comme des arrivages.
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
      typeReleve: { in: ["MORTALITE", "COMPTAGE", "ARRIVAGE", "TRANSFERT", "VENTE"] },
    },
    select: {
      bacId: true,
      typeReleve: true,
      date: true,
      nombreMorts: true,
      nombreCompte: true,
      nombreTransferes: true,
      nombreVendus: true,
    },
    orderBy: { date: "asc" },
  });

  // -------------------------------------------------------------------------
  // 3. Identifier les bacs entrants (TRANSFERT miroir côté destination)
  //    via TransfertGroupe.bacDestId pour cette vague
  // -------------------------------------------------------------------------
  const transfertGroupes = await tx.transfertGroupe.findMany({
    where: {
      vagueDestId: vagueId,
      bacDestId: { in: bacIds },
    },
    select: { bacDestId: true },
  });
  const entrantBacIds = new Set(
    transfertGroupes
      .map((tg) => tg.bacDestId)
      .filter((id): id is string => id !== null),
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
    // On ne rejoue que les relevés STRICTEMENT POSTÉRIEURS à dateAssignation.
    // Les relevés antérieurs ou simultanés sont déjà reflétés dans nombreInitial
    // (ex : 1er transfert → nombreInitial = batch, releve créé à la même date → exclu).
    const releveBac = releves.filter((r) => {
      if (r.bacId !== ab.bacId) return false;
      if (assignationDate === null) return true;
      const releveDate = r.date ? new Date(r.date) : new Date(0);
      return releveDate > assignationDate;
    });
    const isEntrant = entrantBacIds.has(ab.bacId);

    // Trouver le dernier COMPTAGE (override de base de calcul)
    let lastComptageDate: Date | null = null;
    let lastComptageValue: number | null = null;
    for (const r of releveBac) {
      if (r.typeReleve === "COMPTAGE" && r.nombreCompte !== null) {
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

        if (r.typeReleve === "MORTALITE") {
          expected -= r.nombreMorts ?? 0;
        } else if (r.typeReleve === "VENTE") {
          expected -= r.nombreVendus ?? 0;
        } else if (r.typeReleve === "TRANSFERT") {
          expected += isEntrant
            ? (r.nombreTransferes ?? 0)
            : -(r.nombreTransferes ?? 0);
        } else if (r.typeReleve === "ARRIVAGE") {
          expected += r.nombreCompte ?? 0;
        }
      }
    } else {
      // Pas de comptage : replay complet depuis l'initial
      expected = ab.nombreInitial ?? 0;
      for (const r of releveBac) {
        if (r.typeReleve === "MORTALITE") {
          expected -= r.nombreMorts ?? 0;
        } else if (r.typeReleve === "VENTE") {
          expected -= r.nombreVendus ?? 0;
        } else if (r.typeReleve === "TRANSFERT") {
          expected += isEntrant
            ? (r.nombreTransferes ?? 0)
            : -(r.nombreTransferes ?? 0);
        } else if (r.typeReleve === "ARRIVAGE") {
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
