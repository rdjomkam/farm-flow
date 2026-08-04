# Rapport de test — Story PR2sex.2 (Sprint PR2-sexies)

**Rôle :** @tester, vérification adverse post-implémentation (le @developer a déclaré la story terminée).
**Date :** 2026-08-04
**Périmètre :** `calculerDetailConsommationMensuelle` (`src/lib/previsions/aliments.ts`), son intégration
dans `route-orchestration.ts` (`detailParVagueSacs`), la DTO/API/recette associées.

## Verdict : **PASS**, avec deux réserves documentées (pas des échecs) — voir §7 et §8.

---

## 1. Ce qui a été vérifié par lecture de code (pas seulement par les tests déclarés)

- `calculerDetailConsommationMensuelle` (`src/lib/previsions/aliments.ts:422-445`) : fonction pure,
  aucun import Prisma, aucun `process.env`, aucune horloge (`grep -n "^import"` → seulement
  `decimal-config` et un type local ; `grep -n "process\.env\|new Date(\|Date\.now"` → aucune occurrence).
  Signature conforme à la recommandation de la pré-analyse §recommandation point 1, à un détail près :
  `moisCycle` fait partie de l'input (`DetailConsommationCycleInput.moisCycle`) plutôt que la fonction
  ne retournant qu'un tableau — choix légitime, documenté dans le JSDoc, n'affaiblit rien.
- **Sum-then-round réellement appliqué à deux niveaux, pas un seul** : contrairement à ce que la
  formulation de la tâche laissait craindre, l'accumulation Σ **avant** round n'est pas seulement
  externalisée dans la fonction pure — elle est bien faite en `Decimal` dans l'accumulateur
  `sacsEffectifsCycleParAlimentMoisPosition` de `route-orchestration.ts:372,519-530` (`.plus(sacsEffectifsCycle)`
  sur une `Map<alimentId, Map<moisAbsolu, Map<positionCycle, Decimal>>>`), et le round n'est déclenché
  **qu'une seule fois par cellule** à la ligne 672 (`calculerDetailConsommationMensuelle` appelée sur la
  somme déjà faite). C'est la lecture correcte du code — la fonction pure ne protège donc pas seule
  l'invariant, l'accumulateur le respecte aussi. Restait néanmoins **aucun test** exerçant ce chemin avec
  une vraie coïncidence multi-vague avant cette vérification (comblé en §2).
- Un second niveau d'accumulation existe à la ligne 681-682
  (`detailParVagueSacsDuMois[positionCycle][tailleGranule] = (... ?? 0) + sacsConsommes`), qui **somme des
  valeurs déjà arrondies** entre plusieurs `alimentId` partageant la même `tailleGranule`. Ce n'est **pas**
  un bug sum-then-round au sens de la story : à ce niveau on somme deux *calibres différents mais de même
  granulométrie nominale* (cas non modélisé dans le jeu d'or ni dans le schéma actuel où une
  `AlimentPrevision` = un calibre unique par scénario) — signalé pour mémoire, pas comme un défaut, aucun
  test dédié ajouté (jugé hors du risque réel décrit par la pré-analyse, qui porte sur la coïncidence de
  *vagues*, pas de *calibres*).
- **Aucun `3` en dur** : `grep -n "moisCycle1\|moisCycle2\|moisCycle3\|dureeCycleMois"` dans
  `aliments.ts`/`route-orchestration.ts` (hors `__tests__`) ne retourne que des commentaires JSDoc
  expliquant explicitement pourquoi ce n'est PAS en dur. La boucle réelle utilise
  `vague.dureeCycleMoisFigee` partout (`route-orchestration.ts:436,448,492`).
- **Signatures gelées ADR-053 §12.4** (`calculerBesoinAlimentMensuel`, `appliquerPalierRemise`,
  `apportionnerCoutAlimentMensuel`, `calculerCoutAlimentVague`, `calculerCoutAlimentGranulometrieParMois`,
  `repartirSacsEntreArticles`) : lues intégralement, aucune touchée. La nouvelle fonction est ajoutée en
  fin de fichier, strictement additive.
- `previsions-mensuelles-tab.test.tsx` : **ce fichier, ainsi que le composant `.tsx` associé, sont
  entièrement non trackés par git** (`git status --short` → `??`, `git log --follow` → aucun commit).
  Impossible donc de produire un `git diff` contre une base pour confirmer que la seule modification est
  un ajout de champ fixture — le dépôt ne porte aucune version antérieure committée de ce fichier à ce
  jour. Lecture directe : une seule occurrence de `detailParVagueSacs` (`detailParVagueSacs: {},` ligne
  81, un objet vide ajouté au fixture de test), aucune assertion visible autour de cette ligne qui
  ressemble à un affaiblissement. Réserve documentée en §8, pas un blocage.

