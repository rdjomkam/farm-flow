-- CreateTable
CREATE TABLE "GompertzVague" (
    "id" TEXT NOT NULL,
    "vagueId" TEXT NOT NULL,
    "wInfinity" DOUBLE PRECISION NOT NULL,
    "k" DOUBLE PRECISION NOT NULL,
    "ti" DOUBLE PRECISION NOT NULL,
    "r2" DOUBLE PRECISION NOT NULL,
    "rmse" DOUBLE PRECISION NOT NULL,
    "biometrieCount" INTEGER NOT NULL,
    "confidenceLevel" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GompertzVague_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GompertzVague_vagueId_key" ON "GompertzVague"("vagueId");

-- CreateIndex
CREATE INDEX "GompertzVague_siteId_idx" ON "GompertzVague"("siteId");

-- CreateIndex
CREATE INDEX "GompertzVague_vagueId_idx" ON "GompertzVague"("vagueId");

-- AddForeignKey
ALTER TABLE "GompertzVague" ADD CONSTRAINT "GompertzVague_vagueId_fkey" FOREIGN KEY ("vagueId") REFERENCES "Vague"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GompertzVague" ADD CONSTRAINT "GompertzVague_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
