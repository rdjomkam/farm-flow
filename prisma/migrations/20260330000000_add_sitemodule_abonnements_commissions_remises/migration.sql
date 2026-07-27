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

-- Step 4: (removed — Pack.enabledModules was dropped in migration 20260321100000)

-- Step 4b: Cast PlanAbonnement.modulesInclus if present.
-- Sur une base vierge, "PlanAbonnement" (créée par 20260327000000_add_subscriptions)
-- porte déjà la colonne "modulesInclus" "SiteModule"[] au moment où cette
-- migration s'exécute — elle dépend donc, comme "Site.enabledModules", de
-- l'ancien type "SiteModule_old" et doit être castée avant le DROP TYPE.
-- Gardée par une vérification d'existence pour rester un no-op silencieux
-- sur tout environnement où la colonne n'existe pas encore à ce stade.
-- Voir docs/bugs/BUG-CI-migration-order.md.
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'PlanAbonnement' AND column_name = 'modulesInclus'
  ) THEN
    ALTER TABLE "PlanAbonnement" ALTER COLUMN "modulesInclus" DROP DEFAULT;
    ALTER TABLE "PlanAbonnement"
      ALTER COLUMN "modulesInclus" TYPE "SiteModule"[]
      USING "modulesInclus"::text[]::"SiteModule"[];
    ALTER TABLE "PlanAbonnement" ALTER COLUMN "modulesInclus" SET DEFAULT ARRAY[]::"SiteModule"[];
  END IF;
END $$;

-- Step 5: Drop old enum
DROP TYPE "SiteModule_old";
