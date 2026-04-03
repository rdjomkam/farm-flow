-- Migration: Add TypeAjustementDepense + ActionAjustementFrais enums,
-- extend AjustementDepense with frais adjustment fields,
-- add deletedAt soft-delete to FraisPaiementDepense.

-- CreateEnum
CREATE TYPE "TypeAjustementDepense" AS ENUM ('MONTANT_TOTAL', 'FRAIS_SUPP');

-- CreateEnum
CREATE TYPE "ActionAjustementFrais" AS ENUM ('AJOUTE', 'MODIFIE', 'SUPPRIME');

-- AlterTable AjustementDepense: add frais adjustment fields
ALTER TABLE "AjustementDepense"
  ADD COLUMN "typeAjustement" "TypeAjustementDepense" NOT NULL DEFAULT 'MONTANT_TOTAL',
  ADD COLUMN "paiementId" TEXT,
  ADD COLUMN "fraisId" TEXT,
  ADD COLUMN "actionFrais" "ActionAjustementFrais";

-- AlterTable FraisPaiementDepense: add soft-delete field
ALTER TABLE "FraisPaiementDepense"
  ADD COLUMN "deletedAt" TIMESTAMP(3);

-- CreateIndex for soft-delete lookups
CREATE INDEX "FraisPaiementDepense_deletedAt_idx" ON "FraisPaiementDepense"("deletedAt");
