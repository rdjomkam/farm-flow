-- Sprint 52 — Rendre siteId nullable sur Abonnement et PaiementAbonnement
-- L'abonnement est désormais au niveau user, pas au niveau site.
-- La FK reste présente pour les abonnements existants ; les nouveaux n'auront pas de siteId.

-- AlterTable Abonnement : siteId String NOT NULL → String? (nullable)
ALTER TABLE "Abonnement" ALTER COLUMN "siteId" DROP NOT NULL;

-- AlterTable PaiementAbonnement : siteId String NOT NULL → String? (nullable)
ALTER TABLE "PaiementAbonnement" ALTER COLUMN "siteId" DROP NOT NULL;
