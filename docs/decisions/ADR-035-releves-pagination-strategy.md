# ADR-035 — Stratégie de Pagination des Relevés

**Date :** 2026-04-06
**Statut :** SUPERSÉDÉ par ADR-038
**Auteur :** @architect
**Domaine :** Performance / Scalabilité / UX
**Dépend de :** ADR-034 (Filtrage des relevés)

---

## Contexte

### Problème

La nouvelle page standalone `/releves` (ADR-034, déjà implémentée) applique correctement
une pagination `limit=20` avec bouton "Charger plus". En revanche, plusieurs autres
surfaces du produit chargent les relevés sans aucune limite, ce qui constitue un risque
de scalabilité identifié.

Un site actif peut accumuler plusieurs centaines, voire milliers de relevés sur la durée
de vie d'une vague (relevés quotidiens d'alimentation × nombre de bacs × durée du cycle).
À 2 relevés/jour/bac, une vague de 6 bacs sur 6 mois représente ~2 160 relevés.

### Audit des surfaces chargeant des relevés

#### Catégorie A — Chargement sans limite, axe UI (problème de scalabilité utilisateur)

| Surface | Fichier | Mécanisme | Risque |
|---------|---------|-----------|--------|
| **Vue détail vague** | `src/components/pages/vague-detail-page.tsx` | `getVagueById()` + `releves: { include }` sans `take` | HAUT — tous les relevés chargés pour afficher uniquement 2 |
| **Vue relevés par vague** | `src/components/pages/vague-releves-page.tsx` | Même `getVagueById()` — tous les relevés utilisés pour `vague.releves.length` et l'affichage complet | HAUT — page dédiée sans pagination |
| **`getVagueById()`** | `src/lib/queries/vagues.ts` (lignes 34-55) | `include: { releves: { orderBy: { date: "desc" } } }` sans `take` ni `skip` | CRITIQUE — source unique de tous les problèmes A |

#### Catégorie B — Chargement sans limite, axe analytique (acceptable par conception)

| Surface | Fichier | Contexte | Verdict |
|---------|---------|----------|---------|
| **Dashboard — `getVaguesWithReleves`** | `src/lib/queries/dashboard.ts` (lignes 32-54) | Seulement les vagues EN_COURS, champs `select` restreints, pas de `consommations`, scopé aux vagues actives | ACCEPTABLE — déjà optimisé avec `select` minimal |
| **`getRecentActivity`** | `src/lib/queries/dashboard.ts` (ligne 343) | `take: limit` (défaut 5), relations légères | OK — déjà paginé |
| **Analytics `getIndicateursBac`** | `src/lib/queries/analytics.ts` (lignes 207-219) | Scoped `vagueId + bacId`, champs `select` restreints, usage calcul uniquement | ACCEPTABLE — données exhaustives nécessaires pour calcul |
| **Analytics `getAnalytiqueAliments`** | `src/lib/queries/analytics.ts` (lignes 1319-1338) | Filtre `date ≥ troisMoisAvant`, 4 types seulement, usage calcul | ACCEPTABLE — temporellement borné |
| **Analytics `relevesVivants`** | `src/lib/queries/analytics.ts` (lignes 1955-1969) | Scoped par `vagueIds`, 2 types seulement, champs `select` restreints | ACCEPTABLE — données exhaustives nécessaires pour calcul |
| **Analytics `getChangementsGranule`** | `src/lib/queries/analytics.ts` (lignes 2118-2131) | Scoped `vagueId + typeReleve.ALIMENTATION` | ACCEPTABLE — déjà très scoped |
| **Alertes mortalité** | `src/lib/alertes.ts` (ligne 122) | Filtre `date ≥ depuis24h + nombreMorts > seuil` | OK — temporellement borné |
| **Alertes qualité eau** | `src/lib/alertes.ts` (ligne 170) | Filtre `date ≥ depuis24h` | OK — temporellement borné |
| **Export Excel** | `src/app/api/export/releves/route.ts` | Export intentionnel de tous les relevés d'une vague | OK — comportement attendu |
| **`getRelevesByType`** | `src/lib/queries/releves.ts` (ligne 407) | Non exportée vers les pages UI ; usage interne calculs uniquement | ACCEPTABLE |
| **Renouvellements** | `src/app/api/bacs/[id]/renouvellements/route.ts` | Scoped `vagueId + bacId + typeReleve.RENOUVELLEMENT` | OK — très scoped |
| **Calibrages** | `src/lib/queries/calibrages.ts` | Scoped mortalité pré-calibrage uniquement | OK — très scoped |

