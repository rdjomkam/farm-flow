# Rapport story PR2non.3 — La recette au niveau de la route

**Sprint :** PR2-nonies — « La logistique doit entrer dans les dépenses »
**Story :** PR2non.3 (TEST — cœur du sprint)
**Auteur :** @tester
**Date :** 2026-08-04
**Réfs :** ADR-053 §7 (recette), rapport-story-PR2non.1 (audit), PR2non.2 (correctif), ERR-142

## Résumé

Une campagne de recette a été ajoutée pour comparer la sortie de `calculerProjectionScenario`
(la chaîne réelle, code de production, entrées de la fixture poussées jusqu'au bout) aux cumuls du
classeur — au grain mois par mois **et** au grain vague/budget, sur les deux scénarios du jeu d'or.
Le trou signalé par l'audit PR2non.1 (charges d'exploitation jamais mappées vers
`scenario.postes` dans le harnais de recette) a été comblé. Une preuve par falsification en deux
temps confirme que la campagne détecte réellement les deux défauts qu'elle prétend couvrir : 140
assertions tombent quand la logistique est retirée de la base de répartition, 141 quand le mappage
des charges d'exploitation est désactivé — dans les deux cas, largement au-dessus du seuil de ~10
demandé par la story.

## Fichiers modifiés / créés

- **Créé** : `/Users/ronald/project/dkfarm/farm-flow/src/lib/previsions/__tests__/recette/route-orchestration-baseRepartition.recette.test.ts`
  (209 tests — Section F : série mensuelle logistique/baseRepartition/dépenses ; Section G :
  cumuls de scénario + effet par vague/budget ; V1 quotePart/coutProduction).
- **Modifié** : `/Users/ronald/project/dkfarm/farm-flow/src/lib/previsions/__tests__/recette/route-orchestration-builder.ts`
  — mappage par défaut de `entreesModele.chargesExploitation` → `scenario.postes`
  (`buildPostesChargesExploitation`), `resultats.investissements` → `scenario.journal`
  (`buildJournalInvestissements`), `resultats.apportsCapital` → `scenario.apports`
  (`buildApportsCapital`). Trois flags `inclure{ChargesExploitation,Investissements,Apports}`
  ajoutés à `BuildScenarioOptions` (réservés à la preuve par falsification).
- **Modifié** : `/Users/ronald/project/dkfarm/farm-flow/src/lib/previsions/__tests__/recette/route-orchestration.recette.test.ts`
  — Section D : le test qui constatait que `apportsFCFA` dégénérait à 0 (JSDoc « LIMITE ASSUMEE »)
  a été remplacé par deux vraies comparaisons au jeu d'or (`apportsFCFA == resultats.apportsCapital`,
  `revenusFCFA + apportsFCFA == resultats.totalEntrees`), puisque le mappage des apports n'est plus
  systématiquement vide.
- **Non modifié** (production, vérifié intact après la falsification temporaire) :
  `/Users/ronald/project/dkfarm/farm-flow/src/lib/previsions/route-orchestration.ts` — aucune
  différence avec l'état livré par PR2non.2 (`git diff` vide sur ce fichier à la fin de la story).

## Tableau attendu vs mesuré

Toutes les valeurs mesurées proviennent de `calculerProjectionScenario` (code de production),
exécuté par les tests créés ci-dessus.

### Scénario A — plan-v12-corrige

