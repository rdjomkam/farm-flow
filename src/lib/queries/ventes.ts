import { prisma } from "@/lib/db";
import { generateNextNumero } from "./numero-utils";
import { verifyAssignationInvariant } from "@/lib/guards/assignation-invariant";
import { computeVivantsByBac } from "@/lib/calculs";
import { getTransfertGroupesByVague } from "./transferts";
import { ValidationError } from "@/lib/errors";
import {
  StatutVague,
  StatutVente,
  TypeReleve,
  CauseMortalite,
  StatutLotAlevins,
  PhaseLot,
  TypeUniteProduction,
  TypeVague,
  OrigineVente,
  StatutDepense,
  StatutBonLivraison,
} from "@/types";
import type {
  CreateVenteDTO,
  CreateLigneVenteDTO,
  CreateVenteAlevinsDTO,
  CreateVenteAlevinsDepuisVagueDTO,
  UpdateVenteDTO,
  ClotureVenteDTO,
  ClotureVenteLigneDTO,
  VenteFilters,
} from "@/types";

// ---------------------------------------------------------------------------
// Shared include shapes
// ---------------------------------------------------------------------------

/** Include standard pour les listes de ventes */
const VENTE_LIST_INCLUDE = {
  client: { select: { id: true, nom: true } },
  vague: { select: { id: true, code: true } },
  uniteProduction: { select: { id: true, code: true, nom: true, type: true } },
  user: { select: { id: true, name: true } },
  facture: { select: { id: true, numero: true, statut: true, montantPaye: true } },
  lignes: {
    select: {
      id: true,
      vagueId: true,
      bacId: true,
      lotAlevinsId: true,
      poidsTotalKg: true,
      poidsMoyenG: true,
      nombrePoissons: true,
      vague: { select: { id: true, code: true } },
      bac: { select: { id: true, nom: true } },
      lotAlevins: { select: { id: true, code: true, nombreActuel: true, poidsMoyen: true } },
    },
  },
  _count: { select: { lignes: true } },
} as const;

/** Include complet pour une vente unique */
const VENTE_DETAIL_INCLUDE = {
  client: true,
  vague: { select: { id: true, code: true, statut: true } },
  uniteProduction: { select: { id: true, code: true, nom: true, type: true } },
  user: { select: { id: true, name: true } },
  facture: {
    include: {
      paiements: { orderBy: { date: "desc" as const } },
    },
  },
  bonLivraison: { select: { id: true, numero: true, statut: true } },
  lignes: {
    select: {
      id: true,
      vagueId: true,
      bacId: true,
      lotAlevinsId: true,
      poidsTotalKg: true,
      poidsMoyenG: true,
      nombrePoissons: true,
      vague: { select: { id: true, code: true } },
      bac: { select: { id: true, nom: true } },
      lotAlevins: { select: { id: true, code: true, nombreActuel: true, poidsMoyen: true, phase: true } },
    },
  },
  releves: {
    select: {
      id: true,
      typeReleve: true,
      date: true,
      nombreVendus: true,
      nombreMorts: true,
      causeMortalite: true,
      notes: true,
      bac: { select: { id: true, nom: true } },
      vague: { select: { id: true, code: true } },
    },
    orderBy: { date: "asc" as const },
  },
  depenses: {
    select: {
      id: true,
      numero: true,
      date: true,
      description: true,
      categorieDepense: true,
      montantTotal: true,
      montantPaye: true,
      statut: true,
    },
    orderBy: { date: "desc" as const },
  },
} as const;

// ---------------------------------------------------------------------------
// Read helpers
// ---------------------------------------------------------------------------

/** Liste les ventes d'un site avec filtres et pagination */
export async function getVentes(
  siteId: string,
  filters?: VenteFilters,
  pagination?: { limit: number; offset: number }
) {
  const where = {
    siteId,
    ...(filters?.clientId && { clientId: filters.clientId }),
    // Pour multi-vague : chercher parmi les lignes plutot que sur vagueId direct
    ...(filters?.vagueId && {
      lignes: { some: { vagueId: filters.vagueId } },
    }),
    ...(filters?.dateFrom || filters?.dateTo
      ? {
          createdAt: {
            ...(filters.dateFrom && { gte: new Date(filters.dateFrom) }),
            ...(filters.dateTo && { lte: new Date(filters.dateTo) }),
          },
        }
      : {}),
  };

  const limit = pagination?.limit ?? 50;
  const offset = pagination?.offset ?? 0;

  const [data, total] = await Promise.all([
    prisma.vente.findMany({
      where,
      include: VENTE_LIST_INCLUDE,
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    }),
    prisma.vente.count({ where }),
  ]);

  return { data, total };
}

/** Recupere une vente par ID avec ses relations completes */
export async function getVenteById(id: string, siteId: string) {
  return prisma.vente.findFirst({
    where: { id, siteId },
    include: VENTE_DETAIL_INCLUDE,
  });
}

// ---------------------------------------------------------------------------
// Helpers internes
// ---------------------------------------------------------------------------

/**
 * Resout le poidsMoyenG pour un bac donne en cherchant le dernier releve BIOMETRIE.
 * Retourne null si aucune biometrie n'est trouvee pour ce bac.
 */
async function resolvePoidsMoyenG(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  bacId: string,
  vagueId: string,
  siteId: string
): Promise<number | null> {
  const latestBio = await tx.releve.findFirst({
    where: {
      bacId,
      vagueId,
      siteId,
      typeReleve: TypeReleve.BIOMETRIE,
      poidsMoyen: { not: null },
    },
    orderBy: { date: "desc" },
    select: { poidsMoyen: true },
  });
  return latestBio?.poidsMoyen ?? null;
}

/**
 * Valide et enrichit une ligne de vente.
 * Verifie : vague, bac dans la vague, poidsMoyenG disponible, stock suffisant.
 * Retourne { poidsMoyenG, nombrePoissons, bacNom }.
 */
async function validateAndEnrichLigne(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  ligne: CreateLigneVenteDTO,
  siteId: string
): Promise<{ poidsMoyenG: number; nombrePoissons: number; bacNom: string }> {
  // Valider la vague
  const vague = await tx.vague.findFirst({
    where: { id: ligne.vagueId, siteId },
    select: { id: true, statut: true },
  });
  if (!vague) throw new Error(`Vague ${ligne.vagueId} introuvable`);
  if (vague.statut === StatutVague.ANNULEE) {
    throw new Error(`Impossible de vendre depuis une vague annulee (${ligne.vagueId})`);
  }

  // Valider le bac appartient a cette vague via AssignationBac active
  const assignation = await tx.assignationBac.findFirst({
    where: { bacId: ligne.bacId, vagueId: ligne.vagueId, dateFin: null },
    select: { nombreActuel: true },
  });
  const bac = await tx.bac.findFirst({
    where: { id: ligne.bacId, siteId },
    select: { id: true, nom: true },
  });
  if (!bac) throw new Error(`Bac ${ligne.bacId} introuvable`);
  if (!assignation) {
    throw new Error(
      `Le bac "${bac.nom}" n'est pas actuellement assigne a la vague specifie`
    );
  }

  // Resoudre poidsMoyenG : DTO en priorite, sinon derniere biometrie du bac
  let poidsMoyenG = ligne.poidsMoyenG ?? null;
  if (poidsMoyenG == null || poidsMoyenG <= 0) {
    poidsMoyenG = await resolvePoidsMoyenG(tx, ligne.bacId, ligne.vagueId, siteId);
    if (poidsMoyenG == null) {
      throw new Error(
        `Aucune biometrie disponible pour le bac "${bac.nom}". ` +
          `Enregistrez une biometrie ou saisissez le poids moyen manuellement.`
      );
    }
  }

  // Calculer le nombre de poissons
  const nombrePoissons = Math.max(
    1,
    Math.round((ligne.poidsTotalKg * 1000) / poidsMoyenG)
  );

  // Verifier le stock via AssignationBac.nombreActuel (source de verite ADR-043)
  const disponible = assignation.nombreActuel ?? 0;
  if (nombrePoissons > disponible) {
    throw new Error(
      `Stock insuffisant dans "${bac.nom}" : disponible ${disponible}, calcule ${nombrePoissons} ` +
        `(${ligne.poidsTotalKg} kg / ${poidsMoyenG} g)`
    );
  }

  return { poidsMoyenG, nombrePoissons, bacNom: bac.nom };
}

