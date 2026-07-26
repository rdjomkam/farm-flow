/**
 * Post-write guard — vérifie l'invariant de conservation AssignationBac.
 *
 * Règle : après chaque transaction métier, pour chaque AssignationBac active
 * (dateFin IS NULL) modifiée, on recalcule le nombre de poissons attendu à
 * partir des relevés persistés et on le compare à nombreActuel.
 *
 * Algorithme (partagé par capture ET vérification via calculerEcartsParBac) :
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
 * Tolérance (GT.1) : le guard est DIFFÉRENTIEL. On tolère un écart
 * préexistant (mesuré avant l'opération, via captureEcartsAssignation) et
 * on n'échoue que si l'opération l'a AGGRAVÉ. Un bac dont l'AssignationBac
 * est créée dans la même transaction (absent de ecartsRef) reste vérifié en
 * strict (écart de référence = 0 par défaut).
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

export interface EcartBac {
  expected: number;
  actual: number;
  ecart: number;
  bacNom: string;
}

/**
 * Calcule, pour chaque AssignationBac active des bacs demandés, le nombre
 * attendu (replay des relevés) et l'écart avec nombreActuel. Ne throw jamais :
 * c'est une fonction pure de lecture, partagée par la capture (avant écriture)
 * et la vérification (après écriture) pour garantir qu'elles ne divergent
 * jamais entre elles.
 *
 * Un bac sans AssignationBac active (dateFin IS NULL) n'apparaît pas dans la
 * map retournée.
 *
 * @param tx      - Client Prisma de transaction (PAS le client global).
 * @param siteId  - Identifiant du site (filtre multi-tenant R8).
 * @param vagueId - Identifiant de la vague dont on vérifie les bacs.
 * @param bacIds  - Bacs à examiner.
 */
export async function calculerEcartsParBac(
  tx: PrismaTransactionClient,
  siteId: string,
  vagueId: string,
  bacIds: string[],
): Promise<Map<string, EcartBac>> {
  const result = new Map<string, EcartBac>();
  if (bacIds.length === 0) return result;

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
      bac: { select: { nom: true } },
    },
  });

  if (assignations.length === 0) return result;

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
  //    et l'écart avec nombreActuel
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
    const ecart = actual - expected;
    const bacNom = (ab as { bac?: { nom?: string | null } | null }).bac?.nom ?? ab.bacId;

    result.set(ab.bacId, { expected, actual, ecart, bacNom });
  }

  return result;
}

/**
 * Capture l'écart de conservation (nombreActuel − expected) pour chaque bac,
 * AVANT les écritures d'une transaction métier. À appeler en toute première
 * opération de la transaction (avec `tx`, jamais le client `prisma` global)
 * pour préserver l'isolation transactionnelle (R4).
 *
 * Un bac sans AssignationBac active n'apparaît pas dans la map retournée :
 * l'appelant doit considérer son écart de référence comme 0 (guard strict),
 * ce qui est le comportement voulu pour une assignation créée plus tard dans
 * la même transaction.
 */
export async function captureEcartsAssignation(
  tx: PrismaTransactionClient,
  siteId: string,
  vagueId: string,
  bacIds: string[],
): Promise<Map<string, number>> {
  const ecarts = await calculerEcartsParBac(tx, siteId, vagueId, bacIds);
  const result = new Map<string, number>();
  for (const [bacId, e] of ecarts) {
    result.set(bacId, e.ecart);
  }
  return result;
}

/**
 * Vérifie l'invariant de conservation sur une liste de bacs après une écriture.
 *
 * Throws ConservationError (→ rollback) si l'écart mesuré après l'opération
 * diffère de l'écart de référence (mesuré avant l'opération via
 * captureEcartsAssignation). Sans `ecartsRef`, comportement strict identique
 * au guard historique (écart de référence = 0 pour tous les bacs).
 *
 * @param tx        - Client Prisma de transaction (PAS le client global).
 * @param siteId    - Identifiant du site (filtre multi-tenant R8).
 * @param vagueId   - Identifiant de la vague dont on vérifie les bacs.
 * @param bacIds    - Bacs à vérifier (typiquement : bacs source + destination modifiés).
 * @param ecartsRef - Écarts préexistants (bacId → ecart), capturés avant l'opération.
 *                    Optionnel : absent → guard strict (écart de référence 0).
 */
export async function verifyAssignationInvariant(
  tx: PrismaTransactionClient,
  siteId: string,
  vagueId: string,
  bacIds: string[],
  ecartsRef?: Map<string, number>,
): Promise<void> {
  if (bacIds.length === 0) return;

  const ecarts = await calculerEcartsParBac(tx, siteId, vagueId, bacIds);

  for (const [bacId, e] of ecarts) {
    const ecartAvant = ecartsRef?.get(bacId) ?? 0;

    // Décision GT.1 (corrigée GT.2) : on n'accepte que si l'écart est inchangé, ou s'il
    // s'est rapproché de zéro DU MÊME CÔTÉ (0 étant considéré des deux côtés). Comparer
    // uniquement les valeurs absolues laissait passer une inversion de signe (ex. +2 →
    // −2) qui représente pourtant une vraie rupture de conservation (4 poissons de
    // dérive) même si la magnitude reste identique ou diminue. Toute augmentation de
    // magnitude ET toute inversion de signe sont donc rejetées. Sans ecartsRef,
    // ecartAvant vaut 0 pour tous les bacs : la condition redevient alors strictement
    // "e.ecart === 0", identique au guard historique (non différentiel).
    const ecartTolere =
      e.ecart === ecartAvant ||
      (ecartAvant >= 0
        ? e.ecart >= 0 && e.ecart < ecartAvant
        : e.ecart <= 0 && e.ecart > ecartAvant);

    if (!ecartTolere) {
      throw new ConservationError(
        `Le bac "${e.bacNom}" affiche un écart de ${e.ecart > 0 ? "+" : ""}${e.ecart} poissons ` +
          `après cette opération (avant : ${ecartAvant > 0 ? "+" : ""}${ecartAvant}, ` +
          `après : ${e.ecart > 0 ? "+" : ""}${e.ecart}). ` +
          `Vérifiez les derniers relevés de ce bac ou faites un comptage avant de continuer.`,
        e.expected,
        e.actual,
        e.ecart,
        0,
        bacId,
      );
    }

    if (e.ecart !== 0) {
      // Écart préexistant toléré (identique avant/après) : on journalise pour
      // traçabilité et correction ultérieure, mais on ne bloque pas.
      console.warn(
        "[assignation-invariant] Écart préexistant toléré",
        JSON.stringify({
          bacId,
          bacNom: e.bacNom,
          vagueId,
          ecart: e.ecart,
        }),
      );
    }
  }
}
