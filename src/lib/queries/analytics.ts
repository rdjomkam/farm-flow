import { prisma } from "@/lib/db";
import { TypeReleve, CategorieProduit, StatutVague, StatutReproducteur, StatutLotAlevins } from "@/types";
import type {
  IndicateursBac,
  ComparaisonBacs,
  AlerteBac,
  HistoriqueBac,
  HistoriqueBacCycle,
  AnalytiqueAliment,
  ComparaisonAliments,
  DetailAliment,
  DetailAlimentVague,
  SimulationResult,
} from "@/types";
import {
  calculerTauxSurvie,
  calculerSGR,
  calculerFCR,
  calculerBiomasse,
  calculerDensite,
  calculerTauxMortalite,
  calculerGainQuotidien,
  calculerFCRParAliment,
  calculerCoutParKgGain,
  calculerCoutParKg,
  calculerROI,
  genererRecommandation,
} from "@/lib/calculs";
import {
  BENCHMARK_SURVIE,
  BENCHMARK_FCR,
  BENCHMARK_MORTALITE,
  BENCHMARK_DENSITE,
} from "@/lib/benchmarks";

// ---------------------------------------------------------------------------
// Helpers internes
// ---------------------------------------------------------------------------

/**
 * Calcule les indicateurs d'un bac a partir de ses releves et des donnees vague.
 * Fonction interne partagee par getIndicateursBac et getComparaisonBacs.
 */
function computeIndicateursBac(
  bac: { id: string; nom: string; volume: number },
  vagueId: string,
  nombreInitialVague: number,
  poidsMoyenInitialVague: number,
  dateDebutVague: Date,
  dateFinVague: Date | null,
  releves: {
    typeReleve: string;
    date: Date;
    poidsMoyen: number | null;
    tailleMoyenne: number | null;
    nombreMorts: number | null;
    quantiteAliment: number | null;
    nombreCompte: number | null;
  }[],
  totalBacsVague: number
): IndicateursBac {
  // Repartition proportionnelle du nombre initial par bac
  const nombreInitialBac = Math.round(nombreInitialVague / totalBacsVague);

  const biometries = releves.filter((r) => r.typeReleve === TypeReleve.BIOMETRIE);
  const mortalites = releves.filter((r) => r.typeReleve === TypeReleve.MORTALITE);
  const alimentations = releves.filter((r) => r.typeReleve === TypeReleve.ALIMENTATION);
  const comptages = releves.filter((r) => r.typeReleve === TypeReleve.COMPTAGE);

  const derniereBiometrie = biometries.at(-1);
  const poidsMoyen = derniereBiometrie?.poidsMoyen ?? null;

  const totalMortalites = mortalites.reduce((sum, r) => sum + (r.nombreMorts ?? 0), 0);
  const totalAliment = alimentations.reduce((sum, r) => sum + (r.quantiteAliment ?? 0), 0);

  const dernierComptage = comptages.at(-1);
  const nombreVivants = dernierComptage?.nombreCompte ?? nombreInitialBac - totalMortalites;

  const now = dateFinVague ?? new Date();
  const joursEcoules = Math.max(
    1,
    Math.floor((now.getTime() - dateDebutVague.getTime()) / (1000 * 60 * 60 * 24))
  );

  const tauxSurvie = calculerTauxSurvie(nombreVivants, nombreInitialBac);
  const biomasse = calculerBiomasse(poidsMoyen, nombreVivants);
  const sgr = calculerSGR(poidsMoyenInitialVague, poidsMoyen, joursEcoules);
  const biomasseInitiale = calculerBiomasse(poidsMoyenInitialVague, nombreInitialBac);
  const gainBiomasse =
    biomasse !== null && biomasseInitiale !== null ? biomasse - biomasseInitiale : null;
  const fcr = calculerFCR(totalAliment, gainBiomasse);
  const densite = calculerDensite(biomasse, bac.volume);
  const tauxMortalite = calculerTauxMortalite(totalMortalites, nombreInitialBac);
  const gainQuotidien = calculerGainQuotidien(biomasseInitiale, biomasse, joursEcoules);

  const dernierReleve = releves.length > 0 ? releves[releves.length - 1].date : null;

  return {
    bacId: bac.id,
    bacNom: bac.nom,
    vagueId,
    volume: bac.volume,
    tauxSurvie: tauxSurvie !== null ? Math.round(tauxSurvie * 100) / 100 : null,
    fcr: fcr !== null ? Math.round(fcr * 100) / 100 : null,
    sgr: sgr !== null ? Math.round(sgr * 100) / 100 : null,
    biomasse: biomasse !== null ? Math.round(biomasse * 100) / 100 : null,
    poidsMoyen,
    densite: densite !== null ? Math.round(densite * 100) / 100 : null,
    tauxMortalite: tauxMortalite !== null ? Math.round(tauxMortalite * 100) / 100 : null,
    gainQuotidien: gainQuotidien !== null ? Math.round(gainQuotidien * 1000) / 1000 : null,
    nombreVivants,
    totalMortalites,
    totalAliment: Math.round(totalAliment * 100) / 100,
    dernierReleve,
    nombreReleves: releves.length,
  };
}

/**
 * Genere les alertes pour un bac en comparant ses indicateurs aux benchmarks.
 */
