/**
 * Types du moteur de regles d'activites (Sprint 21).
 *
 * Le moteur evalue les RegleActivite contre le contexte courant de chaque
 * vague active et genere des Activite automatiquement quand une regle
 * est declenchee.
 *
 * Flux d'execution :
 *   1. Collecter le RuleEvaluationContext pour chaque vague active
 *   2. Evaluer chaque RegleActivite active → produit des RuleMatch
 *   3. Pour chaque RuleMatch, resoudre les TemplatePlaceholders
 *   4. Persister les GeneratedActivity en base via Prisma
 */

import type { Produit, Recurrence, Releve, RegleActivite, StatutActivite, TypeActivite, Vague } from "./models";

// ---------------------------------------------------------------------------
// Contexte d'evaluation
// ---------------------------------------------------------------------------

/**
 * Stock d'un produit au moment de l'evaluation.
 * Inclus dans RuleEvaluationContext pour les declencheurs STOCK_BAS.
 */
export interface StockProduitContext {
  produit: Pick<Produit, "id" | "nom" | "categorie" | "unite" | "seuilAlerte">;
  /** Quantite actuelle en stock dans l'unite du produit */
  quantiteActuelle: number;
  /** True si quantiteActuelle <= seuilAlerte */
  estEnAlerte: boolean;
}

/**
 * Indicateurs de performance calcules au moment de l'evaluation.
 *
 * Tous les champs sont nullable : si les releves sont insuffisants pour
 * calculer un indicateur, la valeur est null et le moteur ignore les regles
 * qui dependent de cet indicateur.
 */
export interface IndicateursContext {
  /** FCR courant (Feed Conversion Ratio) — null si alimentation insuffisante */
  fcr: number | null;
  /** SGR courant (Specific Growth Rate) % par jour — null si biometrie insuffisante */
  sgr: number | null;
  /** Taux de survie en % — null si pas de donnees de mortalite */
  tauxSurvie: number | null;
  /** Biomasse totale estimee en kg */
  biomasse: number | null;
  /** Poids moyen actuel en grammes */
  poidsMoyen: number | null;
  /** Nombre de poissons vivants estimes */
  nombreVivants: number | null;
  /** Taux de mortalite cumulee en % depuis le debut de la vague */
  tauxMortaliteCumule: number | null;
}

/**
 * Contexte complet d'evaluation d'une vague.
 *
 * Passe a chaque regle lors de l'evaluation. Contient toutes les donnees
 * necessaires pour evaluer les conditions de declenchement et resoudre
 * les placeholders des templates.
 */
export interface RuleEvaluationContext {
  /** Vague en cours d'evaluation */
  vague: Pick<Vague, "id" | "code" | "dateDebut" | "nombreInitial" | "poidsMoyenInitial" | "siteId">;
  /** Nombre de jours ecoules depuis le debut de la vague */
  joursEcoules: number;
  /** Semaine du cycle (joursEcoules / 7, arrondi) */
  semaine: number;
  /** Indicateurs de performance calcules */
  indicateurs: IndicateursContext;
  /** Stock actuel de chaque produit du site */
  stock: StockProduitContext[];
  /**
   * Configuration d'elevage active pour ce site.
   * Contient les seuils FCR, poids, densite utilises comme reference.
   * Null si aucun profil ConfigElevage n'est defini pour le site.
   */
  configElevage: {
    poidsObjectif: number;
    fcrAlerteMax: number | null;
    seuilAcclimatation: number | null;
    seuilCroissanceDebut: number | null;
    seuilJuvenile: number | null;
    seuilGrossissement: number | null;
    seuilFinition: number | null;
  } | null;
  /** 5 derniers releves de la vague (tous types confondus), du plus recent au plus ancien */
  derniersReleves: Pick<
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
  >[];
  /**
   * Phase d'elevage courante determinee a partir du poids moyen et de ConfigElevage.
   * Null si ConfigElevage absent ou poidsMoyen non disponible.
   * Valeurs possibles : "ACCLIMATATION" | "CROISSANCE_DEBUT" | "JUVENILE" | "GROSSISSEMENT" | "FINITION"
   */
  phase: string | null;
}

// ---------------------------------------------------------------------------
// Resultat d'evaluation
// ---------------------------------------------------------------------------

/**
 * RuleMatch — Resultat positif de l'evaluation d'une regle sur une vague.
 *
 * Un RuleMatch est produit quand :
 *   - la regle est active
 *   - la vague satisfait les conditions de declenchement
 *   - le cooldown n'est pas encore ecoule depuis la derniere generation
 *
 * Le score permet de trier les regles par priorite quand plusieurs
 * s'appliquent simultanement a la meme vague.
 */
export interface RuleMatch {
  /** Regle evaluee */
  regle: RegleActivite;
  /** Vague sur laquelle la regle se declenche */
  vague: RuleEvaluationContext["vague"];
  /** Contexte complet ayant conduit au declenchement */
  context: RuleEvaluationContext;
  /**
   * Score de priorite pour le tri (priorite de la regle * 10 + bonus contextuel).
   * Les regles CRITIQUE (priorite 3) sont generees en premier.
   */
  score: number;
}

// ---------------------------------------------------------------------------
// Activite generee
// ---------------------------------------------------------------------------