| Indicateur | Attendu | Mesuré (route-orchestration.ts) | Écart |
|---|---|---|---|
| Tonnage vendu | 241 t | 241 t (`fixture.cumuls`, garde-fou anti-faute-de-frappe) | 0 |
| Chiffre d'affaires | 457 900 000 | 457 900 000 | 0 |
| Coût aliments | 277 369 600 | 277 369 600 (Σ `vagues[].coutAlimentFCFA`) | 0 |
| Coût alevins | 0 | 0 (Σ `vagues[].coutAlevinsFCFA`) | 0 |
| Charges d'exploitation | 20 580 000 | 20 580 000 (dérivé jeu d'or, garde-fou) | 0 |
| Logistique | 10 210 000 | 10 210 000 (Σ `mois[].logistique.sousTotalFCFA`) | 0 |
| Apports | 30 000 000 | 30 000 000 (Σ `mois[].apportsFCFA`, `budget.totalApportsFCFA`) | 0 |
| Investissements | 34 400 000 | 34 400 000 (Σ `mois[].investissementsFCFA`) | 0 |
| **Dépenses totales** | **342 559 600** | **342 559 600** (Σ `mois[].depensesFCFA`) | **0** |
| **Résultat cumulé** | **145 340 400** | **145 340 400** (Σ `mois[].resultatFCFA`) | **0** |
| **Trésorerie finale** | **145 340 400** | **145 340 400** (`mois[dernier].soldeFCFA`) | **0** |
| **Point bas** | **+2 276 600** | **+2 276 600** (`pointBas.pointBasFCFA`, mois 2026-08) | **0** |
| Besoin mensuel max aliments | 17 100 kg | 17 100 kg (max `mois[].besoinAlimentsTotalKg`) | 0 |
| budget.totalCoutsProductionFCFA / budgetTotalFCFA | 308 159 600 (dérivé : dépenses − investissements) | 308 159 600 | 0 |

### Scénario B — annexe-b-corrigee (sans apports ni investissements)

| Indicateur | Attendu | Mesuré | Écart |
|---|---|---|---|
| Dépenses totales | 308 159 600 | 308 159 600 | 0 |
| Résultat cumulé | 149 740 400 | 149 740 400 | 0 |
| Trésorerie finale | 149 740 400 | 149 740 400 | 0 |
| Point bas | −6 334 704, novembre 2026 (mois index `2026-11`) | −6 334 704, `pointBas.moisAbsolu` == index de `2026-11` | 0 |
| Charges d'exploitation / Logistique | 20 580 000 / 10 210 000 (identiques à A, confirmé) | identiques | 0 |
| budget.totalCoutsProductionFCFA / budgetTotalFCFA | 308 159 600 | 308 159 600 | 0 |

### Série mensuelle (21 mois × 2 scénarios) — la partie qui aurait attrapé le bug

`logistique.sousTotalFCFA`, `baseRepartitionFCFA`, `depensesFCFA` comparés mois par mois à
`logistique.sousTotal[m]`, `depenses.baseRepartition[m]`, `resultats.depensesTotales[m]` du jeu
d'or : **126 assertions** (21 mois × 3 champs × 2 scénarios), toutes à 0 écart, plus l'identité
`baseRepartitionFCFA == logistique.sousTotalFCFA + Σ chargesExploitation du mois` (21 × 2 = 42
assertions supplémentaires).

### Effet par vague — quote-part et coût de production

`quotePartChargesFCFA`/`coutProductionFCFA` **n'ont aucune colonne source dans le classeur**
(vérifié : recherche exhaustive dans `entreesModele.planVagues[]` des deux fixtures JSON — aucune
clé `quotePart*`/`coutProduction*`). Ce ne sont donc **pas** un jeu d'or au sens strict de
l'ADR-053 §7. Ces deux grandeurs sont couvertes de deux façons distinctes, documentées
explicitement comme telles dans le fichier de test :

1. **Constantes de la story**, ré-vérifiées indépendamment (script Python hors moteur, hors
   dépôt de test, détaillé ci-dessous) : V1 `quotePartChargesFCFA` == 1 961 666,67 FCFA,
   `coutProductionFCFA` == 6 825 666,67 FCFA — confirmées exactes par le calcul indépendant
   (`Σ baseRepartition[m]/nbVaguesActives[m]` sur les 3 mois de cycle de V1, calculé en Python à
   partir des seules séries `depenses.baseRepartition`/`entreesModele.planVagues`, sans jamais
   appeler ni réimplémenter `calculerQuotePartVague`). **Mesuré (production) : exactement
   1 961 666,67 et 6 825 666,67, écart 0.**
