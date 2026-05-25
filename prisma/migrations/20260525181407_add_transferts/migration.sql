-- CreateTable
CREATE TABLE "Transfert" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Transfert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransfertGroupe" (
    "id" TEXT NOT NULL,
    "transfertId" TEXT NOT NULL,
    "vagueSourceId" TEXT NOT NULL,
    "bacSourceId" TEXT,
    "vagueDestId" TEXT NOT NULL,
    "bacDestId" TEXT,
    "nombrePoissons" INTEGER NOT NULL,
    "poidsMoyenG" DOUBLE PRECISION NOT NULL,
    "nombreMorts" INTEGER NOT NULL DEFAULT 0,
    "snapshotAvantModif" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TransfertGroupe_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransfertModification" (
    "id" TEXT NOT NULL,
    "transfertGroupeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "raison" TEXT NOT NULL,
    "snapshotAvant" JSONB NOT NULL,
    "snapshotApres" JSONB NOT NULL,
    "siteId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TransfertModification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Transfert_siteId_idx" ON "Transfert"("siteId");

-- CreateIndex
CREATE INDEX "TransfertGroupe_vagueSourceId_idx" ON "TransfertGroupe"("vagueSourceId");

-- CreateIndex
CREATE INDEX "TransfertGroupe_vagueDestId_idx" ON "TransfertGroupe"("vagueDestId");

-- CreateIndex
CREATE INDEX "TransfertGroupe_transfertId_idx" ON "TransfertGroupe"("transfertId");

-- CreateIndex
CREATE INDEX "TransfertModification_transfertGroupeId_idx" ON "TransfertModification"("transfertGroupeId");

-- CreateIndex
CREATE INDEX "TransfertModification_userId_idx" ON "TransfertModification"("userId");

-- CreateIndex
CREATE INDEX "TransfertModification_siteId_idx" ON "TransfertModification"("siteId");

-- AddForeignKey
ALTER TABLE "Transfert" ADD CONSTRAINT "Transfert_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transfert" ADD CONSTRAINT "Transfert_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransfertGroupe" ADD CONSTRAINT "TransfertGroupe_transfertId_fkey" FOREIGN KEY ("transfertId") REFERENCES "Transfert"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransfertGroupe" ADD CONSTRAINT "TransfertGroupe_vagueSourceId_fkey" FOREIGN KEY ("vagueSourceId") REFERENCES "Vague"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransfertGroupe" ADD CONSTRAINT "TransfertGroupe_bacSourceId_fkey" FOREIGN KEY ("bacSourceId") REFERENCES "Bac"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransfertGroupe" ADD CONSTRAINT "TransfertGroupe_vagueDestId_fkey" FOREIGN KEY ("vagueDestId") REFERENCES "Vague"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransfertGroupe" ADD CONSTRAINT "TransfertGroupe_bacDestId_fkey" FOREIGN KEY ("bacDestId") REFERENCES "Bac"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransfertModification" ADD CONSTRAINT "TransfertModification_transfertGroupeId_fkey" FOREIGN KEY ("transfertGroupeId") REFERENCES "TransfertGroupe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransfertModification" ADD CONSTRAINT "TransfertModification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransfertModification" ADD CONSTRAINT "TransfertModification_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

