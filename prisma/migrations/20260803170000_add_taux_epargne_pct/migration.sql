-- PR2-quinquies, story PR2q.2 — l'épargne dans le moteur.
--
-- Ajoute ParametresPrevision.tauxEpargnePct (jeu d'or "Paramètres!B36"),
-- échelle 0..100, NOT NULL avec DEFAULT 30 (R7 — nullabilité explicite :
-- un taux d'épargne absent produirait une épargne silencieusement nulle
-- plutôt qu'un rejet explicite ; 30 % est la valeur du classeur de
-- référence). Le DEFAULT 30 backfille implicitement toutes les lignes
-- existantes, y compris le scénario EXCEL-V12, sans UPDATE explicite.
--
-- Idempotent : no-op si la colonne existe déjà (R10).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'ParametresPrevision'
      AND column_name = 'tauxEpargnePct'
  ) THEN
    ALTER TABLE "ParametresPrevision"
      ADD COLUMN "tauxEpargnePct" DECIMAL(65,30) NOT NULL DEFAULT 30;
  END IF;
END $$;
