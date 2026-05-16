-- Ajoute AVARIE à l'enum CauseMortalite (pertes en élevage enregistrées comme mortalité)
ALTER TYPE "CauseMortalite" ADD VALUE IF NOT EXISTS 'AVARIE' BEFORE 'INCONNUE';
