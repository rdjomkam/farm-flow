-- CreateTable
CREATE TABLE "AjustementDepense" (
    "id" TEXT NOT NULL,
    "depenseId" TEXT NOT NULL,
    "montantAvant" DOUBLE PRECISION NOT NULL,
    "montantApres" DOUBLE PRECISION NOT NULL,
    "raison" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AjustementDepense_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AjustementDepense_depenseId_idx" ON "AjustementDepense"("depenseId");

-- CreateIndex
CREATE INDEX "AjustementDepense_siteId_idx" ON "AjustementDepense"("siteId");

-- AddForeignKey
ALTER TABLE "AjustementDepense" ADD CONSTRAINT "AjustementDepense_depenseId_fkey" FOREIGN KEY ("depenseId") REFERENCES "Depense"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AjustementDepense" ADD CONSTRAINT "AjustementDepense_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AjustementDepense" ADD CONSTRAINT "AjustementDepense_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
