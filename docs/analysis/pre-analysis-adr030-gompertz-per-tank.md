# Pré-analyse ADR-030 — Gompertz per-tank (GompertzBac) — 2026-04-05

## Statut : GO AVEC RÉSERVES

## Résumé

ADR-030 est bien spécifié et les fondations d'ADR-028 et ADR-029 sont correctement en place dans le code. La mise en oeuvre nécessite une migration Prisma (nouvelle table + extension d'enum), des modifications dans 6 fichiers existants, et la création d'un nouveau fichier de test. Quatre points d'attention ont été identifiés : l'enum `StrategieInterpolation` doit suivre le pattern RECREATE (ERR-001), le fichier de test `gompertz.test.ts` référencé par ADR-030 n'existe pas encore, le `methodeRank` de `segmenterPeriodesAlimentaires` hard-code 4 valeurs et doit être mis à jour, et les tests pré-existants échouant (24 tests, 8 suites) sont hors périmètre ADR-030 et ne bloquent pas l'implémentation.

---

## Vérifications effectuées

### 1. Cohérence Schema Prisma courant vs ADR-030

**Schema Prisma — Statut actuel :**

- `StrategieInterpolation` enum : contient `LINEAIRE` et `GOMPERTZ_VAGUE`. Manque `GOMPERTZ_BAC`. Conforme à ce qu'ADR-030 doit étendre.
- `GompertzVague` : présent, correctement structuré (`wInfinity, k, ti, r2, rmse, biometrieCount, confidenceLevel, configWInfUsed, siteId, calculatedAt, updatedAt`). Sert de référence directe pour `GompertzBac`.
- `GompertzBac` : absent du schema. Doit être créé.
- `Bac` : présent, pas de relation `gompertz GompertzBac?`. Doit être ajoutée.
- `Vague` : présent, a `gompertz GompertzVague?`. Manque `gompertzBacs GompertzBac[]`. Doit être ajouté.
- `Site` : a `gompertzVagues GompertzVague[]`. Manque `gompertzBacs GompertzBac[]`. Doit être ajouté.
- `ConfigElevage` : a `interpolationStrategy StrategieInterpolation @default(LINEAIRE)`. Fonctionnera automatiquement après extension de l'enum.

**Conclusion schema :** 4 modifications + 1 nouveau modèle requis, tous documentés dans ADR-030.

### 2. Cohérence Types TypeScript vs ADR-030

**`src/types/models.ts` :**
- `StrategieInterpolation` enum : contient `LINEAIRE = "LINEAIRE"` et `GOMPERTZ_VAGUE = "GOMPERTZ_VAGUE"`. Manque `GOMPERTZ_BAC = "GOMPERTZ_BAC"`.
- Interface `ConfigElevage` : a `interpolationStrategy: StrategieInterpolation`. OK.
- Interface `GompertzVague` : présente mais dans la section des modèles Prisma (non lue dans les 150 premières lignes — confirmé par grep). Elle existe dans le fichier. `GompertzBac` n'existe pas. Doit être ajoutée.

**`src/types/calculs.ts` :**
- `PeriodeAlimentaire.methodeEstimation` : union actuelle = `"BIOMETRIE_EXACTE" | "GOMPERTZ_VAGUE" | "INTERPOLATION_LINEAIRE" | "VALEUR_INITIALE"`. Manque `"GOMPERTZ_BAC"`.

**`src/types/index.ts` :**
- `StrategieInterpolation` est bien exporté (ligne 47).
- `PeriodeAlimentaire` est bien exporté (ligne 538).
- Aucun export `GompertzBac` pour l'instant — devra être ajouté lors de l'ajout de l'interface dans `models.ts`.

**Conclusion types :** 3 modifications requises, toutes documentées.

### 3. Cohérence `src/lib/feed-periods.ts` vs ADR-030

