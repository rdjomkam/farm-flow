-- Migration R1-S2 (1/3) — StatutReproducteur : ajout EN_REPOS et SACRIFIE
-- Strategie : RECREATE (ERR-001) — rename old → create new → cast → drop old
-- Aucune ligne ne porte EN_REPOS ni SACRIFIE (inexistants), CAST safe.
-- Note : la colonne statut a un DEFAULT 'ACTIF' qui doit etre drop/re-cree.
-- Note : si StatutReproducteur_old existe deja, cela signifie que le RENAME
--        et CREATE ont deja eu lieu — on saute ces etapes et on fait le CAST.

DO $$
BEGIN
  -- Verifier si le type original existe encore (pas encore renomme)
  IF EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'StatutReproducteur'
    AND NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'StatutReproducteur_old')
  ) THEN
    -- 1. Supprimer le DEFAULT avant le CAST
    ALTER TABLE "Reproducteur" ALTER COLUMN "statut" DROP DEFAULT;
    -- 2. Renommer l'ancien type
    ALTER TYPE "StatutReproducteur" RENAME TO "StatutReproducteur_old";
    -- 3. Creer le nouveau type
    CREATE TYPE "StatutReproducteur" AS ENUM (
      'ACTIF', 'EN_REPOS', 'REFORME', 'SACRIFIE', 'MORT'
    );
  END IF;
END $$;

-- 4. Caster la colonne vers le nouveau type (fonctionne depuis _old ou new)
ALTER TABLE "Reproducteur"
  ALTER COLUMN "statut" TYPE "StatutReproducteur"
  USING "statut"::text::"StatutReproducteur";

-- 5. Remettre le DEFAULT avec le nouveau type
ALTER TABLE "Reproducteur" ALTER COLUMN "statut" SET DEFAULT 'ACTIF'::"StatutReproducteur";

-- 6. Supprimer l'ancien type
DROP TYPE IF EXISTS "StatutReproducteur_old";
