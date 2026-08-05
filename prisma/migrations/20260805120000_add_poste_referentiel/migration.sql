-- ADR-053 §16 (story A.4) — PosteReferentiel : corrige le defaut structurel de
-- MappingRapprochement.cibleId pour POSTE_PREVISION (ERR-179). PostePrevision.id est
-- scenario-scope (onDelete: Cascade) alors que MappingRapprochement est site-scope : un id de
-- PostePrevision stocke dans cibleId devient orphelin des qu'un nouveau scenario est cree.
-- PosteReferentiel est site-scope, symetrique du scope de MappingRapprochement lui-meme.
--
-- Migration en 2 temps dans un seul dossier (R10) :
--   1. CREATE TABLE "PosteReferentiel" + ALTER TABLE "PostePrevision" ADD COLUMN nullable.
--   2. Backfill : pour chaque PostePrevision existant, get-or-create l'entree PosteReferentiel
--      du meme site par slug du libelle (regle de normalisation §16.11, meme resultat que
--      src/lib/previsions/sluggifier-poste.ts::sluggifierLibellePoste — un seul point de verite).
--   3. Garde-fou de precondition (R10) : RAISE EXCEPTION si une ligne reste sans
--      posteReferentielId apres backfill.
--   4. SET NOT NULL + FK Restrict + index.
--
-- Idempotente : chaque etape est un no-op silencieux si deja appliquee (IF NOT EXISTS / valeur
-- cible, jamais un delta relatif). Aucune donnee metier existante n'est modifiee ou supprimee —
-- seule la nouvelle colonne posteReferentielId est backfillee et une nouvelle table est peuplee.

-- ──────────────────────────────────────────────────────────────────────────
-- 1. Nouvelle table + colonne nullable
-- ──────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "PosteReferentiel" (
    "id"        TEXT NOT NULL,
    "siteId"    TEXT NOT NULL,
    "code"      TEXT NOT NULL,
    "libelle"   TEXT NOT NULL,
    "actif"     BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PosteReferentiel_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PosteReferentiel_siteId_code_key"
    ON "PosteReferentiel"("siteId", "code");

CREATE INDEX IF NOT EXISTS "PosteReferentiel_siteId_actif_idx"
    ON "PosteReferentiel"("siteId", "actif");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'PosteReferentiel_siteId_fkey'
  ) THEN
    ALTER TABLE "PosteReferentiel"
      ADD CONSTRAINT "PosteReferentiel_siteId_fkey"
      FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

ALTER TABLE "PostePrevision" ADD COLUMN IF NOT EXISTS "posteReferentielId" TEXT;

-- ──────────────────────────────────────────────────────────────────────────
-- 2. Backfill — get-or-create PosteReferentiel par slug du libelle, par site.
--    Meme regle de normalisation que sluggifierLibellePoste (§16.11) :
--      a. suppression des diacritiques (translittere les caracteres latins accentues courants,
--         equivalent pratique de la normalisation NFD + suppression U+0300-U+036F pour les
--         libelles reellement presents en base — francais) ;
--      b. minuscules ;
--      c. toute suite de caracteres hors [a-z0-9] -> un seul '-' ;
--      d. trim des '-' en tete/fin ;
--      e. chaine vide -> RAISE EXCEPTION (jamais de code vide insere) ;
--      f. troncature a 100 caracteres, au dernier '-' avant la limite, puis nouveau trim.
-- ──────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  rec RECORD;
  slug TEXT;
  ref_id TEXT;
  src_chars TEXT := 'ÀÁÂÃÄÅàáâãäåÈÉÊËèéêëÌÍÎÏìíîïÒÓÔÕÖØòóôõöøÙÚÛÜùúûüÝýÿÑñÇç';
  tgt_chars TEXT := 'AAAAAAaaaaaaEEEEeeeeIIIIiiiiOOOOOOooooooUUUUuuuuYyyNnCc';
BEGIN
  FOR rec IN
    SELECT id, "siteId", libelle
    FROM "PostePrevision"
    WHERE "posteReferentielId" IS NULL
  LOOP
    slug := lower(translate(rec.libelle, src_chars, tgt_chars));
    slug := regexp_replace(slug, '[^a-z0-9]+', '-', 'g');
    slug := regexp_replace(slug, '^-+|-+$', '', 'g');

    IF slug = '' THEN
      RAISE EXCEPTION
        'Backfill PosteReferentiel: libelle invalide (aucun caractere alphanumerique) pour PostePrevision id=%, libelle=%',
        rec.id, rec.libelle;
    END IF;

    IF length(slug) > 100 THEN
      slug := substring(slug FROM 1 FOR 100);
      slug := regexp_replace(slug, '-[^-]*$', '');
      slug := regexp_replace(slug, '^-+|-+$', '', 'g');
    END IF;

    -- get-or-create, atomique au sein de cette transaction de migration
    SELECT id INTO ref_id
    FROM "PosteReferentiel"
    WHERE "siteId" = rec."siteId" AND "code" = slug;

    IF ref_id IS NULL THEN
      INSERT INTO "PosteReferentiel" ("id", "siteId", "code", "libelle", "actif", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, rec."siteId", slug, rec.libelle, true, now(), now())
      ON CONFLICT ("siteId", "code") DO NOTHING
      RETURNING id INTO ref_id;

      IF ref_id IS NULL THEN
        SELECT id INTO ref_id
        FROM "PosteReferentiel"
        WHERE "siteId" = rec."siteId" AND "code" = slug;
      END IF;
    END IF;

    UPDATE "PostePrevision" SET "posteReferentielId" = ref_id WHERE id = rec.id;
  END LOOP;
END $$;

-- ──────────────────────────────────────────────────────────────────────────
-- 3. Garde-fou de precondition (R10) — echec bruyant, jamais silencieux
-- ──────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  orphan_count INT;
BEGIN
  SELECT count(*) INTO orphan_count
  FROM "PostePrevision"
  WHERE "posteReferentielId" IS NULL;

  IF orphan_count > 0 THEN
    RAISE EXCEPTION
      'Migration 20260805120000_add_poste_referentiel: % ligne(s) PostePrevision sans posteReferentielId apres backfill — probable collision de slug entre deux libelles distincts du meme site non desambiguisee. Migration abandonnee.',
      orphan_count;
  END IF;
END $$;

-- ──────────────────────────────────────────────────────────────────────────
-- 4. NOT NULL + FK Restrict + index
-- ──────────────────────────────────────────────────────────────────────────

ALTER TABLE "PostePrevision" ALTER COLUMN "posteReferentielId" SET NOT NULL;

CREATE INDEX IF NOT EXISTS "PostePrevision_posteReferentielId_idx"
    ON "PostePrevision"("posteReferentielId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'PostePrevision_posteReferentielId_fkey'
  ) THEN
    ALTER TABLE "PostePrevision"
      ADD CONSTRAINT "PostePrevision_posteReferentielId_fkey"
      FOREIGN KEY ("posteReferentielId") REFERENCES "PosteReferentiel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
