# Review — BUG-041 & BUG-042

**Reviewer:** @code-reviewer (opus)
**Date:** 2026-04-23
**Verdict:** **APPROVED** — both fixes are clean, surgical, covered by meaningful non-regression tests, and respect all applicable R1-R9 rules. Safe to proceed to @knowledge-keeper + @status-updater.

---

## BUG-041 — AssignationBac dual-write in POST /api/vagues

| Rule | Status | Justification |
|---|---|---|
| R1 Enums UPPERCASE | PASS | `StatutVague.EN_COURS`, `TypePlan.DECOUVERTE` — all uppercase. |
| R2 Import enums | PASS | Imports from `@/types` at top of route; no string literals for enums in the new code. |
| R3 Prisma = TS | PASS | New `tx.assignationBac.create` payload matches `prisma/schema.prisma` exactly: `bacId`, `vagueId`, `siteId`, `dateAssignation: Date`, `dateFin: null` (DateTime?), `nombrePoissonsInitial: Int?`, `poidsMoyenInitial: Float?`, `nombrePoissons: Int?`. `id`, `createdAt`, `updatedAt` auto-generated. |
| R4 Atomic | PASS | The `tx.assignationBac.create` sits inside the existing `prisma.$transaction` callback (line 175), in the same loop as `tx.bac.update` (line 250). Both share the tx. |
| R5 DialogTrigger asChild | N/A | Backend only. |
| R6 CSS variables | N/A | Backend only. |
| R7 Nullability | PASS | `dateFin: null` explicit (matches `DateTime?`). `origineAlevins: data.origineAlevins ?? null` preserved. |
| R8 siteId PARTOUT | PASS | `siteId: auth.activeSiteId` on the new AssignationBac row. |
| R9 Tests before review | PASS | Tester report: 16/16 targeted + 4910 full-suite pass, zero new regressions, build green, E2E API+DB smoke confirmed `nombreBacs: 1` and dual-write persisted. |
| TypeScript strict | PASS | No `any`; explicit types. |
| Input validation | PASS | Full field-by-field validation preserved (lines 68-157). |
| Error handling | PASS | `handleApiError` + QUOTA_DEPASSE path unchanged. |
| Naming convention | PASS | Code English, user messages in French. |
| Prisma N+1 | ACCEPT | Loop issues N updates + N creates (1-5 bacs typical). Mirrors existing `createVague()`. Not a blocker. |

**Test quality:** `vagues-bug041-assignation-dual-write.test.ts` asserts exact call count (2 for 2 bacs), payload shape per bac (incl. `dateFin: null`, `siteId` propagation, `dateAssignation === dateDebut`). Mirrors the calibrages-bug040 pattern. The updated `vagues-distribution.test.ts` closes the original assertion gap.

**Repair script:** `scripts/repair-bug041.sql` is idempotent (NOT EXISTS guard), uses CUID-like id prefix, propagates `siteId` and initial values from Bac. Correct.

**Strengths:** minimal diff, surgical placement, comment tagging ADR-043/BUG-041 for forensic traceability.

**Nit (non-blocker):** the POST handler still duplicates vague-creation logic that lives in `createVague()` (pre-analysis §4). This is the root smell that let BUG-041 ship. Recommend follow-up.

---

## BUG-042 — Dialog mobile scroll + sticky footer

| Rule | Status | Justification |
|---|---|---|
| R1 Enums | N/A | UI wrapper. |
| R2 Import enums | N/A | UI wrapper. |
| R3 Prisma = TS | N/A | No DB. |
| R4 Atomic | N/A | No DB. |
| R5 DialogTrigger asChild | PASS | Fix only touches `DialogContent` inner div and `DialogFooter`. `DialogTrigger` and `DialogPrimitive.Close` structures preserved. |
| R6 CSS variables | PASS | Only theme tokens: `bg-card`, `border-border/40`. No hardcoded hex. `env(safe-area-inset-*)` preserved. |
| R7 Nullability | N/A | UI. |
| R8 siteId | N/A | UI. |
| R9 Tests before review | PASS | 2/2 targeted + no regressions on ~51 consumer dialogs. |
| TypeScript strict | PASS | Existing types untouched. |
| Mobile first | PASS | Mobile defaults: `h-[100dvh] max-h-[100dvh] overflow-y-auto`; desktop via `md:h-auto md:max-h-[85dvh]`. Footer sticky with `border-t` mobile-only (`md:border-0`). Matches pre-analysis prescription. |
| Accessibility | PASS | `sticky bottom-0` stays in keyboard tab order. Radix aria-describedby warning is pre-existing, not introduced by the fix. |
| Safe-area | PASS | `pb-[max(1rem,env(safe-area-inset-bottom))]` preserved on footer; `pt-[max(1rem,env(safe-area-inset-top))]` preserved on content. |

**Test quality:** `dialog-scroll.test.tsx` asserts the exact className tokens (`overflow-y-auto`, `max-h-[100dvh]`, `sticky`, `bottom-0`, `pb-[max(1rem,env(safe-area-inset-bottom))]`, `bg-card`). Cause-check, not smoke.

**Strengths:** single-source-of-truth fix cascades to all ~51 affected dialogs without touching them. Backward-compatible with the 19 `<DialogBody>` dialogs per tester baseline.

**Nit (non-blocker):** theoretical double-scroll on `<DialogBody>` dialogs. Pre-analysis §Risks mitigates it; manual QA on 2-3 Body-using dialogs is recommended at some point.

---

## Follow-ups (non-blocking)

1. **Tech-debt:** Refactor `POST /api/vagues` to delegate to `createVague()` (`src/lib/queries/vagues.ts`) instead of re-implementing the transaction body. This removes the structural asymmetry that caused BUG-041.
2. **UI hygiene:** Audit any non-wrapper dialog that re-implements its own content layout.
3. **Pre-existing test debt:** 37 pre-existing failures from missing `useLocale` in `next-intl` test mocks — open a dedicated ticket.
4. **QA data cleanup:** Residual vagues `VAGUE-2026-MOBILE`, `VAGUE-2026-TEST`, `VAGUE-CLI-2026-01` in dev DB — ask user before `DELETE`.

---

## Final verdict

**APPROVED** for both BUG-041 and BUG-042. Proceed to @knowledge-keeper (ERR-XXX entries) then @status-updater (CLOS).

## Files inspected
- `/Users/ronald/project/dkfarm/farm-flow/src/app/api/vagues/route.ts`
- `/Users/ronald/project/dkfarm/farm-flow/src/components/ui/dialog.tsx`
- `/Users/ronald/project/dkfarm/farm-flow/src/__tests__/api/vagues-bug041-assignation-dual-write.test.ts`
- `/Users/ronald/project/dkfarm/farm-flow/src/components/ui/__tests__/dialog-scroll.test.tsx`
- `/Users/ronald/project/dkfarm/farm-flow/scripts/repair-bug041.sql`
- `/Users/ronald/project/dkfarm/farm-flow/prisma/schema.prisma` (AssignationBac model, lines 1197-1223)
