-- Seed data for Suivi Silures — Farm Flow
-- Run: docker exec -i silures-db psql -U dkfarm -d farm-flow < prisma/seed.sql

BEGIN;

-- Nettoyage (ordre respecte les FK)
DELETE FROM "Session";
DELETE FROM "Activite";
DELETE FROM "Notification";
DELETE FROM "ConfigAlerte";
DELETE FROM "ConfigElevage";
DELETE FROM "PaiementDepense";
DELETE FROM "LigneBesoin";
DELETE FROM "DepenseRecurrente";
DELETE FROM "Depense";
DELETE FROM "ListeBesoins";
DELETE FROM "Paiement";
DELETE FROM "Facture";
DELETE FROM "Vente";
DELETE FROM "Client";
DELETE FROM "ReleveConsommation";
DELETE FROM "LigneCommande";
DELETE FROM "MouvementStock";
DELETE FROM "Commande";
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
DELETE FROM "PackActivation";
DELETE FROM "PackProduit";
DELETE FROM "Pack";
DELETE FROM "RegleActivite";
DELETE FROM "Site";
DELETE FROM "User";

-- ──────────────────────────────────────────
-- Users (3 : admin + gerant + system user)
-- ──────────────────────────────────────────
-- Le system user (isSystem=true) est utilise pour les entites auto-generees lors du provisioning
-- Son passwordHash est un hash impossible a utiliser pour se connecter

INSERT INTO "User" (id, email, phone, name, "passwordHash", role, "isActive", "isSystem", "createdAt", "updatedAt")
VALUES
  ('user_admin', 'admin@dkfarm.cm', '+237699000000', 'Administrateur', '$2b$10$VHWKPywPuVh/szJsFgpiyu3wrTZ00kNz9nBy91QF9FB5WZBdXQUOC', 'ADMIN', true, false, NOW(), NOW()),
  ('user_gerant', 'gerant@dkfarm.cm', '+237677000000', 'Jean Kamga', '$2b$10$VHWKPywPuVh/szJsFgpiyu3wrTZ00kNz9nBy91QF9FB5WZBdXQUOC', 'GERANT', true, false, NOW(), NOW()),
  -- FarmFlow System user — utilise pour les entites auto-generees (provisioning, moteur activites)
  ('system_dkfarm', NULL, NULL, 'FarmFlow System', '$2b$10$SYSTEM_USER_CANNOT_LOGIN_HASH_PLACEHOLDER_XXXX', 'PISCICULTEUR', true, true, NOW(), NOW());

-- ──────────────────────────────────────────
-- Sites (1 ferme principale)
-- ──────────────────────────────────────────

INSERT INTO "Site" (id, name, address, "isActive", "createdAt", "updatedAt")
VALUES
  ('site_01', 'Ferme Douala', 'Douala, Littoral, Cameroun', true, NOW(), NOW());

-- ──────────────────────────────────────────
-- SiteRole (3 roles systeme pour site_01)
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
      'PLANNING_VOIR',
      'PLANNING_GERER',
      'FINANCES_VOIR',
      'FINANCES_GERER',
      'DASHBOARD_VOIR',
      'ALERTES_VOIR',
      'EXPORT_DONNEES'
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
      'PLANNING_VOIR',
      'PLANNING_GERER',
      'FINANCES_VOIR',
      'FINANCES_GERER',
      'DASHBOARD_VOIR',
      'ALERTES_VOIR',
      'EXPORT_DONNEES'
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
      'ALERTES_VOIR'
    ]::"Permission"[],
    true,
    'site_01',
    NOW(),
    NOW()
  );

-- ──────────────────────────────────────────
-- SiteMember (admin + gerant sur site_01)
-- Utilise siteRoleId au lieu de role + permissions
-- ──────────────────────────────────────────

INSERT INTO "SiteMember" (id, "userId", "siteId", "siteRoleId", "isActive", "createdAt", "updatedAt")
VALUES
  ('sm_01', 'user_admin',  'site_01', 'sr_admin_site_01',  true, NOW(), NOW()),
  ('sm_02', 'user_gerant', 'site_01', 'sr_gerant_site_01', true, NOW(), NOW());

-- ──────────────────────────────────────────
-- Vagues (2 : en cours + terminee)
-- ──────────────────────────────────────────

