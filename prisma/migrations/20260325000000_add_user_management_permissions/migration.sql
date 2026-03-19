-- User Management Module — Sprint 26
-- 1. Extend Permission enum with 6 new user management values (RECREATE strategy)
-- 2. Add originalUserId to Session for impersonation support

-- ──────────────────────────────────────────
-- 1. Extend enum Permission (RECREATE approach)
-- ──────────────────────────────────────────

ALTER TYPE "Permission" RENAME TO "Permission_old";
CREATE TYPE "Permission" AS ENUM (
  'SITE_GERER',
  'MEMBRES_GERER',
  'VAGUES_VOIR',
  'VAGUES_CREER',
  'VAGUES_MODIFIER',
  'BACS_GERER',
  'BACS_MODIFIER',
  'RELEVES_VOIR',
  'RELEVES_CREER',
  'RELEVES_MODIFIER',
  'STOCK_VOIR',
  'STOCK_GERER',
  'APPROVISIONNEMENT_VOIR',
  'APPROVISIONNEMENT_GERER',
  'CLIENTS_VOIR',
  'CLIENTS_GERER',
  'VENTES_VOIR',
  'VENTES_CREER',
  'FACTURES_VOIR',
  'FACTURES_GERER',
  'PAIEMENTS_CREER',
  'ALEVINS_VOIR',
  'ALEVINS_GERER',
  'ALEVINS_CREER',
  'ALEVINS_MODIFIER',
  'ALEVINS_SUPPRIMER',
  'PLANNING_VOIR',
  'PLANNING_GERER',
  'FINANCES_VOIR',
  'FINANCES_GERER',
  'DASHBOARD_VOIR',
  'ALERTES_VOIR',
  'EXPORT_DONNEES',
  'ALERTES_CONFIGURER',
  'DEPENSES_VOIR',
  'DEPENSES_CREER',
  'DEPENSES_PAYER',
  'BESOINS_SOUMETTRE',
  'BESOINS_APPROUVER',
  'BESOINS_TRAITER',
  'GERER_PACKS',
  'ACTIVER_PACKS',
  'GERER_CONFIG_ELEVAGE',
  'REGLES_ACTIVITES_VOIR',
  'GERER_REGLES_ACTIVITES',
  'MONITORING_CLIENTS',
  'ENVOYER_NOTES',
  'CALIBRAGES_VOIR',
  'CALIBRAGES_CREER',
  'CALIBRAGES_MODIFIER',
  'GERER_REGLES_GLOBALES',
  'UTILISATEURS_VOIR',
  'UTILISATEURS_CREER',
  'UTILISATEURS_MODIFIER',
  'UTILISATEURS_SUPPRIMER',
  'UTILISATEURS_GERER',
  'UTILISATEURS_IMPERSONNER'
);
ALTER TABLE "SiteRole" ALTER COLUMN "permissions" TYPE "Permission"[] USING "permissions"::text[]::"Permission"[];
DROP TYPE "Permission_old";

-- ──────────────────────────────────────────
-- 2. Add originalUserId to Session (impersonation)
-- ──────────────────────────────────────────

ALTER TABLE "Session" ADD COLUMN "originalUserId" TEXT;

ALTER TABLE "Session" ADD CONSTRAINT "Session_originalUserId_fkey"
  FOREIGN KEY ("originalUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Session_originalUserId_idx" ON "Session"("originalUserId");
