-- Add actif flag to PostePrevision (default true = backwards compatible)
ALTER TABLE "PostePrevision" ADD COLUMN "actif" BOOLEAN NOT NULL DEFAULT true;

-- Add actif flag to ApportCapital (default true = backwards compatible)
ALTER TABLE "ApportCapital" ADD COLUMN "actif" BOOLEAN NOT NULL DEFAULT true;
