-- =============================================================================
-- Correctif de données : dépense + mouvement de stock dupliqués — BES-2026-033 / CMD-2026-015
-- =============================================================================
-- Origine : prisma/migrations/fix-bes033-cmd015-duplicate.sql (fichier orphelin, jamais
-- exécuté par `migrate deploy` — voir ADR-049 section 1). Investigation : un même achat
-- (4x Aliment Gouessant 2mm = 104 000 F) a créé deux Depense et deux MouvementStock
-- ENTREE car la commande avait été créée de façon autonome (sans lien vers le besoin).
-- Action : conserver DEP-2026-032 (commande, paiement MOBILE_MONEY), supprimer
-- DEP-2026-031 (besoin, paiement ESPECES) — les liaisons manquantes sont recréées.
--
-- Cette migration est IDEMPOTENTE — rejouable sans effet (cf. ADR-049 §3.3.a).
--
-- Stratégie d'idempotence : les 4 UPDATE conservent leur garde d'origine
-- `WHERE ... IS NULL` (ne s'appliquent que si la liaison n'est pas déjà faite ; une
-- fois appliquées, rejouer ne matche plus rien). Les 2 DELETE par id sont
-- naturellement idempotents (DELETE sur une ligne absente = 0 ligne affectée, jamais
-- une erreur SQL). Garde FK défensive ajoutée sur chaque UPDATE : la cible référencée
-- (ListeBesoins / LigneBesoin) doit exister pour que la liaison soit tentée — évite
-- toute violation de contrainte étrangère si l'état de la base diverge du contexte de
-- production original.
--
-- No-op silencieux si les identifiants CUID (Depense/Commande/LigneBesoin/
-- MouvementStock de production) sont absents de la base courante (dev, test, nouveau
-- site) : chaque UPDATE/DELETE par id ne matche simplement aucune ligne.
-- =============================================================================

DO $$
DECLARE
  v_rows_commande INT := 0;
  v_rows_depense INT := 0;
  v_rows_lignebesoin INT := 0;
  v_rows_lignedepense INT := 0;
  v_rows_delete_depense INT := 0;
  v_rows_delete_mouvement INT := 0;
  v_tmp INT;
BEGIN
  -- 1. Lier Commande -> ListeBesoins
  UPDATE "Commande"
  SET "listeBesoinsId" = 'cmom2kz5f009i01qwcssoyb87'
  WHERE id = 'cmom2r03c009q01qwm9b7x3j9'
    AND "listeBesoinsId" IS NULL
    AND EXISTS (SELECT 1 FROM "ListeBesoins" WHERE id = 'cmom2kz5f009i01qwcssoyb87');
  GET DIAGNOSTICS v_tmp = ROW_COUNT; v_rows_commande := v_rows_commande + v_tmp;

  -- 2. Lier Depense conservée -> ListeBesoins
  UPDATE "Depense"
  SET "listeBesoinsId" = 'cmom2kz5f009i01qwcssoyb87'
  WHERE id = 'cmom2rf0q009t01qwe10pbu5t'
    AND "listeBesoinsId" IS NULL
    AND EXISTS (SELECT 1 FROM "ListeBesoins" WHERE id = 'cmom2kz5f009i01qwcssoyb87');
  GET DIAGNOSTICS v_tmp = ROW_COUNT; v_rows_depense := v_rows_depense + v_tmp;

  -- 3. Lier LigneBesoin -> Commande
  UPDATE "LigneBesoin"
  SET "commandeId" = 'cmom2r03c009q01qwm9b7x3j9'
  WHERE id = 'cmom2kz5l009k01qwkaaiu8sw'
    AND "commandeId" IS NULL
    AND EXISTS (SELECT 1 FROM "Commande" WHERE id = 'cmom2r03c009q01qwm9b7x3j9');
  GET DIAGNOSTICS v_tmp = ROW_COUNT; v_rows_lignebesoin := v_rows_lignebesoin + v_tmp;

  -- 4. Lier LigneDepense conservée -> LigneBesoin
  UPDATE "LigneDepense"
  SET "ligneBesoinId" = 'cmom2kz5l009k01qwkaaiu8sw'
  WHERE id = 'cmom5c7nf00a101qw5t58zh69'
    AND "ligneBesoinId" IS NULL
    AND EXISTS (SELECT 1 FROM "LigneBesoin" WHERE id = 'cmom2kz5l009k01qwkaaiu8sw');
  GET DIAGNOSTICS v_tmp = ROW_COUNT; v_rows_lignedepense := v_rows_lignedepense + v_tmp;

  -- 5. Supprimer la Depense dupliquée (cascade : LigneDepense + PaiementDepense)
  DELETE FROM "Depense"
  WHERE id = 'cmom2lhi9009l01qwxg0n69bv';
  GET DIAGNOSTICS v_rows_delete_depense = ROW_COUNT;

  -- 6. Supprimer le MouvementStock dupliqué
  DELETE FROM "MouvementStock"
  WHERE id = '4c1fbfc5-1c76-4938-b628-7cddca9226ea';
  GET DIAGNOSTICS v_rows_delete_mouvement = ROW_COUNT;

  RAISE NOTICE '[data_fix_bes033_cmd015_duplicate] Commande liée=%, Depense liée=%, LigneBesoin liée=%, LigneDepense liée=%, Depense supprimée=%, MouvementStock supprimé=% (0 partout = déjà appliqué ou données absentes de cette base)',
    v_rows_commande, v_rows_depense, v_rows_lignebesoin, v_rows_lignedepense, v_rows_delete_depense, v_rows_delete_mouvement;
END $$;
