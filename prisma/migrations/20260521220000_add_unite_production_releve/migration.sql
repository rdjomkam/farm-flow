-- Add uniteProductionId to Releve (auto-resolved from context)
ALTER TABLE "Releve" ADD COLUMN "uniteProductionId" TEXT;

-- Backfill: set uniteProductionId from vague for existing relevés
UPDATE "Releve" r
SET "uniteProductionId" = v."uniteProductionId"
FROM "Vague" v
WHERE r."vagueId" = v."id" AND v."uniteProductionId" IS NOT NULL;

-- Backfill: for lot d'alevins relevés, find the REPRODUCTION unit for the site
UPDATE "Releve" r
SET "uniteProductionId" = up."id"
FROM "UniteProduction" up
WHERE r."lotAlevinsId" IS NOT NULL
  AND r."uniteProductionId" IS NULL
  AND up."siteId" = r."siteId"
  AND up."type" = 'REPRODUCTION';

-- FK constraint
ALTER TABLE "Releve" ADD CONSTRAINT "Releve_uniteProductionId_fkey" FOREIGN KEY ("uniteProductionId") REFERENCES "UniteProduction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Index
CREATE INDEX "Releve_uniteProductionId_idx" ON "Releve"("uniteProductionId");
