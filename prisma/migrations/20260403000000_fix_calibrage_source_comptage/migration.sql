-- Data repair: add missing COMPTAGE=0 relevés for source-only bacs in existing calibrages
-- Idempotent via WHERE NOT EXISTS
INSERT INTO "Releve" (
  id, date, "typeReleve", "nombreCompte", "methodeComptage",
  notes, "vagueId", "bacId", "siteId", "calibrageId", "createdAt", "updatedAt"
)
SELECT
  gen_random_uuid(),
  c.date,
  'COMPTAGE',
  0,
  'DIRECT',
  'Comptage post-calibrage (bac source vide)',
  c."vagueId",
  sb.source_bac_id,
  c."siteId",
  c.id,
  NOW(),
  NOW()
FROM "Calibrage" c
CROSS JOIN LATERAL unnest(c."sourceBacIds") AS sb(source_bac_id)
WHERE NOT EXISTS (
  SELECT 1 FROM "Releve" r
  WHERE r."calibrageId" = c.id
    AND r."bacId" = sb.source_bac_id
    AND r."typeReleve" = 'COMPTAGE'
)
AND NOT EXISTS (
  SELECT 1 FROM "CalibrageGroupe" cg
  WHERE cg."calibrageId" = c.id
    AND cg."destinationBacId" = sb.source_bac_id
);
