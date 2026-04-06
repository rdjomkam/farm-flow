-- Migration: add_strategie_interpolation
-- ADR-029 — Stratégie d'interpolation configurable pour ConfigElevage
-- Non-destructive: toutes les lignes existantes obtiennent LINEAIRE par défaut.

-- CreateEnum
CREATE TYPE "StrategieInterpolation" AS ENUM ('LINEAIRE', 'GOMPERTZ_VAGUE');

-- AlterTable: add interpolationStrategy to ConfigElevage
ALTER TABLE "ConfigElevage"
  ADD COLUMN "interpolationStrategy" "StrategieInterpolation" NOT NULL DEFAULT 'LINEAIRE';

-- AlterTable: add listeBesoinsId to Commande (schema drift sync)
ALTER TABLE "Commande"
  ADD COLUMN "listeBesoinsId" TEXT;

-- CreateIndex
CREATE INDEX "Commande_listeBesoinsId_idx" ON "Commande"("listeBesoinsId");

-- AddForeignKey
ALTER TABLE "Commande"
  ADD CONSTRAINT "Commande_listeBesoinsId_fkey"
  FOREIGN KEY ("listeBesoinsId") REFERENCES "ListeBesoins"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
