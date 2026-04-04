# Review — Sprint 47

**Date :** 2026-04-04
**Reviewer :** @code-reviewer
**Sprint :** 47 — API Routes Adaptation (Subscription Refactoring)
**Stories :** 47.1 (bacs/vagues isBlocked + quota), 47.2 (abonnements garde-fou 409 + audit), 47.3 (billing user-level + renouveler soldeCredit), 47.4 (test + review)

---

## Checklist R1-R9

| # | Regle | Statut | Notes |
|---|-------|--------|-------|
| R1 | Enums MAJUSCULES | PASS | Toutes les valeurs enum en UPPERCASE |
| R2 | Importer les enums | PASS | Corrige apres review: `as TypePlan` au lieu de `as string` (ERR-031) |
| R3 | Prisma = TypeScript | PASS | Alignement respecte |
| R4 | Operations atomiques | PASS | $transaction pour garde-fou 409, soldeCredit, quota bacs/vagues/sites |
| R5 | DialogTrigger asChild | N/A | Pas de Dialog dans ce sprint |
| R6 | CSS variables | N/A | Pas d'UI dans ce sprint |
| R7 | Nullabilite explicite | PASS | Champs optionnels explicites |
| R8 | siteId PARTOUT | PASS | auth.activeSiteId sur toutes les creations |
| R9 | Tests avant review | PASS | 3988 tests, 126 fichiers, 0 echec |

---

## Findings corriges dans ce sprint

### F-001 (Moyenne → CORRIGE) — R2/ERR-031 : `as string` dans bacs et vagues routes
- `bacs/route.ts` et `vagues/route.ts` utilisaient `as string` pour acceder a PLAN_LIMITES
- Corrige: `PLAN_LIMITES[abonnement.plan.typePlan as TypePlan]`

### F-003 (Basse → CORRIGE) — R2 : statutsRenouvellables type string[]
- `renouveler/route.ts` declarait `string[]` au lieu de `StatutAbonnement[]`
- Corrige avec cast `as StatutAbonnement`

### F-004 (Haute → CORRIGE) — Quota sites manquant dans POST /api/sites
- La route ne verifiait pas le quota de sites autorise par le plan
- Ajoute: `getSubscriptionStatus` (402 si pas d'abonnement) + `getQuotaSites` (403 si quota atteint)
- Tests ajoutes: quota atteint → 403, pas d'abonnement → 402

---

## Findings reportes (Sprint 48+)

### F-002 (Moyenne) — getAbonnementActifPourSite hors contexte tx
- Dans bacs/vagues routes, la lecture de l'abonnement n'est pas dans le meme snapshot de transaction
- Risque faible en pratique (changements d'abonnement rares vs creation bacs)

### F-007 (Moyenne) — confirmerPaiement + activerAbonnement non atomiques
- `billing.ts`: deux appels sequentiels hors $transaction
- Pre-existant (Sprint 31), pas dans le perimetre Sprint 47

---

## Tests

- **126 fichiers** / **3988 tests** / **0 echec**
- Nouveaux tests: sites quota (403), sites abonnement (402)

## Verdict

**SPRINT 47 — VALIDE**
