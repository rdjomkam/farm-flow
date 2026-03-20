-- Migration 3: add_density_thresholds
-- Adds density threshold columns to ConfigElevage (differenced by system type)
-- Adds fenetreRenouvellementJours to ConfigElevage
-- Creates SeveriteAlerte enum
-- Adds actionPayload and severite to Notification

-- ── ConfigElevage: density thresholds by system type ────────────────────────
ALTER TABLE "ConfigElevage" ADD COLUMN "densiteBacBetonAlerte"   DOUBLE PRECISION NOT NULL DEFAULT 150;
ALTER TABLE "ConfigElevage" ADD COLUMN "densiteBacBetonCritique" DOUBLE PRECISION NOT NULL DEFAULT 200;
ALTER TABLE "ConfigElevage" ADD COLUMN "densiteEtangAlerte"      DOUBLE PRECISION NOT NULL DEFAULT 30;
ALTER TABLE "ConfigElevage" ADD COLUMN "densiteEtangCritique"    DOUBLE PRECISION NOT NULL DEFAULT 40;
ALTER TABLE "ConfigElevage" ADD COLUMN "densiteRasAlerte"        DOUBLE PRECISION NOT NULL DEFAULT 350;
ALTER TABLE "ConfigElevage" ADD COLUMN "densiteRasCritique"      DOUBLE PRECISION NOT NULL DEFAULT 500;

-- ── ConfigElevage: renewal window ───────────────────────────────────────────
ALTER TABLE "ConfigElevage" ADD COLUMN "fenetreRenouvellementJours" INTEGER NOT NULL DEFAULT 7;

-- ── SeveriteAlerte enum ──────────────────────────────────────────────────────
CREATE TYPE "SeveriteAlerte" AS ENUM (
  'INFO',
  'AVERTISSEMENT',
  'CRITIQUE'
);

-- ── Notification: structured action payload + severity ───────────────────────
ALTER TABLE "Notification" ADD COLUMN "actionPayload" JSONB;
ALTER TABLE "Notification" ADD COLUMN "severite" "SeveriteAlerte" NOT NULL DEFAULT 'INFO';
