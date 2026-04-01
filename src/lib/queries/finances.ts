import { prisma } from "@/lib/db";
import { CategorieProduit, CategorieDepense, TypeMouvement, StatutDepense } from "@/types";
import { getPrixParUniteBase } from "@/lib/calculs";

// ---------------------------------------------------------------------------
// Types de retour locaux
// ---------------------------------------------------------------------------

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
  /** Total des depenses (hors commande — anti double-comptage) */
  depensesTotales: number;
  /** Depenses payees (hors commande) */
  depensesPayees: number;
  /** Depenses impayees ou partiellement payees (hors commande) */
  depensesImpayees: number;
  /** Repartition par categorie (hors commande) */
  depensesParCategorie: Partial<Record<CategorieDepense, number>>;
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

/**
 * Calcule la somme des mouvements ENTREE d'une categorie de produit pour un site.
 * Utilise une jointure via findMany car Prisma ne supporte pas aggregate avec join.
 */
async function sumCoutsParCategorie(
  siteId: string,
  categorie: CategorieProduit,
  dateFilter?: { gte?: Date; lte?: Date }
): Promise<number> {
  const mouvements = await prisma.mouvementStock.findMany({
    where: {
      siteId,
      type: TypeMouvement.ENTREE,
      prixTotal: { not: null },
      ...(dateFilter && { date: dateFilter }),
      produit: { categorie },
    },
    select: { prixTotal: true },
  });

  return mouvements.reduce((sum, m) => sum + (m.prixTotal ?? 0), 0);
}

// ---------------------------------------------------------------------------
// Query 1 — Resume financier global
// ---------------------------------------------------------------------------

/**
 * Calcule les KPIs financiers globaux d'un site.
 *
 * - revenus : SUM(Vente.montantTotal)
 * - coutsAliments/coutsIntrants/coutsEquipements : SUM(MouvementStock.prixTotal)
 *   filtre type=ENTREE + produit.categorie
 * - encaissements : SUM(Paiement.montant)
 * - creances : revenus - encaissements
 * - prixMoyenVenteKg : revenu total / poids total vendu
 *
 * @param siteId  - ID du site (multi-tenancy, R8)
 * @param periode - Filtre de periode optionnel (dateFrom / dateTo ISO 8601)
 */
