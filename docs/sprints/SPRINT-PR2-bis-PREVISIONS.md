# Sprint PR2-bis — Dettes du module Prévisions à solder avant PR3

**Statut** : TERMINÉ
**Commit** : aucun commit ni push par les agents — l'utilisateur commite lui-même
**Référence** : [ADR-053 — Module Prévisions](../decisions/ADR-053-module-previsions.md) (dont §11), `docs/reviews/review-sprint-PR2.md`, ERR-135 à ERR-142

## Contrainte transverse — le moteur

Le moteur `src/lib/previsions/` reste sous recette contre le jeu d'or : **≥ 842 tests / 0 écart** après toute modification. La story PR2bis.3 modifie légitimement le moteur et doit FAIRE AUGMENTER ce nombre (une série passe d'entrée à sortie vérifiée).

## Point de process (réserve 2 de la review PR2)

`docs/sprints/*.md` et `docs/TASKS.md` sont écrits **exclusivement** par le `@status-updater`, spawné par le `@project-manager`. En PR2, quatre agents développeurs ont écrit directement dans le fichier de sprint. C'est interdit pour PR2-bis : tout agent qui a quelque chose à consigner le rapporte au PM, qui spawne le `@status-updater`.

## Hors périmètre (= PR3)

Rapprochement prévu/réel, vues de comparaison, reprévision glissante, exports.

## Stories

| Story | Type | Sujet | Pipeline | Statut |
|-------|------|-------|----------|--------|
| PR2bis.1 | UI | Internationaliser le module Prévisions (30 fichiers sur 34 en dur, sans accents) | @pre-analyst → @developer → @tester → @code-reviewer | FAIT |
| PR2bis.2 | UI | Câbler `genererPlanEmpoissonnement` dans l'écran Plan des vagues | @pre-analyst → @developer → @tester → @code-reviewer | FAIT |
| PR2bis.3 | BUGFIX | Rendre `margeSecuriteAlevinsPct` effective (écart à la spec §4.3 / ADR décision 4) | @pre-analyst → @developer → @tester → @code-reviewer → @knowledge-keeper | FAIT |
| PR2bis.4 | TEST | Étendre la recette à `calculerProjectionScenario` (orchestration) | @tester (+ @developer si écart) | FAIT |
| PR2bis.5 | REVIEW | Review de sprint → `docs/reviews/review-sprint-PR2-bis.md` | @code-reviewer → @knowledge-keeper | FAIT |

**Légende** : `TODO` · `EN COURS` · `REVIEW` · `FAIT` · `BLOQUÉ`

---

### PR2bis.1 — Internationaliser le module Prévisions

**Type** : UI
**Pipeline** : @pre-analyst → @developer → @tester → @code-reviewer
**Statut** : FAIT

**Contexte** : sur un même écran la navigation affiche « Forecasts / Expenses / Invoices » (locale EN) pendant que le contenu affiche « Scenarios de prevision », « Nouveau scenario », « Duree du cycle » — français en dur ET sans accents. 4 fichiers sur 34 seulement utilisent `next-intl`. Tous les autres modules du dépôt sont internationalisés ; Prévisions est l'exception. Décision prise unilatéralement par un agent en PR2.3, reprise en PR2.4, jugée disproportionnée par les deux reviewers.

**Exigences** : appliquer le patron `next-intl` déjà utilisé par les autres modules ; traductions **complètes en fr et en en**, avec les **accents français corrects** ; le test de complétude fr/en (égalité stricte des clés) doit couvrir les nouvelles clés ; traiter au passage, si sans surcoût, `modules.adminCommissions` / `modules.adminRemises` référencées par `getModuleNavKey()` et absentes des deux fichiers de traduction.

**Critères d'acceptation** :
- [ ] Plus aucune chaîne visible en dur dans les fichiers du module Prévisions
- [ ] fr et en complets, parité stricte des clés, accents français corrects
- [ ] Test de complétude i18n vert et couvrant les nouvelles clés
- [ ] `npm run build` OK, `npx vitest run` sans régression

**Note de clôture** : pipeline complet — @pre-analyst (GO AVEC RÉSERVES) → @developer → @tester (PASS) → @code-reviewer (VALIDÉ).

