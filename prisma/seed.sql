-- Seed data for Suivi Silures — Farm Flow
-- Run: docker exec -i silures-db psql -U dkfarm -d farm-flow < prisma/seed.sql

BEGIN;

-- Nettoyage (ordre respecte les FK — du plus dependant au moins dependant)
DELETE FROM "Session";
DELETE FROM "CalibrageGroupe";
DELETE FROM "Calibrage";
DELETE FROM "NoteIngenieur";
DELETE FROM "Activite";
DELETE FROM "Notification";
DELETE FROM "ConfigAlerte";
DELETE FROM "FraisPaiementDepense";
DELETE FROM "AjustementDepense";
DELETE FROM "PaiementDepense";
DELETE FROM "LigneBesoin";
DELETE FROM "DepenseRecurrente";
DELETE FROM "Depense";
DELETE FROM "ListeBesoinsVague";
DELETE FROM "ListeBesoins";
DELETE FROM "Paiement";
DELETE FROM "Facture";
DELETE FROM "Vente";
DELETE FROM "Client";
DELETE FROM "ReleveConsommation";
DELETE FROM "LigneCommande";
DELETE FROM "MouvementStock";
DELETE FROM "Commande";
-- PackProduit et PackBac avant Pack (FK CASCADE sur Pack)
DELETE FROM "PackActivation";
DELETE FROM "PackBac";
DELETE FROM "PackProduit";
DELETE FROM "Pack";
-- ConfigElevage apres Pack (Pack FK ConfigElevage)
DELETE FROM "ConfigElevage";
DELETE FROM "Produit";
DELETE FROM "Fournisseur";
DELETE FROM "LotAlevins";
DELETE FROM "Ponte";
DELETE FROM "Reproducteur";
DELETE FROM "Releve";
DELETE FROM "Bac";
DELETE FROM "Vague";
DELETE FROM "SiteMember";
DELETE FROM "SiteRole";
DELETE FROM "RegleActivite";
-- Sprint 30 — Abonnements (ordre FK : du plus dependant au moins dependant)
DELETE FROM "RetraitPortefeuille";
DELETE FROM "PortefeuilleIngenieur";
DELETE FROM "CommissionIngenieur";
DELETE FROM "RemiseApplication";
DELETE FROM "PaiementAbonnement";
-- Story 45.2 — AbonnementAudit + EssaiUtilise avant Abonnement (FK abonnementId / pas de FK)
DELETE FROM "AbonnementAudit";
DELETE FROM "EssaiUtilise";
DELETE FROM "Abonnement";
DELETE FROM "Remise";
DELETE FROM "PlanAbonnement";
-- ADR-021 — SiteAuditLog avant Site (FK siteId)
DELETE FROM "SiteAuditLog";
DELETE FROM "Site";
-- ADR-maintenance-mode — PlatformAuditLog a FK actorId -> User
DELETE FROM "PlatformAuditLog";
DELETE FROM "User";
-- ADR-021 — ModuleDefinition (registre global, pas de FK)
DELETE FROM "ModuleDefinition";

-- ──────────────────────────────────────────
-- Users (3 : admin + gerant + system user)
-- ──────────────────────────────────────────
-- Le system user (isSystem=true) est utilise pour les entites auto-generees lors du provisioning
-- Son passwordHash est un hash impossible a utiliser pour se connecter

INSERT INTO "User" (id, email, phone, name, "passwordHash", role, "isActive", "isSystem", "createdAt", "updatedAt")
VALUES
  ('user_admin', 'admin@dkfarm.cm', '+237699000000', 'Administrateur', '$2b$10$VHWKPywPuVh/szJsFgpiyu3wrTZ00kNz9nBy91QF9FB5WZBdXQUOC', 'ADMIN', true, false, NOW(), NOW()),
  ('user_gerant', 'gerant@dkfarm.cm', '+237677000000', 'Jean Kamga', '$2b$10$VHWKPywPuVh/szJsFgpiyu3wrTZ00kNz9nBy91QF9FB5WZBdXQUOC', 'GERANT', true, false, NOW(), NOW()),
  -- Ingenieur DKFarm — suit les clients et envoie des notes de monitoring
  ('user_ingenieur', 'ingenieur@dkfarm.cm', '+237666000001', 'Paul Nkomo', '$2b$10$VHWKPywPuVh/szJsFgpiyu3wrTZ00kNz9nBy91QF9FB5WZBdXQUOC', 'INGENIEUR', true, false, NOW(), NOW()),
  -- Client gerant de son propre site (site_client_01) — provisionne via Pack
  ('user_client_01', 'client01@ferme.cm', '+237655000001', 'Marcel Essomba', '$2b$10$VHWKPywPuVh/szJsFgpiyu3wrTZ00kNz9nBy91QF9FB5WZBdXQUOC', 'GERANT', true, false, NOW(), NOW()),
  -- FarmFlow System user — utilise pour les entites auto-generees (provisioning, moteur activites)
  ('system_dkfarm', NULL, NULL, 'FarmFlow System', '$2b$10$SYSTEM_USER_CANNOT_LOGIN_HASH_PLACEHOLDER_XXXX', 'PISCICULTEUR', true, true, NOW(), NOW());

-- ──────────────────────────────────────────
-- Sites (site_01 = DKFarm, site_client_01 = ferme client)
-- ──────────────────────────────────────────

INSERT INTO "Site" (id, name, address, "isActive", supervised, "enabledModules", "ownerId", "createdAt", "updatedAt")
VALUES
  ('site_01', 'Ferme Douala', 'Douala, Littoral, Cameroun', true, false, '{}', 'user_admin', NOW(), NOW()),
  -- Site client cree lors du provisioning d'un Pack (Sprint 20) — supervised avec modules limites
  ('site_client_01', 'Ferme Essomba', 'Yaoundé, Centre, Cameroun', true, true, '{GROSSISSEMENT,ANALYSE_PILOTAGE,NOTES}', 'user_client_01', NOW(), NOW());

-- ADR-022: Mark platform admin as super admin
UPDATE "User" SET "isSuperAdmin" = true WHERE id = 'user_admin';

-- ──────────────────────────────────────────
-- SiteRole (3 roles systeme pour site_01, 1 pour site_client_01)
-- ──────────────────────────────────────────

INSERT INTO "SiteRole" (id, name, description, permissions, "isSystem", "siteId", "createdAt", "updatedAt")
VALUES
  (
    'sr_admin_site_01',
    'Administrateur',
    'Acces complet au site — non supprimable',
    ARRAY[
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
      'RELEVES_SUPPRIMER',
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
      'DEPENSES_MODIFIER',
      'DEPENSES_PAYER',
      'DEPENSES_SUPPRIMER',
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
      'UTILISATEURS_IMPERSONNER',
      'ABONNEMENTS_VOIR',
      'ABONNEMENTS_GERER',
      'PLANS_GERER',
      'REMISES_GERER',
      'COMMISSIONS_VOIR',
      'COMMISSIONS_GERER',
      'COMMISSION_PREMIUM',
      'PORTEFEUILLE_VOIR',
      'PORTEFEUILLE_GERER'
    ]::"Permission"[],
    true,
    'site_01',
    NOW(),
    NOW()
  ),
  (
    'sr_gerant_site_01',
    'Gerant',
    'Acces operationnel — sans gestion site ni membres — non supprimable',
    ARRAY[
      'VAGUES_VOIR',
      'VAGUES_CREER',
      'VAGUES_MODIFIER',
      'BACS_GERER',
      'BACS_MODIFIER',
      'RELEVES_VOIR',
      'RELEVES_CREER',
      'RELEVES_MODIFIER',
      'RELEVES_SUPPRIMER',
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
      'DEPENSES_MODIFIER',
      'DEPENSES_PAYER',
      'DEPENSES_SUPPRIMER',
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
      'ABONNEMENTS_VOIR',
      'ABONNEMENTS_GERER',
      'PLANS_GERER',
      'REMISES_GERER',
      'COMMISSIONS_VOIR',
      'COMMISSIONS_GERER',
      'COMMISSION_PREMIUM',
      'PORTEFEUILLE_VOIR',
      'PORTEFEUILLE_GERER'
    ]::"Permission"[],
    true,
    'site_01',
    NOW(),
    NOW()
  ),
  (
    'sr_pisci_site_01',
    'Pisciculteur',
    'Acces terrain — lecture vagues, saisie releves — non supprimable',
    ARRAY[
      'VAGUES_VOIR',
      'RELEVES_VOIR',
      'RELEVES_CREER',
      'BACS_GERER',
      'DASHBOARD_VOIR',
      'ALERTES_VOIR',
      'CALIBRAGES_VOIR',
      'REGLES_ACTIVITES_VOIR'
    ]::"Permission"[],
    true,
    'site_01',
    NOW(),
    NOW()
  ),
  -- SiteRoles pour le site client (Sprint 25 — admin role pour le client provisionne)
  (
    'sr_admin_client_01',
    'Administrateur',
    'Acces complet au site — role assigne au client lors du provisioning',
    ARRAY[
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
      'RELEVES_SUPPRIMER',
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
      'DEPENSES_MODIFIER',
      'DEPENSES_PAYER',
      'DEPENSES_SUPPRIMER',
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
      'UTILISATEURS_VOIR',
      'UTILISATEURS_CREER',
      'UTILISATEURS_MODIFIER',
      'UTILISATEURS_SUPPRIMER',
      'UTILISATEURS_GERER',
      'CALIBRAGES_MODIFIER',
      'ABONNEMENTS_VOIR',
      'ABONNEMENTS_GERER',
      'PLANS_GERER',
      'REMISES_GERER',
      'COMMISSIONS_VOIR',
      'COMMISSIONS_GERER',
      'COMMISSION_PREMIUM',
      'PORTEFEUILLE_VOIR',
      'PORTEFEUILLE_GERER'
    ]::"Permission"[],
    true,
    'site_client_01',
    NOW(),
    NOW()
  ),
  (
    'sr_pisci_client_01',
    'Pisciculteur',
    'Acces terrain — lecture vagues, saisie releves — non supprimable',
    ARRAY[
      'VAGUES_VOIR',
      'RELEVES_VOIR',
      'RELEVES_CREER',
      'BACS_GERER',
      'DASHBOARD_VOIR',
      'ALERTES_VOIR',
      'CALIBRAGES_VOIR',
      'REGLES_ACTIVITES_VOIR'
    ]::"Permission"[],
    true,
    'site_client_01',
    NOW(),
    NOW()
  );

-- ──────────────────────────────────────────
-- SiteMember (admin + gerant sur site_01, ingenieur sur site_01, client sur site_client_01)
-- Utilise siteRoleId au lieu de role + permissions
-- ──────────────────────────────────────────

INSERT INTO "SiteMember" (id, "userId", "siteId", "siteRoleId", "isActive", "createdAt", "updatedAt")
VALUES
  ('sm_01', 'user_admin',      'site_01',        'sr_admin_site_01',   true, NOW(), NOW()),
  ('sm_02', 'user_gerant',     'site_01',        'sr_gerant_site_01',  true, NOW(), NOW()),
  ('sm_03', 'user_ingenieur',  'site_01',        'sr_admin_site_01',   true, NOW(), NOW()),
  ('sm_04', 'user_client_01',  'site_client_01', 'sr_admin_client_01', true, NOW(), NOW());

-- ──────────────────────────────────────────
-- Vagues (2 : en cours + terminee)
-- ──────────────────────────────────────────

INSERT INTO "Vague" (id, code, "dateDebut", "dateFin", "nombreInitial", "poidsMoyenInitial", "origineAlevins", statut, "siteId", "createdAt", "updatedAt")
VALUES
  ('vague_01', 'VAGUE-2026-01', '2026-01-15', NULL, 500, 8.5, 'Ecloserie Douala', 'EN_COURS', 'site_01', NOW(), NOW()),
  ('vague_02', 'VAGUE-2025-03', '2025-10-01', '2025-12-22', 300, 6.0, 'Ferme Mbalmayo', 'TERMINEE', 'site_01', NOW(), NOW());

-- Vague client (site_client_01) — sera liée à PackActivation pa_01 après son INSERT
INSERT INTO "Vague" (id, code, "dateDebut", "dateFin", "nombreInitial", "poidsMoyenInitial", "origineAlevins", statut, "siteId", "createdAt", "updatedAt")
VALUES
  ('vague_client_01', 'VAGUE-CLI-2026-01', '2026-02-15', NULL, 100, 5.0, 'Pack Decouverte 100', 'EN_COURS', 'site_client_01', NOW(), NOW());

-- ──────────────────────────────────────────
-- Bacs (3 pour vague en cours, 1 pour vague terminee)
-- ──────────────────────────────────────────

INSERT INTO "Bac" (id, nom, volume, "nombrePoissons", "vagueId", "siteId", "createdAt", "updatedAt")
VALUES
  ('bac_01', 'Bac 1', 2000, 170, 'vague_01', 'site_01', NOW(), NOW()),
  ('bac_02', 'Bac 2', 2000, 165, 'vague_01', 'site_01', NOW(), NOW()),
  ('bac_03', 'Bac 3', 1500, 155, 'vague_01', 'site_01', NOW(), NOW()),
  ('bac_04', 'Etang A', 5000, NULL, 'vague_02', 'site_01', NOW(), NOW());

-- ──────────────────────────────────────────
-- AssignationBac — ADR-043 (Phase 2)
-- bac_01, bac_02, bac_03 : actifs dans vague_01 (EN_COURS)
-- bac_04 : terminé dans vague_02 (TERMINEE, clôturée le 2025-12-22)
-- ──────────────────────────────────────────

INSERT INTO "AssignationBac" (id, "bacId", "vagueId", "siteId", "dateAssignation", "dateFin", "nombrePoissonsInitial", "poidsMoyenInitial", "nombrePoissons", "createdAt", "updatedAt")
VALUES
  ('asn_01', 'bac_01', 'vague_01', 'site_01', '2026-01-15', NULL, 170, 8.5, 170, NOW(), NOW()),
  ('asn_02', 'bac_02', 'vague_01', 'site_01', '2026-01-15', NULL, 165, 8.5, 165, NOW(), NOW()),
  ('asn_03', 'bac_03', 'vague_01', 'site_01', '2026-01-15', NULL, 155, 8.5, 155, NOW(), NOW()),
  ('asn_04', 'bac_04', 'vague_02', 'site_01', '2025-10-01', '2025-12-22', 300, 6.0, NULL, NOW(), NOW());

-- ──────────────────────────────────────────
-- Releves — 20 releves varies sur 2 mois
-- ──────────────────────────────────────────

-- Biometries (3)
INSERT INTO "Releve" (id, date, "typeReleve", "vagueId", "bacId", "siteId", "poidsMoyen", "tailleMoyenne", "echantillonCount", notes, "createdAt", "updatedAt")
VALUES
  ('rel_01', '2026-01-22', 'BIOMETRIE', 'vague_01', 'bac_01', 'site_01', 12.3, 8.5, 30, 'Premiere biometrie apres mise en charge', NOW(), NOW()),
  ('rel_02', '2026-02-05', 'BIOMETRIE', 'vague_01', 'bac_02', 'site_01', 28.7, 13.2, 25, NULL, NOW(), NOW()),
  ('rel_03', '2026-02-19', 'BIOMETRIE', 'vague_01', 'bac_01', 'site_01', 55.4, 18.6, 30, 'Bonne croissance, lot homogene', NOW(), NOW());

-- Mortalites (3)
INSERT INTO "Releve" (id, date, "typeReleve", "vagueId", "bacId", "siteId", "nombreMorts", "causeMortalite", notes, "createdAt", "updatedAt")
VALUES
  ('rel_04', '2026-01-18', 'MORTALITE', 'vague_01', 'bac_01', 'site_01', 5, 'STRESS', 'Mortalite post-transport, normale', NOW(), NOW()),
  ('rel_05', '2026-01-25', 'MORTALITE', 'vague_01', 'bac_03', 'site_01', 3, 'INCONNUE', NULL, NOW(), NOW()),
  ('rel_06', '2026-02-10', 'MORTALITE', 'vague_01', 'bac_02', 'site_01', 2, 'QUALITE_EAU', 'Pic ammoniac detecte la veille', NOW(), NOW());

-- Alimentation (4)
INSERT INTO "Releve" (id, date, "typeReleve", "vagueId", "bacId", "siteId", "typeAliment", "quantiteAliment", "frequenceAliment", notes, "createdAt", "updatedAt")
VALUES
  ('rel_07', '2026-01-20', 'ALIMENTATION', 'vague_01', 'bac_01', 'site_01', 'COMMERCIAL', 0.5, 3, NULL, NOW(), NOW()),
  ('rel_08', '2026-01-20', 'ALIMENTATION', 'vague_01', 'bac_02', 'site_01', 'COMMERCIAL', 0.5, 3, NULL, NOW(), NOW()),
  ('rel_09', '2026-02-05', 'ALIMENTATION', 'vague_01', 'bac_01', 'site_01', 'MIXTE', 1.2, 2, 'Transition vers aliment artisanal', NOW(), NOW()),
  ('rel_10', '2026-02-15', 'ALIMENTATION', 'vague_01', 'bac_03', 'site_01', 'ARTISANAL', 1.8, 2, NULL, NOW(), NOW());

