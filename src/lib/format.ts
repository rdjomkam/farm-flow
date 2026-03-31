/**
 * src/lib/format.ts
 *
 * Fonctions utilitaires de formatage pour l'affichage.
 * Utilisées dans les composants pour une cohérence visuelle.
 *
 * Sprint 37 — Story 37.2 (Polish UX)
 * Sprint 39 — Story 39.4 (i18n helpers): locale param added to all functions
 * Story CR3.4 — Extraction utilitaires de formatage
 */

/** Formats a number with fixed decimals and optional suffix. Returns "—" for null/undefined. */
export function formatNum(n: number | null | undefined, decimals = 2, suffix = ""): string {
  if (n == null) return "—";
  return n.toFixed(decimals) + (suffix ? ` ${suffix}` : "");
}

/**
 * Formate un nombre entier avec séparateurs de milliers selon la locale.
 * Retourne "—" pour null/undefined.
 *
 * @example formatNumber(15000) => "15 000"
 * @example formatNumber(null) => "—"
 */
export function formatNumber(n: number | null | undefined, locale: string = "fr"): string {
  if (n == null) return "—";
  const intlLocale = locale === "fr" ? "fr-FR" : locale === "en" ? "en-US" : locale;
  return new Intl.NumberFormat(intlLocale, {
    style: "decimal",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

/**
 * Formate un montant en FCFA avec séparateurs selon la locale.
 * La locale par défaut est "fr" pour la compatibilité ICU maximale.
 *
 * @example formatXAF(15000) => "15 000 FCFA"
 * @example formatXAF(15000, "en") => "15,000 FCFA"
 * @example formatXAF(0) => "0,00 FCFA"
 */
export function formatXAF(amount: number, locale: string = "fr"): string {
  // Normalize short locale codes to full BCP 47 tags for Intl.NumberFormat
  const intlLocale = locale === "fr" ? "fr-FR" : locale === "en" ? "en-US" : locale;
  return (
    new Intl.NumberFormat(intlLocale, {
      style: "decimal",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount) + " FCFA"
  );
}

/**
 * Formate un montant en CFA (alias pour formatXAF, suffixe "CFA" au lieu de "FCFA").
 * Utilisé dans les contextes où on affiche "CFA" sans le préfixe "F".
 *
 * @example formatCFA(15000) => "15 000 CFA"
 */
export function formatCFA(amount: number, locale: string = "fr"): string {
  const intlLocale = locale === "fr" ? "fr-FR" : locale === "en" ? "en-US" : locale;
  return (
    new Intl.NumberFormat(intlLocale, {
      style: "decimal",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount) + " CFA"
  );
}

/**
 * Formate un montant en FCFA avec cas spécial pour 0.
 * Affiche "Gratuit" (fr) ou "Free" (en) quand le montant est 0.
 */
export function formatXAFOrFree(amount: number, locale: string = "fr"): string {
  if (amount === 0) return locale === "en" ? "Free" : "Gratuit";
  return formatXAF(amount, locale);
}

/**
 * Formate une date selon la locale.
 * Retourne une date courte lisible (ex: "21/03/2026" en fr, "3/21/2026" en en).
 *
 * @example formatDate(new Date(), "fr") => "21/03/2026"
 * @example formatDate(new Date(), "en") => "3/21/2026"
 */
export function formatDate(date: Date | string, locale: string = "fr"): string {
  const intlLocale = locale === "fr" ? "fr-FR" : locale === "en" ? "en-US" : locale;
  return new Intl.DateTimeFormat(intlLocale, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(date));
}

/**
 * Formate une date avec l'heure selon la locale.
 *
 * @example formatDateTime(new Date()) => "21/03/2026, 14:30"
 */
export function formatDateTime(date: Date | string, locale: string = "fr"): string {
  const intlLocale = locale === "fr" ? "fr-FR" : locale === "en" ? "en-US" : locale;
  return new Intl.DateTimeFormat(intlLocale, {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(date));
}

/**
 * Formate un poids en grammes avec conversion automatique en kg si >= 1000g.
 *
 * @example formatWeight(500) => "500 g"
 * @example formatWeight(1500) => "1,50 kg"
 * @example formatWeight(null) => "—"
 */
export function formatWeight(grams: number | null | undefined, locale: string = "fr"): string {
  if (grams == null) return "—";
  const intlLocale = locale === "fr" ? "fr-FR" : locale === "en" ? "en-US" : locale;
  if (grams >= 1000) {
    const kg = grams / 1000;
    return (
      new Intl.NumberFormat(intlLocale, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(kg) + " kg"
    );
  }
  return (
    new Intl.NumberFormat(intlLocale, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(grams) + " g"
  );
}
