-- AlterTable
ALTER TABLE "BonLivraison" ADD COLUMN     "dateLivraison" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "LigneBonLivraison" (
    "id" TEXT NOT NULL,
    "bonLivraisonId" TEXT NOT NULL,
    "ligneVenteId" TEXT NOT NULL,
    "poidsLivreKg" DOUBLE PRECISION NOT NULL,
    "nombreMortsTransport" INTEGER NOT NULL DEFAULT 0,
    "motifAvarie" TEXT,
    "siteId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LigneBonLivraison_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LigneBonLivraison_siteId_idx" ON "LigneBonLivraison"("siteId");

-- CreateIndex
CREATE INDEX "LigneBonLivraison_ligneVenteId_idx" ON "LigneBonLivraison"("ligneVenteId");

-- CreateIndex
CREATE UNIQUE INDEX "LigneBonLivraison_bonLivraisonId_ligneVenteId_key" ON "LigneBonLivraison"("bonLivraisonId", "ligneVenteId");

-- AddForeignKey
ALTER TABLE "LigneBonLivraison" ADD CONSTRAINT "LigneBonLivraison_bonLivraisonId_fkey" FOREIGN KEY ("bonLivraisonId") REFERENCES "BonLivraison"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LigneBonLivraison" ADD CONSTRAINT "LigneBonLivraison_ligneVenteId_fkey" FOREIGN KEY ("ligneVenteId") REFERENCES "LigneVente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LigneBonLivraison" ADD CONSTRAINT "LigneBonLivraison_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

