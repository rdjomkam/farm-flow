# Rapport de test — Clôture technique du sprint PR2-octies

**Testeur :** @tester
**Périmètre :** levée de 2 réserves Moyennes de la review UI/typage, snapshot de protection des
données APRÈS, vérification finale du sprint (R9).
**Références :** CLAUDE.md (R1-R11), ERR-157, ERR-170,
`docs/analysis/snapshot-avant-sprint-PR2-octies.md`, `rapport-story-PR2oct.3.md`,
`rapport-story-PR2oct.4.md`.

## 1. Tâche 1 — Vérification navigateur réelle à exactement 360px (ERR-157)

Playwright + Chromium, viewport `{ width: 360, height: 740 }` (pas 375), contre le serveur dev déjà
lancé (`http://localhost:4200`, DB Docker `silures-db` déjà up), connecté `admin@dkfarm.cm` /
`admin123`, site « Ferme Douala » sélectionné, scénario `EXCEL-V12`
(`cmsdnypml0000n4ekuadykn0f`).

**Résultat factuel, mesures DOM réelles (bounding box, pas la classe CSS) :**

| Élément | Observation à 360px |
|---|---|
| Checkbox `alevinsAchetes` (dialogue « Nouvelle vague planifiée ») | `<label>` visible et cliquable, box `{x:16, y:398.5, width:328, height:44}` — cible tactile 44px confirmée |
| Checkbox `alevinsAchetesParDefaut` (onglet Paramètres) | `<label>` visible et cliquable, box `{x:32, y:1242, width:296, height:44}` — cible tactile 44px confirmée |
| Hint `prixAlevinUnitaireFCFA` (« Appliqué uniquement aux vagues dont « Alevins achetés » est actif. ») | Texte intégralement lisible, non tronqué, enroulé sur 2 lignes, aucune collision avec le champ suivant (`Prix de vente prévu`) ni avec la nav bas fixe — capture `360-hint.png` (scratchpad, supprimée après usage) |
| Badges « Production interne » (19 cartes de vagues, `plan-vagues-tab`) | Box type `{x:137, y:337, width:127, height:20}` — largeur badge + décalage x < 360px sur les 5 premières cartes vérifiées, aucun débordement, aucune collision avec le badge de statut « Planifiée » adjacent |
| Console (`console.error` / `pageerror`) | Vide sur toute la navigation (login → sélection site → scénario → dialogue → onglet Paramètres) |

**Verdict : rien ne casse à 360px.** Le hint à 2 lignes redouté par la review (15px de moins qu'à
375px) reste lisible et sans collision — la réserve Moyenne est levée par une mesure réelle, pas
seulement par relecture de code.

Scripts Playwright ad hoc et captures d'écran supprimés du dépôt après usage (jamais commités) —
`git status --short` ne montre aucune trace de ces fichiers temporaires.

## 2. Tâche 2 — Typage `tsc` du harnais de recette

**Cause confirmée** dans `src/lib/previsions/__tests__/recette/helpers.ts:74-79` :
`GoldenFixture.entreesModele.parametresScenario` ne déclarait pas `margeSecuriteAlevinsPct` ni
`prixAlevinUnitaireFCFA`, alors que `route-orchestration-builder.ts:158,162` et
`orchestration.ts:230-232,295-297` les lisent.

**Vérification préalable des fixtures** (`prisma/fixtures/previsions/*.json`) : les deux fichiers
(`annexe-b-corrigee.json`, `plan-v12-corrige.json`) portent bien
`margeSecuriteAlevinsPct: 0.1` et `prixAlevinUnitaireFCFA: 70` (nombres), sous
`entreesModele.parametresScenario`. Le type complété correspond exactement aux clés et types
réels des fixtures — rien d'inventé.

**Fix appliqué** (seul fichier modifié, `__tests__` uniquement) :
```ts
parametresScenario: {
  prixVenteKgFCFA: number;
  poidsMoyenVenteKg: number;
  margeSecuriteAlevinsPct: number;
  prixAlevinUnitaireFCFA: number;
  tauxEpargnePct: number;
  tresorerieInitialeFCFA: number;
};
```
Aucun fichier de production (`src/lib/previsions/*.ts` hors `__tests__`, `src/components/`,
`src/app/`, `prisma/`) touché.

**`npx tsc --noEmit` — avant/après (dépôt entier, pas seulement le module Prévisions) :**

