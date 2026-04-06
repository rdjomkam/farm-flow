# ADR-034 — Architecture du Filtrage des Relevés

**Date :** 2026-04-06
**Statut :** PROPOSÉ
**Auteur :** @architect
**Domaine :** UI / UX / API

---

## Contexte

### État actuel

La page `/vagues/[id]/releves` affiche tous les relevés d'une vague via des onglets
de type (client-side, `useState`). Ce filtrage est limité :

- **Périmètre** : uniquement les relevés d'une vague sélectionnée à l'avance
- **Dimensions** : uniquement le `typeReleve` (7 valeurs)
- **Persistance** : état local React, perdu au rechargement
- **Performance** : tous les relevés sont chargés en une fois, filtrés côté client
- **Navigation** : le lien `/releves` existe dans la nav (FarmBottomNav) mais il n'y a
  pas de `page.tsx` à `src/app/(farm)/releves/`. C'est un lien mort.

### Ce que le backend supporte déjà

Le backend est complet. L'API `GET /api/releves` accepte :

| Paramètre   | Type          | Exemple                   |
|-------------|---------------|---------------------------|
| `vagueId`   | string        | `?vagueId=cm_abc123`      |
| `bacId`     | string        | `?bacId=cm_xyz456`        |
| `typeReleve`| TypeReleve    | `?typeReleve=BIOMETRIE`   |
| `dateFrom`  | ISO string    | `?dateFrom=2026-01-01`    |
| `dateTo`    | ISO string    | `?dateTo=2026-03-31`      |
| `nonLie`    | boolean       | `?nonLie=true`            |
| `limit`     | number        | `?limit=20`               |
| `offset`    | number        | `?offset=40`              |

Le `modifie` flag est géré dans `getReleves()` mais pas encore exposé dans la route GET.

Les index DB couvrent les accès fréquents :
- `@@index([vagueId, typeReleve])`
- `@@index([bacId])`
- `@@index([date])`
- `@@index([siteId])`

---

## Décisions

### D1 — Créer une page standalone `/releves` (vue transversale)

**Décision :** Créer `src/app/(farm)/releves/page.tsx` qui liste TOUS les relevés du
site actif, quelle que soit la vague. Cette page remplace le lien mort actuel.

**Rationale :**

Les pisciculteurs ont besoin de consulter les relevés de manière transversale
(ex : « tous mes relevés d'alimentation de la semaine passée sur toutes les vagues »).
Le workflow actuel force à naviguer vague par vague. La page standalone permet :

1. Un historique complet du site
2. La recherche multi-vague
3. Un point d'entrée direct depuis la nav principale

La vue par vague (`/vagues/[id]/releves`) est conservée telle quelle — elle reste
utile dans le contexte d'une vague spécifique. Les deux vues coexistent.

### D2 — Filtrage Server-Side avec URL Search Params

**Décision :** Les filtres sont portés par les URL search params. La page `/releves`
est un Server Component qui lit `searchParams`, appelle `getReleves()` directement,
et pré-rend les résultats. Le composant de filtre UI est un Client Component séparé.

**Rationale :**

- **Persistance gratuite** : rechargement, copier-coller de l'URL, partage — les
  filtres survivent
- **SEO / SSR** : la liste est rendue côté serveur (pas de spinner initial)
- **Pattern existant** : identique à `feed-filters.tsx` (`useRouter` +
  `useSearchParams` + `startTransition`)
- **Pas de state management** : pas de Zustand/Context, la source de vérité est
  l'URL

Contrainte : les filtres changent déclenche une navigation Next.js
(`router.push`), ce qui re-rend le Server Component. Acceptable car la latence est
masquée par `startTransition` (opacity 60% pendant la transition).

### D3 — Pagination "Charger plus" (Load More)

**Décision :** Pagination `limit=20` avec un bouton "Charger plus" (load more), pas
de numérotation de pages, pas d'infinite scroll automatique.

**Rationale :**

- **Mobile first** : sur 360px, la numérotation de pages est difficile à toucher.
  L'infinite scroll automatique pose problème avec le FAB de création (conflit de
  défilement)
- **Contexte métier** : les pisciculteurs cherchent des relevés récents. La
  majorité des accès concernent les 20 derniers relevés. "Charger plus" est explicite
- **Implémentation simple** : `offset` cumulatif dans l'URL (`?offset=0`, `?offset=20`)
  — un seul paramètre à gérer

