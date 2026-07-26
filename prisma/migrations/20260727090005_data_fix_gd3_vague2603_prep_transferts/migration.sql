-- =============================================================================
-- Correctif de données : rétroactif GD.3 — Vague-26-03-Prep (cmplrrba6000101qwazzjca26)
-- =============================================================================
-- Origine : scripts/data-fixes/gd3-vague-26-03-prep-transferts.sql +
-- scripts/data-fixes/gd3-apply.sh (script légitimement hors prisma/migrations/, mais
-- appliqué manuellement en production sans passer par `migrate deploy` — voir
-- ADR-049 section 1, incident Bac 11 / Vague-26-03-Prep documenté par ADR-048 et
-- docs/analysis/GD3-data-fix-report.md, exécution rapportée le 2026-07-15).
-- Investigation : 3 relevés COMPTAGE utilisés comme substitut anti-pattern à un vrai
-- transfert traçable (retrait successif de Bac 08 et Bac 12) sont remplacés par
-- 2 Transfert + 2 TransfertGroupe + 4 Relevé TRANSFERT (sortant/entrant), avec mise à
-- jour des AssignationBac fermées (Bac 08, Bac 12) à 0 poisson restant.
--
-- Cette migration est IDEMPOTENTE — rejouable sans effet (cf. ADR-049 §3.3.a).
--
-- Stratégie d'idempotence (point le plus important de la story, ADR-049 §3.3.b) : le
-- script source utilisait `ON CONFLICT (id) DO NOTHING`, qui NE PROTÈGE PAS contre une
-- violation de clé étrangère — un INSERT référençant un siteId/userId/vagueId/bacId/
-- transfertGroupeId absent échouerait AVANT l'évaluation du conflit, ce qui bloquerait
-- durablement tout futur `migrate deploy` sur un environnement sans les données de
-- production (dev, test, nouveau site). Chaque INSERT est donc réécrit en
-- `INSERT ... SELECT ... WHERE EXISTS (<toutes les FK référencées existent>)
-- AND NOT EXISTS (<la ligne cible id existe déjà>)`.
--
-- Garde-fou intégré (consigne (e)) : le bloc de vérification de l'invariant de
-- conservation (réplique fidèle du garde-fou du script source, la meilleure pièce du
-- dépôt sur ce point) ne s'exécute désormais QUE si la vague GD3
-- (cmplrrba6000101qwazzjca26) existe réellement sur la base courante — sinon il
-- serait un `RAISE EXCEPTION` inconditionnel qui ferait échouer la migration sur
-- toute base sans les données GD3 (dev, test, nouveau site).
--
-- No-op silencieux si les identifiants CUID (Site/Vague/Bac/User de production) sont
-- absents de la base courante : chaque clause EXISTS ne matche rien, aucun INSERT
-- n'est tenté, aucune erreur de contrainte étrangère n'est levée.
-- =============================================================================

DO $$
DECLARE
  v_rows INT := 0;
  v_total_inserted INT := 0;
