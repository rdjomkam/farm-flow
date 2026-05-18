-- AlterTable: add depenseId FK to MouvementStock
ALTER TABLE "MouvementStock" ADD COLUMN "depenseId" TEXT;

-- CreateIndex
CREATE INDEX "MouvementStock_depenseId_idx" ON "MouvementStock"("depenseId");

-- AddForeignKey
ALTER TABLE "MouvementStock" ADD CONSTRAINT "MouvementStock_depenseId_fkey"
  FOREIGN KEY ("depenseId") REFERENCES "Depense"("id") ON DELETE SET NULL ON UPDATE CASCADE;
