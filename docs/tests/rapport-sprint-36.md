# Rapport de tests — Sprint 36

**Date :** 2026-03-21
**Agent :** @tester
**Sprint :** 36 — Story 36.3 (Page renouvellement depuis état expiré)

---

## Fichiers testés

| Fichier | Rôle |
|---------|------|
| `src/app/api/abonnements/statut-middleware/route.ts` | Route interne GET — vérification statut abonnement (Edge → Node bridge) |
| `src/app/abonnement-expire/page.tsx` | Page de blocage selon statut (EN_GRACE, SUSPENDU, EXPIRE) |
| `src/proxy.ts` | Middleware Edge — vérification session + abonnement, redirect /abonnement-expire |

---

## Fichier de test créé

`src/__tests__/api/abonnements-statut-middleware.test.ts`

---

## Cas de test couverts

| # | Description | Résultat attendu | Statut |
|---|-------------|-----------------|--------|
| 1 | GET sans session (cookie absent) | `{ statut: null, isDecouverte: false, planId: null, isBlocked: false }` | PASSE |
| 2 | Session sans activeSiteId | `{ isBlocked: false }` — getSubscriptionStatus non appelé | PASSE |
| 3 | Session + abonnement ACTIF | `{ isBlocked: false, statut: "ACTIF", planId: "plan-eleveur" }` | PASSE |
| 4 | Session + abonnement EXPIRE | `{ isBlocked: true, statut: "EXPIRE", planId: "plan-eleveur" }` | PASSE |
| 5 | Session + plan DECOUVERTE (via flag isDecouverte) | `{ isDecouverte: true, isBlocked: false, planId: null }` — findFirst non appelé | PASSE |
| 6 | planType === DECOUVERTE mais flag incorrect | isDecouverte résolu via planType — `{ isDecouverte: true, isBlocked: false }` | PASSE |
| 7 | Session + abonnement ANNULE | `{ isBlocked: true, statut: "ANNULE" }` | PASSE |
| 8 | Session + aucun abonnement enregistré | `{ statut: null, isBlocked: false, planId: null }` | PASSE |
| 9 | Erreur interne (getSubscriptionStatus throw) | Fail open — `{ isBlocked: false }` | PASSE |
| 10 | Session + abonnement EN_GRACE | `{ isBlocked: false, statut: "EN_GRACE" }` — pas bloqué | PASSE |

**Total : 10/10 tests passent**

---

## Règles vérifiées

- **R2** : Enums `StatutAbonnement` et `TypePlan` importés depuis `@/types` dans le test et dans la route
- **R9** : `npx vitest run` + `npm run build` exécutés avant livraison

---

## Comportements métier validés

### Fail open
La route retourne `{ isBlocked: false }` dans deux cas de fail safe :
1. Pas de session ou session sans `activeSiteId` — le middleware auth gère le redirect `/login`
2. Exception interne (DB, réseau) — ne jamais bloquer l'utilisateur à cause d'une erreur technique

### Plan DECOUVERTE
Le flag `isDecouverte` est résolu par deux chemins complémentaires :
- Via `status.isDecouverte` retourné par `getSubscriptionStatus`
- Via `(status.planType as string) === TypePlan.DECOUVERTE` en fallback (ERR-008 : comparaison string)

Quand `isDecouverte` est true : `isBlocked` est forcé à false et `planId` n'est pas chargé (pas de `findFirst`).

### planId
- Chargé uniquement pour les plans non-DECOUVERTE
- Null si aucun abonnement en base (`findFirst` retourne null)
- Utilisé par le middleware proxy pour construire le lien de renouvellement

### Statut SUSPENDU
Le middleware proxy (`src/proxy.ts`) ne redirige PAS pour SUSPENDU (mode lecture seule géré côté composant). Cette route retourne `isBlocked: false` pour SUSPENDU (seul EXPIRE et ANNULE sont bloquants via `isBlocked()`).

---

## Résultats d'exécution

```
RUN  v4.0.18

 PASS  src/__tests__/api/abonnements-statut-middleware.test.ts (33ms)
   GET /api/abonnements/statut-middleware
     ✓ sans session → { statut: null, isDecouverte: false, planId: null, isBlocked: false }
     ✓ session sans activeSiteId → { isBlocked: false }
     ✓ session + abonnement ACTIF → { isBlocked: false, statut: 'ACTIF' }
     ✓ session + abonnement EXPIRE → { isBlocked: true, statut: 'EXPIRE' }
     ✓ session + plan DECOUVERTE → { isDecouverte: true, isBlocked: false }
     ✓ planType === DECOUVERTE mais isDecouverte=false dans le service → isDecouverte résolu via planType
     ✓ session + abonnement ANNULE → { isBlocked: true }
     ✓ session + aucun abonnement → { statut: null, isBlocked: false }
     ✓ erreur interne (getSubscriptionStatus throw) → fail open { isBlocked: false }
     ✓ session + abonnement EN_GRACE → { isBlocked: false, statut: 'EN_GRACE' }

 Test Files  1 passed (1)
       Tests  10 passed (10)
    Duration  566ms
```

## Build

```
npm run build → ✓ Compiled successfully in 34.9s
                ✓ 127 pages générées sans erreur
```

---

## Verdict

**PASSE** — 10/10 tests, build OK, R2 et R9 respectés.
