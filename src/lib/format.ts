/**
 * src/lib/format.ts
 *
 * Fonctions utilitaires de formatage pour l'affichage.
 * Utilisées dans les composants pour une cohérence visuelle.
 *
 * Sprint 37 — Story 37.2 (Polish UX)
 * Sprint 39 — Story 39.4 (i18n helpers): locale param added to all functions
 */

/** Formats a number with fixed decimals and optional suffix. Returns "—" for null/undefined. */
export function formatNum(n: number | null | undefined, decimals = 2, suffix = ""): string {
  if (n == null) return "—";
  return n.toFixed(decimals) + (suffix ? ` ${suffix}` : "");
}

/**
 * Formate un montant en FCFA avec séparateurs selon la locale.
 * La locale par défaut est "fr" pour la compatibilité ICU maximale.
 *
 * @example formatXAF(15000) => "15 000 FCFA"
 * @example formatXAF(15000, "en") => "15,000 FCFA"
 * @example formatXAF(0) => "0 FCFA"
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
