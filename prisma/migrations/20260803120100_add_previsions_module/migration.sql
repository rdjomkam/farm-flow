-- CreateEnum
CREATE TYPE "StatutScenarioPrevision" AS ENUM ('BROUILLON', 'ACTIF', 'ARCHIVE');

-- CreateEnum
CREATE TYPE "StatutVaguePrevue" AS ENUM ('PLANIFIEE', 'EN_COURS', 'REALISEE', 'NON_REALISEE', 'ANNULEE');

-- CreateEnum
CREATE TYPE "TypePostePrevision" AS ENUM ('LOGISTIQUE', 'CHARGE_EXPLOITATION');

-- CreateEnum
CREATE TYPE "CategorieJournalPrevu" AS ENUM ('OPERATIONNEL', 'INVESTISSEMENT');

-- CreateEnum
CREATE TYPE "TypeApportCapital" AS ENUM ('CAPITAL', 'CREDIT');

-- CreateEnum
CREATE TYPE "SourceRapprochement" AS ENUM ('DEPENSE_CATEGORIE', 'PRODUIT_CATEGORIE', 'VENTE', 'MOUVEMENT_STOCK');

-- CreateEnum
CREATE TYPE "CibleRapprochement" AS ENUM ('POSTE_PREVISION', 'ALIMENT_PREVISION', 'VENTE_PREVUE', 'NON_RAPPROCHE');
-- AlterTable
ALTER TABLE "Vague" ADD COLUMN     "vaguePrevueId" TEXT;

