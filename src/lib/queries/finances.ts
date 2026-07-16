import { prisma } from "@/lib/db";
import { CategorieDepense, StatutDepense, StatutVague, UniteStock } from "@/types";
import { getPrixParUniteBase, computeNombreVivantsVague, computeVivantsByBac } from "@/lib/calculs";
import { getLineage, getTransfertGroupesByVague } from "@/lib/queries/transferts";
import { effectivePoidsLigneVente, effectiveNombrePoissonsLigne, effectivePoidsVente, totalDepensesVente } from "@/lib/ventes-helpers";

// ---------------------------------------------------------------------------
// Types de retour locaux
// ---------------------------------------------------------------------------

export interface CoutDetailLigne {
  /** @deprecated kept for backward compat — always "depense" now */
  type: "stock" | "depense";
  label: string;
  montant: number;
}

export interface ResumeFinancier {
  revenus: number;
  coutsAliments: number;
  coutsIntrants: number;
  coutsEquipements: number;
  coutsTotaux: number;
  margeBrute: number;
  tauxMarge: number | null;
  encaissements: number;
  creances: number;
  prixMoyenVenteKg: number | null;
  nombreVentes: number;
  nombreFactures: number;
  /** Total de TOUTES les depenses (pour affichage paiement) */
  depensesTotales: number;
  /** Depenses payees (toutes) */
  depensesPayees: number;
  /** Depenses impayees ou partiellement payees (toutes) */
  depensesImpayees: number;
  /** Repartition par categorie (toutes depenses) */
  depensesParCategorie: Partial<Record<CategorieDepense, number>>;
  /** Ventilation detaillee des couts par type */
  coutsDetail: CoutDetailLigne[];
}

export interface RentabiliteVague {
  id: string;
  nom: string;
  code: string;
  statut: string;
  revenus: number;
  couts: number;
  marge: number;
  roi: number | null;
  poidsTotalVendu: number;
  /** Nombre de ventes liees a la vague */
  nombreVentes: number;
}

export interface RentabiliteParVague {
  vagues: RentabiliteVague[];
}

export interface EvolutionMois {
  mois: string;
  revenus: number;
  couts: number;
  marge: number;
  encaissements: number;
}

export interface EvolutionFinanciere {
  evolution: EvolutionMois[];
}

export interface TopClient {
  id: string;
  nom: string;
  totalVentes: number;
  nombreVentes: number;
  totalPaye: number;
}

export interface TopClients {
  clients: TopClient[];
}

export interface ResumeParUnite {
  uniteId: string;
  code: string;
  nom: string;
  type: string;
  /** Revenue from ventes linked to vagues in this unit */
  revenus: number;
  /** Costs: depenses assigned to this unit + stock consumption from unit vagues */
  couts: number;
  /** Revenue - couts */
  marge: number;
  /** Internal transfer revenue (when this unit is source) */
  revenusTransferts: number;
  /** Internal transfer cost (when this unit is destination) */
  coutsTransferts: number;
  /** Number of vagues in this unit */
  nombreVagues: number;
  /** Number of depenses in this unit */
  nombreDepenses: number;
}

export interface ResumeFinancierParUnite {
  unites: ResumeParUnite[];
  /** Costs not assigned to any unit */
  nonAffecte: { couts: number; nombreDepenses: number };
}

// ---------------------------------------------------------------------------
// Helpers internes
// ---------------------------------------------------------------------------

/**
 * Construit un filtre de periode pour les dates Prisma.
 * Retourne undefined si aucune periode n'est fournie.
 */
function buildDateFilter(
  periode?: { dateFrom: string; dateTo: string }
): { gte?: Date; lte?: Date } | undefined {
  if (!periode) return undefined;
  return {
    ...(periode.dateFrom && { gte: new Date(periode.dateFrom) }),
    ...(periode.dateTo && { lte: new Date(periode.dateTo) }),
  };
}

// ---------------------------------------------------------------------------
// Query 1 — Resume financier global
// ---------------------------------------------------------------------------

/**
 * Calcule les KPIs financiers globaux d'un site.
 *
 * Source unique des couts : Depense (ce que l'utilisateur saisit).
 * Pas de MouvementStock pour eviter les ecarts et doublons.
 *
 * - revenus : SUM(Vente.montantTotal)
 * - couts   : SUM(Depense.montantTotal) groupes par categorieDepense
 * - encaissements : SUM(Paiement.montant)
 * - creances : revenus - encaissements
 * - prixMoyenVenteKg : revenu total / poids total vendu
 */
export async function getResumeFinancier(
  siteId: string,
  periode?: { dateFrom: string; dateTo: string }
): Promise<ResumeFinancier> {
  const dateFilterVente = periode ? buildDateFilter(periode) : undefined;
  const dateFilterDepense = periode ? buildDateFilter(periode) : undefined;
  const dateFilterPaiement = periode ? buildDateFilter(periode) : undefined;

  const [venteAgg, paiementAgg, nombreFactures, toutesDepenses] =
    await Promise.all([
      // Revenus : SUM et COUNT des ventes + SUM poids
      // DV.0 : exclure les ventes EN_PREPARATION et ANNULEE
      prisma.vente.aggregate({
        where: {
          siteId,
          statut: { in: ["LIVREE", "CLOTUREE"] },
          ...(dateFilterVente && { createdAt: dateFilterVente }),
        },
        _sum: { montantTotal: true, poidsTotalKg: true },
        _count: { id: true },
      }),

      // Encaissements : SUM des paiements
      prisma.paiement.aggregate({
        where: {
          siteId,
          ...(dateFilterPaiement && { date: dateFilterPaiement }),
        },
        _sum: { montant: true },
      }),

      // Nombre de factures
      prisma.facture.count({
        where: {
          siteId,
          ...(dateFilterVente && { dateEmission: dateFilterVente }),
        },
      }),

      // TOUTES les depenses : source unique pour couts + suivi paiement
      prisma.depense.findMany({
        where: {
          siteId,
          ...(dateFilterDepense && { date: dateFilterDepense }),
        },
        select: {
          montantTotal: true,
          montantPaye: true,
          statut: true,
          categorieDepense: true,
        },
      }),
    ]);

  const revenus = venteAgg._sum.montantTotal ?? 0;
  const poidsTotalKg = venteAgg._sum.poidsTotalKg ?? 0;
  const nombreVentes = venteAgg._count.id;
  const encaissements = paiementAgg._sum.montant ?? 0;

  // Agregation des depenses (source unique pour les couts ET le suivi paiement)
  let coutsTotaux = 0;
  let depensesPayees = 0;
  let depensesImpayees = 0;
  let coutsAliments = 0;
  let coutsIntrants = 0;
  let coutsEquipements = 0;
  const depensesParCategorie: Partial<Record<CategorieDepense, number>> = {};

  for (const dep of toutesDepenses) {
    const montant = dep.montantTotal;
    coutsTotaux += montant;

    if (dep.statut === StatutDepense.PAYEE) {
      depensesPayees += montant;
    } else {
      depensesImpayees += montant - dep.montantPaye;
    }

    const cat = dep.categorieDepense as CategorieDepense;
    depensesParCategorie[cat] = (depensesParCategorie[cat] ?? 0) + montant;

    // Map CategorieDepense to legacy coutsXxx fields
    if (cat === CategorieDepense.ALIMENT) coutsAliments += montant;
    else if (cat === CategorieDepense.INTRANT) coutsIntrants += montant;
    else if (cat === CategorieDepense.EQUIPEMENT) coutsEquipements += montant;
  }

  const margeBrute = revenus - coutsTotaux;
  const tauxMarge = revenus > 0 ? (margeBrute / revenus) * 100 : null;
  const creances = revenus - encaissements;
  const prixMoyenVenteKg = poidsTotalKg > 0 ? revenus / poidsTotalKg : null;

  // Ventilation detaillee des couts par categorie
  const coutsDetail: CoutDetailLigne[] = [];
  for (const [cat, montant] of Object.entries(depensesParCategorie)) {
    if ((montant as number) > 0) {
      coutsDetail.push({ type: "depense", label: cat, montant: Math.round(montant as number) });
    }
  }
  coutsDetail.sort((a, b) => b.montant - a.montant);

  return {
    revenus: Math.round(revenus),
    coutsAliments: Math.round(coutsAliments),
    coutsIntrants: Math.round(coutsIntrants),
    coutsEquipements: Math.round(coutsEquipements),
    coutsTotaux: Math.round(coutsTotaux),
    margeBrute: Math.round(margeBrute),
    tauxMarge: tauxMarge !== null ? Math.round(tauxMarge * 100) / 100 : null,
    encaissements: Math.round(encaissements),
    creances: Math.round(creances),
    prixMoyenVenteKg:
      prixMoyenVenteKg !== null ? Math.round(prixMoyenVenteKg * 100) / 100 : null,
    nombreVentes,
    nombreFactures,
    depensesTotales: Math.round(coutsTotaux),
    depensesPayees: Math.round(depensesPayees),
    depensesImpayees: Math.round(depensesImpayees),
    depensesParCategorie: Object.fromEntries(
      Object.entries(depensesParCategorie).map(([k, v]) => [k, Math.round(v as number)])
    ) as Partial<Record<CategorieDepense, number>>,
    coutsDetail,
  };
}

