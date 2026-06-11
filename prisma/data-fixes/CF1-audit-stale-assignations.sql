-- CF1-audit-stale-assignations.sql
-- Audit prod — Story CF.1 (edge case calibrage leger)
-- Date : 2026-06-11
--
-- SELECT ONLY — aucune modification des donnees.
--
-- Resultats executes contre la base dev (2026-06-11) :
--   Audit 1 : 0 ligne (aucun calibrage historique avec bac source sans AssignationBac active)
--   Audit 2 : 0 ligne (aucun bac actif de vague EN_COURS sans releve exploitable)
--
-- Conclusion : pas de situation pathologique en base. Le patch CF.1 est preventif.
--
-- Execution :
--   docker exec -i silures-db psql -U dkfarm -d farm-flow < prisma/data-fixes/CF1-audit-stale-assignations.sql


-- ---------------------------------------------------------------------------
-- Audit 1 : calibrages historiques dont au moins un bac source n'avait plus
--           d'AssignationBac active (dateFin IS NULL) a la date du calibrage.
--
-- Un resultat ici indiquerait qu'un calibrage a ete cree pendant une race condition
-- (assignation fermee entre la validation et l'execution).
--
-- Note : sourceBacIds est de type text[] (tableau PostgreSQL natif), on utilise
-- unnest() et non jsonb_array_elements_text().
-- ---------------------------------------------------------------------------

SELECT
  c.id          AS calibrage_id,
  c."vagueId"   AS vague_id,
  c.date        AS calibrage_date,
  src.bac_id    AS bac_source_manquant
FROM
  "Calibrage" c
  CROSS JOIN LATERAL unnest(c."sourceBacIds") AS src(bac_id)
WHERE
  -- Pas d'AssignationBac active pour ce bac dans cette vague A la date du calibrage
  NOT EXISTS (
    SELECT 1
    FROM "AssignationBac" ab
    WHERE ab."bacId"    = src.bac_id
      AND ab."vagueId"  = c."vagueId"
      AND ab."dateAssignation" <= c.date
      AND (ab."dateFin" IS NULL OR ab."dateFin" > c.date)
  )
ORDER BY c.date DESC;


-- ---------------------------------------------------------------------------
-- Audit 2 : bacs actifs de vagues EN_COURS sans aucun releve exploitable.
--
-- "Exploitable" = releve de type MORTALITE, COMPTAGE, ARRIVAGE, TRANSFERT ou VENTE
-- sur ce bac dans cette vague.
--
-- Un bac dans ce cas tomberait en Cas B lors d'un calibrage : le code utilise
-- nombreInitial de l'AssignationBac comme base. On verifie que cette valeur est > 0.
-- ---------------------------------------------------------------------------

SELECT
  ab.id                  AS assignation_id,
  ab."bacId"             AS bac_id,
  b.nom                  AS bac_nom,
  ab."vagueId"           AS vague_id,
  v.code                 AS vague_code,
  ab."nombrePoissonsInitial" AS nombre_initial,
  ab."nombrePoissons"    AS nombre_actuel
FROM
  "AssignationBac" ab
  JOIN "Bac"   b ON b.id = ab."bacId"
  JOIN "Vague" v ON v.id = ab."vagueId"
WHERE
  ab."dateFin" IS NULL
  AND v.statut = 'EN_COURS'
  AND NOT EXISTS (
    SELECT 1
    FROM "Releve" r
    WHERE r."bacId"   = ab."bacId"
      AND r."vagueId" = ab."vagueId"
      AND r."typeReleve" IN ('MORTALITE', 'COMPTAGE', 'ARRIVAGE', 'TRANSFERT', 'VENTE')
  )
ORDER BY v.code, b.nom;
