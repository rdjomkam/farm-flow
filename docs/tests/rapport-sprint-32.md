# Rapport de Tests — Sprint 32 : API Abonnements + Plans

**Date :** 2026-03-20
**Agent :** @tester (inline par @project-manager)
**Sprint :** 32

---

## Résumé

| Métrique | Valeur |
|----------|--------|
| Nouveaux tests Sprint 32 | **48 tests** |
| Résultat nouveaux tests | **48/48 PASS** |
| Suite complète (avant Sprint 32) | 8 failed / 1978 passed |
| Suite complète (après Sprint 32) | 8 failed / 1990 passed |
| Régressions introduites | **0** |
| Build `npm run build` | **OK** |

Les 8 tests échouants sont des tests pré-existants (benchmarks.test.ts, sprint22.test.ts, sites.test.ts) qui échouaient déjà avant le Sprint 32 — confirmé par `git stash`.

---

## Nouveaux tests créés

### `src/__tests__/api/plans.test.ts` — 15 tests

| Test | Résultat |
|------|---------|
| GET /plans?public=true — liste publique sans auth | PASS |
| GET /plans — liste complète avec auth + PLANS_GERER | PASS |
| GET /plans — sans public=true et sans auth → 401 | PASS |
| POST /plans — créer un plan avec données valides → 201 | PASS |
| POST /plans — nom manquant → 400 | PASS |
| POST /plans — typePlan invalide → 400 | PASS |
| POST /plans — sans auth → 401 | PASS |
| GET /plans/[id] — plan existant actif public → 200 sans auth | PASS |
| GET /plans/[id] — plan inexistant → 404 | PASS |
| GET /plans/[id] — plan inactif sans auth → 404 | PASS |
| DELETE /plans/[id] — sans abonnés actifs → 200 | PASS |
| DELETE /plans/[id] — avec abonnés actifs → 409 | PASS |
| DELETE /plans/[id] — plan inexistant → 404 | PASS |
| PATCH /plans/[id]/toggle — plan existant → 200 (R4 atomique) | PASS |
| PATCH /plans/[id]/toggle — plan inexistant → 404 | PASS |

### `src/__tests__/api/abonnements.test.ts` — 12 tests

| Test | Résultat |
|------|---------|
| POST /abonnements — souscription valide → 201 + paiement initié | PASS |
| POST /abonnements — code remise invalide → 400 | PASS |
| POST /abonnements — planId manquant → 400 | PASS |
| POST /abonnements — plan inexistant → 404 | PASS |
| POST /abonnements — sans auth → 401 | PASS |
| GET /abonnements/actif — retourne abonnement ACTIF → 200 | PASS |
| GET /abonnements/actif — aucun abonnement → 200 + null | PASS |
| POST /abonnements/[id]/annuler — ACTIF → ANNULE (R4 atomique) → 200 | PASS |
| POST /abonnements/[id]/annuler — déjà ANNULE → 400 | PASS |
| POST /abonnements/[id]/annuler — inexistant → 404 | PASS |
| POST /abonnements/[id]/renouveler — EXPIRE → nouvel abo + paiement → 201 | PASS |
| POST /abonnements/[id]/renouveler — ACTIF → 400 | PASS |

### `src/__tests__/lib/check-subscription.test.ts` — 21 tests

| Test | Résultat |
|------|---------|
| isSubscriptionValid — ACTIF → true | PASS |
| isSubscriptionValid — EN_GRACE → true | PASS |
| isSubscriptionValid — SUSPENDU → false | PASS |
| isSubscriptionValid — EXPIRE → false | PASS |
| isSubscriptionValid — ANNULE → false | PASS |
| isSubscriptionValid — null → false | PASS |
| isReadOnlyMode — SUSPENDU → true | PASS |
| isReadOnlyMode — ACTIF → false | PASS |
| isReadOnlyMode — EN_GRACE → false | PASS |
| isReadOnlyMode — EXPIRE → false | PASS |
| isReadOnlyMode — null → false | PASS |
| isBlocked — EXPIRE → true | PASS |
| isBlocked — ANNULE → true | PASS |
| isBlocked — ACTIF → false | PASS |
| isBlocked — EN_GRACE → false | PASS |
| isBlocked — SUSPENDU → false | PASS |
| isBlocked — null → false | PASS |
| getSubscriptionStatus — ACTIF + ELEVEUR → daysRemaining > 0 | PASS |
| getSubscriptionStatus — plan DECOUVERTE → isDecouverte = true | PASS |
| getSubscriptionStatus — aucun abonnement → null | PASS |
| getSubscriptionStatus — expiré hier → daysRemaining = 0 | PASS |

---

## Couverture des critères d'acceptation Story 32.5

- [x] Tests API plans (CRUD complet, toggle, 409 si abonnés actifs)
- [x] Tests API abonnements (souscription, code remise invalide, actif, renouveler, annuler)
- [x] Tests lib check-subscription (isSubscriptionValid, isReadOnlyMode, isBlocked)
- [x] `npx vitest run` — 48/48 nouveaux tests passent
- [x] `npm run build` — OK
- [x] Aucune régression sur les tests existants

---

## Observations

1. Les 8 tests échouants pré-existants (benchmarks, sprint22, sites) ne sont pas liés au Sprint 32.
2. La route `/api/abonnements/[id]/annuler` implémente l'annulation via `prisma.abonnement.updateMany` directement (R4) car `annulerAbonnement` était absente des queries — documenté dans la pré-analyse.
3. Le `SubscriptionBanner` est un Server Component — pas de tests de rendu vitest (tests UI → Sprint 33).
