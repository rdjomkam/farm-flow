-- AlterEnum
ALTER TYPE "Permission" ADD VALUE 'BONS_LIVRAISON_RECTIFIER';

-- DropIndex
DROP INDEX "BonLivraison_venteId_key";

-- AlterTable
ALTER TABLE "BonLivraison" ADD COLUMN     "rectifieId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "BonLivraison_rectifieId_key" ON "BonLivraison"("rectifieId");

-- CreateIndex
CREATE INDEX "BonLivraison_venteId_idx" ON "BonLivraison"("venteId");

-- AddForeignKey
ALTER TABLE "BonLivraison" ADD CONSTRAINT "BonLivraison_rectifieId_fkey" FOREIGN KEY ("rectifieId") REFERENCES "BonLivraison"("id") ON DELETE SET NULL ON UPDATE CASCADE;

