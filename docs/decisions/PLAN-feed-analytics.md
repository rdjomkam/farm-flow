# PLAN — Implémentation complète des analytiques aliments (F1–F24)

**Date :** 2026-03-28
**Auteur :** @architect
**Référence :** ADR-feed-analytics-research.md
**Statut :** PLAN / EXÉCUTABLE

---

## Vue d'ensemble

Ce plan couvre les 24 améliorations (F1–F24) de l'ADR feed analytics, organisées en 4 phases séquentielles. Chaque phase peut être implémentée dans un sprint distinct. Les dépendances entre features sont explicites.

### Récapitulatif des fichiers critiques existants

| Fichier | Rôle actuel |
|---------|-------------|
| `prisma/schema.prisma` | Schéma de BDD — Produit (lignes 620–680), Releve (lignes 1100–1180), PhaseElevage enum (ligne 386) |
| `src/types/models.ts` | Interface Produit (ligne 630), PhaseElevage enum (ligne 1759) |
| `src/types/calculs.ts` | AnalytiqueAliment (ligne 368), ComparaisonAliments (ligne 395), DetailAliment (ligne 411) |
| `src/lib/calculs.ts` | calculerFCR, calculerSGR, calculerFCRParAliment, calculerCoutParKgGain |
| `src/lib/benchmarks.ts` | BENCHMARK_FCR, BENCHMARK_SGR, evaluerBenchmark |
| `src/lib/queries/analytics.ts` | computeAlimentMetrics, getComparaisonAliments, getDetailAliment |
| `src/app/analytics/aliments/page.tsx` | Page liste aliments — utilise FeedComparisonCards |
| `src/app/analytics/aliments/[produitId]/page.tsx` | Page détail aliment |
| `src/components/analytics/feed-comparison-cards.tsx` | Cartes comparaison aliments |
| `src/components/analytics/feed-detail-charts.tsx` | Graphiques détail (FCR timeline) |
| `prisma/seed.sql` | Données de test |

### État actuel des enums Prisma

Enums existants dans `prisma/schema.prisma` — PAS encore présents :
- `TailleGranule` — ABSENT
- `FormeAliment` — ABSENT
- `ComportementAlimentaire` — ABSENT

Enums déjà présents et réutilisables :
- `PhaseElevage` — ligne 386, valeurs : ACCLIMATATION, CROISSANCE_DEBUT, JUVENILE, GROSSISSEMENT, FINITION, PRE_RECOLTE

---

## Phase 1 — Schéma, types, migration, seed (F1, F5, F6, F7, F8, F12)

**Features couvertes :** F1 (tailleGranule), F5 (formeAliment), F6 (tauxProteines), F7 (tauxRefus), F8 (comportementAlim), F12 (tauxLipides, tauxFibres)

**Objectif :** Enrichir le schéma de données sans casser l'existant. Tous les champs sont nullable donc non-destructifs.

---

### 1.1 — Nouveaux enums Prisma

**Fichier :** `prisma/schema.prisma`

Ajouter après la déclaration de `PhaseElevage` (après la ligne 393 contenant `PRE_RECOLTE`), avant la section `// Enums — Production Alevins` :

```prisma
// ──────────────────────────────────────────
// Enums — Analytiques aliments (PLAN-feed-analytics)
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
  FLOTTANT      // Aliment extrudé flottant
  COULANT       // Aliment coulant classique
  SEMI_FLOTTANT // Aliment semi-flottant
  POUDRE        // Poudre fine (larves)
}

enum ComportementAlimentaire {
  NORMAL        // Appétit normal
  LENT          // Alimentation lente
  REFUS_PARTIEL // Refus partiel
  REFUS_TOTAL   // Refus total (anorexie)
}
```

---

### 1.2 — Champs sur le modèle Produit

**Fichier :** `prisma/schema.prisma`

Localiser le modèle `Produit` (chercher `model Produit {`). Ajouter les champs suivants après le champ `isActive` et avant le champ `siteId` :

```prisma
  // ── Analytiques aliments (PLAN-feed-analytics) ──────────────────────────
  // Ces champs sont pertinents uniquement pour categorie = ALIMENT
  // Tous nullable pour rétrocompatibilité et catégories non-aliment

  /** Granulométrie — taille du granulé ciblée */
  tailleGranule     TailleGranule?

  /** Forme physique de l'aliment (flottant, coulant, etc.) */
  formeAliment      FormeAliment?

  /** Taux de protéines brutes en % de matière sèche — optionnel (fiche technique) */
  tauxProteines     Float?

  /** Taux de lipides bruts en % MS */
  tauxLipides       Float?

  /** Taux de fibres brutes en % MS */
  tauxFibres        Float?

  /** Phases d'élevage pour lesquelles cet aliment est recommandé */
  phasesCibles      PhaseElevage[]

  /** Date de péremption du lot en stock (alerte DLC) */
  datePeremption    DateTime?

  /** Numéro de lot fabricant (traçabilité) */
  lotFabrication    String?
```

**Note :** `phasesCibles PhaseElevage[]` est un tableau PostgreSQL natif — syntaxe Prisma correcte sans `@default([])` obligatoire (array vide par défaut).

---

### 1.3 — Champs sur le modèle Releve

**Fichier :** `prisma/schema.prisma`

Localiser le modèle `Releve` (chercher `model Releve {`). Ajouter les champs suivants dans la section des champs ALIMENTATION (après `quantiteAliment` et `typeAliment`) :

```prisma
  // ── Analytiques aliments — champs type ALIMENTATION uniquement ──────────

  /** Estimation visuelle du taux de refus : 0, 10, 25, 50 % — null si non renseigné */
  tauxRefus         Float?

  /** Comportement alimentaire observé lors de la distribution */
  comportementAlim  ComportementAlimentaire?
```

---

### 1.4 — Migration SQL

**Fichier à créer :** `prisma/migrations/20260328000001_add_feed_analytics_fields/migration.sql`

Créer le dossier `prisma/migrations/20260328000001_add_feed_analytics_fields/` et y placer :

```sql
-- Migration : add_feed_analytics_fields
-- Nouveaux enums + champs sur Produit et Releve
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
  ADD COLUMN "phasesCibles"   "PhaseElevage"[] NOT NULL DEFAULT '{}',
  ADD COLUMN "datePeremption" TIMESTAMP(3),
  ADD COLUMN "lotFabrication" TEXT;

-- 3. Ajouter les champs sur Releve (tous nullable)
ALTER TABLE "Releve"
  ADD COLUMN "tauxRefus"        DOUBLE PRECISION,
  ADD COLUMN "comportementAlim" "ComportementAlimentaire";
```

**Appliquer avec :**
```bash
npx prisma migrate deploy
```

Puis régénérer le client :
```bash
npx prisma generate
```

---

### 1.5 — Nouveaux enums TypeScript

**Fichier :** `src/types/models.ts`

Ajouter après le bloc `PhaseElevage` (après la ligne 1766 contenant `PRE_RECOLTE = "PRE_RECOLTE"`), avant le commentaire `// Enums — Phase 3 : Packs & Provisioning` :

