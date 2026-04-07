-- Migration R1-S2 (2/3) — TypeReleve : ajout TRI
-- Strategie : RECREATE (ERR-001) — rename old → create new → cast → drop old
-- Aucune ligne ne porte TRI (inexistant), CAST safe.

-- 1. Renommer l'ancien type
ALTER TYPE "TypeReleve" RENAME TO "TypeReleve_old";

-- 2. Creer le nouveau type avec toutes les valeurs (MAJUSCULES R1)
CREATE TYPE "TypeReleve" AS ENUM (
  'BIOMETRIE',
  'MORTALITE',
  'ALIMENTATION',
  'QUALITE_EAU',
  'COMPTAGE',
  'OBSERVATION',
  'RENOUVELLEMENT',
  'TRI'
);

-- 3. Caster la colonne vers le nouveau type
ALTER TABLE "Releve"
  ALTER COLUMN "typeReleve" TYPE "TypeReleve"
  USING "typeReleve"::text::"TypeReleve";

-- 4. Supprimer l'ancien type
DROP TYPE "TypeReleve_old";