-- Qualite eau (3)
INSERT INTO "Releve" (id, date, "typeReleve", "vagueId", "bacId", "siteId", temperature, ph, oxygene, ammoniac, notes, "createdAt", "updatedAt")
VALUES
  ('rel_11', '2026-01-22', 'QUALITE_EAU', 'vague_01', 'bac_01', 'site_01', 27.5, 7.2, 5.8, 0.02, NULL, NOW(), NOW()),
  ('rel_12', '2026-02-09', 'QUALITE_EAU', 'vague_01', 'bac_02', 'site_01', 28.1, 6.9, 4.5, 0.15, 'Ammoniac eleve — renouvellement eau effectue', NOW(), NOW()),
  ('rel_13', '2026-02-20', 'QUALITE_EAU', 'vague_01', 'bac_03', 'site_01', 26.8, 7.4, 6.2, 0.01, NULL, NOW(), NOW());

-- Comptages (2)
INSERT INTO "Releve" (id, date, "typeReleve", "vagueId", "bacId", "siteId", "nombreCompte", "methodeComptage", notes, "createdAt", "updatedAt")
VALUES
  ('rel_14', '2026-02-01', 'COMPTAGE', 'vague_01', 'bac_01', 'site_01', 168, 'DIRECT', 'Comptage lors du nettoyage', NOW(), NOW()),
  ('rel_15', '2026-02-15', 'COMPTAGE', 'vague_01', 'bac_03', 'site_01', 152, 'ESTIMATION', NULL, NOW(), NOW());

-- Observations (2)
INSERT INTO "Releve" (id, date, "typeReleve", "vagueId", "bacId", "siteId", description, "createdAt", "updatedAt")
VALUES
  ('rel_16', '2026-01-28', 'OBSERVATION', 'vague_01', 'bac_02', 'site_01', 'Comportement alimentaire actif, les poissons montent bien a la surface. Pas de signe de stress.', NOW(), NOW()),
  ('rel_17', '2026-02-12', 'OBSERVATION', 'vague_01', 'bac_01', 'site_01', 'Quelques poissons avec des taches blanches sur la peau. Surveiller pour eventuelle maladie fongique.', NOW(), NOW());

-- Releves vague terminee (3)
INSERT INTO "Releve" (id, date, "typeReleve", "vagueId", "bacId", "siteId", "poidsMoyen", "tailleMoyenne", "echantillonCount", notes, "createdAt", "updatedAt")
VALUES
  ('rel_18', '2025-10-15', 'BIOMETRIE', 'vague_02', 'bac_04', 'site_01', 45.0, 16.0, 20, NULL, NOW(), NOW()),
  ('rel_19', '2025-11-15', 'BIOMETRIE', 'vague_02', 'bac_04', 'site_01', 180.0, 28.5, 20, 'Croissance excellente dans etang', NOW(), NOW());

INSERT INTO "Releve" (id, date, "typeReleve", "vagueId", "bacId", "siteId", "nombreCompte", "methodeComptage", notes, "createdAt", "updatedAt")
VALUES
  ('rel_20', '2025-12-20', 'COMPTAGE', 'vague_02', 'bac_04', 'site_01', 265, 'ECHANTILLONNAGE', 'Comptage final avant recolte — taux de survie 88%', NOW(), NOW());

-- ──────────────────────────────────────────
-- Fournisseurs (3)
-- ──────────────────────────────────────────

INSERT INTO "Fournisseur" (id, nom, telephone, email, adresse, "isActive", "siteId", "createdAt", "updatedAt")
VALUES
  ('fourn_01', 'Aliments Douala SARL', '+237699100100', 'contact@alimentsdouala.cm', 'Zone Industrielle Bassa, Douala', true, 'site_01', NOW(), NOW()),
  ('fourn_02', 'AquaVet Cameroun', '+237677200200', 'info@aquavet.cm', 'Bonanjo, Douala', true, 'site_01', NOW(), NOW()),
  ('fourn_03', 'Equipement Piscicole SA', '+237699300300', NULL, 'Yaounde, Centre', true, 'site_01', NOW(), NOW());

-- ──────────────────────────────────────────
-- Produits (6 : 3 aliments, 2 intrants, 1 equipement)
-- ──────────────────────────────────────────

INSERT INTO "Produit" (id, nom, categorie, unite, "uniteAchat", contenance, "prixUnitaire", "stockActuel", "seuilAlerte", "fournisseurId", "isActive", "siteId", "createdAt", "updatedAt")
VALUES
  ('prod_01', 'Aliment Croissance 3mm', 'ALIMENT', 'KG', NULL, NULL, 850, 120.0, 50.0, 'fourn_01', true, 'site_01', NOW(), NOW()),
  ('prod_02', 'Aliment Demarrage 1mm', 'ALIMENT', 'KG', NULL, NULL, 1200, 25.0, 20.0, 'fourn_01', true, 'site_01', NOW(), NOW()),
  ('prod_03', 'Farine de poisson', 'ALIMENT', 'KG', 'SACS', 25, 15000, 200.0, 125.0, 'fourn_01', true, 'site_01', NOW(), NOW()),
  ('prod_04', 'Sulfate de cuivre', 'INTRANT', 'KG', NULL, NULL, 3500, 2.5, 1.0, 'fourn_02', true, 'site_01', NOW(), NOW()),
  ('prod_05', 'Sel non iode', 'INTRANT', 'KG', NULL, NULL, 200, 50.0, 20.0, 'fourn_02', true, 'site_01', NOW(), NOW()),
  ('prod_06', 'Epuisette 40cm', 'EQUIPEMENT', 'UNITE', NULL, NULL, 8500, 3.0, 2.0, 'fourn_03', true, 'site_01', NOW(), NOW());

-- ──────────────────────────────────────────
-- Commandes (2 : 1 livree, 1 envoyee)
-- ──────────────────────────────────────────

INSERT INTO "Commande" (id, numero, "fournisseurId", statut, "dateCommande", "dateLivraison", "montantTotal", "factureUrl", "userId", "siteId", "createdAt", "updatedAt")
VALUES
  ('cmd_01', 'CMD-2026-001', 'fourn_01', 'LIVREE', '2026-01-10', '2026-01-14', 157500, 'https://storage.hetzner.com/dkfarm-dev/factures/cmd_01/1736870400000-facture-CMD-2026-001.pdf', 'user_admin', 'site_01', NOW(), NOW()),
  ('cmd_02', 'CMD-2026-002', 'fourn_02', 'ENVOYEE', '2026-02-20', NULL, 11250, NULL, 'user_gerant', 'site_01', NOW(), NOW());

-- ──────────────────────────────────────────
-- LignesCommande (4 lignes sur 2 commandes)
-- ──────────────────────────────────────────

INSERT INTO "LigneCommande" (id, "commandeId", "produitId", quantite, "prixUnitaire", "createdAt")
VALUES
  ('lc_01', 'cmd_01', 'prod_01', 150.0, 850, NOW()),
  ('lc_02', 'cmd_01', 'prod_03', 2.0, 15000, NOW()),
  ('lc_03', 'cmd_02', 'prod_04', 2.5, 3500, NOW()),
  ('lc_04', 'cmd_02', 'prod_05', 10.0, 200, NOW());

-- ──────────────────────────────────────────
-- MouvementsStock (8 : entrees livraison + sorties consommation)
-- ──────────────────────────────────────────

INSERT INTO "MouvementStock" (id, "produitId", type, quantite, "prixTotal", "vagueId", "commandeId", "releveId", "userId", date, notes, "siteId", "createdAt")
VALUES
  -- Entrees de la commande 1 livree
  ('mvt_01', 'prod_01', 'ENTREE', 150.0, 127500, NULL, 'cmd_01', NULL, 'user_admin', '2026-01-14', 'Reception commande CMD-2026-001', 'site_01', NOW()),
  ('mvt_02', 'prod_03', 'ENTREE', 2.0, 30000, NULL, 'cmd_01', NULL, 'user_admin', '2026-01-14', 'Reception commande CMD-2026-001', 'site_01', NOW()),
  -- Sorties alimentation vague 01 — liees aux releves ALIMENTATION
  ('mvt_03', 'prod_01', 'SORTIE', 15.0, NULL, 'vague_01', NULL, 'rel_07', 'user_gerant', '2026-01-20', 'Alimentation semaine 1 — via releve', 'site_01', NOW()),
  ('mvt_04', 'prod_01', 'SORTIE', 15.0, NULL, 'vague_01', NULL, 'rel_09', 'user_gerant', '2026-02-05', 'Alimentation semaine 3 — via releve', 'site_01', NOW()),
  -- Sortie intrant traitement — liee au releve QUALITE_EAU
  ('mvt_05', 'prod_04', 'SORTIE', 0.5, NULL, 'vague_01', NULL, 'rel_12', 'user_gerant', '2026-02-11', 'Traitement bac 2 apres pic ammoniac — via releve', 'site_01', NOW()),
  -- Entree achat direct (sans commande, sans releve)
  ('mvt_06', 'prod_05', 'ENTREE', 25.0, 5000, NULL, NULL, NULL, 'user_admin', '2026-01-18', 'Achat marche local', 'site_01', NOW()),
  -- Sortie sel — liee au releve MORTALITE (traitement preventif)
  ('mvt_07', 'prod_05', 'SORTIE', 5.0, NULL, 'vague_01', NULL, 'rel_04', 'user_gerant', '2026-01-19', 'Bain de sel preventif post-transport — via releve', 'site_01', NOW()),
  -- Sortie aliment demarrage (sans releve — mouvement manuel)
  ('mvt_08', 'prod_02', 'SORTIE', 5.0, NULL, 'vague_01', NULL, NULL, 'user_gerant', '2026-01-16', 'Premiere alimentation alevins', 'site_01', NOW());

-- ──────────────────────────────────────────
-- ReleveConsommation (5 : consommations produits liees aux releves)
-- ──────────────────────────────────────────

INSERT INTO "ReleveConsommation" (id, "releveId", "produitId", quantite, "siteId", "createdAt")
VALUES
  -- Releve ALIMENTATION rel_07 (bac_01, 2026-01-20) -> Aliment Croissance 3mm
  ('rc_01', 'rel_07', 'prod_01', 7.5, 'site_01', NOW()),
  ('rc_02', 'rel_07', 'prod_02', 2.0, 'site_01', NOW()),
  -- Releve ALIMENTATION rel_09 (bac_01, 2026-02-05) -> Aliment Croissance + Farine
  ('rc_03', 'rel_09', 'prod_01', 10.0, 'site_01', NOW()),
  ('rc_04', 'rel_09', 'prod_03', 0.5, 'site_01', NOW()),
  -- Releve QUALITE_EAU rel_12 (bac_02, 2026-02-09) -> Sulfate de cuivre (traitement)
  ('rc_05', 'rel_12', 'prod_04', 0.5, 'site_01', NOW());

-- ──────────────────────────────────────────
-- Clients (3 : restaurateur, poissonniere, grossiste)
-- ──────────────────────────────────────────

INSERT INTO "Client" (id, nom, telephone, email, adresse, "isActive", "siteId", "createdAt", "updatedAt")
VALUES
  ('client_01', 'Restaurant Le Mboa', '+237699400400', 'lemboa@email.cm', 'Akwa, Douala', true, 'site_01', NOW(), NOW()),
  ('client_02', 'Mme Ngono Marie', '+237677500500', NULL, 'Marche Central, Douala', true, 'site_01', NOW(), NOW()),
  ('client_03', 'Poissons du Littoral SARL', '+237699600600', 'contact@poissons-littoral.cm', 'Bonaberi, Douala', true, 'site_01', NOW(), NOW());

-- ──────────────────────────────────────────
-- Ventes (2 : 1 sur vague terminee, 1 sur vague en cours)
-- ──────────────────────────────────────────

INSERT INTO "Vente" (id, numero, "clientId", "vagueId", "quantitePoissons", "poidsTotalKg", "prixUnitaireKg", "montantTotal", notes, "siteId", "userId", "createdAt", "updatedAt")
VALUES
  ('vte_01', 'VTE-2025-001', 'client_01', 'vague_02', 100, 85.0, 2500, 212500, 'Vente lot recolte vague terminee', 'site_01', 'user_admin', NOW(), NOW()),
  ('vte_02', 'VTE-2026-001', 'client_03', 'vague_02', 50, 42.5, 2800, 119000, NULL, 'site_01', 'user_gerant', NOW(), NOW());

-- ──────────────────────────────────────────
-- Factures (2 : 1 PAYEE, 1 ENVOYEE)
-- ──────────────────────────────────────────

INSERT INTO "Facture" (id, numero, "venteId", statut, "dateEmission", "dateEcheance", "montantTotal", "montantPaye", notes, "siteId", "userId", "createdAt", "updatedAt")
VALUES
  ('fac_01', 'FAC-2025-001', 'vte_01', 'PAYEE', '2025-12-23', '2026-01-23', 212500, 212500, NULL, 'site_01', 'user_admin', NOW(), NOW()),
  ('fac_02', 'FAC-2026-001', 'vte_02', 'ENVOYEE', '2026-03-01', '2026-03-31', 119000, 50000, 'Paiement partiel recu', 'site_01', 'user_gerant', NOW(), NOW());

-- ──────────────────────────────────────────
-- Paiements (3 : 2 sur fac_01 = total, 1 partiel sur fac_02)
-- ──────────────────────────────────────────

INSERT INTO "Paiement" (id, "factureId", montant, mode, reference, date, "siteId", "userId", "createdAt")
VALUES
  ('pai_01', 'fac_01', 150000, 'MOBILE_MONEY', 'MTN-20251223-001', '2025-12-23', 'site_01', 'user_admin', NOW()),
  ('pai_02', 'fac_01', 62500, 'ESPECES', NULL, '2025-12-28', 'site_01', 'user_admin', NOW()),
  ('pai_03', 'fac_02', 50000, 'VIREMENT', 'VIR-20260305', '2026-03-05', 'site_01', 'user_gerant', NOW());

-- ──────────────────────────────────────────
-- Reproducteurs (4 : 2 femelles + 2 mâles)
-- ──────────────────────────────────────────

INSERT INTO "Reproducteur" (id, code, sexe, poids, age, origine, statut, "dateAcquisition", notes, "siteId", "createdAt", "updatedAt")
VALUES
  (
    'rep_01',
    'REP-F-001',
    'FEMELLE',
    1250.0,
    18,
    'Ecloserie Nationale Yaoundé',
    'ACTIF',
    '2024-09-01',
    'Femelle de bonne condition, pontes régulières',
    'site_01',
    NOW(),
    NOW()
  ),
  (
    'rep_02',
    'REP-F-002',
    'FEMELLE',
    980.0,
    14,
    'Ferme Mbalmayo',
    'ACTIF',
    '2025-01-15',
    NULL,
    'site_01',
    NOW(),
    NOW()
  ),
  (
    'rep_03',
    'REP-M-001',
    'MALE',
    1480.0,
    20,
    'Ecloserie Nationale Yaoundé',
    'ACTIF',
    '2024-09-01',
    'Male dominant, très actif',
    'site_01',
    NOW(),
    NOW()
  ),
  (
    'rep_04',
    'REP-M-002',
    'MALE',
    820.0,
    12,
    'Ferme Douala — stock interne',
    'REFORME',
    '2025-03-10',
    'Mis en retraite après blessure dorsale — observé mais non utilisé en reproduction',
    'site_01',
    NOW(),
    NOW()
  );

-- ──────────────────────────────────────────
-- Pontes (3 : 1 terminée avec succès, 1 en cours, 1 échouée)
-- ──────────────────────────────────────────

INSERT INTO "Ponte" (id, code, "femelleId", "maleId", "datePonte", "nombreOeufs", "tauxFecondation", statut, notes, "siteId", "createdAt", "updatedAt")
VALUES
  (
    'pon_01',
    'PON-2025-001',
    'rep_01',
    'rep_03',
    '2025-11-10',
    4500,
    82.5,
    'TERMINEE',
    'Ponte réussie — incubation en bac spécialisé — 3712 oeufs fécondés',
    'site_01',
    NOW(),
    NOW()
  ),
  (
    'pon_02',
    'PON-2026-001',
    'rep_02',
    'rep_03',
    '2026-02-20',
    3800,
    NULL,
    'EN_COURS',
    'Incubation démarrée le 20/02 — taux de fécondation en cours d''évaluation',
    'site_01',
    NOW(),
    NOW()
  ),
  (
    'pon_03',
    'PON-2025-002',
    'rep_01',
    NULL,
    '2025-08-05',
    2100,
    12.0,
    'ECHOUEE',
    'Ponte naturelle sans stimulation hormonale — taux de fécondation trop faible, lot abandonné',
    'site_01',
    NOW(),
    NOW()
  );