/**
 * Applique les deductions de stock et cree les releves VENTE pour un ensemble de lignes.
 * Pattern commun entre createVente et updateVente.
 */
async function applyLignesStock(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  venteId: string,
  venteNumero: string,
  lignesEnrichies: Array<{
    ligne: CreateLigneVenteDTO;
    poidsMoyenG: number;
    nombrePoissons: number;
    bacNom: string;
  }>,
  venteDate: Date,
  siteId: string,
  userId: string
): Promise<void> {
  for (const { ligne, poidsMoyenG, nombrePoissons, bacNom } of lignesEnrichies) {
    // ADR-043 : lire AssignationBac.nombreActuel comme source de verite
    // (peut avoir change depuis la validation si plusieurs lignes du meme bac)
    const assignation = await tx.assignationBac.findFirst({
      where: { bacId: ligne.bacId, vagueId: ligne.vagueId, dateFin: null },
      select: { nombreActuel: true },
    });
    const currentCount = assignation?.nombreActuel ?? 0;
    const newCount = Math.max(0, currentCount - nombrePoissons);

    // ADR-043 Phase 3 : AssignationBac est la seule source de verite
    await tx.assignationBac.updateMany({
      where: { bacId: ligne.bacId, vagueId: ligne.vagueId, dateFin: null },
      data: { nombreActuel: newCount },
    });

    // Creer la LigneVente
    await tx.ligneVente.create({
      data: {
        venteId,
        vagueId: ligne.vagueId,
        bacId: ligne.bacId,
        poidsTotalKg: ligne.poidsTotalKg,
        poidsMoyenG,
        nombrePoissons,
        siteId,
      },
    });

    // Creer le releve VENTE pour la tracabilite sur la timeline de la vague
    await tx.releve.create({
      data: {
        date: venteDate,
        typeReleve: TypeReleve.VENTE,
        vagueId: ligne.vagueId,
        bacId: ligne.bacId,
        siteId,
        userId,
        nombreVendus: nombrePoissons,
        venteId,
        notes: `Vente ${venteNumero} — ${nombrePoissons} poissons (${bacNom})`,
      },
    });
  }
}

// ---------------------------------------------------------------------------
// createVente
// ---------------------------------------------------------------------------

/**
 * Cree une vente multi-vague multi-bac (transaction atomique).
 *
 * Flux :
 * 1. Valider le client
 * 2. Pour chaque ligne : valider vague, bac, resoudre poidsMoyenG, verifier stock
 * 3. Calculer les agregats (poidsTotalKg, quantitePoissons, montantTotal)
 * 4. Generer le numero
 * 5. Creer la Vente avec vagueId: null (multi-vague)
 * 6. Creer les LigneVente + deduire stock + creer releves VENTE
 */
export async function createVente(
  siteId: string,
  userId: string,
  data: CreateVenteDTO
) {
  return prisma.$transaction(async (tx) => {
    // Etape 1 : Valider le client
    const client = await tx.client.findFirst({
      where: { id: data.clientId, siteId, isActive: true },
    });
    if (!client) throw new Error("Client introuvable ou inactif");

    if (!data.lignes || data.lignes.length === 0) {
      throw new Error("Au moins une ligne de vente est requise");
    }

    // Etape 2 : Valider et enrichir toutes les lignes
    const lignesEnrichies: Array<{
      ligne: CreateLigneVenteDTO;
      poidsMoyenG: number;
      nombrePoissons: number;
      bacNom: string;
    }> = [];

    for (const ligne of data.lignes) {
      const enriched = await validateAndEnrichLigne(tx, ligne, siteId);
      lignesEnrichies.push({ ligne, ...enriched });
    }

    // Etape 3 : Calculer les agregats
    const poidsTotalKg = lignesEnrichies.reduce(
      (sum, { ligne }) => sum + ligne.poidsTotalKg,
      0
    );
    const quantitePoissons = lignesEnrichies.reduce(
      (sum, { nombrePoissons }) => sum + nombrePoissons,
      0
    );
    const montantTotal = poidsTotalKg * data.prixUnitaireKg;
    const venteDate = data.dateCommande ? new Date(data.dateCommande) : new Date();

    // Etape 4 : Generer le numero
    const numero = await generateNextNumero(tx, "vente", "VTE", siteId);

    // Etape 5 : Creer la vente (vagueId: null pour multi-vague)
    // Prisma 7 prisma-client: create without include to avoid relation constraints,
    // then fetch with include after all lignes are created.
    const venteRaw = await tx.vente.create({
      data: {
        numero,
        clientId: data.clientId,
        vagueId: null,
        uniteProductionId: data.uniteProductionId ?? null,
        quantitePoissons,
        poidsTotalKg,
        prixUnitaireKg: data.prixUnitaireKg,
        montantTotal,
        dateCommande: venteDate,
        statut: StatutVente.EN_PREPARATION,
        notes: data.notes ?? null,
        userId,
        siteId,
      },
    });

    // Etape 6 : Creer LigneVente, deduire stock, creer releves VENTE
    await applyLignesStock(
      tx,
      venteRaw.id,
      numero,
      lignesEnrichies,
      venteDate,
      siteId,
      userId
    );

    // Etape 7 : Recharger la vente avec toutes ses relations
    const vente = await tx.vente.findUniqueOrThrow({
      where: { id: venteRaw.id },
      include: VENTE_LIST_INCLUDE,
    });

    // Guard post-écriture — vérifie l'invariant sur les bacs vendus (par vague)
    // Grouper les bacs par vagueId pour appeler verifyAssignationInvariant une fois par vague
    const venteVagueBacMap = new Map<string, Set<string>>();
    for (const { ligne } of lignesEnrichies) {
      if (!venteVagueBacMap.has(ligne.vagueId)) {
        venteVagueBacMap.set(ligne.vagueId, new Set());
      }
      venteVagueBacMap.get(ligne.vagueId)!.add(ligne.bacId);
    }
    for (const [vgId, bacSet] of venteVagueBacMap.entries()) {
      await verifyAssignationInvariant(tx, siteId, vgId, [...bacSet]);
    }

    return vente;
  });
}

// ---------------------------------------------------------------------------
// createVenteAlevins — Vente d'alevins depuis une unite de reproduction
// ---------------------------------------------------------------------------

