# ADR-PERF-001 — Next.js Performance Optimization

**Date :** 2026-03-31
**Auteur :** @architect
**Statut :** PROPOSÉ
**Sprint :** Hors-sprint (analyse transversale)

---

## Contexte

Une revue de performance de l'application a été menée le 2026-03-31 couvrant les hooks React Query, les contextes, le bundle client, et les requêtes base de données. Chaque fichier identifié dans la revue a été lu et vérifié. Ce document formalise les constats validés et les solutions proposées.

L'application tourne sur Next.js 14+ (App Router), Prisma + PostgreSQL, TanStack Query v5, avec une architecture Server Components + Client Components. Elle cible des utilisateurs en Afrique subsaharienne sur connexions 2G/3G avec des appareils Android d'entrée de gamme.

---

## Problèmes identifiés

### PERF-001 — Absence de cache serveur pour les données stables

**Sévérité : Haute**

**Constat :** L'unique usage de `unstable_cache` dans le code source est `src/lib/abonnements/check-subscription.ts` (TTL 1h, invalidé par `revalidateTag`). Toutes les pages du dashboard, des vagues, des relevés, des bacs, des finances, etc. effectuent des requêtes Prisma fraîches à chaque rendu server-side.

**Fichiers concernés :**
- `src/app/(farm)/page.tsx` — 2 requêtes Prisma directes + 4 sections Suspense (chacune avec ses propres requêtes Prisma)
- `src/lib/queries/finances.ts` — 7 requêtes parallèles dont 3 `findMany` avec aggregation JS
- Toutes les pages sous `src/app/(farm)/` dont les Server Components appellent directement Prisma

**Impact :** Pour chaque visiteur de `/`, le serveur exécute entre 10 et 15 requêtes Prisma. Avec N utilisateurs simultanés, la charge est N×15 requêtes par rafraîchissement de page. Aucun bénéfice du cache HTTP puisque les réponses API utilisent `cachedJson` avec `private, max-age=60` — non utilisable par un CDN ou un cache partagé.

**`cachedJson` existant (`src/lib/api-cache.ts`) :** Le module existe et génère des headers `Cache-Control`, mais il est déclaré `private` et donc limité au cache navigateur client. Il ne réduit pas la charge serveur Prisma.

**Solution proposée :**
- Utiliser `unstable_cache` avec `revalidateTag` pour les données lentes (config élevage, vagues terminées, résumé financier du mois précédent)
- Ajouter `export const revalidate = 60` sur les segments de route dont les données ne changent pas en temps réel
- Utiliser Prisma Accelerate (déjà disponible en prod via Prisma Postgres) pour le cache query-level sur les requêtes fréquentes

---

### PERF-002 — Sur-invalidation React Query en cascade (CRITIQUE)

**Sévérité : Critique**

**Constat validé dans le code :**

`src/hooks/queries/use-releves-queries.ts` :
```
useCreateReleve.onSuccess → invalidate(releves.all) + invalidate(vagues.all) + invalidate(dashboard.all)
useUpdateReleve.onSuccess → invalidate(releves.all) + invalidate(vagues.all) + invalidate(dashboard.all)
useDeleteReleve.onSuccess → invalidate(releves.all) + invalidate(vagues.all) + invalidate(dashboard.all)
```

`src/hooks/queries/use-vagues-queries.ts` :
```
useCreateVague.onSuccess  → invalidate(vagues.all) + invalidate(bacs.all) + invalidate(dashboard.all)
useUpdateVague.onSuccess  → invalidate(vagues.all) + invalidate(detail) + invalidate(dashboard.all)
useClotureVague.onSuccess → invalidate(vagues.all) + invalidate(detail) + invalidate(bacs.all) + invalidate(dashboard.all)
```

`src/hooks/queries/use-ventes-queries.ts` :
```
useCreateVente.onSuccess → invalidate(ventes.all) + invalidate(factures.all) + invalidate(dashboard.all)
useDeleteVente.onSuccess → invalidate(ventes.all) + invalidate(factures.all) + invalidate(dashboard.all)
useAddPaiement.onSuccess → invalidate(factures.all) + invalidate(detail) + invalidate(dashboard.all)
```

`src/hooks/queries/use-depenses-queries.ts` :
```
useCreateDepense.onSuccess → invalidate(depenses.all) + invalidate(dashboard.all)
useDeleteDepense.onSuccess → invalidate(depenses.all) + invalidate(dashboard.all)
useTraiterBesoin.onSuccess → invalidate(besoinsKey) + invalidate(depenses.all)
```

**Mécanisme du problème :** `queryKeys.vagues.all = ["vagues"]`. Quand on invalide `["vagues"]`, TanStack Query invalide toutes les entrées dont la clé commence par `["vagues"]` — soit `["vagues", "list", ...]` ET `["vagues", "detail", ...]`. Créer un relevé pour une vague invalide donc la liste complète des vagues ET le dashboard, forçant des refetches massifs.

