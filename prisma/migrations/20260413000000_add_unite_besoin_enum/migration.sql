-- Migration: add_unite_besoin_enum
-- ADR-025 — LigneBesoin.unite : remplacement du texte libre par un enum étendu
-- Strategy: CREATE new enum type, normalize data, ALTER COLUMN to use enum

-- 1. Créer le nouveau type enum UniteBesoin
CREATE TYPE "UniteBesoin" AS ENUM (
  'GRAMME', 'KG', 'MILLILITRE', 'LITRE',
  'UNITE', 'SACS', 'FLACONS', 'BOITES', 'ROULEAUX', 'METRES'
);

-- 2. Normaliser les données existantes avant conversion (lowercase → UPPERCASE)
UPDATE "LigneBesoin" SET "unite" = 'KG'       WHERE lower("unite") = 'kg';
UPDATE "LigneBesoin" SET "unite" = 'FLACONS'  WHERE lower("unite") = 'flacons';
UPDATE "LigneBesoin" SET "unite" = 'ROULEAUX' WHERE lower("unite") = 'rouleaux';
UPDATE "LigneBesoin" SET "unite" = 'METRES'   WHERE lower("unite") = 'metres';
UPDATE "LigneBesoin" SET "unite" = 'BOITES'   WHERE lower("unite") = 'boites';
UPDATE "LigneBesoin" SET "unite" = 'GRAMME'   WHERE lower("unite") = 'gramme';
UPDATE "LigneBesoin" SET "unite" = 'MILLILITRE' WHERE lower("unite") = 'millilitre';
UPDATE "LigneBesoin" SET "unite" = 'LITRE'    WHERE lower("unite") = 'litre';
UPDATE "LigneBesoin" SET "unite" = 'UNITE'    WHERE lower("unite") = 'unite';
UPDATE "LigneBesoin" SET "unite" = 'SACS'     WHERE lower("unite") = 'sacs';

-- 3. Toute valeur non mappée devient NULL (sécurité — R7)
UPDATE "LigneBesoin"
SET "unite" = NULL
WHERE "unite" IS NOT NULL
  AND "unite" NOT IN (
    'GRAMME', 'KG', 'MILLILITRE', 'LITRE', 'UNITE', 'SACS',
    'FLACONS', 'BOITES', 'ROULEAUX', 'METRES'
  );

-- 4. Changer le type de colonne TEXT → UniteBesoin (avec USING cast)
ALTER TABLE "LigneBesoin"
  ALTER COLUMN "unite" TYPE "UniteBesoin"
  USING "unite"::"UniteBesoin";
