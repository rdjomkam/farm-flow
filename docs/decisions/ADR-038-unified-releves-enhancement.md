# ADR-038 — Amélioration unifiée des relevés : pagination, filtres spécifiques, safe areas et UX paging

**Date :** 2026-04-06
**Statut :** PROPOSÉ
**Auteur :** @architect
**Domaine :** UI / UX / Performance / API
**Remplace :** ADR-035, ADR-037
**Dépend de :** ADR-034 (Architecture du Filtrage des Relevés)

---

## Vue d'ensemble

Cet ADR consolide trois chantiers complémentaires en un plan d'implémentation unifié :

| Partie | Sujet | Source |
|--------|-------|--------|
| **A** | Pagination des vues par vague (split `getVagueById`) | ADR-035 |
| **B** | Filtres spécifiques au type de relevé | ADR-037 |
| **C** | Correction des zones de sécurité iOS/Android (safe areas) | ADR-037 |
| **D** | Composant de pagination UX enrichi (nouveau) | — |

---

## Partie A — Pagination des vues par vague

### Contexte

`getVagueById()` charge tous les relevés d'une vague avec leurs relations complètes
(bac, consommations, modifications) sans limite. Sur une vague de 6 bacs pendant 6 mois
(2 relevés/jour/bac), cela représente ~2 160 relevés — soit ~500 KB de JSON Prisma
en mémoire serveur pour afficher 2 relevés en preview.

### Décisions A

#### A-D1 — Séparer `getVagueById()` en deux fonctions distinctes

**Décision :** Créer `getVagueByIdWithReleves()` séparée. La fonction `getVagueById()`
existante est modifiée pour ne plus inclure les relevés.

```typescript
// src/lib/queries/vagues.ts

/** Retourne la vague avec ses bacs — SANS les relevés */
export async function getVagueById(id: string, siteId: string) {
  return prisma.vague.findFirst({
    where: { id, siteId },
    include: {
      bacs: { orderBy: { nom: "asc" } },
    },
  });
}

/** Retourne la vague + relevés paginés + total */
export async function getVagueByIdWithReleves(
  id: string,
  siteId: string,
  pagination?: { limit: number; offset: number }
) {
  const limit = pagination?.limit ?? 20;
  const offset = pagination?.offset ?? 0;

  const [vague, releves, total] = await Promise.all([
    prisma.vague.findFirst({
      where: { id, siteId },
      include: { bacs: { orderBy: { nom: "asc" } } },
    }),
    prisma.releve.findMany({
      where: { vagueId: id, siteId },
      orderBy: { date: "desc" },
      take: limit,
      skip: offset,
      include: {
        bac: { select: { id: true, nom: true } },
        consommations: { include: { produit: true } },
        modifications: {
          orderBy: { createdAt: "desc" },
          take: 1,
          include: { user: { select: { id: true, name: true } } },
        },
      },
    }),
    prisma.releve.count({ where: { vagueId: id, siteId } }),
  ]);

  return vague ? { vague, releves, total } : null;
}
```

#### A-D2 — VagueDetailPage : deux queries légères au lieu d'une lourde

```typescript
// AVANT — 1 query lourde, tous les relevés
const vague = await getVagueById(id, siteId); // retournait vague + tous les relevés
const biometries = vague.releves.filter(...); // N relevés chargés pour un sous-ensemble

// APRÈS — 2 queries légères, données exactement nécessaires
const [vague, biometriesData, relevesPreview] = await Promise.all([
  getVagueById(id, siteId),           // sans relevés
  prisma.releve.findMany({            // biométries pour le graphique uniquement
    where: { vagueId: id, siteId, typeReleve: TypeReleve.BIOMETRIE },
    orderBy: { date: "asc" },
    select: { typeReleve: true, date: true, poidsMoyen: true, bacId: true },
  }),
  getReleves(siteId, { vagueId: id }, { limit: 3, offset: 0 }), // preview
]);
```

#### A-D3 — VagueRelevesPage : pagination URL (même pattern que `/releves`)

La page `/vagues/[id]/releves` lit `searchParams.offset`, appelle
`getVagueByIdWithReleves(id, siteId, { limit: 20, offset })` et affiche le
composant `RelevesGlobalList` (déjà créé par ADR-034) avec le nouveau
`PaginationFooter` (voir Partie D).

