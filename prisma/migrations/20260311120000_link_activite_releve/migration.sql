-- Migration: 20260311120000_link_activite_releve
-- Lier les activites aux releves (relation 1:1 optionnelle)

-- AlterTable
ALTER TABLE "Activite" ADD COLUMN "releveId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Activite_releveId_key" ON "Activite"("releveId");

-- CreateIndex
CREATE INDEX "Activite_releveId_idx" ON "Activite"("releveId");

-- AddForeignKey
ALTER TABLE "Activite" ADD CONSTRAINT "Activite_releveId_fkey" FOREIGN KEY ("releveId") REFERENCES "Releve"("id") ON DELETE SET NULL ON UPDATE CASCADE;
