-- CreateEnum
CREATE TYPE "TypePlan" AS ENUM ('DECOUVERTE', 'ELEVEUR', 'PROFESSIONNEL', 'ENTREPRISE', 'INGENIEUR_STARTER', 'INGENIEUR_PRO', 'INGENIEUR_EXPERT');

-- CreateEnum
CREATE TYPE "PeriodeFacturation" AS ENUM ('MENSUEL', 'TRIMESTRIEL', 'ANNUEL');

-- CreateEnum
CREATE TYPE "StatutAbonnement" AS ENUM ('ACTIF', 'EN_GRACE', 'SUSPENDU', 'EXPIRE', 'ANNULE', 'EN_ATTENTE_PAIEMENT');

-- CreateEnum
CREATE TYPE "StatutPaiementAbo" AS ENUM ('EN_ATTENTE', 'INITIE', 'CONFIRME', 'ECHEC', 'REMBOURSE', 'EXPIRE');

-- CreateEnum
CREATE TYPE "TypeRemise" AS ENUM ('EARLY_ADOPTER', 'SAISONNIERE', 'PARRAINAGE', 'COOPERATIVE', 'VOLUME', 'MANUELLE');

-- CreateEnum
CREATE TYPE "StatutCommissionIng" AS ENUM ('EN_ATTENTE', 'DISPONIBLE', 'DEMANDEE', 'PAYEE', 'ANNULEE');

-- CreateEnum
CREATE TYPE "FournisseurPaiement" AS ENUM ('SMOBILPAY', 'MTN_MOMO', 'ORANGE_MONEY', 'MANUEL');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "Permission" ADD VALUE 'ABONNEMENTS_VOIR';
ALTER TYPE "Permission" ADD VALUE 'ABONNEMENTS_GERER';
ALTER TYPE "Permission" ADD VALUE 'PLANS_GERER';
ALTER TYPE "Permission" ADD VALUE 'REMISES_GERER';
ALTER TYPE "Permission" ADD VALUE 'COMMISSIONS_VOIR';
ALTER TYPE "Permission" ADD VALUE 'COMMISSIONS_GERER';
ALTER TYPE "Permission" ADD VALUE 'PORTEFEUILLE_VOIR';
ALTER TYPE "Permission" ADD VALUE 'PORTEFEUILLE_GERER';

