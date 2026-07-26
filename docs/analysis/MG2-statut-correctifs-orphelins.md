# MG.2 — Statut réel des correctifs orphelins

**Sprint :** MG (story MG.2)
**Auteur :** @architect
**Date :** 2026-07-26
**Réfs :** ADR-049, `docs/analysis/pre-analysis-sprint-MG.md` (sections B, D), commit `c259b48`

---

> ## ⚠️ AVERTISSEMENT — À LIRE AVANT TOUTE ACTION
>
> **Ce document ne suppose RIEN sur l'état réel de la production.** Il documente ce que
> chaque correctif *ferait* s'il était exécuté, et fournit une requête de diagnostic pour
> que **l'utilisateur** — pas cet agent, pas aucun agent — détermine l'état réel en
> l'exécutant lui-même contre la base cible.
>
> **Aucun des 5 correctifs n'a jamais été exécuté par `prisma migrate deploy`.** Les 4
> fichiers `fix-*.sql` sont des fichiers **inertes** à la racine de `prisma/migrations/` :
> Prisma ne considère comme migration que les *sous-dossiers* contenant un
> `migration.sql` — un fichier `.sql` posé directement à la racine n'est lu par aucune
> commande Prisma, jamais enregistré dans `_prisma_migrations`, jamais exécuté par le
> pipeline de déploiement (`docker-entrypoint.sh`). Voir ADR-049 §1.
>
> **Leur application manuelle éventuelle contre la production n'est tracée nulle part
> dans le dépôt**, à une seule exception : `gd3-vague-26-03-prep-transferts.sql`, dont
> l'exécution est documentée dans `docs/analysis/GD3-data-fix-report.md` — et encore,
> avec une discordance de date non résolue (voir section gd3 ci-dessous). Pour les 4
> autres, il n'existe **aucune trace** dans le dépôt permettant d'affirmer si leur contenu
> a déjà été appliqué à la main sur une base quelconque, ni quand, ni par qui.
>
> **La seule façon fiable de connaître l'état réel est d'exécuter les requêtes de
> diagnostic ci-dessous, en lecture seule, directement contre la base cible.**

---

## 1. `fix-vague2601-phantom-fish.sql`

### Ce que le correctif fait
Corrige un excédent de ~522 poissons « fantômes » détecté sur la Vague 26-01
(`cmmth8mav000004k31i3he89v`) après le calibrage du 14 mai. Il ramène à des valeurs
cibles calculées manuellement (COMPTAGE − mortalités post-calibrage) :
- `Bac.nombrePoissons` pour 4 bacs (`cmmnd2oab...`, `cmmtgbf4x...`, `cmmtgcqsi...`,
  `cmmtgd8br...`) → cibles 1564 / 2117 / 554 / 752.
- `AssignationBac.nombrePoissons` (mappé `nombreActuel` côté Prisma/TypeScript) pour les
  mêmes bacs, filtré sur `vagueId` + `dateFin IS NULL` (assignation active).

