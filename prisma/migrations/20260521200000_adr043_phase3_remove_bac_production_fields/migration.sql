-- ADR-043 Phase 3: Remove production fields from Bac model
-- Bac = physical tank only. AssignationBac = single source of truth for production data.

-- DropForeignKey
ALTER TABLE "Bac" DROP CONSTRAINT IF EXISTS "Bac_vagueId_fkey";

-- DropIndex
DROP INDEX IF EXISTS "Bac_vagueId_idx";

-- AlterTable
ALTER TABLE "Bac" DROP COLUMN IF EXISTS "nombrePoissons",
DROP COLUMN IF EXISTS "nombreInitial",
DROP COLUMN IF EXISTS "poidsMoyenInitial",
DROP COLUMN IF EXISTS "vagueId";
