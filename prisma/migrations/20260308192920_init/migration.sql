-- CreateEnum
CREATE TYPE "StatutVague" AS ENUM ('en_cours', 'terminee', 'annulee');

-- CreateEnum
CREATE TYPE "TypeReleve" AS ENUM ('biometrie', 'mortalite', 'alimentation', 'qualite_eau', 'comptage', 'observation');

-- CreateEnum
CREATE TYPE "TypeAliment" AS ENUM ('artisanal', 'commercial', 'mixte');

-- CreateEnum
CREATE TYPE "CauseMortalite" AS ENUM ('maladie', 'qualite_eau', 'stress', 'predation', 'inconnue');

-- CreateEnum
CREATE TYPE "MethodeComptage" AS ENUM ('direct', 'estimation', 'echantillonnage');

-- CreateTable
CREATE TABLE "Bac" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "volume" DOUBLE PRECISION,
    "nombrePoissons" INTEGER,
    "vagueId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Bac_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vague" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "dateDebutCharge" TIMESTAMP(3) NOT NULL,
    "nombreInitial" INTEGER NOT NULL,
    "poidsMoyenInit" DOUBLE PRECISION NOT NULL,
    "origineAlevins" TEXT,
    "statut" "StatutVague" NOT NULL DEFAULT 'en_cours',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vague_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Releve" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "typeReleve" "TypeReleve" NOT NULL,
    "vagueId" TEXT NOT NULL,
    "bacId" TEXT NOT NULL,
    "notes" TEXT,
    "poidsMoyen" DOUBLE PRECISION,
    "tailleMoyenne" DOUBLE PRECISION,
    "echantillon" INTEGER,
    "nombreMorts" INTEGER,
    "causeMortalite" "CauseMortalite",
    "typeAliment" "TypeAliment",
    "quantiteKg" DOUBLE PRECISION,
    "frequence" INTEGER,
    "temperature" DOUBLE PRECISION,
    "ph" DOUBLE PRECISION,
    "oxygene" DOUBLE PRECISION,
    "ammoniac" DOUBLE PRECISION,
    "nombreCompte" INTEGER,
    "methodeComptage" "MethodeComptage",
    "observation" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Releve_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Bac_vagueId_idx" ON "Bac"("vagueId");

-- CreateIndex
CREATE UNIQUE INDEX "Vague_code_key" ON "Vague"("code");

-- CreateIndex
CREATE INDEX "Releve_vagueId_typeReleve_idx" ON "Releve"("vagueId", "typeReleve");

-- CreateIndex
CREATE INDEX "Releve_bacId_idx" ON "Releve"("bacId");

-- CreateIndex
CREATE INDEX "Releve_date_idx" ON "Releve"("date");

-- AddForeignKey
ALTER TABLE "Bac" ADD CONSTRAINT "Bac_vagueId_fkey" FOREIGN KEY ("vagueId") REFERENCES "Vague"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Releve" ADD CONSTRAINT "Releve_vagueId_fkey" FOREIGN KEY ("vagueId") REFERENCES "Vague"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Releve" ADD CONSTRAINT "Releve_bacId_fkey" FOREIGN KEY ("bacId") REFERENCES "Bac"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
