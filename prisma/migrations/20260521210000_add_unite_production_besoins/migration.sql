-- AlterTable: add uniteProductionId to ListeBesoins
ALTER TABLE "ListeBesoins" ADD COLUMN "uniteProductionId" TEXT;

-- CreateIndex
CREATE INDEX "ListeBesoins_uniteProductionId_idx" ON "ListeBesoins"("uniteProductionId");

-- AddForeignKey
ALTER TABLE "ListeBesoins" ADD CONSTRAINT "ListeBesoins_uniteProductionId_fkey" FOREIGN KEY ("uniteProductionId") REFERENCES "UniteProduction"("id") ON DELETE SET NULL ON UPDATE CASCADE;
