# PLAN v2 — Implémentation complète des analytiques aliments (F1–F24)

**Date :** 2026-03-28
**Auteur :** @architect
**Version :** 2 — révision post adversarial review + edge case hunter
**Référence :** ADR-feed-analytics-research.md, PLAN-feed-analytics.md (v1)
**Statut :** PLAN / EXÉCUTABLE

---

## Résumé des changements par rapport à la v1

| # | Problème v1 | Correction v2 |
|---|-------------|---------------|
| A1 | `datePeremption`/`lotFabrication` sur `Produit` (catalogue) | Déplacés sur `MouvementStock` (niveau lot) |
| A2 | `phasesCibles` array — trade-off documenté | Documenté explicitement + garde `.has()` |
| A3 | `tauxRefus` Float sans validation | Validation API : liste blanche {0, 10, 25, 50} |
| A4 | Score hardcodeait 500–4000 CFA | Seuils configurables via `ConfigElevage.scoreConfig` |
| A5 | `getFCRHebdomadaire` stub vide | Pseudocode algorithmique complet + interpolation biométrie |
| A6 | Interpolation FCR hand-wavée | Algorithme linéaire explicite documenté |
| A7 | Strings français hardcodés | Toutes les chaînes via clés i18n |
| A8 | `comportementAlim`/`tauxRefus` sur tous les types | Validation API rejette si `typeReleve !== ALIMENTATION` |
| A9 | Pas de rollback SQL | Rollback SQL documenté |
| A10 | Seed UPDATE fragile (LIKE sans categorie) | Seed corrigé avec `AND categorie='ALIMENT'` |
| A11 | Phase 4 vague | Scope explicité, items "design needed" marqués |
| A12 | `HistoriqueNutritionnel` duplique données | Justification matérialisation + `@@unique([vagueId, phase])` |
| A13 | Pas de plan rétrocompatibilité analytics | Option "Non renseigné" + null handling documenté |
| E1 | tauxProteines accepte valeurs négatives | Validation 0–100 |
| E2 | ADG peut être négatif | Décision : autorisé (signal perte de poids) + doc |
| E3 | `calculerScoreAliment` avec FCR=0 | Guard `fcr <= 0 → return null` |
| E4 | Bug math score: `(score/poidsTotal)*10` | Corrigé : `score / poidsTotal` sans `*10` |
| E5 | Filtre spread falsy check fragile | Check `!== undefined && !== null` explicite |
| E6 | searchParams cast sans validation | Validation via liste blanche avant cast enum |
| E7 | `getFCRHebdomadaire` non filtré par bac | Filtrage par bac documenté |
| E8 | Biométries avec `poidsMoyen=null` | Filter `poidsMoyen: { not: null }` dans query |
| E9 | `getAlertesRation` sans guard ConfigElevage | Guard : skip vagues sans config |
| E10 | PER — unité gainPoids en grammes | Contrat caller documenté |
| E11 | `HistoriqueNutritionnel` sans `@@unique` | `@@unique([vagueId, phase])` ajouté |
| E12 | `datePeremption` string invalide → NaN | Supprimé (maintenant sur MouvementStock) |
| E13 | DLC query mélange expirés/bientôt | Query séparée expiré vs expiring-soon |
| E14 | ADG benchmark boundary exacte | Comportement de frontière documenté (≤ exclusif) |
| E15 | `getSaisonCameroun` hardcoded | Documenté : multi-tenant → param `pays` ou config |

---

## Vue d'ensemble

Ce plan couvre les 24 améliorations (F1–F24) de l'ADR feed analytics, organisées en 4 phases séquentielles. Chaque phase peut être implémentée dans un sprint distinct. Les dépendances entre features sont explicites.

### Récapitulatif des fichiers critiques existants

| Fichier | Rôle actuel |
|---------|-------------|
| `prisma/schema.prisma` | Schéma DB — Produit, Releve, MouvementStock, PhaseElevage |
| `src/types/models.ts` | Interfaces TypeScript miroirs |
| `src/types/calculs.ts` | AnalytiqueAliment, ComparaisonAliments, DetailAliment |
| `src/lib/calculs.ts` | calculerFCR, calculerSGR, calculerFCRParAliment, calculerCoutParKgGain |
| `src/lib/benchmarks.ts` | BENCHMARK_FCR, BENCHMARK_SGR, evaluerBenchmark |
| `src/lib/queries/analytics.ts` | computeAlimentMetrics, getComparaisonAliments, getDetailAliment |
| `src/app/analytics/aliments/page.tsx` | Page liste aliments |
| `src/app/analytics/aliments/[produitId]/page.tsx` | Page détail aliment |
| `src/components/analytics/feed-comparison-cards.tsx` | Cartes comparaison aliments |
| `src/components/analytics/feed-detail-charts.tsx` | Graphiques détail FCR |
| `prisma/seed.sql` | Données de test |
| `src/messages/fr/analytics.json` | Clés i18n analytics |
| `src/messages/fr/stock.json` | Clés i18n stock/produits |

### Enums déjà présents et réutilisables

- `PhaseElevage` — valeurs : ACCLIMATATION, CROISSANCE_DEBUT, JUVENILE, GROSSISSEMENT, FINITION, PRE_RECOLTE
- `CategorieProduit` — valeurs : ALIMENT, INTRANT, EQUIPEMENT

### Enums à créer

- `TailleGranule` — ABSENT
- `FormeAliment` — ABSENT
- `ComportementAlimentaire` — ABSENT

---

## Décision architecturale : `datePeremption` et `lotFabrication` sur MouvementStock

**Problème v1 :** Ces champs étaient sur le modèle `Produit`. Or `Produit` est un article de catalogue — une seule fiche par aliment, quel que soit le nombre de lots physiques en stock. Mettre `datePeremption` sur `Produit` force une valeur unique alors que plusieurs lots (DLC différentes) peuvent coexister simultanément.

**Décision v2 :** Ces champs vont sur `MouvementStock` (type `ENTREE` = réception de lot). Chaque entrée en stock représente un lot physique avec sa propre DLC et son numéro de lot.

**Conséquence :**
- La query DLC cherche les `MouvementStock` de type ENTREE avec `datePeremption` proche et stock résiduel estimé non nul.
- Le formulaire "réception stock" (ENTREE) expose ces deux champs.
- L'interface `Produit` TypeScript ne contient plus `datePeremption` ni `lotFabrication`.
- F21 (alerte DLC) utilise `MouvementStock` et non `Produit`.

---

## Décision architecturale : `phasesCibles` comme tableau PostgreSQL natif

**Trade-off documenté :** PostgreSQL supporte les arrays natifs. Prisma supporte `has` (un seul élément) mais pas `hasEvery` ni `hasSome` en filtre SQL efficace. La syntaxe `phasesCibles: { has: phaseCible }` filtre "aliments recommandés pour cette phase" — c'est le seul cas d'usage actuel. Si une intersection multi-valeurs est nécessaire (ex : "aliments recommandés pour JUVENILE ET GROSSISSEMENT"), il faudra une jointure via un modèle `ProduitPhase` séparé. Pour les besoins actuels (filtre single-value), le tableau natif est suffisant et correct.

---

## Phase 1 — Schéma, types, migration, seed (F1, F5, F6, F7, F8, F12)

**Features couvertes :** F1 (tailleGranule), F5 (formeAliment), F6 (tauxProteines), F7 (tauxRefus), F8 (comportementAlim), F12 (tauxLipides, tauxFibres), F21 (DLC sur MouvementStock)

**Objectif :** Enrichir le schéma de données sans casser l'existant. Tous les champs sont nullable — non-destructifs.

---

### 1.1 — Nouveaux enums Prisma

**Fichier :** `prisma/schema.prisma`

Ajouter après la déclaration de `PhaseElevage`, avant la section `// Enums — Production Alevins` :

```prisma
// ──────────────────────────────────────────
// Enums — Analytiques aliments (PLAN-feed-analytics-v2)
// ──────────────────────────────────────────

enum TailleGranule {
  P0  // Poudre < 0.5 mm — larves 0-0.5 g
  P1  // Poudre 0.5 mm — alevins 0.5-2 g
  C1  // Crumble 1 mm — alevins 2-5 g
  C2  // Crumble 1.5 mm — alevins 5-10 g
  G1  // Granulé 2 mm — fingerlings 10-30 g
  G2  // Granulé 3 mm — juvéniles 30-100 g
  G3  // Granulé 4 mm — juvéniles 100-300 g
  G4  // Granulé 6 mm — sub-adultes 300-600 g
  G5  // Granulé 8 mm — adultes > 600 g
}

enum FormeAliment {
  FLOTTANT
  COULANT
  SEMI_FLOTTANT
  POUDRE
}

enum ComportementAlimentaire {
  NORMAL
  LENT
  REFUS_PARTIEL
  REFUS_TOTAL
}
```

---

### 1.2 — Champs sur le modèle Produit

**Fichier :** `prisma/schema.prisma`

Localiser `model Produit {`. Ajouter les champs suivants après `isActive` et avant `siteId` :

```prisma
  // ── Analytiques aliments (PLAN-feed-analytics-v2) ────────────────────────
  // Ces champs sont pertinents uniquement pour categorie = ALIMENT
  // Tous nullable pour rétrocompatibilité

  /** Granulométrie — taille du granulé ciblée */
  tailleGranule     TailleGranule?

  /** Forme physique de l'aliment */
  formeAliment      FormeAliment?

  /** Taux de protéines brutes en % de matière sèche */
  tauxProteines     Float?

  /** Taux de lipides bruts en % MS */
  tauxLipides       Float?

  /** Taux de fibres brutes en % MS */
  tauxFibres        Float?

  /** Phases d'élevage recommandées (tableau PostgreSQL natif) */
  phasesCibles      PhaseElevage[]
```

**Note :** `datePeremption` et `lotFabrication` ne sont PAS sur `Produit` (voir décision architecturale ci-dessus). Ces champs sont sur `MouvementStock`.

---

### 1.3 — Champs sur le modèle Releve

**Fichier :** `prisma/schema.prisma`

Localiser `model Releve {`. Ajouter après `quantiteAliment` et `typeAliment` :

```prisma
  // ── Analytiques aliments — champs type ALIMENTATION uniquement ────────────
  // IMPORTANT : tauxRefus et comportementAlim sont valides UNIQUEMENT quand
  // typeReleve = ALIMENTATION. L'API valide et rejette si typeReleve != ALIMENTATION.

  /** Estimation du taux de refus : uniquement les valeurs 0, 10, 25, 50 (%) */
  tauxRefus         Float?

  /** Comportement alimentaire observé lors de la distribution */
  comportementAlim  ComportementAlimentaire?
```

---

### 1.4 — Champs sur le modèle MouvementStock (F21)

**Fichier :** `prisma/schema.prisma`

Localiser `model MouvementStock {`. Ajouter après les champs existants :

```prisma
  // ── Traçabilité lot (PLAN-feed-analytics-v2 / F21) ────────────────────────
  // Ces champs sont pertinents uniquement pour les mouvements de type ENTREE
  // et pour les produits de categorie = ALIMENT

  /** Date de péremption du lot reçu (alerte DLC) */
  datePeremption    DateTime?

  /** Numéro de lot fabricant (traçabilité) */
  lotFabrication    String?
```

---

### 1.5 — Champs ConfigElevage pour le score configurable (A4)

**Fichier :** `prisma/schema.prisma`

Localiser `model ConfigElevage {`. Ajouter un champ JSON pour les seuils du score :

