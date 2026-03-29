# Review Sprint NA — Navigation Phase 1: Corrections urgentes

**Date :** 2026-03-29
**Reviewer :** @code-reviewer
**Verdict : ACCEPTÉ**

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
| R9 — Tests | PASS (3559 tests) |

## Conformité ADR

| Section | Résultat |
|---------|----------|
| §2.2 Routes partagées racine | PASS — /packs, /activations, /mes-taches à src/app/ |
| §3bis.2 INGENIEUR_ONLY | PASS — 4 prefixes |
| §3bis.2 FARM_ONLY | PASS — 7 prefixes |
| §3bis.2 SuperAdmin bypass | PASS |
| §4.3 FarmBottomNav items | PASS |
| §5.3 IngenieurBottomNav items | PASS |
| §5.4 IngenieurSidebar groupes | PASS — 6 groupes dont Configuration |
| §10.2 Clés i18n | PASS |
| §12 Icônes canoniques | PASS |

## Problèmes identifiés (non bloquants)

| # | Sévérité | Description |
|---|----------|-------------|
| M1 | Moyenne | FarmBottomNav : 6 labels de groupes hardcodés, non i18n |
| M2 | Moyenne | IngenieurSidebar : tous labels hardcodés, pas de useTranslations |
| B1 | Basse | Asymétrie groupLabel vs groupKey entre les deux bottom navs |
| B2 | Basse | Guard E11 : rôle inconnu non explicitement rejeté (comportement global sûr) |
| B3 | Basse | Cookie is_super_admin forgeable — acceptable si requireSuperAdmin() protège les routes |

Aucun problème Critique ou Haute.
