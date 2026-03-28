# ADJUSTMENTS — Feed Analytics Stories (FA–FD)

**Date :** 2026-03-28
**Auteur :** @architect
**Basé sur :** Exploration complète du codebase (src/app/, src/components/, src/types/, src/lib/, prisma/)
**Référence PLAN :** `docs/decisions/PLAN-feed-analytics-v2.md`

---

## Méthodologie

Chaque fichier référencé dans les stories FA–FD a été confronté à la réalité du codebase.
Les conflits, chemins incorrects et hypothèses erronées sont listés ci-dessous avec la correction exacte.

---

## Résumé des ajustements

| # | Story | Problème | Correction |
|---|-------|----------|------------|
| ADJ-01 | FA.2, FB.4, FC.* | Chemins pages dans PLAN v2 incorrects | Voir section 1 |
| ADJ-02 | FC.5 | `produit-form.tsx` inexistant | Voir section 2 |
| ADJ-03 | FA.2 | `Produit` interface sans nouveaux champs | Voir section 3 |
| ADJ-04 | FA.2 | `Releve` interface sans `tauxRefus`/`comportementAlim` | Voir section 4 |
| ADJ-05 | FA.2 | `MouvementStock` interface sans `datePeremption`/`lotFabrication` | Voir section 5 |
| ADJ-06 | FA.2 | `ConfigElevage` sans `scoreAlimentConfig` | Voir section 6 |
| ADJ-07 | FB.5 | `computeAlimentMetrics` est privé | Voir section 7 |
| ADJ-08 | FC.1, FD.* | Pas de `src/messages/en/analytics.json` | Voir section 8 |
| ADJ-09 | FA.3, FC.6 | Route relevés POST : chemin et structure existants | Voir section 9 |
| ADJ-10 | FA.3 | Route mouvements POST : chemin existant | Voir section 10 |
| ADJ-11 | FC.2 | Page liste aliments : composant page existe déjà | Voir section 11 |
| ADJ-12 | FD.3 | `getSaison` : pas de `src/lib/queries/saisons.ts` | Voir section 12 |

---

## Section 1 — Chemins de pages incorrects dans PLAN v2

### Problème

Le fichier `PLAN-feed-analytics-v2.md` référence plusieurs fois `src/app/analytics/aliments/page.tsx`
(sans groupe de route), notamment dans les sections 3.2, 4.2 et dans le tableau récapitulatif final.

### Réalité du codebase

Il existe **deux niveaux** de pages analytics aliments :

| Chemin réel | Rôle |
|-------------|------|
| `src/app/(farm)/analytics/aliments/page.tsx` | Page liste aliments (route group `/(farm)/`) — stub 1 ligne |
| `src/components/pages/analytics-aliments-page.tsx` | Implémentation réelle de la page liste |
| `src/app/analytics/aliments/[produitId]/page.tsx` | Page détail aliment (HORS route group) |
| `src/app/analytics/aliments/simulation/page.tsx` | Page simulateur (HORS route group) |

Le pattern utilisé depuis le Sprint IE est :
- Les pages sous `/(farm)/` sont des stubs `export { default } from "@/components/pages/xxx-page"`.
- L'implémentation réelle est dans `src/components/pages/`.
- Les pages de détail (`[produitId]`, `simulation`) sont encore HORS route group — elles devront
  éventuellement être déplacées dans `/(farm)/` lors du Sprint IE, mais ce n'est pas requis pour FA–FD.

### Correction pour les stories

**Story FC.2 (FeedFilters)** et **Story FC.8 (FC.7 FCR hebdomadaire)** — tout composant ajouté à la page liste doit être intégré dans `src/components/pages/analytics-aliments-page.tsx`, PAS dans `src/app/analytics/aliments/page.tsx` directement.

**Story FD.1 (Alerte ration UI)** et **Story FD.2 (Score fournisseur)** — même règle : modifier `src/components/pages/analytics-aliments-page.tsx`.

**PLAN v2 Sections 3.2 et 4.2** — remplacer mentalement `src/app/analytics/aliments/page.tsx` par `src/components/pages/analytics-aliments-page.tsx`.

---

## Section 2 — `produit-form.tsx` n'existe pas

### Problème