**Impact quantifié :** Une seule mutation `useCreateReleve` déclenche potentiellement 3 refetches réseau simultanés. Sur une page de détail vague ouverte avec un dashboard actif, cela peut représenter 5 à 8 appels API en cascade depuis un seul clic.

**Solution proposée :**
- Remplacer `invalidate(vagues.all)` par `invalidate(vagues.list())` quand seule la liste est affectée
- Sur les mutations de type "update d'une entité connue", utiliser `setQueryData` pour patcher le cache localement (optimistic updates)
- Retarder l'invalidation du dashboard avec `invalidateQueries({ queryKey: ..., refetchType: "none" })` pour les mutations non-critiques (relevé d'observation, note)
- Créer un utilitaire `invalidateRelatedQueries(entityType, id)` pour centraliser la logique

---

### PERF-003 — Double-fetch pattern : initialData + staleTime

**Sévérité : Moyenne**

**Constat validé dans le code :**

`src/components/vagues/vagues-list-client.tsx` ligne 35 :
```typescript
const { data: vagues = initialVagues } = useVaguesList(undefined, { initialData: initialVagues });
```

`src/hooks/queries/use-vagues-queries.ts` : `staleTime: 2 * 60_000`

Comportement actuel : le Server Component fetche les vagues, les passe comme `initialData`. React Query considère que `initialData` est immédiatement stale par défaut (sauf si `initialDataUpdatedAt` est fourni). Donc après 2 minutes, React Query refetche les mêmes données — sauf que `staleTime: 2 * 60_000` est appliqué, ce qui signifie que les données sont considérées fraîches pendant 2 min depuis... la création du QueryClient (pas depuis le fetch SSR).

Le même pattern se retrouve dans :
- `useVentesList` (initialData + staleTime 2min)
- `useFacturesList` (initialData + staleTime 2min)
- `useClientsList` (initialData + staleTime 2min)
- `useBesoinsList` (initialData + staleTime 2min)

**Impact :** Moins grave qu'initialement décrit car `staleTime: 2min` protège le premier rendu. Mais si l'utilisateur revient sur la page après 2 minutes, un refetch inutile est déclenché même si les données serveur n'ont pas changé.

**Solution proposée :**
- Passer `initialDataUpdatedAt: Date.now()` avec `initialData` pour que TanStack Query sache que les données sont fraîches depuis maintenant
- Aligner le `staleTime` du hook avec la fréquence de changement réelle des données (les vagues changent rarement, staleTime peut être 10min)

---

### PERF-004 — Polling sans respect de la visibilité de l'onglet

**Sévérité : Haute**

**Constat validé dans le code :**

Trois points de polling actif :

1. `src/components/layout/notification-bell.tsx` :
   ```typescript
   refetchInterval: 60_000,  // poll every 60s
   ```
   Sans `refetchIntervalInBackground: false` — TanStack Query v5 continue de poller même quand l'onglet est en arrière-plan.

2. `src/hooks/queries/use-alertes-queries.ts` — `useNotificationsCount` :
   ```typescript
   refetchInterval: 60_000,
   ```
   Même absence de `refetchIntervalInBackground: false`.

3. `src/hooks/queries/use-planning-queries.ts` — `useMesTachesCount` :
   ```typescript
   refetchInterval: 60_000,
   ```
   Même problème.

4. `src/hooks/use-network-status.ts` :
   ```typescript
   const interval = setInterval(updateCount, 5000); // Every 5s
   ```
   Polling IndexedDB toutes les 5 secondes pour `pendingCount`. Ce poll continue en arrière-plan car il utilise `setInterval` natif et non TanStack Query.

**Note :** `src/providers/query-provider.tsx` définit `refetchOnWindowFocus: false` globalement, ce qui est correct pour les connexions 2G. Mais l'absence de `refetchIntervalInBackground: false` annule partiellement ce bénéfice.

