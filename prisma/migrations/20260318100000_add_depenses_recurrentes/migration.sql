-- Migration Sprint 18 — DepenseRecurrente
-- Adds: DepenseRecurrente model (templates pour génération automatique de dépenses)

-- CreateTable
CREATE TABLE "DepenseRecurrente" (
    "id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "categorieDepense" "CategorieDepense" NOT NULL,
    "montantEstime" DOUBLE PRECISION NOT NULL,
    "frequence" "FrequenceRecurrence" NOT NULL,
    "jourDuMois" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "derniereGeneration" TIMESTAMP(3),
    "userId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DepenseRecurrente_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DepenseRecurrente_siteId_idx" ON "DepenseRecurrente"("siteId");
CREATE INDEX "DepenseRecurrente_siteId_isActive_idx" ON "DepenseRecurrente"("siteId", "isActive");
CREATE INDEX "DepenseRecurrente_siteId_frequence_idx" ON "DepenseRecurrente"("siteId", "frequence");

-- AddForeignKey
ALTER TABLE "DepenseRecurrente" ADD CONSTRAINT "DepenseRecurrente_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DepenseRecurrente" ADD CONSTRAINT "DepenseRecurrente_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddConstraint jourDuMois entre 1 et 28
ALTER TABLE "DepenseRecurrente" ADD CONSTRAINT "DepenseRecurrente_jourDuMois_check" CHECK ("jourDuMois" >= 1 AND "jourDuMois" <= 28);