INSERT INTO "Vague" (id, code, "dateDebut", "dateFin", "nombreInitial", "poidsMoyenInitial", "origineAlevins", statut, "siteId", "createdAt", "updatedAt")
VALUES
  ('vague_01', 'VAGUE-2026-01', '2026-01-15', NULL, 500, 8.5, 'Ecloserie Douala', 'EN_COURS', 'site_01', NOW(), NOW()),
  ('vague_02', 'VAGUE-2025-03', '2025-10-01', '2025-12-22', 300, 6.0, 'Ferme Mbalmayo', 'TERMINEE', 'site_01', NOW(), NOW());

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
-- ListeBesoins (3 listes — statuts variés) + LigneBesoin (8 lignes)
-- ──────────────────────────────────────────

INSERT INTO "ListeBesoins" (
  "id", "numero", "titre",
  "demandeurId", "valideurId", "vagueId",
  "statut", "montantEstime", "montantReel", "motifRejet", "notes",
  "siteId", "createdAt", "updatedAt"
) VALUES
  -- bes_01: SOUMISE — en attente d'approbation
  (
    'bes_01', 'BES-2026-001',
    'Besoins alimentation vague Mars 2026',
    'user_gerant', NULL, 'vague_01',
    'SOUMISE', 95000.0, NULL, NULL,
    'Besoins pour le prochain cycle d''alimentation',
    'site_01', NOW(), NOW()
  ),
  -- bes_02: APPROUVEE — validee, en attente de traitement
  (
    'bes_02', 'BES-2026-002',
    'Equipements entretien bacs',
    'user_gerant', 'user_admin', NULL,
    'APPROUVEE', 45000.0, NULL, NULL,
    'Materiel d''entretien prioritaire',
    'site_01', NOW(), NOW()
  ),
  -- bes_03: CLOTUREE — completement traitee
  (
    'bes_03', 'BES-2026-003',
    'Intrants traitement preventif',
    'user_gerant', 'user_admin', 'vague_01',
    'CLOTUREE', 30000.0, 28500.0, NULL,
    'Traitement preventif realise en fevrier',
    'site_01', NOW(), NOW()
  );

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
    5.0, 'flacons',
    2000.0, NULL, NULL,
    NOW()
  ),
  -- bes_02 (APPROUVEE) — 3 lignes
  (
    'lb_04', 'bes_02',
    'Filet de protection bacs', NULL,
    2.0, 'rouleaux',
    8000.0, NULL, NULL,
    NOW()
  ),
  (
    'lb_05', 'bes_02',
    'Tuyaux PVC 20mm', NULL,
    10.0, 'metres',
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
    20.0, 'kg',
    600.0, 570.0, NULL,
    NOW()
  ),
  (
    'lb_08', 'bes_03',
    'Antibiotique preventif', NULL,
    2.0, 'boites',
    9000.0, 8430.0, NULL,
    NOW()
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
    false, true,
    'site_01', NOW(), NOW()
  );

-- ============================================================
-- SPRINT 20 : Packs & Provisioning
-- ============================================================

-- Packs
INSERT INTO "Pack" (id, nom, description, "nombreAlevins", "poidsMoyenInitial", "prixTotal", "configElevageId", "isActive", "userId", "siteId", "createdAt", "updatedAt")
VALUES
  (
    'pack_01',
    'Pack Decouverte 100',
    'Kit de demarrage pour 100 alevins. Ideal pour les pisciculteurs debutants. Inclut aliments et intrants pour 30 jours.',
    100, 5.0, 85000.0,
    'cfg_01',
    true,
    'user_admin', 'site_01', NOW(), NOW()
  ),
  (
    'pack_02',
    'Pack Starter 300',
    'Kit standard pour 300 alevins. Production semi-intensive. Inclut aliments, intrants et materiel de base.',
    300, 5.0, 220000.0,
    'cfg_01',
    true,
    'user_admin', 'site_01', NOW(), NOW()
  ),
  (
    'pack_03',
    'Pack Pro 500',
    'Kit professionnel pour 500 alevins. Production intensive optimisee. Config Clarias Express incluse.',
    500, 5.0, 350000.0,
    'cfg_02',
    true,
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

COMMIT;
