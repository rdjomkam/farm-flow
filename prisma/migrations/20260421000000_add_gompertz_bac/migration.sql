-- Migration: add_gompertz_bac
-- ADR-030 — Modèle GompertzBac + extension enum StrategieInterpolation avec GOMPERTZ_BAC
-- Utilise l'approche RECREATE pour l'extension d'enum (jamais ADD VALUE — règle R1)
-- Note: DROP DEFAULT + SET DEFAULT requis car la colonne a une valeur par défaut typée.
-- Note: DO blocks utilisés pour idempotence en cas de retry après échec partiel.
--
-- Tolérant à l'ordre : le nom de dossier de cette migration (20260421...)
-- la place, lexicographiquement, APRÈS 20260406000000_remove_strategie_interpolation
-- — alors que l'ordre réel d'application est l'inverse (cette migration,
-- ADR-030, a été appliquée avant ; ADR-034 a ensuite intégralement défait
-- toute la fonctionnalité StrategieInterpolation, GompertzBac compris).
-- schema.prisma ne porte aujourd'hui plus aucune trace de
-- "interpolationStrategy"/"StrategieInterpolation"/"GompertzBac" : l'état
-- cible final est leur ABSENCE complète. Sur une base vierge,
-- 20260406000000_remove_strategie_interpolation s'exécute avant celle-ci
-- (ordre lexicographique) et est donc déjà enregistrée dans
-- "_prisma_migrations" au moment où ce bloc s'exécute — on l'utilise comme
-- signal pour ne PAS recréer une fonctionnalité déjà supprimée en aval.
-- Voir docs/bugs/BUG-CI-migration-order.md.

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM "_prisma_migrations"
    WHERE migration_name = '20260406000000_remove_strategie_interpolation' AND finished_at IS NOT NULL
  ) THEN

    -- ───────────────────────────────────────────────────────────────────────
    -- 1. Extension de l'enum StrategieInterpolation (RECREATE strategy)
    -- ───────────────────────────────────────────────────────────────────────

    -- Drop the default before altering the column type (required for enum RECREATE)
    -- Idempotent: if the default is already dropped, this is a no-op in context.
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'ConfigElevage' AND column_name = 'interpolationStrategy'
    ) THEN
      ALTER TABLE "ConfigElevage"
        ALTER COLUMN "interpolationStrategy" DROP DEFAULT;
    END IF;

    -- Step A: Rename original type to _old (only if StrategieInterpolation still has the old name)
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'StrategieInterpolation_old')
       AND EXISTS (SELECT 1 FROM pg_type WHERE typname = 'StrategieInterpolation') THEN
      ALTER TYPE "StrategieInterpolation" RENAME TO "StrategieInterpolation_old";
    END IF;

    -- Step B: Create new enum (only if it doesn't already exist)
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'StrategieInterpolation') THEN
      CREATE TYPE "StrategieInterpolation" AS ENUM (
        'LINEAIRE',
        'GOMPERTZ_VAGUE',
        'GOMPERTZ_BAC'
      );
    END IF;

    -- Step C: Cast the column to the new type (si la colonne existe déjà)
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'ConfigElevage' AND column_name = 'interpolationStrategy'
    ) THEN
      ALTER TABLE "ConfigElevage"
        ALTER COLUMN "interpolationStrategy" TYPE "StrategieInterpolation"
        USING "interpolationStrategy"::text::"StrategieInterpolation";

      -- Restore the default using the new enum type
      ALTER TABLE "ConfigElevage"
        ALTER COLUMN "interpolationStrategy" SET DEFAULT 'LINEAIRE'::"StrategieInterpolation";
    END IF;

    -- Drop the old type
    DROP TYPE IF EXISTS "StrategieInterpolation_old";

    -- ───────────────────────────────────────────────────────────────────────
    -- 2. Création de la table GompertzBac
    -- ───────────────────────────────────────────────────────────────────────

    IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'GompertzBac') THEN
      CREATE TABLE "GompertzBac" (
          "id"              TEXT NOT NULL,
          "bacId"           TEXT NOT NULL,
          "vagueId"         TEXT NOT NULL,
          "wInfinity"       DOUBLE PRECISION NOT NULL,
          "k"               DOUBLE PRECISION NOT NULL,
          "ti"              DOUBLE PRECISION NOT NULL,
          "r2"              DOUBLE PRECISION NOT NULL,
          "rmse"            DOUBLE PRECISION NOT NULL,
          "biometrieCount"  INTEGER NOT NULL,
          "confidenceLevel" TEXT NOT NULL,
          "configWInfUsed"  DOUBLE PRECISION,
          "siteId"          TEXT NOT NULL,
          "calculatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt"       TIMESTAMP(3) NOT NULL,

          CONSTRAINT "GompertzBac_pkey" PRIMARY KEY ("id")
      );

      -- ─────────────────────────────────────────────────────────────────────
      -- 3. Index
      -- ─────────────────────────────────────────────────────────────────────

      CREATE UNIQUE INDEX "GompertzBac_bacId_key" ON "GompertzBac"("bacId");
      CREATE INDEX "GompertzBac_vagueId_idx" ON "GompertzBac"("vagueId");
      CREATE INDEX "GompertzBac_siteId_idx" ON "GompertzBac"("siteId");
      CREATE INDEX "GompertzBac_bacId_idx" ON "GompertzBac"("bacId");

      -- ─────────────────────────────────────────────────────────────────────
      -- 4. Clés étrangères
      -- ─────────────────────────────────────────────────────────────────────

      ALTER TABLE "GompertzBac"
        ADD CONSTRAINT "GompertzBac_bacId_fkey"
          FOREIGN KEY ("bacId") REFERENCES "Bac"("id") ON DELETE CASCADE ON UPDATE CASCADE;

      ALTER TABLE "GompertzBac"
        ADD CONSTRAINT "GompertzBac_vagueId_fkey"
          FOREIGN KEY ("vagueId") REFERENCES "Vague"("id") ON DELETE CASCADE ON UPDATE CASCADE;

      ALTER TABLE "GompertzBac"
        ADD CONSTRAINT "GompertzBac_siteId_fkey"
          FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;

  END IF;
END $$;