/**
 * Cree une vente d'alevins (reproduction) — transaction atomique.
 *
 * Flux :
 * 1. Valider client et unite de production (type REPRODUCTION)
 * 2. Pour chaque ligne : valider lot, verifier stock (nombreActuel >= quantite)
 * 3. Calculer les agregats (quantitePoissons, poidsTotalKg estime, montantTotal)
 * 4. Generer le numero
 * 5. Creer la Vente avec uniteProductionId
 * 6. Creer les LigneVente avec lotAlevinsId, deduire nombreActuel
 * 7. Marquer les lots entierement vendus comme SORTI/VENTE_ALEVINS
 */
export async function createVenteAlevins(
  siteId: string,
  userId: string,
  data: CreateVenteAlevinsDTO
) {
  return prisma.$transaction(async (tx) => {
    // 1. Valider le client
    const client = await tx.client.findFirst({
      where: { id: data.clientId, siteId, isActive: true },
    });
    if (!client) throw new Error("Client introuvable ou inactif");

    // Valider l'unite de production (doit etre REPRODUCTION)
    const unite = await tx.uniteProduction.findFirst({
      where: { id: data.uniteProductionId, siteId, isActive: true },
    });
    if (!unite) throw new Error("Unite de production introuvable ou inactive");
    if (unite.type !== TypeUniteProduction.REPRODUCTION) {
      throw new Error("L'unite de production doit etre de type REPRODUCTION pour une vente d'alevins");
    }

    if (!data.lignes || data.lignes.length === 0) {
      throw new Error("Au moins une ligne de vente est requise");
    }

    // 2. Valider et enrichir les lignes
    const lignesEnrichies: Array<{
      lotAlevinsId: string;
      nombrePoissons: number;
      poidsMoyenG: number;
      poidsTotalKg: number;
      lotCode: string;
    }> = [];

    for (const ligne of data.lignes) {
      const lot = await tx.lotAlevins.findFirst({
        where: { id: ligne.lotAlevinsId, siteId },
      });
      if (!lot) throw new Error(`Lot d'alevins introuvable: ${ligne.lotAlevinsId}`);
      if (lot.statut === StatutLotAlevins.TRANSFERE || lot.statut === StatutLotAlevins.PERDU) {
        throw new Error(`Le lot ${lot.code} n'est plus disponible (statut: ${lot.statut})`);
      }
      if (lot.nombreActuel < ligne.nombrePoissons) {
        throw new Error(
          `Stock insuffisant sur le lot ${lot.code}: ${lot.nombreActuel} disponibles, ${ligne.nombrePoissons} demandes`
        );
      }

      const poidsMoyenG = lot.poidsMoyen ?? 0;
      const poidsTotalKg = (ligne.nombrePoissons * poidsMoyenG) / 1000;

      lignesEnrichies.push({
        lotAlevinsId: ligne.lotAlevinsId,
        nombrePoissons: ligne.nombrePoissons,
        poidsMoyenG,
        poidsTotalKg,
        lotCode: lot.code,
      });
    }

    // 3. Calculer les agregats
    const quantitePoissons = lignesEnrichies.reduce((sum, l) => sum + l.nombrePoissons, 0);
    const poidsTotalKg = lignesEnrichies.reduce((sum, l) => sum + l.poidsTotalKg, 0);
    // prixUnitaire = prix par alevin, montant = quantite * prixUnitaire
    const montantTotal = quantitePoissons * data.prixUnitaire;
    const venteDate = data.dateCommande ? new Date(data.dateCommande) : new Date();

    // 4. Generer le numero
    const numero = await generateNextNumero(tx, "vente", "VTE", siteId);

    // 5. Creer la vente
    const venteRaw = await tx.vente.create({
      data: {
        numero,
        clientId: data.clientId,
        vagueId: null,
        uniteProductionId: data.uniteProductionId,
        quantitePoissons,
        poidsTotalKg,
        // prixUnitaireKg stocke le prix unitaire (par alevin pour reproduction)
        prixUnitaireKg: data.prixUnitaire,
        montantTotal,
        dateCommande: venteDate,
        statut: StatutVente.EN_PREPARATION,
        notes: data.notes ?? null,
        userId,
        siteId,
      },
    });

    // 6. Creer les LigneVente et deduire stock sur les lots
    for (const ligneData of lignesEnrichies) {
      await tx.ligneVente.create({
        data: {
          venteId: venteRaw.id,
          lotAlevinsId: ligneData.lotAlevinsId,
          vagueId: null,
          bacId: null,
          poidsTotalKg: ligneData.poidsTotalKg,
          poidsMoyenG: ligneData.poidsMoyenG,
          nombrePoissons: ligneData.nombrePoissons,
          siteId,
        },
      });

      // Deduire nombreActuel sur le lot
      const updated = await tx.lotAlevins.update({
        where: { id: ligneData.lotAlevinsId },
        data: {
          nombreActuel: { decrement: ligneData.nombrePoissons },
        },
      });

      // 7. Si lot entierement vendu, marquer comme SORTI
      if (updated.nombreActuel <= 0) {
        await tx.lotAlevins.update({
          where: { id: ligneData.lotAlevinsId },
          data: {
            statut: StatutLotAlevins.TRANSFERE,
            phase: PhaseLot.SORTI,
            destinationSortie: "VENTE_ALEVINS",
            dateTransfert: venteDate,
          },
        });
      }
    }

    // Recharger la vente avec relations
    const vente = await tx.vente.findUniqueOrThrow({
      where: { id: venteRaw.id },
      include: VENTE_LIST_INCLUDE,
    });

    return vente;
  });
}

// ---------------------------------------------------------------------------
// createVenteAlevinsDepuisVague — Sprint VA
// Vente des poissons restants d'une vague PRE_GROSSISSEMENT comme alevins.
// Reutilise l'infrastructure Vente/LigneVente avec origineType = ALEVINS_PG.
// ---------------------------------------------------------------------------

/** Types de releve pris en compte pour le calcul des vivants par bac (ADR-046 pattern). */
const RELEVES_VIVANTS_TYPES = [
  TypeReleve.MORTALITE,
  TypeReleve.COMPTAGE,
  TypeReleve.ARRIVAGE,
  TypeReleve.TRANSFERT,
  TypeReleve.VENTE,
] as const;

/**
 * Cree une vente d'alevins depuis une vague PRE_GROSSISSEMENT (transaction atomique).
 *
 * Flux :
 * 1. Valider la vague (type PRE_GROSSISSEMENT, statut EN_COURS)
 * 2. Valider le client
 * 3. Charger les vivants reels par bac (computeVivantsByBac + transfertGroupesById)
 * 4. Valider chaque ligne (bac assigne, stock disponible, valeurs > 0)
 * 5. Creer la Vente (origineType = ALEVINS_PG) + LigneVente + decrementer AssignationBac
 *    + creer les releves VENTE de tracabilite
 * 6. Guard verifyAssignationInvariant
 * 7. Creer les depenses liees (optionnel)
 * 8. Auto-cloture de la vague si tous les bacs sont vides (optionnel)
 */
