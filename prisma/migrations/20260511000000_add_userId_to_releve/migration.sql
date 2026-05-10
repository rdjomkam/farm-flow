-- AlterTable
ALTER TABLE "Releve" ADD COLUMN "userId" TEXT;

-- AddForeignKey
ALTER TABLE "Releve" ADD CONSTRAINT "Releve_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "Releve_userId_idx" ON "Releve"("userId");
