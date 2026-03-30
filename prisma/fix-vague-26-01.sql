-- Fix 6 — Data correction for Vague 26-01
-- Correct the nombreInitial field that was decremented incorrectly when a bac was removed.
-- Run this once on production to restore the correct value.
--
-- Usage:
--   docker exec -i silures-db psql -U dkfarm -d farm-flow < prisma/fix-vague-26-01.sql
-- or on Prisma Postgres:
--   psql "$DATABASE_URL" < prisma/fix-vague-26-01.sql
--
-- Verify before running:
--   SELECT id, code, "nombreInitial" FROM "Vague" WHERE code = 'Vague 26-01';

UPDATE "Vague" SET "nombreInitial" = 5500 WHERE code = 'Vague 26-01' AND "nombreInitial" != 5500;
