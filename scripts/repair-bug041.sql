-- BUG-041 repair: backfill AssignationBac for vagues created
-- before the POST /api/vagues fix (pre-pipeline test data)
INSERT INTO "AssignationBac" (
  id, "bacId", "vagueId", "siteId",
  "dateAssignation", "dateFin",
  "nombrePoissonsInitial", "poidsMoyenInitial", "nombrePoissons",
  "createdAt", "updatedAt"
)
SELECT
  'repair_' || substr(md5(random()::text || b.id || v.id), 1, 20),
  b.id, v.id, v."siteId",
  v."dateDebut", NULL,
  b."nombreInitial", b."poidsMoyenInitial", b."nombrePoissons",
  NOW(), NOW()
FROM "Bac" b
JOIN "Vague" v ON v.id = b."vagueId"
WHERE b."vagueId" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "AssignationBac" a
    WHERE a."bacId" = b.id AND a."vagueId" = v.id AND a."dateFin" IS NULL
  );
