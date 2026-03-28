-- CreateTable
CREATE TABLE "HistoriqueNutritionnel" (
    "id" TEXT NOT NULL,
    "vagueId" TEXT NOT NULL,
    "phase" "PhaseElevage" NOT NULL,
    "fcrMoyen" DOUBLE PRECISION,
    "sgrMoyen" DOUBLE PRECISION,
    "adgMoyen" DOUBLE PRECISION,
    "perMoyen" DOUBLE PRECISION,
    "quantiteAlimentKg" DOUBLE PRECISION,
    "poidsMoyenDebut" DOUBLE PRECISION,
    "poidsMoyenFin" DOUBLE PRECISION,
    "tauxSurvie" DOUBLE PRECISION,
    "dureeJours" INTEGER,
    "siteId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HistoriqueNutritionnel_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HistoriqueNutritionnel_siteId_idx" ON "HistoriqueNutritionnel"("siteId");

-- CreateIndex
CREATE UNIQUE INDEX "HistoriqueNutritionnel_vagueId_phase_key" ON "HistoriqueNutritionnel"("vagueId", "phase");

-- AddForeignKey
ALTER TABLE "HistoriqueNutritionnel" ADD CONSTRAINT "HistoriqueNutritionnel_vagueId_fkey" FOREIGN KEY ("vagueId") REFERENCES "Vague"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HistoriqueNutritionnel" ADD CONSTRAINT "HistoriqueNutritionnel_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