```typescript
// ---------------------------------------------------------------------------
// Enums — Analytiques aliments (PLAN-feed-analytics)
// ---------------------------------------------------------------------------

/**
 * TailleGranule — granulométrie de l'aliment pour Clarias gariepinus.
 *
 * Chaque valeur correspond à un diamètre standard de granulé
 * et à une phase d'élevage cible.
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

### 1.6 — Mise à jour de l'interface Produit

**Fichier :** `src/types/models.ts`

Localiser l'interface `Produit` (ligne ~630). Ajouter les champs suivants après `isActive` et avant `siteId` :

```typescript
  // ── Analytiques aliments (PLAN-feed-analytics) ──────────────────────────
  /** Granulométrie de l'aliment — null si non renseigné ou non applicable */
  tailleGranule: TailleGranule | null;
  /** Forme physique de l'aliment */
  formeAliment: FormeAliment | null;
  /** Taux de protéines brutes en % MS — null si inconnu */
  tauxProteines: number | null;
  /** Taux de lipides bruts en % MS */
  tauxLipides: number | null;
  /** Taux de fibres brutes en % MS */
  tauxFibres: number | null;
  /** Phases d'élevage recommandées pour cet aliment */
  phasesCibles: PhaseElevage[];
  /** Date de péremption du lot actuel en stock */
  datePeremption: Date | null;
  /** Numéro de lot fabricant */
  lotFabrication: string | null;