// ---------------------------------------------------------------------------
// Query 2 — Rentabilite par vague
// ---------------------------------------------------------------------------

/**
 * Calcule la rentabilite de chaque vague d'un site.
 *
 * Pour chaque vague :
 * - revenus  : SUM(Vente.montantTotal) liees a la vague
 * - couts    : SUM(ReleveConsommation.quantite * Produit.prixUnitaire)
 * - marge    : revenus - couts
 * - roi      : marge / couts * 100 (null si couts = 0)
 * - poidsTotalVendu : SUM(Vente.poidsTotalKg)
 *
 * Tri par ROI decroissant (vagues sans ROI calculable en fin de liste).
 *
 * @param siteId - ID du site (multi-tenancy, R8)
 */
export async function getRentabiliteParVague(
  siteId: string
): Promise<RentabiliteParVague> {
  // Charger toutes les vagues du site
  const vagues = await prisma.vague.findMany({
    where: { siteId },
    select: {
      id: true,
      code: true,
      statut: true,
    },
    orderBy: { createdAt: "asc" },
  });

  if (vagues.length === 0) return { vagues: [] };

  const vagueIds = vagues.map((v) => v.id);

  // Charger toutes les lignes de vente de ces vagues (source de vérité multi-vague)
  // DV.0 : exclure les ventes EN_PREPARATION et ANNULEE
  const toutesLignesVente = await prisma.ligneVente.findMany({
    where: {
      siteId,
      vagueId: { in: vagueIds },
      vente: { statut: { in: ["LIVREE", "CLOTUREE"] } },
    },
    select: {
      vagueId: true,
      poidsTotalKg: true,
      venteId: true,
      vente: {
        select: {
          prixUnitaireKg: true,
          // DV.0 : champs pour effectivePoidsLigneVente
          poidsLivreKg: true,
          poidsTotalKg: true,
        },
      },
    },
  });

  // Charger toutes les consommations associees aux releves de ces vagues
  const toutesConsommations = await prisma.releveConsommation.findMany({
    where: {
      siteId,
      releve: { vagueId: { in: vagueIds } },
    },
    select: {
      quantite: true,
      releve: { select: { vagueId: true } },
      produit: { select: { prixUnitaire: true, uniteAchat: true, contenance: true } },
    },
  });

  // Charger les depenses directement liees a chaque vague (sans commandeId — anti double-comptage)
  const depensesParVague = await prisma.depense.findMany({
    where: {
      siteId,
      vagueId: { in: vagueIds },
      commandeId: null,
    },
    select: { vagueId: true, montantTotal: true },
  });

  // Charger les depenses issues de listes de besoins multi-vague (pas de vagueId direct)
  const depensesBesoinsMultiVague = await prisma.depense.findMany({
    where: {
      siteId,
      listeBesoinsId: { not: null },
      vagueId: null,
      commandeId: null,
    },
    select: {
      montantTotal: true,
      listeBesoins: {
        select: {
          vagues: {
            select: { vagueId: true, ratio: true },
            where: { vagueId: { in: vagueIds } },
          },
        },
      },
    },
  });

  // Agreger par vagueId en memoire (via LigneVente — multi-vague safe)
  const ventesByVague = new Map<
    string,
    { revenus: number; poidsTotalKg: number; nombreVentes: number; venteIds: Set<string> }
  >();
  for (const lv of toutesLignesVente) {
    if (!lv.vagueId) continue;
    const existing = ventesByVague.get(lv.vagueId) ?? {
      revenus: 0,
      poidsTotalKg: 0,
      nombreVentes: 0,
      venteIds: new Set<string>(),
    };
    // DV.0 : utiliser le poids livré effectif (prorata si poidsLivreKg renseigné)
    const poidsEffectif = effectivePoidsLigneVente(lv, lv.vente);
    existing.revenus += poidsEffectif * lv.vente.prixUnitaireKg;
    existing.poidsTotalKg += poidsEffectif;
    existing.venteIds.add(lv.venteId);
    existing.nombreVentes = existing.venteIds.size;
    ventesByVague.set(lv.vagueId, existing);
  }

  const coutsByVague = new Map<string, number>();
  for (const c of toutesConsommations) {
    const vagueId = c.releve.vagueId;
    // Skip consommations from lot d'alevins releves (no vagueId — R3-S5)
    if (!vagueId) continue;
    const coutLigne = c.quantite * getPrixParUniteBase(c.produit);
    coutsByVague.set(vagueId, (coutsByVague.get(vagueId) ?? 0) + coutLigne);
  }

  // Ajouter les depenses directes (sans commandeId) — anti double-comptage
  for (const dep of depensesParVague) {
    if (!dep.vagueId) continue;
    coutsByVague.set(dep.vagueId, (coutsByVague.get(dep.vagueId) ?? 0) + dep.montantTotal);
  }

  // Imputer les depenses multi-vague au prorata des ratios
  for (const dep of depensesBesoinsMultiVague) {
    for (const lbv of dep.listeBesoins?.vagues ?? []) {
      const montantImpute = dep.montantTotal * lbv.ratio;
      coutsByVague.set(
        lbv.vagueId,
        (coutsByVague.get(lbv.vagueId) ?? 0) + montantImpute
      );
    }
  }

  // Construire le tableau de rentabilite
  const result: RentabiliteVague[] = vagues.map((vague) => {
    const ventesVague = ventesByVague.get(vague.id);
    const revenus = Math.round(ventesVague?.revenus ?? 0);
    const poidsTotalVendu = ventesVague?.poidsTotalKg ?? 0;
    const nombreVentes = ventesVague?.nombreVentes ?? 0;
    const couts = Math.round(coutsByVague.get(vague.id) ?? 0);
    const marge = revenus - couts;
    const roi = couts > 0 ? (marge / couts) * 100 : null;

    return {
      id: vague.id,
      nom: vague.code,
      code: vague.code,
      statut: vague.statut,
      revenus,
      couts,
      marge: Math.round(marge),
      roi: roi !== null ? Math.round(roi * 100) / 100 : null,
      poidsTotalVendu: Math.round(poidsTotalVendu * 100) / 100,
      nombreVentes,
    };
  });

  // Trier par ROI decroissant ; vagues sans ROI (null) en dernier
  result.sort((a, b) => {
    if (a.roi === null && b.roi === null) return 0;
    if (a.roi === null) return 1;
    if (b.roi === null) return -1;
    return b.roi - a.roi;
  });

  return { vagues: result };
}

// ---------------------------------------------------------------------------
// Query 3 — Evolution financiere mensuelle
// ---------------------------------------------------------------------------

/**
 * Retourne les donnees d'evolution financiere mois par mois sur les N derniers
 * mois, utilisables pour un graphique de type "revenus / couts / marge".
 *
 * Pour chaque mois :
 * - revenus       : SUM(Vente.montantTotal) creees ce mois
 * - couts         : SUM(Depense.montantTotal) — source unique (pas de MouvementStock)
 * - marge         : revenus - couts
 * - encaissements : SUM(Paiement.montant) de ce mois
 *
 * @param siteId     - ID du site (multi-tenancy, R8)
 * @param moisCount  - Nombre de mois en arriere (defaut : 12)
 */
export async function getEvolutionFinanciere(
  siteId: string,
  moisCount: number = 12
): Promise<EvolutionFinanciere> {
  const now = new Date();
  const dateDebut = new Date(now.getFullYear(), now.getMonth() - (moisCount - 1), 1);

  const [ventes, depenses, paiements] = await Promise.all([
    // DV.0 : exclure les ventes EN_PREPARATION et ANNULEE
    prisma.vente.findMany({
      where: { siteId, statut: { in: ["LIVREE", "CLOTUREE"] }, createdAt: { gte: dateDebut } },
      select: { createdAt: true, montantTotal: true },
    }),
    // Depense = source unique pour les couts (toutes, y compris liees a commandes)
    prisma.depense.findMany({
      where: { siteId, date: { gte: dateDebut } },
      select: { date: true, montantTotal: true },
    }),
    prisma.paiement.findMany({
      where: { siteId, date: { gte: dateDebut } },
      select: { date: true, montant: true },
    }),
  ]);

  const moisList: string[] = [];
  for (let i = 0; i < moisCount; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - (moisCount - 1) + i, 1);
    moisList.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }

  const agregats = new Map<string, { revenus: number; couts: number; encaissements: number }>();
  for (const mois of moisList) {
    agregats.set(mois, { revenus: 0, couts: 0, encaissements: 0 });
  }

  const toMois = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

  for (const v of ventes) {
    const agg = agregats.get(toMois(v.createdAt));
    if (agg) agg.revenus += v.montantTotal;
  }

  for (const dep of depenses) {
    const agg = agregats.get(toMois(dep.date));
    if (agg) agg.couts += dep.montantTotal;
  }

  for (const p of paiements) {
    const agg = agregats.get(toMois(p.date));
    if (agg) agg.encaissements += p.montant;
  }

  const evolution: EvolutionMois[] = moisList.map((mois) => {
    const agg = agregats.get(mois) ?? { revenus: 0, couts: 0, encaissements: 0 };
    return {
      mois,
      revenus: Math.round(agg.revenus),
      couts: Math.round(agg.couts),
      marge: Math.round(agg.revenus - agg.couts),
      encaissements: Math.round(agg.encaissements),
    };
  });

  return { evolution };
}