- Constat d'origine rectifié : **0 fichier sur 25** utilisait `next-intl`, et non « 4 sur 34 » comme l'annonçait la review PR2 — les 4 fichiers citant `next-intl` étaient des tests le mockant de façon vestigiale.
- Livré : `src/messages/fr/previsions.json` et `en/previsions.json`, **299 clés chacun, parité stricte**, ~200 chaînes extraites sur 25 fichiers, 21 fichiers de test mis à jour.
- **L'obstacle réel n'était pas celui invoqué en PR2.3** : il n'y avait pas un registre de namespaces mais **trois** — `src/messages/index.ts`, `src/__tests__/integration/i18n-completeness.test.ts`, et surtout `src/i18n/request.ts` (`loadMessages`), point de chargement réel au runtime, porteur d'une liste dupliquée **déjà désynchronisée** de 3 entrées et qu'aucun test ne rapprochait. Un namespace absent de ce troisième registre rend `useTranslations()` silencieusement vide sans qu'aucun test ne le détecte. Un 4e figeage a été trouvé en chemin dans `src/__tests__/i18n/messages.test.ts`.
- **Garde-fou ajouté** sur la synchronisation `messages/index.ts` ↔ `i18n/request.ts`, et **prouvé efficace** par le @tester : retrait volontaire de `previsions`, échec constaté, restauration, retour au vert.
- Français désormais correctement accentué, anglais réel (0 résidu français), 0 chaîne visible restée en dur (placeholders, `aria-label`, `title`, template literals et `toast` vérifiés).
- Rapports : `docs/analysis/pre-analysis-story-PR2bis.1.md`, `docs/tests/rapport-story-PR2bis.1.md`.

---

### PR2bis.2 — Câbler `genererPlanEmpoissonnement`

**Type** : UI
**Pipeline** : @pre-analyst → @developer → @tester → @code-reviewer
**Statut** : FAIT

**Contexte** : la fonction existe dans le moteur mais n'est câblée nulle part. Seule la création vague par vague est livrée : planifier 19 vagues impose 19 ouvertures de dialogue — exactement le cas d'usage qui justifie le module (ADR §1).

**Exigences** : branche « générer un plan » sur l'écran Plan des vagues ; l'utilisateur saisit les paramètres de génération et obtient les vagues prévues d'un coup ; le cas « des vagues prévues existent déjà » doit être **explicite avant d'agir** (ajout ou remplacement), jamais d'écrasement silencieux ; textes i18n (fr+en) conformément à PR2bis.1.

**Critères d'acceptation** :
- [ ] Génération d'un plan complet accessible depuis l'écran Plan des vagues
- [ ] Comportement en présence de vagues prévues existantes annoncé clairement à l'utilisateur avant action
- [ ] Aucun écrasement silencieux
- [ ] Textes i18n fr+en
- [ ] Tests verts, build OK

**Note de clôture** : pipeline complet — @pre-analyst (GO AVEC RÉSERVES) → @developer → @tester (PASS) → @code-reviewer (VALIDÉ).

- Livré : `GET`/`POST /api/previsions/scenarios/[id]/vagues/generer` (`PREVISIONS_VOIR` / `PREVISIONS_GERER`), queries `apercuGenerationPlan` + `genererPlanVaguesPrevues` en transaction unique, composant `src/components/previsions/generer-plan-dialog.tsx` (dialogue 2 étapes : saisie → aperçu chiffré → confirmation), nouveaux props sur `plan-vagues-tab.tsx` et cascade dans `scenario-detail-client.tsx`.
- **Arbitrages tranchés par le PM** : seul `horizonMois` est saisi, tout le reste vient du scénario et de `ParametresPrevision` (zéro ressaisie) ; deux modes, défaut « ajouter à la suite » ; « remplacer » n'est structurellement qu'un remplacement **partiel** (annule les seules `VaguePrevue` `PLANIFIEE` non rattachées), avec **décompte chiffré affiché avant action** ; codes neufs jamais réutilisés, une `ANNULEE` occupant toujours son code.
- Garantie centrale de l'ADR décision 2 tenue et testée explicitement : **aucune `VaguePrevue` rattachée à une vague réelle ne peut être détruite par une régénération**. Aucun `deleteVaguePrevue` introduit.
- Aperçu et écriture partagent les mêmes fonctions de chargement et de calcul : la divergence entre le décompte annoncé et le résultat réel est **structurellement impossible**, pas seulement testée.
- Rapports : `docs/analysis/pre-analysis-story-PR2bis.2.md`, `docs/tests/rapport-story-PR2bis.2.md`.

---

### PR2bis.3 — Rendre `margeSecuriteAlevinsPct` effective

**Type** : BUGFIX
**Pipeline** : @pre-analyst → @developer → @tester → @code-reviewer → @knowledge-keeper
**Statut** : FAIT

**Contexte** : champ saisi, validé, affiché — jamais lu par le moteur. Le §4.3 des exigences spécifie la formule `nb_alevins_a_commander = ceil(nb_poissons × (1 + marge_securite))`, et la décision 4 de l'ADR-053 acte que la mortalité est absorbée par cette marge. Un champ inerte est un écart à la spécification, pas une fonctionnalité reportée. Capitalisé en ERR-141.

