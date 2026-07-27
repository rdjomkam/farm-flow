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
--
-- Tolérant à l'ordre : le nom de dossier de cette migration (20260405...)
-- la place, lexicographiquement, AVANT 20260420000000_add_strategie_interpolation
-- et 20260421000000_add_gompertz_bac — alors que l'ordre réel d'application
-- (chronologie des commits, cf. docs/bugs/BUG-CI-migration-order.md) est
-- l'inverse : ADR-029/030 (ajout) puis ADR-032 (cette migration) puis
-- ADR-034 (suppression totale). Sur une base vierge, "ConfigElevage"."interpolationStrategy"
-- n'existe donc pas encore à ce stade — toutes les étapes 2 à 6 sont
-- conditionnées à son existence et deviennent un no-op silencieux dans ce
-- cas (l'état final correct — colonne/enum/table absents — est alors déjà
-- atteint : 20260420000000_add_strategie_interpolation et
-- 20260421000000_add_gompertz_bac se neutralisent eux-mêmes une fois cette
-- migration détectée comme déjà appliquée, voir leur propre garde).

-- Étape 1 — DROP TABLE GompertzBac (déjà tolérant : IF EXISTS)
DROP TABLE IF EXISTS "GompertzBac";

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'ConfigElevage' AND column_name = 'interpolationStrategy'
  ) THEN

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

  END IF;
END $$;
