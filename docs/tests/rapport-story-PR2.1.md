# Rapport de tests — Story PR2.1 (Queries Prisma module Prévisions)

**Sprint :** PR2 (Prévisions — Sprint 2)
**Story :** PR2.1 — Queries Prisma
**Étape du pipeline :** tester (pre-analyst → db-specialist → **tester** → code-reviewer → knowledge-keeper)
**Testeur :** @tester
**Date :** 2026-08-03

**Verdict global : PASS**, avec **1 bug réel découvert et documenté** (troncature silencieuse d'une valeur fractionnaire dans une colonne `Int`) et 2 observations mineures de documentation. Aucune régression, build OK, recette moteur intacte à 842/842.

---

## 1. Périmètre couvert

Fichiers testés (tous nouveaux, story PR2.1, @db-specialist) :

- `src/lib/queries/previsions-scenarios.ts`
- `src/lib/queries/previsions-aliments.ts`
- `src/lib/queries/previsions-vagues.ts`
- `src/lib/queries/previsions-charges.ts`
- `src/lib/queries/previsions-scenario-loader.ts`
- `src/lib/previsions/decimal-io.ts`

Le moteur (`src/lib/previsions/*.ts`, hors `decimal-io.ts`) n'a **pas été modifié** par ce travail de test — seule sa recette a été ré-exécutée pour vérifier la non-régression (section 6).

## 2. Fichiers de test livrés

| Fichier | Tests | Nature |
|---|---|---|
| `src/lib/queries/__tests__/previsions-fake-db.ts` | — (helper) | Fake Prisma en mémoire partagé, avec `$transaction` à sémantique de rollback réel sur exception |
| `src/lib/queries/__tests__/previsions-scenarios.test.ts` | 18 | Mock |
| `src/lib/queries/__tests__/previsions-aliments.test.ts` | 12 | Mock |
| `src/lib/queries/__tests__/previsions-vagues.test.ts` | 22 | Mock |
| `src/lib/queries/__tests__/previsions-charges.test.ts` | 15 | Mock |
| `src/lib/queries/__tests__/previsions-scenario-loader.test.ts` | 5 | Mock (avec compteur de requêtes instrumenté) |
| `src/lib/previsions/__tests__/decimal-io.test.ts` | 7 | Pur, aucun mock (fonctions sans I/O) |
| `src/lib/queries/__tests__/previsions-int-fractional-integration.test.ts` | 2 | **DB-gated** (`requireDatabaseUrl()`), vrai Postgres |

**Total : 79 tests mockés + 2 tests DB-gated = 81 tests nouveaux.**

Registre DB-gated mis à jour : `src/test/db-gated-allowlist.ts` (1 nouvelle entrée, justifiée, vérifiée par le test méta `src/__tests__/meta/db-gated-tests-registry.test.ts` — toujours 4/4 vert).

### Pattern retenu

Repris du dépôt existant (`src/__tests__/queries/su12-numero-unique-par-site.test.ts`, `src/lib/queries/__tests__/bons-livraison-transaction-integration.test.ts`) :
- Tests mockés : magasins en mémoire par modèle + `vi.mock("@/lib/db", ...)`, généralisés dans un helper partagé (`previsions-fake-db.ts`) pour éviter de dupliquer 5 fois le même boilerplate CRUD. Le `$transaction` du fake db fait un **snapshot avant** et une **restauration réelle sur exception** — condition nécessaire pour que les tests R4 (atomicité) prouvent quelque chose de non trivial.
- Test DB-gated : `requireDatabaseUrl()` (ADR-052 §3.2), connexion `pg.Pool` directe pour seed/vérification/nettoyage, jamais de secret en dur (`process.env.DATABASE_URL`, R11).

---

## 3. R8 — isolation par site (priorité 1)

Couvert systématiquement sur **toutes** les fonctions de lecture et d'écriture des 4 fichiers de queries mockés : `getScenarios`, `getScenarioById`, `createScenario` (y compris la copie des `Produit` — vérifié qu'un produit ALIMENT actif d'un **autre site** n'est jamais copié), `updateParametresPrevision`, `replacePaliersRemise`, `archiverScenario`, `activerScenario`, `getAlimentsPrevisionParScenario`, `getAlimentPrevisionById`, `createAlimentPrevision`, `replaceRepartitionsMoisAliment`, `deleteAlimentPrevision`, `getVaguesPrevuesParScenario`, `getVaguePrevueById`, `createVaguePrevue`, `updateVaguePrevue`, `scinderVaguePrevue`, `annulerVaguePrevue`, `rattacherVaguePrevue` (les deux sens : VaguePrevue d'un autre site, ET vague réelle d'un autre site), `replaceAlimentsParVaguePrevue`, `updateSacsSaisis`, `getPostesPrevisionParScenario`, `createPostePrevision`, `upsertChargeMensuelle`, `getChargesMensuellesParScenario`, `getJournalDepensesParScenario`, `createJournalDepensePrevue`, `updateJournalDepensePrevue`, `deleteJournalDepensePrevue`, `getApportsCapitalParScenario`, `createApportCapital`, `chargerScenarioPourMoteur`.

