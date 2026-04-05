# ADR-029 — Stratégie d'interpolation configurable pour l'estimation du poids aux bornes de période

**Statut :** Accepté
**Date :** 2026-04-05
**Auteur :** @architect
**Dépend de :** ADR-028 (FCR feed-switch accuracy)

---

## Contexte

### Récapitulatif de l'état actuel

ADR-028 a introduit `interpolerPoidsBac` dans `src/lib/feed-periods.ts`, qui estime le poids
moyen d'un bac à une date donnée selon une hiérarchie à 3 niveaux :

```
1. Biométrie exacte (même jour calendaire)  →  BIOMETRIE_EXACTE
2. Interpolation linéaire (deux biométries encadrent la date)  →  INTERPOLATION_LINEAIRE
3. Poids initial de la vague  →  VALEUR_INITIALE
```

ADR-028 a explicitement rejeté le modèle Gompertz pour l'interpolation dans un premier temps
(Alternative A), mais a laissé la porte ouverte à une "évolution possible" conditionnée à des
tests de validation montrant un biais systématique de l'interpolation linéaire.

### Le besoin

Un éleveur expérimenté disposant de nombreuses biométries et d'un modèle Gompertz bien calibré
(`GompertzVague.r2 > 0.95`, `confidenceLevel = HIGH`) souhaitera utiliser la courbe de Gompertz
plutôt que l'interpolation linéaire pour estimer les poids aux bornes de période. Cette approche
peut être plus précise en phase d'alevinage (croissance exponentielle) où l'interpolation linéaire
sous-estime systématiquement la croissance réelle entre deux biométries.

Ce n'est pas une fonctionnalité universellement utile : pour la majorité des sites avec peu de
biométries ou sans Gompertz calibré, l'interpolation linéaire reste la meilleure option. Il
s'agit donc d'un **réglage optionnel par profil ConfigElevage**.

### Questions architecturales posées

1. Où stocker ce réglage ? (nouveau champ ConfigElevage, champ Site, autre ?)
2. Comment modifier `interpolerPoidsBac` pour accepter la stratégie ?
3. Que représente Gompertz per-tank vs Gompertz per-vague dans ce contexte ?
4. Quelles données minimales sont requises pour que Gompertz soit valide ?
5. Comment gérer le fallback quand Gompertz n'est pas disponible ?

---

## Options considérées

### Option 1 — Champ `interpolationStrategy` dans `ConfigElevage`

**Ajouter un champ enum dans le modèle Prisma `ConfigElevage` :**

```prisma
enum StrategieInterpolation {
  LINEAIRE
  GOMPERTZ_VAGUE
}
```

Avec `interpolationStrategy StrategieInterpolation @default(LINEAIRE)` dans `ConfigElevage`.

