-- Migration 2: add_renouvellement_releve
-- Recreates TypeReleve enum adding RENOUVELLEMENT value (RECREATE pattern — cannot ADD VALUE in same tx as UPDATE)
-- Also adds pourcentageRenouvellement and volumeRenouvele columns to Releve

-- Step 1 — rename old enum
ALTER TYPE "TypeReleve" RENAME TO "TypeReleve_old";

-- Step 2 — create new enum with all values including RENOUVELLEMENT
CREATE TYPE "TypeReleve" AS ENUM (
  'BIOMETRIE',
  'MORTALITE',
  'ALIMENTATION',
  'QUALITE_EAU',
  'COMPTAGE',
  'OBSERVATION',
  'RENOUVELLEMENT'
);

-- Step 3 — migrate existing column
ALTER TABLE "Releve"
  ALTER COLUMN "typeReleve" TYPE "TypeReleve"
  USING "typeReleve"::text::"TypeReleve";

-- Step 4 — drop old enum
DROP TYPE "TypeReleve_old";

-- Step 5 — add new nullable columns for RENOUVELLEMENT type releves
ALTER TABLE "Releve" ADD COLUMN "pourcentageRenouvellement" DOUBLE PRECISION;
ALTER TABLE "Releve" ADD COLUMN "volumeRenouvele" DOUBLE PRECISION;
