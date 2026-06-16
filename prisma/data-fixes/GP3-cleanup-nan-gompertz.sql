-- GP3 — Cleanup NaN GompertzVague en prod
-- Date d'exécution : 2026-06-16
-- Prérequis : GP.1 (e2b2abc) + GP.2 (535d8b2) doivent être déployés AVANT l'exécution
-- Contexte : le record Vague-26-03-Prep a été persisté avec wInfinity=NaN et rmse=NaN
--   le 2026-06-10, avant que le guard GP.2 soit en place.

-- ============================================================
-- SECTION 1 : AUDIT (toujours rejouable)
-- Détecte tous les records avec valeurs NaN ou Infinity
-- ============================================================
SELECT v.code, gv."vagueId", gv."wInfinity"::text, gv.k::text, gv.ti::text, gv.r2::text, gv.rmse::text, gv."updatedAt"
FROM "GompertzVague" gv
JOIN "Vague" v ON v.id = gv."vagueId"
WHERE
  gv."wInfinity"::text = 'NaN'
  OR gv.k::text = 'NaN'
  OR gv.ti::text = 'NaN'
  OR gv.r2::text = 'NaN'
  OR gv.rmse::text = 'NaN'
  OR gv."wInfinity" = 'Infinity'::double precision
  OR gv."wInfinity" = '-Infinity'::double precision
  OR gv.k = 'Infinity'::double precision
  OR gv.k = '-Infinity'::double precision
  OR gv.ti = 'Infinity'::double precision
  OR gv.ti = '-Infinity'::double precision;

-- Résultat observé lors de l'audit du 2026-06-16 :
-- code              | vagueId                    | wInfinity | k     | ti | r2 | rmse | updatedAt
-- Vague-26-03-Prep  | cmplrrba6000101qwazzjca26  | NaN       | 0.018 | 95 | 0  | NaN  | 2026-06-10 13:03:56.736
-- (1 row)

-- ============================================================
-- SECTION 2 : DELETE EN TRANSACTION (DÉJÀ APPLIQUÉ le 2026-06-16)
-- Décommenter uniquement si on rejoue sur un autre environnement
-- ============================================================

-- BEGIN;
--
-- -- Vérification avant
-- SELECT v.code, gv."wInfinity"::text, gv.k::text, gv.ti::text, gv.r2::text, gv.rmse::text
-- FROM "GompertzVague" gv
-- JOIN "Vague" v ON v.id = gv."vagueId"
-- WHERE gv."vagueId" = 'cmplrrba6000101qwazzjca26';
--
-- -- Suppression du record corrompu (Vague-26-03-Prep)
-- DELETE FROM "GompertzVague" WHERE "vagueId" = 'cmplrrba6000101qwazzjca26';
--
-- -- Vérification après (attendu : 0)
-- SELECT COUNT(*) AS residuel_apres FROM "GompertzVague" WHERE "vagueId" = 'cmplrrba6000101qwazzjca26';
--
-- COMMIT;

-- ============================================================
-- SECTION 3 : VALIDATION POST-FIX
-- ============================================================

-- Compte total (avant : 4, après : 3)
SELECT COUNT(*) AS total_gompertz FROM "GompertzVague";

-- Audit résiduel (attendu : 0)
SELECT COUNT(*) AS nan_residuels
FROM "GompertzVague"
WHERE
  "wInfinity"::text = 'NaN'
  OR k::text = 'NaN'
  OR ti::text = 'NaN'
  OR r2::text = 'NaN'
  OR rmse::text = 'NaN'
  OR "wInfinity" = 'Infinity'::double precision
  OR "wInfinity" = '-Infinity'::double precision
  OR k = 'Infinity'::double precision
  OR k = '-Infinity'::double precision
  OR ti = 'Infinity'::double precision
  OR ti = '-Infinity'::double precision;

-- Liste des records valides restants
SELECT v.code, gv."wInfinity"::text, gv.k::text, gv.ti::text, gv.r2::text, gv.rmse::text, gv."updatedAt"
FROM "GompertzVague" gv
JOIN "Vague" v ON v.id = gv."vagueId"
ORDER BY gv."updatedAt" DESC;

-- ============================================================
-- SECTION 4 : COMPORTEMENT ATTENDU APRÈS FIX (GP.1 + GP.2 actifs)
-- ============================================================
-- Au prochain chargement de la page Vague-26-03-Prep par un utilisateur :
--
-- Cas A — Le solver converge (assez de biométries valides) :
--   → upsert crée un record GompertzVague valide (wInfinity, k, ti, r2, rmse tous non-NaN)
--
-- Cas B — Le solver diverge encore (données insuffisantes) :
--   → GP.2 guard bloque la persistance (calibrerGompertz retourne null)
--   → aucun record créé, la page affiche simplement l'absence de courbe
--
-- Dans les deux cas, le record NaN ne peut plus être créé grâce au guard GP.2.