**Résultat : PASS partout.** Chaque tentative d'accès/modification d'une entité d'un autre site échoue avec un message explicite (`"... introuvable"`) ou renvoie un résultat vide/`null`, et l'état de l'entité de l'autre site est vérifié **inchangé** après la tentative (pas seulement l'échec de l'appel).

## 4. R4 — atomicité (priorité 2)

- **`replacePaliersRemise`** : seuils non strictement croissants → rejet, anciens paliers **intacts** (vérifié par id).
- **`createAlimentPrevision`** : somme des répartitions ≠ 100 % → **aucun `AlimentPrevision` créé** (pas seulement ses répartitions — la validation a lieu avant le `create()` de l'aliment lui-même dans le code source, testé explicitement).
- **`replaceRepartitionsMoisAliment`** : somme ≠ 100 % → rejet, anciennes répartitions intactes.
- **`scinderVaguePrevue`** : moins de 2 scissions → rejet **avant même l'ouverture de la transaction** (vérifié que le parent reste `PLANIFIEE`) ; scénario d'un autre site → rejet, aucun enfant créé, parent intact.
- **`replaceAlimentsParVaguePrevue`** : test de rollback réel sur une **violation de contrainte `@@unique` provoquée par le fake db** (deux lignes identiques dans le batch d'entrée, ce qui violerait `@@unique([vaguePrevueId, alimentPrevisionId, moisCycle])` en vrai Postgres) → le `deleteMany` (déjà exécuté avant le `createMany` fautif) est bien annulé par le rollback du fake `$transaction`, l'ancienne ligne survit. C'est le test le plus proche d'une preuve R4 « une erreur d'écriture réelle en milieu de transaction ne laisse aucune trace », sans dupliquer ce que couvre déjà `bons-livraison-transaction-integration.test.ts` en DB réelle.

**Résultat : PASS partout.**

## 5. Règles métier bloquantes

- **`annulerVaguePrevue` sur une VaguePrevue rattachée à une vague réelle** : rejet explicite (`"rattachee a une vague reelle"`), statut inchangé (`PLANIFIEE`). Conforme à l'ADR-053 décision 2.
- **Aucune fonction `deleteVaguePrevue`** : test explicite qui importe le module entier et vérifie `mod.deleteVaguePrevue === undefined`. Conforme.
- **`scinderVaguePrevue`** : enfants avec `vaguePrevueParentId` renseigné (= id du parent) et **`dureeCycleMoisFigee` copiée depuis le PARENT** (testé avec un scénario dont `dureeCycleMois` courant **diffère volontairement** de la valeur figée du parent, pour prouver que la copie ne vient jamais du scénario courant) ; parent → `ANNULEE`.
- **`rattacherVaguePrevue`** : contrainte `@unique` sur `Vague.vaguePrevueId` — testée indirectement via l'isolation de site (le fake db ne simule pas de contrainte unique sur ce champ précis, cette garantie DB réelle est déjà couverte par la suite existante `bons-livraison-transaction-integration.test.ts`/`su12-*` du dépôt ; pas dupliquée ici pour rester dans le périmètre strict de PR2.1).

## 6. COALESCE(sacsSaisis, sacsCalcules)

Testé sur `updateSacsSaisis` : une surcharge posée (`sacsSaisis: 15`) laisse `sacsCalcules` inchangé et prouve que `sacsSaisis ?? sacsCalcules` (le calcul COALESCE réel étant la responsabilité du moteur/consommateur, pas de cette query) renvoie bien la surcharge ; l'effacement de la surcharge (`null`) fait retomber sur `sacsCalcules`. **PASS.**

## 7. `decimal-io.ts`

- `prismaDecimalToEngine` : prouvé avec une valeur à 18 décimales (`0.123456789012345678`) qui perd **réellement** de la précision via un détour par `.toNumber()` (`0.12345678901234568`, vérifié explicitement dans le test que ce détour perd effectivement la précision, pour que le test démontre quelque chose) — `prismaDecimalToEngine` conserve la valeur exacte car il passe par `.toString()`.
- Prouvé aussi qu'un `Prisma.Decimal` et un `decimal.js` moteur ne sont jamais confondus : le retour de `prismaDecimalToEngine` est une instance de `Decimal` (moteur), pas de `Prisma.Decimal`, et une opération moteur (`.times(2)`) fonctionne dessus sans lever d'exception.
- `decimalToNumber` : conversion simple vérifiée, `null` propagé.

**Résultat : PASS.**

## 8. Absence de N+1 sur `chargerScenarioPourMoteur`

Le dépôt n'a pas de middleware Prisma `$on('query')` exploitable en test unitaire mocké (un vrai comptage de requêtes SQL nécessiterait un client connecté à un vrai Postgres). **Vérification alternative retenue** : le fake db partagé a été instrumenté avec un compteur d'appels sur **chaque méthode de chaque modèle mocké** (`countingProxy`, dans le fichier de test) — ce qui mesure fidèlement le nombre d'« allers-retours logiques » que ferait un vrai Prisma (chaque `findMany`/`findFirst` = une requête réseau).

Résultat mesuré : **7 requêtes**, constant que le scénario ait 2 ou 20 `VaguePrevue` (testé explicitement avec les deux tailles). **Observation mineure** : la JSDoc de `chargerScenarioPourMoteur` affirme "un NOMBRE CONSTANT de requetes (6, ...)" puis énumère 7 items numérotés 1 à 7 dans le paragraphe qui suit — la valeur "6" annoncée dans le texte ne correspond pas à sa propre énumération juste en dessous (ni au compte réel mesuré, 7). Incohérence de documentation, sans impact fonctionnel — à corriger dans la JSDoc à l'occasion d'un prochain commit sur ce fichier.

---

## 9. BUG DÉCOUVERT — troncature silencieuse d'une valeur fractionnaire dans une colonne `Int`

**Sévérité proposée : Moyenne** (pas de chemin d'appel connu qui produirait aujourd'hui une valeur fractionnaire — `calculerBesoinAlimentMensuel` fait déjà `ceil()` — mais l'absence de garde est un risque latent de **corruption silencieuse de données**, pas juste un cas limite cosmétique).

**Fichier(s) :** `src/lib/queries/previsions-vagues.ts` (`replaceAlimentsParVaguePrevue`, `updateSacsSaisis`) — le gap est dans l'absence de garde applicative, pas une ligne de code fautive précise.

**Ce qui était supposé (JSDoc existante, écrite par le db-specialist, `src/lib/previsions/aliments.ts`, ajoutée dans cette même story) :**
> "Une ecriture Prisma d'une valeur fractionnaire dans la colonne `Int` echouerait bruyamment de toute facon"

**Ce qui a été observé empiriquement (test DB-gated, vrai Postgres, `src/lib/queries/__tests__/previsions-int-fractional-integration.test.ts`) :**
- `replaceAlimentsParVaguePrevue(vaguePrevueId, siteId, [{ ..., sacsCalcules: 3.7, ... }])` **ne lève AUCUNE exception** : elle réussit, et la valeur persistée en base est **`3`** (tronquée vers zéro, `Math.trunc`, pas un arrondi).
- `updateSacsSaisis(id, siteId, 12.3)` : même comportement, persiste **`12`**.
- Vérifié par contraste que le driver `pg` nu (sans Prisma), sur un `INSERT` paramétré `3.7` dans une vraie colonne `integer`, **rejette** avec l'erreur Postgres `22P02 invalid input syntax for type integer` — c'est donc bien le **client Prisma** qui tronque silencieusement la valeur *avant* qu'elle n'atteigne Postgres (le rejet Postgres réel, qui existe et qui a été vérifié manuellement, n'est jamais atteint car Prisma a déjà arrondi/tronqué la valeur en amont).
- Vérifié aussi que le comportement n'est **pas** celui d'un `CAST` SQL Postgres classique (`SELECT 3.5::integer` renvoie `4`, arrondi au plus proche) — la troncature observée ici est bien un comportement du **client** Prisma, distinct du comportement du moteur SQL.

**Conséquence :** un futur appelant de `replaceAlimentsParVaguePrevue`/`updateSacsSaisis` qui, par erreur (bug amont, mauvaise conversion `Decimal.toNumber()` sans `.round()`/`.ceil()`, etc.), passerait une valeur fractionnaire n'aurait **aucun signal d'erreur** — la donnée serait silencieusement altérée (ex. `3.7` sacs devient `3` sacs, un écart de ~19 % sur cette ligne) sans qu'aucune couche (client Prisma, requête, Postgres) ne le signale.

**Ce qui n'est PAS un bug (pour éviter toute confusion)** : dans le chemin applicatif réel actuel (`calculerBesoinAlimentMensuel`, moteur), la valeur est déjà `ceil()`-ée avant d'atteindre la query — ce bug ne s'est donc **jamais produit en pratique** à ce stade. C'est un gap de robustesse (défense en profondeur manquante), pas un défaut fonctionnel actif.

**Recommandation (à instruire par @project-manager / @db-specialist, je ne corrige pas au-delà du test) :** ajouter un garde explicite (`Number.isInteger(sacsCalcules)` / `Number.isInteger(sacsSaisis)`, levant une erreur sinon) dans `replaceAlimentsParVaguePrevue` et `updateSacsSaisis`, à l'image des validations déjà présentes pour la somme des répartitions et les seuils de palier (`src/lib/previsions/validation.ts`). Corriger accessoirement la JSDoc de `aliments.ts` qui affirme un rejet Postgres qui, en pratique, n'est jamais atteint.

**Reproduction minimale (déjà encodée dans le test, DB-gated) :** voir `src/lib/queries/__tests__/previsions-int-fractional-integration.test.ts`, exécuté avec succès contre Postgres réel (Docker, port 8432) — `set -a; source .env; set +a; npx vitest run src/lib/queries/__tests__/previsions-int-fractional-integration.test.ts`.

---

## 10. Observations mineures (non bloquantes)

1. **JSDoc `chargerScenarioPourMoteur`** : "6 requêtes" annoncé, 7 énumérées et 7 mesurées (section 8). Cosmétique.
2. **`deleteAlimentPrevision`** : lecture (`findFirst` avec `siteId`) puis `delete({ where: { id } })` sans re-condition sur `siteId` dans le `delete` lui-même — un check-then-delete plutôt qu'un `deleteMany` conditionnel atomique (R4 au sens strict). Risque résiduel purement théorique (aucune mutation de `siteId` n'existe sur `AlimentPrevision` dans ce dépôt, donc pas de fenêtre de course réaliste identifiée) — signalé par souci d'exhaustivité, pas un bug actionnable.

---

## 11. Vérifications obligatoires — sorties réelles

### `npx vitest run` (sans `DATABASE_URL`, comme en dev local sans Docker)

```
Test Files  242 passed | 4 skipped (246)
     Tests  6739 passed | 19 skipped | 26 todo (6784)
```

Ligne de base à ne pas régresser : **6660 passés / 17 skipped / 26 todo / 0 échec**.
Delta : **+79 passés** (mes 6 fichiers de test mockés), **+2 skipped** (mon fichier DB-gated, skip normal sans `DATABASE_URL`). **0 échec.** Conforme, aucune régression.

### `npm run build`

Build production réussi (aucune erreur TypeScript/Next.js), toutes les routes générées normalement (sortie tronquée dans ce rapport pour lisibilité — build complet exécuté et vert).

### `npx vitest run src/lib/previsions/__tests__/recette`

```
 ✓ src/lib/previsions/__tests__/recette/annexe-b-corrigee.recette.test.ts (421 tests)
 ✓ src/lib/previsions/__tests__/recette/plan-v12-corrige.recette.test.ts (421 tests)

 Test Files  2 passed (2)
      Tests  842 passed (842)
```

**842/842, 0 écart — inchangé.** La JSDoc ajoutée par le db-specialist dans `src/lib/previsions/aliments.ts` a été confirmée être un diff **commentaires uniquement** (`git diff --stat` : 36 insertions, 1 suppression, aucune ligne de code) — aucune ligne exécutable modifiée. Le moteur n'a pas été touché par ce travail de test.

### Test DB-gated (exécuté manuellement avec `DATABASE_URL` chargé depuis `.env`, Docker `silures-db` up)

```
set -a; source .env; set +a
npx vitest run src/lib/queries/__tests__/previsions-int-fractional-integration.test.ts

 ✓ src/lib/queries/__tests__/previsions-int-fractional-integration.test.ts (2 tests)
      Tests  2 passed (2)
```

Nettoyage vérifié après coup (aucune ligne résiduelle `pr21-int-site-%` dans `Site`).

### Test méta du registre DB-gated

```
npx vitest run src/__tests__/meta/db-gated-tests-registry.test.ts
 ✓ (4 tests) — toujours vert après l'ajout de la nouvelle entrée dans db-gated-allowlist.ts
```

---

## 12. Verdict

**PASS.** La couche requête PR2.1 respecte R8 (isolation par site, exhaustif) et R4 (atomicité, y compris sur une violation réelle de contrainte simulée) partout où testé. Les règles métier de l'ADR-053 (interdiction de suppression physique d'une VaguePrevue rattachée, copie figée de `dureeCycleMoisFigee` depuis le parent lors d'une scission, validations bloquantes somme=100%/seuils croissants) sont respectées. Le moteur PR1 reste intact (842/842). Un bug réel de robustesse (Moyenne, pas Critique/Haute — jamais atteint dans le chemin applicatif actuel) a été découvert et documenté pour instruction par le PM : la troncature silencieuse d'une valeur fractionnaire dans `AlimentParVaguePrevue.sacsCalcules`/`sacsSaisis`, sans aucune exception levée, contredisant l'hypothèse écrite dans la JSDoc du moteur.

## 13. Fichiers livrés (chemins absolus)

- `/Users/ronald/project/dkfarm/farm-flow/src/lib/queries/__tests__/previsions-fake-db.ts`
- `/Users/ronald/project/dkfarm/farm-flow/src/lib/queries/__tests__/previsions-scenarios.test.ts`
- `/Users/ronald/project/dkfarm/farm-flow/src/lib/queries/__tests__/previsions-aliments.test.ts`
- `/Users/ronald/project/dkfarm/farm-flow/src/lib/queries/__tests__/previsions-vagues.test.ts`
- `/Users/ronald/project/dkfarm/farm-flow/src/lib/queries/__tests__/previsions-charges.test.ts`
- `/Users/ronald/project/dkfarm/farm-flow/src/lib/queries/__tests__/previsions-scenario-loader.test.ts`
- `/Users/ronald/project/dkfarm/farm-flow/src/lib/previsions/__tests__/decimal-io.test.ts`
- `/Users/ronald/project/dkfarm/farm-flow/src/lib/queries/__tests__/previsions-int-fractional-integration.test.ts`
- `/Users/ronald/project/dkfarm/farm-flow/src/test/db-gated-allowlist.ts` (1 entrée ajoutée)