Story FC.5 et le PLAN v2 section 3.5 référencent :
```
src/components/stock/produit-form.tsx
```

### Réalité du codebase

Ce fichier n'existe pas. La création de produit est un Dialog inline dans :
```
src/components/stock/produits-list-client.tsx
```
avec tout l'état de formulaire géré localement (lignes 53–252 environ).

La modification de produit est dans :
```
src/components/stock/produit-detail-client.tsx
```
aussi avec state inline.

### Correction pour Story FC.5

L'agent @developer doit ajouter la section conditionnelle `ALIMENT` (Select taille/forme, inputs 0–100, multi-select phases) **directement dans `src/components/stock/produits-list-client.tsx`** (formulaire création) et dans **`src/components/stock/produit-detail-client.tsx`** (formulaire modification).

Il n'y a pas de fichier `produit-form.tsx` à créer ni à modifier.

---

## Section 3 — Interface `Produit` sans champs analytiques

### Problème

FA.2 doit enrichir l'interface TypeScript `Produit`. Actuellement dans `src/types/models.ts`, l'interface `Produit` ne contient pas les 6 champs prévus par PLAN v2 :

```typescript
// MANQUANT dans src/types/models.ts → interface Produit
tailleGranule: TailleGranule | null;    // après FA.1 migration
formeAliment: FormeAliment | null;
tauxProteines: number | null;
tauxLipides: number | null;
tauxFibres: number | null;
phasesCibles: PhaseElevage[];
```

### Correction pour Story FA.2

Ajouter ces 6 champs à l'interface `Produit` dans `src/types/models.ts`, après le champ `isActive` et avant `siteId`. Tous nullable sauf `phasesCibles` (tableau vide par défaut).

Les enums `TailleGranule` et `FormeAliment` doivent être définis dans `src/types/models.ts` (section enums, avant les modèles) et exportés depuis `src/types/index.ts`.

L'enum `ComportementAlimentaire` est également à définir dans `src/types/models.ts`.

---

## Section 4 — Interface `Releve` sans champs alimentation avancés

### Problème

FA.2 doit enrichir l'interface TypeScript `Releve`. Actuellement, l'interface `Releve` dans `src/types/models.ts` ne contient pas :

```typescript
// MANQUANT dans src/types/models.ts → interface Releve
tauxRefus: number | null;                          // valeurs : 0, 10, 25, 50
comportementAlim: ComportementAlimentaire | null;  // enum
```

Ces champs sont présents dans le schéma Prisma après migration FA.1.

### Correction pour Story FA.2

Ajouter ces 2 champs dans la section `// --- Champs alimentation ---` de l'interface `Releve` dans `src/types/models.ts`. Bien documenter : `tauxRefus` et `comportementAlim` ne sont valides que si `typeReleve === ALIMENTATION`.

---

## Section 5 — Interface `MouvementStock` sans champs traçabilité lot

### Problème

FA.2 doit enrichir `MouvementStock`. L'interface actuelle dans `src/types/models.ts` ne contient pas :

```typescript
// MANQUANT dans src/types/models.ts → interface MouvementStock
datePeremption: Date | null;   // DLC du lot reçu — ENTREE only
lotFabrication: string | null; // Numéro de lot fabricant — ENTREE only
```

Note : le champ `releveId` est présent dans le schéma Prisma (FK nullable vers Releve) mais également absent de l'interface TypeScript actuelle. FA.2 devrait aussi l'ajouter pour être en conformité R3.

### Correction pour Story FA.2

Ajouter dans l'interface `MouvementStock` :
```typescript
/** ID du relevé source (null si non lié à un relevé) */
releveId: string | null;
/** Date de péremption du lot reçu — pertinent uniquement pour ENTREE/ALIMENT */
datePeremption: Date | null;
/** Numéro de lot fabricant — traçabilité */
lotFabrication: string | null;
```

---

## Section 6 — `ConfigElevage` sans `scoreAlimentConfig`

### Problème

FA.1 doit ajouter `scoreAlimentConfig Json?` sur le modèle Prisma `ConfigElevage`. FA.2 doit le refléter dans l'interface TypeScript `ConfigElevage`.

### Réalité

Ni le schéma Prisma (`prisma/schema.prisma` modèle `ConfigElevage`) ni l'interface TypeScript (`src/types/models.ts` interface `ConfigElevage`) ne contiennent ce champ.

