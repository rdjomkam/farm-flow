---
stepsCompleted: [1, 2, 3, 4]
inputDocuments: ['docs/decisions/ADR-ingenieur-interface.md']
session_topic: 'Ingenieur vs Proprietaire interface split for FarmFlow'
session_goals: 'Concrete architectural decisions for developer handoff + broader UX philosophy exploration'
selected_approach: 'ai-recommended'
techniques_used: ['Role Playing', 'First Principles Thinking', 'Morphological Analysis']
ideas_generated: ['Role-Play #1: Owner-Operator Paradox', 'Role-Play #2: FAB is Frequency-Driven', 'Role-Play #3: Ingenieur Layout is Persistent Shell', 'Role-Play #4: Layout Sets Defaults Permissions Override', 'Role-Play #5: Ingenieur Always Sees Ingenieur View', 'Role-Play #6: Owner is Sovereign Over Permissions', 'Role-Play #7: Only Two Layouts Role Determines Which', 'Role-Play #8: Ingenieur Own Farm = Full-Permission Client Farm', 'FP #1: Y1 Stub Re-export Architecture', 'FP #2: Login Redirect is Role-Based One Rule', 'FP #3: Middleware Guards Route Groups', 'FP #4: Backoffice Access is isSuperAdmin']
context_file: 'docs/decisions/ADR-ingenieur-interface.md'
---

# Brainstorming Session Results

**Facilitator:** Ronald
**Date:** 2026-03-28

## Session Overview

**Topic:** How to split the FarmFlow interface into Ingenieur vs Proprietaire experiences, resolving 5 design tensions: role detection, layout strategy, solo-farmer persona, site-switching, permission-vs-role visibility.

**Goals:**
- Broad: Establish the right UX philosophy before committing
- Concrete: Produce decisions on schema, middleware, routing, nav that a developer can implement

### Context Guidance

- ADR proposes two Next.js route groups (Option A) with role-based redirect
- Adversarial review found 12 issues including: isIngenieur redundant with Role enum, GERANT/PISCICULTEUR roles ignored, BOTH classification is hand-waving, no middleware exists
- Edge case hunter found 21 unhandled paths including: user who is both ingenieur and owner, solo farmer locked out of releve creation, site-switching layout mismatch

## Technique Selection

**Approach:** AI-Recommended Techniques

**Recommended Techniques:**
- **Role Playing:** Embody 5 real user personas to validate or destroy the 2-audience assumption
- **First Principles Thinking:** Strip away existing architecture to find the simplest correct approach
- **Morphological Analysis:** Grid of 5 design tensions x solution options to produce concrete decisions

## Technique Execution Results

### Phase 1: Role Playing — 5 Personas

#### Persona 1: Mama Ngo (Solo PISCICULTEUR)
Owns a small farm, does everything herself — feeds fish, records releves, sells at market.

**Key Finding:** She's an owner who happens to do technical work. The interface split cannot block her from operational modules. She gets the farm layout with full permissions (she's the owner, she controls everything). Navigating through Ma ferme > Vague > +Releve is acceptable for her low-volume workflow.

**Insight:** The layout split is about navigation priority, not access control.

#### Persona 2: Ing. Tchoupo (INGENIEUR managing 3 farms)
Field technician managing Ferme Kamdem, Ferme Ateba, Ferme Nlend. Paid via commissions.

**Key Finding:** When Tchoupo switches to a client farm, he STAYS in the ingenieur layout. The layout adapts scope (multi-farm vs single-farm) but the nav shell never changes. The ingenieur layout is a persistent shell that works at two levels.

**Insight:** The ingenieur layout is essentially a full app experience — its own dashboard, operational pages, just with a different nav shell.

#### Persona 3: M. Kamdem (PISCICULTEUR who hired an ingenieur)
Businessman, checks app 2-3x/week. Cares about: are fish alive, how much money, is ingenieur doing his job.

**Key Finding:** Same role and layout as Mama Ngo (PISCICULTEUR → farm layout), but radically different usage. The permission system and user behavior naturally filter engagement. No need for a separate "investor" layout.

#### Persona 4: Mme. Essono (GERANT)
Hired by M. Kamdem to run the farm day-to-day. Does operational AND some business work.

**Key Finding:** GERANT gets the farm layout. She's not a third audience — she's a permission profile within the farm layout. The owner (M. Kamdem) decides exactly which modules she can see via SiteMember permissions.

#### Persona 5: Ing. Tchoupo's Own Farm
What if an ingenieur also owns a personal farm?

**Key Finding:** His own farm appears as another farm in his ingenieur client list. Since he's the owner, he grants himself all permissions — so he sees finances, settings, everything on that farm. The ingenieur layout handles it naturally. No layout switching needed.

### Phase 1 Summary — ADR Assumptions Destroyed

| ADR Assumption | What We Found |
|---|---|
| INGENIEUR-only vs OWNER-only modules | Wrong. No role-locked modules. Permissions control everything. |
| Two audiences need different module access | Wrong framing. Two audiences need different **navigation priorities**. |
| BOTH = context-adaptive pages | Unnecessary concept. Every page is just a page. The layout shell differs, not the page. |
| GERANT needs special handling | No. GERANT gets farm layout + owner-assigned permissions. |
| isIngenieur flag on User | Redundant. `role === INGENIEUR` is sufficient. |
| FAB is role-based | No. Frequency-based — ingenieur gets it because of multi-farm volume. |

### Core Principles Established