export async function createVenteAlevinsDepuisVague(
  siteId: string,
  userId: string,
  data: CreateVenteAlevinsDepuisVagueDTO
) {
  // === PHASE 1 — Lecture + validation HORS transaction (parallélisé) ===
  // Objectif : minimiser le temps passé dans la $transaction (défaut 5s).
  // Le guard verifyAssignationInvariant en fin de transaction rattrape toute
  // race condition (ex. vente concurrente sur les mêmes bacs).
  const [vague, client, assignationsBacs, relevesVague, transfertGroupesById] = await Promise.all([
    prisma.vague.findFirst({
      where: { id: data.vagueId, siteId },
      select: { id: true, code: true, type: true, statut: true, nombreInitial: true },
    }),
    prisma.client.findFirst({
      where: { id: data.clientId, siteId, isActive: true },
    }),
    prisma.assignationBac.findMany({
      where: { vagueId: data.vagueId, siteId, dateFin: null },
      select: {
        bacId: true,
        nombreInitial: true,
        nombreActuel: true,
        bac: { select: { nom: true } },
      },
    }),
    prisma.releve.findMany({
      where: {
        siteId,
        vagueId: data.vagueId,
        typeReleve: { in: [...RELEVES_VIVANTS_TYPES] },
      },
      orderBy: { date: "asc" },
      select: {
        bacId: true,
        typeReleve: true,
        nombreMorts: true,
        nombreVendus: true,
        nombreTransferes: true,
        nombreCompte: true,
        date: true,
        transfertGroupeId: true,
      },
    }),
    getTransfertGroupesByVague(siteId, data.vagueId),
  ]);

  if (!vague) throw new ValidationError("Vague introuvable");
  if (vague.type !== TypeVague.PRE_GROSSISSEMENT) {
    throw new ValidationError(
      `La vente d'alevins depuis une vague n'est possible que pour une vague PRE_GROSSISSEMENT (vague ${vague.code})`
    );
  }
  if (vague.statut !== StatutVague.EN_COURS) {
    throw new ValidationError(
      `La vague ${vague.code} n'est pas en cours (statut actuel : ${vague.statut})`
    );
  }
  if (!client) throw new Error("Client introuvable ou inactif");
  if (!data.lignes || data.lignes.length === 0) {
    throw new ValidationError("Au moins une ligne de vente est requise");
  }

  const assignationParBac = new Map(assignationsBacs.map((a) => [a.bacId, a]));
  const bacsForCalc = assignationsBacs.map((a) => ({
    id: a.bacId,
    nombreInitial: a.nombreInitial ?? null,
  }));
  const vivantsByBac = computeVivantsByBac(
    bacsForCalc,
    relevesVague,
    vague.nombreInitial,
    { transfertGroupesById }
  );

  // Valider et enrichir chaque ligne (en mémoire, aucune I/O)
  const lignesEnrichies: Array<{
    bacId: string;
    nombrePoissons: number;
    poidsMoyenG: number;
    poidsTotalKg: number;
    montantLigne: number;
    bacNom: string;
  }> = [];

  for (const ligne of data.lignes) {
    const assignation = assignationParBac.get(ligne.bacId);
    if (!assignation) {
      throw new ValidationError(
        `Le bac ${ligne.bacId} n'a pas d'assignation active sur la vague ${vague.code}`
      );
    }
    if (!Number.isFinite(ligne.nombrePoissons) || ligne.nombrePoissons <= 0) {
      throw new ValidationError("nombrePoissons doit etre superieur a 0");
    }
    if (!Number.isFinite(ligne.poidsMoyenG) || ligne.poidsMoyenG <= 0) {
      throw new ValidationError("poidsMoyenG doit etre superieur a 0");
    }
    if (!Number.isFinite(ligne.prixUnitaireKg) || ligne.prixUnitaireKg < 0) {
      throw new ValidationError("prixUnitaireKg ne peut pas etre negatif");
    }

    const disponible = vivantsByBac.get(ligne.bacId) ?? 0;
    if (ligne.nombrePoissons > disponible) {
      throw new Error(
        `Stock insuffisant dans "${assignation.bac.nom}" : disponible ${disponible}, demande ${ligne.nombrePoissons}`
      );
    }

    const poidsTotalKg = (ligne.nombrePoissons * ligne.poidsMoyenG) / 1000;
    const montantLigne = poidsTotalKg * ligne.prixUnitaireKg;

    lignesEnrichies.push({
      bacId: ligne.bacId,
      nombrePoissons: ligne.nombrePoissons,
      poidsMoyenG: ligne.poidsMoyenG,
      poidsTotalKg,
      montantLigne,
      bacNom: assignation.bac.nom,
    });
  }

  const quantitePoissons = lignesEnrichies.reduce((sum, l) => sum + l.nombrePoissons, 0);
  const poidsTotalKg = lignesEnrichies.reduce((sum, l) => sum + l.poidsTotalKg, 0);
  const montantTotal = lignesEnrichies.reduce((sum, l) => sum + l.montantLigne, 0);
  const prixUnitaireKg = poidsTotalKg > 0 ? montantTotal / poidsTotalKg : 0;
  const venteDate = new Date(data.dateCommande);

  // === PHASE 2 — Écritures dans la transaction ===
  return prisma.$transaction(async (tx) => {
    const numero = await generateNextNumero(tx, "vente", "VTE", siteId);

    const venteRaw = await tx.vente.create({
      data: {
        numero,
        clientId: data.clientId,
        vagueId: data.vagueId,
        uniteProductionId: null,
        quantitePoissons,
        poidsTotalKg,
        prixUnitaireKg,
        montantTotal,
        dateCommande: venteDate,
        statut: StatutVente.EN_PREPARATION,
        origineType: OrigineVente.ALEVINS_PG,
        dateLivraison: venteDate,
        notes: data.notes ?? null,
        userId,
        siteId,
      },
    });

    // Batch createMany : 1 round-trip pour toutes les LigneVente
    await tx.ligneVente.createMany({
      data: lignesEnrichies.map((ligne) => ({
        venteId: venteRaw.id,
        vagueId: data.vagueId,
        bacId: ligne.bacId,
        poidsTotalKg: ligne.poidsTotalKg,
        poidsMoyenG: ligne.poidsMoyenG,
        nombrePoissons: ligne.nombrePoissons,
        siteId,
      })),
    });

    // Batch createMany : 1 round-trip pour tous les relevés VENTE
    await tx.releve.createMany({
      data: lignesEnrichies.map((ligne) => ({
        date: venteDate,
        typeReleve: TypeReleve.VENTE,
        vagueId: data.vagueId,
        bacId: ligne.bacId,
        siteId,
        userId,
        nombreVendus: ligne.nombrePoissons,
        venteId: venteRaw.id,
        notes: `Vente alevins ${numero} — ${ligne.nombrePoissons} alevins (${ligne.bacNom})`,
      })),
    });

    // Décrémenter AssignationBac (loop séquentiel — pas d'équivalent batch en Prisma
    // pour des valeurs distinctes par ligne). N updates courts.
    for (const ligne of lignesEnrichies) {
      const currentCount = assignationParBac.get(ligne.bacId)!.nombreActuel ?? 0;
      const newCount = Math.max(0, currentCount - ligne.nombrePoissons);
      await tx.assignationBac.updateMany({
        where: { bacId: ligne.bacId, vagueId: data.vagueId, dateFin: null },
        data: { nombreActuel: newCount },
      });
    }

    // 6. Guard post-ecriture — verifie l'invariant sur les bacs vendus
    const bacIds = [...new Set(lignesEnrichies.map((l) => l.bacId))];
    await verifyAssignationInvariant(tx, siteId, data.vagueId, bacIds);

    // 7. Depenses liees a la vente (optionnel)
    if (data.depenses && data.depenses.length > 0) {
      for (const dep of data.depenses) {
        const depNumero = await generateNextNumero(tx, "depense", "DEP", siteId);
        const montantPaye = dep.montantPaye ?? 0;
        let statutDepense: StatutDepense;
        if (montantPaye >= dep.montantTotal && dep.montantTotal > 0) {
          statutDepense = StatutDepense.PAYEE;
        } else if (montantPaye > 0) {
          statutDepense = StatutDepense.PAYEE_PARTIELLEMENT;
        } else {
          statutDepense = StatutDepense.NON_PAYEE;
        }

        await tx.depense.create({
          data: {
            numero: depNumero,
            description: dep.description,
            categorieDepense: dep.categorieDepense,
            montantTotal: dep.montantTotal,
            montantPaye,
            statut: statutDepense,
            date: venteDate,
            venteId: venteRaw.id,
            vagueId: null,
            notes: dep.notes ?? null,
            userId,
            siteId,
          },
        });
      }
    }

    // 8. Auto-cloture de la vague si tous les bacs sont vides apres la vente
    // Calcul en mémoire (pas de re-query) : vivantsApres = vivantsAvant - vendus par bac
    if (data.autoCloture === true) {
      const vendusParBac = new Map<string, number>();
      for (const ligne of lignesEnrichies) {
        vendusParBac.set(ligne.bacId, (vendusParBac.get(ligne.bacId) ?? 0) + ligne.nombrePoissons);
      }
      let totalVivantsApres = 0;
      for (const [bacId, vivantsAvant] of vivantsByBac) {
        const vendus = vendusParBac.get(bacId) ?? 0;
        totalVivantsApres += Math.max(0, vivantsAvant - vendus);
      }

      if (totalVivantsApres === 0) {
        await tx.assignationBac.updateMany({
          where: { vagueId: data.vagueId, siteId, dateFin: null },
          data: { dateFin: venteDate },
        });
        await tx.vague.update({
          where: { id: data.vagueId },
          data: { statut: StatutVague.TERMINEE, dateFin: venteDate },
        });
      }
    }

    // 9. Retourner la vente avec ses relations
    return tx.vente.findUniqueOrThrow({
      where: { id: venteRaw.id },
      include: VENTE_LIST_INCLUDE,
    });
  });
}

