-- =============================================================================
-- FIX: VTE-2026-004 missing vagueId
-- =============================================================================
-- VTE-2026-004 (286 poissons, 132 kg, 264 000 F) was created without vagueId
-- but its VENTE releves correctly reference Dibac bacs (Bac 05: 161, Bac 06: 125).
-- This causes the production cost to miss 132 kg of sold weight, inflating cout/kg.
--
-- Fix: set vagueId = Dibac on VTE-2026-004
-- =============================================================================

-- =========================================================
-- PART 1 — DRY RUN (SELECT only)
-- =========================================================

\echo '--- DRY RUN ---'

\echo ''
\echo '1. Vente VTE-2026-004 (missing vagueId):'
SELECT id, numero, "quantitePoissons", "poidsTotalKg", "montantTotal", "vagueId", "createdAt"
FROM "Vente"
WHERE id = 'cmpeot9jg000201nyxfget2gi';

\echo ''
\echo '2. VENTE releves created by this vente (linked to Dibac bacs):'
SELECT r.id, r."typeReleve", r."nombreVendus", r."bacId", b.nom, r."vagueId", r.date
FROM "Releve" r
JOIN "Bac" b ON r."bacId" = b.id
WHERE r.id IN ('cmpeot9jw000401ny5d6uuqx1', 'cmpeot9k4000601ny1acw8nc9');

\echo ''
\echo '3. Facture linked to VTE-2026-004:'
SELECT id, numero, statut, "montantTotal", "montantPaye"
FROM "Facture"
WHERE "venteId" = 'cmpeot9jg000201nyxfget2gi';

\echo ''
\echo '4. All ventes for Dibac vague (before fix):'
SELECT id, numero, "quantitePoissons", "poidsTotalKg", "vagueId"
FROM "Vente"
WHERE "vagueId" = 'cmmvma55c000704jpue712940'
ORDER BY "createdAt";

\echo ''
\echo '5. Target vague (Dibac):'
SELECT id, code, "nombreInitial", statut
FROM "Vague"
WHERE id = 'cmmvma55c000704jpue712940';

-- =========================================================
-- PART 2 — EXECUTE (single UPDATE in transaction)
-- =========================================================

\echo ''
\echo '--- EXECUTE ---'

BEGIN;

-- Link VTE-2026-004 to Dibac vague
-- Note: vagueId was empty string '', not NULL
UPDATE "Vente"
SET "vagueId" = 'cmmvma55c000704jpue712940'
WHERE id = 'cmpeot9jg000201nyxfget2gi';

\echo 'Updated VTE-2026-004 vagueId -> Dibac'

COMMIT;

-- =========================================================
-- PART 3 — VERIFY
-- =========================================================

\echo ''
\echo '--- VERIFY ---'

\echo ''
\echo '1. VTE-2026-004 now linked to Dibac:'
SELECT id, numero, "quantitePoissons", "poidsTotalKg", "vagueId"
FROM "Vente"
WHERE id = 'cmpeot9jg000201nyxfget2gi';

\echo ''
\echo '2. All Dibac ventes (should be 2):'
SELECT id, numero, "quantitePoissons", "poidsTotalKg", "montantTotal"
FROM "Vente"
WHERE "vagueId" = 'cmmvma55c000704jpue712940'
ORDER BY "createdAt";

\echo ''
\echo '3. Total sold from Dibac:'
SELECT COUNT(*) as nb_ventes,
       SUM("quantitePoissons") as total_poissons,
       SUM("poidsTotalKg") as total_kg,
       SUM("montantTotal") as total_fcfa
FROM "Vente"
WHERE "vagueId" = 'cmmvma55c000704jpue712940';