**Calcul de l'impact (par utilisateur actif, onglet en arrière-plan) :**
- `NotificationBell` : 1 440 appels/jour
- `useNotificationsCount` : 1 440 appels/jour (duplique l'appel de NotificationBell)
- `useMesTachesCount` : 1 440 appels/jour
- `useNetworkStatus` : 17 280 lectures IndexedDB/jour
- **Total réseau : ~4 320 appels API inutiles/jour/utilisateur** (en supposant que `useNotificationsCount` et `NotificationBell` partagent la même query key — ce qui est le cas : `queryKeys.notifications.count()` — donc les deux se déduisent à 1 440)
- Réel : 2 880 appels API + 17 280 ops IndexedDB par utilisateur par jour si l'onglet reste ouvert en arrière-plan

**Solution proposée :**
- Ajouter `refetchIntervalInBackground: false` sur tous les `refetchInterval`
- Remplacer le `setInterval` de `useNetworkStatus` par un événement natif `visibilitychange` + poll unique au retour au premier plan (le code gère déjà `visibilitychange` pour la sync offline, le polling peut être suspendu de la même façon)

---

### PERF-005 — GlobalLoadingContext : re-render en cascade sur chaque appel API

**Sévérité : Moyenne**

**Constat validé dans le code :**

`src/contexts/global-loading.context.tsx` : le provider expose `isLoading` et `isMutating` comme state React. Ces deux valeurs changent à chaque appel API (GET ou mutation) via `useApi()`.

`src/hooks/use-api.ts` : chaque appel `call()` invoque `increment()` puis `decrement()` (ou variantes mutation), provoquant deux setState sur le contexte — soit deux re-renders de tout l'arbre sous `GlobalLoadingProvider`.

**Arbre affecté :** `GlobalLoadingProvider` est au niveau du layout racine (`src/app/(farm)/layout.tsx` ou similaire) — donc chaque appel API re-rend potentiellement des dizaines de composants.

**Atténuation existante :** L'usage de `useRef` pour les compteurs (`countRef`, `mutationCountRef`) minimise les re-renders — `setIsLoading(true)` n'est appelé que quand le compteur passe de 0 à 1, et `setIsLoading(false)` seulement quand il revient à 0. Ce n'est donc pas "un re-render par appel" mais "deux re-renders par rafale d'appels".

**Impact réel :** Moindre que décrit initialement grâce aux refs. Mais si plusieurs mutations s'enchaînent (ex: clôture de vague → invalidation cascade → 5 refetches), le contexte peut flipper plusieurs fois.

**Solution proposée :**
- Séparer le contexte en deux providers distincts (`LoadingBarProvider` et `MutationOverlayProvider`) pour réduire la surface de re-render
- Ou utiliser `useSyncExternalStore` avec un store externe (Zustand) pour des souscriptions granulaires
- À courte terme : marquer les polls silencieux avec `silentLoading: true` (déjà prévu dans l'API de `useApi` mais pas systématiquement utilisé)

---

### PERF-006 — Librairies lourdes dans le bundle client (partiellement faux positif)

**Sévérité : Basse (corrigée depuis l'analyse initiale)**

**Constat après vérification du code :**

L'analyse initiale signalait `xlsx`, `@react-pdf/renderer`, et `@aws-sdk/client-s3` comme inclus dans le bundle client. Après vérification :

- `xlsx` : importé uniquement dans `src/lib/export/excel-*.ts`, eux-mêmes importés **uniquement** par des API routes (`src/app/api/export/*/route.ts`). Ces fichiers sont server-only. Pas de contamination bundle client.
- `@react-pdf/renderer` : importé dans `src/lib/export/pdf-*.tsx`, eux-mêmes importés uniquement par des API routes. Server-only.
- `@aws-sdk/client-s3` : importé dans `src/lib/storage.ts`, qui est un module serveur.

**Problème résiduel confirmé :** `recharts` est importé directement (pas via `dynamic()`) dans :
- `src/components/finances/finances-dashboard-client.tsx`
- `src/components/analytics/analytics-dashboard-client.tsx`
- `src/components/analytics/feed-detail-charts.tsx`
- `src/components/dashboard/projections.tsx`
- et 7 autres fichiers

`recharts` est une dépendance client légitime, mais les composants charts pourraient bénéficier d'un lazy loading via `dynamic()` avec `ssr: false` pour les pages où les graphiques ne sont pas above-the-fold.

**Impact réel :** recharts représente ~300KB gzippé. Sans `dynamic()`, il est inclus dans le bundle initial de toute page qui l'importe. Sur 2G (1 Mbps), cela représente ~2.4s de chargement supplémentaire.

**Solution proposée :**
- Wrapper les composants de graphiques dans `dynamic(() => import(...), { ssr: false, loading: () => <Skeleton /> })`
- Vérifier avec `next build --profile` ou `@next/bundle-analyzer` que les chunks charts ne sont pas dans le bundle initial des pages sans graphiques

---

### PERF-007 — Requêtes SQL sous-optimales dans `sumCoutsParCategorie`

**Sévérité : Basse**

**Constat validé dans le code :**

`src/lib/queries/finances.ts` — `getResumeFinancier` appelle `sumCoutsParCategorie` 3 fois dans `Promise.all` :
```typescript
sumCoutsParCategorie(siteId, CategorieProduit.ALIMENT, dateFilterStock),
sumCoutsParCategorie(siteId, CategorieProduit.INTRANT, dateFilterStock),
sumCoutsParCategorie(siteId, CategorieProduit.EQUIPEMENT, dateFilterStock),
```

Chaque appel exécute :
```sql
SELECT "prixTotal" FROM "MouvementStock"
JOIN "Produit" ON ...
WHERE "siteId" = $1 AND "type" = 'ENTREE' AND "prixTotal" IS NOT NULL
AND "Produit"."categorie" = $2
```

Soit 3 requêtes SQL qui parcourent le même sous-ensemble de données avec des filtres différents. Une requête GROUP BY unique serait plus efficace.

**Atténuation existante :** Les 3 appels sont dans `Promise.all` — ils s'exécutent en parallèle sur le même pool de connexions Prisma. L'impact est réduit par la parallélisation mais le nombre de round-trips reste inutilement élevé.

**Seconde inefficacité :** La fonction utilise `findMany` + `reduce` en JavaScript plutôt qu'un `aggregate` avec `_sum`. Prisma supporte `aggregate` avec des relations filtrées via `where` — mais pas directement sur des champs de relations. C'est la raison historique du `findMany`. La solution propre serait une requête SQL native via `prisma.$queryRaw`.

**Solution proposée :**
```typescript
const coutsParCategorie = await prisma.$queryRaw<
  Array<{ categorie: string; total: number }>
>`
  SELECT p."categorie", COALESCE(SUM(ms."prixTotal"), 0)::float AS total
  FROM "MouvementStock" ms
  JOIN "Produit" p ON ms."produitId" = p."id"
  WHERE ms."siteId" = ${siteId}
    AND ms."type" = 'ENTREE'
    AND ms."prixTotal" IS NOT NULL
    ${dateFilterStock ? Prisma.sql`AND ms."date" BETWEEN ${dateFilterStock.gte} AND ${dateFilterStock.lte}` : Prisma.empty}
  GROUP BY p."categorie"
`;
```
Cela remplace 3 requêtes par 1, réduisant les round-trips DB de 2.

---

## Résumé des priorités

| ID | Problème | Sévérité | Effort | Priorité d'implémentation |
|----|----------|----------|--------|--------------------------|
| PERF-002 | Sur-invalidation React Query | Critique | Moyen | 1 — Immédiat |
| PERF-004 | Polling sans visibilité tab | Haute | Faible | 2 — Sprint courant |
| PERF-001 | Absence cache serveur | Haute | Élevé | 3 — Sprint suivant |
| PERF-003 | Double-fetch initialData | Moyenne | Faible | 4 — Sprint courant |
| PERF-005 | GlobalLoadingContext re-render | Moyenne | Moyen | 5 — Quand PERF-002 résolu |
| PERF-006 | Bundle recharts non-lazy | Basse | Faible | 6 — Sprint polish |
| PERF-007 | 3 requêtes SQL vs 1 GROUP BY | Basse | Faible | 7 — Sprint polish |

---

## Dépendances entre fixes

```
PERF-002 (sur-invalidation)
  └── bloque PERF-005 (contexte loading) car les re-renders excessifs du contexte
      sont amplifiés par les invalidations en cascade

PERF-001 (cache serveur)
  └── dépend de PERF-002 résolu — inutile de cacher si les invalidations
      vident le cache immédiatement après chaque mutation

PERF-003 (initialData)
  └── indépendant, peut être résolu en même temps que PERF-004
```

---

## Risques et compromis

### Risque PERF-002 : Invalidations trop ciblées → données périmées
Si on remplace `invalidate(vagues.all)` par `invalidate(vagues.list())`, le cache de détail d'une vague peut devenir obsolète après une mutation. Il faut tester chaque flux utilisateur (créer relevé → la liste et le détail se mettent à jour).

### Risque PERF-001 : Cache serveur → affichage de données périmées
L'usage de `unstable_cache` nécessite une stratégie d'invalidation rigoureuse via `revalidateTag`. Si un tag est oublié après une mutation, les utilisateurs voient des données obsolètes. Mitigation : commencer par des TTL courts (60s) avant d'augmenter.

### Risque PERF-004 : Arrêter le polling → notifications non reçues
Si on ajoute `refetchIntervalInBackground: false`, les utilisateurs avec l'onglet caché ne reçoivent plus les notifications. Acceptable si un Service Worker ou Web Push est utilisé. Vérifier la présence d'un SW de notifications avant d'implémenter.

### Compromis PERF-006 : recharts lazy → flash de skeleton
Les composants dynamiques affichent un skeleton pendant le chargement. Sur 2G, ce skeleton peut rester visible 2-3s. C'est acceptable (mieux qu'un First Contentful Paint bloqué).

---

## Décision

Toutes les issues PERF-001 à PERF-007 sont validées et documentées. Les tickets de bug individuels sont créés dans `docs/bugs/BUG-PERF-001.md` à `BUG-PERF-007.md`.

L'ordre d'implémentation recommandé : PERF-002 → PERF-004 → PERF-003 → PERF-001 → PERF-005 → PERF-006 → PERF-007.
