# BUG-PERF-003 — Double-fetch pattern : initialData SSR sans initialDataUpdatedAt
**Sévérité :** Moyenne
**Détecté par :** @architect
**Sprint :** Performance (hors-sprint)
**Fichier(s) :**
- `src/components/vagues/vagues-list-client.tsx` (ligne 35)
- `src/hooks/queries/use-vagues-queries.ts`
- `src/hooks/queries/use-ventes-queries.ts`
- `src/hooks/queries/use-depenses-queries.ts`

## Description
Le pattern Server Component → `initialData` → React Query est utilisé dans plusieurs composants pour hydrater le cache client avec les données SSR. Cependant, `initialDataUpdatedAt` n'est jamais fourni.

Sans `initialDataUpdatedAt`, TanStack Query v5 traite les données `initialData` comme si elles avaient été fetchées à l'époque 0 (epoch). Même avec `staleTime: 2 * 60_000`, les données sont considérées stales dès le premier rendu, et un refetch est déclenché au prochain focus ou montage d'un composant qui souscrit à la même clé.

Exemple en `vagues-list-client.tsx` :
```typescript
const { data: vagues = initialVagues } = useVaguesList(undefined, { initialData: initialVagues });
```
Le hook `useVaguesList` a `staleTime: 2 * 60_000`. Mais comme `initialDataUpdatedAt` n'est pas passé, React Query ne sait pas que ces données viennent d'être fetchées par le SSR — il les traite comme périmées dès le montage.

**Composants affectés :**
- `useVaguesList` avec `initialData`
- `useVentesList` avec `initialData`
- `useFacturesList` avec `initialData`
- `useClientsList` avec `initialData`
- `useBesoinsList` avec `initialData`
- `useDashboardData` avec `initialData`

## Étapes de reproduction
1. Charger `/vagues` (SSR fournit les vagues)
2. Observer dans React Query Devtools : les vagues sont marquées "stale" immédiatement
3. Attendre 2 minutes ou changer d'onglet puis revenir
4. Un refetch des vagues est déclenché même si les données n'ont pas changé

## Cause racine
`initialData` fourni sans `initialDataUpdatedAt: Date.now()`. TanStack Query ne peut pas savoir que ces données viennent d'être fetched.

## Fix
- [ ] Modifier les hooks qui acceptent `initialData` pour aussi accepter `initialDataUpdatedAt` (optionnel, défaut `Date.now()`)
- [ ] Passer `initialDataUpdatedAt: Date.now()` dans chaque appel SSR qui fournit `initialData`
- [ ] Aligner le `staleTime` avec la fréquence réelle de changement (vagues : 10min, bacs : 5min)
- [ ] Test de non-régression : après SSR, aucun refetch immédiat ne se produit dans les N premières minutes
- [ ] Tous les tests passent
- [ ] Build OK

## Statut : OUVERT
