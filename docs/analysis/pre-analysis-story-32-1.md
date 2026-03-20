# Pré-analyse Story 32.1 — API Routes Plans
Date : 2026-03-20
Agent : @pre-analyst (inline par @project-manager)

## Résumé
GO — toutes les dépendances sont présentes.

## Dépendances vérifiées

| Dépendance | Statut | Fichier | Note |
|------------|--------|---------|------|
| `getPlansAbonnements(includeInactif)` | PRESENT | `src/lib/queries/plans-abonnements.ts` | Inclut `_count.abonnements` |
| `getPlanAbonnementById(id)` | PRESENT | `src/lib/queries/plans-abonnements.ts` | Inclut `_count.abonnements` |
| `createPlanAbonnement(data)` | PRESENT | `src/lib/queries/plans-abonnements.ts` | |
| `updatePlanAbonnement(id, data)` | PRESENT | `src/lib/queries/plans-abonnements.ts` | |
| `togglePlanAbonnement(id)` | PRESENT | `src/lib/queries/plans-abonnements.ts` | R4 : updateMany avec condition |
| `TypePlan` enum | PRESENT | `src/types/models.ts` | |
| `PlanAbonnement` interface | PRESENT | `src/types/models.ts` | |
| `CreatePlanAbonnementDTO` | PRESENT | `src/types/api.ts` | |
| `UpdatePlanAbonnementDTO` | PRESENT | `src/types/api.ts` | |
| `Permission.PLANS_GERER` | PRESENT | `src/types/models.ts` ligne 103 | |
| `requirePermission()` | PRESENT | `src/lib/permissions.ts` | Retourne AuthContext avec activeSiteId |
| `requireAuth()` | PRESENT | `src/lib/auth/session.ts` | Pour la liste publique sans permission |
| Pattern API route (try/catch + NextResponse.json) | PRESENT | `src/app/api/commandes/route.ts` | À réutiliser |
| `AuthError` + `ForbiddenError` | PRESENT | `src/lib/auth/session.ts`, `src/lib/permissions.ts` | |

## Anomalies détectées

Aucune anomalie bloquante. Note : `togglePlanAbonnement` utilise d'abord un `findUnique` puis un `updateMany` — cela est accepté comme pattern R4 (l'update lui-même est atomique via condition).

La fonction de suppression logique n'existe pas dans les queries (pas de `deletePlanAbonnement`). Le @developer devra implémenter la désactivation soft (isActif=false) dans la route DELETE directement, ou via `updatePlanAbonnement(id, { isActif: false })`.

## Recommandations pour @developer

1. **Pattern de référence** : `src/app/api/commandes/route.ts` — structure try/catch avec AuthError + ForbiddenError
2. **Route GET publique** : utiliser `requireAuth` optionnel — si `?public=true`, pas de vérification de permission ; sinon `requirePermission(Permission.PLANS_GERER)` pour voir les inactifs
3. **DELETE 409** : vérifier `_count.abonnements > 0` avant de désactiver, retourner 409 si oui
4. **R4 toggle** : `togglePlanAbonnement(id)` existe déjà, l'utiliser directement
5. **ERR-008** : ne pas comparer les statuts Prisma directement dans les routes, utiliser les fonctions query
6. **Pas de siteId** sur PlanAbonnement (global) — c'est normal selon ADR-020, ne pas ajouter de filtre siteId

## Verdict : GO
