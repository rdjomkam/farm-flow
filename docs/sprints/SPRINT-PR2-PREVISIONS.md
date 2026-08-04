# Sprint PR2 — Module Prévisions : API et interface (MVP)

**Statut** : TERMINÉ
**Commit** : à faire par l'utilisateur — **aucun commit ni push n'a été effectué par les agents sur ce sprint**, l'utilisateur commite lui-même
**Référence** : [ADR-053 — Module Prévisions](../decisions/ADR-053-module-previsions.md) (spécification complète et validée, non renégociable)

## Contrainte transverse — le moteur est intouchable

Le moteur de calcul pur `src/lib/previsions/` (livré et recetté en PR1) est **intouchable sauf nécessité prouvée**. Toute modification, même mineure, doit :
- laisser la recette contre le jeu d'or à **842 tests / 0 écart** (les deux scénarios, ligne à ligne sur les 21 mois, tolérance 0 sur les entiers et ≤ 1 FCFA sur les montants) ;
- être suivie d'une **revérification explicite de la recette par le @tester**, pas seulement d'un `npx vitest run` global qui la fait passer incidemment.

Un agent qui pense devoir toucher au moteur doit d'abord justifier la nécessité (gap avéré, pas confort) et le signaler avant de coder.

## Objectif

Livrer le MVP décrit en ADR-053 §12 : l'exploitant crée un scénario complet avec toutes ses dépendances (paramètres, granulométries, plan des vagues, charges, journal, apports en capital) et lit sa trésorerie projetée sur un tableau de bord.

## Périmètre

**DANS ce sprint** :
- Queries Prisma pour tous les modèles du module Prévisions
- Routes API CRUD + route de calcul de la projection
- Écrans de paramétrage, référentiel aliments/granulométries, plan des vagues prévues
- Saisie des charges mensuelles et du journal de dépenses, apports en capital
- Vue Prévisions mensuelle (tableau) et tableau de bord (indicateurs + courbe de trésorerie)
- Navigation et activation du module (gating par `SiteModule.PREVISIONS` + permission)

**HORS ce sprint** (sprint PR3, à ne pas commencer) :
- Rapprochement prévu/réel
- Les 5 vues de comparaison
- Reprévision glissante
- Scénarios comparés
- Exports

## Dettes ouvertes de PR1 à traiter au passage

| Réserve PR1 | Contenu | À traiter dans |
|---|---|---|
| Réserve 6 | Homonymie `sacsCalcules` : colonne DB `Int` (entière par construction) vs type en mémoire `AlimentParVagueCalcInput` de `src/lib/previsions/aliments.ts`, qui accepte une valeur fractionnaire comme proxy d'échelle pour le palier de remise. Non bloquant (une écriture Prisma fractionnaire échouerait bruyamment sur la colonne `Int`) mais à **documenter clairement, voire séparer en deux noms**, avant d'écrire les routes API. | **PR2.1**, avant PR2.2 |
| Réserve 5 | `getModuleNavKey()` dans `src/components/abonnements/plan-form-dialog.tsx` référence `modules.adminCommissions` et `modules.adminRemises`, absentes des deux fichiers de traduction. Dette préexistante, platform-only, jamais rendue à l'exécution. À corriger **si PR2.5 le permet sans déborder du périmètre**, sinon reporter. | **PR2.5**, best-effort |
| Réserve 4 | Décalage éditorial ADR-053 §8.3 (« 14 modèles ») vs section 3 (13 modèles qui fait foi). Cosmétique, non prioritaire. | Non traitée ce sprint |

## Stories

| Story | Type | Sujet | Pipeline | Statut |
|-------|------|-------|----------|--------|
| PR2.1 | QUERIES | Queries Prisma | @pre-analyst → @db-specialist → @tester → @code-reviewer → @knowledge-keeper | FAIT |
| PR2.2 | API | Routes API | @pre-analyst → @developer → @tester → @code-reviewer → @knowledge-keeper | FAIT |
| PR2.3 | UI | Écrans de paramétrage et plan des vagues | @pre-analyst → @developer → @tester → @code-reviewer | FAIT |
| PR2.4 | UI | Vue Prévisions mensuelle et tableau de bord | @pre-analyst → @developer → @tester → @code-reviewer | FAIT |
| PR2.5 | UI | Navigation et activation du module | @pre-analyst → @developer → @code-reviewer | FAIT |
| PR2.6 | REVIEW | Review de sprint | @code-reviewer → @knowledge-keeper | FAIT |

**Légende des statuts** : `TODO` (pas commencé) · `EN COURS` (travail en cours) · `REVIEW` (code terminé, en attente de review/recette) · `FAIT` (validé) · `BLOQUÉ` (dépendance ou problème)

---

### PR2.1 — Queries Prisma

**Type** : QUERIES
**Pipeline** : @pre-analyst → @db-specialist → @tester → @code-reviewer → @knowledge-keeper
**Statut** : FAIT

**Note de clôture** :
- Pipeline complet exécuté : @pre-analyst (GO) → @db-specialist → @tester (PASS) → @code-reviewer (VALIDÉ AVEC RÉSERVES) → @knowledge-keeper.
- 6 fichiers livrés : `src/lib/queries/previsions-scenarios.ts`, `src/lib/queries/previsions-aliments.ts`, `src/lib/queries/previsions-vagues.ts`, `src/lib/queries/previsions-charges.ts`, `src/lib/queries/previsions-scenario-loader.ts`, `src/lib/previsions/decimal-io.ts`.
- 84 tests ajoutés, dont 2 DB-gated.
- Bug de sévérité moyenne trouvé par le @tester : Prisma tronque silencieusement une valeur fractionnaire écrite dans une colonne `Int` (`3.7 → 3`), sans lever d'exception. Corrigé par une garde `assertEntierColonneInt` appliquée à toutes les colonnes `Int` du module.
- Les 4 findings de la review corrigés, dont un de sévérité Haute : la garde n'avait pas été répliquée dans `previsions-charges.ts`, où `@@unique([posteId, moisAbsolu])` rendait une troncature capable d'écraser silencieusement la charge du mauvais mois.
- Capitalisation : ERR-135, ERR-136, ERR-137.
- Recette du moteur intacte à 842/842.
- Rapports : `docs/analysis/pre-analysis-story-PR2.1.md`, `docs/tests/rapport-story-PR2.1.md`, `docs/reviews/review-story-PR2.1.md`.