BEGIN
  -- ===========================================================================
  -- TG1 : Bac 08 -> Bac 12 (263 poissons, poidsMoyen=42g, date 15/06 10:20:00)
  -- ===========================================================================

  -- Transfert (TG1)
  INSERT INTO "Transfert" (id, "siteId", date, notes, "userId", "createdAt", "updatedAt")
  SELECT
    'gd3_transfert_bac08_bac12',
    'cmmmxjqll000004l2vd7crswl',
    '2026-06-15 10:20:00'::timestamp,
    'GD.3 retroactif : tracabilite transfert lors du retrait de Bac 08',
    'cmmmwvdc5000004l8aellgsyf',
    NOW(), NOW()
  WHERE
    EXISTS (SELECT 1 FROM "Site" WHERE id = 'cmmmxjqll000004l2vd7crswl')
    AND EXISTS (SELECT 1 FROM "User" WHERE id = 'cmmmwvdc5000004l8aellgsyf')
    AND NOT EXISTS (SELECT 1 FROM "Transfert" WHERE id = 'gd3_transfert_bac08_bac12');
  GET DIAGNOSTICS v_rows = ROW_COUNT; v_total_inserted := v_total_inserted + v_rows;

  -- TransfertGroupe (TG1)
  INSERT INTO "TransfertGroupe" (id, "transfertId", "vagueSourceId", "bacSourceId", "vagueDestId", "bacDestId", "nombrePoissons", "poidsMoyenG", "nombreMorts", "createdAt", "updatedAt")
  SELECT
    'gd3_tg_bac08_bac12',
    'gd3_transfert_bac08_bac12',
    'cmplrrba6000101qwazzjca26',
    'cmmtgcza8000604lf3ft910rv',
    'cmplrrba6000101qwazzjca26',
    'cmmtgg6wj000a04lfbwcuax2c',
    263, 42, 0, NOW(), NOW()
  WHERE
    EXISTS (SELECT 1 FROM "Transfert" WHERE id = 'gd3_transfert_bac08_bac12')
    AND EXISTS (SELECT 1 FROM "Vague" WHERE id = 'cmplrrba6000101qwazzjca26')
    AND EXISTS (SELECT 1 FROM "Bac" WHERE id = 'cmmtgcza8000604lf3ft910rv')
    AND EXISTS (SELECT 1 FROM "Bac" WHERE id = 'cmmtgg6wj000a04lfbwcuax2c')
    AND NOT EXISTS (SELECT 1 FROM "TransfertGroupe" WHERE id = 'gd3_tg_bac08_bac12');
  GET DIAGNOSTICS v_rows = ROW_COUNT; v_total_inserted := v_total_inserted + v_rows;

  -- Releve sortant cote Bac 08
  INSERT INTO "Releve" (id, "bacId", "vagueId", "typeReleve", date, "nombreTransferes", "transfertGroupeId", "siteId", "userId", notes, "createdAt", "updatedAt", modifie)
  SELECT
    'gd3_releve_sortant_bac08',
    'cmmtgcza8000604lf3ft910rv',
    'cmplrrba6000101qwazzjca26',
    'TRANSFERT',
    '2026-06-15 10:20:00'::timestamp,
    263,
    'gd3_tg_bac08_bac12',
    'cmmmxjqll000004l2vd7crswl',
    'cmmmwvdc5000004l8aellgsyf',
    'GD.3 retroactif : sortant Bac 08 lors du retrait',
    NOW(), NOW(), false
  WHERE
    EXISTS (SELECT 1 FROM "Bac" WHERE id = 'cmmtgcza8000604lf3ft910rv')
    AND EXISTS (SELECT 1 FROM "Vague" WHERE id = 'cmplrrba6000101qwazzjca26')
    AND EXISTS (SELECT 1 FROM "TransfertGroupe" WHERE id = 'gd3_tg_bac08_bac12')
    AND EXISTS (SELECT 1 FROM "Site" WHERE id = 'cmmmxjqll000004l2vd7crswl')
    AND EXISTS (SELECT 1 FROM "User" WHERE id = 'cmmmwvdc5000004l8aellgsyf')
    AND NOT EXISTS (SELECT 1 FROM "Releve" WHERE id = 'gd3_releve_sortant_bac08');
  GET DIAGNOSTICS v_rows = ROW_COUNT; v_total_inserted := v_total_inserted + v_rows;

  -- Releve entrant cote Bac 12
  INSERT INTO "Releve" (id, "bacId", "vagueId", "typeReleve", date, "nombreTransferes", "transfertGroupeId", "siteId", "userId", notes, "createdAt", "updatedAt", modifie)
  SELECT
    'gd3_releve_entrant_bac12',
    'cmmtgg6wj000a04lfbwcuax2c',
    'cmplrrba6000101qwazzjca26',
    'TRANSFERT',
    '2026-06-15 10:20:00'::timestamp,
    263,
    'gd3_tg_bac08_bac12',
    'cmmmxjqll000004l2vd7crswl',
    'cmmmwvdc5000004l8aellgsyf',
    'GD.3 retroactif : arrivage par transfert depuis Bac 08',
    NOW(), NOW(), false
  WHERE
    EXISTS (SELECT 1 FROM "Bac" WHERE id = 'cmmtgg6wj000a04lfbwcuax2c')
    AND EXISTS (SELECT 1 FROM "Vague" WHERE id = 'cmplrrba6000101qwazzjca26')
    AND EXISTS (SELECT 1 FROM "TransfertGroupe" WHERE id = 'gd3_tg_bac08_bac12')
    AND EXISTS (SELECT 1 FROM "Site" WHERE id = 'cmmmxjqll000004l2vd7crswl')
    AND EXISTS (SELECT 1 FROM "User" WHERE id = 'cmmmwvdc5000004l8aellgsyf')
    AND NOT EXISTS (SELECT 1 FROM "Releve" WHERE id = 'gd3_releve_entrant_bac12');
  GET DIAGNOSTICS v_rows = ROW_COUNT; v_total_inserted := v_total_inserted + v_rows;

  -- ===========================================================================
  -- TG2 : Bac 12 -> Bac 11 (712 poissons, poidsMoyen=20g, date 15/06 12:00:00)
  -- ===========================================================================

  -- Transfert (TG2)
  INSERT INTO "Transfert" (id, "siteId", date, notes, "userId", "createdAt", "updatedAt")
  SELECT
    'gd3_transfert_bac12_bac11',
    'cmmmxjqll000004l2vd7crswl',
    '2026-06-15 12:00:00'::timestamp,
    'GD.3 retroactif : tracabilite transfert lors du retrait de Bac 12',
    'cmmmwvdc5000004l8aellgsyf',
    NOW(), NOW()
  WHERE
    EXISTS (SELECT 1 FROM "Site" WHERE id = 'cmmmxjqll000004l2vd7crswl')
    AND EXISTS (SELECT 1 FROM "User" WHERE id = 'cmmmwvdc5000004l8aellgsyf')
    AND NOT EXISTS (SELECT 1 FROM "Transfert" WHERE id = 'gd3_transfert_bac12_bac11');
  GET DIAGNOSTICS v_rows = ROW_COUNT; v_total_inserted := v_total_inserted + v_rows;

  -- TransfertGroupe (TG2)
  INSERT INTO "TransfertGroupe" (id, "transfertId", "vagueSourceId", "bacSourceId", "vagueDestId", "bacDestId", "nombrePoissons", "poidsMoyenG", "nombreMorts", "createdAt", "updatedAt")
  SELECT
    'gd3_tg_bac12_bac11',
    'gd3_transfert_bac12_bac11',
    'cmplrrba6000101qwazzjca26',
    'cmmtgg6wj000a04lfbwcuax2c',
    'cmplrrba6000101qwazzjca26',
    'cmmtgfw5y000904lfbjb3opqt',
    712, 20, 0, NOW(), NOW()
  WHERE
    EXISTS (SELECT 1 FROM "Transfert" WHERE id = 'gd3_transfert_bac12_bac11')
    AND EXISTS (SELECT 1 FROM "Vague" WHERE id = 'cmplrrba6000101qwazzjca26')
    AND EXISTS (SELECT 1 FROM "Bac" WHERE id = 'cmmtgg6wj000a04lfbwcuax2c')
    AND EXISTS (SELECT 1 FROM "Bac" WHERE id = 'cmmtgfw5y000904lfbjb3opqt')
    AND NOT EXISTS (SELECT 1 FROM "TransfertGroupe" WHERE id = 'gd3_tg_bac12_bac11');
  GET DIAGNOSTICS v_rows = ROW_COUNT; v_total_inserted := v_total_inserted + v_rows;

  -- Releve sortant cote Bac 12
  INSERT INTO "Releve" (id, "bacId", "vagueId", "typeReleve", date, "nombreTransferes", "transfertGroupeId", "siteId", "userId", notes, "createdAt", "updatedAt", modifie)
  SELECT
    'gd3_releve_sortant_bac12',
    'cmmtgg6wj000a04lfbwcuax2c',
    'cmplrrba6000101qwazzjca26',
    'TRANSFERT',
    '2026-06-15 12:00:00'::timestamp,
    712,
    'gd3_tg_bac12_bac11',
    'cmmmxjqll000004l2vd7crswl',
    'cmmmwvdc5000004l8aellgsyf',
    'GD.3 retroactif : sortant Bac 12 lors du retrait',
    NOW(), NOW(), false
  WHERE
    EXISTS (SELECT 1 FROM "Bac" WHERE id = 'cmmtgg6wj000a04lfbwcuax2c')
    AND EXISTS (SELECT 1 FROM "Vague" WHERE id = 'cmplrrba6000101qwazzjca26')
    AND EXISTS (SELECT 1 FROM "TransfertGroupe" WHERE id = 'gd3_tg_bac12_bac11')
    AND EXISTS (SELECT 1 FROM "Site" WHERE id = 'cmmmxjqll000004l2vd7crswl')
    AND EXISTS (SELECT 1 FROM "User" WHERE id = 'cmmmwvdc5000004l8aellgsyf')
    AND NOT EXISTS (SELECT 1 FROM "Releve" WHERE id = 'gd3_releve_sortant_bac12');
  GET DIAGNOSTICS v_rows = ROW_COUNT; v_total_inserted := v_total_inserted + v_rows;

  -- Releve entrant cote Bac 11
  INSERT INTO "Releve" (id, "bacId", "vagueId", "typeReleve", date, "nombreTransferes", "transfertGroupeId", "siteId", "userId", notes, "createdAt", "updatedAt", modifie)
  SELECT
    'gd3_releve_entrant_bac11',
    'cmmtgfw5y000904lfbjb3opqt',
    'cmplrrba6000101qwazzjca26',
    'TRANSFERT',
    '2026-06-15 12:00:00'::timestamp,
    712,
    'gd3_tg_bac12_bac11',
    'cmmmxjqll000004l2vd7crswl',
    'cmmmwvdc5000004l8aellgsyf',
    'GD.3 retroactif : arrivage par transfert depuis Bac 12',
    NOW(), NOW(), false
  WHERE
    EXISTS (SELECT 1 FROM "Bac" WHERE id = 'cmmtgfw5y000904lfbjb3opqt')
    AND EXISTS (SELECT 1 FROM "Vague" WHERE id = 'cmplrrba6000101qwazzjca26')
    AND EXISTS (SELECT 1 FROM "TransfertGroupe" WHERE id = 'gd3_tg_bac12_bac11')
    AND EXISTS (SELECT 1 FROM "Site" WHERE id = 'cmmmxjqll000004l2vd7crswl')
    AND EXISTS (SELECT 1 FROM "User" WHERE id = 'cmmmwvdc5000004l8aellgsyf')
    AND NOT EXISTS (SELECT 1 FROM "Releve" WHERE id = 'gd3_releve_entrant_bac11');
  GET DIAGNOSTICS v_rows = ROW_COUNT; v_total_inserted := v_total_inserted + v_rows;

  RAISE NOTICE '[data_fix_gd3_vague2603_prep_transferts] % ligne(s) insérée(s) au total sur Transfert/TransfertGroupe/Releve (0 = déjà appliqué ou données GD3 absentes de cette base)', v_total_inserted;