Variante rejetée — infinite scroll : difficile à combiner avec Server Components
purs et les URL params pour la persistance.

### D4 — Panneau de filtres collapsable (mobile) / barre inline (desktop)

**Décision :**
- **Mobile (< md)** : bouton "Filtres" avec badge comptant les filtres actifs.
  Clic ouvre un `Sheet` Radix (bottom drawer) contenant tous les filtres.
- **Desktop (≥ md)** : barre de filtres inline affichée en permanence au-dessus
  de la liste.

**Rationale :**

Sur 360px, afficher 5+ contrôles de filtre inline consomme trop d'espace vertical.
Le bottom sheet est le pattern mobile natif pour ce type de sélection multi-critères
(similaire aux apps de e-commerce). Le badge sur le bouton "Filtres" indique le
nombre de filtres actifs sans occuper d'espace.

Radix `Sheet` est déjà présent dans `src/components/ui/sheet.tsx` — pas de
nouvelle dépendance.

### D5 — Sélecteur de bac dynamique (dépend de la vague)

**Décision :** Le sélecteur de bac est désactivé et vide si aucune vague n'est
sélectionnée. Quand `vagueId` est défini, les bacs disponibles sont chargés via
un appel client `GET /api/bacs?vagueId=...` déclenché par le changement de vague.

**Rationale :**

Un bac appartient à une seule vague à la fois (contrainte métier R4). Afficher
tous les bacs du site sans contexte de vague n'aurait pas de sens. La liste des
bacs est courte (< 20 typiquement) — un appel REST simple suffit, pas besoin de
React Query pour ce cas.

### D6 — Exposer le paramètre `modifie` dans l'API GET

**Décision :** Ajouter `modifie` aux query params parsés dans
`src/app/api/releves/route.ts` (la query function `getReleves` le supporte déjà).

**Rationale :**

La logique est déjà en place dans `getReleves()` (ligne 41-43 de `releves.ts`).
Il manque juste l'extraction du paramètre dans la route handler. Changement minimal
(3 lignes).

---

## Architecture des composants

```
src/
├── app/
│   └── (farm)/
│       └── releves/
│           ├── page.tsx                    — Server Component (NEW)
│           └── loading.tsx                 — déjà existant à src/app/releves/loading.tsx
│                                             (à déplacer dans (farm)/releves/)
├── components/
│   └── releves/
│       ├── releves-filter-bar.tsx          — Client Component (NEW)
│       │   Responsabilité : gestion des URL params pour les filtres
│       │   Rendu : Sheet (mobile) ou inline row (desktop)
│       │
│       ├── releves-filter-sheet.tsx        — Client Component (NEW)
│       │   Responsabilité : contenu du Sheet mobile
│       │   (vague select, bac select, date range, type tabs, toggles)
│       │
│       ├── releves-global-list.tsx         — Server Component (NEW)
│       │   Responsabilité : appel getReleves() + rendu liste + pagination
│       │   Reçoit : searchParams parsés + vagues + bacs contexte
│       │
│       ├── releves-active-filters.tsx      — Client Component (NEW)
│       │   Responsabilité : chips/badges des filtres actifs + bouton reset
│       │
│       └── [existant — inchangé]
│           ├── releve-form-client.tsx
│           ├── modifier-releve-dialog.tsx
│           └── consommation-fields.tsx
│
└── app/
    └── api/
        └── releves/
            └── route.ts                    — MODIFIER : ajouter param `modifie`
```

### Arbre de composition (page `/releves`)

```
RelevesPage (Server Component)
├── Header ("Tous les relevés")
├── Suspense
│   └── RelevesContent (Server Component)
│       ├── ReleveFilterBar (Client Component)  ← lit searchParams via props
│       │   ├── [mobile] FilterButton + Sheet
│       │   │   └── RelevesFilterSheet
│       │   │       ├── VagueSelect (Radix Select)
│       │   │       ├── BacSelect (Radix Select, dépend vagueId)
│       │   │       ├── TypeSelect (Radix Select)
│       │   │       ├── DateFromInput (native <input type="date">)
│       │   │       ├── DateToInput (native <input type="date">)
│       │   │       └── ModifieToggle (Radix Switch)
│       │   └── [desktop] inline row des mêmes contrôles
│       │
│       ├── RelevesActiveFilters (Client Component)
│       │   └── chips pour chaque filtre actif + bouton "Effacer tout"
│       │
│       └── RelevesGlobalList (Server Component — résultat DB)
│           ├── ReleveCard × N  (réutilise ReleveDetails existant)
│           └── LoadMoreButton (Client Component)
│
└── FAB (lien /releves/nouveau — existant)
```