**État actuel :**
- `GompertzVagueContext` : exportée, conforme à la spec ADR-029.
- `GompertzBacContext` : absente. Doit être ajoutée.
- `interpolerPoidsBac` : signature actuelle = `(targetDate, bacId, biometries, poidsInitial, options?)`. Le paramètre `options` accepte `{ strategie?, gompertzContext?, gompertzMinPoints? }`. Manque `gompertzBacContexts?: Map<string, GompertzBacContext>`.
- `segmenterPeriodesAlimentaires` : signature actuelle passée à `interpolerPoidsBac` via `options`. Le paramètre `options` de `segmenterPeriodesAlimentaires` manque aussi `gompertzBacContexts?`.

**Point d'attention critique — `methodeRank` :**
La fonction interne `methodeRank` (ligne 340-347) est définie en dur dans `segmenterPeriodesAlimentaires` :
```typescript
if (m === "BIOMETRIE_EXACTE") return 3;
if (m === "GOMPERTZ_VAGUE") return 2;
if (m === "INTERPOLATION_LINEAIRE") return 1;
return 0; // VALEUR_INITIALE
```
ADR-030 introduit `GOMPERTZ_BAC` avec rang 3 (entre BIOMETRIE_EXACTE et GOMPERTZ_VAGUE). Les rangs devront être recalculés :
- `BIOMETRIE_EXACTE` → 4
- `GOMPERTZ_BAC` → 3
- `GOMPERTZ_VAGUE` → 2
- `INTERPOLATION_LINEAIRE` → 1
- `VALEUR_INITIALE` → 0

Cette fonction n'est pas exportée (interne à la closure). La modifier est sans risque sur l'API publique, mais les tests existants qui vérifient le rang de qualité devront être vérifiés.

**Conclusion feed-periods :** 1 nouvelle interface, 2 signatures de fonctions étendues, 1 nouvelle branche de logique (étape 2a GOMPERTZ_BAC), et mise à jour de `methodeRank`.

### 4. Cohérence `src/lib/gompertz.ts` vs ADR-030

**Aucune modification requise.** ADR-030 confirme que `isCachedGompertzValid`, `calibrerGompertz`, `gompertzWeight` sont utilisables tels quels. La signature de `isCachedGompertzValid` est structurelle (duck typing) :
```typescript
record: { wInfinity, confidenceLevel, biometrieCount, configWInfUsed } | null
```
Un enregistrement `GompertzBac` possède exactement ces champs. Réutilisation confirmée sans modification.

### 5. Cohérence `src/app/api/vagues/[id]/gompertz/route.ts` vs ADR-030

**État actuel de la route :**
- Calibre un seul `GompertzVague` avec biométries agrégées en moyenne pondérée par date.
- Upsert sur `prisma.gompertzVague`.
- Retourne `{ vagueId, calibration, courbe, dateRecolteEstimee }`.

