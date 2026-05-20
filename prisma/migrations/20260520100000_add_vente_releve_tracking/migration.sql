-- AlterEnum: Add VENTE to TypeReleve (RECREATE pattern)
ALTER TYPE "TypeReleve" RENAME TO "TypeReleve_old";

CREATE TYPE "TypeReleve" AS ENUM (
  'BIOMETRIE',
  'MORTALITE',
  'ALIMENTATION',
  'QUALITE_EAU',
  'COMPTAGE',
  'OBSERVATION',
  'RENOUVELLEMENT',
  'TRI',
  'VENTE'
);

ALTER TABLE "Releve"
  ALTER COLUMN "typeReleve" TYPE "TypeReleve"
  USING ("typeReleve"::text::"TypeReleve");

DROP TYPE "TypeReleve_old";

-- Add nombreVendus column to Releve
ALTER TABLE "Releve" ADD COLUMN "nombreVendus" INTEGER;

-- Add venteId FK column to Releve
ALTER TABLE "Releve" ADD COLUMN "venteId" TEXT;

-- Add FK constraint + index for venteId
ALTER TABLE "Releve"
  ADD CONSTRAINT "Releve_venteId_fkey"
  FOREIGN KEY ("venteId") REFERENCES "Vente"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Releve_venteId_idx" ON "Releve"("venteId");

-- Add poidsObjectifKg column to Vague
ALTER TABLE "Vague" ADD COLUMN "poidsObjectifKg" DOUBLE PRECISION;

-- ============================================
-- BACKFILL: Create VENTE relevés for existing ventes
-- Distributes sold fish proportionally across all active bacs
-- assigned to the vague, based on each bac's share of total fish.
-- ============================================
INSERT INTO "Releve" (
  "id", "date", "typeReleve", "vagueId", "bacId", "siteId", "userId",
  "nombreVendus", "venteId", "notes", "createdAt", "updatedAt"
)
SELECT
  gen_random_uuid()::text,
  v."dateCommande",
  'VENTE'::"TypeReleve",
  v."vagueId",
  ab."bacId",
  v."siteId",
  v."userId",
  -- Distribute proportionally: last bac gets the remainder
  CASE
    WHEN ab.rn = ab.total_bacs THEN
      v."quantitePoissons" - (v."quantitePoissons" / ab.total_bacs) * (ab.total_bacs - 1)
    ELSE
      v."quantitePoissons" / ab.total_bacs
  END,
  v."id",
  CONCAT('Backfill — Vente ', v."numero", ' — bac ', ab.rn, '/', ab.total_bacs),
  NOW(),
  NOW()
FROM "Vente" v
CROSS JOIN LATERAL (
  SELECT
    a."bacId",
    ROW_NUMBER() OVER (ORDER BY a."createdAt" ASC) AS rn,
    COUNT(*) OVER () AS total_bacs
  FROM "AssignationBac" a
  WHERE a."vagueId" = v."vagueId" AND a."dateFin" IS NULL
) ab
WHERE v."quantitePoissons" > 0
  AND NOT EXISTS (
    SELECT 1 FROM "Releve" r WHERE r."venteId" = v."id"
  );