### Correction

**Story FA.1** : ajouter `scoreAlimentConfig Json?` dans `model ConfigElevage` de `prisma/schema.prisma`, dans la section `// ── Alimentation : ration par phase ──` après `alimentTauxConfig`.

**Story FA.2** : ajouter dans l'interface `ConfigElevage` de `src/types/models.ts` :
```typescript
/** Seuils configurables pour le score qualité aliment — null = seuils par défaut */
scoreAlimentConfig: ScoreAlimentConfig | null;
```
L'interface `ScoreAlimentConfig` est définie dans `src/types/calculs.ts` (Story FB.4).

Attention à l'ordre des stories : `ConfigElevage.scoreAlimentConfig` dans models.ts référence `ScoreAlimentConfig` définie dans calculs.ts — FB.4 doit être livré **avant** que FA.2 soit finalisé sur ce point, ou bien utiliser `unknown` comme type intermédiaire et remplacer après FB.4.

**Recommandation** : typer `scoreAlimentConfig` comme `Record<string, unknown> | null` dans FA.2, puis remplacer par `ScoreAlimentConfig | null` dans FB.4.

---

## Section 7 — `computeAlimentMetrics` est une fonction privée

### Problème

Le PLAN v2 section 2.5 dit "Enrichir `computeAlimentMetrics`". Cette fonction existe dans `src/lib/queries/analytics.ts` mais elle est **privée** (non exportée, déclarée `async function computeAlimentMetrics(...)`).

### Réalité

`computeAlimentMetrics` prend en paramètre un objet `produit` avec les champs du SELECT Prisma. Pour y ajouter les nouveaux champs (`tailleGranule`, `formeAliment`, etc.), l'agent @developer doit modifier :
1. Le SELECT Prisma dans la fonction privée `computeAlimentMetrics`
2. La signature de l'objet produit passé en paramètre (type local inline)
3. Le retour `AnalytiqueAliment` (qui sera enrichi dans FB.4)

Il n'y a pas d'export à modifier. L'enrichissement se fait entièrement à l'intérieur du fichier `src/lib/queries/analytics.ts`.

---

## Section 8 — Pas de fichier `src/messages/en/analytics.json`

### Problème

Le PLAN v2 dans le tableau récapitulatif (section "Fichiers touchés Phase 3") liste `src/messages/en/analytics.json` à modifier.

### Réalité

Le dossier `src/messages/` ne contient qu'un sous-dossier `fr/` :
```
src/messages/fr/analytics.json   ← EXISTS
src/messages/fr/stock.json       ← EXISTS
src/messages/fr/releves.json     ← EXISTS
```
Il n'y a pas de dossier `en/`. Le projet est mono-langue (français) pour le moment.

### Correction pour Story FC.1

Modifier uniquement `src/messages/fr/analytics.json` et `src/messages/fr/stock.json` et `src/messages/fr/releves.json`. Ne pas créer de fichiers `en/`.

---

## Section 9 — Routes relevés POST : structure actuelle

### Réalité actuelle

**Route :** `POST /api/releves` dans `src/app/api/releves/route.ts`

La route POST valide déjà `typeReleve` via `Object.values(TypeReleve).includes(...)`. Les nouveaux champs `tauxRefus` et `comportementAlim` doivent être intégrés dans cette route existante.

**Formulaire :** `src/components/releves/releve-form-client.tsx` — composite de sous-formulaires. Le sous-formulaire alimentation est dans `src/components/releves/form-alimentation.tsx`.

### Correction pour Story FA.3

Dans `src/app/api/releves/route.ts` (POST), ajouter :
1. Validation `tauxRefus` : si présent et `typeReleve !== ALIMENTATION` → HTTP 400
2. Validation `tauxRefus` valeur : doit être dans `{0, 10, 25, 50}` (liste blanche)
3. Validation `comportementAlim` : si présent et `typeReleve !== ALIMENTATION` → HTTP 400
4. Validation `comportementAlim` valeur : doit être une valeur de `ComportementAlimentaire`

Dans `src/app/api/releves/[id]/route.ts` (PUT/PATCH), mêmes validations.

### Correction pour Story FC.6