> **Note (correction post-migration ADR-043 Phase 3) :** le volet `Bac.nombrePoissons`
> décrit ci-dessus est un état passé du correctif, tel qu'écrit à l'époque. La colonne
> `Bac.nombrePoissons` a depuis été **supprimée** par la migration
> `20260521200000_adr043_phase3_remove_bac_production_fields` : depuis ADR-043,
> `AssignationBac.nombreActuel` (colonne DB `nombrePoissons`) est la **seule source de
> vérité** du nombre de poissons — `Bac` ne porte plus aucun champ de production. Ceci
> prouve, en soi, que ce correctif orphelin **n'aurait de toute façon jamais pu
> s'exécuter tel quel** sur le schéma actuel : le volet `UPDATE "Bac" SET
> "nombrePoissons" = ...` échouerait avec `column "nombrePoissons" of relation "Bac"
> does not exist` sur toute base ayant déjà appliqué cette migration — un argument
> supplémentaire, indépendant de l'absence de trace d'exécution, en faveur du statut
> « jamais appliqué » pour ce correctif précis. La requête de diagnostic ci-dessous a été
> corrigée en conséquence : elle ne porte plus que sur `AssignationBac`.

État final produit : les 4 lignes `AssignationBac` (le volet `Bac` n'est plus
diagnosticable — voir note ci-dessus) portent exactement les valeurs cibles listées
ci-dessus.

### Idempotence en l'état
**Non, au sens strict.** Les `UPDATE` sont inconditionnels sur l'`id` (`UPDATE ... SET x
= <littéral> WHERE id = '<id>'`), sans clause `WHERE ... != <cible>`. Rejouer le script
plusieurs fois ne duplique rien (ce sont des `UPDATE`, pas des `INSERT`) et ne
« sur-corrige » pas non plus — mais ce n'est pas un no-op garanti : si un relevé légitime
a fait évoluer `nombrePoissons`/`nombreActuel` entre l'écriture du correctif et son
exécution (ou entre deux exécutions), ce script écraserait silencieusement cette nouvelle
valeur, potentiellement correcte, avec l'ancienne valeur figée au moment de
l'investigation. Le risque n'est donc pas la duplication mais l'écrasement d'un état
devenu correct entre-temps.

### Identifiants de production en dur
1 `Vague.id` (`cmmth8mav000004k31i3he89v`), 4 `Bac.id`, valeurs numériques calculées à la
main (1564, 2117, 554, 752) — aucune règle générique, tout est littéral.

### Requête de diagnostic (lecture seule)
```sql
SELECT
  (SELECT COUNT(*) FROM "AssignationBac"
   WHERE "vagueId" = 'cmmth8mav000004k31i3he89v' AND "dateFin" IS NULL
     AND "bacId" IN ('cmmnd2oab000104jse23g509w','cmmtgbf4x000204lfb3tsnrrd',
                     'cmmtgcqsi000504lfaj2rpcjb','cmmtgd8br000704lf12xj13e1')
     AND "nombrePoissons" NOT IN (1564, 2117, 554, 752)) AS assignation_non_corrigee,
  (SELECT COUNT(*) FROM "AssignationBac"
   WHERE "vagueId" = 'cmmth8mav000004k31i3he89v' AND "dateFin" IS NULL
     AND "bacId" IN ('cmmnd2oab000104jse23g509w','cmmtgbf4x000204lfb3tsnrrd',
                     'cmmtgcqsi000504lfaj2rpcjb','cmmtgd8br000704lf12xj13e1')) AS lignes_assignation_existantes
