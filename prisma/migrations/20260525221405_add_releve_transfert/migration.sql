-- AlterEnum
ALTER TYPE "TypeReleve" ADD VALUE 'TRANSFERT';

-- AlterTable
ALTER TABLE "Releve" ADD COLUMN "nombreTransferes" INTEGER,
ADD COLUMN "transfertGroupeId" TEXT;

-- AddForeignKey
ALTER TABLE "Releve" ADD CONSTRAINT "Releve_transfertGroupeId_fkey" FOREIGN KEY ("transfertGroupeId") REFERENCES "TransfertGroupe"("id") ON DELETE SET NULL ON UPDATE CASCADE;