-- CreateTable
CREATE TABLE "ScenarioPrevision" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "description" TEXT,
    "dureeCycleMois" INTEGER NOT NULL DEFAULT 3,
    "dateDebutPlan" TIMESTAMP(3) NOT NULL,
    "statut" "StatutScenarioPrevision" NOT NULL DEFAULT 'BROUILLON',
    "userId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScenarioPrevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParametresPrevision" (
    "id" TEXT NOT NULL,
    "scenarioId" TEXT NOT NULL,
    "effectifAlevinsParVague" INTEGER NOT NULL,
    "margeSecuriteAlevinsPct" DECIMAL(65,30) NOT NULL,
    "poidsMoyenInitialG" DECIMAL(65,30) NOT NULL,
    "poidsObjectifG" DECIMAL(65,30) NOT NULL,
    "prixAlevinUnitaireFCFA" DECIMAL(65,30) NOT NULL,
    "prixVenteKgFCFA" DECIMAL(65,30) NOT NULL,
    "nombreBacsSimultanesCible" INTEGER NOT NULL,
    "frequenceStockageMois" DECIMAL(65,30) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ParametresPrevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PalierRemise" (
    "id" TEXT NOT NULL,
    "scenarioId" TEXT NOT NULL,
    "seuilSacs" DECIMAL(65,30) NOT NULL,
    "pourcentageRemise" DECIMAL(65,30) NOT NULL,
    "ordre" INTEGER NOT NULL,
    "siteId" TEXT NOT NULL,

    CONSTRAINT "PalierRemise_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlimentPrevision" (
    "id" TEXT NOT NULL,
    "scenarioId" TEXT NOT NULL,
    "produitId" TEXT,
    "libelle" TEXT NOT NULL,
    "tailleGranule" "TailleGranule",
    "poidsSacKg" DECIMAL(65,30) NOT NULL,
    "prixSacFCFA" DECIMAL(65,30) NOT NULL,
    "sacsParTonne" DECIMAL(65,30) NOT NULL,
    "ordre" INTEGER NOT NULL,
    "siteId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AlimentPrevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RepartitionMoisAliment" (
    "id" TEXT NOT NULL,
    "alimentPrevisionId" TEXT NOT NULL,
    "moisCycle" INTEGER NOT NULL,
    "pourcentage" DECIMAL(65,30) NOT NULL,
    "siteId" TEXT NOT NULL,

    CONSTRAINT "RepartitionMoisAliment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VaguePrevue" (
    "id" TEXT NOT NULL,
    "scenarioId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "dateStockagePrevue" TIMESTAMP(3) NOT NULL,
    "effectifAlevinsPrevu" INTEGER NOT NULL,
    "poidsMoyenInitialG" DECIMAL(65,30) NOT NULL,
    "dureeCycleMoisFigee" INTEGER NOT NULL,
    "statut" "StatutVaguePrevue" NOT NULL DEFAULT 'PLANIFIEE',
    "vaguePrevueParentId" TEXT,
    "siteId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VaguePrevue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlimentParVaguePrevue" (
    "id" TEXT NOT NULL,
    "vaguePrevueId" TEXT NOT NULL,
    "alimentPrevisionId" TEXT NOT NULL,
    "moisCycle" INTEGER NOT NULL,
    "sacsCalcules" DECIMAL(65,30) NOT NULL,
    "sacsSaisis" DECIMAL(65,30),
    "quantiteKgCalculee" DECIMAL(65,30) NOT NULL,
    "coutCalculeFCFA" DECIMAL(65,30) NOT NULL,
    "siteId" TEXT NOT NULL,

    CONSTRAINT "AlimentParVaguePrevue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PostePrevision" (
    "id" TEXT NOT NULL,
    "scenarioId" TEXT NOT NULL,
    "libelle" TEXT NOT NULL,
    "type" "TypePostePrevision" NOT NULL,
    "inclusBaseRepartition" BOOLEAN NOT NULL DEFAULT true,
    "ordre" INTEGER NOT NULL,
    "siteId" TEXT NOT NULL,

    CONSTRAINT "PostePrevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChargeMensuellePrevue" (
    "id" TEXT NOT NULL,
    "scenarioId" TEXT NOT NULL,
    "posteId" TEXT NOT NULL,
    "moisAbsolu" INTEGER NOT NULL,
    "montantFCFA" DECIMAL(65,30) NOT NULL,
    "siteId" TEXT NOT NULL,

    CONSTRAINT "ChargeMensuellePrevue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JournalDepensePrevue" (
    "id" TEXT NOT NULL,
    "scenarioId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "libelle" TEXT NOT NULL,
    "categorie" "CategorieJournalPrevu" NOT NULL,
    "montantFCFA" DECIMAL(65,30) NOT NULL,
    "vaguePrevueId" TEXT,
    "siteId" TEXT NOT NULL,

    CONSTRAINT "JournalDepensePrevue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApportCapital" (
    "id" TEXT NOT NULL,
    "scenarioId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "libelle" TEXT NOT NULL,
    "montantFCFA" DECIMAL(65,30) NOT NULL,
    "type" "TypeApportCapital" NOT NULL,
    "siteId" TEXT NOT NULL,

    CONSTRAINT "ApportCapital_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MappingRapprochement" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "sourceType" "SourceRapprochement" NOT NULL,
    "sourceCle" TEXT NOT NULL,
    "cibleType" "CibleRapprochement" NOT NULL,
    "cibleId" TEXT,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MappingRapprochement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClotureMois" (
    "id" TEXT NOT NULL,
    "scenarioId" TEXT NOT NULL,
    "moisAbsolu" INTEGER NOT NULL,
    "clotureeParId" TEXT NOT NULL,
    "dateCloture" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "siteId" TEXT NOT NULL,

    CONSTRAINT "ClotureMois_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ScenarioPrevision_siteId_idx" ON "ScenarioPrevision"("siteId");

-- CreateIndex
CREATE INDEX "ScenarioPrevision_siteId_statut_idx" ON "ScenarioPrevision"("siteId", "statut");

-- CreateIndex
CREATE UNIQUE INDEX "ScenarioPrevision_siteId_code_key" ON "ScenarioPrevision"("siteId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "ParametresPrevision_scenarioId_key" ON "ParametresPrevision"("scenarioId");

-- CreateIndex
CREATE INDEX "PalierRemise_scenarioId_idx" ON "PalierRemise"("scenarioId");

-- CreateIndex
CREATE INDEX "PalierRemise_siteId_idx" ON "PalierRemise"("siteId");

-- CreateIndex
CREATE INDEX "AlimentPrevision_scenarioId_idx" ON "AlimentPrevision"("scenarioId");

-- CreateIndex
CREATE INDEX "AlimentPrevision_siteId_idx" ON "AlimentPrevision"("siteId");

-- CreateIndex
CREATE INDEX "AlimentPrevision_produitId_idx" ON "AlimentPrevision"("produitId");

-- CreateIndex
CREATE INDEX "RepartitionMoisAliment_siteId_idx" ON "RepartitionMoisAliment"("siteId");

-- CreateIndex
CREATE UNIQUE INDEX "RepartitionMoisAliment_alimentPrevisionId_moisCycle_key" ON "RepartitionMoisAliment"("alimentPrevisionId", "moisCycle");

-- CreateIndex
CREATE INDEX "VaguePrevue_siteId_idx" ON "VaguePrevue"("siteId");

-- CreateIndex
CREATE INDEX "VaguePrevue_scenarioId_statut_idx" ON "VaguePrevue"("scenarioId", "statut");

-- CreateIndex
CREATE UNIQUE INDEX "VaguePrevue_scenarioId_code_key" ON "VaguePrevue"("scenarioId", "code");

-- CreateIndex
CREATE INDEX "AlimentParVaguePrevue_siteId_idx" ON "AlimentParVaguePrevue"("siteId");

-- CreateIndex
CREATE INDEX "AlimentParVaguePrevue_vaguePrevueId_idx" ON "AlimentParVaguePrevue"("vaguePrevueId");

-- CreateIndex
CREATE UNIQUE INDEX "AlimentParVaguePrevue_vaguePrevueId_alimentPrevisionId_mois_key" ON "AlimentParVaguePrevue"("vaguePrevueId", "alimentPrevisionId", "moisCycle");

-- CreateIndex
CREATE INDEX "PostePrevision_siteId_idx" ON "PostePrevision"("siteId");

-- CreateIndex
CREATE UNIQUE INDEX "PostePrevision_scenarioId_libelle_key" ON "PostePrevision"("scenarioId", "libelle");

-- CreateIndex
CREATE INDEX "ChargeMensuellePrevue_siteId_idx" ON "ChargeMensuellePrevue"("siteId");

-- CreateIndex
CREATE INDEX "ChargeMensuellePrevue_scenarioId_moisAbsolu_idx" ON "ChargeMensuellePrevue"("scenarioId", "moisAbsolu");

-- CreateIndex
CREATE UNIQUE INDEX "ChargeMensuellePrevue_posteId_moisAbsolu_key" ON "ChargeMensuellePrevue"("posteId", "moisAbsolu");

-- CreateIndex
CREATE INDEX "JournalDepensePrevue_siteId_idx" ON "JournalDepensePrevue"("siteId");

-- CreateIndex
CREATE INDEX "JournalDepensePrevue_scenarioId_date_idx" ON "JournalDepensePrevue"("scenarioId", "date");

-- CreateIndex
CREATE INDEX "JournalDepensePrevue_vaguePrevueId_idx" ON "JournalDepensePrevue"("vaguePrevueId");

-- CreateIndex
CREATE INDEX "ApportCapital_siteId_idx" ON "ApportCapital"("siteId");

-- CreateIndex
CREATE INDEX "ApportCapital_scenarioId_date_idx" ON "ApportCapital"("scenarioId", "date");

-- CreateIndex
CREATE INDEX "MappingRapprochement_siteId_actif_idx" ON "MappingRapprochement"("siteId", "actif");

-- CreateIndex
CREATE UNIQUE INDEX "MappingRapprochement_siteId_version_sourceType_sourceCle_key" ON "MappingRapprochement"("siteId", "version", "sourceType", "sourceCle");

-- CreateIndex
CREATE INDEX "ClotureMois_siteId_idx" ON "ClotureMois"("siteId");

-- CreateIndex
CREATE UNIQUE INDEX "ClotureMois_scenarioId_moisAbsolu_key" ON "ClotureMois"("scenarioId", "moisAbsolu");

-- CreateIndex
CREATE UNIQUE INDEX "Vague_vaguePrevueId_key" ON "Vague"("vaguePrevueId");

-- AddForeignKey
ALTER TABLE "Vague" ADD CONSTRAINT "Vague_vaguePrevueId_fkey" FOREIGN KEY ("vaguePrevueId") REFERENCES "VaguePrevue"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScenarioPrevision" ADD CONSTRAINT "ScenarioPrevision_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScenarioPrevision" ADD CONSTRAINT "ScenarioPrevision_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParametresPrevision" ADD CONSTRAINT "ParametresPrevision_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "ScenarioPrevision"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PalierRemise" ADD CONSTRAINT "PalierRemise_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "ScenarioPrevision"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PalierRemise" ADD CONSTRAINT "PalierRemise_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlimentPrevision" ADD CONSTRAINT "AlimentPrevision_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "ScenarioPrevision"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlimentPrevision" ADD CONSTRAINT "AlimentPrevision_produitId_fkey" FOREIGN KEY ("produitId") REFERENCES "Produit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlimentPrevision" ADD CONSTRAINT "AlimentPrevision_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RepartitionMoisAliment" ADD CONSTRAINT "RepartitionMoisAliment_alimentPrevisionId_fkey" FOREIGN KEY ("alimentPrevisionId") REFERENCES "AlimentPrevision"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RepartitionMoisAliment" ADD CONSTRAINT "RepartitionMoisAliment_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VaguePrevue" ADD CONSTRAINT "VaguePrevue_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "ScenarioPrevision"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VaguePrevue" ADD CONSTRAINT "VaguePrevue_vaguePrevueParentId_fkey" FOREIGN KEY ("vaguePrevueParentId") REFERENCES "VaguePrevue"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VaguePrevue" ADD CONSTRAINT "VaguePrevue_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlimentParVaguePrevue" ADD CONSTRAINT "AlimentParVaguePrevue_vaguePrevueId_fkey" FOREIGN KEY ("vaguePrevueId") REFERENCES "VaguePrevue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlimentParVaguePrevue" ADD CONSTRAINT "AlimentParVaguePrevue_alimentPrevisionId_fkey" FOREIGN KEY ("alimentPrevisionId") REFERENCES "AlimentPrevision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlimentParVaguePrevue" ADD CONSTRAINT "AlimentParVaguePrevue_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostePrevision" ADD CONSTRAINT "PostePrevision_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "ScenarioPrevision"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostePrevision" ADD CONSTRAINT "PostePrevision_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChargeMensuellePrevue" ADD CONSTRAINT "ChargeMensuellePrevue_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "ScenarioPrevision"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChargeMensuellePrevue" ADD CONSTRAINT "ChargeMensuellePrevue_posteId_fkey" FOREIGN KEY ("posteId") REFERENCES "PostePrevision"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChargeMensuellePrevue" ADD CONSTRAINT "ChargeMensuellePrevue_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalDepensePrevue" ADD CONSTRAINT "JournalDepensePrevue_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "ScenarioPrevision"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalDepensePrevue" ADD CONSTRAINT "JournalDepensePrevue_vaguePrevueId_fkey" FOREIGN KEY ("vaguePrevueId") REFERENCES "VaguePrevue"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalDepensePrevue" ADD CONSTRAINT "JournalDepensePrevue_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApportCapital" ADD CONSTRAINT "ApportCapital_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "ScenarioPrevision"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApportCapital" ADD CONSTRAINT "ApportCapital_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MappingRapprochement" ADD CONSTRAINT "MappingRapprochement_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClotureMois" ADD CONSTRAINT "ClotureMois_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "ScenarioPrevision"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClotureMois" ADD CONSTRAINT "ClotureMois_clotureeParId_fkey" FOREIGN KEY ("clotureeParId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClotureMois" ADD CONSTRAINT "ClotureMois_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

