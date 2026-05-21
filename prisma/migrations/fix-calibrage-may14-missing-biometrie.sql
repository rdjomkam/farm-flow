-- =============================================================================
-- FIX: Missing BIOMETRIE releve for Bac 07 (PETIT) from calibrage 14/05/2026
-- =============================================================================
-- Calibrage cmpcimvty002z01rumvue4ayb created 4 CalibrageGroupe records
-- (GROS→Bac04, TRES_GROS→Bac09, MOYEN→Bac01, PETIT→Bac07) but only
-- generated 3 BIOMETRIE releves — Bac 07 (PETIT @ 178g) was missed.
--
-- Root cause: unknown — code logic is correct, likely a DTO issue at creation.
-- Fix: insert the missing BIOMETRIE releve for Bac 07.
-- =============================================================================

-- =========================================================
-- PART 1 — DRY RUN (SELECT only)
-- =========================================================

\echo '--- DRY RUN ---'

\echo ''
\echo '1. Calibrage du 14 mai — groupes:'
SELECT g.categorie, g."nombrePoissons", g."poidsMoyen", b.nom as bac_dest
FROM "CalibrageGroupe" g
JOIN "Bac" b ON g."destinationBacId" = b.id
WHERE g."calibrageId" = 'cmpcimvty002z01rumvue4ayb'
ORDER BY g.categorie;

\echo ''
\echo '2. Releves BIOMETRIE lies au calibrage (devrait etre 4, sera 3):'
SELECT r.id, b.nom as bac, r."poidsMoyen", r.notes
FROM "Releve" r
JOIN "Bac" b ON r."bacId" = b.id
WHERE r."calibrageId" = 'cmpcimvty002z01rumvue4ayb'
  AND r."typeReleve" = 'BIOMETRIE'
ORDER BY b.nom;

\echo ''
\echo '3. Derniere biometrie Bac 07 actuellement (manque celle du calibrage):'
SELECT r.date, r."poidsMoyen", r.notes, r."calibrageId"
FROM "Releve" r
WHERE r."bacId" = 'cmmtgcqsi000504lfaj2rpcjb'
  AND r."vagueId" = 'cmmth8mav000004k31i3he89v'
  AND r."typeReleve" = 'BIOMETRIE'
ORDER BY r.date DESC
LIMIT 3;

-- =========================================================
-- PART 2 — EXECUTE
-- =========================================================

\echo ''
\echo '--- EXECUTE ---'

BEGIN;

INSERT INTO "Releve" (
  id, date, "typeReleve", "poidsMoyen", "echantillonCount", notes,
  "vagueId", "bacId", "siteId", "calibrageId", "createdAt", "updatedAt"
) VALUES (
  gen_random_uuid()::text,
  '2026-05-14 21:50:00',
  'BIOMETRIE',
  178,
  554,
  'Biometrie calibrage — categorie Petit',
  'cmmth8mav000004k31i3he89v',
  'cmmtgcqsi000504lfaj2rpcjb',
  'cmmmxjqll000004l2vd7crswl',
  'cmpcimvty002z01rumvue4ayb',
  NOW(),
  NOW()
);

\echo 'Inserted missing BIOMETRIE for Bac 07 (PETIT @ 178g)'

COMMIT;

-- =========================================================
-- PART 3 — VERIFY
-- =========================================================

\echo ''
\echo '--- VERIFY ---'

\echo ''
\echo '1. Releves BIOMETRIE du calibrage (devrait etre 4 maintenant):'
SELECT r.id, b.nom as bac, r."poidsMoyen", r."echantillonCount", r.notes
FROM "Releve" r
JOIN "Bac" b ON r."bacId" = b.id
WHERE r."calibrageId" = 'cmpcimvty002z01rumvue4ayb'
  AND r."typeReleve" = 'BIOMETRIE'
ORDER BY b.nom;

\echo ''
\echo '2. Compte total releves du calibrage (devrait etre 8: 4 bio + 4 comptage):'
SELECT r."typeReleve", COUNT(*) as cnt
FROM "Releve" r
WHERE r."calibrageId" = 'cmpcimvty002z01rumvue4ayb'
GROUP BY r."typeReleve"
ORDER BY r."typeReleve";
