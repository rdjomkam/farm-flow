-- CreateTable
CREATE TABLE "PackBac" (
    "id" TEXT NOT NULL,
    "packId" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "volume" DOUBLE PRECISION,
    "nombreAlevins" INTEGER NOT NULL,
    "poidsMoyenInitial" DOUBLE PRECISION NOT NULL DEFAULT 5,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PackBac_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PackBac_packId_idx" ON "PackBac"("packId");

-- CreateIndex
CREATE UNIQUE INDEX "PackBac_packId_nom_key" ON "PackBac"("packId", "nom");

-- AddForeignKey
-- Tolérant à l'ordre : sur une base vierge, "Pack" n'existe pas encore à ce
-- stade (elle est créée par 20260320110000_add_packs, postérieure dans la
-- chaîne réelle mais lexicographiquement après celle-ci). Le bloc DO ci-
-- dessous saute silencieusement l'ajout de la contrainte si "Pack" n'existe
-- pas encore — 20260320110000_add_packs l'ajoute alors elle-même une fois
-- "Pack" créée. Sur un environnement où "Pack" existe déjà (ordre réel
-- historique), la contrainte est ajoutée normalement ici.
-- Voir docs/bugs/BUG-CI-migration-order.md.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'Pack') THEN
    ALTER TABLE "PackBac" ADD CONSTRAINT "PackBac_packId_fkey"
      FOREIGN KEY ("packId") REFERENCES "Pack"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
