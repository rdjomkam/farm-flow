-- Migration : Purge des MORTALITE cause=AVARIE créées automatiquement par livrerVente
-- Sprint AV.6
--
-- Contexte :
--   Le code livrerVente (avant Sprint AV) convertissait toute perte de poids
--   en transport en morts fictifs, créant des Releve MORTALITE cause=AVARIE
--   avec venteId non-null. Ces morts n'ont jamais existé (calculés depuis
--   poidsLivré / poidsMoyen), ils faussent le taux de survie.
--
--   Cette migration les supprime. Idempotente (rejouable — les relevés
--   déjà supprimés ne réapparaîtront pas).
--
--   Préservés :
--     - MORTALITE cause=AVARIE SANS venteId (potentielles saisies manuelles)
--     - Autres MORTALITE (élevage, prédation, etc.)
--     - Les relevés VENTE liés (leur nombreVendus est déjà correct)
--
-- Audit prod (2026-07-15) :
--   17 relevés fictifs, 0 modifiés manuellement (modifie=false pour tous),
--   répartis sur 3 vagues :
--     Vague 26-01       : 8 relevés / 270 morts fictifs (survie 85.42% -> 90.33%)
--     Vague 26-02       : 5 relevés /  52 morts fictifs (survie 80.49% -> 81.44%)
--     Vague 26-02-Dibac : 4 relevés /  13 morts fictifs (survie 71.64% -> 74.00%)
--
-- Impact attendu :
--   - Taux de survie remonte automatiquement sur toutes vagues affectées
--   - Biomasse et stock bac inchangés (les morts fictifs ne décrémentaient
--     déjà pas AssignationBac)

-- Compter avant (log postgres)
DO $$
DECLARE
  nb_avant INTEGER;
BEGIN
  SELECT COUNT(*) INTO nb_avant
  FROM "Releve"
  WHERE "typeReleve" = 'MORTALITE'
    AND "causeMortalite" = 'AVARIE'
    AND "venteId" IS NOT NULL;
  RAISE NOTICE 'Purge MORTALITE fictifs : % relevés à supprimer', nb_avant;
END $$;

DELETE FROM "Releve"
WHERE "typeReleve" = 'MORTALITE'
  AND "causeMortalite" = 'AVARIE'
  AND "venteId" IS NOT NULL;
