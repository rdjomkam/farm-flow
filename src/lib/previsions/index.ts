/**
 * src/lib/previsions/index.ts
 *
 * Barrel export — moteur de calcul pur du module Previsions.
 *
 * ADR-053, Sprint PR1, story PR1.3. Zero I/O (pas de `prisma.*`, pas de
 * `fs`, pas d'appel reseau) dans aucun fichier de ce dossier.
 */

export { Decimal } from "./decimal-config";

export type {
  RepartitionMoisInput,
  AlimentPrevisionCalcInput,
  PalierRemiseInput,
  StatutRapprochement,
  SensEcart,
  NatureGrandeur,
  CouleurEcart,
  LigneRapprochement,
} from "./types";

export { genererPlanEmpoissonnement, calculerAlevinsACommander } from "./plan";
export type { ParametresPlanInput, VaguePrevueGeneree } from "./plan";

export {
  calculerBesoinAlimentMensuel,
  determinerPourcentageRemise,
  appliquerTauxRemise,
  appliquerPalierRemise,
  calculerCoutAlimentVague,
  apportionnerCoutAlimentMensuel,
  calculerCoutAlimentGranulometrieParMois,
  repartirSacsEntreArticles,
  calculerDetailConsommationMensuelle,
} from "./aliments";
export type {
  BesoinAlimentMensuelResult,
  RemiseAppliqueeResult,
  AlimentParVagueCalcInput,
  CoutAlimentMoisResult,
  AlimentParVagueMensuelCalcInput,
  CoutAlimentGranulometrieMoisResult,
  ArticleRepartitionInput,
  ArticleRepartitionResult,
  DetailConsommationCycleInput,
  DetailConsommationMoisResult,
} from "./aliments";

export {
  calculerVoyages,
  calculerCoutTransport,
  calculerLogistiqueMensuelle,
} from "./logistique";
export type {
  ParametresTransportInput,
  LogistiqueMensuelleInput,
  LogistiqueMensuelleResult,
} from "./logistique";

export {
  calculerChargesMensuelles,
  calculerBaseRepartition,
  calculerQuotePartVague,
} from "./charges";
export type {
  ChargeMensuelleInput,
  ChargesMensuellesResult,
  ChargePourBaseInput,
  JournalEntryInput,
} from "./charges";

export { calculerCoutProductionVague, calculerRevenuPrevu } from "./vague";
export type { RevenuPrevuResult } from "./vague";

export {
  calculerTresorerieMensuelle,
  genererSerieTresorerie,
  calculerPointBasTresorerie,
} from "./tresorerie";
export type { TresorerieMoisResult, PointBasTresorerieResult } from "./tresorerie";

export { calculerBudgetTotalPlan } from "./budget";
export type { BudgetTotalPlanInput, BudgetTotalPlanResult } from "./budget";

export {
  validerSommeRepartitionMoisAliment,
  validerPaliersRemiseCroissants,
} from "./validation";

export {
  calculerEcart,
  calculerSensEcart,
  couleurPourSensEcart,
  SEUILS_ECART_PAR_DEFAUT,
  construireLigneRapprochement,
  reconcilierPrevuEtReel,
  extraireBacNonRapproche,
  agregerParMois,
  agregerCumule,
  agregerParPoste,
  topEcartsDuMois,
} from "./rapprochement";
export type {
  EcartCalcule,
  SeuilsEcart,
  ConstruireLigneRapprochementInput,
  EntreePrevueRapprochement,
  EntreeReelleAgregee,
  MappingRapprochementActif,
  AgregatEcart,
  AgregatMois,
  AgregatPoste,
} from "./rapprochement";
