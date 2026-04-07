-- R3-S5 — Rendre vagueId et bacId nullable sur Releve (ADR-044 §5.2)
-- Les relevés de lots d'alevins (lotAlevinsId renseigné) n'ont pas de vagueId/bacId

ALTER TABLE "Releve" ALTER COLUMN "vagueId" DROP NOT NULL;
ALTER TABLE "Releve" ALTER COLUMN "bacId" DROP NOT NULL;
