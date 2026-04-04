-- AlterTable
ALTER TABLE "Commande" ADD COLUMN "listeBesoinsId" TEXT;

-- CreateIndex
CREATE INDEX "Commande_listeBesoinsId_idx" ON "Commande"("listeBesoinsId");

-- AddForeignKey
ALTER TABLE "Commande" ADD CONSTRAINT "Commande_listeBesoinsId_fkey" FOREIGN KEY ("listeBesoinsId") REFERENCES "ListeBesoins"("id") ON DELETE SET NULL ON UPDATE CASCADE;
