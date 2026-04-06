# Pré-analyse ADR-029 — Stratégie d'interpolation configurable (Linear vs Gompertz)

**Date :** 2026-04-05
**ADR de référence :** `docs/decisions/ADR-029-config-interpolation-strategy.md`
**Analysé par :** @pre-analyst

---

## Statut : GO AVEC RÉSERVES

---

## Résumé

L'implémentation d'ADR-029 est faisable sans bloquer aucun sprint courant. Les fondations
(modèle `GompertzVague` en DB, fonctions `gompertzWeight`/`calibrerGompertz` dans `src/lib/gompertz.ts`,
type `GompertzParams`) sont toutes en place. Six fichiers doivent être modifiés et une migration
Prisma non-destructive est nécessaire. Les réserves portent sur deux points : (1) l'absence
d'interface TypeScript `GompertzVague` dans `src/types/models.ts` à créer pour la query
`computeAlimentMetrics`, et (2) un travail de refactoring du `methodeRank` dans `feed-periods.ts`
pour intégrer `GOMPERTZ_VAGUE` avec le rang 2.

---

## Vérifications effectuées

### Schema Prisma — ConfigElevage : OK — champ à ajouter

**Modèle `ConfigElevage` existant avec :**
- `gompertzMinPoints Int @default(5)` — champ clé déjà présent (ligne ~795)
- `gompertzWInfDefault`, `gompertzKDefault`, `gompertzTiDefault` — tous présents (Phase 3)
- Relation `vagues Vague[]` existante

**Modèle `GompertzVague` existant avec :**
- `wInfinity`, `k`, `ti`, `r2`, `rmse`, `biometrieCount`, `confidenceLevel String`, `configWInfUsed Float?`
- `siteId` présent (R8 respectée)
- `vagueId @unique` + `onDelete: Cascade` depuis `Vague`

**Ce qui manque dans le schema :**
- L'enum `StrategieInterpolation { LINEAIRE GOMPERTZ_VAGUE }` n'existe pas
- Le champ `interpolationStrategy StrategieInterpolation @default(LINEAIRE)` n'existe pas dans `ConfigElevage`

**Migration requise :**
```sql
CREATE TYPE "StrategieInterpolation" AS ENUM ('LINEAIRE', 'GOMPERTZ_VAGUE');
ALTER TABLE "ConfigElevage"
  ADD COLUMN "interpolationStrategy" "StrategieInterpolation" NOT NULL DEFAULT 'LINEAIRE';
```
Migration non-destructive : toutes les lignes existantes obtiennent `LINEAIRE` (comportement ADR-028 préservé).

### Types TypeScript — src/types/models.ts : PROBLÈME MINEUR

**Ce qui existe :**
- Interface `ConfigElevage` avec `gompertzMinPoints: number` présente
- Enum `PhaseElevage` dans `src/types/models.ts` (pattern réutilisable pour `StrategieInterpolation`)
- `PhaseElevage` est exporté dans `src/types/index.ts` — pattern à suivre pour `StrategieInterpolation`

**Ce qui manque :**
1. L'enum `StrategieInterpolation` n'existe pas dans `src/types/models.ts`
2. Le champ `interpolationStrategy: StrategieInterpolation` manque dans l'interface `ConfigElevage`
3. Pas d'interface TypeScript `GompertzVague` dans `src/types/models.ts` — le modèle existe
   uniquement dans les types générés Prisma (`src/generated/prisma/models/GompertzVague.ts`).
   Ce manque est signalé car `computeAlimentMetrics` devra typer le résultat de la query
   `vague.gompertz` dans `analytics.ts`.

**Note :** `StrategieInterpolation` doit être ajouté dans le barrel `src/types/index.ts`
(section "Sprint 19 — ConfigElevage" existante, à étendre).

### Types calculs — src/types/calculs.ts : PROBLÈME MINEUR

Le type union `PeriodeAlimentaire.methodeEstimation` est actuellement :
```typescript
methodeEstimation: "BIOMETRIE_EXACTE" | "INTERPOLATION_LINEAIRE" | "VALEUR_INITIALE";
```
Il doit être étendu avec `"GOMPERTZ_VAGUE"`. Extension non-cassante : le nouveau literal s'ajoute
à l'union sans supprimer les valeurs existantes.

### src/lib/feed-periods.ts : MODIFICATIONS NÉCESSAIRES