function genererAlertes(indicateurs: IndicateursBac): AlerteBac[] {
  const alertes: AlerteBac[] = [];

  if (
    indicateurs.tauxSurvie !== null &&
    indicateurs.tauxSurvie < BENCHMARK_SURVIE.acceptable.min
  ) {
    alertes.push({
      bacId: indicateurs.bacId,
      bacNom: indicateurs.bacNom,
      type: "SURVIE_BASSE",
      message: `Survie critique (${indicateurs.tauxSurvie}%) dans ${indicateurs.bacNom}`,
      valeur: indicateurs.tauxSurvie,
      seuil: BENCHMARK_SURVIE.acceptable.min,
    });
  }

  if (indicateurs.fcr !== null && indicateurs.fcr > BENCHMARK_FCR.acceptable.max) {
    alertes.push({
      bacId: indicateurs.bacId,
      bacNom: indicateurs.bacNom,
      type: "FCR_ELEVE",
      message: `FCR trop eleve (${indicateurs.fcr}) dans ${indicateurs.bacNom}`,
      valeur: indicateurs.fcr,
      seuil: BENCHMARK_FCR.acceptable.max,
    });
  }

  if (
    indicateurs.tauxMortalite !== null &&
    indicateurs.tauxMortalite > BENCHMARK_MORTALITE.acceptable.max
  ) {
    alertes.push({
      bacId: indicateurs.bacId,
      bacNom: indicateurs.bacNom,
      type: "MORTALITE_HAUTE",
      message: `Mortalite elevee (${indicateurs.tauxMortalite}%) dans ${indicateurs.bacNom}`,
      valeur: indicateurs.tauxMortalite,
      seuil: BENCHMARK_MORTALITE.acceptable.max,
    });
  }

  if (indicateurs.densite !== null && indicateurs.densite > BENCHMARK_DENSITE.acceptable.max) {
    alertes.push({
      bacId: indicateurs.bacId,
      bacNom: indicateurs.bacNom,
      type: "DENSITE_ELEVEE",
      message: `Densite trop elevee (${indicateurs.densite} kg/m\u00B3) dans ${indicateurs.bacNom}`,
      valeur: indicateurs.densite,
      seuil: BENCHMARK_DENSITE.acceptable.max,
    });
  }

  return alertes;
}

// ---------------------------------------------------------------------------
// Queries publiques
// ---------------------------------------------------------------------------

/**
 * Calcule les indicateurs d'un bac individuel au sein d'une vague.
 *
 * @param siteId - ID du site (multi-tenancy)
 * @param vagueId - ID de la vague
 * @param bacId - ID du bac
 */
export async function getIndicateursBac(
  siteId: string,
  vagueId: string,
  bacId: string
): Promise<IndicateursBac | null> {
  const [vague, bac] = await Promise.all([
    prisma.vague.findFirst({
      where: { id: vagueId, siteId },
      select: {
        id: true,
        nombreInitial: true,
        poidsMoyenInitial: true,
        dateDebut: true,
        dateFin: true,
        _count: { select: { bacs: true } },
      },
    }),
    prisma.bac.findFirst({
      where: { id: bacId, siteId },
      select: { id: true, nom: true, volume: true },
    }),
  ]);

  if (!vague || !bac) return null;

  const releves = await prisma.releve.findMany({
    where: { vagueId, bacId, siteId },
    orderBy: { date: "asc" },
    select: {
      typeReleve: true,
      date: true,
      poidsMoyen: true,
      tailleMoyenne: true,
      nombreMorts: true,
      quantiteAliment: true,
      nombreCompte: true,
    },
  });

  return computeIndicateursBac(
    bac,
    vagueId,
    vague.nombreInitial,
    vague.poidsMoyenInitial,
    vague.dateDebut,
    vague.dateFin,
    releves,
    vague._count.bacs || 1
  );
}

/**
 * Calcule et compare les indicateurs de tous les bacs d'une vague.
 *
 * @param siteId - ID du site (multi-tenancy)
 * @param vagueId - ID de la vague
 */
export async function getComparaisonBacs(
  siteId: string,
  vagueId: string
): Promise<ComparaisonBacs | null> {
  const vague = await prisma.vague.findFirst({
    where: { id: vagueId, siteId },
    select: {
      id: true,
      code: true,
      nombreInitial: true,
      poidsMoyenInitial: true,
      dateDebut: true,
      dateFin: true,
      bacs: {
        select: { id: true, nom: true, volume: true },
      },
    },
  });

  if (!vague) return null;

  const totalBacs = vague.bacs.length || 1;

  // Fetch all releves for this vague in one query
  const allReleves = await prisma.releve.findMany({
    where: { vagueId, siteId },
    orderBy: { date: "asc" },
    select: {
      bacId: true,
      typeReleve: true,
      date: true,
      poidsMoyen: true,
      tailleMoyenne: true,
      nombreMorts: true,
      quantiteAliment: true,
      nombreCompte: true,
    },
  });

  // Group releves by bacId
  const relevesByBac = new Map<string, typeof allReleves>();
  for (const r of allReleves) {
    const existing = relevesByBac.get(r.bacId) ?? [];
    existing.push(r);
    relevesByBac.set(r.bacId, existing);
  }

  // Compute indicators for each bac
  const bacs: IndicateursBac[] = vague.bacs.map((bac) => {
    const bacReleves = relevesByBac.get(bac.id) ?? [];
    return computeIndicateursBac(
      bac,
      vagueId,
      vague.nombreInitial,
      vague.poidsMoyenInitial,
      vague.dateDebut,
      vague.dateFin,
      bacReleves,
      totalBacs
    );
  });

  // Find best performers
  const bacsWithFCR = bacs.filter((b) => b.fcr !== null);
  const meilleurFCR =
    bacsWithFCR.length > 0
      ? bacsWithFCR.reduce((best, b) => (b.fcr! < best.fcr! ? b : best)).bacId
      : null;

  const bacsWithSurvie = bacs.filter((b) => b.tauxSurvie !== null);
  const meilleurSurvie =
    bacsWithSurvie.length > 0
      ? bacsWithSurvie.reduce((best, b) => (b.tauxSurvie! > best.tauxSurvie! ? b : best)).bacId
      : null;

  // Generate alerts
  const alertes: AlerteBac[] = bacs.flatMap(genererAlertes);

  return {
    vagueId,
    vagueCode: vague.code,
    bacs,
    meilleurFCR,
    meilleurSurvie,
    alertes,
  };
}

/**
 * Retourne l'historique de performance d'un bac a travers les vagues successives.
 *
 * @param siteId - ID du site (multi-tenancy)
 * @param bacId - ID du bac
 */
