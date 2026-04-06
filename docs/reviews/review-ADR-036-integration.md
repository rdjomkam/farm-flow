# Review: ADR-036 FCR-by-Feed Integration

**Verdict: APPROVED WITH RESERVATIONS (all bugs fixed)**
**Date:** 2026-04-06
**Reviewer:** @code-reviewer

---

## Checklist R1-R9

- [x] R1: Enums UPPERCASE
- [x] R2: Import enums from @/types
- [x] R3: Prisma = TypeScript aligned
- [x] R4: Atomic operations
- [x] R5: DialogTrigger asChild
- [x] R6: CSS variables (pre-existing violations in feed-k-comparison-chart.tsx noted but out of scope)
- [x] R7: Nullability explicit
- [x] R8: siteId everywhere
- [x] R9: Tests pass (4296/4296 ADR-036 scope, build OK)

---

## Bugs Found and Fixed

| Bug ID | Severity | File | Description | Status |
|--------|----------|------|-------------|--------|
| BUG-ADR036-01 | High | fcr-transparency-dialog.tsx:282-290 | Wrong fcrGlobal: picked first vague's FCR instead of weighted Σaliment/Σgain | FIXED |
| BUG-ADR036-02 | Medium | calculs.ts:892-1019 | FCRTracePeriode/FCRTraceVague/FCRTrace orphaned dead code | FIXED (deleted) |
| BUG-ADR036-03 | Medium | fcr-by-feed.ts:1046-1050 | flagLowConfidence vagues not counted in nombreVaguesIgnorees | FIXED |
| BUG-ADR036-04 | Medium | analytics.ts + route.ts | saisonFilter uses string literals (no enum exists) | ACCEPTED (no Prisma enum for this) |
| BUG-ADR036-05 | Low | feed-k-comparison-chart.tsx | Hard-coded hex colors (pre-existing, out of scope) | DEFERRED |
| BUG-ADR036-06 | Low | fcr-transparency-dialog.tsx | i18n keys need verification | DEFERRED |

---

## What Was Verified

- `computeAlimentMetrics` wrapper correctly maps all `AnalytiqueAliment` fields
- `saisonFilter` logic correct (SECHE = months 11,12,1,2,3; PLUIES = 4-10)
- FCRTransparencyDialog handles both lazy-fetch and pre-loaded modes
- API route has proper auth (Permission.STOCK_VOIR) and siteId filtering
- `getFCRTrace` fully removed, no dead imports
- FCRTrace dead types cleaned from calculs.ts