// ---------------------------------------------------------------------------
// updateVente
// ---------------------------------------------------------------------------

/**
 * Modifie une vente existante (transaction atomique).
 *
 * Si dto.lignes est fourni :
 *   1. Supprimer les anciens releves VENTE
 *   2. Restituer les poissons de chaque ancienne LigneVente
 *   3. Supprimer les anciennes LigneVente
 *   4. Appliquer les nouvelles lignes (meme logique que createVente)
 *   5. Recalculer les agregats
 *
 * Si dto.lignes n'est pas fourni : mettre a jour les champs simples uniquement.
 * La facture et le SiteAuditLog sont toujours mis a jour.
 */
export async function updateVente(
  venteId: string,
  siteId: string,
  userId: string,
  dto: UpdateVenteDTO
) {
  return prisma.$transaction(async (tx) => {
    // Charger la vente avec ses lignes
    const existing = await tx.vente.findFirst({
      where: { id: venteId, siteId },
      include: {
        facture: { select: { id: true } },
        vague: { select: { id: true, code: true } },
        client: { select: { id: true, nom: true } },
        lignes: true,
      },
    });
    if (!existing) throw new Error("Vente introuvable");

    if (existing.statut === StatutVente.CLOTUREE) {
      throw new Error("Une vente cloturee ne peut plus etre modifiee");
    }

    const newClientId = dto.clientId ?? existing.clientId;
    const newPrixUnitaireKg = dto.prixUnitaireKg ?? existing.prixUnitaireKg;
    const newNotes = dto.notes !== undefined ? dto.notes : existing.notes;
    const newDateCommande = dto.dateCommande
      ? new Date(dto.dateCommande)
      : existing.dateCommande;

    // Valider le nouveau client si change
    if (newClientId !== existing.clientId) {
      const client = await tx.client.findFirst({
        where: { id: newClientId, siteId, isActive: true },
      });
      if (!client) throw new Error("Client introuvable ou inactif");
    }

    let newPoidsTotalKg = existing.poidsTotalKg;
    let newQuantitePoissons = existing.quantitePoissons;

    if (dto.lignes && dto.lignes.length > 0) {
      // --- Restitution des poissons des anciennes lignes ---
      // Supprimer d'abord les releves VENTE lies a cette vente
      await tx.releve.deleteMany({ where: { venteId } });

      // Restituer le stock de chaque ancienne LigneVente
      for (const oldLigne of existing.lignes) {
        // Lignes reproduction (lotAlevinsId set, pas de bacId) — gerer separement
        if (!oldLigne.bacId || !oldLigne.vagueId) continue;

        // ADR-043 : lire AssignationBac.nombreActuel comme source de verite
        const assignation = await tx.assignationBac.findFirst({
          where: { bacId: oldLigne.bacId, vagueId: oldLigne.vagueId, dateFin: null },
          select: { nombreActuel: true },
        });
        const currentCount = assignation?.nombreActuel ?? 0;
        const restoredCount = currentCount + oldLigne.nombrePoissons;

        // ADR-043 Phase 3 : AssignationBac seule source de verite
        await tx.assignationBac.updateMany({
          where: {
            bacId: oldLigne.bacId,
            vagueId: oldLigne.vagueId,
            dateFin: null,
          },
          data: { nombreActuel: restoredCount },
        });
      }

      // Supprimer les anciennes LigneVente (la contrainte cascade s'en charge aussi,
      // mais on le fait explicitement pour garder le controle)
      await tx.ligneVente.deleteMany({ where: { venteId } });

      // --- Valider et enrichir les nouvelles lignes ---
      const lignesEnrichies: Array<{
        ligne: CreateLigneVenteDTO;
        poidsMoyenG: number;
        nombrePoissons: number;
        bacNom: string;
      }> = [];

      for (const ligne of dto.lignes) {
        const enriched = await validateAndEnrichLigne(tx, ligne, siteId);
        lignesEnrichies.push({ ligne, ...enriched });
      }

      // Recalculer les agregats
      newPoidsTotalKg = lignesEnrichies.reduce(
        (sum, { ligne }) => sum + ligne.poidsTotalKg,
        0
      );
      newQuantitePoissons = lignesEnrichies.reduce(
        (sum, { nombrePoissons }) => sum + nombrePoissons,
        0
      );

      // Appliquer le nouveau stock + creer LigneVente + releves VENTE
      await applyLignesStock(
        tx,
        venteId,
        existing.numero,
        lignesEnrichies,
        newDateCommande,
        siteId,
        userId
      );
    } else {
      // Pas de modification de lignes — synchroniser juste les dates si besoin
      if (newDateCommande.getTime() !== existing.dateCommande.getTime()) {
        await tx.releve.updateMany({
          where: { venteId },
          data: { date: newDateCommande },
        });
      }
    }

    const newMontantTotal = newPoidsTotalKg * newPrixUnitaireKg;

    // Mettre a jour la vente
    // Prisma 7 prisma-client: update without include, then fetch separately
    await tx.vente.update({
      where: { id: venteId },
      data: {
        clientId: newClientId,
        prixUnitaireKg: newPrixUnitaireKg,
        poidsTotalKg: newPoidsTotalKg,
        quantitePoissons: newQuantitePoissons,
        montantTotal: newMontantTotal,
        dateCommande: newDateCommande,
        notes: newNotes,
      },
    });

    const updated = await tx.vente.findUniqueOrThrow({
      where: { id: venteId },
      include: {
        client: { select: { id: true, nom: true } },
        vague: { select: { id: true, code: true } },
        user: { select: { id: true, name: true } },
        facture: {
          select: {
            id: true,
            numero: true,
            statut: true,
            montantPaye: true,
            montantTotal: true,
          },
        },
        lignes: {
          select: {
            id: true,
            vagueId: true,
            bacId: true,
            poidsTotalKg: true,
            poidsMoyenG: true,
            nombrePoissons: true,
            vague: { select: { id: true, code: true } },
            bac: { select: { id: true, nom: true } },
          },
        },
      },
    });

    // Mettre a jour la facture si le montant change
    if (existing.facture && newMontantTotal !== existing.montantTotal) {
      await tx.facture.update({
        where: { id: existing.facture.id },
        data: { montantTotal: newMontantTotal },
      });
    }

    // Extraire les codes vagues des lignes pour l'audit log
    const oldVagueCodes = [
      ...new Set(existing.lignes.map((l) => l.vagueId)),
    ];
    const newVagueCodes = [
      ...new Set(updated.lignes.map((l) => l.vague?.code ?? null).filter((c): c is string => c !== null)),
    ];

    // Audit log
    await tx.siteAuditLog.create({
      data: {
        siteId,
        actorId: userId,
        action: "VENTE_MODIFIEE",
        details: {
          motif: dto.motif,
          before: {
            clientId: existing.clientId,
            clientNom: existing.client.nom,
            vagueCodes: oldVagueCodes,
            poidsTotalKg: existing.poidsTotalKg,
            prixUnitaireKg: existing.prixUnitaireKg,
            quantitePoissons: existing.quantitePoissons,
            montantTotal: existing.montantTotal,
            dateCommande: existing.dateCommande,
            notes: existing.notes,
            nbLignes: existing.lignes.length,
          },
          after: {
            clientId: updated.clientId,
            clientNom: updated.client.nom,
            vagueCodes: newVagueCodes,
            poidsTotalKg: updated.poidsTotalKg,
            prixUnitaireKg: updated.prixUnitaireKg,
            quantitePoissons: updated.quantitePoissons,
            montantTotal: updated.montantTotal,
            dateCommande: updated.dateCommande,
            notes: updated.notes,
            nbLignes: updated.lignes.length,
          },
        },
      },
    });

    return updated;
  });
}