export async function getHistoriqueBac(
  siteId: string,
  bacId: string
): Promise<HistoriqueBac | null> {
  const bac = await prisma.bac.findFirst({
    where: { id: bacId, siteId },
    select: { id: true, nom: true, volume: true },
  });

  if (!bac) return null;

  // Find all vagues that had releves in this bac
  const vaguesWithReleves = await prisma.releve.findMany({
    where: { bacId, siteId },
    select: { vagueId: true },
    distinct: ["vagueId"],
  });

  const vagueIds = vaguesWithReleves.map((r) => r.vagueId);
  if (vagueIds.length === 0) {
    return { bacId: bac.id, bacNom: bac.nom, volume: bac.volume, cycles: [] };
  }

  // Fetch all vagues and their releves for this bac
  const vagues = await prisma.vague.findMany({
    where: { id: { in: vagueIds }, siteId },
    orderBy: { dateDebut: "asc" },
    select: {
      id: true,
      code: true,
      nombreInitial: true,
      poidsMoyenInitial: true,
      dateDebut: true,
      dateFin: true,
      _count: { select: { bacs: true } },
    },
  });

  const allReleves = await prisma.releve.findMany({
    where: { bacId, siteId, vagueId: { in: vagueIds } },
    orderBy: { date: "asc" },
    select: {
      vagueId: true,
      typeReleve: true,
      date: true,
      poidsMoyen: true,
      tailleMoyenne: true,
      nombreMorts: true,
      quantiteAliment: true,
      nombreCompte: true,
    },
  });

  // Group releves by vagueId
  const relevesByVague = new Map<string, typeof allReleves>();
  for (const r of allReleves) {
    const existing = relevesByVague.get(r.vagueId) ?? [];
    existing.push(r);
    relevesByVague.set(r.vagueId, existing);
  }

  const cycles: HistoriqueBacCycle[] = vagues.map((vague) => {
    const vagueReleves = relevesByVague.get(vague.id) ?? [];
    const ind = computeIndicateursBac(
      bac,
      vague.id,
      vague.nombreInitial,
      vague.poidsMoyenInitial,
      vague.dateDebut,
      vague.dateFin,
      vagueReleves,
      vague._count.bacs || 1
    );
    return {
      vagueId: vague.id,
      vagueCode: vague.code,
      dateDebut: vague.dateDebut,
      dateFin: vague.dateFin,
      tauxSurvie: ind.tauxSurvie,
      fcr: ind.fcr,
      sgr: ind.sgr,
      biomasse: ind.biomasse,
      poidsMoyen: ind.poidsMoyen,
      gainQuotidien: ind.gainQuotidien,
      nombreReleves: ind.nombreReleves,
    };
  });

  return {
    bacId: bac.id,
    bacNom: bac.nom,
    volume: bac.volume,
    cycles,
  };
}

// ===========================================================================
// Analytiques par aliment (CR-011)
// ===========================================================================

/**
 * Calcule les metriques agregees d'un produit aliment pour un site.
 * Interne, reutilisee par getComparaisonAliments et getDetailAliment.
 */