**Exigences** :
- `src/lib/queries/previsions.ts` (ou découpage justifié par le pre-analyst si le fichier devient trop large — par exemple un fichier par groupe de modèles)
- Filtre `siteId` partout (R8) — aucune query sur les modèles Prévisions ne doit pouvoir traverser un site
- Opérations atomiques (R4) — `updateMany` avec conditions, pas de check-then-update
- Aucun N+1 — utiliser `include`/`select` groupés, pas de boucle de queries
- Traiter la **réserve 6** de PR1 en premier : documenter (voire séparer en deux noms) l'homonymie `sacsCalcules` entre la colonne DB `Int` et le type en mémoire `AlimentParVagueCalcInput` avant d'écrire la moindre query d'écriture dessus
- Piège Prisma 7 documenté dans ERRORS-AND-FIXES : `create()`/`update()` + `include` échouent avec les FK brutes (« Argument 'x' is missing ») — pattern imposé : `create({ data })` puis `findUniqueOrThrow({ where, include })` (idem pour `update`)
- Couvrir au minimum : `ScenarioPrevision`, `ParametresPrevision`, granulométries/aliments et leurs répartitions, `VaguePrevue` (+ auto-relation `vaguePrevueParentId`), postes de charges et `ChargeMensuelle`, journal de dépenses, apports en capital
- Réutiliser le patron `src/lib/queries/vagues.ts`

**Critères d'acceptation** :
- [ ] `siteId` filtré sur toutes les queries de lecture et d'écriture (R8)
- [ ] Toutes les mises à jour conditionnelles utilisent `updateMany` avec conditions, jamais de check-then-update (R4)
- [ ] Aucune query en boucle (N+1) détectée en review
- [ ] Réserve 6 (homonymie `sacsCalcules`) documentée ou résolue par renommage, avant toute query d'écriture sur le champ
- [ ] Pattern `create`/`update` + `findUniqueOrThrow` appliqué partout où une relation est incluse après écriture
- [ ] Tests des queries verts (`npx vitest run`)

---

### PR2.2 — Routes API

**Type** : API
**Pipeline** : @pre-analyst → @developer → @tester → @code-reviewer → @knowledge-keeper
**Statut** : FAIT

