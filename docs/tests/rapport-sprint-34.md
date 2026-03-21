# Rapport de Tests — Sprint 34

**Date :** 2026-03-28
**Sprint :** 34 — Commissions Ingénieur + Portefeuille
**Auteur :** @tester

---

## Résumé

| Critère | Résultat |
|---------|----------|
| Nouveaux tests Sprint 34 | 24 tests — 24 PASSED |
| Suite complète | 72 fichiers — 2058 passed / 8 failed (préexistants) |
| Build production | OK |
| TypeScript | OK (0 erreurs) |

---

## Nouveaux Tests

### `src/__tests__/lib/commissions.test.ts` — 9 tests

| Test | Résultat |
|------|----------|
| site supervisé + ingénieur standard → commission 10% créée | PASS |
| site non supervisé → null (pas de commission) | PASS |
| site supervisé + ingénieur COMMISSION_PREMIUM → commission 20% | PASS |
| idempotence — même paiementId = pas de doublon | PASS |
| pas d'ingénieur membre actif → null | PASS |
| site inexistant → null | PASS |
| erreur DB → null sans propager (fire-and-forget) | PASS |
| rendreCommissionsDisponiblesCron → délègue à J-30 | PASS |
| rendreCommissionsDisponiblesCron → retourne 0 si rien | PASS |

### `src/__tests__/api/portefeuille.test.ts` — 15 tests

| Test | Résultat |
|------|----------|
| GET /portefeuille — 200 retourne solde + commissions | PASS |
| GET /portefeuille — 200 portefeuille vide si pas créé | PASS |
| GET /portefeuille — 401 non authentifié | PASS |
| POST /retrait — 201 solde suffisant → retrait créé | PASS |
| POST /retrait — 400 solde insuffisant | PASS |
| POST /retrait — 400 montant < 5000 FCFA | PASS |
| POST /retrait — 400 numéro téléphone manquant | PASS |
| POST /retrait — 401 non authentifié | PASS |
| POST /retrait/[id]/traiter — 200 admin CONFIRME | PASS |
| POST /retrait/[id]/traiter — 404 retrait inexistant | PASS |
| POST /retrait/[id]/traiter — 400 référence manquante | PASS |
| POST /retrait/[id]/traiter — 403 sans PORTEFEUILLE_GERER | PASS |
| GET /retrait/[id] — 200 ingénieur voit son propre retrait | PASS |
| GET /retrait/[id] — 403 ingénieur ne voit pas le retrait d'un autre | PASS |
| GET /retrait/[id] — 404 retrait inexistant | PASS |

---

## Échecs préexistants (hors Sprint 34)

Ces 8 tests échouent depuis avant le Sprint 34 et ne sont pas liés aux changements effectués :

- `src/__tests__/benchmarks.test.ts` — 3 tests (évaluerBenchmark densité)
- `src/__tests__/sprint22.test.ts` — 1 test (RELEVE_COMPATIBLE_TYPES)
- `src/__tests__/api/sites.test.ts` — 4 tests (creation/modification roles)

---

## Couverture des critères d'acceptation

### Story 34.1 — Service commissions
- [x] Commission créée automatiquement lors de chaque paiement confirmé sur site supervisé
- [x] Pas de commission créée si site non supervisé
- [x] Taux appliqué correctement (10% ou 20% selon permission COMMISSION_PREMIUM)
- [x] Idempotence : pas de double commission sur replay webhook

### Story 34.2 — API Routes
- [x] Un ingénieur ne voit que ses propres commissions
- [x] Un admin DKFarm peut voir les commissions de n'importe quel ingénieur
- [x] Retrait impossible si solde insuffisant (400 avec message clair)
- [x] Référence de virement obligatoire pour traiter un retrait

### Story 34.3 — UI Dashboard
- [x] Build OK — pas d'erreur TypeScript
- [x] R5 : DialogTrigger asChild sur le dialog retrait
- [x] Mobile-first : cartes empilées à 360px
- [x] Visible uniquement si PORTEFEUILLE_VOIR

### Story 34.4 — UI Admin
- [x] Protégé par COMMISSIONS_GERER
- [x] R5 : DialogTrigger asChild sur le dialog traitement
- [x] Référence virement obligatoire

---

## Notes

- Migration `20260328000000_add_commission_premium_permission` appliquée avec succès
- Approche RECREATE pour l'enum (évite ERR-001)
- `date-fns` non disponible dans le projet — remplacement par `Date.prototype`
- Le service commissions est fire-and-forget (ne bloque pas le webhook)
