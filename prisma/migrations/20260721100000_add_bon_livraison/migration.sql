-- CreateEnum
CREATE TYPE "StatutBonLivraison" AS ENUM ('BROUILLON', 'EN_ATTENTE_SIGNATURE', 'SIGNE');

-- AlterTable
ALTER TABLE "Site" ADD COLUMN     "cachet" TEXT,
ADD COLUMN     "signaturePromoteur" TEXT;

-- CreateTable
CREATE TABLE "BonLivraison" (
    "id" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "venteId" TEXT NOT NULL,
    "statut" "StatutBonLivraison" NOT NULL DEFAULT 'BROUILLON',
    "signatureClient" TEXT,
    "signataireClientNom" TEXT,
    "signatureLivreur" TEXT,
    "signeLe" TIMESTAMP(3),
    "userId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BonLivraison_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BonLivraison_numero_key" ON "BonLivraison"("numero");

-- CreateIndex
CREATE UNIQUE INDEX "BonLivraison_venteId_key" ON "BonLivraison"("venteId");

-- CreateIndex
CREATE INDEX "BonLivraison_siteId_idx" ON "BonLivraison"("siteId");

-- CreateIndex
CREATE INDEX "BonLivraison_userId_idx" ON "BonLivraison"("userId");

-- AddForeignKey
ALTER TABLE "BonLivraison" ADD CONSTRAINT "BonLivraison_venteId_fkey" FOREIGN KEY ("venteId") REFERENCES "Vente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BonLivraison" ADD CONSTRAINT "BonLivraison_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BonLivraison" ADD CONSTRAINT "BonLivraison_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
