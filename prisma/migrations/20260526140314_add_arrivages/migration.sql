-- AlterEnum
ALTER TYPE "TypeReleve" ADD VALUE 'ARRIVAGE';

-- AlterTable
ALTER TABLE "Releve" ADD COLUMN     "arrivageId" TEXT;

-- CreateTable
CREATE TABLE "Arrivage" (
    "id" TEXT NOT NULL,
    "vagueId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "origine" TEXT,
    "notes" TEXT,
    "userId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "modifie" BOOLEAN NOT NULL DEFAULT false,
    "snapshotAvant" JSONB,
    "snapshotAvantModif" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Arrivage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArrivageGroupe" (
    "id" TEXT NOT NULL,
    "arrivageId" TEXT NOT NULL,
    "destinationBacId" TEXT NOT NULL,
    "nombrePoissons" INTEGER NOT NULL,
    "poidsMoyen" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ArrivageGroupe_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArrivageModification" (
    "id" TEXT NOT NULL,
    "arrivageId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "raison" TEXT NOT NULL,
    "snapshotAvant" JSONB NOT NULL,
    "snapshotApres" JSONB NOT NULL,
    "siteId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ArrivageModification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Arrivage_vagueId_idx" ON "Arrivage"("vagueId");

-- CreateIndex
CREATE INDEX "Arrivage_siteId_idx" ON "Arrivage"("siteId");

-- CreateIndex
CREATE INDEX "Arrivage_userId_idx" ON "Arrivage"("userId");

-- CreateIndex
CREATE INDEX "ArrivageGroupe_arrivageId_idx" ON "ArrivageGroupe"("arrivageId");

-- CreateIndex
CREATE INDEX "ArrivageGroupe_destinationBacId_idx" ON "ArrivageGroupe"("destinationBacId");

-- CreateIndex
CREATE INDEX "ArrivageModification_arrivageId_idx" ON "ArrivageModification"("arrivageId");

-- CreateIndex
CREATE INDEX "ArrivageModification_userId_idx" ON "ArrivageModification"("userId");

-- CreateIndex
CREATE INDEX "ArrivageModification_siteId_idx" ON "ArrivageModification"("siteId");

-- CreateIndex
CREATE INDEX "Releve_arrivageId_idx" ON "Releve"("arrivageId");

-- AddForeignKey
ALTER TABLE "Releve" ADD CONSTRAINT "Releve_arrivageId_fkey" FOREIGN KEY ("arrivageId") REFERENCES "Arrivage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Arrivage" ADD CONSTRAINT "Arrivage_vagueId_fkey" FOREIGN KEY ("vagueId") REFERENCES "Vague"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Arrivage" ADD CONSTRAINT "Arrivage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Arrivage" ADD CONSTRAINT "Arrivage_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArrivageGroupe" ADD CONSTRAINT "ArrivageGroupe_arrivageId_fkey" FOREIGN KEY ("arrivageId") REFERENCES "Arrivage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArrivageGroupe" ADD CONSTRAINT "ArrivageGroupe_destinationBacId_fkey" FOREIGN KEY ("destinationBacId") REFERENCES "Bac"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArrivageModification" ADD CONSTRAINT "ArrivageModification_arrivageId_fkey" FOREIGN KEY ("arrivageId") REFERENCES "Arrivage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArrivageModification" ADD CONSTRAINT "ArrivageModification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArrivageModification" ADD CONSTRAINT "ArrivageModification_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

