-- Sprint GD — Story GD.3 : data-fix rétroactif Vague-26-03-Prep
-- Remplace 3 « COMPTAGES déguisés » par de vrais TransfertGroupes traçables
-- ⚠️ À exécuter APRÈS backup et AVANT deploy du guard corrigé (GD.1)
--
-- Contexte : voir docs/bugs/BUG-049.md et docs/sprints/SPRINT-GD-GUARD-DISCRIMINATION.md
-- Vague    : cmplrrba6000101qwazzjca26 (Vague-26-03-Prep)
-- Site     : cmmmxjqll000004l2vd7crswl
-- User     : cmmmwvdc5000004l8aellgsyf (ronald.djomkam@gmail.com)
--
-- Bacs :
--   Bac 08 = cmmtgcza8000604lf3ft910rv
--   Bac 11 = cmmtgfw5y000904lfbjb3opqt
--   Bac 12 = cmmtgg6wj000a04lfbwcuax2c

BEGIN;

-- =============================================================================
-- TG1 : Bac 08 → Bac 12 (263 poissons, poidsMoyen=42g, date 15/06 10:20:00)
-- =============================================================================

INSERT INTO "Transfert" (id, "siteId", date, notes, "userId", "createdAt", "updatedAt")
VALUES (
  'gd3_transfert_bac08_bac12',
  'cmmmxjqll000004l2vd7crswl',
  '2026-06-15 10:20:00',
  'GD.3 retroactif : tracabilite transfert lors du retrait de Bac 08',
  'cmmmwvdc5000004l8aellgsyf',
  NOW(), NOW()
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO "TransfertGroupe" (id, "transfertId", "vagueSourceId", "bacSourceId", "vagueDestId", "bacDestId", "nombrePoissons", "poidsMoyenG", "nombreMorts", "createdAt", "updatedAt")
VALUES (
  'gd3_tg_bac08_bac12',
  'gd3_transfert_bac08_bac12',
  'cmplrrba6000101qwazzjca26',
  'cmmtgcza8000604lf3ft910rv',   -- Bac 08 source
  'cmplrrba6000101qwazzjca26',
  'cmmtgg6wj000a04lfbwcuax2c',   -- Bac 12 dest
  263, 42, 0, NOW(), NOW()
)
ON CONFLICT (id) DO NOTHING;

-- Releve sortant côté Bac 08
INSERT INTO "Releve" (id, "bacId", "vagueId", "typeReleve", date, "nombreTransferes", "transfertGroupeId", "siteId", "userId", notes, "createdAt", "updatedAt", modifie)
VALUES (
  'gd3_releve_sortant_bac08',
  'cmmtgcza8000604lf3ft910rv',
  'cmplrrba6000101qwazzjca26',
  'TRANSFERT',
  '2026-06-15 10:20:00',
  263,
  'gd3_tg_bac08_bac12',
  'cmmmxjqll000004l2vd7crswl',
  'cmmmwvdc5000004l8aellgsyf',
  'GD.3 retroactif : sortant Bac 08 lors du retrait',
  NOW(), NOW(), false
)
ON CONFLICT (id) DO NOTHING;

-- Releve entrant côté Bac 12
INSERT INTO "Releve" (id, "bacId", "vagueId", "typeReleve", date, "nombreTransferes", "transfertGroupeId", "siteId", "userId", notes, "createdAt", "updatedAt", modifie)
VALUES (
  'gd3_releve_entrant_bac12',
  'cmmtgg6wj000a04lfbwcuax2c',
  'cmplrrba6000101qwazzjca26',
  'TRANSFERT',
  '2026-06-15 10:20:00',
  263,
  'gd3_tg_bac08_bac12',
  'cmmmxjqll000004l2vd7crswl',
  'cmmmwvdc5000004l8aellgsyf',
  'GD.3 retroactif : arrivage par transfert depuis Bac 08',
  NOW(), NOW(), false
)
ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- TG2 : Bac 12 → Bac 11 (712 poissons, poidsMoyen=20g, date 15/06 12:00:00)
-- =============================================================================

INSERT INTO "Transfert" (id, "siteId", date, notes, "userId", "createdAt", "updatedAt")
VALUES (
  'gd3_transfert_bac12_bac11',
  'cmmmxjqll000004l2vd7crswl',
  '2026-06-15 12:00:00',
  'GD.3 retroactif : tracabilite transfert lors du retrait de Bac 12',
  'cmmmwvdc5000004l8aellgsyf',
  NOW(), NOW()
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO "TransfertGroupe" (id, "transfertId", "vagueSourceId", "bacSourceId", "vagueDestId", "bacDestId", "nombrePoissons", "poidsMoyenG", "nombreMorts", "createdAt", "updatedAt")
VALUES (
  'gd3_tg_bac12_bac11',
  'gd3_transfert_bac12_bac11',
  'cmplrrba6000101qwazzjca26',
  'cmmtgg6wj000a04lfbwcuax2c',   -- Bac 12 source
  'cmplrrba6000101qwazzjca26',
  'cmmtgfw5y000904lfbjb3opqt',   -- Bac 11 dest
  712, 20, 0, NOW(), NOW()
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO "Releve" (id, "bacId", "vagueId", "typeReleve", date, "nombreTransferes", "transfertGroupeId", "siteId", "userId", notes, "createdAt", "updatedAt", modifie)
VALUES (
  'gd3_releve_sortant_bac12',
  'cmmtgg6wj000a04lfbwcuax2c',
  'cmplrrba6000101qwazzjca26',
  'TRANSFERT',
  '2026-06-15 12:00:00',
  712,
  'gd3_tg_bac12_bac11',
  'cmmmxjqll000004l2vd7crswl',
  'cmmmwvdc5000004l8aellgsyf',
  'GD.3 retroactif : sortant Bac 12 lors du retrait',
  NOW(), NOW(), false
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO "Releve" (id, "bacId", "vagueId", "typeReleve", date, "nombreTransferes", "transfertGroupeId", "siteId", "userId", notes, "createdAt", "updatedAt", modifie)
VALUES (
  'gd3_releve_entrant_bac11',
  'cmmtgfw5y000904lfbjb3opqt',
  'cmplrrba6000101qwazzjca26',
  'TRANSFERT',
  '2026-06-15 12:00:00',
  712,
  'gd3_tg_bac12_bac11',
  'cmmmxjqll000004l2vd7crswl',
  'cmmmwvdc5000004l8aellgsyf',
  'GD.3 retroactif : arrivage par transfert depuis Bac 12',
  NOW(), NOW(), false
)
ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- DELETE des 3 COMPTAGES anti-pattern
-- =============================================================================

DELETE FROM "Releve" WHERE id IN (
  'cmqf2d6a6005601rr4lop685g',   -- Bac 08 COMPTAGE=0
  'cmqf2d6ah005701rrozze4x36',   -- Bac 12 COMPTAGE=712
  'cmrlr6jgb000301nbu1hizbat'    -- Bac 11 COMPTAGE=936
);

-- =============================================================================
-- Fix AssignationBac.nombrePoissons pour bacs 08 et 12 (closed)
-- (Bac 11 reste à 936, cohérent avec le replay init=2000 - 1776 + 712)
-- =============================================================================

UPDATE "AssignationBac" SET "nombrePoissons" = 0, "updatedAt" = NOW()
WHERE "vagueId" = 'cmplrrba6000101qwazzjca26'
  AND "bacId" IN ('cmmtgcza8000604lf3ft910rv', 'cmmtgg6wj000a04lfbwcuax2c')
  AND "dateFin" IS NOT NULL
  AND "nombrePoissons" != 0;

-- =============================================================================
-- Vérification pre-commit : replay chaque bac, doit matcher nombrePoissons
-- =============================================================================

DO $$
DECLARE
  r RECORD;
  ok BOOLEAN := true;
BEGIN
  FOR r IN
    SELECT b.nom, ab."nombrePoissons" AS actuel, ab."dateFin" AS date_fin,
           (
             SELECT ab."nombrePoissonsInitial"
               - COALESCE(SUM(CASE WHEN rv."typeReleve"='MORTALITE' THEN rv."nombreMorts" ELSE 0 END),0)
               - COALESCE(SUM(CASE WHEN rv."typeReleve"='VENTE' THEN rv."nombreVendus" ELSE 0 END),0)
               - COALESCE(SUM(CASE WHEN rv."typeReleve"='TRANSFERT' AND tg."bacSourceId"=ab."bacId" THEN rv."nombreTransferes" ELSE 0 END),0)
               + COALESCE(SUM(CASE WHEN rv."typeReleve"='TRANSFERT' AND tg."bacDestId"=ab."bacId" THEN rv."nombreTransferes" ELSE 0 END),0)
               + COALESCE(SUM(CASE WHEN rv."typeReleve"='ARRIVAGE' THEN rv."nombreCompte" ELSE 0 END),0)
             FROM "Releve" rv
             LEFT JOIN "TransfertGroupe" tg ON tg.id = rv."transfertGroupeId"
             WHERE rv."bacId"=ab."bacId" AND rv."vagueId"=ab."vagueId"
           ) AS expected
    FROM "AssignationBac" ab
    JOIN "Bac" b ON b.id=ab."bacId"
    WHERE ab."vagueId"='cmplrrba6000101qwazzjca26'
      AND b.nom IN ('Bac 08','Bac 11','Bac 12')
      AND (ab."dateFin" IS NULL OR ab."dateAssignation" > '2026-06-01')  -- ignore old closed
  LOOP
    RAISE NOTICE '% : actuel=% expected=% dateFin=%', r.nom, r.actuel, r.expected, r.date_fin;
    IF r.actuel != r.expected THEN
      ok := false;
      RAISE WARNING 'INVARIANT KO sur %: actuel=% expected=%', r.nom, r.actuel, r.expected;
    END IF;
  END LOOP;

  IF NOT ok THEN
    RAISE EXCEPTION 'GD.3 replay verification FAILED — rollback';
  END IF;

  RAISE NOTICE 'GD.3 replay verification: TOUS LES BACS OK';
END $$;

COMMIT;
