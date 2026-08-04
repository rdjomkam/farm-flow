# Rapport de test — Story PR2bis.4 (TEST) — Recette de `calculerProjectionScenario`

**Sprint :** PR2-bis — Dettes du module Prévisions
**Agent :** @tester
**Date :** 2026-08-03

## Objectif de la story

Étendre `src/lib/previsions/__tests__/recette/` (jusqu'ici 880 tests / 0 écart, mais qui ne
couvrait que les fonctions du moteur pur prises isolément) pour comparer, pour la première fois,
la sortie de `calculerProjectionScenario` **elle-même** (`route-orchestration.ts`) au jeu d'or —
recommandation actée par ERR-142 après les 3 bugs Haute de PR2, tous localisés dans ce fichier.

## Fichiers créés

- `/Users/ronald/project/dkfarm/farm-flow/src/lib/previsions/__tests__/recette/route-orchestration-builder.ts`
  (192 lignes) — construit un `ScenarioPourCalcul` complet (forme exacte de sortie de
  `chargerScenarioPourMoteur`) directement depuis `entreesModele` d'une fixture, sans jamais
  toucher Prisma. Documente explicitement (JSDoc d'en-tête) le choix `paliersRemise: []` et sa
  justification (voir « Écart d'architecture découvert » ci-dessous).
- `/Users/ronald/project/dkfarm/farm-flow/src/lib/previsions/__tests__/recette/route-orchestration.recette.test.ts`
  (298 lignes) — 390 tests répartis en Section A (couverture `besoinTotalCycleKg`, 2 fixtures × 19
  vagues) et Section B (couverture des deux grains de `sacsSaisis`, scénario minimal contrôlé).

Aucun fichier de production modifié (`route-orchestration.ts` et le moteur restent intouchés,
conforme au périmètre de la story).

## Tests ajoutés — décompte et grandeurs couvertes

**390 tests ajoutés**, recette totale passée de **880 → 1270 tests, 0 écart**.

### Section A — `besoinTotalCycleKg` via `calculerProjectionScenario` (2 fixtures × 19 vagues)

Pour chaque vague des deux fixtures (`plan-v12-corrige.json`, `annexe-b-corrigee.json`) :
- `quantiteKg` sommé sur les 3 mois de cycle, par granulométrie (2mm/3mm/4mm) — comparé à
  `objectifTonnes × sacsParTonneStandard × poidsSacKg` (entrées littérales de la fixture),
  tolérance kg (1e-6).
- **`coutAlimentFCFA` (champ PUBLIC de `VagueProjectionResult`)** comparé à
  `Σ(sacsXmm × prixSacFCFA)` (entrées littérales `vague.sacs2mm/3mm/4mm` du jeu d'or), avec
  `paliersRemise: []` de sorte que la remise dégénère en 0 % — c'est le test le plus direct de
  `besoinTotalCycleKg` de bout en bout via la sortie publique de la fonction, tolérance ≤ 1 FCFA.
- `kgTotal` (3 granulométries), `biomasseKg` (= `objectifTonnes × 1000`), `alevinsACommanderNb`,
  `moisStockageAbsolu`/`moisRecolteAbsolu`.

### Section B — `sacsSaisis` aux deux grains (ERR-140)

Scénario minimal contrôlé (1 vague V1, 1 granulométrie 2mm, palier custom seuil 400 sacs / 10 %
remise), aucune des deux fixtures du jeu d'or ne modélisant de surcharge `sacsSaisis` (concept
absent du classeur Excel source) :
- **Grain 1 (affichage mensuel)** : avec une surcharge de 500 sacs sur le mois de cycle 1, le mois
  affiché vaut exactement 500 (pas le besoin brut ~26) ; les mois non surchargés restent au besoin
  brut du moteur.
- **Grain 2 (agrégat de cycle qui pilote la remise)** : la surcharge (500 + 7 + 0 = 507 sacs sur le
  cycle complet) fait franchir le seuil de 400 sacs — `coutAlimentFCFA` de la vague devient
  strictement inférieur au coût plein, et est vérifié exactement (tolérance ≤ 1 FCFA) contre un
  appel **direct** à `calculerCoutAlimentGranulometrieParMois` (le moteur réel, déjà recetté à 0
  écart) avec le même total de cycle — jamais une formule réimplémentée séparément.
- Cas de contrôle : sans surcharge, le seuil n'est jamais franchi (32 sacs de cycle, tolérance
  ≤ 1 FCFA au taux plein).

## Confirmation explicite demandée par la story

- **`besoinTotalCycleKg` couvert** : oui, via `quantiteKg` (kg, tolérance flottante) ET via
  `coutAlimentFCFA` (FCFA, tolérance ≤ 1) — sur les 19 vagues × 2 fixtures × 3 granulométries.
- **Les DEUX grains de `sacsSaisis` couverts** : oui, explicitement dans des tests séparés (Grain 1
  = affichage mensuel, Grain 2 = agrégat de cycle qui pilote la remise) — exactement la
  décomposition qu'un test à un seul grain aurait ratée (ERR-140).

## Écarts trouvés

**Aucun écart dans `route-orchestration.ts` lui-même** — tous les tests passent au premier essai
une fois la conception du test corrigée (voir section suivante). ERR-138/139/140 restent
correctement corrigés dans le code de production.

**Deux ajustements de conception de test, documentés ici pour éviter qu'un futur agent les
reproduise :**

1. **Somme des `sacs` mensuels ≠ `sacsCalculesCycle`** — piège de la même famille qu'ERR-128.
   Chaque ligne mensuelle de `alimentsParMois[].sacs` est ceilée **indépendamment** par
   `calculerBesoinAlimentMensuel` (un ceil par mois), alors que `vague.sacsXmm` du jeu d'or et le
   `sacsCalculesCycle` interne de `route-orchestration.ts` sont un ceil **unique sur le cycle
   complet**. Vérifié numériquement sur V1/2mm : 26 + 7 + 0 = 33 sacs (somme des ceils mensuels)
   contre 32 = ceil(480/15) (ceil du cycle complet) — écart de 1, systématique dès qu'un mois casse
   un total exact en fractions. Ce n'est **pas un bug** : les deux grandeurs sont légitimement
   différentes et toutes deux correctement calculées par le moteur pour leur usage respectif (le
   ceil par mois donne la quantité à acheter CE mois-là ; le ceil de cycle pilote la décision de
   remise). Mon premier jet de test comparait à tort la somme des ceils mensuels à `vague.sacsXmm`
   (le ceil de cycle) — corrigé en testant plutôt `coutAlimentFCFA` (qui dépend du ceil de cycle,
   jamais exposé directement par `VagueProjectionResult`).
2. **Choix du seuil de remise du scénario custom (Section B)** — le premier seuil choisi (400 sacs,
   surcharge de 350) ne faisait pas franchir le seuil (350 + 7 + 0 = 357 < 400), ce qui aurait
   rendu le test « Grain 2 » vide de sens (aucune différence observable). Corrigé en portant la
   surcharge à 500 (507 > 400).

## Écart d'architecture découvert (hors périmètre de correction, à faire trancher)

**`PalierRemise.seuilSacs` (ADR-053 §3.4) est UN SEUIL UNIQUE PAR SCÉNARIO, appliqué identiquement
à chaque granulométrie par `route-orchestration.ts`** (`paliers: scenario.paliersRemise`, même
tableau réutilisé pour les 3 granulométries, ligne ~353 de `route-orchestration.ts`). Le jeu d'or,
lui, décide sa remise sur le **tonnage de la vague** (`entreesModele.paliersRemise[].seuilTonnes`),
ce qui revient à un seuil **différent en nombre de sacs pour chaque granulométrie** (coefficients
8/18/50 dans les deux fixtures). Ce n'est structurellement **pas reproductible** avec un seul
`PalierRemise[]` par scénario tel que modélisé actuellement : un seuil unique en sacs ne peut pas
être simultanément équivalent à `seuilTonnes × 8`, `× 18` et `× 50`.

Déjà partiellement documenté comme « adaptation d'unité nécessaire, pas un bug » par
`docs/tests/rapport-story-PR1.4.md` section 4.2 — **mais ce rapport-là ne visait que le fichier de
recette du moteur pur** (`orchestration.ts`, qui met lui-même les seuils à l'échelle par
granulométrie avant d'appeler le moteur). `route-orchestration.ts`, lui, **ne fait pas** cette
mise à l'échelle — il ne le peut pas, puisque `scenario.paliersRemise` est un seul tableau
partagé, sans notion de granulométrie de référence. Conséquence concrète : pour un scénario de
production avec plusieurs granulométries à `sacsParTonneStandard` différents, la remise de volume
appliquée par granulométrie divergera de ce qu'un raisonnement en tonnage total attendrait pour au
moins une des granulométries (celle dont le coefficient diffère le plus de celui implicite au
seuil choisi).

**Ceci explique pourquoi la Section A de mes tests utilise `paliersRemise: []`** (aucune remise
jamais appliquée) plutôt que de rejouer les paliers réels de la fixture : reproduire exactement
`vague.coutAlimentsFCFA` du jeu d'or (qui suppose une remise cohérente entre les 3 granulométries)
via `calculerProjectionScenario` n'est pas possible sans fabriquer artificiellement un jeu de
seuils par granulométrie que le modèle de production ne supporte pas.

Je ne qualifie pas ceci de bug de sévérité Haute (aucune des deux fixtures du jeu d'or n'a vocation
à être rejouée telle quelle en production — c'est un modèle Excel de référence, pas un scénario
réel), mais c'est une divergence de modèle réelle entre l'ADR-053 §3.4 et le comportement du
classeur source, jamais signalée avant cette story. Je recommande au PM de faire trancher
explicitement : soit c'est acceptable (le business réel négocie ses remises par granulométrie, pas
par tonnage global — hypothèse plausible et différente de celle du classeur), soit `PalierRemise`
doit devenir scopé par `AlimentPrevision` (migration de schéma, hors périmètre TEST).

## Ce que je n'ai pas couvert, et pourquoi

- **`coutAlevinsFCFA` par vague contre le jeu d'or** : les deux fixtures ont `alevinsAchetes: "NON"`
  sur les 19 vagues (`coutAlevinsFCFA: 0` partout), alors que `calculerProjectionScenario` calcule
  **toujours** `alevinsACommanderNb × prixAlevinUnitaireFCFA` (aucune notion « auto-produit, donc
  gratuit » dans le schéma ADR-053 — recherche exhaustive faite, absente de `ParametresPrevision`
  et de `VaguePrevue`). Comparer directement donnerait un écart énorme et systématique (~770 000
  FCFA pour V1) qui ne serait pas un bug de `route-orchestration.ts` mais une hypothèse de scénario
  absente du modèle de production. Signalé ici plutôt que testé à tort comme un écart de calcul.
- **`revenuPrevuFCFA` par vague et `entrees.chiffreAffaires[mois]`** : aucun champ du jeu d'or ne
  donne un revenu par vague isolée (le classeur répartit la vente sur plusieurs mois via
  `partVendueFinMois2Pct`/`partVendueMois3Pct`, un mécanisme absent des 12 fonctions ADR-053 §4 —
  déjà documenté comme hors de portée par `orchestration.ts`, `buildChaineFinanciereCalendrier`).
  Comparer aurait exigé de fabriquer ce découpage moi-même, une réimplémentation de formule
  interdite par la règle sacrée du répertoire.
- **Séries mensuelles calendaires complètes de `calculerProjectionScenario`** (`mois[]`,
  trésorerie cumulée, point bas) : non couvertes par cette story faute de temps — l'agrégation
  multi-vague par mois calendaire (GAP 2 documenté en tête de `route-orchestration.ts`) et la
  chaîne financière complète restent uniquement testées via les fonctions du moteur pur isolément
  (fichiers existants `plan-v12-corrige.recette.test.ts`/`annexe-b-corrigee.recette.test.ts`), pas
  via `calculerProjectionScenario` elle-même. Recommandation : story de suivi dédiée si jugée
  prioritaire, sur le même patron que Section A/B de ce fichier.

## Sorties réelles des 3 commandes exigées

```
$ npx vitest run src/lib/previsions/__tests__/recette
 ✓ src/lib/previsions/__tests__/recette/plan-v12-corrige.recette.test.ts (440 tests) 9ms
 ✓ src/lib/previsions/__tests__/recette/annexe-b-corrigee.recette.test.ts (440 tests) 10ms
 ✓ src/lib/previsions/__tests__/recette/route-orchestration.recette.test.ts (390 tests) 11ms

 Test Files  3 passed (3)
      Tests  1270 passed (1270)
```

Avant cette story : 880 tests / 0 écart. Après : **1270 tests / 0 écart** (+ 390).

```
$ npx vitest run
 Test Files  261 passed | 4 skipped (265)
      Tests  7440 passed | 19 skipped | 26 todo (7485)
```

Avant cette story : 264 fichiers / ~7050 tests. Après : **265 fichiers / 7440 tests passants**
(+390, cohérent avec l'ajout d'un seul nouveau fichier de test), **0 échec**.

```
$ npm run build
```
Build production terminé sans erreur (toutes les routes générées, y compris
`/previsions/scenarios` et `/previsions/scenarios/[id]`) — `grep -i "error|fail"` sur la sortie
complète : aucune occurrence.

## Statut

Prêt pour review. Aucune modification de code de production. Recommandation actionnable
principale pour le PM : trancher l'écart d'architecture `PalierRemise` (scopé scénario vs scopé
granulométrie) avant qu'une future story ne s'appuie dessus pour une remise réelle multi-
granulométrie en production.