/**
 * GeneratedActivity — Payload pret a etre persiste en base par le moteur.
 *
 * Tous les placeholders du titreTemplate et instructionsTemplate ont ete
 * resolus. Ce type correspond aux champs crees lors d'un INSERT Activite
 * par le moteur (isAutoGenerated = true).
 */
export interface GeneratedActivity {
  /** Titre resolu (placeholders remplaces) */
  titre: string;
  /** Description ou instructions resolues (null si instructionsTemplate absent) */
  description: string | null;
  typeActivite: TypeActivite;
  statut: StatutActivite;
  /** Date de debut proposee pour l'activite */
  dateDebut: Date;
  dateFin: Date | null;
  recurrence: Recurrence | null;
  vagueId: string;
  bacId: string | null;
  assigneAId: string | null;
  /** Utilisateur systeme qui a declenche la generation (SYSTEM_USER_ID) */
  userId: string;
  siteId: string;
  /** ID de la regle ayant genere cette activite */
  regleId: string;
  /** Instructions detaillees resolues */
  instructionsDetaillees: string | null;
  /** Conseil IA contextuel genere (ex: "FCR eleve : reduire la ration de 10%") */
  conseilIA: string | null;
  produitRecommandeId: string | null;
  quantiteRecommandee: number | null;
  priorite: number;
  /** Toujours true pour les activites creees par le moteur */
  isAutoGenerated: true;
  /** Phase d'elevage au moment de la generation */
  phaseElevage: string | null;
}

// ---------------------------------------------------------------------------
// Placeholders de template
// ---------------------------------------------------------------------------

/**
 * TemplatePlaceholders — Valeurs injectees dans les templates Mustache
 * lors de la resolution d'un RuleMatch.
 *
 * Syntaxe dans les templates : {{nom_du_placeholder}}
 *
 * Tous les champs sont de type string car ils sont inseres dans du texte.
 * Le moteur est responsable du formatage (arrondis, unites, etc.).
 *
 * @example
 * ```
 * titreTemplate : "Alimentation J{{semaine}} — {{quantite_calculee}} kg"
 * instructionsTemplate : "Distribuer {{quantite_calculee}} kg d'aliment
 *   de taille {{produit}} pour {{nombreVivants}} poissons (poids moyen {{poids_moyen}} g).
 *   Taux de rationnement : {{taux}}% de la biomasse."
 * ```
 */
export type TemplatePlaceholders = {
  /**
   * Quantite calculee d'aliment recommandee en kg.
   * Calcul : biomasse * (tauxRationnement / 100)
   * Arrondi a 2 decimales.
   */
  quantite_calculee: string;

  /**
   * Taille corporelle moyenne actuelle en cm.
   * Source : dernier releve biometrie (tailleMoyenne).
   */
  taille: string;

  /**
   * Poids moyen actuel des poissons en grammes.
   * Source : dernier releve biometrie (poidsMoyen) ou indicateurs.poidsMoyen.
   */
  poids_moyen: string;

  /**
   * Quantite en stock du produit recommande (dans son unite).
   * Source : StockProduitContext.quantiteActuelle du produitRecommandeId.
   * Vide ("—") si produitRecommandeId est null.
   */
  stock: string;

  /**
   * Taux contextuel en pourcentage.
   * Semantique selon le contexte : taux de rationnement, taux de survie, etc.
   * Le moteur determine le taux pertinent selon le typeActivite.
   */
  taux: string;

  /**
   * Valeur numerique generique (FCR, SGR, temperature, ph, etc.).
   * Semantique determinee par le declencheur de la regle.
   */
  valeur: string;

  /**
   * Numero de semaine depuis le debut du cycle d'elevage.
   * Calcul : Math.floor(joursEcoules / 7) + 1
   */
  semaine: string;

  /**
   * Nom du produit recommande.
   * Source : produitRecommande.nom, ou "—" si absent.
   */
  produit: string;

  /**
   * Valeur du seuil qui a declenche la regle (ex: "150" pour un seuil de poids).
   * Source : RegleActivite.seuilDeclencheur.
   */
  seuil: string;

  /**
   * Nombre de jours restants avant la fin estimee du cycle.
   * Calcul : configElevage.dureeEstimeeCycle - joursEcoules
   * "—" si ConfigElevage absent.
   */
  jours_restants: string;

  /**
   * Quantite recommandee definie sur la regle (RegleActivite.quantiteRecommandee).
   * Vide ("—") si non definie.
   */
  quantite_recommandee: string;

  /**
   * Nom du bac associe a la vague (premier bac si plusieurs).
   * "—" si aucun bac disponible dans le contexte.
   */
  bac: string;

  /**
   * Biomasse totale estimee en kg.
   * Source : indicateurs.biomasse.
   */
  biomasse: string;

  /**
   * Code ou nom de la vague en cours d'evaluation.
   * Source : vague.code.
   */
  vague: string;

  /**
   * Nombre de jours ecoules depuis le debut de la vague.
   * Source : joursEcoules.
   */
  jours_ecoules: string;

  /**
   * Valeur marchande estimee en FCFA.
   * Calcul : biomasse (kg) * prix marche (FCFA/kg).
   * "—" si le prix marche n'est pas disponible dans ConfigElevage.
   */
  valeur_marchande: string;
};
