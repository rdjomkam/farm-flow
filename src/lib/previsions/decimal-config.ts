/**
 * Configuration centrale de decimal.js pour le moteur de calcul pur du
 * module Prevision (ADR-053 section 4 et section 7 "Statut de la
 * dependance").
 *
 * Premier import direct de `decimal.js` dans le depot (jusqu'ici presente
 * uniquement comme dependance transitive de Prisma) — voir story PR1.0 qui
 * l'a ajoutee explicitement a `dependencies` de `package.json`, version
 * epinglee `10.6.0`.
 *
 * Choix de configuration, justifies :
 * - `precision: 20` — les cascades de calcul du moteur (sacs -> kg -> cout
 *   -> base de repartition -> quote-part -> tresorerie cumulee sur 21 mois,
 *   ADR-053 section 7) accumulent de nombreuses operations successives.
 *   20 chiffres significatifs absorbe tres largement cette accumulation
 *   tout en restant loin au-dela de la tolerance de recette (<= 1 FCFA sur
 *   les montants, 0 sur les entiers).
 * - `rounding: Decimal.ROUND_HALF_UP` — arrondi "classique" (0.5 arrondit
 *   au-dessus), coherent avec le comportement d'Excel (`ROUND`) utilise par
 *   le classeur de reference (`Previsions_Elevage_Silure_v12.xlsx`). Ce
 *   mode par defaut ne s'applique qu'aux operations Decimal qui ne
 *   precisent pas explicitement leur propre arrondi : les sorties qui
 *   doivent etre des entiers stricts (sacs, voyages) utilisent
 *   systematiquement `.ceil()` explicitement dans le code du moteur
 *   (ADR-053 section 4, "Typage numerique"), jamais ce rounding par
 *   defaut — et les effectifs de poissons utilisent `.round()`
 *   explicitement (jamais ce defaut non plus, pour rester lisible a la
 *   relecture).
 *
 * Ce module doit etre importe (au moins transitivement, via n'importe quel
 * fichier de `src/lib/previsions/`) avant toute operation Decimal du
 * module Previsions, pour garantir que cette configuration globale de
 * `decimal.js` est appliquee une seule fois, de facon deterministe, avant
 * le premier calcul.
 *
 * IMPORTANT (ADR-053 section 4) : n'utiliser JAMAIS les operateurs natifs
 * JS (`+`, `-`, `*`, `/`, `<`, `>`, `===`) sur des `Decimal` — toujours les
 * methodes dediees (`.plus()`, `.minus()`, `.times()`, `.dividedBy()`,
 * `.equals()`/`.eq()`, `.lessThan()`/`.lt()`, `.greaterThan()`/`.gt()`,
 * etc.).
 */
import Decimal from "decimal.js";

Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

export { Decimal };
