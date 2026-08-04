# Rapport final — Vérification de fin de sprint PR2-quinquies

**Sprint :** PR2-quinquies | **Testeur :** @tester | **Date :** 2026-08-04

Toutes les sorties de commandes ci-dessous sont copiées telles quelles (aucune reformulation). Aucun code de production, test, fixture ou donnée n'a été modifié pendant cette vérification.

---

## 1. `npx prisma migrate deploy`

```
Loaded Prisma config from prisma.config.ts.

Prisma schema loaded from prisma/schema.prisma.
Datasource "db": PostgreSQL database "farm-flow", schema "public" at "localhost:8432"

166 migrations found in prisma/migrations


No pending migrations to apply.
```

**Résultat : OK.** Aucune migration en attente.

---

## 2. `npx vitest run src/lib/previsions/__tests__/recette` — la recette

```
 RUN  v4.0.18 /Users/ronald/project/dkfarm/farm-flow

 ✓ src/lib/previsions/__tests__/recette/plan-v12-corrige.recette.test.ts (461 tests) 10ms
 ✓ src/lib/previsions/__tests__/recette/annexe-b-corrigee.recette.test.ts (461 tests) 9ms
 ✓ src/lib/previsions/__tests__/recette/route-orchestration.recette.test.ts (982 tests) 21ms

 Test Files  3 passed (3)
      Tests  1904 passed (1904)
   Start at  02:24:20
   Duration  261ms (transform 202ms, setup 51ms, import 271ms, tests 40ms, environment 0ms)
```

**Résultat : 1904 tests, 1904 passed, 0 écart.** Conforme à l'attendu (461 + 461 + 982 = 1904).

---

## 3. `npx vitest run` — suite complète, rejouée 3 fois

### Run 1

```
 Test Files  279 passed | 5 skipped (284)
      Tests  8326 passed | 21 skipped | 26 todo (8373)
   Start at  02:24:23
   Duration  16.53s (transform 14.83s, setup 2.01s, import 47.10s, tests 76.22s, environment 24.39s)
```
Fichiers en échec : **aucun**.

### Run 2

```
 Test Files  279 passed | 5 skipped (284)
      Tests  8326 passed | 21 skipped | 26 todo (8373)
   Start at  02:24:43
   Duration  17.36s (transform 17.52s, setup 2.46s, import 49.31s, tests 83.48s, environment 23.28s)
```
Fichiers en échec : **aucun**.

### Run 3

```
 Test Files  279 passed | 5 skipped (284)
      Tests  8326 passed | 21 skipped | 26 todo (8373)
   Start at  02:25:03
   Duration  17.54s (transform 16.82s, setup 2.53s, import 49.99s, tests 83.93s, environment 23.36s)
```
Fichiers en échec : **aucun**.

### Synthèse des 3 runs

| Run | Fichiers | Tests passed | Skipped | Todo | Échecs |
|---|---|---|---|---|---|
| 1 | 284 (279 passed + 5 skipped) | 8326 | 21 | 26 | 0 |
| 2 | 284 (279 passed + 5 skipped) | 8326 | 21 | 26 | 0 |
| 3 | 284 (279 passed + 5 skipped) | 8326 | 21 | 26 | 0 |

**8326 tests passés à chaque run, 0 échec, résultat rigoureusement identique run par run.**

L'instabilité signalée sous charge parallèle sur `aliment-form-dialog.test.tsx`, `apport-form-dialog.test.tsx`, `journal-form-dialog.test.tsx`, `poste-form-dialog.test.tsx`, `scenario-form-dialog.test.tsx`, `vague-prevue-form-dialog.test.tsx` et `render-pdf-safely.test.ts` **ne s'est reproduite dans aucun des 3 runs** exécutés ici. Aucune assertion n'a été affaiblie, aucun `retry` ajouté, aucun test marqué `skip` pour tenter de la faire disparaître — ces 3 runs sont des exécutions brutes de `npx vitest run` sans aucune modification de configuration ni de code.

**Écart vs l'attendu de l'énoncé (« environ 8326 tests, 0 échec, base avant sprint : 282 fichiers, 7666 tests hors DB-gated ») :** le total de fichiers observé est **284** (279 passed + 5 skipped), pas 282. Le nombre de tests passants (8326) correspond exactement à l'attendu. Cet écart de 2 fichiers n'a pas été investigué plus avant (hors périmètre strict de la commande demandée) — signalé ici pour traçabilité, ce n'est pas un échec.

---

## 4. `npm run build`

```
✓ Compiled successfully in 12.6s
```

Aucune erreur, aucun `failed` dans la sortie complète. Le build liste toutes les routes (dont `/previsions/scenarios`, `/previsions/scenarios/[id]`) en mode `ƒ` (server-rendered on demand), rien d'anormal.

