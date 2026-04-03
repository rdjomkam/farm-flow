-- Migration: ADR-027 — Ajout du modèle LigneDepense
-- Satellite analytique de Depense pour la ventilation catégorielle des coûts.
-- Les dépenses existantes restent sans lignes (compatibilité ascendante).

-- AlterTable: FeatureFlag — suppression du DEFAULT résiduel
ALTER TABLE "FeatureFlag" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateTable: LigneDepense
CREATE TABLE "LigneDepense" (
    "id" TEXT NOT NULL,
    "depenseId" TEXT NOT NULL,
    "designation" TEXT NOT NULL,
    "categorieDepense" "CategorieDepense" NOT NULL,
    "quantite" DOUBLE PRECISION NOT NULL,
    "prixUnitaire" DOUBLE PRECISION NOT NULL,
    "montantTotal" DOUBLE PRECISION NOT NULL,
    "produitId" TEXT,
    "ligneBesoinId" TEXT,
    "ligneCommandeId" TEXT,
    "siteId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LigneDepense_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LigneDepense_depenseId_idx" ON "LigneDepense"("depenseId");

-- CreateIndex
CREATE INDEX "LigneDepense_siteId_idx" ON "LigneDepense"("siteId");

-- CreateIndex
CREATE INDEX "LigneDepense_siteId_categorieDepense_idx" ON "LigneDepense"("siteId", "categorieDepense");

-- CreateIndex
CREATE INDEX "LigneDepense_produitId_idx" ON "LigneDepense"("produitId");

-- CreateIndex
CREATE INDEX "LigneDepense_ligneBesoinId_idx" ON "LigneDepense"("ligneBesoinId");

-- CreateIndex
CREATE INDEX "LigneDepense_ligneCommandeId_idx" ON "LigneDepense"("ligneCommandeId");

-- AddForeignKey: LigneDepense.depenseId → Depense (CASCADE)
ALTER TABLE "LigneDepense" ADD CONSTRAINT "LigneDepense_depenseId_fkey"
    FOREIGN KEY ("depenseId") REFERENCES "Depense"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: LigneDepense.produitId → Produit (SET NULL)
ALTER TABLE "LigneDepense" ADD CONSTRAINT "LigneDepense_produitId_fkey"
    FOREIGN KEY ("produitId") REFERENCES "Produit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: LigneDepense.ligneBesoinId → LigneBesoin (SET NULL)
ALTER TABLE "LigneDepense" ADD CONSTRAINT "LigneDepense_ligneBesoinId_fkey"
    FOREIGN KEY ("ligneBesoinId") REFERENCES "LigneBesoin"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: LigneDepense.ligneCommandeId → LigneCommande (SET NULL)
ALTER TABLE "LigneDepense" ADD CONSTRAINT "LigneDepense_ligneCommandeId_fkey"
    FOREIGN KEY ("ligneCommandeId") REFERENCES "LigneCommande"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: LigneDepense.siteId → Site
ALTER TABLE "LigneDepense" ADD CONSTRAINT "LigneDepense_siteId_fkey"
    FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
