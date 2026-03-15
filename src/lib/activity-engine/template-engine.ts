/**
 * template-engine.ts — Resolveur de templates pour le moteur de regles.
 *
 * Remplace les placeholders {nom_placeholder} dans les templates de titre
 * et d'instructions par les valeurs calculees.
 *
 * Placeholders supportes :
 *   {quantite_calculee}, {taille}, {poids_moyen}, {stock}, {taux},
 *   {valeur}, {semaine}, {produit}, {seuil}, {jours_restants}, {quantite_recommandee}
 *
 * Placeholders non resolus → "[donnee non disponible]" (EC-3.6)
 */

import type { TemplatePlaceholders } from "@/types/activity-engine";

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

const UNAVAILABLE = "[donnee non disponible]";

/** Separateur decimal FR */
const FR_LOCALE = "fr-FR";

// ---------------------------------------------------------------------------
// Formatage
// ---------------------------------------------------------------------------

/**
 * Formate un nombre en locale FR (1 234,5 au lieu de 1234.5).
 * Retourne UNAVAILABLE si la valeur est null/undefined.
 */
function formatNumber(
  value: number | null | undefined,
  decimals = 2
): string {
  if (value == null) return UNAVAILABLE;
  return value.toLocaleString(FR_LOCALE, {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  });
}

// ---------------------------------------------------------------------------
// Fonction principale
// ---------------------------------------------------------------------------

/**
 * Resout tous les placeholders d'un template.
 *
 * Syntaxe : {nom_placeholder} (accolades simples)
 * Fallback : "[donnee non disponible]" pour tout placeholder inconnu ou valeur absente.
 *
 * @param template    - Chaine de caracteres avec placeholders
 * @param placeholders - Dictionnaire des valeurs a injecter
 * @returns            Chaine resolue
 */
export function resolveTemplate(
  template: string,
  placeholders: Partial<TemplatePlaceholders>
): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => {
    const value = (placeholders as Record<string, string | undefined>)[key];
    if (value == null || value === "") return UNAVAILABLE;
    return value;
  });
}

// ---------------------------------------------------------------------------
// Constructeur de placeholders depuis le contexte
// ---------------------------------------------------------------------------

/**
 * Construit un dictionnaire TemplatePlaceholders partiel a partir
 * des donnees disponibles dans le contexte et de la regle.
 *
 * @param ctx              - Contexte d'evaluation de la vague
 * @param quantiteCalculee - Quantite d'aliment calculee en kg (nullable)
 * @param produitNom       - Nom du produit recommande (nullable)
 * @param seuilValeur      - Valeur du seuil de declenchement (de la regle)
 * @param quantiteRegle    - Quantite recommandee definie sur la regle
 * @param tailleGranule    - Taille de granule recommandee (nullable)
 * @param dureeEstimee     - Duree estimee du cycle en jours (nullable)
 * @param stockQte         - Quantite en stock du produit recommande (nullable)
 * @param bacNom           - Nom du bac associe a la vague (nullable)
 * @param vagueCode        - Code de la vague en cours d'evaluation
 * @param prixMarcheKg     - Prix marche en FCFA/kg pour estimer la valeur marchande (nullable)
 */
export function buildPlaceholders(ctx: {
  joursEcoules: number;
  semaine: number;
  /** Vague en cours d'evaluation — optionnel pour la compatibilite backward */
  vague?: { code: string };
  indicateurs: {
    poidsMoyen: number | null;
    fcr: number | null;
    sgr: number | null;
    tauxSurvie: number | null;
    tauxMortaliteCumule: number | null;
    /** Biomasse totale en kg — optionnel pour la compatibilite backward */
    biomasse?: number | null;
  };
  derniersReleves: { tailleMoyenne: number | null }[];
}, options: {
  quantiteCalculee?: number | null;
  produitNom?: string | null;
  seuilValeur?: number | null;
  quantiteRegle?: number | null;
  tailleGranule?: string | null;
  dureeEstimee?: number | null;
  stockQte?: number | null;
  tauxRationnement?: number | null;
  bacNom?: string | null;
  prixMarcheKg?: number | null;
}): Partial<TemplatePlaceholders> {
  const {
    quantiteCalculee,
    produitNom,
    seuilValeur,
    quantiteRegle,
    tailleGranule,
    dureeEstimee,
    stockQte,
    tauxRationnement,
    bacNom,
    prixMarcheKg,
  } = options;

  // Taille depuis le dernier releve biometrie (dans les 5 derniers)
  const tailleMoyenne =
    ctx.derniersReleves.find((r) => r.tailleMoyenne != null)?.tailleMoyenne ??
    null;

  // Jours restants
  const joursRestants =
    dureeEstimee != null
      ? Math.max(0, dureeEstimee - ctx.joursEcoules)
      : null;

  // Biomasse depuis les indicateurs (optionnelle pour compat backward)
  const biomasse = ctx.indicateurs.biomasse ?? null;

  // Valeur marchande : biomasse (kg) * prix marche (FCFA/kg)
  const valeurMarchande =
    biomasse != null && prixMarcheKg != null
      ? biomasse * prixMarcheKg
      : null;

  return {
    quantite_calculee:
      quantiteCalculee != null
        ? formatNumber(quantiteCalculee / 1000, 2) // grammes → kg
        : UNAVAILABLE,
    taille: tailleMoyenne != null ? formatNumber(tailleMoyenne, 1) : UNAVAILABLE,
    poids_moyen:
      ctx.indicateurs.poidsMoyen != null
        ? formatNumber(ctx.indicateurs.poidsMoyen, 1)
        : UNAVAILABLE,
    stock:
      stockQte != null ? formatNumber(stockQte, 2) : UNAVAILABLE,
    taux:
      tauxRationnement != null
        ? formatNumber(tauxRationnement, 2)
        : ctx.indicateurs.tauxSurvie != null
        ? formatNumber(ctx.indicateurs.tauxSurvie, 1)
        : UNAVAILABLE,
    valeur:
      ctx.indicateurs.fcr != null
        ? formatNumber(ctx.indicateurs.fcr, 2)
        : ctx.indicateurs.sgr != null
        ? formatNumber(ctx.indicateurs.sgr, 2)
        : UNAVAILABLE,
    semaine: String(ctx.semaine),
    produit: produitNom ?? UNAVAILABLE,
    seuil:
      seuilValeur != null ? formatNumber(seuilValeur, 2) : UNAVAILABLE,
    jours_restants:
      joursRestants != null ? String(Math.round(joursRestants)) : UNAVAILABLE,
    quantite_recommandee:
      quantiteRegle != null ? formatNumber(quantiteRegle, 2) : UNAVAILABLE,
    bac: bacNom ?? UNAVAILABLE,
    biomasse:
      biomasse != null
        ? formatNumber(biomasse, 2)
        : UNAVAILABLE,
    vague: ctx.vague?.code ?? UNAVAILABLE,
    jours_ecoules: String(ctx.joursEcoules),
    valeur_marchande:
      valeurMarchande != null
        ? formatNumber(valeurMarchande, 0)
        : UNAVAILABLE,
  };
}
