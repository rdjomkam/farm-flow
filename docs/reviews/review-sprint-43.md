# Review Sprint 43 — Plans configurent les modules

**Date :** 2026-03-21
**Reviewer :** @code-reviewer
**Stories :** 43.1, 43.2, 43.3, 43.4, 43.5, 43.6

---

## Verdict : VALIDÉ (après corrections)

Le Sprint 43 est correctement implémenté. La feature principale (`modulesInclus` sur `PlanAbonnement` + `applyPlanModules`) est correcte, sécurisée et testée.

Deux problèmes bloquants identifiés dans les tests ont été corrigés :
- P1 : `TypePlan.GRATUIT` et `TypePlan.PREMIUM` inexistants → remplacés par `DECOUVERTE`, `PROFESSIONNEL`, `ENTREPRISE`
- P2 : Test "plan inactif sans auth → 404" faux positif → corrigé en 401 avec mock AuthError

---

## Checklist R1-R9

| Règle | Statut | Notes |
|-------|--------|-------|
| R1 — Enums MAJUSCULES | PASS | SiteModule, TypePlan en UPPERCASE |
| R2 — Import des enums | PASS | SiteModule, TypePlan importés depuis @/types |
| R3 — Prisma = TypeScript identiques | PASS | `modulesInclus SiteModule[]` aligné Prisma/TS |
| R4 — Opérations atomiques | PASS | `applyPlanModules` fait site.update direct |
| R5 — DialogTrigger asChild | PASS | plan-form-dialog.tsx conforme |
| R6 — CSS variables du thème | PASS | Pas de couleurs hardcodées |
| R7 — Nullabilité explicite | PASS | `modulesInclus` NOT NULL DEFAULT [] |
| R8 — siteId PARTOUT | PASS | PlanAbonnement global (exception documentée) |
| R9 — Tests avant review | PASS | 32 tests Sprint 43, build OK |

---

## Sécurité

| Point | Statut |
|-------|--------|
| Modules platform rejetés en API (POST/PUT) | OK |
| Double barrière dans applyPlanModules (filtre PLATFORM_MODULES) | OK |
| Webhook Smobilpay : vérification HMAC | OK |
| Webhook manuel : requirePermission ABONNEMENTS_GERER | OK |

---

## Architecture

| Composant | Implementation | Statut |
|-----------|---------------|--------|
| Schema Prisma | `modulesInclus SiteModule[] @default([])` | Correct |
| Migration | ALTER TABLE ADD COLUMN avec DEFAULT | Correct |
| API validation | SITE_TOGGLEABLE_MODULES filtre les platform | Correct |
| applyPlanModules | findUnique + site.update, filtre PLATFORM_MODULES | Correct |
| applyPlanModulesTx | Variante transactionnelle identique | Correct |
| UI form | Checkboxes modules dans plan-form-dialog | Correct |
| UI liste | ModuleBadgeList dans plans-admin-list | Correct |
| Webhooks | Fire-and-forget avec .catch() | Correct |

---

## Tests

| Suite | Tests | Statut |
|-------|-------|--------|
| apply-plan-modules.test.ts | 17 | PASS |
| plans.test.ts | 15 | PASS |
| **Total Sprint 43** | **32** | **PASS** |

Build : PASS — toutes les routes compilent sans erreur.

---

## Problèmes corrigés

| # | Sévérité | Description | Statut |
|---|----------|-------------|--------|
| P1 | Haute | `TypePlan.GRATUIT`/`PREMIUM` inexistants dans tests | Corrigé |
| P2 | Haute | Test "plan inactif → 404" faux positif (réalité: 401) | Corrigé |

---

## Dette technique (non-bloquante)

- i18n incomplète dans plan-form-dialog.tsx (strings FR en dur — dette Sprint 38)
- 3x `as any` dans plans-abonnements.ts (limitation Prisma enum arrays)
- webhook manuel : applyPlanModules en fire-and-forget (discutable pour action admin)

---

## Décision finale

**Sprint 43 VALIDÉ. Sprint 44 peut démarrer.**
