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
-- For each vente that has quantitePoissons > 0,
-- create a single VENTE relevé linked to the vague.
-- We use the first bac assigned to the vague as bacId
-- (simplified — exact per-bac split is unknown for historical data).
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
  (
    SELECT ab."bacId"
    FROM "AssignationBac" ab
    WHERE ab."vagueId" = v."vagueId" AND ab."dateFin" IS NULL
    ORDER BY ab."createdAt" ASC
    LIMIT 1
  ),
  v."siteId",
  v."userId",
  v."quantitePoissons",
  v."id",
  CONCAT('Backfill — Vente ', v."numero", ' — ', v."quantitePoissons", ' poissons'),
  NOW(),
  NOW()
FROM "Vente" v
WHERE v."quantitePoissons" > 0
  AND NOT EXISTS (
    SELECT 1 FROM "Releve" r WHERE r."venteId" = v."id"
  );
