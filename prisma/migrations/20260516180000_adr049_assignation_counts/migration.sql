-- ADR-049: Add ecartConstate + appliedDelta on Releve for count tracking
-- AssignationBac columns stay as-is (renamed at Prisma level via @map)

ALTER TABLE "Releve" ADD COLUMN "ecartConstate" INTEGER;
ALTER TABLE "Releve" ADD COLUMN "appliedDelta" INTEGER;
