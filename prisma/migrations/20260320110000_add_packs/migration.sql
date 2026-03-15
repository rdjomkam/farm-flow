-- Migration Sprint 20 — Pack, PackProduit, PackActivation
-- Adds: isSystem on User, Bac.volume nullable, Vague FK fields, 3 new Pack models

-- ──────────────────────────────────────────
-- 1. Add isSystem field on User
-- ──────────────────────────────────────────
ALTER TABLE "User" ADD COLUMN "isSystem" BOOLEAN NOT NULL DEFAULT false;

-- ──────────────────────────────────────────
-- 2. Make Bac.volume nullable (for provisioning EC-2.4)
-- ──────────────────────────────────────────
ALTER TABLE "Bac" ALTER COLUMN "volume" DROP NOT NULL;

-- ──────────────────────────────────────────
-- 3. Add configElevageId and packActivationId to Vague
-- ──────────────────────────────────────────
ALTER TABLE "Vague" ADD COLUMN "configElevageId" TEXT;
ALTER TABLE "Vague" ADD COLUMN "packActivationId" TEXT;

-- ──────────────────────────────────────────
-- 4. Create table Pack
-- ──────────────────────────────────────────
CREATE TABLE "Pack" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "description" TEXT,
    "nombreAlevins" INTEGER NOT NULL,
    "poidsMoyenInitial" DOUBLE PRECISION NOT NULL DEFAULT 5,
    "prixTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "configElevageId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "userId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Pack_pkey" PRIMARY KEY ("id")
);

-- ──────────────────────────────────────────
-- 5. Create table PackProduit
-- ──────────────────────────────────────────
CREATE TABLE "PackProduit" (
    "id" TEXT NOT NULL,
    "packId" TEXT NOT NULL,
    "produitId" TEXT NOT NULL,
    "quantite" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "PackProduit_pkey" PRIMARY KEY ("id")
);

-- ──────────────────────────────────────────
-- 6. Create table PackActivation
-- ──────────────────────────────────────────
CREATE TABLE "PackActivation" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "packId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "clientSiteId" TEXT NOT NULL,
    "statut" "StatutActivation" NOT NULL DEFAULT 'ACTIVE',
    "dateActivation" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dateExpiration" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PackActivation_pkey" PRIMARY KEY ("id")
);

-- ──────────────────────────────────────────
-- 7. Create indexes
-- ──────────────────────────────────────────
CREATE INDEX "Pack_siteId_idx" ON "Pack"("siteId");
CREATE INDEX "Pack_configElevageId_idx" ON "Pack"("configElevageId");
CREATE INDEX "Pack_userId_idx" ON "Pack"("userId");

CREATE INDEX "PackProduit_packId_idx" ON "PackProduit"("packId");
CREATE INDEX "PackProduit_produitId_idx" ON "PackProduit"("produitId");
CREATE UNIQUE INDEX "PackProduit_packId_produitId_key" ON "PackProduit"("packId", "produitId");

CREATE UNIQUE INDEX "PackActivation_code_key" ON "PackActivation"("code");
CREATE INDEX "PackActivation_siteId_idx" ON "PackActivation"("siteId");
CREATE INDEX "PackActivation_clientSiteId_idx" ON "PackActivation"("clientSiteId");
CREATE INDEX "PackActivation_packId_idx" ON "PackActivation"("packId");
CREATE INDEX "PackActivation_userId_idx" ON "PackActivation"("userId");
CREATE INDEX "PackActivation_code_idx" ON "PackActivation"("code");
CREATE INDEX "PackActivation_statut_idx" ON "PackActivation"("statut");

CREATE INDEX "Vague_configElevageId_idx" ON "Vague"("configElevageId");
CREATE INDEX "Vague_packActivationId_idx" ON "Vague"("packActivationId");

-- ──────────────────────────────────────────
-- 8. Add foreign keys
-- ──────────────────────────────────────────
ALTER TABLE "Vague" ADD CONSTRAINT "Vague_configElevageId_fkey"
    FOREIGN KEY ("configElevageId") REFERENCES "ConfigElevage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Vague" ADD CONSTRAINT "Vague_packActivationId_fkey"
    FOREIGN KEY ("packActivationId") REFERENCES "PackActivation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Pack" ADD CONSTRAINT "Pack_configElevageId_fkey"
    FOREIGN KEY ("configElevageId") REFERENCES "ConfigElevage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Pack" ADD CONSTRAINT "Pack_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Pack" ADD CONSTRAINT "Pack_siteId_fkey"
    FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PackProduit" ADD CONSTRAINT "PackProduit_packId_fkey"
    FOREIGN KEY ("packId") REFERENCES "Pack"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PackProduit" ADD CONSTRAINT "PackProduit_produitId_fkey"
    FOREIGN KEY ("produitId") REFERENCES "Produit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PackActivation" ADD CONSTRAINT "PackActivation_packId_fkey"
    FOREIGN KEY ("packId") REFERENCES "Pack"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PackActivation" ADD CONSTRAINT "PackActivation_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PackActivation" ADD CONSTRAINT "PackActivation_siteId_fkey"
    FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PackActivation" ADD CONSTRAINT "PackActivation_clientSiteId_fkey"
    FOREIGN KEY ("clientSiteId") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