async function computeAlimentMetrics(
  siteId: string,
  produit: {
    id: string;
    nom: string;
    prixUnitaire: number;
    fournisseur: { nom: string } | null;
  }
): Promise<{
  analytique: AnalytiqueAliment;
  parVague: DetailAlimentVague[];
  evolutionFCR: { date: string; fcr: number }[];
}> {
  // Get all ReleveConsommation for this product on this site
  const consommations = await prisma.releveConsommation.findMany({
    where: { produitId: produit.id, siteId },
    select: {
      quantite: true,
      releve: {
        select: {
          id: true,
          vagueId: true,
          date: true,
        },
      },
    },
  });

  if (consommations.length === 0) {
    return {
      analytique: {
        produitId: produit.id,
        produitNom: produit.nom,
        fournisseurNom: produit.fournisseur?.nom ?? null,
        categorie: CategorieProduit.ALIMENT,
        prixUnitaire: produit.prixUnitaire,
        quantiteTotale: 0,
        coutTotal: 0,
        nombreVagues: 0,
        fcrMoyen: null,
        sgrMoyen: null,
        coutParKgGain: null,
        tauxSurvieAssocie: null,
      },
      parVague: [],
      evolutionFCR: [],
    };
  }

  // Group consommations by vagueId
  const consoByVague = new Map<string, { quantite: number; dates: Date[] }>();
  for (const c of consommations) {
    const vagueId = c.releve.vagueId;
    const existing = consoByVague.get(vagueId) ?? { quantite: 0, dates: [] };
    existing.quantite += c.quantite;
    existing.dates.push(c.releve.date);
    consoByVague.set(vagueId, existing);
  }

  const vagueIds = [...consoByVague.keys()];

  // Fetch vague data
  const vagues = await prisma.vague.findMany({
    where: { id: { in: vagueIds }, siteId },
    select: {
      id: true,
      code: true,
      nombreInitial: true,
      poidsMoyenInitial: true,
      dateDebut: true,
      dateFin: true,
    },
  });

  // Fetch biometrie and mortalite releves for these vagues
  const vagueReleves = await prisma.releve.findMany({
    where: {
      vagueId: { in: vagueIds },
      siteId,
      typeReleve: { in: [TypeReleve.BIOMETRIE, TypeReleve.MORTALITE, TypeReleve.COMPTAGE] },
    },
    orderBy: { date: "asc" },
    select: {
      vagueId: true,
      typeReleve: true,
      date: true,
      poidsMoyen: true,
      nombreMorts: true,
      nombreCompte: true,
    },
  });

  // Group releves by vague
  const relevesByVague = new Map<string, typeof vagueReleves>();
  for (const r of vagueReleves) {
    const existing = relevesByVague.get(r.vagueId) ?? [];
    existing.push(r);
    relevesByVague.set(r.vagueId, existing);
  }

  // Compute per-vague metrics
  const vagueMetrics: {
    quantite: number;
    gainBiomasse: number | null;
    fcr: number | null;
    sgr: number | null;
    coutParKgGain: number | null;
    tauxSurvie: number | null;
    detail: DetailAlimentVague;
  }[] = [];

  const evolutionFCR: { date: string; fcr: number }[] = [];

  for (const vague of vagues) {
    const conso = consoByVague.get(vague.id);
    if (!conso) continue;

    const releves = relevesByVague.get(vague.id) ?? [];
    const biometries = releves
      .filter((r) => r.typeReleve === TypeReleve.BIOMETRIE)
      .sort((a, b) => a.date.getTime() - b.date.getTime());
    const mortalites = releves.filter((r) => r.typeReleve === TypeReleve.MORTALITE);
    const comptages = releves.filter((r) => r.typeReleve === TypeReleve.COMPTAGE);

    const derniereBio = biometries.at(-1);
    const poidsMoyen = derniereBio?.poidsMoyen ?? null;

    const totalMorts = mortalites.reduce((s, r) => s + (r.nombreMorts ?? 0), 0);
    const dernierComptage = comptages.at(-1);
    const nombreVivants = dernierComptage?.nombreCompte ?? vague.nombreInitial - totalMorts;

    const biomasse = calculerBiomasse(poidsMoyen, nombreVivants);
    const biomasseInitiale = calculerBiomasse(vague.poidsMoyenInitial, vague.nombreInitial);
    const gainBiomasse =
      biomasse !== null && biomasseInitiale !== null ? biomasse - biomasseInitiale : null;

    const now = vague.dateFin ?? new Date();
    const jours = Math.max(
      1,
      Math.floor((now.getTime() - vague.dateDebut.getTime()) / (1000 * 60 * 60 * 24))
    );

    const fcr = calculerFCR(conso.quantite, gainBiomasse);
    const sgr = calculerSGR(vague.poidsMoyenInitial, poidsMoyen, jours);
    const tauxSurvie = calculerTauxSurvie(nombreVivants, vague.nombreInitial);
    const coutKg = calculerCoutParKgGain(conso.quantite, produit.prixUnitaire, gainBiomasse);

    vagueMetrics.push({
      quantite: conso.quantite,
      gainBiomasse,
      fcr,
      sgr,
      coutParKgGain: coutKg,
      tauxSurvie,
      detail: {
        vagueId: vague.id,
        vagueCode: vague.code,
        quantite: conso.quantite,
        fcr: fcr !== null ? Math.round(fcr * 100) / 100 : null,
        sgr: sgr !== null ? Math.round(sgr * 100) / 100 : null,
        coutParKgGain: coutKg !== null ? Math.round(coutKg) : null,
        periode: { debut: vague.dateDebut, fin: vague.dateFin },
      },
    });

    // FCR evolution point (using median date of consommations)
    if (fcr !== null) {
      const sortedDates = conso.dates.sort((a, b) => a.getTime() - b.getTime());
      const medianDate = sortedDates[Math.floor(sortedDates.length / 2)];
      evolutionFCR.push({
        date: medianDate.toISOString(),
        fcr: Math.round(fcr * 100) / 100,
      });
    }
  }

  // Aggregate metrics
  const quantiteTotale = vagueMetrics.reduce((s, v) => s + v.quantite, 0);
  const coutTotal = Math.round(quantiteTotale * produit.prixUnitaire);

  const fcrMoyen = calculerFCRParAliment(
    vagueMetrics.map((v) => ({ quantite: v.quantite, gainBiomasse: v.gainBiomasse }))
  );

  // Weighted SGR
  const sgrEntries = vagueMetrics.filter((v) => v.sgr !== null);
  const sgrMoyen =
    sgrEntries.length > 0
      ? sgrEntries.reduce((s, v) => s + v.sgr! * v.quantite, 0) /
        sgrEntries.reduce((s, v) => s + v.quantite, 0)
      : null;

  // Weighted survival
  const survieEntries = vagueMetrics.filter((v) => v.tauxSurvie !== null);
  const tauxSurvieAssocie =
    survieEntries.length > 0
      ? survieEntries.reduce((s, v) => s + v.tauxSurvie! * v.quantite, 0) /
        survieEntries.reduce((s, v) => s + v.quantite, 0)
      : null;

  // Overall cost per kg gain
  const totalGain = vagueMetrics.reduce(
    (s, v) => s + (v.gainBiomasse != null && v.gainBiomasse > 0 ? v.gainBiomasse : 0),
    0
  );
  const coutParKgGain = totalGain > 0 ? coutTotal / totalGain : null;

  return {
    analytique: {
      produitId: produit.id,
      produitNom: produit.nom,
      fournisseurNom: produit.fournisseur?.nom ?? null,
      categorie: CategorieProduit.ALIMENT,
      prixUnitaire: produit.prixUnitaire,
      quantiteTotale: Math.round(quantiteTotale * 100) / 100,
      coutTotal,
      nombreVagues: vagueMetrics.length,
      fcrMoyen: fcrMoyen !== null ? Math.round(fcrMoyen * 100) / 100 : null,
      sgrMoyen: sgrMoyen !== null ? Math.round(sgrMoyen * 100) / 100 : null,
      coutParKgGain: coutParKgGain !== null ? Math.round(coutParKgGain) : null,
      tauxSurvieAssocie:
        tauxSurvieAssocie !== null ? Math.round(tauxSurvieAssocie * 100) / 100 : null,
    },
    parVague: vagueMetrics.map((v) => v.detail),
    evolutionFCR: evolutionFCR.sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    ),
  };
}

/**
 * Compare tous les aliments utilises sur un site.
 *
 * @param siteId - ID du site
 * @param filters - Filtres optionnels (vagueId, fournisseurId)
 */