**Résultat : OK.**

---

## 5. Fixtures du jeu d'or (`prisma/fixtures/previsions/`)

```
$ git status --porcelain prisma/fixtures/previsions/
(vide)

$ git diff --stat prisma/fixtures/previsions/
(vide)

$ git ls-files prisma/fixtures/previsions/
prisma/fixtures/previsions/Previsions_Elevage_Silure_v12.xlsx
prisma/fixtures/previsions/README.md
prisma/fixtures/previsions/annexe-b-corrigee.json
prisma/fixtures/previsions/extract-golden.py
prisma/fixtures/previsions/plan-v12-corrige.json
```

Checksums SHA-256 actuels (pour référence future, aucune divergence détectée par `git diff`/`git status` — ces 5 fichiers sont trackés et identiques à HEAD) :

```
9ff571994f698de3e2e55325bbd2016617df7024b8b245f9435e0ca44e23f91f  Previsions_Elevage_Silure_v12.xlsx
3607571c3a6ad319838f45140c70bfad2bd8c2977a326afaf517c9a466d5a0a5  annexe-b-corrigee.json
d8576a277d3e975e159ded1c6b8068ade00b97bcb9b5ebd8c4ae3a19baa24db1  README.md
a35ee68fb29ba00ce8918d19163721b6d327f4cd085077cc3e3cfb8a6336e088  extract-golden.py
668b48888f0c447ae7213a7a05f3d49ee14f59357e5445bcbf7690ecbd8452cd  plan-v12-corrige.json
```

**Résultat : intact, aucune modification depuis HEAD.**

---

## 6. Scénario `EXCEL-V12` — vérification en lecture seule

Toutes les requêtes ci-dessous sont des `SELECT` purs, exécutées via `docker exec -i silures-db psql`. Aucun `UPDATE`/`INSERT`/`DELETE` n'a été exécuté.

```sql
SELECT id, code, nom, statut FROM "ScenarioPrevision" WHERE code = 'EXCEL-V12';
```
```
            id             |   code    |             nom             |  statut
---------------------------+-----------+-----------------------------+-----------
 cmsdnypml0000n4ekuadykn0f | EXCEL-V12 | Plan de reference Excel v12 | BROUILLON
(1 row)
```

```sql
SELECT count(*) as nb_vagues, sum("effectifAlevinsPrevu") as total_alevins
FROM "VaguePrevue" WHERE "scenarioId"='cmsdnypml0000n4ekuadykn0f';
```
```
 nb_vagues | total_alevins
-----------+---------------
        19 |        602500
(1 row)
```

```sql
SELECT "tailleGranule", ordre FROM "AlimentPrevision"
WHERE "scenarioId"='cmsdnypml0000n4ekuadykn0f' ORDER BY ordre;
```
```
 tailleGranule | ordre
---------------+-------
 G1            |     0
 G2            |     1
 G3            |     2
(3 rows)
```

```sql
SELECT "poidsObjectifG" FROM "ParametresPrevision" WHERE "scenarioId"='cmsdnypml0000n4ekuadykn0f';
```
```
           poidsObjectifG
------------------------------------
 400.000000000000000000000000000000
(1 row)
```

```sql
SELECT sum("effectifAlevinsPrevu") * (SELECT "poidsObjectifG" FROM "ParametresPrevision"
  WHERE "scenarioId"='cmsdnypml0000n4ekuadykn0f') / 1000000 as tonnes
FROM "VaguePrevue" WHERE "scenarioId"='cmsdnypml0000n4ekuadykn0f';
```
```
               tonnes
------------------------------------
 241.000000000000000000000000000000
(1 row)
```

```sql
SELECT "tauxEpargnePct" FROM "ParametresPrevision" WHERE "scenarioId"='cmsdnypml0000n4ekuadykn0f';
```
```
          tauxEpargnePct
-----------------------------------
 30.000000000000000000000000000000
(1 row)
```

**Résultat : conforme sur tous les points** — 3 calibres G1/G2/G3, 19 vagues, 602 500 alevins, 241 t (602 500 × 400 g ÷ 1 000 000), `tauxEpargnePct` = 30. Aucune écriture effectuée.

---

## 7. Parité i18n `src/messages/fr/previsions.json` / `src/messages/en/previsions.json`

