# Sprint PR1 — Module Prévisions : fondations et moteur

**Statut** : ✅ TERMINÉ
**Commit** : à faire par l'utilisateur — aucun commit ni push n'a été effectué par les agents
**Référence** : [ADR-053 — Module Prévisions](../decisions/ADR-053-module-previsions.md) (spécification complète et validée, non renégociable)

## Objectif

Poser les fondations du module Prévisions : schéma de données, types TypeScript miroirs, moteur de calcul pur, et recette contre le jeu d'or. Aucune surface applicative (API, UI, navigation) n'est construite dans ce sprint.

## Périmètre

**DANS ce sprint** :
- Schéma Prisma (14 modèles + 7 enums + champs liés) et migration
- Types TypeScript miroirs
- Moteur de calcul pur, `src/lib/previsions/`, zéro I/O
- Recette contre le jeu d'or (`prisma/fixtures/previsions/`)

**HORS ce sprint** (sprints PR2/PR3, à ne pas commencer) :
- Routes API
- Pages UI et composants React
- Navigation
- Rapprochement prévu/réel

## Note de processus

PR1.3 (moteur de calcul pur dans `src/lib/`) applique la **forme** du pipeline de type API (pre-analyst → developer → tester → code-reviewer → knowledge-keeper) alors que `docs/PROCESSES.md` n'a pas de type « moteur ». Ce n'est pas une déviation de processus mais une application par analogie, actée par le @project-manager.

## Stories

| Story | Type | Sujet | Pipeline | Statut |
|-------|------|-------|----------|--------|
| PR1.0 | SCHEMA | `decimal.js` en dépendance déclarée | @developer seul | FAIT |
| PR1.1 | SCHEMA | Schéma Prisma et migration | @pre-analyst → @db-specialist → @code-reviewer → @knowledge-keeper | FAIT |
| PR1.2 | TYPES | Types TypeScript miroirs | @pre-analyst → @architect → @code-reviewer | FAIT |
| PR1.3 | MOTEUR | Moteur de calcul pur | @pre-analyst → @developer → @tester → @code-reviewer → @knowledge-keeper (forme API, par analogie) | FAIT |
| PR1.4 | TEST | Recette contre le jeu d'or | @tester (+ @developer si écart) | FAIT |
| PR1.5 | REVIEW | Review de sprint | @code-reviewer → @knowledge-keeper | FAIT |

**Légende des statuts** : `TODO` (pas commencé) · `EN COURS` (travail en cours) · `REVIEW` (code terminé, en attente de review/recette) · `FAIT` (validé) · `BLOQUÉ` (dépendance ou problème)

---

### PR1.0 — `decimal.js` en dépendance déclarée

**Type** : SCHEMA
**Pipeline** : @developer seul (pipeline allégé)
**Statut** : FAIT
**Note** : `decimal.js` ajouté en version épinglée `"10.6.0"` dans `dependencies` de `package.json`, `package-lock.json` régénéré, import direct vérifié. `npm run build` OK et `npx vitest run` : 5764 tests passés / 0 échec.

**Constat** : `decimal.js@10.6.0` est présent dans `node_modules` (dépendance transitive) mais absent de `package.json`. Réf. ADR-053 §7 « Statut de la dépendance ».

**Critères d'acceptation** :
- [ ] `decimal.js` ajouté à `dependencies` dans `package.json`, version épinglée (`10.6.0`)
- [ ] `npm install` ne modifie pas la résolution existante de `decimal.js`
- [ ] Aucune régression build

---

### PR1.1 — Schéma Prisma et migration

**Type** : SCHEMA
**Pipeline** : @pre-analyst → @db-specialist → @code-reviewer → @knowledge-keeper
**Statut** : FAIT
**Note** : pré-analyse @pre-analyst rendue, verdict GO. Ligne de base avant travaux : build OK, 229 fichiers de test, 5764 tests passés, 26 todo, 0 échec.