### Conclusion de l'audit

Les deux seuls problèmes de scalabilité réels sont dans la **Catégorie A** :

1. `getVagueById()` charge tous les relevés avec leurs relations complètes
   (bac, consommations, modifications)
2. `VagueDetailPage` et `VagueRelevesPage` consomment `vague.releves` sans limite

Les queries de la Catégorie B utilisent des `select` restreints, des filtres temporels,
ou des scopes très précis. Elles ne montrent pas les relevés en UI — elles calculent des
indicateurs. Leur chargement exhaustif est une exigence fonctionnelle, pas un bug.

---

## Décisions

### D1 — Séparer `getVagueById()` en deux fonctions distinctes

**Décision :** Créer une nouvelle variante `getVagueByIdWithoutReleves()` (ou renommer
en `getVagueByIdForDetail()`) qui charge la vague sans ses relevés. Les relevés sont
chargés séparément via `getReleves()` lorsque nécessaire.

**Rationale :**

La fonction `getVagueById()` est appelée par deux contextes aux besoins opposés :

| Contexte | Besoin en relevés |
|----------|-------------------|
| `VagueDetailPage` (page `/vagues/[id]`) | 2 relevés (mode preview `limit=2`) + biométries pour le graphique |
| `VagueRelevesPage` (page `/vagues/[id]/releves`) | Relevés paginés (limit=20) |

Retourner tous les relevés dans les deux cas est un over-fetching structurel. La solution
est de supprimer l'inclusion des relevés de `getVagueById()` et de les charger selon
le besoin de chaque page.

**Nouvelle signature proposée :**

```typescript
// src/lib/queries/vagues.ts

/** Retourne la vague avec ses bacs — SANS les relevés (pour les pages detail + analytics) */
export async function getVagueById(id: string, siteId: string) {
  return prisma.vague.findFirst({
    where: { id, siteId },
    include: {
      bacs: { orderBy: { nom: "asc" } },
      // Suppression : releves n'est plus chargé ici
    },
  });
}

/** Retourne la vague avec ses bacs ET les relevés paginés */
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

### D2 — VagueDetailPage : charger les relevés séparément, en deux temps

**Décision :** `VagueDetailPage` charge la vague sans relevés via `getVagueById()`.
Les données pour le graphique Gompertz/poids (biométries uniquement) sont chargées
via une query spécialisée. Le composant `RelevesList` en mode preview (`limit=2`)
est alimenté par une query séparée `getReleves(siteId, { vagueId }, { limit: 3 })`.

**Rationale :**

La page détail vague utilise `vague.releves` pour deux usages distincts :

1. **Calcul du graphique** : uniquement les relevés `typeReleve=BIOMETRIE` avec
   `poidsMoyen`, `bacId`, `date` — pas besoin des consommations ni modifications
2. **Composant `RelevesList`** : mode preview `limit=2`, affiche les 2 derniers relevés

Ces deux usages justifient deux queries séparées, chacune optimisée pour son besoin.

**Impact sur `VagueDetailPage` :**

```typescript
// AVANT — 1 query lourde, tous les relevés
const [vague, ...] = await Promise.all([
  getVagueById(id, siteId),  // retournait vague + tous les relevés
  ...
]);
// biometries = vague.releves.filter(...)  → N relevés chargés pour un sous-ensemble