---

## Interfaces TypeScript

### Props et types nouveaux

```typescript
// src/types/ui.ts (nouveau fichier ou ajout à api.ts)

/** Filtres UI dérivés des URL search params — tous optionnels et strings bruts */
export interface ReleveSearchParams {
  vagueId?: string;
  bacId?: string;
  typeReleve?: string;
  dateFrom?: string;     // format "YYYY-MM-DD"
  dateTo?: string;       // format "YYYY-MM-DD"
  modifie?: string;      // "true" | undefined
  offset?: string;       // string car searchParams toujours string
}

/** Résultat parsé et validé, prêt pour getReleves() */
export interface ParsedReleveFilters {
  vagueId?: string;
  bacId?: string;
  typeReleve?: TypeReleve;
  dateFrom?: string;
  dateTo?: string;
  modifie?: boolean;
  offset: number;        // toujours défini (défaut 0)
  limit: number;         // toujours défini (défaut 20)
}

/** Props du composant RelevesFilterBar */
export interface ReleveFilterBarProps {
  /** Filtres actuellement actifs (depuis URL) */
  current: ReleveSearchParams;
  /** Vagues disponibles pour le Select (chargées côté serveur) */
  vagues: Array<{ id: string; code: string; statut: StatutVague }>;
}

/** Props du composant RelevesGlobalList */
export interface RelevesGlobalListProps {
  releves: Releve[];
  total: number;
  offset: number;
  limit: number;
  permissions: Permission[];
  produits: ProduitOption[];
}
```

### Fonction de parsing des searchParams

```typescript
// src/lib/releve-search-params.ts (nouveau fichier utilitaire)

import { TypeReleve } from "@/types";
import type { ReleveSearchParams, ParsedReleveFilters } from "@/types";

export const RELEVES_PAGE_LIMIT = 20;
export const ALL_VALUE = "__all__";

/** Valide et parse les URL search params vers des filtres typés */
export function parseReleveSearchParams(
  params: ReleveSearchParams
): ParsedReleveFilters {
  const typeReleve = params.typeReleve &&
    params.typeReleve !== ALL_VALUE &&
    Object.values(TypeReleve).includes(params.typeReleve as TypeReleve)
      ? (params.typeReleve as TypeReleve)
      : undefined;

  const offset = Math.max(0, parseInt(params.offset ?? "0", 10) || 0);

  return {
    vagueId: params.vagueId || undefined,
    bacId: params.bacId || undefined,
    typeReleve,
    dateFrom: params.dateFrom || undefined,
    dateTo: params.dateTo || undefined,
    modifie: params.modifie === "true" ? true : undefined,
    offset,
    limit: RELEVES_PAGE_LIMIT,
  };
}

/** Compte le nombre de filtres actifs (hors pagination) */
export function countActiveFilters(params: ReleveSearchParams): number {
  let count = 0;
  if (params.vagueId) count++;
  if (params.bacId) count++;
  if (params.typeReleve && params.typeReleve !== ALL_VALUE) count++;
  if (params.dateFrom) count++;
  if (params.dateTo) count++;
  if (params.modifie === "true") count++;
  return count;
}
```

---

## Flux de données

```
URL: /releves?vagueId=abc&typeReleve=BIOMETRIE&dateFrom=2026-03-01

RelevesPage (Server)
  │
  ├── lit searchParams (Next.js prop automatique)
  ├── parse via parseReleveSearchParams()
  ├── appelle getVagues(siteId) pour populer le Select vague
  ├── appelle getReleves(siteId, filters, { limit: 20, offset }) → {data, total}
  │
  ├── passe parsed filters → ReleveFilterBar (Client)
  │     └── useSearchParams() pour lecture locale
  │         useRouter() + startTransition() pour écriture
  │         → router.push("/releves?" + newParams)
  │             └── Re-render Server Component avec nouvelles searchParams
  │
  └── passe {releves, total, offset} → RelevesGlobalList (Server)
        └── "Charger plus" (offset + 20)
              → router.push avec ?offset=20
                  └── Server Component récupère les 20 suivants
```

**Note importante :** Le bouton "Charger plus" doit préserver TOUS les filtres
existants dans l'URL — uniquement `offset` est incrémenté.

