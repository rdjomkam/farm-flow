-- Seed data for Suivi Silures — Farm Flow
-- Run: docker exec -i silures-db psql -U dkfarm -d farm-flow < prisma/seed.sql

BEGIN;

-- Nettoyage (ordre respecte les FK)
DELETE FROM "Session";
DELETE FROM "Activite";
DELETE FROM "Notification";
DELETE FROM "ConfigAlerte";
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
DELETE FROM "Site";
DELETE FROM "User";

-- ──────────────────────────────────────────
-- Users (2 : admin + gerant)
-- ──────────────────────────────────────────

INSERT INTO "User" (id, email, phone, name, "passwordHash", role, "isActive", "createdAt", "updatedAt")
VALUES
  ('user_admin', 'admin@dkfarm.cm', '+237699000000', 'Administrateur', '$2b$10$VHWKPywPuVh/szJsFgpiyu3wrTZ00kNz9nBy91QF9FB5WZBdXQUOC', 'ADMIN', true, NOW(), NOW()),
  ('user_gerant', 'gerant@dkfarm.cm', '+237677000000', 'Jean Kamga', '$2b$10$VHWKPywPuVh/szJsFgpiyu3wrTZ00kNz9nBy91QF9FB5WZBdXQUOC', 'GERANT', true, NOW(), NOW());

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

COMMIT;
