-- Rollback: add_feed_analytics
-- Sprint FA — Feed Analytics Phase 1
-- Annule la migration 20260404000000_add_feed_analytics
--
-- IMPORTANT : exécuter dans cet ordre pour éviter les dépendances

-- Supprimer les colonnes ajoutées sur Releve
ALTER TABLE "Releve"
  DROP COLUMN IF EXISTS "comportementAlim",
  DROP COLUMN IF EXISTS "tauxRefus";

-- Supprimer les colonnes ajoutées sur Produit
-- Note : phasesCibles utilise l'enum PhaseElevage qui reste (il existait avant)
ALTER TABLE "Produit"
  DROP COLUMN IF EXISTS "formeAliment",
  DROP COLUMN IF EXISTS "phasesCibles",
  DROP COLUMN IF EXISTS "tailleGranule",
  DROP COLUMN IF EXISTS "tauxFibres",
  DROP COLUMN IF EXISTS "tauxLipides",
  DROP COLUMN IF EXISTS "tauxProteines";

-- Supprimer les colonnes ajoutées sur MouvementStock
ALTER TABLE "MouvementStock"
  DROP COLUMN IF EXISTS "datePeremption",
  DROP COLUMN IF EXISTS "lotFabrication";

-- Supprimer la colonne ajoutée sur ConfigElevage
ALTER TABLE "ConfigElevage"
  DROP COLUMN IF EXISTS "scoreAlimentConfig";

-- Supprimer les 3 enums créés par cette migration
DROP TYPE IF EXISTS "ComportementAlimentaire";
DROP TYPE IF EXISTS "FormeAliment";
DROP TYPE IF EXISTS "TailleGranule";
