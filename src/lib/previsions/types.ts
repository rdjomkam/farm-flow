/**
 * Types internes du moteur de calcul du module Previsions.
 *
 * Ces types sont VOLONTAIREMENT distincts des interfaces miroirs de
 * `src/types/models.ts` (story PR1.2) : la convention constante du depot
 * mirroire un `Decimal` Prisma en `number` cote types applicatifs, alors
 * que le moteur (ADR-053 section 4, "Typage numerique") travaille
 * exclusivement en `Decimal` pour tout montant, poids en kg, ou nombre de
 * sacs fractionnaire. La frontiere de conversion `number` (types
 * applicatifs / Prisma) <-> `Decimal` (moteur) est assumee explicitement a
 * la charge de la couche API/queries qui appellera ce moteur (hors
 * perimetre PR1.3, cf. story) — jamais laissee implicite a l'interieur du
 * moteur lui-meme.
 *
 * Ces interfaces ne portent que les champs strictement necessaires au
 * calcul (pas de miroir 1:1 des modeles Prisma) : c'est ce qui garantit
 * l'absence d'I/O (aucune de ces interfaces ne force a charger un modele
 * Prisma complet pour appeler une fonction du moteur).
 */
import { Decimal } from "./decimal-config";

/**
 * Une ligne de repartition mensuelle (%) pour un AlimentPrevision donne
 * (miroir partiel de RepartitionMoisAliment, ADR-053 section 3.5).
 */
export interface RepartitionMoisInput {
  /** 1..dureeCycleMois — jamais un index 0-based (ADR-053 section 3.5) */
  moisCycle: number;
  /** 0..100 */
  pourcentage: Decimal;
}

/**
 * Un aliment previsionnel (granulometrie), tel que consomme par
 * `calculerBesoinAlimentMensuel` (aliments.ts).
 */
export interface AlimentPrevisionCalcInput {
  /** alimentPrevisionId — tracabilite du resultat uniquement, jamais lu comme FK (le moteur ne fait pas d'I/O) */
  id: string;
  poidsSacKg: Decimal;
  /**
   * Besoin total (kg) de cette granulometrie sur un cycle complet d'une
   * VaguePrevue.
   *
   * GAP DE MODELE signale au rapport de la story PR1.3 : ni le schema
   * Prisma (AlimentPrevision, ADR-053 section 3.5) ni le texte de l'ADR
   * ne specifient de champ ni de formule pour deriver cette valeur depuis
   * la biomasse prevue / un taux d'alimentation par phase de poids. Elle
   * est donc traitee ici comme une ENTREE explicite du moteur (calculee
   * en amont, par la couche API/queries ou fournie par les fixtures de
   * recette PR1.4) plutot que recalculee silencieusement a l'interieur du
   * moteur avec une formule non verifiee par la pre-analyse.
   */
  besoinTotalCycleKg: Decimal;
  repartitions: RepartitionMoisInput[];
}

/**
 * Un palier de remise volume, dans son ordre d'evaluation explicite
 * (miroir partiel de PalierRemise, ADR-053 section 3.4).
 */
export interface PalierRemiseInput {
  /** ordre d'evaluation explicite — jamais deduit d'un tri implicite sur seuilTonnes */
  ordre: number;
  seuilTonnes: Decimal;
  pourcentageRemise: Decimal;
}

/* -------------------------------------------------------------------- *
 * Rapprochement prevu/reel (ADR-053 section 15, amendement Sprint PR3,
 * story PR3.4 — src/lib/previsions/rapprochement.ts).
 *
 * IMPORTANT (ERR-142/ERR-160/ERR-171, ADR-053 section 15.6) : il n'existe
 * PAS de jeu d'or externe pour ce sous-module — Depense/Vente/
 * MouvementStock n'ont jamais ete modelises dans le classeur de reference.
 * La seule protection possible est une discipline de test par
 * falsification chiffree (§15.6 point 3) sur des fixtures synthetiques
 * concues pour FAIRE DIVERGER deux implementations candidates (§15.6
 * point 4), jamais un compte brut d'assertions vertes.
 * -------------------------------------------------------------------- */

/**
 * Statut de rapprochabilite d'une ligne (ADR-053 section 15.1).
 *
 * - RAPPROCHE : une source reelle existe et un mapping actif la relie a la
 *   cible prevue — `reel` est un montant, potentiellement 0 (aucune
 *   donnee reelle ce mois-la, legitimement).
 * - NON_RAPPROCHE : une source reelle existe (une CategorieDepense/
 *   CategorieProduit reellement utilisee sur le site) mais aucun
 *   MappingRapprochement actif ne la couvre — bac explicite, jamais un
 *   silence (ADR-053 section 5).
 * - SANS_SOURCE_REELLE : la ligne prevue n'a structurellement AUCUNE table
 *   reelle a lire (ex. ApportCapital de type SUBVENTION). `reel` vaut
 *   `null`, JAMAIS `0` — un `0` mentirait sur l'existence d'une source.
 */
export type StatutRapprochement = "RAPPROCHE" | "NON_RAPPROCHE" | "SANS_SOURCE_REELLE";

/**
 * Sens favorable/defavorable d'un ecart (ADR-053 section 15.5). Porte par
 * la ligne, jamais deduit ad hoc dans un composant UI.
 */
export type SensEcart = "FAVORABLE" | "DEFAVORABLE" | "NEUTRE" | "NON_APPLICABLE";

/**
 * Nature de la grandeur comparee — determine le sens de l'ecart (ADR-053
 * section 15.5), independamment du signe brut de `ecartAbsolu` :
 * - DEPENSE : `reel > prevu` est DEFAVORABLE (depasser un budget de
 *   depense est un signal negatif).
 * - ENTREE : `reel > prevu` est FAVORABLE (recette/encaissement, ex. une
 *   vente prevue).
 * - QUANTITE : `reel > prevu` est FAVORABLE (tonnage, effectif — produire
 *   plus que prevu est un signal positif).
 */
export type NatureGrandeur = "DEPENSE" | "ENTREE" | "QUANTITE";

/**
 * Couleur de severite discrete calculee par `couleurPourSensEcart`
 * (rapprochement.ts). La palette exacte de nuances (ex. "vert clair" vs
 * "vert sature") est un choix d'implementation UI hors architecture
 * (ADR-053 section 15.8.d) — cette fonction ne retourne que la teinte.
 */
export type CouleurEcart = "vert" | "orange" | "rouge" | "neutre";

/**
 * Une ligne de rapprochement prevu/reel (ADR-053 section 15.5).
 */
export interface LigneRapprochement {
  /** identifiant stable de la ligne — tracabilite uniquement, jamais lu comme FK (le moteur ne fait pas d'I/O) */
  id: string;
  /** 0-based depuis dateDebutPlan du scenario, meme referentiel que ChargeMensuellePrevue.moisAbsolu */
  moisAbsolu: number;
  /** libelle lisible de la ligne (poste, granulometrie, "Non rapproche — <categorie>", ...) */
  libelle: string;
  natureGrandeur: NatureGrandeur;
  prevu: Decimal;
  /** null ssi statutRapprochement === "SANS_SOURCE_REELLE" — jamais 0 dans ce cas (ADR-053 15.1) */
  reel: Decimal | null;
  statutRapprochement: StatutRapprochement;
  /** reel - prevu, jamais prevu - reel. null si reel est null. */
  ecartAbsolu: Decimal | null;
  /** (reel - prevu) / |prevu|. null si prevu === 0 OU reel === null — JAMAIS Infinity, JAMAIS NaN, JAMAIS 0 */
  ecartPct: Decimal | null;
  sens: SensEcart;
}
