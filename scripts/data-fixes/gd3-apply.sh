#!/usr/bin/env bash
# GD.3 apply — backup + apply SQL data-fix Vague-26-03-Prep
# Usage : bash scripts/data-fixes/gd3-apply.sh

set -euo pipefail

TS=$(date +%Y%m%d-%H%M%S)
BACKUP="/tmp/backup-avant-GD3-${TS}.sql"
DB_URL="postgres://postgres:n6t2CiPF2SaINP17iqhbEfeFORWG5dkr1a1cLTWSfARtHF6igReL6MpRDnX2vRCc@72.61.187.32:5432/postgres"

echo "==> [1/3] Backup prod → ${BACKUP}"
docker exec silures-db pg_dump "$DB_URL" > "$BACKUP"
echo "    Backup OK ($(wc -c < "$BACKUP") octets)"

echo ""
echo "==> [2/3] État AVANT fix"
docker exec -i silures-db psql "$DB_URL" <<'SQL'
SELECT b.nom, ab."nombrePoissonsInitial" AS init, ab."nombrePoissons" AS actuel,
       to_char(ab."dateAssignation",'YYYY-MM-DD') AS debut,
       COALESCE(to_char(ab."dateFin",'YYYY-MM-DD'),'ACTIVE') AS fin
FROM "AssignationBac" ab JOIN "Bac" b ON b.id=ab."bacId"
WHERE ab."vagueId"='cmplrrba6000101qwazzjca26'
  AND b.nom IN ('Bac 08','Bac 11','Bac 12')
ORDER BY b.nom, ab."dateAssignation";
SQL

echo ""
echo "==> [3/3] Applique migration SQL"
docker exec -i silures-db psql "$DB_URL" < "$(dirname "$0")/gd3-vague-26-03-prep-transferts.sql"

echo ""
echo "==> État APRÈS fix"
docker exec -i silures-db psql "$DB_URL" <<'SQL'
SELECT b.nom, ab."nombrePoissonsInitial" AS init, ab."nombrePoissons" AS actuel,
       to_char(ab."dateAssignation",'YYYY-MM-DD') AS debut,
       COALESCE(to_char(ab."dateFin",'YYYY-MM-DD'),'ACTIVE') AS fin
FROM "AssignationBac" ab JOIN "Bac" b ON b.id=ab."bacId"
WHERE ab."vagueId"='cmplrrba6000101qwazzjca26'
  AND b.nom IN ('Bac 08','Bac 11','Bac 12')
ORDER BY b.nom, ab."dateAssignation";

\echo ''
\echo '=== Nouveaux TransfertGroupes ==='
SELECT tg.id, bs.nom AS source, bd.nom AS dest, tg."nombrePoissons", tg."poidsMoyenG"
FROM "TransfertGroupe" tg
JOIN "Bac" bs ON bs.id=tg."bacSourceId"
JOIN "Bac" bd ON bd.id=tg."bacDestId"
WHERE tg.id IN ('gd3_tg_bac08_bac12','gd3_tg_bac12_bac11');

\echo ''
\echo '=== Confirm anti-pattern COMPTAGES supprimés (attendu: 0 rows) ==='
SELECT id, "typeReleve", "nombreCompte", notes FROM "Releve"
WHERE id IN ('cmqf2d6a6005601rr4lop685g','cmqf2d6ah005701rrozze4x36','cmrlr6jgb000301nbu1hizbat');
SQL

echo ""
echo "==> DONE."
echo "    Backup   : $BACKUP"
echo "    Rollback : docker exec -i silures-db psql \"\$DB_URL\" < $BACKUP"