// ---------------------------------------------------------------------------
// deleteVente
// ---------------------------------------------------------------------------

/**
 * Supprime une vente et restaure le stock de poissons (transaction atomique).
 *
 * Flux :
 * 1. Charger la vente avec ses lignes, facture, paiements, releves VENTE
 * 2. Supprimer les paiements lies a la facture
 * 3. Supprimer la facture
 * 4. Restaurer le stock par bac en utilisant les VENTE releves (nombreVendus)
 *    qui refletent la quantite reellement deduite (= livree si cloturee, sinon commandee)
 * 5. Supprimer TOUS les releves lies a cette vente (VENTE + AVARIE)
 * 6. Supprimer les LigneVente
 * 7. Supprimer la vente
 * 8. Audit log
 */
export async function deleteVente(
  venteId: string,
  siteId: string,
  userId: string
) {
  return prisma.$transaction(async (tx) => {
    const vente = await tx.vente.findFirst({
      where: { id: venteId, siteId },
      include: {
        client: { select: { nom: true } },
        facture: { select: { id: true } },
        lignes: true,
      },
    });
    if (!vente) throw new Error("Vente introuvable");

    if (vente.statut === StatutVente.CLOTUREE) {
      throw new Error("Une vente cloturee ne peut pas etre supprimee");
    }

    // 1. Supprimer les paiements lies a la facture
    if (vente.facture) {
      await tx.paiement.deleteMany({ where: { factureId: vente.facture.id } });
      await tx.facture.delete({ where: { id: vente.facture.id } });
    }

    // 2. Charger TOUS les releves lies a cette vente pour calculer le total a restaurer par bac.
    //    - VENTE releves : nombreVendus = poissons vendus (livres)
    //    - AVARIE releves (venteId set) : nombreMorts = poissons morts en transport
    //    Total a restaurer = vendus + morts = total commande (= ce qui a ete deduit du bac)
    const allVenteReleves = await tx.releve.findMany({
      where: { venteId },
      select: { bacId: true, vagueId: true, typeReleve: true, nombreVendus: true, nombreMorts: true },
    });

    // Agreger par bac+vague
    const restoreMap = new Map<string, { vagueId: string; toRestore: number }>();
    for (const r of allVenteReleves) {
      if (!r.bacId) continue;
      const key = `${r.bacId}__${r.vagueId}`;
      // VENTE releves contribute nombreVendus, MORTALITE/AVARIE contribute nombreMorts
      const count = r.typeReleve === TypeReleve.VENTE
        ? (r.nombreVendus ?? 0)
        : (r.nombreMorts ?? 0);
      const existing = restoreMap.get(key);
      if (existing) {
        existing.toRestore += count;
      } else {
        restoreMap.set(key, { vagueId: r.vagueId ?? "", toRestore: count });
      }
    }

    // 3. Restaurer le stock par bac (ADR-043 : lire AssignationBac comme source de verite)
    for (const [key, { vagueId, toRestore }] of restoreMap) {
      if (toRestore <= 0) continue;
      const bacId = key.split("__")[0];

      // ADR-043 : lire AssignationBac.nombreActuel comme source de verite
      const assignation = await tx.assignationBac.findFirst({
        where: { bacId, vagueId, dateFin: null },
        select: { nombreActuel: true },
      });
      const currentCount = assignation?.nombreActuel ?? 0;
      const restoredCount = currentCount + toRestore;

      // ADR-043 Phase 3 : AssignationBac seule source de verite
      await tx.assignationBac.updateMany({
        where: { bacId, vagueId, dateFin: null },
        data: { nombreActuel: restoredCount },
      });
    }

    // 4. Supprimer TOUS les releves lies a cette vente (VENTE + AVARIE via venteId)
    await tx.releve.deleteMany({ where: { venteId } });
    // Fallback: delete AVARIE releves from older code that didn't set venteId (matched by notes)
    await tx.releve.deleteMany({
      where: {
        siteId,
        typeReleve: TypeReleve.MORTALITE,
        causeMortalite: CauseMortalite.AVARIE,
        notes: { contains: vente.numero },
      },
    });

    // 5. Supprimer les LigneVente
    await tx.ligneVente.deleteMany({ where: { venteId } });

    // 6. Supprimer la vente
    await tx.vente.delete({ where: { id: venteId } });

    // 7. Audit log
    const vagueCodes = [...new Set(vente.lignes.map((l) => l.vagueId))];
    await tx.siteAuditLog.create({
      data: {
        siteId,
        actorId: userId,
        action: "VENTE_SUPPRIMEE",
        details: {
          venteNumero: vente.numero,
          clientNom: vente.client.nom,
          vagueIds: vagueCodes,
          poidsTotalKg: vente.poidsTotalKg,
          quantitePoissons: vente.quantitePoissons,
          montantTotal: vente.montantTotal,
          nbLignes: vente.lignes.length,
          restoredFish: Object.fromEntries(
            [...restoreMap.entries()].map(([k, v]) => [k.split("__")[0], v.toRestore])
          ),
        },
      },
    });

    return { message: "Vente supprimee avec succes" };
  });
}

// ---------------------------------------------------------------------------
// cloturerVente
// ---------------------------------------------------------------------------

