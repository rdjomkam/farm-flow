# Review Story 30.4 — Queries Prisma Abonnements

**Date :** 2026-03-20
**Agent :** @code-reviewer
**Verdict :** APPROUVÉ

---

## Checklist R1-R9

| Règle | Vérification | Statut |
|-------|-------------|--------|
| R2 — Importer les enums | Tous les statuts : `StatutAbonnement.ACTIF`, `StatutPaiementAbo.CONFIRME`, `StatutCommissionIng.EN_ATTENTE` | PASS |
| R4 — Opérations atomiques | activerAbonnement, suspendreAbonnement, expirerAbonnement → `updateMany` avec condition | PASS |
| R4 — Opérations atomiques | confirmerPaiement → `updateMany` idempotent sur referenceExterne | PASS |
| R4 — Opérations atomiques | demanderRetrait → `$transaction` avec `updateMany` conditionnel sur solde | PASS |
| R4 — Opérations atomiques | rendreCommissionsDisponibles → `updateMany` sur createdAt | PASS |
| R8 — siteId | siteId obligatoire sur createPaiementAbonnement, createCommission, demanderRetrait | PASS |
| R8 — siteId | getRemises filtre par siteId (nullable pour globales) | PASS |
| Pas de N+1 | getPortefeuille utilise `$transaction` pour requêtes parallèles | PASS |
| Pas de `any` | Aucun type `any` dans les 5 fichiers | PASS |

---

## Fichiers revus

### src/lib/queries/plans-abonnements.ts
- `getPlansAbonnements` : filtre actif/public, include `_count` abonnements actifs
- `togglePlanAbonnement` : read-then-updateMany acceptable ici (pas de race condition sur activation de plan)

### src/lib/queries/abonnements.ts
- Toutes les transitions de statut via `updateMany` avec condition (R4)
- `getAbonnementActif` : `findFirst` avec `statut IN [ACTIF, EN_GRACE]` — correct
- `getAbonnementsEnGraceExpires` : filtre sur `dateFinGrace` correct

### src/lib/queries/paiements-abonnements.ts
- `confirmerPaiement` : idempotent via `updateMany` sur referenceExterne + statut IN [EN_ATTENTE, INITIE]
- `getPaiementByReference` : pour les webhooks — correct

### src/lib/queries/remises.ts
- `appliquerRemise` : transaction atomique — increment puis create — correct (R4)
- `verifierRemiseApplicable` : logique de validation complète

### src/lib/queries/commissions.ts
- `demanderRetrait` : `$transaction` atomique avec vérification de solde via `updateMany` conditionnel (R4)
- `traiterRetrait` : remboursement automatique si ECHEC — logique correcte

---

## Note sur index.ts
Toutes les nouvelles fonctions exportées depuis `src/lib/queries/index.ts`.

---

## Verdict : APPROUVÉ

Story 30.4 peut passer en FAIT.
