-- =============================================================================
-- Correctif de données : vagueId manquant — VTE-2026-004 (cmpeot9jg000201nyxfget2gi)
-- =============================================================================
-- Origine : prisma/migrations/fix-vte004-missing-vagueid.sql (fichier orphelin, jamais
-- exécuté par `migrate deploy` — voir ADR-049 section 1). Investigation : VTE-2026-004
-- (286 poissons, 132 kg, 264 000 F) a été créée avec un vagueId vide (chaîne '' plutôt
-- que NULL), alors que ses relevés VENTE référencent correctement des bacs de la vague
-- Dibac (Bac 05 : 161, Bac 06 : 125). Conséquence : le coût de production omettait
-- 132 kg de poids vendu, gonflant artificiellement le coût/kg.
--
-- Cette migration est IDEMPOTENTE — rejouable sans effet (cf. ADR-049 §3.3.a).
--
-- Stratégie d'idempotence : le fichier source note explicitement que la valeur
-- avant-fix était la chaîne vide '' (pas NULL) — condition ciblée sur cette valeur
-- buggée connue, pas sur une simple différence avec la cible (cf. ADR-049 §3.3.a et
-- consigne (c) : ne cible que l'état incorrect documenté, jamais un `vagueId IS NULL`
-- générique qui n'aurait pas correspondu au bug réel constaté). Garde FK défensive :
-- la Vague cible doit exister pour que la liaison soit tentée.
--
-- No-op silencieux si l'identifiant CUID (Vente/Vague de production) est absent de la
-- base courante (dev, test, nouveau site) : l'UPDATE ne matche simplement aucune ligne.
-- =============================================================================

DO $$
DECLARE
  v_rows INT := 0;
BEGIN
  UPDATE "Vente"
  SET "vagueId" = 'cmmvma55c000704jpue712940'
  WHERE id = 'cmpeot9jg000201nyxfget2gi'
    AND "vagueId" = ''
    AND EXISTS (SELECT 1 FROM "Vague" WHERE id = 'cmmvma55c000704jpue712940');
  GET DIAGNOSTICS v_rows = ROW_COUNT;

  RAISE NOTICE '[data_fix_vte004_missing_vagueid] % ligne(s) Vente corrigée(s) (0 = déjà appliqué, ou données absentes de cette base)', v_rows;
END $$;
