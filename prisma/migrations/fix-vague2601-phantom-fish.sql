-- =============================================================================
-- FIX: 522 phantom fish in Vague 26-01 AssignationBac + Bac counts
-- =============================================================================
-- After the May 14 calibrage (cmpcimvty002z01rumvue4ayb, created May 19),
-- AssignationBac.nombreActuel and Bac.nombrePoissons are inflated by ~130
-- per bac vs the expected values (COMPTAGE - post-COMPTAGE mortalities).
--
-- Expected (COMPTAGE − mortalites post-calibrage):
--   Bac 01: 1564 − 0 = 1564   (actual: 1696, +132)
--   Bac 04: 2118 − 1 = 2117   (actual: 2247, +130)
--   Bac 07:  554 − 0 =  554   (actual:  684, +130)
--   Bac 09:  752 − 0 =  752   (actual:  882, +130)
--
-- Root cause: unidentified — all code paths verified, no increment source
-- found. Data corruption likely from an external update or race condition.
-- =============================================================================

-- =========================================================
-- PART 1 — DRY RUN (SELECT only)
-- =========================================================

\echo '--- DRY RUN ---'

\echo ''
\echo '1. Current Bac.nombrePoissons vs expected:'
SELECT b.nom, b."nombrePoissons" as actuel,
  CASE b.nom
    WHEN 'Bac 01' THEN 1564
    WHEN 'Bac 04' THEN 2117
    WHEN 'Bac 07' THEN 554
    WHEN 'Bac 09' THEN 752
  END as attendu,
  b."nombrePoissons" - CASE b.nom
    WHEN 'Bac 01' THEN 1564
    WHEN 'Bac 04' THEN 2117
    WHEN 'Bac 07' THEN 554
    WHEN 'Bac 09' THEN 752
  END as ecart
FROM "Bac" b
WHERE b."vagueId" = 'cmmth8mav000004k31i3he89v'
ORDER BY b.nom;

\echo ''
\echo '2. Current AssignationBac.nombrePoissons vs expected:'
SELECT b.nom, a."nombrePoissons" as actuel,
  CASE b.nom
    WHEN 'Bac 01' THEN 1564
    WHEN 'Bac 04' THEN 2117
    WHEN 'Bac 07' THEN 554
    WHEN 'Bac 09' THEN 752
  END as attendu,
  a."nombrePoissons" - CASE b.nom
    WHEN 'Bac 01' THEN 1564
    WHEN 'Bac 04' THEN 2117
    WHEN 'Bac 07' THEN 554
    WHEN 'Bac 09' THEN 752
  END as ecart
FROM "AssignationBac" a
JOIN "Bac" b ON a."bacId" = b.id
WHERE a."vagueId" = 'cmmth8mav000004k31i3he89v'
AND a."dateFin" IS NULL
ORDER BY b.nom;

-- =========================================================
-- PART 2 — EXECUTE
-- =========================================================

\echo ''
\echo '--- EXECUTE ---'

BEGIN;

-- Fix Bac.nombrePoissons
UPDATE "Bac" SET "nombrePoissons" = 1564 WHERE id = 'cmmnd2oab000104jse23g509w';
UPDATE "Bac" SET "nombrePoissons" = 2117 WHERE id = 'cmmtgbf4x000204lfb3tsnrrd';
UPDATE "Bac" SET "nombrePoissons" = 554  WHERE id = 'cmmtgcqsi000504lfaj2rpcjb';
UPDATE "Bac" SET "nombrePoissons" = 752  WHERE id = 'cmmtgd8br000704lf12xj13e1';

-- Fix AssignationBac.nombrePoissons (mapped as nombreActuel in Prisma)
UPDATE "AssignationBac" SET "nombrePoissons" = 1564
WHERE "bacId" = 'cmmnd2oab000104jse23g509w' AND "vagueId" = 'cmmth8mav000004k31i3he89v' AND "dateFin" IS NULL;

UPDATE "AssignationBac" SET "nombrePoissons" = 2117
WHERE "bacId" = 'cmmtgbf4x000204lfb3tsnrrd' AND "vagueId" = 'cmmth8mav000004k31i3he89v' AND "dateFin" IS NULL;

UPDATE "AssignationBac" SET "nombrePoissons" = 554
WHERE "bacId" = 'cmmtgcqsi000504lfaj2rpcjb' AND "vagueId" = 'cmmth8mav000004k31i3he89v' AND "dateFin" IS NULL;

UPDATE "AssignationBac" SET "nombrePoissons" = 752
WHERE "bacId" = 'cmmtgd8br000704lf12xj13e1' AND "vagueId" = 'cmmth8mav000004k31i3he89v' AND "dateFin" IS NULL;

\echo 'Fixed 4 Bac + 4 AssignationBac records (total: -522 phantom fish)'

COMMIT;

-- =========================================================
-- PART 3 — VERIFY
-- =========================================================

\echo ''
\echo '--- VERIFY ---'

\echo ''
\echo '1. Bac.nombrePoissons after fix:'
SELECT b.nom, b."nombrePoissons"
FROM "Bac" b
WHERE b."vagueId" = 'cmmth8mav000004k31i3he89v'
ORDER BY b.nom;

\echo ''
\echo '2. AssignationBac.nombrePoissons after fix:'
SELECT b.nom, a."nombrePoissons"
FROM "AssignationBac" a
JOIN "Bac" b ON a."bacId" = b.id
WHERE a."vagueId" = 'cmmth8mav000004k31i3he89v'
AND a."dateFin" IS NULL
ORDER BY b.nom;

\echo ''
\echo '3. Total fish in wave (should be ~4987 = 1564+2117+554+752):'
SELECT SUM(a."nombrePoissons") as total_poissons
FROM "AssignationBac" a
WHERE a."vagueId" = 'cmmth8mav000004k31i3he89v'
AND a."dateFin" IS NULL;