/**
 * Cloture une vente apres livraison physique (transaction atomique).
 *
 * Sprint AV (Option E) — la conversion automatique kg->morts a ete
 * SUPPRIMEE. Le nombre de poissons morts en transport doit etre saisi
 * explicitement par ligne (`dto.lignes[].nombreMortsTransport`). La perte
 * de poids (deshydratation, purge) est purement comptable et ne cree
 * JAMAIS de mortalite fictive.
 *
 * 1. Valide statut EN_PREPARATION
 * 2. Pour chaque ligne : poidsLivreKg (defaut = poidsTotalKg, aucune perte)
 *    et nombreMortsTransport (defaut 0, saisi manuellement)
 * 3. Si nombreMortsTransport > 0 pour une ligne :
 *    - decremente LigneVente.nombrePoissons
 *    - decremente le releve VENTE.nombreVendus lie + trace ReleveModification
 *    - cree un releve MORTALITE cause=AVARIE (venteId, nombreMorts)
 * 4. Le stock bac (AssignationBac.nombreActuel) N'EST PAS modifie : les
 *    poissons ont deja quitte le bac physiquement a la vente
 * 5. Recalcule montantTotal sur le poids livre agrege
 * 6. Met a jour la facture et cree un SiteAuditLog
 * 7. Verifie l'invariant AssignationBac sur les bacs impactes par une avarie
 */
export async function cloturerVente(
  venteId: string,
  siteId: string,
  userId: string,
  dto: ClotureVenteDTO
) {
  return prisma.$transaction(async (tx) => {
    const vente = await tx.vente.findFirst({
      where: { id: venteId, siteId },
      include: {
        facture: { select: { id: true } },
        vague: { select: { id: true, code: true, nombreInitial: true } },
        client: { select: { id: true, nom: true } },
        lignes: true,
        bonLivraison: { select: { statut: true } },
      },
    });
    if (!vente) throw new Error("Vente introuvable");

    if (vente.statut !== StatutVente.EN_PREPARATION) {
      throw new Error("Cette vente est deja cloturee");
    }
    if (vente.lignes.length === 0) {
      throw new Error("Impossible de livrer une vente sans ligne");
    }
    // Sprint BL — guard : le bon de livraison doit etre signe avant de livrer.
    // Retrocompat : ce guard ne s'applique qu'au chemin EN_PREPARATION -> LIVREE ;
    // les ventes deja LIVREE/CLOTUREE ne repassent jamais par cette fonction.
    if (vente.bonLivraison?.statut !== StatutBonLivraison.SIGNE) {
      throw new ValidationError(
        "Le bon de livraison doit être signé avant de livrer la vente."
      );
    }

    const dateLivraison = dto.dateLivraison
      ? new Date(dto.dateLivraison)
      : new Date();

    // -------------------------------------------------------------------
    // Construire la liste effective des lignes a traiter (retrocompat)
    // -------------------------------------------------------------------
    let effectiveLignes: ClotureVenteLigneDTO[];

    if (dto.lignes && dto.lignes.length > 0) {
      effectiveLignes = dto.lignes;

      // Verifier que toutes les lignes referencees appartiennent bien a la vente
      for (const l of effectiveLignes) {
        if (!vente.lignes.some((vl) => vl.id === l.ligneVenteId)) {
          throw new ValidationError(
            `Ligne de vente introuvable dans cette vente: ${l.ligneVenteId}`
          );
        }
      }

      // Coherence avec l'agregat legacy s'il est fourni
      if (dto.poidsLivreKg !== undefined) {
        const sommeLignes = vente.lignes.reduce((sum, vl) => {
          const ligneDto = effectiveLignes.find((l) => l.ligneVenteId === vl.id);
          const poids = ligneDto?.poidsLivreKg ?? vl.poidsTotalKg;
          return sum + poids;
        }, 0);
        if (Math.abs(sommeLignes - dto.poidsLivreKg) > 0.01) {
          throw new ValidationError(
            `poidsLivreKg agrege (${dto.poidsLivreKg} kg) ne correspond pas a la somme des lignes (${sommeLignes.toFixed(2)} kg)`
          );
        }
      }
    } else {
      // Retrocompat : ancien DTO sans `lignes` -> 0 morts sur toutes les lignes.
      // eslint-disable-next-line no-console
      console.warn(
        `cloturerVente(${venteId}) : DTO sans "lignes[]" (legacy) — conversion automatique kg->morts desactivee, 0 morts transport suppose.`
      );

      if (dto.poidsLivreKg !== undefined) {
        if (dto.poidsLivreKg <= 0) {
          throw new ValidationError("Le poids livre doit etre superieur a 0");
        }
        if (dto.poidsLivreKg > vente.poidsTotalKg) {
          throw new ValidationError(
            `Le poids livre (${dto.poidsLivreKg} kg) ne peut pas depasser le poids commande (${vente.poidsTotalKg} kg)`
          );
        }
        // Distribution proportionnelle du poids livre agrege, sans aucun mort
        const totalLossKg = vente.poidsTotalKg - dto.poidsLivreKg;
        effectiveLignes = vente.lignes.map((vl, i) => {
          const isLast = i === vente.lignes.length - 1;
          const lossKg = isLast
            ? totalLossKg -
              vente.lignes
                .slice(0, -1)
                .reduce((sum, l) => sum + (l.poidsTotalKg / vente.poidsTotalKg) * totalLossKg, 0)
            : (vl.poidsTotalKg / vente.poidsTotalKg) * totalLossKg;
          return {
            ligneVenteId: vl.id,
            poidsLivreKg: Math.max(0, vl.poidsTotalKg - lossKg),
            nombreMortsTransport: 0,
          };
        });
      } else {
        // Aucune info fournie : defaut = aucune perte, aucun mort
        effectiveLignes = vente.lignes.map((vl) => ({
          ligneVenteId: vl.id,
          poidsLivreKg: vl.poidsTotalKg,
          nombreMortsTransport: 0,
        }));
      }
    }

    // -------------------------------------------------------------------
    // Traiter chaque ligne : poids livre (comptable) + morts transport (saisi)
    // -------------------------------------------------------------------
    let totalPoidsLivre = 0;
    let totalQuantiteLivree = 0;
    let totalNombreMorts = 0;
    const bacsParVague = new Map<string, Set<string>>();

    for (const ligne of vente.lignes) {
      const ligneDto = effectiveLignes.find((l) => l.ligneVenteId === ligne.id);
      const poidsLivreLigne = ligneDto?.poidsLivreKg ?? ligne.poidsTotalKg;
      const nombreMortsTransport = ligneDto?.nombreMortsTransport ?? 0;

      if (poidsLivreLigne < 0) {
        throw new ValidationError(
          `poidsLivreKg de la ligne ${ligne.id} ne peut pas etre negatif`
        );
      }
      if (nombreMortsTransport < 0) {
        throw new ValidationError(
          `nombreMortsTransport de la ligne ${ligne.id} ne peut pas etre negatif`
        );
      }
      if (nombreMortsTransport > ligne.nombrePoissons) {
        throw new ValidationError(
          `nombreMortsTransport (${nombreMortsTransport}) ne peut pas depasser le nombre de poissons de la ligne (${ligne.nombrePoissons})`
        );
      }

      let nouveauNombrePoissons = ligne.nombrePoissons;

      if (nombreMortsTransport > 0) {
        nouveauNombrePoissons = ligne.nombrePoissons - nombreMortsTransport;

        // Decrementer la ligne de vente (poissons morts = ne comptent plus comme livres)
        await tx.ligneVente.update({
          where: { id: ligne.id },
          data: { nombrePoissons: nouveauNombrePoissons, poidsLivreKg: poidsLivreLigne },
        });

        // Mettre a jour le releve VENTE lie a cette ligne + tracer la modification
        if (ligne.bacId) {
          const venteReleve = await tx.releve.findFirst({
            where: { venteId, bacId: ligne.bacId, typeReleve: TypeReleve.VENTE },
            select: { id: true, nombreVendus: true },
          });
          if (venteReleve) {
            const oldVendus = venteReleve.nombreVendus ?? 0;
            const newVendus = Math.max(0, oldVendus - nombreMortsTransport);
            await tx.releve.update({
              where: { id: venteReleve.id },
              data: { nombreVendus: newVendus, modifie: true },
            });
            await tx.releveModification.create({
              data: {
                releveId: venteReleve.id,
                userId,
                raison: "Avarie transport livraison",
                champModifie: "nombreVendus",
                ancienneValeur: String(oldVendus),
                nouvelleValeur: String(newVendus),
                siteId,
              },
            });
          }
        }

        // Releve MORTALITE cause=AVARIE : seule source de verite pour les morts transport
        await tx.releve.create({
          data: {
            date: dateLivraison,
            typeReleve: TypeReleve.MORTALITE,
            vagueId: ligne.vagueId,
            bacId: ligne.bacId,
            siteId,
            userId,
            nombreMorts: nombreMortsTransport,
            causeMortalite: CauseMortalite.AVARIE,
            venteId,
            notes:
              ligneDto?.motifAvarie ??
              `Morts transport livraison vente ${vente.numero} — ${nombreMortsTransport} poissons`,
          },
        });

        if (ligne.vagueId && ligne.bacId) {
          const set = bacsParVague.get(ligne.vagueId) ?? new Set<string>();
          set.add(ligne.bacId);
          bacsParVague.set(ligne.vagueId, set);
        }
      } else {
        await tx.ligneVente.update({
          where: { id: ligne.id },
          data: { poidsLivreKg: poidsLivreLigne },
        });
      }

      totalPoidsLivre += poidsLivreLigne;
      totalQuantiteLivree += nouveauNombrePoissons;
      totalNombreMorts += nombreMortsTransport;
    }

    const newMontantTotal = totalPoidsLivre * vente.prixUnitaireKg;
    const nombreMorts = totalNombreMorts;
    const quantiteLivree = totalQuantiteLivree;

    // Mettre a jour la vente — Prisma 7: update then fetch separately
    await tx.vente.update({
      where: { id: venteId },
      data: {
        statut: StatutVente.LIVREE,
        poidsCommandeKg: vente.poidsTotalKg,
        quantiteCommandee: vente.quantitePoissons,
        poidsLivreKg: totalPoidsLivre,
        quantiteLivree,
        poidsTotalKg: totalPoidsLivre,
        quantitePoissons: quantiteLivree,
        dateLivraison,
        montantTotal: newMontantTotal,
      },
    });

    // Guard : verifier l'invariant AssignationBac sur les bacs impactes par une avarie
    for (const [vagueId, bacIds] of bacsParVague) {
      await verifyAssignationInvariant(tx, siteId, vagueId, [...bacIds]);
    }

    const updated = await tx.vente.findUniqueOrThrow({
      where: { id: venteId },
      include: {
        client: { select: { id: true, nom: true } },
        vague: { select: { id: true, code: true } },
        user: { select: { id: true, name: true } },
        facture: {
          select: {
            id: true,
            numero: true,
            statut: true,
            montantPaye: true,
            montantTotal: true,
          },
        },
        lignes: {
          select: {
            id: true,
            vagueId: true,
            bacId: true,
            poidsTotalKg: true,
            poidsMoyenG: true,
            nombrePoissons: true,
            poidsLivreKg: true,
            vague: { select: { id: true, code: true } },
            bac: { select: { id: true, nom: true } },
          },
        },
      },
    });

    // Mettre a jour la facture si elle existe
    if (vente.facture) {
      await tx.facture.update({
        where: { id: vente.facture.id },
        data: { montantTotal: newMontantTotal },
      });
    }

    // Codes vagues sources pour l'audit log
    const vagueCodes = [...new Set(vente.lignes.map((l) => l.vagueId))];

    // Audit log
    await tx.siteAuditLog.create({
      data: {
        siteId,
        actorId: userId,
        action: "VENTE_CLOTUREE",
        details: {
          venteNumero: vente.numero,
          clientNom: vente.client.nom,
          vagueIds: vagueCodes,
          poidsCommande: vente.poidsTotalKg,
          poidsLivre: totalPoidsLivre,
          pertePoids: vente.poidsTotalKg - totalPoidsLivre,
          quantiteCommandee: vente.quantitePoissons,
          quantiteLivree,
          nombreMortsTransport: nombreMorts,
          ancienMontant: vente.montantTotal,
          nouveauMontant: newMontantTotal,
          dateLivraison: dateLivraison.toISOString(),
        },
      },
    });

    return updated;
  });
}