2. **Cohérence interne, explicitement nommée comme telle** : `Σ quotePartChargesFCFA (19 vagues)
   == Σ baseRepartitionFCFA (21 mois)` — vrai UNIQUEMENT parce qu'aucun des 21 mois de l'horizon
   n'a zéro vague active (vérifié indépendamment en Python : `active_count` minimal = 1 sur les
   21 mois) ; sans cette propriété du planning des 19 vagues, une fuite de répartition serait
   possible et cette identité ne prouverait rien. `budget.totalCoutsProductionFCFA` est ensuite
   dérivé de cette même somme (Σ coûts aliments + Σ coûts alevins + Σ base de répartition), donc
   comparé à la valeur golden dérivée (dépenses totales − investissements), pas à une
   réimplémentation.

## Falsification — trois étapes, chiffres réels

### Falsification #1 — retrait de la logistique (bug de production, PR2non.2 annulé)

1. **Retrait** : `route-orchestration.ts`, ligne ~733 — `calculerBaseRepartition([...chargesDuMois,
   { montantFCFA: logistiqueMois.sousTotalFCFA, ... }], journalDuMois)` remplacé temporairement par
   `calculerBaseRepartition([...chargesDuMois], journalDuMois)` (retour exact au comportement d'avant
   PR2non.2).
