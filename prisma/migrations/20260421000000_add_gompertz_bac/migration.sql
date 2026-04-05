-- Migration: add_gompertz_bac
-- ADR-030 — Modèle GompertzBac + extension enum StrategieInterpolation avec GOMPERTZ_BAC
-- Utilise l'approche RECREATE pour l'extension d'enum (jamais ADD VALUE — règle R1)
-- Note: DROP DEFAULT + SET DEFAULT requis car la colonne a une valeur par défaut typée.
-- Note: DO blocks utilisés pour idempotence en cas de retry après échec partiel.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Extension de l'enum StrategieInterpolation (RECREATE strategy)
-- ─────────────────────────────────────────────────────────────────────────────

-- Drop the default before altering the column type (required for enum RECREATE)
-- Idempotent: if the default is already dropped, this is a no-op in context.
ALTER TABLE "ConfigElevage"
  ALTER COLUMN "interpolationStrategy" DROP DEFAULT;

-- Step A: Rename original type to _old (only if StrategieInterpolation still has the old name)
DO $$
BEGIN
  -- Only rename if the NEW type doesn't exist yet (i.e. this step hasn't been done)
  -- and the old base name still exists (not yet renamed to _old)
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'StrategieInterpolation_old')
     AND EXISTS (SELECT 1 FROM pg_type WHERE typname = 'StrategieInterpolation') THEN
    ALTER TYPE "StrategieInterpolation" RENAME TO "StrategieInterpolation_old";
  END IF;
END;
$$;

-- Step B: Create new enum (only if it doesn't already exist)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'StrategieInterpolation') THEN
    CREATE TYPE "StrategieInterpolation" AS ENUM (
      'LINEAIRE',
      'GOMPERTZ_VAGUE',
      'GOMPERTZ_BAC'
    );
  END IF;
END;
$$;

-- Step C: Cast the column to the new type
ALTER TABLE "ConfigElevage"
  ALTER COLUMN "interpolationStrategy" TYPE "StrategieInterpolation"
  USING "interpolationStrategy"::text::"StrategieInterpolation";

-- Restore the default using the new enum type
ALTER TABLE "ConfigElevage"
  ALTER COLUMN "interpolationStrategy" SET DEFAULT 'LINEAIRE'::"StrategieInterpolation";

-- Drop the old type
DROP TYPE IF EXISTS "StrategieInterpolation_old";

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Création de la table GompertzBac
-- ─────────────────────────────────────────────────────────────────────────────

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

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Index
-- ─────────────────────────────────────────────────────────────────────────────

CREATE UNIQUE INDEX "GompertzBac_bacId_key" ON "GompertzBac"("bacId");
CREATE INDEX "GompertzBac_vagueId_idx" ON "GompertzBac"("vagueId");
CREATE INDEX "GompertzBac_siteId_idx" ON "GompertzBac"("siteId");
CREATE INDEX "GompertzBac_bacId_idx" ON "GompertzBac"("bacId");

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Clés étrangères
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE "GompertzBac"
  ADD CONSTRAINT "GompertzBac_bacId_fkey"
    FOREIGN KEY ("bacId") REFERENCES "Bac"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "GompertzBac"
  ADD CONSTRAINT "GompertzBac_vagueId_fkey"
    FOREIGN KEY ("vagueId") REFERENCES "Vague"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "GompertzBac"
  ADD CONSTRAINT "GompertzBac_siteId_fkey"
    FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