;
-- applied = (lignes_assignation_existantes = 4 AND assignation_non_corrigee = 0)
```
**Colonne à lire :** `assignation_non_corrigee`. Le volet `Bac.nombrePoissons` de la
requête d'origine a été retiré (colonne supprimée du schéma, voir note ci-dessus) —
`AssignationBac` est désormais la seule source consultable pour ce diagnostic. **Valeur
attendue si déjà appliqué : `assignation_non_corrigee = 0`.**

### Interprétation
| Résultat | Signification |
|---|---|
| `assignation_non_corrigee = 0` (et `lignes_assignation_existantes = 4`) | **Correctif déjà appliqué.** Les 4 lignes `AssignationBac` portent déjà les valeurs cibles. Ne pas ré-exécuter le DML sans réflexion (risque d'écraser un état légitime plus récent, cf. idempotence ci-dessus). |
| `assignation_non_corrigee > 0` | **Correctif non appliqué** — au moins une ligne porte encore une valeur différente de la cible. Vérifier d'abord si l'écart correspond bien à l'excédent diagnostiqué à l'époque avant d'exécuter le correctif (une valeur différente pourrait aussi refléter une évolution légitime postérieure à l'investigation). |
| `lignes_assignation_existantes < 4` (moins de 4 lignes trouvées) | **Correctif non concerné sur cette base** — cette vague/ces bacs n'existent pas ici (dev, staging, nouveau site). Distinct de « non appliqué » : il n'y a simplement rien à corriger sur cet environnement. |

---

## 2. `fix-bes033-cmd015-duplicate.sql`

### Ce que le correctif fait
Corrige un doublon de dépense/mouvement de stock provenant d'un même achat
(commande créée en doublon d'un besoin). Actions :
- `UPDATE Commande.listeBesoinsId` (cible `cmom2r03c009q01qwm9b7x3j9` → besoin
  `cmom2kz5f009i01qwcssoyb87`), gardé par `WHERE ... IS NULL`.
- `UPDATE Depense.listeBesoinsId` (dépense conservée `cmom2rf0q009t01qwe10pbu5t`),
  gardé par `WHERE ... IS NULL`.
- `UPDATE LigneBesoin.commandeId` et `UPDATE LigneDepense.ligneBesoinId`, gardés par
  `WHERE ... IS NULL`.
- `DELETE FROM Depense WHERE id = 'cmom2lhi9009l01qwxg0n69bv'` (cascade
  `LigneDepense` + `PaiementDepense`).
- `DELETE FROM MouvementStock WHERE id = '4c1fbfc5-1c76-4938-b628-7cddca9226ea'`.

État final produit : une seule `Depense` (`cmom2rf0q...`) et un seul `MouvementStock`
ENTREE subsistent pour cet achat, tous deux liés au besoin `BES-2026-033` et à la
commande `CMD-2026-015`.

### Idempotence en l'état
**Oui, en pratique** (bien que non explicitement conçu comme tel). Les 4 `UPDATE` sont
protégés par `WHERE ... IS NULL` (no-op silencieux si déjà lié). Les 2 `DELETE` ciblent
un `id` précis : un `DELETE` sur une ligne déjà absente affecte 0 ligne sans lever
d'exception en SQL pur — donc rejouable sans casse. L'ensemble est idempotent, mais par
un effet de bord de la sémantique SQL (DELETE par id est naturellement idempotent), pas
par une garde explicite conçue pour ça.

### Identifiants de production en dur
6 identifiants CUID littéraux : 1 `Commande.id`, 2 `Depense.id`, 1 `MouvementStock.id`,
1 `LigneBesoin.id`, 1 `LigneDepense.id`.

### Requête de diagnostic (lecture seule)
```sql
SELECT
  (SELECT COUNT(*) FROM "Depense" WHERE id = 'cmom2lhi9009l01qwxg0n69bv') AS depense_dupliquee_encore_presente,
  (SELECT COUNT(*) FROM "MouvementStock" WHERE id = '4c1fbfc5-1c76-4938-b628-7cddca9226ea') AS mouvement_duplique_encore_present,
  (SELECT "listeBesoinsId" FROM "Commande" WHERE id = 'cmom2r03c009q01qwm9b7x3j9') AS commande_liste_besoins_id,
  (SELECT COUNT(*) FROM "Commande" WHERE id = 'cmom2r03c009q01qwm9b7x3j9') AS commande_existe
