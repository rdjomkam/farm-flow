-- DropForeignKey
ALTER TABLE "Abonnement" DROP CONSTRAINT "Abonnement_siteId_fkey";

-- DropForeignKey
ALTER TABLE "PaiementAbonnement" DROP CONSTRAINT "PaiementAbonnement_siteId_fkey";

-- AddForeignKey
ALTER TABLE "Abonnement" ADD CONSTRAINT "Abonnement_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaiementAbonnement" ADD CONSTRAINT "PaiementAbonnement_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE SET NULL ON UPDATE CASCADE;
