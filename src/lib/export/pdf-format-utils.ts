/**
 * Formatters de nombres sûrs pour l'encodage WinAnsi (Sprint SU, story SU.11).
 *
 * Contexte (ERR-104, voir docs/knowledge/ERRORS-AND-FIXES.md) : sur Node 22 (ICU
 * actuel), `(1234).toLocaleString("fr-FR")` insère U+202F (narrow no-break space)
 * comme séparateur de milliers. Ce caractère est ABSENT de la table WinAnsi /
 * Windows-1252 utilisée par les polices standard de `@react-pdf/pdfkit` (AFMFont,
 * `Encoding: 'WinAnsiEncoding'`). Un template PDF `@react-pdf/renderer` qui
 * n'enregistre aucune police custom via `Font.register()` (Helvetica standard)
 * ne peut PAS rendre ce caractère : il retombe silencieusement sur `.notdef`
 * (glyphe manquant, largeur 0) — pas de crash, mais un séparateur de milliers
 * invisible ou mal rendu dans le PDF final. Bug visuel silencieux, indétectable
 * sans extraction de texte réelle du PDF.
 *
 * Règle : dans `src/lib/export/**`, ne JAMAIS utiliser `toLocaleString("fr-FR")`
 * (ni `Intl.NumberFormat("fr-FR")`) pour formater un nombre destiné à un
 * `<Text>` react-pdf sans police custom enregistrée. Toujours utiliser les
 * helpers ci-dessous (séparateur de milliers = espace ASCII U+0020, séparateur
 * décimal = virgule ASCII U+002C — tous deux présents dans WinAnsi).
 *
 * Les formatages de DATE en `fr-FR` (`toLocaleDateString`) ne sont PAS concernés
 * par ce piège : vérifié empiriquement sur cet environnement, ils ne produisent
 * que des espaces ASCII classiques (U+0020), jamais U+202F.
 */

/**
 * Formate un nombre entier avec un séparateur de milliers ASCII (espace simple).
 * Équivalent sûr de `Math.round(n).toLocaleString("fr-FR")`.
 */
export function formatNumPDF(n: number): string {
  const abs = Math.abs(Math.round(n));
  const formatted = abs.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return n < 0 && abs !== 0 ? "-" + formatted : formatted;
}

/**
 * Formate un nombre décimal avec un séparateur de milliers ASCII (espace simple)
 * et une virgule comme séparateur décimal, en tronquant à `maxFractionDigits`
 * décimales (sans zéros de fin superflus — même comportement que
 * `maximumFractionDigits` de `toLocaleString`).
 * Équivalent sûr de `n.toLocaleString("fr-FR", { maximumFractionDigits })`.
 */
export function formatDecimalPDF(n: number, maxFractionDigits = 1): string {
  const factor = 10 ** maxFractionDigits;
  const rounded = Math.round(Math.abs(n) * factor) / factor;
  const [intPart, decPart] = rounded.toString().split(".");
  const intFormatted = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  const result = decPart ? `${intFormatted},${decPart}` : intFormatted;
  return n < 0 && rounded !== 0 ? "-" + result : result;
}

/**
 * Caractères hors table WinAnsi/Windows-1252 fréquemment produits par
 * `toLocaleString`/`Intl.NumberFormat` en locale `fr-FR` (séparateurs de
 * milliers non-ASCII). Utilisé par le garde de non-régression
 * `pdf-winansi-format-guard.test.ts`.
 */
export const NON_WINANSI_SEPARATORS = [
  " ", // narrow no-break space — séparateur de milliers Intl fr-FR (Node 22 ICU)
  " ", // no-break space — séparateur de milliers Intl fr-FR (anciennes versions ICU)
  " ", // thin space
  " ", // figure space
];
