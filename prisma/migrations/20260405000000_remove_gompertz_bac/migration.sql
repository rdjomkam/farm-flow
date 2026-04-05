-- Migration: 20260405000000_remove_gompertz_bac
-- ADR-032 — Suppression de GOMPERTZ_BAC
--
-- Phase A: supprimer le modele GompertzBac et la valeur GOMPERTZ_BAC de StrategieInterpolation.
-- Approche RECREATE pour l'enum (impossible de DROP VALUE directement en PostgreSQL):
--   1. DROP TABLE GompertzBac (lever les contraintes FK sur Bac/Vague/Site)
--   2. MAP toute valeur GOMPERTZ_BAC vers GOMPERTZ_VAGUE dans ConfigElevage
--   3. Rename ancien enum -> __old__
--   4. Créer nouveau enum avec seulement LINEAIRE + GOMPERTZ_VAGUE
--   5. DROP le DEFAULT de la colonne, ALTER le type, restaurer le DEFAULT
--   6. DROP l'ancien enum

-- Étape 1 — DROP TABLE GompertzBac
DROP TABLE IF EXISTS "GompertzBac";

-- Étape 2 — Migrer les lignes GOMPERTZ_BAC -> GOMPERTZ_VAGUE dans ConfigElevage
UPDATE "ConfigElevage"
SET "interpolationStrategy" = 'GOMPERTZ_VAGUE'::"StrategieInterpolation"
WHERE "interpolationStrategy" = 'GOMPERTZ_BAC'::"StrategieInterpolation";

-- Étape 3 — Rename l'ancien enum
ALTER TYPE "StrategieInterpolation" RENAME TO "StrategieInterpolation__old__";

-- Étape 4 — Créer le nouveau enum sans GOMPERTZ_BAC
CREATE TYPE "StrategieInterpolation" AS ENUM ('LINEAIRE', 'GOMPERTZ_VAGUE');

-- Étape 5 — DROP le DEFAULT, ALTER la colonne, restaurer le DEFAULT
ALTER TABLE "ConfigElevage"
  ALTER COLUMN "interpolationStrategy" DROP DEFAULT;

ALTER TABLE "ConfigElevage"
  ALTER COLUMN "interpolationStrategy" TYPE "StrategieInterpolation"
  USING "interpolationStrategy"::text::"StrategieInterpolation";

ALTER TABLE "ConfigElevage"
  ALTER COLUMN "interpolationStrategy" SET DEFAULT 'LINEAIRE'::"StrategieInterpolation";

-- Étape 6 — DROP l'ancien enum
DROP TYPE "StrategieInterpolation__old__";
