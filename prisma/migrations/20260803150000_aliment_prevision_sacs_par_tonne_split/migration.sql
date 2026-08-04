-- ADR-053, amendement Sprint PR2 (section 11) : leve l'homonymie entre le pur ratio
-- d'unite de poids (1000 / poidsSacKg) et le coefficient de besoin en aliment par
-- tonne de POISSON produit, qui n'avait jamais eu de colonne dans le schema.
--
-- IMPORTANT : `prisma migrate diff` genere naivement un DROP COLUMN + ADD COLUMN pour
-- ce renommage (il ne detecte pas les renommages), ce qui detruirait les donnees
-- existantes. On utilise ici un vrai RENAME COLUMN pour preserver les valeurs.

-- AlterTable
ALTER TABLE "AlimentPrevision" RENAME COLUMN "sacsParTonne" TO "sacsParTonneUnitaire";
ALTER TABLE "AlimentPrevision" ADD COLUMN "sacsParTonneStandard" DECIMAL(65,30);
