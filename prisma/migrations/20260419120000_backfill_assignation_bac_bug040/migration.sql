-- BUG-040: backfill AssignationBac for bacs with Bac.vagueId but no active AssignationBac
-- This fixes historical data inconsistency where Bac.vagueId was set but no AssignationBac
-- active record existed, causing bacs to be invisible in the relevé creation form.

INSERT INTO "AssignationBac" (
  id, "bacId", "vagueId", "siteId", "dateAssignation", "dateFin",
  "nombrePoissonsInitial", "nombrePoissons", "poidsMoyenInitial",
  "createdAt", "updatedAt"
)
SELECT
  gen_random_uuid()::text,
  b.id,
  b."vagueId",
  b."siteId",
  COALESCE(v."dateDebut", b."createdAt"),
  CASE WHEN v.statut = 'TERMINEE' THEN COALESCE(v."dateFin", NOW()) ELSE NULL END,
  COALESCE(b."nombreInitial", b."nombrePoissons", 0),
  b."nombrePoissons",
  COALESCE(b."poidsMoyenInitial", v."poidsMoyenInitial", 0),
  NOW(),
  NOW()
FROM "Bac" b
JOIN "Vague" v ON v.id = b."vagueId"
WHERE b."vagueId" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "AssignationBac" a
    WHERE a."bacId" = b.id
      AND a."vagueId" = b."vagueId"
      AND a."dateFin" IS NULL
  );

-- Bug secondaire : nullifier Bac.vagueId pour les bacs dont la vague est TERMINEE
-- et qui viennent d'obtenir une AssignationBac fermée via le backfill ci-dessus.
-- (cloturerVague fait déjà cela dans le code courant, mais des orphelins historiques
-- peuvent subsister si le code de clôture a été appliqué avant ce fix.)
UPDATE "Bac" b
SET "vagueId" = NULL
FROM "Vague" v
WHERE b."vagueId" = v.id
  AND v.statut = 'TERMINEE'
  AND EXISTS (
    SELECT 1 FROM "AssignationBac" a
    WHERE a."bacId" = b.id
      AND a."vagueId" = v.id
      AND a."dateFin" IS NOT NULL
  );