-- ──────────────────────────────────────────
-- Lots d'alevins (3 : 1 transféré en vague, 1 en élevage, 1 en incubation)
-- ──────────────────────────────────────────

INSERT INTO "LotAlevins" (id, code, "ponteId", "nombreInitial", "nombreActuel", "ageJours", "poidsMoyen", statut, "bacId", "vagueDestinationId", "dateTransfert", notes, "siteId", "createdAt", "updatedAt")
VALUES
  (
    'lot_01',
    'LOT-2025-001',
    'pon_01',
    3200,
    2850,
    120,
    8.2,
    'TRANSFERE',
    NULL,
    'vague_02',
    '2025-10-01',
    'Lot issu de PON-2025-001 — transféré dans VAGUE-2025-03 pour grossissement — 350 pertes en incubation',
    'site_01',
    NOW(),
    NOW()
  ),
  (
    'lot_02',
    'LOT-2026-001',
    'pon_02',
    3100,
    3020,
    18,
    0.15,
    'EN_ELEVAGE',
    'bac_03',
    NULL,
    NULL,
    'Alevins issus de PON-2026-001 — en phase post-larvaire dans bac_03',
    'site_01',
    NOW(),
    NOW()
  ),
  (
    'lot_03',
    'LOT-2026-002',
    'pon_02',
    650,
    598,
    18,
    NULL,
    'EN_INCUBATION',
    NULL,
    NULL,
    NULL,
    'Second lot issu de PON-2026-001 — encore en incubation dans bac dédié',
    'site_01',
    NOW(),
    NOW()
  );

-- ──────────────────────────────────────────
-- ConfigAlerte (4 : mortalite, stock bas, rappel alimentation, rappel biometrie)
-- ──────────────────────────────────────────

INSERT INTO "ConfigAlerte" (id, "typeAlerte", "seuilValeur", "seuilPourcentage", enabled, "userId", "siteId", "createdAt", "updatedAt")
VALUES
  -- Mortalite elevee : alerte si > 5 poissons morts OU > 3% de taux de mortalite
  ('ca_01', 'MORTALITE_ELEVEE', 5.0, 3.0, true, 'user_admin', 'site_01', NOW(), NOW()),
  -- Stock bas : alerte si stock aliment < seuil (utilise seuilValeur en kg)
  ('ca_02', 'STOCK_BAS', 30.0, NULL, true, 'user_admin', 'site_01', NOW(), NOW()),
  -- Rappel alimentation : alerte si aucun releve alimentation depuis 2 jours
  ('ca_03', 'RAPPEL_ALIMENTATION', 2.0, NULL, true, 'user_gerant', 'site_01', NOW(), NOW()),
  -- Rappel biometrie : alerte si aucune biometrie depuis 14 jours
  ('ca_04', 'RAPPEL_BIOMETRIE', 14.0, NULL, true, 'user_gerant', 'site_01', NOW(), NOW());

-- ──────────────────────────────────────────
-- Notification (6 : mix de statuts et types)
-- ──────────────────────────────────────────

INSERT INTO "Notification" (id, "typeAlerte", titre, message, statut, lien, "userId", "siteId", "createdAt")
VALUES
  -- ACTIVE — mortalite elevee detectee
  (
    'notif_01',
    'MORTALITE_ELEVEE',
    'Mortalite elevee — Bac 2',
    'Un releve de mortalite enregistre 2 morts dans Bac 2 avec cause Qualite_eau. Verifiez les parametres eau.',
    'ACTIVE',
    '/vagues/vague_01',
    'user_admin',
    'site_01',
    NOW() - INTERVAL '2 hours'
  ),
  -- ACTIVE — stock bas aliment
  (
    'notif_02',
    'STOCK_BAS',
    'Stock bas — Aliment Croissance 3mm',
    'Le stock d''Aliment Croissance 3mm est a 25 kg, en dessous du seuil d''alerte de 50 kg.',
    'ACTIVE',
    '/stock',
    'user_admin',
    'site_01',
    NOW() - INTERVAL '1 day'
  ),
  -- ACTIVE — rappel biometrie
  (
    'notif_03',
    'RAPPEL_BIOMETRIE',
    'Rappel biometrie — Vague VAGUE-2026-01',
    'Aucune biometrie effectuee depuis 14 jours sur la vague VAGUE-2026-01. Une mesure est recommandee.',
    'ACTIVE',
    '/releves/nouveau',
    'user_gerant',
    'site_01',
    NOW() - INTERVAL '3 hours'
  ),
  -- LUE — qualite eau
  (
    'notif_04',
    'QUALITE_EAU',
    'Parametre eau anormal — Bac 2',
    'Le releve du 2026-02-09 indique un taux d''ammoniac a 0.15 mg/L (seuil recommande : 0.05). Traitement effectue.',
    'LUE',
    '/vagues/vague_01',
    'user_gerant',
    'site_01',
    '2026-02-09 14:30:00'
  ),
  -- TRAITEE — stock bas resolu
  (
    'notif_05',
    'STOCK_BAS',
    'Stock bas resolu — Sel non iode',
    'La commande CMD-2026-002 a permis de reapprovisionner le stock de Sel non iode. Seuil d''alerte depasse.',
    'TRAITEE',
    '/stock',
    'user_admin',
    'site_01',
    '2026-02-21 09:00:00'
  ),
  -- LUE — rappel alimentation
  (
    'notif_06',
    'RAPPEL_ALIMENTATION',
    'Rappel alimentation — Bac 3',
    'Aucun releve d''alimentation enregistre pour Bac 3 depuis 48 heures. Pensez a saisir la consommation.',
    'LUE',
    '/releves/nouveau',
    'user_gerant',
    'site_01',
    '2026-02-14 08:00:00'
  );

-- ──────────────────────────────────────────
-- Activite (6 : alimentation quotidienne, biometrie hebdo liee a rel_03,
--            nettoyage, traitement, recolte, alimentation terminee liee a rel_07)
-- ──────────────────────────────────────────

INSERT INTO "Activite" (id, titre, description, "typeActivite", statut, "dateDebut", "dateFin", recurrence, "vagueId", "bacId", "assigneAId", "userId", "siteId", "releveId", "dateTerminee", "noteCompletion", "createdAt", "updatedAt")
VALUES
  -- Alimentation quotidienne — recurrente — en cours (pas de releve lie)
  (
    'act_01',
    'Alimentation quotidienne — Vague 2026-01',
    'Distribution d''aliment commercial 3 fois par jour pour les 3 bacs de la vague en cours. Ration : 2% du poids corporel.',
    'ALIMENTATION',
    'PLANIFIEE',
    '2026-03-11 07:00:00',
    '2026-03-11 17:00:00',
    'QUOTIDIEN',
    'vague_01',
    NULL,
    'user_gerant',
    'user_admin',
    'site_01',
    NULL,
    NULL,
    NULL,
    NOW(),
    NOW()
  ),
  -- Biometrie hebdomadaire — terminee — liee au releve rel_03 (BIOMETRIE bac_01 2026-02-19)
  (
    'act_02',
    'Biometrie hebdomadaire — Bac 1',
    'Pesee et mesure sur echantillon de 30 poissons. Calculer taux de croissance specifique.',
    'BIOMETRIE',
    'TERMINEE',
    '2026-02-19 08:00:00',
    '2026-02-19 10:00:00',
    'HEBDOMADAIRE',
    'vague_01',
    'bac_01',
    'user_gerant',
    'user_admin',
    'site_01',
    'rel_03',
    '2026-02-19 10:30:00',
    NULL,
    '2026-02-18 15:00:00',
    '2026-02-19 10:30:00'
  ),
  -- Nettoyage bac — planifie (pas de releve lie — type NETTOYAGE non mappable)
  (
    'act_03',
    'Nettoyage et renouvellement eau — Bac 2',
    'Renouvellement 30% volume eau + nettoyage parois + retrait matieres organiques. Suite au pic ammoniac detecte.',
    'NETTOYAGE',
    'PLANIFIEE',
    '2026-03-12 06:00:00',
    '2026-03-12 09:00:00',
    NULL,
    'vague_01',
    'bac_02',
    'user_gerant',
    'user_admin',
    'site_01',
    NULL,
    NULL,
    NULL,
    NOW(),
    NOW()
  ),
  -- Traitement preventif — en retard (pas de releve lie — type TRAITEMENT non mappable)
  (
    'act_04',
    'Traitement preventif bain de sel — Bac 3',
    'Bain de sel (3g/L pendant 10 min) suite a observation de taches blanches sur certains poissons. Prevenir maladie fongique.',
    'TRAITEMENT',
    'EN_RETARD',
    '2026-03-10 07:00:00',
    '2026-03-10 08:00:00',
    NULL,
    'vague_01',
    'bac_03',
    'user_gerant',
    'user_admin',
    'site_01',
    NULL,
    NULL,
    NULL,
    '2026-03-09 16:00:00',
    '2026-03-11 09:00:00'
  ),
  -- Recolte planifiee — future (pas de releve lie — type RECOLTE non mappable)
  (
    'act_05',
    'Recolte partielle — Vague 2026-01',
    'Recolte prevue de 150 poissons pour le client Restaurant Le Mboa. Peche, pesee, conditionnement. Vente programmee.',
    'RECOLTE',
    'PLANIFIEE',
    '2026-04-15 06:00:00',
    '2026-04-15 12:00:00',
    NULL,
    'vague_01',
    NULL,
    'user_gerant',
    'user_admin',
    'site_01',
    NULL,
    NULL,
    NULL,
    NOW(),
    NOW()
  ),
  -- Alimentation du 2026-01-20 — TERMINEE — liee au releve rel_07 (ALIMENTATION bac_01 2026-01-20)
  (
    'act_06',
    'Alimentation journaliere — Bac 1 (2026-01-20)',
    'Distribution aliment commercial — premiere alimentation documentee de la vague. Releve saisi via rel_07.',
    'ALIMENTATION',
    'TERMINEE',
    '2026-01-20 07:00:00',
    '2026-01-20 17:00:00',
    NULL,
    'vague_01',
    'bac_01',
    'user_gerant',
    'user_admin',
    'site_01',
    'rel_07',
    '2026-01-20 17:30:00',
    NULL,
    '2026-01-19 16:00:00',
    '2026-01-20 17:30:00'
  );

-- ──────────────────────────────────────────────────────────────────────────────
-- Sprint 16 — Dépenses (5 dépenses + 4 paiements)
-- ──────────────────────────────────────────────────────────────────────────────

-- 5 dépenses variées (catégories et statuts différents)
INSERT INTO "Depense" (
  "id", "numero", "description", "categorieDepense",
  "montantTotal", "montantPaye", "statut",
  "date", "dateEcheance", "factureUrl", "notes",
  "commandeId", "vagueId", "userId", "siteId",
  "createdAt", "updatedAt"
) VALUES
  -- dep_01: ALIMENT — auto-créée depuis cmd_01 (PAYEE complète)
  (
    'dep_01', 'DEP-2026-001',
    'Commande CMD-2026-001',
    'ALIMENT',
    87500.0, 87500.0, 'PAYEE',
    '2026-02-01 00:00:00', NULL, NULL,
    'Aliment commercial Coppens — reçu avec commande',
    'cmd_01', NULL,
    'user_admin', 'site_01',
    NOW(), NOW()
  ),
  -- dep_02: ELECTRICITE — NON_PAYEE, avec écheance
  (
    'dep_02', 'DEP-2026-002',
    'Facture electricite — Fevrier 2026',
    'ELECTRICITE',
    45000.0, 0.0, 'NON_PAYEE',
    '2026-02-05 00:00:00', '2026-02-28 00:00:00', NULL,
    'Consommation des pompes et éclairage de la ferme',
    NULL, NULL,
    'user_admin', 'site_01',
    NOW(), NOW()
  ),
  -- dep_03: SALAIRE — PAYEE_PARTIELLEMENT
  (
    'dep_03', 'DEP-2026-003',
    'Salaire technicien — Mars 2026',
    'SALAIRE',
    120000.0, 60000.0, 'PAYEE_PARTIELLEMENT',
    '2026-03-01 00:00:00', '2026-03-31 00:00:00', NULL,
    'Paiement en deux tranches convenu avec le technicien',
    NULL, NULL,
    'user_admin', 'site_01',
    NOW(), NOW()
  ),
  -- dep_04: REPARATION — PAYEE_PARTIELLEMENT (50%), liée à vague_01
  (
    'dep_04', 'DEP-2026-004',
    'Reparation pompe bac 2 — Vague 2026-01',
    'REPARATION',
    25000.0, 12500.0, 'PAYEE_PARTIELLEMENT',
    '2026-02-15 00:00:00', '2026-03-15 00:00:00', NULL,
    'Remplacement joint et filtre',
    NULL, 'vague_01',
    'user_gerant', 'site_01',
    NOW(), NOW()
  ),
  -- dep_05: LOYER — PAYEE complète
  (
    'dep_05', 'DEP-2026-005',
    'Loyer terrain ferme — Fevrier 2026',
    'LOYER',
    80000.0, 80000.0, 'PAYEE',
    '2026-02-01 00:00:00', '2026-02-05 00:00:00', NULL,
    NULL,
    NULL, NULL,
    'user_admin', 'site_01',
    NOW(), NOW()
  );

-- 4 paiements dépense
INSERT INTO "PaiementDepense" (
  "id", "depenseId", "montant", "mode", "reference",
  "date", "userId", "siteId", "createdAt"
) VALUES
  -- dep_01 — paiement total (PAYEE)
  (
    'pdep_01', 'dep_01', 87500.0, 'MOBILE_MONEY', 'MOMO-2026-0201',
    '2026-02-01 12:00:00', 'user_admin', 'site_01', NOW()
  ),
  -- dep_03 — premiere tranche (PAYEE_PARTIELLEMENT)
  (
    'pdep_02', 'dep_03', 60000.0, 'ESPECES', NULL,
    '2026-03-05 09:00:00', 'user_admin', 'site_01', NOW()
  ),
  -- dep_05 — paiement total (PAYEE)
  (
    'pdep_03', 'dep_05', 80000.0, 'VIREMENT', 'VIR-2026-0201',
    '2026-02-01 10:00:00', 'user_admin', 'site_01', NOW()
  ),
  -- dep_04 — acompte versé (50%)
  (
    'pdep_04', 'dep_04', 12500.0, 'ESPECES', NULL,
    '2026-02-20 10:00:00', 'user_gerant', 'site_01', NOW()
  );

-- ──────────────────────────────────────────
-- FraisPaiementDepense (3 frais supplémentaires sur paiements)
-- ──────────────────────────────────────────

INSERT INTO "FraisPaiementDepense" (
  "id", "paiementId", "motif", "montant", "notes", "userId", "siteId", "createdAt"
) VALUES
  -- Transport lors du paiement Mobile Money (pdep_01)
  (
    'frais_01', 'pdep_01', 'TRANSPORT', 1500.0,
    'Frais de déplacement pour dépôt Mobile Money',
    'user_admin', 'site_01', NOW()
  ),
  -- Frais Mobile Money sur pdep_01
  (
    'frais_02', 'pdep_01', 'FRAIS_MOBILE_MONEY', 875.0,
    'Commission MTN MoMo 1%',
    'user_admin', 'site_01', NOW()
  ),
  -- Frais bancaires sur virement (pdep_03)
  (
    'frais_03', 'pdep_03', 'FRAIS_BANCAIRES', 2000.0,
    'Frais de virement bancaire',
    'user_admin', 'site_01', NOW()
  );

-- Mise à jour du montantFraisSupp sur les dépenses concernées
UPDATE "Depense" SET "montantFraisSupp" = 2375.0 WHERE id = 'dep_01';  -- frais_01 + frais_02
UPDATE "Depense" SET "montantFraisSupp" = 2000.0 WHERE id = 'dep_05';  -- frais_03

-- ──────────────────────────────────────────
-- AjustementDepense (2 ajustements de montant)
-- ──────────────────────────────────────────

INSERT INTO "AjustementDepense" (
  "id", "depenseId", "montantAvant", "montantApres", "raison",
  "userId", "siteId", "createdAt"
) VALUES
  -- dep_02 (électricité) : prix réel à la livraison différent du devis
  (
    'adj_01', 'dep_02', 40000.0, 45000.0,
    'Prix réel à la livraison différent du devis — facture Camtel reçue le 2026-02-10',
    'user_admin', 'site_01', NOW()
  ),
  -- dep_04 (réparation pompe) : coût supplémentaire découvert pendant intervention
  (
    'adj_02', 'dep_04', 20000.0, 25000.0,
    'Roulement supplémentaire à remplacer découvert pendant l''intervention',
    'user_gerant', 'site_01', NOW()
  );