| | Avant | Après |
|---|---|---|
| Total erreurs `tsc` dans le dépôt | **1427** | **1423** |
| dont `orchestration.ts` (2) + `route-orchestration-builder.ts` (2) | 4 | **0** |

Les 4 erreurs ciblées par la review ont disparu, exactement (1427 → 1423 = −4), aucune nouvelle
erreur introduite par le changement de type.

**Le dépôt reste à 1423 erreurs `tsc --noEmit` restantes — je ne prétends pas les avoir nettoyées.**
Elles sont massivement préexistantes et hors du périmètre de cette tâche (ex. `permissions.test.ts`
236, `besoins.test.ts` 194, `depenses-recurrentes.test.ts` 141, `activity-engine/evaluator.test.ts`
141, `depenses.test.ts` 139, `activity-engine/api/regles-activites.test.ts` 118, etc. — aucun
rapport avec `alevinsAchetes`/`margeSecuriteAlevinsPct`/`prixAlevinUnitaireFCFA`). Les seules
erreurs restantes en lien, même indirect, avec le module Prévisions après le fix :
```
src/__tests__/api/previsions-aliments-articles-routes.test.ts(85,65)  — RequestInit Next vs DOM
src/__tests__/api/previsions-auth-permissions.test.ts(187,65)         — RequestInit Next vs DOM
src/__tests__/api/previsions-generer-plan.test.ts(67,65)              — RequestInit Next vs DOM
src/lib/queries/__tests__/previsions-charges.test.ts(161,32)          — Decimal vs number
```
Ces 4 erreurs sont indépendantes de la story PR2oct.3/PR2oct.4 (aucune ne mentionne
`margeSecuriteAlevinsPct` ni `prixAlevinUnitaireFCFA`) — elles ne faisaient pas partie de la
réserve de review et ne sont pas corrigées ici ; signalées au PM pour triage séparé si souhaité.
`npm run build` (le critère R9 retenu par le projet) n'inclut aucune de ces erreurs `tsc` de test.

## 3. Tâche 3 — Snapshot APRÈS et comparaison ligne à ligne

Connexion via `docker exec silures-db psql -U dkfarm -d farm-flow` (R11 respectée, aucune URL/mdp
reproduit). Aucune écriture en base.

### VaguePrevue
```
 count |  sum
-------+--------
    19 | 602500
```
`alevinsAchetes = true` : **0**. Identique à l'AVANT (19 / 602 500 / 0).

### ApportCapital
```
 count
-------
     3
```
Identique à l'AVANT (3).

### AlimentPrevision (3 calibres) + articles + répartitions
```
            id             | tailleGranule | nb_articles |    articles     | nb_repart
---------------------------+---------------+-------------+-----------------+-----------
 cmsdohxam000an4ek4uvjicxb | G1            |           1 | Marque A — 2 mm |         3
 cmsdombck000fn4ekyzhd68hs | G2            |           1 | Marque A — 3 mm |         3
 cmsdop5q4000kn4eknxds3fwf | G3            |           1 | Marque B — 4 mm |         3
```
Identique à l'AVANT (mêmes `id`, mêmes valeurs).

### ParametresPrevision — colonne par colonne

| Colonne | AVANT | APRÈS | Verdict |
|---|---|---|---|
| id | cmsdnypmr0001n4ekirvc1r9s | cmsdnypmr0001n4ekirvc1r9s | identique |
| scenarioId | cmsdnypml0000n4ekuadykn0f | cmsdnypml0000n4ekuadykn0f | identique |
| effectifAlevinsParVague | 10000 | 10000 | identique |
| margeSecuriteAlevinsPct | 10.000000000000000000000000000000 | 10.000000000000000000000000000000 | identique |
| poidsMoyenInitialG | 5.000000000000000000000000000000 | 5.000000000000000000000000000000 | identique |
| poidsObjectifG | 400.000000000000000000000000000000 | 400.000000000000000000000000000000 | identique |
| **prixAlevinUnitaireFCFA** | **0.0000...** | **70.0000...** | **différence autorisée (restauration documentée)** |
| prixVenteKgFCFA | 1900.000000000000000000000000000000 | 1900.000000000000000000000000000000 | identique |
| nombreBacsSimultanesCible | 4 | 4 | identique |
| frequenceStockageMois | 1.000000000000000000000000000000 | 1.000000000000000000000000000000 | identique |
| createdAt | 2026-08-03 20:10:26.499 | 2026-08-03 20:10:26.499 | identique |
| updatedAt | 2026-08-04 06:03:17.707 | 2026-08-04 06:03:17.707 | identique |
| capaciteTransportAlevinsNb | 20000 | 20000 | identique |
| capaciteTransportAlimentsSacs | 60 | 60 | identique |
| capaciteTransportPoissonsKg | 1500 | 1500 | identique |
| coutTransportAlevinsFCFA | 30000.0000... | 30000.0000... | identique |
| coutTransportAlimentsFCFA | 15000.0000... | 15000.0000... | identique |
| coutTransportPoissonsFCFA | 25000.0000... | 25000.0000... | identique |
| tauxEpargnePct | 30.000000000000000000000000000000 | 30.000000000000000000000000000000 | identique |
| **alevinsAchetesParDefaut** | *(colonne absente)* | **f (false)** | **ajout autorisé (nouveau drapeau)** |