**Signature actuelle de `interpolerPoidsBac` :**
```typescript
export function interpolerPoidsBac(
  targetDate: Date,
  bacId: string | null,
  biometries: BiometriePoint[],
  poidsInitial: number
): { poids: number; methode: PeriodeAlimentaire["methodeEstimation"] } | null
```
Doit recevoir un 5e paramètre optionnel `options?`. Modification rétrocompatible — tous les
appelants existants fonctionnent sans le paramètre.

**`methodeRank` dans `segmenterPeriodesAlimentaires` (lignes 267-274) :**
```typescript
const methodeRank = (m) => {
  if (!m) return 0;
  if (m === "BIOMETRIE_EXACTE") return 2;
  if (m === "INTERPOLATION_LINEAIRE") return 1;
  return 0; // VALEUR_INITIALE
};
```
Ce switch devra intégrer `GOMPERTZ_VAGUE` avec rang 2 (entre `BIOMETRIE_EXACTE` rang 3 et
`INTERPOLATION_LINEAIRE` rang 1). Attention : les rangs actuels devront être renumérotés :
```
BIOMETRIE_EXACTE (3) > GOMPERTZ_VAGUE (2) > INTERPOLATION_LINEAIRE (1) > VALEUR_INITIALE (0)
```

**Interface `GompertzVagueContext` :** à ajouter localement dans `feed-periods.ts` selon la spec ADR-029.

**Fonction `gompertzWeight` réutilisable :** déjà exportée depuis `src/lib/gompertz.ts`. Import
à ajouter dans `feed-periods.ts`. Pas de duplication de code.

### src/lib/queries/analytics.ts : MODIFICATIONS NÉCESSAIRES

**Appel actuel dans `computeAlimentMetrics` (ligne ~648) :**
```typescript
const allPeriodes = segmenterPeriodesAlimentaires(
  relevsAlimPoints,
  biometriePoints,
  vagueCtx
);
```

**Ce qui doit être ajouté :**
1. La query `vagues` (lignes 513-524) ne sélectionne pas `configElevage` ni `gompertz`. Ces deux
   champs doivent être ajoutés au `select`.
2. Un bloc de construction du `gompertzContext` selon le pattern de l'ADR-029 section 7.
3. Le passage des `options` à `segmenterPeriodesAlimentaires`.

**Coût de requête :** une jointure supplémentaire `GompertzVague` (relation `@unique`, déjà indexée)
+ `ConfigElevage` (relation many-to-one, `configElevageId` déjà présent sur `Vague`). Impact
minimal.

**Point d'attention :** la query vague existante utilise `select` (pas `include`). Il faudra
ajouter `configElevage: { select: { interpolationStrategy: true, gompertzMinPoints: true } }`
et `gompertz: { select: { wInfinity: true, k: true, ti: true, r2: true, confidenceLevel: true,
biometrieCount: true } }` dans ce select.

### src/__tests__/lib/feed-periods.test.ts : MODIFICATIONS NÉCESSAIRES

Tests existants : 22 cas couvrant ADR-028 (tous passants). Aucun test ADR-029 existant.

**Tests à ajouter** (selon spec ADR-029) :
- Stratégie LINEAIRE : comportement inchangé (vérification de non-régression)
- Stratégie GOMPERTZ_VAGUE cas nominal : évaluation de `gompertzWeight`, méthode `GOMPERTZ_VAGUE`
- Biométrie exacte prime toujours sur Gompertz (étape 1 inchangée)
- Fallback LOW confidence → LINEAIRE
- Fallback INSUFFICIENT_DATA → LINEAIRE
- Fallback r2 < 0.85 → LINEAIRE
- Fallback gompertzContext undefined → LINEAIRE
- Fallback t négatif (targetDate avant vagueDebut) → LINEAIRE
- `segmenterPeriodesAlimentaires` transmet la stratégie aux appels internes
- Sans options, comportement ADR-028 préservé

### Build & Prisma : OK

