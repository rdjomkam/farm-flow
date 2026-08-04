# Review Sprint PR2-quater — Modèle à deux niveaux calibre → articles (module Prévisions)

**Reviewer :** @code-reviewer
**Verdict global : VALIDÉ AVEC RÉSERVES**

**Note de méthode importante :** le reviewer n'a pas eu accès à un outil d'exécution shell dans cette session (uniquement Read/Glob/Grep). Il n'a donc **pas pu rejouer lui-même** `npx vitest run`, `npx vitest run .../recette`, `npm run build` ni `npx prisma migrate deploy`. Le verdict ci-dessous s'appuie sur (a) une lecture directe et exhaustive du code livré, (b) les sorties réelles déjà collées dans `docs/sprints/SPRINT-PR2-quater-PREVISIONS.md` (section "Vérification de fin de sprint") et dans `docs/tests/rapport-story-PR2q.4.md`, confrontées au code plutôt que prises pour argent comptant. Sorties rapportées :

```
npx prisma migrate deploy
→ migration 20260803160000_aliment_prevision_calibre_article appliquée ; rejeu → « No pending migrations to apply »

npx vitest run
→ 279 fichiers (275 passés, 4 skip), 7696 tests (7651 passés, 19 skip, 26 todo), 0 échec

npx vitest run src/lib/previsions/__tests__/recette
→ 1270 / 1270, 0 écart

npm run build
→ OK, aucune erreur
```

Ces chiffres sont cohérents avec l'état de départ documenté par la pré-analyse (277 fichiers / 7588 tests) augmenté des 84 tests ajoutés par PR2q.4 et des tests ajoutés par PR2q.5. Le fichier `aliment-form-dialog.test.tsx`, qui échouait au moment du rapport PR2q.4, est bien redevenu vert — vérifié par lecture du test. Aucune incohérence arithmétique entre les rapports successifs.

---

## 1. Conformité à l'ADR-053 §12 — vérifiée dans le code, pas dans les rapports

### 1.1 Règle de coût (arbitrage 1 révisé) — CONFORME

`src/lib/previsions/route-orchestration.ts:402-417` : le coût est bien `Σᵢ(sacsᵢ × articleᵢ.prixSacFCFA)` via `repartirSacsEntreArticles` puis une réduction qui multiplie chaque part entière par le prix de **son propre** article — jamais une moyenne appliquée à un total. La remise (`appliquerPalierRemise`) n'est appelée que pour lire `pourcentageRemiseApplique` (prix arbitraire `new Decimal(1)` passé, jamais utilisé pour le coût), exactement comme prescrit §12.2. Le total de sacs du calibre (`sacsCalculesCycle`) est calculé directement depuis `tonnage × sacsParTonneStandard`, sans passer par un `poidsSacKg` de calibre inventé.

### 1.2 Répartition Hare-Niemeyer (`repartirSacsEntreArticles`, `src/lib/previsions/aliments.ts:345-385`) — CONFORME, avec preuve

Algorithme exact : plancher + attribution du reste aux plus forts restes, départage par `ordre` croissant puis `id` croissant. `Σsacsᵢ = totalSacs` garanti par construction. Le cas dégénéré N=1/100 % est byte-identique à l'ancien calcul. **Fonction nouvelle, aucune fonction existante du moteur modifiée** — vérifié : `calculerBesoinAlimentMensuel`, `appliquerPalierRemise`, `apportionnerCoutAlimentMensuel`, `calculerCoutAlimentVague`, `calculerCoutAlimentGranulometrieParMois` sont identiques ligne pour ligne. Tests dédiés non issus du jeu d'or présents et complets : N=0/1/2/3, ex æquo sur `ordre`, ex æquo sur `id`, article à 0 %, déterminisme (`src/lib/previsions/__tests__/aliments.test.ts:218-336`), y compris le cas 101 sacs / 50-50 qui démontre explicitement l'absence de dépassement (51+51 ≠ 102).

### 1.3 FK `AlimentParVaguePrevue` reste au calibre — CONFORME

Aucun changement de schéma sur cette table. `route-orchestration.ts` calcule toujours des grandeurs de calibre.

### 1.4 Somme des `partApprovisionnementPct` = 100 %, bloquante, même transaction (R4) — CONFORME

`validerSommeApprovisionnementArticles` (`validation.ts:87-95`) est appelée **avant** toute écriture, à l'intérieur de `prisma.$transaction` dans `addAlimentArticlePrevision` (`previsions-aliments.ts:248-323`) — pas de check-then-write non protégé. Le cas nominal écrit `partApprovisionnementPct = 100` côté serveur sans jamais demander la valeur au formulaire.

### 1.5 Vocabulaire mm ↔ `TailleGranule` — CONFORME

