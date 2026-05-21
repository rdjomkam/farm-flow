-- Add uniteProductionId to Vente (links sale to production unit)
-- Make vagueId/bacId optional on LigneVente (reproduction sales use lotAlevinsId instead)
-- Add lotAlevinsId to LigneVente (for reproduction alevin sales)

-- DropForeignKey
ALTER TABLE "LigneVente" DROP CONSTRAINT "LigneVente_bacId_fkey";

-- DropForeignKey
ALTER TABLE "LigneVente" DROP CONSTRAINT "LigneVente_vagueId_fkey";

-- DropIndex
DROP INDEX "LigneVente_venteId_vagueId_bacId_key";

-- AlterTable
ALTER TABLE "LigneVente" ADD COLUMN     "lotAlevinsId" TEXT,
ALTER COLUMN "vagueId" DROP NOT NULL,
ALTER COLUMN "bacId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Vente" ADD COLUMN     "uniteProductionId" TEXT;

-- CreateIndex
CREATE INDEX "LigneVente_lotAlevinsId_idx" ON "LigneVente"("lotAlevinsId");

-- CreateIndex
CREATE INDEX "Vente_uniteProductionId_idx" ON "Vente"("uniteProductionId");

-- AddForeignKey
ALTER TABLE "Vente" ADD CONSTRAINT "Vente_uniteProductionId_fkey" FOREIGN KEY ("uniteProductionId") REFERENCES "UniteProduction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LigneVente" ADD CONSTRAINT "LigneVente_vagueId_fkey" FOREIGN KEY ("vagueId") REFERENCES "Vague"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LigneVente" ADD CONSTRAINT "LigneVente_bacId_fkey" FOREIGN KEY ("bacId") REFERENCES "Bac"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LigneVente" ADD CONSTRAINT "LigneVente_lotAlevinsId_fkey" FOREIGN KEY ("lotAlevinsId") REFERENCES "LotAlevins"("id") ON DELETE SET NULL ON UPDATE CASCADE;