// ---------------------------------------------------------------------------
// Query 3b — Ventilation mensuelle des couts par categorie
// ---------------------------------------------------------------------------

export interface CoutMoisCategorie {
  mois: string;
  categorie: string;
  type: "stock" | "depense";
  montant: number;
}

export interface CoutsParMoisParType {
  lignes: CoutMoisCategorie[];
  categories: string[];
  moisList: string[];
}

export async function getCoutsParMoisParType(
  siteId: string,
  moisCount: number = 12
): Promise<CoutsParMoisParType> {
  const now = new Date();
  const dateDebut = new Date(now.getFullYear(), now.getMonth() - (moisCount - 1), 1);

  // Depense = source unique pour les couts (toutes, y compris liees a commandes)
  const depenses = await prisma.depense.findMany({
    where: { siteId, date: { gte: dateDebut } },
    select: {
      date: true,
      montantTotal: true,
      categorieDepense: true,
    },
  });

  const moisList: string[] = [];
  for (let i = 0; i < moisCount; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - (moisCount - 1) + i, 1);
    moisList.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }

  const toMois = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

  // mois -> categorie -> montant
  const grid = new Map<string, Map<string, number>>();
  for (const m of moisList) grid.set(m, new Map());

  const categoriesSet = new Set<string>();

  for (const dep of depenses) {
    const mois = toMois(dep.date);
    const cat = dep.categorieDepense as string;
    categoriesSet.add(cat);
    const row = grid.get(mois);
    if (!row) continue;
    row.set(cat, (row.get(cat) ?? 0) + dep.montantTotal);
  }

  const lignes: CoutMoisCategorie[] = [];
  for (const mois of moisList) {
    const row = grid.get(mois)!;
    for (const [cat, montant] of row) {
      if (montant > 0) {
        lignes.push({
          mois,
          categorie: cat,
          type: "depense",
          montant: Math.round(montant),
        });
      }
    }
  }

  const categories = Array.from(categoriesSet).sort();

  return { lignes, categories, moisList };
}

// ---------------------------------------------------------------------------
// Query 3c — Détail concret des coûts par mois (lignes individuelles)
// ---------------------------------------------------------------------------

export interface CoutDetailLigneConcrete {
  date: Date;
  mois: string;
  description: string;
  categorie: string;
  type: "stock" | "depense";
  montant: number;
}

export interface CoutsDetailParMois {
  moisList: string[];
  lignesParMois: Record<string, CoutDetailLigneConcrete[]>;
}

export async function getCoutsDetailParMois(
  siteId: string,
  moisCount: number = 12
): Promise<CoutsDetailParMois> {
  const now = new Date();
  const dateDebut = new Date(now.getFullYear(), now.getMonth() - (moisCount - 1), 1);

  // Depense = source unique pour les couts (toutes, y compris liees a commandes)
  const depenses = await prisma.depense.findMany({
    where: { siteId, date: { gte: dateDebut } },
    select: {
      date: true,
      montantTotal: true,
      description: true,
      categorieDepense: true,
    },
    orderBy: { date: "asc" },
  });

  const toMois = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

  const moisList: string[] = [];
  for (let i = 0; i < moisCount; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - (moisCount - 1) + i, 1);
    moisList.push(toMois(d));
  }

  const lignesParMois: Record<string, CoutDetailLigneConcrete[]> = {};

  for (const dep of depenses) {
    const mois = toMois(dep.date);
    if (!moisList.includes(mois)) continue;
    if (!lignesParMois[mois]) lignesParMois[mois] = [];
    lignesParMois[mois].push({
      date: dep.date,
      mois,
      description: dep.description,
      categorie: dep.categorieDepense as string,
      type: "depense",
      montant: Math.round(dep.montantTotal),
    });
  }

  const moisAvecData = moisList.filter((m) => lignesParMois[m]?.length > 0);

  return { moisList: moisAvecData, lignesParMois };
}

// ---------------------------------------------------------------------------
// Query 4 — Top clients par chiffre d'affaires
// ---------------------------------------------------------------------------

/**
 * Retourne les N meilleurs clients d'un site classes par chiffre d'affaires
 * total decroissant.
 *
 * Pour chaque client :
 * - totalVentes  : SUM(Vente.montantTotal)
 * - nombreVentes : COUNT(Vente)
 * - totalPaye    : SUM(Paiement.montant) via Facture via Vente
 *
 * @param siteId - ID du site (multi-tenancy, R8)
 * @param limit  - Nombre maximum de clients a retourner (defaut : 5)
 */
export async function getTopClients(
  siteId: string,
  limit: number = 5
): Promise<TopClients> {
  // Charger tous les clients actifs du site avec leurs ventes et paiements
  const clients = await prisma.client.findMany({
    where: { siteId, isActive: true },
    select: {
      id: true,
      nom: true,
      ventes: {
        // DV.0 : exclure les ventes EN_PREPARATION et ANNULEE
        where: { siteId, statut: { in: ["LIVREE", "CLOTUREE"] } },
        select: {
          montantTotal: true,
          facture: {
            select: {
              paiements: {
                select: { montant: true },
              },
            },
          },
        },
      },
    },
  });

  // Calculer les agregats en memoire
  const clientsAvecAggregats: TopClient[] = clients.map((client) => {
    let totalVentes = 0;
    let totalPaye = 0;
    const nombreVentes = client.ventes.length;

    for (const vente of client.ventes) {
      totalVentes += vente.montantTotal;

      if (vente.facture) {
        for (const paiement of vente.facture.paiements) {
          totalPaye += paiement.montant;
        }
      }
    }

    return {
      id: client.id,
      nom: client.nom,
      totalVentes: Math.round(totalVentes),
      nombreVentes,
      totalPaye: Math.round(totalPaye),
    };
  });

  // Filtrer les clients sans vente, trier par CA decroissant, limiter
  return {
    clients: clientsAvecAggregats
      .filter((c) => c.nombreVentes > 0)
      .sort((a, b) => b.totalVentes - a.totalVentes)
      .slice(0, limit),
  };
}

// ---------------------------------------------------------------------------
// Query 5 — Cout de production complet d'une vague
// ---------------------------------------------------------------------------

/**
 * Interfaces de retour de getCoutProductionVague
 */
type CategorieDepenseAffichage = CategorieDepense | "MULTI_VAGUE";

export interface CoutProductionVagueCategorie {
  categorie: CategorieDepenseAffichage;
  montant: number;
  pourcentage: number;
  parKg: number | null;
}

export interface CoutProductionDetailAliment {
  produit: string;
  quantite: number;
  prixUnitaire: number;
  total: number;
  contenanceSac: number | null;
  nombreSacs: number | null;
}

export interface CoutProductionDepenseDirecte {
  date: Date;
  categorie: CategorieDepense;
  description: string;
  montant: number;
}

export interface CoutProductionDepenseMultiVague {
  description: string;
  montantTotal: number;
  ratio: number;
  montantImpute: number;
}

export interface CoutProductionRatioDetailVague {
  code: string;
  jours: number;
  nombreInitial: number;
  poids: number;
}

export interface CoutProductionRatioDetail {
  mois: string;
  poidsCible: number;
  totalPoids: number;
  ratio: number;
  vagues: CoutProductionRatioDetailVague[];
}

export interface CoutProductionDepenseRecurrente {
  description: string;
  categorie: CategorieDepense;
  montantPayeTotal: number;
  moisCouverts: number;
  ratioMoyen: number;
  montantImpute: number;
  ratioDetail: CoutProductionRatioDetail[];
}

export interface CoutProductionVente {
  date: Date;
  client: string;
  poidsKg: number;
  prixKg: number;
  montant: number;
}

export interface CoutProductionDepenseVente {
  description: string;
  categorie: string;
  date: Date;
  montant: number;
}

export interface CoutProductionVague {
  vague: {
    id: string;
    code: string;
    statut: StatutVague;
    dateDebut: Date;
    dateFin: Date | null;
    nombreInitial: number;
    dureeJours: number;
  };

