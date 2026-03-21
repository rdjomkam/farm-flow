-- Migration: Add ABONNEMENTS, COMMISSIONS, REMISES to SiteModule enum
-- Uses RECREATE strategy (rename old → create new → cast columns → drop old)
-- Required because PostgreSQL does not allow ADD VALUE + UPDATE in the same transaction

-- Step 1: Rename old enum
ALTER TYPE "SiteModule" RENAME TO "SiteModule_old";

-- Step 2: Create new enum with all values (existing 9 + 3 new)
CREATE TYPE "SiteModule" AS ENUM (
  'REPRODUCTION',
  'GROSSISSEMENT',
  'INTRANTS',
  'VENTES',
  'ANALYSE_PILOTAGE',
  'PACKS_PROVISIONING',
  'CONFIGURATION',
  'INGENIEUR',
  'NOTES',
  'ABONNEMENTS',
  'COMMISSIONS',
  'REMISES'
);

-- Step 3: Cast array columns on Site table (drop default, cast, restore default)
ALTER TABLE "Site" ALTER COLUMN "enabledModules" DROP DEFAULT;
ALTER TABLE "Site"
  ALTER COLUMN "enabledModules" TYPE "SiteModule"[]
  USING "enabledModules"::text[]::"SiteModule"[];
ALTER TABLE "Site" ALTER COLUMN "enabledModules" SET DEFAULT ARRAY[]::"SiteModule"[];

-- Step 4: Cast array columns on Pack table (drop default, cast, restore default)
ALTER TABLE "Pack" ALTER COLUMN "enabledModules" DROP DEFAULT;
ALTER TABLE "Pack"
  ALTER COLUMN "enabledModules" TYPE "SiteModule"[]
  USING "enabledModules"::text[]::"SiteModule"[];
ALTER TABLE "Pack" ALTER COLUMN "enabledModules" SET DEFAULT ARRAY[]::"SiteModule"[];

-- Step 5: Drop old enum
DROP TYPE "SiteModule_old";