```prisma
  // ── Seuils score qualité aliment (PLAN-feed-analytics-v2) ────────────────
  // JSON de type ScoreAlimentConfig (voir src/types/calculs.ts)
  // Null = utiliser les seuils par défaut (voir calculerScoreAliment)
  scoreAlimentConfig Json?
```

---

### 1.6 — Migration SQL

**Fichier à créer :** `prisma/migrations/20260328000001_add_feed_analytics_v2/migration.sql`

```sql
-- Migration : add_feed_analytics_v2
-- Nouveaux enums + champs Produit, Releve, MouvementStock, ConfigElevage
-- Non-destructif : tous les champs sont nullable

-- 1. Créer les nouveaux enums
CREATE TYPE "TailleGranule" AS ENUM (
  'P0', 'P1', 'C1', 'C2',
  'G1', 'G2', 'G3', 'G4', 'G5'
);

CREATE TYPE "FormeAliment" AS ENUM (
  'FLOTTANT', 'COULANT', 'SEMI_FLOTTANT', 'POUDRE'
);

CREATE TYPE "ComportementAlimentaire" AS ENUM (
  'NORMAL', 'LENT', 'REFUS_PARTIEL', 'REFUS_TOTAL'
);

-- 2. Ajouter les champs sur Produit (tous nullable)
ALTER TABLE "Produit"
  ADD COLUMN "tailleGranule"  "TailleGranule",
  ADD COLUMN "formeAliment"   "FormeAliment",
  ADD COLUMN "tauxProteines"  DOUBLE PRECISION,
  ADD COLUMN "tauxLipides"    DOUBLE PRECISION,
  ADD COLUMN "tauxFibres"     DOUBLE PRECISION,
  ADD COLUMN "phasesCibles"   "PhaseElevage"[] NOT NULL DEFAULT '{}';

-- 3. Ajouter les champs sur Releve (tous nullable)
ALTER TABLE "Releve"
  ADD COLUMN "tauxRefus"        DOUBLE PRECISION,
  ADD COLUMN "comportementAlim" "ComportementAlimentaire";

-- 4. Ajouter les champs de traçabilité lot sur MouvementStock (tous nullable)
ALTER TABLE "MouvementStock"
  ADD COLUMN "datePeremption"  TIMESTAMP(3),
  ADD COLUMN "lotFabrication"  TEXT;

-- 5. Ajouter scoreAlimentConfig sur ConfigElevage (nullable)
ALTER TABLE "ConfigElevage"
  ADD COLUMN "scoreAlimentConfig" JSONB;
```

**Appliquer avec :**
```bash
npx prisma migrate deploy
npx prisma generate
```

---

### 1.7 — Rollback SQL (A9)

**Fichier à créer :** `prisma/migrations/20260328000001_add_feed_analytics_v2/rollback.sql`

```sql
-- Rollback : supprime les ajouts de feed_analytics_v2
-- ATTENTION : destructif si des données ont été saisies dans ces colonnes

ALTER TABLE "ConfigElevage"
  DROP COLUMN IF EXISTS "scoreAlimentConfig";

ALTER TABLE "MouvementStock"
  DROP COLUMN IF EXISTS "datePeremption",
  DROP COLUMN IF EXISTS "lotFabrication";

ALTER TABLE "Releve"
  DROP COLUMN IF EXISTS "tauxRefus",
  DROP COLUMN IF EXISTS "comportementAlim";

ALTER TABLE "Produit"
  DROP COLUMN IF EXISTS "tailleGranule",
  DROP COLUMN IF EXISTS "formeAliment",
  DROP COLUMN IF EXISTS "tauxProteines",
  DROP COLUMN IF EXISTS "tauxLipides",
  DROP COLUMN IF EXISTS "tauxFibres",
  DROP COLUMN IF EXISTS "phasesCibles";

DROP TYPE IF EXISTS "ComportementAlimentaire";
DROP TYPE IF EXISTS "FormeAliment";
DROP TYPE IF EXISTS "TailleGranule";
```

---

### 1.8 — Nouveaux enums TypeScript

**Fichier :** `src/types/models.ts`

Ajouter après le bloc `PhaseElevage`, avant le commentaire `// Enums — Phase 3 :` :

```typescript
// ---------------------------------------------------------------------------
// Enums — Analytiques aliments (PLAN-feed-analytics-v2)
// ---------------------------------------------------------------------------

/**
 * TailleGranule — granulométrie de l'aliment pour Clarias gariepinus.
 */
export enum TailleGranule {
  P0 = "P0",  // Poudre < 0.5 mm — larves 0-0.5 g
  P1 = "P1",  // Poudre 0.5 mm — alevins 0.5-2 g
  C1 = "C1",  // Crumble 1 mm — alevins 2-5 g
  C2 = "C2",  // Crumble 1.5 mm — alevins 5-10 g
  G1 = "G1",  // Granulé 2 mm — fingerlings 10-30 g
  G2 = "G2",  // Granulé 3 mm — juvéniles 30-100 g
  G3 = "G3",  // Granulé 4 mm — juvéniles 100-300 g
  G4 = "G4",  // Granulé 6 mm — sub-adultes 300-600 g
  G5 = "G5",  // Granulé 8 mm — adultes > 600 g
}

/** FormeAliment — forme physique de l'aliment */
export enum FormeAliment {
  FLOTTANT = "FLOTTANT",
  COULANT = "COULANT",
  SEMI_FLOTTANT = "SEMI_FLOTTANT",
  POUDRE = "POUDRE",
}

/** ComportementAlimentaire — comportement observé lors de la distribution */
export enum ComportementAlimentaire {
  NORMAL = "NORMAL",
  LENT = "LENT",
  REFUS_PARTIEL = "REFUS_PARTIEL",
  REFUS_TOTAL = "REFUS_TOTAL",
}
```

---

### 1.9 — Mise à jour interface Produit

**Fichier :** `src/types/models.ts`

Localiser `export interface Produit {`. Ajouter après `isActive` et avant `siteId` :

```typescript
  // ── Analytiques aliments (PLAN-feed-analytics-v2) ──────────────────────────
  // ABSENT : datePeremption et lotFabrication — ces champs sont sur MouvementStock
  tailleGranule: TailleGranule | null;
  formeAliment: FormeAliment | null;
  /** Taux de protéines brutes en % MS. Validé 0–100. */
  tauxProteines: number | null;
  /** Taux de lipides bruts en % MS. Validé 0–100. */
  tauxLipides: number | null;
  /** Taux de fibres brutes en % MS. Validé 0–100. */
  tauxFibres: number | null;
  phasesCibles: PhaseElevage[];
```

---

### 1.10 — Mise à jour interface Releve

**Fichier :** `src/types/models.ts`

Localiser `export interface Releve {`. Ajouter après `typeAliment` :

```typescript
  // ── Analytiques aliments (PLAN-feed-analytics-v2) ──────────────────────────
  // VALIDÉ côté API : rejetés si typeReleve !== ALIMENTATION (voir section 1.12)
  /** Taux de refus estimé : uniquement 0, 10, 25 ou 50 */
  tauxRefus: number | null;
  /** Comportement alimentaire observé */
  comportementAlim: ComportementAlimentaire | null;
```

---

### 1.11 — Mise à jour interface MouvementStock

**Fichier :** `src/types/models.ts`

Localiser `export interface MouvementStock {`. Ajouter les champs de traçabilité lot :

```typescript
  // ── Traçabilité lot (PLAN-feed-analytics-v2 / F21) ────────────────────────
  /** Date de péremption du lot reçu. Null si non renseignée ou mouvement SORTIE. */
  datePeremption: Date | null;
  /** Numéro de lot fabricant. */
  lotFabrication: string | null;
```

---

### 1.12 — Export barrel

**Fichier :** `src/types/index.ts`

Ajouter dans le bloc d'export des enums :

```typescript
  // PLAN-feed-analytics-v2 — Analytiques aliments
  TailleGranule,
  FormeAliment,
  ComportementAlimentaire,
```

---

### 1.13 — DTOs API mis à jour

**Fichier :** `src/types/api.ts`

```typescript
// Dans CreateProduitDTO et UpdateProduitDTO — après isActive?
tailleGranule?: TailleGranule | null;
formeAliment?: FormeAliment | null;
/** Validé 0–100 côté API */
tauxProteines?: number | null;
/** Validé 0–100 côté API */
tauxLipides?: number | null;
/** Validé 0–100 côté API */
tauxFibres?: number | null;
phasesCibles?: PhaseElevage[];
// NOTE : datePeremption et lotFabrication sont dans CreateMouvementStockDTO
```

```typescript
// Dans CreateReleveAlimentationDTO — après typeAliment?
/**
 * Validé côté API : uniquement les valeurs {0, 10, 25, 50}.
 * Rejeté avec 400 si typeReleve !== ALIMENTATION.
 */
tauxRefus?: number | null;
/**
 * Rejeté avec 400 si typeReleve !== ALIMENTATION.
 */
comportementAlim?: ComportementAlimentaire | null;
```

```typescript
// Dans CreateMouvementStockDTO — nouveaux champs
/** Date de péremption du lot (pertinent pour ENTREE + categorie ALIMENT) */
datePeremption?: Date | string | null;
/** Numéro de lot fabricant */
lotFabrication?: string | null;
```

```typescript
// Dans ProduitFilters — nouveaux champs
tailleGranule?: TailleGranule;
formeAliment?: FormeAliment;
/**
 * Filtre les aliments recommandés pour cette phase.
 * Utilise Prisma `has` (single-value — suffisant pour le cas d'usage actuel).
 */
phaseCible?: PhaseElevage;
```

---

### 1.14 — Validation API côté route (A3, A8, E1)

**Fichier :** `src/app/api/releves/route.ts`

Dans le handler POST, avant l'insertion Prisma, ajouter :

```typescript
// Validation : tauxRefus et comportementAlim rejetés si typeReleve !== ALIMENTATION
if (data.typeReleve !== TypeReleve.ALIMENTATION) {
  if (data.tauxRefus !== undefined && data.tauxRefus !== null) {
    return NextResponse.json(
      { error: "tauxRefus est valide uniquement pour les relevés ALIMENTATION" },
      { status: 400 }
    );
  }
  if (data.comportementAlim !== undefined && data.comportementAlim !== null) {
    return NextResponse.json(
      { error: "comportementAlim est valide uniquement pour les relevés ALIMENTATION" },
      { status: 400 }
    );
  }
}

// Validation : tauxRefus doit être dans la liste blanche {0, 10, 25, 50}
if (data.tauxRefus !== undefined && data.tauxRefus !== null) {
  const TAUX_REFUS_VALIDES = [0, 10, 25, 50];
  if (!TAUX_REFUS_VALIDES.includes(data.tauxRefus)) {
    return NextResponse.json(
      { error: "tauxRefus doit être 0, 10, 25 ou 50" },
      { status: 400 }
    );
  }
}
```

**Fichier :** `src/app/api/produits/route.ts` et `src/app/api/produits/[id]/route.ts`

```typescript
// Validation : taux nutritionnels dans la plage 0–100
for (const champ of ["tauxProteines", "tauxLipides", "tauxFibres"] as const) {
  const val = data[champ];
  if (val !== undefined && val !== null) {
    if (val < 0 || val > 100) {
      return NextResponse.json(
        { error: `${champ} doit être compris entre 0 et 100` },
        { status: 400 }
      );
    }
  }
}
```

**Fichier :** `src/app/api/produits/route.ts` — searchParams validation (E6)

```typescript
// Validation des searchParams enum avant cast
const tailleParam = searchParams.get("taille");
const TAILLES_VALIDES = Object.values(TailleGranule) as string[];
const tailleGranule = tailleParam && TAILLES_VALIDES.includes(tailleParam)
  ? (tailleParam as TailleGranule)
  : undefined;

const phaseParam = searchParams.get("phase");
const PHASES_VALIDES = Object.values(PhaseElevage) as string[];
const phaseCible = phaseParam && PHASES_VALIDES.includes(phaseParam)
  ? (phaseParam as PhaseElevage)
  : undefined;
```

