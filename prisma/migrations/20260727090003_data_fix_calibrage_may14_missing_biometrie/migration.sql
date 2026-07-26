-- =============================================================================
-- Correctif de données : relevé BIOMETRIE manquant — calibrage du 14/05/2026 (Bac 07)
-- =============================================================================
-- Origine : prisma/migrations/fix-calibrage-may14-missing-biometrie.sql (fichier
-- orphelin, jamais exécuté par `migrate deploy` — voir ADR-049 section 1).
-- Investigation : le calibrage cmpcimvty002z01rumvue4ayb (créé le 19/05/2026) a
-- généré 4 CalibrageGroupe (GROS→Bac04, TRES_GROS→Bac09, MOYEN→Bac01,
-- PETIT→Bac07) mais seulement 3 relevés BIOMETRIE — celui de Bac 07 (catégorie
-- PETIT @ 178g) manque. Cause racine inconnue (logique de code jugée correcte).
--
-- Cette migration est IDEMPOTENTE — rejouable sans effet (cf. ADR-049 §3.3.a).
--
-- Stratégie d'idempotence (point le plus important de la story, ADR-049 §3.3.b et
-- pré-analyse sprint MG section C) : l'INSERT brut du fichier source dupliquerait le
-- relevé à chaque exécution (`gen_random_uuid()` génère un nouvel id à chaque fois).
-- Réécrit en `INSERT ... SELECT ... WHERE EXISTS (<toutes les FK référencées
-- existent>) AND NOT EXISTS (<la ligne cible existe déjà>)` :
--   - EXISTS : Vague, Bac, Site, Calibrage doivent tous exister sur cette base —
--     sinon l'INSERT ne serait de toute façon pas pertinent (données de prod absentes
--     d'un environnement dev/test/nouveau site) et échouerait sur violation de
--     contrainte étrangère si tenté malgré tout.
--   - NOT EXISTS : aucun relevé BIOMETRIE déjà présent pour ce calibrage + ce bac —
--     protège contre la duplication au replay ET contre l'écrasement d'un relevé
--     éventuellement déjà ajouté manuellement entre-temps.
--
-- No-op silencieux si les identifiants CUID (Vague/Bac/Site/Calibrage de production)
-- sont absents de la base courante : la clause EXISTS ne matche rien, l'INSERT ...
-- SELECT ne produit alors aucune ligne — jamais d'erreur de contrainte étrangère.
-- =============================================================================

DO $$
DECLARE
  v_rows INT := 0;
BEGIN
  INSERT INTO "Releve" (
    id, date, "typeReleve", "poidsMoyen", "echantillonCount", notes,
    "vagueId", "bacId", "siteId", "calibrageId", "createdAt", "updatedAt"
  )
  SELECT
    gen_random_uuid()::text,
    '2026-05-14 21:50:00'::timestamp,
    'BIOMETRIE',
    178,
    554,
    'Biometrie calibrage — categorie Petit',
    'cmmth8mav000004k31i3he89v',
    'cmmtgcqsi000504lfaj2rpcjb',
    'cmmmxjqll000004l2vd7crswl',
    'cmpcimvty002z01rumvue4ayb',
    NOW(),
    NOW()
  WHERE
    EXISTS (SELECT 1 FROM "Vague" WHERE id = 'cmmth8mav000004k31i3he89v')
    AND EXISTS (SELECT 1 FROM "Bac" WHERE id = 'cmmtgcqsi000504lfaj2rpcjb')
    AND EXISTS (SELECT 1 FROM "Site" WHERE id = 'cmmmxjqll000004l2vd7crswl')
    AND EXISTS (SELECT 1 FROM "Calibrage" WHERE id = 'cmpcimvty002z01rumvue4ayb')
    AND NOT EXISTS (
      SELECT 1 FROM "Releve"
      WHERE "calibrageId" = 'cmpcimvty002z01rumvue4ayb'
        AND "bacId" = 'cmmtgcqsi000504lfaj2rpcjb'
        AND "typeReleve" = 'BIOMETRIE'
    );
  GET DIAGNOSTICS v_rows = ROW_COUNT;

  RAISE NOTICE '[data_fix_calibrage_may14_missing_biometrie] % ligne(s) Releve insérée(s) (0 = déjà appliqué, relevé déjà présent, ou données de calibrage absentes de cette base)', v_rows;
END $$;