// APRÈS — 2 queries légères, données exactement nécessaires
const [vague, biometriesData, releves3, ...] = await Promise.all([
  getVagueById(id, siteId),   // sans relevés
  prisma.releve.findMany({    // biométries pour le graphique uniquement
    where: { vagueId: id, siteId, typeReleve: TypeReleve.BIOMETRIE },
    orderBy: { date: "asc" },
    select: { typeReleve: true, date: true, poidsMoyen: true, bacId: true },
  }),
  getReleves(siteId, { vagueId: id }, { limit: 3, offset: 0 }),  // preview
  ...
]);
```

**Note sur le calcul Gompertz :** `getVaguesWithReleves()` dans le dashboard charge
déjà les biométries via un `select` restreint. La même approche doit être appliquée
ici — seuls les champs nécessaires au calcul sont sélectionnés.

### D3 — VagueRelevesPage : adopter la pagination "Charger plus" (même pattern que `/releves`)

**Décision :** La page `/vagues/[id]/releves` adopte le même mécanisme de pagination
que la page standalone `/releves` : URL search param `?offset=0`, limit=20, bouton
"Charger plus". La page lit le param `offset` depuis `searchParams` et appelle
`getVagueByIdWithReleves()` avec pagination.

**Rationale :**

La page dédiée aux relevés d'une vague est l'endroit le plus susceptible d'avoir
des centaines de relevés. C'est précisément ici que la pagination est la plus critique.

Le pattern "Load more" avec URL params est déjà validé dans ADR-034 pour la page
standalone. L'appliquer ici maintient la cohérence de l'UX et évite d'inventer un
second pattern.

**Impact :**

- `VagueRelevesPage` devient un Server Component qui lit `searchParams.offset`
- `RelevesList` en mode "full" (sans prop `limit`) est remplacé par un nouveau
  composant `VagueRelevesList` (ou le composant existant est adapté avec un prop
  `pagination`)
- Le titre `t("list.title", { count: vague.releves.length })` affiche le total DB,
  pas la taille du tableau en mémoire

**Signature mise à jour :**

```typescript
// src/components/pages/vague-releves-page.tsx
export default async function VagueRelevesPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[]>>;
}) {
  const { id } = await params;
  const rawParams = await searchParams;
  const offset = Math.max(0, parseInt(
    typeof rawParams.offset === "string" ? rawParams.offset : "0", 10
  ) || 0);

  const result = await getVagueByIdWithReleves(id, siteId, { limit: 20, offset });
  // result.total → pour le titre et le bouton "Charger plus"
  // result.releves → 20 relevés max
}
```

### D4 — `RelevesList` : ne pas modifier le composant existant pour la vue preview

**Décision :** `RelevesList` en mode "limited" (`limit` prop défini) reste inchangé.
Le mode "full" (`limit` non défini) est remplacé dans `VagueRelevesPage` par
l'utilisation du nouveau composant `RelevesGlobalList` (déjà créé par ADR-034)
ou une adaptation équivalente pour le contexte vague.

**Rationale :**

`RelevesList` est utilisé dans `VagueDetailPage` en mode preview (`limit=2`). Ce
mode ne pose pas de problème de scalabilité — on ne charge que 3 relevés. Modifier
ce composant risquerait de casser un cas d'usage stable.

En revanche, le mode "full" dans `VagueRelevesPage` (sans prop `limit`) ne sera
plus utilisé car la page passera à un modèle paginé serveur. Le composant
`RelevesGlobalList` existant (ADR-034) peut être réutilisé tel quel ou une variante
légèrement adaptée `VagueRelevesGlobalList` peut être créée si les besoins divergent
(ex : bouton "Retour à la vague" spécifique).

### D5 — Afficher le total dans le titre (pas le compte en mémoire)

**Décision :** Le titre de la page relevés (`X relevés — code_vague`) utilise le
`total` retourné par la query paginée, pas `releves.length` (qui serait toujours ≤ 20).

**Rationale :**

`vague.releves.length` est actuellement le seul indicateur du nombre réel de relevés.
Avec la pagination, `releves.length` vaudra au plus `limit=20`. Le total réel est
disponible via `prisma.releve.count({ where: { vagueId, siteId } })` — inclus dans
`getVagueByIdWithReleves()`.

---

## Architecture des composants

### Avant (état actuel)

```
VagueDetailPage (Server Component)
├── getVagueById()           ← charge TOUS les relevés + consommations + modifications
├── RelevesList              ← reçoit vague.releves (N relevés)
│   └── mode: limit=2        ← affiche 2, oublie N-2
└── Calcul Gompertz          ← filtre vague.releves pour biométries seulement

VagueRelevesPage (Server Component)
├── getVagueById()           ← charge TOUS les relevés + consommations + modifications
└── RelevesList              ← reçoit vague.releves (N relevés), mode full, onglets
```

### Après (cible)

```
VagueDetailPage (Server Component)
├── getVagueById()               ← charge vague + bacs SEULEMENT (pas de relevés)
├── prisma.releve.findMany()     ← biométries uniquement (select restreint, pas de limit)
├── getReleves(vagueId, limit=3) ← 3 derniers relevés pour preview
└── RelevesList                  ← reçoit 3 relevés, mode: limit=2
    └── lien "Voir tout → /vagues/[id]/releves"