## 2. Trou de couverture comblé : l'accumulateur d'orchestration (point 1 de la mission)

**Constat avant intervention** : le test synthétique de `aliments.test.ts` ("PROTECTION sum-then-round")
protège uniquement `calculerDetailConsommationMensuelle` prise isolément — il ne passe jamais par
`route-orchestration.ts`. Le jeu d'or ne peut pas exercer la coïncidence multi-vague (19 vagues, 19 mois
d'empoissonnement distincts). Aucun test existant n'aurait détecté une régression qui round-arait par
vague *avant* d'alimenter l'accumulateur.

**Fait, sans DB** (`calculerProjectionScenario` est une fonction pure prenant un `ScenarioPourCalcul` déjà
en mémoire — aucune écriture SQL, conforme à la contrainte de lecture seule stricte) : nouveau fichier
`src/lib/previsions/__tests__/route-orchestration-detail-consommation.test.ts`, 5 tests :

1. Deux vagues stockées le **même mois calendaire** (3 sacs chacune, calibre unique) → `ROUND(Σ)=1`,
   prouvé différent de `Σ ROUND()=0` (mêmes valeurs numériques que le test synthétique de la fonction
   pure, pour rester comparable).
2. Trois vagues coïncidentes (au-delà du cas à deux termes) → confirme l'accumulation à N>2 termes.
3. Deux vagues stockées à des mois **différents** (cas nominal, non coïncident) → chaque mois isolé donne
   `ROUND(0.4998)=0`, contraste explicite avec le cas coïncident.
4. `dureeCycleMoisFigee = 4` → les 4 positions de cycle sont produites, aucune tronquée à 3 ; positions
   au-delà de 4 absentes (prouve la borne dynamique, pas une borne en dur).
5. `dureeCycleMoisFigee = 1` → une seule position produite, sans erreur, positions 2/3 absentes.

Tous passent (`npx vitest run src/lib/previsions/__tests__/route-orchestration-detail-consommation.test.ts`
→ 5/5). Ceci couvre exactement le trou identifié par la mission — pas de « c'est impossible sans DB », le
chemin était bien atteignable en mémoire.

## 3. ERR-155 — assertions valeur par valeur, et compte des séries triviales

Vérifié par lecture directe de `runSectionE` (`route-orchestration.recette.test.ts:347-385`, préexistant) :
chaque cellule `(positionCycle, tailleGranule, mois)` compare `resultat.mois[m].detailParVagueSacs[...]`
à `serieAttendue[m]` (valeur brute lue dans la fixture, jamais un `undefined` comparé à un `undefined` —
le `?? 0` ne s'applique qu'au côté moteur, jamais au côté fixture) — assertions non triviales.

**Compte réel des séries non nulles** (script Node exécuté directement sur les deux fixtures, hors
moteur) :

| Série | 2 mm | 3 mm | 4 mm |
|---|---|---|---|
| `moisCycle1` | 19/21 non nuls | 19/21 non nuls | **0/21 (série toute à zéro)** |
| `moisCycle2` | 19/21 non nuls | 19/21 non nuls | 19/21 non nuls |
| `moisCycle3` | **0/21 (toute à zéro)** | **0/21 (toute à zéro)** | 19/21 non nuls |

**Trois des neuf séries sont entièrement nulles sur les deux fixtures** (`moisCycle1.4mm`,
`moisCycle3.2mm`, `moisCycle3.3mm`) — leurs 21×2 = 42 assertions comparent `0 == 0`, ce qui ne prouve
presque rien sur la correction de l'arrondi pour ces cas précis (conforme au risque ERR-155, à dire
franchement plutôt que de compter ces tests comme une preuve). C'est une propriété du jeu de données réel
(le cycle démarre toujours en 2mm/3mm et finit en 4mm — aucune vague ne consomme de 4mm au 1er mois ni de
2/3mm au 3e mois dans ce plan), pas un défaut du moteur ni de la recette : les 6 autres séries (14/18
combinaisons position×granulométrie × 2 fixtures) sont bien discriminantes. Documenté maintenant
explicitement dans `route-orchestration.recette.test.ts` (JSDoc ajouté, §4 ci-dessous) — ce n'était pas
signalé avant cette vérification.

