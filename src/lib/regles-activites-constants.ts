/**
 * regles-activites-constants.ts — Constantes et utilitaires pour le module
 * d'administration des regles d'activites (Sprint 25).
 *
 * Ce fichier regroupe :
 *   - KNOWN_PLACEHOLDERS : liste exhaustive des 16 placeholders reconnus par
 *     template-engine.ts, avec description et valeur d'exemple pour l'UI.
 *   - TYPE_DECLENCHEUR_LABELS : labels FR pour chaque TypeDeclencheur.
 *   - TYPE_ACTIVITE_LABELS : labels FR pour chaque TypeActivite.
 *   - PHASE_ELEVAGE_LABELS : labels FR pour chaque PhaseElevage.
 *   - PHASE_ELEVAGE_ORDER : tableau ordonne des phases (du debut a la fin du cycle).
 *   - validateTemplatePlaceholders : fonction pure de validation des templates.
 *
 * Usage :
 * ```ts
 * import {
 *   KNOWN_PLACEHOLDERS,
 *   TYPE_DECLENCHEUR_LABELS,
 *   PHASE_ELEVAGE_ORDER,
 *   validateTemplatePlaceholders,
 * } from "@/lib/regles-activites-constants";
 * ```
 */

import { PhaseElevage, TypeActivite, TypeDeclencheur } from "@/types";

// ---------------------------------------------------------------------------
// Placeholders
// ---------------------------------------------------------------------------

/** Description d'un placeholder de template reconnu par le moteur. */
export interface KnownPlaceholder {
  /** Cle utilisee dans le template : {key} */
  key: string;
  /** Description metier a destination de l'administrateur */
  description: string;
  /** Valeur d'exemple affichee dans le preview (TemplatePreview) */
  example: string;
}

/**
 * Liste exhaustive des 16 placeholders reconnus par template-engine.ts.
 *
 * Tout placeholder absent de cette liste est considere inconnu :
 * il sera remplace par "[donnee non disponible]" au moment de la resolution,
 * mais son utilisation est autorisee (avertissement, pas d'erreur).
 *
 * Source : ADR-013 section "Placeholders disponibles".
 */
export const KNOWN_PLACEHOLDERS: KnownPlaceholder[] = [
  {
    key: "quantite_calculee",
    description: "Quantite d'aliment en kg calculee selon le taux de rationnement",
    example: "1,25",
  },
  {
    key: "taille",
    description: "Taille moyenne des poissons (dernier releve biometrie, en cm)",
    example: "12,5",
  },
  {
    key: "poids_moyen",
    description: "Poids moyen de la vague (en grammes)",
    example: "185,3",
  },
  {
    key: "stock",
    description: "Quantite en stock du produit recommande (en unite du produit)",
    example: "50,00",
  },
  {
    key: "taux",
    description: "Taux d'alimentation ou taux de survie selon le contexte (en %)",
    example: "3,50",
  },
  {
    key: "valeur",
    description: "FCR ou SGR selon le contexte (indice de conversion ou taux de croissance specifique)",
    example: "1,42",
  },
  {
    key: "semaine",
    description: "Numero de semaine dans le cycle d'elevage",
    example: "8",
  },
  {
    key: "produit",
    description: "Nom du produit recommande pour cette activite",
    example: "Granule 3mm Pro",
  },
  {
    key: "seuil",
    description: "Valeur du seuil ayant declenche la regle (ex: poids en g, taux en %)",
    example: "200,00",
  },
  {
    key: "jours_restants",
    description: "Jours restants avant la fin de cycle estimee",
    example: "45",
  },
  {
    key: "quantite_recommandee",
    description: "Quantite recommandee definie sur la regle (en unite du produit)",
    example: "25,00",
  },
  {
    key: "bac",
    description: "Nom du bac associe a la vague en cours d'evaluation",
    example: "Bac 3",
  },
  {
    key: "biomasse",
    description: "Biomasse totale de la vague en kg (poids moyen x effectif vivant)",
    example: "124,50",
  },
  {
    key: "vague",
    description: "Code identifiant de la vague",
    example: "V2026-03",
  },
  {
    key: "jours_ecoules",
    description: "Nombre de jours ecoules depuis le debut de la vague",
    example: "55",
  },
  {
    key: "valeur_marchande",
    description: "Valeur marchande estimee de la vague en FCFA (biomasse x prix marche)",
    example: "1 244 500",
  },
];

/** Set des cles connues (statiques) pour une validation O(1). */
const KNOWN_PLACEHOLDER_KEYS = new Set(KNOWN_PLACEHOLDERS.map((p) => p.key));

