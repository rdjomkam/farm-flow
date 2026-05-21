-- =============================================================================
-- FIX: BES-2026-033 / CMD-2026-015 duplicate depense + stock movement
-- =============================================================================
-- Problem: Same purchase (4x Aliment Gouessant 2mm = 104,000F) created two
-- depenses and two MouvementStock ENTREE because the order was created
-- standalone (not linked to the need).
--
-- Action: Keep DEP-2026-032 (order, MOBILE_MONEY payment), delete DEP-2026-031
-- (need, ESPECES payment). Link order to need. Delete orphan MouvementStock.
-- No stockActuel adjustment needed (rattrapage never incremented stock).
-- =============================================================================

-- =========================================
-- PART 1: DRY RUN (SELECT only)
-- =========================================

\echo '=== DRY RUN: Inspecting current state ==='

\echo ''
\echo '--- Depenses to inspect ---'
SELECT id, numero, description, "montantTotal", "montantPaye", statut,
  "commandeId" IS NOT NULL as has_commande,
  "listeBesoinsId" IS NOT NULL as has_besoin
FROM "Depense"
WHERE id IN ('cmom2lhi9009l01qwxg0n69bv', 'cmom2rf0q009t01qwe10pbu5t');

\echo ''
\echo '--- MouvementStock to inspect ---'
SELECT ms.id, ms.type, ms.quantite, ms."prixTotal", ms.notes,
  ms."commandeId" IS NOT NULL as has_commande,
  ms."depenseId"
FROM "MouvementStock" ms
WHERE ms.id IN ('cmom2rf09009s01qwjcxutnhf', '4c1fbfc5-1c76-4938-b628-7cddca9226ea');

\echo ''
\echo '--- Commande current listeBesoinsId (should be NULL) ---'
SELECT id, numero, statut, "listeBesoinsId"
FROM "Commande" WHERE id = 'cmom2r03c009q01qwm9b7x3j9';

\echo ''
\echo '--- LigneBesoin current commandeId (should be NULL) ---'
SELECT id, designation, "commandeId"
FROM "LigneBesoin" WHERE id = 'cmom2kz5l009k01qwkaaiu8sw';

\echo ''
\echo '--- LigneDepense on both depenses ---'
SELECT ld.id, ld.designation, ld."montantTotal", ld."depenseId",
  ld."ligneBesoinId", ld."ligneCommandeId",
  d.numero as dep_numero
FROM "LigneDepense" ld
JOIN "Depense" d ON ld."depenseId" = d.id
WHERE d.id IN ('cmom2lhi9009l01qwxg0n69bv', 'cmom2rf0q009t01qwe10pbu5t');

\echo ''
\echo '--- PaiementDepense on both depenses ---'
SELECT pd.id, pd.montant, pd.mode, pd.reference, d.numero as dep_numero
FROM "PaiementDepense" pd
JOIN "Depense" d ON pd."depenseId" = d.id
WHERE d.id IN ('cmom2lhi9009l01qwxg0n69bv', 'cmom2rf0q009t01qwe10pbu5t');

\echo ''
\echo '--- Product stockActuel (should stay ~0.03) ---'
SELECT id, nom, "stockActuel", "uniteAchat", contenance
FROM "Produit" WHERE id = 'cmom2e3r6009c01qwq4eh4qh9';

\echo ''
\echo '=== ACTIONS THAT WILL BE TAKEN ==='
\echo '1. UPDATE Commande CMD-2026-015: SET listeBesoinsId → BES-2026-033'
\echo '2. UPDATE Depense DEP-2026-032: SET listeBesoinsId → BES-2026-033'
\echo '3. UPDATE LigneBesoin: SET commandeId → CMD-2026-015'
\echo '4. UPDATE LigneDepense (DEP-032): SET ligneBesoinId → LigneBesoin'
\echo '5. DELETE Depense DEP-2026-031 (cascades: LigneDepense + PaiementDepense ESPECES)'
\echo '6. DELETE MouvementStock (rattrapage BES-2026-033)'
\echo ''
\echo 'To execute, uncomment PART 2 below and re-run.'

-- =========================================
-- PART 2: EXECUTE
-- =========================================

BEGIN;

-- 1. Link Commande → Besoin
UPDATE "Commande"
SET "listeBesoinsId" = 'cmom2kz5f009i01qwcssoyb87'
WHERE id = 'cmom2r03c009q01qwm9b7x3j9'
  AND "listeBesoinsId" IS NULL;

-- 2. Link kept Depense → Besoin
UPDATE "Depense"
SET "listeBesoinsId" = 'cmom2kz5f009i01qwcssoyb87'
WHERE id = 'cmom2rf0q009t01qwe10pbu5t'
  AND "listeBesoinsId" IS NULL;

-- 3. Link LigneBesoin → Commande
UPDATE "LigneBesoin"
SET "commandeId" = 'cmom2r03c009q01qwm9b7x3j9'
WHERE id = 'cmom2kz5l009k01qwkaaiu8sw'
  AND "commandeId" IS NULL;

-- 4. Link kept LigneDepense → LigneBesoin
UPDATE "LigneDepense"
SET "ligneBesoinId" = 'cmom2kz5l009k01qwkaaiu8sw'
WHERE id = 'cmom5c7nf00a101qw5t58zh69'
  AND "ligneBesoinId" IS NULL;

-- 5. Delete duplicate Depense (cascades: LigneDepense + PaiementDepense)
DELETE FROM "Depense"
WHERE id = 'cmom2lhi9009l01qwxg0n69bv';

-- 6. Delete duplicate MouvementStock
DELETE FROM "MouvementStock"
WHERE id = '4c1fbfc5-1c76-4938-b628-7cddca9226ea';

COMMIT;

-- =========================================
-- PART 3: VERIFY
-- =========================================

\echo ''
\echo '=== POST-EXECUTION VERIFICATION ==='

\echo '--- CMD-2026-015 now linked to BES-2026-033? ---'
SELECT id, numero, "listeBesoinsId" FROM "Commande" WHERE id = 'cmom2r03c009q01qwm9b7x3j9';

\echo '--- Only DEP-2026-032 remains? ---'
SELECT id, numero, "commandeId", "listeBesoinsId" FROM "Depense"
WHERE id IN ('cmom2lhi9009l01qwxg0n69bv', 'cmom2rf0q009t01qwe10pbu5t');

\echo '--- Only 1 ENTREE MouvementStock for this product? ---'
SELECT id, type, quantite, "prixTotal" FROM "MouvementStock"
WHERE "produitId" = 'cmom2e3r6009c01qwq4eh4qh9' AND type = 'ENTREE';

\echo '--- LigneBesoin linked to CMD? ---'
SELECT id, "commandeId" FROM "LigneBesoin" WHERE id = 'cmom2kz5l009k01qwkaaiu8sw';

\echo '--- LigneDepense linked to LigneBesoin? ---'
SELECT id, "ligneBesoinId", "ligneCommandeId" FROM "LigneDepense"
WHERE id = 'cmom5c7nf00a101qw5t58zh69';

\echo '--- stockActuel unchanged? ---'
SELECT nom, "stockActuel" FROM "Produit" WHERE id = 'cmom2e3r6009c01qwq4eh4qh9';

\echo '--- Total depenses for this site (cost check) ---'
SELECT SUM("montantTotal") as total_depenses FROM "Depense"
WHERE "siteId" = (SELECT "siteId" FROM "Commande" WHERE id = 'cmom2r03c009q01qwm9b7x3j9');
