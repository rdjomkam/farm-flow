-- Seed data for Suivi Silures — Farm Flow
-- Run: docker exec -i silures-db psql -U dkfarm -d farm-flow < prisma/seed.sql

BEGIN;

-- Nettoyage
DELETE FROM "Releve";
DELETE FROM "Bac";
DELETE FROM "Vague";

-- ──────────────────────────────────────────
-- Vagues
-- ──────────────────────────────────────────

INSERT INTO "Vague" (id, code, "dateDebut", "dateFin", "nombreInitial", "poidsMoyenInitial", "origineAlevins", statut, "createdAt", "updatedAt")
VALUES
  ('vague_01', 'VAGUE-2026-01', '2026-01-15', NULL, 500, 8.5, 'Ecloserie Douala', 'EN_COURS', NOW(), NOW()),
  ('vague_02', 'VAGUE-2025-03', '2025-10-01', '2025-12-22', 300, 6.0, 'Ferme Mbalmayo', 'TERMINEE', NOW(), NOW());

-- ──────────────────────────────────────────
-- Bacs (3 pour vague en cours, 1 pour vague terminee)
-- ──────────────────────────────────────────

INSERT INTO "Bac" (id, nom, volume, "nombrePoissons", "vagueId", "createdAt", "updatedAt")
VALUES
  ('bac_01', 'Bac 1', 2000, 170, 'vague_01', NOW(), NOW()),
  ('bac_02', 'Bac 2', 2000, 165, 'vague_01', NOW(), NOW()),
  ('bac_03', 'Bac 3', 1500, 155, 'vague_01', NOW(), NOW()),
  ('bac_04', 'Etang A', 5000, NULL, 'vague_02', NOW(), NOW());

-- ──────────────────────────────────────────
-- Releves — 20 releves varies sur 2 mois
-- ──────────────────────────────────────────

-- Biometries (3)
INSERT INTO "Releve" (id, date, "typeReleve", "vagueId", "bacId", "poidsMoyen", "tailleMoyenne", "echantillonCount", notes, "createdAt", "updatedAt")
VALUES
  ('rel_01', '2026-01-22', 'BIOMETRIE', 'vague_01', 'bac_01', 12.3, 8.5, 30, 'Premiere biometrie apres mise en charge', NOW(), NOW()),
  ('rel_02', '2026-02-05', 'BIOMETRIE', 'vague_01', 'bac_02', 28.7, 13.2, 25, NULL, NOW(), NOW()),
  ('rel_03', '2026-02-19', 'BIOMETRIE', 'vague_01', 'bac_01', 55.4, 18.6, 30, 'Bonne croissance, lot homogene', NOW(), NOW());

-- Mortalites (3)
INSERT INTO "Releve" (id, date, "typeReleve", "vagueId", "bacId", "nombreMorts", "causeMortalite", notes, "createdAt", "updatedAt")
VALUES
  ('rel_04', '2026-01-18', 'MORTALITE', 'vague_01', 'bac_01', 5, 'STRESS', 'Mortalite post-transport, normale', NOW(), NOW()),
  ('rel_05', '2026-01-25', 'MORTALITE', 'vague_01', 'bac_03', 3, 'INCONNUE', NULL, NOW(), NOW()),
  ('rel_06', '2026-02-10', 'MORTALITE', 'vague_01', 'bac_02', 2, 'QUALITE_EAU', 'Pic ammoniac detecte la veille', NOW(), NOW());

-- Alimentation (4)
INSERT INTO "Releve" (id, date, "typeReleve", "vagueId", "bacId", "typeAliment", "quantiteAliment", "frequenceAliment", notes, "createdAt", "updatedAt")
VALUES
  ('rel_07', '2026-01-20', 'ALIMENTATION', 'vague_01', 'bac_01', 'COMMERCIAL', 0.5, 3, NULL, NOW(), NOW()),
  ('rel_08', '2026-01-20', 'ALIMENTATION', 'vague_01', 'bac_02', 'COMMERCIAL', 0.5, 3, NULL, NOW(), NOW()),
  ('rel_09', '2026-02-05', 'ALIMENTATION', 'vague_01', 'bac_01', 'MIXTE', 1.2, 2, 'Transition vers aliment artisanal', NOW(), NOW()),
  ('rel_10', '2026-02-15', 'ALIMENTATION', 'vague_01', 'bac_03', 'ARTISANAL', 1.8, 2, NULL, NOW(), NOW());

-- Qualite eau (3)
INSERT INTO "Releve" (id, date, "typeReleve", "vagueId", "bacId", temperature, ph, oxygene, ammoniac, notes, "createdAt", "updatedAt")
VALUES
  ('rel_11', '2026-01-22', 'QUALITE_EAU', 'vague_01', 'bac_01', 27.5, 7.2, 5.8, 0.02, NULL, NOW(), NOW()),
  ('rel_12', '2026-02-09', 'QUALITE_EAU', 'vague_01', 'bac_02', 28.1, 6.9, 4.5, 0.15, 'Ammoniac eleve — renouvellement eau effectue', NOW(), NOW()),
  ('rel_13', '2026-02-20', 'QUALITE_EAU', 'vague_01', 'bac_03', 26.8, 7.4, 6.2, 0.01, NULL, NOW(), NOW());

-- Comptages (2)
INSERT INTO "Releve" (id, date, "typeReleve", "vagueId", "bacId", "nombreCompte", "methodeComptage", notes, "createdAt", "updatedAt")
VALUES
  ('rel_14', '2026-02-01', 'COMPTAGE', 'vague_01', 'bac_01', 168, 'DIRECT', 'Comptage lors du nettoyage', NOW(), NOW()),
  ('rel_15', '2026-02-15', 'COMPTAGE', 'vague_01', 'bac_03', 152, 'ESTIMATION', NULL, NOW(), NOW());

-- Observations (2)
INSERT INTO "Releve" (id, date, "typeReleve", "vagueId", "bacId", description, "createdAt", "updatedAt")
VALUES
  ('rel_16', '2026-01-28', 'OBSERVATION', 'vague_01', 'bac_02', 'Comportement alimentaire actif, les poissons montent bien a la surface. Pas de signe de stress.', NOW(), NOW()),
  ('rel_17', '2026-02-12', 'OBSERVATION', 'vague_01', 'bac_01', 'Quelques poissons avec des taches blanches sur la peau. Surveiller pour eventuelle maladie fongique.', NOW(), NOW());

-- Releves vague terminee (3)
INSERT INTO "Releve" (id, date, "typeReleve", "vagueId", "bacId", "poidsMoyen", "tailleMoyenne", "echantillonCount", notes, "createdAt", "updatedAt")
VALUES
  ('rel_18', '2025-10-15', 'BIOMETRIE', 'vague_02', 'bac_04', 45.0, 16.0, 20, NULL, NOW(), NOW()),
  ('rel_19', '2025-11-15', 'BIOMETRIE', 'vague_02', 'bac_04', 180.0, 28.5, 20, 'Croissance excellente dans etang', NOW(), NOW());

INSERT INTO "Releve" (id, date, "typeReleve", "vagueId", "bacId", "nombreCompte", "methodeComptage", notes, "createdAt", "updatedAt")
VALUES
  ('rel_20', '2025-12-20', 'COMPTAGE', 'vague_02', 'bac_04', 265, 'ECHANTILLONNAGE', 'Comptage final avant recolte — taux de survie 88%', NOW(), NOW());

COMMIT;