#### A-D4 — RelevesList en mode preview : inchangé

`RelevesList` (mode `limit=2`) dans `VagueDetailPage` n'est pas modifié. Seul
le mode "full" dans `VagueRelevesPage` est remplacé par un modèle paginé serveur.

#### A-D5 — Afficher le total DB dans le titre (pas `releves.length`)

Le titre `X relevés — code_vague` utilise `total` (retourné par la query paginée),
pas `releves.length` (qui vaudrait au plus 20).

### Interface TypeScript A

```typescript
// src/types/models.ts — ajouter
export interface VagueWithPaginatedReleves {
  vague: VagueWithBacs;
  releves: Releve[];
  total: number;
}
```

---

## Partie B — Filtres spécifiques au type de relevé

### Contexte

La page `/releves` (ADR-034) expose des filtres génériques. Quand un utilisateur
sélectionne `typeReleve=ALIMENTATION`, il ne peut pas affiner par type d'aliment
ou comportement alimentaire. Ces sous-filtres n'ont de sens que dans le contexte
du type sélectionné.

### Décisions B

#### B-D1 — Paramètres URL par type

Convention : camelCase, sans préfixe de type, suffixe `Min`/`Max` pour les plages.

| Type | Param URL | Valeurs |
|------|-----------|---------|
| **BIOMETRIE** | `poidsMoyenMin`, `poidsMoyenMax` | number |
| | `tailleMoyenneMin`, `tailleMoyenneMax` | number |
| **MORTALITE** | `causeMortalite` | CauseMortalite enum |
| | `nombreMortsMin`, `nombreMortsMax` | number |
| **ALIMENTATION** | `typeAliment` | TypeAliment enum |
| | `comportementAlim` | ComportementAlimentaire enum |
| | `frequenceAlimentMin`, `frequenceAlimentMax` | number |
| **QUALITE_EAU** | `temperatureMin`, `temperatureMax` | number |
| | `phMin`, `phMax` | number |
| **COMPTAGE** | `methodeComptage` | MethodeComptage enum |
| **OBSERVATION** | `descriptionSearch` | string (ILIKE) |
| **RENOUVELLEMENT** | `pourcentageMin`, `pourcentageMax` | number |

#### B-D2 — Extension de ReleveSearchParams et ParsedReleveFilters

```typescript
// src/lib/releve-search-params.ts — extension de ReleveSearchParams
export interface ReleveSearchParams {
  // Filtres existants
  vagueId?: string;
  bacId?: string;
  typeReleve?: string;
  dateFrom?: string;
  dateTo?: string;
  modifie?: string;
  offset?: string;

  // Filtres spécifiques BIOMETRIE
  poidsMoyenMin?: string;
  poidsMoyenMax?: string;
  tailleMoyenneMin?: string;
  tailleMoyenneMax?: string;

  // Filtres spécifiques MORTALITE
  causeMortalite?: string;
  nombreMortsMin?: string;
  nombreMortsMax?: string;

  // Filtres spécifiques ALIMENTATION
  typeAliment?: string;
  comportementAlim?: string;
  frequenceAlimentMin?: string;
  frequenceAlimentMax?: string;

  // Filtres spécifiques QUALITE_EAU
  temperatureMin?: string;
  temperatureMax?: string;
  phMin?: string;
  phMax?: string;

  // Filtres spécifiques COMPTAGE
  methodeComptage?: string;

  // Filtres spécifiques OBSERVATION
  descriptionSearch?: string;

  // Filtres spécifiques RENOUVELLEMENT
  pourcentageMin?: string;
  pourcentageMax?: string;
}

// Constante exportée — partagée entre filter-bar, filter-sheet, active-filters
export const ALL_FILTER_PARAMS = [
  "vagueId", "bacId", "typeReleve", "dateFrom", "dateTo", "modifie",
  "poidsMoyenMin", "poidsMoyenMax", "tailleMoyenneMin", "tailleMoyenneMax",
  "causeMortalite", "nombreMortsMin", "nombreMortsMax",
  "typeAliment", "comportementAlim", "frequenceAlimentMin", "frequenceAlimentMax",
  "temperatureMin", "temperatureMax", "phMin", "phMax",
  "methodeComptage",
  "descriptionSearch",
  "pourcentageMin", "pourcentageMax",
] as const;
```