Le même pattern s'applique dans `src/app/analytics/aliments/page.tsx`.

---

### 1.15 — Mise à jour du seed SQL (A10, E12)

**Fichier :** `prisma/seed.sql`

Les champs `datePeremption` et `lotFabrication` ne sont plus sur `Produit`. Ils sont dans les MouvementStock de type ENTREE.

Pour les UPDATE de produits aliments existants :

```sql
-- Correction v2 : filtrage strict par categorie pour éviter les collisions
UPDATE "Produit"
SET
  "tailleGranule" = 'G2',
  "formeAliment" = 'FLOTTANT',
  "tauxProteines" = 42.0,
  "tauxLipides" = 8.0,
  "tauxFibres" = 4.5,
  "phasesCibles" = ARRAY['JUVENILE', 'GROSSISSEMENT']::"PhaseElevage"[]
WHERE
  categorie = 'ALIMENT'
  AND (nom LIKE '%Skretting%' OR nom LIKE '%G2%' OR nom LIKE '%granulé 3mm%');
```

Pour les INSERT nouveaux :

```sql
INSERT INTO "Produit" (
  "id", "nom", "categorie", "unite", "prixUnitaire", "stockActuel",
  "seuilAlerte", "isActive", "siteId",
  "tailleGranule", "formeAliment", "tauxProteines", "tauxLipides",
  "tauxFibres", "phasesCibles", "createdAt", "updatedAt"
) VALUES (
  'prod-aliment-g3-seed',
  'Granulé G3 4mm',
  'ALIMENT',
  'KG',
  1200,
  80,
  20,
  true,
  'site-seed-id',
  'G3',
  'FLOTTANT',
  38.5,
  7.0,
  5.0,
  ARRAY['GROSSISSEMENT', 'FINITION']::"PhaseElevage"[],
  NOW(),
  NOW()
);
```

Pour les MouvementStock — ajout DLC sur les entrées aliment :

```sql
-- Ajout de datePeremption et lotFabrication sur une entrée stock existante
UPDATE "MouvementStock"
SET
  "datePeremption" = '2026-09-30T00:00:00.000Z',
  "lotFabrication" = 'LOT-2026-001'
WHERE
  "produitId" = 'prod-aliment-g3-seed'
  AND "type" = 'ENTREE'
  AND "datePeremption" IS NULL
LIMIT 1;
```

Pour les relevés ALIMENTATION en seed :

```sql
-- Relevé ALIMENTATION avec tauxRefus et comportementAlim
INSERT INTO "Releve" (..., "tauxRefus", "comportementAlim")
VALUES (..., 10, 'NORMAL');
-- Note : typeReleve DOIT être 'ALIMENTATION' sinon violation sémantique
```

---

### Tests Phase 1

**Fichier à créer :** `src/tests/phase1-feed-schema.test.ts`

Tests requis :
1. Migration sans erreur
2. `Produit.tailleGranule` accepte null et les valeurs enum
3. `Produit.phasesCibles` est un array vide par défaut
4. `Releve.tauxRefus` accepte 0, 10, 25, 50 — rejette 15 (liste blanche)
5. Route POST `/api/releves` rejette `tauxRefus` si `typeReleve !== ALIMENTATION`
6. Route POST `/api/releves` rejette `comportementAlim` si `typeReleve !== ALIMENTATION`
7. Route POST `/api/produits` rejette `tauxProteines = -1` et `tauxProteines = 101`
8. `MouvementStock.datePeremption` est nullable
9. `npm run build` sans erreur TypeScript

---

## Phase 2 — Calculs et queries (F9, F10, F11, F13, F17, F24)

**Features couvertes :**
- F9 : Calcul ADG (Average Daily Gain)
- F10 : Benchmarks FCR contextualisés par phase
- F11 : Score qualité aliment /10 (configurable)
- F13 : Calcul PER (Protein Efficiency Ratio)
- F17 : Détection changement granulé automatique
- F24 : Calcul DFR et alerte sur-alimentation

**Dépendances :** Phase 1 terminée

---

### 2.1 — Nouvelles fonctions dans calculs.ts

**Fichier :** `src/lib/calculs.ts`

Ajouter après `convertirUniteStock` :

```typescript
// ---------------------------------------------------------------------------
// PLAN-feed-analytics-v2 — Nouveaux indicateurs zootechniques
// ---------------------------------------------------------------------------

/**
 * Calcule le ADG (Average Daily Gain) — gain journalier moyen en g/jour.
 *
 * Formule : (poidsFinal - poidsInitial) / jours
 *
 * DÉCISION : ADG peut être négatif (signal de perte de poids, ex: stress,
 * maladie, sous-alimentation). Ne pas retourner null pour ADG < 0.
 * Retourner null uniquement si les données sont manquantes ou jours <= 0.
 *
 * Benchmarks Clarias gariepinus (frontières exclusives au seuil supérieur) :
 *   fingerling (< 30g)     : excellent > 1.5 g/j, bon > 1.0 g/j
 *   juvénile (30–150g)     : excellent > 3.0 g/j, bon > 2.0 g/j
 *   sub-adulte (150–400g)  : excellent > 5.0 g/j, bon > 3.5 g/j
 *   adulte (≥ 400g)        : excellent > 6.0 g/j, bon > 4.0 g/j
 *
 * @param poidsInitial - Poids moyen initial en grammes
 * @param poidsFinal - Poids moyen final en grammes (peut être < poidsInitial)
 * @param jours - Nombre de jours entre les deux mesures (doit être > 0)
 * @returns ADG en g/jour (peut être négatif), ou null si données insuffisantes
 */
export function calculerADG(
  poidsInitial: number | null,
  poidsFinal: number | null,
  jours: number | null
): number | null {
  if (
    poidsInitial == null ||
    poidsFinal == null ||
    jours == null ||
    jours <= 0
  ) {
    return null;
  }
  // Résultat peut être négatif intentionnellement (perte de poids)
  return (poidsFinal - poidsInitial) / jours;
}

/**
 * Calcule le PER (Protein Efficiency Ratio) — efficacité protéique.
 *
 * Formule : gainPoids(g) / proteinesConsommees(g)
 *   où proteinesConsommees(g) = quantiteAliment(kg) * 1000 * (tauxProteines / 100)
 *
 * CONTRAT CALLER : gainPoids DOIT être en grammes (population totale, pas individu).
 * Exemple correct : gainBiomasse(kg) * 1000 = gainPoids(g).
 *
 * Benchmark Clarias grossissement : PER > 2.0 (bon)
 *
 * @param gainPoidsG - Gain de poids total de la population en GRAMMES
 * @param quantiteAlimentKg - Quantité d'aliment consommée en kg
 * @param tauxProteinesPct - Taux de protéines en % MS (ex: 42 pour 42%) — validé 0–100
 * @returns PER sans unité, ou null si données insuffisantes
 */
export function calculerPER(
  gainPoidsG: number | null,
  quantiteAlimentKg: number | null,
  tauxProteinesPct: number | null
): number | null {
  if (
    gainPoidsG == null ||
    quantiteAlimentKg == null ||
    tauxProteinesPct == null ||
    quantiteAlimentKg <= 0 ||
    tauxProteinesPct <= 0
  ) {
    return null;
  }
  const proteinesConsommees = (quantiteAlimentKg * 1000) * (tauxProteinesPct / 100);
  if (proteinesConsommees <= 0) return null;
  return gainPoidsG / proteinesConsommees;
}

/**
 * Calcule le DFR (Daily Feeding Rate) — taux d'alimentation quotidien.
 *
 * Formule : (quantiteJournaliere / biomasse) × 100
 * Benchmark Clarias : 2–5 % biomasse/jour selon phase
 *
 * @param quantiteJournaliereKg - Quantité d'aliment distribuée en kg ce jour
 * @param biomasseKg - Biomasse estimée en kg
 * @returns DFR en % de la biomasse, ou null si données insuffisantes
 */
export function calculerDFR(
  quantiteJournaliereKg: number | null,
  biomasseKg: number | null
): number | null {
  if (
    quantiteJournaliereKg == null ||
    biomasseKg == null ||
    biomasseKg <= 0
  ) {
    return null;
  }
  return (quantiteJournaliereKg / biomasseKg) * 100;
}

/**
 * Calcule l'écart entre ration réelle et ration théorique.
 *
 * Formule : ((reel - theorique) / theorique) × 100
 * Positif = sur-alimentation, Négatif = sous-alimentation.
 * Seuil d'alerte : écart > 20% sur 3 relevés consécutifs.
 *
 * @param consommeKg - Quantité réellement distribuée en kg
 * @param rationTheoriqueKg - Ration théorique calculée depuis ConfigElevage en kg
 * @returns Écart en %, ou null si données insuffisantes
 */
export function calculerEcartRation(
  consommeKg: number | null,
  rationTheoriqueKg: number | null
): number | null {
  if (
    consommeKg == null ||
    rationTheoriqueKg == null ||
    rationTheoriqueKg <= 0
  ) {
    return null;
  }
  return ((consommeKg - rationTheoriqueKg) / rationTheoriqueKg) * 100;
}

/**
 * Interface de configuration des seuils du score qualité aliment.
 * Stockée en JSON dans ConfigElevage.scoreAlimentConfig.
 * Si absent, les valeurs par défaut sont utilisées.
 */
export interface ScoreAlimentConfig {
  /** Seuil FCR min (lower is better). Défaut : 1.0 */
  fcrMin: number;
  /** Seuil FCR max (= score 0). Défaut : 3.0 */
  fcrMax: number;
  /** Seuil SGR max (%/j, higher is better). Défaut : 4.0 */
  sgrMax: number;
  /** Seuil coût/kg gain bas (score max). Configurable selon monnaie locale. */
  coutKgMin: number;
  /** Seuil coût/kg gain haut (score 0). */
  coutKgMax: number;
  /** Seuil survie bas (score 0). Défaut : 70 */
  survieMin: number;
}

const DEFAULT_SCORE_CONFIG: ScoreAlimentConfig = {
  fcrMin: 1.0,
  fcrMax: 3.0,
  sgrMax: 4.0,
  coutKgMin: 500,   // Remplacer par une valeur relative si multi-devise
  coutKgMax: 4000,  // idem
  survieMin: 70,
};

/**
 * Calcule le score qualité d'un aliment sur 10 (multicritères).
 *
 * Algorithme pondéré (correction bug v1 — E4) :
 *   FCR    : 40% du score (lower is better)
 *   SGR    : 25% du score (higher is better)
 *   Coût/kg: 25% du score (lower is better, seuils configurables)
 *   Survie : 10% du score (higher is better)
 *
 * CORRECTION BUG v1 : la formule finale est `score / poidsTotal` sans `* 10`.
 * La raison : chaque composante est déjà normalisée sur 10, puis pondérée.
 * `score / poidsTotal` ramène à l'échelle 0–10 correcte sans double-scaling.
 *
 * GUARD (E3) : si fcr <= 0, retourner null (FCR nul ou négatif est invalide).
 * GUARD (E9) : si fcr == null ET sgr == null, retourner null.
 *
 * @param fcr - FCR moyen pondéré. Guard : null ou <= 0 → ignoré
 * @param sgr - SGR moyen en %/jour
 * @param coutKg - Coût par kg de gain (dans la devise configurée)
 * @param tauxSurvie - Taux de survie moyen en %
 * @param config - Seuils configurables. Null = DEFAULT_SCORE_CONFIG
 * @returns Score entre 0 et 10, ou null si données insuffisantes
 */
export function calculerScoreAliment(
  fcr: number | null,
  sgr: number | null,
  coutKg: number | null,
  tauxSurvie: number | null,
  config?: ScoreAlimentConfig | null
): number | null {
  if (fcr == null && sgr == null) return null;

  const c = config ?? DEFAULT_SCORE_CONFIG;
  let score = 0;
  let poidsTotal = 0;

  // FCR — 40%
  // Guard E3 : FCR <= 0 est invalide (ne pas le traiter comme parfait)
  if (fcr !== null && fcr > 0) {
    const fcrRange = c.fcrMax - c.fcrMin;
    const fcrNorm = Math.max(0, Math.min(10, 10 - ((fcr - c.fcrMin) / fcrRange) * 10));
    score += fcrNorm * 0.4;
    poidsTotal += 0.4;
  }

  // SGR — 25%
  if (sgr !== null) {
    const sgrNorm = Math.max(0, Math.min(10, (sgr / c.sgrMax) * 10));
    score += sgrNorm * 0.25;
    poidsTotal += 0.25;
  }

  // Coût/kg — 25%
  if (coutKg !== null) {
    const coutRange = c.coutKgMax - c.coutKgMin;
    const coutNorm = Math.max(0, Math.min(10, 10 - ((coutKg - c.coutKgMin) / coutRange) * 10));
    score += coutNorm * 0.25;
    poidsTotal += 0.25;
  }

  // Survie — 10%
  if (tauxSurvie !== null) {
    const survieRange = 100 - c.survieMin;
    const survieNorm = Math.max(0, Math.min(10, ((tauxSurvie - c.survieMin) / survieRange) * 10));
    score += survieNorm * 0.1;
    poidsTotal += 0.1;
  }

  if (poidsTotal <= 0) return null;

  // CORRECTION v1 (E4) : score / poidsTotal sans * 10
  // Chaque composante est déjà normalisée sur 10 avant pondération.
  // score / poidsTotal ramène sur l'échelle 0–10 correcte.
  const scoreAjuste = score / poidsTotal;
  return Math.round(scoreAjuste * 10) / 10;
}
```