1. **The layout is a navigation skin optimized for a workflow pattern. Permissions are the real access control. The layout never blocks — it only prioritizes.**
2. **INGENIEUR role = ingenieur layout, always. Everyone else = farm layout, always.**
3. **The PISCICULTEUR (farm owner) is the sole authority on who sees what on their farm.**

### Phase 2: First Principles Thinking

#### Architecture Decision: Y1 Stub Re-export

Two Next.js route groups with shared page components:

```
src/components/pages/vagues-page.tsx    -> real logic
src/app/(farm)/vagues/page.tsx          -> export { default } from "@/components/pages/vagues-page"
src/app/(ingenieur)/vagues/page.tsx     -> export { default } from "@/components/pages/vagues-page"
```

**Why Y1:**
- "Ingenieur always sees ingenieur layout" rule holds
- Zero logic duplication — stubs are 1-line re-exports
- Each layout can diverge per-page if needed (pass perspective prop)
- Middleware is simple — one redirect rule per group
- Incremental migration — move pages one at a time

#### Route Structure

```
(farm)/                  -> farm layout shell
  vagues/                -> stub -> shared component
  releves/               -> stub -> shared component
  stock/                 -> stub -> shared component
  bacs/                  -> stub -> shared component
  analytics/             -> stub -> shared component
  planning/              -> stub -> shared component
  notes/                 -> stub -> shared component
  finances/              -> farm-exclusive (owner pages)
  ventes/                -> farm-exclusive
  factures/              -> farm-exclusive
  clients/               -> farm-exclusive
  mon-abonnement/        -> farm-exclusive
  settings/sites/        -> farm-exclusive
  settings/alertes/      -> stub -> shared component
  users/                 -> farm-exclusive
  depenses/              -> stub -> shared component

(ingenieur)/             -> ingenieur layout shell
  vagues/                -> stub -> shared component
  releves/               -> stub -> shared component
  stock/                 -> stub -> shared component
  bacs/                  -> stub -> shared component
  analytics/             -> stub -> shared component
  planning/              -> stub -> shared component
  notes/                 -> stub -> shared component
  monitoring/            -> ingenieur-exclusive (multi-farm)
  portefeuille/          -> ingenieur-exclusive
  packs/                 -> ingenieur-exclusive
  activations/           -> ingenieur-exclusive
  settings/alertes/      -> stub -> shared component
  depenses/              -> stub -> shared component

(backoffice)/            -> backoffice layout (already exists)
  ...                    -> platform-exclusive
```

#### Middleware Redirect Logic

```
if (user.isSuperAdmin) -> /(backoffice)/
else if (user.role === INGENIEUR) -> /(ingenieur)/
else -> /(farm)/
```

Middleware also enforces layout boundaries:
- INGENIEUR hitting `/(farm)/*` -> redirect to `/(ingenieur)/*` equivalent
- Non-INGENIEUR hitting `/(ingenieur)/*` -> redirect to `/(farm)/`

#### Navigation

**Farm layout bottom-nav (5 items):**
1. Accueil (farm dashboard)
2. Ma ferme (vagues, bacs, releves, calibrages)
3. Finances (ventes, factures, depenses) — visible if FINANCES_VOIR permission
4. Messages (notes, echanges)
5. Menu (stock, alevins, planning, parametres, abonnement)

**Ingenieur layout bottom-nav (5 items):**
1. Accueil (multi-farm dashboard OR single-farm dashboard when scoped)
2. Mes taches
3. +Releve (FAB — quick action for high-volume workflow)
4. Mes clients (monitoring)
5. Menu (notes, portefeuille, packs, stock, profil)

### Phase 3: Morphological Analysis — Decision Matrix

| # | Tension | Decision | Schema Impact | Implementation |
|---|---|---|---|---|
| 1 | Role detection | `User.role` enum (existing) | None | middleware.ts reads role |
| 2 | Layout strategy | Y1 — two route groups + stub re-exports | None | `(farm)/layout.tsx`, `(ingenieur)/layout.tsx`, ~20 stubs, components in `src/components/pages/` |
| 3 | Solo farmer | Farm layout + full permissions via SiteMember | None | Nav components read permissions to show/hide items |
| 4 | Site-switching | Ingenieur stays in ingenieur layout, data scope changes | None | Ingenieur nav adapts to single-farm vs multi-farm |
| 5 | Module visibility | Layout = nav structure, permissions = content visibility | None | `bottom-nav.tsx` and `sidebar.tsx` per layout group |

**ZERO schema migrations. ZERO new database fields. The entire feature is a frontend routing + navigation change.**

## Key Decisions Summary

1. **No `isIngenieur` flag** — use existing `User.role === INGENIEUR`
2. **No `isSuperAdmin` for layout** — isSuperAdmin only redirects to backoffice
3. **Two route groups** — `(farm)` and `(ingenieur)` in Next.js App Router
4. **Shared pages as stubs** — real components in `src/components/pages/`, 1-line re-exports in each route group
5. **Middleware enforces layout boundaries** — redirects users to correct route group based on role
6. **Permissions control module visibility** — layout never blocks, only organizes navigation
7. **Owner is sovereign** — PISCICULTEUR controls all permission grants on their farm
8. **Ingenieur layout is persistent** — never changes when switching between farms
9. **GERANT = farm layout + permissions** — not a third audience
10. **FAB (+Releve) is ingenieur-only** — frequency-based optimization, solo farmers use Ma ferme > Vague > +Releve
