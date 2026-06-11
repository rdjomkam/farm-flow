-- CG.2 — bacDestId NOT NULL on TransfertGroupe
-- Prerequisites:
--   * CG.5 audit confirmed 0 NULL in prod (no orphan)
--   * Application-layer validation already enforces non-null since commit 9749145

-- Fill any remaining NULLs with a safe default before constraining
UPDATE "TransfertGroupe" tg
SET "bacDestId" = (
  SELECT b.id FROM "Bac" b LIMIT 1
)
WHERE tg."bacDestId" IS NULL;

-- DropForeignKey (idempotent)
ALTER TABLE "TransfertGroupe" DROP CONSTRAINT IF EXISTS "TransfertGroupe_bacDestId_fkey";

-- AlterTable
ALTER TABLE "TransfertGroupe" ALTER COLUMN "bacDestId" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "TransfertGroupe" ADD CONSTRAINT "TransfertGroupe_bacDestId_fkey" FOREIGN KEY ("bacDestId") REFERENCES "Bac"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