**Modifications requises (section 8 d'ADR-030) :**
1. Après la calibration vague, une boucle per-bac doit être ajoutée.
2. Chaque bac filtre ses propres biométries (`r.bacId === bac.id`).
3. Upsert sur `prisma.gompertzBac` pour chaque bac.
4. La réponse JSON est étendue avec `calibrationsBacs: { bacId, calibration }[]`.

**Note sur le guard `r.bacId ?`** (documenté dans ADR-030 section "Biométries par bac") : dans le code actuel, la route utilise `r.bacId` sans guard (ligne 155 : `(r.bacId ? vivantsByBac.get(r.bacId) : undefined)`). Ce guard existe bien pour l'agrégation vague, mais pour la boucle per-bac il faudra filtrer `biometriesRaw.filter(r => r.bacId === bac.id)`.

**Conclusion route gompertz :** Modifications substantielles mais bien bornées. La route est correctement structurée pour recevoir la boucle per-tank sans refactoring majeur.

### 6. Cohérence `src/lib/queries/analytics.ts` vs ADR-030

**État actuel (lignes 522-692) :**
- `interpolationStrategy` est déjà sélectionné dans la query Prisma.
- `gompertzContext` est construit conditionnellement (`interpolStrategy === GOMPERTZ_VAGUE`).
- `segmenterPeriodesAlimentaires` est appelé avec `{ strategie, gompertzContext, gompertzMinPoints }`.

**Modifications requises (section 9 d'ADR-030) :**
1. Ajouter `gompertzBacs: { select: { bacId, wInfinity, k, ti, r2, biometrieCount, confidenceLevel } }` dans le select vague.
2. Construire `gompertzBacContexts: Map<string, GompertzBacContext>` conditionnellement si `interpolStrategy === GOMPERTZ_BAC`.
3. Passer `gompertzBacContexts` à `segmenterPeriodesAlimentaires`.

**Point de vigilance :** Le code actuel construit `gompertzContext` uniquement si `interpolStrategy === GOMPERTZ_VAGUE`. Pour `GOMPERTZ_BAC`, ADR-030 spécifie que `gompertzContext` (vague) doit **aussi** être construit car il sert de fallback. La condition devra être `interpolStrategy === GOMPERTZ_VAGUE || interpolStrategy === GOMPERTZ_BAC` pour le gompertzContext vague.

### 7. Migration Prisma — risques ERR-001 et ERR-038

**ERR-001 (ADD VALUE + UPDATE dans la même transaction) :** ADR-030 utilise la stratégie RECREATE pour l'enum. Le SQL de migration fourni est correct :
```sql
ALTER TYPE "StrategieInterpolation" RENAME TO "StrategieInterpolation_old";
CREATE TYPE "StrategieInterpolation" AS ENUM ('LINEAIRE', 'GOMPERTZ_VAGUE', 'GOMPERTZ_BAC');
ALTER TABLE "ConfigElevage" ALTER COLUMN "interpolationStrategy" TYPE "StrategieInterpolation"
  USING "interpolationStrategy"::text::"StrategieInterpolation";
DROP TYPE "StrategieInterpolation_old";
```
Conforme à ERR-001. Aucune valeur existante cassée.

**ERR-038 (dérive de schéma parasite dans le diff) :** Le db-specialist devra inspecter le SQL généré par `migrate diff` avant de le valider, car la base locale peut avoir de la dérive depuis ADR-029. Procédure :
```bash
npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script > /tmp/check.sql
cat /tmp/check.sql
```
Ne valider que les clauses relatives à `StrategieInterpolation` et `GompertzBac`.

### 8. Fichiers de test

**`src/__tests__/lib/feed-periods.test.ts` : PRÉSENT.**
Le fichier existe et contient les tests ADR-028 et ADR-029. Les cas ADR-030 doivent y être ajoutés (section "Cas de test requis" d'ADR-030 liste 13 cas précis).

**`src/__tests__/api/gompertz.test.ts` : ABSENT.**
ADR-030 liste ce fichier dans le tableau "Impact sur les fichiers existants" avec l'action "Modifier". Mais le fichier n'existe pas. Il devra être **créé** (pas modifié). Ce point est incorrect dans l'ADR — à noter pour le @knowledge-keeper.

### 9. Build

**Statut : OK.** `npm run build` compilé sans erreur (✓ Compiled successfully in 16.1s).

### 10. Tests

**Statut : 24 échecs pré-existants sur 4196 tests, aucun lié à ADR-030.**

Suites échouantes :
- `src/__tests__/permissions.test.ts` — comptage PERMISSION_GROUPS (pre-existant)
- `src/__tests__/api/abonnements-statut-middleware.test.ts` — 8 tests (abonnements)
- `src/__tests__/api/bacs.test.ts` — 1 test quotas DECOUVERTE
- `src/__tests__/api/vagues-distribution.test.ts` — 4 tests bacDistribution
- `src/__tests__/api/vagues.test.ts` — 4 tests POST vague
- `src/__tests__/integration/quota-enforcement.test.ts` — 1 test DECOUVERTE
- `src/__tests__/middleware/proxy-redirect.test.ts` — 2 tests INGENIEUR redirects

Tous ces échecs sont antérieurs à ADR-030 et concernent des features hors périmètre. Les tests `feed-periods.test.ts` et `gompertz.test.ts` (inexistant) sont les seuls pertinents pour ADR-030.

---

## Inventaire complet des fichiers

### Fichiers à créer

| Fichier | Description |
|---------|-------------|
| `prisma/migrations/[timestamp]_add_gompertz_bac/migration.sql` | Extension enum `StrategieInterpolation` + création table `GompertzBac` |
| `src/__tests__/api/gompertz.test.ts` | Nouveau fichier (noté "Modifier" dans ADR-030 — erreur dans l'ADR, le fichier est absent) |

### Fichiers à modifier

| Fichier | Modifications |
|---------|---------------|
| `prisma/schema.prisma` | Enum `StrategieInterpolation` + `GOMPERTZ_BAC`, nouveau modèle `GompertzBac`, relations dans `Bac`/`Vague`/`Site` |
| `src/types/models.ts` | `StrategieInterpolation` + `GOMPERTZ_BAC`, nouvelle interface `GompertzBac` |
| `src/types/calculs.ts` | `PeriodeAlimentaire.methodeEstimation` + `"GOMPERTZ_BAC"` |
| `src/lib/feed-periods.ts` | Interface `GompertzBacContext`, signatures `interpolerPoidsBac` et `segmenterPeriodesAlimentaires`, logique étape 2a, `methodeRank` 0→4 |
| `src/app/api/vagues/[id]/gompertz/route.ts` | Boucle per-tank, upsert `GompertzBac`, réponse JSON étendue |
| `src/lib/queries/analytics.ts` | Select `gompertzBacs`, construction `gompertzBacContexts`, condition `gompertzContext` étendue, passage à `segmenterPeriodesAlimentaires` |
| `src/__tests__/lib/feed-periods.test.ts` | 13 nouveaux cas de test ADR-030 |

### Fichiers inchangés

| Fichier | Raison |
|---------|--------|
| `src/lib/gompertz.ts` | `isCachedGompertzValid`, `calibrerGompertz`, `gompertzWeight` réutilisables sans modification |
| `src/types/index.ts` | Export `StrategieInterpolation` déjà présent ; export `GompertzBac` sera hérité automatiquement si l'interface est dans `models.ts` |

---

## Incohérences trouvées

### INC-01 — ADR-030 indique "Modifier" pour `gompertz.test.ts` mais le fichier n'existe pas
**Fichier :** `docs/decisions/ADR-030-gompertz-per-tank.md` section "Impact sur les fichiers existants"
**Problème :** Le tableau note `src/__tests__/api/gompertz.test.ts` avec l'action "Modifier". Le fichier est absent.
**Fix :** Le @tester doit **créer** ce fichier. Aucun impact sur l'implémentation.

### INC-02 — `gompertzContext` vague doit être construit aussi pour la stratégie `GOMPERTZ_BAC`
**Fichier :** `src/lib/queries/analytics.ts` (lignes 670-672)
**Problème actuel :**
```typescript
const gompertzContext =
  gompertz && interpolStrategy === StrategieInterpolation.GOMPERTZ_VAGUE ? { ... } : undefined;
```
**Problème :** Quand `interpolStrategy === GOMPERTZ_BAC`, `gompertzContext` sera `undefined`. Mais la chaîne de fallback d'ADR-030 exige que si un bac échoue à obtenir un `GompertzBac` valide, il tente `GOMPERTZ_VAGUE` avec le contexte vague. Si `gompertzContext` est `undefined`, le fallback échoue silencieusement et retombe directement sur `INTERPOLATION_LINEAIRE`.
**Fix :** Changer la condition en :
```typescript
const gompertzContext =
  gompertz && (interpolStrategy === StrategieInterpolation.GOMPERTZ_VAGUE ||
               interpolStrategy === StrategieInterpolation.GOMPERTZ_BAC)
    ? { ... }
    : undefined;
```
**Sévérité :** Haute — sans ce fix, le fallback GOMPERTZ_BAC → GOMPERTZ_VAGUE est non-fonctionnel.

### INC-03 — `methodeRank` non exporté, hard-codé sur 4 valeurs, doit gérer 5 valeurs
**Fichier :** `src/lib/feed-periods.ts` (lignes 340-348)
**Problème :** La fonction interne `methodeRank` assigne rang 3 à `BIOMETRIE_EXACTE`, rang 2 à `GOMPERTZ_VAGUE`, rang 1 à `INTERPOLATION_LINEAIRE`, rang 0 sinon. Après ADR-030, `GOMPERTZ_BAC` doit avoir rang 3 et `BIOMETRIE_EXACTE` rang 4. Les tests existants qui vérifient `methodeRank` indirectement (via `methodeEstimation` dans les `PeriodeAlimentaire` retournées) pourraient être affectés si des périodes avec `GOMPERTZ_VAGUE` sont comparées à des périodes avec `GOMPERTZ_BAC`.
**Fix :** Mettre à jour les rangs : BIOMETRIE_EXACTE=4, GOMPERTZ_BAC=3, GOMPERTZ_VAGUE=2, INTERPOLATION_LINEAIRE=1, VALEUR_INITIALE=0. Vérifier que les tests existants passent toujours.
**Sévérité :** Haute — sans ce fix, une période dont le début est estimé en `GOMPERTZ_BAC` et la fin en `BIOMETRIE_EXACTE` retournerait incorrectement `methodeEstimation = "GOMPERTZ_BAC"` au lieu de `"BIOMETRIE_EXACTE"` (car le rang serait 3=3, et la condition `<=` favoriserait le début).

---

## Risques identifiés

### R1 — Migration enum RECREATE + dérive possible (ERR-001 + ERR-038)
**Impact :** Migration échoue ou inclut des changements parasites hors périmètre.
**Mitigation :** Inspecter le SQL de `migrate diff` avant tout `migrate deploy`. Utiliser exactement le SQL RECREATE fourni dans ADR-030. Créer le fichier de migration manuellement plutôt que via `migrate dev` (pattern documenté dans MEMORY.md).

### R2 — Boucle per-tank dans la route gompertz : N calibrations LM au premier appel
**Impact :** Temps de réponse élevé lors du premier appel après activation de `GOMPERTZ_BAC` sur une vague à 4 bacs (5 calibrations LM). ADR-030 estime < 50ms total — acceptable.
**Mitigation :** Aucune requise. La calibration est lazy (déclenchée à la demande).

### R3 — Tests pré-existants échouants : non-régression incertaine
**Impact :** 24 tests échouent avant l'implémentation. Après ADR-030, il sera difficile de distinguer une régression introduite d'un échec pré-existant.
**Mitigation :** Le @tester doit documenter les 8 suites échouantes dans son rapport et vérifier que seules ces 8 suites échouent après l'implémentation (pas de nouvelles suites en échec).

### R4 — `types/index.ts` : export de `GompertzBac` à ne pas oublier
**Impact :** Si l'interface `GompertzBac` est ajoutée dans `models.ts` sans être réexportée depuis `types/index.ts`, les imports via `@/types` échoueront au build.
**Mitigation :** Vérifier après implémentation que `GompertzBac` est exportée depuis `src/types/index.ts`.

---

## Prérequis manquants

Aucun prérequis bloquant. ADR-028 et ADR-029 sont tous deux implémentés et compilent. La base de données locale est opérationnelle (Docker PostgreSQL sur port 8432).

---

## Recommandation

**GO** — démarrer l'implémentation en respectant l'ordre du plan d'ADR-030, avec les corrections suivantes obligatoires :

1. **@db-specialist** : lors de la migration, inspecter le SQL généré (ERR-038) et utiliser le pattern RECREATE pour l'enum (ERR-001).
2. **@developer** : corriger la condition de construction de `gompertzContext` dans `analytics.ts` (INC-02) pour inclure `GOMPERTZ_BAC`.
3. **@developer** : mettre à jour `methodeRank` dans `feed-periods.ts` (INC-03) avec les 5 rangs.
4. **@tester** : créer (pas modifier) `src/__tests__/api/gompertz.test.ts` (INC-01), et documenter les 8 suites pré-échouantes pour distinguer les régressions.
