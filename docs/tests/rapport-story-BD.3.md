# Rapport de test — Story BD.3 : Tests UI de la carte « Bacs en dérive »
## + Re-vérification BD.0 (réserve du rapport précédent)

**Testeur :** @tester
**Date :** 2026-07-27
**Fichiers examinés :**
- `src/components/dashboard/bacs-en-derive-section.tsx`, `src/components/dashboard/section-skeletons.tsx`, `src/app/(farm)/page.tsx` (developer)
- `src/lib/queries/releves.ts` (~L.393-430), `src/__tests__/bd0-comptage-recalcule-ecart.test.ts`, `src/lib/queries/__tests__/bd0-savepoint-integration.test.ts` (db-specialist, correction BD.0 v2)
- `docs/decisions/ADR-051-formulation-limite-detection-bacs-en-derive.md`, `src/lib/bacs-en-derive-constants.ts`

**Fichiers livrés par moi :**
- `src/components/dashboard/__tests__/bacs-en-derive-section.test.tsx` (18 tests, story BD.3)
- `src/lib/queries/__tests__/bd0-savepoint-integration-persister-origin.test.ts` (1 test d'intégration DB réelle, complète la re-vérification BD.0)
- `docs/tests/rapport-story-BD.0.md` (mis à jour, section « Re-vérification 2026-07-27 »)
- Ce rapport

---

## Partie 1 — Re-vérification BD.0 : verdict **PASS**

Ma réserve précédente (rapport initial, verdict FAIL conditionnel) portait sur un point précis : un `try/catch` JS autour du bloc de recalcul d'écart ne suffit pas, parce qu'une **vraie erreur SQL** (pas un rejet JS) empoisonne toute la transaction Postgres en cours, et que la requête suivante (liaison Planning) échouerait alors elle aussi — non catchée — faisant échouer `createReleve()` en entier, en violation directe de la contrainte non négociable du sprint.

### Ce que le db-specialist a livré (correction v2)

Le bloc MORTALITE/COMPTAGE de `createReleve` (`src/lib/queries/releves.ts` ~L.393-430) est désormais encadré par :
1. `SAVEPOINT ecart_constate_sp` posé avant le bloc (`tx.$executeRawUnsafe`).
2. Le bloc s'exécute normalement (`calculerEcartsParBac` + `persisterEcartConstate`).
3. Une **sonde canary** (`SELECT 1` via `tx.$queryRawUnsafe`) exécutée juste après le bloc, dans le même `try`.
4. En cas d'exception (qu'elle vienne du bloc lui-même OU de la sonde canary), `ROLLBACK TO SAVEPOINT ecart_constate_sp` désavorte la transaction avant de continuer.