;
```
**Valeur attendue si déjà appliqué :** `depense_dupliquee_encore_presente = 0 ET
mouvement_duplique_encore_present = 0 ET commande_liste_besoins_id =
'cmom2kz5f009i01qwcssoyb87'`.

### Interprétation
| Résultat | Signification |
|---|---|
| `depense_dupliquee_encore_presente = 0` et `mouvement_duplique_encore_present = 0` et `commande_liste_besoins_id = 'cmom2kz5f009i01qwcssoyb87'` | **Correctif déjà appliqué.** |
| `depense_dupliquee_encore_presente = 1` ou `mouvement_duplique_encore_present = 1` ou `commande_liste_besoins_id` différent/NULL | **Correctif non appliqué** (état encore incohérent). |
| `commande_existe = 0` | **Correctif non concerné sur cette base** — cette commande n'existe pas ici. Distinct de « non appliqué ». |

---

## 3. `fix-calibrage-may14-missing-biometrie.sql`

### Ce que le correctif fait
Insère un relevé `BIOMETRIE` manquant pour Bac 07 (`cmmtgcqsi000504lfaj2rpcjb`), issu du
calibrage du 14 mai (`cmpcimvty002z01rumvue4ayb`), catégorie PETIT. Un seul `INSERT INTO
"Releve"` avec `poidsMoyen = 178`, `echantillonCount = 554`, date littérale
`2026-05-14 21:50:00`.

État final produit : 4 relevés BIOMETRIE liés à ce calibrage (au lieu de 3), un par bac
calibré.

### Idempotence en l'état
**Non.** `INSERT` pur, sans `ON CONFLICT` ni `WHERE NOT EXISTS`, avec `id =
gen_random_uuid()::text` généré à chaque exécution. Rejouer ce script **duplique** le
relevé — c'est le correctif le plus fragile des 5 si exécuté plus d'une fois.

### Identifiants de production en dur
1 `Vague.id`, 1 `Bac.id`, 1 `Site.id`, 1 `Calibrage.id`, valeurs métier `poidsMoyen=178`,
`echantillonCount=554`, horodatage littéral.

### Requête de diagnostic (lecture seule)
```sql
SELECT COUNT(*) AS nb_biometrie_bac07_deja_presente
FROM "Releve"
WHERE "calibrageId" = 'cmpcimvty002z01rumvue4ayb'
  AND "bacId" = 'cmmtgcqsi000504lfaj2rpcjb'
  AND "typeReleve" = 'BIOMETRIE';