---

### 2.2 — Nouveaux benchmarks dans benchmarks.ts

**Fichier :** `src/lib/benchmarks.ts`

Ajouter à la fin du fichier :

```typescript
// ---------------------------------------------------------------------------
// PLAN-feed-analytics-v2 — Benchmarks par phase pour Clarias gariepinus
// ---------------------------------------------------------------------------

/**
 * Benchmarks FCR différenciés par phase d'élevage.
 * Source : FAO / CIRAD Clarias gariepinus guidelines.
 * FCR : lower is better.
 */
export const BENCHMARK_FCR_PAR_PHASE: Record<
  string,
  { excellent: number; bon: number; acceptable: number }
> = {
  ACCLIMATATION:    { excellent: 1.2, bon: 1.5, acceptable: 2.0 },
  CROISSANCE_DEBUT: { excellent: 1.3, bon: 1.6, acceptable: 2.0 },
  JUVENILE:         { excellent: 1.4, bon: 1.8, acceptable: 2.2 },
  GROSSISSEMENT:    { excellent: 1.5, bon: 1.9, acceptable: 2.5 },
  FINITION:         { excellent: 1.6, bon: 2.0, acceptable: 2.8 },
  PRE_RECOLTE:      { excellent: 1.8, bon: 2.2, acceptable: 3.0 },
} as const;

/**
 * Benchmarks SGR différenciés par phase.
 * SGR : higher is better. Valeurs en %/jour.
 */
export const BENCHMARK_SGR_PAR_PHASE: Record<
  string,
  { excellent: number; bon: number; acceptable: number }
> = {
  ACCLIMATATION:    { excellent: 4.0, bon: 3.0, acceptable: 2.0 },
  CROISSANCE_DEBUT: { excellent: 3.5, bon: 2.5, acceptable: 1.8 },
  JUVENILE:         { excellent: 3.0, bon: 2.0, acceptable: 1.5 },
  GROSSISSEMENT:    { excellent: 2.5, bon: 1.8, acceptable: 1.2 },
  FINITION:         { excellent: 2.0, bon: 1.5, acceptable: 1.0 },
  PRE_RECOLTE:      { excellent: 1.5, bon: 1.0, acceptable: 0.7 },
} as const;

/**
 * Benchmarks ADG (Average Daily Gain) par stade de poids.
 * Valeurs en g/jour.
 *
 * FRONTIÈRES : poidsMin inclusif, poidsMax exclusif.
 * Ex : fingerling couvre [0, 30[, juvenile couvre [30, 150[, etc.
 */
export const BENCHMARK_ADG_PAR_STADE: Record<
  string,
  { label: string; poidsMin: number; poidsMax: number; excellent: number; bon: number }
> = {
  fingerling: { label: "Fingerling (<30g)",     poidsMin: 0,   poidsMax: 30,       excellent: 1.5, bon: 1.0 },
  juvenile:   { label: "Juvénile (30–150g)",    poidsMin: 30,  poidsMax: 150,      excellent: 3.0, bon: 2.0 },
  subadulte:  { label: "Sub-adulte (150–400g)", poidsMin: 150, poidsMax: 400,      excellent: 5.0, bon: 3.5 },
  adulte:     { label: "Adulte (≥400g)",        poidsMin: 400, poidsMax: Infinity, excellent: 6.0, bon: 4.0 },
} as const;

/**
 * Benchmark DFR (Daily Feeding Rate) en % biomasse/jour.
 */
export const BENCHMARK_DFR_PAR_PHASE: Record<
  string,
  { min: number; max: number; optimal: number }
> = {
  ACCLIMATATION:    { min: 8,   max: 15, optimal: 10  },
  CROISSANCE_DEBUT: { min: 5,   max: 8,  optimal: 6   },
  JUVENILE:         { min: 3,   max: 5,  optimal: 4   },
  GROSSISSEMENT:    { min: 2,   max: 4,  optimal: 3   },
  FINITION:         { min: 1.5, max: 3,  optimal: 2   },
  PRE_RECOLTE:      { min: 1,   max: 2,  optimal: 1.5 },
} as const;

/**
 * Retourne les seuils FCR pour une phase donnée.
 */
export function getBenchmarkFCRPourPhase(phase: string | null): BenchmarkRange {
  if (!phase || !(phase in BENCHMARK_FCR_PAR_PHASE)) {
    return BENCHMARK_FCR;
  }
  const seuils = BENCHMARK_FCR_PAR_PHASE[phase];
  return {
    label: "fcr",
    unit: "",
    excellent: { min: 0, max: seuils.excellent },
    bon: { min: seuils.excellent, max: seuils.bon },
    acceptable: { min: seuils.bon, max: seuils.acceptable },
  };
}

/**
 * Retourne les seuils ADG pour un poids moyen donné.
 * Frontières : poidsMin inclusif, poidsMax exclusif.
 */
export function getBenchmarkADGPourPoids(poidsMoyen: number | null): BenchmarkRange | null {
  if (poidsMoyen == null) return null;
  const stade = Object.values(BENCHMARK_ADG_PAR_STADE).find(
    (s) => poidsMoyen >= s.poidsMin && poidsMoyen < s.poidsMax
  );
  if (!stade) return null;
  return {
    label: "adg",
    unit: "g/j",
    excellent: { min: stade.excellent, max: Infinity },
    bon: { min: stade.bon, max: stade.excellent },
    acceptable: { min: 0, max: stade.bon },
  };
}
```

---

### 2.3 — Extension des types calculs.ts

**Fichier :** `src/types/calculs.ts`

```typescript
// Dans AnalytiqueAliment, ajouter après tauxSurvieAssocie :

  // ── PLAN-feed-analytics-v2 — Indicateurs enrichis ────────────────────────
  tailleGranule: TailleGranule | null;
  formeAliment: FormeAliment | null;
  tauxProteines: number | null;
  adgMoyen: number | null;
  perMoyen: number | null;
  /** Score /10. Null si FCR et SGR tous deux absents. */
  score: number | null;
  phasesCibles: PhaseElevage[];
  // NOTE : datePeremption est désormais absente de AnalytiqueAliment.
  // Utiliser getProduitsEnAlerteDLC() séparément pour les alertes DLC.
```

```typescript
// Nouvelles interfaces :

export interface FiltresAnalyticsAliments {
  tailleGranule?: TailleGranule | null;
  formeAliment?: FormeAliment | null;
  phaseCible?: PhaseElevage | null;
  fournisseurId?: string | null;
  /** Voir getSaisonCameroun — multi-tenant : configurer le pays dans ConfigElevage */
  saison?: "SECHE" | "PLUIES" | null;
}

/**
 * Point de données pour l'évolution FCR hebdomadaire (F14).
 */
export interface FCRHebdomadairePoint {
  semaine: string;          // "YYYY-Www"
  semaineNumero: number;
  fcr: number | null;
  /** Vrai si le produit/granulé a changé cette semaine (F17) */
  changementGranule: boolean;
  produitNom: string | null;
  tailleGranule: TailleGranule | null;
  temperatureMoyenne: number | null;
}

/**
 * Résultat de la détection de changement de granulé (F17).
 */
export interface ChangementGranule {
  date: Date;
  ancienProduitNom: string | null;
  ancienTaille: TailleGranule | null;
  nouveauProduitNom: string;
  nouvelleTaille: TailleGranule | null;
  jourCycle: number;
}

/**
 * Alerte sous/sur-alimentation (F18/F24).
 */
export interface AlerteRation {
  vagueId: string;
  vagueCode: string;
  nombreRelevesConcernes: number;
  ecartMoyen: number;
  type: "SOUS_ALIMENTATION" | "SUR_ALIMENTATION";
  dernierReleve: Date;
}

/**
 * Configuration seuils score aliment (voir src/lib/calculs.ts).
 * Ré-exporté depuis calculs.ts.
 */
export type { ScoreAlimentConfig } from "@/lib/calculs";
```

---

### 2.4 — Enrichissement de computeAlimentMetrics dans analytics.ts

**Fichier :** `src/lib/queries/analytics.ts`

Signature du paramètre `produit` mise à jour (sans `datePeremption`) :

```typescript
async function computeAlimentMetrics(
  siteId: string,
  produit: {
    id: string;
    nom: string;
    prixUnitaire: number;
    uniteAchat?: string | null;
    contenance?: number | null;
    fournisseur: { nom: string } | null;
    tailleGranule: string | null;
    formeAliment: string | null;
    tauxProteines: number | null;
    phasesCibles: string[];
  }
)
```

Dans le calcul par vague, ajouter ADG et PER :

```typescript
// Après calcul de fcr, sgr, tauxSurvie, coutKg :
const adg = calculerADG(vague.poidsMoyenInitial, poidsMoyen, jours);

// PER : gainPoidsG = gainBiomasse(kg) * 1000
const gainPoidsG = gainBiomasse !== null ? gainBiomasse * 1000 : null;
const per = calculerPER(gainPoidsG, conso.quantite, produit.tauxProteines);
```

Score avec config :

```typescript
// Après agrégation fcrMoyen, sgrMoyen, coutParKgGain, tauxSurvieMoyen
// config provient de la vague ou du site, null si absent
const scoreConfig = config?.scoreAlimentConfig as ScoreAlimentConfig | null ?? null;
const score = calculerScoreAliment(fcrMoyen, sgrMoyen, coutParKgGain, tauxSurvieMoyen, scoreConfig);
```

Filtres dans `getComparaisonAliments` (E5 — vérification null/undefined explicite) :