Les champs RadioGroup `tauxRefus` et `comportementAlim` doivent être ajoutés dans **`src/components/releves/form-alimentation.tsx`** (qui reçoit `values`, `onChange`, `errors` du formulaire parent). Mettre à jour l'interface `FormAlimentationProps` pour inclure ces deux valeurs.

Dans `releve-form-client.tsx`, les valeurs `tauxRefus` et `comportementAlim` sont gérées via le `fields` Record existant — pas de state supplémentaire nécessaire.

---

## Section 10 — Route mouvements POST : chemin exact

### Réalité actuelle

**Route :** `POST /api/stock/mouvements` dans `src/app/api/stock/mouvements/route.ts`

(Pas `/api/mouvements/` — le préfixe `/stock/` est requis.)

La validation actuelle ne connaît pas `datePeremption` ni `lotFabrication`.

### Correction pour Story FA.3

Dans `src/app/api/stock/mouvements/route.ts` (POST), ajouter :
- Acceptation optionnelle de `datePeremption` (string ISO 8601 → `new Date()`) si `type === ENTREE`
- Acceptation optionnelle de `lotFabrication` (string) si `type === ENTREE`
- Passer ces champs à `createMouvement()` dans `src/lib/queries/mouvements.ts`

Mettre à jour `CreateMouvementDTO` dans `src/types/api.ts` pour inclure `datePeremption?: string` et `lotFabrication?: string`.

---

## Section 11 — Page liste aliments et le pattern "pages" déjà appliqué

### Réalité

`src/app/(farm)/analytics/aliments/page.tsx` est déjà un stub d'une ligne :
```ts
export { default } from "@/components/pages/analytics-aliments-page";
```

`src/components/pages/analytics-aliments-page.tsx` contient toute l'implémentation (Server Component, auth, query, rendu).

### Implication pour FC.2 (FeedFilters)

Le composant `FeedFilters` doit être importé et utilisé dans `src/components/pages/analytics-aliments-page.tsx`. La page reçoit les `searchParams` via les paramètres du Server Component — pas via le stub.

Pour que `analytics-aliments-page.tsx` puisse lire les `searchParams`, il faut lui passer les params depuis le stub. Mettre à jour le stub :

```tsx
// src/app/(farm)/analytics/aliments/page.tsx
import AnalyticsAlimentsPage from "@/components/pages/analytics-aliments-page";

export default function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <AnalyticsAlimentsPage searchParams={searchParams} />;
}
```

Et ajouter la prop `searchParams` au composant `analytics-aliments-page.tsx`.

---

## Section 12 — `getSaison` et l'absence de fichier queries/saisons.ts

### Problème

Story FD.3 référence `getSaison(date, pays?)` à créer. Le PLAN ne précise pas le fichier cible.

### Recommandation

`getSaison(date, pays?)` est une **fonction pure** (pas de DB). Elle appartient à `src/lib/calculs.ts` (côté des fonctions utilitaires configurables), pas à un fichier queries.

Ajouter `getSaison` dans `src/lib/calculs.ts`, après `convertirUniteStock`. Exporter depuis `src/lib/calculs.ts` directement.

---

## Fichiers affectés — Vue synthétique

### Sprint FA (schéma + types)

| Fichier | Action |
|---------|--------|
| `prisma/schema.prisma` | +3 enums, +6 champs Produit, +2 champs Releve, +2 champs MouvementStock, +1 champ ConfigElevage |
| `src/types/models.ts` | +3 enums exports, enrichir interfaces Produit/Releve/MouvementStock/ConfigElevage |
| `src/types/api.ts` | Enrichir CreateProduitDTO, UpdateProduitDTO, CreateReleveDTO, CreateMouvementDTO |
| `src/types/index.ts` | Exports des 3 nouveaux enums |
| `src/app/api/produits/route.ts` (POST) | +validation tailleGranule/formeAliment/tauxProteines etc. |
| `src/app/api/produits/[id]/route.ts` (PUT) | +validation mêmes champs |
| `src/app/api/releves/route.ts` (POST) | +validation tauxRefus (liste blanche), +guard non-ALIMENTATION |
| `src/app/api/releves/[id]/route.ts` (PUT) | +mêmes validations |
| `src/app/api/stock/mouvements/route.ts` (POST) | +datePeremption, +lotFabrication |
| `prisma/seed.sql` | UPDATE aliments avec `AND categorie='ALIMENT'`, INSERT rel ALIMENTATION avec tauxRefus |