**Notes de clôture** :
- 7 enums + **13 modèles** livrés. L'ADR §8.3 annonce « 14 modèles » mais sa **section 3, qui fait foi**, en définit 13 + le champ `Vague.vaguePrevueId` — décalage éditorial de l'ADR **signalé, non corrigé**.
- 3 migrations créées : `20260803120000_add_permission_sitemodule_previsions`, `20260803120100_add_previsions_module`, `20260803120200_backfill_previsions_permissions` (backfill idempotent des permissions sur les `SiteRole` existants, ERR-105 ; idempotence prouvée par rejeu).
- Seed enrichi d'un jeu de démonstration + permissions ajoutées aux rôles Administrateur (4) et Gérant (2) ; Pisciculteur volontairement non doté (profil terrain, aucun accès financier).
- Review @code-reviewer : **VALIDÉ AVEC RÉSERVES**, réserve refermée par PR1.2.
- Bug pré-existant corrigé au passage : l'`INSERT INTO "Bac"` du seed référençait les colonnes `nombrePoissons`/`vagueId` supprimées par la migration ADR-043 Phase 3, ce qui rendait `npm run db:seed` inexécutable.

**Périmètre** : 14 modèles + 7 enums + `Vague.vaguePrevueId String? @unique` + 4 valeurs `Permission` + 1 valeur `SiteModule`, exactement selon ADR-053 §3 et §6.

**Points de vigilance** :
- R1 : enums en UPPERCASE dès le départ
- R7 : nullabilité explicite, décidée dès le schéma
- R8 : `siteId` sur chaque nouveau modèle
- `@@unique([siteId, code])` pour `ScenarioPrevision` et `VaguePrevue`
- Tous les montants en `Decimal` — le domaine ferme existant n'est **pas** migré et reste en `Float`
- Auto-relation `vaguePrevueParentId`
- Migration générée via `prisma migrate diff` (dossier créé à la main) puis appliquée via `migrate deploy` (R10, jamais `migrate dev` en non-interactif)
- `seed.sql` mis à jour avec des données de test pour les nouveaux modèles

**Critères d'acceptation** :
- [ ] 14 modèles et 7 enums créés, strictement conformes à ADR-053 §3 et §6
- [ ] `Vague.vaguePrevueId String? @unique` ajouté
- [ ] 4 valeurs `Permission` et 1 valeur `SiteModule` ajoutées
- [ ] `siteId` présent sur chaque nouveau modèle (R8)
- [ ] `@@unique([siteId, code])` sur `ScenarioPrevision` et `VaguePrevue`
- [ ] Tous les montants prévisionnels en `Decimal` ; domaine ferme existant non touché (reste `Float`)
- [ ] Auto-relation `vaguePrevueParentId` fonctionnelle
- [ ] Migration créée via `migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script`, dossier créé à la main, appliquée via `migrate deploy`
- [ ] `prisma/seed.sql` mis à jour
- [ ] `npx prisma migrate deploy` et `npm run db:seed` passent sans erreur

---

### PR1.2 — Types TypeScript miroirs

**Type** : TYPES
**Pipeline** : @pre-analyst → @architect → @code-reviewer
**Statut** : FAIT

