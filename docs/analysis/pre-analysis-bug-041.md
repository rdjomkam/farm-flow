# Pre-analysis — BUG-041 "0 tank" displayed on newly created vagues

**Agent:** @pre-analyst (opus) — 2026-04-23
**Status:** GO — Root cause confirmed, fix is surgical and isolated.
**Severité recommandée :** **Haute**

## 1. Reproduction confirmation

Symptom reproduces exactly as described in `docs/bugs/BUG-041.md`. DB-level evidence matches the code:

- `Bac.vagueId` IS set (POST handler writes it, `src/app/api/vagues/route.ts` lines 239-247)
- `AssignationBac` has **0 rows** (POST handler never calls `tx.assignationBac.create`)

## 2. Root cause — precise

**File:** `src/app/api/vagues/route.ts`
**Function:** `POST` handler, transaction body
**Lines:** 238-248

The inline transaction in the POST route duplicates the vague-creation logic instead of delegating to `createVague()` in the query layer. During that duplication, **only the `tx.bac.update` call was ported; the `tx.assignationBac.create` call was omitted**.

Compare with the correct implementation in `src/lib/queries/vagues.ts` `createVague()` (lines 180-205):

```ts
// queries/vagues.ts — CORRECT
for (const entry of data.bacDistribution) {
  await tx.bac.update({ ... vagueId: vague.id, nombrePoissons: ... });
  await tx.assignationBac.create({
    data: {
      bacId: entry.bacId, vagueId: vague.id, siteId,
      dateAssignation: new Date(data.dateDebut),
      dateFin: null,
      nombrePoissonsInitial: entry.nombrePoissons,
      poidsMoyenInitial: data.poidsMoyenInitial,
      nombrePoissons: entry.nombrePoissons,
    },
  });
}
```

vs. the BROKEN route handler (lines 238-248):

```ts
// api/vagues/route.ts — BROKEN
for (const entry of data.bacDistribution) {
  await tx.bac.update({ ... });   // writes Bac.vagueId
  // MISSING: tx.assignationBac.create(...)
}
```

The list query `getVagues()` (`src/lib/queries/vagues.ts` lines 17-33) correctly counts `_count.assignations { where: { dateFin: null } }`. The API `GET` handler returns `nombreBacs = v._count.assignations ?? v._count.bacs` (`src/app/api/vagues/route.ts` line 49). Because `_count.assignations` is **0** (not undefined), the fallback to `_count.bacs` is never triggered → UI shows "0 tank".

## 3. Data-model clarification

From `prisma/schema.prisma` (lines 1095-1223, ADR-043 comment block at 1185-1196):

- **Phase 2 is a dual-write, AssignationBac-first read model.**
- `Bac.vagueId` — LEGACY direct FK; still required Phase 2 for backward compat; will be dropped in Phase 3.
- `AssignationBac` — SOURCE OF TRUTH for bac-vague membership + history. Active assignment = `dateFin IS NULL`. Unique partial index enforces one active assignment per bac.
- Every write path MUST dual-write. The query layer (`getVagues`, `getVagueById`, `getVagueByIdWithReleves`, `updateVague.addBacs`, `cloturerVague`) already does this correctly; the POST API handler is the lone regression point.

This mirrors BUG-040 (ERR-089 in `ERRORS-AND-FIXES.md` line 158): asymmetry between dual-source write and single-source read. BUG-041 is the twin: single-source write vs dual-source read.

## 4. Exact surgical fix

**File to edit:** `src/app/api/vagues/route.ts`
**Insertion point:** inside the existing `for (const entry of data.bacDistribution)` loop, immediately after the `tx.bac.update(...)` call (after line 247, before the closing brace at line 248).

```ts
for (const entry of data.bacDistribution) {
  await tx.bac.update({
    where: { id: entry.bacId, siteId: auth.activeSiteId },
    data: {
      vagueId: vague.id,
      nombrePoissons: entry.nombrePoissons,
      nombreInitial: entry.nombrePoissons,
      poidsMoyenInitial: data.poidsMoyenInitial,
    },
  });

  // +++ ADD (ADR-043 Phase 2 dual-write) +++
  await tx.assignationBac.create({
    data: {
      bacId: entry.bacId,
      vagueId: vague.id,
      siteId: auth.activeSiteId,
      dateAssignation: new Date(data.dateDebut),
      dateFin: null,
      nombrePoissonsInitial: entry.nombrePoissons,
      poidsMoyenInitial: data.poidsMoyenInitial,
      nombrePoissons: entry.nombrePoissons,
    },
  });
  // +++ END ADD +++
}
```

