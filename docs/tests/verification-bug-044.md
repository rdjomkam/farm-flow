# Verification Report — BUG-044
**Date :** 2026-05-03
**Verified by :** @tester
**Fix author :** @developer

---

## Fix verified: YES

---

## 1. Query fix verification

### getVagueById (lines 51-76)

The `assignations.bac` select at line 51 now includes `nombreInitial: true` and `poidsMoyenInitial: true`.

Both branches of the UNION are correctly patched:

- **Active-assignations branch** (line 64-66): the map now propagates `nombreInitial` and `poidsMoyenInitial` from each `a.bac`.
- **Legacy bac.vagueId branch** (line 70): the fallback map also propagates `b.nombreInitial` and `b.poidsMoyenInitial` directly from the Prisma `Bac` model (which always had those fields — they were never missing from the legacy branch, only from the assignations branch).

The intermediate `Map` type is explicitly typed as `Map<string, { id: string; nom: string; volume: number | null; nombreInitial: number | null; poidsMoyenInitial: number | null }>` — sound.

The final `cast` is `finalBacs as import("@/types").Bac[]` which is consistent with existing patterns in this file. The shape satisfies the `Bac` interface.

### getVagueByIdWithReleves (lines 83-142)

Same fix applied symmetrically:

- `assignations` filter uses `where: { dateFin: null }` (active-only — correct for the "current bacs" use case).
- The select on `assignations.bac` now includes `nombreInitial: true` and `poidsMoyenInitial: true` (line 101).
- Both branches of the byIdWithReleves union map (lines 131-134) propagate both fields.

One minor structural difference vs `getVagueById`: in `getVagueById` the active-assignations branch filters with `.filter((a) => a.dateFin === null)` at runtime after fetching all assignations; in `getVagueByIdWithReleves` the filter is pushed into the Prisma `where` clause. Both produce the correct set of active bacs.

---

## 2. New regression tests (BUG-044 describe block)

File: `src/__tests__/survie-calculs.test.ts`, lines 296-376.

| Test | Description | Assertion verified | Result |
|------|-------------|-------------------|--------|
| "avec nombreInitial réel : les vivants reflètent la distribution 3500/1800/200" | Passes `bacsAvecNombreInitial` (3500/1800/200) and empty releves | `get("bac-a")===3500`, `get("bac-b")===1800`, `get("bac-c")===200`, total===5500 | PASS |
| "BUG : sans nombreInitial (undefined strippé), les vivants tombent sur la répartition uniforme ≈ 1833" | Passes `bacsSansNombreInitial` (all null) and empty releves — simulates pre-fix behavior | `get("bac-a")===1833`, `get("bac-b")===1833`, `get("bac-c")===1834` (last bac gets remainder), total===5500 | PASS |
| "le poids moyen pondéré diffère significativement entre les deux cas (bug vs fix)" | Computes weighted average under both inputs with bac-a=45g, bac-b=50g, bac-c=80g | `poidsMoyenFix ≈ 47.91g`, `poidsMoyenBug > poidsMoyenFix + 5` (confirmed: ≈58.5g) | PASS |

All 3 BUG-044 tests pass. Full survie-calculs.test.ts: **19/19 passed**.

---

## 3. Full suite status

**5 test files failed | 152 test files passed (157 total)**
**37 tests failed | 4913 tests passed | 26 todo (4976 total)**

The 5 failing files and 37 failing tests are **identical to the pre-existing baseline** documented in `docs/tests/rapport-bugs-041-042-043.md` (section "Failure file set is identical"):

| File | Failures | Root cause |
|------|----------|-----------|
| `src/__tests__/ui/feed-analytics-ui.test.tsx` | 16 | `next-intl` mock does not export `useLocale` — `alerte-dlc.tsx:22` throws |
| `src/__tests__/ui/vagues-page.test.tsx` | 12 | `next-intl` mock does not export `useLocale` — `vague-card.tsx:24` throws |
| `src/__tests__/ui/analytics-bacs.test.tsx` | 7 | Same `useLocale` mock issue |
| `src/__tests__/ui/analytics-aliments.test.tsx` | 1 | Same `useLocale` mock issue |
| `src/__tests__/api/sites.test.ts` | 1 | Unrelated API assertion on siteRole shape |

These failures are pre-existing tech-debt (missing `useLocale` in `next-intl` mock stubs), fully documented in `rapport-bugs-041-042-043.md` as "should be tracked as a dedicated BUG/tech-debt ticket". None are related to BUG-044.

---

## 4. Build status

`npm run build` completed with **0 TypeScript errors** and **0 compilation errors**. One non-blocking advisory warning (`outputFileTracingRoot`) is pre-existing.

---

## 5. Call-site audit

All production call sites of `computeVivantsByBac` audited:

| File | Bac source | nombreInitial present? |
|------|-----------|------------------------|
| `src/components/pages/vague-detail-page.tsx:123` | `vague.bacs` from `getVagueById` (fixed) | YES — fix applied here |
| `src/app/api/vagues/[id]/gompertz/route.ts:69` | `vague.bacs` from direct Prisma select with `nombreInitial: true` (line 32) | YES — was never broken |
| `src/lib/queries/dashboard.ts:88,186` | `v.bacs` from `prisma.vague.findMany` with `select: { id, volume, nombreInitial }` (line 37) | YES — was never broken |
| `src/lib/queries/indicateurs.ts:73` | `vague.bacs` from `prisma.vague.findFirst` with `select: { id, nombrePoissons, nombreInitial, poidsMoyenInitial }` (line 25) | YES — was never broken |
| `src/lib/activity-engine/context.ts` | Uses local query, not `getVagueById` | Out of scope for this fix |

The developer's audit is confirmed: only `vague-detail-page.tsx` was affected, because it was the only call site that obtained its bacs through `getVagueById`'s UNION logic where the `assignations.bac` select was previously stripping `nombreInitial`.

---

## 6. Concerns / Follow-ups

**No blocking concerns.**

Minor observation (non-blocking): the last bac in the uniform-fallback receives `floor(N/k) + remainder` which means the third test's assertion `get("bac-c") === 1834` assumes sorted iteration order of the `Map`. The current implementation uses `Array.from(byId.values())` which preserves insertion order. This is fine in all modern JS engines but is worth noting if the bac order ever changes.

Pre-existing tech debt (not introduced by this fix): the 37 failing tests due to missing `useLocale` in `next-intl` mocks should be resolved in a dedicated sprint (opened as BUG or tech-debt item). See `rapport-bugs-041-042-043.md` for tracking.