Vérifiable contre le jeu d'or : le classeur porte `Empoissonnement!D` (poissons à vendre) et `Empoissonnement!E = ROUNDUP(D×(1+marge))` (alevins à commander) ; les fixtures les exposent dans `entreesModele.planVagues[]` (`poissonsAVendreNb`, `alevinsACommanderNb`). Aujourd'hui `alevinsACommanderNb` est lu comme une **entrée** ; il doit devenir une **valeur calculée** comparée au jeu d'or sur les 19 vagues, **tolérance zéro** (entier).

**Exigences** : le texte d'aide de l'UI signalant que le champ est inerte est retiré **une fois le champ effectif, et pas avant** ; la recette reste ≥ 842 / 0 écart et doit **augmenter**.

**Critères d'acceptation** :
- [ ] Le moteur lit `margeSecuriteAlevinsPct` et calcule `alevinsACommanderNb = ceil(poissonsAVendreNb × (1 + marge))`
- [ ] `alevinsACommanderNb` comparé au jeu d'or sur les 19 vagues, tolérance 0
- [ ] Nombre de tests de recette en hausse, 0 écart
- [ ] Texte d'aide « champ inerte » retiré de l'UI
- [ ] ERR-141 mise à jour par le @knowledge-keeper

**Note de clôture** : pipeline complet — @pre-analyst (GO AVEC RÉSERVES) → @developer → @tester (PASS) → @code-reviewer (VALIDÉ) → @knowledge-keeper.

- Nouvelle fonction pure `calculerAlevinsACommander` dans `src/lib/previsions/plan.ts`, en `Decimal` strict.
- **Distinction D vs E**, structurante : D (`effectifAlevinsPrevu`, poissons à vendre) continue d'alimenter le besoin en aliment et le revenu ; E (`alevinsACommanderNb`) alimente désormais le coût des alevins **et** la logistique alevins. Les deux sites E ont été corrigés ensemble — n'en corriger qu'un aurait laissé le résidu invisible décrit par ERR-142.
- **Piège d'arrondi vérifié numériquement** : `Math.ceil(25000 * 1.1)` renvoie 27501 au lieu de 27500 en flottant binaire. L'implémentation passe par `Decimal.ceil()`.
- **Piège d'unité** : échelle 0..100 en base et dans le moteur, fraction (0.1) dans les fixtures du jeu d'or ; un seul site de conversion de chaque côté.
- `alevinsACommanderNb` est passé d'**entrée lue** à **valeur calculée**, comparée au jeu d'or sur les **19 vagues × 2 fixtures, tolérance zéro**. Recette **842 → 880, 0 écart**.
- Les 3 textes d'aide UI signalant l'inertie du champ ont été réécrits (et leurs 3 tests inversés), sans sur-promesse : la marge ne s'applique ni au besoin en aliment ni au revenu.
- Capitalisation : ERR-141 mise à jour. Rapport : `docs/tests/rapport-story-PR2bis.3.md`.
- **Écart de traçabilité à noter** : la pré-analyse de cette story a été produite mais son rapport `docs/analysis/pre-analysis-story-PR2bis.3.md` n'a pas été écrit sur disque — ses conclusions ont été transmises au @developer par le PM. Confirmé par le @tester.

---

### PR2bis.4 — Étendre la recette à l'orchestration

**Type** : TEST
**Pipeline** : @tester (+ @developer si écart)
**Statut** : FAIT

**Contexte** : les 3 bugs de sévérité Haute de PR2 étaient tous dans `route-orchestration.ts`, la seule couche non couverte par la recette. Deux se composaient (facteur ×8300 = (66,667/8) × 1000) : corriger le premier seul aurait laissé un résidu invisible. ERR-142 recommande explicitement d'étendre la recette à `calculerProjectionScenario`.

**Exigences** : un scénario complet construit depuis `entreesModele` des fixtures, passé à `calculerProjectionScenario`, sortie comparée au jeu d'or avec les mêmes tolérances (0 sur les entiers, ≤ 1 FCFA sur les montants). Couvrir au minimum `besoinTotalCycleKg` et l'application de `sacsSaisis`. Tout écart révélé est un vrai bug : à rapporter et faire corriger.

**Critères d'acceptation** :
- [ ] `calculerProjectionScenario` recettée contre le jeu d'or
- [ ] Tolérances : 0 sur les entiers, ≤ 1 FCFA sur les montants
- [ ] `besoinTotalCycleKg` et `sacsSaisis` couverts
- [ ] Écarts éventuels rapportés et corrigés

