-- AlterTable
ALTER TABLE "MouvementStock" ADD COLUMN     "releveId" TEXT;

-- CreateTable
CREATE TABLE "ReleveConsommation" (
    "id" TEXT NOT NULL,
    "releveId" TEXT NOT NULL,
    "produitId" TEXT NOT NULL,
    "quantite" DOUBLE PRECISION NOT NULL,
    "siteId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReleveConsommation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReleveConsommation_releveId_idx" ON "ReleveConsommation"("releveId");

-- CreateIndex
CREATE INDEX "ReleveConsommation_produitId_idx" ON "ReleveConsommation"("produitId");

-- CreateIndex
CREATE INDEX "ReleveConsommation_siteId_idx" ON "ReleveConsommation"("siteId");

-- CreateIndex
CREATE INDEX "MouvementStock_releveId_idx" ON "MouvementStock"("releveId");

-- AddForeignKey
ALTER TABLE "MouvementStock" ADD CONSTRAINT "MouvementStock_releveId_fkey" FOREIGN KEY ("releveId") REFERENCES "Releve"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReleveConsommation" ADD CONSTRAINT "ReleveConsommation_releveId_fkey" FOREIGN KEY ("releveId") REFERENCES "Releve"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReleveConsommation" ADD CONSTRAINT "ReleveConsommation_produitId_fkey" FOREIGN KEY ("produitId") REFERENCES "Produit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReleveConsommation" ADD CONSTRAINT "ReleveConsommation_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