/**
 * Fusionne les placeholders statiques avec les custom depuis la DB.
 *
 * Les custom placeholders sont affiches avec un badge distinctif dans l'UI.
 *
 * @param customPlaceholders - Placeholders custom charges depuis la DB
 * @returns Liste fusionnee statiques + custom
 */
export function getAllPlaceholders(
  customPlaceholders: { key: string; label: string; description: string | null; example: string }[]
): (KnownPlaceholder & { isCustom?: boolean })[] {
  const merged: (KnownPlaceholder & { isCustom?: boolean })[] = [
    ...KNOWN_PLACEHOLDERS,
  ];

  for (const cp of customPlaceholders) {
    merged.push({
      key: cp.key,
      description: cp.label + (cp.description ? ` — ${cp.description}` : ""),
      example: cp.example,
      isCustom: true,
    });
  }

  return merged;
}

/**
 * Valide les placeholders d'un template en tenant compte des custom.
 *
 * @param template           - Chaine de template a valider
 * @param customKeys         - Cles des custom placeholders (optionnel)
 * @returns                  Resultat de validation
 */
export function validateTemplatePlaceholdersWithCustom(
  template: string,
  customKeys: string[]
): { valid: boolean; unknown: string[] } {
  const allKeys = new Set([...KNOWN_PLACEHOLDER_KEYS, ...customKeys]);

  const PLACEHOLDER_REGEX = /\{(\w+)\}/g;
  const foundKeys = new Set<string>();

  let match: RegExpExecArray | null;
  while ((match = PLACEHOLDER_REGEX.exec(template)) !== null) {
    foundKeys.add(match[1]);
  }

  const unknown: string[] = [];
  for (const key of foundKeys) {
    if (!allKeys.has(key)) {
      unknown.push(key);
    }
  }

  return { valid: unknown.length === 0, unknown };
}

// ---------------------------------------------------------------------------
// Labels FR — TypeDeclencheur
// ---------------------------------------------------------------------------

/**
 * Labels en francais pour l'affichage UI de chaque TypeDeclencheur.
 * Couvre toutes les valeurs de l'enum (exhaustivite garantie par Record<TypeDeclencheur, string>).
 */
export const TYPE_DECLENCHEUR_LABELS: Record<TypeDeclencheur, string> = {
  [TypeDeclencheur.CALENDRIER]:    "Calendrier",
  [TypeDeclencheur.RECURRENT]:     "Recurrent",
  [TypeDeclencheur.SEUIL_POIDS]:   "Seuil de poids",
  [TypeDeclencheur.SEUIL_QUALITE]: "Seuil qualite eau",
  [TypeDeclencheur.SEUIL_MORTALITE]: "Seuil de mortalite",
  [TypeDeclencheur.STOCK_BAS]:     "Stock bas",
  [TypeDeclencheur.FCR_ELEVE]:     "FCR eleve",
  [TypeDeclencheur.JALON]:         "Jalon de production",
  // Sprint 27-28 — Conditions composees de densite (ADR-density-alerts)
  [TypeDeclencheur.SEUIL_DENSITE]:        "Seuil de densite",
  [TypeDeclencheur.SEUIL_RENOUVELLEMENT]: "Seuil de renouvellement eau",
  [TypeDeclencheur.ABSENCE_RELEVE]:       "Absence de releve",
  // Declencheurs qualite eau specifiques (FAIL-1 fix)
  [TypeDeclencheur.SEUIL_AMMONIAC]:       "Seuil d'ammoniac",
  [TypeDeclencheur.SEUIL_OXYGENE]:        "Seuil d'oxygene dissous",
  [TypeDeclencheur.SEUIL_PH]:             "Seuil de pH",
  [TypeDeclencheur.SEUIL_TEMPERATURE]:    "Seuil de temperature",
};

// ---------------------------------------------------------------------------
// Labels FR — TypeActivite
// ---------------------------------------------------------------------------

/**
 * Labels en francais pour l'affichage UI de chaque TypeActivite.
 */
export const TYPE_ACTIVITE_LABELS: Record<TypeActivite, string> = {
  [TypeActivite.ALIMENTATION]: "Alimentation",
  [TypeActivite.BIOMETRIE]:    "Biometrie",
  [TypeActivite.QUALITE_EAU]:  "Qualite de l'eau",
  [TypeActivite.COMPTAGE]:     "Comptage",
  [TypeActivite.NETTOYAGE]:    "Nettoyage",
  [TypeActivite.TRAITEMENT]:   "Traitement",
  [TypeActivite.RECOLTE]:      "Recolte",
  [TypeActivite.TRI]:          "Tri",
  [TypeActivite.MEDICATION]:   "Medication",
  // Sprint 27-28 — Renouvellement eau (ADR-density-alerts)
  [TypeActivite.RENOUVELLEMENT]: "Renouvellement eau",
  [TypeActivite.AUTRE]:        "Autre",
};

