-- Migration: add LigneVente model and make Vente.vagueId nullable

-- AlterEnum
ALTER TYPE "Permission" ADD VALUE 'VENTES_MODIFIER';

-- AlterEnum
ALTER TYPE "TypeAlerte" ADD VALUE 'ACTIVITE_EN_RETARD';

-- DropForeignKey
ALTER TABLE "Releve" DROP CONSTRAINT "Releve_bacId_fkey";

-- DropForeignKey
ALTER TABLE "Releve" DROP CONSTRAINT "Releve_vagueId_fkey";

-- DropForeignKey
ALTER TABLE "Vente" DROP CONSTRAINT "Vente_vagueId_fkey";

-- DropIndex (partial index managed manually — safe to drop if exists)
DROP INDEX IF EXISTS "AssignationBac_bacId_active_unique";

-- AlterTable: make vagueId nullable on Vente
ALTER TABLE "Vente" ALTER COLUMN "vagueId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "LigneVente" (
    "id" TEXT NOT NULL,
    "venteId" TEXT NOT NULL,
    "vagueId" TEXT NOT NULL,
    "bacId" TEXT NOT NULL,
    "poidsTotalKg" DOUBLE PRECISION NOT NULL,
    "poidsMoyenG" DOUBLE PRECISION NOT NULL,
    "nombrePoissons" INTEGER NOT NULL,
    "siteId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LigneVente_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LigneVente_venteId_idx" ON "LigneVente"("venteId");

-- CreateIndex
CREATE INDEX "LigneVente_vagueId_idx" ON "LigneVente"("vagueId");

-- CreateIndex
CREATE INDEX "LigneVente_bacId_idx" ON "LigneVente"("bacId");

-- CreateIndex
CREATE INDEX "LigneVente_siteId_idx" ON "LigneVente"("siteId");

-- CreateIndex
CREATE UNIQUE INDEX "LigneVente_venteId_vagueId_bacId_key" ON "LigneVente"("venteId", "vagueId", "bacId");

-- AddForeignKey
ALTER TABLE "Releve" ADD CONSTRAINT "Releve_vagueId_fkey" FOREIGN KEY ("vagueId") REFERENCES "Vague"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Releve" ADD CONSTRAINT "Releve_bacId_fkey" FOREIGN KEY ("bacId") REFERENCES "Bac"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vente" ADD CONSTRAINT "Vente_vagueId_fkey" FOREIGN KEY ("vagueId") REFERENCES "Vague"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LigneVente" ADD CONSTRAINT "LigneVente_venteId_fkey" FOREIGN KEY ("venteId") REFERENCES "Vente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LigneVente" ADD CONSTRAINT "LigneVente_vagueId_fkey" FOREIGN KEY ("vagueId") REFERENCES "Vague"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LigneVente" ADD CONSTRAINT "LigneVente_bacId_fkey" FOREIGN KEY ("bacId") REFERENCES "Bac"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LigneVente" ADD CONSTRAINT "LigneVente_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