-- ──────────────────────────────────────────
-- ListeBesoins (3 listes — statuts variés) + LigneBesoin (8 lignes)
-- ──────────────────────────────────────────

INSERT INTO "ListeBesoins" (
  "id", "numero", "titre",
  "demandeurId", "valideurId",
  "statut", "montantEstime", "montantReel", "motifRejet", "notes",
  "siteId", "createdAt", "updatedAt"
) VALUES
  -- bes_01: SOUMISE — en attente d'approbation (associee a vague_01 via junction)
  (
    'bes_01', 'BES-2026-001',
    'Besoins alimentation vague Mars 2026',
    'user_gerant', NULL,
    'SOUMISE', 95000.0, NULL, NULL,
    'Besoins pour le prochain cycle d''alimentation',
    'site_01', NOW(), NOW()
  ),
  -- bes_02: APPROUVEE — validee, en attente de traitement (sans vague)
  (
    'bes_02', 'BES-2026-002',
    'Equipements entretien bacs',
    'user_gerant', 'user_admin',
    'APPROUVEE', 45000.0, NULL, NULL,
    'Materiel d''entretien prioritaire',
    'site_01', NOW(), NOW()
  ),
  -- bes_03: CLOTUREE — completement traitee (associee a vague_01 et vague_02 via junction)
  (
    'bes_03', 'BES-2026-003',
    'Intrants traitement preventif',
    'user_gerant', 'user_admin',
    'CLOTUREE', 30000.0, 28500.0, NULL,
    'Traitement preventif realise en fevrier',
    'site_01', NOW(), NOW()
  );

-- ListeBesoinsVague — associations vague/ratio pour les listes de besoins
INSERT INTO "ListeBesoinsVague" (
  "id", "listeBesoinsId", "vagueId", "ratio", "siteId", "createdAt"
) VALUES
  -- bes_01 -> vague_01 (ratio 1.0 — liste mono-vague)
  ('lbv_01', 'bes_01', 'vague_01', 1.0, 'site_01', NOW()),
  -- bes_03 -> vague_01 (40%) + vague_02 (60%) — liste multi-vague demo
  ('lbv_02', 'bes_03', 'vague_01', 0.4, 'site_01', NOW()),
  ('lbv_03', 'bes_03', 'vague_02', 0.6, 'site_01', NOW());

-- 8 lignes de besoin (réparties sur les 3 listes)
INSERT INTO "LigneBesoin" (
  "id", "listeBesoinsId",
  "designation", "produitId", "quantite", "unite",
  "prixEstime", "prixReel", "commandeId",
  "createdAt"
) VALUES
  -- bes_01 (SOUMISE) — 3 lignes
  (
    'lb_01', 'bes_01',
    'Aliment poisson granulés 3mm', 'prod_01',
    50.0, NULL,
    1200.0, NULL, NULL,
    NOW()
  ),
  (
    'lb_02', 'bes_01',
    'Aliment poisson granulés 5mm', 'prod_02',
    30.0, NULL,
    1100.0, NULL, NULL,
    NOW()
  ),
  (
    'lb_03', 'bes_01',
    'Vitamines et supplement', NULL,
    5.0, 'FLACONS',
    2000.0, NULL, NULL,
    NOW()
  ),
  -- bes_02 (APPROUVEE) — 3 lignes
  (
    'lb_04', 'bes_02',
    'Filet de protection bacs', NULL,
    2.0, 'ROULEAUX',
    8000.0, NULL, NULL,
    NOW()
  ),
  (
    'lb_05', 'bes_02',
    'Tuyaux PVC 20mm', NULL,
    10.0, 'METRES',
    500.0, NULL, NULL,
    NOW()
  ),
  (
    'lb_06', 'bes_02',
    'Produit entretien filtres', 'prod_04',
    3.0, NULL,
    6000.0, NULL, NULL,
    NOW()
  ),
  -- bes_03 (CLOTUREE) — 2 lignes
  (
    'lb_07', 'bes_03',
    'Sel marin traitement eau', NULL,
    20.0, 'KG',
    600.0, 570.0, NULL,
    NOW()
  ),
  (
    'lb_08', 'bes_03',
    'Antibiotique preventif', NULL,
    2.0, 'BOITES',
    9000.0, 8430.0, NULL,
    NOW()
  );

-- ──────────────────────────────────────────
-- LigneDepense (ADR-027) — ventilation catégorielle
-- dep_01 (ALIMENT, liée à cmd_01) → 2 lignes produit ALIMENT
-- dep_04 (REPARATION, liée à vague_01) → 2 lignes REPARATION (sans produit)
-- ──────────────────────────────────────────

INSERT INTO "LigneDepense" (
  "id", "depenseId",
  "designation", "categorieDepense",
  "quantite", "prixUnitaire", "montantTotal",
  "produitId", "ligneBesoinId", "ligneCommandeId",
  "siteId", "createdAt", "updatedAt"
) VALUES
  -- dep_01 — ligne 1 : Aliment Coppens 3mm (prod_01, lc_01) — 75 kg à 850 FCFA
  (
    'ldep_01', 'dep_01',
    'Aliment commercial Coppens 3mm', 'ALIMENT',
    75.0, 850.0, 63750.0,
    'prod_01', NULL, 'lc_01',
    'site_01', NOW(), NOW()
  ),
  -- dep_01 — ligne 2 : Vitamines et complements (prod_03, lc_02) — fraction de commande
  (
    'ldep_02', 'dep_01',
    'Vitamines et complements nutritifs', 'INTRANT',
    1.0, 23750.0, 23750.0,
    'prod_03', NULL, 'lc_02',
    'site_01', NOW(), NOW()
  ),
  -- dep_04 — ligne 1 : Joint pompe (sans produit stock)
  (
    'ldep_03', 'dep_04',
    'Joint de pompe submersible 40mm', 'REPARATION',
    1.0, 8000.0, 8000.0,
    NULL, NULL, NULL,
    'site_01', NOW(), NOW()
  ),
  -- dep_04 — ligne 2 : Filtre de remplacement (sans produit stock)
  (
    'ldep_04', 'dep_04',
    'Filtre mecanique de remplacement', 'REPARATION',
    2.0, 3500.0, 7000.0,
    NULL, NULL, NULL,
    'site_01', NOW(), NOW()
  );

-- ──────────────────────────────────────────
-- DepenseRecurrente (3 templates — Sprint 18)
-- ──────────────────────────────────────────

INSERT INTO "DepenseRecurrente" (
  id, description, "categorieDepense", "montantEstime", frequence,
  "jourDuMois", "isActive", "derniereGeneration",
  "userId", "siteId", "createdAt", "updatedAt"
) VALUES
  -- rec_01: Loyer mensuel — actif, derniereGeneration = mois precedent
  ('rec_01', 'Loyer atelier pisciculture', 'LOYER', 150000, 'MENSUEL', 5, true,
   '2026-02-05 00:00:00'::timestamp, 'user_admin', 'site_01',
   NOW(), NOW()),
  -- rec_02: Electricite mensuelle — actif, jamais generee
  ('rec_02', 'Facture electricite mensuelle', 'ELECTRICITE', 35000, 'MENSUEL', 10, true,
   NULL, 'user_admin', 'site_01',
   NOW(), NOW()),
  -- rec_03: Salaire mensuel — inactif
  ('rec_03', 'Salaire employe pisciculture', 'SALAIRE', 80000, 'MENSUEL', 28, false,
   NULL, 'user_admin', 'site_01',
   NOW(), NOW());

-- ──────────────────────────────────────────
-- ConfigElevage (3 profils — Sprint 19)
-- ──────────────────────────────────────────

INSERT INTO "ConfigElevage" (
  id, nom, description,
  "poidsObjectif", "dureeEstimeeCycle", "tauxSurvieObjectif",
  "seuilAcclimatation", "seuilCroissanceDebut", "seuilJuvenile", "seuilGrossissement", "seuilFinition",
  "alimentTailleConfig", "alimentTauxConfig",
  "fcrExcellentMax", "fcrBonMax", "fcrAcceptableMax",
  "sgrExcellentMin", "sgrBonMin", "sgrAcceptableMin",
  "survieExcellentMin", "survieBonMin", "survieAcceptableMin",
  "densiteExcellentMax", "densiteBonMax", "densiteAcceptableMax",
  "mortaliteExcellentMax", "mortaliteBonMax", "mortaliteAcceptableMax",
  "phMin", "phMax", "phOptimalMin", "phOptimalMax",
  "temperatureMin", "temperatureMax", "temperatureOptimalMin", "temperatureOptimalMax",
  "oxygeneMin", "oxygeneAlerte", "oxygeneOptimal",
  "ammoniacMax", "ammoniacAlerte", "ammoniacOptimal",
  "nitriteMax", "nitriteAlerte",
  "mortaliteQuotidienneAlerte", "mortaliteQuotidienneCritique",
  "fcrAlerteMax", "stockJoursAlerte",
  "triPoidsMin", "triPoidsMax", "triIntervalleJours",
  "biometrieIntervalleDebut", "biometrieIntervalleFin", "biometrieEchantillonPct",
  "eauChangementPct", "eauChangementIntervalleJours",
  "densiteMaxPoissonsM3", "densiteOptimalePoissonsM3",
  "recoltePartiellePoidsSeuil", "recolteJeuneAvantJours",
  "gompertzWInfDefault", "gompertzKDefault", "gompertzTiDefault", "gompertzMinPoints",
  "isDefault", "isActive",
  "siteId", "createdAt", "updatedAt"
) VALUES
  -- Profil 1 : Clarias Standard Cameroun (par defaut)
  (
    'cfg_01',
    'Clarias Standard Cameroun',
    'Profil standard pour Clarias gariepinus eleve au Cameroun. Objectif 800g en 180 jours. Benchmarks FAO.',
    800.0, 180, 85.0,
    15.0, 50.0, 150.0, 350.0, 700.0,
    '[
      {"poidsMin": 0, "poidsMax": 15, "tailleGranule": "1.2mm", "description": "Aliment demarrage", "proteines": 42},
      {"poidsMin": 15, "poidsMax": 30, "tailleGranule": "1.5-2mm", "description": "Aliment croissance petit", "proteines": 38},
      {"poidsMin": 30, "poidsMax": 80, "tailleGranule": "2-3mm", "description": "Aliment croissance", "proteines": 35},
      {"poidsMin": 80, "poidsMax": 150, "tailleGranule": "3-4mm", "description": "Aliment grossissement petit", "proteines": 32},
      {"poidsMin": 150, "poidsMax": 350, "tailleGranule": "4-6mm", "description": "Aliment grossissement", "proteines": 28},
      {"poidsMin": 350, "poidsMax": 99999, "tailleGranule": "6-9mm", "description": "Aliment finition", "proteines": 25}
    ]'::jsonb,
    '[
      {"phase": "ACCLIMATATION", "tauxMin": 8, "tauxMax": 10, "frequence": 4, "notes": "3-4 distributions/jour"},
      {"phase": "CROISSANCE_DEBUT", "tauxMin": 5, "tauxMax": 6, "frequence": 3, "notes": "3 distributions/jour"},
      {"phase": "JUVENILE", "tauxMin": 3, "tauxMax": 5, "frequence": 3, "notes": "2-3 distributions/jour"},
      {"phase": "GROSSISSEMENT", "tauxMin": 2, "tauxMax": 3, "frequence": 2, "notes": "2 distributions/jour"},
      {"phase": "FINITION", "tauxMin": 1.5, "tauxMax": 2, "frequence": 2, "notes": "1-2 distributions/jour"},
      {"phase": "PRE_RECOLTE", "tauxMin": 1, "tauxMax": 1.5, "frequence": 1, "notes": "1 distribution/jour"}
    ]'::jsonb,
    1.5, 1.8, 2.2,
    2.0, 1.5, 1.0,
    90.0, 85.0, 80.0,
    7.0, 10.0, 15.0,
    3.0, 5.0, 10.0,
    6.5, 8.5, 6.5, 7.5,
    22.0, 36.0, 26.0, 32.0,
    1.5, 4.0, 5.0,
    0.5, 0.05, 0.02,
    1.0, 0.5,
    1.0, 3.0,
    2.0, 5,
    5.0, 150.0, 14,
    7, 14, 10.0,
    30.0, 3,
    100.0, 50.0,
    400.0, 2,
    1200.0, 0.018, 95.0, 5,
    true, true,
    'site_01', NOW(), NOW()
  ),
  -- Profil 2 : Clarias Express (croissance rapide 500g en 120 jours)
  (
    'cfg_02',
    'Clarias Express',
    'Profil pour production rapide. Objectif 500g en 120 jours. Taux alimentation eleve, densite faible.',
    500.0, 120, 82.0,
    15.0, 50.0, 150.0, 350.0, 600.0,
    '[
      {"poidsMin": 0, "poidsMax": 15, "tailleGranule": "1.2mm", "description": "Aliment demarrage haute proteine", "proteines": 45},
      {"poidsMin": 15, "poidsMax": 30, "tailleGranule": "1.5-2mm", "description": "Aliment croissance", "proteines": 42},
      {"poidsMin": 30, "poidsMax": 80, "tailleGranule": "2-3mm", "description": "Aliment croissance actif", "proteines": 40},
      {"poidsMin": 80, "poidsMax": 200, "tailleGranule": "3-4mm", "description": "Aliment grossissement", "proteines": 36},
      {"poidsMin": 200, "poidsMax": 400, "tailleGranule": "4-6mm", "description": "Aliment finition", "proteines": 30},
      {"poidsMin": 400, "poidsMax": 99999, "tailleGranule": "5-7mm", "description": "Aliment pre-recolte", "proteines": 28}
    ]'::jsonb,
    '[
      {"phase": "ACCLIMATATION", "tauxMin": 9, "tauxMax": 11, "frequence": 5, "notes": "4-5 distributions/jour"},
      {"phase": "CROISSANCE_DEBUT", "tauxMin": 6, "tauxMax": 7, "frequence": 4, "notes": "4 distributions/jour"},
      {"phase": "JUVENILE", "tauxMin": 4, "tauxMax": 6, "frequence": 3, "notes": "3 distributions/jour"},
      {"phase": "GROSSISSEMENT", "tauxMin": 3, "tauxMax": 4, "frequence": 3, "notes": "3 distributions/jour"},
      {"phase": "FINITION", "tauxMin": 2, "tauxMax": 3, "frequence": 2, "notes": "2 distributions/jour"},
      {"phase": "PRE_RECOLTE", "tauxMin": 1.5, "tauxMax": 2, "frequence": 1, "notes": "1 distribution/jour"}
    ]'::jsonb,
    1.4, 1.7, 2.0,
    2.2, 1.8, 1.2,
    88.0, 83.0, 78.0,
    6.0, 9.0, 13.0,
    2.0, 4.0, 8.0,
    6.5, 8.5, 6.5, 7.5,
    22.0, 36.0, 26.0, 32.0,
    1.5, 4.0, 5.0,
    0.5, 0.05, 0.02,
    1.0, 0.5,
    1.0, 2.5,
    1.8, 5,
    5.0, 100.0, 10,
    7, 14, 10.0,
    30.0, 3,
    80.0, 40.0,
    300.0, 1,
    1000.0, 0.025, 70.0, 5,
    false, true,
    'site_01', NOW(), NOW()
  ),
  -- Profil 3 : Clarias Premium (gros calibre 1200g en 240 jours)
  (
    'cfg_03',
    'Clarias Premium',
    'Profil pour production haut de gamme. Objectif 1200g en 240 jours. Densite faible, qualite maximale.',
    1200.0, 240, 88.0,
    15.0, 50.0, 150.0, 400.0, 800.0,
    '[
      {"poidsMin": 0, "poidsMax": 15, "tailleGranule": "1.2mm", "description": "Aliment demarrage", "proteines": 42},
      {"poidsMin": 15, "poidsMax": 30, "tailleGranule": "1.5-2mm", "description": "Aliment croissance", "proteines": 40},
      {"poidsMin": 30, "poidsMax": 100, "tailleGranule": "2-3mm", "description": "Aliment croissance lente", "proteines": 36},
      {"poidsMin": 100, "poidsMax": 250, "tailleGranule": "3-5mm", "description": "Aliment grossissement", "proteines": 32},
      {"poidsMin": 250, "poidsMax": 600, "tailleGranule": "5-7mm", "description": "Aliment grossissement lent", "proteines": 28},
      {"poidsMin": 600, "poidsMax": 1000, "tailleGranule": "6-9mm", "description": "Aliment finition", "proteines": 25},
      {"poidsMin": 1000, "poidsMax": 99999, "tailleGranule": "8-12mm", "description": "Aliment pre-recolte premium", "proteines": 22}
    ]'::jsonb,
    '[
      {"phase": "ACCLIMATATION", "tauxMin": 7, "tauxMax": 9, "frequence": 4, "notes": "3-4 distributions/jour"},
      {"phase": "CROISSANCE_DEBUT", "tauxMin": 4, "tauxMax": 5, "frequence": 3, "notes": "3 distributions/jour"},
      {"phase": "JUVENILE", "tauxMin": 2.5, "tauxMax": 4, "frequence": 2, "notes": "2-3 distributions/jour"},
      {"phase": "GROSSISSEMENT", "tauxMin": 1.5, "tauxMax": 2.5, "frequence": 2, "notes": "2 distributions/jour"},
      {"phase": "FINITION", "tauxMin": 1.2, "tauxMax": 1.8, "frequence": 1, "notes": "1-2 distributions/jour"},
      {"phase": "PRE_RECOLTE", "tauxMin": 0.8, "tauxMax": 1.2, "frequence": 1, "notes": "1 distribution/jour"}
    ]'::jsonb,
    1.6, 2.0, 2.5,
    1.8, 1.3, 0.9,
    92.0, 87.0, 82.0,
    5.0, 8.0, 12.0,
    2.5, 4.5, 9.0,
    6.5, 8.5, 6.5, 7.5,
    22.0, 36.0, 26.0, 32.0,
    1.5, 4.0, 5.0,
    0.5, 0.05, 0.02,
    1.0, 0.5,
    0.8, 2.0,
    2.5, 7,
    5.0, 200.0, 21,
    7, 14, 10.0,
    25.0, 2,
    60.0, 30.0,
    600.0, 3,
    1500.0, 0.015, 110.0, 5,
    false, true,
    'site_01', NOW(), NOW()
  );