## 4. Cumuls de contrôle sur l'horizon (point 3 de la mission)

**Absents avant cette vérification** (`grep -n "1543\|867\|385\|3471\|4820\|7230"` dans le fichier de
recette → aucune occurrence). Ajoutés à `runSectionE` : pour chacune des 9 séries × 2 fixtures, une
assertion `Σ moteur == Σ jeu d'or == cumul de contrôle du README` :

| | 2 mm | 3 mm | 4 mm |
|---|---|---|---|
| 1er mois de cycle | 1 543 | 867 | 0 |
| 2e mois de cycle | 385 | 3 471 | 4 820 |
| 3e mois de cycle | 0 | 0 | 7 230 |

18 nouveaux tests (9 séries × 2 fixtures), tous verts. Différence exacte avec le total annoncé par le
@developer : 2282 (déclaré) + 18 (ajoutés ici) = **2300**, confirmé par l'exécution réelle (§9).

## 5. Cycle paramétrable (point 4 de la mission)

Voir §1 (aucun `3` en dur) et §2 (tests 4/5 avec `dureeCycleMoisFigee` = 4 et = 1, tous deux verts). Le
code ne suppose nulle part une durée de cycle fixe à 3 — vérifié à la fois par lecture et par test
d'exécution réelle.

## 6. Pureté (point 5)

Confirmée par lecture (§1). Aucun écart.

## 7. Cas limites (point 6)

- Liste de vagues vide, pourcentages ne sommant pas à 100, `moisCycle` absent des répartitions,
  `sommeSacsEffectifsCycle = 0` : déjà couverts par les tests existants du @developer
  (`aliments.test.ts:406-547`), relus et jugés corrects.
- `dureeCycleMois = 0` : **non testé, ni par le @developer ni par moi**. La fonction pure elle-même
  n'a pas de notion de `dureeCycleMois` (elle reçoit un `moisCycle` unique par appel) — c'est
  `route-orchestration.ts` qui boucle `for (let moisCycle = 1; moisCycle <= vague.dureeCycleMoisFigee; ...)`
  : avec `dureeCycleMoisFigee = 0`, la boucle ne s'exécute jamais (`1 <= 0` faux), donc `alimentsParMois`
  reste vide pour cette vague, sans erreur — comportement dégénéré mais non crashant, déductible de la
  lecture de la boucle, **non vérifié par un test dédié** dans cette vérification (limite explicite,
  n'entrait pas dans la liste des points prioritaires de la mission mais mentionné pour être honnête).
- **Valeurs négatives** : ajouté un test dédié à la fonction pure (`aliments.test.ts`, nouveau cas
  « CAS LIMITE : half-away-from-zero sur une somme négative ») : `sommeSacsEffectifsCycle = -5`, pct = 50 %
  → `-2.5` exactement à l'égalité → `Decimal.ROUND_HALF_UP` produit **-3**, jamais **-2**
  (`Math.round(-2.5)` natif JS vaut -2, vérifié dans le test lui-même comme contraste explicite). Ce cas
  n'est **pas atteignable en pratique par le chemin applicatif réel** (`sacsEffectifsCycle` provient
  toujours d'un `ceil()` sur un tonnage positif, jamais négatif) — testé au niveau de la fonction pure
  uniquement, car c'est elle qui expose le contrat, conforme à l'esprit de la mission (« teste au moins
  le cas négatif si la fonction peut y être exposée »).

## 8. Régression (point 7)

- Signatures gelées ADR-053 §12.4 : intactes (§1).
- `previsions-mensuelles-tab.test.tsx` : voir réserve §1 — fichier non tracké par git, aucun diff
  possible contre une base committée. Lecture manuelle ne révèle rien d'anormal (un seul champ fixture
  ajouté), mais ce n'est **pas une vérification aussi forte qu'un diff** — signalé honnêtement plutôt que
  présenté comme confirmé à 100 %.
- Aucun fichier de `__tests__/recette/` existant modifié hormis l'ajout strictement additif dans
  `runSectionE` (18 nouveaux `it(...)`, aucun `it` existant retiré ni changé).

## 9. Sorties réelles collées