-- applied = (nb_biometrie_bac07_deja_presente >= 1)
```
**Valeur attendue si déjà appliqué :** `nb_biometrie_bac07_deja_presente >= 1`.

### Interprétation
| Résultat | Signification |
|---|---|
| `nb_biometrie_bac07_deja_presente >= 1` | **Correctif déjà appliqué** (au moins un relevé BIOMETRIE existe pour ce bac et ce calibrage). **Attention :** si ce chiffre est `2` ou plus, cela signale une **double application** — le script a déjà été exécuté plusieurs fois, un nettoyage des doublons est nécessaire avant toute réflexion sur une migration idempotente. |
| `nb_biometrie_bac07_deja_presente = 0` | **Correctif non appliqué.** Vérifier au préalable que le calibrage `cmpcimvty002z01rumvue4ayb` existe bien sur cette base (sinon, voir cas suivant). |
| Le `calibrageId` n'existe dans aucune ligne `CalibrageGroupe`/`Releve` de cette base | **Correctif non concerné sur cette base** — ce calibrage n'existe pas ici. Distinct de « non appliqué ». |

---

## 4. `fix-vte004-missing-vagueid.sql`

### Ce que le correctif fait
Un seul `UPDATE "Vente" SET "vagueId" = 'cmmvma55c000704jpue712940' WHERE id =
'cmpeot9jg000201nyxfget2gi'` — relie la vente VTE-2026-004 à la vague Dibac, dont elle
avait été créée sans `vagueId` (chaîne vide `''`, pas `NULL`).

État final produit : `Vente.vagueId` = `'cmmvma55c000704jpue712940'` pour cette vente.

### Idempotence en l'état
**Oui, trivialement.** Rejouer l'`UPDATE` avec la même valeur cible ne change rien après
la première exécution — c'est le correctif le plus simple des 5, déjà idempotent sans
modification.

### Identifiants de production en dur
1 `Vente.id`, 1 `Vague.id`. Note : le SQL source précise que `vagueId` était une chaîne
vide `''`, pas `NULL` — un `WHERE vagueId IS NULL` ne suffirait pas à généraliser au-delà
de ce cas précis, mais ce correctif cible un seul id, pas une règle générale.

### Requête de diagnostic (lecture seule)
```sql
SELECT "vagueId", (SELECT COUNT(*) FROM "Vente" WHERE id = 'cmpeot9jg000201nyxfget2gi') AS vente_existe
FROM "Vente" WHERE id = 'cmpeot9jg000201nyxfget2gi';
-- applied = ("vagueId" = 'cmmvma55c000704jpue712940')
```

### Interprétation
| Résultat | Signification |
|---|---|
| `vagueId = 'cmmvma55c000704jpue712940'` | **Correctif déjà appliqué.** |
| `vagueId = ''` ou `NULL` ou toute autre valeur | **Correctif non appliqué** (ou l'état a évolué autrement depuis — à examiner). |
| `vente_existe = 0` (aucune ligne retournée) | **Correctif non concerné sur cette base** — cette vente n'existe pas ici. Distinct de « non appliqué ». |

---

## 5. `gd3-vague-26-03-prep-transferts.sql` (+ `gd3-apply.sh`)

### Ce que le correctif fait
Remplace 3 relevés `COMPTAGE` anti-pattern par une traçabilité correcte de transferts
inter-bacs pour la Vague-26-03-Prep (`cmplrrba6000101qwazzjca26`) :
- Crée 2 `Transfert` (`gd3_transfert_bac08_bac12`, `gd3_transfert_bac12_bac11`) et 2
  `TransfertGroupe` (`gd3_tg_bac08_bac12`, `gd3_tg_bac12_bac11`), avec `ON CONFLICT (id)
  DO NOTHING`.
- Crée 4 `Releve` de type `TRANSFERT` (sortant/entrant pour chaque transfert), avec `ON
  CONFLICT (id) DO NOTHING`.
- Supprime 3 relevés `COMPTAGE` (`cmqf2d6a6...`, `cmqf2d6ah...`, `cmrlr6jgb...`).
- Met à jour `AssignationBac.nombrePoissons = 0` pour Bac 08 et Bac 12 (fermés), gardé
  par `AND "nombrePoissons" != 0`.
- Contient un bloc `DO $$ ... RAISE EXCEPTION ...` de vérification post-écriture qui
  **rollback toute la transaction** si le replay (recalcul de `nombrePoissons` à partir
  des relevés) ne matche pas l'état attendu pour Bac 08, Bac 11, Bac 12 — le plus abouti
  des 5 correctifs en termes de sécurité d'exécution.

### Idempotence en l'état
**Oui, bien conçu.** Les `INSERT` utilisent `ON CONFLICT (id) DO NOTHING` avec des `id`
littéraux préfixés `gd3_...`. Le `DELETE ... WHERE id IN (...)` est naturellement
idempotent. Le second `UPDATE` a la garde `AND "nombrePoissons" != 0`. C'est le seul des
5 correctifs déjà idempotent sans modification.

### Identifiants de production en dur
1 `Vague.id`, 1 `Site.id`, 1 `User.id`, 3 `Bac.id` (Bac 08, Bac 11, Bac 12), 2 `id` de
`Transfert`, 2 `id` de `TransfertGroupe`, 4 `id` de `Releve` (préfixés `gd3_`), 3 `id` de
relevés `COMPTAGE` à supprimer.

### Requête de diagnostic (lecture seule)
```sql
SELECT
  (SELECT COUNT(*) FROM "TransfertGroupe"
   WHERE id IN ('gd3_tg_bac08_bac12','gd3_tg_bac12_bac11')) AS transferts_groupes_presents,
  (SELECT COUNT(*) FROM "Releve"
   WHERE id IN ('cmqf2d6a6005601rr4lop685g','cmqf2d6ah005701rrozze4x36','cmrlr6jgb000301nbu1hizbat')
  ) AS comptages_antipattern_encore_presents