**Règle de validation dans `parseReleveSearchParams` :**
- Params numériques : parsés via `parseFloat`/`parseInt`. `NaN` ou négatif → filtre ignoré.
- Params enum : validés via `Object.values(EnumType).includes(value)`. Valeur inconnue → ignorée silencieusement.
- Un filtre spécifique est inclus dans `ParsedReleveFilters` **seulement** si `typeReleve` est défini et correspond au bon type.

#### B-D3 — Extension de ReleveFilters et getReleves()

Voir ADR-037 D3 pour le détail du where builder Prisma (patterns `gte`/`lte` par champ,
`contains + mode: "insensitive"` pour `descriptionSearch`).

#### B-D4 — filtres tailleGranule / formeAliment : hors périmètre

La liaison `Releve → ReleveConsommation → Produit` nécessite une sous-requête corrélée.
Reporté en Phase 2 avec benchmark préalable.

#### B-D5 — Rendu conditionnel des filtres dans le Sheet

Le bloc `TypeSpecificFilters` n'apparaît que si `localType !== ALL_VALUE`. Au changement
de type, les états locaux des filtres spécifiques du type précédent sont réinitialisés.

```
RelevesFilterSheet
├── VagueSelect
├── BacSelect (dépend vagueId)
├── TypeSelect               ← handleTypeChange() réinitialise les filtres spécifiques
│
├── [si localType !== ALL_VALUE]
│   └── TypeSpecificFilters  ← section conditionnelle avec séparateur visuel
│       ├── [BIOMETRIE]   BiometrieFilters
│       ├── [MORTALITE]   MortaliteFilters
│       ├── [ALIMENTATION] AlimentationFilters
│       ├── [QUALITE_EAU] QualiteEauFilters
│       ├── [COMPTAGE]    ComptageFilters
│       ├── [OBSERVATION] ObservationFilters
│       └── [RENOUVELLEMENT] RenouvellementFilters
│
├── PeriodeInputs
├── ModifieCheckbox
└── [sticky footer] ActionButtons
```

#### B-D6 — countActiveFilters étendue

Chaque paire min/max compte pour 1 filtre (pas 2). Voir ADR-037 D7 pour le code complet.

#### B-D7 — Chips des filtres actifs

Labels : `Poids : 30–120 g`, `Poids ≥ 30 g`, `Cause : Maladie`, `Aliment : Commercial`,
`T° : 25–32°C`, `Recherche : "stress"`, etc. Suppression d'un chip de plage supprime
les deux params (`min` et `max`) en un seul clic.

---

## Partie C — Zones de sécurité iOS/Android (Safe Areas)

### Contexte

Le `Sheet` filtre relevés utilise `!inset-y-0 !left-auto !right-0` qui annule le
`pt-[env(safe-area-inset-top)]` du composant `sheet.tsx` de base. Sur iOS avec notch
ou indicateur home, le contenu empiète sur les zones système réservées.

### Décision C

**Approche :** Padding dans le contenu du Sheet (pas dans `SheetContent`), pour ne pas
impacter la sidebar et les autres usages partagés.

```tsx
{/* Structure du contenu du Sheet filtres */}
<div className="flex flex-col h-full">

  {/* Header fixe — safe area top */}
  <div className="shrink-0 flex items-center justify-between px-4
                  pt-[env(safe-area-inset-top)] pb-3 border-b border-border">
    <h2 className="text-base font-semibold">Filtres</h2>
    <button onClick={resetAllFilters}>Effacer</button>
  </div>

  {/* Corps scrollable */}
  <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
    {/* ... filtres ... */}
  </div>

  {/* Footer fixe — safe area bottom + safe area right (landscape) */}
  <div className="shrink-0 flex gap-2 px-4 pt-3
                  pb-[max(0.75rem,env(safe-area-inset-bottom))]
                  pr-[max(1rem,env(safe-area-inset-right))]
                  border-t border-border">
    <button className="flex-1">Effacer</button>
    <button className="flex-1">Appliquer</button>
  </div>

</div>
```

**Pourquoi `max(0.75rem, env(safe-area-inset-bottom))` :** Sur un appareil sans gestes
système, `safe-area-inset-bottom` vaut 0. `max()` garantit un minimum de 12px de padding
bas en toutes circonstances.

