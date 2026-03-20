# Pré-analyse + Implémentation — Story 31.1
**Agent :** @architect
**Date :** 2026-03-20
**Sprint :** 31

## Statut : FAIT

## Prérequis vérifiés
- [x] `FournisseurPaiement` enum présent dans `src/types/models.ts` (ligne 2319)
- [x] `StatutPaiementAbo` enum présent dans `src/types/models.ts` (ligne 2290)
- [x] `InitierPaiementDTO` présent dans `src/types/api.ts` (ligne 2039)
- [x] Queries Sprint 30 présentes dans `src/lib/queries/paiements-abonnements.ts`
- [x] ADR-016 lu et respecté

## Fichiers créés
- `src/lib/payment/types.ts` — Interfaces PaymentGateway, PaymentInitiateParams, PaymentInitiateResult, PaymentStatusResult, WebhookPayload, WebhookResult
- `src/lib/payment/factory.ts` — Factory getPaymentGateway(fournisseur)
- `src/lib/payment/manual-gateway.ts` — ManualGateway implémentation complète
- `src/lib/payment/smobilpay-gateway.ts` — SmobilpayGateway stub (Story 31.2 complétera)
- `src/lib/payment/index.ts` — Barrel export

## Résultat build
OK — aucune erreur TypeScript ni de compilation Next.js

## Résultat tests
3 fichiers de tests en échec (8 tests) — tous pré-existants, non liés à Story 31.1 :
- `benchmarks.test.ts` (3 failures) — tests densité non liés
- `sprint22.test.ts` (1 failure) — test RELEVE_COMPATIBLE_TYPES non lié
- `sites.test.ts` (4 failures) — tests roles API non liés

Aucun test lié aux nouveaux fichiers payment/ en échec.

## Décisions architecturales prises
- `montant: number` plutôt que `Decimal` dans PaymentInitiateParams (plus simple pour les appels API, FCFA sans centimes)
- SmobilpayGateway = stub compilable dans Story 31.1 (évite de bloquer la chaîne)
- ManualGateway entièrement implémentée dès Story 31.1 (simple, pas d'appels HTTP)
- R2 respecté : tous les enums importés depuis "@/types"