---

## Wireframes mobile (360px)

### Écran principal `/releves` — état "aucun filtre"

```
┌─────────────────────────────┐  <- 360px
│ ← Tous les relevés          │  <- Header
├─────────────────────────────┤
│ [Filtres]        [+ Relevé] │  <- barre d'actions (48px)
│  (badge "0")                │
├─────────────────────────────┤
│ 87 relevés trouvés          │  <- compteur
├─────────────────────────────┤
│ ┌───────────────────────┐   │
│ │ [BIOMETRIE]  Bac A-01 │   │  <- carte relevé
│ │ 03/04/2026            │   │
│ │ 45g | 12cm | 20 éch.  │   │
│ └───────────────────────┘   │
│ ┌───────────────────────┐   │
│ │ [MORTALITE] Bac B-02  │   │
│ │ ...                   │   │
│ └───────────────────────┘   │
│ ...                         │
│ ┌───────────────────────┐   │
│ │   Charger 20 de plus  │   │  <- bouton load more
│ │   (67 restants)       │   │
│ └───────────────────────┘   │
└─────────────────────────────┘
│ [Accueil][Vagues][Fin.][Menu]│  <- bottom nav
```

### Sheet filtres (ouverte depuis bouton "Filtres")

```
┌─────────────────────────────┐
│ Filtres            [Effacer]│  <- header sheet
├─────────────────────────────┤
│ Vague                       │
│ ┌───────────────────────┐   │
│ │ Toutes les vagues ▼   │   │  <- Radix Select
│ └───────────────────────┘   │
│                             │
│ Bac                         │
│ ┌───────────────────────┐   │
│ │ Tous les bacs ▼       │   │  <- désactivé si pas de vague
│ └───────────────────────┘   │
│                             │
│ Type de relevé              │
│ ┌───────────────────────┐   │
│ │ Tous les types ▼      │   │
│ └───────────────────────┘   │
│                             │
│ Période                     │
│ Du   ┌──────────────────┐   │
│      │ 2026-01-01       │   │  <- input type="date" natif
│      └──────────────────┘   │
│ Au   ┌──────────────────┐   │
│      │ 2026-03-31       │   │
│      └──────────────────┘   │
│                             │
│ ○ Relevés modifiés seulement│  <- Radix Switch
│                             │
│ ┌───────────────────────┐   │
│ │   Appliquer (3 actifs)│   │  <- bouton ferme le sheet
│ └───────────────────────┘   │
└─────────────────────────────┘
```

### Filtres actifs (chips sous la barre)

```
┌─────────────────────────────┐
│ [BIOMETRIE ×] [Jan→Mars ×]  │  <- chips scrollable horizontalement
│ [Vague V-2024 ×]  [Tout ×] │
└─────────────────────────────┘
```

### Barre desktop (≥ md, 768px+)

```
┌──────────────────────────────────────────────────────────────┐
│ Vague ▼ │ Bac ▼ │ Type ▼ │ Du [date] Au [date] │ [Modifiés] │
└──────────────────────────────────────────────────────────────┘
```

---

## Modifications fichier par fichier

### Nouveau : `src/app/(farm)/releves/page.tsx`

Server Component. Responsabilités :
1. Auth + permission `RELEVES_VOIR`
2. Lecture des `searchParams` (prop Next.js 14+)
3. `parseReleveSearchParams(searchParams)` → filtres validés
4. `getVagues(siteId)` → pour populer le Select vague
5. `getReleves(siteId, filters, pagination)` → données paginées
6. `prisma.produit.findMany(...)` → options pour modifier un relevé
7. Rendu : `<Header>` + `<ReleveFilterBar>` + `<RelevesGlobalList>`

```typescript
// Signature de la page
export default async function RelevesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[]>>;
})
```

### Nouveau : `src/components/releves/releves-filter-bar.tsx`

Client Component (`"use client"`). Encapsule toute la logique URL.

Exports :
- `ReleveFilterBar` — composant principal
- Réutilise le pattern exact de `feed-filters.tsx` (whitelist validation +
  `startTransition` + état local synchronisé avec `useEffect`)

Logique clé :
- `updateParam(key, value)` — met à jour un seul param, remet `offset` à 0
- `resetAllFilters()` — `router.push("/releves")` sans params
- `activeCount` calculé via `countActiveFilters(searchParams)` (fonction pure)

