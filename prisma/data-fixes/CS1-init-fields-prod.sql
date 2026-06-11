-- CS1 — Populate nombreInitial / poidsMoyenInitial on AssignationBac destination
-- Sprint : CS.1 (Correction Silures — champs init)
-- Date   : 2026-06-11
--
-- Contexte :
--   createTransfert et updateTransfertGroupe créaient les AssignationBac destination
--   avec nombreInitial=0 et poidsMoyenInitial=0.
--   computeVivantsByBac retournait donc 0 poissons vivants pour la destination.
--
-- Stratégie de correction :
--   Pour chaque AssignationBac avec nombreInitial=0 mais nombreActuel>0, on
--   recalcule nombreInitial et poidsMoyenInitial à partir de la somme pondérée
--   des TransfertGroupe liés (bacDestId = bac, vagueDestId = vague).
--
-- IMPORTANT :
--   - SECTION 1 = SELECT d'audit seulement (sans effet)
--   - SECTION 2 = UPDATE dans une transaction (rollback possible)
--   - Appliquer SECTION 2 seulement après revue manuelle des candidats de SECTION 1
--   - Pour CS.4 : laisser à l'opérateur le soin de décider de l'exécution

-- ===========================================================================
-- SECTION 1 — Audit : compter les AssignationBac candidates
-- ===========================================================================

-- Note: colonnes réelles en DB (via @map Prisma) :
--   nombreInitial   → "nombrePoissonsInitial"
--   nombreActuel    → "nombrePoissons"

-- Nombre total d'AssignationBac avec init=0 mais actuel>0
SELECT COUNT(*) AS nb_candidats
FROM "AssignationBac" ab
WHERE (ab."nombrePoissonsInitial" IS NULL OR ab."nombrePoissonsInitial" = 0)
  AND ab."nombrePoissons" IS NOT NULL
  AND ab."nombrePoissons" > 0;

-- Détail par vague et bac, avec les valeurs calculées depuis TransfertGroupe
SELECT
  ab.id                           AS assignation_id,
  ab."vagueId"                    AS vague_id,
  ab."bacId"                      AS bac_id,
  ab."nombrePoissons"             AS actuel,
  ab."nombrePoissonsInitial"      AS init_avant,
  ab."poidsMoyenInitial"          AS poids_init_avant,
  COALESCE(SUM(tg."nombrePoissons"), 0)::int AS init_calcule,
  CASE
    WHEN COALESCE(SUM(tg."nombrePoissons"), 0) = 0 THEN 0
    ELSE ROUND(
      SUM(tg."nombrePoissons" * tg."poidsMoyenG") /
      NULLIF(SUM(tg."nombrePoissons"), 0)::numeric,
      2
    )
  END                             AS poids_init_calcule
FROM "AssignationBac" ab
LEFT JOIN "TransfertGroupe" tg
  ON tg."bacDestId" = ab."bacId"
 AND tg."vagueDestId" = ab."vagueId"
WHERE (ab."nombrePoissonsInitial" IS NULL OR ab."nombrePoissonsInitial" = 0)
  AND ab."nombrePoissons" IS NOT NULL
  AND ab."nombrePoissons" > 0
GROUP BY ab.id, ab."vagueId", ab."bacId", ab."nombrePoissons", ab."nombrePoissonsInitial", ab."poidsMoyenInitial"
ORDER BY ab."vagueId", ab."bacId";

-- ===========================================================================
-- SECTION 2 — UPDATE (dans une transaction — commenter/décommenter selon besoin)
-- ===========================================================================
-- Pour appliquer : décommenter le bloc BEGIN...COMMIT ci-dessous.
-- Pour un dry-run : laisser commenté et utiliser uniquement la SECTION 1.

/*
BEGIN;

UPDATE "AssignationBac" ab
SET
  "nombrePoissonsInitial" = sub.init_calcule,
  "poidsMoyenInitial" = sub.poids_init_calcule
FROM (
  SELECT
    ab2.id AS assignation_id,
    COALESCE(SUM(tg."nombrePoissons"), 0)::int AS init_calcule,
    CASE
      WHEN COALESCE(SUM(tg."nombrePoissons"), 0) = 0 THEN 0
      ELSE SUM(tg."nombrePoissons" * tg."poidsMoyenG") /
           NULLIF(SUM(tg."nombrePoissons"), 0)
    END AS poids_init_calcule
  FROM "AssignationBac" ab2
  LEFT JOIN "TransfertGroupe" tg
    ON tg."bacDestId" = ab2."bacId"
   AND tg."vagueDestId" = ab2."vagueId"
  WHERE (ab2."nombrePoissonsInitial" IS NULL OR ab2."nombrePoissonsInitial" = 0)
    AND ab2."nombrePoissons" IS NOT NULL
    AND ab2."nombrePoissons" > 0
  GROUP BY ab2.id
) sub
WHERE ab.id = sub.assignation_id
  AND sub.init_calcule > 0;

-- Vérification post-update
SELECT COUNT(*) AS nb_restants_avec_init_zero
FROM "AssignationBac"
WHERE ("nombrePoissonsInitial" IS NULL OR "nombrePoissonsInitial" = 0)
  AND "nombrePoissons" IS NOT NULL
  AND "nombrePoissons" > 0;

COMMIT;
*/