// ---------------------------------------------------------------------------
// cloturerDefinitivement
// ---------------------------------------------------------------------------

/**
 * Cloture definitive d'une vente (LIVREE -> CLOTUREE).
 * Etat terminal : aucune modification possible apres.
 */
export async function cloturerDefinitivement(
  venteId: string,
  siteId: string,
  userId: string
) {
  return prisma.$transaction(async (tx) => {
    const vente = await tx.vente.findFirst({
      where: { id: venteId, siteId },
      include: {
        client: { select: { nom: true } },
        vague: { select: { code: true } },
        lignes: {
          select: {
            vagueId: true,
            vague: { select: { code: true } },
          },
        },
        facture: {
          select: {
            id: true,
            statut: true,
            montantTotal: true,
            montantPaye: true,
          },
        },
      },
    });
    if (!vente) throw new Error("Vente introuvable");

    if (vente.statut !== StatutVente.LIVREE) {
      throw new Error("Seule une vente livree peut etre cloturee definitivement");
    }

    await tx.vente.update({
      where: { id: venteId },
      data: { statut: StatutVente.CLOTUREE },
    });

    const updated = await tx.vente.findUniqueOrThrow({
      where: { id: venteId },
      include: {
        client: { select: { id: true, nom: true } },
        vague: { select: { id: true, code: true } },
        user: { select: { id: true, name: true } },
        facture: {
          select: {
            id: true,
            numero: true,
            statut: true,
            montantPaye: true,
            montantTotal: true,
          },
        },
        lignes: {
          select: {
            id: true,
            vagueId: true,
            bacId: true,
            poidsTotalKg: true,
            poidsMoyenG: true,
            nombrePoissons: true,
            vague: { select: { id: true, code: true } },
            bac: { select: { id: true, nom: true } },
          },
        },
      },
    });

    // Extraire les codes vagues sources depuis les lignes
    const vagueCodes = [
      ...new Set(
        vente.lignes
          .map((l) => l.vague?.code)
          .filter((code): code is string => code != null)
      ),
    ];
    // Fallback sur la vague directe si pas de lignes (ventes legacy)
    if (vagueCodes.length === 0 && vente.vague?.code) {
      vagueCodes.push(vente.vague.code);
    }

    await tx.siteAuditLog.create({
      data: {
        siteId,
        actorId: userId,
        action: "VENTE_CLOTUREE_DEFINITIVEMENT",
        details: {
          venteNumero: vente.numero,
          clientNom: vente.client.nom,
          vagueCodes,
          montantTotal: vente.montantTotal,
          factureStatut: vente.facture?.statut ?? null,
        },
      },
    });

    return updated;
  });
}
