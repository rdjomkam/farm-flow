-- AlterEnum
ALTER TYPE "TypePlan" ADD VALUE 'EXONERATION';

-- AlterTable
ALTER TABLE "Abonnement" ADD COLUMN     "downgradePeriode" "PeriodeFacturation",
ADD COLUMN     "downgradeRessourcesAGarder" JSONB,
ADD COLUMN     "downgradeVersId" TEXT,
ADD COLUMN     "dureeEssaiJours" INTEGER,
ADD COLUMN     "isEssai" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "motifExoneration" TEXT,
ADD COLUMN     "prochainePeriode" "PeriodeFacturation";

-- AlterTable
ALTER TABLE "Bac" ADD COLUMN     "isBlocked" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "PlanAbonnement" ADD COLUMN     "dureeEssaiJours" INTEGER;

-- AlterTable
ALTER TABLE "Site" ADD COLUMN     "isBlocked" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "ownerId" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "soldeCredit" DECIMAL(65,30) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Vague" ADD COLUMN     "isBlocked" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "EssaiUtilise" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "typePlan" "TypePlan" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EssaiUtilise_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AbonnementAudit" (
    "id" TEXT NOT NULL,
    "abonnementId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "metadata" JSONB,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AbonnementAudit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EssaiUtilise_userId_idx" ON "EssaiUtilise"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "EssaiUtilise_userId_typePlan_key" ON "EssaiUtilise"("userId", "typePlan");

-- CreateIndex
CREATE INDEX "AbonnementAudit_abonnementId_idx" ON "AbonnementAudit"("abonnementId");

-- CreateIndex
CREATE INDEX "AbonnementAudit_userId_idx" ON "AbonnementAudit"("userId");

-- CreateIndex
CREATE INDEX "AbonnementAudit_createdAt_idx" ON "AbonnementAudit"("createdAt");

-- CreateIndex
CREATE INDEX "Abonnement_downgradeVersId_idx" ON "Abonnement"("downgradeVersId");

-- CreateIndex
CREATE INDEX "Site_ownerId_idx" ON "Site"("ownerId");

-- AddForeignKey
ALTER TABLE "Site" ADD CONSTRAINT "Site_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Abonnement" ADD CONSTRAINT "Abonnement_downgradeVersId_fkey" FOREIGN KEY ("downgradeVersId") REFERENCES "PlanAbonnement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EssaiUtilise" ADD CONSTRAINT "EssaiUtilise_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AbonnementAudit" ADD CONSTRAINT "AbonnementAudit_abonnementId_fkey" FOREIGN KEY ("abonnementId") REFERENCES "Abonnement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AbonnementAudit" ADD CONSTRAINT "AbonnementAudit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