END $$;

-- ===============================================================================
-- DELETE des 3 COMPTAGES anti-pattern (naturellement idempotent : DELETE par id sur
-- une ligne absente = 0 ligne affectée, jamais une erreur SQL)
-- ===============================================================================

DO $$
DECLARE
  v_rows INT := 0;
BEGIN
  DELETE FROM "Releve" WHERE id IN (
    'cmqf2d6a6005601rr4lop685g',   -- Bac 08 COMPTAGE=0
    'cmqf2d6ah005701rrozze4x36',   -- Bac 12 COMPTAGE=712
    'cmrlr6jgb000301nbu1hizbat'    -- Bac 11 COMPTAGE=936
  );
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RAISE NOTICE '[data_fix_gd3_vague2603_prep_transferts] % releve(s) COMPTAGE anti-pattern supprime(s) (0 = déjà appliqué ou données absentes de cette base)', v_rows;
END $$;

-- ===============================================================================
-- Fix AssignationBac.nombrePoissons pour bacs 08 et 12 (fermés)
-- (Bac 11 reste inchangé, cohérent avec le replay init=2000 - 1776 + 712)
-- Idempotent en l'état d'origine : garde explicite sur la valeur buggée observable
-- (nombrePoissons != 0) — cible = 0, valeur absolue, jamais un delta relatif.
-- ===============================================================================