```typescript
// CORRECTION E5 : utiliser !== undefined && !== null (pas falsy)
// pour éviter de filtrer tailleGranule='P0' (truthy mais potentiellement faux-négatif avec !!)
where: {
  siteId,
  categorie: CategorieProduit.ALIMENT,
  isActive: true,
  ...(filtres?.tailleGranule !== undefined && filtres.tailleGranule !== null
    ? { tailleGranule: filtres.tailleGranule }
    : {}),
  ...(filtres?.formeAliment !== undefined && filtres.formeAliment !== null
    ? { formeAliment: filtres.formeAliment }
    : {}),
  ...(filtres?.phaseCible !== undefined && filtres.phaseCible !== null
    ? { phasesCibles: { has: filtres.phaseCible } }
    : {}),
  ...(filtres?.fournisseurId !== undefined && filtres.fournisseurId !== null
    ? { fournisseurId: filtres.fournisseurId }
    : {}),
},
```

---

### 2.5 — Query FCR hebdomadaire avec algorithme d'interpolation (F14, F17)

**Fichier :** `src/lib/queries/analytics.ts`

**Algorithme d'interpolation poidsMoyen entre biométries (A5, A6) :**

Les biométries sont rares (hebdomadaire ou mensuelle). Les relevés alimentation sont quotidiens. Pour calculer un FCR hebdomadaire, le gain de biomasse doit être estimé sur la semaine. Algorithme d'interpolation linéaire :

```
Données d'entrée :
  - biometries : [ { date, poidsMoyen }, ... ] triées par date ascendante
  - dateDebut, dateFin de la fenêtre de calcul

Algorithme :
  Pour une fenêtre [D1, D2] :
    1. Trouver la biométrie b_avant = dernière biométrie dont date <= D1
    2. Trouver la biométrie b_apres = première biométrie dont date >= D2
    3. Si b_avant == null ET b_apres == null → poidsMoyen inconnu → FCR = null
    4. Si b_avant != null ET b_apres == null → extrapoler avec SGR constant
       poids(D) = b_avant.poidsMoyen * exp(sgrEstime * jours_depuis_b_avant / 100)
       (sgrEstime = SGR calculé sur la vague entière, ou valeur par défaut 2.0 %/j)
    5. Si b_avant == null ET b_apres != null → utiliser b_apres.poidsMoyen (safe)
    6. Si b_avant != null ET b_apres != null → interpolation linéaire :
       fraction = (D - b_avant.date) / (b_apres.date - b_avant.date)
       poids(D) = b_avant.poidsMoyen + fraction * (b_apres.poidsMoyen - b_avant.poidsMoyen)

  Calcul gain biomasse pour la semaine :
    poids_debut_semaine = interpoler(D1)
    poids_fin_semaine   = interpoler(D2)
    vivants_semaine     = computeNombreVivantsVague(bacs, releves, nombreInitial)
    gainBiomasseKg      = (poids_fin_semaine - poids_debut_semaine) * vivants_semaine / 1000

  FCR semaine :
    alimentSemaine = somme(quantiteAliment) sur tous les relevés ALIMENTATION de [D1, D2]
    FCR_semaine    = alimentSemaine / gainBiomasseKg  (null si gainBiomasseKg <= 0)
```

Implémentation partielle (à compléter par @developer) :

```typescript
/**
 * Calcule l'évolution FCR semaine par semaine pour une vague.
 * Utilise l'interpolation linéaire pour estimer poidsMoyen entre biométries.
 * Filtre les biométries avec poidsMoyen = null (E8).
 *
 * @param siteId - ID du site
 * @param vagueId - ID de la vague
 * @returns Tableau de points FCR hebdomadaires + changements de granulé détectés
 */
export async function getFCRHebdomadaire(
  siteId: string,
  vagueId: string
): Promise<{
  points: FCRHebdomadairePoint[];
  changements: ChangementGranule[];
}> {
  // 1. Récupérer la vague avec ses bacs
  const vague = await prisma.vague.findFirst({
    where: { id: vagueId, siteId },
    select: {
      id: true, code: true, nombreInitial: true,
      poidsMoyenInitial: true, dateDebut: true, dateFin: true,
      bacs: { select: { id: true, nombreInitial: true } },
    },
  });
  if (!vague) return { points: [], changements: [] };

  // 2. Relevés ALIMENTATION avec consommations + produits
  const relevesAlim = await prisma.releve.findMany({
    where: { vagueId, siteId, typeReleve: TypeReleve.ALIMENTATION },
    orderBy: { date: "asc" },
    select: {
      id: true, date: true, quantiteAliment: true,
      consommations: {
        select: {
          quantite: true,
          produit: {
            select: { id: true, nom: true, tailleGranule: true },
          },
        },
      },
    },
  });

  // 3. Biométries — filtre poidsMoyen non null (E8)
  const relevesBio = await prisma.releve.findMany({
    where: {
      vagueId, siteId,
      typeReleve: TypeReleve.BIOMETRIE,
      poidsMoyen: { not: null },  // Guard E8
    },
    orderBy: { date: "asc" },
    select: { date: true, poidsMoyen: true },
  });

  // 4. Qualité eau pour corrélation température
  const relevesQualite = await prisma.releve.findMany({
    where: { vagueId, siteId, typeReleve: TypeReleve.QUALITE_EAU },
    orderBy: { date: "asc" },
    select: { date: true, temperature: true },
  });

  // 5. Grouper par semaine ISO + interpolation poidsMoyen (voir algorithme ci-dessus)
  // 6. FCR hebdomadaire (null si gainBiomasse <= 0)
  // 7. Détection changement granulé : comparer produit.tailleGranule du relevé N vs N-1
  // 8. E7 Guard : relevés filtrés par vagueId (multi-bac : quantiteAliment est global vague)
  //    Si relevé par bac, sommer sur tous les bacs de la vague pour la semaine

  return { points: [], changements: [] }; // implémentation par @developer
}
```

---

### 2.6 — Query getAlertesRation avec guards (F18/F24)

**Fichier :** `src/lib/queries/analytics.ts`

```typescript
/**
 * Détecte les sous/sur-alimentations pour les vagues actives d'un site.
 *
 * Guard E9 : les vagues sans ConfigElevage actif sont ignorées (skip silencieux).
 *
 * @param siteId - ID du site
 * @returns Liste des alertes ration actives
 */
export async function getAlertesRation(siteId: string): Promise<AlerteRation[]> {
  // 1. Récupérer les vagues actives avec leur ConfigElevage
  const vagues = await prisma.vague.findMany({
    where: { siteId, statut: StatutVague.EN_COURS },
    include: {
      bacs: { select: { id: true, nombreInitial: true, volume: true } },
      configElevage: true,  // relation ConfigElevage
    },
  });

  const alertes: AlerteRation[] = [];

  for (const vague of vagues) {
    // Guard E9 : skip si pas de ConfigElevage
    if (!vague.configElevage) continue;

    const config = vague.configElevage;

    // 2. Relevés ALIMENTATION des 30 derniers jours
    const dateLimit = new Date();
    dateLimit.setDate(dateLimit.getDate() - 30);

    const releves = await prisma.releve.findMany({
      where: {
        vagueId: vague.id, siteId,
        typeReleve: TypeReleve.ALIMENTATION,
        date: { gte: dateLimit },
      },
      orderBy: { date: "asc" },
    });

    if (releves.length < 3) continue;

    // 3. Calculer écarts
    // Pour chaque relevé : ration théorique = getTauxAlimentation(poidsMoyen, config) * biomasse / 100
    // Voir algorithme complet dans ADR ou laisser à @developer

    // 4. Détecter 3 relevés consécutifs avec |écart| > 20%
    // → créer AlerteRation et l'ajouter à alertes[]
  }

  return alertes;
}
```

---

### Tests Phase 2

**Fichier :** `src/tests/calculs.test.ts` (ajouter à la suite)

```typescript
describe('calculerADG', () => {
  test('nominal : 200g → 500g en 100 jours = 3.0 g/j', () => {
    expect(calculerADG(200, 500, 100)).toBe(3.0);
  });
  test('ADG négatif autorisé (perte de poids)', () => {
    expect(calculerADG(500, 300, 50)).toBe(-4.0); // perte de poids acceptable
  });
  test('retourne null si jours = 0', () => {
    expect(calculerADG(200, 500, 0)).toBeNull();
  });
  test('retourne null si poidsInitial null', () => {
    expect(calculerADG(null, 500, 100)).toBeNull();
  });
})

describe('calculerPER', () => {
  test('nominal : gain 10000g population, 5kg aliment à 40% = PER 0.5', () => {
    expect(calculerPER(10000, 5, 40)).toBeCloseTo(0.5);
  });
  test('retourne null si tauxProteines null', () => {
    expect(calculerPER(10000, 5, null)).toBeNull();
  });
  test('retourne null si quantiteAliment = 0', () => {
    expect(calculerPER(10000, 0, 40)).toBeNull();
  });
})

describe('calculerDFR', () => {
  test('nominal : 3kg aliment / 100kg biomasse = 3.0%', () => {
    expect(calculerDFR(3, 100)).toBe(3.0);
  });
  test('retourne null si biomasse = 0', () => {
    expect(calculerDFR(3, 0)).toBeNull();
  });
})

describe('calculerScoreAliment', () => {
  test('FCR=1.2, SGR=3.0, cout=800, survie=95 → score > 8.0', () => {
    expect(calculerScoreAliment(1.2, 3.0, 800, 95)).toBeGreaterThan(8.0);
  });
  test('retourne null si FCR et SGR tous deux null', () => {
    expect(calculerScoreAliment(null, null, 800, 95)).toBeNull();
  });
  test('score borné entre 0 et 10', () => {
    const s = calculerScoreAliment(0.5, 5.0, 100, 100);
    expect(s).not.toBeNull();
    expect(s!).toBeGreaterThanOrEqual(0);
    expect(s!).toBeLessThanOrEqual(10);
  });
  test('Guard E3 : FCR=0 retourne null (non score parfait)', () => {
    expect(calculerScoreAliment(0, 3.0, 800, 95)).toBeNull();
  });
  test('Bug fix E4 : score avec seul FCR disponible est correct', () => {
    // FCR=1.5 (milieu de range 1.0-3.0) → fcrNorm=5.0, score=5.0*0.4=2.0
    // poidsTotal=0.4, scoreAjuste = 2.0/0.4 = 5.0 (pas *10)
    const s = calculerScoreAliment(1.5, null, null, null);
    expect(s).toBeCloseTo(5.0, 1);
  });
  test('Config personnalisée : seuils currency-agnostic', () => {
    const config = { fcrMin: 1.0, fcrMax: 3.0, sgrMax: 4.0, coutKgMin: 100, coutKgMax: 800, survieMin: 70 };
    const s = calculerScoreAliment(1.2, 3.0, 200, 95, config);
    expect(s).toBeGreaterThan(8.0);
  });
})

describe('calculerEcartRation', () => {
  test('consommé=5kg, théorique=4kg → +25%', () => {
    expect(calculerEcartRation(5, 4)).toBeCloseTo(25);
  });
  test('consommé=3kg, théorique=4kg → -25%', () => {
    expect(calculerEcartRation(3, 4)).toBeCloseTo(-25);
  });
})
```

---

## Phase 3 — Interface utilisateur (F2, F3, F4, F10, F11, F14, F15, F17, F21)

