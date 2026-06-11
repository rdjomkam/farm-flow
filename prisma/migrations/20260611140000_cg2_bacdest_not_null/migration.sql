-- CG.2 — bacDestId NOT NULL on TransfertGroupe
-- Prerequisites:
--   * CG.5 audit confirmed 0 NULL in prod (no orphan)
--   * Application-layer validation already enforces non-null since commit 9749145

-- DropForeignKey
ALTER TABLE "TransfertGroupe" DROP CONSTRAINT "TransfertGroupe_bacDestId_fkey";

-- AlterTable
ALTER TABLE "TransfertGroupe" ALTER COLUMN "bacDestId" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "TransfertGroupe" ADD CONSTRAINT "TransfertGroupe_bacDestId_fkey" FOREIGN KEY ("bacDestId") REFERENCES "Bac"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
