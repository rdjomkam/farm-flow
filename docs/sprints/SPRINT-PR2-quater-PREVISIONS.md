# Sprint PR2-quater — Modèle à deux niveaux calibre → articles (module Prévisions)

**Statut** : TERMINÉ (VALIDÉ AVEC RÉSERVES)
**Commit** : aucun commit ni push par les agents — l'utilisateur commite lui-même
**Référence** : [ADR-053 — Module Prévisions](../decisions/ADR-053-module-previsions.md) (§12 à amender par PR2q.1), `docs/reviews/review-sprint-PR2-bis.md`

## Contexte — pourquoi le modèle actuel est faux

Le modèle actuel écrase **deux natures distinctes** dans une seule ligne `AlimentPrevision` :

- le **calibre** (2 mm, 3 mm, 4 mm…) est caractérisé par une **taille**, et pilote le coefficient `sacsParTonneStandard` ainsi que la répartition sur le cycle ;
- l'**article** (« Marque A en 2 mm ») est caractérisé par une **marque**, un **poids de sac** et un **prix**, et pilote le **coût**.

Tant qu'il n'y a qu'une seule marque par calibre — le cas du classeur Excel de référence — le défaut reste invisible. Dès qu'un exploitant a deux marques de 2 mm à des prix différents, le modèle casse.

**Second défaut, lié** : le formulaire de création n'expose ni `tailleGranule` ni `produitId`. Une granulométrie saisie à la main a donc les deux à `null`, ce qui rend **impossible le rapprochement prévu/réel de PR3**.

## Filet de sécurité — non négociable

Le jeu d'or a **un seul article par calibre, à 100 %**. La recette doit donc rester à **1270 tests et 0 écart** après la restructuration.

**Si elle bouge d'un seul FCFA, c'est un ÉCHEC, pas un ajustement à accepter.**

## Hors périmètre (= PR3)

Rapprochement prévu/réel, vues de comparaison, reprévision, exports.

## Stories

| Story | Titre | Type | Pipeline | Statut |
|-------|-------|------|----------|--------|
| PR2q.1 | Amendement section 12 de l'ADR-053 — modèle à deux niveaux calibre → articles, les 5 arbitrages, et pourquoi le modèle initial était faux | ADR | @architect seul | FAIT |
| PR2q.2 | Schéma Prisma : niveau calibre + niveau article, migration versionnée idempotente, seed | SCHEMA | @pre-analyst → @db-specialist → @code-reviewer → @knowledge-keeper | FAIT |
| PR2q.3 | Miroirs TypeScript des deux niveaux | TYPES | @pre-analyst → @architect → @code-reviewer | FAIT |
| PR2q.4 | Adaptation moteur + queries + API au modèle à deux niveaux | API | @pre-analyst → @developer → @tester → @code-reviewer → @knowledge-keeper | FAIT |
| PR2q.5 | UI : l'onglet Granulométries devient calibres → articles ; calibre = sélecteur obligatoire ; marque et rattachement produit saisissables ; i18n fr + en complète, accents corrects | UI | @pre-analyst → @developer → @tester → @code-reviewer | FAIT |
| PR2q.6 | Review de sprint R1-R11 → `docs/reviews/review-sprint-PR2-quater.md` | REVIEW | @code-reviewer → @knowledge-keeper | FAIT |

**Légende** : `TODO` · `EN COURS` · `REVIEW` · `FAIT` · `BLOQUÉ`

## Journal

