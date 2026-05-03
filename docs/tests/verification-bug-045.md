# Verification Report — BUG-045
**Date :** 2026-05-03
**Verified by :** @tester
**Fix author :** @developer

---

## Fix verified: YES

---

## 1. Source code analysis

### vivants sourced from existing vivantsByBac map (no recomputation, no extra DB query)

Confirmed. In `src/components/pages/vague-detail-page.tsx`:
- `vivantsByBac` is computed once at line 123 via `computeVivantsByBac(vague.bacs, relevesForVivants, vague.nombreInitial)`.
- At lines 342-345, `bacsActifs` is built by spreading each active assignation and adding `vivants: vivantsByBac.get(a.bacId) ?? a.nombrePoissons ?? null`.
- No second call to `computeVivantsByBac`. No new Prisma query. The existing `relevesForVivants` data (already fetched) feeds the computation.

### Fallback when vivantsByBac.get(a.bacId) is undefined

The expression `vivantsByBac.get(a.bacId) ?? a.nombrePoissons ?? null` correctly chains:
1. Map hit → use computed vivants.
2. Map miss (undefined) → fall back to `a.nombrePoissons` (the stale DB field, better than nothing).
3. Both null/undefined → null (display nothing).

### Component handles all three cases

In `src/components/vagues/vague-bacs-section.tsx` lines 47-55:
- `a.vivants != null && a.nombrePoissonsInitial != null` → renders `t("poissonsActuels", { count: a.vivants, initial: a.nombrePoissonsInitial })` → "X actuels (Y au départ)".
- `a.vivants != null` (no initial) → renders `t("poissons", { count: a.vivants })` → "X poissons".
- Neither condition met → renders nothing (null branch).

All three cases are verified correct.

### Retired bacs (bacsRetires) unchanged

The `bacsRetires` prop is populated directly from `assignationsDb.filter((a) => a.dateFin !== null) as AssignationBacForVague[]` (line 346) — no `vivants` enrichment applied. The component renders `bacsRetires` exclusively using `a.nombrePoissonsInitial` via `t("poissonsDepart", ...)`. No regression on retired bacs.

### i18n keys exist in both locales with consistent placeholders

| Locale | Key path | Value |
|--------|----------|-------|
| fr | `bacsSection.poissonsActuels` | `{count} actuels ({initial} au départ)` |
| en | `bacsSection.poissonsActuels` | `{count} current ({initial} at start)` |

Both files present. Placeholders `{count}` and `{initial}` are consistent. Both locales also have the pre-existing `bacsSection.poissons` key (`{count} poissons` / `{count} fish`) which is the fallback used when `vivants` is defined but `nombrePoissonsInitial` is null.

### TypeScript prop type

In `src/components/vagues/vague-bacs-section.tsx` line 14:
```
bacsActifs: (AssignationBacForVague & { vivants: number | null })[];
```
Strongly typed intersection — not `any`. Confirmed.

---

## 2. New regression tests

File: `src/components/vagues/__tests__/vague-bacs-section.test.tsx`

All 4 BUG-045 tests **PASS** (verified by running vitest on the isolated file).

| # | Test description | Result |
|---|-----------------|--------|
| 1 | "affiche 'X actuels (Y au départ)' quand vivants et nombrePoissonsInitial sont définis" | PASS |
| 2 | "affiche 'X poissons' quand vivants est défini mais nombrePoissonsInitial est null" | PASS |
| 3 | "ne crashe pas et n'affiche rien de lié aux poissons quand vivants est null" | PASS |
| 4 | "les bacs retirés affichent toujours nombrePoissonsInitial (comportement inchangé)" | PASS |

---

## 3. Full suite status

```
Test Files   5 failed | 153 passed (158)
Tests       37 failed | 4917 passed | 26 todo (4980)
```

The 37 failures and 5 failing files are **identical to the pre-existing baseline** documented in `rapport-bugs-041-042-043.md` and confirmed again in `verification-bug-044.md`:

| File | Failures | Root cause |
|------|----------|-----------|
| `src/__tests__/ui/vagues-page.test.tsx` | 12 | `next-intl` mock missing `useLocale` export |
| `src/__tests__/ui/feed-analytics-ui.test.tsx` | 16 | Same `useLocale` mock issue |
| `src/__tests__/ui/analytics-bacs.test.tsx` | 7 | Same `useLocale` mock issue |
| `src/__tests__/ui/analytics-aliments.test.tsx` | 1 | Same `useLocale` mock issue |
| `src/__tests__/api/sites.test.ts` | 1 | Unrelated API assertion on siteRole shape |

None of these failures are related to BUG-045. No new failures introduced.

---

## 4. Build status

`next build --webpack` (equivalent to `npm run build`): **exit code 0**, `BUILD_ID` produced (`p1TR_Yg11NaYC4JU3Mnfw`), route `/vagues/[id]` compiled without errors.

Note: `next build` without `--webpack` hangs indefinitely on this machine due to a Turbopack + multiple-lockfiles conflict (pre-existing environment issue, unrelated to BUG-045). Using `--webpack` is the documented build path (`npm run build` in package.json also uses `--webpack`).

---

## 5. Other callsites of VagueBacsSection

`grep -rn "VagueBacsSection" src/` returns exactly two production references:
1. `src/components/vagues/vague-bacs-section.tsx` — the component definition.
2. `src/components/pages/vague-detail-page.tsx` — the single production callsite.

No other page or component renders `VagueBacsSection`. The updated prop type requiring `vivants: number | null` on `bacsActifs` cannot cause a type break elsewhere because there is no other caller. The test file (`vague-bacs-section.test.tsx`) is the only other reference, and it explicitly constructs the enriched type inline.

---

## 6. i18n key orphan check

The new key `bacsSection.poissonsActuels` is:
- Defined in `src/messages/fr/vagues.json` line 220.
- Defined in `src/messages/en/vagues.json` line 220.
- Referenced in `src/components/vagues/vague-bacs-section.tsx` line 49: `t("poissonsActuels", { count: a.vivants, initial: a.nombrePoissonsInitial })`.
- Referenced in the test mock template table at `vague-bacs-section.test.tsx` line 18.

No orphaned keys. The key is actively used.

---

## 7. Concerns

**One minor concern (non-blocking, test quality):**

The `makeAssignation` helper in the new test file does not set `poidsMoyenInitial`, `createdAt`, or `updatedAt`, causing a TypeScript type error (`TS2322`) when running `tsc --noEmit`. The error is: `Type 'number | null | undefined' is not assignable to type 'number | null'` on `poidsMoyenInitial`. This is a test helper strictness issue, not a production code issue. `next build` does not type-check `src/components/vagues/__tests__/` files and the tests themselves pass without error via vitest. Recommend fixing the helper in a follow-up by adding `poidsMoyenInitial: null, createdAt: new Date(), updatedAt: new Date()` to the default shape.

**No blocking concerns. Fix is correct and complete.**