**Bugs détectés par le @tester — CORRIGÉS ET VÉRIFIÉS** :
- **Bug 1 (Haute)** — sémantique de `sacsParTonne` : en production le champ vaut `1000 / poidsSacKg` (pur ratio d'unité, conforme à l'ADR §3.5), alors que le moteur et le jeu d'or utilisent un `sacsParTonneStandard` valant 8/18/50 selon la granulométrie, qui est un coefficient de besoin en aliment par tonne de poisson produite. Les deux grandeurs sont distinctes et portaient le même nom. Gap de modèle confirmé par @architect : le coefficient n'était modélisé nulle part dans le schéma Prisma.
  - **Résolution** : amendement ADR-053 §11 — `sacsParTonne` scindé en `sacsParTonneUnitaire` (pur ratio d'unité de poids) et `sacsParTonneStandard Decimal?` nullable (coefficient de besoin en aliment par tonne de poisson). Migration `20260803150000_aliment_prevision_sacs_par_tonne_split`, écrite avec un vrai `RENAME COLUMN` — le `migrate diff` naïf proposait un `DROP`+`ADD` destructeur.
- **Bug 2 (Haute)** — `route-orchestration.ts` code en dur `sacsSaisisCycle: null` : les surcharges manuelles `AlimentParVaguePrevue.sacsSaisis` persistées ne sont jamais appliquées par la route de calcul, en contradiction littérale avec l'ADR §3.6 qui exige `COALESCE(sacsSaisis, sacsCalcules)` dans tous les calculs downstream.
  - **Résolution** : `route-orchestration.ts` lit désormais les surcharges persistées et applique `COALESCE(sacsSaisis, sacsCalcules)` aux **deux niveaux de grain** : l'affichage par mois et l'agrégat de cycle qui pilote la remise de volume.
- **Bug 3 (Haute)** — découvert par @architect en analysant le bug 1, non isolé par le rapport de test : erreur d'unité ×1000 supplémentaire dans `route-orchestration.ts`, où `tonnageCibleKg()` renvoie une biomasse en **kg** alors que la formule transposée attend un tonnage en **tonnes**. Les deux erreurs se composent : le facteur ×8300 démontré par le test vaut `(66,667 / 8) × 1000`. Un correctif traitant seulement le renommage aurait laissé un résidu ×1000 non détecté.
  - **Résolution** : division par 1000 ajoutée (kg → tonnes). Cas de contrôle revérifié indépendamment par le @tester : 5000 alevins à 800 g, `sacsParTonneStandard = 8`, `poidsSacKg = 15` → **480 kg**, contre 4 000 000 kg avant correction.
- **Complément** : `sacsParTonneStandard = null` provoque désormais un **rejet explicite mappé en 422**, jamais un défaut silencieux (anti-pattern `dashboard.ts:218`).

**Note de clôture** :
- Pipeline complet exécuté : @pre-analyst (GO) → @developer → @tester (PASS avec réserves) → 3 correctifs → @tester (revérification PASS) → @code-reviewer (**VALIDÉ**) → @knowledge-keeper.
- 22 routes livrées, validation par zod, 134 tests ajoutés.
- Aucun problème de sévérité Haute ou Critique en review.
- Capitalisation : ERR-138, ERR-139, ERR-140.
- Recette du moteur intacte à 842/842.
- Rapports : `docs/analysis/pre-analysis-story-PR2.2.md`, `docs/tests/rapport-story-PR2.2.md`, `docs/reviews/review-story-PR2.2.md`.

**Notes de cloture @developer (implementation)** :
- 22 routes API creees sous `src/app/api/previsions/` (liste exhaustive + permissions dans le rapport de session du @developer).
- Convention de validation retenue : **zod** (`src/lib/validation/previsions.schema.ts`), justifiee dans l'en-tete du fichier (volume de payloads du module, coherent avec les domaines recents du depot).
- Mapping HTTP des validations §8(a)(b) et de la garde `assertEntierColonneInt` : **statusMap par route** (`src/app/api/previsions/_shared.ts`, `PREVISIONS_STATUS_MAP`) — **le moteur n'a PAS ete touche**, la recette reste a 842/842.
- Flux de scission (§4 pre-analyse) : `POST /vagues-prevues/[id]/rattacher` intercepte specifiquement le P2002 sur `vaguePrevueId` et renvoie `{status:409, code:"VAGUE_PREVUE_DEJA_RATTACHEE", vaguePrevueId, message}`.
- Route de calcul (`GET /scenarios/[id]/calculer`) : orchestration ecrite dans un fichier NOUVEAU, `src/lib/previsions/route-orchestration.ts` (n'est PAS le moteur teste par la recette — enchaine les fonctions existantes, aucune modification du moteur). Permission **PREVISIONS_VOIR seule**, **aucune persistance** (decision explicite du sprint). Deux gaps de modele documentes explicitement en tete de ce fichier (composition `besoinTotalCycleKg`, calendrier mensuel de recolte/transport) — **non verifies contre le jeu d'or**, a couvrir par un test dedie si jugé prioritaire par le sprint suivant.
- Decisions tranchees explicitement (non couvertes littéralement par l'ADR §6) : creation scenario = GERER ; transitions archiver/activer = GERER ; `rattacherVaguePrevue` = PREVISIONS_GERER seule (pas combinee a une permission VAGUES_*, sur decision explicite du PM) ; upsert charges mensuelles = GERER ; referentiel PostePrevision = PARAMETRER.
- Aucune route `DELETE` sur `VaguePrevue` (structurellement impossible cote queries PR2.1) — `POST .../annuler` a la place.

**Exigences** :
- CRUD complet sur : scénarios, paramètres, aliments et répartitions, vagues prévues, postes et charges mensuelles, journal de dépenses, apports en capital
- Une route de calcul dédiée renvoyant la **projection complète de l'horizon** (appel au moteur `src/lib/previsions/`, aucune logique de calcul dupliquée dans la route)
- `requirePermission()` sur **chaque** route, avec la permission adaptée à l'opération :
  - `PREVISIONS_VOIR` en lecture
  - `PREVISIONS_GERER` en écriture (scénarios, vagues prévues, charges, journal, apports)
  - `PREVISIONS_PARAMETRER` pour les paramètres du scénario et le référentiel aliments/granulométries
  - `PREVISIONS_CLOTURER` pour la clôture d'un scénario
- `auth.activeSiteId` threadé dans chaque query appelée par chaque route — aucune route ne doit pouvoir agir sur un autre site
- Patron à suivre : `src/app/api/vagues/route.ts`
- Validations bloquantes du §8 de l'ADR à faire respecter **côté API**, pas seulement côté UI (l'UI peut les afficher en amont, l'API doit les faire respecter en dernier ressort) :
  - somme des pourcentages de répartition des granulométries = 100 % (rejet sinon)
  - seuils de remise strictement croissants (rejet si égalité ou inversion)
  - suppression d'une `VaguePrevue` rattachée à une vague réelle **interdite** — passer son statut à `ANNULEE` à la place, jamais de `DELETE`

**Critères d'acceptation** :
- [ ] CRUD complet sur les 7 groupes de modèles listés ci-dessus
- [ ] Route de calcul de la projection complète, appelant le moteur sans dupliquer sa logique
- [ ] `requirePermission()` présent sur chaque route avec la permission exacte prescrite (VOIR/GERER/PARAMETRER/CLOTURER)
- [ ] `auth.activeSiteId` threadé dans chaque appel de query, aucune fuite inter-site possible
- [ ] Rejet API si somme des pourcentages de répartition ≠ 100 %
- [ ] Rejet API si seuils de remise non strictement croissants
- [ ] Suppression d'une `VaguePrevue` rattachée à une vague réelle bloquée côté API ; passage à `ANNULEE` proposé à la place
- [ ] Tests API verts (`npx vitest run`)

---

### PR2.3 — Écrans de paramétrage et plan des vagues

**Type** : UI
**Pipeline** : @pre-analyst → @developer → @tester → @code-reviewer
**Statut** : FAIT

**Note de clôture** :
- Pipeline complet exécuté : @pre-analyst (GO) → @developer → @tester (PASS, 87 tests) → @code-reviewer (VALIDÉ AVEC RÉSERVES).
- Livré : 2 pages, ~20 composants dans `src/components/previsions/`, le composant transverse `ValeurCalculee` (explicabilité §7.4), les formatteurs dédiés `src/lib/previsions/format-previsions.ts`, et la dépendance `@radix-ui/react-popover`.
- Flux de scission implémenté et testé de bout en bout, y compris les 5 cas d'erreur qui ne doivent PAS le déclencher.
- Findings de review corrigés : le total mensuel de `charges-tab.tsx` et la somme de répartition d'`aliments-tab.tsx` échappaient à `ValeurCalculee` (exigence §7.4) ; `TypePostePrevision.FIXE`, valeur d'enum inexistante, dans un test.
- Rapports : `docs/analysis/pre-analysis-story-PR2.3.md`, `docs/tests/rapport-story-PR2.3.md`, `docs/reviews/review-story-PR2.3.md`.

**Exigences** :
- Mobile first 360px, Server Components par défaut, `"use client"` uniquement si nécessaire
- R5 : `DialogTrigger asChild` sur tous les boutons trigger de dialogue
- R6 : variables CSS du thème (`var(--primary)`, etc.), aucune couleur en dur
- Pas de tableau sur mobile : cartes empilées à la place
- Exigence d'ergonomie non négociable du §7.4 :
  - distinguer visuellement saisie et calcul — champ saisissable identifiable au premier regard (bordure, fond), valeur calculée non éditable et visuellement neutre
  - tout chiffre calculé est **explicable** : clic ou survol montrant d'où vient le nombre, en langage courant, avec ses valeurs sources (remplace la barre de formule d'Excel)
- Formats du §7.4, appliqués partout où un montant/pourcentage/tonnage est affiché :
  - séparateur de milliers systématique
  - aucune décimale sur les montants
  - zéros affichés « – »
  - négatifs en rouge
  - pourcentages à une décimale
  - tonnages à une décimale
- Le rattachement d'une vague réelle à une `VaguePrevue` se fait dans cet écran
- ADR décision 2 : relation 1↔1 avec unicité en base entre `Vague` et `VaguePrevue` — si l'utilisateur tente de rattacher une deuxième vague réelle à la même prévision, l'UI **doit** proposer de scinder la `VaguePrevue` (ex. V7 → V7a + V7b via `vaguePrevueParentId`). C'est une exigence, pas une option.

**Critères d'acceptation** :
- [ ] Écrans utilisables à 360px sans scroll horizontal, cartes empilées (aucun tableau brut sur mobile)
- [ ] Tous les boutons de dialogue utilisent `DialogTrigger asChild` (R5)
- [ ] Aucune couleur en dur, uniquement des variables CSS du thème (R6)
- [ ] Champs saisissables et valeurs calculées visuellement distincts sans ambiguïté
- [ ] Chaque valeur calculée est explicable au clic/survol avec ses valeurs sources en langage courant
- [ ] Formats respectés : milliers séparés, 0 décimale sur montants, zéro affiché « – », négatif en rouge, pourcentage à 1 décimale, tonnage à 1 décimale
- [ ] Rattachement vague réelle ↔ `VaguePrevue` fonctionnel
- [ ] Tentative de second rattachement propose la scission V7 → V7a + V7b via `vaguePrevueParentId`
- [ ] Tests UI verts (`npx vitest run`)

---

### PR2.4 — Vue Prévisions mensuelle et tableau de bord

**Type** : UI
**Pipeline** : @pre-analyst → @developer → @tester → @code-reviewer
**Statut** : FAIT

**Note de clôture** :
- Pipeline complet exécuté : @pre-analyst (GO) → @developer → @tester (PASS, 23 tests) → @code-reviewer (VALIDÉ AVEC RÉSERVES).
- Livré : tableau mensuel mois × indicateurs (desktop) avec navigation mois par mois en mobile, bandeau de 6 indicateurs dont la trésorerie projetée et le point bas avec son mois, et le graphique Recharts avec zone sous zéro colorée par gradient SVG à offset calculé plus `ReferenceLine y={0}`.
- Findings corrigés : le repli sur exception affichait les messages de l'état « données vides » et masquait la cause réelle — une bannière d'erreur distincte a été ajoutée ; et une explication affichée à l'utilisateur affirmait à tort que la marge de sécurité mortalité était appliquée au coût des alevins.
- Rapports : `docs/analysis/pre-analysis-story-PR2.4.md`, `docs/tests/rapport-story-PR2.4.md`, `docs/reviews/review-story-PR2.4.md`.

**Notes de clôture @developer (implémentation)** :
- Fichiers créés : `src/lib/previsions/tableau-de-bord-helpers.ts` (logique pure, testable sans DB — `calculerTresorerieActuelle`, `libelleMoisCalendaire`, réexporte `moisAbsoluDepuis` de `route-orchestration.ts` sans le modifier), `src/components/previsions/projection-types.ts` (DTOs de la projection, distincts d'`api-types.ts`), `src/components/previsions/tresorerie-chart.tsx` (graphique Recharts), `src/components/previsions/tableau-bord-tab.tsx` (bandeau de 6 indicateurs + graphique), `src/components/previsions/previsions-mensuelles-tab.tsx` (tableau mensuel desktop + navigation mois par mois mobile).
- Fichiers modifiés : `src/components/pages/previsions-scenario-detail-page.tsx` (charge `chargerScenarioPourMoteur` + `calculerProjectionScenario` en plus des queries PR2.1, convertit les `Decimal` en `number` à la frontière, capture toute exception du moteur/orchestration dans un repli "projection vide" plutôt que de laisser planter la page), `src/components/previsions/scenario-detail-client.tsx` (2 nouveaux onglets ajoutés au shell existant : "Tableau de bord" en premier onglet par défaut, "Prévisions").
- **Indicateurs du bandeau (6, priorité visuelle aux 2 premiers)** : (1) Trésorerie projetée au mois courant — libellé explicite ne laissant jamais croire à une donnée réelle constatée, gère les 2 cas hors horizon (avant/après) sans jamais planter ni inventer un chiffre ; (2) Point bas projeté + mois ; (3) Budget total du plan ; (4) Revenu total prévu sur l'horizon ; (5) Nombre de vagues actives (hors `ANNULEE`) ; (6) Biomasse totale prévue (tonnage).
- **Trésorerie actuelle** : tranchée conformément à la pré-analyse — solde projeté du mois calendaire courant (`moisAbsoluDepuis(dateDebutPlan, aujourd'hui)`) lu dans la série déjà renvoyée par le moteur, jamais une donnée réelle (aucune n'existe dans le schéma). Cas hors horizon (avant le début / après la fin du plan) : état textuel explicite, jamais un accès de série hors bornes.
- **Zone sous zéro du graphique** : gradient SVG `<linearGradient>` à `offset` calculé dynamiquement (`maxSolde / (maxSolde - minSolde)`), 2 paires de stops (vert `var(--success)` au-dessus, rouge `var(--danger)` en dessous), complété par une `ReferenceLine y={0}` — technique recommandée par la pré-analyse, aucune fonctionnalité native Recharts ne gérant une couleur conditionnelle au signe. Sous-composants Recharts chargés via `next/dynamic({ ssr: false })`, patron du dépôt (`dashboard/projections.tsx`, `finances-dashboard-client.tsx`).
- **`calculerProjectionScenario` peut lever une exception** (ex. `sacsParTonneStandard` non configuré) — la page capture ce cas et retombe sur une projection vide plutôt que de planter ; les onglets affichent alors leur état "aucune donnée" (jamais un chiffre inventé, cohérent avec ADR-053 §8.1).
- **i18n** : textes en français en dur, même choix assumé que PR2.3, pour ne pas casser le test de complétude i18n (36 namespaces figés) — dette assumée, pas traitée dans cette story.
- Le moteur (`src/lib/previsions/*.ts`) et `route-orchestration.ts` n'ont **subi aucune modification** — recette revérifiée à 842/842 après implémentation.
- Vérifications exécutées : `npm run build` (OK), `npx vitest run` (6959 tests passés / 19 skipped / 26 todo / 0 échec — 252 fichiers, 4 skipped sur 256 ; hausse par rapport à la ligne de base 6872 attribuable aux tests ajoutés en parallèle par PR2.3), `npx vitest run src/lib/previsions/__tests__/recette` (842/842).
- Hors périmètre, non traité (conforme au périmètre strict de la story) : navigation/gating du module (PR2.5), export, rapprochement prévu/réel, reprévision glissante (PR3).

**Pré-analyse faite** (`docs/analysis/pre-analysis-story-PR2.4.md`, verdict **GO AVEC RÉSERVES**) — deux points à traiter :
- La route de calcul ne renvoie ni `nom`, ni `dateDebutPlan`, ni `statut` du scénario : il faut donc composer avec le détail du scénario pour convertir `moisAbsolu` en date lisible.
- « Trésorerie actuelle » doit être lue comme le **solde projeté du mois courant**, aucun solde de trésorerie réel n'existant dans le schéma — gap du même type que `dashboard.ts:218`, signalé et non inventé.

**Exigences** :
- Vue Prévisions mensuelle : tableau mois × indicateurs — le grand tableau peut rester réservé au bureau (§7.4), une alternative mobile reste nécessaire (cartes empilées ou navigation mois par mois)
- Tableau de bord :
  - bandeau de 4 à 6 indicateurs, incluant obligatoirement la **trésorerie actuelle** et son **point bas projeté avec le mois où il survient** (indicateur le plus important du §7.2)
  - un graphique unique de trésorerie sur l'horizon, en Recharts, avec la zone sous zéro colorée « besoin de financement »
- Objectif §7.1 : un exploitant doit comprendre sa situation en moins de 10 secondes — priorité visuelle au point bas et à la courbe, pas au détail
- Mêmes règles de format que PR2.3 (§7.4) appliquées au tableau de bord

**Critères d'acceptation** :
- [ ] Tableau mois × indicateurs disponible (desktop), alternative mobile sans tableau brut
- [ ] Bandeau de 4 à 6 indicateurs incluant trésorerie actuelle + point bas projeté + mois du point bas
- [ ] Graphique de trésorerie Recharts sur tout l'horizon, zone sous zéro colorée distinctement
- [ ] Formats §7.4 respectés sur tout le tableau de bord
- [ ] Test manuel/automatisé de lisibilité en < 10 secondes documenté (au moins qualitativement) par le @tester
- [ ] Tests UI verts (`npx vitest run`)

---

### PR2.5 — Navigation et activation du module

**Type** : UI
**Pipeline** : @pre-analyst → @developer → @code-reviewer
**Statut** : FAIT

**Note de clôture** :
- Pipeline allégé exécuté : @pre-analyst (GO) → @developer → @code-reviewer (VALIDÉ AVEC RÉSERVES, aucun problème au-dessus de Basse).
- Rapport : `docs/reviews/review-story-PR2.5.md`.

**Notes de clôture @developer (implémentation)** :
- **Point dur tranché — `module-nav-items.ts` est du code mort.** Confirmé par grep exhaustif
  (repris de la pré-analyse) : `MODULE_NAV` n'est importé nulle part hors de lui-même et du test
  `sprint-nc-nav-cleanup.test.ts` (qui documente que ses anciens consommateurs, `sidebar.tsx` et
  `bottom-nav.tsx`, ont été supprimés par le Sprint NC sans migration de ce fichier). La navigation
  réellement rendue vit dans `src/components/layout/farm-sidebar.tsx` (`NAV_GROUPS`, desktop) et
  `src/components/layout/farm-bottom-nav.tsx` (`SHEET_GROUPS`, menu secondaire mobile) — ce sont ces
  deux fichiers qui ont été modifiés pour rendre l'entrée Prévisions visible. `module-nav-items.ts` a
  quand même reçu une entrée `MODULE_NAV["Prévisions"]`, **par cohérence documentaire uniquement**,
  avec un commentaire explicite indiquant qu'elle n'a aucun effet à l'exécution.
- **Point dur tranché — 5 entrées visées, 1 seule livrée.** Aucune des 5 routes du §7.3 (Tableau de
  bord, Plan des vagues, Prévisions, Dépenses, Paramètres) n'existe comme page autonome : PR2.3/PR2.4
  ont construit tout le contenu en **onglets** à l'intérieur de
  `/previsions/scenarios/[id]` (`scenario-detail-client.tsx`, hors périmètre de cette story — fichier
  dans `src/components/previsions/`, non touché), avec un état d'onglet géré en `useState` local, non
  adressable par URL/query param. Il n'existe donc **aucun** href réel pour "Tableau de bord" seul,
  "Plan des vagues" seul, etc. — pointer vers `/previsions`, `/previsions/plan`, `/previsions/depenses`
  ou `/previsions/parametres` produirait 5 liens morts (404), ce que le sprint interdit explicitement.
  **Décision** : une seule entrée de navigation "Prévisions", pointant vers
  `/previsions/scenarios` (la liste des scénarios — seule route qui existe réellement et ne dépend
  d'aucun ID). L'écart avec la liste à 5 entrées du §7.3 (elle-même déjà un écart assumé avec les 7
  entrées de l'ADR-053 §6) est donc total : ce sprint ne construit aucune des 5 destinations
  indépendamment. Conséquence directe : l'override `ITEM_VIEW_PERMISSIONS["/previsions/parametres"] =
  PREVISIONS_PARAMETRER` prescrit par le §6 de la pré-analyse ne peut pas être câblé — il n'y a pas de
  route `/previsions/parametres` à gater. L'onglet "Paramètres" à l'intérieur du détail de scénario
  gère déjà sa propre visibilité par permission (`ParametresTab`, PR2.3, hors périmètre de cette
  story).
- **Fichiers modifiés** :
  - `src/components/layout/farm-sidebar.tsx` — nouveau groupe `NAV_GROUPS` (1 item), gate
    `permissionRequired: Permission.PREVISIONS_VOIR` + `moduleRequired: SiteModule.PREVISIONS`.
  - `src/components/layout/farm-bottom-nav.tsx` — nouveau groupe `SHEET_GROUPS` symétrique (1 item),
    permission + module gate posés à la fois sur le groupe et sur l'item (patron déjà en place pour
    les autres groupes de ce fichier).
  - `src/lib/module-nav-items.ts` — entrée `MODULE_NAV["Prévisions"]` ajoutée par cohérence
    documentaire seule (voir ci-dessus), pas un critère d'acceptation.
  - `src/lib/site-modules-config.ts` — `SiteModule.PREVISIONS` ajouté à `SITE_MODULES_CONFIG`
    (10e entrée) : sans cette entrée, aucun site ne pouvait activer le module via
    `admin-site-modules-editor.tsx`/`backoffice-site-modules-editor.tsx`. Coût nul pour les sites
    existants (juste une entrée togglable de plus), et nécessaire pour toute recette end-to-end.
  - `src/messages/fr/navigation.json` / `src/messages/en/navigation.json` — nouvelle clé
    `items.previsions` (fr "Prévisions" / en "Forecasts", parité stricte respectée) pour l'unique
    item de nav livré ; `modules.previsions` existait déjà (PR1). Best-effort réserve 5 : ajout de
    `modules.adminCommissions` / `modules.adminRemises` (mêmes valeurs que `common.json`), qui
    comblent le gap confirmé de `getModuleNavKey()` — toujours structurellement inatteignable
    aujourd'hui (`COMMISSIONS`/`REMISES` absents de `SITE_MODULES_CONFIG`), mais la clé ne lèvera
    plus si ce chemin devient un jour atteignable.
  - `src/__tests__/lib/site-modules-config.test.ts` — comptes `9 → 10` mis à jour (assertions
    figées cassées par l'ajout légitime de `PREVISIONS`) + 3 tests ajoutés couvrant `PREVISIONS`
    dans `isModuleActive`/`SITE_TOGGLEABLE_MODULES`.
- **Non fait, documenté explicitement plutôt que découvert en review** :
  - Les 4 autres clés `items.previsions*` envisagées par la pré-analyse (Dashboard, Plan des vagues,
    Dépenses, Paramètres) n'ont **pas** été créées : elles n'auraient été rattachées à aucune route
    réelle, donc aucune valeur ajoutée face au risque de clés i18n mortes.
  - `MODULE_LABEL_TO_SITE_MODULE["Prévisions"]` n'a pas été ajouté : ce mapping n'est plus consulté
    par aucun code vivant (import mort dans `farm-bottom-nav.tsx`, jamais invoqué) — vérifié par
    grep, signalé pour un futur nettoyage, hors périmètre de cette story.
  - `ITEM_VIEW_PERMISSIONS` n'a reçu aucune nouvelle entrée : la seule route livrée
    (`/previsions/scenarios`) n'a besoin d'aucun override, son gate de groupe (`PREVISIONS_VOIR`)
    suffit déjà.
- **Vérifications** : `npm run build` (OK, toutes les routes compilent), `npx vitest run` (254
  fichiers passés / 4 skipped sur 258, **6985 tests passés / 19 skipped / 26 todo / 0 échec** — +3
  tests nets vs. la base 6982/19/26/0 fournie, correspondant aux 3 tests ajoutés dans
  `site-modules-config.test.ts`), `npx vitest run src/lib/previsions/__tests__/recette` (**842/842**,
  moteur non touché).

**Exigences** :
- Entrée dans `MODULE_NAV` (`src/lib/module-nav-items.ts`)
- Gating par `SiteModule.PREVISIONS` **et** par permission (`PREVISIONS_VOIR` au minimum pour voir l'entrée)
- La clé i18n `modules.previsions` existe déjà en `fr` et `en` (posée en PR1, réserve 2 levée) — les clés `navigation.items.*` propres au module restent à créer, avec traduction dans les deux langues
- Un test de complétude compare `fr` et `en` par égalité stricte des clés — il échouera si une langue manque une clé
- **Cinq entrées maximum** dans le module (§7.3) : Tableau de bord · Plan des vagues · Prévisions · Dépenses · Paramètres
- **Écart signalé** : cette liste à 5 entrées prévaut sur la liste à 7 entrées de l'ADR-053 §6, qui incluait notamment `rapprochement` (hors périmètre, PR3) — ne pas ajouter cette 6e/7e entrée dans ce sprint
- Best-effort sur la réserve 5 de PR1 (`getModuleNavKey()` référence `modules.adminCommissions`/`modules.adminRemises` absentes des traductions) — corriger seulement si cela n'élargit pas le périmètre de la story

**Critères d'acceptation** :
- [ ] Entrée Prévisions ajoutée à `MODULE_NAV`, gating par `SiteModule.PREVISIONS` + permission
- [ ] Exactement 5 sous-entrées : Tableau de bord, Plan des vagues, Prévisions, Dépenses, Paramètres — pas de `rapprochement`
- [ ] Clés `navigation.items.*` créées et traduites en `fr` et `en`
- [ ] Test de complétude fr/en passe
- [ ] Écart avec ADR-053 §6 (7 entrées vs 5) documenté explicitement dans les notes de clôture de la story
- [ ] Réserve 5 de PR1 traitée si possible sans déborder du périmètre, sinon explicitement reportée

---

### PR2.6 — Review de sprint

**Type** : REVIEW
**Pipeline** : @code-reviewer → @knowledge-keeper
**Statut** : FAIT

**Livrable** : `docs/reviews/review-sprint-PR2.md`

**Note de clôture** :
- Rapport produit : `docs/reviews/review-sprint-PR2.md`, verdict **VALIDÉ AVEC RÉSERVES** — aucune réserve de sévérité Critique ni Haute, aucune réserve bloquante.
- **Le MVP du §12 est confirmé livré** : le parcours utilisateur complet a été retracé étape par étape dans le code, sans rupture — chaque étape a un écran, chaque écran une route API, chaque route une query.
- Capitalisation : ERR-142 ajoutée dans `docs/knowledge/ERRORS-AND-FIXES.md`.

**Critères d'acceptation** :
- [ ] Checklist R1-R11 vérifiée pour chaque story touchant du code
- [ ] Confirmation explicite que le moteur `src/lib/previsions/` n'a pas régressé : recette à 842 tests / 0 écart revérifiée par le @tester
- [ ] `docs/reviews/review-sprint-PR2.md` produit avec verdict explicite
- [ ] Capitalisation dans `docs/knowledge/ERRORS-AND-FIXES.md` si des erreurs ont été rencontrées et corrigées

---

## Vérification de fin de sprint

État mesuré réel, exécuté en une seule passe finale, sans agent concurrent :

- [x] `npx prisma migrate deploy` — **164 migrations trouvées, aucune en attente**. Idempotence confirmée par un second rejeu : sortie identique.
- [x] `npx vitest run` — **264 fichiers (260 passés, 4 skipped), 7000 tests passés, 19 skipped, 26 todo, 0 échec**. Exécuté deux fois, chiffres strictement identiques. Ligne de base après PR1 : 239 fichiers, 6660 tests, 0 échec.
- [x] `npx vitest run src/lib/previsions/__tests__/recette` — **842 tests passés / 842, 0 écart**, exactement la valeur attendue. Le moteur est resté intouchable : contrainte centrale du sprint respectée.
- [x] `npm run build` — **succès**, toutes les routes générées, aucune erreur.
- [x] `npm run db:seed` — **succès**, aucune erreur SQL.
- [x] `npx tsc --noEmit` (vérification complémentaire) — **1419 erreurs**, dont environ 1186 de la forme `Cannot find name 'expect'/'it'/'describe'/'vi'` sur ~80 fichiers de test de tous les modules. **Problème d'infrastructure préexistant et transverse, sans rapport avec ce sprint** : `next build` ne type-vérifie pas les fichiers de test orphelins, non atteignables depuis le graphe des routes. Une seule erreur strictement dans le périmètre Prévisions a été trouvée et corrigée (valeur d'enum `CategorieProduit.MEDICAMENT` inexistante dans un fichier de test) ; une autre reste ouverte — voir réserves.

## Réserves

- **ADR-053 amendé** — une section 11 a été ajoutée à `docs/decisions/ADR-053-module-previsions.md` par @architect, actant le gap de modèle et l'arbitrage : `AlimentPrevision.sacsParTonne` renommé `sacsParTonneUnitaire`, et nouveau champ `AlimentPrevision.sacsParTonneStandard Decimal?` nullable (aucune source de dérivation automatique n'existe dans `Produit`, donc pas de NOT NULL avec une valeur inventée ; `null` = non configuré, et tout calcul qui en dépend doit rejeter explicitement plutôt que retomber sur un défaut silencieux).

### Réserves issues de la review PR2.2 (priorité Basse, non bloquantes)

- **Mapping HTTP par sous-chaîne de message** — la correspondance des erreurs vers un statut HTTP repose sur une comparaison par sous-chaîne du message. Pour 2 des 4 motifs, qui viennent du moteur `validation.ts` sans garde zod équivalente en amont, une reformulation future du message ferait silencieusement retomber la validation en 500. À durcir si une story future retouche `validation.ts` (typer ces erreurs en `ValidationError`).
- **Exclusion de `logistique.sousTotalFCFA` de la surcharge `sacsSaisis`** — fidèle au texte de l'ADR §3.6 aujourd'hui, mais à réexaminer le jour où une story câblera le coût logistique dans `depensesFCFA`.
- **Entrée `assertEntierColonneInt` de `PREVISIONS_STATUS_MAP`** — probablement inatteignable via l'API (champs couverts en amont par `z.number().int()`) : défense en profondeur, à noter pour un futur nettoyage.

### Réserves issues des reviews PR2.3, PR2.4 et PR2.5

- **Dette i18n — la plus importante, à borner.** Le module Prévisions compte 24 fichiers avec des textes en français en dur, sans `next-intl`, alors que tous les autres modules métier du dépôt sont internationalisés (`vagues` 16 fichiers, `releves` 23, `abonnements` 10+). Décision prise unilatéralement par un agent en PR2.3, reprise en PR2.4, au motif que le test `i18n-completeness.test.ts` fige le nombre de namespaces à 36. Les deux reviewers jugent l'argument réel mais disproportionné : ajouter un 37e namespace et mettre à jour une assertion de longueur coûte une ligne, contre plus de 150 chaînes déjà à extraire. **Recommandation : un item de backlog unique et chiffré, référencé par PR2.3 et PR2.4**, plutôt que deux notes de clôture séparées.
- **`margeSecuriteAlevinsPct` est inerte.** Le champ est saisi, validé, affiché et documenté par l'ADR-053 décision 4 comme absorbant la mortalité, mais **aucun fichier du moteur ne le lit**. Le moteur n'a délibérément pas été modifié (la recette du jeu d'or passe à 842/0 sans ce champ, signe que le classeur de référence l'intègre en amont dans l'effectif saisi). L'UI signale désormais honnêtement que le champ est enregistré mais pas encore appliqué. **Arbitrage produit à instruire séparément.** Capitalisé en ERR-141.
- **`nombreBacsSimultanesCible` est également inerte**, mais **intentionnellement** : l'ADR-053 §4 (« Découplage des bacs réels ») le documente comme purement paramétrique. Signalé pour éviter qu'un futur agent le prenne pour un bug.
- **`src/lib/module-nav-items.ts` est du code mort** — ses consommateurs (`sidebar.tsx`, `bottom-nav.tsx`) ont été supprimés par le Sprint NC sans qu'il soit migré. L'ADR-053 §6 le désigne pourtant comme la cible à éditer pour la navigation, ce qui a déjà induit en erreur. **Deux actions recommandées** : une story de nettoyage pour le supprimer, et un amendement de l'ADR-053 §6 par l'@architect.
- **Écart §7.3 assumé** : la navigation livre **une seule entrée** (« Prévisions » → `/previsions/scenarios`) au lieu des cinq prescrites, parce que PR2.3 et PR2.4 ont construit toutes les vues en onglets `useState` non adressables par URL. Câbler cinq `href` aurait produit cinq liens morts. À réévaluer si des routes adressables par URL apparaissent.
- **Dette de process** : les notes de clôture de PR2.1, PR2.2, PR2.4 et PR2.5 ont été écrites directement dans ce fichier de sprint par les agents développeurs, alors que `docs/PROCESSES.md` réserve l'écriture de `docs/sprints/*.md` au `@status-updater`. À trancher avant PR3 : soit amender `PROCESSES.md`, soit faire repasser ces sections par le `@status-updater`.

### Réserves issues de la review de sprint PR2.6 et de la vérification finale

- **`genererPlanEmpoissonnement` n'est câblée nulle part.** Cette fonction du moteur (ADR §4, testée unitairement) n'est appelée par aucune route ni query : seule la branche « créer » du plan des vagues est livrée, pas la branche « générer ». Un exploitant qui veut planifier 19 vagues sur 21 mois — le cas d'usage de référence de l'ADR §1 — doit ouvrir le dialogue de création 19 fois. Ce n'est pas une rupture du parcours MVP, mais un écart d'ergonomie contre le cas d'usage qui justifie l'existence du module, et une fonction du moteur qui reste du code mort côté production. Sévérité **Basse à Moyenne** selon l'usage réel.
- **Zone non recettée = zone à bugs (ERR-142).** Les 3 bugs de sévérité Haute du sprint étaient **tous les trois** dans `route-orchestration.ts`, la couche d'orchestration explicitement hors du périmètre de la recette, alors que le moteur pur qu'elle appelle est validé à 842 tests / 0 écart. Les erreurs ne portaient pas sur les formules mais sur ce qui les entoure : quelle grandeur est passée en argument, dans quelle unité, et quelles données persistées sont lues ou ignorées. **Recommandation actionnable** : étendre `src/lib/previsions/__tests__/recette/` pour comparer la sortie de `calculerProjectionScenario` elle-même aux séries mensuelles du jeu d'or, au moins sur `besoinTotalCycleKg` et sur l'application de `sacsSaisis`.
- **Erreur de type ouverte dans le périmètre** : `src/__tests__/api/previsions-auth-permissions.test.ts` ligne ~187, désaccord entre le type `RequestInit` du DOM et celui de `next/server` dans une fonction utilitaire de test. Non triviale (nécessite de choisir le bon type et probablement d'harmoniser un patron ailleurs), **non corrigée**. Sans effet sur le build ni sur les tests, qui passent.
- **Réserve 4 de PR1 — CLÔTURÉE.** Le décalage éditorial de l'ADR-053 (§8.3 annonçant « 14 modèles » là où la section 3 en définit 13) n'existe plus : le texte actuel de l'ADR dit bien « 13 nouveaux modèles Prisma », la correction ayant été faite en marge de l'amendement §11 sans être annoncée.

_À compléter en fin de sprint par le @code-reviewer, sur le modèle du tableau « Réserves reportées » de PR1 (numéro, priorité, réserve, statut)._