### Nouveau : `src/components/releves/releves-filter-sheet.tsx`

Client Component. Contenu du `Sheet` Radix pour mobile.

Props : identiques à `ReleveFilterBar` (forwarded).

Inclut le fetch dynamique des bacs :
```typescript
// Pseudo-code dans le composant
const [bacs, setBacs] = useState<Bac[]>([]);
useEffect(() => {
  if (!vagueId) { setBacs([]); return; }
  fetch(`/api/bacs?vagueId=${vagueId}`)
    .then(r => r.json())
    .then(d => setBacs(d.data ?? []));
}, [vagueId]);
```

### Nouveau : `src/components/releves/releves-global-list.tsx`

Server Component. Rendu de la liste + bouton "Charger plus".

Props :
```typescript
interface Props {
  releves: Releve[];
  total: number;
  offset: number;
  limit: number;
  permissions: Permission[];
  produits: ProduitOption[];
  currentSearchParams: ReleveSearchParams;
}
```

Réutilise `ReleveDetails` (à extraire de `releves-list.tsx` vers un fichier partagé
`releve-details.tsx` — actuellement `memo` local dans `releves-list.tsx`).

Le bouton "Charger plus" est un `LoadMoreButton` Client Component qui fait :
```typescript
const newParams = new URLSearchParams(currentSearchParams);
newParams.set("offset", String(offset + limit));
router.push(`/releves?${newParams}`);
```

### Nouveau : `src/components/releves/releves-active-filters.tsx`

Client Component. Affiche des chips pour chaque filtre actif.

Chips affichés :
- Vague : `Vague: [code]`
- Bac : `Bac: [nom]`
- Type : `[BIOMETRIE]` (avec badge coloré)
- Date : `Du 01/01` ou `→ 31/03` ou `01/01 → 31/03`
- Modifiés : `Modifiés seulement`

Chaque chip a un `×` qui supprime uniquement ce filtre (appel `updateParam`).

### Nouveau : `src/lib/releve-search-params.ts`

Fonctions pures (pas de "use client"). Voir section Interfaces TypeScript.

### Modifier : `src/app/api/releves/route.ts`

Ajouter l'extraction du paramètre `modifie` :

```typescript
// Après la ligne: if (dateTo) filters.dateTo = dateTo;
if (searchParams.get("modifie") === "true") filters.modifie = true;
```

### Modifier : `src/app/releves/loading.tsx`

Ce fichier est dans `src/app/releves/` (hors du groupe `(farm)`). Le déplacer vers
`src/app/(farm)/releves/loading.tsx` pour qu'il s'applique à la bonne route.

Vérifier : si `src/app/releves/` contient uniquement `loading.tsx` et `nouveau/`,
le dossier peut être fusionné ou les fichiers déplacés selon la structure de routing
actuelle.

### Inchangé : `src/components/vagues/releves-list.tsx`

La vue par vague reste telle quelle. Les onglets de type en client-side sont
adaptés à ce contexte (tous les relevés sont déjà chargés, les onglets sont rapides).

### Extraction suggérée : `src/components/releves/releve-details.tsx`

`ReleveDetails` est actuellement un `memo` local dans `releves-list.tsx`. Il doit
être extrait pour être partagé entre `releves-list.tsx` et `releves-global-list.tsx`.

```typescript
// src/components/releves/releve-details.tsx
export const ReleveDetails = memo(function ReleveDetails({
  releve,
}: {
  releve: Releve;
}) { ... });
```

---

## Changements backend requis

### Minimal (1 ligne de code)

L'unique changement requis dans le backend est l'exposition du paramètre `modifie`
dans la route GET :

**Fichier :** `src/app/api/releves/route.ts`
**Ligne à ajouter** (après `if (dateTo) filters.dateTo = dateTo;`) :
```typescript
if (searchParams.get("modifie") === "true") filters.modifie = true;
```

### Aucun changement de schéma DB

Tous les indexes nécessaires existent. Aucune nouvelle colonne, aucune migration.

### Aucun nouveau endpoint API

La page `/releves` appelle `getReleves()` directement (Server Component) — pas
d'appel fetch côté client pour la liste principale. Seul le sélecteur de bac
utilise `/api/bacs?vagueId=...` (endpoint existant).

---

## Considérations de performance

### Pagination conservatrice (limit=20)

Sur mobile Cameroun (connexion 3G variable), charger 20 relevés est raisonnable.
Chaque relevé est léger en JSON (< 500 bytes). 20 relevés = ~10 KB de données.