```

---

### 1.7 — Mise à jour de l'interface Releve

**Fichier :** `src/types/models.ts`

Localiser l'interface `Releve` (chercher `export interface Releve {`). Ajouter après le champ `typeAliment` :

```typescript
  // ── Analytiques aliments (PLAN-feed-analytics) ──────────────────────────
  /** Taux de refus estimé en % (0, 10, 25, 50) — null si non saisi */
  tauxRefus: number | null;
  /** Comportement alimentaire observé */
  comportementAlim: ComportementAlimentaire | null;
```

---

### 1.8 — Export barrel

**Fichier :** `src/types/index.ts`

Ajouter les trois nouveaux enums dans le bloc d'export des enums (après `ActionRegle,` dans le premier bloc export) :

```typescript
  // PLAN-feed-analytics — Analytiques aliments
  TailleGranule,
  FormeAliment,
  ComportementAlimentaire,
```

---

### 1.9 — DTOs API mis à jour

**Fichier :** `src/types/api.ts`

Localiser `CreateProduitDTO` et `UpdateProduitDTO`. Ajouter les champs optionnels :

```typescript
// Dans CreateProduitDTO — après le champ `isActive?`
tailleGranule?: TailleGranule | null;
formeAliment?: FormeAliment | null;
tauxProteines?: number | null;
tauxLipides?: number | null;
tauxFibres?: number | null;
phasesCibles?: PhaseElevage[];
datePeremption?: Date | string | null;
lotFabrication?: string | null;
```

```typescript
// Dans UpdateProduitDTO — mêmes champs optionnels
tailleGranule?: TailleGranule | null;
formeAliment?: FormeAliment | null;
tauxProteines?: number | null;
tauxLipides?: number | null;
tauxFibres?: number | null;
phasesCibles?: PhaseElevage[];
datePeremption?: Date | string | null;
lotFabrication?: string | null;
```

Localiser `CreateReleveAlimentationDTO`. Ajouter :

```typescript
// Dans CreateReleveAlimentationDTO — après le champ `typeAliment?`
tauxRefus?: number | null;       // 0, 10, 25, 50
comportementAlim?: ComportementAlimentaire | null;
```

Localiser `ProduitFilters`. Ajouter :

```typescript
// Dans ProduitFilters
tailleGranule?: TailleGranule;
formeAliment?: FormeAliment;
phaseCible?: PhaseElevage;
```

---

### 1.10 — Mise à jour du seed SQL

**Fichier :** `prisma/seed.sql`

Localiser les INSERT de produits de type aliment (section `-- Produits`). Enrichir 3 aliments existants avec les nouvelles colonnes :

```sql
-- Exemple pour un aliment Skretting G2
UPDATE "Produit"
SET
  "tailleGranule" = 'G2',
  "formeAliment" = 'FLOTTANT',
  "tauxProteines" = 42.0,
  "tauxLipides" = 8.0,
  "tauxFibres" = 4.5,
  "phasesCibles" = ARRAY['JUVENILE', 'GROSSISSEMENT']::"PhaseElevage"[]
WHERE nom LIKE '%Skretting%' OR nom LIKE '%G2%' OR nom LIKE '%granulé%';
```

Pour les INSERT nouveaux dans le seed, utiliser cette forme :

```sql
INSERT INTO "Produit" (
  "id", "nom", "categorie", "unite", "prixUnitaire", "stockActuel",
  "seuilAlerte", "isActive", "siteId",
  "tailleGranule", "formeAliment", "tauxProteines", "tauxLipides",
  "tauxFibres", "phasesCibles", "createdAt", "updatedAt"
) VALUES (
  'prod-aliment-g3',
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

Pour les INSERT de relevés ALIMENTATION, ajouter les colonnes :

```sql
-- Exemple relevé avec tauxRefus et comportementAlim
INSERT INTO "Releve" (..., "tauxRefus", "comportementAlim")
VALUES (..., 10, 'NORMAL');
```

---

### 1.11 — Route API Produit : mise à jour

**Fichier :** `src/app/api/produits/route.ts`

Localiser le handler POST (création produit). Ajouter dans le `prisma.produit.create({ data: {...} })` :

```typescript
tailleGranule: data.tailleGranule ?? null,
formeAliment: data.formeAliment ?? null,
tauxProteines: data.tauxProteines ?? null,
tauxLipides: data.tauxLipides ?? null,
tauxFibres: data.tauxFibres ?? null,
phasesCibles: data.phasesCibles ?? [],
datePeremption: data.datePeremption ? new Date(data.datePeremption) : null,
lotFabrication: data.lotFabrication ?? null,
```

**Fichier :** `src/app/api/produits/[id]/route.ts`

Même ajout dans le handler PATCH.

**Fichier :** `src/lib/queries/produits.ts`

Dans `createProduit` (ligne 64) et `updateProduit`, ajouter les champs dans `data: { ... }`.

---

### Tests Phase 1

**Fichier à créer :** `src/tests/phase1-feed-schema.test.ts`

Tests requis :
1. `npx prisma migrate dev` sans erreur (vérifier manuellement)
2. Vérifier que `Produit.tailleGranule` accepte null et les valeurs de l'enum
3. Vérifier que `Produit.phasesCibles` est bien un array vide par défaut
4. Vérifier que `Releve.tauxRefus` accepte 0, 10, 25, 50
5. Vérifier que les routes POST/PATCH produit acceptent les nouveaux champs
6. `npm run build` sans erreur TypeScript

---

## Phase 2 — Calculs et queries (F9, F10, F11, F13, F17, F24)

**Features couvertes :**
- F9 : Calcul ADG (Average Daily Gain)
- F10 : Benchmarks FCR contextualisés par phase
- F11 : Score qualité aliment /10
- F13 : Calcul PER (Protein Efficiency Ratio)
- F17 : Détection changement granulé automatique
- F24 : Calcul DFR et alerte sur-alimentation

**Dépendances :** Phase 1 terminée (pour `tauxProteines` nécessaire à PER)

---

### 2.1 — Nouvelles fonctions dans calculs.ts

**Fichier :** `src/lib/calculs.ts`

Ajouter à la fin du fichier, après `convertirUniteStock` (après la ligne 998) :

```typescript
// ---------------------------------------------------------------------------
// PLAN-feed-analytics — Nouveaux indicateurs zootechniques
// ---------------------------------------------------------------------------

/**
 * Calcule le ADG (Average Daily Gain) — gain journalier moyen en g/jour.
 *
 * Formule : (poidsFinal - poidsInitial) / jours
 *
 * Benchmarks Clarias gariepinus :
 *   fingerling (30g)   : bon > 1.0 g/j, excellent > 1.5 g/j
 *   juvénile (100g)    : bon > 2.0 g/j, excellent > 3.0 g/j
 *   sub-adulte (300g)  : bon > 3.5 g/j, excellent > 5.0 g/j
 *   adulte (500g)      : bon > 4.0 g/j, excellent > 6.0 g/j
 *
 * @param poidsInitial - Poids moyen initial en grammes
 * @param poidsFinal - Poids moyen final en grammes
 * @param jours - Nombre de jours entre les deux mesures
 * @returns ADG en g/jour, ou null si données insuffisantes
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
  return (poidsFinal - poidsInitial) / jours;
}

/**
 * Calcule le PER (Protein Efficiency Ratio) — efficacité protéique.
 *
 * Formule : gainPoids(g) / proteinesConsommees(g)
 *
 * Benchmark Clarias grossissement : PER > 2.0 (bon)
 *
 * @param gainPoids - Gain de poids total en grammes (population)
 * @param quantiteAliment - Quantité d'aliment consommée en kg
 * @param tauxProteines - Taux de protéines brutes en % (ex: 42 pour 42%)
 * @returns PER sans unité, ou null si données insuffisantes
 */
export function calculerPER(
  gainPoids: number | null,
  quantiteAliment: number | null,
  tauxProteines: number | null
): number | null {
  if (
    gainPoids == null ||
    quantiteAliment == null ||
    tauxProteines == null ||
    quantiteAliment <= 0 ||
    tauxProteines <= 0
  ) {
    return null;
  }
  const proteinesConsommees = (quantiteAliment * 1000) * (tauxProteines / 100); // en grammes
  if (proteinesConsommees <= 0) return null;
  return gainPoids / proteinesConsommees;
}

/**
 * Calcule le DFR (Daily Feeding Rate) — taux d'alimentation quotidien.
 *
 * Formule : (quantiteJournaliere / biomasse) × 100
 *
 * Benchmark Clarias : 2–5 % biomasse/jour selon phase
 *
 * @param quantiteJournaliere - Quantité d'aliment distribuée en kg ce jour
 * @param biomasse - Biomasse estimée en kg
 * @returns DFR en % de la biomasse, ou null si données insuffisantes
 */
export function calculerDFR(
  quantiteJournaliere: number | null,
  biomasse: number | null
): number | null {
  if (
    quantiteJournaliere == null ||
    biomasse == null ||
    biomasse <= 0
  ) {
    return null;
  }
  return (quantiteJournaliere / biomasse) * 100;
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
 * Calcule le score qualité d'un aliment sur 10 (multicritères).
 *
 * Algorithme pondéré :
 *   FCR    : 40% du score (lower is better, normalisé entre 1.0 et 3.0)
 *   SGR    : 25% du score (higher is better, normalisé entre 0 et 4 %/j)
 *   Coût/kg: 25% du score (lower is better, normalisé entre 500 et 4000 CFA)
 *   Survie : 10% du score (higher is better, normalisé entre 70% et 100%)
 *
 * Retourne null si FCR ET SGR sont tous deux null (pas assez de données).
 *
 * @param fcr - FCR moyen pondéré (lower is better)
 * @param sgr - SGR moyen en %/jour (higher is better)
 * @param coutKg - Coût par kg de gain en CFA (lower is better)
 * @param tauxSurvie - Taux de survie moyen en % (higher is better)
 * @returns Score entre 0 et 10, ou null
 */
export function calculerScoreAliment(
  fcr: number | null,
  sgr: number | null,
  coutKg: number | null,
  tauxSurvie: number | null
): number | null {
  if (fcr == null && sgr == null) return null;

  let score = 0;
  let poidsTotal = 0;

  // FCR — 40% — normalisé : 1.0 = 10pts, 3.0 = 0pts
  if (fcr !== null) {
    const fcrNorm = Math.max(0, Math.min(10, 10 - ((fcr - 1.0) / 2.0) * 10));
    score += fcrNorm * 0.4;
    poidsTotal += 0.4;
  }

  // SGR — 25% — normalisé : 4%/j = 10pts, 0 = 0pts
  if (sgr !== null) {
    const sgrNorm = Math.max(0, Math.min(10, (sgr / 4.0) * 10));
    score += sgrNorm * 0.25;
    poidsTotal += 0.25;
  }

  // Coût/kg — 25% — normalisé : 500 CFA = 10pts, 4000 CFA = 0pts
  if (coutKg !== null) {
    const coutNorm = Math.max(0, Math.min(10, 10 - ((coutKg - 500) / 3500) * 10));
    score += coutNorm * 0.25;
    poidsTotal += 0.25;
  }

  // Survie — 10% — normalisé : 100% = 10pts, 70% = 0pts
  if (tauxSurvie !== null) {
    const survieNorm = Math.max(0, Math.min(10, ((tauxSurvie - 70) / 30) * 10));
    score += survieNorm * 0.1;
    poidsTotal += 0.1;
  }

  if (poidsTotal <= 0) return null;

  // Ramener le score au poids total des critères disponibles
  const scoreAjuste = (score / poidsTotal) * 10;
  return Math.round(scoreAjuste * 10) / 10;
}
```

---

### 2.2 — Nouveaux benchmarks dans benchmarks.ts

**Fichier :** `src/lib/benchmarks.ts`

Ajouter à la fin du fichier, après `benchmarkBgColor` :

```typescript
// ---------------------------------------------------------------------------
// PLAN-feed-analytics — Benchmarks par phase pour Clarias gariepinus
// ---------------------------------------------------------------------------

/**
 * Benchmarks FCR différenciés par phase d'élevage.
 * Source : FAO / CIRAD Clarias gariepinus guidelines.
 */
export const BENCHMARK_FCR_PAR_PHASE: Record<
  string,
  { excellent: number; bon: number; acceptable: number }
> = {
  ACCLIMATATION: { excellent: 1.2, bon: 1.5, acceptable: 2.0 },
  CROISSANCE_DEBUT: { excellent: 1.3, bon: 1.6, acceptable: 2.0 },
  JUVENILE: { excellent: 1.4, bon: 1.8, acceptable: 2.2 },
  GROSSISSEMENT: { excellent: 1.5, bon: 1.9, acceptable: 2.5 },
  FINITION: { excellent: 1.6, bon: 2.0, acceptable: 2.8 },
  PRE_RECOLTE: { excellent: 1.8, bon: 2.2, acceptable: 3.0 },
} as const;

/**
 * Benchmarks SGR différenciés par phase.
 * Plus haut = meilleur. Valeurs en %/jour.
 */
export const BENCHMARK_SGR_PAR_PHASE: Record<
  string,
  { excellent: number; bon: number; acceptable: number }
> = {
  ACCLIMATATION: { excellent: 4.0, bon: 3.0, acceptable: 2.0 },
  CROISSANCE_DEBUT: { excellent: 3.5, bon: 2.5, acceptable: 1.8 },
  JUVENILE: { excellent: 3.0, bon: 2.0, acceptable: 1.5 },
  GROSSISSEMENT: { excellent: 2.5, bon: 1.8, acceptable: 1.2 },
  FINITION: { excellent: 2.0, bon: 1.5, acceptable: 1.0 },
  PRE_RECOLTE: { excellent: 1.5, bon: 1.0, acceptable: 0.7 },
} as const;

/**
 * Benchmarks ADG (Average Daily Gain) par stade de poids.
 * Valeurs en g/jour.
 */
export const BENCHMARK_ADG_PAR_STADE: Record<
  string,
  { label: string; poidsMin: number; poidsMax: number; excellent: number; bon: number }
> = {
  fingerling: { label: "Fingerling (<30g)", poidsMin: 0, poidsMax: 30, excellent: 1.5, bon: 1.0 },
  juvenile: { label: "Juvénile (30-150g)", poidsMin: 30, poidsMax: 150, excellent: 3.0, bon: 2.0 },
  subadulte: { label: "Sub-adulte (150-400g)", poidsMin: 150, poidsMax: 400, excellent: 5.0, bon: 3.5 },
  adulte: { label: "Adulte (>400g)", poidsMin: 400, poidsMax: Infinity, excellent: 6.0, bon: 4.0 },
} as const;

/**
 * Benchmark DFR (Daily Feeding Rate) en % biomasse/jour.
 * Varie selon la phase d'élevage.
 */
export const BENCHMARK_DFR_PAR_PHASE: Record<
  string,
  { min: number; max: number; optimal: number }
> = {
  ACCLIMATATION: { min: 8, max: 15, optimal: 10 },
  CROISSANCE_DEBUT: { min: 5, max: 8, optimal: 6 },
  JUVENILE: { min: 3, max: 5, optimal: 4 },
  GROSSISSEMENT: { min: 2, max: 4, optimal: 3 },
  FINITION: { min: 1.5, max: 3, optimal: 2 },
  PRE_RECOLTE: { min: 1, max: 2, optimal: 1.5 },
} as const;

/**
 * Retourne les seuils FCR pour une phase donnée.
 * Construit un BenchmarkRange compatible avec evaluerBenchmark().
 *
 * @param phase - Phase d'élevage (PhaseElevage enum)
 * @returns BenchmarkRange paramétré pour la phase, ou BENCHMARK_FCR si phase inconnue
 */
export function getBenchmarkFCRPourPhase(phase: string | null): BenchmarkRange {
  if (!phase || !(phase in BENCHMARK_FCR_PAR_PHASE)) {
    return BENCHMARK_FCR; // fallback
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
 *
 * @param poidsMoyen - Poids moyen du poisson en grammes
 * @returns BenchmarkRange pour l'ADG à ce stade, ou null si données insuffisantes
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

Localiser l'interface `AnalytiqueAliment` (ligne 368). Ajouter les champs enrichis :

```typescript
// Dans AnalytiqueAliment, ajouter après tauxSurvieAssocie :

  // ── PLAN-feed-analytics — Indicateurs enrichis ──────────────────────────
  /** Granulométrie de l'aliment (depuis Produit.tailleGranule) */
  tailleGranule: TailleGranule | null;
  /** Forme physique (depuis Produit.formeAliment) */
  formeAliment: FormeAliment | null;
  /** Taux de protéines en % (depuis Produit.tauxProteines) */
  tauxProteines: number | null;
  /** ADG moyen en g/jour sur les vagues utilisant cet aliment */
  adgMoyen: number | null;
  /** PER moyen (calculable si tauxProteines non null) */
  perMoyen: number | null;
  /** Score qualité /10 (multicritères) */
  score: number | null;
  /** Phases d'élevage recommandées pour cet aliment */
  phasesCibles: PhaseElevage[];
  /** Date de péremption du lot en stock */
  datePeremption: Date | null;
```

Ajouter une nouvelle interface pour les filtres analytics :

```typescript
/**
 * Filtres pour la page analytiques aliments (/analytics/aliments).
 */
export interface FiltresAnalyticsAliments {
  tailleGranule?: TailleGranule | null;
  formeAliment?: FormeAliment | null;
  phaseCible?: PhaseElevage | null;
  fournisseurId?: string | null;
}

/**
 * Point de données pour l'évolution FCR hebdomadaire.
 * Utilisé par le composant FeedFCRWeeklyChart (F14).
 */
export interface FCRHebdomadairePoint {
  /** Semaine au format ISO "YYYY-Www" (ex: "2026-W03") */
  semaine: string;
  /** Numéro de semaine depuis le début du cycle (1, 2, 3...) */
  semaineNumero: number;
  /** FCR calculé pour la semaine */
  fcr: number | null;
  /** Vrai si le granulé a changé cette semaine (F17) */
  changementGranule: boolean;
  /** Nom du produit utilisé cette semaine */
  produitNom: string | null;
  /** Taille du granulé utilisé */
  tailleGranule: TailleGranule | null;
  /** Température moyenne de l'eau cette semaine (corrélation F15) */
  temperatureMoyenne: number | null;
}

/**
 * Résultat de la détection de changement de granulé (F17).
 */
export interface ChangementGranule {
  /** Date du premier relevé avec le nouveau produit */
  date: Date;
  /** Produit précédent */
  ancienProduitNom: string | null;
  ancienTaille: TailleGranule | null;
  /** Nouveau produit */
  nouveauProduitNom: string;
  nouvelleTaille: TailleGranule | null;
  /** Jour du cycle lors du changement */
  jourCycle: number;
}

/**
 * Alerte sous/sur-alimentation (F18/F24).
 */
export interface AlerteRation {
  vagueId: string;
  vagueCode: string;
  /** Nombre de relevés consécutifs en écart */
  nombreRelevesConcernes: number;
  /** Écart moyen en % (positif = sur-alimentation, négatif = sous-alimentation) */
  ecartMoyen: number;
  /** Type d'alerte */
  type: "SOUS_ALIMENTATION" | "SUR_ALIMENTATION";
  /** Date du dernier relevé concerné */
  dernierReleve: Date;
}
```

---

### 2.4 — Enrichissement de computeAlimentMetrics dans analytics.ts

**Fichier :** `src/lib/queries/analytics.ts`

Localiser la fonction `computeAlimentMetrics` (ligne ~397). Modifier la signature du paramètre `produit` pour inclure les nouveaux champs :

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
    // PLAN-feed-analytics — nouveaux champs
    tailleGranule: string | null;
    formeAliment: string | null;
    tauxProteines: number | null;
    phasesCibles: string[];
    datePeremption: Date | null;
  }
)
```

Dans le calcul `vagueMetrics`, ajouter le calcul ADG et PER :

```typescript
// Après le calcul de fcr, sgr, tauxSurvie, coutKg (ligne ~542)
const adg = calculerADG(vague.poidsMoyenInitial, poidsMoyen, jours);

// PER nécessite gainPoids total de la population
const gainPoidsTotalG = gainBiomasse !== null ? gainBiomasse * 1000 : null;
const per = calculerPER(gainPoidsTotalG, conso.quantite, produit.tauxProteines);
```

Calculer le score global après agrégation des vagues :

```typescript
// Après aggregation fcrMoyen, sgrMoyen, coutParKgGain, tauxSurvie
const score = calculerScoreAliment(fcrMoyen, sgrMoyen, coutParKgGain, tauxSurvieMoyen);
const adgMoyen = /* moyenne des adg par vague */ ...;
const perMoyen = /* moyenne des per par vague */ ...;
```

Dans la query `getComparaisonAliments`, enrichir le `select` Prisma sur `Produit` :

```typescript
// Dans prisma.produit.findMany({ select: { ... } })
// Ajouter :
tailleGranule: true,
formeAliment: true,
tauxProteines: true,
phasesCibles: true,
datePeremption: true,
```

Ajouter le paramètre filtres dans la signature de `getComparaisonAliments` :

```typescript
export async function getComparaisonAliments(
  siteId: string,
  filtres?: FiltresAnalyticsAliments
): Promise<ComparaisonAliments>
```

Dans le `where` de la query Prisma produits, ajouter les filtres :

```typescript
where: {
  siteId,
  categorie: CategorieProduit.ALIMENT,
  isActive: true,
  // PLAN-feed-analytics filtres
  ...(filtres?.tailleGranule && { tailleGranule: filtres.tailleGranule }),
  ...(filtres?.formeAliment && { formeAliment: filtres.formeAliment }),
  ...(filtres?.phaseCible && {
    phasesCibles: { has: filtres.phaseCible },
  }),
  ...(filtres?.fournisseurId && { fournisseurId: filtres.fournisseurId }),
},
```

---

### 2.5 — Nouvelle query : FCR hebdomadaire avec détection changement granulé (F14, F17)

**Fichier :** `src/lib/queries/analytics.ts`

Ajouter la fonction suivante :

```typescript
/**
 * Calcule l'évolution FCR semaine par semaine pour une vague.
 * Détecte automatiquement les changements de granulé entre relevés successifs.
 *
 * @param siteId - ID du site
 * @param vagueId - ID de la vague
 * @returns Tableau de points FCR hebdomadaires avec annotations changement granulé
 */
export async function getFCRHebdomadaire(
  siteId: string,
  vagueId: string
): Promise<{
  points: FCRHebdomadairePoint[];
  changements: ChangementGranule[];
}> {
  // 1. Récupérer la vague
  const vague = await prisma.vague.findFirst({
    where: { id: vagueId, siteId },
    select: {
      id: true, code: true, nombreInitial: true,
      poidsMoyenInitial: true, dateDebut: true, dateFin: true,
      bacs: { select: { id: true, nombreInitial: true } },
    },
  });
  if (!vague) return { points: [], changements: [] };

  // 2. Récupérer tous les relevés ALIMENTATION avec leurs consommations et produits
  const relevesAlim = await prisma.releve.findMany({
    where: { vagueId, siteId, typeReleve: TypeReleve.ALIMENTATION },
    orderBy: { date: "asc" },
    select: {
      id: true, date: true, quantiteAliment: true,
      consommations: {
        select: {
          quantite: true,
          produit: {
            select: {
              id: true, nom: true, tailleGranule: true,
            },
          },
        },
      },
    },
  });

  // 3. Récupérer biométries pour le FCR
  const relevesBio = await prisma.releve.findMany({
    where: { vagueId, siteId, typeReleve: TypeReleve.BIOMETRIE },
    orderBy: { date: "asc" },
    select: { date: true, poidsMoyen: true },
  });

  // 4. Récupérer qualité eau pour corrélation température
  const relevesQualite = await prisma.releve.findMany({
    where: { vagueId, siteId, typeReleve: TypeReleve.QUALITE_EAU },
    orderBy: { date: "asc" },
    select: { date: true, temperature: true },
  });

  // 5. Grouper par semaine ISO et calculer FCR hebdomadaire
  // ... (algorithme : grouper relevesAlim par semaine ISO, calculer FCR avec interpolation biométrie)

  // 6. Détecter changements de granulé entre relevés successifs
  // Comparer produit.tailleGranule du relevé N avec relevé N-1

  return { points: [], changements: [] }; // implémentation par @developer
}
```

---

### 2.6 — Nouvelle query : alerte ration (F18/F24)

**Fichier :** `src/lib/queries/analytics.ts`

Ajouter :

```typescript
/**
 * Détecte les sous/sur-alimentations pour les vagues actives d'un site.
 *
 * Compare la ration réelle (depuis ReleveConsommation) avec la ration théorique
 * calculée depuis ConfigElevage (getTauxAlimentation × biomasse estimée).
 * Déclenche une alerte si l'écart dépasse 20% sur 3 relevés consécutifs.
 *
 * @param siteId - ID du site
 * @returns Liste des alertes ration actives
 */
export async function getAlertesRation(siteId: string): Promise<AlerteRation[]> {
  // 1. Récupérer toutes les vagues actives
  // 2. Pour chaque vague, récupérer ConfigElevage actif
  // 3. Pour chaque relevé ALIMENTATION récent (30 derniers jours),
  //    calculer ration théorique = getTauxAlimentation(poidsMoyen) × biomasse / 100
  // 4. Calculer écart via calculerEcartRation()
  // 5. Détecter 3 relevés consécutifs avec écart > 20%
  return []; // implémentation par @developer
}
```

---

### Tests Phase 2

**Fichier :** `src/tests/calculs.test.ts` (existant — ajouter à la suite)

Tests à ajouter :

```typescript
describe('calculerADG', () => {
  test('calcul nominal : 200g → 500g en 100 jours = 3.0 g/j', ...)
  test('retourne null si jours = 0', ...)
  test('retourne null si poidsInitial null', ...)
})

describe('calculerPER', () => {
  test('nominal : gain 10kg population, 5kg aliment à 40% protéines = PER 0.5', ...)
  test('retourne null si tauxProteines null', ...)
})

describe('calculerDFR', () => {
  test('nominal : 3kg aliment / 100kg biomasse = 3.0%', ...)
  test('retourne null si biomasse = 0', ...)
})

describe('calculerScoreAliment', () => {
  test('FCR=1.2, SGR=3.0, cout=800, survie=95 → score > 8.0', ...)
  test('retourne null si FCR et SGR tous deux null', ...)
  test('score borné entre 0 et 10', ...)
})

describe('calculerEcartRation', () => {
  test('consommé=5kg, théorique=4kg → +25% (sur-alimentation)', ...)
  test('consommé=3kg, théorique=4kg → -25% (sous-alimentation)', ...)
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
- F21 : Suivi DLC et alertes péremption

**Dépendances :** Phase 1 et Phase 2 terminées

---

### 3.1 — Page analytiques aliments : filtres (F2)

**Fichier :** `src/app/analytics/aliments/page.tsx`

Transformer en Server Component avec searchParams pour les filtres :

```typescript
// Signature
export default async function AnalyticsAlimentsPage({
  searchParams,
}: {
  searchParams: Promise<{
    taille?: string;
    forme?: string;
    phase?: string;
    fournisseur?: string;
  }>;
})
```

Passer les filtres parsés à `getComparaisonAliments` :

```typescript
const sp = await searchParams;
const filtres: FiltresAnalyticsAliments = {
  tailleGranule: sp.taille ? (sp.taille as TailleGranule) : undefined,
  formeAliment: sp.forme ? (sp.forme as FormeAliment) : undefined,
  phaseCible: sp.phase ? (sp.phase as PhaseElevage) : undefined,
  fournisseurId: sp.fournisseur ?? undefined,
};
const comparaison = await getComparaisonAliments(session.activeSiteId, filtres);
```

---

### 3.2 — Composant FeedFilters (F2)

**Fichier à créer :** `src/components/analytics/feed-filters.tsx`

```typescript
"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import * as Select from "@radix-ui/react-select";
import { TailleGranule, FormeAliment, PhaseElevage } from "@/types";

/**
 * Barre de filtres pour la page analytiques aliments.
 * Utilise des Radix Select pour accessibilité mobile.
 * Met à jour les searchParams sans navigation (replace).
 */
export function FeedFilters() {
  // Composant "use client" — accès aux searchParams du client
  // Filtres : tailleGranule, formeAliment, phaseCible
  // Chaque filtre met à jour l'URL via router.replace
}
```

Options pour `tailleGranule` (libellés FR) :
- P0 → "Poudre < 0.5mm (larves)"
- P1 → "Poudre 0.5mm (alevins)"
- C1 → "Crumble 1mm"
- C2 → "Crumble 1.5mm"
- G1 → "Granulé 2mm"
- G2 → "Granulé 3mm"
- G3 → "Granulé 4mm"
- G4 → "Granulé 6mm"
- G5 → "Granulé 8mm"

Intégrer dans `src/app/analytics/aliments/page.tsx` en dessous du `<Header>`.

---

### 3.3 — Mise à jour FeedComparisonCards : taille granulé et score (F3, F11)

**Fichier :** `src/components/analytics/feed-comparison-cards.tsx`

Dans la fonction `MetricItem`, ajouter la taille granulé et le score dans la grille :

```tsx
{/* Dans la section "Footer metadata", ajouter après fournisseurNom : */}
{aliment.tailleGranule && (
  <span className="inline-flex items-center gap-1 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium">
    <GrainIcon className="h-2.5 w-2.5" />
    {TAILLE_GRANULE_LABELS[aliment.tailleGranule]}
  </span>
)}
{aliment.formeAliment && (
  <span className="text-xs text-muted-foreground">{FORME_ALIMENT_LABELS[aliment.formeAliment]}</span>
)}

{/* Score aliment /10 */}
{aliment.score !== null && (
  <div className="mt-2 flex items-center gap-2">
    <span className="text-[10px] text-muted-foreground uppercase">Score</span>
    <ScoreBadge score={aliment.score} />
  </div>
)}
```

Créer un composant `ScoreBadge` dans le même fichier :

```tsx
function ScoreBadge({ score }: { score: number }) {
  const color = score >= 7 ? "text-accent-green" : score >= 5 ? "text-accent-amber" : "text-accent-red";
  return (
    <span className={cn("text-sm font-bold", color)}>
      {score.toFixed(1)}/10
    </span>
  );
}
```

---

### 3.4 — Avertissement comparaison tailles différentes (F4)

**Fichier :** `src/components/analytics/feed-comparison-cards.tsx`

Ajouter en tête du composant `FeedComparisonCards` :

```tsx
// Détecter si des aliments de tailles différentes sont comparés
const tailles = aliments
  .map((a) => a.tailleGranule)
  .filter(Boolean);
const taillesUniques = new Set(tailles);
const avertissementTaille = taillesUniques.size > 1;

// Dans le JSX, avant la liste des cartes :
{avertissementTaille && (
  <div className="flex items-start gap-2 rounded-lg border border-accent-amber/30 bg-accent-amber-muted p-3">
    <AlertTriangle className="h-4 w-4 shrink-0 text-accent-amber mt-0.5" />
    <p className="text-xs text-accent-amber">
      Attention : vous comparez des aliments de tailles différentes (
      {[...taillesUniques].join(", ")}). Le FCR peut varier selon la phase d'élevage. Filtrez par taille de granulé pour une comparaison valide.
    </p>
  </div>
)}
```

---

### 3.5 — Formulaire produit : nouveaux champs (F1, F5, F6, F12, F21)

**Fichier :** `src/components/stock/produit-form.tsx` (ou le chemin exact du formulaire produit)

Chercher avec `Glob` : `src/components/stock/produit-form*.tsx` ou `src/app/**/produits/**/*.tsx`

Dans le formulaire de création/édition de produit, afficher les champs aliment uniquement si `categorie === ALIMENT` :

```tsx
{categorie === CategorieProduit.ALIMENT && (
  <div className="flex flex-col gap-3 border-t pt-3">
    <h3 className="text-sm font-medium">Propriétés de l'aliment</h3>

    {/* Granulométrie — champ obligatoire pour ALIMENT */}
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium">Taille de granulé</label>
      <Select.Root value={tailleGranule} onValueChange={setTailleGranule}>
        {/* Radix Select avec les options P0–G5 */}
      </Select.Root>
    </div>

    {/* Forme — Radix Select */}
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium">Forme physique</label>
      <Select.Root value={formeAliment} onValueChange={setFormeAliment}>
        {/* FLOTTANT, COULANT, SEMI_FLOTTANT, POUDRE */}
      </Select.Root>
    </div>

    {/* Taux de protéines — optionnel */}
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium">
        Protéines brutes
        <span className="ml-1 text-xs text-muted-foreground">(% MS, optionnel)</span>
      </label>
      <input type="number" min="0" max="100" step="0.1" placeholder="ex: 42" />
    </div>

    {/* Lipides — optionnel */}
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium">
        Lipides bruts
        <span className="ml-1 text-xs text-muted-foreground">(% MS, optionnel)</span>
      </label>
      <input type="number" min="0" max="100" step="0.1" placeholder="ex: 8" />
    </div>

    {/* Phases ciblées — multi-select Radix */}
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium">Phases recommandées</label>
      {/* Multi-select checkbox-based pour PhaseElevage */}
    </div>

    {/* Date de péremption — F21 */}
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium">
        Date de péremption
        <span className="ml-1 text-xs text-muted-foreground">(alerte DLC)</span>
      </label>
      <input type="date" />
    </div>
  </div>
)}
```

---

### 3.6 — Formulaire relevé ALIMENTATION : nouveaux champs (F7, F8)

**Fichier :** `src/components/releves/releve-form-client.tsx`

Localiser la section du formulaire pour `typeReleve === ALIMENTATION`. Ajouter après la saisie de `quantiteAliment` :

```tsx
{/* Taux de refus — F7 */}
<div className="flex flex-col gap-1.5">
  <label className="text-sm font-medium">
    Taux de refus
    <span className="ml-1 text-xs text-muted-foreground">(estimation visuelle)</span>
  </label>
  {/* Radix RadioGroup : 0%, 10%, 25%, 50% — gros boutons pour mobile */}
  <RadioGroup.Root
    value={String(tauxRefus ?? 0)}
    onValueChange={(v) => setTauxRefus(Number(v))}
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

{/* Comportement alimentaire — F8 */}
<div className="flex flex-col gap-1.5">
  <label className="text-sm font-medium">Comportement alimentaire</label>
  <RadioGroup.Root
    value={comportementAlim ?? ""}
    onValueChange={(v) => setComportementAlim(v as ComportementAlimentaire)}
    className="grid grid-cols-2 gap-2"
  >
    {[
      { value: "NORMAL", label: "Normal" },
      { value: "LENT", label: "Lent" },
      { value: "REFUS_PARTIEL", label: "Refus partiel" },
      { value: "REFUS_TOTAL", label: "Refus total" },
    ].map((item) => (
      <RadioGroup.Item
        key={item.value}
        value={item.value}
        className="flex h-12 items-center justify-center rounded-lg border text-sm font-medium data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
      >
        {item.label}
      </RadioGroup.Item>
    ))}
  </RadioGroup.Root>
</div>
```

Ces champs sont inclus dans le payload soumis à `POST /api/releves` via `CreateReleveAlimentationDTO`.

---

### 3.7 — Composant FeedFCRWeeklyChart (F14)

**Fichier à créer :** `src/components/analytics/feed-fcr-weekly-chart.tsx`

```typescript
"use client";

import {
  ComposedChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ReferenceLine, ResponsiveContainer, Legend
} from "recharts";
import type { FCRHebdomadairePoint } from "@/types";

interface FeedFCRWeeklyChartProps {
  points: FCRHebdomadairePoint[];
  /** Phase détectée (pour benchmarks contextualisés) */
  phase?: string | null;
}

/**
 * Graphique FCR hebdomadaire avec :
 * - Courbe FCR semaine par semaine (Recharts Line)
 * - ReferenceLine verticale rouge quand changementGranule = true (F17)
 * - Tooltip customisé affichant le produit et la taille de granulé
 * - Référence benchmark horizontal (getBenchmarkFCRPourPhase)
 * - Overlay optionnel température eau (axe Y secondaire)
 */
export function FeedFCRWeeklyChart({ points, phase }: FeedFCRWeeklyChartProps) {
  // Implémentation par @developer
  // Pattern : réutiliser le pattern de FeedDetailCharts
  // Mobile first : height 240px sur mobile, 320px sur sm+
}
```

Intégrer dans `src/app/analytics/aliments/[produitId]/page.tsx` après `<FeedFCRChart>` :

```tsx
{detail.fcrHebdomadaire && detail.fcrHebdomadaire.length > 0 && (
  <FeedFCRWeeklyChart
    points={detail.fcrHebdomadaire}
    phase={null} // sera enrichi en Phase 4
  />
)}
```

---

### 3.8 — Corrélation mortalité / aliment (F15)

**Fichier à créer :** `src/components/analytics/feed-mortality-correlation.tsx`

```typescript
"use client";

import type { DetailAlimentVague } from "@/types";

interface FeedMortalityCorrelationProps {
  parVague: DetailAlimentVague[];
}

/**
 * Tableau de corrélation mortalité vs aliment.
 *
 * Affiche pour chaque vague où l'aliment a été utilisé :
 * - Période d'utilisation
 * - FCR de la vague
 * - Taux de mortalité associé
 * - Indicateur visuel : mortalité haute pendant utilisation de l'aliment
 *
 * Si taux de mortalité > 10% dans une vague → badge d'alerte rouge.
 * Mobile first : tableau → cartes empilées sur mobile (< 640px).
 */
export function FeedMortalityCorrelation({ parVague }: FeedMortalityCorrelationProps) {
  // Implémentation par @developer
}
```

L'interface `DetailAlimentVague` dans `src/types/calculs.ts` doit être enrichie avec :

```typescript
// Dans DetailAlimentVague, ajouter :
tauxMortalite: number | null;   // taux de mortalité pendant cette vague
adg: number | null;             // ADG moyen pendant cette vague
per: number | null;             // PER calculé si tauxProteines disponible
```

---

### 3.9 — Alerte péremption DLC (F21)

**Fichier :** `src/lib/queries/produits.ts`

Ajouter une fonction :

```typescript
/**
 * Retourne les produits ALIMENT dont la date de péremption est dans moins de 30 jours.
 *
 * @param siteId - ID du site
 * @param joursAvant - Nombre de jours avant péremption pour déclencher l'alerte (défaut 30)
 */
export async function getProduitsEnAlerteDLC(
  siteId: string,
  joursAvant: number = 30
): Promise<ProduitWithFournisseur[]> {
  const dateLimit = new Date();
  dateLimit.setDate(dateLimit.getDate() + joursAvant);

  return prisma.produit.findMany({
    where: {
      siteId,
      isActive: true,
      categorie: CategorieProduit.ALIMENT,
      datePeremption: {
        not: null,
        lte: dateLimit,
      },
      stockActuel: { gt: 0 },
    },
    include: { fournisseur: { select: { id: true, nom: true } } },
    orderBy: { datePeremption: "asc" },
  });
}
```

Intégrer dans la page stock ou le dashboard en affichant un badge d'alerte.

---

### Tests Phase 3

Fichiers de tests :
1. `src/tests/analytics-aliments-filters.test.ts` — tester `getComparaisonAliments` avec filtres tailleGranule/phase
2. Tests visuels manuels : vérifier sur mobile 360px que les RadioGroup de tauxRefus et comportementAlim sont utilisables avec le pouce

---

## Phase 4 — Fonctionnalités avancées (F16, F18, F19, F20, F22, F23)

**Features couvertes :**
- F16 : Rapport PDF consommation par période
- F18 : Alerte sous/sur-alimentation (seuil 20%, 3 relevés consécutifs)
- F19 : Courbe de croissance vs référentiel théorique
- F20 : Score fournisseur agrégé
- F22 : Filtrage analytics par saison
- F23 : Table HistoriqueNutritionnel (NICE-TO-HAVE)

**Dépendances :** Phase 1, 2, 3 terminées. F18 dépend de `getAlertesRation` de Phase 2.

---

### 4.1 — Rapport PDF consommation par période (F16)

**Fichier à créer :** `src/app/api/export/aliments/route.ts`

```typescript
// GET /api/export/aliments?vagueId=...&debut=...&fin=...
// Retourne un JSON structuré pour génération PDF (pattern existant : voir src/app/api/export/)
// Structure de la réponse :
interface RapportConsommationAliment {
  vague: { id: string; code: string; dateDebut: Date; dateFin: Date | null };
  site: { name: string };
  periode: { debut: Date; fin: Date };
  semaines: {
    semaine: string;           // "Semaine 1 (01/01 – 07/01)"
    phase: string;             // Phase détectée
    alimentNom: string;        // Produit principal
    tailleGranule: string | null;
    quantite: number;          // kg distribués
    cout: number;              // CFA
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

**Fichier à créer :** `src/components/analytics/rapport-consommation-button.tsx`

Bouton "use client" qui appelle `POST /api/export/aliments` puis génère le PDF via la librairie d'export existante.

---

### 4.2 — Alerte sous/sur-alimentation UI (F18)

**Fichier :** `src/app/analytics/aliments/page.tsx`

Appeler `getAlertesRation(siteId)` et afficher les alertes :

```tsx
const alertes = await getAlertesRation(session.activeSiteId);

{alertes.length > 0 && (
  <div className="flex flex-col gap-2">
    <h2 className="text-sm font-semibold">Alertes ration</h2>
    {alertes.map((alerte) => (
      <AlerteRationCard key={alerte.vagueId} alerte={alerte} />
    ))}
  </div>
)}
```

**Fichier à créer :** `src/components/analytics/alerte-ration-card.tsx`

```typescript
// Carte d'alerte mobile-first affichant :
// - Icône selon type (sous vs sur)
// - Vague concernée
// - Écart moyen et nombre de relevés
// - Bouton "Voir les relevés" → lien vers /vagues/[vagueId]/releves
```

---

### 4.3 — Courbe de croissance vs référentiel (F19)

**Fichier :** `src/types/calculs.ts`

Ajouter l'interface pour la courbe de référence :

```typescript
/**
 * Point de la courbe de croissance théorique Clarias en conditions optimales.
 * Référentiel : 25°C, FCR 1.5, aliment 35% protéines.
 */
export interface CourbeCroissanceReference {
  /** Jour depuis mise en charge (J0 = poids initial) */
  jour: number;
  /** Poids théorique en conditions optimales (grammes) */
  poidsOptimal: number;
  /** Poids théorique en conditions bonnes (grammes) */
  poidsBon: number;
  /** Poids théorique en conditions acceptables (grammes) */
  poidsAcceptable: number;
}
```

**Fichier :** `src/lib/calculs.ts`

Ajouter :

```typescript
/**
 * Génère la courbe de croissance théorique pour Clarias en conditions optimales.
 *
 * Utilise un SGR différencié par phase :
 *   J0-J30  : SGR 4.0%/j (acclimatation/alevinage intensif)
 *   J30-J90 : SGR 3.0%/j (grossissement début)
 *   J90-J180: SGR 2.5%/j (grossissement moyen)
 *   J180+   : SGR 2.0%/j (finition)
 *
 * @param poidsInitial - Poids moyen initial en grammes
 * @param nombreJours - Durée de la projection en jours
 * @returns Tableau de points par semaine
 */
export function genererCourbeCroissanceReference(
  poidsInitial: number,
  nombreJours: number
): CourbeCroissanceReference[]
```

**Composant :** `src/components/analytics/courbe-croissance-reference.tsx`

Graphique Recharts ComposedChart avec :
- Line courbe réelle (depuis biométries)
- Line courbe optimale (gris clair)
- Area entre optimal et acceptable (fond vert très transparent)
- Annotations sur les décrochages (point réel < courbe acceptable)

---

### 4.4 — Score fournisseur agrégé (F20)

**Fichier :** `src/lib/queries/analytics.ts`

Ajouter :

```typescript
/**
 * Agrège les scores de tous les aliments d'un fournisseur.
 *
 * @param siteId - ID du site
 * @returns Liste des fournisseurs avec leur score moyen et nombre d'aliments
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

Intégrer dans `src/app/analytics/aliments/page.tsx` en section distincte "Performance par fournisseur".

---

### 4.5 — Filtre par saison (F22)

**Fichier :** `src/lib/queries/analytics.ts`

Ajouter un helper :

```typescript
/**
 * Détermine la saison camerounaise d'une date.
 *
 * Saison sèche : novembre–mars (eau plus froide, FCR dégradé)
 * Saison des pluies : avril–octobre (températures optimales)
 *
 * @param date - Date à classifier
 * @returns "SECHE" | "PLUIES"
 */
export function getSaisonCameroun(date: Date): "SECHE" | "PLUIES" {
  const mois = date.getMonth() + 1; // 1-12
  return mois >= 4 && mois <= 10 ? "PLUIES" : "SECHE";
}
```

Ajouter `saison?: "SECHE" | "PLUIES"` dans `FiltresAnalyticsAliments`. Filtrer les `ReleveConsommation` par date de relevé correspondant à la saison.

---

### 4.6 — Table HistoriqueNutritionnel (F23) — NICE-TO-HAVE

**Priorité :** Basse — implémenter seulement si les phases 1–3 sont complètement stables.

**Fichier :** `prisma/schema.prisma`

Modèle à ajouter si besoin :

```prisma
/**
 * HistoriqueNutritionnel — capture du profil nutritionnel estimé par phase.
 * Calculé automatiquement depuis les ReleveConsommation et Produit.tauxProteines.
 * Permet le calcul PER cumulatif et le benchmarking inter-cycles.
 */
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

  @@index([vagueId])
  @@index([siteId])
}
```

**Note R8 :** Le modèle inclut `siteId` obligatoirement.

---

## Récapitulatif des fichiers modifiés par phase

### Phase 1 — 9 fichiers modifiés, 1 fichier créé

| Fichier | Type de modification |
|---------|---------------------|
| `prisma/schema.prisma` | +3 enums, +9 champs Produit, +2 champs Releve |
| `prisma/migrations/20260328000001_add_feed_analytics_fields/migration.sql` | NOUVEAU |
| `src/types/models.ts` | +3 enums, +9 champs interface Produit, +2 champs interface Releve |
| `src/types/index.ts` | +3 exports enums |
| `src/types/api.ts` | +9 champs CreateProduitDTO/UpdateProduitDTO, +2 champs CreateReleveAlimentationDTO, +3 champs ProduitFilters |
| `src/lib/queries/produits.ts` | +9 champs dans createProduit/updateProduit |
| `src/app/api/produits/route.ts` | +9 champs dans handler POST |
| `src/app/api/produits/[id]/route.ts` | +9 champs dans handler PATCH |
| `prisma/seed.sql` | Enrichissement 3 aliments existants + 1 nouvel aliment |

### Phase 2 — 4 fichiers modifiés, 0 fichier créé

| Fichier | Type de modification |
|---------|---------------------|
| `src/lib/calculs.ts` | +5 fonctions : calculerADG, calculerPER, calculerDFR, calculerEcartRation, calculerScoreAliment |
| `src/lib/benchmarks.ts` | +4 constantes benchmark, +2 fonctions getBenchmark* |
| `src/types/calculs.ts` | +10 champs AnalytiqueAliment, +4 nouvelles interfaces |
| `src/lib/queries/analytics.ts` | Enrichissement computeAlimentMetrics + 2 nouvelles fonctions |

### Phase 3 — 6 fichiers modifiés, 4 fichiers créés

| Fichier | Type de modification |
|---------|---------------------|
| `src/app/analytics/aliments/page.tsx` | Ajout searchParams filtres |
| `src/components/analytics/feed-filters.tsx` | NOUVEAU — barre de filtres |
| `src/components/analytics/feed-comparison-cards.tsx` | +taille granulé, +score, +avertissement |
| `src/components/analytics/feed-fcr-weekly-chart.tsx` | NOUVEAU — graphique FCR hebdomadaire |
| `src/components/analytics/feed-mortality-correlation.tsx` | NOUVEAU — corrélation mortalité |
| `src/components/analytics/alerte-ration-card.tsx` | NOUVEAU — carte alerte ration |
| `src/components/releves/releve-form-client.tsx` | +tauxRefus RadioGroup, +comportementAlim RadioGroup |
| `src/components/stock/produit-form.tsx` | +section champs aliment |
| `src/lib/queries/produits.ts` | +getProduitsEnAlerteDLC |

### Phase 4 — 4 fichiers modifiés, 3 fichiers créés

| Fichier | Type de modification |
|---------|---------------------|
| `src/app/analytics/aliments/page.tsx` | +alertes ration, +scores fournisseur, +filtre saison |
| `src/app/api/export/aliments/route.ts` | NOUVEAU |
| `src/components/analytics/rapport-consommation-button.tsx` | NOUVEAU |
| `src/components/analytics/courbe-croissance-reference.tsx` | NOUVEAU |
| `src/lib/calculs.ts` | +genererCourbeCroissanceReference |
| `src/types/calculs.ts` | +CourbeCroissanceReference |
| `src/lib/queries/analytics.ts` | +getScoresFournisseurs, +getSaisonCameroun, filtre saison |

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
| F16 | Rapport PDF consommation | 4 | 33 |
| F17 | Détection changement granulé | 2+3 | 31–32 |
| F18 | Alerte sous/sur-alimentation | 2+4 | 31+33 |
| F19 | Courbe vs référentiel théorique | 4 | 33 |
| F20 | Score fournisseur agrégé | 4 | 33 |
| F21 | Suivi DLC et alertes péremption | 3 | 32 |
| F22 | Filtre analytiques par saison | 4 | 33 |
| F23 | Table HistoriqueNutritionnel | 4 | 34 (NICE) |
| F24 | Calcul DFR | 2 | 31 |

---

## Contraintes et règles à respecter (R1–R9)

| Règle | Application dans ce plan |
|-------|-------------------------|
| R1 | Toutes les valeurs d'enum UPPERCASE : P0, P1, C1... G5 / FLOTTANT / NORMAL / etc. |
| R2 | Importer `TailleGranule, FormeAliment, ComportementAlimentaire` depuis `@/types` — jamais en string littéral |
| R3 | Les champs Prisma (`tailleGranule TailleGranule?`) et TypeScript (`tailleGranule: TailleGranule | null`) sont strictement alignés |
| R4 | Les mises à jour Produit et Releve utilisent des opérations atomiques Prisma |
| R5 | Les Select Radix dans les filtres utilisent `asChild` correctement |
| R6 | Les couleurs du score badge utilisent `var(--accent-green)` etc. via les classes Tailwind définies |
| R7 | Tous les nouveaux champs ont leur nullabilité explicite : nullable sur Produit, nullable sur Releve |
| R8 | `HistoriqueNutritionnel` (F23) DOIT avoir `siteId String NOT NULL` |
| R9 | Avant chaque review : `npx vitest run` + `npm run build` |

---

## Dépendances entre features

```
F1 ─────────────────────────────────────────────────────────── F2, F3, F4, F10 (taille visible)
F6 (tauxProteines) ─────────────────────────────────────────── F13 (PER calcul)
F6 + F13 ───────────────────────────────────────────────────── F11 (score partiel avec PER)
F7 (tauxRefus) + F8 (comportement) ────────────────────────── F18 (alerte ration qualitative)
F9 (ADG) + F13 (PER) + F11 (score) ────────────────────────── F20 (score fournisseur agrégé)
Phase 2 complète ───────────────────────────────────────────── F14 (graphique FCR hebdo)
F14 ────────────────────────────────────────────────────────── F17 (annotations changement)
F14 + F15 ──────────────────────────────────────────────────── F19 (courbe vs référentiel)
Phase 3 complète ───────────────────────────────────────────── F16, F18, F22
```

---

## Notes de compatibilité ascendante

1. Tous les nouveaux champs sur `Produit` et `Releve` sont nullable — les données existantes ne sont pas affectées.
2. `phasesCibles PhaseElevage[]` aura `DEFAULT '{}'` en SQL — les produits existants ont un tableau vide, ce qui est cohérent (aucune restriction de phase imposée).
3. Les fonctions `getComparaisonAliments` et `getDetailAliment` existantes retournent maintenant des champs enrichis — les composants UI qui les consomment doivent être testés pour ne pas casser l'affichage si `tailleGranule == null` (cas des données pré-migration).
4. L'interface `AnalytiqueAliment` étendue est rétrocompatible — les nouveaux champs ont tous `null` comme valeur par défaut pour les anciens aliments.
