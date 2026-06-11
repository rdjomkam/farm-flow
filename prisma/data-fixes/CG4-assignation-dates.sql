-- CG4-assignation-dates.sql
-- Audit + correctif des AssignationBac dont dateAssignation ne correspond pas
-- a la date de l'operation metier parente (calibrage, transfert ou arrivage).
--
-- INCIDENT : Bac 11 reçoit 2000 alevins via calibrage date 09 juin,
-- mais AssignationBac creee le 10 juin 10:36 (new Date() au lieu de calibrageDate).
-- Cela cause un trou de coherence dans computeVivantsByBac pour les operations antidatees.
--
-- UTILISATION :
--   1. Executer le SELECT seul pour auditer (sans rien modifier).
--   2. Relire les resultats. Si ok, decommmenter et executer l'UPDATE correspondant.
--   3. Toujours executer dans une transaction et verifier le nombre de lignes affectees.
--
-- PREREQUIS : Connexion en lecture/ecriture sur la base de production.
-- AUTEUR   : @developer — Sprint CG (Conservation Garantie), story CG.4
-- DATE     : 2026-06-11

-- =============================================================================
-- SECTION 1 — Ecarts via Calibrage
-- Cas : AssignationBac.dateAssignation > Calibrage.date
--       (la crea defensive utilisait new Date() au lieu de calibrageDate)
-- =============================================================================

-- Audit
SELECT
    ab.id             AS assignation_id,
    ab."bacId",
    ab."vagueId",
    ab."dateAssignation" AS date_assignation_actuelle,
    c.date            AS calibrage_date,
    c.id              AS calibrage_id,
    EXTRACT(EPOCH FROM (ab."dateAssignation" - c.date)) / 3600 AS ecart_heures
FROM "AssignationBac" ab
JOIN "CalibrageGroupe" cg ON cg."destinationBacId" = ab."bacId"
JOIN "Calibrage" c ON c.id = cg."calibrageId"
    AND c."vagueId" = ab."vagueId"
    AND c."siteId" = ab."siteId"
WHERE ab."dateAssignation" > c.date + INTERVAL '1 hour'
  AND ab."dateFin" IS NULL
ORDER BY ecart_heures DESC;