### Sprint FB (calculs + queries)

| Fichier | Action |
|---------|--------|
| `src/lib/calculs.ts` | +calculerADG, +calculerPER, +calculerDFR, +calculerEcartRation, +calculerScoreAliment |
| `src/lib/benchmarks.ts` | +getBenchmarkFCRPourPhase, +getBenchmarkADGPourPoids, +constantes benchmark par phase |
| `src/types/calculs.ts` | Enrichir AnalytiqueAliment, DetailAlimentVague + 5 nouveaux types |
| `src/lib/queries/analytics.ts` | Enrichir SELECT interne de computeAlimentMetrics, +getFCRHebdomadaire, +getAlertesRation |

### Sprint FC (UI)

| Fichier | Action |
|---------|--------|
| `src/messages/fr/analytics.json` | +TailleGranule, +FormeAliment, +ComportementAlimentaire, +score, +filtres, +alertes, +DLC |
| `src/messages/fr/stock.json` | +champs tailleGranule/formeAliment dans produits.fields |
| `src/messages/fr/releves.json` | +tauxRefus, +comportementAlim |
| `src/components/analytics/feed-comparison-cards.tsx` | +badge taille granulé, +ScoreBadge, +avertissement comparaison |
| `src/components/analytics/` | NOUVEAU : feed-filters.tsx, alerte-dlc.tsx |
| `src/components/analytics/feed-detail-charts.tsx` | +graphique FCR hebdomadaire ComposedChart |
| `src/components/pages/analytics-aliments-page.tsx` | +FeedFilters, +avertissement, +AlerteDLC |
| `src/app/(farm)/analytics/aliments/page.tsx` (stub) | Mettre à jour pour passer searchParams |
| `src/components/releves/form-alimentation.tsx` | +RadioGroup tauxRefus, +Select comportementAlim |
| `src/components/stock/produits-list-client.tsx` | +section ALIMENT conditionnelle dans le Dialog création |
| `src/components/stock/produit-detail-client.tsx` | +section ALIMENT conditionnelle dans le Dialog modification |

### Sprint FD (fonctionnalités avancées)

| Fichier | Action |
|---------|--------|
| `src/components/analytics/` | NOUVEAU : alerte-ration-card.tsx |
| `src/components/pages/analytics-aliments-page.tsx` | +AlerteRationCard, +ScoresFournisseurs, +filtre saison |
| `src/lib/calculs.ts` | +getSaison(date, pays?) |
| `src/lib/queries/analytics.ts` | +getScoresFournisseurs |
| `docs/decisions/ADR-rapport-pdf-consommation.md` | NOUVEAU (Story FD.4) |
| `docs/decisions/ADR-courbe-croissance-reference.md` | NOUVEAU (Story FD.5) |

---

## Points de vigilance R1–R9

| Règle | Point de vigilance |
|-------|-------------------|
| R1 | Enums TailleGranule, FormeAliment, ComportementAlimentaire : toutes les valeurs UPPERCASE dans Prisma ET TypeScript |
| R2 | Importer les enums depuis `@/types` — jamais de strings hardcodés comme `"G3"` ou `"FLOTTANT"` |
| R3 | Les 3 interfaces (Produit, Releve, MouvementStock) doivent être des miroirs EXACTS du schéma Prisma après migration |
| R5 | FeedFilters : chaque Select utilise `<SelectTrigger>` avec Radix — pas de `<select>` natif |
| R6 | ScoreBadge et badges taille : couleurs via `var(--accent-green)`, `var(--accent-amber)`, `var(--danger)` — pas de hex hardcodés |
| R7 | `tauxRefus`: Float? nullable, `comportementAlim`: enum nullable, `datePeremption`: DateTime? nullable — tous explicitement nullable dès le schéma |
| R8 | Pas de nouveau modèle dans FA–FD sans siteId — `HistoriqueNutritionnel` (FD.6) doit avoir siteId |

---

*Document généré par @architect après exploration exhaustive du codebase le 2026-03-28.*