`npx prisma validate` retourne "The schema at prisma/schema.prisma is valid".
Build et tests non exécutés (conformément à la consigne — pas de modification de code dans cette
phase d'analyse). Ces vérifications doivent être faites par @tester après implémentation.

---

## Inventaire complet des fichiers

### Fichiers à CRÉER
| Fichier | Action |
|---------|--------|
| `prisma/migrations/YYYYMMDD_add_strategie_interpolation/migration.sql` | Migration Prisma non-destructive |

### Fichiers à MODIFIER
| Fichier | Action | Priorité |
|---------|--------|----------|
| `prisma/schema.prisma` | Ajouter enum `StrategieInterpolation` + champ dans `ConfigElevage` | 1 - DB d'abord |
| `src/types/models.ts` | Ajouter enum `StrategieInterpolation` + champ dans interface `ConfigElevage` | 2 |
| `src/types/index.ts` | Exporter `StrategieInterpolation` (section Sprint 19) | 2 |
| `src/types/calculs.ts` | Étendre `PeriodeAlimentaire.methodeEstimation` + `"GOMPERTZ_VAGUE"` | 3 |
| `src/lib/feed-periods.ts` | Ajouter `GompertzVagueContext`, modifier signatures + logique Gompertz | 4 |
| `src/lib/queries/analytics.ts` | Étendre query `vagues`, construire `gompertzContext`, passer options | 5 |
| `src/__tests__/lib/feed-periods.test.ts` | Ajouter ~10 cas de test ADR-029 | 6 |

### Fichiers à laisser AS-IS
| Fichier | Raison |
|---------|--------|
| `src/lib/gompertz.ts` | `gompertzWeight(t, params)` déjà exportée — réutilisation directe |
| `src/lib/calculs.ts` | Pas de fonctions Gompertz — calculs piscicoles standards non impactés |
| `src/lib/gompertz-panel.ts` | Logique UI panel Gompertz — non impactée par ADR-029 |
| `src/app/api/vagues/[id]/gompertz/route.ts` | Route de calibrage — non impactée |
| `src/__tests__/lib/gompertz.test.ts` | Tests `calibrerGompertz`/`gompertzWeight` — non impactés |

---

## Vérification des dépendances

### ADR-028 (prérequis déclaré) : SATISFAIT

`src/lib/feed-periods.ts` existe avec `interpolerPoidsBac` et `segmenterPeriodesAlimentaires`
entièrement implémentées. Tests passants. La hiérarchie à 3 niveaux ADR-028 est le point de
départ correct.

### Modèle GompertzVague en DB : PRÉSENT

Le modèle `GompertzVague` existe dans `prisma/schema.prisma` avec tous les champs requis :
`wInfinity`, `k`, `ti`, `r2`, `biometrieCount`, `confidenceLevel`, `configWInfUsed`.
La relation `vague.gompertz` est `@unique` (0 ou 1 par vague).

### Fonction gompertzWeight : PRÉSENTE ET EXPORTÉE

`gompertzWeight(t, params)` dans `src/lib/gompertz.ts` — prête à être importée dans
`feed-periods.ts` sans modification.

### Interface TypeScript GompertzVague : ABSENTE des types métier

Le modèle existe en DB et dans les types générés Prisma (`src/generated/prisma/models/GompertzVague.ts`)
mais n'a pas d'interface dans `src/types/models.ts`. Pour `computeAlimentMetrics`, utiliser
directement le type Prisma généré via `Prisma.GompertzVagueGetPayload` dans la query, ou créer
une interface légère `GompertzVagueRef` dans `src/types/models.ts`. L'ADR-029 définit
`GompertzVagueContext` comme interface locale dans `feed-periods.ts` — ce pattern est suffisant
et évite la prolifération de types.

---

## Incohérences trouvées

### INC-001 — `methodeRank` dans `feed-periods.ts` utilise des rangs 0-2 au lieu de 0-3

**Fichier :** `src/lib/feed-periods.ts` lignes 267-274
**Actuel :**
```typescript
if (m === "BIOMETRIE_EXACTE") return 2;
if (m === "INTERPOLATION_LINEAIRE") return 1;
return 0; // VALEUR_INITIALE
```
**Requis après ADR-029 :**
```typescript
if (m === "BIOMETRIE_EXACTE") return 3;
if (m === "GOMPERTZ_VAGUE") return 2;
if (m === "INTERPOLATION_LINEAIRE") return 1;
return 0; // VALEUR_INITIALE
```
La logique de sélection de la méthode conservatrice (`<=`) est correcte — seuls les valeurs de
rang changent. Impact : les comparaisons existantes `<= methodeRank` restent valides.

### INC-002 — `confidenceLevel` est `String` (non-typé) dans le schéma Prisma

**Fichier :** `prisma/schema.prisma` — modèle `GompertzVague`, ligne ~3044
```prisma
confidenceLevel String
```
Ce champ stocke `"HIGH" | "MEDIUM" | "LOW" | "INSUFFICIENT_DATA"` mais n'est pas un enum Prisma.
ADR-029 suppose que `gompertz.confidenceLevel` peut être casté vers `GompertzVagueContext["confidenceLevel"]`.
Le cast est nécessaire et risqué si une valeur inattendue existe en DB. Mitigation : le code de
fallback dans `interpolerPoidsBac` traite implicitement toute valeur non-`HIGH`/`MEDIUM` comme
non-valide → fallback LINEAIRE.

Cette incohérence existait avant ADR-029. Elle est hors périmètre mais doit être notée.

### INC-003 — `computeAlimentMetrics` n'inclut pas `configElevageId` dans le select vague

**Fichier :** `src/lib/queries/analytics.ts` lignes 513-524
La query `vagues` sélectionne : `id, code, nombreInitial, poidsMoyenInitial, dateDebut, dateFin, bacs`.
Ni `configElevage` ni `gompertz` ne sont présents. Pour implémenter ADR-029, ces deux champs
doivent être ajoutés. Modification localisée, sans impact sur les autres consommateurs de cette
function interne.

---

## Risques identifiés

### RISQUE-001 — Renumérotation des rangs dans `methodeRank` : régression possible

**Impact :** Moyen. Si un test compare explicitement la valeur numérique du rang (improbable — les
tests vérifient `methodeEstimation` string, pas le rang), une régression silencieuse est possible.
**Mitigation :** Vérifier que les tests existants ne font que comparer les strings
`"BIOMETRIE_EXACTE"` / `"INTERPOLATION_LINEAIRE"` / `"VALEUR_INITIALE"` — c'est le cas
dans `feed-periods.test.ts` (aucun test ne touche au rang interne).

### RISQUE-002 — Cast `confidenceLevel` non sécurisé

**Impact :** Faible. Si une valeur DB non-standard existe (ex. `"MEDIUM_DEGRADED"`), le cast
`gompertz.confidenceLevel as GompertzVagueContext["confidenceLevel"]` pourrait accepter
silencieusement une valeur invalide et entraîner un comportement inattendu.
**Mitigation :** Ajouter une validation explicite dans `interpolerPoidsBac` :
```typescript
const validLevels = ["HIGH", "MEDIUM", "LOW", "INSUFFICIENT_DATA"] as const;
if (!validLevels.includes(ctx.confidenceLevel as typeof validLevels[number])) {
  // fallback LINEAIRE
}
```

### RISQUE-003 — Performance de `computeAlimentMetrics` avec les jointures supplémentaires

**Impact :** Faible. La fonction est déjà O(n) sur les vagues. Ajouter `configElevage` et
`gompertz` (relation `@unique`) dans le select Prisma ajoute deux jointures indexées. Pour les
sites avec > 50 vagues et beaucoup de rotations, le temps de requête peut légèrement augmenter.
**Mitigation :** Les deux relations sont sur des FK indexées. Pas de N+1 (select unique).

### RISQUE-004 — Divergence per-bac non testée

**Impact :** Faible. Si les bacs d'une même vague ont des conditions très différentes (densités,
qualité eau), la courbe Gompertz vague peut sur- ou sous-estimer le poids d'un bac individuel.
Ce risque est documenté dans l'ADR-029 et jugé acceptable. Aucune mitigation technique requise —
c'est un comportement by-design.