### ScenarioPrevision.updatedAt
```
        updatedAt
-------------------------
 2026-08-03 20:10:26.493
```
**Inchangé**, identique à l'AVANT.

### Verdict global — Régression : NON

Les deux seules différences constatées (`prixAlevinUnitaireFCFA` 0 → 70, ajout de
`alevinsAchetesParDefaut = false`) sont exactement les deux différences explicitement autorisées
par le briefing. Toutes les autres lignes/colonnes/comptages sont strictement identiques à l'AVANT
sur les 5 axes vérifiés (VaguePrevue, ApportCapital, AlimentPrevision, ParametresPrevision,
ScenarioPrevision.updatedAt).

## 4. Tâche 4 — Vérification de fin de sprint

### 4.1 `npx prisma migrate deploy`
```
168 migrations found in prisma/migrations
No pending migrations to apply.
```

### 4.2 `npx vitest run src/lib/previsions/__tests__/recette`
```
Test Files  3 passed (3)
     Tests  2458 passed (2458)
```
0 écart, 2 458 assertions — au plancher exigé, aucune diminution (baseline PR2oct.3/4 : 2458).

### 4.3 `npx vitest run` — trois passages consécutifs

```
Run 1 : Test Files 284 passed | 5 skipped (289) — Tests 8977 passed | 21 skipped | 26 todo (9024)
Run 2 : Test Files 284 passed | 5 skipped (289) — Tests 8977 passed | 21 skipped | 26 todo (9024)
Run 3 : Test Files 284 passed | 5 skipped (289) — Tests 8977 passed | 21 skipped | 26 todo (9024)
```
Trois compteurs **strictement identiques**, **0 échec** sur les trois passages. Conforme
exactement à la référence après PR2oct.4 (289 fichiers / 9024 tests dont 8977 passed — la
consigne de mission citait « 8 977 » comme référence des tests *passed*, ce qui correspond).

### 4.4 `npm run build`
```
✓ Compiled successfully in 12.4s
```
Exit propre, aucune erreur.

## 5. Ce qui a échoué ou a été laissé de côté

- **Rien dans le périmètre des 4 tâches n'a échoué.**
- **1423 erreurs `tsc --noEmit` restent dans le dépôt** (contre 1427 avant), très majoritairement
  sans rapport avec le module Prévisions — dette préexistante massive, hors mandat de cette tâche
  (qui ne portait que sur les 4 erreurs `margeSecuriteAlevinsPct`/`prixAlevinUnitaireFCFA`),
  signalée au PM pour triage séparé si souhaité. `npm run build` (critère R9) n'est pas affecté.
- 4 erreurs `tsc` résiduelles avec un lien indirect au module Prévisions
  (`previsions-aliments-articles-routes.test.ts`, `previsions-auth-permissions.test.ts`,
  `previsions-generer-plan.test.ts` — incompatibilité `RequestInit` Next vs DOM ;
  `previsions-charges.test.ts` — comparaison `Decimal`/`number`) ne faisaient pas partie de la
  réserve de review et ne sont pas corrigées ici.

## 6. Fichiers modifiés (chemin absolu)

- `/Users/ronald/project/dkfarm/farm-flow/src/lib/previsions/__tests__/recette/helpers.ts` (type
  `GoldenFixture.entreesModele.parametresScenario`, +2 champs, fichier de test uniquement)

Aucun fichier de production modifié. Aucune écriture en base. Aucun commit, aucun push effectué.