**Note iPhone landscape :** `safe-area-inset-right` protège l'encoche latérale quand le
Sheet s'ouvre à droite. En usage portrait (principal), sa valeur est 0 — aucun impact.

---

## Partie D — Composant de pagination UX enrichi

### Contexte

Le `LoadMoreButton` actuel est fonctionnel mais minimaliste : un simple bouton
"`Charger N de plus (M restants)`" avec une icône `ChevronDown`. Il n'offre pas
de repère visuel sur la position dans la liste ni de sentiment de progression.

### Objectif UX

Transformer l'expérience de pagination en quelque chose d'**informatif mais sobre** :
- L'utilisateur sait immédiatement où il en est (`1–20 sur 87 relevés`)
- Une barre de progression subtile donne le sentiment de progresser dans la liste
- Le bouton indique précisément combien d'éléments supplémentaires seront chargés
- Le tout fonctionne parfaitement sur 360px, sans surcharge visuelle

### Décision D — Composant `PaginationFooter`

**Remplace** `LoadMoreButton` sur la page `/releves` et dans `VagueRelevesPage`.

#### Structure visuelle

```
┌─────────────────────────────────────────┐  ← 360px
│                                         │
│  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  │  ← barre de fond (bg-muted)
│  ████████████████░░░░░░░░░░░░░░░░░░░░░  │  ← remplissage (bg-primary/30)
│                                         │
│   Affichage 20 sur 87 relevés           │  ← texte informatif
│                                         │
│  ┌─────────────────────────────────┐    │
│  │  ↓  Charger 20 de plus          │    │  ← bouton principal
│  └─────────────────────────────────┘    │
│                                         │
└─────────────────────────────────────────┘
```

#### Variante : dernier chargement (restants < limit)

```
│  ████████████████████████████████░░░░░  │
│   Affichage 67 sur 87 relevés           │
│  ┌─────────────────────────────────┐    │
│  │  ↓  Charger les 20 derniers     │    │
│  └─────────────────────────────────┘    │
```

#### Variante : tout chargé (fin de liste)

```
│  ████████████████████████████████████  │  ← barre pleine
│   Tous les 87 relevés affichés ✓        │  ← message de complétion
│                                         │  ← pas de bouton
```

#### Interface du composant

```typescript
// src/components/releves/pagination-footer.tsx
// "use client"

interface PaginationFooterProps {
  /** Nombre d'éléments actuellement affichés */
  shown: number;
  /** Total d'éléments dans la DB (après filtres) */
  total: number;
  /** Nombre max d'éléments par page */
  limit: number;
  /** Offset courant */
  offset: number;
  /** Label singulier/pluriel pour le type d'élément (défaut: "relevé"/"relevés") */
  itemLabel?: { singular: string; plural: string };
  /** Callback optionnel au lieu de la navigation URL */
  onLoadMore?: () => void;
}
```

**Calculs internes :**
```typescript
const progress = Math.min(100, (shown / total) * 100);
const remaining = total - shown;
const nextBatch = Math.min(limit, remaining);
const isComplete = remaining <= 0;
const isLastBatch = remaining > 0 && remaining <= limit;
```

#### Implémentation de référence

