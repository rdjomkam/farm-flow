-- Add unit conversion fields to Produit (uniteAchat + contenance)

-- 1. Add columns first (before touching enum)
ALTER TABLE "Produit" ADD COLUMN "uniteAchat" TEXT;
ALTER TABLE "Produit" ADD COLUMN "contenance" DOUBLE PRECISION;

-- 2. Recreate enum with new values (GRAMME, MILLILITRE)
ALTER TYPE "UniteStock" RENAME TO "UniteStock_old";
CREATE TYPE "UniteStock" AS ENUM ('GRAMME', 'KG', 'MILLILITRE', 'LITRE', 'UNITE', 'SACS');

-- 3. Cast existing unite column to new enum type
ALTER TABLE "Produit" ALTER COLUMN "unite" TYPE "UniteStock" USING "unite"::text::"UniteStock";

-- 4. Cast new uniteAchat column to new enum type
ALTER TABLE "Produit" ALTER COLUMN "uniteAchat" TYPE "UniteStock" USING "uniteAchat"::text::"UniteStock";

-- 5. Drop old enum
DROP TYPE "UniteStock_old";
