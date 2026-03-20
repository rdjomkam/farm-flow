# Pré-analyse Story 32.2 — API Routes Abonnements
Date : 2026-03-20
Agent : @pre-analyst (inline par @project-manager)

## Résumé
GO avec 1 point d'attention : `annulerAbonnement()` est absente des queries. Le @developer doit l'implémenter dans la route avec `updateMany` (R4).

## Dépendances vérifiées

| Dépendance | Statut | Fichier | Note |
|------------|--------|---------|------|
| `getAbonnements(siteId, filters)` | PRESENT | `src/lib/queries/abonnements.ts` | |
| `getAbonnementActif(siteId)` | PRESENT | `src/lib/queries/abonnements.ts` | |
| `getAbonnementById(id, siteId)` | PRESENT | `src/lib/queries/abonnements.ts` | |
| `createAbonnement(siteId, userId, data, ...)` | PRESENT | `src/lib/queries/abonnements.ts` | |
| `annulerAbonnement(id)` | ABSENT | — | À implémenter dans la route via `prisma.abonnement.updateMany` avec condition R4 |
| `activerAbonnement(id)` | PRESENT | `src/lib/queries/abonnements.ts` | R4 : updateMany |
| `verifierRemiseApplicable(code, siteId)` | PRESENT | `src/lib/queries/remises.ts` | Retourne `{ remise, erreur? }` |
| `appliquerRemise(remiseId, abonnementId, userId, montantReduit)` | PRESENT | `src/lib/queries/remises.ts` | Transaction atomique |
| `initierPaiement(abonnementId, userId, siteId, params)` | PRESENT | `src/lib/services/billing.ts` | Retourne `InitierPaiementResult` |
| `StatutAbonnement` enum | PRESENT | `src/types/models.ts` | |
| `CreateAbonnementDTO` | PRESENT | `src/types/api.ts` | |
| `AbonnementFilters` | PRESENT | `src/types/api.ts` | |
| `InitierPaiementDTO` | PRESENT | `src/types/api.ts` | |
| `Permission.ABONNEMENTS_VOIR` | PRESENT | `src/types/models.ts` ligne 101 | |
| `Permission.ABONNEMENTS_GERER` | PRESENT | `src/types/models.ts` ligne 102 | |
| `requirePermission()` / `requireAuth()` | PRESENT | `src/lib/permissions.ts` | `auth.activeSiteId` = siteId du site actif |
| `calculerProchaineDate(base, periode)` | PRESENT | `src/lib/abonnements-constants.ts` | Pour calculer dateDebut, dateFin, dateProchainRenouvellement |
| `PLAN_TARIFS` | PRESENT | `src/lib/abonnements-constants.ts` | Pour calculer prixPaye selon période |

## Anomalies détectées

1. **`annulerAbonnement` manquante** : Cette fonction n'existe pas dans `abonnements.ts`. Le @developer doit l'implémenter directement dans la route avec :
   ```typescript
   await prisma.abonnement.updateMany({
     where: { id, siteId, statut: { notIn: [StatutAbonnement.ANNULE, StatutAbonnement.EXPIRE] } },
     data: { statut: StatutAbonnement.ANNULE }
   });
   ```
   Ou utiliser `updatePlanAbonnement`-style dans la route. R4 respecté.

2. **Renouvellement** : Il n'existe pas de fonction `renouvelerAbonnement`. Pour le renouvellement, il faut créer un nouvel abonnement via `createAbonnement` et initier le paiement, ou réactiver via `activerAbonnement`. La logique métier doit être dans la route.

## Recommandations pour @developer

1. **Souscrire à un plan (POST /abonnements)** : flux complet :
   - Vérifier le code remise si fourni via `verifierRemiseApplicable`
   - Calculer les dates : `calculerProchaineDate` + `PLAN_TARIFS`
   - `createAbonnement(siteId, userId, data, dateDebut, dateFin, dateProchainRenouvellement, prixPaye)`
   - Appliquer la remise si présente : `appliquerRemise`
   - `initierPaiement(abonnementId, userId, siteId, { fournisseur, phoneNumber })`
   - Retourner `{ abonnement, paiement }`
2. **R2** : importer `StatutAbonnement` depuis `@/types`, jamais de string brut
3. **R4** : annulation et renouvellement via `updateMany` avec condition
4. **R8** : `auth.activeSiteId` est le siteId du site actif — le passer à toutes les queries
5. **ERR-008** : utiliser les fonctions query pour les transitions d'état, pas Prisma direct avec enum cast
6. **`abonnements/actif`** : route GET sans paramètre dynamique — créer `/api/abonnements/actif/route.ts` (dossier séparé)

## Verdict : GO (avec implémentation de annulerAbonnement dans la route)