export async function getComparaisonAliments(
  siteId: string,
  filters?: { vagueId?: string; fournisseurId?: string }
): Promise<ComparaisonAliments> {
  // Fetch all active ALIMENT products on the site
  const whereClause: Record<string, unknown> = {
    siteId,
    categorie: CategorieProduit.ALIMENT,
    isActive: true,
  };
  if (filters?.fournisseurId) {
    whereClause.fournisseurId = filters.fournisseurId;
  }

  const produits = await prisma.produit.findMany({
    where: whereClause,
    select: {
      id: true,
      nom: true,
      prixUnitaire: true,
      fournisseur: { select: { nom: true } },
    },
    orderBy: { nom: "asc" },
  });

  const aliments: AnalytiqueAliment[] = [];

  for (const produit of produits) {
    const { analytique } = await computeAlimentMetrics(siteId, produit);
    // Only include aliments that have been used
    if (analytique.quantiteTotale > 0) {
      aliments.push(analytique);
    }
  }

  // Sort by coutParKgGain ascending (best first)
  aliments.sort((a, b) => {
    if (a.coutParKgGain == null && b.coutParKgGain == null) return 0;
    if (a.coutParKgGain == null) return 1;
    if (b.coutParKgGain == null) return -1;
    return a.coutParKgGain - b.coutParKgGain;
  });

  // Find bests
  const withFCR = aliments.filter((a) => a.fcrMoyen !== null);
  const meilleurFCR =
    withFCR.length > 0
      ? withFCR.reduce((best, a) => (a.fcrMoyen! < best.fcrMoyen! ? a : best)).produitId
      : null;

  const withCout = aliments.filter((a) => a.coutParKgGain !== null);
  const meilleurCoutKg =
    withCout.length > 0
      ? withCout.reduce((best, a) => (a.coutParKgGain! < best.coutParKgGain! ? a : best))
          .produitId
      : null;

  const withSGR = aliments.filter((a) => a.sgrMoyen !== null);
  const meilleurSGR =
    withSGR.length > 0
      ? withSGR.reduce((best, a) => (a.sgrMoyen! > best.sgrMoyen! ? a : best)).produitId
      : null;

  // Generate recommendation
  const meilleur = aliments.find((a) => a.produitId === meilleurCoutKg) ?? null;
  const deuxieme = aliments.find((a) => a.produitId !== meilleurCoutKg && a.coutParKgGain !== null) ?? null;

  const recommandation = genererRecommandation(
    meilleur
      ? {
          nom: meilleur.produitNom,
          fournisseur: meilleur.fournisseurNom,
          fcrMoyen: meilleur.fcrMoyen,
          coutParKgGain: meilleur.coutParKgGain,
        }
      : null,
    deuxieme
      ? {
          nom: deuxieme.produitNom,
          fcrMoyen: deuxieme.fcrMoyen,
          coutParKgGain: deuxieme.coutParKgGain,
        }
      : null
  );

  return {
    siteId,
    aliments,
    meilleurFCR,
    meilleurCoutKg,
    meilleurSGR,
    recommandation,
  };
}

/**
 * Retourne le detail d'un aliment specifique avec ventilation par vague.
 *
 * @param siteId - ID du site
 * @param produitId - ID du produit aliment
 */
export async function getDetailAliment(
  siteId: string,
  produitId: string
): Promise<DetailAliment | null> {
  const produit = await prisma.produit.findFirst({
    where: { id: produitId, siteId, categorie: CategorieProduit.ALIMENT },
    select: {
      id: true,
      nom: true,
      prixUnitaire: true,
      fournisseur: { select: { nom: true } },
    },
  });

  if (!produit) return null;

  const { analytique, parVague, evolutionFCR } = await computeAlimentMetrics(siteId, produit);

  return {
    ...analytique,
    parVague,
    evolutionFCR,
  };
}

/**
 * Simule le changement d'un aliment par un autre.
 *
 * @param siteId - ID du site
 * @param ancienProduitId - ID du produit actuel
 * @param nouveauProduitId - ID du nouveau produit
 * @param productionCible - Production cible en kg de biomasse
 */
export async function getSimulationChangementAliment(
  siteId: string,
  ancienProduitId: string,
  nouveauProduitId: string,
  productionCible: number
): Promise<SimulationResult | null> {
  const [ancien, nouveau] = await Promise.all([
    prisma.produit.findFirst({
      where: { id: ancienProduitId, siteId, categorie: CategorieProduit.ALIMENT },
      select: { id: true, nom: true, prixUnitaire: true, fournisseur: { select: { nom: true } } },
    }),
    prisma.produit.findFirst({
      where: { id: nouveauProduitId, siteId, categorie: CategorieProduit.ALIMENT },
      select: { id: true, nom: true, prixUnitaire: true, fournisseur: { select: { nom: true } } },
    }),
  ]);

  if (!ancien || !nouveau) return null;

  const [metricsAncien, metricsNouveau] = await Promise.all([
    computeAlimentMetrics(siteId, ancien),
    computeAlimentMetrics(siteId, nouveau),
  ]);

  const ancienFCR = metricsAncien.analytique.fcrMoyen;
  const nouveauFCR = metricsNouveau.analytique.fcrMoyen;

  // Cout = FCR × prixUnitaire × productionCible
  const ancienCout =
    ancienFCR !== null ? Math.round(ancienFCR * ancien.prixUnitaire * productionCible) : null;
  const nouveauCout =
    nouveauFCR !== null ? Math.round(nouveauFCR * nouveau.prixUnitaire * productionCible) : null;

  const economie =
    ancienCout !== null && nouveauCout !== null ? ancienCout - nouveauCout : null;

  let message: string;
  if (economie === null) {
    message = "Donnees insuffisantes pour calculer l'economie. Utilisez les deux aliments sur au moins une vague.";
  } else if (economie > 0) {
    message = `En passant de '${ancien.nom}' a '${nouveau.nom}' pour ${productionCible} kg de production, vous economiseriez ${economie.toLocaleString("fr-FR")} CFA.`;
  } else if (economie < 0) {
    message = `Le passage de '${ancien.nom}' a '${nouveau.nom}' couterait ${Math.abs(economie).toLocaleString("fr-FR")} CFA de plus pour ${productionCible} kg de production.`;
  } else {
    message = `Les deux aliments ont un cout equivalent pour ${productionCible} kg de production.`;
  }

  return {
    ancienProduitId: ancien.id,
    ancienProduitNom: ancien.nom,
    nouveauProduitId: nouveau.id,
    nouveauProduitNom: nouveau.nom,
    productionCible,
    ancienFCR,
    nouveauFCR,
    ancienCout,
    nouveauCout,
    economie,
    message,
  };
}

// ===========================================================================
// Dashboard analytique global + comparaison vagues (CR-012)
// ===========================================================================

// ---------------------------------------------------------------------------
// Types locaux CR-012
// ---------------------------------------------------------------------------