// ---------------------------------------------------------------------------
// Labels FR — PhaseElevage
// ---------------------------------------------------------------------------

/**
 * Labels en francais pour l'affichage UI de chaque PhaseElevage.
 */
export const PHASE_ELEVAGE_LABELS: Record<PhaseElevage, string> = {
  [PhaseElevage.ACCLIMATATION]:    "Acclimatation",
  [PhaseElevage.CROISSANCE_DEBUT]: "Croissance debut",
  [PhaseElevage.JUVENILE]:         "Juvenile",
  [PhaseElevage.GROSSISSEMENT]:    "Grossissement",
  [PhaseElevage.FINITION]:         "Finition",
  [PhaseElevage.PRE_RECOLTE]:      "Pre-recolte",
};

// ---------------------------------------------------------------------------
// Ordre des phases d'elevage
// ---------------------------------------------------------------------------

/**
 * Tableau ordonne des phases d'elevage du debut a la fin du cycle.
 *
 * Utilise pour valider que phaseMin precede phaseMax dans le formulaire
 * et dans les validations cote API.
 *
 * Ordre : ACCLIMATATION < CROISSANCE_DEBUT < JUVENILE < GROSSISSEMENT < FINITION < PRE_RECOLTE
 */
export const PHASE_ELEVAGE_ORDER: PhaseElevage[] = [
  PhaseElevage.ACCLIMATATION,
  PhaseElevage.CROISSANCE_DEBUT,
  PhaseElevage.JUVENILE,
  PhaseElevage.GROSSISSEMENT,
  PhaseElevage.FINITION,
  PhaseElevage.PRE_RECOLTE,
];

// ---------------------------------------------------------------------------
// Types de declencheur a seuil (supportent firedOnce)
// ---------------------------------------------------------------------------

/**
 * Types de declencheur qui supportent le mecanisme firedOnce (one-shot).
 * Utilise pour la logique de toggle (reset firedOnce on reactivation),
 * la route /reset, et l'affichage du badge "Declenchee" dans l'UI.
 */
export const SEUIL_TYPES_FIREDONCE: TypeDeclencheur[] = [
  TypeDeclencheur.SEUIL_POIDS,
  TypeDeclencheur.SEUIL_QUALITE,
  TypeDeclencheur.SEUIL_MORTALITE,
  TypeDeclencheur.FCR_ELEVE,
  TypeDeclencheur.STOCK_BAS,
];

// ---------------------------------------------------------------------------
// Validation des templates
// ---------------------------------------------------------------------------

/**
 * Extrait et valide les placeholders presents dans un template.
 *
 * Syntaxe acceptee : {nom_placeholder} (accolades simples, lettres/chiffres/underscore).
 * Regex miroir de celle utilisee dans template-engine.ts : /\{(\w+)\}/g
 *
 * @param template - Chaine de template a valider (ex: "Distribuer {quantite_calculee}kg")
 * @returns
 *   - `valid`   : true si tous les placeholders sont dans KNOWN_PLACEHOLDERS
 *   - `unknown` : liste des cles de placeholders non reconnus (deduplication incluse)
 *
 * @example
 * validateTemplatePlaceholders("Distribuer {quantite_calculee}kg en {bac}")
 * // => { valid: true, unknown: [] }
 *
 * validateTemplatePlaceholders("Phase {phase_actuelle} — {poids_moyen}g")
 * // => { valid: false, unknown: ["phase_actuelle"] }
 *
 * @pure Cette fonction est pure : aucun effet de bord, meme entree => meme sortie.
 */
export function validateTemplatePlaceholders(template: string): {
  valid: boolean;
  unknown: string[];
} {
  const PLACEHOLDER_REGEX = /\{(\w+)\}/g;
  const foundKeys = new Set<string>();

  let match: RegExpExecArray | null;
  while ((match = PLACEHOLDER_REGEX.exec(template)) !== null) {
    foundKeys.add(match[1]);
  }

  const unknown: string[] = [];
  for (const key of foundKeys) {
    if (!KNOWN_PLACEHOLDER_KEYS.has(key)) {
      unknown.push(key);
    }
  }

  return {
    valid: unknown.length === 0,
    unknown,
  };
}