```tsx
// src/components/releves/pagination-footer.tsx
"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { ChevronDown, CheckCircle } from "lucide-react";
import { RELEVES_PAGE_LIMIT } from "@/lib/releve-search-params";

interface PaginationFooterProps {
  shown: number;
  total: number;
  limit?: number;
  offset: number;
  itemLabel?: { singular: string; plural: string };
}

export function PaginationFooter({
  shown,
  total,
  limit = RELEVES_PAGE_LIMIT,
  offset,
  itemLabel = { singular: "relevé", plural: "relevés" },
}: PaginationFooterProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const remaining = total - shown;
  const nextBatch = Math.min(limit, remaining);
  const progress = total > 0 ? Math.min(100, (shown / total) * 100) : 100;
  const isComplete = remaining <= 0;
  const isLastBatch = remaining > 0 && remaining <= limit;

  const label = shown === 1 ? itemLabel.singular : itemLabel.plural;
  const totalLabel = total === 1 ? itemLabel.singular : itemLabel.plural;

  function handleLoadMore() {
    const params = new URLSearchParams(searchParams.toString());
    params.set("offset", String(offset + limit));
    startTransition(() => {
      router.push(`?${params.toString()}`);
    });
  }

  return (
    <div className="mt-4 flex flex-col gap-3">

      {/* Barre de progression */}
      <div className="flex flex-col gap-1.5">
        <div
          className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-valuenow={Math.round(progress)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${shown} sur ${total} ${totalLabel} chargés`}
        >
          <div
            className="h-full rounded-full bg-primary/40 transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Texte informatif */}
        <p className="text-xs text-muted-foreground text-center">
          {isComplete ? (
            <span className="flex items-center justify-center gap-1.5">
              <CheckCircle className="h-3.5 w-3.5 text-primary" />
              Tous les {total} {totalLabel} affichés
            </span>
          ) : (
            <>Affichage <span className="font-medium text-foreground">{shown}</span> sur <span className="font-medium text-foreground">{total}</span> {totalLabel}</>
          )}
        </p>
      </div>

      {/* Bouton "Charger plus" — masqué si tout est chargé */}
      {!isComplete && (
        <button
          type="button"
          onClick={handleLoadMore}
          disabled={isPending}
          className="
            w-full flex items-center justify-center gap-2
            rounded-lg border border-border
            py-3 px-4
            text-sm font-medium
            text-muted-foreground
            hover:bg-accent hover:text-foreground hover:border-primary/30
            active:scale-[0.98]
            transition-all duration-150
            disabled:opacity-50 disabled:cursor-not-allowed
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50
          "
        >
          {isPending ? (
            <>
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-muted-foreground border-t-primary" />
              Chargement…
            </>
          ) : (
            <>
              <ChevronDown className="h-4 w-4 shrink-0" />
              {isLastBatch
                ? `Charger les ${nextBatch} derniers`
                : `Charger ${nextBatch} de plus`}
            </>
          )}
        </button>
      )}

    </div>
  );
}
```

#### Comportement du spinner de chargement

Pendant la transition (`isPending = true`) :
- Le texte du bouton est remplacé par `[spinner] Chargement…`
- Le bouton est désactivé (`disabled`)
- Le curseur passe en `not-allowed`
- Le spinner est un cercle CSS (`border-t-primary`) — aucune dépendance externe

#### Décisions de style

| Choix | Rationale |
|-------|-----------|
| Barre `h-1.5` (6px) | Subtile, non intrusive. Assez visible pour être informative. |
| `bg-primary/40` | La couleur primary (teal) à 40% d'opacité — élégant, pas agressif. |
| `transition-all duration-500` | La barre s'anime à chaque nouveau chargement — feedback visuel doux. |
| `rounded-lg` sur le bouton | Plus doux que `rounded-md`, cohérent avec le design system mobile-first. |
| `active:scale-[0.98]` | Feedback tactile subtil au toucher — important sur mobile. |
| Texte `"les N derniers"` | Distingue le dernier chargement des chargements intermédiaires. |
| `CheckCircle` en fin de liste | Celebratoire mais discret — l'utilisateur sait qu'il a tout vu. |

#### Migration depuis LoadMoreButton

`LoadMoreButton` (`src/components/releves/load-more-button.tsx`) devient un re-export
de `PaginationFooter` avec les mêmes props pour compatibilité ascendante, ou est
supprimé si tous les appelants sont migrés.

```typescript
// Option A — re-export pour compatibilité
export { PaginationFooter as LoadMoreButton } from "./pagination-footer";

