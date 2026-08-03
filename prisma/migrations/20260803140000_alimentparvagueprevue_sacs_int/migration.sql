-- Migration : 20260803140000_alimentparvagueprevue_sacs_int
--
-- POURQUOI CETTE MIGRATION EXISTE (review-sprint-PR1.md, réserve n°1,
-- sévérité Haute) :
--
-- "AlimentParVaguePrevue.sacsCalcules" / "sacsSaisis" étaient typés
-- Decimal(65,30) dans le schéma initial (migration 20260803120100). Un
-- nombre de sacs est par construction un entier : sacsCalcules est le
-- résultat d'un `ceil` (ADR-053 section 4), sacsSaisis est une surcharge
-- manuelle qui n'a aucun sens fractionnaire. La fenêtre pour corriger ceci
-- à coût nul se ferme dès qu'une route API écrit dans cette table (PR2) --
-- aujourd'hui, seul prisma/seed.sql y insère des lignes.
--
-- PIÈGE ÉVITÉ ICI (identifié par la pré-analyse du sprint PR1) :
-- PostgreSQL accepte `ALTER COLUMN ... TYPE integer` depuis numeric(65,30)
-- SANS clause USING (cast d'assignment implicite), mais ce cast implicite
-- ARRONDIT silencieusement une valeur fractionnaire au lieu d'échouer
-- (vérifié : 10.5 -> 11, 10.4 -> 10). Aucune ligne fractionnaire n'existe
-- aujourd'hui (3/3 lignes de prisma/seed.sql sont des entiers exacts), mais
-- un cast silencieux resterait une perte de données non tracée si ce
-- n'était pas le cas. Cette migration :
--   1. Vérifie explicitement, AVANT toute écriture, qu'aucune valeur
--      fractionnaire n'existe (RAISE EXCEPTION sinon, sans modifier la
--      table) -- garde-fou de précondition dans la migration elle-même,
--      jamais dans un script préalable qu'un humain doit penser à lancer
--      (R10 / ADR-049 §3.1, pattern déjà utilisé dans
--      20260727090006_unicite_numero_par_site_autosuffisante).
--   2. Effectue le cast avec une clause USING explicite (::integer via
--      ROUND, jamais un cast implicite) une fois la précondition validée.
--
-- Nullabilité : "sacsCalcules" reste NOT NULL, "sacsSaisis" reste nullable
-- (R7, conservée à l'identique -- seul le type scalaire change).

-- ============================================================================
-- 1. GARDE-FOU -- AVANT toute modification. Échoue tôt, sans écrire, si une
--    valeur fractionnaire existe sur l'une des deux colonnes.
-- ============================================================================
DO $$
DECLARE
  v_found TEXT;
BEGIN
  SELECT string_agg(
    'id=' || sub.id
      || ' | sacsCalcules=' || sub."sacsCalcules"::text
      || ' | sacsSaisis=' || COALESCE(sub."sacsSaisis"::text, 'NULL'),
    chr(10) ORDER BY sub.id
  )
  INTO v_found
  FROM (
    SELECT id, "sacsCalcules", "sacsSaisis"
    FROM "AlimentParVaguePrevue"
    WHERE "sacsCalcules" <> TRUNC("sacsCalcules")
       OR ("sacsSaisis" IS NOT NULL AND "sacsSaisis" <> TRUNC("sacsSaisis"))
    LIMIT 20
  ) sub;

  IF v_found IS NOT NULL THEN
    RAISE EXCEPTION E'Précondition non satisfaite (migration 20260803140000) : des valeurs fractionnaires existent dans AlimentParVaguePrevue.sacsCalcules/sacsSaisis -- un cast implicite Decimal -> Integer les arrondirait silencieusement. Aucune écriture n''a été effectuée. Corriger manuellement ces lignes (arrondi explicite et documenté), puis relancer le déploiement :\n%',
      v_found;
  END IF;
END $$;

-- ============================================================================
-- 2. ALTER -- cast explicite (USING), jamais implicite, une fois la
--    précondition validée.
-- ============================================================================
ALTER TABLE "AlimentParVaguePrevue"
  ALTER COLUMN "sacsCalcules" TYPE INTEGER USING "sacsCalcules"::INTEGER,
  ALTER COLUMN "sacsSaisis" TYPE INTEGER USING "sacsSaisis"::INTEGER;
