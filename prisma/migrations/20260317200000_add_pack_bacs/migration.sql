-- CreateTable
CREATE TABLE "PackBac" (
    "id" TEXT NOT NULL,
    "packId" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "volume" DOUBLE PRECISION,
    "nombreAlevins" INTEGER NOT NULL,
    "poidsMoyenInitial" DOUBLE PRECISION NOT NULL DEFAULT 5,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PackBac_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PackBac_packId_idx" ON "PackBac"("packId");

-- CreateIndex
CREATE UNIQUE INDEX "PackBac_packId_nom_key" ON "PackBac"("packId", "nom");

-- AddForeignKey
ALTER TABLE "PackBac" ADD CONSTRAINT "PackBac_packId_fkey" FOREIGN KEY ("packId") REFERENCES "Pack"("id") ON DELETE CASCADE ON UPDATE CASCADE;