**Notes de clôture** :
- 7 enums + 13 interfaces dans `src/types/models.ts`, barrel `src/types/index.ts` mis à jour (enums en `export {}`, interfaces en `export type {}`), `vaguePrevueId` ajouté à l'interface `Vague`, 4 libellés de permission dans `src/lib/role-form-labels.ts`.
- Review @code-reviewer : **VALIDÉ AVEC RÉSERVES** (l'auteur n'avait pas d'outil shell ; vérification exécutable faite ensuite).
- Correctifs d'exhaustivité découverts après coup et appliqués : groupe `previsions` ajouté à `PERMISSION_GROUPS` (`src/lib/permissions-constants.ts`) ; entrée `PREVISIONS` ajoutée au `Record<SiteModule, string>` de `src/components/abonnements/plan-form-dialog.tsx` (le build était cassé) ; décomptes mis à jour dans `src/__tests__/permissions.test.ts` (16→17 groupes).
- `SITE_MODULES_CONFIG` et `module-nav-items.ts` volontairement non touchés (sprint PR3).

**Critères d'acceptation** :
- [ ] Types créés dans `src/types/` strictement alignés sur les modèles Prisma de PR1.1 (R3)
- [ ] Tous les enums importés depuis `@/types`, aucune chaîne littérale (R2)
- [ ] Aucun `any`
- [ ] Barrel export (`src/types/index.ts`) mis à jour

---

### PR1.3 — Moteur de calcul pur

**Type** : MOTEUR
**Pipeline** : forme du pipeline API — @pre-analyst → @developer → @tester → @code-reviewer → @knowledge-keeper (par analogie, cf. Note de processus ci-dessus)
**Statut** : FAIT

**Notes** :
- 12 fonctions pures de l'ADR §4 + helper `genererSerieTresorerie` + `validation.ts`, dans `src/lib/previsions/`, zéro I/O (vérifié par grep exhaustif en review). 52 tests unitaires.
- Review @code-reviewer : **VALIDÉ AVEC RÉSERVES** — 3 réserves :
  1. `sacsCalcules`/`sacsSaisis` typés `number` dans le moteur alors que le schéma Prisma les déclare `Decimal` — à trancher par @architect/@db-specialist **avant** l'écriture de la couche API (PR2).
  2. R9 : exécution effective à confirmer.
  3. Gap de l'ADR : aucune des 12 fonctions ne couvre le calcul des transports/voyages, alors que le jeu d'or en dépend pour `base_repartition`.
- Statut passé à **FAIT** après la recette PR1.4.

**Note complémentaire (post-review de story)** : deux gaps révélés par la recette ont été comblés après la review de story — `src/lib/previsions/logistique.ts` (calcul des voyages et coûts de transport, arrondi `ceil`, capacités passées en paramètre et jamais en dur) et deux fonctions ajoutées à `aliments.ts` (`apportionnerCoutAlimentMensuel`, `calculerCoutAlimentGranulometrieParMois`) pour la ventilation mensuelle du coût d'aliment remisé. Sémantique vérifiée : la remise est décidée une seule fois sur le total du cycle de la vague puis ventilée par pourcentages, jamais recalculée mois par mois.

**Exigences** :
- Fonctions pures dans `src/lib/previsions/`, zéro I/O (pas d'appel Prisma, pas de fetch)
- `Decimal` pour tous les montants, kg et sacs fractionnaires ; `number` pour les entiers stricts (effectifs de poissons, mois)
- Arrondi `ceil` pour les sacs et les voyages ; arrondi `round` pour les effectifs de poissons
- Décision 6 de l'ADR : la quote-part est calculée sur `base_repartition` (hors journal affecté), jamais sur `charges_operationnelles`
- Boucle générique `k = 1..dureeCycleMois` — interdiction de coder 3 branches en dur (mois 1 / mois 2 / reste)

**Critères d'acceptation** :
- [ ] Aucune fonction du moteur ne fait d'I/O (ni Prisma, ni fetch, ni accès disque)
- [ ] `Decimal` utilisé pour montants/kg/sacs fractionnaires, `number` pour entiers stricts
- [ ] `ceil` appliqué aux sacs et voyages, `round` aux effectifs de poissons
- [ ] Quote-part calculée sur `base_repartition`, jamais sur `charges_operationnelles`
- [ ] Boucle `k = 1..dureeCycleMois` générique, aucune branche en dur pour un nombre de mois particulier
- [ ] Suite de tests unitaires du moteur verte

---

### PR1.4 — Recette contre le jeu d'or

**Type** : TEST
**Pipeline** : @tester (+ @developer si écart constaté)
**Statut** : FAIT

**Note de clôture** : **842 tests de recette, 0 écart**, sur les deux scénarios, ligne à ligne sur les 21 mois, tolérance 0 sur les entiers et ≤ 1 FCFA sur les montants. Le point bas négatif du scénario B (−6 334 704 FCFA en novembre 2026) est reproduit exactement. Séries couvertes : besoins en aliments (kg et sacs par granulométrie), coût aliment par vague et par mois, logistique complète (3 séries de voyages + transport alevins + sous-total), base de répartition, dépenses totales, résultat, trésorerie cumulée, point bas et mois du point bas, cumuls. Séries non couvertes, documentées et assumées : `resultats.epargne` (aucune fonction correspondante dans l'ADR §4) et `calculerBudgetTotalPlan` (aucune cible de comparaison fiable dans le jeu d'or). Entrées encore lues depuis le jeu d'or plutôt que calculées : `entrees.ventesT`, `entrees.chiffreAffaires`, `resultats.apportsCapital`, `resultats.investissements` — ce sont des données de planification sans formule associée dans l'ADR, aucune n'est une sortie testée ailleurs. Rapport : `docs/tests/rapport-story-PR1.4.md`.

**Note** : les fixtures ont été enrichies d'un bloc `entreesModele` extrait des feuilles de saisie du classeur (`Paramètres`, `Aliments`, `Empoissonnement`, `Aliment par vague`, `Dépenses`) — sans ce bloc la recette était impossible, les fixtures ne contenant que les séries de sortie. Les séries de sortie du jeu d'or sont vérifiées **inchangées valeur pour valeur** après enrichissement.

**Exigences** :
- Rejouer `plan-v12-corrige.json` et `annexe-b-corrigee.json`
- Comparaison **ligne à ligne sur les 21 mois**, pas seulement sur les cumuls
- Tolérance **0** sur les entiers, **≤ 1 FCFA** sur les montants
- Couvrir les cas limites décrits en ADR-053 §8

**Critères d'acceptation** :
- [ ] `plan-v12-corrige.json` rejoué et comparé mois par mois (21 mois), tolérance 0 sur entiers / ≤ 1 FCFA sur montants
- [ ] `annexe-b-corrigee.json` rejoué et comparé mois par mois, mêmes tolérances
- [ ] Cas limites §8 de l'ADR-053 couverts par des tests dédiés
- [ ] Tout écart constaté est soit corrigé (avec @developer), soit documenté et justifié
- [ ] `npx vitest run` vert sur l'ensemble de la recette

---

### PR1.5 — Review de sprint

**Type** : REVIEW
**Pipeline** : @code-reviewer → @knowledge-keeper
**Statut** : FAIT

**Note de clôture** : rapport dans `docs/reviews/review-sprint-PR1.md`, verdict **VALIDÉ AVEC RÉSERVES**, aucune réserve bloquante. Capitalisation faite : ERR-124 à ERR-129 ajoutées dans `docs/knowledge/ERRORS-AND-FIXES.md`.

**Livrable** : `docs/reviews/review-sprint-PR1.md`

**Critères d'acceptation** :
- [ ] Checklist R1-R11 vérifiée pour chaque story touchant du code
- [ ] `docs/reviews/review-sprint-PR1.md` produit avec verdict explicite
- [ ] Capitalisation dans `docs/knowledge/ERRORS-AND-FIXES.md` si des erreurs ont été rencontrées et corrigées

---

## Vérification de fin de sprint

- [x] `npx prisma migrate deploy`
- [x] `npm run db:seed`
- [x] `npx vitest run`
- [x] `npm run build`

**État mesuré (fin de sprint, toutes stories FAIT)** :
- `npx prisma migrate deploy` : 161 migrations trouvées, aucune en attente. Idempotence confirmée par second rejeu.
- `npm run db:seed` : COMMIT sans erreur SQL. Rejouabilité confirmée par second rejeu.
- `npx vitest run` : **239 fichiers, 6677 tests passés, 26 todo, 0 échec**
- `npm run build` : compilation réussie, aucune erreur

## Réserves reportées

| # | Priorité | Réserve | Statut |
|---|----------|---------|--------|
| 1 | **Haute — avant PR2** | Passer `AlimentParVaguePrevue.sacsCalcules` / `sacsSaisis` de `Decimal` à `Int` / `Int?` — la valeur est par construction toujours un entier (ADR §4). | **LEVÉE** |
| 2 | **Moyenne — au moment de PR3** | La clé i18n `"modules.previsions"`, référencée par `src/components/abonnements/plan-form-dialog.tsx`, n'existe ni dans `src/messages/fr/navigation.json` ni dans `en`. Sans effet aujourd'hui (code jamais exécuté), mais régression UI dès que PR3 ajoutera `PREVISIONS` à `SITE_MODULES_CONFIG`. | **LEVÉE** |
| 3 | **Basse** | Modéliser les paramètres de transport (capacités, coûts par voyage) dans Prisma — ils sont aujourd'hui portés en entrée de fonction, gap documenté dans `src/lib/previsions/logistique.ts`. | **LEVÉE** |
| 4 | **Cosmétique** | ADR-053 §8.3 annonce « 14 nouveaux modèles » alors que la section 3 en définit 13. | **OUVERTE** — hors périmètre du lot de traitement des réserves 1-3 |
| 5 | **Basse — préexistante** | `getModuleNavKey()` dans `src/components/abonnements/plan-form-dialog.tsx` (l.182-183) référence aussi `modules.adminCommissions` et `modules.adminRemises`, absentes des deux `navigation.json`. Bug préexistant, platform-only, jamais rendu à l'exécution. | **OUVERTE** — identifiée en traitant la réserve 2, non corrigée (hors périmètre) |
| 6 | **Documentation — avant PR2** | Homonymie `sacsCalcules` : le nom est porté à la fois par la colonne DB (`Int`, entière par construction) et par le type en mémoire `AlimentParVagueCalcInput` de `src/lib/previsions/aliments.ts`, qui peut recevoir une valeur fractionnaire comme proxy d'échelle pour la décision de palier de remise. Non bloquant — une écriture Prisma fractionnaire échouerait bruyamment sur la colonne `Int` — mais à documenter pour le développeur de PR2. | **OUVERTE** — identifiée en traitant la réserve 1, non traitée |

### Détail des réserves levées

**Réserve 1 — `sacsCalcules` / `sacsSaisis` en `Int`.** Pipeline complet SCHEMA : @pre-analyst (GO) → @db-specialist → @tester (PASS) → @code-reviewer (VALIDÉ) → @knowledge-keeper.
- `prisma/schema.prisma` : `sacsCalcules Decimal` → `Int` (NOT NULL conservé), `sacsSaisis Decimal?` → `Int?` (nullabilité conservée). `quantiteKgCalculee` et `coutCalculeFCFA` restent `Decimal`.
- Migration `prisma/migrations/20260803140000_alimentparvagueprevue_sacs_int/migration.sql` : garde-fou de précondition (`DO $$ ... RAISE EXCEPTION` sur `<> TRUNC(...)`) exécuté avant tout `ALTER TABLE`, puis cast explicite `USING ...::INTEGER` — le cast implicite PostgreSQL arrondit silencieusement, piège identifié et neutralisé. Garde-fou prouvé fonctionnel sur table temporaire.
- Aucun fichier TypeScript modifié : le moteur et `src/types/models.ts` typaient déjà ces champs en `number` / `number | null` — pur alignement R3.
- Recette du jeu d'or inchangée : **842 tests, 0 écart**.

**Réserve 2 — clé i18n `modules.previsions`.** Pipeline allégé : @pre-analyst (GO) → @developer → @code-reviewer (VALIDÉ).
- `src/messages/fr/navigation.json` : `modules.previsions = "Prévisions"`.
- `src/messages/en/navigation.json` : `modules.previsions = "Forecasts"`.
- Le test de parité fr/en existant `src/__tests__/i18n/messages-sprint40.test.ts` couvrait déjà le cas (égalité stricte des clés) : aucune extension de test nécessaire, confirmé par la review.
- Aucune clé `items.*` ajoutée par anticipation ; `SITE_MODULES_CONFIG` non touché (reste à PR3).

**Réserve 3 — paramètres de transport en Prisma.** Pipeline complet SCHEMA : @pre-analyst (GO) → @db-specialist → @code-reviewer (VALIDÉ) → @knowledge-keeper.
- 6 champs ajoutés à `ParametresPrevision` dans `prisma/schema.prisma` : `capaciteTransportAlimentsSacs Int @default(60)`, `coutTransportAlimentsFCFA Decimal @default(15000)`, `capaciteTransportPoissonsKg Int @default(1500)`, `coutTransportPoissonsFCFA Decimal @default(25000)`, `capaciteTransportAlevinsNb Int @default(20000)`, `coutTransportAlevinsFCFA Decimal @default(30000)` — valeurs du classeur `Paramètres!B25:B30`. Tous NOT NULL avec `@default` (R7 tranchée explicitement).
- Migration `prisma/migrations/20260803130000_add_transport_parametres_prevision/migration.sql`, avec 6 contraintes `CHECK` (capacités `> 0`, coûts `>= 0`) suivant la convention du dépôt `<Table>_<champ>_check`.
- `src/types/models.ts` : miroir des 6 champs (R3).
- Le moteur reste à signature explicite : aucune signature de `src/lib/previsions/logistique.ts` modifiée, aucun I/O introduit (décision 1 de l'ADR-053). Seul le commentaire d'en-tête « GAP DE MODELE » a été mis à jour.
