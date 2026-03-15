-- Sprint 23 — Monitoring Ingénieur
-- Ajout de l'enum VisibiliteNote et du modele NoteIngenieur

-- CreateEnum
CREATE TYPE "VisibiliteNote" AS ENUM ('PUBLIC', 'INTERNE');

-- CreateTable
CREATE TABLE "NoteIngenieur" (
    "id" TEXT NOT NULL,
    "titre" TEXT NOT NULL,
    "contenu" TEXT NOT NULL,
    "visibility" "VisibiliteNote" NOT NULL,
    "isUrgent" BOOLEAN NOT NULL DEFAULT false,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "isFromClient" BOOLEAN NOT NULL DEFAULT false,
    "observationTexte" TEXT,
    "ingenieurId" TEXT NOT NULL,
    "clientSiteId" TEXT NOT NULL,
    "vagueId" TEXT,
    "siteId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NoteIngenieur_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NoteIngenieur_siteId_idx" ON "NoteIngenieur"("siteId");

-- CreateIndex
CREATE INDEX "NoteIngenieur_clientSiteId_idx" ON "NoteIngenieur"("clientSiteId");

-- CreateIndex
CREATE INDEX "NoteIngenieur_ingenieurId_idx" ON "NoteIngenieur"("ingenieurId");

-- CreateIndex
CREATE INDEX "NoteIngenieur_vagueId_idx" ON "NoteIngenieur"("vagueId");

-- CreateIndex
CREATE INDEX "NoteIngenieur_visibility_idx" ON "NoteIngenieur"("visibility");

-- CreateIndex
CREATE INDEX "NoteIngenieur_isFromClient_idx" ON "NoteIngenieur"("isFromClient");

-- CreateIndex
CREATE INDEX "NoteIngenieur_isRead_idx" ON "NoteIngenieur"("isRead");

-- CreateIndex
CREATE INDEX "NoteIngenieur_clientSiteId_isRead_idx" ON "NoteIngenieur"("clientSiteId", "isRead");

-- CreateIndex
CREATE INDEX "NoteIngenieur_clientSiteId_visibility_idx" ON "NoteIngenieur"("clientSiteId", "visibility");

-- AddForeignKey
ALTER TABLE "NoteIngenieur" ADD CONSTRAINT "NoteIngenieur_ingenieurId_fkey" FOREIGN KEY ("ingenieurId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoteIngenieur" ADD CONSTRAINT "NoteIngenieur_clientSiteId_fkey" FOREIGN KEY ("clientSiteId") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoteIngenieur" ADD CONSTRAINT "NoteIngenieur_vagueId_fkey" FOREIGN KEY ("vagueId") REFERENCES "Vague"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoteIngenieur" ADD CONSTRAINT "NoteIngenieur_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
