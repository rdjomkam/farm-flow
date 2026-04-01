-- Migration B: Remove vagueId column from ListeBesoins (replaced by ListeBesoinsVague junction table)
-- ADR-besoins-multi-vague: Step 2 of 2

-- DropForeignKey
ALTER TABLE "ListeBesoins" DROP CONSTRAINT "ListeBesoins_vagueId_fkey";

-- DropIndex
DROP INDEX "ListeBesoins_vagueId_idx";

-- AlterTable
ALTER TABLE "ListeBesoins" DROP COLUMN "vagueId";