-- ============================================================
-- SPRINT 20 : Packs & Provisioning (inserts déplacés après Sprint 30 — FK planId)
-- ============================================================
-- Note: Pack INSERT est dans la section Sprint 30 (après PlanAbonnement) car Pack.planId FK PlanAbonnement

-- ──────────────────────────────────────────
-- SPRINT 21 : Catalogue de règles pré-définies globales
-- siteId = NULL => règle globale DKFarm applicable à tous les sites
-- ──────────────────────────────────────────

INSERT INTO "RegleActivite" (
  id, nom, description,
  "typeActivite", "typeDeclencheur",
  "conditionValeur", "conditionValeur2",
  "phaseMin", "phaseMax",
  "intervalleJours",
  "titreTemplate", "descriptionTemplate", "instructionsTemplate",
  priorite, "isActive", "firedOnce",
  "siteId", "userId",
  "createdAt", "updatedAt"
) VALUES

-- ──────────────────────────────────────────
-- Activités quotidiennes récurrentes (priorité 5)
-- ──────────────────────────────────────────

(
  'regle_01',
  'Alimentation quotidienne',
  'Distribution journalière d''aliment selon le poids moyen des poissons et le taux d''alimentation de la phase.',
  'ALIMENTATION', 'RECURRENT',
  NULL, NULL,
  NULL, NULL,
  1,
  'Distribuer {quantite_calculee}g de granulé {taille}',
  'Poids moyen estimé : {poids_moyen}g. Taux d''alimentation : {taux}% de la biomasse. Biomasse totale : {biomasse}kg.',
  '1. Peser la quantité d''aliment calculée.
2. Distribuer en 2 à 3 repas répartis sur la journée.
3. Observer la consommation et noter les refus.
4. Ajuster la quantité si refus > 10%.',
  5, true, false,
  NULL, NULL,
  NOW(), NOW()
),

(
  'regle_02',
  'Vérification température eau',
  'Mesure quotidienne de la température pour s''assurer qu''elle reste dans la plage optimale (25-32°C) pour Clarias gariepinus.',
  'QUALITE_EAU', 'RECURRENT',
  NULL, NULL,
  NULL, NULL,
  1,
  'Mesurer la température de l''eau — Bac {bac}',
  'Plage optimale : 25-32°C. Dernière valeur enregistrée : {valeur}°C.',
  '1. Utiliser un thermomètre étalonné.
2. Mesurer à 10 cm de profondeur, loin des entrées d''eau.
3. Enregistrer dans le relevé qualité eau.
4. Si < 25°C ou > 32°C : alerter le responsable.',
  5, true, false,
  NULL, NULL,
  NOW(), NOW()
),

(
  'regle_03',
  'Observation comportement',
  'Observation journalière du comportement des poissons pour détecter signes de stress, maladie ou mortalité.',
  'AUTRE', 'RECURRENT',
  NULL, NULL,
  NULL, NULL,
  1,
  'Observer le comportement des poissons — Bac {bac}',
  'Vague : {vague}. Effectif estimé : {effectif} individus.',
  '1. Observer l''agitation, la nage en surface (manque O2), les lésions visibles.
2. Retirer tout poisson mort immédiatement.
3. Noter observations dans le relevé d''observation.
4. Signaler tout comportement anormal.',
  5, true, false,
  NULL, NULL,
  NOW(), NOW()
),

(
  'regle_04',
  'Nettoyage bac',
  'Nettoyage quotidien du bac pour maintenir la qualité de l''eau et prévenir les maladies.',
  'NETTOYAGE', 'RECURRENT',
  NULL, NULL,
  NULL, NULL,
  1,
  'Nettoyer le bac {bac}',
  'Vague : {vague}. Retirer les déchets, fèces et aliments non consommés.',
  '1. Retirer les fèces et déchets organiques au fond du bac.
2. Vérifier et nettoyer les filtres si nécessaire.
3. Vérifier le débit d''eau entrant.
4. Noter l''état général dans le relevé d''observation.',
  5, true, false,
  NULL, NULL,
  NOW(), NOW()
),

-- ──────────────────────────────────────────
-- Activités hebdomadaires et bi-hebdomadaires récurrentes (priorité 5)
-- ──────────────────────────────────────────

(
  'regle_05',
  'Biométrie hebdomadaire',
  'Pesée et mesure d''un échantillon représentatif pour calculer le poids moyen et ajuster la ration alimentaire.',
  'BIOMETRIE', 'RECURRENT',
  NULL, NULL,
  'CROISSANCE_DEBUT', 'FINITION',
  7,
  'Biométrie hebdomadaire — Bac {bac}',
  'Dernier poids moyen enregistré : {poids_moyen}g. Echantillonner au moins 10% de l''effectif.',
  '1. Préparer balance et bassine graduée.
2. Capturer un échantillon (min 10% effectif, max 30 individus).
3. Peser chaque individu ou par lot.
4. Calculer le poids moyen et saisir dans le relevé biométrie.
5. Ajuster la ration alimentaire en conséquence.',
  5, true, false,
  NULL, NULL,
  NOW(), NOW()
),

(
  'regle_06',
  'Qualité eau complète',
  'Analyse complète de la qualité de l''eau incluant pH, ammoniaque, nitrites, turbidité et oxygène dissous.',
  'QUALITE_EAU', 'RECURRENT',
  NULL, NULL,
  NULL, NULL,
  7,
  'Analyse qualité eau complète — Bac {bac}',
  'Paramètres à mesurer : pH (6,5-8,5), NH3 (< 0,02 mg/L), NO2 (< 0,5 mg/L), O2 dissous (> 5 mg/L).',
  '1. Utiliser le kit d''analyse multiparamètre.
2. Mesurer pH, ammoniaque, nitrites, turbidité, O2 dissous.
3. Enregistrer tous les paramètres dans le relevé qualité eau.
4. Comparer aux seuils optimaux et alerter si dépassement.',
  5, true, false,
  NULL, NULL,
  NOW(), NOW()
),

(
  'regle_07',
  'Comptage poissons',
  'Comptage bi-mensuel pour mettre à jour l''effectif et calculer le taux de survie cumulé.',
  'COMPTAGE', 'RECURRENT',
  NULL, NULL,
  NULL, NULL,
  14,
  'Comptage effectif — Bac {bac}',
  'Effectif théorique : {effectif} individus. Dernier comptage : {dernier_comptage}.',
  '1. Vider partiellement ou utiliser un filet de compartimentage.
2. Compter par lots de 50 individus.
3. Enregistrer le résultat dans le relevé de comptage.
4. Calculer le taux de survie depuis le début de la vague.',
  5, true, false,
  NULL, NULL,
  NOW(), NOW()
),

(
  'regle_08',
  'Nettoyage filtre',
  'Nettoyage hebdomadaire des filtres pour maintenir un débit optimal et prévenir l''accumulation de matières organiques.',
  'NETTOYAGE', 'RECURRENT',
  NULL, NULL,
  NULL, NULL,
  7,
  'Nettoyer les filtres — Bac {bac}',
  'Vague : {vague}. Vérifier le colmatage et l''état des médias filtrants.',
  '1. Arrêter temporairement la filtration (max 30 min).
2. Rincer les médias filtrants à l''eau propre (pas de détergent).
3. Vérifier l''intégrité des supports et tuyaux.
4. Redémarrer et vérifier le débit.
5. Consigner l''opération dans le relevé d''observation.',
  5, true, false,
  NULL, NULL,
  NOW(), NOW()
),

-- ──────────────────────────────────────────
-- Seuils de poids — changements de granulé (priorité 3)
-- ──────────────────────────────────────────

(
  'regle_09',
  'Changement granulé 0,5mm → 1mm',
  'Transition de taille de granulé recommandée lorsque le poids moyen atteint 5g. La bouche du Clarias peut ingérer des granulés plus grands.',
  'ALIMENTATION', 'SEUIL_POIDS',
  5.0, NULL,
  'ACCLIMATATION', NULL,
  NULL,
  'Changer le granulé : passer à 1mm — Bac {bac}',
  'Poids moyen actuel : {poids_moyen}g (seuil : 5g). Produit recommandé : granulé 1mm.',
  '1. Commander ou préparer le granulé 1mm.
2. Effectuer la transition sur 3 jours en mélangeant les deux tailles (70%/30%, 50%/50%, 30%/70%).
3. Observer l''acceptation et ajuster si refus.
4. Mettre à jour le produit utilisé dans les relevés d''alimentation.',
  3, true, false,
  NULL, NULL,
  NOW(), NOW()
),

(
  'regle_10',
  'Changement granulé 1mm → 2mm',
  'Transition vers granulé 2mm recommandée à 20g de poids moyen. Améliore le FCR et réduit les pertes en suspension.',
  'ALIMENTATION', 'SEUIL_POIDS',
  20.0, NULL,
  'CROISSANCE_DEBUT', NULL,
  NULL,
  'Changer le granulé : passer à 2mm — Bac {bac}',
  'Poids moyen actuel : {poids_moyen}g (seuil : 20g). Produit recommandé : granulé 2mm.',
  '1. Effectuer la transition sur 3 jours en mélangeant progressivement.
2. Observer la consommation et l''absence de refus.
3. Recalculer la ration sur la base du nouveau taux d''alimentation.
4. Mettre à jour le produit dans les relevés.',
  3, true, false,
  NULL, NULL,
  NOW(), NOW()
),

(
  'regle_11',
  'Changement granulé 2mm → 3mm',
  'Transition vers granulé 3mm à 100g. Stade juvénile : le poisson peut ingérer des granulés plus denses, réduction des fines.',
  'ALIMENTATION', 'SEUIL_POIDS',
  100.0, NULL,
  'JUVENILE', NULL,
  NULL,
  'Changer le granulé : passer à 3mm — Bac {bac}',
  'Poids moyen actuel : {poids_moyen}g (seuil : 100g). Produit recommandé : granulé 3mm.',
  '1. Effectuer la transition progressive sur 4 jours.
2. Granulé 3mm : taux d''alimentation typique 3-4% biomasse.
3. Vérifier l''absence de compétition alimentaire (tri si nécessaire).
4. Mettre à jour le produit dans les relevés.',
  3, true, false,
  NULL, NULL,
  NOW(), NOW()
),

(
  'regle_12',
  'Changement granulé 3mm → 4mm',
  'Transition finale vers granulé 4mm à 300g. Phase de grossissement : granulé haute énergie pour maximiser la croissance.',
  'ALIMENTATION', 'SEUIL_POIDS',
  300.0, NULL,
  'GROSSISSEMENT', NULL,
  NULL,
  'Changer le granulé : passer à 4mm — Bac {bac}',
  'Poids moyen actuel : {poids_moyen}g (seuil : 300g). Produit recommandé : granulé 4mm haute énergie.',
  '1. Effectuer la transition progressive sur 4 jours.
2. Granulé 4mm haute énergie : taux d''alimentation 2,5-3% biomasse.
3. Surveiller le FCR hebdomadairement.
4. Mettre à jour le produit dans les relevés.',
  3, true, false,
  NULL, NULL,
  NOW(), NOW()
),

(
  'regle_13',
  'Tri recommandé',
  'Tri par tailles recommandé à 50g pour homogénéiser les bacs et réduire la compétition alimentaire et le cannibalisme.',
  'TRI', 'SEUIL_POIDS',
  50.0, NULL,
  'JUVENILE', NULL,
  NULL,
  'Effectuer un tri par tailles — Bac {bac}',
  'Poids moyen actuel : {poids_moyen}g (seuil : 50g). Hétérogénéité estimée : {heterogeneite}%.',
  '1. Préparer 2 bacs de réception propres.
2. Utiliser un trieur calibré (maille 2-3 cm).
3. Séparer grands (> 60g), moyens (40-60g) et petits (< 40g).
4. Redistribuer à densité égale dans les bacs disponibles.
5. Mettre à jour les vagues et effectifs dans l''application.',
  3, true, false,
  NULL, NULL,
  NOW(), NOW()
),

-- ──────────────────────────────────────────
-- Alertes anomalies (priorité 1-2)
-- ──────────────────────────────────────────

(
  'regle_14',
  'Mortalité anormale',
  'Alerte déclenchée lorsque le taux de mortalité journalier dépasse 2%, indicateur d''une pathologie ou d''un problème environnemental grave.',
  'AUTRE', 'SEUIL_MORTALITE',
  2.0, NULL,
  NULL, NULL,
  NULL,
  'ALERTE : Mortalité anormale — Bac {bac}',
  'Taux de mortalité journalier : {valeur}% (seuil critique : 2%). Morts aujourd''hui : {nb_morts} individus.',
  '1. URGENCE : Identifier immédiatement la cause (qualité eau, maladie, cannibalisme).
2. Mesurer pH, O2, NH3, NO2 immédiatement.
3. Retirer tous les poissons morts.
4. Contacter le responsable et/ou le vétérinaire si cause inconnue.
5. Enregistrer dans le relevé de mortalité.',
  1, true, false,
  NULL, NULL,
  NOW(), NOW()
),

(
  'regle_15',
  'pH hors norme',
  'Alerte déclenchée lorsque le pH sort de la plage optimale (6,5-8,5). Un pH extrême est toxique pour Clarias gariepinus.',
  'QUALITE_EAU', 'SEUIL_QUALITE',
  6.5, 8.5,
  NULL, NULL,
  NULL,
  'ALERTE : pH hors norme — Bac {bac}',
  'pH mesuré : {valeur} (plage normale : 6,5-8,5). Action corrective requise immédiatement.',
  '1. Vérifier la mesure avec un second instrument.
2. Si pH < 6,5 : ajouter de la chaux agricole (CaCO3) progressivement.
3. Si pH > 8,5 : augmenter le renouvellement d''eau, vérifier les algues.
4. Contrôler toutes les 2h jusqu''au retour à la normale.
5. Documenter dans le relevé qualité eau.',
  1, true, false,
  NULL, NULL,
  NOW(), NOW()
),

(
  'regle_16',
  'Température hors norme',
  'Alerte déclenchée lorsque la température sort de la plage optimale (25-32°C). Une température inadaptée ralentit la croissance et fragilise les poissons.',
  'QUALITE_EAU', 'SEUIL_QUALITE',
  25.0, 32.0,
  NULL, NULL,
  NULL,
  'ALERTE : Température hors norme — Bac {bac}',
  'Température mesurée : {valeur}°C (plage optimale : 25-32°C). Action corrective requise.',
  '1. Si < 25°C : vérifier l''alimentation en eau chaude, envisager chauffage d''appoint.
2. Si > 32°C : augmenter le débit d''eau froide, ombrager si bac extérieur.
3. Surveiller toutes les 2h.
4. Réduire la ration alimentaire de 20% si T° hors norme persistante.
5. Documenter dans le relevé qualité eau.',
  1, true, false,
  NULL, NULL,
  NOW(), NOW()
),

