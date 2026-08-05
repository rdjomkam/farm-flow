
-- AlterTable
ALTER TABLE "ClotureMois" ADD COLUMN     "versionMapping" INTEGER NOT NULL;

-- CreateTable
CREATE TABLE "SnapshotBudgetInitial" (
    "id" TEXT NOT NULL,
    "scenarioId" TEXT NOT NULL,
    "moisAbsolu" INTEGER NOT NULL,
    "posteId" TEXT,
    "categorie" TEXT NOT NULL,
    "montantFCFA" DECIMAL(65,30) NOT NULL,
    "siteId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SnapshotBudgetInitial_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SnapshotBudgetInitial_siteId_scenarioId_idx" ON "SnapshotBudgetInitial"("siteId", "scenarioId");

-- CreateIndex
CREATE UNIQUE INDEX "SnapshotBudgetInitial_scenarioId_moisAbsolu_posteId_categor_key" ON "SnapshotBudgetInitial"("scenarioId", "moisAbsolu", "posteId", "categorie");

-- AddForeignKey
ALTER TABLE "SnapshotBudgetInitial" ADD CONSTRAINT "SnapshotBudgetInitial_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "ScenarioPrevision"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SnapshotBudgetInitial" ADD CONSTRAINT "SnapshotBudgetInitial_posteId_fkey" FOREIGN KEY ("posteId") REFERENCES "PostePrevision"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SnapshotBudgetInitial" ADD CONSTRAINT "SnapshotBudgetInitial_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