---

## Prérequis manquants

Aucun prérequis bloquant. Tous les fondamentaux sont en place :
- Schema Prisma valide
- Modèle `GompertzVague` existant avec les bons champs
- Fonctions Gompertz exportées depuis `src/lib/gompertz.ts`
- `feed-periods.ts` entièrement implémenté avec ADR-028
- Tests existants passants (à confirmer avec `npx vitest run` avant de commencer)

---

## Plan d'implémentation recommandé

| Ordre | Fichier | Agent | Risque si inversé |
|-------|---------|-------|-------------------|
| 1 | `prisma/schema.prisma` + migration | @db-specialist | Les types TypeScript dépendent de l'enum Prisma |
| 2 | `src/types/models.ts` + `src/types/index.ts` | @developer | `feed-periods.ts` importe `StrategieInterpolation` |
| 3 | `src/types/calculs.ts` | @developer | `feed-periods.ts` utilise `PeriodeAlimentaire["methodeEstimation"]` |
| 4 | `src/lib/feed-periods.ts` | @developer | `analytics.ts` appelle `segmenterPeriodesAlimentaires` avec options |
| 5 | `src/lib/queries/analytics.ts` | @developer | Dépend des étapes 2+4 |
| 6 | `src/__tests__/lib/feed-periods.test.ts` | @tester | Dépend de l'étape 4 |

---

## Recommandation

**GO** — implémenter dans l'ordre décrit ci-dessus.

Corriger INC-001 (renumérotation `methodeRank`) en même temps que la modification de
`feed-periods.ts` (étape 4). Ce point est le seul qui modifie de la logique existante et
mérite une attention particulière lors de la code review.

Confirmer que `npx vitest run` passe au vert avant de commencer (état du repo propre selon
`git status`).
