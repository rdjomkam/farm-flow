-- AlterTable: Remove default from Calibrage.date (app always provides value)
ALTER TABLE "Calibrage" ALTER COLUMN "date" DROP DEFAULT;

-- AlterTable: Add calibrageId FK on Releve
ALTER TABLE "Releve" ADD COLUMN "calibrageId" TEXT;

-- CreateIndex
CREATE INDEX "Releve_calibrageId_idx" ON "Releve"("calibrageId");

-- AddForeignKey
ALTER TABLE "Releve" ADD CONSTRAINT "Releve_calibrageId_fkey" FOREIGN KEY ("calibrageId") REFERENCES "Calibrage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill: link existing auto-created releves to their calibrages
UPDATE "Releve" r
SET "calibrageId" = c.id
FROM "Calibrage" c
WHERE r."calibrageId" IS NULL
  AND r."typeReleve" = 'MORTALITE'
  AND r."vagueId" = c."vagueId"
  AND r."siteId" = c."siteId"
  AND r.notes LIKE '%calibrage%'
  AND r.date = c.date;

UPDATE "Releve" r
SET "calibrageId" = c.id
FROM "Calibrage" c
WHERE r."calibrageId" IS NULL
  AND r."typeReleve" = 'BIOMETRIE'
  AND r."vagueId" = c."vagueId"
  AND r."siteId" = c."siteId"
  AND r.notes LIKE '%calibrage%'
  AND r.date = c.date;

UPDATE "Releve" r
SET "calibrageId" = c.id
FROM "Calibrage" c
WHERE r."calibrageId" IS NULL
  AND r."typeReleve" = 'COMPTAGE'
  AND r."vagueId" = c."vagueId"
  AND r."siteId" = c."siteId"
  AND r.notes LIKE '%calibrage%'
  AND r.date = c.date;