;
-- applied = (transferts_groupes_presents = 2 AND comptages_antipattern_encore_presents = 0)
```

### Interprétation
| Résultat | Signification |
|---|---|
| `transferts_groupes_presents = 2` et `comptages_antipattern_encore_presents = 0` | **Correctif déjà appliqué et vérifié** (le replay a passé au moment de l'exécution, sinon la transaction aurait été rollback). |
| `transferts_groupes_presents = 0` et `comptages_antipattern_encore_presents = 3` | **Correctif non appliqué.** |
| Résultat partiel (ex. `transferts_groupes_presents = 2` mais `comptages_antipattern_encore_presents = 3`) | **État anormal** — ne devrait pas se produire car tout est dans une seule transaction (`BEGIN ... COMMIT`) avec rollback automatique en cas d'échec du replay. Si observé, investiguer avant toute action (possible exécution partielle hors transaction, ou modification manuelle ultérieure). |
| Les 3 `Bac` / la `Vague` ciblés n'existent pas sur cette base | **Correctif non concerné sur cette base.** Distinct de « non appliqué ». |

**Discordance de date à noter honnêtement :** `docs/analysis/GD3-data-fix-report.md`
indique une exécution le **2026-07-15** (10:49:19, avec backup
`/tmp/backup-avant-GD3-20260715-104919.sql`), alors que la commande de ce sprint MG
évoque « appliqué manuellement en production aujourd'hui » (**2026-07-26**). Cette
discordance **ne change pas la conclusion** : que ce soit le 15/07 ou le 26/07, gd3 est
appliqué dans les deux cas (la requête de diagnostic ci-dessus tranchera sans ambiguïté
l'état actuel). Mais cette discordance est **le symptôme même du problème que ce sprint
corrige** : sans migration versionnée, enregistrée dans `_prisma_migrations` avec un
horodatage fiable, la date exacte d'application d'un correctif de données n'est
simplement **pas fiable** — elle dépend de la mémoire humaine ou de la date de rédaction
d'un rapport, jamais d'un registre technique vérifiable.

---

## Un seul script à exécuter

Bloc SQL unique enchaînant les 5 diagnostics, avec une ligne de synthèse lisible par
correctif — à copier-coller tel quel dans un client `psql` connecté à la base cible.

```sql
WITH
  vague2601 AS (
    SELECT
      (SELECT COUNT(*) FROM "AssignationBac"
       WHERE "vagueId" = 'cmmth8mav000004k31i3he89v' AND "dateFin" IS NULL
         AND "bacId" IN ('cmmnd2oab000104jse23g509w','cmmtgbf4x000204lfb3tsnrrd',
                         'cmmtgcqsi000504lfaj2rpcjb','cmmtgd8br000704lf12xj13e1')) AS lignes_existantes,
      (SELECT COUNT(*) FROM "AssignationBac"
       WHERE "vagueId" = 'cmmth8mav000004k31i3he89v' AND "dateFin" IS NULL
         AND "bacId" IN ('cmmnd2oab000104jse23g509w','cmmtgbf4x000204lfb3tsnrrd',
                         'cmmtgcqsi000504lfaj2rpcjb','cmmtgd8br000704lf12xj13e1')
         AND "nombrePoissons" NOT IN (1564, 2117, 554, 752)) AS assignation_non_corrigee
  ),
  besCmd AS (
    SELECT
      (SELECT COUNT(*) FROM "Commande" WHERE id = 'cmom2r03c009q01qwm9b7x3j9') AS commande_existe,
      (SELECT COUNT(*) FROM "Depense" WHERE id = 'cmom2lhi9009l01qwxg0n69bv') AS depense_dupliquee_encore_presente,
      (SELECT COUNT(*) FROM "MouvementStock" WHERE id = '4c1fbfc5-1c76-4938-b628-7cddca9226ea') AS mouvement_duplique_encore_present,
      (SELECT "listeBesoinsId" FROM "Commande" WHERE id = 'cmom2r03c009q01qwm9b7x3j9') AS commande_liste_besoins_id
  ),
  calibrageMay14 AS (
    SELECT COUNT(*) AS nb_biometrie_bac07_deja_presente
    FROM "Releve"
    WHERE "calibrageId" = 'cmpcimvty002z01rumvue4ayb'
      AND "bacId" = 'cmmtgcqsi000504lfaj2rpcjb'
      AND "typeReleve" = 'BIOMETRIE'
  ),
  vte004 AS (
    SELECT
      (SELECT COUNT(*) FROM "Vente" WHERE id = 'cmpeot9jg000201nyxfget2gi') AS vente_existe,
      (SELECT "vagueId" FROM "Vente" WHERE id = 'cmpeot9jg000201nyxfget2gi') AS vagueid_actuel
  ),
  gd3 AS (
    SELECT
      (SELECT COUNT(*) FROM "TransfertGroupe"
       WHERE id IN ('gd3_tg_bac08_bac12','gd3_tg_bac12_bac11')) AS transferts_groupes_presents,
      (SELECT COUNT(*) FROM "Releve"
       WHERE id IN ('cmqf2d6a6005601rr4lop685g','cmqf2d6ah005701rrozze4x36','cmrlr6jgb000301nbu1hizbat')
      ) AS comptages_antipattern_encore_presents
  )