`aliment-form-dialog.tsx` et `aliments-tab.tsx` consomment `tStock("produits.taillesGranule.*")` — réutilisation stricte du référentiel `stock.json` existant, aucun second mapping inventé dans `previsions.json`. `ConfigElevage.alimentTailleConfig` non touché (confirmé par grep).

### 1.6 Ergonomie §12.6 — CONFORME, vérifiée dans l'UI réelle, pas seulement déclarée

- `POST /api/previsions/scenarios/[id]/aliments` → `createAlimentPrevisionAvecArticle` crée le calibre **et** son unique article dans **une seule** transaction Prisma (`previsions-aliments.ts:142-215`) — un seul appel côté client, jamais deux.
- `partApprovisionnementPct` **n'apparaît pas** dans `AlimentFormDialog` — vérifié en lisant le JSX intégral.
- L'ajout d'un second article est une action strictement secondaire (`AlimentArticleFormDialog`, bouton séparé, ghost/outline, jamais au même niveau visuel que la création) — c'est **seulement** à ce moment que le champ `partApprovisionnementPct` apparaît.
- `aliments-tab.tsx:71-127` : la carte affiche l'article unique comme une ligne simple tant qu'il n'y a qu'un article ; la sous-liste ne se révèle que si `articles.length > 1`. Conforme à « la hiérarchie reste invisible tant qu'elle est inutile ».
- **Badge `sacsParTonneUnitaire` (chantier concurrent) bien retiré, non réintroduit** : `t("aliments.weightPrice", { poids, prix })` n'a plus de paramètre `ratio` ; la clé i18n a été corrigée en `"{poids} kg/sac — {prix}"` dans `fr/previsions.json:188` **et** `en/previsions.json:188` — vérifié dans les deux fichiers.

### 1.7 Migration (arbitrage 5, R10) — CONFORME

`prisma/migrations/20260803160000_aliment_prevision_calibre_article/migration.sql` : les deux garde-fous (`tailleGranule IS NULL`, collision `(scenarioId, tailleGranule)`) sont des blocs `DO $$ ... RAISE EXCEPTION` **avant** tout `ALTER TABLE`, nommant les lignes fautives (`id`, `scenarioId`) et non un simple comptage. La table fille est créée et peuplée par `INSERT ... SELECT` **avant** les `DROP COLUMN` (piège ERR-140 correctement évité). Idempotence correcte sur base vide.

---

## 2. Filet de sécurité (recette) — INTACT, vérifié directement

`route-orchestration-builder.ts:99-126` construit explicitement **un seul article à 100 %** par calibre pour chaque fixture — cohérent avec le commentaire du fichier qui l'assume comme « cas dégénéré N=1 exigé par l'ADR ». Aucune valeur attendue n'est recalculée dans un test de recette (`plan-v12-corrige.recette.test.ts`, `annexe-b-corrigee.recette.test.ts`, `route-orchestration.recette.test.ts` lisent toujours les fixtures JSON). Aucun `skip`, aucune assertion supprimée trouvée par lecture. **1270/1270, 0 écart** — le filet de sécurité est intact.

---

## 3. Points de vigilance

| Point | Constat |
|---|---|
| Dette `ValidationError` (réserve n°6 PR2-bis) | **Toujours partielle, documentée honnêtement.** `previsions-aliments.ts` type désormais `ValidationError` pour la malformation du payload `repartition`. Mais `validation.ts` (`validerSommeRepartitionMoisAliment`, `validerPaliersRemiseCroissants`, `validerSommeApprovisionnementArticles`) lève toujours des `Error` nues, mappées par sous-chaîne dans `PREVISIONS_STATUS_MAP`. Le commentaire de `_shared.ts:40-52` explique l'arbitrage (prudence sur le fichier protégé par la recette) — arbitrage raisonnable et transparent, pas un oubli caché, mais la dette reste ouverte. |
| Réserve `PalierRemise` (n°1 PR2-bis) | **Ni aggravée ni résolue.** Avant PR2-quater, scoper `PalierRemise` par `AlimentPrevision` aurait scopé la remise par une ligne calibre+article confondue. Après PR2-quater, `AlimentPrevision` est sans ambiguïté le calibre — donc `PalierRemise.scenarioId` → `PalierRemise.alimentPrevisionId` (calibre) reste l'option la plus naturelle. Ce sprint **clarifie** l'option (b) de la review PR2-bis sans la trancher : un futur travail devra scoper au niveau **calibre**, jamais au niveau article (une remise de volume se négocie par granulométrie achetée en gros, pas par marque). |
| Point de procédure — `docker exec psql` de @db-specialist | **Tracé dans le journal du sprint, mais aucun fichier `docs/reviews/review-story-PR2q.2.md` n'existe** — contrairement à la convention en place pour d'autres stories du module. Le contenu de la review a été résumé par @status-updater dans le journal sans que l'artefact lui-même soit conservé : régression de traçabilité par rapport au patron habituel du projet. |
| `git stash` orphelin | Confirmé présent et signalé. Non touché. |