// Option B — migration directe dans RelevesGlobalList
// Remplacer <LoadMoreButton offset={offset} total={total} />
// par <PaginationFooter shown={offset + limit} total={total} limit={limit} offset={offset} />
```

L'option B est préférée car elle transmet `shown` correctement (l'offset représente le
début de la page courante, pas le nombre affiché).

---

## Ordre d'implémentation unifié

L'ordre suit la règle : modifications de données d'abord, puis UI, puis polish.

### Étape 1 — Types et interfaces (sans effet de bord)

| Fichier | Action |
|---------|--------|
| `src/types/models.ts` | Ajouter `VagueWithPaginatedReleves` |
| `src/lib/releve-search-params.ts` | Étendre `ReleveSearchParams`, `ParsedReleveFilters`, `countActiveFilters`, `parseReleveSearchParams`. Ajouter `ALL_FILTER_PARAMS`. |
| `src/types/api.ts` | Étendre `ReleveFilters` avec les nouveaux champs |

### Étape 2 — Queries (sans UI)

| Fichier | Action |
|---------|--------|
| `src/lib/queries/vagues.ts` | Modifier `getVagueById()` (supprimer l'include relevés) + ajouter `getVagueByIdWithReleves()` |
| `src/lib/queries/releves.ts` | Étendre le where builder dans `getReleves()` |

### Étape 3 — API routes

| Fichier | Action |
|---------|--------|
| `src/app/api/releves/route.ts` | Extraire et valider les nouveaux query params |

### Étape 4 — Composant PaginationFooter (nouveau, isolé)

| Fichier | Action |
|---------|--------|
| `src/components/releves/pagination-footer.tsx` | Créer le nouveau composant |

### Étape 5 — Pages Server Component

| Fichier | Action |
|---------|--------|
| `src/components/pages/vague-detail-page.tsx` | Refactorer : queries séparées biométries + preview |
| `src/components/pages/vague-releves-page.tsx` | Ajouter `searchParams`, utiliser `getVagueByIdWithReleves()`, `PaginationFooter` |

### Étape 6 — Composants liste

| Fichier | Action |
|---------|--------|
| `src/components/releves/releves-global-list.tsx` | Remplacer `<LoadMoreButton>` par `<PaginationFooter shown={offset + limit} ...>` |

### Étape 7 — Safe areas (Sheet filtre)

| Fichier | Action |
|---------|--------|
| `src/components/releves/releves-filter-bar.tsx` | Restructurer layout Sheet : flex-col h-full, header/footer sticky, padding safe-area |

### Étape 8 — Filtres spécifiques (Sheet + barre desktop)

| Fichier | Action |
|---------|--------|
| `src/components/releves/releves-filter-sheet.tsx` | Ajouter `TypeSpecificFilters` conditionnel + `RangeInputs` interne + `handleTypeChange` avec reset |
| `src/components/releves/releves-filter-bar.tsx` | `updateMultipleParams` avec `ALL_FILTER_PARAMS`, 2ème ligne filtres desktop |
| `src/components/releves/releves-active-filters.tsx` | Chips pour les filtres spécifiques |

### Étape 9 — Tests et non-régression

| Test | Portée |
|------|--------|
| `parseReleveSearchParams` avec les nouveaux params | Unitaire |
| `countActiveFilters` avec filtres spécifiques | Unitaire |
| `getVagueById` ne retourne plus de relevés | Unitaire |
| `getVagueByIdWithReleves` retourne le bon `total` | Unitaire |
| Page `/releves` avec filtres spécifiques | Intégration |
| `PaginationFooter` : rendu complet / dernier lot / tout chargé | Composant |
| Build production : `npm run build` | CI |

---

## Architecture des composants mise à jour

### Avant (état actuel)

```
RelevesGlobalList
└── LoadMoreButton        ← bouton simple sans contexte visuel

VagueDetailPage (Server Component)
├── getVagueById()        ← charge TOUS les relevés + consommations + modifications
├── RelevesList           ← reçoit vague.releves (N relevés)
└── Calcul Gompertz       ← filtre vague.releves pour biométries

VagueRelevesPage (Server Component)
├── getVagueById()        ← charge TOUS les relevés
└── RelevesList           ← mode full, pas de pagination
```

### Après (cible)

```
RelevesGlobalList
└── PaginationFooter      ← barre progression + texte "X sur Y" + bouton intelligent

VagueDetailPage (Server Component)
├── getVagueById()              ← vague + bacs uniquement
├── prisma.releve.findMany()    ← biométries (select restreint)
├── getReleves(vagueId, {limit: 3}) ← 3 derniers pour preview
└── RelevesList                 ← reçoit 3 relevés, mode limit=2 (inchangé)

