# Sprint PR2-nonies — La logistique doit entrer dans les dépenses

**Statut du sprint : FAIT**

## Contexte
Le plan de référence du classeur a été saisi en entier dans l'application (scénario `EXCEL-V12`). Douze indicateurs de cumul ont été comparés : **neuf tombent exactement**, trois divergent, et ce ne sont qu'un seul défaut.

| Indicateur | Application | Classeur | Écart |
|---|---|---|---|
| Dépenses totales | 332 349 600 | 342 559 600 | −10 210 000 |
| Résultat cumulé | 155 550 400 | 145 340 400 | +10 210 000 |
| Point bas de trésorerie | +2 321 600 | +2 276 600 | +45 000 |

Diagnostic établi : la route `GET /api/previsions/scenarios/[id]/calculer` **calcule** la logistique et l'expose dans sa réponse (mois 0 : `sousTotalFCFA: 45000`) mais ne l'ajoute **ni à `baseRepartitionFCFA`, ni à `depensesFCFA`**. Mois 0 : `baseRepartitionFCFA: 980000` (charges d'exploitation seules) au lieu de 1 025 000 = 980 000 + 45 000. Cumulé : 10 210 000 FCFA de transport jamais décaissés ; l'écart de 45 000 sur le point bas est exactement le transport du premier mois.

Le moteur pur est juste (`calculerBaseRepartition` additionne bien la logistique reçue en argument, et la recette le vérifie). **Ce que personne ne testait, c'est que la route la lui passe effectivement** — signature exacte d'ERR-142, et doute méthodique signalé sans être tranché par PR2-octies.

## Stories

### PR2non.1 — Audit du helper de recette (type TEST) — @tester — Statut : FAIT
À faire EN PREMIER, avant tout correctif. Liste exhaustive des valeurs que `src/lib/previsions/__tests__/recette/orchestration.ts` et ses jumeaux lisent depuis la fixture au lieu de les faire produire par la chaîne réelle. Pour chacune : LÉGITIME (vraie entrée du modèle) ou COURT-CIRCUIT (masque un défaut d'orchestration). Conclusion attendue : le bug de la logistique est-il isolé ou en cache-t-il d'autres ?
Pipeline : @tester seul.

**Livrable : `docs/tests/rapport-story-PR2non.1.md`.**

**Conclusion de l'audit : le bug n'est PAS isolé.** `plan-v12-corrige.recette.test.ts` et `annexe-b-corrigee.recette.test.ts` **n'appellent jamais** `calculerProjectionScenario` : ils passent par une **recomposition de test** (`src/lib/previsions/__tests__/recette/orchestration.ts`) qui, elle, applique correctement la formule — la recette prouve donc la formule, jamais l'orchestration réelle. Le seul fichier qui exécute le code de production, `route-orchestration.recette.test.ts`, **ne contient aucune assertion** sur `.logistique`, `.baseRepartitionFCFA` ni `.depensesFCFA` contre le jeu d'or.

### PR2non.2 — Le correctif : la logistique entre dans la base de répartition (type QUERIES/moteur) — Statut : FAIT
`base_repartition = logistique + charges_exploitation + journal_op_general` (§5.5 des exigences). La logistique entre dans la base de répartition, donc elle est aussi **quote-partée sur les vagues** : vérifier l'effet sur le coût de production par vague, pas seulement le cumul mensuel.
Pipeline : @pre-analyst → @developer → @tester → @code-reviewer → @knowledge-keeper.

**Pré-analyse rendue — verdict `GO`.** Livrable : `docs/analysis/pre-analysis-sprint-PR2-nonies.md`.

**Correctif livré.** `src/lib/previsions/route-orchestration.ts` : boucle mensuelle réordonnée (la logistique est calculée **avant** la base de répartition) et `logistiqueMois.sousTotalFCFA` passé à `calculerBaseRepartition` comme entrée de son paramètre `chargesLogistiqueEtExploitation`. **Aucune fonction pure modifiée.** Valeurs de contrôle toutes exactes : mois 0 `baseRepartition` 980 000 → **1 025 000**, dépenses 1 678 400 → **1 723 400** ; cumuls dépenses **342 559 600**, résultat **145 340 400**, point bas **+2 276 600**, logistique **10 210 000**. Effet en aval sur la vague V1 : `quotePartChargesFCFA` 1 796 666,67 → **1 961 666,67** et `coutProductionFCFA` 6 660 666,67 → **6 825 666,67**.

### PR2non.3 — La recette au niveau de la route (type TEST) — cœur du sprint — Statut : FAIT
Campagne comparant la sortie de `calculerProjectionScenario` (chaîne réelle, entrées de la fixture, aucun court-circuit) aux cumuls du classeur :

| Indicateur | Attendu |
|---|---|
| Tonnage vendu | 241 t |
| Chiffre d'affaires | 457 900 000 |
| Coût aliments | 277 369 600 |
| Coût alevins | 0 |
| Charges d'exploitation | 20 580 000 |
| Logistique | 10 210 000 |
| Apports | 30 000 000 |
| Investissements | 34 400 000 |
| Dépenses totales | 342 559 600 |
| Résultat cumulé | 145 340 400 |
| Trésorerie finale | 145 340 400 |
| Point bas | +2 276 600 |
| Besoin mensuel max | 17 100 kg |

Variante annexe B (sans apports ni investissements) : dépenses 308 159 600, résultat 149 740 400, point bas −6 334 704 en novembre 2026.

**Preuve par falsification exigée** : retirer la logistique de la base de répartition, compter les assertions qui tombent, restaurer. Une campagne qui passerait sans avoir détecté l'absence de logistique n'aurait aucune valeur.
Pipeline : @tester (+ @developer si un écart révèle un autre bug).

**Campagne livrée.** Nouveau fichier `src/lib/previsions/__tests__/recette/route-orchestration-baseRepartition.recette.test.ts` (**209 tests**). `route-orchestration-builder.ts` mappe désormais `entreesModele.chargesExploitation` → `scenario.postes`, `resultats.investissements` → `scenario.journal` et `resultats.apportsCapital` → `scenario.apports` (auparavant tous vides). Scénarios A et B : **0 écart sur les 13 indicateurs**. **Preuve par falsification** : retirer la logistique de la base de répartition fait tomber **140 assertions**, désactiver le mapping des charges d'exploitation en fait tomber **141** ; correctif restauré à l'identique (`git diff` vide). Total **2 709 assertions de recette, 0 écart** (base exigée ≥ 2 458). Livrable : `docs/tests/rapport-story-PR2non.3.md`.

### PR2non.4 — Review de sprint (type REVIEW) — Statut : FAIT
Pipeline : @code-reviewer → @knowledge-keeper. Rapport dans `docs/reviews/review-sprint-PR2-nonies.md`.

**Review rendue — verdict `VALIDÉ AVEC RÉSERVES`** : 3 réserves, **toutes de priorité basse, aucune bloquante**. Rapport : `docs/reviews/review-sprint-PR2-nonies.md`.

**Capitalisation @knowledge-keeper :** **ERR-171** créée (**récidive directe d'ERR-142**) et **ERR-142** mise à jour pour pointer vers ERR-171.

**Correction documentaire appliquée :** `prisma/fixtures/previsions/README.md` — « 6 postes non nuls » → « **4 postes non nuls (sur 8 lignes, dont 4 à zéro)** ».

## Vérification de fin de sprint

Attendus :
- `npx vitest run` — **trois passages consécutifs, 0 échec** (base : 289 fichiers / 8977 tests)
- Recette **≥ 2 458 assertions et 0 écart**
- `npm run build`
- `npx prisma migrate deploy`
- Contrôle **lecture seule stricte** du scénario `EXCEL-V12`, avant et après : 19 vagues / 602 500 alevins, 3 calibres, 4 paliers (0/5/10/15 t → 0/2/4/6 %), 6 apports = 30 000 000, 5 lignes de journal = 34 400 000, 4 postes de charges × 21 mois = 20 580 000, et la ligne `ParametresPrevision` colonne par colonne.

### Résultats réels constatés

- **`npx vitest run` — 3 passages consécutifs strictement identiques** : **285 fichiers passés / 5 skipped (290)**, **9228 tests passés / 21 skipped / 26 todo (9275)**, **0 échec**, ~14-15 s. **Aucun test instable.**
- **Recette : 2 709 assertions, 0 écart** (exigé ≥ 2 458).
- **`npm run build`** : succès, aucune erreur.
- **`npx prisma migrate deploy`** : « No pending migrations to apply », **168 migrations déjà appliquées**. Ce sprint **n'introduit aucune migration**.
- **Contrôle lecture seule `EXCEL-V12`, AVANT et APRÈS : aucune différence.** 19 vagues / 602 500 alevins, 3 calibres, 4 paliers (0/5/10/15 t → 0/2/4/6 %), **7 lignes d'apports totalisant 30 000 000** (et non 6 lignes — **écart de forme sur la saisie, total exact, tranché comme non bloquant par la review**), 5 lignes de journal = 34 400 000, 4 postes × 21 mois = 20 580 000, `ParametresPrevision` **inchangée colonne par colonne**.
- **Chaîne réelle `calculerProjectionScenario` sur `EXCEL-V12` : 13/13 indicateurs à 0 écart** — dépenses **342 559 600**, résultat **145 340 400**, trésorerie finale **145 340 400**, point bas **+2 276 600** en **2026-08**, logistique **10 210 000**, charges d'exploitation **20 580 000**, aliments **277 369 600**, alevins **0**, tonnage **241 t**, CA **457 900 000**, apports **30 000 000**, investissements **34 400 000**, besoin mensuel max **17 100 kg**.

## Réserves ouvertes

1. **README des fixtures corrigé — fait.** `prisma/fixtures/previsions/README.md` : « 6 postes non nuls » → « 4 postes non nuls (sur 8 lignes, dont 4 à zéro) ».
2. **À faire confirmer par l'exploitant** : les deux libellés « **Vente Vague 26-03** » et « **Vente Vague 26-04** » rangés en **apports en capital**.
3. **Optionnel** : isoler/renommer les **3 drapeaux d'opt-out de falsification** du builder de recette.
4. **Hors périmètre** : `ParametresPrevision` **ne porte aucun champ de trésorerie d'ouverture** — `route-orchestration.ts` fige `new Decimal(0)`.
