# Pré-analyse Story 32.3 — API Routes Paiements Abonnements
Date : 2026-03-21
Agent : @pre-analyst

## Résumé
GO — toutes les dépendances sont présentes. Les routes implémentées respectent les patterns du projet.

## Fichiers analysés

- `src/app/api/abonnements/[id]/paiements/route.ts`
- `src/app/api/paiements/[id]/verifier/route.ts`
- `src/lib/queries/paiements-abonnements.ts`
- `src/lib/services/billing.ts`
- `src/types/models.ts`

## Dépendances vérifiées

| Dépendance | Statut | Fichier | Note |
|------------|--------|---------|------|
| `getAbonnementById(id, siteId)` | PRESENT | `src/lib/queries/abonnements.ts` | R8 : filtre par siteId |
| `getPaiementsByAbonnement(abonnementId)` | PRESENT | `src/lib/queries/paiements-abonnements.ts` | Ordonnés par date DESC |
| `createPaiementAbonnement(data)` | PRESENT | `src/lib/queries/paiements-abonnements.ts` | Utilisé par billing.ts |
| `confirmerPaiement(referenceExterne)` | PRESENT | `src/lib/queries/paiements-abonnements.ts` | |
| `getPaiementByReference(referenceExterne)` | PRESENT | `src/lib/queries/paiements-abonnements.ts` | Utilisé par billing.ts |
| `initierPaiement(abonnementId, userId, siteId, params)` | PRESENT | `src/lib/services/billing.ts` | Idempotent |
| `verifierEtActiverPaiement(referenceExterne)` | PRESENT | `src/lib/services/billing.ts` | Idempotent, retourne boolean |
| `StatutPaiementAbo` enum | PRESENT | `src/types/models.ts` | CONFIRME, ECHOUE, EN_ATTENTE... |
| `FournisseurPaiement` enum | PRESENT | `src/types/models.ts` | SMOBILPAY, MTN_MOMO... |
| `Permission.ABONNEMENTS_VOIR` | PRESENT | `src/types/models.ts` | |
| `Permission.ABONNEMENTS_GERER` | PRESENT | `src/types/models.ts` | |
| `requirePermission()` / `ForbiddenError` | PRESENT | `src/lib/permissions.ts` | |
| `AuthError` | PRESENT | `src/lib/auth.ts` (re-export) | |
| `prisma.paiementAbonnement.findFirst` | PRESENT | Modèle Prisma PaiementAbonnement | Avec champ siteId — R8 |

## Vérification des patterns

| Critère | Route abonnements/[id]/paiements | Route paiements/[id]/verifier |
|---------|----------------------------------|-------------------------------|
| `requirePermission()` correct | OUI (ABONNEMENTS_VOIR / ABONNEMENTS_GERER) | OUI (ABONNEMENTS_VOIR) |
| R8 siteId vérifié | OUI (getAbonnementById avec siteId) | OUI (prisma.findFirst avec siteId) |
| R2 enums importés | OUI (Permission, FournisseurPaiement) | OUI (Permission, StatutPaiementAbo) |
| try/catch 401/403/500 | OUI | OUI |
| Idempotence | OUI (billing gère le cas "déjà en cours") | OUI (verifierEtActiverPaiement est idempotent) |
| Pas de doublons paiements | OUI (billing.ts vérifie avant création) | N/A |

## Anomalies détectées

Aucune anomalie bloquante.

**Note mineure :** La route `/paiements/[id]/verifier` utilise `prisma` directement au lieu d'une fonction de query dédiée (`getPaiementAbonnementById`). Ce n'est pas bloquant mais c'est un écart par rapport au pattern "toutes les queries dans src/lib/queries/". À signaler en review.

## Verdict : GO

Les tests unitaires pour ces routes sont à créer (aucun test existant dans `src/__tests__/api/` pour les routes paiements abonnements). Le @tester doit créer `src/__tests__/api/paiements-abonnements.test.ts`.
