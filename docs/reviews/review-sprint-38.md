# Review Sprint 38 — Admin CRUD Plans d'Abonnement

**Date :** 2026-03-21
**Reviewer :** @code-reviewer
**Stories :** 38.1, 38.2, 38.3, 38.4, 38.5, 38.6, 38.7

---

## Verdict : VALIDÉ

---

## Checklist R1-R9

| Règle | Statut | Notes |
|-------|--------|-------|
| R1 — Enums MAJUSCULES | PASS | SiteModule, TypePlan, StatutAbonnement — tous UPPERCASE |
| R2 — Import des enums | PASS | `as any` utilisé 3x dans plans-abonnements.ts (contournement ERR-008) |
| R3 — Prisma = TypeScript identiques | PASS | SiteModule 12 valeurs alignées |
| R4 — Opérations atomiques | PASS | togglePlanAbonnement via $transaction |
| R5 — DialogTrigger asChild | PASS | plan-form-dialog.tsx et plans-admin-list.tsx conformes |
| R6 — CSS variables du thème | PASS | Aucune couleur hex en dur |
| R7 — Nullabilité explicite | PASS | Champs nullable correctement typés |
| R8 — siteId PARTOUT | PASS | PlanAbonnement global — exception ADR-020 |
| R9 — Tests avant review | PASS | 189 tests Sprint 38, build OK |

---

## Sécurité

| Point | Verdict |
|-------|---------|
| Page /admin/plans : checkPagePermission(PLANS_GERER) | OK |
| API POST/PUT/DELETE : requirePermission(PLANS_GERER) | OK |
| API GET plan inactif/privé : requirePermission(PLANS_GERER) | OK (corrigé P2) |
| Migration RECREATE pour SiteModule | OK (conforme ERR-001) |
| Modules platform non toggleables par admin site | OK |
| Cohérence sidebar/hamburger | OK |

---

## Problèmes identifiés et corrigés

| # | Sévérité | Description | Statut |
|---|----------|-------------|--------|
| P1 | Moyenne | `as any` x3 dans plans-abonnements.ts (ERR-008) | Accepté — contournement documenté |
| P2 | Moyenne | GET plan inactif sans PLANS_GERER | Corrigé |
| P3 | Basse | Validation limites >= 1 absente côté API POST | Reporté Sprint 39 |
| P4 | Basse | Bouton submit hors du form (Enter ne fonctionne pas) | Reporté Sprint 39 |

---

## Tests

| Fichier | Tests | Statut |
|---------|-------|--------|
| plans-admin-list.test.tsx | 61 | PASS |
| plan-form-dialog.test.tsx | 42 | PASS |
| plan-toggle.test.tsx | 32 | PASS |
| site-modules-config.test.ts | 42 | PASS |
| sites-modules-validation.test.ts | 12 | PASS |
| **Total Sprint 38** | **189** | **PASS** |

Build : PASS — 127 routes, aucune erreur TypeScript.

---

## Décision finale

**Sprint 38 VALIDÉ. Sprint 39 peut démarrer.**

P1 est un contournement connu (ERR-008). P2 a été corrigé. P3 et P4 sont basse sévérité, reportés au Sprint 39.