interface AnalyticsDashboardStats {
  vaguesEnCours: number;
  bacsActifs: number;
  totalReproducteurs: number;
  totalLotsEnElevage: number;
}

interface AnalyticsDashboard {
  meilleurBac: { id: string; nom: string; fcr: number; tauxSurvie: number | null } | null;
  meilleurAliment: { nom: string; coutParKgGain: number } | null;
  alertesPerformance: number;
  tendanceFCR: { mois: string; fcr: number }[];
  stats: AnalyticsDashboardStats;
}

interface IndicateursVagueComparaison {
  id: string;
  nom: string;
  code: string;
  statut: string;
  dateDebut: Date;
  dateFin: Date | null;
  dureeJours: number;
  nombreInitial: number;
  fcrGlobal: number | null;
  tauxSurvie: number | null;
  sgrMoyen: number | null;
  biomasseProduite: number | null;
  coutTotalAliment: number;
  coutParKgProduit: number | null;
  revenuVentes: number;
  margeBrute: number | null;
  roi: number | null;
  nombreBacs: number;
}

interface ComparaisonVagues {
  vagues: IndicateursVagueComparaison[];
}

// ---------------------------------------------------------------------------
// Helpers internes CR-012
// ---------------------------------------------------------------------------

/**
 * Calcule le FCR global d'une vague a partir de ses releves.
 * Somme toutes les quantites ALIMENTATION / gain biomasse BIOMETRIE.
 */
function computeFCRVague(
  releves: {
    typeReleve: string;
    poidsMoyen: number | null;
    nombreMorts: number | null;
    quantiteAliment: number | null;
    nombreCompte: number | null;
  }[],
  nombreInitial: number,
  poidsMoyenInitial: number
): { fcr: number | null; tauxSurvie: number | null; sgr: number | null; biomasse: number | null } {
  const biometries = releves.filter((r) => r.typeReleve === TypeReleve.BIOMETRIE);
  const mortalites = releves.filter((r) => r.typeReleve === TypeReleve.MORTALITE);
  const alimentations = releves.filter((r) => r.typeReleve === TypeReleve.ALIMENTATION);
  const comptages = releves.filter((r) => r.typeReleve === TypeReleve.COMPTAGE);

  const derniereBio = biometries.at(-1);
  const poidsMoyen = derniereBio?.poidsMoyen ?? null;

  const totalMorts = mortalites.reduce((s, r) => s + (r.nombreMorts ?? 0), 0);
  const dernierComptage = comptages.at(-1);
  const nombreVivants = dernierComptage?.nombreCompte ?? nombreInitial - totalMorts;

  const totalAliment = alimentations.reduce((s, r) => s + (r.quantiteAliment ?? 0), 0);

  const biomasse = calculerBiomasse(poidsMoyen, nombreVivants);
  const biomasseInitiale = calculerBiomasse(poidsMoyenInitial, nombreInitial);
  const gainBiomasse =
    biomasse !== null && biomasseInitiale !== null ? biomasse - biomasseInitiale : null;

  const fcr = calculerFCR(totalAliment, gainBiomasse);
  const tauxSurvie = calculerTauxSurvie(nombreVivants, nombreInitial);
  const sgr = null; // SGR vague-niveau necessite duree — calcule dans getComparaisonVagues

  return {
    fcr: fcr !== null ? Math.round(fcr * 100) / 100 : null,
    tauxSurvie: tauxSurvie !== null ? Math.round(tauxSurvie * 100) / 100 : null,
    sgr,
    biomasse,
  };
}

// ---------------------------------------------------------------------------
// Queries publiques CR-012
// ---------------------------------------------------------------------------

/**
 * Dashboard analytique global pour un site.
 *
 * Retourne le meilleur bac (FCR le plus bas parmi vagues EN_COURS),
 * le meilleur aliment (cout/kg gain le plus bas), les alertes de performance,
 * la tendance FCR mensuelle sur 3 mois et des statistiques generales.
 *
 * @param siteId - ID du site (multi-tenancy)
 */