**Avantages :**
- Cohérent avec la philosophie de ConfigElevage (paramètre de pilotage du moteur d'élevage).
- Les vagues héritent la stratégie via leur `configElevageId` — même vague, même stratégie.
- Facilement exposable dans la page Paramètres de l'élevage.
- Suit R8 (rattaché au site via ConfigElevage → siteId).

**Inconvénients :**
- Requiert une migration Prisma.

---

### Option 2 — Champ `interpolationStrategy` directement sur `Site`

Placer le réglage sur le modèle `Site` comme un paramètre global.

**Avantages :** Simple, pas de relation à traverser.

**Inconvénients :**
- Un site peut avoir plusieurs ConfigElevage (profils différents pour des espèces différentes ou
  des conditions différentes). Rendre la stratégie site-wide ignore cette granularité.
- Mélange les responsabilités : `Site` est une entité organisationnelle, pas un profil technique.
- Si un éleveur veut tester LINEAIRE vs GOMPERTZ sur deux cohortes simultanées, ce n'est pas
  possible avec un réglage site-level.

**Rejetée.**

---

### Option 3 — Paramètre au niveau `Vague`

Stocker la stratégie sur chaque `Vague` individuellement.

**Avantages :** Granularité maximale.

**Inconvénients :**
- Charge l'interface de création de vague avec un paramètre technique rarement changé.
- Incohérent : la stratégie d'interpolation est une décision de profil d'élevage, pas une
  décision par vague.
- Dilue la valeur de ConfigElevage.

**Rejetée.**

---

### Option 4 — Paramètre passé à l'exécution sans persistance

Passer la stratégie comme argument à `segmenterPeriodesAlimentaires` sans la stocker en base.

**Avantages :** Zéro migration.

**Inconvénients :**
- Doit être choisi à chaque appel API — qui décide ?
- Pas de traçabilité : FCR recalculé avec une stratégie différente selon le contexte d'appel
  donne des résultats incohérents entre les sessions.
- Non configurable via l'UI de l'éleveur.

**Rejetée.**

---

## Décision

**Option 1 : champ `interpolationStrategy` dans `ConfigElevage`, enum `StrategieInterpolation`.**

La stratégie d'interpolation est un paramètre de profil d'élevage. Elle doit vivre dans
`ConfigElevage` pour bénéficier de l'héritage par vague (via `vague.configElevageId`),
de la traçabilité, et de l'exposition via l'interface "Paramètres d'élevage".

---

## Spécification détaillée

### 1. Nouveau champ Prisma dans `ConfigElevage`

```prisma
// À ajouter dans prisma/schema.prisma — bloc ConfigElevage
// Section : ── Calibrage Gompertz : parametres initiaux par defaut ─────────

/**
 * Stratégie d'interpolation des poids aux bornes de période d'alimentation.
 * LINEAIRE  : interpolation linéaire entre deux biométries encadrantes (défaut, ADR-028).
 * GOMPERTZ_VAGUE : utilise la courbe Gompertz de la vague si calibrée et fiable.
 * En l'absence d'un GompertzVague fiable, le système retombe automatiquement sur LINEAIRE.
 */
interpolationStrategy StrategieInterpolation @default(LINEAIRE)
```

```prisma
// À ajouter dans les enums — section Phase 3 / ConfigElevage
enum StrategieInterpolation {
  LINEAIRE
  GOMPERTZ_VAGUE
}
```

### 2. Interface TypeScript — `StrategieInterpolation`

À ajouter dans `src/types/models.ts` (section des enums Phase 3 / ConfigElevage) :

```typescript
/**
 * Stratégie d'interpolation du poids aux bornes de période d'alimentation.
 *
 * LINEAIRE      — interpolation linéaire entre deux biométries encadrantes.
 *                 Défaut. Précis à ±5 % pour des biométries espacées de 7-21 jours.
 * GOMPERTZ_VAGUE — utilise la courbe Gompertz calibrée de la vague (GompertzVague)
 *                 si confidenceLevel est HIGH ou MEDIUM.
 *                 Fallback vers LINEAIRE si Gompertz non disponible ou insuffisant.
 */
export enum StrategieInterpolation {
  LINEAIRE = "LINEAIRE",
  GOMPERTZ_VAGUE = "GOMPERTZ_VAGUE",
}
```

À ajouter dans `ConfigElevage` (interface TypeScript miroir) :

```typescript
/** Stratégie d'interpolation des poids aux bornes de période (ADR-029) */
interpolationStrategy: StrategieInterpolation;
```

### 3. Nouveau type `GompertzVagueContext` dans `src/lib/feed-periods.ts`

Pour passer les paramètres Gompertz disponibles à `interpolerPoidsBac` sans couplage fort au
modèle Prisma :

```typescript
/**
 * Contexte Gompertz optionnel pour la stratégie GOMPERTZ_VAGUE.
 *
 * Transmis par l'appelant (computeAlimentMetrics) depuis un GompertzVague DB row.
 * Si null ou confidenceLevel insuffisant, le système retombe sur LINEAIRE.
 */
export interface GompertzVagueContext {
  /** W∞ — poids asymptotique en grammes */
  wInfinity: number;
  /** k — constante de taux de croissance (1/jour) */
  k: number;
  /** ti — point d'inflexion en jours depuis le début de la vague */
  ti: number;
  /** R² — coefficient de détermination du calibrage */
  r2: number;
  /** Niveau de confiance — seuls HIGH et MEDIUM déclenchent Gompertz */
  confidenceLevel: "HIGH" | "MEDIUM" | "LOW" | "INSUFFICIENT_DATA";
  /** Date de début de la vague — nécessaire pour convertir targetDate en t (jours) */
  vagueDebut: Date;
}
```

### 4. Signature modifiée de `interpolerPoidsBac`

```typescript
/**
 * Interpole ou récupère le poids moyen d'un bac à une date donnée.
 *
 * Stratégie (ADR-028 + ADR-029) :
 *   1. Biométrie exacte — même jour calendaire  →  BIOMETRIE_EXACTE
 *   2a. Si stratégie = GOMPERTZ_VAGUE et GompertzVagueContext valide (HIGH | MEDIUM) :
 *       évaluer gompertzWeight(t, params)  →  GOMPERTZ_VAGUE
 *   2b. Sinon interpolation linéaire entre deux biométries encadrantes  →  INTERPOLATION_LINEAIRE
 *   3. Poids initial de la vague (fallback final)  →  VALEUR_INITIALE
 *
 * Le Gompertz est utilisé uniquement pour l'étape 2 (quand aucune biométrie exacte n'existe).
 * Il ne remplace pas la biométrie exacte (étape 1).
 *
 * @param targetDate   - date pour laquelle estimer le poids
 * @param bacId        - identifiant du bac (null = vague entière)
 * @param biometries   - série temporelle de biométries (triées par date)
 * @param poidsInitial - poids moyen initial de la vague (fallback final)
 * @param options      - options de stratégie (ADR-029)
 * @returns { poids, methode } — null si aucune donnée disponible
 */
export function interpolerPoidsBac(
  targetDate: Date,
  bacId: string | null,
  biometries: BiometriePoint[],
  poidsInitial: number,
  options?: {
    strategie?: StrategieInterpolation;
    gompertzContext?: GompertzVagueContext;
  }
): { poids: number; methode: PeriodeAlimentaire["methodeEstimation"] } | null;
```

### 5. Extension de `PeriodeAlimentaire["methodeEstimation"]`

L'union des méthodes d'estimation doit inclure le nouveau cas Gompertz :

```typescript
// Dans src/types/calculs.ts — interface PeriodeAlimentaire
methodeEstimation:
  | "BIOMETRIE_EXACTE"
  | "INTERPOLATION_LINEAIRE"
  | "GOMPERTZ_VAGUE"
  | "VALEUR_INITIALE";
```

L'ordre de rang (pour la qualité indicative dans `segmenterPeriodesAlimentaires`) devient :

```
BIOMETRIE_EXACTE (3) > GOMPERTZ_VAGUE (2) > INTERPOLATION_LINEAIRE (1) > VALEUR_INITIALE (0)
```

Justification : Gompertz MEDIUM/HIGH (R² ≥ 0.85) est considéré plus fiable que l'interpolation
linéaire pour des intervalles inter-biométries longs (> 21 jours), mais moins fiable qu'une
mesure directe.

### 6. Signature modifiée de `segmenterPeriodesAlimentaires`

L'appelant fournit la stratégie et le contexte Gompertz si disponible. La fonction les transmet
à chaque appel interne de `interpolerPoidsBac`.

```typescript
export function segmenterPeriodesAlimentaires(
  relevsAlim: ReleveAlimPoint[],
  biometries: BiometriePoint[],
  vagueContext: VagueContext,
  options?: {
    strategie?: StrategieInterpolation;
    gompertzContext?: GompertzVagueContext;
  }
): PeriodeAlimentaire[];
```

### 7. Mise à jour de l'appelant dans `computeAlimentMetrics`

```typescript
// Dans src/lib/queries/analytics.ts

// Récupérer ConfigElevage.interpolationStrategy et GompertzVague depuis la DB
const config = vague.configElevage;
const gompertz = vague.gompertz; // GompertzVague | null

const gompertzContext: GompertzVagueContext | undefined =
  gompertz && config?.interpolationStrategy === StrategieInterpolation.GOMPERTZ_VAGUE
    ? {
        wInfinity: gompertz.wInfinity,
        k: gompertz.k,
        ti: gompertz.ti,
        r2: gompertz.r2,
        confidenceLevel: gompertz.confidenceLevel as GompertzVagueContext["confidenceLevel"],
        vagueDebut: vague.dateDebut,
      }
    : undefined;

const periodes = segmenterPeriodesAlimentaires(
  relevsAlimBac,
  biometriesBac,
  vagueContext,
  {
    strategie: config?.interpolationStrategy ?? StrategieInterpolation.LINEAIRE,
    gompertzContext,
  }
);
```

---

## Gompertz per-tank vs Gompertz per-vague

### Clarification conceptuelle

Le modèle `GompertzVague` est calibré sur **toutes les biométries de la vague** (tous bacs
confondus). Ce n'est pas un modèle par bac individuel.

Lorsque la stratégie `GOMPERTZ_VAGUE` est activée, `interpolerPoidsBac` évalue
`gompertzWeight(t, params_vague)` pour estimer le poids à la date cible. Cela revient à
supposer que tous les bacs d'une vague suivent la même courbe de croissance en tendance.

Cette hypothèse est raisonnable quand :
- Les bacs ont reçu les mêmes alevins (même lot génétique, même poids initial)
- Les conditions d'élevage sont similaires entre bacs
- L'intervalle sans biométrie exacte est long (> 21 jours)

### Pourquoi ne pas calibrer un Gompertz par bac ?

ADR-028 Alternative A l'a explicitement rejeté pour trois raisons qui restent valables :
1. Les biométries par bac sont trop peu nombreuses (souvent 2-4 par bac vs 5 min requis)
2. La complexité de stockage est disproportionnée (N modèles par vague)
3. Les bacs d'une même vague ont des conditions quasi-identiques — la courbe vague est un
   proxy valide pour chaque bac

La stratégie `GOMPERTZ_VAGUE` est donc bien un Gompertz au niveau vague appliqué à l'estimation
du poids d'un bac spécifique. Ce n'est pas un Gompertz per-tank.

---

## Données minimales requises

Pour que la stratégie `GOMPERTZ_VAGUE` soit activée (et non ignorée avec fallback vers LINEAIRE),
les conditions suivantes doivent être réunies au moment du calcul :

| Condition | Seuil | Source |
|-----------|-------|--------|
| GompertzVague existant pour la vague | non null | `Vague.gompertz` |
| Niveau de confiance | HIGH ou MEDIUM | `GompertzVague.confidenceLevel` |
| Coefficient de détermination R² | ≥ 0.85 | `GompertzVague.r2` |
| Nombre de biométries calibrées | ≥ `configElevage.gompertzMinPoints` | `GompertzVague.biometrieCount` |

La valeur de `configElevage.gompertzMinPoints` est utilisée directement, sans surcharge ni
plancher minimum. La valeur par défaut dans `ConfigElevage` est **3** (trois points), qui
correspond au nombre de paramètres du modèle Gompertz (W∞, k, ti).

> **Note sur le trade-off R² / n = 3.** Lorsque `gompertzMinPoints = 3`, le modèle Gompertz
> dispose exactement d'autant de paramètres que de points d'observation. Dans ce cas, le modèle
> peut passer parfaitement par les 3 points et R² ≈ 1.0 quelle que soit la qualité réelle de la
> courbe — R² perd son pouvoir discriminant. Le seuil R² ≥ 0.85 ne sert donc plus de garde-fou
> utile avec n = 3. L'éleveur qui configure `gompertzMinPoints = 3` accepte ce trade-off en
> connaissance de cause : il préfère activer Gompertz tôt (dès la troisième biométrie) au
> détriment de la valeur indicative de R². Aucune surcharge `max(config, 4)` ou `max(config, 5)`
> n'est appliquée — la valeur de config est utilisée telle quelle.

Si l'une de ces conditions n'est pas remplie, le système retombe silencieusement sur
l'interpolation linéaire (étape 2b) sans modifier le contrat de retour.

Le seuil R² = 0.85 correspond au niveau `MEDIUM` défini dans `src/lib/gompertz.ts` :

```
HIGH   : biometrieCount >= minPoints + 5  AND  R² > 0.95
MEDIUM : biometrieCount >= minPoints + 2  AND  R² > 0.85
LOW    : biometrieCount >= minPoints      (R² non contraint)
INSUFFICIENT_DATA : < minPoints
```

---

## Chaîne de fallback complète

```
Stratégie configurée = GOMPERTZ_VAGUE
    │
    ▼
GompertzVague existe pour la vague ?
    │ Non → utiliser INTERPOLATION_LINEAIRE (étape 2b)
    │ Oui
    ▼
confidenceLevel = HIGH ou MEDIUM ?
    │ Non (LOW ou INSUFFICIENT_DATA) → utiliser INTERPOLATION_LINEAIRE
    │ Oui
    ▼
r2 >= 0.85 ?
    │ Non → utiliser INTERPOLATION_LINEAIRE
    │ (Note : avec n = gompertzMinPoints = 3, R² ≈ 1.0 toujours — seuil non discriminant,
    │  mais l'éleveur accepte ce trade-off en fixant un seuil bas.)
    │ Oui
    ▼
biometrieCount >= configElevage.gompertzMinPoints ?
    │ Non → utiliser INTERPOLATION_LINEAIRE
    │ (gompertzMinPoints utilisé tel quel, sans plancher minimum appliqué)
    │ Oui
    ▼
Calculer t = jours(targetDate - vagueDebut)
Évaluer gompertzWeight(t, params)
    │
    ▼
Résultat valide (poids > 0) ?
    │ Non (ex. t négatif ou NaN) → utiliser INTERPOLATION_LINEAIRE
    │ Oui
    ▼
Retourner { poids, methode: "GOMPERTZ_VAGUE" }
```

```
Étape 2b — INTERPOLATION_LINEAIRE
    │
    ▼
Deux biométries encadrent la date cible ?
    │ Non → étape 3
    │ Oui
    ▼
Interpoler linéairement
Retourner { poids, methode: "INTERPOLATION_LINEAIRE" }
```

```
Étape 3 — VALEUR_INITIALE
    │
    ▼
Retourner { poids: poidsInitial, methode: "VALEUR_INITIALE" }
```

---

## Impact sur les fichiers existants

### Fichiers à modifier

| Fichier | Action | Description |
|---------|--------|-------------|
| `prisma/schema.prisma` | Modifier | Ajouter enum `StrategieInterpolation` + champ `interpolationStrategy` dans `ConfigElevage` |
| `src/types/models.ts` | Modifier | Ajouter `StrategieInterpolation` enum TypeScript + champ dans interface `ConfigElevage` |
| `src/types/calculs.ts` | Modifier | Étendre `PeriodeAlimentaire.methodeEstimation` avec `"GOMPERTZ_VAGUE"` |
| `src/lib/feed-periods.ts` | Modifier | Ajouter `GompertzVagueContext`, modifier signatures `interpolerPoidsBac` et `segmenterPeriodesAlimentaires`, implémenter la logique Gompertz étape 2a |
| `src/lib/queries/analytics.ts` | Modifier | Passer `strategie` et `gompertzContext` à `segmenterPeriodesAlimentaires` |
| `src/__tests__/lib/feed-periods.test.ts` | Modifier | Ajouter cas de test pour la stratégie GOMPERTZ_VAGUE et les fallbacks |

### Aucun changement de contrat API

Le type de retour de `computeAlimentMetrics` et les interfaces de réponse des routes analytics
ne changent pas. La valeur `methodeEstimation` dans `PeriodeAlimentaire` peut maintenant valoir
`"GOMPERTZ_VAGUE"` au lieu de `"INTERPOLATION_LINEAIRE"`, mais ce champ n'est pas exposé dans
les réponses JSON publiques actuellement.

### Migration Prisma requise

```sql
-- Créer l'enum
CREATE TYPE "StrategieInterpolation" AS ENUM ('LINEAIRE', 'GOMPERTZ_VAGUE');

-- Ajouter le champ avec valeur par défaut
ALTER TABLE "ConfigElevage"
  ADD COLUMN "interpolationStrategy" "StrategieInterpolation" NOT NULL DEFAULT 'LINEAIRE';
```

La migration est non-destructive : toutes les ConfigElevage existantes obtiennent `LINEAIRE`
comme valeur par défaut, ce qui préserve le comportement actuel (ADR-028).

---

## Cas de test requis

```typescript
// src/__tests__/lib/feed-periods.test.ts — nouveaux cas (ADR-029)

// 1. Stratégie LINEAIRE (comportement inchangé d'ADR-028)
describe("interpolerPoidsBac — stratégie LINEAIRE", () => {
  it("retourne INTERPOLATION_LINEAIRE quand deux biométries encadrent la date")
  it("retourne VALEUR_INITIALE quand aucune biométrie avant la date")
})

// 2. Stratégie GOMPERTZ_VAGUE — cas nominal
describe("interpolerPoidsBac — stratégie GOMPERTZ_VAGUE", () => {
  it("évalue gompertzWeight(t, params) quand GompertzVagueContext HIGH et R²=0.97")
  it("retourne methode GOMPERTZ_VAGUE dans ce cas")
  it("biométrie exacte prime toujours sur Gompertz (étape 1 inchangée)")
})

// 3. Fallbacks Gompertz
describe("interpolerPoidsBac — fallbacks GOMPERTZ_VAGUE", () => {
  it("retombe sur LINEAIRE si confidenceLevel = LOW")
  it("retombe sur LINEAIRE si confidenceLevel = INSUFFICIENT_DATA")
  it("retombe sur LINEAIRE si r2 < 0.85")
  it("retombe sur LINEAIRE si gompertzContext est undefined")
  it("retombe sur LINEAIRE si gompertzWeight retourne NaN (t négatif)")
})

// 4. segmenterPeriodesAlimentaires transmet la stratégie
describe("segmenterPeriodesAlimentaires — options", () => {
  it("transmet stratégie GOMPERTZ_VAGUE à tous les appels interpolerPoidsBac")
  it("sans options, utilise LINEAIRE par défaut (comportement ADR-028 préservé)")
})
```

---

## Conséquences

### Positives

- Les éleveurs avancés avec un Gompertz bien calibré (R² > 0.95) obtiennent des estimations de
  poids aux bornes de période plus précises sur des cycles longs, ce qui améliore la fidélité
  du FCR calculé.
- Le comportement par défaut (LINEAIRE) est inchangé pour tous les sites existants — migration
  non-cassante.
- La stratégie est traçable par vague (via `configElevageId`) et exposable dans l'UI paramètres.
- La chaîne de fallback est explicite et testée — pas de comportement surprise.

### Contraintes / Risques

- **Divergence per-bac.** Si des bacs d'une même vague ont des conditions très différentes
  (densités différentes, qualité eau différente), la courbe Gompertz vague peut sur- ou
  sous-estimer le poids d'un bac spécifique. Ce risque est documenté mais jugé acceptable
  (même situation qu'avec l'interpolation linéaire si les biométries ne sont pas par bac).

- **Sensibilité au timing du recalibrage Gompertz.** Si `GompertzVague` est périmé (calibré
  avant les dernières biométries), il peut être moins précis que l'interpolation linéaire entre
  les deux dernières biométries réelles. Ce risque est mitigé par le seuil R² : un Gompertz
  périmé avec nouvelles données qui divergent aura un R² plus bas → fallback automatique.

- **Coût de requête.** `computeAlimentMetrics` doit inclure `vague.gompertz` dans son `include`
  Prisma. Coût minimal (une jointure supplémentaire, relation `@unique` déjà indexée).

---

## Décisions reportées

- **Interface UI.** Le champ `interpolationStrategy` sera exposé dans la page "Paramètres du
  profil d'élevage" (ConfigElevage). Le design UI précis est délégué au Sprint correspondant.
  Le label recommandé : "Méthode d'estimation du poids" avec options :
  `Interpolation linéaire (recommandée)` / `Modèle Gompertz (si calibré)`.

- **Gompertz per-tank.** Reste rejeté (même arguments qu'ADR-028 Alternative A). À reconsidérer
  uniquement si des éleveurs documentent un biais per-bac significatif avec des données réelles.

---

## Plan d'implémentation

| Étape | Agent | Action |
|-------|-------|--------|
| 1 | @architect | Ce document (ADR-029) — FAIT |
| 2 | @db-specialist | Migration Prisma : enum `StrategieInterpolation` + champ `interpolationStrategy` dans `ConfigElevage` |
| 3 | @developer | Ajouter `StrategieInterpolation` dans `src/types/models.ts` + mettre à jour `ConfigElevage` interface |
| 4 | @developer | Étendre `PeriodeAlimentaire.methodeEstimation` dans `src/types/calculs.ts` |
| 5 | @developer | Modifier `src/lib/feed-periods.ts` : ajouter `GompertzVagueContext`, modifier `interpolerPoidsBac` et `segmenterPeriodesAlimentaires` |
| 6 | @developer | Mettre à jour `computeAlimentMetrics` dans `src/lib/queries/analytics.ts` |
| 7 | @tester | Créer les cas de test ADR-029 dans `src/__tests__/lib/feed-periods.test.ts` |
| 8 | @tester | Vérifier `npx vitest run` + `npm run build` |
