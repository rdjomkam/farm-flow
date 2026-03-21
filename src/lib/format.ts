/**
 * src/lib/format.ts
 *
 * Fonctions utilitaires de formatage pour l'affichage.
 * Utilisées dans les composants pour une cohérence visuelle.
 *
 * Sprint 37 — Story 37.2 (Polish UX)
 */

/**
 * Formate un montant en FCFA avec séparateurs français.
 * Utilise "fr-FR" + suffixe "FCFA" pour une compatibilité ICU maximale.
 *
 * @example formatXAF(15000) => "15 000 FCFA"
 * @example formatXAF(0) => "0 FCFA"
 */
export function formatXAF(amount: number): string {
  return (
    new Intl.NumberFormat("fr-FR", {
      style: "decimal",
      maximumFractionDigits: 0,
    }).format(amount) + " FCFA"
  );
}

/**
 * Formate un montant en FCFA avec cas spécial pour 0.
 * Affiche "Gratuit" quand le montant est 0.
 */
export function formatXAFOrFree(amount: number): string {
  if (amount === 0) return "Gratuit";
  return formatXAF(amount);
}

/**
 * Formate une date en français.
 */
export function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString("fr-FR");
}
