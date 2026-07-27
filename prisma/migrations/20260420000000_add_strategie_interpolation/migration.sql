-- Migration: add_strategie_interpolation
-- ADR-029 — Stratégie d'interpolation configurable pour ConfigElevage
-- Non-destructive: toutes les lignes existantes obtiennent LINEAIRE par défaut.
--
-- Tolérant à l'ordre : le nom de dossier de cette migration (20260420...)
-- la place, lexicographiquement, APRÈS 20260406000000_remove_strategie_interpolation
-- — alors que l'ordre réel d'application est l'inverse (cette migration,
-- ADR-029, a été appliquée en premier chronologiquement ; ADR-034 l'a
-- ensuite intégralement défaite). schema.prisma ne porte aujourd'hui plus
-- aucune trace de "interpolationStrategy"/"StrategieInterpolation" : l'état
-- cible final est l'ABSENCE de cette colonne/cet enum. Sur une base vierge,
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

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'StrategieInterpolation') THEN
      CREATE TYPE "StrategieInterpolation" AS ENUM ('LINEAIRE', 'GOMPERTZ_VAGUE');
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'ConfigElevage' AND column_name = 'interpolationStrategy'
    ) THEN
      ALTER TABLE "ConfigElevage"
        ADD COLUMN "interpolationStrategy" "StrategieInterpolation" NOT NULL DEFAULT 'LINEAIRE';
    END IF;

  END IF;
END $$;

-- AlterTable: add listeBesoinsId to Commande (schema drift sync)
ALTER TABLE "Commande"
  ADD COLUMN "listeBesoinsId" TEXT;

-- CreateIndex
CREATE INDEX "Commande_listeBesoinsId_idx" ON "Commande"("listeBesoinsId");

-- AddForeignKey
ALTER TABLE "Commande"
  ADD CONSTRAINT "Commande_listeBesoinsId_fkey"
  FOREIGN KEY ("listeBesoinsId") REFERENCES "ListeBesoins"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