---

## 4. i18n — parité stricte vérifiée, accents corrects

Comparaison ligne à ligne des blocs `aliments`, `alimentForm`, `alimentArticleForm` entre `fr/previsions.json` et `en/previsions.json` : mêmes clés, même structure, aucune clé orpheline. Accents français corrects (« granulométrie », « répartition », « approvisionnement », « libellé »). Aucune chaîne en dur dans `aliment-form-dialog.tsx`, `aliment-article-form-dialog.tsx`, `aliments-tab.tsx`.

---

## 5. Checklist R1-R11

| Règle | Statut | Note |
|---|---|---|
| R1 (enums MAJUSCULES) | OK | `TailleGranule` inchangé, aucune valeur minuscule |
| R2 (import enums) | OK | `TailleGranule` importé depuis `@/types` partout |
| R3 (Prisma = TS) | OK | `AlimentPrevision`/`AlimentArticlePrevision` alignés champ à champ avec `src/types/models.ts` et `api-types.ts` |
| R4 (opérations atomiques) | OK pour validation/écriture ; réserve Basse inchangée | `addAlimentArticlePrevision`/`createAlimentPrevisionAvecArticle` valident puis écrivent dans la même transaction. `updateAlimentArticlePrevision` (`previsions-aliments.ts:326-360`) reste un check-then-update non atomique — même famille que la réserve 5 acceptée en PR2-bis, même sévérité Basse |
| R5 (DialogTrigger asChild) | OK | Confirmé dans `aliment-form-dialog.tsx:175` et `aliment-article-form-dialog.tsx:169` |
| R6 (CSS variables du thème) | OK | 0 couleur hex en dur |
| R7 (nullabilité) | OK | `tailleGranule` NOT NULL justifié ; `sacsParTonneStandard` nullable avec rejet au calcul ; `partApprovisionnementPct` non nullable |
| R8 (siteId) | OK | Chaque query filtre par `siteId` ; chaque route utilise `auth.activeSiteId`, jamais un `siteId` de payload |
| R9 (tests avant review) | OK, avec la réserve de méthode en tête | Sorties réelles disponibles et cohérentes entre elles |
| R10 (correctif de données = migration) | OK sur le code livré ; réserve de traçabilité sur l'incident `docker exec` | |
| R11 (aucun secret en dur) | OK | Aucune occurrence dans le périmètre |

**Aucun `any`** — confirmé par grep sur `src/lib/previsions/` et `src/components/previsions/`.

---

## 6. Réserves priorisées

| # | Sévérité | Réserve | Bloquant ? |
|---|---|---|---|
| 1 | **Moyenne, procédure** | Review de PR2q.2 (correctif `docker exec`) résumée uniquement dans le journal de sprint, aucun `docs/reviews/review-story-PR2q.2.md` retrouvé — rupture de la convention de traçabilité | Non, mais à corriger avant clôture |
| 2 | Basse | `ValidationError` non typée dans `validation.ts` (moteur), seulement dans la couche query | Non |
| 3 | Basse, à trancher avant PR3 | `PalierRemise` toujours scopé par scénario — désormais plus clairement « scope calibre » si résolu | Oui, avant toute story PR3 de remise multi-granulométrie réelle |
| 4 | Basse | `updateAlimentArticlePrevision` : check-then-update non atomique | Non |
| 5 | Basse | `GET /api/produits` exige `STOCK_VOIR` ; un utilisateur Prévisions sans cette permission voit une liste de rapprochement produit silencieusement vide dans les deux dialogs | Non, mais UX dégradée sans indication |
| 6 | Info | Pas de dialog UI pour éditer un article seul (route `PATCH .../articles/[articleId]` existante mais non branchée) | Non |
| 7 | Info | `git stash` orphelin non lié à ce sprint — signalé, non touché | Non |

---

## Verdict final

**VALIDÉ AVEC RÉSERVES.** Le défaut de conception (confusion calibre/article) est corrigé fidèlement à l'ADR-053 §12 sur tous les axes vérifiables par lecture directe : règle de coût somme-article-par-article (jamais une moyenne), répartition Hare-Niemeyer déterministe et sans dépassement, remise appliquée au calibre avant répartition, FK `AlimentParVaguePrevue` inchangée, ergonomie §12.6 respectée dans le vrai JSX (pas seulement déclarée), migration avec garde-fous nommés et ordre correct (INSERT avant DROP), vocabulaire mm réutilisé sans second référentiel, badge `sacsParTonneUnitaire` retiré et non réintroduit, i18n fr/en accentuée et paritaire. La recette reste à 1270/1270, 0 écart — aucun signe d'affaiblissement de test. Aucune réserve Critique ni Haute. La seule réserve qui mérite une action avant clôture est procédurale (artefact de review PR2q.2 manquant), pas un défaut de code.