SELECT
  'vague2601-phantom-fish' AS correctif,
  CASE
    WHEN v.lignes_existantes = 0 THEN 'NON CONCERNÉ (lignes absentes de cette base)'
    WHEN v.assignation_non_corrigee = 0 THEN 'APPLIQUÉ'
    ELSE 'NON APPLIQUÉ'
  END AS statut
FROM vague2601 v
UNION ALL
SELECT
  'bes033-cmd015-duplicate',
  CASE
    WHEN b.commande_existe = 0 THEN 'NON CONCERNÉ (commande absente de cette base)'
    WHEN b.depense_dupliquee_encore_presente = 0
     AND b.mouvement_duplique_encore_present = 0
     AND b.commande_liste_besoins_id = 'cmom2kz5f009i01qwcssoyb87' THEN 'APPLIQUÉ'
    ELSE 'NON APPLIQUÉ'
  END
FROM besCmd b
UNION ALL
SELECT
  'calibrage-may14-missing-biometrie',
  CASE
    WHEN c.nb_biometrie_bac07_deja_presente = 0 THEN 'NON APPLIQUÉ (ou calibrage non concerné — vérifier existence du calibrage séparément)'
    WHEN c.nb_biometrie_bac07_deja_presente = 1 THEN 'APPLIQUÉ'
    ELSE 'APPLIQUÉ PLUSIEURS FOIS — ANOMALIE (doublons à nettoyer)'
  END
FROM calibrageMay14 c
UNION ALL
SELECT
  'vte004-missing-vagueid',
  CASE
    WHEN t.vente_existe = 0 THEN 'NON CONCERNÉ (vente absente de cette base)'
    WHEN t.vagueid_actuel = 'cmmvma55c000704jpue712940' THEN 'APPLIQUÉ'
    ELSE 'NON APPLIQUÉ'
  END
FROM vte004 t
UNION ALL
SELECT
  'gd3-vague-26-03-prep-transferts',
  CASE
    WHEN g.transferts_groupes_presents = 2 AND g.comptages_antipattern_encore_presents = 0 THEN 'APPLIQUÉ'
    WHEN g.transferts_groupes_presents = 0 AND g.comptages_antipattern_encore_presents = 3 THEN 'NON APPLIQUÉ'
    ELSE 'ÉTAT ANORMAL — investiguer avant toute action'
  END
FROM gd3 g;
```

**Lecture attendue :** 5 lignes, une par correctif, colonne `statut` directement lisible
sans calcul mental (`APPLIQUÉ` / `NON APPLIQUÉ` / `NON CONCERNÉ (...)` / `ÉTAT ANORMAL —
...`).