(
  'regle_17',
  'FCR élevé',
  'Alerte déclenchée lorsque le FCR (Food Conversion Ratio) dépasse 2,0 sur la fenêtre glissante de 7 jours, indiquant une inefficacité alimentaire.',
  'ALIMENTATION', 'FCR_ELEVE',
  2.0, NULL,
  NULL, NULL,
  NULL,
  'ALERTE : FCR élevé — Bac {bac}',
  'FCR calculé sur 7 jours : {valeur} (seuil : 2,0). Vérifier la qualité de l''aliment et la distribution.',
  '1. Vérifier la qualité et la fraîcheur de l''aliment (date de péremption, stockage).
2. Revoir le taux d''alimentation : réduire si refus observés.
3. Vérifier la santé des poissons (parasites, stress).
4. Contrôler la température (< 25°C réduit l''appétit).
5. Si FCR > 2,5 sur 14 jours : consultation technique recommandée.',
  2, true, false,
  NULL, NULL,
  NOW(), NOW()
),

(
  'regle_18',
  'Stock aliment bas',
  'Alerte déclenchée lorsque le stock restant d''aliment est inférieur à 7 jours de consommation au rythme actuel.',
  'AUTRE', 'STOCK_BAS',
  7.0, NULL,
  NULL, NULL,
  NULL,
  'ALERTE : Stock aliment insuffisant',
  'Stock restant : {stock_restant}kg. A ce rythme de consommation, rupture estimée dans {valeur} jours.',
  '1. Vérifier le stock physique en entrepôt.
2. Déclencher une commande de réapprovisionnement immédiatement.
3. Contacter le fournisseur habituel.
4. Si délai > 3 jours : envisager une source d''approvisionnement alternative.
5. Enregistrer la commande dans le module stock.',
  2, true, false,
  NULL, NULL,
  NOW(), NOW()
),

-- ──────────────────────────────────────────
-- Jalons de production (priorité 7 sauf fin de cycle)
-- ──────────────────────────────────────────

(
  'regle_19',
  'Jalon 25% du cycle',
  'Jalon de production : 25% de la durée du cycle écoulée. Point de contrôle intermédiaire pour évaluer la trajectoire de croissance.',
  'AUTRE', 'JALON',
  25.0, NULL,
  NULL, NULL,
  NULL,
  'Jalon 25% — Bac {bac}',
  'Le cycle a atteint 25% de sa durée planifiée. Durée écoulée : {jours_ecoules} jours / {duree_totale} jours prévus.',
  '1. Comparer le poids moyen actuel à la courbe de croissance théorique.
2. Calculer le taux de survie cumulé.
3. Calculer le FCR depuis le début.
4. Évaluer si des ajustements (densité, alimentation, traitement) sont nécessaires.
5. Documenter le bilan dans un relevé d''observation.',
  7, true, true,
  NULL, NULL,
  NOW(), NOW()
),

(
  'regle_20',
  'Jalon 50% du cycle',
  'Jalon de production : mi-cycle. Bilan intermédiaire obligatoire pour évaluer la rentabilité prévisionnelle et ajuster le plan.',
  'AUTRE', 'JALON',
  50.0, NULL,
  NULL, NULL,
  NULL,
  'Jalon 50% — Mi-cycle — Bac {bac}',
  'Mi-cycle atteint. Durée écoulée : {jours_ecoules} jours. Poids moyen : {poids_moyen}g. Objectif mi-cycle : {objectif_poids}g.',
  '1. Réaliser une biométrie complète (comptage + pesée).
2. Calculer le FCR cumulé et le SGR.
3. Comparer à la projection initiale.
4. Si retard de croissance > 15% : revoir la ration ou la densité.
5. Mettre à jour la date de récolte prévisionnelle.',
  7, true, true,
  NULL, NULL,
  NOW(), NOW()
),

(
  'regle_21',
  'Jalon 75% du cycle',
  'Jalon à 75% du cycle. Planification de la récolte : contacter les acheteurs, préparer la logistique.',
  'AUTRE', 'JALON',
  75.0, NULL,
  NULL, NULL,
  NULL,
  'Jalon 75% — Préparer la récolte — Bac {bac}',
  'Le cycle est à 75%. Date de récolte estimée : {date_recolte}. Poids moyen actuel : {poids_moyen}g.',
  '1. Estimer la date de récolte avec ±2 semaines de précision.
2. Contacter les acheteurs et confirmer les commandes.
3. Planifier le jeûne pré-récolte (24-48h avant).
4. Vérifier la disponibilité du matériel de récolte.
5. Commencer la réduction progressive du stock d''aliment.',
  7, true, true,
  NULL, NULL,
  NOW(), NOW()
),

(
  'regle_22',
  'Pré-récolte (90% du cycle)',
  'Alerte pré-récolte à 90% du cycle. Actions urgentes pour préparer la commercialisation et la logistique de récolte.',
  'RECOLTE', 'JALON',
  90.0, NULL,
  NULL, NULL,
  NULL,
  'Pré-récolte — Actions urgentes — Bac {bac}',
  'Récolte imminente (90% du cycle). Poids moyen : {poids_moyen}g. Biomasse estimée : {biomasse}kg. Valeur marchande estimée : {valeur_marchande} FCFA.',
  '1. URGENT : Confirmer les acheteurs et la date de livraison.
2. Planifier le jeûne (arrêt alimentation 48h avant récolte).
3. Préparer le matériel : épuisettes, bacs de transport, oxygène.
4. Contacter le transporteur frigorifique si besoin.
5. Préparer la facture proforma pour l''acheteur.',
  3, true, true,
  NULL, NULL,
  NOW(), NOW()
),

(
  'regle_23',
  'Fin de cycle — Récolte',
  'Fin du cycle de production : déclenchement du processus de récolte. Bilan complet du cycle à réaliser.',
  'RECOLTE', 'JALON',
  100.0, NULL,
  NULL, NULL,
  NULL,
  'Fin de cycle — Procéder à la récolte — Bac {bac}',
  'Le cycle est terminé. Vague : {vague}. Durée totale : {jours_ecoules} jours. Biomasse finale estimée : {biomasse}kg.',
  '1. Arrêter l''alimentation 48h avant (si pas déjà fait).
2. Procéder à la récolte complète du bac.
3. Peser et trier les poissons par calibre (< 400g, 400-600g, > 600g).
4. Enregistrer la vente dans le module commercial.
5. Nettoyer et désinfecter le bac avant la prochaine vague.
6. Clôturer la vague dans l''application avec le bilan final.',
  1, true, true,
  NULL, NULL,
  NOW(), NOW()
);

-- ──────────────────────────────────────────
-- SPRINT 23 : Notes Ingénieur (Monitoring)
-- ingenieurId = user_ingenieur, siteId = site_01 (DKFarm, R8)
-- clientSiteId = site_client_01 (ferme du client)
-- vagueId = vague_01 (vague EN_COURS du client — ici on reutilise vague_01 pour la demo)
-- ──────────────────────────────────────────

INSERT INTO "NoteIngenieur" (
  id, titre, contenu, visibility, "isUrgent", "isRead",
  "isFromClient", "observationTexte",
  "ingenieurId", "clientSiteId", "vagueId", "siteId",
  "createdAt", "updatedAt"
) VALUES

-- Note 1 : note technique PUBLIC visible par le client, liee a la vague en cours
(
  'note_01',
  'Bilan biométrique S8 — Croissance satisfaisante',
  E'## Bilan biométrie — Semaine 8\n\nLe poids moyen des poissons atteint **55g**, ce qui correspond aux benchmarks FAO pour Clarias gariepinus à ce stade.\n\n### Points positifs\n- Croissance régulière (+6g/semaine)\n- Taux de survie estimé : 94%\n- FCR actuel : 1.8 (bon)\n\n### Recommandations\n1. Passer au granulé 2mm dès la semaine prochaine\n2. Augmenter la ration de 10% (phase juvenile)\n3. Effectuer un tri si l''écart de poids > 30%',
  'PUBLIC', false, false,
  false, NULL,
  'user_ingenieur', 'site_client_01', 'vague_client_01', 'site_01',
  NOW() - INTERVAL '7 days', NOW() - INTERVAL '7 days'
),

-- Note 2 : note INTERNE (usage DKFarm uniquement), urgente
(
  'note_02',
  'INTERNE : Suspicion mycose — suivi renforcé requis',
  E'## Note interne — Non visible par le client\n\nLors de la visite du 2026-03-08, observation de lésions cutanées suspectes sur 3 individus du Bac 1. Possible mycose à *Saprolegnia*.\n\n**Actions internes requises :**\n- Prélever 5 individus pour analyse laboratoire\n- Commander sulfate de cuivre (15kg) en urgence\n- Prévenir Dr. Biloa (vétérinaire partenaire)\n\n**NE PAS informer le client avant confirmation du diagnostic.**',
  'INTERNE', true, false,
  false, NULL,
  'user_ingenieur', 'site_client_01', 'vague_client_01', 'site_01',
  NOW() - INTERVAL '4 days', NOW() - INTERVAL '4 days'
),

-- Note 3 : observation soumise par le client (isFromClient=true)
(
  'note_03',
  'Observation client : poissons en surface ce matin',
  E'Le client a soumis une observation via l''application.\n\n**Observation originale :** "Ce matin j''ai vu beaucoup de poissons nager en surface, ils semblent chercher de l''air. Est-ce grave ?"\n\n**Analyse ingénieur :** Probable manque d''oxygène dissous. Vérifier le débit d''aération. Mesure urgente de l''O2 recommandée.',
  'PUBLIC', true, true,
  true, 'Ce matin j''ai vu beaucoup de poissons nager en surface, ils semblent chercher de l''air. Est-ce grave ?',
  'user_ingenieur', 'site_client_01', 'vague_client_01', 'site_01',
  NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day'
),

-- Note 4 : note de suivi PUBLIC lue par le client, sans vague associee
(
  'note_04',
  'Guide démarrage : conseils pratiques pour les 30 premiers jours',
  E'## Guide de démarrage — 30 premiers jours\n\nBienvenue sur FarmFlow ! Voici les points clés pour réussir vos 30 premiers jours d''élevage.\n\n### Alimentation\n- Granulé **1mm** jusqu''à 10g de poids moyen\n- Taux : **5-8% de la biomasse/jour** en 3 repas\n\n### Qualité eau\n- Température idéale : **25-30°C**\n- Renouveler **30% du volume** tous les 2-3 jours\n- Mesurer O2, pH, température **chaque matin**\n\n### Biométrie\n- 1ère biométrie à J+7\n- Peser **10% de l''effectif** par bac\n\nN''hésitez pas à soumettre vos observations directement dans l''application.',
  'PUBLIC', false, true,
  false, NULL,
  'user_ingenieur', 'site_client_01', NULL, 'site_01',
  NOW() - INTERVAL '14 days', NOW() - INTERVAL '14 days'
);

-- ──────────────────────────────────────────
-- Calibrages (2 : un complet sur vague_01, un partiel)
-- ──────────────────────────────────────────

INSERT INTO "Calibrage" (id, date, "vagueId", "sourceBacIds", "nombreMorts", notes, "siteId", "userId", "createdAt", "updatedAt")
VALUES
  (
    'calib_01',
    '2026-02-20',
    'vague_01',
    ARRAY['bac_01', 'bac_02', 'bac_03'],
    4,
    'Premier calibrage de la vague — tri par categorie de poids apres 5 semaines.',
    'site_01',
    'user_gerant',
    NOW() - INTERVAL '24 days',
    NOW() - INTERVAL '24 days'
  ),
  (
    'calib_02',
    '2026-03-05',
    'vague_01',
    ARRAY['bac_01', 'bac_02'],
    1,
    NULL,
    'site_01',
    'user_gerant',
    NOW() - INTERVAL '11 days',
    NOW() - INTERVAL '11 days'
  );

-- CalibrageGroupes pour calib_01 (3 categories, 1 bac destination chacune)
INSERT INTO "CalibrageGroupe" (id, "calibrageId", categorie, "destinationBacId", "nombrePoissons", "poidsMoyen", "tailleMoyenne", "createdAt")
VALUES
  -- Petits (< 50 g) → bac_03
  (
    'cg_01_petit',
    'calib_01',
    'PETIT',
    'bac_03',
    85,
    38.5,
    14.2,
    NOW() - INTERVAL '24 days'
  ),
  -- Moyens (50–150 g) → bac_02
  (
    'cg_01_moyen',
    'calib_01',
    'MOYEN',
    'bac_02',
    215,
    87.0,
    21.5,
    NOW() - INTERVAL '24 days'
  ),
  -- Gros (150–350 g) → bac_01
  (
    'cg_01_gros',
    'calib_01',
    'GROS',
    'bac_01',
    122,
    198.3,
    32.0,
    NOW() - INTERVAL '24 days'
  );

-- CalibrageGroupes pour calib_02 (2 categories)
INSERT INTO "CalibrageGroupe" (id, "calibrageId", categorie, "destinationBacId", "nombrePoissons", "poidsMoyen", "tailleMoyenne", "createdAt")
VALUES
  (
    'cg_02_moyen',
    'calib_02',
    'MOYEN',
    'bac_02',
    142,
    112.0,
    25.0,
    NOW() - INTERVAL '11 days'
  ),
  (
    'cg_02_gros',
    'calib_02',
    'GROS',
    'bac_01',
    190,
    245.0,
    36.5,
    NOW() - INTERVAL '11 days'
  );

-- ──────────────────────────────────────────
-- SPRINT 27-28 : Règles globales de densité avec conditions composées (R1-R6)
-- siteId = NULL => règles globales DKFarm applicables à tous les sites
-- Ces règles utilisent la logique de conditions composées (ConditionRegle)
-- firedOnce = false : la densité fluctue, re-évaluer à chaque relevé
-- ──────────────────────────────────────────

INSERT INTO "RegleActivite" (
  id, nom, description,
  "typeActivite", "typeDeclencheur",
  "conditionValeur", "conditionValeur2",
  "phaseMin", "phaseMax",
  "intervalleJours",
  "titreTemplate", "descriptionTemplate", "instructionsTemplate",
  priorite, "isActive", "firedOnce",
  logique,
  "actionType", severite,
  "titreNotificationTemplate", "descriptionNotificationTemplate",
  "actionPayloadType",
  "siteId", "userId",
  "createdAt", "updatedAt"
) VALUES

-- ── R1 : Densité élevée + renouvellement insuffisant (50-100 kg/m3) ──────────
-- actionType = NOTIFICATION, severite = AVERTISSEMENT
(
  'rule_densite_renouv_50',
  'Densité élevée + renouvellement insuffisant (50-100 kg/m3)',
  'Alerte quand la densité dépasse 50 kg/m3 ET que le taux de renouvellement est inférieur à 50%/jour sur la fenêtre configurée. Correspond à la case ALERTE/EAU_NON_MESURÉE de la matrice densité × qualité eau.',
  'QUALITE_EAU', 'SEUIL_DENSITE',
  50.0, NULL,
  NULL, NULL,
  NULL,
  'Renouvellement insuffisant — Bac {bac}',
  'Densité actuelle : {valeur} kg/m3 (seuil : 50 kg/m3). Renouvellement moyen sur 7 jours : insuffisant. Augmenter le débit ou la fréquence de renouvellement.',
  '1. Vérifier le débit d''eau entrant dans le bac.
2. Effectuer un renouvellement de 50% du volume minimum.
3. Enregistrer le renouvellement dans l''application (relevé type RENOUVELLEMENT).
4. Mesurer la qualité de l''eau (O2, NH3, pH) après le renouvellement.
5. Si densité > 100 kg/m3 : renouveler à 75% minimum.',
  5, true, false,
  'ET',
  'NOTIFICATION', 'AVERTISSEMENT',
  'Renouvellement insuffisant — Bac {bac}',
  'Densité : {valeur} kg/m3 (seuil 50). Taux de renouvellement insuffisant. Augmentez le débit ou la fréquence de renouvellement.',
  'CREER_RELEVE',
  NULL, NULL,
  NOW(), NOW()
),

-- ── R2 : Densité haute + renouvellement insuffisant (100-200 kg/m3) ──────────
-- actionType = NOTIFICATION, severite = CRITIQUE
(
  'rule_densite_renouv_100',
  'Densité haute + renouvellement insuffisant (100-200 kg/m3)',
  'Alerte critique quand la densité dépasse 100 kg/m3 ET que le taux de renouvellement est inférieur à 75%/jour. À cette densité, un renouvellement insuffisant entraîne une accumulation rapide d''ammoniac.',
  'QUALITE_EAU', 'SEUIL_DENSITE',
  100.0, NULL,
  NULL, NULL,
  NULL,
  'Renouvellement critique — Bac {bac} (densité {valeur} kg/m3)',
  'Densité actuelle : {valeur} kg/m3 (seuil critique : 100 kg/m3). Renouvellement insuffisant. Risque d''accumulation d''ammoniac. Action urgente.',
  '1. URGENT : Effectuer un renouvellement de 75% du volume minimum.
2. Mesurer immédiatement NH3, O2 et pH.
3. Si NH3 > 0.5 mg/L : renouvellement d''urgence à 100%.
4. Enregistrer dans l''application (relevé RENOUVELLEMENT + relevé QUALITE_EAU).
5. Réduire la ration alimentaire de 30% pour limiter les rejets azotés.
6. Envisager une réduction de densité si situation persistante.',
  3, true, false,
  'ET',
  'NOTIFICATION', 'CRITIQUE',
  'URGENT — Renouvellement insuffisant — Bac {bac}',
  'Densité {valeur} kg/m3 (> 100). Renouvellement insuffisant. Risque accumulation ammoniac. Renouveler 75% du volume immédiatement.',
  'CREER_RELEVE',
  NULL, NULL,
  NOW(), NOW()
),

