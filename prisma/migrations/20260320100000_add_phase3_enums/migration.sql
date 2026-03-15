-- Migration Sprint 20 — Phase 3 Enums: Packs & Provisioning
-- Adds: INGENIEUR role, 6 new permissions, TRI/MEDICATION activities, StatutActivation enum

-- ──────────────────────────────────────────
-- 1. Extend enum Role with INGENIEUR
-- ──────────────────────────────────────────
-- Must drop DEFAULT first, then recreate enum, then restore DEFAULT

ALTER TABLE "User" ALTER COLUMN "role" DROP DEFAULT;
ALTER TYPE "Role" RENAME TO "Role_old";
CREATE TYPE "Role" AS ENUM ('ADMIN', 'GERANT', 'PISCICULTEUR', 'INGENIEUR');
ALTER TABLE "User" ALTER COLUMN "role" TYPE "Role" USING "role"::text::"Role";
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'PISCICULTEUR'::"Role";
DROP TYPE "Role_old";

-- ──────────────────────────────────────────
-- 2. Extend enum Permission with 6 new values
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
  'GERER_REGLES_ACTIVITES',
  'MONITORING_CLIENTS',
  'ENVOYER_NOTES'
);
ALTER TABLE "SiteRole" ALTER COLUMN "permissions" TYPE "Permission"[] USING "permissions"::text[]::"Permission"[];
DROP TYPE "Permission_old";

-- ──────────────────────────────────────────
-- 3. Extend enum TypeActivite with TRI and MEDICATION
-- ──────────────────────────────────────────

ALTER TYPE "TypeActivite" RENAME TO "TypeActivite_old";
CREATE TYPE "TypeActivite" AS ENUM ('ALIMENTATION', 'BIOMETRIE', 'QUALITE_EAU', 'COMPTAGE', 'NETTOYAGE', 'TRAITEMENT', 'RECOLTE', 'TRI', 'MEDICATION', 'AUTRE');
ALTER TABLE "Activite" ALTER COLUMN "typeActivite" TYPE "TypeActivite" USING "typeActivite"::text::"TypeActivite";
DROP TYPE "TypeActivite_old";

-- ──────────────────────────────────────────
-- 4. Create new enum StatutActivation
-- ──────────────────────────────────────────

CREATE TYPE "StatutActivation" AS ENUM ('ACTIVE', 'EXPIREE', 'SUSPENDUE');