  resume: {
    coutTotal: number;
    poidsTotalVendu: number;
    nombrePoissonsVendus: number;
    biomasseKg: number | null;             // biomasse vivante restante en ferme
    biomasseTransferee: number | null;     // biomasse transférée à d'autres vagues (sortants — PRE_GROSSISSEMENT)
    nombrePoissonsTransferes: number;      // nombre de poissons transférés sortants
    biomasseProduite: number | null;       // biomasse totale produite (vivante + vendue + transférée)
    coutParKg: number | null;
    prixMoyenVenteKg: number | null;
    margeParKg: number | null;
    /** Revenus bruts = somme des montants effectifs (sans déduire les dépenses ventes) */
    revenusBruts: number;
    /** Dépenses associées aux ventes (allouées au prorata du poids de la ligne) */
    depensesVentes: number;
    /** Revenus nets = revenusBruts - depensesVentes (montant net) */
    revenus: number;
    marge: number;
    roi: number | null;
  };

  coutParCategorie: CoutProductionVagueCategorie[];

  detailAliments: CoutProductionDetailAliment[];

  depensesDirectes: CoutProductionDepenseDirecte[];

  depensesMultiVagues: CoutProductionDepenseMultiVague[];

  depensesRecurrentes: CoutProductionDepenseRecurrente[];

  ventes: CoutProductionVente[];

  /** Dépenses associées aux ventes de cette vague (allouées au prorata) */
  depensesVentes: CoutProductionDepenseVente[];

  formule: {
    coutAliments: number;
    coutDepensesDirectes: number;
    coutMultiVagues: number;
    coutRecurrents: number;
    coutTotal: number;
    poidsVendu: number;
    biomasseKg: number | null;
    coutParKg: number | null;
  };

  /**
   * Coûts imputés des vagues parentes via le lineage de transfert.
   * Présent uniquement si l'option `includeParents` a été activée.
   */
  coutsParents?: CoutsParentsImpute;

  /**
   * KPIs du cycle complet (vague courante + coûts pré-grossissement imputés).
   * Présent uniquement si `coutsParents` est présent.
   */
  cycleComplet?: {
    coutTotalCycleComplet: number;
    margesCycleComplet: number;
    roiCycleComplet: number | null;
  };
}

// ---------------------------------------------------------------------------
// Interfaces — Coûts pré-grossissement imputés
// ---------------------------------------------------------------------------

export interface CoutsParentsImputeDetail {
  vagueParentId: string;
  vagueParentCode: string;
  dateTransfert: Date;
  nombrePoissons: number;
  parentNombreInitial: number;
  ratio: number;
  parentCoutTotal: number;
  coutImpute: number;
}

export interface CoutsParentsImpute {
  coutTotalImpute: number;
  details: CoutsParentsImputeDetail[];
}

/**
 * Calcule le coût imputé proportionnel des vagues parentes via le lineage.
 * Récursif sur N niveaux (borné à maxDepth pour éviter les boucles infinies).
 *
 * Pour chaque parent dans le lineage :
 *   ratio = nombrePoissonsTransferes / parentNombreInitial
 *   coutParentImpute = (parentCoutTotal + coutParentsDuParentImpute) × ratio
 *
 * @param vagueId  - vague cible (recherche les transferts entrants)
 * @param siteId   - ID du site (multi-tenancy, R8)
 * @param maxDepth - profondeur max (défaut 5)
 * @param visited  - Set de vagueIds déjà traités (anti-boucle)
 */
export async function getCoutParentsImpute(
  vagueId: string,
  siteId: string,
  maxDepth: number = 5,
  visited: Set<string> = new Set()
): Promise<CoutsParentsImpute> {
  if (visited.has(vagueId) || maxDepth <= 0) {
    return { coutTotalImpute: 0, details: [] };
  }
  visited.add(vagueId);

  // Récupérer le lineage (parents directs + indirects via getLineage)
  const lineage = await getLineage(siteId, vagueId, maxDepth);

  if (lineage.parents.length === 0) {
    return { coutTotalImpute: 0, details: [] };
  }

  // Récupérer le nombreInitial de la vague cible (pour le ratio)
  const vagueTarget = await prisma.vague.findUnique({
    where: { id: vagueId, siteId },
    select: { nombreInitial: true },
  });
  const targetNombreInitial = vagueTarget?.nombreInitial ?? 0;

  if (targetNombreInitial === 0) {
    return { coutTotalImpute: 0, details: [] };
  }

  // On ne traite que les parents DIRECTS (level 1) pour éviter les doublons.
  // getLineage retourne une liste aplatie — on filtre les parents directs
  // en vérifiant que vagueDestId === vagueId dans les TransfertGroupes.
  const parentsDirects = await prisma.transfertGroupe.findMany({
    where: {
      vagueDestId: vagueId,
      transfert: { siteId },
    },
    include: {
      vagueSource: { select: { id: true, code: true, nombreInitial: true } },
      transfert: { select: { date: true } },
    },
  });

  let coutTotalImpute = 0;
  const details: CoutsParentsImputeDetail[] = [];

  for (const g of parentsDirects) {
    const parentId = g.vagueSourceId;

    if (visited.has(parentId)) continue;

    const parentNombreInitial = g.vagueSource.nombreInitial ?? 0;
    if (parentNombreInitial === 0) continue;

    const ratio = g.nombrePoissons / parentNombreInitial;

    // Coût total de la vague parente (vague isolée)
    let parentCoutTotal = 0;
    try {
      const parentCout = await getCoutProductionVague(parentId, siteId);
      parentCoutTotal = parentCout.resume.coutTotal;
    } catch {
      // Si la vague parente n'existe plus ou erreur, on ignore
      continue;
    }

    // Coûts imputés des grands-parents (récursion)
    const visitedChild = new Set(visited);
    const grandParentsCouts = await getCoutParentsImpute(
      parentId,
      siteId,
      maxDepth - 1,
      visitedChild
    );

    const coutParentTotal = parentCoutTotal + grandParentsCouts.coutTotalImpute;
    const coutImpute = Math.round(coutParentTotal * ratio);

    coutTotalImpute += coutImpute;

    details.push({
      vagueParentId: parentId,
      vagueParentCode: g.vagueSource.code,
      dateTransfert: g.transfert.date,
      nombrePoissons: g.nombrePoissons,
      parentNombreInitial,
      ratio: Math.round(ratio * 10000) / 10000,
      parentCoutTotal: Math.round(coutParentTotal),
      coutImpute,
    });
  }

  return {
    coutTotalImpute,
    details,
  };
}

/**
 * Calcule le cout de production complet d'une vague de poissons.
 *
 * ## Conventions anti double-comptage
 * - **Aliments** : Les `ReleveConsommation` font foi pour les aliments.
 *   Les `Depense` avec `categorieDepense = ALIMENT` sont EXCLUES des depenses
 *   directes pour eviter de compter deux fois.
 *
 * ## Allocation des depenses recurrentes
 * Utilise les `Depense` reelles generees depuis les templates `DepenseRecurrente`
 * (via `depenseRecurrenteId`). Seul `montantPaye` est pris en compte.
 * Pour chaque mois ou une depense reelle existe :
 * 1. Lister toutes les vagues du site actives ce mois (chevauchement).
 * 2. Calculer le poids de chaque vague : jours d'activite * nombreInitial.
 * 3. Quote-part = (poidsCible / totalPoids) * montantPaye du mois.
 *
 * ## Vague EN_COURS
 * `dateFin ?? new Date()` est utilise pour le calcul de duree et les
 * allocations de depenses recurrentes.
 *
 * ## Toggle includeParents
 * Si `options.includeParents === true`, appelle `getCoutParentsImpute` et
 * enrichit le retour avec `coutsParents` et `cycleComplet`.
 *
 * @param vagueId  - ID de la vague a analyser
 * @param siteId   - ID du site (multi-tenancy, R8)
 * @param options  - Options optionnelles (includeParents)
 */