-- AlterTable
ALTER TABLE "Calibrage" ALTER COLUMN "sourceBacIds" DROP DEFAULT,
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateTable
CREATE TABLE "PlanAbonnement" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "typePlan" "TypePlan" NOT NULL,
    "description" TEXT,
    "prixMensuel" DECIMAL(65,30),
    "prixTrimestriel" DECIMAL(65,30),
    "prixAnnuel" DECIMAL(65,30),
    "limitesSites" INTEGER NOT NULL DEFAULT 1,
    "limitesBacs" INTEGER NOT NULL DEFAULT 3,
    "limitesVagues" INTEGER NOT NULL DEFAULT 1,
    "limitesIngFermes" INTEGER,
    "isActif" BOOLEAN NOT NULL DEFAULT true,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlanAbonnement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Abonnement" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "periode" "PeriodeFacturation" NOT NULL,
    "statut" "StatutAbonnement" NOT NULL DEFAULT 'EN_ATTENTE_PAIEMENT',
    "dateDebut" TIMESTAMP(3) NOT NULL,
    "dateFin" TIMESTAMP(3) NOT NULL,
    "dateProchainRenouvellement" TIMESTAMP(3) NOT NULL,
    "dateFinGrace" TIMESTAMP(3),
    "prixPaye" DECIMAL(65,30) NOT NULL,
    "userId" TEXT NOT NULL,
    "remiseId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Abonnement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaiementAbonnement" (
    "id" TEXT NOT NULL,
    "abonnementId" TEXT NOT NULL,
    "montant" DECIMAL(65,30) NOT NULL,
    "fournisseur" "FournisseurPaiement" NOT NULL,
    "statut" "StatutPaiementAbo" NOT NULL DEFAULT 'EN_ATTENTE',
    "referenceExterne" TEXT,
    "phoneNumber" TEXT,
    "metadata" JSONB,
    "initiePar" TEXT NOT NULL,
    "dateInitiation" TIMESTAMP(3) NOT NULL,
    "dateConfirmation" TIMESTAMP(3),
    "siteId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaiementAbonnement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Remise" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" "TypeRemise" NOT NULL,
    "valeur" DECIMAL(65,30) NOT NULL,
    "estPourcentage" BOOLEAN NOT NULL DEFAULT false,
    "dateDebut" TIMESTAMP(3) NOT NULL,
    "dateFin" TIMESTAMP(3),
    "limiteUtilisations" INTEGER,
    "nombreUtilisations" INTEGER NOT NULL DEFAULT 0,
    "isActif" BOOLEAN NOT NULL DEFAULT true,
    "siteId" TEXT,
    "userId" TEXT NOT NULL,
    "planId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Remise_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RemiseApplication" (
    "id" TEXT NOT NULL,
    "remiseId" TEXT NOT NULL,
    "abonnementId" TEXT NOT NULL,
    "montantReduit" DECIMAL(65,30) NOT NULL,
    "appliqueLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,

    CONSTRAINT "RemiseApplication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommissionIngenieur" (
    "id" TEXT NOT NULL,
    "ingenieurId" TEXT NOT NULL,
    "siteClientId" TEXT NOT NULL,
    "abonnementId" TEXT NOT NULL,
    "paiementAbonnementId" TEXT NOT NULL,
    "montant" DECIMAL(65,30) NOT NULL,
    "taux" DECIMAL(65,30) NOT NULL,
    "statut" "StatutCommissionIng" NOT NULL DEFAULT 'EN_ATTENTE',
    "periodeDebut" TIMESTAMP(3) NOT NULL,
    "periodeFin" TIMESTAMP(3) NOT NULL,
    "siteId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommissionIngenieur_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PortefeuilleIngenieur" (
    "id" TEXT NOT NULL,
    "ingenieurId" TEXT NOT NULL,
    "solde" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "soldePending" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "totalGagne" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "totalPaye" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "siteId" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PortefeuilleIngenieur_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RetraitPortefeuille" (
    "id" TEXT NOT NULL,
    "portefeuilleId" TEXT NOT NULL,
    "montant" DECIMAL(65,30) NOT NULL,
    "fournisseur" "FournisseurPaiement" NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "statut" "StatutPaiementAbo" NOT NULL DEFAULT 'EN_ATTENTE',
    "referenceExterne" TEXT,
    "demandeLeBy" TEXT NOT NULL,
    "traitePar" TEXT,
    "dateTraitement" TIMESTAMP(3),
    "siteId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RetraitPortefeuille_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PlanAbonnement_typePlan_key" ON "PlanAbonnement"("typePlan");

-- CreateIndex
CREATE INDEX "PlanAbonnement_typePlan_idx" ON "PlanAbonnement"("typePlan");

-- CreateIndex
CREATE INDEX "Abonnement_siteId_idx" ON "Abonnement"("siteId");

-- CreateIndex
CREATE INDEX "Abonnement_statut_idx" ON "Abonnement"("statut");

-- CreateIndex
CREATE INDEX "Abonnement_planId_idx" ON "Abonnement"("planId");

-- CreateIndex
CREATE INDEX "Abonnement_dateFin_idx" ON "Abonnement"("dateFin");

-- CreateIndex
CREATE INDEX "PaiementAbonnement_abonnementId_idx" ON "PaiementAbonnement"("abonnementId");

-- CreateIndex
CREATE INDEX "PaiementAbonnement_siteId_idx" ON "PaiementAbonnement"("siteId");

-- CreateIndex
CREATE INDEX "PaiementAbonnement_statut_idx" ON "PaiementAbonnement"("statut");

-- CreateIndex
CREATE INDEX "PaiementAbonnement_referenceExterne_idx" ON "PaiementAbonnement"("referenceExterne");

-- CreateIndex
CREATE UNIQUE INDEX "Remise_code_key" ON "Remise"("code");

-- CreateIndex
CREATE INDEX "Remise_siteId_idx" ON "Remise"("siteId");

-- CreateIndex
CREATE INDEX "Remise_code_idx" ON "Remise"("code");

-- CreateIndex
CREATE INDEX "RemiseApplication_remiseId_idx" ON "RemiseApplication"("remiseId");

-- CreateIndex
CREATE INDEX "RemiseApplication_abonnementId_idx" ON "RemiseApplication"("abonnementId");

-- CreateIndex
CREATE UNIQUE INDEX "RemiseApplication_remiseId_abonnementId_key" ON "RemiseApplication"("remiseId", "abonnementId");

-- CreateIndex
CREATE INDEX "CommissionIngenieur_ingenieurId_idx" ON "CommissionIngenieur"("ingenieurId");

-- CreateIndex
CREATE INDEX "CommissionIngenieur_abonnementId_idx" ON "CommissionIngenieur"("abonnementId");

-- CreateIndex
CREATE INDEX "CommissionIngenieur_siteId_idx" ON "CommissionIngenieur"("siteId");

-- CreateIndex
CREATE INDEX "CommissionIngenieur_statut_idx" ON "CommissionIngenieur"("statut");

-- CreateIndex
CREATE UNIQUE INDEX "PortefeuilleIngenieur_ingenieurId_key" ON "PortefeuilleIngenieur"("ingenieurId");

-- CreateIndex
CREATE INDEX "PortefeuilleIngenieur_siteId_idx" ON "PortefeuilleIngenieur"("siteId");

-- CreateIndex
CREATE INDEX "RetraitPortefeuille_portefeuilleId_idx" ON "RetraitPortefeuille"("portefeuilleId");

-- CreateIndex
CREATE INDEX "RetraitPortefeuille_siteId_idx" ON "RetraitPortefeuille"("siteId");

-- CreateIndex
CREATE INDEX "RetraitPortefeuille_statut_idx" ON "RetraitPortefeuille"("statut");

-- AddForeignKey
ALTER TABLE "Abonnement" ADD CONSTRAINT "Abonnement_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Abonnement" ADD CONSTRAINT "Abonnement_planId_fkey" FOREIGN KEY ("planId") REFERENCES "PlanAbonnement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Abonnement" ADD CONSTRAINT "Abonnement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Abonnement" ADD CONSTRAINT "Abonnement_remiseId_fkey" FOREIGN KEY ("remiseId") REFERENCES "Remise"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaiementAbonnement" ADD CONSTRAINT "PaiementAbonnement_abonnementId_fkey" FOREIGN KEY ("abonnementId") REFERENCES "Abonnement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaiementAbonnement" ADD CONSTRAINT "PaiementAbonnement_initiePar_fkey" FOREIGN KEY ("initiePar") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaiementAbonnement" ADD CONSTRAINT "PaiementAbonnement_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Remise" ADD CONSTRAINT "Remise_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Remise" ADD CONSTRAINT "Remise_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Remise" ADD CONSTRAINT "Remise_planId_fkey" FOREIGN KEY ("planId") REFERENCES "PlanAbonnement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RemiseApplication" ADD CONSTRAINT "RemiseApplication_remiseId_fkey" FOREIGN KEY ("remiseId") REFERENCES "Remise"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RemiseApplication" ADD CONSTRAINT "RemiseApplication_abonnementId_fkey" FOREIGN KEY ("abonnementId") REFERENCES "Abonnement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RemiseApplication" ADD CONSTRAINT "RemiseApplication_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommissionIngenieur" ADD CONSTRAINT "CommissionIngenieur_ingenieurId_fkey" FOREIGN KEY ("ingenieurId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommissionIngenieur" ADD CONSTRAINT "CommissionIngenieur_siteClientId_fkey" FOREIGN KEY ("siteClientId") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommissionIngenieur" ADD CONSTRAINT "CommissionIngenieur_abonnementId_fkey" FOREIGN KEY ("abonnementId") REFERENCES "Abonnement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommissionIngenieur" ADD CONSTRAINT "CommissionIngenieur_paiementAbonnementId_fkey" FOREIGN KEY ("paiementAbonnementId") REFERENCES "PaiementAbonnement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommissionIngenieur" ADD CONSTRAINT "CommissionIngenieur_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortefeuilleIngenieur" ADD CONSTRAINT "PortefeuilleIngenieur_ingenieurId_fkey" FOREIGN KEY ("ingenieurId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortefeuilleIngenieur" ADD CONSTRAINT "PortefeuilleIngenieur_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RetraitPortefeuille" ADD CONSTRAINT "RetraitPortefeuille_portefeuilleId_fkey" FOREIGN KEY ("portefeuilleId") REFERENCES "PortefeuilleIngenieur"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RetraitPortefeuille" ADD CONSTRAINT "RetraitPortefeuille_demandeLeBy_fkey" FOREIGN KEY ("demandeLeBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RetraitPortefeuille" ADD CONSTRAINT "RetraitPortefeuille_traitePar_fkey" FOREIGN KEY ("traitePar") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RetraitPortefeuille" ADD CONSTRAINT "RetraitPortefeuille_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