Vérification par script indépendant (Node, comparaison d'ensembles de clés aplaties + recherche de références littérales dans `src/`), pas à l'œil.

```
Total FR keys: 407
Total EN keys: 407

Missing in EN (present in FR only):
(none)

Missing in FR (present in EN only):
(none)
```

**Parité de clés : totale — 407 clés de chaque côté, aucune manquante d'un côté ou de l'autre.**

### Clés potentiellement mortes

Le script a d'abord flaggé un grand nombre de faux positifs (clés référencées uniquement via des template literals dynamiques, ex. `` t(`parametresTab.fields.${key}.label`) ``, `` t(`planVaguesTab.statuts.${v.statut}`) ``, `` t(`previsionsMensuellesTab.rows.${i18nKey}.label`) ``). Vérification manuelle par `grep` ciblé sur chaque groupe flaggé (`parametresTab.fields.*`, `parametresTab.transportFields.*`, `planVaguesTab.statuts.*`, `list.statuts.*`, `previsionsMensuellesTab.rows.*.label`/`.formule`) : **toutes sont référencées dynamiquement**, aucune n'est réellement morte.

Recherche ciblée des clés connues :

```
$ grep -rn "detailTitle\|backToList" src/ --include="*.tsx" --include="*.ts" | grep -v test
(aucune sortie)

$ grep -rn "sectionToggleAria" src/ --include="*.tsx" --include="*.ts" | grep -v test
(aucune sortie)

$ grep -n "sectionToggleAria" src/messages/fr/previsions.json src/messages/en/previsions.json
(aucune sortie)
```

- `page.detailTitle` et `page.backToList` : **confirmées mortes**, comme annoncé — connues et hors périmètre de ce sprint.
- `sectionToggleAria` : **confirmée absente des deux fichiers JSON** — a bien disparu, comme attendu suite au correctif post-livraison sur l'en-tête de section collant.
- **Aucune autre clé morte** trouvée au-delà des deux déjà connues.

---

## 8. R11 — Aucun secret en dur

Scan `gitleaks` (config du dépôt `.gitleaks.toml`, qui étend le jeu de règles par défaut) exécuté sur une copie des fichiers touchés par les travaux Prévisions (dernier commit `d789ce7` + working tree courant), soit 237 fichiers.

```
$ gitleaks detect --source <copie> --no-git --config .gitleaks.toml -v

Finding:     ...xport DATABASE_URL="postgresql://<user>:<password>@localhost:8432/farm-flow"
Secret:      postgresql://<user>:<password>@localhost:8432
RuleID:      connection-string-with-credentials
Entropy:     4.681654
Tags:        [connection-string credentials]
File:        docs/tests/rapport-story-PR1.4.md
Line:        263
Fingerprint: docs/tests/rapport-story-PR1.4.md:connection-string-with-credentials:263

INF scanned ~3787835 bytes (3.79 MB) in 284ms
WRN leaks found: 1
```

**1 résultat trouvé, à signaler explicitement — pas à corriger ici (interdiction de modifier le code/docs) :**

- **Fichier :** `docs/tests/rapport-story-PR1.4.md`, ligne 263
- **Contenu :** `export DATABASE_URL="postgresql://<user>:<password>@localhost:8432/farm-flow"` (valeur réelle redigée dans ce rapport, cf. note ci-dessous) dans un bloc de commande copié-collé pour reproduire un run de tests (section « `npx vitest run` (DATABASE_URL exportée, cf. ERR-118) »).
- **Nature :** identifiant réel de la base **locale de développement** (Docker, port 8432), **pas** un identifiant de production.
- **Statut R11 :** ce fichier appartient au dépôt (déjà committé dans `d789ce7`, `git status` le montre propre, aucune modification en cours) — il n'a pas été touché par les stories PR2q.1-PR2q.4 de ce sprint précisément (il date de la story PR1.4, sprint antérieur), mais il fait partie du périmètre balayé ici car c'est un fichier Prévisions du dépôt actuel. **Il viole la lettre de R11** (« aucun secret en dur... dans aucun fichier du dépôt, quel qu'il soit »), même si le risque réel est faible (identifiant de dev local, pas de production). Signalé pour arbitrage — pas corrigé par ce testeur (hors mandat).
- **Aucun autre résultat.** Le reste des 237 fichiers scannés (code de production, tests, migrations, fixtures, docs du sprint PR2-quinquies proprement dit) est propre.

---

## 9. Confirmation des 3 « cassages volontaires » restaurés

Vérification par lecture du code + exécution des tests correspondants.

### `calculerEpargne` (`src/lib/previsions/tresorerie.ts`)

```ts
export function calculerEpargne(resultat: Decimal, tauxEpargnePct: Decimal): Decimal {
  return Decimal.max(0, resultat).times(tauxEpargnePct).dividedBy(100);
}
```
Formule correcte : `max(0, resultat) × tauxEpargnePct / 100`, comme documenté en JSDoc (« un mois deficitaire n'epargne rien »).

### Accumulation du `ceil` par granulométrie (`src/lib/previsions/route-orchestration.ts`)

```ts
for (const [alimentId, parMois] of kgParGranulometrieEtMois) {
  const kgDuMois = parMois.get(m);
  if (!kgDuMois || kgDuMois.lte(0)) continue;
  besoinAlimentsTotalKgDuMois = besoinAlimentsTotalKgDuMois.plus(kgDuMois);
  const aliment = scenario.aliments.find((a) => a.id === alimentId)!;
  const sacs = ceilViaMoteur(alimentId, poidsSacKgReference(aliment.articles), kgDuMois);
  sacsAlimentsDuMois = sacsAlimentsDuMois.plus(sacs);
  sacsParGranulometrieDuMois[aliment.tailleGranule] =
    (sacsParGranulometrieDuMois[aliment.tailleGranule] ?? 0) + sacs;
}
```
Correct : le `ceil` est appliqué séparément par granulométrie (`ceilViaMoteur` par `alimentId`/mois), jamais sommé en KG bruts multi-granulométries avant un seul `ceil` global.

### Filtre de `ventilerDepensesParPoste` (`src/lib/previsions/ventilations.ts`)

```ts
const postesInclus = postes.filter((p) => p.inclusBaseRepartition);
...
for (const j of journal) {
  if (j.categorie !== CategorieJournalPrevu.OPERATIONNEL || j.vaguePrevueId !== null) continue;
  ...
}
```
Correct : reproduit exactement le filtre de `calculerBaseRepartition` (postes `inclusBaseRepartition = true` uniquement, journal `OPERATIONNEL` sans `vaguePrevueId`).

### Tests correspondants

```
$ npx vitest run src/lib/previsions/__tests__/tresorerie.test.ts src/lib/previsions/__tests__/ventilations.test.ts src/lib/previsions/__tests__/recette/route-orchestration.recette.test.ts

 ✓ src/lib/previsions/__tests__/tresorerie.test.ts (8 tests) 3ms
 ✓ src/lib/previsions/__tests__/ventilations.test.ts (6 tests) 3ms
 ✓ src/lib/previsions/__tests__/recette/route-orchestration.recette.test.ts (982 tests) 21ms

 Test Files  3 passed (3)
      Tests  996 passed (996)
```

**Résultat : les trois sont confirmés dans leur état correct**, par lecture du code et par le fait que tous les tests correspondants passent (y compris les 982 tests de recette de `route-orchestration.recette.test.ts`, qui couvrent l'accumulation du `ceil` par granulométrie contre le jeu d'or).

---

## Ce qui a échoué / n'a pas pu être vérifié

- **Rien n'a échoué** parmi les commandes 1 à 4 (migrate deploy, recette, suite complète ×3, build) : tous verts, 0 échec, résultats identiques run par run.
- **Écart mineur documenté (pas un échec) :** l'énoncé indiquait une base avant sprint de « 282 fichiers » ; les 3 runs observent 284 fichiers (279 passed + 5 skipped). Le nombre de tests passants (8326) correspond exactement à l'attendu. Non investigué plus avant — hors mandat de cette vérification.
- **Instabilité `*-form-dialog.test.tsx` / `render-pdf-safely.test.ts` sous charge parallèle :** **non reproduite** dans les 3 runs exécutés ici (config par défaut, aucun réglage de concurrence modifié). Ne peut donc pas être confirmée ni infirmée de façon définitive sur la seule base de ces 3 exécutions — signalé tel quel, sans conclusion forcée.
- **R11 — 1 violation trouvée, depuis corrigée par @knowledge-keeper (cf. ERR-159) :** `docs/tests/rapport-story-PR1.4.md:263` contenait un identifiant réel de la base de développement locale en dur dans un bloc de commande. Ce n'est pas un secret de production, mais violait la lettre de R11. La ligne a été remplacée par un placeholder (`<user>:<password>`) ; la valeur réelle reste présente dans l'historique git de ce fichier (hors mandat de rotation/réécriture d'historique du knowledge-keeper — signalé pour arbitrage éventuel par @project-manager).
- **Vérification EXCEL-V12 :** entièrement effectuée, entièrement conforme — aucune limite rencontrée.
- **Fixtures du jeu d'or :** entièrement vérifiées, aucune modification détectée.
- **Parité i18n :** entièrement vérifiée par script indépendant, parité totale confirmée, aucune clé morte au-delà des deux déjà connues (`page.detailTitle`, `page.backToList`), `sectionToggleAria` confirmée disparue des deux fichiers.
- **Les 3 cassages volontaires :** tous les trois confirmés restaurés dans leur état correct, par lecture de code et tests passants.
