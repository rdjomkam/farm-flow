-- Migration : 20260319120000_add_besoin_date_limite
-- ADR-017.2 — Date limite sur ListeBesoins + BESOIN_EN_RETARD dans TypeAlerte

-- 1. Ajouter dateLimite sur ListeBesoins
ALTER TABLE "ListeBesoins" ADD COLUMN "dateLimite" TIMESTAMP(3);
CREATE INDEX "ListeBesoins_dateLimite_idx" ON "ListeBesoins"("dateLimite");

-- 2. Recreer l'enum TypeAlerte pour ajouter BESOIN_EN_RETARD
--    (strategie RECREATE : rename old → create new → cast → drop old)
ALTER TYPE "TypeAlerte" RENAME TO "TypeAlerte_old";

CREATE TYPE "TypeAlerte" AS ENUM (
  'MORTALITE_ELEVEE',
  'QUALITE_EAU',
  'STOCK_BAS',
  'RAPPEL_ALIMENTATION',
  'RAPPEL_BIOMETRIE',
  'PERSONNALISEE',
  'BESOIN_EN_RETARD'
);

ALTER TABLE "ConfigAlerte"
  ALTER COLUMN "typeAlerte" TYPE "TypeAlerte"
  USING "typeAlerte"::text::"TypeAlerte";

ALTER TABLE "Notification"
  ALTER COLUMN "typeAlerte" TYPE "TypeAlerte"
  USING "typeAlerte"::text::"TypeAlerte";

DROP TYPE "TypeAlerte_old";