-- ── R3 : Densité critique + renouvellement insuffisant (>200 kg/m3) ──────────
-- actionType = NOTIFICATION, severite = CRITIQUE
(
  'rule_densite_renouv_200',
  'Densité critique + renouvellement insuffisant (>200 kg/m3)',
  'Alerte urgente quand la densité dépasse 200 kg/m3 (seuil rouge bac béton/plastique) ET que le renouvellement est inférieur à 100%/jour. Risque sérieux de mortalité.',
  'QUALITE_EAU', 'SEUIL_DENSITE',
  200.0, NULL,
  NULL, NULL,
  NULL,
  'URGENT — Eau stagnante — Bac {bac}',
  'Densité actuelle : {valeur} kg/m3 (seuil urgence : 200 kg/m3). Renouvellement insuffisant. Risque de mortalité massive par asphyxie ou intoxication à l''ammoniac.',
  '1. URGENCE ABSOLUE : Renouveler 100% du volume immédiatement.
2. Mesurer O2 dissous (si < 4 mg/L : aération d''urgence).
3. Mesurer NH3 (si > 1 mg/L : dilution massive obligatoire).
4. Arrêter l''alimentation jusqu''à retour à la normale.
5. Enregistrer le renouvellement et les mesures qualité eau.
6. Si impossible de renouveler : envisager un transfert d''urgence des poissons.
7. Alerter le responsable technique.',
  1, true, false,
  'ET',
  'NOTIFICATION', 'CRITIQUE',
  'URGENCE — Eau stagnante — Bac {bac}',
  'Densité {valeur} kg/m3 (> 200). Renouvellement critique. Risque mortalité massive. Renouveler 100% du volume IMMÉDIATEMENT.',
  'MODIFIER_BAC',
  NULL, NULL,
  NOW(), NOW()
),

-- ── R4 : Densité élevée + absence relevé qualité eau (> 3 jours) ─────────────
-- actionType = LES_DEUX (activite + alerte), severite = CRITIQUE
(
  'rule_densite_abs_qe',
  'Densité élevée + absence relevé qualité eau',
  'Alerte quand la densité dépasse 100 kg/m3 ET qu''aucun relevé de qualité eau n''a été enregistré depuis plus de 3 jours. À cette densité, un suivi quotidien de la qualité eau est impératif.',
  'QUALITE_EAU', 'SEUIL_DENSITE',
  100.0, NULL,
  NULL, NULL,
  NULL,
  'Qualité eau non vérifiée — Bac {bac}',
  'Densité actuelle : {valeur} kg/m3. Dernier relevé qualité eau : il y a plus de 3 jours. À cette densité, la qualité de l''eau doit être contrôlée quotidiennement.',
  '1. Effectuer immédiatement un relevé de qualité eau complet.
2. Mesurer : pH, O2 dissous, NH3, NO2, température.
3. Si paramètres hors norme : suivre les instructions de l''alerte correspondante.
4. Mettre en place un suivi quotidien (relevé QUALITE_EAU chaque matin).
5. Considérer l''installation d''un kit de mesure multi-paramètre permanent.',
  2, true, false,
  'ET',
  'LES_DEUX', 'CRITIQUE',
  'Qualité eau non contrôlée — Bac {bac}',
  'Densité {valeur} kg/m3 et aucun relevé qualité eau depuis 3+ jours. Effectuez un relevé immédiatement.',
  'CREER_RELEVE',
  NULL, NULL,
  NOW(), NOW()
),

-- ── R5 : Problème qualité eau (paramètre critique — logique OU) ───────────────
-- actionType = NOTIFICATION, severite = CRITIQUE
(
  'rule_qualite_critique',
  'Paramètre qualité eau critique (NH3 ou O2)',
  'Alerte déclenchée si l''ammoniac dépasse 1.0 mg/L OU si l''oxygène dissous est inférieur à 4.0 mg/L. Correspond aux cases */CRITIQUE de la matrice densité × qualité eau.',
  'QUALITE_EAU', 'SEUIL_QUALITE',
  NULL, NULL,
  NULL, NULL,
  NULL,
  'Paramètre critique — Bac {bac}',
  'Un paramètre de qualité eau est dans la zone critique : NH3 > 1.0 mg/L OU O2 < 4.0 mg/L. Risque de mortalité sans intervention immédiate.',
  '1. URGENCE : Identifier le paramètre critique (NH3 ou O2).
2. Si O2 < 4 mg/L : aération d''urgence + renouvellement 50% du volume.
3. Si NH3 > 1.0 mg/L : renouvellement 100% du volume, arrêt alimentation 24h.
4. Mesurer à nouveau 1h après intervention.
5. Enregistrer relevé QUALITE_EAU + relevé RENOUVELLEMENT.
6. Surveiller toutes les 2h jusqu''au retour à la normale.',
  1, true, false,
  'OU',
  'NOTIFICATION', 'CRITIQUE',
  'ALERTE — Paramètre qualité eau critique — Bac {bac}',
  'NH3 > 1.0 mg/L OU O2 < 4.0 mg/L détecté. Risque de mortalité. Intervention immédiate requise.',
  'CREER_RELEVE',
  NULL, NULL,
  NOW(), NOW()
),

-- ── R6 : Densité critique + qualité eau dégradée (NH3 élevé) ─────────────────
-- actionType = NOTIFICATION, severite = CRITIQUE
(
  'rule_densite_nh3_critique',
  'Densité critique + NH3 élevé',
  'Alerte maximale quand la densité dépasse 200 kg/m3 ET que l''ammoniac dépasse 0.05 mg/L. Correspond à la case CRITIQUE/DÉGRADÉE ou CRITIQUE/CRITIQUE de la matrice. Risque de mortalité massive.',
  'QUALITE_EAU', 'SEUIL_DENSITE',
  200.0, NULL,
  NULL, NULL,
  NULL,
  'URGENT — Densité + NH3 — Bac {bac}',
  'SITUATION CRITIQUE : Densité {valeur} kg/m3 ET ammoniac élevé détecté. Combinaison létale pour Clarias gariepinus. Intervention immédiate obligatoire.',
  '1. URGENCE ABSOLUE : Renouveler 100% du volume immédiatement.
2. Arrêter l''alimentation pour les 24 prochaines heures.
3. Si O2 < 5 mg/L : aération d''urgence en plus du renouvellement.
4. Retirer tout poisson mort immédiatement.
5. Enregistrer le renouvellement dans l''application.
6. Mesurer NH3 toutes les 2h jusqu''à NH3 < 0.05 mg/L.
7. Contacter immédiatement le responsable technique.
8. Évaluer une réduction de densité (transfert vers bac disponible).',
  1, true, false,
  'ET',
  'NOTIFICATION', 'CRITIQUE',
  'URGENCE ABSOLUE — Densité + NH3 — Bac {bac}',
  'Densité {valeur} kg/m3 ET ammoniac élevé. Combinaison létale. Renouveler 100% du volume IMMÉDIATEMENT. Arrêter l''alimentation.',
  'MODIFIER_BAC',
  NULL, NULL,
  NOW(), NOW()
);

-- ──────────────────────────────────────────
-- ConditionRegle pour les 6 règles de densité (R1-R6)
-- ──────────────────────────────────────────

INSERT INTO "ConditionRegle" (id, "regleId", "typeDeclencheur", operateur, "conditionValeur", "conditionValeur2", ordre)
VALUES

-- R1 : densité > 50 ET renouvellement < 50%/jour
('cond_r1_c1', 'rule_densite_renouv_50',   'SEUIL_DENSITE',        'SUPERIEUR', 50.0,  NULL, 0),
('cond_r1_c2', 'rule_densite_renouv_50',   'SEUIL_RENOUVELLEMENT', 'INFERIEUR', 50.0,  NULL, 1),

-- R2 : densité > 100 ET renouvellement < 75%/jour
('cond_r2_c1', 'rule_densite_renouv_100',  'SEUIL_DENSITE',        'SUPERIEUR', 100.0, NULL, 0),
('cond_r2_c2', 'rule_densite_renouv_100',  'SEUIL_RENOUVELLEMENT', 'INFERIEUR', 75.0,  NULL, 1),

-- R3 : densité > 200 ET renouvellement < 100%/jour
('cond_r3_c1', 'rule_densite_renouv_200',  'SEUIL_DENSITE',        'SUPERIEUR', 200.0, NULL, 0),
('cond_r3_c2', 'rule_densite_renouv_200',  'SEUIL_RENOUVELLEMENT', 'INFERIEUR', 100.0, NULL, 1),

-- R4 : densité > 100 ET absence relevé qualité eau > 3 jours
('cond_r4_c1', 'rule_densite_abs_qe',      'SEUIL_DENSITE',        'SUPERIEUR', 100.0, NULL, 0),
('cond_r4_c2', 'rule_densite_abs_qe',      'ABSENCE_RELEVE',       'SUPERIEUR', 3.0,   NULL, 1),

-- R5 : NH3 > 1.0 OU O2 < 4.0 (logique OU — declencheurs specifiques)
('cond_r5_c1', 'rule_qualite_critique',    'SEUIL_AMMONIAC',       'SUPERIEUR', 1.0,   NULL, 0),
('cond_r5_c2', 'rule_qualite_critique',    'SEUIL_OXYGENE',        'INFERIEUR', 4.0,   NULL, 1),

-- R6 : densité > 200 ET NH3 > 0.05
('cond_r6_c1', 'rule_densite_nh3_critique','SEUIL_DENSITE',        'SUPERIEUR', 200.0, NULL, 0),
('cond_r6_c2', 'rule_densite_nh3_critique','SEUIL_AMMONIAC',       'SUPERIEUR', 0.05,  NULL, 1);

-- ============================================================
-- Sprint 30 — Abonnements & Plans (seed données de test)
-- ============================================================

-- Plans d'abonnement (8 plans — Story 43.1 : modulesInclus, Story 45.2 : EXONERATION)
-- Règle : ABONNEMENTS, COMMISSIONS, REMISES sont des modules platform-only — jamais dans modulesInclus
INSERT INTO "PlanAbonnement" (id, nom, "typePlan", description, "prixMensuel", "prixTrimestriel", "prixAnnuel", "limitesSites", "limitesBacs", "limitesVagues", "limitesIngFermes", "isActif", "isPublic", "modulesInclus", "dureeEssaiJours", "createdAt", "updatedAt")
VALUES
  ('plan_decouverte',      'Découverte',       'DECOUVERTE',        'Plan gratuit pour démarrer',                    NULL,  NULL,   NULL,   1, 3,  1,  NULL, true, true, ARRAY['GROSSISSEMENT']::"SiteModule"[],                                                                                        14,   NOW(), NOW()),
  ('plan_eleveur',         'Éleveur',          'ELEVEUR',           'Pour les petits éleveurs',                      3000,  7500,   25000,  1, 10, 3,  NULL, true, true, ARRAY['GROSSISSEMENT','INTRANTS','VENTES']::"SiteModule"[],                                                                      NULL, NOW(), NOW()),
  ('plan_professionnel',   'Professionnel',    'PROFESSIONNEL',     'Pour les éleveurs professionnels',              8000,  20000,  70000,  3, 30, 10, NULL, true, true, ARRAY['GROSSISSEMENT','INTRANTS','VENTES','REPRODUCTION','ANALYSE_PILOTAGE','NOTES']::"SiteModule"[],                            NULL, NOW(), NOW()),
  ('plan_entreprise',      'Entreprise',       'ENTREPRISE',        'Pour les structures d''élevage avancées',       20000, 50000,  180000, 5, 50, 20, NULL, true, true, ARRAY['GROSSISSEMENT','INTRANTS','VENTES','REPRODUCTION','ANALYSE_PILOTAGE','NOTES','CONFIGURATION']::"SiteModule"[],           NULL, NOW(), NOW()),
  ('plan_ing_starter',     'Ingénieur Starter','INGENIEUR_STARTER', 'Pour les ingénieurs débutant leur activité',   5000,  NULL,   50000,  1, 3,  1,  5,    true, true, ARRAY['GROSSISSEMENT','INGENIEUR']::"SiteModule"[],                                                                              NULL, NOW(), NOW()),
  ('plan_ing_pro',         'Ingénieur Pro',    'INGENIEUR_PRO',     'Pour les ingénieurs piscicoles supervisants',  15000, NULL,   135000, 1, 3,  1,  20,   true, true, ARRAY['GROSSISSEMENT','INTRANTS','VENTES','INGENIEUR']::"SiteModule"[],                                                          NULL, NOW(), NOW()),
  ('plan_ing_expert',      'Ingénieur Expert', 'INGENIEUR_EXPERT',  'Pour les ingénieurs avec expertise avancée',   25000, NULL,   225000, 1, 3,  1,  NULL, true, true, ARRAY['GROSSISSEMENT','INTRANTS','VENTES','REPRODUCTION','ANALYSE_PILOTAGE','INGENIEUR']::"SiteModule"[],                        NULL, NOW(), NOW()),
  -- Story 45.2 — Plan EXONERATION : réservé admin plateforme, non public, prix 0, limites 999
  ('plan_exoneration',     'Exonération',      'EXONERATION',       'Plan réservé aux sites fondateurs et partenaires DKFarm — accès complet exonéré', NULL, NULL, NULL, 999, 999, 999, NULL, true, false, ARRAY['GROSSISSEMENT','INTRANTS','VENTES','REPRODUCTION','ANALYSE_PILOTAGE','NOTES','CONFIGURATION','INGENIEUR']::"SiteModule"[], NULL, NOW(), NOW())
ON CONFLICT ("typePlan") DO UPDATE SET
  "modulesInclus"     = EXCLUDED."modulesInclus",
  "dureeEssaiJours"   = EXCLUDED."dureeEssaiJours",
  "updatedAt"         = NOW();

-- ============================================================
-- SPRINT 20 (suite) : Packs & Provisioning
-- Placé ici car Pack.planId FK PlanAbonnement (Story 44.1)
-- ============================================================

-- Packs (planId remplace enabledModules depuis Story 44.1)
INSERT INTO "Pack" (id, nom, description, "nombreAlevins", "poidsMoyenInitial", "prixTotal", "configElevageId", "isActive", "planId", "userId", "siteId", "createdAt", "updatedAt")
VALUES
  (
    'pack_01',
    'Pack Decouverte 100',
    'Kit de demarrage pour 100 alevins. Ideal pour les pisciculteurs debutants. Inclut aliments et intrants pour 30 jours.',
    100, 5.0, 85000.0,
    'cfg_01',
    true,
    'plan_decouverte',
    'user_admin', 'site_01', NOW(), NOW()
  ),
  (
    'pack_02',
    'Pack Starter 300',
    'Kit standard pour 300 alevins. Production semi-intensive. Inclut aliments, intrants et materiel de base.',
    300, 5.0, 220000.0,
    'cfg_01',
    true,
    'plan_eleveur',
    'user_admin', 'site_01', NOW(), NOW()
  ),
  (
    'pack_03',
    'Pack Pro 500',
    'Kit professionnel pour 500 alevins. Production intensive optimisee. Config Clarias Express incluse.',
    500, 5.0, 350000.0,
    'cfg_02',
    true,
    'plan_professionnel',
    'user_admin', 'site_01', NOW(), NOW()
  );

-- Pack Produits (associer les produits existants aux packs)
-- Pack Decouverte 100 : aliment de base + sel de cuisine
INSERT INTO "PackProduit" (id, "packId", "produitId", quantite)
VALUES
  ('pp_01_aliment', 'pack_01', 'prod_01', 25.0),
  ('pp_01_sel', 'pack_01', 'prod_03', 2.0),
  -- Pack Starter 300
  ('pp_02_aliment', 'pack_02', 'prod_01', 75.0),
  ('pp_02_sel', 'pack_02', 'prod_03', 5.0),
  ('pp_02_vit', 'pack_02', 'prod_04', 1.0),
  -- Pack Pro 500
  ('pp_03_aliment', 'pack_03', 'prod_01', 120.0),
  ('pp_03_sel', 'pack_03', 'prod_03', 8.0),
  ('pp_03_vit', 'pack_03', 'prod_04', 2.0),
  ('pp_03_aliment2', 'pack_03', 'prod_02', 50.0);

