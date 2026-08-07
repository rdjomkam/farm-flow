-- AlterTable
ALTER TABLE "ScenarioPrevision" ADD COLUMN     "scenarioParentId" TEXT;

-- CreateIndex
CREATE INDEX "ScenarioPrevision_scenarioParentId_idx" ON "ScenarioPrevision"("scenarioParentId");

-- AddForeignKey
ALTER TABLE "ScenarioPrevision" ADD CONSTRAINT "ScenarioPrevision_scenarioParentId_fkey" FOREIGN KEY ("scenarioParentId") REFERENCES "ScenarioPrevision"("id") ON DELETE SET NULL ON UPDATE CASCADE;