**Features couvertes :**
- F2 : Filtrage analytics par taille de granulé
- F3 : Affichage taille granulé sur cartes aliment
- F4 : Avertissement comparaison tailles différentes
- F10 : Benchmarks FCR contextualisés par phase (affichage)
- F11 : Score qualité aliment /10
- F14 : Graphique FCR hebdomadaire avec annotations
- F15 : Corrélation mortalité / aliment
- F17 : Annotation changement granulé sur graphiques
- F21 : Suivi DLC et alertes péremption (via MouvementStock)

**Dépendances :** Phases 1 et 2 terminées

---

### 3.1 — Clés i18n pour tous les nouveaux strings (A7)

**Règle :** Aucun string UI en français hardcodé dans les composants. Toutes les chaînes passent par `t()` depuis les fichiers `src/messages/`.

**Fichier :** `src/messages/fr/analytics.json`

Ajouter dans la section `aliments` :

```json
"aliments": {
  ...existant...,

  "tailleGranule": {
    "P0": "Poudre <0.5mm (larves)",
    "P1": "Poudre 0.5mm (alevins)",
    "C1": "Crumble 1mm",
    "C2": "Crumble 1.5mm",
    "G1": "Granulé 2mm",
    "G2": "Granulé 3mm",
    "G3": "Granulé 4mm",
    "G4": "Granulé 6mm",
    "G5": "Granulé 8mm"
  },
  "formeAliment": {
    "FLOTTANT": "Flottant",
    "COULANT": "Coulant",
    "SEMI_FLOTTANT": "Semi-flottant",
    "POUDRE": "Poudre"
  },
  "comportement": {
    "NORMAL": "Normal",
    "LENT": "Lent",
    "REFUS_PARTIEL": "Refus partiel",
    "REFUS_TOTAL": "Refus total"
  },
  "score": "Score",
  "scoreLabel": "Score /10",
  "adg": "GAJ",
  "adgFull": "Gain journalier moyen (GAJ)",
  "per": "EEP",
  "perFull": "Efficacité protéique (EEP)",
  "dfr": "TAQ",
  "dfrFull": "Taux d'alimentation quotidien (TAQ)",
  "filters": {
    "taille": "Taille de granulé",
    "forme": "Forme",
    "phase": "Phase",
    "fournisseur": "Fournisseur",
    "saison": "Saison",
    "tous": "Tous",
    "reinitialiser": "Réinitialiser les filtres"
  },
  "alerteTaille": "Attention : vous comparez des aliments de tailles différentes ({tailles}). Le FCR peut varier selon la phase d'élevage. Filtrez par taille de granulé pour une comparaison valide.",
  "dlc": {
    "title": "Alertes péremption",
    "expireAujourdhui": "Expiré aujourd'hui",
    "expireDans": "Expire dans {jours} j",
    "expire": "Expiré",
    "lot": "Lot",
    "aucune": "Aucune alerte de péremption"
  },
  "alerteRation": {
    "title": "Alertes ration",
    "surAlimentation": "Sur-alimentation",
    "sousAlimentation": "Sous-alimentation",
    "ecart": "{ecart, number, ::percent} sur {count} relevés",
    "voirReleves": "Voir les relevés",
    "aucune": "Aucune alerte de ration"
  },
  "fcrHebdo": {
    "title": "ICA hebdomadaire",
    "changementGranule": "Changement de granulé",
    "pasDesDonnees": "Pas assez de données pour afficher l'évolution hebdomadaire"
  },
  "correlationMortalite": {
    "title": "Corrélation mortalité / aliment",
    "periode": "Période",
    "mortalite": "Mortalité",
    "alerte": "Mortalité élevée"
  },
  "refus": {
    "label": "Taux de refus",
    "hint": "Estimation visuelle après distribution"
  }
}
```

**Fichier :** `src/messages/en/analytics.json`

Ajouter les équivalents anglais (mêmes clés, libellés EN) :

```json
"aliments": {
  ...existant...,

  "tailleGranule": {
    "P0": "Powder <0.5mm (larvae)",
    "P1": "Powder 0.5mm (fry)",
    "C1": "Crumble 1mm",
    "C2": "Crumble 1.5mm",
    "G1": "Pellet 2mm",
    "G2": "Pellet 3mm",
    "G3": "Pellet 4mm",
    "G4": "Pellet 6mm",
    "G5": "Pellet 8mm"
  },
  "formeAliment": {
    "FLOTTANT": "Floating",
    "COULANT": "Sinking",
    "SEMI_FLOTTANT": "Semi-floating",
    "POUDRE": "Powder"
  },
  "comportement": {
    "NORMAL": "Normal",
    "LENT": "Slow",
    "REFUS_PARTIEL": "Partial refusal",
    "REFUS_TOTAL": "Total refusal"
  },
  "score": "Score",
  "scoreLabel": "Score /10",
  "adg": "ADG",
  "adgFull": "Average Daily Gain (ADG)",
  "per": "PER",
  "perFull": "Protein Efficiency Ratio (PER)",
  "dfr": "DFR",
  "dfrFull": "Daily Feeding Rate (DFR)",
  "filters": {
    "taille": "Pellet size",
    "forme": "Form",
    "phase": "Phase",
    "fournisseur": "Supplier",
    "saison": "Season",
    "tous": "All",
    "reinitialiser": "Reset filters"
  },
  "alerteTaille": "Warning: you are comparing feeds of different sizes ({tailles}). FCR may vary by rearing phase. Filter by pellet size for a valid comparison.",
  "dlc": {
    "title": "Expiry alerts",
    "expireAujourdhui": "Expires today",
    "expireDans": "Expires in {jours} days",
    "expire": "Expired",
    "lot": "Lot",
    "aucune": "No expiry alerts"
  },
  "alerteRation": {
    "title": "Feeding alerts",
    "surAlimentation": "Overfeeding",
    "sousAlimentation": "Underfeeding",
    "ecart": "{ecart, number, ::percent} over {count} records",
    "voirReleves": "View records",
    "aucune": "No feeding alerts"
  },
  "fcrHebdo": {
    "title": "Weekly FCR",
    "changementGranule": "Pellet change",
    "pasDesDonnees": "Not enough data to display weekly evolution"
  },
  "correlationMortalite": {
    "title": "Mortality / feed correlation",
    "periode": "Period",
    "mortalite": "Mortality",
    "alerte": "High mortality"
  },
  "refus": {
    "label": "Refusal rate",
    "hint": "Visual estimation after feeding"
  }
}
```

**Fichier :** `src/messages/fr/stock.json`

Dans la section `produits.fields`, ajouter :

```json
"alimentSection": "Propriétés de l'aliment",
"tailleGranule": "Taille de granulé",
"formeAliment": "Forme physique",
"tauxProteines": "Protéines brutes (% MS)",
"tauxLipides": "Lipides bruts (% MS)",
"tauxFibres": "Fibres brutes (% MS)",
"phasesCibles": "Phases recommandées",
"lotFabrication": "N° de lot fabricant",
"datePeremption": "Date de péremption"
```

**Fichier :** `src/messages/fr/releves.json`

Ajouter dans la section alimentation :

```json
"alimentation": {
  ...existant...,
  "tauxRefus": "Taux de refus",
  "tauxRefusHint": "Estimation visuelle après distribution",
  "comportementAlim": "Comportement alimentaire"
}
```

---

### 3.2 — Page analytiques aliments : filtres (F2)

**Fichier :** `src/app/analytics/aliments/page.tsx`

Validation stricte des searchParams (E6) avant cast enum :

```typescript
export default async function AnalyticsAlimentsPage({
  searchParams,
}: {
  searchParams: Promise<{
    taille?: string;
    forme?: string;
    phase?: string;
    fournisseur?: string;
  }>;
}) {
  const sp = await searchParams;

  // Validation enum — liste blanche (E6)
  const TAILLES_VALIDES = Object.values(TailleGranule) as string[];
  const FORMES_VALIDES = Object.values(FormeAliment) as string[];
  const PHASES_VALIDES = Object.values(PhaseElevage) as string[];

  const filtres: FiltresAnalyticsAliments = {
    tailleGranule: sp.taille && TAILLES_VALIDES.includes(sp.taille)
      ? (sp.taille as TailleGranule) : undefined,
    formeAliment: sp.forme && FORMES_VALIDES.includes(sp.forme)
      ? (sp.forme as FormeAliment) : undefined,
    phaseCible: sp.phase && PHASES_VALIDES.includes(sp.phase)
      ? (sp.phase as PhaseElevage) : undefined,
    fournisseurId: sp.fournisseur ?? undefined,
  };

  const comparaison = await getComparaisonAliments(session.activeSiteId, filtres);
  // ...
}
```

**Rétrocompatibilité (A13) :** Les aliments sans `tailleGranule` (données pré-migration) sont toujours inclus dans les résultats quand aucun filtre n'est actif. Quand un filtre `tailleGranule` est actif, les aliments à `tailleGranule = null` sont exclus — comportement attendu. L'UI doit afficher un message "Non renseigné" dans les Select de filtres pour permettre de filtrer explicitement les aliments sans granulométrie si besoin.

---

### 3.3 — Composant FeedFilters (F2)

**Fichier à créer :** `src/components/analytics/feed-filters.tsx`

```typescript
"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import * as Select from "@radix-ui/react-select";
import { TailleGranule, FormeAliment, PhaseElevage } from "@/types";
import { useTranslations } from "next-intl";

/**
 * Barre de filtres pour la page analytiques aliments.
 * Utilise des Radix Select pour accessibilité mobile.
 * Met à jour les searchParams via router.replace (sans navigation).
 *
 * Mobile first : les selects sont en colonne sur 360px, en ligne sur sm+.
 */
export function FeedFilters() {
  const t = useTranslations("analytics.aliments.filters");
  // Radix Select pour tailleGranule, formeAliment, phaseCible
  // Chaque option utilise t("analytics.aliments.tailleGranule.P0") etc.
  // Valeur "" = pas de filtre (afficher t("tous"))
}
```

---

### 3.4 — Mise à jour FeedComparisonCards (F3, F11)

**Fichier :** `src/components/analytics/feed-comparison-cards.tsx`

Utilisation des clés i18n :

```tsx
import { useTranslations } from "next-intl";

// Dans MetricItem :
const t = useTranslations("analytics.aliments");

{aliment.tailleGranule && (
  <span className="...">
    {t(`tailleGranule.${aliment.tailleGranule}`)}
  </span>
)}

// Avertissement tailles différentes (F4)
// Détecter si des aliments de tailles différentes sont comparés :
const tailles = aliments.map((a) => a.tailleGranule).filter(
  (v): v is TailleGranule => v !== null
);
const taillesUniques = [...new Set(tailles)];
const avertissementTaille = taillesUniques.length > 1;

{avertissementTaille && (
  <div className="...">
    <p className="text-xs text-accent-amber">
      {t("alerteTaille", {
        tailles: taillesUniques.map((tg) => t(`tailleGranule.${tg}`)).join(", "),
      })}
    </p>
  </div>
)}

// Score badge
function ScoreBadge({ score }: { score: number }) {
  const t = useTranslations("analytics.aliments");
  const color =
    score >= 7 ? "text-accent-green" :
    score >= 5 ? "text-accent-amber" :
                  "text-accent-red";
  return (
    <span className={cn("text-sm font-bold", color)}>
      {score.toFixed(1)}/10
    </span>
  );
}
```

---

### 3.5 — Formulaire produit : nouveaux champs (F1, F5, F6, F12)

**Fichier :** `src/components/stock/produit-form.tsx`

