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
-- "enabledModules" est normalement ajoutée par 20260317120000_add_site_modules
-- (postérieure dans la chaîne réelle mais lexicographiquement AVANT cette
-- migration qui crée la table). Elle est donc définie ici dès la création,
-- pour qu'une base vierge (qui applique 20260317120000 avant que "Pack"
-- existe, en no-op) obtienne malgré tout la colonne. Voir
-- docs/bugs/BUG-CI-migration-order.md.
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
    "enabledModules" "SiteModule"[] DEFAULT ARRAY[]::"SiteModule"[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Pack_pkey" PRIMARY KEY ("id")
);

-- ──────────────────────────────────────────
-- 5. Create table PackProduit
-- ──────────────────────────────────────────
-- "unite" est normalement ajoutée par 20260316120000_add_unite_pack_produit
-- (postérieure dans la chaîne réelle mais lexicographiquement AVANT cette
-- migration qui crée la table). Elle est donc définie ici dès la création,
-- pour qu'une base vierge (qui applique 20260316120000 avant que
-- "PackProduit" existe, en no-op) obtienne malgré tout la colonne. Voir
-- docs/bugs/BUG-CI-migration-order.md.
CREATE TABLE "PackProduit" (
    "id" TEXT NOT NULL,
    "packId" TEXT NOT NULL,
    "produitId" TEXT NOT NULL,
    "quantite" DOUBLE PRECISION NOT NULL,
    "unite" "UniteStock",

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

-- "PackBac_packId_fkey" est normalement ajoutée par
-- 20260317200000_add_pack_bacs (postérieure dans la chaîne réelle mais
-- lexicographiquement AVANT cette migration qui crée "Pack"). Sur une base
-- vierge, cette contrainte n'a pas pu être ajoutée là-bas (skip silencieux,
-- "Pack" n'existait pas encore) — elle est donc ajoutée ici, une fois
-- "Pack" créée. Le bloc DO protège contre le cas où elle existe déjà (ordre
-- réel historique où "PackBac" a été créée après "Pack").
-- Voir docs/bugs/BUG-CI-migration-order.md.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'PackBac') THEN
    ALTER TABLE "PackBac" ADD CONSTRAINT "PackBac_packId_fkey"
      FOREIGN KEY ("packId") REFERENCES "Pack"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
