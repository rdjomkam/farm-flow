-- Migration 1: add_type_systeme_bac
-- Creates TypeSystemeBac enum and adds typeSysteme column to Bac (nullable)

CREATE TYPE "TypeSystemeBac" AS ENUM (
  'BAC_BETON',
  'BAC_PLASTIQUE',
  'ETANG_TERRE',
  'RAS'
);

ALTER TABLE "Bac" ADD COLUMN "typeSysteme" "TypeSystemeBac";
