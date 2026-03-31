# BUG-PERF-002 — Sur-invalidation React Query en cascade après chaque mutation
**Sévérité :** Critique
**Détecté par :** @architect
**Sprint :** Performance (hors-sprint)
**Fichier(s) :**
- `src/hooks/queries/use-releves-queries.ts`
- `src/hooks/queries/use-vagues-queries.ts`
- `src/hooks/queries/use-ventes-queries.ts`
- `src/hooks/queries/use-depenses-queries.ts`
- `src/lib/query-keys.ts`

## Description
Chaque mutation invalide des clés React Query trop larges, déclenchant des refetches en cascade qui ne sont pas nécessaires.

Exemples concrets observés dans le code :

**`useCreateReleve` (`use-releves-queries.ts`) :**
```
invalidate(releves.all)    → invalide TOUTES les listes de relevés
invalidate(vagues.all)     → invalide TOUTES les listes ET détails de toutes les vagues
invalidate(dashboard.all)  → invalide le dashboard complet
```

**`useCreateVague` (`use-vagues-queries.ts`) :**
```
invalidate(vagues.all)     → invalide listes + tous les détails de vagues
invalidate(bacs.all)       → invalide toutes les listes de bacs
invalidate(dashboard.all)  → invalide le dashboard complet
```

**`useCreateVente` (`use-ventes-queries.ts`) :**
```
invalidate(ventes.all)     → invalide listes + tous les détails
invalidate(factures.all)   → invalide toutes les factures
invalidate(dashboard.all)  → invalide le dashboard complet
```

La clé `queryKeys.vagues.all = ["vagues"]` est un préfixe de `["vagues", "list", ...]` et `["vagues", "detail", "xyz"]`. L'invalidation par préfixe force donc le refetch de TOUTES les entrées du domaine, y compris les détails d'entités non affectées.

## Étapes de reproduction
1. Ouvrir la page `/vagues` (liste) avec la page `/dashboard` ouverte dans un autre composant
2. Créer un nouveau relevé
3. Observer dans React Query Devtools : 3 à 5 refetches réseau sont déclenchés simultanément
4. Répéter 10 fois : ~30-50 appels API inutiles générés

## Cause racine
Les `onSuccess` des mutations utilisent systématiquement les clés `*.all` pour garantir la cohérence, mais ce faisant ils invalident bien plus que nécessaire. La granularité des invalidations n'a pas été affinée après l'ajout des clés `list` et `detail`.

## Fix
- [ ] Remplacer `invalidate(vagues.all)` par `invalidate(vagues.list())` dans les mutations qui n'affectent que la liste (pas les détails existants)
- [ ] Pour les mutations `update` d'une entité connue : utiliser `queryClient.setQueryData(queryKeys.vagues.detail(id), updatedData)` au lieu d'invalider
- [ ] Pour `useCreateReleve` : invalider uniquement `releves.list({ vagueId })` et `vagues.detail(vagueId)` — pas `vagues.all` ni `dashboard.all` sauf si c'est un relevé biométrie/mortalité qui impacte les KPIs
- [ ] Créer un helper `invalidateRelatedQueries(entityType, id, affectsKPIs)` pour centraliser la logique
- [ ] Utiliser `refetchType: "none"` pour les invalidations différées (dashboard peut attendre la prochaine navigation)
- [ ] Test de non-régression : après création d'un relevé, la liste et le détail de la vague sont à jour
- [ ] Tous les tests passent
- [ ] Build OK

## Statut : OUVERT