DO $$
DECLARE
  v_rows INT := 0;
BEGIN
  UPDATE "AssignationBac" SET "nombrePoissons" = 0, "updatedAt" = NOW()
  WHERE "vagueId" = 'cmplrrba6000101qwazzjca26'
    AND "bacId" IN ('cmmtgcza8000604lf3ft910rv', 'cmmtgg6wj000a04lfbwcuax2c')
    AND "dateFin" IS NOT NULL
    AND "nombrePoissons" != 0;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RAISE NOTICE '[data_fix_gd3_vague2603_prep_transferts] % AssignationBac corrigée(s) a 0 poisson (0 = déjà appliqué ou données absentes de cette base)', v_rows;
END $$;

-- ===============================================================================
-- Garde-fou intégré (pas préalable) : vérification de l'invariant de conservation
-- — réplique du garde-fou du script source, rendue conditionnelle à l'existence
-- réelle de la vague GD3 sur la base courante (consigne (e) : sinon ce bloc ferait
-- échouer la migration sur toute base sans les données GD3, ce qui est exactement le
-- risque à éviter selon ADR-049 §3.3.b).
-- ===============================================================================

DO $$
DECLARE
  r RECORD;
  ok BOOLEAN := true;
  v_vague_exists BOOLEAN;
BEGIN
  SELECT EXISTS (SELECT 1 FROM "Vague" WHERE id = 'cmplrrba6000101qwazzjca26') INTO v_vague_exists;

  IF NOT v_vague_exists THEN
    RAISE NOTICE '[data_fix_gd3_vague2603_prep_transferts] Vague GD3 (cmplrrba6000101qwazzjca26) absente de cette base — vérification de l''invariant de conservation ignorée (no-op)';
    RETURN;
  END IF;

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

  RAISE NOTICE '[data_fix_gd3_vague2603_prep_transferts] Vérification invariant de conservation : TOUS LES BACS OK';
END $$;
