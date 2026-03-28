/**
 * context.ts — Constructeur du contexte d'evaluation pour le moteur de regles.
 *
 * Assemble un RuleEvaluationContext a partir des donnees brutes de la vague,
 * de ses releves, du stock du site et de la ConfigElevage.
 *
 * Flux :
 *   buildEvaluationContext(vague, releves, stock, configElevage) → RuleEvaluationContext
 */

import type { Releve, Vague, Produit, ConfigElevage } from "@/types";
import type { RuleEvaluationContext, IndicateursContext, StockProduitContext } from "@/types/activity-engine";
import { TypeReleve } from "@/types";
import {
  calculerFCR,
  calculerSGR,
  calculerTauxSurvie,
  calculerBiomasse,
  detecterPhase,
  calculerDensiteBac,
  computeTauxRenouvellement,
} from "@/lib/calculs";

// ---------------------------------------------------------------------------
// Types internes
// ---------------------------------------------------------------------------

/** Vague minimale requise pour le contexte */
type VagueCtx = Pick<
  Vague,
  "id" | "code" | "dateDebut" | "nombreInitial" | "poidsMoyenInitial" | "siteId"
>;

/** Releve minimal pour les calculs d'indicateurs */
type ReleveCtx = Pick<
  Releve,
  | "id"
  | "typeReleve"
  | "date"
  | "poidsMoyen"
  | "tailleMoyenne"
  | "nombreMorts"
  | "quantiteAliment"
  | "temperature"
  | "ph"
  | "oxygene"
  | "ammoniac"
  | "nombreCompte"
  | "bacId"
  | "pourcentageRenouvellement"
  | "volumeRenouvele"
  | "nombreRenouvellements"
>;

/** Bac minimal pour l'iteration per-bac */
export type BacCtx = {
  id: string;
  nom: string;
  volume: number | null;
  nombrePoissons: number | null;
  nombreInitial: number | null;
  poidsMoyenInitial: number | null;
};

/** Stock produit minimal */
type ProduitStockCtx = Pick<
  Produit,
  "id" | "nom" | "categorie" | "unite" | "seuilAlerte" | "stockActuel"
>;

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

/** Offset UTC+1 pour le Cameroun (WAT) en millisecondes */
const WAT_OFFSET_MS = 1 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// Fonction principale
// ---------------------------------------------------------------------------

/**
 * Construit le contexte d'evaluation complet pour une vague.
 *
 * Calcule tous les indicateurs de performance a partir des releves fournis
 * et assemble le contexte pret a etre utilise par l'evaluateur.
 *
 * @param vague         - Vague a evaluer
 * @param releves       - Tous les releves de la vague (tous types)
 * @param stock         - Produits en stock du site avec quantites
 * @param configElevage - Configuration d'elevage (nullable)
 * @param bac           - Bac courant pour l'iteration per-bac (null = vague-level)
 * @param allBacs       - Tous les bacs de la vague (pour calculerDensiteBac — Sprint 27-28)
 * @returns             Contexte complet d'evaluation
 */