```tsx
const t = useTranslations("stock.produits.fields");

{categorie === CategorieProduit.ALIMENT && (
  <div className="flex flex-col gap-3 border-t pt-3">
    <h3 className="text-sm font-medium">{t("alimentSection")}</h3>

    {/* Granulométrie — Radix Select */}
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium">{t("tailleGranule")}</label>
      <Select.Root value={tailleGranule ?? ""} onValueChange={setTailleGranule}>
        {/* Options via t("analytics.aliments.tailleGranule.P0") etc. */}
      </Select.Root>
    </div>

    {/* Forme — Radix Select */}
    {/* Taux protéines/lipides/fibres — input min=0 max=100 step=0.1 */}
    {/* Phases recommandées — multi-checkbox (PhaseElevage) */}
    {/* lotFabrication et datePeremption sont dans le formulaire MouvementStock (réception) */}
  </div>
)}
```

---

### 3.6 — Formulaire relevé ALIMENTATION : nouveaux champs (F7, F8)

**Fichier :** `src/components/releves/releve-form-client.tsx`

```tsx
const t = useTranslations("releves.alimentation");

{typeReleve === TypeReleve.ALIMENTATION && (
  <>
    {/* Taux de refus — Radix RadioGroup, gros boutons mobile */}
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium">
        {t("tauxRefus")}
        <span className="ml-1 text-xs text-muted-foreground">{t("tauxRefusHint")}</span>
      </label>
      <RadioGroup.Root
        value={String(tauxRefus ?? "")}
        onValueChange={(v) => setTauxRefus(v === "" ? null : Number(v))}
        className="grid grid-cols-4 gap-2"
      >
        {[0, 10, 25, 50].map((val) => (
          <RadioGroup.Item
            key={val}
            value={String(val)}
            className="flex h-12 items-center justify-center rounded-lg border text-sm font-medium data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
          >
            {val}%
          </RadioGroup.Item>
        ))}
      </RadioGroup.Root>
    </div>

    {/* Comportement alimentaire — Radix RadioGroup */}
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium">{t("comportementAlim")}</label>
      <RadioGroup.Root
        value={comportementAlim ?? ""}
        onValueChange={(v) => setComportementAlim(v as ComportementAlimentaire || null)}
        className="grid grid-cols-2 gap-2"
      >
        {Object.values(ComportementAlimentaire).map((val) => (
          <RadioGroup.Item
            key={val}
            value={val}
            className="flex h-12 items-center justify-center rounded-lg border text-sm font-medium data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
          >
            {t(`comportement.${val}`, { fallback: val })}
            {/* Utiliser t("analytics.aliments.comportement.NORMAL") etc. */}
          </RadioGroup.Item>
        ))}
      </RadioGroup.Root>
    </div>
  </>
)}
```

---

### 3.7 — Formulaire réception stock : champs DLC et lot (F21)

**Fichier :** `src/components/stock/mouvement-form.tsx` (ou chemin équivalent)

Les champs `datePeremption` et `lotFabrication` apparaissent dans le formulaire de création de `MouvementStock` de type `ENTREE`, uniquement pour les produits de catégorie `ALIMENT` :

```tsx
const t = useTranslations("stock.produits.fields");

{mouvement.type === TypeMouvement.ENTREE && produit?.categorie === CategorieProduit.ALIMENT && (
  <>
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium">{t("lotFabrication")}</label>
      <input type="text" placeholder="LOT-2026-001" />
    </div>
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium">{t("datePeremption")}</label>
      <input type="date" />
    </div>
  </>
)}
```

---

### 3.8 — Query DLC : expirés vs bientôt (E13)

**Fichier :** `src/lib/queries/produits.ts`

```typescript
/**
 * Alerte péremption sur les mouvements ENTREE de type ALIMENT.
 *
 * Distingue explicitement expiré (datePeremption < aujourd'hui)
 * et expiring-soon (aujourd'hui <= datePeremption <= aujourd'hui + joursAvant).
 * L'UI doit traiter les deux séparément (E13).
 *
 * @param siteId - ID du site
 * @param joursAvant - Fenêtre "bientôt" en jours (défaut 30)
 */
export async function getMouvementsEnAlerteDLC(
  siteId: string,
  joursAvant: number = 30
): Promise<{
  expires: MouvementStockAvecProduit[];
  expiringSoon: MouvementStockAvecProduit[];
}> {
  const maintenant = new Date();
  const dateLimit = new Date();
  dateLimit.setDate(dateLimit.getDate() + joursAvant);

  // Expiré : datePeremption dans le passé (strict)
  const expires = await prisma.mouvementStock.findMany({
    where: {
      siteId,
      type: TypeMouvement.ENTREE,
      produit: { categorie: CategorieProduit.ALIMENT, isActive: true },
      datePeremption: { not: null, lt: maintenant },
    },
    include: { produit: { select: { id: true, nom: true, tailleGranule: true } } },
    orderBy: { datePeremption: "asc" },
  });

  // Bientôt : datePeremption dans la fenêtre [maintenant, dateLimit]
  const expiringSoon = await prisma.mouvementStock.findMany({
    where: {
      siteId,
      type: TypeMouvement.ENTREE,
      produit: { categorie: CategorieProduit.ALIMENT, isActive: true },
      datePeremption: { not: null, gte: maintenant, lte: dateLimit },
    },
    include: { produit: { select: { id: true, nom: true, tailleGranule: true } } },
    orderBy: { datePeremption: "asc" },
  });

  return { expires, expiringSoon };
}
```

---

### 3.9 — Composant FeedFCRWeeklyChart (F14, F17)

**Fichier à créer :** `src/components/analytics/feed-fcr-weekly-chart.tsx`

```typescript
"use client";

import {
  ComposedChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ReferenceLine, ResponsiveContainer, Legend
} from "recharts";
import type { FCRHebdomadairePoint } from "@/types";
import { useTranslations } from "next-intl";

interface FeedFCRWeeklyChartProps {
  points: FCRHebdomadairePoint[];
  phase?: string | null;
}

/**
 * Graphique FCR hebdomadaire — Recharts ComposedChart.
 *
 * - Courbe FCR (Line)
 * - ReferenceLine verticale par semaine où changementGranule = true (F17)
 * - Tooltip avec t("analytics.aliments.fcrHebdo.changementGranule")
 * - Référence benchmark horizontal (getBenchmarkFCRPourPhase)
 * - Mobile first : height 240px sur mobile, 320px sur sm+
 *
 * Si points.length === 0 : afficher t("analytics.aliments.fcrHebdo.pasDesDonnees")
 */
export function FeedFCRWeeklyChart({ points, phase }: FeedFCRWeeklyChartProps) {
  const t = useTranslations("analytics.aliments.fcrHebdo");
  // Implémentation par @developer
}
```

---

### 3.10 — Corrélation mortalité / aliment (F15)

**Fichier à créer :** `src/components/analytics/feed-mortality-correlation.tsx`

```typescript
"use client";

import { useTranslations } from "next-intl";
import type { DetailAlimentVague } from "@/types";

/**
 * Mobile first : tableau sur sm+, cartes empilées sur < 640px.
 * Badge rouge si tauxMortalite > 10%.
 * Labels via t("analytics.aliments.correlationMortalite.*").
 */
export function FeedMortalityCorrelation({ parVague }: { parVague: DetailAlimentVague[] }) {
  const t = useTranslations("analytics.aliments.correlationMortalite");
  // Implémentation par @developer
}
```

L'interface `DetailAlimentVague` dans `src/types/calculs.ts` enrichie avec :

```typescript
tauxMortalite: number | null;
adg: number | null;
per: number | null;
```

---

### Tests Phase 3

1. `src/tests/analytics-aliments-filters.test.ts` — `getComparaisonAliments` avec filtres
2. Tests visuels manuels : RadioGroup tauxRefus et comportementAlim sur mobile 360px
3. Vérifier que les aliments pré-migration (tailleGranule=null) apparaissent quand aucun filtre n'est actif
4. Vérifier l'option "Non renseigné" dans le Select filtre tailleGranule

---

## Phase 4 — Fonctionnalités avancées (F16, F18, F19, F20, F22, F23)

**Features couvertes :**
- F16 : Rapport PDF consommation par période
- F18 : Alerte sous/sur-alimentation UI (getAlertesRation de Phase 2)
- F19 : Courbe de croissance vs référentiel théorique
- F20 : Score fournisseur agrégé
- F22 : Filtrage analytics par saison
- F23 : Table HistoriqueNutritionnel (NICE-TO-HAVE)

**Dépendances :** Phases 1, 2, 3 terminées. F18 dépend de `getAlertesRation` (Phase 2).

**Note de scope :** Plusieurs items de Phase 4 nécessitent un travail de design avant implémentation. Ces items sont marqués **[DESIGN NEEDED]** ci-dessous et ne doivent pas être implémentés directement sans une session de conception supplémentaire.

---

### 4.1 — Rapport PDF consommation par période (F16) [DESIGN NEEDED]

**Scope :** Définir la structure exacte du PDF, le layout, et les données à inclure dans une session de design séparée (mock-up + validation PM). La route API et le composant bouton peuvent être scaffoldés mais pas finalisés avant le design.

**Fichier à créer :** `src/app/api/export/aliments/route.ts`

```typescript
// GET /api/export/aliments?vagueId=...&debut=...&fin=...
interface RapportConsommationAliment {
  vague: { id: string; code: string; dateDebut: Date; dateFin: Date | null };
  site: { name: string };
  periode: { debut: Date; fin: Date };
  semaines: {
    semaine: string;
    phase: string;
    alimentNom: string;
    tailleGranule: string | null;
    quantite: number;
    cout: number;
    fcrHebdo: number | null;
    tauxRefusMoyen: number | null;
  }[];
  totaux: {
    quantiteTotale: number;
    coutTotal: number;
    fcrGlobal: number | null;
    adgMoyen: number | null;
  };
}
```

---

### 4.2 — Alerte sous/sur-alimentation UI (F18)

**Fichier :** `src/app/analytics/aliments/page.tsx`

```tsx
const t = useTranslations("analytics.aliments.alerteRation");
const alertes = await getAlertesRation(session.activeSiteId);

{alertes.length > 0 ? (
  <div className="flex flex-col gap-2">
    <h2 className="text-sm font-semibold">{t("title")}</h2>
    {alertes.map((alerte) => (
      <AlerteRationCard key={alerte.vagueId} alerte={alerte} />
    ))}
  </div>
) : (
  <p className="text-xs text-muted-foreground">{t("aucune")}</p>
)}
```

**Fichier à créer :** `src/components/analytics/alerte-ration-card.tsx`

Utiliser `useTranslations("analytics.aliments.alerteRation")` pour tous les textes.

---

### 4.3 — Courbe de croissance vs référentiel (F19) [DESIGN NEEDED]

**Scope :** L'algorithme de génération de la courbe de référence multi-SGR est spécifié mais le layout et l'intégration dans la page détail aliment nécessitent un design séparé (quel aliment est concerné ? Affichage global ou par vague ?).

**Fichier :** `src/types/calculs.ts` (ajouter interface) :

```typescript
export interface CourbeCroissanceReference {
  jour: number;
  poidsOptimal: number;
  poidsBon: number;
  poidsAcceptable: number;
}
```

**Fichier :** `src/lib/calculs.ts` — ajouter `genererCourbeCroissanceReference(poidsInitial, nombreJours)`.

---

### 4.4 — Score fournisseur agrégé (F20)

**Fichier :** `src/lib/queries/analytics.ts`

```typescript
/**
 * Agrège les scores des aliments par fournisseur.
 * Utilise calculerScoreAliment avec scoreConfig du site.
 */
export async function getScoresFournisseurs(
  siteId: string
): Promise<{
  fournisseurId: string;
  fournisseurNom: string;
  scoreMoyen: number | null;
  nombreAliments: number;
  meilleurFCR: number | null;
  coutMoyen: number | null;
}[]>
```

---

