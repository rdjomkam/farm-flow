-- =============================================================================
-- Correctif de données : 522 poissons fantômes — Vague 26-01 (cmmth8mav000004k31i3he89v)
-- =============================================================================
-- Origine : prisma/migrations/fix-vague2601-phantom-fish.sql (fichier orphelin, jamais
-- exécuté par `migrate deploy` — voir ADR-049 section 1). Investigation : après le
-- calibrage du 14/05/2026 (cmpcimvty002z01rumvue4ayb, créé le 19/05), les colonnes
-- "Bac"."nombrePoissons" et "AssignationBac"."nombrePoissons" affichaient une inflation
-- d'environ +130 par bac par rapport à la valeur attendue (COMPTAGE - mortalités
-- post-calibrage). Cause racine non identifiée (aucun chemin de code incriminé trouvé).
--
-- Cette migration est IDEMPOTENTE — rejouable sans effet (cf. ADR-049 §3.3.a).
--
-- ÉCART DÉCOUVERT PAR RAPPORT AU FICHIER SOURCE (limite documentée explicitement,
-- consigne de la story « ne pas deviner ») : le fichier source contient aussi des
-- `UPDATE "Bac" SET "nombrePoissons" = ...`. Or la migration
-- `20260521200000_adr043_phase3_remove_bac_production_fields` (commit 90e70db,
-- 2026-05-21 17:28) a supprimé la colonne "Bac"."nombrePoissons" — commit intervenu
-- AVANT le commit du fichier correctif source (c259b48, 2026-05-21 17:43). Cette
-- migration s'exécutant nécessairement APRÈS 20260521200000 dans la chaîne
-- (contrainte d'ordre des migrations), la colonne "Bac"."nombrePoissons" est garantie
-- absente sur TOUT environnement à jour au moment où ce correctif s'applique — y
-- inclus en production, si `docker-entrypoint.sh` y exécute `migrate deploy` à chaque
-- démarrage (confirmé par la pré-analyse sprint MG, section D). Un `UPDATE "Bac" SET
-- "nombrePoissons" = ...` échouerait donc avec une erreur SQL dure (colonne
-- inexistante), pas un no-op silencieux — contrairement à un `WHERE` qui ne matche
-- aucune ligne. Ce volet est donc volontairement OMIS de cette migration : depuis
-- ADR-043, "AssignationBac.nombreActuel" (colonne physique "nombrePoissons") est
-- l'unique source de vérité du nombre de poissons (cf. mémoire projet
-- "AssignationBac Source of Truth") — seul ce volet est converti ici.
--
-- Stratégie d'idempotence et garde sur agrégat dérivé (ADR-049 §3.3.a + pré-analyse
-- sprint MG section C) : chaque UPDATE ne s'applique QUE si la ligne porte encore la
-- valeur BUGGÉE CONNUE (documentée dans le fichier source), jamais une simple
-- différence avec la cible. Ainsi :
--   - valeur déjà corrigée (= cible)                  -> no-op (WHERE ne matche pas)
--   - valeur ayant légitimement évolué depuis (relevé) -> no-op (ne matche ni la valeur
--     buggée ni un état à écraser sans discernement — on ne détruit rien)
--   - valeur encore buggée (= valeur avant-fix)        -> corrigée vers la cible
--
-- Valeurs avant-fix (documentées dans le fichier source, colonne "actual") :
--   Bac 01 (cmmnd2oab000104jse23g509w) : 1696 -> cible 1564
--   Bac 04 (cmmtgbf4x000204lfb3tsnrrd) : 2247 -> cible 2117
--   Bac 07 (cmmtgcqsi000504lfaj2rpcjb) :  684 -> cible  554
--   Bac 09 (cmmtgd8br000704lf12xj13e1) :  882 -> cible  752
--
-- No-op silencieux si les identifiants CUID (Bac/Vague de production) sont absents de
-- la base courante (dev, test, nouveau site) : un UPDATE ... WHERE ... = '<absent>' ne
-- matche simplement aucune ligne, 0 ligne affectée n'est jamais une erreur SQL.
-- =============================================================================

DO $$
DECLARE
  v_rows_assignation INT := 0;
  v_tmp INT;
BEGIN
  -- AssignationBac (assignation ouverte, dateFin IS NULL) — colonne physique
  -- "nombrePoissons", mappée nombreActuel côté Prisma, seule source de vérité
  -- (ADR-043) depuis la suppression du champ dupliqué sur Bac.
  UPDATE "AssignationBac" SET "nombrePoissons" = 1564
  WHERE "bacId" = 'cmmnd2oab000104jse23g509w' AND "vagueId" = 'cmmth8mav000004k31i3he89v'
    AND "dateFin" IS NULL AND "nombrePoissons" = 1696;
  GET DIAGNOSTICS v_tmp = ROW_COUNT; v_rows_assignation := v_rows_assignation + v_tmp;

  UPDATE "AssignationBac" SET "nombrePoissons" = 2117
  WHERE "bacId" = 'cmmtgbf4x000204lfb3tsnrrd' AND "vagueId" = 'cmmth8mav000004k31i3he89v'
    AND "dateFin" IS NULL AND "nombrePoissons" = 2247;
  GET DIAGNOSTICS v_tmp = ROW_COUNT; v_rows_assignation := v_rows_assignation + v_tmp;

  UPDATE "AssignationBac" SET "nombrePoissons" = 554
  WHERE "bacId" = 'cmmtgcqsi000504lfaj2rpcjb' AND "vagueId" = 'cmmth8mav000004k31i3he89v'
    AND "dateFin" IS NULL AND "nombrePoissons" = 684;
  GET DIAGNOSTICS v_tmp = ROW_COUNT; v_rows_assignation := v_rows_assignation + v_tmp;

  UPDATE "AssignationBac" SET "nombrePoissons" = 752
  WHERE "bacId" = 'cmmtgd8br000704lf12xj13e1' AND "vagueId" = 'cmmth8mav000004k31i3he89v'
    AND "dateFin" IS NULL AND "nombrePoissons" = 882;
  GET DIAGNOSTICS v_tmp = ROW_COUNT; v_rows_assignation := v_rows_assignation + v_tmp;

  RAISE NOTICE '[data_fix_vague2601_phantom_fish] % ligne(s) AssignationBac corrigée(s) (0 = déjà appliqué, déjà à jour, ou données absentes de cette base). Volet Bac.nombrePoissons omis : colonne supprimée par ADR-043, voir en-tête.', v_rows_assignation;
END $$;
