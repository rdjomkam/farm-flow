-- R1-S3: Add LotGeniteurs, Incubation, TraitementIncubation models
-- Also modifies Ponte (add lotGeniteursFemellId, lotGeniteursMaleId, incubations back-relation)
-- and LotAlevins (add incubationId FK)

-- AlterTable Ponte: add LotGeniteurs FK fields
ALTER TABLE "Ponte" ADD COLUMN "lotGeniteursFemellId" TEXT,
ADD COLUMN "lotGeniteursMaleId" TEXT;

-- AlterTable LotAlevins: add Incubation FK field
ALTER TABLE "LotAlevins" ADD COLUMN "incubationId" TEXT;

-- CreateTable LotGeniteurs
CREATE TABLE "LotGeniteurs" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "sexe" "SexeReproducteur" NOT NULL,
    "nombrePoissons" INTEGER NOT NULL,
    "poidsMoyenG" DOUBLE PRECISION,
    "poidsMinG" DOUBLE PRECISION,
    "poidsMaxG" DOUBLE PRECISION,
    "origine" TEXT,
    "sourcing" "SourcingGeniteur" NOT NULL DEFAULT 'ACHAT_FERMIER',
    "generation" "GenerationGeniteur" NOT NULL DEFAULT 'INCONNUE',
    "dateAcquisition" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "nombreMalesDisponibles" INTEGER,
    "seuilAlerteMales" INTEGER,
    "dateRenouvellementGenetique" TIMESTAMP(3),
    "bacId" TEXT,
    "statut" "StatutReproducteur" NOT NULL DEFAULT 'ACTIF',
    "notes" TEXT,
    "siteId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LotGeniteurs_pkey" PRIMARY KEY ("id")
);

-- CreateTable Incubation
CREATE TABLE "Incubation" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "ponteId" TEXT NOT NULL,
    "substrat" "SubstratIncubation" NOT NULL DEFAULT 'RACINES_PISTIA',
    "temperatureEauC" DOUBLE PRECISION,
    "dureeIncubationH" INTEGER,
    "dateDebutIncubation" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dateEclosionPrevue" TIMESTAMP(3),
    "dateEclosionReelle" TIMESTAMP(3),
    "nombreOeufsPlaces" INTEGER,
    "nombreLarvesEcloses" INTEGER,
    "tauxEclosion" DOUBLE PRECISION,
    "nombreDeformes" INTEGER,
    "nombreLarvesViables" INTEGER,
    "notesRetrait" TEXT,
    "statut" "StatutIncubation" NOT NULL DEFAULT 'EN_COURS',
    "notes" TEXT,
    "siteId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Incubation_pkey" PRIMARY KEY ("id")
);

-- CreateTable TraitementIncubation
CREATE TABLE "TraitementIncubation" (
    "id" TEXT NOT NULL,
    "incubationId" TEXT NOT NULL,
    "produit" TEXT NOT NULL,
    "concentration" TEXT NOT NULL,
    "dureeMinutes" INTEGER NOT NULL,
    "heure" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "siteId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TraitementIncubation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LotGeniteurs_code_key" ON "LotGeniteurs"("code");
CREATE INDEX "LotGeniteurs_siteId_idx" ON "LotGeniteurs"("siteId");
CREATE INDEX "LotGeniteurs_siteId_sexe_idx" ON "LotGeniteurs"("siteId", "sexe");
CREATE INDEX "LotGeniteurs_siteId_statut_idx" ON "LotGeniteurs"("siteId", "statut");
CREATE INDEX "LotGeniteurs_bacId_idx" ON "LotGeniteurs"("bacId");

CREATE UNIQUE INDEX "Incubation_code_key" ON "Incubation"("code");
CREATE INDEX "Incubation_siteId_idx" ON "Incubation"("siteId");
CREATE INDEX "Incubation_ponteId_idx" ON "Incubation"("ponteId");

CREATE INDEX "TraitementIncubation_incubationId_idx" ON "TraitementIncubation"("incubationId");
CREATE INDEX "TraitementIncubation_siteId_idx" ON "TraitementIncubation"("siteId");

CREATE INDEX "LotAlevins_incubationId_idx" ON "LotAlevins"("incubationId");

CREATE INDEX "Ponte_lotGeniteursFemellId_idx" ON "Ponte"("lotGeniteursFemellId");
CREATE INDEX "Ponte_lotGeniteursMaleId_idx" ON "Ponte"("lotGeniteursMaleId");

-- AddForeignKey LotGeniteurs
ALTER TABLE "LotGeniteurs" ADD CONSTRAINT "LotGeniteurs_bacId_fkey" FOREIGN KEY ("bacId") REFERENCES "Bac"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LotGeniteurs" ADD CONSTRAINT "LotGeniteurs_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey Incubation
ALTER TABLE "Incubation" ADD CONSTRAINT "Incubation_ponteId_fkey" FOREIGN KEY ("ponteId") REFERENCES "Ponte"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Incubation" ADD CONSTRAINT "Incubation_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey TraitementIncubation
ALTER TABLE "TraitementIncubation" ADD CONSTRAINT "TraitementIncubation_incubationId_fkey" FOREIGN KEY ("incubationId") REFERENCES "Incubation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TraitementIncubation" ADD CONSTRAINT "TraitementIncubation_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey Ponte (new FK columns)
ALTER TABLE "Ponte" ADD CONSTRAINT "Ponte_lotGeniteursFemellId_fkey" FOREIGN KEY ("lotGeniteursFemellId") REFERENCES "LotGeniteurs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Ponte" ADD CONSTRAINT "Ponte_lotGeniteursMaleId_fkey" FOREIGN KEY ("lotGeniteursMaleId") REFERENCES "LotGeniteurs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey LotAlevins (new incubationId FK)
ALTER TABLE "LotAlevins" ADD CONSTRAINT "LotAlevins_incubationId_fkey" FOREIGN KEY ("incubationId") REFERENCES "Incubation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