The write is inside the existing `prisma.$transaction` — R4 (atomic operations) respected.

## 5. Regression test plan

**Test file to update:** `src/__tests__/api/vagues-distribution.test.ts`

The test already stubs `tx.assignationBac.create` (line 147) as a `vi.fn().mockResolvedValue({})` — but **never asserts it is called**. That is the gap that let BUG-041 ship.

Required assertions for the "distribution valide" case (around line 189+):
1. Expose the `assignationBac.create` mock as a module-level `mockAssignationBacCreate` (mirror pattern in `src/__tests__/api/calibrages-bug040.test.ts` lines 32-57).
2. After a successful POST with N tanks in `bacDistribution`, assert:
   - `mockAssignationBacCreate` was called exactly N times.
   - Each call received `{ bacId, vagueId, siteId, dateAssignation, dateFin: null, nombrePoissonsInitial, poidsMoyenInitial, nombrePoissons }` matching the request entry.
3. Add a new test `"crée l'assignation active avec dateFin null"` verifying `dateFin: null`.
4. Add a new dedicated non-regression test file: `src/__tests__/api/vagues-bug041-assignation-dual-write.test.ts`.

## 6. Severity recommendation — **Haute**

- Vague-creation feature is broken after creation (list, detail, quota all mis-count).
- All users creating new vagues post-ADR-043 are impacted.
- Downstream analytics (evolution poids, survie) may silently use wrong tank set.
- Not Critique because the build is green.

## 7. Impacted files (absolute paths)

**Must edit (source):**
- `/Users/ronald/project/dkfarm/farm-flow/src/app/api/vagues/route.ts` — add `tx.assignationBac.create` in POST loop (lines 238-248).

**Must edit (tests):**
- `/Users/ronald/project/dkfarm/farm-flow/src/__tests__/api/vagues-distribution.test.ts` — add assertion that `assignationBac.create` is called.
- **New:** `/Users/ronald/project/dkfarm/farm-flow/src/__tests__/api/vagues-bug041-assignation-dual-write.test.ts` (non-regression).

**No change needed:**
- `src/lib/queries/vagues.ts` — already correct.
- `src/components/vagues/vagues-list-client.tsx` — reads `nombreBacs` from API; correct once writes are fixed.
- `prisma/schema.prisma` — correct.
- `prisma/seed.sql` — seed already populates both (line 458+).

## 8. Repair plan for existing broken vagues

Two vagues created during QA are stuck without AssignationBac rows: `VAGUE-2026-TEST` (id `cmobew19k0001mxh8qxuh7voz`) and `VAGUE-2026-MOBILE`.

Idempotent SQL repair:

```sql
INSERT INTO "AssignationBac" (
  id, "bacId", "vagueId", "siteId",
  "dateAssignation", "dateFin",
  "nombrePoissonsInitial", "poidsMoyenInitial", "nombrePoissons",
  "createdAt", "updatedAt"
)
SELECT
  'repair_' || substr(md5(random()::text || b.id || v.id), 1, 20),
  b.id, v.id, v."siteId",
  v."dateDebut", NULL,
  b."nombreInitial", b."poidsMoyenInitial", b."nombrePoissons",
  NOW(), NOW()
FROM "Bac" b
JOIN "Vague" v ON v.id = b."vagueId"
WHERE b."vagueId" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "AssignationBac" a
    WHERE a."bacId" = b.id AND a."vagueId" = v.id AND a."dateFin" IS NULL
  );
```

Run via `docker exec -i silures-db psql -U dkfarm -d farm-flow < scripts/repair-bug041.sql`. Idempotent (NOT EXISTS guard). Verify after: every active vague has `COUNT(active assignations) = COUNT(bacs via FK)`.

## 9. Dependencies / coordination

- **Isolated fix.** No UI, no query, no schema changes.
- **Single source file:** `src/app/api/vagues/route.ts`.
- **Tests:** one new + one updated.
- **DB repair:** one idempotent script.
- **No coordination** needed with @architect or @db-specialist beyond review sign-off. @developer owns fix + repair script. @tester writes the non-regression test. @code-reviewer reviews (Haute triggers mandatory review).

## 10. R1-R9 compliance for the fix

- **R3** (Prisma = TS): unaffected — schema not touched.
- **R4** (Atomic operations): added write inside existing `prisma.$transaction`. ✅
- **R8** (siteId PARTOUT): new row gets `siteId: auth.activeSiteId`. ✅
- **R9** (Tests before review): @tester runs `npx vitest run` + `npm run build` before code-reviewer.
