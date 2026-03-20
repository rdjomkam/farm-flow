# Pré-analyse Story 32.4 — Middleware restriction abonnement expiré
Date : 2026-03-20
Agent : @pre-analyst (inline par @project-manager)

## Résumé
GO — toutes les dépendances nécessaires sont en place (getAbonnementActif + StatutAbonnement).

## Dépendances vérifiées

| Dépendance | Statut | Fichier | Note |
|------------|--------|---------|------|
| `getAbonnementActif(siteId)` | PRESENT | `src/lib/queries/abonnements.ts` | Retourne plan inclus |
| `StatutAbonnement` enum | PRESENT | `src/types/models.ts` | ACTIF, EN_GRACE, SUSPENDU, EXPIRE, ANNULE |
| Route `/api/abonnements/actif` | PRESENT | `src/app/api/abonnements/actif/route.ts` | Créé en story 32.2 |
| `getServerSession()` (pour Server Components) | PRESENT | `src/lib/auth/session.ts` | |
| `src/components/layout/app-shell.tsx` | A VÉRIFIER | — | Pour intégration du banner |

## Recommandations pour @developer

1. `check-subscription.ts` : fonctions pures, pas d'appel Prisma — utiliser les types directement
2. `subscription-banner.tsx` : Server Component, charger via `getServerSession()` + `getAbonnementActif()`
3. Mobile-first : banner compact sur 360px (pas de padding excessif)
4. R6 : CSS variables du thème (pas de couleurs hardcodées)
5. Plan DECOUVERTE : ne pas afficher le banner

## Verdict : GO