export async function getAnalyticsDashboard(siteId: string): Promise<AnalyticsDashboard> {
  // ---- 1. Stats generales (COUNT en parallele) ----
  const [vaguesEnCours, bacsActifs, totalReproducteurs, totalLotsEnElevage] = await Promise.all([
    prisma.vague.count({ where: { siteId, statut: StatutVague.EN_COURS } }),
    prisma.bac.count({ where: { siteId, vagueId: { not: null } } }),
    prisma.reproducteur.count({ where: { siteId, statut: StatutReproducteur.ACTIF } }),
    prisma.lotAlevins.count({ where: { siteId, statut: StatutLotAlevins.EN_ELEVAGE } }),
  ]);

  // ---- 2. Meilleur bac (FCR le plus bas parmi vagues EN_COURS) ----
  const vaguesActives = await prisma.vague.findMany({
    where: { siteId, statut: StatutVague.EN_COURS },
    select: {
      id: true,
      nombreInitial: true,
      poidsMoyenInitial: true,
      dateDebut: true,
      dateFin: true,
      bacs: { select: { id: true, nom: true, volume: true } },
      _count: { select: { bacs: true } },
    },
  });

  let meilleurBac: AnalyticsDashboard["meilleurBac"] = null;
  let alertesPerformance = 0;

  if (vaguesActives.length > 0) {
    const vagueIds = vaguesActives.map((v) => v.id);

    const allReleves = await prisma.releve.findMany({
      where: { siteId, vagueId: { in: vagueIds } },
      orderBy: { date: "asc" },
      select: {
        vagueId: true,
        bacId: true,
        typeReleve: true,
        poidsMoyen: true,
        nombreMorts: true,
        quantiteAliment: true,
        nombreCompte: true,
      },
    });

    // Grouper les releves par (vagueId, bacId)
    type ReleveKey = `${string}:${string}`;
    const relevesByVagueBac = new Map<ReleveKey, typeof allReleves>();
    for (const r of allReleves) {
      const key: ReleveKey = `${r.vagueId}:${r.bacId}`;
      const existing = relevesByVagueBac.get(key) ?? [];
      existing.push(r);
      relevesByVagueBac.set(key, existing);
    }

    let meilleurFCR = Infinity;

    for (const vague of vaguesActives) {
      const totalBacs = vague._count.bacs || 1;
      for (const bac of vague.bacs) {
        const key: ReleveKey = `${vague.id}:${bac.id}`;
        const bacReleves = relevesByVagueBac.get(key) ?? [];

        // Repartition proportionnelle du nombreInitial par bac
        const nombreInitialBac = Math.round(vague.nombreInitial / totalBacs);
        const { fcr, tauxSurvie } = computeFCRVague(
          bacReleves,
          nombreInitialBac,
          vague.poidsMoyenInitial
        );

        // Compter les alertes
        if (fcr !== null && fcr > BENCHMARK_FCR.acceptable.max) {
          alertesPerformance++;
        }
        if (tauxSurvie !== null && tauxSurvie < BENCHMARK_SURVIE.acceptable.min) {
          alertesPerformance++;
        }

        // Meilleur FCR global
        if (fcr !== null && fcr < meilleurFCR) {
          meilleurFCR = fcr;
          meilleurBac = { id: bac.id, nom: bac.nom, fcr, tauxSurvie };
        }
      }
    }
  }

  // ---- 3. Meilleur aliment (coutParKgGain le plus bas) ----
  let meilleurAliment: AnalyticsDashboard["meilleurAliment"] = null;

  const produits = await prisma.produit.findMany({
    where: { siteId, categorie: CategorieProduit.ALIMENT, isActive: true },
    select: {
      id: true,
      nom: true,
      prixUnitaire: true,
      fournisseur: { select: { nom: true } },
    },
  });

  let meilleurCoutKg = Infinity;
  for (const produit of produits) {
    const { analytique } = await computeAlimentMetrics(siteId, produit);
    if (analytique.coutParKgGain !== null && analytique.coutParKgGain < meilleurCoutKg) {
      meilleurCoutKg = analytique.coutParKgGain;
      meilleurAliment = { nom: produit.nom, coutParKgGain: analytique.coutParKgGain };
    }
  }

  // ---- 4. Tendance FCR sur 3 derniers mois ----
  const troisMoisAvant = new Date();
  troisMoisAvant.setMonth(troisMoisAvant.getMonth() - 3);

  // Recuperer les releves ALIMENTATION + BIOMETRIE sur 3 mois pour calcul FCR mensuel
  const relevesRecents = await prisma.releve.findMany({
    where: {
      siteId,
      date: { gte: troisMoisAvant },
      typeReleve: { in: [TypeReleve.ALIMENTATION, TypeReleve.BIOMETRIE, TypeReleve.COMPTAGE, TypeReleve.MORTALITE] },
    },
    orderBy: { date: "asc" },
    select: {
      date: true,
      typeReleve: true,
      vagueId: true,
      quantiteAliment: true,
      poidsMoyen: true,
      nombreMorts: true,
      nombreCompte: true,
      vague: {
        select: { nombreInitial: true, poidsMoyenInitial: true },
      },
    },
  });

  // Grouper par mois (YYYY-MM)
  const relevesByMois = new Map<string, typeof relevesRecents>();
  for (const r of relevesRecents) {
    const mois = r.date.toISOString().slice(0, 7); // "YYYY-MM"
    const existing = relevesByMois.get(mois) ?? [];
    existing.push(r);
    relevesByMois.set(mois, existing);
  }

  const tendanceFCR: { mois: string; fcr: number }[] = [];
  for (const [mois, releves] of relevesByMois.entries()) {
    const alimentations = releves.filter((r) => r.typeReleve === TypeReleve.ALIMENTATION);
    const biometries = releves.filter((r) => r.typeReleve === TypeReleve.BIOMETRIE);

    const totalAliment = alimentations.reduce((s, r) => s + (r.quantiteAliment ?? 0), 0);

    // Gain biomasse approxime : somme des gains par vague sur ce mois
    let totalGainBiomasse = 0;
    const vaguesIds = [...new Set(releves.map((r) => r.vagueId))];

    for (const vagueId of vaguesIds) {
      const vagueBios = biometries.filter((r) => r.vagueId === vagueId);
      if (vagueBios.length === 0) continue;
      const vagueRef = releves.find((r) => r.vagueId === vagueId)?.vague;
      if (!vagueRef) continue;

      const derniereBio = vagueBios.at(-1);
      const poidsMoyenFin = derniereBio?.poidsMoyen ?? null;
      const biomasseFin = calculerBiomasse(poidsMoyenFin, vagueRef.nombreInitial);
      const biomasseDebut = calculerBiomasse(vagueRef.poidsMoyenInitial, vagueRef.nombreInitial);
      if (biomasseFin !== null && biomasseDebut !== null && biomasseFin > biomasseDebut) {
        totalGainBiomasse += biomasseFin - biomasseDebut;
      }
    }

    const fcr = calculerFCR(totalAliment, totalGainBiomasse > 0 ? totalGainBiomasse : null);
    if (fcr !== null) {
      tendanceFCR.push({ mois, fcr: Math.round(fcr * 100) / 100 });
    }
  }

  // Trier par mois croissant
  tendanceFCR.sort((a, b) => a.mois.localeCompare(b.mois));

  return {
    meilleurBac,
    meilleurAliment,
    alertesPerformance,
    tendanceFCR,
    stats: {
      vaguesEnCours,
      bacsActifs,
      totalReproducteurs,
      totalLotsEnElevage,
    },
  };
}

/**
 * Compare les indicateurs zootechniques et financiers de 2 a 4 vagues.
 *
 * Pour chaque vague, calcule :
 * - FCR global, taux de survie, SGR moyen, biomasse produite
 * - Cout total aliment (via ReleveConsommation), cout par kg produit
 * - Revenu des ventes, marge brute, ROI
 *
 * @param siteId    - ID du site (multi-tenancy)
 * @param vagueIds  - Tableau de 2 a 4 IDs de vagues a comparer
 */