2. **Relance** (`npx vitest run src/lib/previsions/__tests__/recette`) :
   ```
   Test Files  1 failed | 3 passed (4)
   Tests       140 failed | 2569 passed (2709)
   ```
   Les **140 échecs sont TOUS localisés dans le nouveau fichier**
   (`route-orchestration-baseRepartition.recette.test.ts`) : Section F (`baseRepartitionFCFA`,
   `depensesFCFA` mois par mois — `logistique.sousTotalFCFA` lui-même ne bouge pas, cohérent : la
   logistique est toujours *calculée*, juste plus *injectée* dans la base), Section G (tous les
   cumuls qui dépendent de la logistique : dépenses totales, résultat, trésorerie finale, point
   bas, budget), et les deux assertions V1. **Zéro échec** dans
   `route-orchestration.recette.test.ts` (Sections A-E, y compris la Section C qui contient
   l'identité `resultatFCFA == revenus + apports − depenses`) — confirme exactement le diagnostic
   de l'audit PR2non.1 : ces sections restent aveugles au bug par construction (identité interne).
3. **Restauration** : `git diff --stat src/lib/previsions/route-orchestration.ts` après restauration
   → vide (fichier identique à l'état livré par PR2non.2). `npx vitest run` complet re-exécuté :
   **285 fichiers passés, 9228 tests passés, 0 échec.**

**Verdict : 140 assertions tombent, très au-dessus du seuil de ~10 demandé — la campagne détecte
le bug réel avec une marge large.**

### Falsification #2 — mapping des charges d'exploitation (gap signalé par l'audit)

1. **Retrait** : `route-orchestration-builder.ts` — `postes:
   (options.inclureChargesExploitation ?? true) ? buildPostesChargesExploitation(fixture) : []`
   temporairement forcé à `postes: []` (retour à l'état d'avant cette story : `scenario.postes`
   toujours vide, gap exact décrit par le rapport PR2non.1).
2. **Relance** :
   ```
   Test Files  1 failed | 3 passed (4)
   Tests       141 failed | 2568 passed (2709)
   ```
   Même localisation exclusive dans le nouveau fichier (une assertion de plus qu'en falsification
   #1 : le terme `chargesExploitation` de l'identité `baseRepartitionFCFA == logistique +
   Σ chargesExploitation` disparaît aussi, contrairement à la falsification #1 où seule la
   logistique manquait).
3. **Restauration** : le remplacement a été appliqué à l'identique (`postes:
   (options.inclureChargesExploitation ?? true) ? buildPostesChargesExploitation(fixture) : []`).
   `npx vitest run` complet re-exécuté après restauration : **285 fichiers passés, 9228 tests
   passés, 0 échec.** `npm run build` : OK.

**Verdict : 141 assertions tombent — le gap signalé par l'audit est désormais couvert et sa
disparition future serait détectée.**

## Compte d'assertions de la campagne de recette

| Fichier | Tests |
|---|---|
| `plan-v12-corrige.recette.test.ts` | 480 |
| `annexe-b-corrigee.recette.test.ts` | 480 |
| `route-orchestration.recette.test.ts` | 1540 |
| `route-orchestration-baseRepartition.recette.test.ts` (nouveau, cette story) | 209 |
| **Total `__tests__/recette/`** | **2709** |

Base attendue par la consigne : ≥ 2458, 0 écart. **Mesuré : 2709, 0 écart** (marge de +251 vs. la
base indiquée, dont 209 nouveaux tests créés par cette story et 42 tests supplémentaires générés
par la Section D étendue de `route-orchestration.recette.test.ts`, 21 mois × 2 nouvelles
assertions par mois × 2 scénarios).

## Sorties réelles — build et suite complète

### `npm run build`
Succès (Next.js production build complet, toutes les routes générées, aucune erreur TypeScript).

### `npx vitest run` (suite complète du dépôt)
```
Test Files  285 passed | 5 skipped (290)
     Tests  9228 passed | 21 skipped | 26 todo (9275)
  Start at  21:21:13
  Duration  13.50s
```
(9228 vs. 8977 avant cette story — +251, cohérent avec le compte d'assertions de recette
ci-dessus : +209 nouveau fichier, +42 Section D étendue, dont aucune régression sur les 8977 tests
préexistants.)

## Ce qui a été laissé de côté / limites explicites

- **`quotePartChargesFCFA`/`coutProductionFCFA` par vague** : pas de colonne golden dans le
  classeur (confirmé par recherche exhaustive) — couverts par des constantes de la story
  (ré-vérifiées indépendamment, en dehors du fichier de test, par un script Python jetable qui
  n'a jamais appelé ni réimplémenté `calculerQuotePartVague`) et par une identité de cohérence
  interne dont la validité dépend d'une propriété du planning des 19 vagues (aucun mois à zéro
  vague active) — explicitement documentée comme telle dans le JSDoc du test, comme demandé par
  la consigne.
- **`TypeApportCapital` du mappage `resultats.apportsCapital` → `ApportCapital`** : fixé à
  `CAPITAL` par défaut, faute de distinction capital/crédit dans la série agrégée du jeu d'or.
  Sans conséquence sur les grandeurs testées : `calculerProjectionScenario` ne filtre jamais par
  `TypeApportCapital` (vérifié dans le code de production).
- **Aucune ligne de `JournalDepensePrevue` de catégorie `OPERATIONNEL` avec `vaguePrevueId` non
  nul** n'a été ajoutée par cette story — ce cas (déjà signalé par `charges.ts` comme non exerçable
  par le seul jeu d'or, décision 6 de l'ADR) reste couvert uniquement par le test unitaire dédié
  de `charges.test.ts`, hors périmètre de cette story.
- **Aucun écart de production trouvé** au-delà de celui déjà corrigé par PR2non.2 et du gap déjà
  signalé par PR2non.1 (comblé ici dans le harnais). Le mapping des investissements/apports
  n'a révélé aucun autre bug d'orchestration — tous les cumuls du tableau A/B tombent à 0 écart
  dès la première exécution, sans itération de correction.
- **`Vague.code` (ADR-053 §8.2) et les points reportés en Phase 3** : hors périmètre, non
  touchés.

## Statut : TERMINÉ

Tests créés/étendus, exécutés (build OK, vitest 9228/9228), falsification en deux temps réalisée
et chiffrée, campagne restaurée à l'identique et re-vérifiée après chaque falsification. Aucun bug
de production supplémentaire trouvé — le correctif PR2non.2 et le mappage ajouté par cette story
suffisent à faire tomber les deux scénarios de la story à 0 écart, mois par mois et au cumul.
