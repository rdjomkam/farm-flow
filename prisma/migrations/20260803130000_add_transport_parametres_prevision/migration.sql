-- Réserve n°3 de docs/reviews/review-sprint-PR1.md : modéliser les capacités
-- et coûts de transport (aliments, poissons, alevins) sur ParametresPrevision,
-- comblant le "GAP DE MODELE" documenté en en-tête de
-- src/lib/previsions/logistique.ts (jeu d'or "Paramètres!B25:B30").
--
-- Valeurs par défaut = jeu d'or (ADR-053 §7). NOT NULL : ces paramètres
-- entrent dans base_repartition via logistique.sousTotal, jamais de COALESCE
-- implicite (voir commentaire schema.prisma).

-- AlterTable
ALTER TABLE "ParametresPrevision" ADD COLUMN     "capaciteTransportAlevinsNb" INTEGER NOT NULL DEFAULT 20000,
ADD COLUMN     "capaciteTransportAlimentsSacs" INTEGER NOT NULL DEFAULT 60,
ADD COLUMN     "capaciteTransportPoissonsKg" INTEGER NOT NULL DEFAULT 1500,
ADD COLUMN     "coutTransportAlevinsFCFA" DECIMAL(65,30) NOT NULL DEFAULT 30000,
ADD COLUMN     "coutTransportAlimentsFCFA" DECIMAL(65,30) NOT NULL DEFAULT 15000,
ADD COLUMN     "coutTransportPoissonsFCFA" DECIMAL(65,30) NOT NULL DEFAULT 25000;

-- Contraintes de validité (précédent : DepenseRecurrente_jourDuMois_check,
-- migration 20260318100000_add_depenses_recurrentes). Capacités strictement
-- positives (une capacité <= 0 est un paramètre invalide, pas un "aucun
-- transport" — cf. calculerVoyages dans logistique.ts, qui gère lui-même le
-- cas capacite<=0 comme "0 voyage" côté moteur, mais ce n'est pas une raison
-- pour tolérer une valeur invalide en base) ; coûts jamais négatifs.
ALTER TABLE "ParametresPrevision" ADD CONSTRAINT "ParametresPrevision_capaciteTransportAlimentsSacs_check" CHECK ("capaciteTransportAlimentsSacs" > 0);
ALTER TABLE "ParametresPrevision" ADD CONSTRAINT "ParametresPrevision_capaciteTransportPoissonsKg_check" CHECK ("capaciteTransportPoissonsKg" > 0);
ALTER TABLE "ParametresPrevision" ADD CONSTRAINT "ParametresPrevision_capaciteTransportAlevinsNb_check" CHECK ("capaciteTransportAlevinsNb" > 0);
ALTER TABLE "ParametresPrevision" ADD CONSTRAINT "ParametresPrevision_coutTransportAlimentsFCFA_check" CHECK ("coutTransportAlimentsFCFA" >= 0);
ALTER TABLE "ParametresPrevision" ADD CONSTRAINT "ParametresPrevision_coutTransportPoissonsFCFA_check" CHECK ("coutTransportPoissonsFCFA" >= 0);
ALTER TABLE "ParametresPrevision" ADD CONSTRAINT "ParametresPrevision_coutTransportAlevinsFCFA_check" CHECK ("coutTransportAlevinsFCFA" >= 0);
