-- R1-S4 — Champs étendus : Reproducteur, Ponte, LotAlevins, Releve
-- Ajoute 9 champs sur Reproducteur, 17 sur Ponte, 8 sur LotAlevins, 2 sur Releve
-- Ajoute les back-relations et index correspondants

-- AlterTable
ALTER TABLE "LotAlevins" ADD COLUMN     "dateDebutPhase" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "destinationSortie" "DestinationLot",
ADD COLUMN     "nombreDeformesRetires" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "parentLotId" TEXT,
ADD COLUMN     "phase" "PhaseLot" NOT NULL DEFAULT 'INCUBATION',
ADD COLUMN     "poidsObjectifG" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "Ponte" ADD COLUMN     "causeEchec" "CauseEchecPonte",
ADD COLUMN     "coutHormone" DOUBLE PRECISION,
ADD COLUMN     "coutTotal" DOUBLE PRECISION,
ADD COLUMN     "doseHormone" DOUBLE PRECISION,
ADD COLUMN     "doseMgKg" DOUBLE PRECISION,
ADD COLUMN     "heureInjection" TIMESTAMP(3),
ADD COLUMN     "heureStripping" TIMESTAMP(3),
ADD COLUMN     "latenceTheorique" INTEGER,
ADD COLUMN     "methodeMale" "MethodeExtractionMale",
ADD COLUMN     "motiliteSperme" "MotiliteSperme",
ADD COLUMN     "nombreLarvesViables" INTEGER,
ADD COLUMN     "nombreOeufsEstime" INTEGER,
ADD COLUMN     "poidsOeufsPontesG" DOUBLE PRECISION,
ADD COLUMN     "qualiteOeufs" "QualiteOeufs",
ADD COLUMN     "tauxEclosion" DOUBLE PRECISION,
ADD COLUMN     "temperatureEauC" DOUBLE PRECISION,
ADD COLUMN     "typeHormone" "TypeHormone";

-- AlterTable
ALTER TABLE "Releve" ADD COLUMN     "lotAlevinsId" TEXT;

-- AlterTable
ALTER TABLE "Reproducteur" ADD COLUMN     "bacId" TEXT,
ADD COLUMN     "dernierePonte" TIMESTAMP(3),
ADD COLUMN     "generation" "GenerationGeniteur" NOT NULL DEFAULT 'INCONNUE',
ADD COLUMN     "modeGestion" "ModeGestionGeniteur" NOT NULL DEFAULT 'INDIVIDUEL',
ADD COLUMN     "nombrePontesTotal" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "photo" TEXT,
ADD COLUMN     "pitTag" TEXT,
ADD COLUMN     "sourcing" "SourcingGeniteur" NOT NULL DEFAULT 'ACHAT_FERMIER',
ADD COLUMN     "tempsReposJours" INTEGER;

-- CreateIndex
CREATE INDEX "LotAlevins_parentLotId_idx" ON "LotAlevins"("parentLotId");

-- CreateIndex
CREATE INDEX "LotAlevins_siteId_phase_idx" ON "LotAlevins"("siteId", "phase");

-- CreateIndex
CREATE INDEX "Releve_lotAlevinsId_idx" ON "Releve"("lotAlevinsId");

-- CreateIndex
CREATE INDEX "Reproducteur_bacId_idx" ON "Reproducteur"("bacId");

-- AddForeignKey
ALTER TABLE "Releve" ADD CONSTRAINT "Releve_lotAlevinsId_fkey" FOREIGN KEY ("lotAlevinsId") REFERENCES "LotAlevins"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reproducteur" ADD CONSTRAINT "Reproducteur_bacId_fkey" FOREIGN KEY ("bacId") REFERENCES "Bac"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LotAlevins" ADD CONSTRAINT "LotAlevins_parentLotId_fkey" FOREIGN KEY ("parentLotId") REFERENCES "LotAlevins"("id") ON DELETE SET NULL ON UPDATE CASCADE;
