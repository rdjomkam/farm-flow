# Review ADR-022 — Backoffice Separation

**Date :** 2026-03-22
**Reviewer :** @code-reviewer
**Scope :** ADR-022 — 24 stories, 5 sprints (A-E)

---

## Verdict : VALIDE

## Checklist R1-R9

| # | Regle | Statut |
|---|-------|--------|
| R1 | Enums MAJUSCULES | PASS |
| R2 | Import des enums | PASS — Permission, SiteModule, Role importes |
| R3 | Prisma = TypeScript | PASS — isSuperAdmin Boolean = isSuperAdmin: true |
| R4 | Operations atomiques | PASS |
| R5 | DialogTrigger asChild | N/A |
| R6 | CSS variables | PASS — text-primary, bg-primary/10, border-border |
| R7 | Nullabilite explicite | PASS — email: string | null, phone: string | null |
| R8 | siteId | PASS — BackofficeSession sans siteId (exemption documentee) |
| R9 | Tests + build | PASS — 3158 tests, build OK |

## Securite

- requireSuperAdmin() lit isSuperAdmin depuis la DB (pas le cookie) — CONFORME
- Double couche: layout Server Component + routes API — CONFORME
- 10 routes /api/backoffice/* toutes protegees par requireSuperAdmin — CONFORME

## Points forts

- isPlatform entierement supprime du code fonctionnel (0 references)
- BackofficeSession type avec isSuperAdmin: true (literal discriminant)
- Layout backoffice separe avec sidebar/header dedies
- Mobile first: hamburger + Sheet Radix pour navigation mobile
- CSS variables du theme uniquement, zero hexa en dur

## Bilan ADR-022 complet (Sprints A-E)

| Sprint | Scope | Statut |
|--------|-------|--------|
| A | Schema isSuperAdmin + types + guards | FAIT |
| B | Suppression dependances isPlatform | FAIT |
| C | Creation backoffice (layout, API, pages) | FAIT |
| D | Suppression code admin obsolete | FAIT |
| E | Validation finale + review | FAIT |

**24 stories completees, 0 bloquees.**

## Decision
**VALIDE.** ADR-022 Backoffice Separation entierement implemente.
