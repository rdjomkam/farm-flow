-- Migration: Pack.planId + drop enabledModules
-- Story 44.1 — Pack linked to PlanAbonnement, enabledModules removed from Pack

-- 1. Add planId nullable first (to allow data backfill)
ALTER TABLE "Pack" ADD COLUMN "planId" TEXT;

-- 2. Map existing packs to plans by name pattern
UPDATE "Pack" SET "planId" = (SELECT id FROM "PlanAbonnement" WHERE "typePlan" = 'DECOUVERTE')
WHERE LOWER("nom") LIKE '%d%couverte%' OR LOWER("nom") LIKE '%decouverte%' OR LOWER("nom") LIKE '%starter 100%' OR LOWER("nom") LIKE '%100%';

UPDATE "Pack" SET "planId" = (SELECT id FROM "PlanAbonnement" WHERE "typePlan" = 'ELEVEUR')
WHERE "planId" IS NULL AND (LOWER("nom") LIKE '%l%veur%' OR LOWER("nom") LIKE '%eleveur%' OR LOWER("nom") LIKE '%starter 300%' OR LOWER("nom") LIKE '%300%');

UPDATE "Pack" SET "planId" = (SELECT id FROM "PlanAbonnement" WHERE "typePlan" = 'PROFESSIONNEL')
WHERE "planId" IS NULL AND (LOWER("nom") LIKE '%professionnel%' OR LOWER("nom") LIKE '%pro 500%' OR LOWER("nom") LIKE '%500%');

UPDATE "Pack" SET "planId" = (SELECT id FROM "PlanAbonnement" WHERE "typePlan" = 'ENTREPRISE')
WHERE "planId" IS NULL AND (LOWER("nom") LIKE '%entreprise%' OR LOWER("nom") LIKE '%enterprise%');

UPDATE "Pack" SET "planId" = (SELECT id FROM "PlanAbonnement" WHERE "typePlan" = 'INGENIEUR_STARTER')
WHERE "planId" IS NULL AND (LOWER("nom") LIKE '%ing%nieur starter%' OR LOWER("nom") LIKE '%ingenieur starter%');

UPDATE "Pack" SET "planId" = (SELECT id FROM "PlanAbonnement" WHERE "typePlan" = 'INGENIEUR_PRO')
WHERE "planId" IS NULL AND (LOWER("nom") LIKE '%ing%nieur pro%' OR LOWER("nom") LIKE '%ingenieur pro%');

UPDATE "Pack" SET "planId" = (SELECT id FROM "PlanAbonnement" WHERE "typePlan" = 'INGENIEUR_EXPERT')
WHERE "planId" IS NULL AND (LOWER("nom") LIKE '%ing%nieur expert%' OR LOWER("nom") LIKE '%ingenieur expert%');

-- Fallback: any remaining packs without planId → DECOUVERTE
UPDATE "Pack" SET "planId" = (SELECT id FROM "PlanAbonnement" WHERE "typePlan" = 'DECOUVERTE')
WHERE "planId" IS NULL;

-- 3. Make planId NOT NULL
ALTER TABLE "Pack" ALTER COLUMN "planId" SET NOT NULL;

-- 4. Drop enabledModules column
ALTER TABLE "Pack" DROP COLUMN "enabledModules";

-- 5. Add FK constraint + index
ALTER TABLE "Pack" ADD CONSTRAINT "Pack_planId_fkey" FOREIGN KEY ("planId") REFERENCES "PlanAbonnement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "Pack_planId_idx" ON "Pack"("planId");