**Note de clôture** : @tester seul, aucun @developer requis (aucun écart trouvé).

- Livré : `src/lib/previsions/__tests__/recette/route-orchestration-builder.ts` et `route-orchestration.recette.test.ts`, **390 tests** appelant `calculerProjectionScenario` elle-même depuis `entreesModele` des fixtures.
- Couvre `besoinTotalCycleKg` **et les deux grains** de `sacsSaisis` (affichage mensuel et agrégat de cycle pilotant la remise) — les deux points de défaillance réels de PR2.
- Recette **880 → 1270, 0 écart**. **Aucun écart de code trouvé** : ERR-138/139/140 restent correctement corrigés ; la couche est désormais protégée contre la régression.
- Non-tautologie confirmée en review : la valeur attendue vient toujours du JSON du jeu d'or, jamais d'un recalcul dans le test.
- **Découverte signalée, non corrigée** : `PalierRemise.seuilSacs` est un seuil unique par scénario appliqué identiquement aux 3 granulométries, alors que le jeu d'or décide sa remise par tonnage réel (coefficients 8/18/50). Non reproductible avec le schéma actuel. Capitalisé en ERR-143, à trancher avant PR3.
- Non couvert faute de temps, recommandé en suivi : `coutAlevinsFCFA` par vague, `revenuPrevuFCFA` par vague, séries mensuelles calendaires complètes.
- Rapport : `docs/tests/rapport-story-PR2bis.4.md`.

---

### PR2bis.5 — Review de sprint

**Type** : REVIEW
**Pipeline** : @code-reviewer → @knowledge-keeper
**Statut** : FAIT

**Livrable** : `docs/reviews/review-sprint-PR2-bis.md`, verdict explicite, checklist R1-R11, confirmation de l'état de la recette.

**Note de clôture** : @code-reviewer → @knowledge-keeper. Rapport : `docs/reviews/review-sprint-PR2-bis.md`, verdict **VALIDÉ AVEC RÉSERVES**, aucune réserve Critique ni Haute. Capitalisation : ERR-134 corrigée (obsolète), ERR-141 et ERR-142 mises à jour, ERR-143 et ERR-144 créées.

---

## Vérification de fin de sprint

- [x] `npx prisma migrate deploy` — **164 migrations trouvées, aucune en attente**. Idempotence confirmée par un second rejeu, sortie identique.
- [x] `npx vitest run` — **267 fichiers (263 passés, 4 skipped), 7487 tests passés, 19 skipped, 26 todo, 0 échec**. Ligne de base avant le sprint : 264 fichiers / 7000 tests.
- [x] `npx vitest run src/lib/previsions/__tests__/recette` — **3 fichiers, 1270 tests, 0 écart** (842 → 880 par PR2bis.3 → 1270 par PR2bis.4). Exigence « ≥ 842 et 0 écart » largement tenue.
- [x] `npm run build` — **succès**, 169 pages générées, toutes les routes `/previsions/*` et `/api/previsions/*` présentes, dont `/api/previsions/scenarios/[id]/vagues/generer`.

---

## Réserves reportées à PR3

| # | Sévérité | Réserve | Bloquant avant PR3 ? |
|---|---|---|---|
| 1 | Moyenne | `PalierRemise.seuilSacs` scopé par scénario vs remise réelle par granulométrie (ERR-143) — options : assumer et documenter l'écart au classeur, ou scoper `PalierRemise` par `AlimentPrevision` (migration) | **Oui**, avant toute story PR3 touchant aux remises multi-granulométrie |
| 2 | Basse | 2-3 check-then-write résiduels (R4 strict) dans `previsions-vagues.ts` — non traités, hors périmètre | Non |
| 3 | Basse | Mapping HTTP par sous-chaîne de message, **aggravé d'une entrée** ce sprint — à typer en `ValidationError` avant la prochaine story touchant `validation.ts` | Non |
| 4 | Basse | Dette i18n résiduelle (ERR-144) : les listes de `src/i18n/request.ts` et `src/messages/index.ts` divergent toujours de 3 entrées ; le garde-fou vérifie l'inclusion, pas la convergence | Non |
| 5 | Basse | `module-nav-items.ts` toujours code mort | Non |
| 6 | Info | 1 seule entrée de navigation au lieu des 5 du §7.3 | Non |
| 7 | Cosmétique | 2 clés i18n mortes (`previsions.page.detailTitle`, `page.backToList`) | Non |
| 8 | Info | Doublons de numérotation préexistants dans `ERRORS-AND-FIXES.md` (ERR-001, ERR-101, ERR-103 apparaissent deux fois) | Non |
