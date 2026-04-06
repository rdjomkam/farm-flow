# ADR-030 — Gompertz per-tank : calibrage et interpolation par bac individuel

**Statut :** Accepté
**Date :** 2026-04-05
**Auteur :** @architect
**Dépend de :** ADR-028 (FCR feed-switch accuracy), ADR-029 (stratégie d'interpolation configurable)
**Annule partiellement :** ADR-029 section "Gompertz per-tank — Rejeté" (les arguments ont changé)

---

## Contexte

### Ce qu'ADR-029 a décidé — et pourquoi la situation a changé

ADR-029 a introduit la stratégie `GOMPERTZ_VAGUE` : un seul modèle de croissance Gompertz calibré
sur **toutes les biométries de la vague** (tous bacs confondus, agrégées en moyenne pondérée par
date). Ce modèle est appliqué de façon uniforme à chaque bac lors de l'interpolation du poids aux
bornes de période d'alimentation.

ADR-029 a explicitement rejeté le calibrage per-tank pour trois raisons :

1. Les biométries par bac sont trop peu nombreuses (souvent 2-4 par bac vs minimum de 5 requis).
2. La complexité de stockage est disproportionnée (N modèles par vague).
3. Les bacs d'une même vague ont des conditions quasi-identiques — la courbe vague est un proxy
   valide pour chaque bac.

Ces trois arguments sont reconsidérés :

**Raison 1 — fréquence de biométrie.** `ConfigElevage.gompertzMinPoints` est configurable. Sa
valeur par défaut est `5`, mais un éleveur peut l'abaisser à `3` (nombre de paramètres du modèle).
Avec des biométries toutes les 2-3 jours (pratique courante en phase d'alevinage intensif), un bac
accumule 3 points en 6 à 9 jours. L'argument "pas assez de données par bac" n'est plus absolu.

**Raison 2 — complexité de stockage.** Une vague compte généralement 2-4 bacs. Le coût de stocker
2-4 rangées `GompertzBac` supplémentaires est marginal comparé au bénéfice analytique.

**Raison 3 — conditions quasi-identiques.** C'est précisément là que le problème se pose. La
prémisse d'ADR-028 est que **les changements d'aliment sont par bac** : Bac A peut passer à 3mm
au jour J21 pendant que Bac B reste sur 2mm. Deux aliments différents → deux trajectoires de
croissance différentes → deux courbes Gompertz différentes. Utiliser la courbe vague (mélange des
deux) pour estimer le poids d'un bac spécifique introduit un biais systématique dans le FCR de ce
bac.

### Le problème de contamination croisée

Soit une vague avec deux bacs, Bac A et Bac B :
- Bac A : aliment 3mm à partir du jour J21 → croissance plus rapide
- Bac B : aliment 2mm jusqu'à la récolte → croissance plus lente

La courbe `GompertzVague` est calibrée sur la moyenne pondérée des biométries des deux bacs. Elle
représente un "bac moyen fictif" qui n'existe pas. Lorsqu'on l'applique à Bac A pour estimer le
poids à la borne de période (changement d'aliment au jour J21), on utilise une courbe influencée
par les données de Bac B — qui a reçu un aliment moins performant. Le poids estimé pour Bac A est
donc sous-estimé, le gain de biomasse est sous-estimé, et le FCR pour la période 3mm de Bac A est
sur-estimé (semble moins efficace qu'il ne l'est réellement).

C'est exactement la problématique qu'ADR-028 cherchait à résoudre avec les périodes par bac.
La stratégie `GOMPERTZ_VAGUE` d'ADR-029 résout la segmentation temporelle mais pas la segmentation
spatiale.

### Biométries par bac — état du schéma

Dans `prisma/schema.prisma`, le champ `Releve.bacId` est de type `String` (non nullable). Chaque
relevé biométrique est donc déjà attribué à un bac spécifique. Les données per-tank existent dans
la base de données depuis la Phase 1. Il n'y a aucune transformation ni migration de données
requise pour accéder aux biométries par bac.

Note : dans le code de la route gompertz actuelle (`src/app/api/vagues/[id]/gompertz/route.ts`),
`bacId` est sélectionné comme un champ potentiellement nul (guard `r.bacId ?`) pour gérer les
anciens enregistrements pré-Phase 1, mais le schéma garantit la valeur depuis la migration initiale.

---

## Décision

**Introduire un modèle `GompertzBac` et une nouvelle valeur `GOMPERTZ_BAC` dans l'enum
`StrategieInterpolation`, avec une chaîne de fallback à 4 niveaux.**

La stratégie `GOMPERTZ_BAC` calibre un modèle Gompertz distinct pour chaque bac d'une vague, en
utilisant uniquement les biométries de ce bac. Si un bac n'a pas assez de biométries, le système
retombe automatiquement sur `GOMPERTZ_VAGUE` (courbe vague), puis sur `INTERPOLATION_LINEAIRE`,
puis sur `VALEUR_INITIALE`.

Les stratégies `LINEAIRE` et `GOMPERTZ_VAGUE` d'ADR-028 et ADR-029 sont préservées sans
modification. `GOMPERTZ_BAC` est une **valeur additionnelle**, pas un remplacement.

---

## Options considérées

### Option A — Modèle `GompertzBac` séparé (décision retenue)

Nouveau modèle Prisma `GompertzBac` avec `bacId @unique`, `vagueId`, `siteId`, et les mêmes
champs de paramètres que `GompertzVague` (`wInfinity`, `k`, `ti`, `r2`, `rmse`, `biometrieCount`,
`confidenceLevel`, `configWInfUsed`).

**Avantages :**
- Séparation claire des responsabilités : GompertzVague = vague entière, GompertzBac = bac individuel.
- Chaque enregistrement est autonome — valide/invalidé indépendamment selon les biométries de son bac.
- La route d'API et le service analytics peuvent charger les deux niveaux séparément.
- Conforme à R8 (`siteId` présent).
- Cascade propre : si un bac est supprimé, son GompertzBac est supprimé avec lui.

**Inconvénients :**
- Nouvelle table en base de données.
- La route `GET /api/vagues/[id]/gompertz` doit calibrer et upsert N+1 enregistrements (1 vague + N bacs).

### Option B — Étendre `GompertzVague` avec champ `bacId` nullable

Réutiliser `GompertzVague` avec `bacId String?` : un enregistrement sans `bacId` = calibrage vague,
un enregistrement avec `bacId` = calibrage bac.

**Inconvénients :**
- Casse l'unicité `@@unique([vagueId])` — doit devenir `@@unique([vagueId, bacId])` avec `bacId`
  nullable, ce qui est une contrainte composée partielle difficile à gérer proprement en PostgreSQL.
- Mélange deux niveaux de granularité dans le même modèle.
- Charge cognitive élevée pour les queries (filtres `bacId IS NULL` vs `bacId IS NOT NULL`).

**Rejetée.**

### Option C — Stocker les courbes per-tank en JSON dans `GompertzVague`

Ajouter un champ `Json` `bacParams` dans `GompertzVague` contenant un dictionnaire `{bacId: params}`.

**Inconvénients :**
- Pas de typage Prisma fort, pas d'index sur `bacId`.
- Invalider ou recalibrer un bac spécifique nécessite de réécrire l'objet JSON entier.
- Non conforme à la philosophie des modèles relationnels du projet.

**Rejetée.**

---

## Spécification détaillée

### 1. Nouveau modèle Prisma `GompertzBac`

```prisma
// ──────────────────────────────────────────
// Modèle — GompertzBac (ADR-030)
// ──────────────────────────────────────────

/**
 * GompertzBac — Paramètres du modèle de croissance de Gompertz calibrés sur les
 * relevés biométriques d'un bac individuel.
 * W(t) = W∞ × exp(−exp(−k × (t − ti)))
 * Un seul enregistrement par bac (@@unique bacId).
 * Supprimé en cascade avec le bac (onDelete: Cascade).
 * R8 : siteId obligatoire.
 */
model GompertzBac {
  id String @id @default(cuid())

  bacId String @unique
  bac   Bac    @relation(fields: [bacId], references: [id], onDelete: Cascade)

  vagueId String
  vague   Vague  @relation(fields: [vagueId], references: [id], onDelete: Cascade)

  /** W∞ — Poids asymptotique (g) */
  wInfinity Float
  /** k — Constante de taux de croissance (1/jour) */
  k         Float
  /** ti — Point d'inflexion (jours depuis le début de la vague) */
  ti        Float
  /** R² — Coefficient de détermination (0-1) */
  r2        Float
  /** RMSE — Erreur quadratique moyenne (g) */
  rmse      Float
  /** Nombre de relevés biométriques du bac utilisés pour le calibrage */
  biometrieCount Int
  /** Niveau de confiance : INSUFFICIENT_DATA | LOW | MEDIUM | HIGH */
  confidenceLevel String
  /** Valeur de configElevage.gompertzWInfDefault utilisée lors de ce calibrage */
  configWInfUsed Float?

  siteId String
  site   Site   @relation(fields: [siteId], references: [id])

  calculatedAt DateTime @default(now())
  updatedAt    DateTime @updatedAt

  @@index([vagueId])
  @@index([siteId])
  @@index([bacId])
}
```

Relations à ajouter dans les modèles existants :

```prisma
// Dans model Bac — ajouter après la liste des relations existantes :
gompertz GompertzBac?

// Dans model Vague — ajouter après gompertz GompertzVague? :
gompertzBacs GompertzBac[]

// Dans model Site — ajouter après gompertzVagues GompertzVague[] :
gompertzBacs GompertzBac[]
```

### 2. Extension de l'enum `StrategieInterpolation`

```prisma
// Dans prisma/schema.prisma — modifier l'enum existant
enum StrategieInterpolation {
  LINEAIRE
  GOMPERTZ_VAGUE
  GOMPERTZ_BAC   // ADR-030 : calibrage per-tank avec fallback vers GOMPERTZ_VAGUE
}
```

```typescript
// Dans src/types/models.ts — modifier l'enum TypeScript existant
export enum StrategieInterpolation {
  LINEAIRE = "LINEAIRE",
  GOMPERTZ_VAGUE = "GOMPERTZ_VAGUE",
  /** Calibrage Gompertz par bac individuel (ADR-030).
   * Fallback automatique vers GOMPERTZ_VAGUE si le bac n'a pas assez de biométries,
   * puis vers INTERPOLATION_LINEAIRE si la vague non plus. */
  GOMPERTZ_BAC = "GOMPERTZ_BAC",
}
```

### 3. Interface TypeScript `GompertzBacContext`

À ajouter dans `src/lib/feed-periods.ts`, après `GompertzVagueContext` :

```typescript
/**
 * Contexte Gompertz per-tank pour la stratégie GOMPERTZ_BAC (ADR-030).
 *
 * Un GompertzBacContext par bac, transmis par l'appelant (computeAlimentMetrics)
 * depuis les enregistrements GompertzBac de la DB.
 * Si null pour un bacId donné, le système retombe sur GompertzVagueContext.
 */
export interface GompertzBacContext {
  /** W∞ — poids asymptotique en grammes */
  wInfinity: number;
  /** k — constante de taux de croissance (1/jour) */
  k: number;
  /** ti — point d'inflexion en jours depuis le début de la vague */
  ti: number;
  /** R² — coefficient de détermination du calibrage */
  r2: number;
  /** Nombre de biométries du bac utilisées pour le calibrage */
  biometrieCount: number;
  /** Niveau de confiance — seuls HIGH et MEDIUM déclenchent Gompertz */
  confidenceLevel: "HIGH" | "MEDIUM" | "LOW" | "INSUFFICIENT_DATA";
  /** Date de début de la vague — nécessaire pour convertir targetDate en t (jours) */
  vagueDebut: Date;
}
```

### 4. Extension de `methodeEstimation` dans `PeriodeAlimentaire`

```typescript
// Dans src/types/calculs.ts — interface PeriodeAlimentaire
methodeEstimation:
  | "BIOMETRIE_EXACTE"
  | "INTERPOLATION_LINEAIRE"
  | "GOMPERTZ_VAGUE"
  | "GOMPERTZ_BAC"      // ADR-030
  | "VALEUR_INITIALE";
```

Ordre de rang pour la qualité indicative dans `segmenterPeriodesAlimentaires` :

```
BIOMETRIE_EXACTE (4) > GOMPERTZ_BAC (3) > GOMPERTZ_VAGUE (2) > INTERPOLATION_LINEAIRE (1) > VALEUR_INITIALE (0)
```

Justification : GOMPERTZ_BAC est fondé sur les données spécifiques au bac → plus fiable que
GOMPERTZ_VAGUE (qui inclut les données d'autres bacs potentiellement sur un aliment différent).

### 5. Extension de la signature de `interpolerPoidsBac`

```typescript
export function interpolerPoidsBac(
  targetDate: Date,
  bacId: string | null,
  biometries: BiometriePoint[],
  poidsInitial: number,
  options?: {
    strategie?: StrategieInterpolation;
    /** Contexte vague (ADR-029) — utilisé par GOMPERTZ_VAGUE et comme fallback de GOMPERTZ_BAC */
    gompertzContext?: GompertzVagueContext;
    /** Contextes per-tank (ADR-030) — utilisés uniquement si strategie = GOMPERTZ_BAC */
    gompertzBacContexts?: Map<string, GompertzBacContext>;
    gompertzMinPoints?: number;
  }
): { poids: number; methode: PeriodeAlimentaire["methodeEstimation"] } | null;
```

### 6. Logique d'interpolation mise à jour — étapes 2a et 2b

La hiérarchie complète dans `interpolerPoidsBac` devient :

```
1. Biométrie exacte (même jour calendaire)         → BIOMETRIE_EXACTE
2a. Si stratégie = GOMPERTZ_BAC :
    └─ GompertzBacContext pour ce bacId existe ET valide (HIGH|MEDIUM, r2 >= 0.85, count >= min) ?
       ├─ Oui → gompertzWeight(t, bacParams)        → GOMPERTZ_BAC
       └─ Non → tenter GOMPERTZ_VAGUE (étape 2b)
2b. Si stratégie = GOMPERTZ_VAGUE ou fallback de GOMPERTZ_BAC :
    └─ GompertzVagueContext valide ?
       ├─ Oui → gompertzWeight(t, vagueParams)      → GOMPERTZ_VAGUE
       └─ Non → étape 2c
2c. Interpolation linéaire entre deux biométries encadrantes → INTERPOLATION_LINEAIRE
3.  Poids initial de la vague (fallback final)      → VALEUR_INITIALE
```

Note : la biométrie exacte (étape 1) prime toujours sur toute stratégie Gompertz.

### 7. Extension de la signature de `segmenterPeriodesAlimentaires`

```typescript
export function segmenterPeriodesAlimentaires(
  relevsAlim: ReleveAlimPoint[],
  biometries: BiometriePoint[],
  vagueContext: VagueContext,
  options?: {
    strategie?: StrategieInterpolation;
    gompertzContext?: GompertzVagueContext;
    /** Contexts per-tank indexés par bacId. Ignorés si strategie != GOMPERTZ_BAC. */
    gompertzBacContexts?: Map<string, GompertzBacContext>;
    gompertzMinPoints?: number;
  }
): PeriodeAlimentaire[];
```

La fonction transmet `gompertzBacContexts` à chaque appel interne de `interpolerPoidsBac`.

### 8. Calibration per-tank dans la route `GET /api/vagues/[id]/gompertz`

Après la calibration vague-level existante, la route effectue une passe per-tank :

```
Pour chaque bac de la vague :
  1. Filtrer les biométries par bacId
  2. Grouper par date (biométries du même jour = une seule mesure)
  3. Vérifier si le GompertzBac cache est encore valide (isCachedGompertzValid)
  4. Si invalide ou absent :
     a. Si moins de minPoints biométries → upsert INSUFFICIENT_DATA, continuer
     b. Sinon → appeler calibrerGompertz({ points: bacPoints, initialGuess })
     c. Upsert GompertzBac avec le résultat
```

La calibration per-tank est **colocalisée** avec la calibration vague dans la même route pour
éviter la prolifération de routes. Elle est également **lazy** : déclenchée à la demande (lors
de l'affichage du dashboard Gompertz d'une vague) et non en batch asynchrone.

La route retourne désormais les calibrations per-tank en plus de la calibration vague :

```typescript
// Réponse JSON étendue
{
  vagueId: string;
  calibration: { params, r2, rmse, confidenceLevel, biometrieCount } | null;
  courbe: { jour, poids }[] | null;
  dateRecolteEstimee: number | null;
  // ADR-030 : calibrations par bac
  calibrationsBacs: {
    bacId: string;
    calibration: { params, r2, rmse, confidenceLevel, biometrieCount } | null;
  }[];
}
```

Les calibrations INSUFFICIENT_DATA des bacs sont incluses dans `calibrationsBacs` pour permettre
à l'UI d'afficher l'état de chaque bac (combien de biométries manquent).

### 9. Mise à jour de `computeAlimentMetrics` dans `analytics.ts`

```typescript
// Charger les GompertzBac de la vague (si stratégie = GOMPERTZ_BAC)
const interpolStrategy = config?.interpolationStrategy ?? StrategieInterpolation.LINEAIRE;

let gompertzBacContexts: Map<string, GompertzBacContext> | undefined;

if (interpolStrategy === StrategieInterpolation.GOMPERTZ_BAC) {
  // vague.gompertzBacs est déjà inclus dans la query Prisma (select)
  const bacRows = vague.gompertzBacs ?? [];
  if (bacRows.length > 0) {
    gompertzBacContexts = new Map(
      bacRows
        .filter((b) => b.confidenceLevel !== "INSUFFICIENT_DATA")
        .map((b) => [
          b.bacId,
          {
            wInfinity: b.wInfinity,
            k: b.k,
            ti: b.ti,
            r2: b.r2,
            biometrieCount: b.biometrieCount,
            confidenceLevel: b.confidenceLevel as GompertzBacContext["confidenceLevel"],
            vagueDebut: vague.dateDebut,
          },
        ])
    );
  }
}

const allPeriodes = segmenterPeriodesAlimentaires(
  relevsAlimPoints,
  biometriePoints,
  vagueCtx,
  {
    strategie: interpolStrategy as StrategieInterpolation,
    gompertzContext,        // vague-level (inchangé)
    gompertzBacContexts,    // per-tank (ADR-030)
    gompertzMinPoints: config?.gompertzMinPoints,
  }
);
```

La query Prisma dans `computeAlimentMetrics` doit inclure `gompertzBacs` dans le `select` de vague
quand la stratégie est GOMPERTZ_BAC. Pour éviter une condition dans le select (qui alourdit la
query), inclure systématiquement `gompertzBacs: { select: { bacId, wInfinity, k, ti, r2,
biometrieCount, confidenceLevel } }` dans la sélection vague de cette fonction.

### 10. Aucun changement aux API routes de FCR public

Le type de retour de `computeAlimentMetrics` et les réponses des routes analytics sont inchangés.
La valeur `methodeEstimation` dans `PeriodeAlimentaire` peut maintenant valoir `"GOMPERTZ_BAC"`,
mais ce champ n'est pas exposé dans les réponses JSON publiques actuellement.

---

## Chaîne de fallback complète

```
Stratégie configurée = GOMPERTZ_BAC
    │
    ▼
GompertzBacContext pour ce bacId existe ?
    │ Non → tenter GOMPERTZ_VAGUE ci-dessous
    │ Oui
    ▼
confidenceLevel = HIGH ou MEDIUM ?
    │ Non (LOW ou INSUFFICIENT_DATA) → tenter GOMPERTZ_VAGUE
    │ Oui
    ▼
r2 >= 0.85 ?
    │ Non → tenter GOMPERTZ_VAGUE
    │ Oui
    ▼
biometrieCount >= configElevage.gompertzMinPoints ?
    │ Non → tenter GOMPERTZ_VAGUE
    │ Oui
    ▼
Calculer t = jours(targetDate - vagueDebut)
Évaluer gompertzWeight(t, bacParams)
    │
    ▼
Résultat valide (poids > 0, non NaN) ?
    │ Non → tenter GOMPERTZ_VAGUE
    │ Oui
    ▼
Retourner { poids, methode: "GOMPERTZ_BAC" }
```

```
Fallback GOMPERTZ_VAGUE (identique ADR-029, inchangé)
    │
    ▼
GompertzVagueContext valide (HIGH|MEDIUM, r2 >= 0.85, count >= min) ?
    │ Non → INTERPOLATION_LINEAIRE
    │ Oui
    ▼
gompertzWeight(t, vagueParams) valide ?
    │ Non → INTERPOLATION_LINEAIRE
    │ Oui
    ▼
Retourner { poids, methode: "GOMPERTZ_VAGUE" }
```

```
Fallback INTERPOLATION_LINEAIRE
    │
    ▼
Deux biométries du bac encadrent la date cible ?
    │ Non → VALEUR_INITIALE
    │ Oui
    ▼
Retourner { poids interpolé, methode: "INTERPOLATION_LINEAIRE" }
```

```
Fallback VALEUR_INITIALE
    ▼
Retourner { poids: poidsInitial, methode: "VALEUR_INITIALE" }
```

---

## Gestion du cache — `isCachedGompertzValid` pour les bacs

La fonction `isCachedGompertzValid` dans `src/lib/gompertz.ts` accepte en entrée un enregistrement
avec les champs `{ wInfinity, confidenceLevel, biometrieCount, configWInfUsed }`. Cette signature
est identique pour `GompertzVague` et `GompertzBac`. Elle est réutilisable sans modification pour
valider les enregistrements per-tank.

La route `GET /api/vagues/[id]/gompertz` utilisera `isCachedGompertzValid(gompertzBacRecord,
bacBiometrieCount, minPoints, configWInf)` pour décider si un recalibrage est nécessaire pour
chaque bac.

---

## Migration Prisma

```sql
-- 1. Étendre l'enum StrategieInterpolation (RECREATE strategy — R1)
ALTER TYPE "StrategieInterpolation" RENAME TO "StrategieInterpolation_old";

CREATE TYPE "StrategieInterpolation" AS ENUM (
  'LINEAIRE',
  'GOMPERTZ_VAGUE',
  'GOMPERTZ_BAC'
);

ALTER TABLE "ConfigElevage"
  ALTER COLUMN "interpolationStrategy" TYPE "StrategieInterpolation"
  USING "interpolationStrategy"::text::"StrategieInterpolation";

DROP TYPE "StrategieInterpolation_old";

-- 2. Créer la table GompertzBac
CREATE TABLE "GompertzBac" (
  "id"              TEXT NOT NULL,
  "bacId"           TEXT NOT NULL,
  "vagueId"         TEXT NOT NULL,
  "wInfinity"       DOUBLE PRECISION NOT NULL,
  "k"               DOUBLE PRECISION NOT NULL,
  "ti"              DOUBLE PRECISION NOT NULL,
  "r2"              DOUBLE PRECISION NOT NULL,
  "rmse"            DOUBLE PRECISION NOT NULL,
  "biometrieCount"  INTEGER NOT NULL,
  "confidenceLevel" TEXT NOT NULL,
  "configWInfUsed"  DOUBLE PRECISION,
  "siteId"          TEXT NOT NULL,
  "calculatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL,

  CONSTRAINT "GompertzBac_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "GompertzBac"
  ADD CONSTRAINT "GompertzBac_bacId_fkey"
    FOREIGN KEY ("bacId") REFERENCES "Bac"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "GompertzBac_vagueId_fkey"
    FOREIGN KEY ("vagueId") REFERENCES "Vague"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "GompertzBac_siteId_fkey"
    FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE UNIQUE INDEX "GompertzBac_bacId_key" ON "GompertzBac"("bacId");
CREATE INDEX "GompertzBac_vagueId_idx" ON "GompertzBac"("vagueId");
CREATE INDEX "GompertzBac_siteId_idx" ON "GompertzBac"("siteId");
CREATE INDEX "GompertzBac_bacId_idx" ON "GompertzBac"("bacId");
```

La migration de l'enum est non-destructive pour les valeurs existantes (`LINEAIRE`,
`GOMPERTZ_VAGUE` sont préservées). Toutes les `ConfigElevage` existantes gardent leur valeur
courante.

---

## Impact sur les fichiers existants

| Fichier | Action | Description |
|---------|--------|-------------|
| `prisma/schema.prisma` | Modifier | Nouveau modèle `GompertzBac`, relations dans `Bac`/`Vague`/`Site`, extension enum `StrategieInterpolation` |
| `src/types/models.ts` | Modifier | Étendre enum `StrategieInterpolation` avec `GOMPERTZ_BAC`, interface `GompertzBac` |
| `src/types/calculs.ts` | Modifier | Étendre `PeriodeAlimentaire.methodeEstimation` avec `"GOMPERTZ_BAC"` |
| `src/lib/feed-periods.ts` | Modifier | Ajouter `GompertzBacContext`, étendre signatures `interpolerPoidsBac` et `segmenterPeriodesAlimentaires`, implémenter étape 2a GOMPERTZ_BAC |
| `src/app/api/vagues/[id]/gompertz/route.ts` | Modifier | Calibration per-tank après calibration vague, upsert `GompertzBac`, retour JSON étendu avec `calibrationsBacs` |
| `src/lib/queries/analytics.ts` | Modifier | Inclure `gompertzBacs` dans select vague, construire `gompertzBacContexts`, passer à `segmenterPeriodesAlimentaires` |
| `src/__tests__/lib/feed-periods.test.ts` | Modifier | Ajouter cas de test pour GOMPERTZ_BAC et sa chaîne de fallback |
| `src/__tests__/api/gompertz.test.ts` | Modifier | Ajouter cas de test pour la calibration per-tank |

### Aucun changement à `src/lib/gompertz.ts`

La fonction `isCachedGompertzValid` est réutilisable sans modification grâce à sa signature
structurelle (duck typing TypeScript). Les fonctions `calibrerGompertz`, `gompertzWeight`, etc.
sont utilisées directement sans extension.

---

## Cas de test requis

```typescript
// src/__tests__/lib/feed-periods.test.ts — nouveaux cas ADR-030

// 1. Stratégie GOMPERTZ_BAC — cas nominal
describe("interpolerPoidsBac — stratégie GOMPERTZ_BAC", () => {
  it("évalue gompertzWeight avec les params du bac quand GompertzBacContext HIGH et R²=0.97")
  it("retourne methode GOMPERTZ_BAC dans ce cas")
  it("biométrie exacte prime toujours sur GOMPERTZ_BAC (étape 1 inchangée)")
})

// 2. Fallbacks GOMPERTZ_BAC → GOMPERTZ_VAGUE
describe("interpolerPoidsBac — fallback GOMPERTZ_BAC vers GOMPERTZ_VAGUE", () => {
  it("retombe sur GOMPERTZ_VAGUE si GompertzBacContext absent pour ce bacId")
  it("retombe sur GOMPERTZ_VAGUE si confidenceLevel bac = LOW")
  it("retombe sur GOMPERTZ_VAGUE si r2 bac < 0.85")
  it("retombe sur GOMPERTZ_VAGUE si biometrieCount bac < minPoints")
  it("retombe sur GOMPERTZ_VAGUE si gompertzWeight bac retourne NaN")
  it("retombe sur INTERPOLATION_LINEAIRE si GOMPERTZ_VAGUE aussi invalide")
  it("retombe sur VALEUR_INITIALE si aucune biométrie encadrante et pas de Gompertz valide")
})

// 3. Rang methodeEstimation
describe("segmenterPeriodesAlimentaires — rang methodeEstimation", () => {
  it("GOMPERTZ_BAC (3) > GOMPERTZ_VAGUE (2) dans le rang de qualité")
  it("une période avec début GOMPERTZ_BAC et fin GOMPERTZ_VAGUE conserve GOMPERTZ_VAGUE comme methode (plus bas rang)")
})

// 4. Stratégies inchangées
describe("interpolerPoidsBac — stratégies LINEAIRE et GOMPERTZ_VAGUE inchangées", () => {
  it("LINEAIRE ignore gompertzBacContexts même si fourni")
  it("GOMPERTZ_VAGUE ignore gompertzBacContexts même si fourni")
})
```

---

## Conséquences

### Positives

- La courbe Gompertz d'un bac A (aliment 3mm) est calibrée uniquement sur les données du bac A.
  Les biométries du bac B (aliment 2mm) n'influencent plus l'estimation du poids de A. Le FCR
  per-tank est donc calculé avec les données du bac concerné — cohérence totale avec ADR-028.
- La chaîne de fallback à 4 niveaux garantit qu'aucune dégradation silencieuse n'est possible :
  chaque bac sans données suffisantes utilise automatiquement le meilleur niveau disponible.
- `isCachedGompertzValid` est réutilisable sans modification — coût d'implémentation réduit.
- Les stratégies `LINEAIRE` et `GOMPERTZ_VAGUE` restent strictement inchangées — migration
  non-cassante pour tous les sites existants.

### Contraintes / Risques

**Risque 1 — Biais early-phase sur bac unique.** Avec `gompertzMinPoints = 3` et 3 biométries
toutes en phase exponentielle (jours 1-15), le modèle peut produire une W∞ incorrecte (ADR-029
section "Note sur le trade-off R² / n = 3"). Ce risque existe au niveau bac comme au niveau vague.
La valeur R² ≈ 1.0 avec n = 3 n'est pas discriminante. Mitigation : même garde-fou qu'ADR-029 —
l'éleveur qui configure `gompertzMinPoints = 3` accepte ce trade-off en connaissance de cause.

**Risque 2 — Temps de calibration.** Une vague avec 4 bacs et `biometrieCount >= minPoints` par
bac déclenche 5 calibrations LM (1 vague + 4 bacs) lors d'un unique appel
`GET /api/vagues/[id]/gompertz`. En pratique, le LM converge en < 10ms par calibration pour
50 points maximum, soit < 50ms au total. Acceptable pour une route déclenchée à la demande (pas
dans un hot path).

**Risque 3 — Accumulation de GompertzBac obsolètes.** Si un bac est retiré d'une vague (vagueId
mis à null), son `GompertzBac` reste en base avec le `vagueId` d'origine. La contrainte FK
`vagueId` pointe sur une vague qui n'a plus ce bac en cours. Ce cas est rare et non bloquant :
le `GompertzBac` sera ignoré car le bac n'a plus de biométries nouvelles dans la vague. Une
route de nettoyage peut être ajoutée en Sprint 12 si nécessaire.

**Risque 4 — Divergence entre GompertzBac et GompertzVague.** Il est théoriquement possible qu'un
bac ait R² = 0.90 (GOMPERTZ_BAC actif) mais que la courbe vague (tous bacs agrégés) ait R² = 0.95.
Dans ce cas la courbe vague serait "plus lisse" statistiquement mais biologiquement incorrecte
pour ce bac spécifique. La priorité donnée à GOMPERTZ_BAC dans la hiérarchie est délibérée :
la précision per-tank prime sur la lisseur statistique vague.

---

## Décisions reportées

- **Interface UI pour le statut des calibrations per-tank.** La route retourne déjà `calibrationsBacs`
  dans sa réponse JSON. L'affichage dans la page dashboard Gompertz (liste des bacs avec leur niveau
  de confiance) est délégué au Sprint correspondant (UI analytics).

- **Batch recalibration.** Si une vague a de nombreuses biométries et que l'on veut recalibrer
  tous les bacs en arrière-plan sans bloquer l'UI, une route `POST /api/vagues/[id]/gompertz/recalibrate`
  peut être ajoutée. Non prioritaire — le trigger lazy sur GET est suffisant pour la Phase 2.

- **Alerte bac sous-instrumenté.** Si un bac a < minPoints biométries mais que sa vague utilise
  `GOMPERTZ_BAC`, on pourrait alerter l'éleveur. À ajouter dans le sprint Alertes (Sprint 11).

---

## Plan d'implémentation

| Étape | Agent | Action |
|-------|-------|--------|
| 1 | @architect | Ce document (ADR-030) — FAIT |
| 2 | @db-specialist | Migration Prisma : extension enum `StrategieInterpolation` + modèle `GompertzBac` + relations |
| 3 | @developer | Ajouter `GOMPERTZ_BAC` dans `StrategieInterpolation` TypeScript + interface `GompertzBac` dans `src/types/models.ts` |
| 4 | @developer | Étendre `PeriodeAlimentaire.methodeEstimation` avec `"GOMPERTZ_BAC"` dans `src/types/calculs.ts` |
| 5 | @developer | Ajouter `GompertzBacContext` dans `src/lib/feed-periods.ts`, modifier `interpolerPoidsBac` et `segmenterPeriodesAlimentaires` |
| 6 | @developer | Modifier `src/app/api/vagues/[id]/gompertz/route.ts` : calibration per-tank + réponse étendue |
| 7 | @developer | Modifier `src/lib/queries/analytics.ts` : charger `gompertzBacs`, construire `gompertzBacContexts` |
| 8 | @tester | Ajouter cas de test ADR-030 dans `src/__tests__/lib/feed-periods.test.ts` et `src/__tests__/api/gompertz.test.ts` |
| 9 | @tester | Vérifier `npx vitest run` + `npm run build` |