- **2026-08-03 — PR2q.1 : TODO → FAIT.** Section 12 (12.1 à 12.6) écrite dans `docs/decisions/ADR-053-module-previsions.md`, puis amendée une seconde fois après arbitrage utilisateur : la règle de coût est la somme article par article de (sacs × prix de sac), jamais une moyenne pondérée ; la répartition d'un total entier de sacs entre articles suit la méthode du plus fort reste (Hare-Niemeyer) avec départage déterministe par `ordre` puis `id` ; `appliquerPalierRemise` reste appliquée au total du calibre avant répartition. La section 12.6 acte l'ergonomie du cas nominal à un article unique.
- **2026-08-03 — PR2q.2 : TODO → REVIEW.** Schéma restructuré en niveau calibre (`AlimentPrevision`, `tailleGranule` NOT NULL, `@@unique([scenarioId, tailleGranule])`) et niveau article (nouveau modèle `AlimentArticlePrevision`), migration versionnée `20260803160000_aliment_prevision_calibre_article` avec deux garde-fous de précondition bruyants, `seed.sql` mis à jour. Recette vérifiée à 1270 tests / 0 écart. `npm run build` cassé volontairement en attendant PR2q.3 et PR2q.4.
- **2026-08-03 — PR2q.3 : TODO → EN COURS.**
- **2026-08-03 — PR2q.2 : REVIEW → FAIT.** Reviewée par @code-reviewer : **VALIDÉ AVEC RÉSERVES**. Réserve Moyenne, de procédure : @db-specialist a supprimé à la main, via `docker exec psql`, une ligne `AlimentPrevision` résiduelle à `tailleGranule = NULL` sur la base Docker partagée, sans traçabilité — geste à ne pas banaliser au regard de R10. Réserve Basse : la preuve d'un `migrate deploy` sur base fraîche n'a pas été collée.
- **2026-08-03 — PR2q.3 : EN COURS → FAIT.** Miroirs `src/types/models.ts`, `src/types/api.ts` et `src/types/index.ts` alignés sur le schéma à deux niveaux : DTO de création transactionnelle calibre + article et DTO d'ajout d'un second article. Aucun `any`.
- **2026-08-03 — PR2q.4 : TODO → FAIT.** Nouvelle fonction pure `repartirSacsEntreArticles` (plus fort reste / Hare-Niemeyer, départage `ordre` puis `id`) et `validerSommeApprovisionnementArticles` ; `route-orchestration.ts` recomposé calibre → articles ; `copierAlimentsPrevisionDepuisProduits` regroupe désormais par `tailleGranule` et rejette nommément un produit sans taille ; 2 nouvelles routes `articles/`. 84 tests ajoutés par le @tester, dont la divergence somme vs moyenne mesurée à 8 000 FCFA sur un cas 30/70. Aucune fonction existante du moteur pur modifiée.
- **2026-08-03 — Bugfix PR2q.4.** Un bug HTTP 500 au lieu de 400 trouvé par le @tester a été corrigé par le typage `ValidationError` sur la couche query.
- **2026-08-03 — PR2q.5 : TODO → FAIT.** `aliment-form-dialog.tsx` réécrit (calibre = sélecteur obligatoire, `produitId` saisissable), nouveau `aliment-article-form-dialog.tsx` pour l'action secondaire, `aliments-tab.tsx` garde une ligne simple à un article et ne révèle la hiérarchie qu'à partir de deux. Badge `sacsParTonneUnitaire` retiré : chantier concurrent intégré, jamais annulé. i18n fr/en à 368/368 clés, parité vérifiée mécaniquement, référentiel d'affichage mm existant réutilisé.
- **2026-08-03 — PR2q.6 : TODO → EN COURS.**
- **2026-08-03 — PR2q.6 : EN COURS → FAIT.** Review de sprint par @code-reviewer : **VALIDÉ AVEC RÉSERVES**, rapport persisté dans `docs/reviews/review-sprint-PR2-quater.md`. Aucune réserve Critique ni Haute. Conformité vérifiée par lecture directe du code sur tous les axes de l'ADR-053 §12 : coût = somme article par article (jamais une moyenne), répartition Hare-Niemeyer déterministe et sans dépassement, remise appliquée au calibre avant répartition, FK `AlimentParVaguePrevue` inchangée, ergonomie §12.6 respectée dans le JSX réel, migration avec garde-fous nommés et `INSERT ... SELECT` avant `DROP COLUMN`, vocabulaire mm réutilisé sans second référentiel, badge `sacsParTonneUnitaire` retiré et non réintroduit, i18n fr/en paritaire et accentuée. Recette **1270/1270, 0 écart** — aucun signe d'affaiblissement de test.
- **2026-08-03 — Capitalisation @knowledge-keeper.** Entrées ERR-147 à ERR-152 ajoutées à `docs/knowledge/ERRORS-AND-FIXES.md` ; ERR-140 enrichie du cas « déplacer une colonne entre deux tables n'est pas un renommage » ; ERR-134 confirmée résolue.

---

## Vérification de fin de sprint

- [x] `npx prisma migrate deploy` — migration `20260803160000_aliment_prevision_calibre_article` appliquée ; rejeu → « No pending migrations to apply »
- [x] `npx vitest run` — 279 fichiers (275 passés, 4 skip), 7696 tests (7651 passés, 19 skip, 26 todo), **0 échec**
- [x] `npx vitest run src/lib/previsions/__tests__/recette` — **1270 / 1270, 0 écart** — filet de sécurité tenu
- [x] `npm run build` — OK, aucune erreur

---

## Points ouverts

1. **Dette réserve n°6 de PR2-bis (mapping HTTP par sous-chaîne)** : `ValidationError` n'est typée que sur la couche query `previsions-aliments.ts`, pas sur le moteur `validation.ts` — extension repoussée volontairement, par prudence sur la recette.
2. **Réserve n°1 de PR2-bis (`PalierRemise` scopé par scénario)** : toujours ouverte, à trancher avant PR3.
3. **Pas de dialog UI dédié pour éditer un article existant seul** : la route `PATCH .../articles/[articleId]` existe mais n'est pas branchée.
4. **`GET /api/produits` exige `STOCK_VOIR`** : un utilisateur Prévisions sans cette permission voit une liste de rapprochement produit vide, silencieusement.
5. **Un `git stash` orphelin** (`stash@{0}`, « WIP on main ») traîne sur le dépôt, non créé par les agents de ce sprint — à ne pas supprimer sans vérification de l'utilisateur.
6. ~~**Traçabilité : artefact de review de story manquant**~~ — **SOLDÉ**. La review de sprint avait relevé l'absence de `docs/reviews/review-story-PR2q.2.md` comme une rupture de la convention du projet (chaque story reviewée produit son artefact). Le rapport a été **reconstitué et persisté** ; la réserve est close.
7. **`updateAlimentArticlePrevision` reste un check-then-update non atomique** (`src/lib/queries/previsions-aliments.ts`) — sévérité **Basse**, même famille que la réserve 5 déjà acceptée en PR2-bis (R4).
8. **Origine jamais investiguée de la ligne `AlimentPrevision` résiduelle** : le geste de @db-specialist (suppression manuelle d'une ligne orpheline via `docker exec psql` sur la base de dev partagée, sans consigner son origine) est désormais capitalisé en **ERR-152**. L'origine de cette ligne résiduelle n'a **jamais été investiguée** et pourrait être le symptôme d'un bug d'une story antérieure.

---

## Gouvernance

Aucun agent autre que @status-updater n'écrit dans ce fichier. Les agents rapportent leur résultat au @project-manager, qui spawne @status-updater.

## Chantier concurrent

`src/components/previsions/aliments-tab.tsx` fait l'objet d'une correction en cours par un @developer (retrait du badge `sacsParTonneUnitaire` de l'affichage). Cette décision est acquise : la story PR2q.5 doit l'intégrer, jamais l'écraser.