export function buildEvaluationContext(
  vague: VagueCtx,
  releves: ReleveCtx[],
  stock: ProduitStockCtx[],
  configElevage: ConfigElevage | null,
  bac?: BacCtx | null,
  allBacs?: BacCtx[]
): RuleEvaluationContext {
  // ---- Calcul du temps ecoule (UTC+1 = WAT) ----
  const nowWAT = new Date(Date.now() + WAT_OFFSET_MS);
  const dateDebutWAT = new Date(vague.dateDebut.getTime() + WAT_OFFSET_MS);
  const joursEcoules = Math.max(
    0,
    Math.floor(
      (nowWAT.getTime() - dateDebutWAT.getTime()) / (1000 * 60 * 60 * 24)
    )
  );
  const semaine = Math.floor(joursEcoules / 7) + 1;

  // ---- Tri des releves par type ----
  const sorted = [...releves].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  // ---- Filtrer par bac si fourni ----
  const relevesForCalc = bac
    ? sorted.filter((r) => r.bacId === bac.id)
    : sorted;

  // ---- Nombre initial pour les calculs (bac-level ou vague-level) ----
  const nombreInitialCalc = bac?.nombreInitial ?? vague.nombreInitial;
  const poidsMoyenInitialCalc = bac?.poidsMoyenInitial ?? vague.poidsMoyenInitial;

  const biometries = relevesForCalc.filter((r) => r.typeReleve === TypeReleve.BIOMETRIE);
  const mortalites = relevesForCalc.filter((r) => r.typeReleve === TypeReleve.MORTALITE);
  const alimentations = relevesForCalc.filter((r) => r.typeReleve === TypeReleve.ALIMENTATION);
  const comptages = relevesForCalc.filter((r) => r.typeReleve === TypeReleve.COMPTAGE);

  // ---- Indicateurs de base ----
  const derniereBiometrie = biometries.at(-1) ?? null;
  const poidsMoyen = derniereBiometrie?.poidsMoyen ?? null;

  const totalMortalites = mortalites.reduce(
    (sum, r) => sum + (r.nombreMorts ?? 0),
    0
  );

  const totalAliment = alimentations.reduce(
    (sum, r) => sum + (r.quantiteAliment ?? 0),
    0
  );

  const dernierComptage = comptages.at(-1) ?? null;
  const nombreVivants =
    dernierComptage?.nombreCompte != null
      ? dernierComptage.nombreCompte
      : Math.max(0, nombreInitialCalc - totalMortalites);

  // ---- FCR ----
  const biomasse = calculerBiomasse(poidsMoyen, nombreVivants);
  const biomasseInitiale = calculerBiomasse(
    poidsMoyenInitialCalc,
    nombreInitialCalc
  );
  const gainBiomasse =
    biomasse !== null && biomasseInitiale !== null
      ? biomasse - biomasseInitiale
      : null;
  const fcr = calculerFCR(totalAliment, gainBiomasse);

  // ---- SGR ----
  const sgr = calculerSGR(poidsMoyenInitialCalc, poidsMoyen, joursEcoules);

  // ---- Taux survie et mortalite ----
  const tauxSurvie = calculerTauxSurvie(nombreVivants, nombreInitialCalc);
  const tauxMortaliteCumule =
    nombreInitialCalc > 0
      ? (totalMortalites / nombreInitialCalc) * 100
      : null;

  const indicateurs: IndicateursContext = {
    fcr: fcr !== null ? Math.round(fcr * 1000) / 1000 : null,
    sgr: sgr !== null ? Math.round(sgr * 1000) / 1000 : null,
    tauxSurvie: tauxSurvie !== null ? Math.round(tauxSurvie * 100) / 100 : null,
    biomasse: biomasse !== null ? Math.round(biomasse * 100) / 100 : null,
    poidsMoyen,
    nombreVivants,
    tauxMortaliteCumule:
      tauxMortaliteCumule !== null
        ? Math.round(tauxMortaliteCumule * 100) / 100
        : null,
  };

  // ---- Stock ----
  const stockCtx: StockProduitContext[] = stock.map((p) => ({
    produit: {
      id: p.id,
      nom: p.nom,
      categorie: p.categorie,
      unite: p.unite,
      seuilAlerte: p.seuilAlerte,
    },
    quantiteActuelle: p.stockActuel,
    estEnAlerte: p.stockActuel <= p.seuilAlerte,
  }));

  // ---- Phase via detecterPhase ----
  const phase =
    poidsMoyen !== null
      ? String(detecterPhase(poidsMoyen, configElevage))
      : null;

  // ---- 5 derniers releves (tous types, du plus recent au plus ancien) ----
  const derniersReleves = [...relevesForCalc]
    .reverse()
    .slice(0, 5)
    .map((r) => ({
      id: r.id,
      typeReleve: r.typeReleve,
      date: r.date,
      poidsMoyen: r.poidsMoyen ?? null,
      tailleMoyenne: r.tailleMoyenne ?? null,
      nombreMorts: r.nombreMorts ?? null,
      quantiteAliment: r.quantiteAliment ?? null,
      temperature: r.temperature ?? null,
      ph: r.ph ?? null,
      oxygene: r.oxygene ?? null,
      ammoniac: r.ammoniac ?? null,
    }));

  // ---- Config elevage simplifie pour le contexte ----
  const configCtx = configElevage
    ? {
        poidsObjectif: configElevage.poidsObjectif,
        fcrAlerteMax: configElevage.fcrAlerteMax,
        seuilAcclimatation: configElevage.seuilAcclimatation,
        seuilCroissanceDebut: configElevage.seuilCroissanceDebut,
        seuilJuvenile: configElevage.seuilJuvenile,
        seuilGrossissement: configElevage.seuilGrossissement,
        seuilFinition: configElevage.seuilFinition,
        // Seuils de densite differencies par type de systeme (Sprint 27-28)
        densiteBacBetonAlerte: configElevage.densiteBacBetonAlerte,
        densiteBacBetonCritique: configElevage.densiteBacBetonCritique,
        densiteEtangAlerte: configElevage.densiteEtangAlerte,
        densiteEtangCritique: configElevage.densiteEtangCritique,
        densiteRasAlerte: configElevage.densiteRasAlerte,
        densiteRasCritique: configElevage.densiteRasCritique,
        fenetreRenouvellementJours: configElevage.fenetreRenouvellementJours,
      }
    : null;

  // ---- Sprint 27-28 (ADR-density-alerts) — densiteKgM3 ----
  // Calcul rigoureux via computeVivantsByBac() + biometrie filtree par bacId.
  // Requires: bac non-null + volume connu + au moins une biometrie disponible.
  let densiteKgM3: number | null = null;
  if (bac != null) {
    const bacsForDensity = allBacs ?? (bac ? [bac] : []);
    // Adapter les releves au type attendu par calculerDensiteBac
    const relevesAdaptes = sorted.map((r) => ({
      bacId: r.bacId ?? null,
      typeReleve: r.typeReleve,
      nombreMorts: r.nombreMorts ?? null,
      nombreCompte: r.nombreCompte ?? null,
      poidsMoyen: r.poidsMoyen ?? null,
      date: r.date,
    }));
    densiteKgM3 = calculerDensiteBac(
      { id: bac.id, volume: bac.volume, nombreInitial: bac.nombreInitial },
      bacsForDensity.map((b) => ({ id: b.id, nombreInitial: b.nombreInitial })),
      relevesAdaptes,
      vague.nombreInitial
    );
  }

  // ---- Sprint 27-28 — tauxRenouvellementPctJour ----
  // Filtre les releves RENOUVELLEMENT pour ce bac et calcule le taux moyen.
  let tauxRenouvellementPctJour: number | null = null;
  if (bac != null) {
    const fenetreJours = configElevage?.fenetreRenouvellementJours ?? 7;
    const relevesRenouvellement = sorted
      .filter((r) => r.typeReleve === TypeReleve.RENOUVELLEMENT && r.bacId === bac.id)
      .map((r) => ({
        date: r.date,
        pourcentageRenouvellement: r.pourcentageRenouvellement ?? null,
        volumeRenouvele: r.volumeRenouvele ?? null,
        nombreRenouvellements: r.nombreRenouvellements ?? null,
      }));
    tauxRenouvellementPctJour = computeTauxRenouvellement(
      relevesRenouvellement,
      bac.volume,
      fenetreJours
    );
  }

  // ---- Sprint 27-28 — joursDepuisDernierReleveQualiteEau ----
  // Cherche le dernier releve QUALITE_EAU pour ce bac et calcule les jours ecoules.
  let joursDepuisDernierReleveQualiteEau: number | null = null;
  if (bac != null) {
    const derniereQualiteEau = sorted
      .filter((r) => r.typeReleve === TypeReleve.QUALITE_EAU && r.bacId === bac.id)
      .at(-1) ?? null;
    if (derniereQualiteEau != null) {
      const nowWATMs = Date.now() + WAT_OFFSET_MS;
      const dateWATMs = new Date(derniereQualiteEau.date).getTime() + WAT_OFFSET_MS;
      joursDepuisDernierReleveQualiteEau = Math.floor(
        (nowWATMs - dateWATMs) / (1000 * 60 * 60 * 24)
      );
    }
  }

  return {
    vague: {
      id: vague.id,
      code: vague.code,
      dateDebut: vague.dateDebut,
      nombreInitial: vague.nombreInitial,
      poidsMoyenInitial: vague.poidsMoyenInitial,
      siteId: vague.siteId,
    },
    joursEcoules,
    semaine,
    indicateurs,
    stock: stockCtx,
    configElevage: configCtx,
    derniersReleves,
    phase,
    bac: bac ?? null,
    densiteKgM3,
    tauxRenouvellementPctJour,
    joursDepuisDernierReleveQualiteEau,
  };
}