### `npx vitest run src/lib/previsions/__tests__/recette`
```
✓ src/lib/previsions/__tests__/recette/plan-v12-corrige.recette.test.ts (461 tests)
✓ src/lib/previsions/__tests__/recette/annexe-b-corrigee.recette.test.ts (461 tests)
✓ src/lib/previsions/__tests__/recette/route-orchestration.recette.test.ts (1378 tests)

Test Files  3 passed (3)
     Tests  2300 passed (2300)
```
(2282 déclarés par le @developer + 18 assertions de cumul de contrôle ajoutées par cette vérification
= 2300, exact.)

### `npx vitest run` (suite complète)
Exécutée deux fois pour distinguer une régression réelle d'une instabilité liée à la charge (plusieurs
agents tournent en parallèle sur ce dépôt, cf. note de la pré-analyse sur le verrou `.next/lock`) :

- 1er passage : `4 failed | 279 passed | 5 skipped (287 fichiers)`, `10 failed | 8732 passed | 21 skipped | 26 todo (8789 tests)`.
- 2e passage : `3 failed | 279 passed | 5 skipped (287 fichiers)`, `4 failed | 8738 passed | 21 skipped | 26 todo (8789 tests)`.

**Nombre d'échecs différent d'un passage à l'autre → instabilité (flakiness), pas une régression stable.**
Tous les échecs des deux passages sont localisés dans des fichiers **hors du périmètre de cette story**
(`aliment-form-dialog.test.tsx`, `apport-form-dialog.test.tsx`, `journal-form-dialog.test.tsx`,
`poste-form-dialog.test.tsx`, `scenario-form-dialog.test.tsx`) — des tests `userEvent.type()` sensibles au
timing, dont les échecs montrent des chaînes de caractères mélangées (`"20E2X6C-E0L9--V0112"` au lieu de
`"EXCEL-V12"`), signature typique d'une contention CPU (plusieurs `next build`/`vitest` concurrents
d'autres agents sur la même machine), pas d'un bug logique. **Confirmation** : ces 5 fichiers, rejoués
seuls (`npx vitest run <les 5 fichiers>`), passent intégralement — 41/41 tests verts, aucune modification
de ma part sur ces fichiers ni sur quoi que ce soit qu'ils exercent.

Aucun test de `src/lib/previsions/` ni de `route-orchestration-detail-consommation.test.ts` n'a échoué
sur aucun des deux passages.

### `npm run build`
Exit code 0, build production terminé sans erreur (dernières lignes du log : liste des routes générées,
aucune erreur de compilation).

## 10. Liste de ce qui reste non couvert (à ne pas présenter comme couvert)

1. `dureeCycleMois = 0` au niveau de l'orchestration (comportement dégénéré déduit par lecture, non
   vérifié par un test dédié).
2. `previsions-mensuelles-tab.test.tsx` : vérifié par lecture seule, pas par diff (fichier non tracké,
   aucune base committée disponible).
3. Trois des neuf séries `detailParVagueSacs` (`moisCycle1.4mm`, `moisCycle3.2mm`, `moisCycle3.3mm`) sont
   structurellement toujours nulles dans les deux fixtures disponibles — aucun jeu de données actuel ne
   peut prouver empiriquement que l'arrondi de ces trois séries précises est correct sur un cas non nul ;
   seule la lecture de la formule (identique aux six autres séries, même fonction) donne confiance.
4. L'accumulation de second niveau (ligne 681-682 de `route-orchestration.ts`, somme de `sacsConsommes`
   déjà arrondis entre plusieurs `alimentId` de même `tailleGranule`) n'est couverte par aucun test dédié
   — jugée hors du risque réel de cette story (nécessiterait deux `AlimentPrevision` distinctes partageant
   la même `tailleGranule` dans un même scénario, cas non modélisé aujourd'hui), mais signalée pour
   traçabilité future.

## Fichiers modifiés/ajoutés par cette vérification

- `src/lib/previsions/__tests__/aliments.test.ts` — 1 test ajouté (half-away-from-zero négatif).
- `src/lib/previsions/__tests__/route-orchestration-detail-consommation.test.ts` — nouveau fichier, 5 tests
  (accumulateur multi-vague coïncidente, cycle paramétrable 1 et 4 mois).
- `src/lib/previsions/__tests__/recette/route-orchestration.recette.test.ts` — 18 tests ajoutés (cumuls
  de contrôle sur l'horizon des 9 séries × 2 fixtures), aucun test existant modifié ni retiré.
- Ce rapport.

Aucun fichier de `prisma/fixtures/previsions/` touché. Aucune écriture SQL. Aucun secret dans ce rapport.