export async function getResumeFinancier(
  siteId: string,
  periode?: { dateFrom: string; dateTo: string }
): Promise<ResumeFinancier> {
  const dateFilterVente = periode
    ? buildDateFilter(periode)
    : undefined;
  const dateFilterStock = periode
    ? buildDateFilter(periode)
    : undefined;
  const dateFilterPaiement = periode
    ? buildDateFilter(periode)
    : undefined;

  // Lancer toutes les agregations en parallele pour minimiser les round-trips
  const [
    venteAgg,
    paiementAgg,
    nombreFactures,
    coutsAliments,
    coutsIntrants,
    coutsEquipements,
    depensesHorsCommande,
  ] = await Promise.all([
    // Revenus : SUM et COUNT des ventes + SUM poids
    prisma.vente.aggregate({
      where: {
        siteId,
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

    // Couts par categorie (via jointure interne)
    sumCoutsParCategorie(siteId, CategorieProduit.ALIMENT, dateFilterStock),
    sumCoutsParCategorie(siteId, CategorieProduit.INTRANT, dateFilterStock),
    sumCoutsParCategorie(siteId, CategorieProduit.EQUIPEMENT, dateFilterStock),

    // Depenses hors-commande : anti double-comptage
    // Les depenses liees a une Commande sont deja comptees dans MouvementStock
    // Seules les depenses sans commandeId sont ajoutees ici
    prisma.depense.findMany({
      where: {
        siteId,
        commandeId: null,
        ...(dateFilterStock && { date: dateFilterStock }),
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

  // Agregation des depenses hors-commande
  let depensesTotales = 0;
  let depensesPayees = 0;
  let depensesImpayees = 0;
  const depensesParCategorie: Partial<Record<CategorieDepense, number>> = {};

  for (const dep of depensesHorsCommande) {
    depensesTotales += dep.montantTotal;
    if (dep.statut === StatutDepense.PAYEE) {
      depensesPayees += dep.montantTotal;
    } else {
      depensesImpayees += dep.montantTotal - dep.montantPaye;
    }
    const cat = dep.categorieDepense as CategorieDepense;
    depensesParCategorie[cat] = (depensesParCategorie[cat] ?? 0) + dep.montantTotal;
  }

  const coutsStock = coutsAliments + coutsIntrants + coutsEquipements;
  const coutsTotaux = coutsStock + depensesTotales;
  const margeBrute = revenus - coutsTotaux;
  const tauxMarge = revenus > 0 ? (margeBrute / revenus) * 100 : null;
  const creances = revenus - encaissements;
  const prixMoyenVenteKg = poidsTotalKg > 0 ? revenus / poidsTotalKg : null;

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
    depensesTotales: Math.round(depensesTotales),
    depensesPayees: Math.round(depensesPayees),
    depensesImpayees: Math.round(depensesImpayees),
    depensesParCategorie: Object.fromEntries(
      Object.entries(depensesParCategorie).map(([k, v]) => [k, Math.round(v as number)])
    ) as Partial<Record<CategorieDepense, number>>,
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

  // Charger toutes les ventes de ces vagues en une seule requete
  const toutesVentes = await prisma.vente.findMany({
    where: { siteId, vagueId: { in: vagueIds } },
    select: { vagueId: true, montantTotal: true, poidsTotalKg: true },
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

  // Agreger par vagueId en memoire
  const ventesByVague = new Map<
    string,
    { revenus: number; poidsTotalKg: number; nombreVentes: number }
  >();
  for (const v of toutesVentes) {
    const existing = ventesByVague.get(v.vagueId) ?? {
      revenus: 0,
      poidsTotalKg: 0,
      nombreVentes: 0,
    };
    existing.revenus += v.montantTotal;
    existing.poidsTotalKg += v.poidsTotalKg;
    existing.nombreVentes += 1;
    ventesByVague.set(v.vagueId, existing);
  }

  const coutsByVague = new Map<string, number>();
  for (const c of toutesConsommations) {
    const vagueId = c.releve.vagueId;
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
 * - couts         : SUM(MouvementStock.prixTotal) type=ENTREE ce mois
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
  // Calculer la date de debut : debut du mois il y a moisCount mois
  const now = new Date();
  const dateDebut = new Date(now.getFullYear(), now.getMonth() - (moisCount - 1), 1);

  // Charger toutes les donnees sur la periode en parallele
  const [ventes, mouvements, paiements, depensesHorsCommande] = await Promise.all([
    prisma.vente.findMany({
      where: {
        siteId,
        createdAt: { gte: dateDebut },
      },
      select: { createdAt: true, montantTotal: true },
    }),
    prisma.mouvementStock.findMany({
      where: {
        siteId,
        type: TypeMouvement.ENTREE,
        prixTotal: { not: null },
        date: { gte: dateDebut },
      },
      select: { date: true, prixTotal: true },
    }),
    prisma.paiement.findMany({
      where: {
        siteId,
        date: { gte: dateDebut },
      },
      select: { date: true, montant: true },
    }),
    // Depenses hors-commande (anti double-comptage)
    prisma.depense.findMany({
      where: {
        siteId,
        commandeId: null,
        date: { gte: dateDebut },
      },
      select: { date: true, montantTotal: true },
    }),
  ]);

  // Generer la liste des mois de la periode (format "YYYY-MM")
  const moisList: string[] = [];
  for (let i = 0; i < moisCount; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - (moisCount - 1) + i, 1);
    const moisLabel = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    moisList.push(moisLabel);
  }

  // Initialiser les agregats par mois
  const agregats = new Map<
    string,
    { revenus: number; couts: number; encaissements: number }
  >();
  for (const mois of moisList) {
    agregats.set(mois, { revenus: 0, couts: 0, encaissements: 0 });
  }

  // Affecter les ventes
  for (const v of ventes) {
    const mois = `${v.createdAt.getFullYear()}-${String(
      v.createdAt.getMonth() + 1
    ).padStart(2, "0")}`;
    const agg = agregats.get(mois);
    if (agg) agg.revenus += v.montantTotal;
  }

  // Affecter les mouvements
  for (const m of mouvements) {
    const mois = `${m.date.getFullYear()}-${String(
      m.date.getMonth() + 1
    ).padStart(2, "0")}`;
    const agg = agregats.get(mois);
    if (agg) agg.couts += m.prixTotal ?? 0;
  }

  // Affecter les depenses hors-commande (anti double-comptage)
  for (const d of depensesHorsCommande) {
    const mois = `${d.date.getFullYear()}-${String(
      d.date.getMonth() + 1
    ).padStart(2, "0")}`;
    const agg = agregats.get(mois);
    if (agg) agg.couts += d.montantTotal;
  }

  // Affecter les paiements
  for (const p of paiements) {
    const mois = `${p.date.getFullYear()}-${String(
      p.date.getMonth() + 1
    ).padStart(2, "0")}`;
    const agg = agregats.get(mois);
    if (agg) agg.encaissements += p.montant;
  }

  // Construire le tableau final ordonne par mois croissant
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
        where: { siteId },
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
