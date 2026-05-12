-- AlterTable: add depenseRecurrenteId to Depense
ALTER TABLE "Depense" ADD COLUMN "depenseRecurrenteId" TEXT;

-- AddForeignKey
ALTER TABLE "Depense" ADD CONSTRAINT "Depense_depenseRecurrenteId_fkey" FOREIGN KEY ("depenseRecurrenteId") REFERENCES "DepenseRecurrente"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "Depense_depenseRecurrenteId_idx" ON "Depense"("depenseRecurrenteId");

-- Backfill: match existing Depense to their DepenseRecurrente template
-- Criteria: same siteId, same description, same categorieDepense,
-- montantTotal = montantEstime, and no commandeId/vagueId/listeBesoinsId
-- (generated depenses are site-level, not linked to specific vagues/commandes)
UPDATE "Depense" d
SET "depenseRecurrenteId" = dr.id
FROM "DepenseRecurrente" dr
WHERE d."siteId" = dr."siteId"
  AND d."description" = dr."description"
  AND d."categorieDepense"::text = dr."categorieDepense"::text
  AND d."montantTotal" = dr."montantEstime"
  AND d."commandeId" IS NULL
  AND d."vagueId" IS NULL
  AND d."listeBesoinsId" IS NULL
  AND d."depenseRecurrenteId" IS NULL;
