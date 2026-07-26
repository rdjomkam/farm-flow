
-- CreateEnum
CREATE TYPE "ContexteDetectionEcart" AS ENUM ('ARRIVAGE', 'TRANSFERT', 'CALIBRAGE', 'VENTE', 'VENTE_ALEVINS', 'BON_LIVRAISON', 'INDETERMINE');

-- CreateTable
CREATE TABLE "EcartAssignationConstate" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "bacId" TEXT NOT NULL,
    "vagueId" TEXT NOT NULL,
    "ecart" INTEGER NOT NULL,
    "premiereDetectionLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "derniereDetectionLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dernierContexte" "ContexteDetectionEcart" NOT NULL DEFAULT 'INDETERMINE',
    "dernierActorId" TEXT,
    "resoluLe" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EcartAssignationConstate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EcartAssignationConstate_bacId_key" ON "EcartAssignationConstate"("bacId");

-- CreateIndex
CREATE INDEX "EcartAssignationConstate_siteId_ecart_idx" ON "EcartAssignationConstate"("siteId", "ecart");

-- CreateIndex
CREATE INDEX "EcartAssignationConstate_vagueId_idx" ON "EcartAssignationConstate"("vagueId");

-- AddForeignKey
ALTER TABLE "EcartAssignationConstate" ADD CONSTRAINT "EcartAssignationConstate_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EcartAssignationConstate" ADD CONSTRAINT "EcartAssignationConstate_bacId_fkey" FOREIGN KEY ("bacId") REFERENCES "Bac"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EcartAssignationConstate" ADD CONSTRAINT "EcartAssignationConstate_vagueId_fkey" FOREIGN KEY ("vagueId") REFERENCES "Vague"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EcartAssignationConstate" ADD CONSTRAINT "EcartAssignationConstate_dernierActorId_fkey" FOREIGN KEY ("dernierActorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