-- Pack Bacs (bacs modeles inclus dans chaque pack)
-- Pack Decouverte 100 : 1 bac unique de 100 alevins
INSERT INTO "PackBac" (id, "packId", nom, volume, "nombreAlevins", "poidsMoyenInitial", position)
VALUES
  ('pb_01_bac1', 'pack_01', 'Bac Unique', 1000.0, 100, 5.0, 0);

-- Pack Starter 300 : 2 bacs (200 + 100 alevins)
INSERT INTO "PackBac" (id, "packId", nom, volume, "nombreAlevins", "poidsMoyenInitial", position)
VALUES
  ('pb_02_bac1', 'pack_02', 'Bac Principal', 2000.0, 200, 5.0, 0),
  ('pb_02_bac2', 'pack_02', 'Bac Secondaire', 1500.0, 100, 5.0, 1);

-- Pack Pro 500 : 3 bacs (200 + 200 + 100 alevins)
INSERT INTO "PackBac" (id, "packId", nom, volume, "nombreAlevins", "poidsMoyenInitial", position)
VALUES
  ('pb_03_bac1', 'pack_03', 'Bac A', 2000.0, 200, 5.0, 0),
  ('pb_03_bac2', 'pack_03', 'Bac B', 2000.0, 200, 5.0, 1),
  ('pb_03_bac3', 'pack_03', 'Bac C', 1500.0, 100, 5.0, 2);

-- PackActivation (site_01 supervise site_client_01 via pack_01)
INSERT INTO "PackActivation" (id, code, "packId", "userId", "siteId", "clientSiteId", statut, "dateActivation", "createdAt", "updatedAt")
VALUES
  ('pa_01', 'ACT-2026-001', 'pack_01', 'user_ingenieur', 'site_01', 'site_client_01', 'ACTIVE', NOW() - INTERVAL '30 days', NOW() - INTERVAL '30 days', NOW());

-- Link client vague to PackActivation
UPDATE "Vague" SET "packActivationId" = 'pa_01' WHERE id = 'vague_client_01';

-- ============================================================
-- Remises (3 remises : early adopter fixe, early adopter %, bienvenue)
-- Story 35.2 : EARLY2026 = remise fixe 2000 XAF pour les early adopters (premier abonnement)
INSERT INTO "Remise" (id, nom, code, type, valeur, "estPourcentage", "dateDebut", "dateFin", "limiteUtilisations", "nombreUtilisations", "isActif", "userId", "createdAt", "updatedAt")
VALUES
  ('remise_early_xaf', 'Early Adopter 2000 XAF', 'EARLY2026', 'EARLY_ADOPTER', 2000, false, NOW(), '2026-12-31 23:59:59', NULL, 0, true, 'user_admin', NOW(), NOW()),
  ('remise_early_pct', 'Early Adopter 50%', 'EARLYBIRD50', 'EARLY_ADOPTER', 50, true, NOW(), NOW() + INTERVAL '6 months', 100, 0, true, 'user_admin', NOW(), NOW()),
  ('remise_bienvenue', 'Bienvenue', 'BIENVENUE10', 'MANUELLE', 10, true, NOW(), NULL, NULL, 0, true, 'user_admin', NOW(), NOW())
ON CONFLICT (code) DO NOTHING;

-- Abonnements : 1 ACTIF EXONERATION (site_01) + 1 EN_GRACE DECOUVERTE (site_client_01)
-- Story 45.2 : site_01 est le site fondateur DKFarm — exonéré (motif obligatoire pour EXONERATION)
INSERT INTO "Abonnement" (id, "siteId", "planId", periode, statut, "dateDebut", "dateFin", "dateProchainRenouvellement", "prixPaye", "motifExoneration", "userId", "createdAt", "updatedAt")
VALUES
  -- Abonnement ACTIF EXONERATION — site fondateur DKFarm (accès complet, prixPaye = 0)
  ('abo_site_01', 'site_01', 'plan_exoneration', 'MENSUEL', 'ACTIF', NOW() - INTERVAL '1 month', NOW() + INTERVAL '11 months', NOW() + INTERVAL '11 months', 0, 'Site fondateur DKFarm', 'user_admin', NOW() - INTERVAL '1 month', NOW()),
  -- Abonnement EN_GRACE — site client Essomba (plan Découverte, mensuel, expiré depuis 3j)
  ('abo_client_01', 'site_client_01', 'plan_decouverte', 'MENSUEL', 'EN_GRACE', NOW() - INTERVAL '33 days', NOW() - INTERVAL '3 days', NOW() - INTERVAL '3 days', 0, NULL, 'user_client_01', NOW() - INTERVAL '33 days', NOW())
ON CONFLICT DO NOTHING;

-- Paiements abonnement :
--   paie_abo_01 : CONFIRME pour abo_site_01 (montant 0 — exonération, enregistrement comptable)
--   paie_abo_02 : CONFIRME pour abo_client_01 (montant 0 — plan Découverte gratuit)
INSERT INTO "PaiementAbonnement" (id, "abonnementId", montant, fournisseur, statut, "initiePar", "dateInitiation", "dateConfirmation", "siteId", "createdAt", "updatedAt")
VALUES
  ('paie_abo_01', 'abo_site_01', 0, 'MANUEL', 'CONFIRME', 'user_admin', NOW() - INTERVAL '1 month', NOW() - INTERVAL '1 month', 'site_01', NOW() - INTERVAL '1 month', NOW()),
  ('paie_abo_02', 'abo_client_01', 0, 'MANUEL', 'CONFIRME', 'user_client_01', NOW() - INTERVAL '33 days', NOW() - INTERVAL '33 days', 'site_client_01', NOW() - INTERVAL '33 days', NOW())
ON CONFLICT DO NOTHING;

-- Commission ingénieur (pour user_ingenieur, sur l''abonnement abo_client_01 site_client_01)
-- L''ingénieur suit site_client_01 ; la commission est rattachée au site DKFarm (site_01)
-- Note: abo_client_01 (DECOUVERTE) est gratuit (prixPaye=0), donc commission = 0 pour demo
INSERT INTO "CommissionIngenieur" (id, "ingenieurId", "siteClientId", "abonnementId", "paiementAbonnementId", montant, taux, statut, "periodeDebut", "periodeFin", "siteId", "createdAt", "updatedAt")
VALUES
  ('comm_ing_01', 'user_ingenieur', 'site_client_01', 'abo_client_01', 'paie_abo_02', 0, 0.10, 'DISPONIBLE', NOW() - INTERVAL '1 month', NOW(), 'site_01', NOW(), NOW())
ON CONFLICT DO NOTHING;

-- Portefeuille ingénieur (1 par ingénieur — @@unique sur ingenieurId)
INSERT INTO "PortefeuilleIngenieur" (id, "ingenieurId", solde, "soldePending", "totalGagne", "totalPaye", "siteId", "updatedAt")
VALUES
  ('portefeuille_ing', 'user_ingenieur', 0, 0, 0, 0, 'site_01', NOW())
ON CONFLICT DO NOTHING;

-- Story 45.2 — AbonnementAudit : enregistrement de la création d''exonération
INSERT INTO "AbonnementAudit" (id, "abonnementId", action, metadata, "userId", "createdAt")
VALUES
  (
    'audit_abo_01',
    'abo_site_01',
    'EXONERATION',
    '{"motif": "Site fondateur DKFarm", "planPrecedent": null, "planNouveau": "EXONERATION"}'::jsonb,
    'user_admin',
    NOW() - INTERVAL '1 month'
  )
ON CONFLICT DO NOTHING;

-- ──────────────────────────────────────────
-- ModuleDefinition (ADR-021) — Registre global des 12 modules
-- Conforme à src/lib/site-modules-config.ts et l'enum SiteModule
-- ──────────────────────────────────────────

INSERT INTO "ModuleDefinition" (id, key, label, description, "iconName", "sortOrder", level, "dependsOn", "isVisible", "isActive", category, "createdAt", "updatedAt")
VALUES
  (gen_random_uuid(), 'REPRODUCTION',       'Reproduction',        'Gestion des reproducteurs, pontes et lots alevins',         'FlaskConical', 1,  'site',     ARRAY[]::TEXT[], true, true, 'elevage',       NOW(), NOW()),
  (gen_random_uuid(), 'GROSSISSEMENT',      'Grossissement',       'Vagues, bacs, relevés et biométrie',                        'Fish',         2,  'site',     ARRAY[]::TEXT[], true, true, 'elevage',       NOW(), NOW()),
  (gen_random_uuid(), 'INTRANTS',           'Intrants',            'Stock, fournisseurs et approvisionnement',                  'Package',      3,  'site',     ARRAY[]::TEXT[], true, true, 'stock',         NOW(), NOW()),
  (gen_random_uuid(), 'VENTES',             'Ventes',              'Clients, ventes, factures et paiements',                    'ShoppingCart', 4,  'site',     ARRAY[]::TEXT[], true, true, 'commercial',    NOW(), NOW()),
  (gen_random_uuid(), 'ANALYSE_PILOTAGE',   'Analyse & Pilotage',  'Analytics, planning et indicateurs KPI',                    'BarChart2',    5,  'site',     ARRAY[]::TEXT[], true, true, 'analyse',       NOW(), NOW()),
  (gen_random_uuid(), 'PACKS_PROVISIONING', 'Packs & Provisioning','Création et activation des packs client',                   'Boxes',        6,  'platform', ARRAY[]::TEXT[], true, true, 'plateforme',    NOW(), NOW()),
  (gen_random_uuid(), 'CONFIGURATION',      'Configuration',       'Paramètres, profils d''élevage et règles',                  'Settings',     7,  'site',     ARRAY[]::TEXT[], true, true, 'admin',         NOW(), NOW()),
  (gen_random_uuid(), 'INGENIEUR',          'Ingénieur',           'Dashboard multi-clients et monitoring',                     'HardHat',      8,  'site',     ARRAY[]::TEXT[], true, true, 'plateforme',    NOW(), NOW()),
  (gen_random_uuid(), 'NOTES',              'Notes',               'Notes et observations partagées',                           'StickyNote',   9,  'site',     ARRAY[]::TEXT[], true, true, 'communication', NOW(), NOW()),
  (gen_random_uuid(), 'ABONNEMENTS',        'Abonnements',         'Gestion des abonnements et plans tarifaires',               'CreditCard',   10, 'platform', ARRAY[]::TEXT[], true, true, 'plateforme',    NOW(), NOW()),
  (gen_random_uuid(), 'COMMISSIONS',        'Commissions',         'Commissions ingénieurs et portefeuilles',                   'TrendingUp',   11, 'platform', ARRAY[]::TEXT[], true, true, 'plateforme',    NOW(), NOW()),
  (gen_random_uuid(), 'REMISES',            'Remises',             'Codes promotionnels et remises',                            'Tag',          12, 'platform', ARRAY[]::TEXT[], true, true, 'plateforme',    NOW(), NOW())
ON CONFLICT (key) DO UPDATE SET
  label       = EXCLUDED.label,
  description = EXCLUDED.description,
  "iconName"  = EXCLUDED."iconName",
  "sortOrder" = EXCLUDED."sortOrder",
  level       = EXCLUDED.level,
  "isVisible" = EXCLUDED."isVisible",
  "isActive"  = EXCLUDED."isActive",
  category    = EXCLUDED.category,
  "updatedAt" = NOW();

-- ──────────────────────────────────────────
-- Feed Analytics (Sprint FA) — enrichissement aliments existants
-- ──────────────────────────────────────────

-- prod_01 : Aliment Croissance 3mm — granulé G2, flottant, phase croissance/grossissement
UPDATE "Produit" SET
  "tailleGranule" = 'G2'::"TailleGranule",
  "formeAliment"  = 'FLOTTANT'::"FormeAliment",
  "tauxProteines" = 38.0,
  "tauxLipides"   = 6.0,
  "tauxFibres"    = 5.0,
  "phasesCibles"  = ARRAY['GROSSISSEMENT', 'FINITION']::"PhaseElevage"[],
  "updatedAt"     = NOW()
WHERE id = 'prod_01';

-- prod_02 : Aliment Demarrage 1mm — granulé P1, poudre/starter, phase alevin/début croissance
UPDATE "Produit" SET
  "tailleGranule" = 'P1'::"TailleGranule",
  "formeAliment"  = 'POUDRE'::"FormeAliment",
  "tauxProteines" = 45.0,
  "tauxLipides"   = 8.0,
  "tauxFibres"    = 3.0,
  "phasesCibles"  = ARRAY['ACCLIMATATION', 'CROISSANCE_DEBUT']::"PhaseElevage"[],
  "updatedAt"     = NOW()
WHERE id = 'prod_02';

-- prod_03 : Farine de poisson — pas de taille granulé (mélange), semi-flottant, toutes phases
UPDATE "Produit" SET
  "tailleGranule" = 'P2'::"TailleGranule",
  "formeAliment"  = 'SEMI_FLOTTANT'::"FormeAliment",
  "tauxProteines" = 55.0,
  "tauxLipides"   = 10.0,
  "tauxFibres"    = 2.0,
  "phasesCibles"  = ARRAY['JUVENILE', 'GROSSISSEMENT']::"PhaseElevage"[],
  "updatedAt"     = NOW()
WHERE id = 'prod_03';

-- Nouvel aliment G3 — gros granulé finition/pré-récolte (grandes tailles)
INSERT INTO "Produit" (id, nom, categorie, unite, "uniteAchat", contenance, "prixUnitaire", "stockActuel", "seuilAlerte", "fournisseurId", "isActive", "tailleGranule", "formeAliment", "tauxProteines", "tauxLipides", "tauxFibres", "phasesCibles", "siteId", "createdAt", "updatedAt")
VALUES (
  'prod_07',
  'Aliment Finition 6mm',
  'ALIMENT',
  'KG',
  'SACS',
  25,
  780,
  80.0,
  40.0,
  'fourn_01',
  true,
  'G3'::"TailleGranule",
  'FLOTTANT'::"FormeAliment",
  30.0,
  5.0,
  6.0,
  ARRAY['FINITION', 'PRE_RECOLTE']::"PhaseElevage"[],
  'site_01',
  NOW(),
  NOW()
);

-- ──────────────────────────────────────────
-- Feed Analytics — enrichissement relevés ALIMENTATION
-- ──────────────────────────────────────────

-- rel_07 : Alimentation normale — taux refus 0%, comportement vorace
UPDATE "Releve" SET
  "tauxRefus"        = 0.0,
  "comportementAlim" = 'VORACE'::"ComportementAlimentaire",
  "updatedAt"        = NOW()
WHERE id = 'rel_07';

-- rel_08 : Alimentation normale — taux refus 10%, comportement normal
UPDATE "Releve" SET
  "tauxRefus"        = 10.0,
  "comportementAlim" = 'NORMAL'::"ComportementAlimentaire",
  "updatedAt"        = NOW()
WHERE id = 'rel_08';

-- rel_09 : Transition aliment — taux refus 25%, comportement normal (changement d'aliment)
UPDATE "Releve" SET
  "tauxRefus"        = 25.0,
  "comportementAlim" = 'NORMAL'::"ComportementAlimentaire",
  "updatedAt"        = NOW()
WHERE id = 'rel_09';

-- rel_10 : Aliment artisanal — taux refus 50%, comportement faible (qualité moindre)
UPDATE "Releve" SET
  "tauxRefus"        = 50.0,
  "comportementAlim" = 'FAIBLE'::"ComportementAlimentaire",
  "updatedAt"        = NOW()
WHERE id = 'rel_10';

-- ──────────────────────────────────────────
-- Feed Analytics — mouvement ENTREE avec DLC et lot de fabrication
-- ──────────────────────────────────────────

-- Réception lot Aliment Finition 6mm avec DLC et numéro de lot
INSERT INTO "MouvementStock" (id, "produitId", type, quantite, "prixTotal", "vagueId", "commandeId", "releveId", "userId", date, notes, "datePeremption", "lotFabrication", "siteId", "createdAt")
VALUES
  ('mvt_09', 'prod_07', 'ENTREE', 80.0, 62400, NULL, NULL, NULL, 'user_admin', '2026-03-01', 'Reception lot finition — controle qualite OK', '2027-03-01', 'LOT-2026-F06-001', 'site_01', NOW()),
  ('mvt_10', 'prod_01', 'ENTREE', 50.0, 42500, NULL, NULL, NULL, 'user_admin', '2026-03-10', 'Reapprovisionnement aliment croissance 3mm', '2027-01-15', 'LOT-2026-C03-002', 'site_01', NOW());

-- ──────────────────────────────────────────
-- FeatureFlags — ADR-maintenance-mode
-- ──────────────────────────────────────────

DELETE FROM "FeatureFlag";

INSERT INTO "FeatureFlag" ("key", "enabled", "updatedAt")
VALUES ('MAINTENANCE_MODE', false, NOW())
ON CONFLICT ("key") DO NOTHING;

COMMIT;

