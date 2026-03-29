# Review Sprint NB — Navigation Phase 2: Restructuration

**Date :** 2026-03-29
**Reviewer :** @code-reviewer
**Verdict : ACCEPTÉ AVEC REMARQUES**

## Checklist R1-R9

| Règle | Statut |
|-------|--------|
| R1 — Enums MAJUSCULES | PASS |
| R2 — Import des enums | PASS |
| R3 — Prisma = TypeScript | N/A |
| R5 — DialogTrigger asChild | N/A |
| R6 — CSS variables | PASS |
| R7 — Nullabilité | PASS |
| R8 — siteId | N/A |
| R9 — Tests | PASS (3614 tests, +55 nouveaux) |

## Conformité ADR

| Section | Résultat |
|---------|----------|
| §3 Permission gating algorithm | PASS — nav-gating.ts conforme |
| §4.1-4.4 Farm layout | PASS |
| §5.1-5.4 Ingénieur layout | PASS |
| §6 Badge count format | PASS |
| §7 Offline behavior | PASS |
| §8/§9 Skeleton loading | PASS |
| E5 Single-item group | PASS |
| E12 Landscape drawer | PASS |

## Remarques

| # | Sévérité | Description |
|---|----------|-------------|
| NB-1 | Basse | FarmBottomNav: `/observations` non couvert dans isActive "Ma ferme" |
| NB-2 | Basse | FarmHeader: icône Fish vs Waves (cosmétique) |
| NB-4 | Basse | `/besoins`: gate BESOINS_APPROUVER manquante (ANY) |
| NB-5 | Basse | FarmBottomNav: orientationchange non écouté |
| NB-6 | Moyenne | nav-gating.ts non intégré dans les 4 composants (dette technique) |
| NB-8 | Basse | IngenieurBottomNav: "Profil" et "Backoffice" non i18n |
| NB-9 | Basse | AppShell: FarmHeader sans props userSites/activeSiteId |
| NB-10 | Basse | OfflineNavLink: prop activeClassName morte |

Aucun problème Critique ou Haute. Sprint peut être marqué FAIT.
