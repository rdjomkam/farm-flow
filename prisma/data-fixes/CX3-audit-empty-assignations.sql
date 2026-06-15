-- CX3 — Audit AssignationBac actives avec init=0 et actuel=0 (prod)
-- Date : 2026-06-15
-- Nature : lecture seule (SELECT uniquement — aucun UPDATE/DELETE)
-- Objectif : identifier les bacs vides rattachés sans poissons et évaluer
--            la compatibilité avec le guard CS.3 (AssignationBac invariant)

-- ============================================================
-- 1. SELECT PRINCIPAL — bacs actifs avec init=0 et actuel=0
-- ============================================================

SELECT v.code                          AS vague,
       b.nom                           AS bac,
       ab."dateAssignation"::text      AS debut,
       ab."dateFin"::text              AS fin,
       ab."nombrePoissonsInitial"      AS init,
       ab."nombrePoissons"             AS actuel,
       ab."poidsMoyenInitial"          AS poids
FROM   "AssignationBac" ab
JOIN   "Vague" v ON v.id = ab."vagueId"
JOIN   "Bac"   b ON b.id = ab."bacId"
WHERE  ab."dateFin" IS NULL
  AND  ab."nombrePoissonsInitial" = 0
  AND  ab."nombrePoissons"        = 0
ORDER BY v.code, b.nom;

/*
RÉSULTATS AU 2026-06-15 :
--------------------------
 vague        | bac    | debut                    | fin  | init | actuel | poids
--------------+--------+--------------------------+------+------+--------+-------
 Vague 26-02  | Bac 07 | 2026-06-15 10:28:07.041  |      |    0 |      0 |    26
 Vague 26-02  | Bac 08 | 2026-06-15 10:28:16.023  |      |    0 |      0 |    26

Total : 2 cas
*/

-- ============================================================
-- 2. ANALYSE GUARD CS.3 — relevés sensibles pour chaque cas
--    Types concernés par le guard : MORTALITE, COMPTAGE, ARRIVAGE, TRANSFERT, VENTE
-- ============================================================

SELECT b.nom                 AS bac,
       r."typeReleve",
       COUNT(*)              AS nb
FROM   "Releve" r
JOIN   "Bac"    b ON b.id = r."bacId"
WHERE  r."vagueId" = 'cmoclpy6n000n01qwy1qi9erq'   -- Vague 26-02
  AND  r."bacId" IN (
         'cmmtgcqsi000504lfaj2rpcjb',              -- Bac 07
         'cmmtgcza8000604lf3ft910rv'               -- Bac 08
       )
  AND  r."typeReleve" IN ('MORTALITE','COMPTAGE','ARRIVAGE','TRANSFERT','VENTE')
GROUP  BY b.nom, r."typeReleve"
ORDER  BY b.nom, r."typeReleve";

/*
RÉSULTATS AU 2026-06-15 :
--------------------------
 bac    | typeReleve | nb
--------+------------+----
 Bac 08 | COMPTAGE   |  2
 Bac 08 | MORTALITE  | 15

 Bac 07 : 0 relevé guard-sensible
*/

-- ============================================================
-- 3. CONTEXTE — tous les AssignationBac (actifs + clos) pour ces bacs
-- ============================================================

SELECT ab.id,
       b.nom                           AS bac,
       ab."dateAssignation"::text      AS debut,
       ab."dateFin"::text              AS fin,
       ab."nombrePoissonsInitial"      AS init,
       ab."nombrePoissons"             AS actuel,
       ab."poidsMoyenInitial"
FROM   "AssignationBac" ab
JOIN   "Bac"   b ON b.id = ab."bacId"
WHERE  ab."vagueId" = 'cmoclpy6n000n01qwy1qi9erq'
  AND  ab."bacId" IN (
         'cmmtgcqsi000504lfaj2rpcjb',
         'cmmtgcza8000604lf3ft910rv'
       )
ORDER BY b.nom, ab."dateAssignation";

/*
RÉSULTATS AU 2026-06-15 :
--------------------------
 bac    | debut                    | fin                      | init | actuel
--------+--------------------------+--------------------------+------+-------
 Bac 07 | 2026-06-15 10:28:07.041  |                          |    0 |     0   ← actif, VIDE
 Bac 08 | 2026-05-10 19:56:58.56   | 2026-05-25 15:55:31.923  |    0 |     0   ← clos antérieur, init=0
 Bac 08 | 2026-06-15 10:28:16.023  |                          |    0 |     0   ← actif, VIDE

Bac 08 : deux assignations clos/actif, toutes deux avec init=0.
  L'assignation close (2026-05-10) est celle qui a porté les 50 relevés (MORTALITE, BIOMETRIE, etc.)
  — c'est l'incohérence source identifiée dans CX.1.
  L'assignation active (2026-06-15) a été créée par l'opération de réassignation du sprint CX.
*/