VagueRelevesPage (Server Component)
├── lit searchParams.offset
├── getVagueByIdWithReleves(id, siteId, { limit: 20, offset })
│   ├── vague + bacs (sans relevés supplémentaires)
│   ├── 20 relevés paginés (avec consommations + modifications)
│   └── total (prisma.releve.count)
└── RelevesGlobalList (réutilisé depuis ADR-034)
    └── LoadMoreButton → /vagues/[id]/releves?offset=20
```

---

## Interfaces TypeScript

### Nouveau type de retour pour `getVagueByIdWithReleves`

```typescript
// src/types/models.ts — ajouter

/** Retour paginé de getVagueByIdWithReleves */
export interface VagueWithPaginatedReleves {
  vague: VagueWithBacs;    // VagueWithBacs = vague + bacs (pas de releves)
  releves: Releve[];
  total: number;
}
```

### Props de `VagueRelevesPage` mise à jour

```typescript
// src/components/pages/vague-releves-page.tsx

interface VagueRelevesPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[]>>;
}
```

### Constante partagée pour la limite

```typescript
// src/lib/releve-search-params.ts — déjà existant

export const RELEVES_PAGE_LIMIT = 20;  // déjà défini dans ADR-034
// À réutiliser dans VagueRelevesPage — pas de duplication
```

---

## Plan d'implémentation

### Ordre des modifications (du moins risqué au plus impactant)

**Étape 1 — Ajouter `getVagueByIdWithReleves()` dans `vagues.ts`**

Nouvelle fonction uniquement, aucune modification de l'existante. Risque : zéro.

**Étape 2 — Refactorer `VagueDetailPage`**

Remplacer l'usage des relevés depuis `vague.releves` par deux queries séparées.
Tests : s'assurer que le graphique Gompertz produit les mêmes données.

**Étape 3 — Refactorer `VagueRelevesPage`**

Ajouter `searchParams` comme prop, utiliser `getVagueByIdWithReleves()` paginé,
remplacer `RelevesList` mode full par `RelevesGlobalList`.

**Étape 4 — (Optionnel) Deprecation de `getVagueById()` avec `include: { releves }`**

Une fois que plus aucun appelant n'utilise les relevés depuis `getVagueById()`,
supprimer le bloc `include: { releves: ... }` de la fonction originale, ou la
marquer `@deprecated` en attendant.

### Stories estimées

| Story | Fichier(s) modifié(s) | Complexité |
|-------|----------------------|-----------|
| Ajouter `getVagueByIdWithReleves()` | `src/lib/queries/vagues.ts` | S |
| Refactorer `VagueDetailPage` | `src/components/pages/vague-detail-page.tsx` | M |
| Refactorer `VagueRelevesPage` | `src/components/pages/vague-releves-page.tsx` | M |
| Tests de non-régression | `src/tests/` | M |

---

## Impact sur les composants existants

| Composant | Impact | Action requise |
|-----------|--------|----------------|
| `src/lib/queries/vagues.ts` | MODIFIÉ | Ajouter `getVagueByIdWithReleves()` |
| `src/components/pages/vague-detail-page.tsx` | MODIFIÉ | Queries séparées pour biométries + preview |
| `src/components/pages/vague-releves-page.tsx` | MODIFIÉ | Pagination URL + `getVagueByIdWithReleves()` |
| `src/components/vagues/releves-list.tsx` | INCHANGÉ | Mode preview (`limit=2`) non affecté |
| `src/components/releves/releves-global-list.tsx` | RÉUTILISÉ | Déjà créé par ADR-034, réutilisable tel quel |
| `src/lib/queries/dashboard.ts` | INCHANGÉ | Déjà optimisé (select restreint + vagues EN_COURS) |
| `src/lib/queries/analytics.ts` | INCHANGÉ | Chargement exhaustif justifié par le calcul |
| `src/lib/queries/releves.ts` | INCHANGÉ | `getReleves()` supporte déjà la pagination |

---

## Considérations de performance

### Ce qui change

Avant le refactoring, `VagueDetailPage` sur une vague mature (500 relevés) :

- Charge 500 relevés avec leurs consommations et modifications depuis la DB
- Transfère ~500 KB de JSON Prisma en mémoire serveur
- Passe 500 objets au composant React (même si 2 s'affichent)

Après :

- Biométries only : ~10-50 relevés (une biométrie par semaine × 6 mois = ~26)
- Preview : 3 relevés uniquement
- Total : ~30-55 relevés + 1 COUNT, au lieu de 500

### Ce qui ne change pas

Les queries analytiques restent inchangées. Elles sont executées uniquement sur
les pages analytics/indicateurs, pas sur les pages de listing UI. Leur chargement
exhaustif est nécessaire pour calculer FCR, SGR, taux de survie, etc.

### Index DB déjà présents (suffisants)

Les index suivants couvrent les nouvelles queries :
- `@@index([vagueId, typeReleve])` — biométries par vague
- `@@index([vagueId])` — relevés paginés par vague
- `@@index([date])` — tri par date

Aucun nouvel index requis.

---

## Surfaces exclues de la pagination (et pourquoi)

### Calculs analytiques

`getIndicateursBac`, `getAnalytiqueAliments`, `relevesVivants`, `getChangementsGranule`
dans `analytics.ts` ne sont PAS paginés. Ces fonctions calculent des indicateurs
agrégés (FCR, SGR, biomasse, survie) qui requièrent l'exhaustivité historique.
Paginer leur source de données produirait des indicateurs incorrects.

Mitigation existante : ces fonctions utilisent des `select` restreints (pas de
`consommations`, pas de `modifications`), des filtres temporels stricts (3 derniers
mois), et des scopes très précis (un seul bac, une seule vague).

### Export Excel

La route `/api/export/releves` charge intentionnellement tous les relevés d'une
vague pour produire un fichier complet. C'est le comportement attendu et ne doit
pas être paginé.

### Alertes (mortalité, qualité eau)

Les queries d'alertes dans `alertes.ts` sont bornées temporellement (`date ≥ depuis24h`).
Le volume est intrinsèquement limité (relevés des 24 dernières heures).

---

## Règles Phase 2 respectées

| Règle | Application |
|-------|-------------|
| R1 — Enums MAJUSCULES | `TypeReleve.BIOMETRIE` dans les where clauses |
| R2 — Importer les enums | `import { TypeReleve } from "@/types"` |
| R3 — Prisma = TypeScript | `VagueWithPaginatedReleves` miroir du retour Prisma |
| R4 — Opérations atomiques | `Promise.all([vague, releves, total])` en parallèle |
| R5 — DialogTrigger asChild | Bouton "Charger plus" est un `<Button asChild>` pur |
| R6 — CSS variables | Aucun changement de style requis |
| R7 — Nullabilité explicite | `total: number` (required), `releves: Releve[]` (required) |
| R8 — siteId PARTOUT | `getVagueByIdWithReleves(id, siteId, ...)` — siteId obligatoire |
| R9 — Tests avant review | `npx vitest run` + `npm run build` avant PR |

---

## Alternatives rejetées

### A1 — Paginer `getVagueById()` in-place (sans créer une nouvelle fonction)

Rejetée. Modifier la signature de `getVagueById()` pour ajouter une pagination
optionnelle casserait tous les appelants qui attendent `vague.releves` dans le
résultat (dashboard analytics, `VagueDetailPage` pour le graphique). Le risque
de régression est élevé. Créer une nouvelle fonction dédiée est plus safe.

### A2 — Paginer également les queries analytiques

Rejetée. Les fonctions analytiques calculent des indicateurs sur l'historique
complet. Paginer leur source introduirait des biais de calcul (FCR faux, SGR faux,
taux de survie faux). La scalabilité est assurée par les `select` restreints
et les filtres temporels déjà en place.

### A3 — Infinite scroll côté client avec React Query

Rejetée. Même raison que dans ADR-034 : conflit avec les Server Components,
complexité de la gestion du cache, et le pattern URL-first est déjà établi.

### A4 — Créer un endpoint API dédié `/api/vagues/[id]/releves`

Rejetée. La page `VagueRelevesPage` est un Server Component — elle peut appeler
`getVagueByIdWithReleves()` directement sans passer par une route API. Les routes
API sont pour les Client Components. Ajouter un endpoint inutile augmente la
surface de l'API sans bénéfice.

### A5 — Numérotation de pages (Previous / Next) plutôt que "Load more"

Rejetée. Cohérence avec ADR-034 qui a statué en faveur de "Load more". Sur 360px,
les boutons de pagination numérotés sont difficiles à toucher. Le pattern "Load more"
est plus adapté au comportement mobile-first validé dans ADR-034.
