-- AlterTable
ALTER TABLE "Depense" ADD COLUMN     "venteId" TEXT;

-- CreateIndex
CREATE INDEX "Depense_venteId_idx" ON "Depense"("venteId");

-- AddForeignKey
ALTER TABLE "Depense" ADD CONSTRAINT "Depense_venteId_fkey" FOREIGN KEY ("venteId") REFERENCES "Vente"("id") ON DELETE SET NULL ON UPDATE CASCADE;

