-- Fix 5 — Add snapshot fields to Calibrage for survival rate audit trail
-- These fields capture the state of vague+bacs before a calibrage is created or modified.
--
-- Data correction (Fix 6) — Vague 26-01 prod fix:
-- UPDATE "Vague" SET "nombreInitial" = 5500 WHERE code = 'Vague 26-01';
-- Run this manually on production after deploying the migration.

-- AlterTable
ALTER TABLE "Calibrage" ADD COLUMN "snapshotAvant" JSONB,
ADD COLUMN "snapshotAvantModif" JSONB;
