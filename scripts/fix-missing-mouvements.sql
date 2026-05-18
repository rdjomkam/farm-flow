-- =============================================================================
-- Script de correction données production — 2026-05-18
--
-- 3 corrections :
-- 1. Supprimer 7 LigneDepense doublons/fantômes (lignes COMMANDE dans dépenses listeBesoins)
-- 2. Recalculer montantTotal des 4 dépenses impactées
-- 3. Créer 33 MouvementStock ENTREE manquants (achats LIBRE sans mouvement)
-- =============================================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- PARTIE 1 : Supprimer les 7 LigneDepense doublons/fantômes
-- ─────────────────────────────────────────────────────────────────────────────

-- 6 doublons (commandes LIVREE) + 1 fantôme (commande ANNULEE)
DELETE FROM "LigneDepense" WHERE id IN (
  'cmnjy7i4r000f01rypf0aapfx',  -- DEP-2026-004: DIBAC 3mm (42k, CMD-2026-005 LIVREE)
  'cmnjy7i4r000g01ryelig1n6d',  -- DEP-2026-004: DIBAC 4,5mm (61.5k, CMD-2026-005 LIVREE)
  'cmnjy7i4d000a01ryf9yqvnb4',  -- DEP-2026-005: Aliments 0.2 Perla (100k, CMD-2026-006 LIVREE)
  'cmnjy7i4d000b01ryxrqw2u8m',  -- DEP-2026-005: Aliments 0.3 Perla (110k, CMD-2026-006 LIVREE)
  'cmnjy7i4d000901rywct4ya1u',  -- DEP-2026-005: Aliments 1.7 gouessant (140k, CMD-2026-007 ANNULEE)
  'cmnjy7i37000001ry6n76wdo6',  -- DEP-2026-007: Aliment géniteurs (50k, CMD-2026-008 LIVREE)
  'cmnjy7i3i000201ryzcp6h4d8'   -- DEP-2026-008: Aliments 1.1-1.3 Perla (75k, CMD-2026-009 LIVREE)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- PARTIE 2 : Recalculer montantTotal des 4 dépenses impactées
-- ─────────────────────────────────────────────────────────────────────────────

-- DEP-2026-004 (BES-2026-006) : était 103500, toutes lignes supprimées → 0
UPDATE "Depense" SET "montantTotal" = 0
WHERE numero = 'DEP-2026-004';

-- DEP-2026-005 (BES-2026-002) : était 388250, supprimé 350000 (Perla + gouessant) → reste 38250 (Carburant)
UPDATE "Depense" SET "montantTotal" = (
  SELECT COALESCE(SUM("montantTotal"), 0) FROM "LigneDepense" WHERE "depenseId" = (
    SELECT id FROM "Depense" WHERE numero = 'DEP-2026-005'
  )
)
WHERE numero = 'DEP-2026-005';

-- DEP-2026-007 (BES-2026-008) : était 170000, supprimé 50000 (géniteurs) → reste 120000 (Pompe)
UPDATE "Depense" SET "montantTotal" = (
  SELECT COALESCE(SUM("montantTotal"), 0) FROM "LigneDepense" WHERE "depenseId" = (
    SELECT id FROM "Depense" WHERE numero = 'DEP-2026-007'
  )
)
WHERE numero = 'DEP-2026-007';

-- DEP-2026-008 (BES-2026-009) : était 75000, toutes lignes supprimées → 0
UPDATE "Depense" SET "montantTotal" = 0
WHERE numero = 'DEP-2026-008';

-- ─────────────────────────────────────────────────────────────────────────────
-- PARTIE 3 : Créer les 33 MouvementStock ENTREE manquants
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO "MouvementStock" (id, "produitId", type, quantite, "prixTotal", "userId", date, notes, "siteId", "createdAt")
VALUES
-- BES-2026-001 (2026-03-26) — Stériliser les bacs
(gen_random_uuid()::text, 'cmn5uaeu3000104ic4cf2gdoi', 'ENTREE', 0.5, 40000, 'cmmnkbxot000004jog91w1bdo', '2026-03-26 10:42:50.492', 'Rattrapage achat direct BES-2026-001', 'cmmmxjqll000004l2vd7crswl', NOW()),
(gen_random_uuid()::text, 'cmn5u5id4000004le64xyq0c4', 'ENTREE', 1, 3500, 'cmmnkbxot000004jog91w1bdo', '2026-03-26 10:42:50.492', 'Rattrapage achat direct BES-2026-001', 'cmmmxjqll000004l2vd7crswl', NOW()),
(gen_random_uuid()::text, 'cmn5u7fwk000004ic2g9wm0g1', 'ENTREE', 1, 5000, 'cmmnkbxot000004jog91w1bdo', '2026-03-26 10:42:50.492', 'Rattrapage achat direct BES-2026-001', 'cmmmxjqll000004l2vd7crswl', NOW()),

-- BES-2026-002 (2026-04-01) — Carburant
(gen_random_uuid()::text, 'cmn8uf4u7000004l557odnq9n', 'ENTREE', 45, 38250, 'cmmnkbxot000004jog91w1bdo', '2026-04-01 10:33:39.086', 'Rattrapage achat direct BES-2026-002', 'cmmmxjqll000004l2vd7crswl', NOW()),

-- BES-2026-007 (2026-04-01) — Carburant grossissement
(gen_random_uuid()::text, 'cmn8ugcu4000104lcjcvp4jjl', 'ENTREE', 23.8, 20230, 'cmmnkbxot000004jog91w1bdo', '2026-04-01 10:41:34.288', 'Rattrapage achat direct BES-2026-007', 'cmmmxjqll000004l2vd7crswl', NOW()),

-- BES-2026-008 (2026-04-01) — Pompe écloserie
(gen_random_uuid()::text, 'cmnfzz0ya000004joqrvg5oo6', 'ENTREE', 2, 120000, 'cmmnkbxot000004jog91w1bdo', '2026-04-01 14:40:20.073', 'Rattrapage achat direct BES-2026-008', 'cmmmxjqll000004l2vd7crswl', NOW()),

-- BES-2026-010 (2026-04-03) — Prophylaxie
(gen_random_uuid()::text, 'cmmtou3nq000004gvtgkp3ltu', 'ENTREE', 1, 12500, 'cmmnkbxot000004jog91w1bdo', '2026-04-03 11:36:53.723', 'Rattrapage achat direct BES-2026-010', 'cmmmxjqll000004l2vd7crswl', NOW()),
(gen_random_uuid()::text, 'cmmtquam7000104jo31vihgo7', 'ENTREE', 1, 25000, 'cmmnkbxot000004jog91w1bdo', '2026-04-03 11:36:53.723', 'Rattrapage achat direct BES-2026-010', 'cmmmxjqll000004l2vd7crswl', NOW()),

-- BES-2026-011 (2026-04-03) — Bicarbonate
(gen_random_uuid()::text, 'cmnglszxa000004i9gbcwvvlk', 'ENTREE', 1, 20000, 'cmmnkbxot000004jog91w1bdo', '2026-04-03 11:41:57.847', 'Rattrapage achat direct BES-2026-011', 'cmmmxjqll000004l2vd7crswl', NOW()),

-- BES-2026-012 (2026-04-05) — Bicarbonate
(gen_random_uuid()::text, 'cmnglszxa000004i9gbcwvvlk', 'ENTREE', 2, 40000, 'cmmnkbxot000004jog91w1bdo', '2026-04-05 15:55:20.646', 'Rattrapage achat direct BES-2026-012', 'cmmmxjqll000004l2vd7crswl', NOW()),

-- BES-2026-018 (2026-04-09) — Filet anti prédateur
(gen_random_uuid()::text, 'cmnra3ab5000q01ndpbuaz8pk', 'ENTREE', 2, 56000, 'cmmnkbxot000004jog91w1bdo', '2026-04-09 09:38:09.771', 'Rattrapage achat direct BES-2026-018', 'cmmmxjqll000004l2vd7crswl', NOW()),

-- BES-2026-019 (2026-04-10) — Prophylaxie
(gen_random_uuid()::text, 'cmnsoh4f3002m01ndwb8y8ayo', 'ENTREE', 1, 2500, 'cmmnkbxot000004jog91w1bdo', '2026-04-10 13:19:54.495', 'Rattrapage achat direct BES-2026-019', 'cmmmxjqll000004l2vd7crswl', NOW()),
(gen_random_uuid()::text, 'cmmtquam7000104jo31vihgo7', 'ENTREE', 1, 25000, 'cmmnkbxot000004jog91w1bdo', '2026-04-10 13:19:54.495', 'Rattrapage achat direct BES-2026-019', 'cmmmxjqll000004l2vd7crswl', NOW()),
(gen_random_uuid()::text, 'cmmq5g3j4000a04jrkosxtu9r', 'ENTREE', 1, 25000, 'cmmnkbxot000004jog91w1bdo', '2026-04-10 13:19:54.495', 'Rattrapage achat direct BES-2026-019', 'cmmmxjqll000004l2vd7crswl', NOW()),

-- BES-2026-016 (2026-04-10) — Oxy pure grossissement
(gen_random_uuid()::text, 'cmmtqr9am000204kyz90bm833', 'ENTREE', 1, 25000, 'cmmnkbxot000004jog91w1bdo', '2026-04-10 13:24:46.196', 'Rattrapage achat direct BES-2026-016', 'cmmmxjqll000004l2vd7crswl', NOW()),

-- BES-2026-017 (2026-04-10) — Lit
(gen_random_uuid()::text, 'cmnr4uiky000f01ndcg3s4pac', 'ENTREE', 1, 25000, 'cmmnkbxot000004jog91w1bdo', '2026-04-10 13:27:51.592', 'Rattrapage achat direct BES-2026-017', 'cmmmxjqll000004l2vd7crswl', NOW()),

-- BES-2026-021 (2026-04-12) — Traitement curatif
(gen_random_uuid()::text, 'cmmtou3nq000004gvtgkp3ltu', 'ENTREE', 2, 25000, 'cmmnkbxot000004jog91w1bdo', '2026-04-12 18:33:05.41', 'Rattrapage achat direct BES-2026-021', 'cmmmxjqll000004l2vd7crswl', NOW()),
(gen_random_uuid()::text, 'cmmtquam7000104jo31vihgo7', 'ENTREE', 2, 50000, 'cmmnkbxot000004jog91w1bdo', '2026-04-12 18:33:05.41', 'Rattrapage achat direct BES-2026-021', 'cmmmxjqll000004l2vd7crswl', NOW()),
(gen_random_uuid()::text, 'cmmtqr9am000204kyz90bm833', 'ENTREE', 1, 25000, 'cmmnkbxot000004jog91w1bdo', '2026-04-12 18:33:05.41', 'Rattrapage achat direct BES-2026-021', 'cmmmxjqll000004l2vd7crswl', NOW()),
(gen_random_uuid()::text, 'cmn5u7fwk000004ic2g9wm0g1', 'ENTREE', 2, 10000, 'cmmnkbxot000004jog91w1bdo', '2026-04-12 18:33:05.41', 'Rattrapage achat direct BES-2026-021', 'cmmmxjqll000004l2vd7crswl', NOW()),

-- BES-2026-028 (2026-04-22) — Bicarbonate
(gen_random_uuid()::text, 'cmnglszxa000004i9gbcwvvlk', 'ENTREE', 1, 20000, 'cmmnkbxot000004jog91w1bdo', '2026-04-22 18:01:42.718', 'Rattrapage achat direct BES-2026-028', 'cmmmxjqll000004l2vd7crswl', NOW()),

-- BES-2026-023 (2026-04-23) — Reproduction
(gen_random_uuid()::text, 'cmnsoh4f3002m01ndwb8y8ayo', 'ENTREE', 2, 5000, 'cmmnkbxot000004jog91w1bdo', '2026-04-23 08:24:24.537', 'Rattrapage achat direct BES-2026-023', 'cmmmxjqll000004l2vd7crswl', NOW()),
(gen_random_uuid()::text, 'cmmq5bllg000604jrqcm7evsl', 'ENTREE', 1, 12500, 'cmmnkbxot000004jog91w1bdo', '2026-04-23 08:24:24.537', 'Rattrapage achat direct BES-2026-023', 'cmmmxjqll000004l2vd7crswl', NOW()),
(gen_random_uuid()::text, 'cmmq5aktf000504jrcssspayn', 'ENTREE', 2, 20000, 'cmmnkbxot000004jog91w1bdo', '2026-04-23 08:24:24.537', 'Rattrapage achat direct BES-2026-023', 'cmmmxjqll000004l2vd7crswl', NOW()),
(gen_random_uuid()::text, 'cmn5u5id4000004le64xyq0c4', 'ENTREE', 1, 1200, 'cmmnkbxot000004jog91w1bdo', '2026-04-23 08:24:24.537', 'Rattrapage achat direct BES-2026-023', 'cmmmxjqll000004l2vd7crswl', NOW()),
(gen_random_uuid()::text, 'cmo14uytw000701la27sgroom', 'ENTREE', 5, 5000, 'cmmnkbxot000004jog91w1bdo', '2026-04-23 08:24:24.537', 'Rattrapage achat direct BES-2026-023', 'cmmmxjqll000004l2vd7crswl', NOW()),
(gen_random_uuid()::text, 'cmo0eiqhy000501lawhqdxlnk', 'ENTREE', 1, 8000, 'cmmnkbxot000004jog91w1bdo', '2026-04-23 08:24:24.537', 'Rattrapage achat direct BES-2026-023', 'cmmmxjqll000004l2vd7crswl', NOW()),
(gen_random_uuid()::text, 'cmmq5cs9t000704jrcbc3uxo8', 'ENTREE', 2, 7000, 'cmmnkbxot000004jog91w1bdo', '2026-04-23 08:24:24.537', 'Rattrapage achat direct BES-2026-023', 'cmmmxjqll000004l2vd7crswl', NOW()),

-- BES-2026-022 (2026-04-23) — Aliment géniteurs + Carburant
(gen_random_uuid()::text, 'cmmrxltoh000004l57pdk1xc1', 'ENTREE', 1, 50000, 'cmmnkbxot000004jog91w1bdo', '2026-04-23 08:27:19.484', 'Rattrapage achat direct BES-2026-022', 'cmmmxjqll000004l2vd7crswl', NOW()),
(gen_random_uuid()::text, 'cmn8uf4u7000004l557odnq9n', 'ENTREE', 40, 34000, 'cmmnkbxot000004jog91w1bdo', '2026-04-23 08:27:19.484', 'Rattrapage achat direct BES-2026-022', 'cmmmxjqll000004l2vd7crswl', NOW()),

-- BES-2026-033 (2026-04-30) — Aliment Gouessant 2mm
(gen_random_uuid()::text, 'cmom2e3r6009c01qwq4eh4qh9', 'ENTREE', 4, 104000, 'cmmnkbxot000004jog91w1bdo', '2026-04-30 22:43:23.744', 'Rattrapage achat direct BES-2026-033', 'cmmmxjqll000004l2vd7crswl', NOW()),

-- BES-2026-030 (2026-04-30) — Carburant grossissement
(gen_random_uuid()::text, 'cmn8ugcu4000104lcjcvp4jjl', 'ENTREE', 30, 25500, 'cmmnkbxot000004jog91w1bdo', '2026-04-30 22:51:06.641', 'Rattrapage achat direct BES-2026-030', 'cmmmxjqll000004l2vd7crswl', NOW()),

-- BES-2026-031 (2026-04-30) — Bicarbonate
(gen_random_uuid()::text, 'cmnglszxa000004i9gbcwvvlk', 'ENTREE', 1, 20000, 'cmmnkbxot000004jog91w1bdo', '2026-04-30 22:54:21.824', 'Rattrapage achat direct BES-2026-031', 'cmmmxjqll000004l2vd7crswl', NOW());

-- ─────────────────────────────────────────────────────────────────────────────
-- VÉRIFICATIONS
-- ─────────────────────────────────────────────────────────────────────────────

-- Vérifier les dépenses recalculées
SELECT numero, "montantTotal" as nouveau_montant
FROM "Depense"
WHERE numero IN ('DEP-2026-004', 'DEP-2026-005', 'DEP-2026-007', 'DEP-2026-008');

-- Vérifier le nombre de mouvements insérés
SELECT 'Mouvements insérés' as check, COUNT(*) as nb
FROM "MouvementStock"
WHERE notes LIKE 'Rattrapage achat direct BES-%';

-- Vérifier les nouveaux totaux
SELECT 'Mouvements ENTREE total' as metric, ROUND(SUM("prixTotal")) as valeur
FROM "MouvementStock" WHERE type = 'ENTREE' AND "prixTotal" IS NOT NULL
UNION ALL
SELECT 'Dépenses total', ROUND(SUM("montantTotal"))
FROM "Depense"
UNION ALL
SELECT 'Dépenses sans commandeId', ROUND(SUM("montantTotal"))
FROM "Depense" WHERE "commandeId" IS NULL;

COMMIT;