-- Correctif (decommmenter apres validation de l'audit)
-- BEGIN;
-- UPDATE "AssignationBac" ab
-- SET "dateAssignation" = c.date
-- FROM "CalibrageGroupe" cg
-- JOIN "Calibrage" c ON c.id = cg."calibrageId"
-- WHERE cg."destinationBacId" = ab."bacId"
--   AND c."vagueId" = ab."vagueId"
--   AND c."siteId" = ab."siteId"
--   AND ab."dateAssignation" > c.date + INTERVAL '1 hour'
--   AND ab."dateFin" IS NULL;
-- -- Verifier le nombre de lignes avant de committer
-- COMMIT;

-- =============================================================================
-- SECTION 2 — Ecarts via Transfert (updateTransfertGroupe — chemin defensif)
-- Cas : AssignationBac cree par updateTransfertGroupe avec new Date()
--       au lieu de groupe.transfert.date
-- =============================================================================

-- Audit
SELECT
    ab.id             AS assignation_id,
    ab."bacId",
    ab."vagueId",
    ab."dateAssignation" AS date_assignation_actuelle,
    t.date            AS transfert_date,
    t.id              AS transfert_id,
    tg.id             AS groupe_id,
    EXTRACT(EPOCH FROM (ab."dateAssignation" - t.date)) / 3600 AS ecart_heures
FROM "AssignationBac" ab
JOIN "TransfertGroupe" tg ON tg."bacDestId" = ab."bacId"
JOIN "Transfert" t ON t.id = tg."transfertId"
    AND t."siteId" = ab."siteId"
WHERE ab."vagueId" = (
    SELECT "vagueDestId" FROM "TransfertGroupe" tg2
    WHERE tg2.id = tg.id
)
  AND ab."dateAssignation" > t.date + INTERVAL '1 hour'
  AND ab."dateFin" IS NULL
ORDER BY ecart_heures DESC;

-- Correctif (decommmenter apres validation de l'audit)
-- BEGIN;
-- UPDATE "AssignationBac" ab
-- SET "dateAssignation" = t.date
-- FROM "TransfertGroupe" tg
-- JOIN "Transfert" t ON t.id = tg."transfertId"
-- WHERE tg."bacDestId" = ab."bacId"
--   AND ab."vagueId" = tg."vagueDestId"
--   AND t."siteId" = ab."siteId"
--   AND ab."dateAssignation" > t.date + INTERVAL '1 hour'
--   AND ab."dateFin" IS NULL;
-- COMMIT;

-- =============================================================================
-- SECTION 3 — Ecarts via Arrivage (updateArrivageGroupe — chemins defensifs)
-- Cas : AssignationBac cree par updateArrivageGroupe avec new Date()
--       au lieu de arrivage.date
-- =============================================================================

-- Audit
SELECT
    ab.id             AS assignation_id,
    ab."bacId",
    ab."vagueId",
    ab."dateAssignation" AS date_assignation_actuelle,
    a.date            AS arrivage_date,
    a.id              AS arrivage_id,
    ag.id             AS groupe_id,
    EXTRACT(EPOCH FROM (ab."dateAssignation" - a.date)) / 3600 AS ecart_heures
FROM "AssignationBac" ab
JOIN "ArrivageGroupe" ag ON ag."destinationBacId" = ab."bacId"
JOIN "Arrivage" a ON a.id = ag."arrivageId"
    AND a."vagueId" = ab."vagueId"
    AND a."siteId" = ab."siteId"
WHERE ab."dateAssignation" > a.date + INTERVAL '1 hour'
  AND ab."dateFin" IS NULL
  AND a."modifie" = true   -- les ecarts viennent d'un updateArrivageGroupe
ORDER BY ecart_heures DESC;

-- Correctif (decommmenter apres validation de l'audit)
-- BEGIN;
-- UPDATE "AssignationBac" ab
-- SET "dateAssignation" = a.date
-- FROM "ArrivageGroupe" ag
-- JOIN "Arrivage" a ON a.id = ag."arrivageId"
-- WHERE ag."destinationBacId" = ab."bacId"
--   AND a."vagueId" = ab."vagueId"
--   AND a."siteId" = ab."siteId"
--   AND ab."dateAssignation" > a.date + INTERVAL '1 hour'
--   AND ab."dateFin" IS NULL
--   AND a."modifie" = true;
-- COMMIT;

-- =============================================================================
-- SECTION 4 — Resume global : toutes les AssignationBac potentiellement impactees
-- =============================================================================

SELECT
    'calibrage'      AS source,
    COUNT(*)         AS nb_ecarts
FROM "AssignationBac" ab
JOIN "CalibrageGroupe" cg ON cg."destinationBacId" = ab."bacId"
JOIN "Calibrage" c ON c.id = cg."calibrageId"
    AND c."vagueId" = ab."vagueId"
    AND c."siteId" = ab."siteId"
WHERE ab."dateAssignation" > c.date + INTERVAL '1 hour'
  AND ab."dateFin" IS NULL

UNION ALL

SELECT
    'transfert'      AS source,
    COUNT(*)         AS nb_ecarts
FROM "AssignationBac" ab
JOIN "TransfertGroupe" tg ON tg."bacDestId" = ab."bacId"
JOIN "Transfert" t ON t.id = tg."transfertId"
    AND t."siteId" = ab."siteId"
WHERE ab."vagueId" = tg."vagueDestId"
  AND ab."dateAssignation" > t.date + INTERVAL '1 hour'
  AND ab."dateFin" IS NULL

UNION ALL

SELECT
    'arrivage'       AS source,
    COUNT(*)         AS nb_ecarts
FROM "AssignationBac" ab
JOIN "ArrivageGroupe" ag ON ag."destinationBacId" = ab."bacId"
JOIN "Arrivage" a ON a.id = ag."arrivageId"
    AND a."vagueId" = ab."vagueId"
    AND a."siteId" = ab."siteId"
WHERE ab."dateAssignation" > a.date + INTERVAL '1 hour'
  AND ab."dateFin" IS NULL
  AND a."modifie" = true;
