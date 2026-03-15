-- Migration Sprint 19 — ConfigElevage
-- Adds: PhaseElevage enum, ConfigElevage model (parametres configurables par site)
-- Also fixes: FK drift for Activite, ConfigAlerte, Notification + Depense.updatedAt

-- CreateEnum
CREATE TYPE "PhaseElevage" AS ENUM ('ACCLIMATATION', 'CROISSANCE_DEBUT', 'JUVENILE', 'GROSSISSEMENT', 'FINITION', 'PRE_RECOLTE');

-- DropForeignKey (drift fix)
ALTER TABLE "Activite" DROP CONSTRAINT IF EXISTS "Activite_siteId_fkey";
ALTER TABLE "ConfigAlerte" DROP CONSTRAINT IF EXISTS "ConfigAlerte_siteId_fkey";
ALTER TABLE "ConfigAlerte" DROP CONSTRAINT IF EXISTS "ConfigAlerte_userId_fkey";
ALTER TABLE "Notification" DROP CONSTRAINT IF EXISTS "Notification_siteId_fkey";
ALTER TABLE "Notification" DROP CONSTRAINT IF EXISTS "Notification_userId_fkey";

-- AlterTable (drift fix)
ALTER TABLE "Depense" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateTable
CREATE TABLE "ConfigElevage" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "description" TEXT,
    "poidsObjectif" DOUBLE PRECISION NOT NULL,
    "dureeEstimeeCycle" INTEGER NOT NULL,
    "tauxSurvieObjectif" DOUBLE PRECISION NOT NULL,
    "seuilAcclimatation" DOUBLE PRECISION NOT NULL DEFAULT 15,
    "seuilCroissanceDebut" DOUBLE PRECISION NOT NULL DEFAULT 50,
    "seuilJuvenile" DOUBLE PRECISION NOT NULL DEFAULT 150,
    "seuilGrossissement" DOUBLE PRECISION NOT NULL DEFAULT 350,
    "seuilFinition" DOUBLE PRECISION NOT NULL DEFAULT 700,
    "alimentTailleConfig" JSONB NOT NULL,
    "alimentTauxConfig" JSONB NOT NULL,
    "fcrExcellentMax" DOUBLE PRECISION NOT NULL DEFAULT 1.5,
    "fcrBonMax" DOUBLE PRECISION NOT NULL DEFAULT 1.8,
    "fcrAcceptableMax" DOUBLE PRECISION NOT NULL DEFAULT 2.2,
    "sgrExcellentMin" DOUBLE PRECISION NOT NULL DEFAULT 2.0,
    "sgrBonMin" DOUBLE PRECISION NOT NULL DEFAULT 1.5,
    "sgrAcceptableMin" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "survieExcellentMin" DOUBLE PRECISION NOT NULL DEFAULT 90,
    "survieBonMin" DOUBLE PRECISION NOT NULL DEFAULT 85,
    "survieAcceptableMin" DOUBLE PRECISION NOT NULL DEFAULT 80,
    "densiteExcellentMax" DOUBLE PRECISION NOT NULL DEFAULT 7,
    "densiteBonMax" DOUBLE PRECISION NOT NULL DEFAULT 10,
    "densiteAcceptableMax" DOUBLE PRECISION NOT NULL DEFAULT 15,
    "mortaliteExcellentMax" DOUBLE PRECISION NOT NULL DEFAULT 3,
    "mortaliteBonMax" DOUBLE PRECISION NOT NULL DEFAULT 5,
    "mortaliteAcceptableMax" DOUBLE PRECISION NOT NULL DEFAULT 10,
    "phMin" DOUBLE PRECISION NOT NULL DEFAULT 6.5,
    "phMax" DOUBLE PRECISION NOT NULL DEFAULT 8.5,
    "phOptimalMin" DOUBLE PRECISION NOT NULL DEFAULT 6.5,
    "phOptimalMax" DOUBLE PRECISION NOT NULL DEFAULT 7.5,
    "temperatureMin" DOUBLE PRECISION NOT NULL DEFAULT 22,
    "temperatureMax" DOUBLE PRECISION NOT NULL DEFAULT 36,
    "temperatureOptimalMin" DOUBLE PRECISION NOT NULL DEFAULT 26,
    "temperatureOptimalMax" DOUBLE PRECISION NOT NULL DEFAULT 32,
    "oxygeneMin" DOUBLE PRECISION NOT NULL DEFAULT 1.5,
    "oxygeneAlerte" DOUBLE PRECISION NOT NULL DEFAULT 4.0,
    "oxygeneOptimal" DOUBLE PRECISION NOT NULL DEFAULT 5.0,
    "ammoniacMax" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "ammoniacAlerte" DOUBLE PRECISION NOT NULL DEFAULT 0.05,
    "ammoniacOptimal" DOUBLE PRECISION NOT NULL DEFAULT 0.02,
    "nitriteMax" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "nitriteAlerte" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "mortaliteQuotidienneAlerte" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "mortaliteQuotidienneCritique" DOUBLE PRECISION NOT NULL DEFAULT 3.0,
    "fcrAlerteMax" DOUBLE PRECISION NOT NULL DEFAULT 2.0,
    "stockJoursAlerte" INTEGER NOT NULL DEFAULT 5,
    "triPoidsMin" DOUBLE PRECISION NOT NULL DEFAULT 5,
    "triPoidsMax" DOUBLE PRECISION NOT NULL DEFAULT 150,
    "triIntervalleJours" INTEGER NOT NULL DEFAULT 14,
    "biometrieIntervalleDebut" INTEGER NOT NULL DEFAULT 7,
    "biometrieIntervalleFin" INTEGER NOT NULL DEFAULT 14,
    "biometrieEchantillonPct" DOUBLE PRECISION NOT NULL DEFAULT 10,
    "eauChangementPct" DOUBLE PRECISION NOT NULL DEFAULT 30,
    "eauChangementIntervalleJours" INTEGER NOT NULL DEFAULT 3,
    "densiteMaxPoissonsM3" DOUBLE PRECISION NOT NULL DEFAULT 100,
    "densiteOptimalePoissonsM3" DOUBLE PRECISION NOT NULL DEFAULT 50,
    "recoltePartiellePoidsSeuil" DOUBLE PRECISION NOT NULL DEFAULT 400,
    "recolteJeuneAvantJours" INTEGER NOT NULL DEFAULT 2,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "siteId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConfigElevage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ConfigElevage_siteId_idx" ON "ConfigElevage"("siteId");
CREATE INDEX "ConfigElevage_siteId_isDefault_idx" ON "ConfigElevage"("siteId", "isDefault");
CREATE INDEX "ConfigElevage_siteId_isActive_idx" ON "ConfigElevage"("siteId", "isActive");

-- AddForeignKey
ALTER TABLE "ConfigElevage" ADD CONSTRAINT "ConfigElevage_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey (drift fix)
ALTER TABLE "ConfigAlerte" ADD CONSTRAINT "ConfigAlerte_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ConfigAlerte" ADD CONSTRAINT "ConfigAlerte_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Activite" ADD CONSTRAINT "Activite_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
