import { prisma } from "@/lib/db";
import { formatNumber } from "@/lib/format";
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
  AnalyticsDashboard,
  FiltresAnalyticsAliments,
  FCRHebdomadairePoint,
  ChangementGranule,
  AlerteRation,
  ConfigElevage,
} from "@/types";
import {
  calculerTauxSurvie,
  calculerSGR,
  calculerFCR,
  calculerBiomasse,
  calculerDensite,
  calculerTauxMortalite,
  calculerCoutParKgGain,
  calculerCoutParKg,
  calculerROI,
  genererRecommandation,
  getPrixParUniteBase,
  computeNombreVivantsVague,
  calculerADG,
  calculerPER,
  calculerScoreAliment,
  calculerEcartRation,
  getTauxAlimentation,
  detecterPhase,
} from "@/lib/calculs";
import {
  BENCHMARK_MORTALITE,
  BENCHMARK_DENSITE,
  getBenchmarkFCRPourPhase,
  BENCHMARK_DFR_PAR_PHASE,
} from "@/lib/benchmarks";
import { getFCRByFeed } from "@/lib/queries/fcr-by-feed";

// ---------------------------------------------------------------------------
// Helpers internes
// ---------------------------------------------------------------------------

/**
 * Calcule les indicateurs d'un bac a partir de ses releves et des donnees vague.
 * Fonction interne partagee par getIndicateursBac et getComparaisonBacs.
 */
