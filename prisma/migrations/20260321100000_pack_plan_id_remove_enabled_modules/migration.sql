-- Migration: Pack.planId + drop enabledModules
-- Story 44.1 — Pack linked to PlanAbonnement, enabledModules removed from Pack
--
-- Tolérant à l'ordre : sur une base vierge, "PlanAbonnement" n'existe pas
-- encore à ce stade (elle est créée par 20260327000000_add_subscriptions,
-- postérieure dans la chaîne réelle mais lexicographiquement après
-- celle-ci). L'étape 1 (ajout de "planId" nullable) est inconditionnelle ;
-- les étapes 2 à 5 (backfill, NOT NULL, DROP "enabledModules", FK, index)
-- ne peuvent s'exécuter qu'une fois "PlanAbonnement" disponible — elles
-- sont donc conditionnées ici à son existence, et rejouées par
-- 20260327000000_add_subscriptions une fois la table créée (idempotent :
-- no-op si déjà fait, via les mêmes gardes de précondition).
-- Voir docs/bugs/BUG-CI-migration-order.md.

-- 1. Add planId nullable first (to allow data backfill)
ALTER TABLE "Pack" ADD COLUMN IF NOT EXISTS "planId" TEXT;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'PlanAbonnement') THEN

    -- 2. Map existing packs to plans by name pattern
    UPDATE "Pack" SET "planId" = (SELECT id FROM "PlanAbonnement" WHERE "typePlan" = 'DECOUVERTE')
    WHERE "planId" IS NULL AND (LOWER("nom") LIKE '%d%couverte%' OR LOWER("nom") LIKE '%decouverte%' OR LOWER("nom") LIKE '%starter 100%' OR LOWER("nom") LIKE '%100%');

    UPDATE "Pack" SET "planId" = (SELECT id FROM "PlanAbonnement" WHERE "typePlan" = 'ELEVEUR')
    WHERE "planId" IS NULL AND (LOWER("nom") LIKE '%l%veur%' OR LOWER("nom") LIKE '%eleveur%' OR LOWER("nom") LIKE '%starter 300%' OR LOWER("nom") LIKE '%300%');

    UPDATE "Pack" SET "planId" = (SELECT id FROM "PlanAbonnement" WHERE "typePlan" = 'PROFESSIONNEL')
    WHERE "planId" IS NULL AND (LOWER("nom") LIKE '%professionnel%' OR LOWER("nom") LIKE '%pro 500%' OR LOWER("nom") LIKE '%500%');

    UPDATE "Pack" SET "planId" = (SELECT id FROM "PlanAbonnement" WHERE "typePlan" = 'ENTREPRISE')
    WHERE "planId" IS NULL AND (LOWER("nom") LIKE '%entreprise%' OR LOWER("nom") LIKE '%enterprise%');

    UPDATE "Pack" SET "planId" = (SELECT id FROM "PlanAbonnement" WHERE "typePlan" = 'INGENIEUR_STARTER')
    WHERE "planId" IS NULL AND (LOWER("nom") LIKE '%ing%nieur starter%' OR LOWER("nom") LIKE '%ingenieur starter%');

    UPDATE "Pack" SET "planId" = (SELECT id FROM "PlanAbonnement" WHERE "typePlan" = 'INGENIEUR_PRO')
    WHERE "planId" IS NULL AND (LOWER("nom") LIKE '%ing%nieur pro%' OR LOWER("nom") LIKE '%ingenieur pro%');

    UPDATE "Pack" SET "planId" = (SELECT id FROM "PlanAbonnement" WHERE "typePlan" = 'INGENIEUR_EXPERT')
    WHERE "planId" IS NULL AND (LOWER("nom") LIKE '%ing%nieur expert%' OR LOWER("nom") LIKE '%ingenieur expert%');

    -- Fallback: any remaining packs without planId → DECOUVERTE
    UPDATE "Pack" SET "planId" = (SELECT id FROM "PlanAbonnement" WHERE "typePlan" = 'DECOUVERTE')
    WHERE "planId" IS NULL;

    -- 3. Make planId NOT NULL (no-op si déjà fait)
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'Pack'
        AND column_name = 'planId' AND is_nullable = 'YES'
    ) THEN
      ALTER TABLE "Pack" ALTER COLUMN "planId" SET NOT NULL;
    END IF;

    -- 4. Drop enabledModules column (no-op si déjà absente)
    ALTER TABLE "Pack" DROP COLUMN IF EXISTS "enabledModules";

    -- 5. Add FK constraint + index (no-op si déjà présents)
    BEGIN
      ALTER TABLE "Pack" ADD CONSTRAINT "Pack_planId_fkey"
        FOREIGN KEY ("planId") REFERENCES "PlanAbonnement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;

    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'Pack_planId_idx') THEN
      CREATE INDEX "Pack_planId_idx" ON "Pack"("planId");
    END IF;

  END IF;
END $$;
