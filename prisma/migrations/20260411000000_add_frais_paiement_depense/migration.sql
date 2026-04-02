-- CreateEnum
CREATE TYPE "MotifFraisSupp" AS ENUM ('TRANSPORT', 'FRAIS_MOBILE_MONEY', 'FRAIS_BANCAIRES', 'PENALITE_RETARD', 'AUTRE');

-- AlterTable
ALTER TABLE "Depense" ADD COLUMN "montantFraisSupp" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "FraisPaiementDepense" (
    "id" TEXT NOT NULL,
    "paiementId" TEXT NOT NULL,
    "motif" "MotifFraisSupp" NOT NULL,
    "montant" DOUBLE PRECISION NOT NULL,
    "notes" TEXT,
    "siteId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FraisPaiementDepense_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FraisPaiementDepense_paiementId_idx" ON "FraisPaiementDepense"("paiementId");

-- CreateIndex
CREATE INDEX "FraisPaiementDepense_siteId_idx" ON "FraisPaiementDepense"("siteId");

-- AddForeignKey
ALTER TABLE "FraisPaiementDepense" ADD CONSTRAINT "FraisPaiementDepense_paiementId_fkey" FOREIGN KEY ("paiementId") REFERENCES "PaiementDepense"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FraisPaiementDepense" ADD CONSTRAINT "FraisPaiementDepense_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