export async function getCoutProductionVague(
  vagueId: string,
  siteId: string,
  options?: { includeParents?: boolean }
): Promise<CoutProductionVague> {
  // -------------------------------------------------------------------------
  // 1. Charger la vague cible
  // -------------------------------------------------------------------------
  const vague = await prisma.vague.findUniqueOrThrow({
    where: { id: vagueId, siteId },
    select: {
      id: true,
      code: true,
      statut: true,
      dateDebut: true,
      dateFin: true,
      nombreInitial: true,
      configElevage: {
        select: { poidsSacKg: true },
      },
    },
  });

  const dateFin = vague.dateFin ?? new Date();
  const dureeMs = dateFin.getTime() - vague.dateDebut.getTime();
  const dureeJours = Math.max(1, Math.round(dureeMs / (1000 * 60 * 60 * 24)));

  // -------------------------------------------------------------------------
  // 2. Charger toutes les donnees en parallele
  // -------------------------------------------------------------------------
  const [
    releveConsommations,
    depensesDirectes,
    depensesBesoinsMultiVague,
    depensesRecurrentesReelles,
    toutesVaguesSite,
    ventes,
    bacsVague,
    relevesVague,
    transfertsSortants,
    transfertGroupesById,
  ] = await Promise.all([
    // 2a. Consommations aliments (fait foi pour les aliments — ERR-093)
    // Filtre par dateFin : exclure les releves posterieurs a la cloture
    prisma.releveConsommation.findMany({
      where: {
        siteId,
        releve: { vagueId, date: { lte: dateFin } },
      },
      select: {
        quantite: true,
        produit: {
          select: {
            nom: true,
            prixUnitaire: true,
            uniteAchat: true,
            contenance: true,
          },
        },
      },
    }),

    // 2b. Depenses directes liees a la vague
    // Exclure: categorieDepense = ALIMENT (anti double-comptage ReleveConsommation)
    // Exclure: depenseRecurrenteId non null (comptees separement via montantPaye)
    // Filtre par dateFin : exclure les depenses posterieures a la cloture
    prisma.depense.findMany({
      where: {
        siteId,
        vagueId,
        depenseRecurrenteId: null,
        categorieDepense: { not: CategorieDepense.ALIMENT },
        date: { lte: dateFin },
      },
      select: {
        date: true,
        categorieDepense: true,
        description: true,
        montantTotal: true,
      },
    }),

    // 2c. Depenses multi-vague via ListeBesoins (vagueId null, listeBesoinsId non null)
    // Exclure: categorieDepense = ALIMENT (anti double-comptage ReleveConsommation)
    // Filtre par dateFin : exclure les depenses posterieures a la cloture
    prisma.depense.findMany({
      where: {
        siteId,
        listeBesoinsId: { not: null },
        vagueId: null,
        categorieDepense: { not: CategorieDepense.ALIMENT },
        date: { lte: dateFin },
      },
      select: {
        description: true,
        montantTotal: true,
        listeBesoins: {
          select: {
            vagues: {
              select: { vagueId: true, ratio: true },
            },
          },
        },
      },
    }),

    // 2d. Depenses generees depuis des templates recurrents (avec paiements reels)
    prisma.depense.findMany({
      where: {
        siteId,
        depenseRecurrenteId: { not: null },
        date: { gte: vague.dateDebut, lte: dateFin },
      },
      select: {
        date: true,
        montantPaye: true,
        depenseRecurrente: {
          select: {
            id: true,
            description: true,
            categorieDepense: true,
          },
        },
      },
    }),

    // 2e. Toutes les vagues actives du site (pour allocation prorata mensuel)
    prisma.vague.findMany({
      where: { siteId },
      select: {
        id: true,
        code: true,
        dateDebut: true,
        dateFin: true,
        nombreInitial: true,
      },
    }),

    // 2f. Lignes de vente de la vague (source de vérité multi-vague)
    // DV.0 : exclure les ventes EN_PREPARATION et ANNULEE — seules LIVREE et CLOTUREE comptent
    prisma.ligneVente.findMany({
      where: {
        siteId,
        vagueId,
        vente: { statut: { in: ["LIVREE", "CLOTUREE"] } },
      },
      select: {
        createdAt: true,
        nombrePoissons: true,
        poidsTotalKg: true,
        vente: {
          select: {
            prixUnitaireKg: true,
            createdAt: true,
            client: { select: { nom: true } },
            // DV.0 : champs pour les helpers effectivePoidsLigneVente / effectiveNombrePoissonsLigne
            statut: true,
            poidsLivreKg: true,
            poidsTotalKg: true,
            quantiteLivree: true,
            quantitePoissons: true,
            // DV.6 : dépenses de la vente pour le calcul du montant net
            depenses: {
              select: {
                description: true,
                categorieDepense: true,
                date: true,
                montantTotal: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    }),

    // 2g. Bacs de la vague via AssignationBac (ADR-043 Phase 3 — source de vérité)
    prisma.assignationBac.findMany({
      where: { siteId, vagueId, dateFin: null },
      select: { nombreInitial: true, bac: { select: { id: true } } },
    }),

    // 2h. Releves de la vague (for biomass calculation)
    // Filtre par dateFin : biomasse a la date de cloture
    prisma.releve.findMany({
      where: { siteId, vagueId, date: { lte: dateFin } },
      select: {
        bacId: true,
        typeReleve: true,
        nombreMorts: true,
        nombreVendus: true,
        nombreTransferes: true,
        nombreCompte: true,
        date: true,
        poidsMoyen: true,
        transfertGroupeId: true,
      },
      orderBy: { date: "asc" },
    }),

    // 2i. Transferts sortants — biomasse transférée hors de cette vague (PRE_GROSSISSEMENT)
    // Filtre par dateFin : ne considérer que les transferts antérieurs à la clôture
    prisma.transfertGroupe.findMany({
      where: {
        vagueSourceId: vagueId,
        transfert: { siteId, date: { lte: dateFin } },
      },
      select: {
        nombrePoissons: true,
        poidsMoyenG: true,
      },
    }),

    // 2j. TransfertGroupe de la vague — nécessaire pour que computeVivantsByBac
    // discrimine, PAR RELEVÉ, les TRANSFERT entrants des sortants (GV.1-GV.2)
    getTransfertGroupesByVague(siteId, vagueId),
  ]);

  // -------------------------------------------------------------------------
  // 2bis. Calcul biomasse vivante (biomasse réellement présente dans les bacs)
  //
  // ALIGNEMENT AVEC indicateurs.ts (carte stats) : utilise computeVivantsByBac
  // SANS excludeVentes, donc les VENTE relevés sont déjà soustraits des vivants
  // par bac. Pas de scaling proportionnel — le calcul reflète directement ce
  // qui est observé dans chaque bac : poidsMoyen × vivants_actuels.
  //
  // Avant : excludeVentes=true puis scaling proportionnel par LigneVente.nombrePoissons.
  // Le scaling supposait que vendus et vivants avaient le même poids moyen,
  // ce qui sous-estimait la biomasse quand les vendus étaient plus gros que
  // les vivants restants (cas typique en fin de cycle).
  //
  // biomasseProduite = biomasseKg (vivante actuelle) + poidsTotalVendu (LigneVente)
  //                  + biomasseTransferee (TransfertGroupe sortants)
  // -------------------------------------------------------------------------

  // ADR-043 Phase 3: mapper les assignations en forme {id, nombreInitial} pour les calculs
  const bacsVagueMapped = bacsVague.map((a) => ({ id: a.bac.id, nombreInitial: a.nombreInitial }));

  const hasPerBacReleves = relevesVague.some((r) => r.bacId !== null);
  // Aligné avec indicateurs.ts : VENTE relevés soustraits des vivants par bac
  // transfertGroupesById permet de discriminer les relevés TRANSFERT entrants des sortants (vague GROSSISSEMENT)
  const vivantsByBac = computeVivantsByBac(bacsVagueMapped, relevesVague, vague.nombreInitial, { transfertGroupesById });

  // Nombre total de poissons reellement vendus (source de verite : LigneVente)
  const totalPoissonsVendus = ventes.reduce((acc, lv) => acc + lv.nombrePoissons, 0);

  let biomasseKg: number | null = null;

  if (hasPerBacReleves && bacsVagueMapped.length > 0) {
    const biometriesParBac = new Map<string, { poidsMoyen: number }>();
    for (const r of relevesVague) {
      if (r.typeReleve === "BIOMETRIE" && r.poidsMoyen !== null && r.bacId) {
        biometriesParBac.set(r.bacId, { poidsMoyen: r.poidsMoyen });
      }
    }

    // Biomasse vivante par bac (vivants déjà après soustraction des VENTE relevés)
    let totalBiomasse = 0;
    let hasBiomasse = false;
    for (const bac of bacsVagueMapped) {
      const bio = biometriesParBac.get(bac.id);
      const vivantsBac = vivantsByBac.get(bac.id) ?? 0;
      if (bio && vivantsBac > 0) {
        totalBiomasse += (bio.poidsMoyen * vivantsBac) / 1000;
        hasBiomasse = true;
      }
    }

    if (hasBiomasse) {
      biomasseKg = Math.round(totalBiomasse * 100) / 100;
    }
  } else {
    const nombreVivants = computeNombreVivantsVague(bacsVagueMapped, relevesVague, vague.nombreInitial, { transfertGroupesById });
    const biometrieReleves = relevesVague
      .filter((r) => r.typeReleve === "BIOMETRIE" && r.poidsMoyen !== null);
    if (biometrieReleves.length > 0 && nombreVivants > 0) {
      const last = biometrieReleves[biometrieReleves.length - 1];
      biomasseKg = Math.round(((last.poidsMoyen as number) * nombreVivants) / 1000 * 100) / 100;
    }
  }

  // -------------------------------------------------------------------------
  // 3. Calcul cout aliments
  // -------------------------------------------------------------------------

  // Aggreger par produit pour detailAliments
  const alimentsMap = new Map<
    string,
    {
      quantite: number;
      prixUnitaire: number;
      total: number;
      uniteAchat: string | null;
      contenance: number | null;
    }
  >();

  let coutAliments = 0;
  for (const rc of releveConsommations) {
    const prixBase = getPrixParUniteBase(rc.produit);
    const ligneTotal = rc.quantite * prixBase;
    coutAliments += ligneTotal;

    const existing = alimentsMap.get(rc.produit.nom) ?? {
      quantite: 0,
      prixUnitaire: prixBase,
      total: 0,
      uniteAchat: rc.produit.uniteAchat,
      contenance: rc.produit.contenance,
    };
    existing.quantite += rc.quantite;
    existing.total += ligneTotal;
    alimentsMap.set(rc.produit.nom, existing);
  }

  // SC2.2 : priorite profil (ConfigElevage.poidsSacKg) > produit (Produit.contenance, si uniteAchat=SACS)
  // Quand le poids vient du profil, il s'applique a TOUS les aliments (pas de condition uniteAchat).
  const poidsSacProfil = vague.configElevage?.poidsSacKg ?? null;

  const detailAliments: CoutProductionDetailAliment[] = Array.from(
    alimentsMap.entries()
  ).map(([nom, data]) => {
    let contenanceSac: number | null;
    let nombreSacs: number | null;

    if (poidsSacProfil !== null && poidsSacProfil > 0) {
      contenanceSac = poidsSacProfil;
      nombreSacs = data.quantite / poidsSacProfil;
    } else {
      contenanceSac = data.contenance ?? null;
      nombreSacs =
        data.uniteAchat === UniteStock.SACS && contenanceSac && contenanceSac > 0
          ? data.quantite / contenanceSac
          : null;
    }

    return {
      produit: nom,
      quantite: Math.round(data.quantite * 1000) / 1000,
      prixUnitaire: Math.round(data.prixUnitaire * 100) / 100,
      total: Math.round(data.total),
      contenanceSac,
      nombreSacs: nombreSacs !== null ? Math.round(nombreSacs * 10) / 10 : null,
    };
  });

  // -------------------------------------------------------------------------
  // 4. Calcul depenses directes (hors aliments, hors commandes)
  // -------------------------------------------------------------------------

  let coutDepensesDirectes = 0;
  const depensesDirectesResult: CoutProductionDepenseDirecte[] = [];

  for (const dep of depensesDirectes) {
    coutDepensesDirectes += dep.montantTotal;
    depensesDirectesResult.push({
      date: dep.date,
      categorie: dep.categorieDepense as unknown as CategorieDepense,
      description: dep.description,
      montant: Math.round(dep.montantTotal),
    });
  }

  // -------------------------------------------------------------------------
  // 5. Calcul depenses multi-vagues (prorata ratio ListeBesoins)
  // -------------------------------------------------------------------------

  let coutMultiVagues = 0;
  const depensesMultiVaguesResult: CoutProductionDepenseMultiVague[] = [];

  for (const dep of depensesBesoinsMultiVague) {
    const vagueEntry = dep.listeBesoins?.vagues.find((v) => v.vagueId === vagueId);
    if (!vagueEntry) continue;

    const montantImpute = dep.montantTotal * vagueEntry.ratio;
    coutMultiVagues += montantImpute;
    depensesMultiVaguesResult.push({
      description: dep.description,
      montantTotal: Math.round(dep.montantTotal),
      ratio: vagueEntry.ratio,
      montantImpute: Math.round(montantImpute),
    });
  }

  // -------------------------------------------------------------------------
  // 6. Calcul depenses recurrentes (allocation prorata mensuel)
  // -------------------------------------------------------------------------

  function joursVagueDansMois(
    v: { dateDebut: Date; dateFin: Date | null },
    debutMois: Date,
    finMois: Date
  ): number {
    const vDebut = v.dateDebut;
    const vFin = v.dateFin ?? new Date();
    const debut = vDebut > debutMois ? vDebut : debutMois;
    const fin = vFin < finMois ? vFin : finMois;
    const diffMs = fin.getTime() - debut.getTime();
    if (diffMs < 0) return 0;
    return Math.round(diffMs / (1000 * 60 * 60 * 24)) + 1;
  }

  // Generer la liste des mois calendaires couverts par la vague cible
  const moisVague: Array<{ debutMois: Date; finMois: Date; label: string }> = [];
  {
    const d = new Date(
      vague.dateDebut.getFullYear(),
      vague.dateDebut.getMonth(),
      1
    );
    const dernierMois = new Date(dateFin.getFullYear(), dateFin.getMonth(), 1);
    while (d <= dernierMois) {
      const year = d.getFullYear();
      const month = d.getMonth();
      const debutMois = new Date(year, month, 1);
      const finMois = new Date(year, month + 1, 0);
      moisVague.push({
        debutMois,
        finMois,
        label: `${year}-${String(month + 1).padStart(2, "0")}`,
      });
      d.setMonth(d.getMonth() + 1);
    }
  }

  const vagueCibleObj = { dateDebut: vague.dateDebut, dateFin: vague.dateFin };

  // Grouper les depenses reelles par template recurrent et par mois
  const recParTemplate = new Map<
    string,
    {
      description: string;
      categorie: CategorieDepense;
      parMois: Map<string, number>;
    }
  >();

  for (const dep of depensesRecurrentesReelles) {
    if (!dep.depenseRecurrente || dep.montantPaye <= 0) continue;
    const templateId = dep.depenseRecurrente.id;
    const moisLabel = `${dep.date.getFullYear()}-${String(dep.date.getMonth() + 1).padStart(2, "0")}`;

    let entry = recParTemplate.get(templateId);
    if (!entry) {
      entry = {
        description: dep.depenseRecurrente.description,
        categorie: dep.depenseRecurrente.categorieDepense as unknown as CategorieDepense,
        parMois: new Map(),
      };
      recParTemplate.set(templateId, entry);
    }
    entry.parMois.set(moisLabel, (entry.parMois.get(moisLabel) ?? 0) + dep.montantPaye);
  }

  let coutRecurrents = 0;
  const depensesRecurrentesResult: CoutProductionDepenseRecurrente[] = [];

  for (const [, template] of recParTemplate) {
    let montantImputeTotal = 0;
    let moisCouverts = 0;
    let sommeRatios = 0;
    let montantPayeTotal = 0;
    const ratioDetail: CoutProductionRatioDetail[] = [];

    for (const { debutMois, finMois, label } of moisVague) {
      const montantPayeMois = template.parMois.get(label);
      if (!montantPayeMois || montantPayeMois <= 0) continue;

      const joursVagueCibleMois = joursVagueDansMois(vagueCibleObj, debutMois, finMois);
      if (joursVagueCibleMois <= 0) continue;

      const poidsCible = joursVagueCibleMois * vague.nombreInitial;
      let totalPoids = 0;
      const vaguesDetail: CoutProductionRatioDetailVague[] = [];

      for (const autreVague of toutesVaguesSite) {
        const jours = joursVagueDansMois(
          { dateDebut: autreVague.dateDebut, dateFin: autreVague.dateFin },
          debutMois,
          finMois
        );
        if (jours <= 0) continue;
        const poids = jours * autreVague.nombreInitial;
        totalPoids += poids;
        vaguesDetail.push({
          code: autreVague.code,
          jours,
          nombreInitial: autreVague.nombreInitial,
          poids,
        });
      }

      if (totalPoids <= 0) continue;

      const ratio = poidsCible / totalPoids;
      const montantMois = ratio * montantPayeMois;

      montantImputeTotal += montantMois;
      montantPayeTotal += montantPayeMois;
      moisCouverts += 1;
      sommeRatios += ratio;

      ratioDetail.push({
        mois: label,
        poidsCible,
        totalPoids,
        ratio: Math.round(ratio * 10000) / 10000,
        vagues: vaguesDetail,
      });
    }

    if (moisCouverts === 0) continue;

    const ratioMoyen = sommeRatios / moisCouverts;
    coutRecurrents += montantImputeTotal;

    depensesRecurrentesResult.push({
      description: template.description,
      categorie: template.categorie,
      montantPayeTotal: Math.round(montantPayeTotal),
      moisCouverts,
      ratioMoyen: Math.round(ratioMoyen * 10000) / 10000,
      montantImpute: Math.round(montantImputeTotal),
      ratioDetail,
    });
  }

  // -------------------------------------------------------------------------
  // 7. Ventes
  // -------------------------------------------------------------------------

  let revenusBruts = 0;
  let depensesVentesTotal = 0;
  let poidsTotalVendu = 0;
  const ventesResult: CoutProductionVente[] = [];
  const depensesVentesResult: CoutProductionDepenseVente[] = [];

  for (const lv of ventes) {
    // DV.0 : utiliser le poids livré effectif (prorata si poidsLivreKg renseigné)
    const poidsLigneEffectif = effectivePoidsLigneVente(lv, lv.vente);
    const nombreEffectif = effectiveNombrePoissonsLigne(lv, lv.vente);
    const montantLigne = poidsLigneEffectif * lv.vente.prixUnitaireKg;
    revenusBruts += montantLigne;
    poidsTotalVendu += poidsLigneEffectif;
    ventesResult.push({
      date: lv.vente.createdAt,
      client: lv.vente.client.nom,
      poidsKg: Math.round(poidsLigneEffectif * 100) / 100,
      prixKg: Math.round(lv.vente.prixUnitaireKg * 100) / 100,
      montant: Math.round(montantLigne),
    });

    // DV.6 : allouer les dépenses de la vente au prorata du poids de cette ligne
    if (lv.vente.depenses && lv.vente.depenses.length > 0) {
      const poidsVenteTotal = effectivePoidsVente(lv.vente);
      const ratio = poidsVenteTotal > 0 ? poidsLigneEffectif / poidsVenteTotal : 0;
      const totalDepenses = totalDepensesVente(lv.vente.depenses);
      const montantAlloue = totalDepenses * ratio;
      depensesVentesTotal += montantAlloue;

      for (const dep of lv.vente.depenses) {
        const montantDepAlloue = dep.montantTotal * ratio;
        if (montantDepAlloue > 0) {
          depensesVentesResult.push({
            description: dep.description,
            categorie: dep.categorieDepense as string,
            date: dep.date,
            montant: Math.round(montantDepAlloue),
          });
        }
      }
    }

    // nombreEffectif est calculé mais utilisé implicitement via le poids (prorata)
    void nombreEffectif;
  }

  // DV.6 : revenus nets = bruts - dépenses ventes allouées
  const revenus = revenusBruts - depensesVentesTotal;

  // -------------------------------------------------------------------------
  // 8. Agregation finale
  // -------------------------------------------------------------------------

  const coutTotal =
    coutAliments + coutDepensesDirectes + coutMultiVagues + coutRecurrents;

  // Biomasse transférée hors de cette vague (sortants vers d'autres vagues — PRE_GROSSISSEMENT)
  // Convertit poidsMoyenG (g) en kg : (g × nb) / 1000
  let biomasseTransferee = 0;
  let nombrePoissonsTransferes = 0;
  for (const tg of transfertsSortants) {
    biomasseTransferee += (tg.poidsMoyenG * tg.nombrePoissons) / 1000;
    nombrePoissonsTransferes += tg.nombrePoissons;
  }
  biomasseTransferee = Math.round(biomasseTransferee * 100) / 100;
  const biomasseTransfereeForResume = biomasseTransferee > 0 ? biomasseTransferee : null;

  // biomasseProduite = biomasse restante en ferme + biomasse deja vendue + biomasse transférée sortante.
  // Pour le cout de production, on divise par la biomasse TOTALE produite par cette vague,
  // c'est-à-dire tout ce qui en est sorti (vivants + vendus + transférés vers d'autres vagues).
  const partsBiomasse: number[] = [];
  if (biomasseKg !== null) partsBiomasse.push(biomasseKg);
  if (poidsTotalVendu > 0) partsBiomasse.push(poidsTotalVendu);
  if (biomasseTransferee > 0) partsBiomasse.push(biomasseTransferee);
  const biomasseProduite = partsBiomasse.length > 0
    ? Math.round(partsBiomasse.reduce((s, v) => s + v, 0) * 100) / 100
    : null;
  const coutParKg =
    biomasseProduite !== null && biomasseProduite > 0 ? coutTotal / biomasseProduite : null;
  const prixMoyenVenteKg = poidsTotalVendu > 0 ? revenus / poidsTotalVendu : null;
  const marge = revenus - coutTotal;
  const roi = coutTotal > 0 ? (marge / coutTotal) * 100 : null;
  const margeParKg =
    coutParKg !== null && prixMoyenVenteKg !== null
      ? prixMoyenVenteKg - coutParKg
      : null;

  // -------------------------------------------------------------------------
  // 9. Repartition par categorie
  // -------------------------------------------------------------------------

  const categorieMap = new Map<CategorieDepenseAffichage, number>();

  // Aliments
  if (coutAliments > 0) {
    categorieMap.set(CategorieDepense.ALIMENT, (categorieMap.get(CategorieDepense.ALIMENT) ?? 0) + coutAliments);
  }

  // Depenses directes — agreger par categorieDepense
  for (const dep of depensesDirectes) {
    const cat = dep.categorieDepense as CategorieDepense;
    categorieMap.set(cat, (categorieMap.get(cat) ?? 0) + dep.montantTotal);
  }

  // Depenses multi-vagues — agreger par categorie de la depense source
  // (on n'a pas la categorie dans la sous-requete — on les groupe sous "MULTI_VAGUE")
  for (const dep of depensesMultiVaguesResult) {
    const montant = dep.montantImpute;
    categorieMap.set(
      "MULTI_VAGUE",
      (categorieMap.get("MULTI_VAGUE") ?? 0) + montant
    );
  }

  // Depenses recurrentes — agreger par categorieDepense
  for (const dr of depensesRecurrentesResult) {
    const cat = dr.categorie;
    categorieMap.set(cat, (categorieMap.get(cat) ?? 0) + dr.montantImpute);
  }

  const coutParCategorie: CoutProductionVagueCategorie[] = Array.from(
    categorieMap.entries()
  )
    .filter(([, montant]) => montant > 0)
    .map(([categorie, montant]) => ({
      categorie,
      montant: Math.round(montant),
      pourcentage:
        coutTotal > 0
          ? Math.round((montant / coutTotal) * 10000) / 100
          : 0,
      parKg:
        biomasseProduite !== null && biomasseProduite > 0
          ? Math.round((montant / biomasseProduite) * 100) / 100
          : null,
    }))
    .sort((a, b) => b.montant - a.montant);

  // -------------------------------------------------------------------------
  // 10. Retour
  // -------------------------------------------------------------------------

  const baseResult: CoutProductionVague = {
    vague: {
      id: vague.id,
      code: vague.code,
      statut: vague.statut as unknown as StatutVague,
      dateDebut: vague.dateDebut,
      dateFin: vague.dateFin,
      nombreInitial: vague.nombreInitial,
      dureeJours,
    },

    resume: {
      coutTotal: Math.round(coutTotal),
      poidsTotalVendu: Math.round(poidsTotalVendu * 100) / 100,
      nombrePoissonsVendus: totalPoissonsVendus,
      biomasseKg: biomasseKg !== null ? Math.round(biomasseKg * 100) / 100 : null,
      biomasseTransferee: biomasseTransfereeForResume !== null ? Math.round(biomasseTransfereeForResume * 100) / 100 : null,
      nombrePoissonsTransferes,
      biomasseProduite: biomasseProduite !== null ? Math.round(biomasseProduite * 100) / 100 : null,
      coutParKg: coutParKg !== null ? Math.round(coutParKg * 100) / 100 : null,
      prixMoyenVenteKg:
        prixMoyenVenteKg !== null
          ? Math.round(prixMoyenVenteKg * 100) / 100
          : null,
      margeParKg: margeParKg !== null ? Math.round(margeParKg * 100) / 100 : null,
      revenusBruts: Math.round(revenusBruts),
      depensesVentes: Math.round(depensesVentesTotal),
      revenus: Math.round(revenus),
      marge: Math.round(marge),
      roi: roi !== null ? Math.round(roi * 100) / 100 : null,
    },

    coutParCategorie,
    detailAliments,
    depensesDirectes: depensesDirectesResult,
    depensesMultiVagues: depensesMultiVaguesResult,
    depensesRecurrentes: depensesRecurrentesResult,
    ventes: ventesResult,
    depensesVentes: depensesVentesResult,

    formule: {
      coutAliments: Math.round(coutAliments),
      coutDepensesDirectes: Math.round(coutDepensesDirectes),
      coutMultiVagues: Math.round(coutMultiVagues),
      coutRecurrents: Math.round(coutRecurrents),
      coutTotal: Math.round(coutTotal),
      poidsVendu: Math.round(poidsTotalVendu * 100) / 100,
      biomasseKg: biomasseKg !== null ? Math.round(biomasseKg * 100) / 100 : null,
      coutParKg: coutParKg !== null ? Math.round(coutParKg * 100) / 100 : null,
    },
  };

  // -------------------------------------------------------------------------
  // 11. Calcul coûts pré-grossissement (si includeParents)
  // -------------------------------------------------------------------------

  if (options?.includeParents) {
    const coutsParents = await getCoutParentsImpute(vagueId, siteId, 5);
    if (coutsParents.coutTotalImpute > 0) {
      const coutTotalCycleComplet = Math.round(coutTotal) + coutsParents.coutTotalImpute;
      const margesCycleComplet = Math.round(revenus) - coutTotalCycleComplet;
      const roiCycleComplet =
        coutTotalCycleComplet > 0
          ? Math.round(((margesCycleComplet / coutTotalCycleComplet) * 100) * 100) / 100
          : null;

      baseResult.coutsParents = coutsParents;
      baseResult.cycleComplet = {
        coutTotalCycleComplet,
        margesCycleComplet,
        roiCycleComplet,
      };
    }
  }

  return baseResult;
}

// ---------------------------------------------------------------------------
// Query 6 — Resume financier par unite de production
// ---------------------------------------------------------------------------

/**
 * Calcule les indicateurs financiers ventiles par unite de production (REPRODUCTION / GROSSISSEMENT).
 *
 * Pour chaque unite :
 * - revenus           : SUM(Vente.montantTotal) des ventes liees aux vagues de l'unite
 * - couts             : SUM(Depense.montantTotal) assignees a l'unite (commandeId null)
 *                       + SUM(ReleveConsommation.quantite * prixParUniteBase) pour les vagues de l'unite
 * - marge             : revenus - couts
 * - revenusTransferts : SUM(TransfertInterne.montantTotal) quand l'unite est source
 * - coutsTransferts   : SUM(TransfertInterne.montantTotal) quand l'unite est destination
 * - nombreVagues      : nombre de vagues dans l'unite
 * - nombreDepenses    : nombre de depenses directement assignees a l'unite
 *
 * Depense est la source unique pour les couts (toutes incluses, pas de filtre commandeId).
 * Les couts non affectes (depenses sans uniteProductionId ni vagueId) sont regroupes
 * dans nonAffecte.
 *
 * @param siteId - ID du site (multi-tenancy, R8)
 */
export async function getResumeFinancierParUnite(
  siteId: string
): Promise<ResumeFinancierParUnite> {
  // -------------------------------------------------------------------------
  // 1. Charger toutes les donnees en parallele
  // -------------------------------------------------------------------------
  const [
    unites,
    vagues,
    ventes,
    depenses,
    consommations,
    transferts,
  ] = await Promise.all([
    // 1a. Unites de production actives du site
    prisma.uniteProduction.findMany({
      where: { siteId, isActive: true },
      select: { id: true, code: true, nom: true, type: true },
      orderBy: { code: "asc" },
    }),

    // 1b. Toutes les vagues du site (pour mapper vagueId -> uniteProductionId)
    prisma.vague.findMany({
      where: { siteId },
      select: { id: true, uniteProductionId: true },
    }),

    // 1c. Toutes les lignes de vente du site (pour mapper via vague -> unite)
    // DV.0 : exclure les ventes EN_PREPARATION et ANNULEE
    prisma.ligneVente.findMany({
      where: { siteId, vente: { statut: { in: ["LIVREE", "CLOTUREE"] } } },
      select: {
        vagueId: true,
        poidsTotalKg: true,
        vente: {
          select: {
            prixUnitaireKg: true,
            // DV.0 : champs pour effectivePoidsLigneVente
            poidsLivreKg: true,
            poidsTotalKg: true,
          },
        },
      },
    }),

    // 1d. Toutes les depenses du site (source unique pour les couts)
    prisma.depense.findMany({
      where: { siteId },
      select: { uniteProductionId: true, vagueId: true, montantTotal: true },
    }),

    // 1e. Consommations aliments pour les vagues du site
    prisma.releveConsommation.findMany({
      where: { siteId },
      select: {
        quantite: true,
        releve: { select: { vagueId: true } },
        produit: { select: { prixUnitaire: true, uniteAchat: true, contenance: true } },
      },
    }),

    // 1f. Transferts internes du site
    prisma.transfertInterne.findMany({
      where: { siteId },
      select: { uniteSourceId: true, uniteDestinationId: true, montantTotal: true },
    }),
  ]);

  // -------------------------------------------------------------------------
  // 2. Construire les index en memoire
  // -------------------------------------------------------------------------

  // Map vagueId -> uniteProductionId (null si non affectee)
  const vagueToUnite = new Map<string, string | null>();
  for (const v of vagues) {
    vagueToUnite.set(v.id, v.uniteProductionId);
  }

  // Set des uniteIds connus (pour detecter les unites inactives/supprimees)
  const uniteIds = new Set(unites.map((u) => u.id));

  // -------------------------------------------------------------------------
  // 3. Agreger les revenus par unite (via vague)
  // -------------------------------------------------------------------------

  const revenusByUnite = new Map<string, number>();
  for (const lv of ventes) {
    const uniteId = lv.vagueId ? vagueToUnite.get(lv.vagueId) ?? null : null;
    if (uniteId && uniteIds.has(uniteId)) {
      // DV.0 : utiliser le poids livré effectif (prorata si poidsLivreKg renseigné)
      const poidsEffectif = effectivePoidsLigneVente(lv, lv.vente);
      const montantLigne = poidsEffectif * lv.vente.prixUnitaireKg;
      revenusByUnite.set(uniteId, (revenusByUnite.get(uniteId) ?? 0) + montantLigne);
    }
    // lignes sans unite ou unite inactive sont ignorees pour la ventilation
  }

  // -------------------------------------------------------------------------
  // 4. Agreger les couts par unite
  //    - depenses directement liees a l'unite (uniteProductionId non null)
  //    - depenses liees a une vague de l'unite (vagueId non null, uniteProductionId null)
  //    - consommations des vagues de l'unite
  // -------------------------------------------------------------------------

  const coutsByUnite = new Map<string, number>();
  const depensesCountByUnite = new Map<string, number>();
  let coutNonAffecte = 0;
  let depensesNonAffectees = 0;

  for (const dep of depenses) {
    let uniteId: string | null = null;

    if (dep.uniteProductionId && uniteIds.has(dep.uniteProductionId)) {
      // Depense directement assignee a une unite
      uniteId = dep.uniteProductionId;
    } else if (dep.vagueId) {
      // Depense liee a une vague — resoudre via la vague
      const vagueUniteId = vagueToUnite.get(dep.vagueId) ?? null;
      if (vagueUniteId && uniteIds.has(vagueUniteId)) {
        uniteId = vagueUniteId;
      }
    }

    if (uniteId) {
      coutsByUnite.set(uniteId, (coutsByUnite.get(uniteId) ?? 0) + dep.montantTotal);
      depensesCountByUnite.set(uniteId, (depensesCountByUnite.get(uniteId) ?? 0) + 1);
    } else {
      // Aucune unite trouvee — non affecte
      coutNonAffecte += dep.montantTotal;
      depensesNonAffectees += 1;
    }
  }

  // Consommations aliments (cout stock par vague -> unite)
  for (const rc of consommations) {
    const vagueId = rc.releve.vagueId;
    if (!vagueId) continue;
    const uniteId = vagueToUnite.get(vagueId) ?? null;
    if (!uniteId || !uniteIds.has(uniteId)) continue;
    const coutLigne = rc.quantite * getPrixParUniteBase(rc.produit);
    coutsByUnite.set(uniteId, (coutsByUnite.get(uniteId) ?? 0) + coutLigne);
  }

  // -------------------------------------------------------------------------
  // 5. Agreger les transferts internes par unite
  // -------------------------------------------------------------------------

  const revenusTransfertsByUnite = new Map<string, number>();
  const coutsTransfertsByUnite = new Map<string, number>();

  for (const t of transferts) {
    // Unite source recoit un revenu (elle cede les animaux)
    if (uniteIds.has(t.uniteSourceId)) {
      revenusTransfertsByUnite.set(
        t.uniteSourceId,
        (revenusTransfertsByUnite.get(t.uniteSourceId) ?? 0) + t.montantTotal
      );
    }
    // Unite destination supporte un cout (elle recoit les animaux)
    if (uniteIds.has(t.uniteDestinationId)) {
      coutsTransfertsByUnite.set(
        t.uniteDestinationId,
        (coutsTransfertsByUnite.get(t.uniteDestinationId) ?? 0) + t.montantTotal
      );
    }
  }

  // -------------------------------------------------------------------------
  // 6. Compter les vagues par unite
  // -------------------------------------------------------------------------

  const vagueCountByUnite = new Map<string, number>();
  for (const v of vagues) {
    if (v.uniteProductionId && uniteIds.has(v.uniteProductionId)) {
      vagueCountByUnite.set(
        v.uniteProductionId,
        (vagueCountByUnite.get(v.uniteProductionId) ?? 0) + 1
      );
    }
  }

  // -------------------------------------------------------------------------
  // 7. Construire le tableau de retour
  // -------------------------------------------------------------------------

  const unitesResult: ResumeParUnite[] = unites.map((unite) => {
    const revenus = Math.round(revenusByUnite.get(unite.id) ?? 0);
    const couts = Math.round(coutsByUnite.get(unite.id) ?? 0);
    const revenusTransferts = Math.round(revenusTransfertsByUnite.get(unite.id) ?? 0);
    const coutsTransferts = Math.round(coutsTransfertsByUnite.get(unite.id) ?? 0);
    const marge = revenus - couts;

    return {
      uniteId: unite.id,
      code: unite.code,
      nom: unite.nom,
      type: unite.type as string,
      revenus,
      couts,
      marge,
      revenusTransferts,
      coutsTransferts,
      nombreVagues: vagueCountByUnite.get(unite.id) ?? 0,
      nombreDepenses: depensesCountByUnite.get(unite.id) ?? 0,
    };
  });

  return {
    unites: unitesResult,
    nonAffecte: {
      couts: Math.round(coutNonAffecte),
      nombreDepenses: depensesNonAffectees,
    },
  };
}
