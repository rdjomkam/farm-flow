-- Migration: add_feed_analytics
-- Sprint FA — Feed Analytics Phase 1
-- Story FA.1 — Migration DB : enums + champs aliment
--
-- Ajoute 3 enums (TailleGranule, FormeAliment, ComportementAlimentaire)
-- et enrichit Produit, Releve, MouvementStock, ConfigElevage

-- CreateEnum
CREATE TYPE "TailleGranule" AS ENUM ('P0', 'P1', 'P2', 'P3', 'G1', 'G2', 'G3', 'G4', 'G5');

-- CreateEnum
CREATE TYPE "FormeAliment" AS ENUM ('FLOTTANT', 'COULANT', 'SEMI_FLOTTANT', 'POUDRE');

-- CreateEnum
CREATE TYPE "ComportementAlimentaire" AS ENUM ('VORACE', 'NORMAL', 'FAIBLE', 'REFUSE');

-- AlterTable ConfigElevage — scoreAlimentConfig (nullable, migration non-destructive)
ALTER TABLE "ConfigElevage" ADD COLUMN "scoreAlimentConfig" JSONB;

-- AlterTable MouvementStock — traçabilité lot aliment
ALTER TABLE "MouvementStock"
  ADD COLUMN "datePeremption" TIMESTAMP(3),
  ADD COLUMN "lotFabrication" TEXT;

-- AlterTable Produit — caractéristiques nutritionnelles aliment
ALTER TABLE "Produit"
  ADD COLUMN "formeAliment"  "FormeAliment",
  ADD COLUMN "phasesCibles"  "PhaseElevage"[],
  ADD COLUMN "tailleGranule" "TailleGranule",
  ADD COLUMN "tauxFibres"    DOUBLE PRECISION,
  ADD COLUMN "tauxLipides"   DOUBLE PRECISION,
  ADD COLUMN "tauxProteines" DOUBLE PRECISION;

-- AlterTable Releve — données comportementales alimentation
ALTER TABLE "Releve"
  ADD COLUMN "comportementAlim" "ComportementAlimentaire",
  ADD COLUMN "tauxRefus"        DOUBLE PRECISION;
