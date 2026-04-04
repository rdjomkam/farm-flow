-- Migration: add ABONNEMENT_ESSAI_EXPIRE to TypeAlerte enum
-- ERR-001: RECREATE approach (rename old → create new → cast columns → drop old)
-- PostgreSQL does not allow ADD VALUE + UPDATE in the same transaction.

-- Step 1: Rename old enum
ALTER TYPE "TypeAlerte" RENAME TO "TypeAlerte_old";

-- Step 2: Create new enum with all existing values + the new one
CREATE TYPE "TypeAlerte" AS ENUM (
  'MORTALITE_ELEVEE',
  'QUALITE_EAU',
  'STOCK_BAS',
  'RAPPEL_ALIMENTATION',
  'RAPPEL_BIOMETRIE',
  'PERSONNALISEE',
  'BESOIN_EN_RETARD',
  'DENSITE_ELEVEE',
  'RENOUVELLEMENT_EAU_INSUFFISANT',
  'AUCUN_RELEVE_QUALITE_EAU',
  'DENSITE_CRITIQUE_QUALITE_EAU',
  'ABONNEMENT_RAPPEL_RENOUVELLEMENT',
  'ABONNEMENT_ESSAI_EXPIRE'
);

-- Step 3: Cast columns using old enum to new enum
ALTER TABLE "Notification" ALTER COLUMN "typeAlerte" TYPE "TypeAlerte" USING "typeAlerte"::text::"TypeAlerte";
ALTER TABLE "ConfigAlerte" ALTER COLUMN "typeAlerte" TYPE "TypeAlerte" USING "typeAlerte"::text::"TypeAlerte";

-- Step 4: Drop old enum
DROP TYPE "TypeAlerte_old";
