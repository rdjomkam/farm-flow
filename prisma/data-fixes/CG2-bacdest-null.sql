-- CG2 — Repair NULL bacDestId on TransfertGroupe
-- Sprint : CG (Conservation Garantie)
-- Date   : 2026-06-11
--
-- IMPORTANT : exécuter les étapes dans l'ordre.
-- L'étape 2 (UPDATE) ne doit être appliquée qu'après revue manuelle des candidats.

-- ===========================================================================
-- Étape A — Compter les orphelins
-- ===========================================================================
SELECT COUNT(*) AS orphelins FROM "TransfertGroupe" WHERE "bacDestId" IS NULL;

-- ===========================================================================
-- Étape B — Identifier les candidats avec la meilleure AssignationBac candidate
-- (critère : même vagueDestId, date proche du transfert)
-- ===========================================================================
WITH orphans AS (
  SELECT
    tg.id          AS groupe_id,
    tg."vagueDestId",
    tg."nombrePoissons",
    t.date         AS transfert_date
  FROM "TransfertGroupe" tg
  JOIN "Transfert" t ON t.id = tg."transfertId"
  WHERE tg."bacDestId" IS NULL
)
SELECT
  o.groupe_id,
  o."vagueDestId",
  o.transfert_date,
  ab.id  AS assignation_id,
  ab."bacId" AS candidat_bacId
FROM orphans o
LEFT JOIN "AssignationBac" ab
  ON ab."vagueId"  = o."vagueDestId"
  AND DATE(ab."dateAssignation") = DATE(o.transfert_date)
ORDER BY o.transfert_date DESC;

-- ===========================================================================
-- Étape C — Identifier les bacs de la vague destination (toutes AssignationBac)
-- (utile si la date d'assignation ne correspond pas exactement)
-- ===========================================================================
SELECT
  tg.id            AS groupe_id,
  tg."vagueDestId",
  t.date           AS transfert_date,
  ab.id            AS assignation_id,
  ab."bacId",
  ab."dateAssignation",
  ab."dateFin"
FROM "TransfertGroupe" tg
JOIN "Transfert" t ON t.id = tg."transfertId"
LEFT JOIN "AssignationBac" ab ON ab."vagueId" = tg."vagueDestId"
WHERE tg."bacDestId" IS NULL
ORDER BY tg.id, ab."dateAssignation" ASC;

-- ===========================================================================
-- Étape D — Cas connu : groupe cmplmjm980002wrek8rugmdz5 (Vague-26-03)
--
-- INSTRUCTIONS :
-- 1. Relancer l'étape C pour voir les AssignationBac disponibles.
-- 2. Remplacer '<bacId_correct>' par le bacId identifié.
-- 3. Décommenter et exécuter dans une transaction.
-- ===========================================================================

-- BEGIN;
--
-- UPDATE "TransfertGroupe"
-- SET "bacDestId" = '<bacId_correct>'
-- WHERE id = 'cmplmjm980002wrek8rugmdz5'
--   AND "bacDestId" IS NULL;
--
-- -- Vérifier
-- SELECT id, "bacDestId" FROM "TransfertGroupe" WHERE id = 'cmplmjm980002wrek8rugmdz5';
--
-- COMMIT;

-- ===========================================================================
-- Étape E — Vérification finale
-- ===========================================================================
SELECT COUNT(*) AS orphelins_restants FROM "TransfertGroupe" WHERE "bacDestId" IS NULL;
