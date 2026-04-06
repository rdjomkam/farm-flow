-- ADR-043 — Modèle Associatif AssignationBac
-- Phase 2 : création de la table de jonction sans supprimer Bac.vagueId (double source de vérité)

-- CreateTable
CREATE TABLE "AssignationBac" (
    "id" TEXT NOT NULL,
    "bacId" TEXT NOT NULL,
    "vagueId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "dateAssignation" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dateFin" TIMESTAMP(3),
    "nombrePoissonsInitial" INTEGER,
    "poidsMoyenInitial" DOUBLE PRECISION,
    "nombrePoissons" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssignationBac_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AssignationBac_bacId_idx" ON "AssignationBac"("bacId");

-- CreateIndex
CREATE INDEX "AssignationBac_vagueId_idx" ON "AssignationBac"("vagueId");

-- CreateIndex
CREATE INDEX "AssignationBac_siteId_idx" ON "AssignationBac"("siteId");

-- CreateIndex
CREATE INDEX "AssignationBac_bacId_dateFin_idx" ON "AssignationBac"("bacId", "dateFin");

-- CreateIndex
CREATE INDEX "AssignationBac_vagueId_dateFin_idx" ON "AssignationBac"("vagueId", "dateFin");

-- Partial unique index — contrainte métier : un bac ne peut avoir qu'une assignation active à la fois
-- Non générée par Prisma, ajoutée manuellement (ADR-043 section 1.2)
CREATE UNIQUE INDEX "AssignationBac_bacId_active_unique" ON "AssignationBac"("bacId") WHERE "dateFin" IS NULL;

-- AddForeignKey
ALTER TABLE "AssignationBac" ADD CONSTRAINT "AssignationBac_bacId_fkey" FOREIGN KEY ("bacId") REFERENCES "Bac"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssignationBac" ADD CONSTRAINT "AssignationBac_vagueId_fkey" FOREIGN KEY ("vagueId") REFERENCES "Vague"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssignationBac" ADD CONSTRAINT "AssignationBac_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
