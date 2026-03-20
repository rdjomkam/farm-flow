-- Migration: 20260326160000_add_quality_declencheur_types
-- Ajoute 4 nouvelles valeurs a l'enum TypeDeclencheur :
--   SEUIL_AMMONIAC, SEUIL_OXYGENE, SEUIL_PH, SEUIL_TEMPERATURE
-- Utilise le pattern RECREATE (rename old → create new → cast → drop old)
-- car PostgreSQL ne permet pas DROP VALUE sur un enum.

-- 1. Renommer l'ancien type
ALTER TYPE "TypeDeclencheur" RENAME TO "TypeDeclencheur_old";

-- 2. Creer le nouveau type avec toutes les valeurs
CREATE TYPE "TypeDeclencheur" AS ENUM (
  'CALENDRIER',
  'RECURRENT',
  'SEUIL_POIDS',
  'SEUIL_QUALITE',
  'SEUIL_MORTALITE',
  'STOCK_BAS',
  'FCR_ELEVE',
  'JALON',
  'SEUIL_DENSITE',
  'SEUIL_RENOUVELLEMENT',
  'ABSENCE_RELEVE',
  'SEUIL_AMMONIAC',
  'SEUIL_OXYGENE',
  'SEUIL_PH',
  'SEUIL_TEMPERATURE'
);

-- 3. Migrer les colonnes qui utilisent l'ancien type
ALTER TABLE "RegleActivite"
  ALTER COLUMN "typeDeclencheur"
  TYPE "TypeDeclencheur"
  USING "typeDeclencheur"::text::"TypeDeclencheur";

ALTER TABLE "ConditionRegle"
  ALTER COLUMN "typeDeclencheur"
  TYPE "TypeDeclencheur"
  USING "typeDeclencheur"::text::"TypeDeclencheur";

-- 4. Supprimer l'ancien type
DROP TYPE "TypeDeclencheur_old";