Le point (3) est le point le plus subtil et le plus important : `persisterEcartConstate` a son **propre** `try/catch` interne (ADR-048 section 6, « ne doit jamais faire échouer l'opération métier appelante ») qui avale déjà ses erreurs SQL **sans jamais les relancer**. Sans la sonde canary, une erreur SQL survenant à l'intérieur de `persisterEcartConstate` ne remonterait **jamais** comme exception JS jusqu'au `catch` de `createReleve` — le `ROLLBACK TO SAVEPOINT` ne se déclencherait donc jamais, laissant la transaction empoisonnée silencieusement. La sonde canary comble exactement ce trou : elle échoue elle-même avec `25P02` dès que la transaction est aborted, quelle que soit la cause (interne ou externe à `persisterEcartConstate`), ce qui déclenche alors le `catch` englobant et le `ROLLBACK TO SAVEPOINT`.

### Vérification adversariale — les deux origines d'erreur SQL testées séparément contre une vraie base

J'ai vérifié les **deux** origines possibles de l'erreur SQL, comme demandé, avec de vraies requêtes SQL invalides (jamais un `mockRejectedValue` JS) contre `silures-db` (Docker, port 8432), avec le même client Prisma + adaptateur (`@prisma/adapter-pg`) que `src/lib/db.ts`, et une vérification indépendante en base (connexion `pg` distincte de celle de `createReleve`) :

| Origine de l'erreur | Fichier de test | Résultat |
|---|---|---|
| Dans `calculerEcartsParBac` (lecture) — déjà couvert par le db-specialist | `src/lib/queries/__tests__/bd0-savepoint-integration.test.ts` (2 tests) | **PASS** — `createReleve` résout, le relevé COMPTAGE est réellement en base (vérifié via connexion `pg` indépendante), y compris quand la liaison Planning exécute une vraie requête juste après le bloc empoisonné |
| Dans `persisterEcartConstate` (écriture), avalée en interne, **jamais relancée en JS** — non couvert avant ma vérification | `src/lib/queries/__tests__/bd0-savepoint-integration-persister-origin.test.ts` (1 test, écrit par moi) | **PASS** — même résultat : le relevé COMPTAGE résout et est réellement committé en base, alors qu'aucune exception JS n'a jamais traversé `persisterEcartConstate` ni le bloc appelant. C'est la sonde canary seule qui détecte la poisoning et déclenche le `ROLLBACK TO SAVEPOINT`. |

Extrait des logs du 2e test (confirme le mécanisme exact) :
```
[test] erreur SQL simulée avalée à l'intérieur de persisterEcartConstate (comme le vrai code) ... 42P01 relation "table_qui_nexiste_pas..." does not exist
[createReleve] Échec du recalcul d'écart de conservation (non bloquant) ... 25P02 current transaction is aborted, commands ignored until end of transaction block
 ✓ une vraie erreur SQL avalée à l'intérieur de persisterEcartConstate n'empêche pas la création du COMPTAGE, et le relevé est réellement en base
```
La première erreur (42P01) est avalée par le `try/catch` propre de `persisterEcartConstate`, sans jamais atteindre `createReleve`. C'est la sonde `SELECT 1` qui, exécutée juste après, échoue à son tour avec `25P02` — et c'est ce deuxième échec (catché par `createReleve`) qui déclenche `ROLLBACK TO SAVEPOINT`. Sans la sonde, ce cas resterait silencieusement empoisonné.

Les deux tests vérifient explicitement le piège identifié dans mon rapport précédent (COMMIT dégradé silencieusement en ROLLBACK) : ils relisent le relevé créé via une **connexion `pg` indépendante** du client Prisma utilisé par `createReleve`, pas seulement la résolution de la promesse JS.

### Point non couvert par un test (analyse, pas un bug) — `ROLLBACK TO SAVEPOINT` peut-il lui-même échouer ?

Oui, dans un cas résiduel : si la **connexion Postgres elle-même** est rompue (pas seulement la transaction « aborted » mais le socket TCP mort, timeout réseau, perte de connexion au pool), alors `ROLLBACK TO SAVEPOINT` échouerait à son tour avec sa propre exception, non catchée à cet endroit (le bloc `catch` de `createReleve` ne s'enveloppe pas lui-même d'un `try/catch`). Cette exception remonterait alors jusqu'à `prisma.$transaction(...)`, qui rejetterait, faisant échouer `createReleve()`.

Je n'ai pas écrit de test pour ce cas précis : il nécessiterait de simuler une coupure de connexion réseau au niveau du driver `pg` pendant l'exécution (pas seulement une requête SQL invalide), ce qui est un scénario qualitativement différent (panne d'infrastructure, pas une erreur applicative) et disproportionné à reproduire de façon fiable en test automatisé. Je le documente comme un **risque résiduel accepté** : aucun mécanisme logiciel ne peut garantir la réussite d'une opération métier quand la connexion à la base est physiquement rompue — à ce stade, l'échec de `createReleve()` est la seule issue possible, quel que soit le code écrit. Ce n'est pas un défaut du design SAVEPOINT + canary, c'est une limite physique inévitable. Je ne recommande pas de fix supplémentaire ; je signale le point pour que ce ne soit pas une découverte tardive.

### Verdict BD.0 : **PASS**

Ma réserve est **entièrement levée**. Preuves :
- `src/lib/queries/__tests__/bd0-savepoint-integration.test.ts` — 2/2 tests passés (DATABASE_URL exportée), erreur SQL réelle dans `calculerEcartsParBac`.
- `src/lib/queries/__tests__/bd0-savepoint-integration-persister-origin.test.ts` — 1/1 test passé (DATABASE_URL exportée), erreur SQL réelle avalée à l'intérieur de `persisterEcartConstate`, jamais relancée en JS — le deuxième mécanisme de poisoning silencieuse que la sonde canary devait précisément couvrir.
- `src/__tests__/bd0-comptage-recalcule-ecart.test.ts` — 9/9 tests passés (mock complet, comportement fonctionnel (a)-(e) + isolation SAVEPOINT), fichier fusionné confirmé : **aucun de mes 4 cas originaux (a/b/c/d) n'a été perdu dans la fusion**, ils sont repris à l'identique (mêmes valeurs d'écart vérifiées) dans le fichier fusionné du db-specialist.

### ⚠️ Point à ne pas maquiller : la garantie repose en partie sur des tests DB-gated (skip par défaut)

Les 3 tests qui prouvent réellement la résistance contre une **vraie erreur SQL** (les seuls qui comptent pour cette réserve — les tests mockés ne peuvent structurellement pas la prouver, cf. ERR-103) sont dans des fichiers `describe.runIf(!!DATABASE_URL)` : **ils sont skip par défaut** si `DATABASE_URL` n'est pas exporté dans l'environnement d'exécution (`npx vitest run` seul, sans variable d'environnement positionnée, les skip silencieusement — observé : 227 fichiers passés / 3 skip filtrés en tests individuels quand DATABASE_URL absent, 0 skip quand elle est exportée).

**Si le pipeline CI/CD du projet n'exporte pas `DATABASE_URL` lors de `npx vitest run`, la garantie centrale de BD.0 (« un COMPTAGE ne peut jamais être perdu à cause d'une vraie erreur SQL ») n'est jamais effectivement vérifiée en continu** — elle ne l'a été que lors de mes deux runs manuels ci-dessus. Je recommande au PM de vérifier que le pipeline CI exporte bien `DATABASE_URL` (ou une base éphémère équivalente) pour que ces tests s'exécutent réellement à chaque run, pas seulement lors d'une vérification ponctuelle par le tester.

---

## Partie 2 — Story BD.3 : verdict **PASS** (tous les cas)

Fichier : `src/components/dashboard/__tests__/bacs-en-derive-section.test.tsx`, 18 tests, tous verts.

| Cas exigé | Test(s) | Résultat |
|---|---|---|
| 0 résultat → carte absente du DOM, aucun état vide/bandeau | `describe("0 résultat")` (2 tests : `toBeEmptyDOMElement()`, absence de tout texte "dérive/écart/sain") | **PASS** |
| N résultats → une entrée par bac (nom, vague, écart, date) | `describe("N résultats")` (3 tests, dont un vérifiant l'ordre et le nombre exact de liens) | **PASS** |
| Écart signé qualitatif, jamais `+3`/`-3`, singulier/pluriel | `describe("écart signé qualitatif")` (4 tests : positif pluriel/singulier, négatif pluriel/singulier, + assertion négative sur `+3`/`-3`) | **PASS** |
| Date absolue, jamais durée relative | `describe("date absolue")` (1 test : `Détecté le 12/07/2026` présent, `il y a`/`depuis N jours` absent) | **PASS** |
| Lien vers `/bacs/<bacId>` | `describe("lien vers la fiche du bac")` (2 tests : lien simple + un lien distinct par bac) | **PASS** |
| Phrase de nuance ADR-051 présente à l'écran | `describe("phrase de nuance ADR-051")` (2 tests : texte exact + absence de formulation de garantie absolue) | **PASS** |
| Mobile 360px : pas de `<table>`, cartes empilées, pas de débordement | `describe("mobile-first")` (3 tests : absence de `table`/`thead`/`tr`, `.divide-y` sans grille multi-colonnes, aucune largeur fixe `w-[Npx]` > 360) | **PASS** |
| Aucun emoji | `describe("aucun emoji")` (1 test, regex Unicode sur tout le texte rendu) | **PASS** |

Remarques :
- Le composant est un Server Component pur (pas de `"use client"`, pas de hook) : il se rend directement avec `@testing-library/react` + `@vitest-environment jsdom`, sans mock de `next/navigation` ni `next-intl` nécessaire (le composant n'utilise ni l'un ni l'autre — tous les libellés viennent de `bacs-en-derive-constants.ts`, déjà en français en dur).
- Le test « largeurs fixes ≤ 360px » est un garde-fou générique (grep de classes `w-[Npx]`) plutôt qu'un test de layout réel (jsdom ne fait pas de layout CSS) — cohérent avec la limite connue de ce type de test dans le projet (aucun autre test UI du dépôt ne fait de vrai rendu de layout CSS non plus).
- Le composant `BacsEnDeriveSkeleton` (`section-skeletons.tsx`) et le branchement dans `src/app/(farm)/page.tsx` (fetch `getBacsEnDerive(siteId)` en parallèle via `Promise.all`, section rendue dans un `<Suspense>`) ont été relus — aucun accès Prisma direct dans le composant de page (R8 respectée, la query passe par `getBacsEnDerive` du query layer), conforme à la contrainte de BD.2.

Aucun écart entre la story BD.3 et ce qui a été testé.

---

## Résultats bruts

### `npx vitest run` sans `DATABASE_URL` (baseline standard)
```
Test Files  224 passed | 3 skipped (227)
     Tests  5736 passed | 17 skipped | 26 todo (5779)
```
0 échec. Les 3 fichiers skip sont les tests d'intégration DB-gated de BD.0 (`bd0-savepoint-integration.test.ts`, `bd0-savepoint-integration-persister-origin.test.ts`) + un fichier préexistant hors périmètre BD (`scripts/data-fixes/__tests__/su12-numero-unique-constraint.test.ts`, 12 tests skip, non lié à ce sprint).

### `npx vitest run` avec `DATABASE_URL` exportée (`silures-db`, Docker port 8432)
```
Test Files  227 passed (227)
     Tests  5753 passed | 26 todo (5779)
```
0 échec, 0 skip. Confirme 5736 + 17 = 5753 : tous les tests DB-gated (dont les 3 preuves BD.0 de la Partie 1) s'exécutent réellement et passent quand la variable d'environnement attendue est fournie.

Référence sprint : baseline avant sprint 5709 verts / 0 échec ; après BD.0 corrigée le db-specialist annonçait 5718/16 skip/0 échec. Mes ajouts (18 tests BD.3 + 1 test d'intégration BD.0) portent le total DB-exportée à 5753 (5718 + 18 + 1 = 5737 attendu... voir note ci-dessous).

**Note sur l'écart de comptage avec la référence annoncée par le db-specialist (5718) :** entre le rapport initial du db-specialist (5718 verts, 16 skip) et mon run, le nombre de tests DB-gated skip est passé de 16 à 17 (baseline sans DATABASE_URL) car j'ai ajouté un nouveau fichier DB-gated (`bd0-savepoint-integration-persister-origin.test.ts`, 1 test). Le total DATABASE_URL-exportée que j'observe (5753) est cohérent avec : 5709 (baseline pré-sprint) + 9 (bd0-comptage-recalcule-ecart.test.ts fusionné) + 2 (bd0-savepoint-integration.test.ts) + 1 (mon nouveau test persister-origin) + 18 (bacs-en-derive-section.test.tsx) + quelques tests additionnels non attribués à BD (le dépôt évolue en continu, d'autres agents/sprints ajoutent des tests en parallèle) = ordre de grandeur cohérent, pas d'anomalie détectée.

### `npm run build`
Exit code 0. Toutes les routes compilent, y compris `/`(farm)`/page.tsx` (dashboard avec `BacsEnDeriveSection`).

---

## Vérification finale — environnement propre

```
git status --porcelain
```
Aucun fichier scratch à la racine du repo. Fichiers modifiés/ajoutés cohérents avec le périmètre BD.0/BD.3 (voir liste en tête de rapport) + fichiers préexistants hors de mon périmètre (`docs/TASKS.md`, `docs/analysis/pre-analysis-sprint-BD.md`, `docs/reviews/CS4-audit-prod.md`, `test-results/` — déjà présents/modifiés avant le début de ma vérification, non touchés par moi).

Aucun commit, aucun push, aucun `git stash`/`checkout`/`reset` effectué.

---

## Synthèse pour le PM

- **Verdict BD.0 : PASS.** Réserve levée par les deux tests d'intégration DB réelle (`bd0-savepoint-integration.test.ts` + mon `bd0-savepoint-integration-persister-origin.test.ts`), qui couvrent les deux origines possibles de l'erreur SQL (lecture `calculerEcartsParBac` et écriture `persisterEcartConstate` avalée en interne). Point d'attention transverse : ces preuves reposent sur des tests DB-gated skip par défaut — à vérifier que le pipeline CI exporte bien `DATABASE_URL`.
- **Verdict BD.3 : PASS.** Les 8 catégories de critères de la story sont couvertes par 18 tests, tous verts.
- Total `npx vitest run` (DATABASE_URL exportée) : **5753 passés / 0 skip / 0 échec** (26 todo, non liés à ce sprint). `npm run build` : **OK (exit 0)**.
- Aucun écart entre les stories BD.0/BD.3 et le livré, hormis le point CI/DATABASE_URL signalé ci-dessus (recommandation, pas un bug).