### Cache

L'API `GET /api/releves` utilise déjà `cachedJson(..., "fast")`. La page Server
Component bénéficie du cache Next.js `dynamic = "force-dynamic"` implicitement
(car elle lit `searchParams`).

### Éviter le N+1 sur les vagues

Le Select de vague affiche uniquement `code` et `statut` — la query se limite à
ces 3 champs (`id`, `code`, `statut`) pour les vagues EN_COURS du site.

```typescript
const vagues = await prisma.vague.findMany({
  where: { siteId, statut: StatutVague.EN_COURS },
  select: { id: true, code: true, statut: true },
  orderBy: { dateDebut: "desc" },
  take: 50,  // sécurité : pas plus de 50 vagues
});
```

---

## Règles Phase 2 respectées

| Règle | Application |
|-------|-------------|
| R1 — Enums MAJUSCULES | `TypeReleve.BIOMETRIE` partout, jamais `"biometrie"` |
| R2 — Importer les enums | `import { TypeReleve } from "@/types"` |
| R3 — Prisma = TypeScript | `ParsedReleveFilters` miroir de `ReleveFilters` |
| R4 — Opérations atomiques | Pagination par URL, pas de state accumulé |
| R5 — DialogTrigger asChild | Bouton "Filtres" sera `<Button>` pur, pas de Dialog |
| R6 — CSS variables | `var(--primary)` pour les badges de filtre actif |
| R7 — Nullabilité explicite | `vagueId?: string` (optional), `offset: number` (required) |
| R8 — siteId PARTOUT | `getReleves(siteId, filters)` — siteId en 1er argument |
| R9 — Tests avant review | `npx vitest run` + `npm run build` avant PR |

---

## Plan d'implémentation

### Ordre recommandé (pour le @developer)

1. **Extraire `ReleveDetails`** vers `src/components/releves/releve-details.tsx`
   (refactor sans régression, tests en premier)

2. **Patcher la route API** : exposer `modifie` dans `route.ts` (1 ligne)

3. **Créer `src/lib/releve-search-params.ts`** (fonctions pures — testable en isolation)

4. **Créer `RelevesGlobalList`** Server Component (liste + load more)

5. **Créer `RelevesActiveFilters`** Client Component (chips)

6. **Créer `RelevesFilterSheet`** Client Component (contenu Sheet mobile)

7. **Créer `ReleveFilterBar`** Client Component (assemblage + Sheet + inline desktop)

8. **Créer `src/app/(farm)/releves/page.tsx`** Server Component (assemblage final)

9. **Déplacer `loading.tsx`** dans `(farm)/releves/`

### Stories estimées

| Story | Complexité | Composant |
|-------|-----------|-----------|
| Extraction ReleveDetails | XS | releve-details.tsx |
| Patch route API modifie | XS | route.ts |
| Lib parse search params | S | releve-search-params.ts |
| RelevesGlobalList | M | composant liste |
| RelevesActiveFilters | S | composant chips |
| RelevesFilterSheet | M | Sheet mobile |
| ReleveFilterBar | M | assemblage + desktop |
| Page /releves | S | assemblage final |

---

## Alternatives rejetées

### A1 — Améliorer uniquement la vue par vague

Rejetée. Le lien `/releves` dans la nav principale pointe vers une route inexistante.
Ce bug doit être corrigé. Une vue transversale répond à un besoin distinct.

### A2 — Infinite scroll automatique

Rejetée. Conflit avec le FAB flottant de création. Complexité de gestion avec Server
Components. "Load more" explicite est plus prévisible sur mobile basse performance.

### A3 — Filtres dans un Dialog (modal)

Rejetée en faveur du Sheet. Un Dialog est centré et flottant — le Sheet bottom est
le pattern mobile natif pour les filtres (ancré au bas, swipeable, demi-écran).

### A4 — Composant de filtres standalone avec react-query

Rejetée. Ajoute de la complexité (cache management, loading states, error states)
pour des données qui changent rarement. Le pattern URL-first + Server Component est
plus simple et déjà utilisé dans le projet.

### A5 — Réutiliser `RelevesList` existant

Rejetée. `RelevesList` est fortement couplé au mode "vague unique" (tabs client-side,
lien "Voir tout", prop `vagueId`). Créer `RelevesGlobalList` découplé est plus propre
et évite de complexifier le composant existant.
