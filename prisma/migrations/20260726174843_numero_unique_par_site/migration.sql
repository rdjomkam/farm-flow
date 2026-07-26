-- DropIndex
DROP INDEX "BonLivraison_numero_key";

-- DropIndex
DROP INDEX "Commande_numero_key";

-- DropIndex
DROP INDEX "Depense_numero_key";

-- DropIndex
DROP INDEX "Facture_numero_key";

-- DropIndex
DROP INDEX "Incubation_code_key";

-- DropIndex
DROP INDEX "ListeBesoins_numero_key";

-- DropIndex
DROP INDEX "LotGeniteurs_code_key";

-- DropIndex
DROP INDEX "Ponte_code_key";

-- DropIndex
DROP INDEX "Vente_numero_key";

-- CreateIndex
CREATE UNIQUE INDEX "BonLivraison_siteId_numero_key" ON "BonLivraison"("siteId", "numero");

-- CreateIndex
CREATE UNIQUE INDEX "Commande_siteId_numero_key" ON "Commande"("siteId", "numero");

-- CreateIndex
CREATE UNIQUE INDEX "Depense_siteId_numero_key" ON "Depense"("siteId", "numero");

-- CreateIndex
CREATE UNIQUE INDEX "Facture_siteId_numero_key" ON "Facture"("siteId", "numero");

-- CreateIndex
CREATE UNIQUE INDEX "Incubation_siteId_code_key" ON "Incubation"("siteId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "ListeBesoins_siteId_numero_key" ON "ListeBesoins"("siteId", "numero");

-- CreateIndex
CREATE UNIQUE INDEX "LotGeniteurs_siteId_code_key" ON "LotGeniteurs"("siteId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "Ponte_siteId_code_key" ON "Ponte"("siteId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "Vente_siteId_numero_key" ON "Vente"("siteId", "numero");