VagueRelevesPage (Server Component)
├── lit searchParams.offset
├── getVagueByIdWithReleves(id, siteId, { limit: 20, offset })
└── RelevesGlobalList           ← réutilisé (avec PaginationFooter intégré)
```

---

## Surfaces exclues de la pagination (et pourquoi)

| Surface | Justification |
|---------|---------------|
| Queries analytiques (`analytics.ts`) | Calculent FCR, SGR, biomasse sur historique complet. Paginer introduirait des biais. |
| Export Excel (`/api/export/releves`) | Export intentionnel de tous les relevés d'une vague. |
| Alertes mortalité/qualité eau | Bornées temporellement (`date ≥ depuis24h`). Volume intrinsèquement limité. |
| Dashboard `getVaguesWithReleves` | Déjà optimisé : `select` restreint + vagues EN_COURS uniquement. |

---

## Impact sur les fichiers

| Fichier | Impact |
|---------|--------|
| `src/lib/queries/vagues.ts` | MODIFIÉ — `getVagueById` allégé + nouvelle `getVagueByIdWithReleves` |
| `src/lib/queries/releves.ts` | MODIFIÉ — where builder étendu |
| `src/lib/releve-search-params.ts` | MODIFIÉ — interfaces + constantes étendues |
| `src/types/models.ts` | MODIFIÉ — `VagueWithPaginatedReleves` ajouté |
| `src/types/api.ts` | MODIFIÉ — `ReleveFilters` étendu |
| `src/app/api/releves/route.ts` | MODIFIÉ — nouveaux params extraits |
| `src/components/releves/pagination-footer.tsx` | CRÉÉ — nouveau composant |
| `src/components/releves/load-more-button.tsx` | DÉPRÉCIÉ → migré vers PaginationFooter |
| `src/components/releves/releves-global-list.tsx` | MODIFIÉ — LoadMoreButton → PaginationFooter |
| `src/components/pages/vague-detail-page.tsx` | MODIFIÉ — queries séparées |
| `src/components/pages/vague-releves-page.tsx` | MODIFIÉ — pagination URL + PaginationFooter |
| `src/components/releves/releves-filter-bar.tsx` | MODIFIÉ — safe areas + 2ème ligne filtres desktop + ALL_FILTER_PARAMS |
| `src/components/releves/releves-filter-sheet.tsx` | MODIFIÉ — TypeSpecificFilters conditionnel + RangeInputs |
| `src/components/releves/releves-active-filters.tsx` | MODIFIÉ — chips filtres spécifiques |
| `src/lib/queries/dashboard.ts` | INCHANGÉ — déjà optimisé |
| `src/lib/queries/analytics.ts` | INCHANGÉ — chargement exhaustif justifié |
| `src/components/vagues/releves-list.tsx` | INCHANGÉ — mode preview non affecté |

---

## Règles Phase 2 respectées

| Règle | Application |
|-------|-------------|
| R1 — Enums MAJUSCULES | `TypeReleve.BIOMETRIE`, `CauseMortalite.MALADIE`, etc. |
| R2 — Importer les enums | `import { TypeReleve, CauseMortalite, ... } from "@/types"` |
| R3 — Prisma = TypeScript | `VagueWithPaginatedReleves` miroir du retour Prisma |
| R4 — Opérations atomiques | `Promise.all([vague, releves, total])` en parallèle |
| R5 — DialogTrigger asChild | Inchangé — Selects Radix déjà corrects |
| R6 — CSS variables | `bg-primary/40`, `border-primary/30` via variables du thème ; `env(safe-area-inset-bottom)` |
| R7 — Nullabilité explicite | `total: number` (required), `shown: number` (required) |
| R8 — siteId PARTOUT | `getVagueByIdWithReleves(id, siteId, ...)` — siteId obligatoire |
| R9 — Tests avant review | `npx vitest run` + `npm run build` avant PR |

---

## Alternatives rejetées (synthèse)

| Alternative | Raison du rejet |
|-------------|-----------------|
| Paginer `getVagueById()` in-place | Casserait tous les appelants qui attendent `vague.releves` |
| Paginer les queries analytiques | Introduirait des biais de calcul (FCR faux, SGR faux) |
| Infinite scroll React Query | Conflit avec Server Components, complexité cache |
| Pagination numérotée (Prev/Next) | Difficile à toucher sur 360px ; cohérence avec ADR-034 |
| Dialog séparé pour filtres avancés | Double couche modale sur mobile |
| Accordion Radix dans le Sheet | Interaction supplémentaire inutile sur 360px |
| Modifier `SheetContent` globalement | Casserait la sidebar et les autres usages partagés |
| Filtres tailleGranule / formeAliment | Sous-requête corrélée sans index — reporté Phase 2 |
| `PaginationFooter` avec pages numérotées | Incompatible avec le modèle "append" (Load more) — on accumule les relevés, on ne change pas de page |