### 4.5 — Filtre par saison (F22)

**Fichier :** `src/lib/queries/analytics.ts`

```typescript
/**
 * Détermine la saison d'une date.
 *
 * MULTI-TENANT (E15) : La classification saisonnière est spécifique au pays.
 * Cette implémentation supporte le Cameroun (paramètre par défaut).
 * Pour supporter d'autres pays, passer `pays` depuis ConfigElevage.pays
 * ou un champ Site.pays. Si pays inconnu → retourner null (pas de filtrage saison).
 *
 * @param date - Date à classifier
 * @param pays - Code pays ISO 3166-1 alpha-2 (défaut: "CM" pour Cameroun)
 * @returns "SECHE" | "PLUIES" | null
 */
export function getSaison(date: Date, pays: string = "CM"): "SECHE" | "PLUIES" | null {
  if (pays !== "CM") return null; // Extensible futurs pays
  const mois = date.getMonth() + 1;
  return mois >= 4 && mois <= 10 ? "PLUIES" : "SECHE";
}
```

Ajouter `saison?: "SECHE" | "PLUIES"` dans `FiltresAnalyticsAliments` (déjà prévu en section 2.3). Filtrer les `ReleveConsommation` par date correspondant à la saison détectée.

---

### 4.6 — Table HistoriqueNutritionnel (F23) — NICE-TO-HAVE

**Priorité :** Basse — implémenter uniquement si les phases 1–3 sont complètement stables.

**Justification de la matérialisation (A12) :** Les données calculables à la volée (PER par phase, gainBiomasse par phase) nécessitent de rejoindre biométries et relevés alimentation avec interpolation temporelle. Ce calcul est coûteux pour un historique multi-cycles. La table matérialisée permet :
1. Agrégation financière rapide par phase sur N cycles (Sprint 11 financier)
2. Comparaison inter-cycles sans recalcul complet
3. Export PDF sans timeout

**Modèle :**

```prisma
model HistoriqueNutritionnel {
  id                String       @id @default(cuid())
  vagueId           String
  vague             Vague        @relation(fields: [vagueId], references: [id])
  phase             PhaseElevage
  dateDebut         DateTime
  dateFin           DateTime?
  proteinesTotal    Float?       // grammes consommées dans cette phase
  gainBiomassePhase Float?       // kg gagnés dans cette phase
  per               Float?       // PER calculé pour la phase
  siteId            String
  site              Site         @relation(fields: [siteId], references: [id])
  createdAt         DateTime     @default(now())

  @@unique([vagueId, phase])   // Correction E11 : contrainte unique ajoutée
  @@index([vagueId])
  @@index([siteId])
}
```

**Note R8 :** `siteId` inclus obligatoirement.

---

## Récapitulatif des fichiers modifiés par phase

### Phase 1 — 10 fichiers modifiés, 2 fichiers créés

| Fichier | Modification |
|---------|-------------|
| `prisma/schema.prisma` | +3 enums, +6 champs Produit (sans DLC), +2 champs Releve, +2 champs MouvementStock, +1 champ ConfigElevage |
| `prisma/migrations/20260328000001_add_feed_analytics_v2/migration.sql` | NOUVEAU |
| `prisma/migrations/20260328000001_add_feed_analytics_v2/rollback.sql` | NOUVEAU |
| `src/types/models.ts` | +3 enums, +6 champs Produit, +2 champs Releve, +2 champs MouvementStock |
| `src/types/index.ts` | +3 exports enums |
| `src/types/api.ts` | +6 champs Produit DTOs, +2 champs Releve DTO, +2 champs MouvementStock DTO, +3 champs ProduitFilters |
| `src/lib/queries/produits.ts` | +6 champs createProduit/updateProduit |
| `src/lib/queries/mouvements.ts` | +2 champs createMouvement |
| `src/app/api/produits/route.ts` | +validation taux 0-100, +6 champs |
| `src/app/api/produits/[id]/route.ts` | +validation taux 0-100, +6 champs |
| `src/app/api/releves/route.ts` | +validation typeReleve pour tauxRefus/comportementAlim, +liste blanche tauxRefus |
| `prisma/seed.sql` | Enrichissement avec filtre `AND categorie='ALIMENT'` |

### Phase 2 — 4 fichiers modifiés

| Fichier | Modification |
|---------|-------------|
| `src/lib/calculs.ts` | +5 fonctions + `ScoreAlimentConfig` interface + bug fix score |
| `src/lib/benchmarks.ts` | +4 constantes benchmark, +2 fonctions getBenchmark* |
| `src/types/calculs.ts` | +champs AnalytiqueAliment, +5 interfaces, +`ScoreAlimentConfig` re-export |
| `src/lib/queries/analytics.ts` | Enrichissement computeAlimentMetrics + 2 nouvelles fonctions |

### Phase 3 — 7 fichiers modifiés, 5 fichiers créés

| Fichier | Modification |
|---------|-------------|
| `src/messages/fr/analytics.json` | +clés tailleGranule, formeAliment, comportement, score, filters, dlc, alerteRation, fcrHebdo, correlationMortalite, refus |
| `src/messages/en/analytics.json` | idem EN |
| `src/messages/fr/stock.json` | +champs formulaire produit aliment |
| `src/messages/fr/releves.json` | +champs tauxRefus, comportementAlim |
| `src/app/analytics/aliments/page.tsx` | +searchParams avec validation enum |
| `src/components/analytics/feed-comparison-cards.tsx` | +taille granulé (i18n), +score, +avertissement |
| `src/components/releves/releve-form-client.tsx` | +tauxRefus RadioGroup, +comportementAlim RadioGroup (i18n) |
| `src/components/stock/produit-form.tsx` | +section champs aliment (i18n) |
| `src/components/stock/mouvement-form.tsx` | +champs DLC et lot (sur ENTREE ALIMENT) |
| `src/components/analytics/feed-filters.tsx` | NOUVEAU |
| `src/components/analytics/feed-fcr-weekly-chart.tsx` | NOUVEAU |
| `src/components/analytics/feed-mortality-correlation.tsx` | NOUVEAU |
| `src/lib/queries/produits.ts` | +getMouvementsEnAlerteDLC (séparé expirés vs bientôt) |

### Phase 4 — 4 fichiers modifiés, 3 fichiers créés

| Fichier | Modification |
|---------|-------------|
| `src/app/analytics/aliments/page.tsx` | +alertes ration, +scores fournisseur, +filtre saison |
| `src/app/api/export/aliments/route.ts` | NOUVEAU |
| `src/components/analytics/rapport-consommation-button.tsx` | NOUVEAU |
| `src/components/analytics/courbe-croissance-reference.tsx` | NOUVEAU |
| `src/lib/calculs.ts` | +genererCourbeCroissanceReference |
| `src/types/calculs.ts` | +CourbeCroissanceReference |
| `src/lib/queries/analytics.ts` | +getScoresFournisseurs, +getSaison (avec param pays), filtre saison |

---

## Mapping features → phases

| ID | Feature | Phase | Sprint suggéré |
|----|---------|-------|---------------|
| F1 | `tailleGranule` sur Produit | 1 | 31 |
| F2 | Filtrage analytics par taille | 3 | 32 |
| F3 | Affichage taille sur cartes | 3 | 32 |
| F4 | Avertissement tailles différentes | 3 | 32 |
| F5 | `formeAliment` sur Produit | 1 | 31 |
| F6 | `tauxProteines` sur Produit | 1 | 31 |
| F7 | `tauxRefus` sur Releve | 1 | 31 |
| F8 | `comportementAlim` sur Releve | 1 | 31 |
| F9 | Calcul ADG | 2 | 31 |
| F10 | Benchmarks FCR par phase | 2+3 | 31–32 |
| F11 | Score qualité aliment /10 | 2+3 | 31–32 |
| F12 | `tauxLipides`, `tauxFibres` | 1 | 31 |
| F13 | Calcul PER | 2 | 31 |
| F14 | Graphique FCR hebdomadaire | 3 | 32 |
| F15 | Corrélation mortalité / aliment | 3 | 32 |
| F16 | Rapport PDF consommation [DESIGN NEEDED] | 4 | 33 |
| F17 | Détection changement granulé | 2+3 | 31–32 |
| F18 | Alerte sous/sur-alimentation | 2+4 | 31+33 |
| F19 | Courbe vs référentiel [DESIGN NEEDED] | 4 | 33 |
| F20 | Score fournisseur agrégé | 4 | 33 |
| F21 | Suivi DLC et alertes (MouvementStock) | 1+3 | 31+32 |
| F22 | Filtre analytiques par saison | 4 | 33 |
| F23 | Table HistoriqueNutritionnel (NICE) | 4 | 34 |
| F24 | Calcul DFR | 2 | 31 |

---

## Contraintes et règles à respecter (R1–R9)

| Règle | Application dans ce plan |
|-------|-------------------------|
| R1 | Toutes les valeurs d'enum UPPERCASE : P0, P1... G5 / FLOTTANT / NORMAL / etc. |
| R2 | Importer `TailleGranule, FormeAliment, ComportementAlimentaire` depuis `@/types` |
| R3 | Champs Prisma et TypeScript strictement alignés |
| R4 | Mises à jour atomiques Prisma |
| R5 | Select Radix avec `asChild` correctement, DialogTrigger asChild |
| R6 | CSS variables via classes Tailwind définies, jamais hardcodé |
| R7 | Nullabilité explicite sur tous les nouveaux champs |
| R8 | `HistoriqueNutritionnel` a `siteId String NOT NULL` |
| R9 | `npx vitest run` + `npm run build` avant chaque review |

---

## Notes de compatibilité ascendante et transition (A13)

1. Tous les nouveaux champs sur `Produit`, `Releve`, `MouvementStock` sont nullable — données existantes non affectées.
2. `phasesCibles PhaseElevage[]` a `DEFAULT '{}'` — produits existants ont tableau vide (aucune restriction de phase).
3. Les composants qui consomment `getComparaisonAliments` recevront maintenant des champs enrichis potentiellement nuls. Le pattern de base est : `aliment.tailleGranule !== null && ...` avant affichage.
4. **Option "Non renseigné" dans les filtres :** Le Select filtre `tailleGranule` DOIT inclure une option explicite "Non renseigné" (ou "Tous") pour les données pré-migration. Ne pas filtrer sur null via searchParams par défaut.
5. **DLC :** L'alerte DLC ne concerne que les `MouvementStock` créés après migration. Les stocks antérieurs sans `datePeremption` n'apparaissent pas en alerte — comportement attendu et correct.
6. **Score null :** Si `fcrMoyen` et `sgrMoyen` sont tous deux null (aliment jamais utilisé en production ou données insuffisantes), `score = null`. L'UI doit afficher "—" et non "0/10".

---

## Dépendances entre features

```
F1 ────────────────────────────────────────── F2, F3, F4, F10 (taille visible)
F6 (tauxProteines) ─────────────────────────── F13 (PER calcul)
F6 + F13 ──────────────────────────────────── F11 (score partiel avec PER)
F7 (tauxRefus) + F8 (comportement) ────────── F18 (alerte ration qualitative)
F9 (ADG) + F13 (PER) + F11 (score) ────────── F20 (score fournisseur agrégé)
Phase 2 complète ───────────────────────────── F14 (graphique FCR hebdo)
F14 ────────────────────────────────────────── F17 (annotations changement)
F14 + F15 ─────────────────────────────────── F19 (courbe vs référentiel) [DESIGN NEEDED]
Phase 3 complète ───────────────────────────── F16 [DESIGN NEEDED], F18, F22
MouvementStock (F21) ───────────────────────── F16 (rapport PDF avec DLC)
```
