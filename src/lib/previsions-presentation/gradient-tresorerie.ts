/**
 * src/lib/previsions-presentation/gradient-tresorerie.ts
 *
 * Extraction PURE (Sprint PR3-ter, story B.5) du calcul d'offset du
 * gradient SVG "zone sous zero coloree" deja implemente et deja teste dans
 * `src/components/previsions/tresorerie-chart.tsx` (Sprint PR2, story
 * PR2.4). Ce fichier ne change AUCUN comportement de ce composant existant
 * (meme formule, extraite telle quelle) — objectif : partager la formule
 * avec `tresorerie-trois-series-chart.tsx` (story B.5) sans dupliquer la
 * technique ("reutiliser, pas dupliquer" — instruction explicite du
 * sprint), tout en laissant `tresorerie-chart.tsx` strictement inchange
 * dans son rendu (consomme par `tableau-bord-tab.tsx`, ne doit jamais
 * regresser).
 *
 * Recharts n'a aucune fonctionnalite native de "couleur conditionnelle au
 * signe" pour une Area/Line continue — la technique retenue (deja
 * verifiee exhaustivement par la pre-analyse PR2.4, section 3.1) est un
 * gradient SVG `<linearGradient>` dont l'`offset` de bascule vert/rouge est
 * calcule depuis le min/max AFFICHE de la serie (jamais depuis un domaine
 * fixe arbitraire), complete par une `ReferenceLine y={0}`.
 */

/**
 * Calcule l'offset [0, 1] de bascule du gradient SVG "zone sous zero" a
 * partir du minimum et du maximum affiches d'une serie (le domaine doit
 * deja avoir ete force a inclure 0, cf. appelants : `Math.max(...valeurs,
 * 0)` / `Math.min(...valeurs, 0)`).
 *
 * - Serie entierement <= 0 (`maxSolde <= 0`) -> offset 0 (toute la zone est
 *   rouge, aucune division par zero meme si `maxSolde === minSolde === 0`).
 * - Serie entierement >= 0 (`minSolde >= 0`) -> offset 1 (aucune zone
 *   rouge).
 * - Serie mixte -> `maxSolde / (maxSolde - minSolde)`, toujours fini
 *   (denominateur non nul par construction : `maxSolde > 0` et
 *   `minSolde < 0` dans cette branche).
 *
 * @example calculerOffsetGradientSousZero(2_000_000, -1_000_000) => 0.6666...
 * @example calculerOffsetGradientSousZero(0, 0) => 0 (serie plate a zero, jamais NaN)
 */
export function calculerOffsetGradientSousZero(maxSolde: number, minSolde: number): number {
  if (maxSolde <= 0) return 0;
  if (minSolde >= 0) return 1;
  return maxSolde / (maxSolde - minSolde);
}