export async function getComparaisonVagues(
  siteId: string,
  vagueIds: string[]
): Promise<ComparaisonVagues> {
  if (vagueIds.length === 0) return { vagues: [] };

  // Limiter a 4 vagues maximum
  const ids = vagueIds.slice(0, 4);

  // Charger toutes les donnees en parallele
  const [vagues, allReleves, allVentes] = await Promise.all([
    prisma.vague.findMany({
      where: { id: { in: ids }, siteId },
      select: {
        id: true,
        code: true,
        statut: true,
        dateDebut: true,
        dateFin: true,
        nombreInitial: true,
        poidsMoyenInitial: true,
        bacs: { select: { id: true } },
      },
      orderBy: { dateDebut: "asc" },
    }),
    prisma.releve.findMany({
      where: { vagueId: { in: ids }, siteId },
      orderBy: { date: "asc" },
      select: {
        vagueId: true,
        typeReleve: true,
        date: true,
        poidsMoyen: true,
        nombreMorts: true,
        quantiteAliment: true,
        nombreCompte: true,
        consommations: {
          select: {
            quantite: true,
            produit: { select: { prixUnitaire: true } },
          },
        },
      },
    }),
    prisma.vente.findMany({
      where: { vagueId: { in: ids }, siteId },
      select: { vagueId: true, montantTotal: true },
    }),
  ]);

  // Grouper les releves et ventes par vagueId
  const relevesByVague = new Map<string, typeof allReleves>();
  for (const r of allReleves) {
    const existing = relevesByVague.get(r.vagueId) ?? [];
    existing.push(r);
    relevesByVague.set(r.vagueId, existing);
  }

  const ventesByVague = new Map<string, number>();
  for (const v of allVentes) {
    const current = ventesByVague.get(v.vagueId) ?? 0;
    ventesByVague.set(v.vagueId, current + v.montantTotal);
  }

  // Calculer les indicateurs pour chaque vague
  const result: IndicateursVagueComparaison[] = vagues.map((vague) => {
    const releves = relevesByVague.get(vague.id) ?? [];
    const now = vague.dateFin ?? new Date();
    const dureeJours = Math.max(
      1,
      Math.floor((now.getTime() - vague.dateDebut.getTime()) / (1000 * 60 * 60 * 24))
    );

    // ---- Indicateurs zootechniques ----
    const biometries = releves.filter((r) => r.typeReleve === TypeReleve.BIOMETRIE);
    const mortalites = releves.filter((r) => r.typeReleve === TypeReleve.MORTALITE);
    const alimentations = releves.filter((r) => r.typeReleve === TypeReleve.ALIMENTATION);
    const comptages = releves.filter((r) => r.typeReleve === TypeReleve.COMPTAGE);

    const derniereBio = biometries.at(-1);
    const premiereBio = biometries.at(0);
    const poidsMoyenFinal = derniereBio?.poidsMoyen ?? null;
    const poidsMoyenDebut = premiereBio?.poidsMoyen ?? vague.poidsMoyenInitial;

    const totalMorts = mortalites.reduce((s, r) => s + (r.nombreMorts ?? 0), 0);
    const dernierComptage = comptages.at(-1);
    const nombreVivants = dernierComptage?.nombreCompte ?? vague.nombreInitial - totalMorts;

    const totalAliment = alimentations.reduce((s, r) => s + (r.quantiteAliment ?? 0), 0);

    const biomasseProduite = calculerBiomasse(poidsMoyenFinal, nombreVivants);
    const biomasseInitiale = calculerBiomasse(vague.poidsMoyenInitial, vague.nombreInitial);
    const gainBiomasse =
      biomasseProduite !== null && biomasseInitiale !== null
        ? biomasseProduite - biomasseInitiale
        : null;

    const fcrGlobal = calculerFCR(totalAliment, gainBiomasse);
    const tauxSurvie = calculerTauxSurvie(nombreVivants, vague.nombreInitial);

    // SGR moyen : utilise poidsMoyenDebut et poidsMoyenFinal sur la duree totale
    const sgrMoyen = calculerSGR(poidsMoyenDebut, poidsMoyenFinal, dureeJours);

    // ---- Indicateurs financiers ----
    // Cout total aliment : SUM(quantite * prixUnitaire) depuis ReleveConsommation
    let coutTotalAliment = 0;
    for (const r of releves) {
      for (const c of r.consommations) {
        coutTotalAliment += c.quantite * c.produit.prixUnitaire;
      }
    }
    coutTotalAliment = Math.round(coutTotalAliment);

    const revenuVentes = Math.round(ventesByVague.get(vague.id) ?? 0);

    const coutParKgProduit =
      coutTotalAliment > 0
        ? calculerCoutParKg(coutTotalAliment, biomasseProduite)
        : null;

    const margeBrute = revenuVentes > 0 || coutTotalAliment > 0
      ? revenuVentes - coutTotalAliment
      : null;

    const roi = calculerROI(
      revenuVentes > 0 ? revenuVentes : null,
      coutTotalAliment > 0 ? coutTotalAliment : null
    );

    // Nom d'affichage = code (la vague n'a pas de champ "nom")
    const nom = vague.code;

    return {
      id: vague.id,
      nom,
      code: vague.code,
      statut: vague.statut,
      dateDebut: vague.dateDebut,
      dateFin: vague.dateFin,
      dureeJours,
      nombreInitial: vague.nombreInitial,
      fcrGlobal: fcrGlobal !== null ? Math.round(fcrGlobal * 100) / 100 : null,
      tauxSurvie: tauxSurvie !== null ? Math.round(tauxSurvie * 100) / 100 : null,
      sgrMoyen: sgrMoyen !== null ? Math.round(sgrMoyen * 100) / 100 : null,
      biomasseProduite: biomasseProduite !== null ? Math.round(biomasseProduite * 100) / 100 : null,
      coutTotalAliment,
      coutParKgProduit: coutParKgProduit !== null ? Math.round(coutParKgProduit) : null,
      revenuVentes,
      margeBrute: margeBrute !== null ? Math.round(margeBrute) : null,
      roi: roi !== null ? Math.round(roi * 100) / 100 : null,
      nombreBacs: vague.bacs.length,
    };
  });

  return { vagues: result };
}