function computeIndicateursBac(
  bac: { id: string; nom: string; volume: number | null; nombreInitial: number | null },
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
  // Utiliser le nombreInitial per-bac si disponible, sinon repartition uniforme
  const nombreInitialBac = bac.nombreInitial ?? Math.round(nombreInitialVague / totalBacsVague);

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

  const biomasse = calculerBiomasse(poidsMoyen, nombreVivants);
  const densite = calculerDensite(biomasse, bac.volume);

  const dernierReleve = releves.length > 0 ? releves[releves.length - 1].date : null;

  return {
    bacId: bac.id,
    bacNom: bac.nom,
    vagueId,
    volume: bac.volume,
    biomasse: biomasse !== null ? Math.round(biomasse * 100) / 100 : null,
    poidsMoyen,
    densite: densite !== null ? Math.round(densite * 100) / 100 : null,
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
function genererAlertes(indicateurs: IndicateursBac, nombreInitialBac: number): AlerteBac[] {
  const alertes: AlerteBac[] = [];

  // Compute mortality rate locally (performance metrics are tracked at vague level)
  const tauxMortalite = nombreInitialBac > 0
    ? calculerTauxMortalite(indicateurs.totalMortalites, nombreInitialBac)
    : null;

  if (
    tauxMortalite !== null &&
    tauxMortalite > BENCHMARK_MORTALITE.acceptable.max
  ) {
    const tauxArrondi = Math.round(tauxMortalite * 100) / 100;
    alertes.push({
      bacId: indicateurs.bacId,
      bacNom: indicateurs.bacNom,
      type: "MORTALITE_HAUTE",
      message: `Mortalite elevee (${tauxArrondi}%) dans ${indicateurs.bacNom}`,
      valeur: tauxArrondi,
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
  const [vague, bac, assignation] = await Promise.all([
    prisma.vague.findFirst({
      where: { id: vagueId, siteId },
      select: {
        id: true,
        nombreInitial: true,
        poidsMoyenInitial: true,
        dateDebut: true,
        dateFin: true,
        _count: {
          select: {
            bacs: true,
            // ADR-043 Phase 2: compter aussi les assignations
            assignations: { where: { vagueId } },
          },
        },
      },
    }),
    prisma.bac.findFirst({
      where: { id: bacId, siteId },
      select: { id: true, nom: true, volume: true, nombreInitial: true },
    }),
    // ADR-043 Phase 2: lire nombrePoissonsInitial depuis AssignationBac
    prisma.assignationBac.findFirst({
      where: { bacId, vagueId, siteId },
      orderBy: { dateAssignation: "asc" },
      select: { nombrePoissonsInitial: true },
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

  // ADR-043 Phase 2: préférer AssignationBac.nombrePoissonsInitial si disponible
  const bacWithBestNombreInitial = {
    ...bac,
    nombreInitial: assignation?.nombrePoissonsInitial ?? bac.nombreInitial,
  };

  // ADR-043 Phase 2: utiliser le nombre d'assignations si _count.bacs est insuffisant
  const totalBacs = vague._count.bacs > 0
    ? vague._count.bacs
    : (vague._count as { assignations?: number }).assignations ?? 1;

  return computeIndicateursBac(
    bacWithBestNombreInitial,
    vagueId,
    vague.nombreInitial,
    vague.poidsMoyenInitial,
    vague.dateDebut,
    vague.dateFin,
    releves,
    totalBacs || 1
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
        select: { id: true, nom: true, volume: true, nombreInitial: true },
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

  // Generate alerts (pass nombreInitialBac per-bac for local mortality rate computation)
  const alertes: AlerteBac[] = bacs.flatMap((b) => {
    const bacData = vague.bacs.find((vb) => vb.id === b.bacId);
    const initBac = bacData?.nombreInitial ?? Math.round(vague.nombreInitial / totalBacs);
    return genererAlertes(b, initBac);
  });

  return {
    vagueId,
    vagueCode: vague.code,
    bacs,
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
    select: { id: true, nom: true, volume: true, nombreInitial: true },
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
      biomasse: ind.biomasse,
      poidsMoyen: ind.poidsMoyen,
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
    uniteAchat?: string | null;
    contenance?: number | null;
    tailleGranule?: string | null;
    formeAliment?: string | null;
    tauxProteines?: number | null;
    phasesCibles?: string[];
    fournisseur: { nom: string } | null;
  },
  saisonFilter?: "SECHE" | "PLUIES" | null
): Promise<{
  analytique: AnalytiqueAliment;
  parVague: DetailAlimentVague[];
  evolutionFCR: { date: string; fcr: number }[];
}> {
  // Fix A13: propagate produit fields consistently — cast via unknown for enum compatibility
  const tailleGranule = (produit.tailleGranule ?? null) as AnalytiqueAliment["tailleGranule"];
  const formeAliment = (produit.formeAliment ?? null) as AnalytiqueAliment["formeAliment"];
  const tauxProteines = produit.tauxProteines ?? null;
  const phasesCibles = (produit.phasesCibles ?? []) as AnalytiqueAliment["phasesCibles"];
  const prixBase = getPrixParUniteBase(produit);

  // Load ConfigElevage for Gompertz params (minPoints, wInfinity)
  const configElevage = await prisma.configElevage.findFirst({
    where: { siteId, isActive: true },
    select: { gompertzMinPoints: true, gompertzWInfDefault: true },
  });

  // Delegate FCR/feed calculation to ADR-036 algorithm
  const fcrResult = await getFCRByFeed(siteId, produit.id, {
    minPoints: configElevage?.gompertzMinPoints ?? 5,
    wInfinity: configElevage?.gompertzWInfDefault ?? null,
    saisonFilter: saisonFilter ?? undefined,
  });

  // Empty result: product not found or no feed data at all
  if (!fcrResult || fcrResult.parVague.length === 0) {
    return {
      analytique: {
        produitId: produit.id,
        produitNom: produit.nom,
        fournisseurNom: produit.fournisseur?.nom ?? null,
        categorie: CategorieProduit.ALIMENT,
        prixUnitaire: prixBase,
        quantiteTotale: 0,
        coutTotal: 0,
        nombreVagues: 0,
        fcrMoyen: null,
        sgrMoyen: null,
        coutParKgGain: null,
        tauxSurvieAssocie: null,
        tailleGranule,
        formeAliment,
        tauxProteines,
        adgMoyen: null,
        perMoyen: null,
        scoreQualite: null,
        phasesCibles,
      },
      parVague: [],
      evolutionFCR: [],
    };
  }

  // Collect vague IDs that have consumption data
  const vagueIds = (fcrResult?.parVague ?? []).map((v) => v.vagueId);

  // Fetch vague metadata for SGR/ADG/tauxSurvie calculations (lightweight query)
  const vagues = vagueIds.length > 0
    ? await prisma.vague.findMany({
        where: { id: { in: vagueIds }, siteId },
        select: {
          id: true,
          code: true,
          nombreInitial: true,
          poidsMoyenInitial: true,
          dateDebut: true,
          dateFin: true,
          bacs: { select: { id: true, nombreInitial: true } },
        },
      })
    : [];

  // Fetch biometrie and mortalite releves for these vagues
  const vagueReleves = vagueIds.length > 0
    ? await prisma.releve.findMany({
        where: {
          vagueId: { in: vagueIds },
          siteId,
          typeReleve: { in: [TypeReleve.BIOMETRIE, TypeReleve.MORTALITE, TypeReleve.COMPTAGE] },
        },
        orderBy: { date: "asc" },
        select: {
          vagueId: true,
          bacId: true,
          typeReleve: true,
          date: true,
          poidsMoyen: true,
          nombreMorts: true,
          nombreCompte: true,
        },
      })
    : [];

  // Group releves by vague
  const relevesByVague = new Map<string, typeof vagueReleves>();
  for (const r of vagueReleves) {
    const existing = relevesByVague.get(r.vagueId) ?? [];
    existing.push(r);
    relevesByVague.set(r.vagueId, existing);
  }

  // Build per-vague metrics by combining FCRByFeed result with biometric data
  const vagueMetrics: {
    quantite: number;
    gainBiomasse: number | null;
    fcr: number | null;
    sgr: number | null;
    coutParKgGain: number | null;
    tauxSurvie: number | null;
    adg: number | null;
    per: number | null;
    detail: DetailAlimentVague;
  }[] = [];

  const evolutionFCR: { date: string; fcr: number }[] = [];

  const vagueMap = new Map(vagues.map((v) => [v.id, v]));

  for (const fcrVague of fcrResult?.parVague ?? []) {
    const vague = vagueMap.get(fcrVague.vagueId);
    if (!vague) continue;

    const releves = relevesByVague.get(vague.id) ?? [];
    const biometries = releves
      .filter((r) => r.typeReleve === TypeReleve.BIOMETRIE)
      .sort((a, b) => a.date.getTime() - b.date.getTime());

    const derniereBio = biometries.at(-1);
    const poidsMoyen = derniereBio?.poidsMoyen ?? null;

    const nombreVivants = computeNombreVivantsVague(vague.bacs, releves, vague.nombreInitial);

    const now = vague.dateFin ?? new Date();
    const jours = Math.max(
      1,
      Math.floor((now.getTime() - vague.dateDebut.getTime()) / (1000 * 60 * 60 * 24))
    );

    // FCR and gain biomasse from ADR-036 algorithm
    const fcr = fcrVague.fcrVague !== null ? Math.round(fcrVague.fcrVague * 100) / 100 : null;
    const gainBiomasse = fcrVague.totalGainBiomasseKg > 0 ? fcrVague.totalGainBiomasseKg : null;
    const quantite = fcrVague.totalAlimentKg;

    const sgr = calculerSGR(vague.poidsMoyenInitial, poidsMoyen, jours);
    const tauxSurvie = calculerTauxSurvie(nombreVivants, vague.nombreInitial);
    const coutKg = calculerCoutParKgGain(quantite, prixBase, gainBiomasse);

    const adg = calculerADG(vague.poidsMoyenInitial, poidsMoyen, jours);

    // PER : gain biomasse (kg→g) / proteines consommees
    const gainPoidsG = gainBiomasse !== null ? gainBiomasse * 1000 : null;
    const per = calculerPER(gainPoidsG, quantite, tauxProteines);

    const totalMorts = releves
      .filter((r) => r.typeReleve === TypeReleve.MORTALITE)
      .reduce((sum, r) => sum + (r.nombreMorts ?? 0), 0);
    const tauxMortaliteAssocie =
      vague.nombreInitial > 0
        ? calculerTauxMortalite(totalMorts, vague.nombreInitial)
        : null;

    // avecChangementAliment: true if more than one bac was used (proxy for feed switches)
    // FCRBacPeriode does not expose joursMixtes; use distinct bac count as heuristic
    const distinctBacs = new Set(fcrVague.periodesBac.map((p) => p.bacId)).size;
    const avecChangementAliment = distinctBacs > 1;
    const nombrePeriodes = fcrVague.periodesBac.length;

    vagueMetrics.push({
      quantite,
      gainBiomasse,
      fcr,
      sgr,
      coutParKgGain: coutKg,
      tauxSurvie,
      adg,
      per,
      detail: {
        vagueId: vague.id,
        vagueCode: vague.code,
        quantite,
        fcr,
        sgr: sgr !== null ? Math.round(sgr * 100) / 100 : null,
        coutParKgGain: coutKg !== null ? Math.round(coutKg) : null,
        periode: { debut: vague.dateDebut, fin: vague.dateFin },
        adg: adg !== null ? Math.round(adg * 100) / 100 : null,
        per: per !== null ? Math.round(per * 100) / 100 : null,
        tauxMortaliteAssocie:
          tauxMortaliteAssocie !== null ? Math.round(tauxMortaliteAssocie * 100) / 100 : null,
        nombrePeriodes,
        avecChangementAliment,
        periodesBac: fcrVague.periodesBac,
        flagLowConfidence: fcrVague.flagLowConfidence,
      },
    });

    // FCR evolution point
    if (fcr !== null) {
      const midDate = fcrVague.dateFin ?? fcrVague.dateDebut;
      evolutionFCR.push({
        date: midDate.toISOString(),
        fcr,
      });
    }
  }

  // Aggregate global metrics
  // quantiteTotale = sum of ALL vague totals (including low-confidence)
  const quantiteTotale = vagueMetrics.reduce((s, v) => s + v.quantite, 0);
  const coutTotal = Math.round(quantiteTotale * prixBase);

  // FCR global from ADR-036 result (weighted ratio from high-confidence vagues only)
  const fcrMoyen = fcrResult?.fcrGlobal !== null && fcrResult?.fcrGlobal !== undefined
    ? Math.round(fcrResult.fcrGlobal * 100) / 100
    : null;

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

  // Overall cost per kg gain (using all vagues with positive gain)
  const totalGain = vagueMetrics.reduce(
    (s, v) => s + (v.gainBiomasse != null && v.gainBiomasse > 0 ? v.gainBiomasse : 0),
    0
  );
  const coutParKgGain = totalGain > 0 ? coutTotal / totalGain : null;

  // Weighted ADG mean
  const adgEntries = vagueMetrics.filter((v) => v.adg !== null);
  const adgMoyen =
    adgEntries.length > 0
      ? adgEntries.reduce((s, v) => s + v.adg! * v.quantite, 0) /
        adgEntries.reduce((s, v) => s + v.quantite, 0)
      : null;

  // Weighted PER mean
  const perEntries = vagueMetrics.filter((v) => v.per !== null);
  const perMoyen =
    perEntries.length > 0
      ? perEntries.reduce((s, v) => s + v.per! * v.quantite, 0) /
        perEntries.reduce((s, v) => s + v.quantite, 0)
      : null;

  // Score qualite aliment /10
  const scoreQualite = calculerScoreAliment(fcrMoyen, sgrMoyen, coutParKgGain, tauxSurvieAssocie);

  // nombreVagues = all vagues seen (incluses + ignorees)
  const nombreVagues = (fcrResult?.nombreVaguesIncluses ?? 0) + (fcrResult?.nombreVaguesIgnorees ?? 0);

  return {
    analytique: {
      produitId: produit.id,
      produitNom: produit.nom,
      fournisseurNom: produit.fournisseur?.nom ?? null,
      categorie: CategorieProduit.ALIMENT,
      prixUnitaire: prixBase,
      quantiteTotale: Math.round(quantiteTotale * 100) / 100,
      coutTotal,
      nombreVagues,
      fcrMoyen,
      sgrMoyen: sgrMoyen !== null ? Math.round(sgrMoyen * 100) / 100 : null,
      coutParKgGain: coutParKgGain !== null ? Math.round(coutParKgGain) : null,
      tauxSurvieAssocie:
        tauxSurvieAssocie !== null ? Math.round(tauxSurvieAssocie * 100) / 100 : null,
      tailleGranule,
      formeAliment,
      tauxProteines,
      adgMoyen: adgMoyen !== null ? Math.round(adgMoyen * 100) / 100 : null,
      perMoyen: perMoyen !== null ? Math.round(perMoyen * 100) / 100 : null,
      scoreQualite: scoreQualite !== null ? Math.round(scoreQualite * 10) / 10 : null,
      phasesCibles,
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
 * @param filtres - Filtres optionnels (phase, tailleGranule, formeAliment, fournisseurId, vagueId)
 */
export async function getComparaisonAliments(
  siteId: string,
  filtres?: FiltresAnalyticsAliments & { vagueId?: string; fournisseurId?: string }
): Promise<ComparaisonAliments> {
  // Fetch all active ALIMENT products on the site
  const whereClause: Record<string, unknown> = {
    siteId,
    categorie: CategorieProduit.ALIMENT,
    isActive: true,
  };
  // Fix E5: use !== undefined && !== null to avoid false negatives with falsy values (0, "")
  if (filtres?.fournisseurId !== undefined && filtres.fournisseurId !== null) {
    whereClause.fournisseurId = filtres.fournisseurId;
  }
  if (filtres?.tailleGranule !== undefined && filtres.tailleGranule !== null) {
    whereClause.tailleGranule = filtres.tailleGranule;
  }
  if (filtres?.formeAliment !== undefined && filtres.formeAliment !== null) {
    whereClause.formeAliment = filtres.formeAliment;
  }
  if (filtres?.phase !== undefined && filtres.phase !== null) {
    whereClause.phasesCibles = { has: filtres.phase };
  }

  const produits = await prisma.produit.findMany({
    where: whereClause,
    select: {
      id: true,
      nom: true,
      prixUnitaire: true,
      uniteAchat: true,
      contenance: true,
      tailleGranule: true,
      formeAliment: true,
      tauxProteines: true,
      phasesCibles: true,
      fournisseur: { select: { nom: true } },
    },
    orderBy: { nom: "asc" },
  });

  // FD.3 : convertir le filtre saison en type discrimine
  const saisonFilter =
    filtres?.saison === "SECHE" || filtres?.saison === "PLUIES"
      ? (filtres.saison as "SECHE" | "PLUIES")
      : null;

  const aliments: AnalytiqueAliment[] = [];

  for (const produit of produits) {
    const { analytique } = await computeAlimentMetrics(siteId, produit, saisonFilter);
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
 * @param filtres - Filtres optionnels (non appliques au produit unique, conserves pour coherence API)
 */
export async function getDetailAliment(
  siteId: string,
  produitId: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _filtres?: FiltresAnalyticsAliments
): Promise<DetailAliment | null> {
  const produit = await prisma.produit.findFirst({
    where: { id: produitId, siteId, categorie: CategorieProduit.ALIMENT },
    select: {
      id: true,
      nom: true,
      prixUnitaire: true,
      uniteAchat: true,
      contenance: true,
      tailleGranule: true,
      formeAliment: true,
      tauxProteines: true,
      phasesCibles: true,
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
  const alimentSelect = {
    id: true,
    nom: true,
    prixUnitaire: true,
    uniteAchat: true,
    contenance: true,
    tailleGranule: true,
    formeAliment: true,
    tauxProteines: true,
    phasesCibles: true,
    fournisseur: { select: { nom: true } },
  } as const;

  const [ancien, nouveau] = await Promise.all([
    prisma.produit.findFirst({
      where: { id: ancienProduitId, siteId, categorie: CategorieProduit.ALIMENT },
      select: alimentSelect,
    }),
    prisma.produit.findFirst({
      where: { id: nouveauProduitId, siteId, categorie: CategorieProduit.ALIMENT },
      select: alimentSelect,
    }),
  ]);

  if (!ancien || !nouveau) return null;

  const [metricsAncien, metricsNouveau] = await Promise.all([
    computeAlimentMetrics(siteId, ancien),
    computeAlimentMetrics(siteId, nouveau),
  ]);

  const ancienFCR = metricsAncien.analytique.fcrMoyen;
  const nouveauFCR = metricsNouveau.analytique.fcrMoyen;

  // Cout = FCR × prixParUniteBase × productionCible
  const ancienCout =
    ancienFCR !== null ? Math.round(ancienFCR * getPrixParUniteBase(ancien) * productionCible) : null;
  const nouveauCout =
    nouveauFCR !== null ? Math.round(nouveauFCR * getPrixParUniteBase(nouveau) * productionCible) : null;

  const economie =
    ancienCout !== null && nouveauCout !== null ? ancienCout - nouveauCout : null;

  let message: string;
  if (economie === null) {
    message = "Donnees insuffisantes pour calculer l'economie. Utilisez les deux aliments sur au moins une vague.";
  } else if (economie > 0) {
    message = `En passant de '${ancien.nom}' a '${nouveau.nom}' pour ${productionCible} kg de production, vous economiseriez ${formatNumber(economie)} CFA.`;
  } else if (economie < 0) {
    message = `Le passage de '${ancien.nom}' a '${nouveau.nom}' couterait ${formatNumber(Math.abs(economie))} CFA de plus pour ${productionCible} kg de production.`;
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
// Queries publiques CR-012
// ---------------------------------------------------------------------------

/**
 * Dashboard analytique global pour un site.
 *
 * Retourne le meilleur bac (densite la plus basse parmi vagues EN_COURS),
 * le meilleur aliment (cout/kg gain le plus bas), les alertes de performance,
 * la tendance FCR mensuelle sur 3 mois et des statistiques generales.
 *
 * @param siteId - ID du site (multi-tenancy)
 */
export async function getAnalyticsDashboard(siteId: string): Promise<AnalyticsDashboard> {
  // ---- 1. Stats generales (COUNT en parallele) ----
  const [vaguesEnCours, bacsActifs, totalReproducteurs, totalLotsEnElevage] = await Promise.all([
    prisma.vague.count({ where: { siteId, statut: StatutVague.EN_COURS } }),
    // ADR-043 Phase 2: compter les assignations actives
    prisma.assignationBac.count({ where: { siteId, dateFin: null } }),
    prisma.reproducteur.count({ where: { siteId, statut: StatutReproducteur.ACTIF } }),
    prisma.lotAlevins.count({ where: { siteId, statut: StatutLotAlevins.EN_ELEVAGE } }),
  ]);

  // ---- 2. Meilleur bac (densite la plus basse parmi vagues EN_COURS) ----
  const vaguesActives = await prisma.vague.findMany({
    where: { siteId, statut: StatutVague.EN_COURS },
    select: {
      id: true,
      nombreInitial: true,
      poidsMoyenInitial: true,
      dateDebut: true,
      dateFin: true,
      bacs: { select: { id: true, nom: true, volume: true, nombreInitial: true } },
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
        date: true,
        poidsMoyen: true,
        tailleMoyenne: true,
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

    let meilleurDensite = Infinity;

    for (const vague of vaguesActives) {
      const totalBacs = vague._count.bacs || 1;

      for (const bac of vague.bacs) {
        const key: ReleveKey = `${vague.id}:${bac.id}`;
        const bacReleves = relevesByVagueBac.get(key) ?? [];

        const ind = computeIndicateursBac(
          bac,
          vague.id,
          vague.nombreInitial,
          vague.poidsMoyenInitial,
          vague.dateDebut,
          vague.dateFin,
          bacReleves,
          totalBacs
        );

        // Count monitoring alerts (DENSITE_ELEVEE + MORTALITE_HAUTE only)
        const initBac = bac.nombreInitial ?? Math.round(vague.nombreInitial / totalBacs);
        const bacAlertes = genererAlertes(ind, initBac);
        alertesPerformance += bacAlertes.length;

        // Best bac = lowest density (operationally meaningful)
        if (ind.densite !== null && ind.densite < meilleurDensite) {
          meilleurDensite = ind.densite;
          meilleurBac = { id: bac.id, nom: bac.nom, densite: ind.densite };
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
      uniteAchat: true,
      contenance: true,
      tailleGranule: true,
      formeAliment: true,
      tauxProteines: true,
      phasesCibles: true,
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
        bacs: { select: { id: true, nombreInitial: true } },
      },
      orderBy: { dateDebut: "asc" },
    }),
    prisma.releve.findMany({
      where: { vagueId: { in: ids }, siteId },
      orderBy: { date: "asc" },
      select: {
        vagueId: true,
        bacId: true,
        typeReleve: true,
        date: true,
        poidsMoyen: true,
        nombreMorts: true,
        quantiteAliment: true,
        nombreCompte: true,
        consommations: {
          select: {
            quantite: true,
            produit: { select: { prixUnitaire: true, uniteAchat: true, contenance: true } },
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

    const nombreVivants = computeNombreVivantsVague(vague.bacs, releves, vague.nombreInitial);

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
    // Cout total aliment : SUM(quantite * prixParUniteBase) depuis ReleveConsommation
    let coutTotalAliment = 0;
    for (const r of releves) {
      for (const c of r.consommations) {
        coutTotalAliment += c.quantite * getPrixParUniteBase(c.produit);
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

// ===========================================================================
// Alertes ration (F18/F24)
// ===========================================================================

/**
 * Detecte les sous/sur-alimentations pour les vagues actives d'un site.
 *
 * Algorithme :
 *   1. Recupere toutes les vagues EN_COURS du site avec leur ConfigElevage
 *   2. Guard E9 : skip les vagues sans ConfigElevage (pas de ration theorique)
 *   3. Pour chaque vague, recupere les releves ALIMENTATION recents (30j) tries par date DESC
 *   4. Pour chaque releve, calcule la ration theorique :
 *        - Utilise le poids moyen de la derniere biometrie pour detecter la phase
 *        - Ration theorique = getTauxAlimentation(poidsMoyen, config) * biomasse / 100
 *        - Fallback : si pas de biometrie, utilise BENCHMARK_DFR_PAR_PHASE[phase].optimal
 *   5. Detecte 3 releves consecutifs avec |ecart| > 20% dans la meme direction :
 *        - Les 3 positifs → SUR_ALIMENTATION
 *        - Les 3 negatifs → SOUS_ALIMENTATION
 *   6. Retourne un tableau d'AlerteRation avec ecartMoyenPct et relevesConsecutifs
 *
 * Guard E9 : les vagues sans ConfigElevage actif sont ignorees (skip silencieux).
 *
 * @param siteId - ID du site (multi-tenancy)
 * @returns Liste des alertes ration actives
 */
export async function getAlertesRation(siteId: string): Promise<AlerteRation[]> {
  // 1. Recuperer les vagues actives avec leur ConfigElevage et bacs
  const vagues = await prisma.vague.findMany({
    where: { siteId, statut: StatutVague.EN_COURS },
    select: {
      id: true,
      code: true,
      nombreInitial: true,
      poidsMoyenInitial: true,
      configElevage: true,
      bacs: { select: { id: true, nombreInitial: true } },
    },
  });

  const alertes: AlerteRation[] = [];

  for (const vague of vagues) {
    // Guard E9 : skip si pas de ConfigElevage
    if (!vague.configElevage) continue;

    // Cast necessaire : champs JSON Prisma (alimentTailleConfig, alimentTauxConfig)
    // sont types JsonValue, mais getTauxAlimentation/detecterPhase attendent ConfigElevage | null.
    const config = vague.configElevage as unknown as ConfigElevage;

    // 2. Fenetre : releves ALIMENTATION des 30 derniers jours, tries par date ASC
    const dateLimit = new Date();
    dateLimit.setDate(dateLimit.getDate() - 30);

    const [alimentationReleves, biometrieReleves, mortaliteReleves, comptageReleves] =
      await Promise.all([
        prisma.releve.findMany({
          where: {
            vagueId: vague.id,
            siteId,
            typeReleve: TypeReleve.ALIMENTATION,
            date: { gte: dateLimit },
          },
          orderBy: { date: "asc" },
          select: {
            id: true,
            date: true,
            quantiteAliment: true,
          },
        }),
        // Biometrie sans fenetre temporelle pour avoir le dernier poids
        prisma.releve.findMany({
          where: { vagueId: vague.id, siteId, typeReleve: TypeReleve.BIOMETRIE },
          orderBy: { date: "asc" },
          select: { date: true, poidsMoyen: true, bacId: true },
        }),
        prisma.releve.findMany({
          where: { vagueId: vague.id, siteId, typeReleve: TypeReleve.MORTALITE },
          select: { bacId: true, nombreMorts: true, typeReleve: true, nombreCompte: true },
        }),
        prisma.releve.findMany({
          where: { vagueId: vague.id, siteId, typeReleve: TypeReleve.COMPTAGE },
          orderBy: { date: "asc" },
          select: { bacId: true, nombreMorts: true, typeReleve: true, nombreCompte: true },
        }),
      ]);

    // Besoin d'au moins 3 releves pour detecter 3 consecutifs
    if (alimentationReleves.length < 3) continue;

    // 3. Calculer le nombre de vivants pour estimer la biomasse
    const relevesPourVivants = [
      ...mortaliteReleves,
      ...comptageReleves,
    ];
    const nombreVivants = computeNombreVivantsVague(
      vague.bacs,
      relevesPourVivants,
      vague.nombreInitial
    );

    // 4. Obtenir le poids moyen depuis la derniere biometrie
    const derniereBiometrie = biometrieReleves
      .filter((r) => r.poidsMoyen != null)
      .at(-1);
    const poidsMoyen = derniereBiometrie?.poidsMoyen ?? null;

    // 5. Calculer la ration theorique pour chaque releve d'alimentation
    const ecartsParReleve: number[] = [];

    for (const releve of alimentationReleves) {
      const quantiteDistribuee = releve.quantiteAliment;
      if (quantiteDistribuee == null) continue;

      let rationTheoriqueKg: number | null = null;

      if (poidsMoyen != null && nombreVivants > 0) {
        // Ration theorique via ConfigElevage : taux% * biomasse(kg) / 100
        const biomasseKg = calculerBiomasse(poidsMoyen, nombreVivants);
        if (biomasseKg != null && biomasseKg > 0) {
          const tauxPct = getTauxAlimentation(poidsMoyen, config);
          rationTheoriqueKg = (tauxPct * biomasseKg) / 100;
        }
      }

      // Fallback : utiliser BENCHMARK_DFR_PAR_PHASE avec poids initial si pas de biometrie
      if (rationTheoriqueKg == null) {
        const poidsRef = poidsMoyen ?? vague.poidsMoyenInitial;
        const phase = detecterPhase(poidsRef, config);
        const benchmarkDfr = BENCHMARK_DFR_PAR_PHASE[phase];
        if (benchmarkDfr && nombreVivants > 0) {
          const biomasseRef = calculerBiomasse(poidsRef, nombreVivants);
          if (biomasseRef != null && biomasseRef > 0) {
            rationTheoriqueKg = (benchmarkDfr.optimal * biomasseRef) / 100;
          }
        }
      }

      if (rationTheoriqueKg == null) continue;

      const ecart = calculerEcartRation(quantiteDistribuee, rationTheoriqueKg);
      if (ecart != null) {
        ecartsParReleve.push(ecart);
      }
    }

    // 6. Detecter les sequences de 3 releves consecutifs avec |ecart| > 20%
    // Parcourir le tableau et chercher la sequence la plus longue en cours
    const SEUIL_ECART_PCT = 20;
    let seqPositive = 0;
    let seqNegative = 0;
    let sommePositive = 0;
    let sommeNegative = 0;

    for (const ecart of ecartsParReleve) {
      if (ecart > SEUIL_ECART_PCT) {
        seqPositive++;
        sommePositive += ecart;
        seqNegative = 0;
        sommeNegative = 0;
      } else if (ecart < -SEUIL_ECART_PCT) {
        seqNegative++;
        sommeNegative += ecart;
        seqPositive = 0;
        sommePositive = 0;
      } else {
        // Ecart dans la zone acceptable → reset les deux sequences
        seqPositive = 0;
        sommePositive = 0;
        seqNegative = 0;
        sommeNegative = 0;
      }
    }

    // Creer une alerte si la sequence en cours atteint au moins 3 releves consecutifs
    if (seqPositive >= 3) {
      alertes.push({
        vagueId: vague.id,
        vagueNom: vague.code,
        type: "SUR_ALIMENTATION",
        ecartMoyenPct: Math.round((sommePositive / seqPositive) * 100) / 100,
        relevesConsecutifs: seqPositive,
      });
    } else if (seqNegative >= 3) {
      alertes.push({
        vagueId: vague.id,
        vagueNom: vague.code,
        type: "SOUS_ALIMENTATION",
        ecartMoyenPct: Math.round((sommeNegative / seqNegative) * 100) / 100,
        relevesConsecutifs: seqNegative,
      });
    }
  }

  return alertes;
}

// ===========================================================================
// Feed Analytics v2 — FCR hebdomadaire + changements de granule (FB.6)
// ===========================================================================

// ---------------------------------------------------------------------------
// Helpers internes FB.6
// ---------------------------------------------------------------------------

/**
 * Retourne la cle de semaine ISO au format "YYYY-WNN" pour une date donnee.
 */
function getISOWeekKey(date: Date): string {
  const d = new Date(date.getTime());
  const dayOfWeek = d.getUTCDay() === 0 ? 7 : d.getUTCDay(); // 1=Lun, 7=Dim
  d.setUTCDate(d.getUTCDate() + 4 - dayOfWeek); // Jeudi de la semaine courante
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  const isoYear = d.getUTCFullYear();
  return `${isoYear}-W${String(week).padStart(2, "0")}`;
}

/**
 * Retourne les dates de debut (lundi 00:00 UTC) et fin (dimanche 23:59 UTC)
 * d'une semaine ISO au format "YYYY-WNN".
 */
function getISOWeekBounds(semaine: string): { debut: Date; fin: Date } {
  const [yearStr, weekStr] = semaine.split("-W");
  const year = parseInt(yearStr, 10);
  const week = parseInt(weekStr, 10);
  // Le 4 janvier est toujours en semaine 1 (ISO 8601)
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const dayOfWeekJan4 = jan4.getUTCDay() === 0 ? 7 : jan4.getUTCDay();
  const lundi = new Date(
    jan4.getTime() - (dayOfWeekJan4 - 1) * 86400000 + (week - 1) * 7 * 86400000
  );
  const dimanche = new Date(lundi.getTime() + 6 * 86400000);
  dimanche.setUTCHours(23, 59, 59, 999);
  return { debut: lundi, fin: dimanche };
}

/**
 * Interpole le poids moyen a une date cible a partir de biometries encadrantes.
 * Algorithme A5/A6 du PLAN-feed-analytics-v2.md.
 *
 * @param biometries - Liste triee ASC par date, avec poidsMoyen non null
 * @param targetDate - Date pour laquelle interpoler le poids
 * @param sgrEstime  - SGR en %/jour pour extrapolation (defaut 2.0)
 */
function interpolerPoidsMoyen(
  biometries: { date: Date; poidsMoyen: number }[],
  targetDate: Date,
  sgrEstime = 2.0
): number | null {
  if (biometries.length === 0) return null;

  const targetMs = targetDate.getTime();

  // Derniere biometrie <= date cible
  let bAvant: { date: Date; poidsMoyen: number } | null = null;
  for (const b of biometries) {
    if (b.date.getTime() <= targetMs) bAvant = b;
    else break;
  }

  // Premiere biometrie >= date cible
  let bApres: { date: Date; poidsMoyen: number } | null = null;
  for (const b of biometries) {
    if (b.date.getTime() >= targetMs) {
      bApres = b;
      break;
    }
  }

  if (bAvant === null && bApres === null) return null;

  if (bApres === null && bAvant !== null) {
    // Extrapolation exponentielle avec SGR constant
    const joursDepuisAvant = (targetMs - bAvant.date.getTime()) / 86400000;
    return bAvant.poidsMoyen * Math.exp((sgrEstime * joursDepuisAvant) / 100);
  }

  if (bAvant === null && bApres !== null) {
    // Utiliser bApres comme valeur de secours
    return bApres.poidsMoyen;
  }

  // Interpolation lineaire
  const totalMs = bApres!.date.getTime() - bAvant!.date.getTime();
  if (totalMs === 0) return bAvant!.poidsMoyen;
  const fraction = (targetMs - bAvant!.date.getTime()) / totalMs;
  return bAvant!.poidsMoyen + fraction * (bApres!.poidsMoyen - bAvant!.poidsMoyen);
}

// ---------------------------------------------------------------------------
// Queries publiques FB.6
// ---------------------------------------------------------------------------

/**
 * Calcule l'evolution FCR semaine par semaine pour un produit aliment donne.
 *
 * - Filtre par produitId via ReleveConsommation
 * - Guard E7 : releves filtres par vagueId (pas de melange inter-vagues)
 * - Guard E8 : biometries avec poidsMoyen null exclues
 * - Interpolation lineaire du poids moyen entre biometries (algorithme A5/A6)
 * - Benchmark FCR via getBenchmarkFCRPourPhase sur la premiere phase cible du produit
 *
 * NOTE ADR-028 (residual inconsistency, out of scope):
 * This function uses the old whole-vague FCR calculation (biometrieVague sans distinction de bac).
 * If the vague has feed switches between tanks, the weekly FCR shown here may differ from
 * the corrected per-period FCR shown in the feed comparison page (computeAlimentMetrics).
 * A future evolution should apply segmenterPeriodesAlimentaires here as well.
 *
 * @param siteId    - ID du site (multi-tenancy)
 * @param produitId - ID du produit aliment
 * @param vagueId   - Vague a analyser (optionnel - si absent, toutes les vagues)
 */
export async function getFCRHebdomadaire(
  siteId: string,
  produitId: string,
  vagueId?: string
): Promise<FCRHebdomadairePoint[]> {
  // NOTE ADR-028: Ce calcul FCR hebdomadaire utilise encore l'algorithme vague-entière
  // (biomasseFinale - biomasseInitiale divisée par aliment total).
  // Il n'a PAS été migré vers la segmentation per-bac de feed-periods.ts.
  // Conséquence : si une vague contient des changements d'aliment, le FCR affiché dans
  // ce graphique de tendance peut différer du FCR corrigé affiché dans la comparaison aliments.
  // Voir ADR-028 et docs/analysis/pre-analysis-fcr-refactor.md (Risque 6).

  // 1. Verifier que le produit existe et appartient au site
  const produit = await prisma.produit.findFirst({
    where: { id: produitId, siteId, categorie: CategorieProduit.ALIMENT },
    select: { id: true, tailleGranule: true, phasesCibles: true },
  });
  if (!produit) return [];

  // 2. Charger les consommations de ce produit (filtrees par vague si fourni)
  const consommations = await prisma.releveConsommation.findMany({
    where: {
      produitId,
      siteId,
      ...(vagueId ? { releve: { vagueId } } : {}),
    },
    select: {
      quantite: true,
      releve: {
        select: {
          id: true,
          date: true,
          vagueId: true,
        },
      },
    },
    orderBy: { releve: { date: "asc" } },
  });

  if (consommations.length === 0) return [];

  // 3. Guard E7 : isoler les vagueIds (pas de melange inter-vagues)
  const vagueIds = [...new Set(consommations.map((c) => c.releve.vagueId))];

  // 4. Charger les vagues avec leurs bacs
  const vagues = await prisma.vague.findMany({
    where: { id: { in: vagueIds }, siteId },
    select: {
      id: true,
      nombreInitial: true,
      poidsMoyenInitial: true,
      dateDebut: true,
      dateFin: true,
      bacs: { select: { id: true, nombreInitial: true } },
    },
  });
  const vagueMap = new Map(vagues.map((v) => [v.id, v]));

  // 5. Biometries - Guard E8 : exclure poidsMoyen null
  const biometriesRaw = await prisma.releve.findMany({
    where: {
      vagueId: { in: vagueIds },
      siteId,
      typeReleve: TypeReleve.BIOMETRIE,
      poidsMoyen: { not: null },
    },
    orderBy: { date: "asc" },
    select: { vagueId: true, date: true, poidsMoyen: true },
  });
  const biosByVague = new Map<string, { date: Date; poidsMoyen: number }[]>();
  for (const b of biometriesRaw) {
    if (b.poidsMoyen === null) continue;
    const existing = biosByVague.get(b.vagueId) ?? [];
    existing.push({ date: b.date, poidsMoyen: b.poidsMoyen });
    biosByVague.set(b.vagueId, existing);
  }

  // 6. Releves MORTALITE + COMPTAGE pour computeNombreVivantsVague
  const relevesVivants = await prisma.releve.findMany({
    where: {
      vagueId: { in: vagueIds },
      siteId,
      typeReleve: { in: [TypeReleve.MORTALITE, TypeReleve.COMPTAGE] },
    },
    orderBy: { date: "asc" },
    select: {
      vagueId: true,
      bacId: true,
      typeReleve: true,
      nombreMorts: true,
      nombreCompte: true,
    },
  });
  const vivantsByVague = new Map<string, typeof relevesVivants>();
  for (const r of relevesVivants) {
    const existing = vivantsByVague.get(r.vagueId) ?? [];
    existing.push(r);
    vivantsByVague.set(r.vagueId, existing);
  }

  // 7. Grouper les consommations par (vagueId, semaine ISO)
  type SemaineKey = string; // "vagueId::YYYY-WNN"
  const alimBySemaineVague = new Map<
    SemaineKey,
    { quantiteAliment: number; vagueId: string; semaine: string }
  >();
  for (const c of consommations) {
    const semaine = getISOWeekKey(c.releve.date);
    const key: SemaineKey = `${c.releve.vagueId}::${semaine}`;
    const existing = alimBySemaineVague.get(key) ?? {
      quantiteAliment: 0,
      vagueId: c.releve.vagueId,
      semaine,
    };
    existing.quantiteAliment += c.quantite;
    alimBySemaineVague.set(key, existing);
  }

  // 8. Calculer FCR par semaine - aggregation sur toutes les vagues
  type SemaineCumul = {
    quantiteAliment: number;
    gainBiomasseKg: number | null;
    poidsMoyenG: number | null;
    countPoids: number;
    benchmarkFCR: number | null;
  };
  const semaineMap = new Map<string, SemaineCumul>();

  for (const [, entry] of alimBySemaineVague) {
    const { semaine, vagueId: vid, quantiteAliment } = entry;
    const vague = vagueMap.get(vid);
    if (!vague) continue;

    const biometries = biosByVague.get(vid) ?? [];
    const { debut, fin } = getISOWeekBounds(semaine);

    // Nombre de vivants pour le gain de biomasse
    const vivantsReleves = vivantsByVague.get(vid) ?? [];
    const nombreVivants = computeNombreVivantsVague(
      vague.bacs,
      vivantsReleves,
      vague.nombreInitial
    );

    // SGR estime pour extrapolation post-dernier-releve biometrique
    const dernierBio = biometries.at(-1);
    const joursEcoules =
      dernierBio
        ? Math.round((dernierBio.date.getTime() - vague.dateDebut.getTime()) / 86400000)
        : 0;
    const sgrEstime =
      dernierBio && dernierBio.poidsMoyen > vague.poidsMoyenInitial && joursEcoules > 0
        ? (calculerSGR(vague.poidsMoyenInitial, dernierBio.poidsMoyen, joursEcoules) ?? 2.0)
        : 2.0;

    // Interpolation poids debut et fin de semaine
    const poidsDebut = interpolerPoidsMoyen(biometries, debut, sgrEstime);
    const poidsFin = interpolerPoidsMoyen(biometries, fin, sgrEstime);

    let gainBiomasseKg: number | null = null;
    if (poidsDebut !== null && poidsFin !== null && nombreVivants > 0) {
      gainBiomasseKg = ((poidsFin - poidsDebut) * nombreVivants) / 1000;
    }

    // Poids moyen au milieu de la semaine (pour affichage)
    const milieu = new Date((debut.getTime() + fin.getTime()) / 2);
    const poidsMoyenG = interpolerPoidsMoyen(biometries, milieu, sgrEstime);

    // Benchmark FCR de la premiere phase cible du produit
    const phaseCourante = (produit.phasesCibles?.[0] as string | undefined) ?? null;
    const benchmarkRange = getBenchmarkFCRPourPhase(phaseCourante);
    const benchmarkFCR =
      isFinite(benchmarkRange.acceptable.max) ? benchmarkRange.acceptable.max : null;

    // Aggregation par semaine
    const existing = semaineMap.get(semaine);
    if (existing) {
      existing.quantiteAliment += quantiteAliment;
      if (gainBiomasseKg !== null) {
        existing.gainBiomasseKg =
          existing.gainBiomasseKg !== null
            ? existing.gainBiomasseKg + gainBiomasseKg
            : gainBiomasseKg;
      }
      if (poidsMoyenG !== null) {
        const newCount = existing.countPoids + 1;
        existing.poidsMoyenG =
          existing.poidsMoyenG !== null
            ? (existing.poidsMoyenG * existing.countPoids + poidsMoyenG) / newCount
            : poidsMoyenG;
        existing.countPoids = newCount;
      }
    } else {
      semaineMap.set(semaine, {
        quantiteAliment,
        gainBiomasseKg,
        poidsMoyenG: poidsMoyenG ?? null,
        countPoids: poidsMoyenG !== null ? 1 : 0,
        benchmarkFCR,
      });
    }
  }

  // 9. Construire et retourner les points FCR hebdomadaires tries par semaine
  const points: FCRHebdomadairePoint[] = [];
  for (const [semaine, cumul] of semaineMap.entries()) {
    const fcr = calculerFCR(
      cumul.quantiteAliment,
      cumul.gainBiomasseKg !== null && cumul.gainBiomasseKg > 0
        ? cumul.gainBiomasseKg
        : null
    );
    points.push({
      semaine,
      fcr: fcr !== null ? Math.round(fcr * 100) / 100 : null,
      quantiteAlimentKg: Math.round(cumul.quantiteAliment * 100) / 100,
      poidsMoyenG:
        cumul.poidsMoyenG !== null ? Math.round(cumul.poidsMoyenG * 10) / 10 : null,
      benchmarkFCR: cumul.benchmarkFCR,
    });
  }

  return points.sort((a, b) => a.semaine.localeCompare(b.semaine));
}

/**
 * Detecte les changements de taille de granule au cours d'une vague pour un produit.
 *
 * Parcourt les releves ALIMENTATION tries par date et detecte les transitions
 * entre produits dont la tailleGranule differe.
 *
 * @param siteId    - ID du site (multi-tenancy)
 * @param produitId - ID du produit aliment de reference
 * @param vagueId   - ID de la vague
 */
export async function getChangementsGranule(
  siteId: string,
  produitId: string,
  vagueId: string
): Promise<ChangementGranule[]> {
  // Charger les releves ALIMENTATION avec les consommations et tailleGranule
  const releves = await prisma.releve.findMany({
    where: { vagueId, siteId, typeReleve: TypeReleve.ALIMENTATION },
    orderBy: { date: "asc" },
    select: {
      date: true,
      consommations: {
        select: {
          produit: {
            select: { id: true, tailleGranule: true },
          },
        },
      },
    },
  });

  if (releves.length === 0) return [];

  // Pour chaque releve, identifier le produit principal utilise
  // (preferer le produitId de reference s'il est present dans le releve)
  type ReleveAlimProduit = {
    date: Date;
    produitId: string;
    tailleGranule: string | null;
  };
  const relevesProduits: ReleveAlimProduit[] = [];

  for (const r of releves) {
    if (r.consommations.length === 0) continue;
    const consoRef = r.consommations.find((c) => c.produit.id === produitId);
    const conso = consoRef ?? r.consommations[0];
    relevesProduits.push({
      date: r.date,
      produitId: conso.produit.id,
      tailleGranule: conso.produit.tailleGranule,
    });
  }

  // Detecter les transitions de tailleGranule entre produits consecutifs
  const changements: ChangementGranule[] = [];
  let dernierProduitId: string | null = null;
  let derniereTaille: string | null = null;

  for (const r of relevesProduits) {
    if (
      dernierProduitId !== null &&
      r.produitId !== dernierProduitId &&
      derniereTaille !== null &&
      r.tailleGranule !== null &&
      derniereTaille !== r.tailleGranule
    ) {
      changements.push({
        date: r.date,
        ancienneTaille: derniereTaille as ChangementGranule["ancienneTaille"],
        nouvelleTaille: r.tailleGranule as ChangementGranule["nouvelleTaille"],
      });
    }
    dernierProduitId = r.produitId;
    derniereTaille = r.tailleGranule;
  }

  return changements;
}

// ===========================================================================
// FC.9 — Alertes DLC stock aliment
// ===========================================================================

export interface MouvementExpirable {
  produitNom: string;
  lotFabrication: string | null;
  datePeremption: Date;
  quantite: number;
}

export interface MouvementExpirableSoon extends MouvementExpirable {
  joursRestants: number;
}

/**
 * Retourne les mouvements ENTREE avec date de peremption expirée ou proche (30j).
 *
 * Guard E13 : les deux catégories sont séparées strictement —
 *   - `expires` : datePeremption < now
 *   - `expiringSoon` : datePeremption entre now et now+30j (exclu de expires)
 *
 * @param siteId - ID du site (multi-tenancy)
 */
export async function getMouvementsExpirables(siteId: string): Promise<{
  expires: MouvementExpirable[];
  expiringSoon: MouvementExpirableSoon[];
}> {
  const now = new Date();
  const limitPlus30j = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const [expiresRaw, expiringSoonRaw] = await Promise.all([
    // Lots déjà expirés
    prisma.mouvementStock.findMany({
      where: {
        siteId,
        type: "ENTREE",
        datePeremption: { lt: now },
      },
      select: {
        quantite: true,
        lotFabrication: true,
        datePeremption: true,
        produit: { select: { nom: true } },
      },
      orderBy: { datePeremption: "asc" },
    }),
    // Lots expirant dans les 30 prochains jours
    prisma.mouvementStock.findMany({
      where: {
        siteId,
        type: "ENTREE",
        datePeremption: { gte: now, lte: limitPlus30j },
      },
      select: {
        quantite: true,
        lotFabrication: true,
        datePeremption: true,
        produit: { select: { nom: true } },
      },
      orderBy: { datePeremption: "asc" },
    }),
  ]);

  const expires: MouvementExpirable[] = expiresRaw
    .filter((m) => m.datePeremption !== null)
    .map((m) => ({
      produitNom: m.produit.nom,
      lotFabrication: m.lotFabrication,
      datePeremption: m.datePeremption!,
      quantite: m.quantite,
    }));

  const expiringSoon: MouvementExpirableSoon[] = expiringSoonRaw
    .filter((m) => m.datePeremption !== null)
    .map((m) => {
      const joursRestants = Math.ceil(
        (m.datePeremption!.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );
      return {
        produitNom: m.produit.nom,
        lotFabrication: m.lotFabrication,
        datePeremption: m.datePeremption!,
        quantite: m.quantite,
        joursRestants,
      };
    });

  return { expires, expiringSoon };
}

// ===========================================================================
// FD.2 — Score fournisseur agrege
// ===========================================================================

/**
 * Calcule le score agrege par fournisseur pour les produits ALIMENT d'un site.
 *
 * Pour chaque fournisseur ayant au moins un produit ALIMENT actif, on calcule :
 * - le nombre de produits
 * - le score moyen pondere par quantite (scoreQualite des AnalytiqueAliment)
 * - le FCR moyen pondere par quantite
 *
 * @param siteId - ID du site (multi-tenancy)
 * @returns Liste triee par scoreMoyen DESC (null en fin)
 */
export async function getScoresFournisseurs(siteId: string): Promise<
  Array<{
    fournisseurId: string;
    fournisseurNom: string;
    nombreProduits: number;
    scoreMoyen: number | null;
    fcrMoyen: number | null;
  }>
> {
  // Recuperer tous les produits ALIMENT actifs du site avec leur fournisseur
  const produits = await prisma.produit.findMany({
    where: {
      siteId,
      categorie: CategorieProduit.ALIMENT,
      isActive: true,
      fournisseurId: { not: null },
    },
    select: {
      id: true,
      nom: true,
      prixUnitaire: true,
      uniteAchat: true,
      contenance: true,
      tailleGranule: true,
      formeAliment: true,
      tauxProteines: true,
      phasesCibles: true,
      fournisseurId: true,
      fournisseur: { select: { id: true, nom: true } },
    },
    orderBy: { nom: "asc" },
  });

  // Calculer les metriques de chaque produit
  type ProduitScore = {
    fournisseurId: string;
    fournisseurNom: string;
    scoreQualite: number | null;
    fcrMoyen: number | null;
    quantiteTotale: number;
  };

  const produitScores: ProduitScore[] = [];

  for (const produit of produits) {
    if (!produit.fournisseur) continue;
    const { analytique } = await computeAlimentMetrics(siteId, {
      ...produit,
      fournisseur: produit.fournisseur,
    });
    if (analytique.quantiteTotale <= 0) continue;
    produitScores.push({
      fournisseurId: produit.fournisseur.id,
      fournisseurNom: produit.fournisseur.nom,
      scoreQualite: analytique.scoreQualite,
      fcrMoyen: analytique.fcrMoyen,
      quantiteTotale: analytique.quantiteTotale,
    });
  }

  // Agreger par fournisseur (moyenne ponderee par quantite)
  const byFournisseur = new Map<
    string,
    {
      fournisseurNom: string;
      nombreProduits: number;
      sommeScorePondere: number;
      sommeFCRPondere: number;
      totalQuantiteScore: number;
      totalQuantiteFCR: number;
    }
  >();

  for (const ps of produitScores) {
    const existing = byFournisseur.get(ps.fournisseurId) ?? {
      fournisseurNom: ps.fournisseurNom,
      nombreProduits: 0,
      sommeScorePondere: 0,
      sommeFCRPondere: 0,
      totalQuantiteScore: 0,
      totalQuantiteFCR: 0,
    };
    existing.nombreProduits += 1;
    if (ps.scoreQualite !== null) {
      existing.sommeScorePondere += ps.scoreQualite * ps.quantiteTotale;
      existing.totalQuantiteScore += ps.quantiteTotale;
    }
    if (ps.fcrMoyen !== null) {
      existing.sommeFCRPondere += ps.fcrMoyen * ps.quantiteTotale;
      existing.totalQuantiteFCR += ps.quantiteTotale;
    }
    byFournisseur.set(ps.fournisseurId, existing);
  }

  // Construire la liste de resultats
  const result = Array.from(byFournisseur.entries()).map(([fournisseurId, data]) => ({
    fournisseurId,
    fournisseurNom: data.fournisseurNom,
    nombreProduits: data.nombreProduits,
    scoreMoyen:
      data.totalQuantiteScore > 0
        ? Math.round((data.sommeScorePondere / data.totalQuantiteScore) * 100) / 100
        : null,
    fcrMoyen:
      data.totalQuantiteFCR > 0
        ? Math.round((data.sommeFCRPondere / data.totalQuantiteFCR) * 100) / 100
        : null,
  }));

  // Trier par scoreMoyen DESC (null en fin)
  result.sort((a, b) => {
    if (a.scoreMoyen === null && b.scoreMoyen === null) return 0;
    if (a.scoreMoyen === null) return 1;
    if (b.scoreMoyen === null) return -1;
    return b.scoreMoyen - a.scoreMoyen;
  });

  return result;
}
