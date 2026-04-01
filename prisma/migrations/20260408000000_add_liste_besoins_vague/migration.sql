-- Migration A: Create ListeBesoinsVague junction table and backfill from existing vagueId
-- ADR-besoins-multi-vague: Step 1 of 2

-- CreateTable
CREATE TABLE "ListeBesoinsVague" (
    "id" TEXT NOT NULL,
    "listeBesoinsId" TEXT NOT NULL,
    "vagueId" TEXT NOT NULL,
    "ratio" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "siteId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ListeBesoinsVague_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ListeBesoinsVague_vagueId_idx" ON "ListeBesoinsVague"("vagueId");

-- CreateIndex
CREATE INDEX "ListeBesoinsVague_siteId_idx" ON "ListeBesoinsVague"("siteId");

-- CreateIndex
CREATE UNIQUE INDEX "ListeBesoinsVague_listeBesoinsId_vagueId_key" ON "ListeBesoinsVague"("listeBesoinsId", "vagueId");

-- AddForeignKey
ALTER TABLE "ListeBesoinsVague" ADD CONSTRAINT "ListeBesoinsVague_listeBesoinsId_fkey" FOREIGN KEY ("listeBesoinsId") REFERENCES "ListeBesoins"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListeBesoinsVague" ADD CONSTRAINT "ListeBesoinsVague_vagueId_fkey" FOREIGN KEY ("vagueId") REFERENCES "Vague"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: for each ListeBesoins with vagueId IS NOT NULL, insert a row with ratio = 1.0
INSERT INTO "ListeBesoinsVague" ("id", "listeBesoinsId", "vagueId", "ratio", "siteId", "createdAt")
SELECT
    gen_random_uuid()::text,
    lb."id",
    lb."vagueId",
    1.0,
    lb."siteId",
    NOW()
FROM "ListeBesoins" lb
WHERE lb."vagueId" IS NOT NULL;
