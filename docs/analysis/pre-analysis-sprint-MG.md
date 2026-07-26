# Pré-analyse Sprint MG — 2026-07-26

## Statut : GO AVEC RÉSERVES

## Résumé
Le principe du sprint (« tout correctif de données est une migration ») est sain et les scripts de lecture existants (`su12-audit-doublons-numero.ts`, `px-audit-signatures-corrompues.ts`) sont bien strictement read-only. Mais deux points bloquent une exécution mécanique : (1) le pipeline de déploiement (`docker-entrypoint.sh`) exécute `prisma migrate deploy` **inconditionnellement** à chaque démarrage de conteneur et **avale silencieusement un échec** (`|| echo WARNING ... continuing`) — donc convertir un correctif en migration sans données de diagnostic préalables en production est risqué ; (2) le statut prod des deux migrations d'unicité (`20260726174843`, `20260726212515`) **ne peut pas être déterminé depuis le dépôt** — voir section D, ne rien supposer avant d'avoir interrogé la prod.

## Vérifications effectuées

### A. Inventaire

**Fichiers de correctif/audit de données (hors migrations normales) :**
| Fichier | Type | Nature |
|---|---|---|
| `prisma/migrations/fix-vague2601-phantom-fish.sql` | racine migrations (inerte) | correctif écriture |
| `prisma/migrations/fix-bes033-cmd015-duplicate.sql` | racine migrations (inerte) | correctif écriture |
| `prisma/migrations/fix-calibrage-may14-missing-biometrie.sql` | racine migrations (inerte) | correctif écriture |
| `prisma/migrations/fix-vte004-missing-vagueid.sql` | racine migrations (inerte) | correctif écriture |
| `scripts/data-fixes/gd3-vague-26-03-prep-transferts.sql` | script + `gd3-apply.sh` | correctif écriture, **déjà appliqué en prod** (rapport `docs/analysis/GD3-data-fix-report.md`, exécution du 2026-07-15) |
| `scripts/data-fixes/su12-audit-doublons-numero.ts` | script `.ts` | audit lecture seule (confirmé par lecture complète) |
| `scripts/data-fixes/px-audit-signatures-corrompues.ts` | script `.ts` | audit lecture seule (confirmé par lecture complète) |
| `prisma/data-fixes/CX3-audit-empty-assignations.sql` | script | audit lecture seule (précédent existant, autre emplacement) |
| `prisma/data-fixes/CF1-audit-stale-assignations.sql` | script | audit lecture seule (précédent existant, autre emplacement) |
| `prisma/fix-vague-26-01.sql` | racine `prisma/` (hors `migrations/`) | correctif écriture — **orphelin supplémentaire non cité dans la mission**, découvert pendant l'inventaire |
| `scripts/fix-missing-mouvements.sql` | racine `scripts/` | correctif écriture — orphelin supplémentaire découvert |
| `scripts/fix-depense-mouvement-link.sql` | racine `scripts/` | correctif écriture — orphelin supplémentaire découvert |
| `scripts/repair-bug041.sql` | racine `scripts/` | correctif écriture — orphelin supplémentaire découvert (aucun garde d'idempotence visible : simple `INSERT`, pas de `WHERE NOT EXISTS`) |

**Constat important pour @knowledge-keeper / @project-manager** : le problème « correctif de données hors migration » n'est pas limité aux 4 fichiers cités dans la mission + gd3 — c'est un pattern récurrent depuis mai 2026 (`prisma/fix-vague-26-01.sql`, `scripts/fix-missing-mouvements.sql`, `scripts/fix-depense-mouvement-link.sql`, `scripts/repair-bug041.sql`). Le scope MG devrait décider explicitement s'il couvre aussi ces 4-là ou les traite comme dette historique acceptée (ils sont vraisemblablement déjà appliqués et n'ont pas de trace de vérification post-exécution comme GD3, donc rejouer une conversion en migration idempotente sur eux est plus risqué faute de certitude sur leur état).

**Migrations existantes** : 130 dossiers dans `prisma/migrations/`, ordre chronologique confirmé par nom de dossier (timestamps). Les 2 plus récentes sont :
- `20260726174843_numero_unique_par_site`
- `20260726212515_lotalevins_code_unique_par_site`

Toute nouvelle migration MG doit utiliser un timestamp **postérieur** à `20260726212515` (ex. préfixe `2026072X` où X est plus tard que 21h25, ou une date ultérieure si le sprint MG se déroule après le 26/07).

**Confirmation par grep** : les 4 fichiers orphelins à la racine de `prisma/migrations/` ne sont référencés dans **aucun** `migration.sql`, script npm (`package.json`), CI, ou `Dockerfile`. Seules mentions : `docs/knowledge/ERRORS-AND-FIXES.md` et `docs/analysis/pre-analysis-sprint-PX.md` (mentions documentaires, pas d'exécution automatisée). `gd3-apply.sh` référence le `.sql` voisin (normal, c'est son propre script d'application manuelle) — aucune référence externe.

**`docs/sprints/SPRINT-MG*.md` ou entrée MG dans `docs/TASKS.md`** : **aucun trouvé**. Ni fichier de sprint, ni ligne `MG.x` dans `docs/TASKS.md`. Ce sprint n'a pas encore de story formalisée dans le backlog — à créer avant de commencer (le pipeline `docs/PROCESSES.md` l'exige : pré-analyste → implémenteur → testeur → code-reviewer → knowledge-keeper → status-updater, et TASKS.md est la source de vérité des tâches).

### Schema ↔ Types : Non applicable à ce sprint (pas de nouveau modèle Prisma prévu — seulement migrations de rattrapage de données + suppression de fichiers)

### API ↔ Queries : Non applicable (aucune route API concernée directement)

### Build : non exécuté à ce stade (aucun changement de code encore fait) — à exécuter par l'implémenteur après ses modifications, cf. R9.

### Tests : `su12-numero-unique-constraint.test.ts`, `su12-unicite-numero-par-site-guard.test.ts`, `px-audit-signatures-corrompues.test.ts` existent déjà et documentent le comportement attendu des deux garde-fous déjà livrés (SU.12/SU.13, PX.5) — bons patterns de référence pour MG.6, pas d'exécution nécessaire ici (ce ne sont pas des tests visés par MG, ils passent déjà en l'état, confirmé indirectement par leur présence dans la suite standard listée au sprint SU).

## B. Analyse fonctionnelle de chaque correctif orphelin

### 1. `fix-vague2601-phantom-fish.sql`
- **Modifie** : 4 lignes `Bac.nombrePoissons` + 4 lignes `AssignationBac.nombrePoissons` (mappé `nombreActuel` côté Prisma) pour la vague `cmmth8mav000004k31i3he89v`, en les ramenant à des valeurs calculées manuellement (COMPTAGE − mortalités post-calibrage).
- **Idempotent en l'état ?** Non. Ce sont des `UPDATE ... SET x = <valeur littérale> WHERE id = '<id>'` sans condition sur l'état actuel — rejouable sans casse (il remettrait juste les mêmes valeurs), mais **pas silencieux en cas de non-pertinence** : si entre-temps un relevé légitime a fait évoluer `nombrePoissons`, ce correctif l'écraserait à tort. Rejouer plusieurs fois ne duplique rien (pas d'INSERT), mais ce n'est pas un "no-op garanti" — c'est un `UPDATE` inconditionnel qui écrase toujours, qu'il soit nécessaire ou non.
- **Dépendances en dur** : 4 `Bac.id` littéraux, 1 `Vague.id` littéral, valeurs numériques calculées à la main (1564/2117/554/752), aucune règle générique.
- **Diagnostic SQL (lecture seule)** :
```sql
SELECT
  (SELECT COUNT(*) FROM "Bac"
   WHERE id IN ('cmmnd2oab000104jse23g509w','cmmtgbf4x000204lfb3tsnrrd','cmmtgcqsi000504lfaj2rpcjb','cmmtgd8br000704lf12xj13e1')
     AND "nombrePoissons" NOT IN (1564, 2117, 554, 752)) AS bac_non_corrige,
  (SELECT COUNT(*) FROM "AssignationBac"
   WHERE "vagueId" = 'cmmth8mav000004k31i3he89v' AND "dateFin" IS NULL
     AND "bacId" IN ('cmmnd2oab000104jse23g509w','cmmtgbf4x000204lfb3tsnrrd','cmmtgcqsi000504lfaj2rpcjb','cmmtgd8br000704lf12xj13e1')
     AND "nombrePoissons" NOT IN (1564, 2117, 554, 752)) AS assignation_non_corrigee;
-- applied = (bac_non_corrige = 0 AND assignation_non_corrigee = 0)
```

### 2. `fix-bes033-cmd015-duplicate.sql`
- **Modifie** : `Commande.listeBesoinsId`, `Depense.listeBesoinsId`, `LigneBesoin.commandeId`, `LigneDepense.ligneBesoinId` (liaisons), puis **supprime** une `Depense` (cascade `LigneDepense` + `PaiementDepense`) et un `MouvementStock` en double.
- **Idempotent en l'état ?** Partiellement. Les 4 `UPDATE` ont déjà une garde `WHERE ... IS NULL` (donc rejouables sans effet si déjà liés — bon pattern). Les 2 `DELETE` en revanche sont inconditionnels sur un `id` : rejouables sans erreur (DELETE sur ligne absente = 0 ligne affectée, pas d'exception), donc en réalité l'ensemble **est** idempotent au sens strict (aucune exception, aucune duplication), mais silencieusement no-op seulement parce que DELETE par id est naturellement idempotent — pas par conception explicite.
- **Dépendances en dur** : 6 identifiants CUID littéraux (Commande, Depense×2, MouvementStock, LigneBesoin, LigneDepense).
- **Diagnostic SQL** :
```sql
SELECT
  (SELECT COUNT(*) FROM "Depense" WHERE id = 'cmom2lhi9009l01qwxg0n69bv') AS depense_dupliquee_encore_presente,
  (SELECT COUNT(*) FROM "MouvementStock" WHERE id = '4c1fbfc5-1c76-4938-b628-7cddca9226ea') AS mouvement_duplique_encore_present,
  (SELECT "listeBesoinsId" FROM "Commande" WHERE id = 'cmom2r03c009q01qwm9b7x3j9') AS commande_liste_besoins_id;
-- applied = (depense_dupliquee_encore_presente = 0 AND mouvement_duplique_encore_present = 0
--            AND commande_liste_besoins_id = 'cmom2kz5f009i01qwcssoyb87')
```

### 3. `fix-calibrage-may14-missing-biometrie.sql`
- **Modifie** : `INSERT` d'un unique relevé `Releve` (BIOMETRIE) manquant pour Bac 07, lié au calibrage `cmpcimvty002z01rumvue4ayb`.
- **Idempotent en l'état ?** Non — `INSERT` pur sans `ON CONFLICT` ni `WHERE NOT EXISTS`. Rejouer ce script **dupliquerait** le relevé (nouvel `id` via `gen_random_uuid()` à chaque exécution). C'est le correctif le plus fragile des 4 pour une conversion en migration idempotente telle quelle.
- **Dépendances en dur** : 1 `Vague.id`, 1 `Bac.id`, 1 `Site.id`, 1 `Calibrage.id`, valeur métier `poidsMoyen=178`, `echantillonCount=554`, horodatage littéral `2026-05-14 21:50:00`.
- **Diagnostic SQL** :
```sql
SELECT COUNT(*) AS nb_biometrie_bac07_deja_presente
FROM "Releve"
WHERE "calibrageId" = 'cmpcimvty002z01rumvue4ayb'
  AND "bacId" = 'cmmtgcqsi000504lfaj2rpcjb'
  AND "typeReleve" = 'BIOMETRIE';
-- applied = (nb_biometrie_bac07_deja_presente >= 1)
```

### 4. `fix-vte004-missing-vagueid.sql`
- **Modifie** : un seul `UPDATE "Vente" SET vagueId = ... WHERE id = ...`.
- **Idempotent en l'état ?** Oui, trivialement — rejouer l'UPDATE avec la même valeur cible ne change rien après la première exécution. C'est le plus simple à convertir sans risque.
- **Dépendances en dur** : `Vente.id`, `Vague.id` (Dibac) littéraux. Le SQL note explicitement que `vagueId` était une chaîne vide `''`, pas `NULL` — donc un `WHERE vagueId IS NULL` ne suffirait pas comme condition générique, il faut `WHERE vagueId = '' OR vagueId IS NULL` si on voulait généraliser au-delà de ce cas précis (mais ici c'est un correctif ciblé sur un seul id, pas une règle générale).
- **Diagnostic SQL** :
```sql
SELECT "vagueId" FROM "Vente" WHERE id = 'cmpeot9jg000201nyxfget2gi';
-- applied = ("vagueId" = 'cmmvma55c000704jpue712940')
```

### 5. `gd3-vague-26-03-prep-transferts.sql` (+ `gd3-apply.sh`)
- **Modifie** : crée 2 `Transfert` + 2 `TransfertGroupe` + 4 `Releve` (TRANSFERT), **supprime** 3 relevés `COMPTAGE` anti-pattern, met à jour `AssignationBac.nombrePoissons` pour Bac 08 et Bac 12 (fermés) à `0`. Contient un bloc `DO $$ ... RAISE EXCEPTION ...` de vérification post-écriture qui **rollback toute la transaction** si l'invariant de replay ne matche pas — c'est le correctif le plus abouti des 5 en termes de sécurité d'exécution.
- **Idempotent** : les `INSERT` utilisent `ON CONFLICT (id) DO NOTHING` avec des `id` littéraux préfixés `gd3_...` — donc rejouable sans duplication. Le `DELETE ... WHERE id IN (...)` est naturellement idempotent (no-op si déjà supprimé). Le seul point non totalement no-op silencieux : le second `UPDATE AssignationBac` a une garde `AND "nombrePoissons" != 0` — bon pattern, évite un `UPDATE` inutile en rejouant.
- **Déjà appliqué en prod** selon `docs/analysis/GD3-data-fix-report.md` (exécution 2026-07-15 10:49:19, backup `/tmp/backup-avant-GD3-20260715-104919.sql`). **Attention à la formulation de la mission** : elle indique « appliqué manuellement en production aujourd'hui » (26/07), alors que le rapport committé indique le 15/07. Cette discordance de date n'a pas pu être résolue par lecture seule du dépôt (le rapport peut avoir été rédigé avec une date d'exécution antérieure puis committé plus tard, ou la date du rapport peut être erronée) — **à faire confirmer par l'utilisateur avant toute action**, ne pas supposer que gd3 est "récent et pas encore vérifié" sans confirmation. Si le rapport est fiable, gd3 est déjà appliqué et vérifié (replay OK) — le convertir rétroactivement en migration n'a d'intérêt que pour la traçabilité/anti-récidive (MG.6), pas pour une ré-application.
- **Diagnostic SQL** :
```sql
SELECT
  (SELECT COUNT(*) FROM "TransfertGroupe" WHERE id IN ('gd3_tg_bac08_bac12','gd3_tg_bac12_bac11')) AS transferts_groupes_presents,
  (SELECT COUNT(*) FROM "Releve" WHERE id IN ('cmqf2d6a6005601rr4lop685g','cmqf2d6ah005701rrozze4x36','cmrlr6jgb000301nbu1hizbat')) AS comptages_antipattern_encore_presents;
-- applied = (transferts_groupes_presents = 2 AND comptages_antipattern_encore_presents = 0)
```

## C. Faisabilité de la conversion en migrations

| Correctif | Stratégie d'idempotence recommandée | Nom de dossier suggéré |
|---|---|---|
| vague2601-phantom-fish | `UPDATE ... WHERE id = X AND "nombrePoissons" != <valeur_cible>` (garde explicite, sinon no-op silencieux garanti même si un relevé légitime a changé la valeur entre-temps — mais alors le correctif deviendrait FAUX, pas juste redondant : à documenter comme risque, cf. Risques) | `2026072X_data_fix_vague2601_phantom_fish` |
| bes033-cmd015-duplicate | Conserver les gardes `WHERE ... IS NULL` existantes pour les UPDATE ; les DELETE par id sont déjà idempotents nativement, aucun changement structurel nécessaire | `2026072X_data_fix_bes033_cmd015_duplicate` |
| calibrage-may14-missing-biometrie | Ajouter `WHERE NOT EXISTS (SELECT 1 FROM "Releve" WHERE "calibrageId"=... AND "bacId"=... AND "typeReleve"='BIOMETRIE')` autour de l'INSERT (via `INSERT ... SELECT ... WHERE NOT EXISTS (...)` car `INSERT ... VALUES` ne supporte pas nativement de clause `WHERE`) — sinon duplication à chaque replay | `2026072X_data_fix_calibrage_may14_missing_biometrie` |
| vte004-missing-vagueid | Déjà idempotent, garder tel quel (option : ajouter `AND vagueId != <cible>` pour un no-op explicite plutôt qu'un UPDATE toujours exécuté) | `2026072X_data_fix_vte004_missing_vagueid` |
| gd3 (déjà en prod, sous réserve de la discordance de date ci-dessus) | Déjà correctement gardé (`ON CONFLICT DO NOTHING` + condition sur `UPDATE`) — à documenter en migration seulement pour traçabilité, pas pour ré-application | `2026072X_data_fix_gd3_vague2603_prep_transferts` |

**Cas où le correctif recalcule un agrégat dérivé** : `vague2601-phantom-fish` (Bac.nombrePoissons + AssignationBac.nombrePoissons) et `gd3` (AssignationBac.nombrePoissons) recalculent des agrégats dérivés. C'est le point le plus subtil : une garde `WHERE nombrePoissons != <cible>` protège contre le replay du même correctif, mais **ne protège pas** contre le cas où une opération métier légitime (nouveau relevé) a fait évoluer la valeur entre la rédaction du correctif et son déploiement effectif — le correctif écraserait alors une valeur devenue correcte avec une valeur devenue obsolète. Recommandation : la migration devrait recalculer la valeur cible **dynamiquement** (via la même formule de replay que ADR-049/`verifyAssignationInvariant`) plutôt que d'utiliser une constante littérale figée au moment de l'investigation — sinon ajouter une garde temporelle (`AND "updatedAt" < '<date de l'investigation>'`) pour ne jamais toucher une ligne modifiée après coup.

**À supprimer** : les 4 fichiers `.sql` orphelins à la racine de `prisma/migrations/` (après conversion en vraies migrations), `scripts/data-fixes/gd3-apply.sh` (remplacé par `migrate deploy`, standard du projet — plus besoin de backup/apply manuel ad hoc une fois en migration versionnée). Le fichier `docs/analysis/GD3-data-fix-report.md` peut rester comme trace historique (ce n'est pas du code exécutable).

## D. Les deux migrations d'unicité

Contenu des deux migrations : uniquement `DROP INDEX <ancien_unique_global>` + `CREATE UNIQUE INDEX <nouveau_composite (siteId, champ)>`, **aucun** `UPDATE`/dédoublonnage de données dans le SQL de migration lui-même.

**Ce qui se passe s'il existe des doublons `(siteId, numero)` en production** : impossible par construction actuelle, dans un sens précis — la contrainte **avant** cette migration est `@unique` **globale** sur `numero` seul (une seule ligne par valeur de `numero`, tous sites confondus). Il ne peut donc structurellement pas exister deux lignes avec le même `(siteId, numero)` puisqu'il ne peut même pas exister deux lignes avec le même `numero` tout court. **`CREATE UNIQUE INDEX` sur `(siteId, numero)` ne peut donc pas échouer sur des données déjà contraintes par un unique global antérieur** — la nouvelle contrainte est strictement plus permissive que l'ancienne. Le `DROP INDEX` précédent ne peut pas non plus échouer (il ne fait que retirer une contrainte, jamais un `ALTER COLUMN ... USING` qui pourrait rejeter des données). **Conclusion : ces deux migrations, prises isolément, ne peuvent pas échouer sur la contrainte elle-même, quel que soit l'état des données**, contrairement à ce que suggère la doc du script (`su12-audit-doublons-numero.ts`) qui présente l'audit comme un pré-requis empêchant un `CREATE UNIQUE INDEX` en échec. Le seul scénario qui pourrait effectivement faire échouer le `CREATE UNIQUE INDEX` serait l'existence d'une dérive de schéma antérieure (cf. ERR-038) où l'unique global sur `numero` aurait déjà été retiré ou contourné hors migration — rien dans le dépôt n'indique un tel cas, mais je ne peux pas prouver son absence en production par simple lecture du dépôt.

**Rollback en cas d'échec** : les deux fichiers ne contiennent pas de `BEGIN`/`COMMIT` explicite ; Prisma exécute chaque migration dans sa propre transaction implicite par défaut (sauf directive `-- Disable-Transaction` absente ici) — un échec sur l'un des `DROP INDEX`/`CREATE UNIQUE INDEX` ferait rollback proprement de toute la migration, sans état intermédiaire. Mais **si `migrate deploy` échoue au démarrage du conteneur, `docker-entrypoint.sh` ne fait qu'un `echo WARNING` et démarre quand même le serveur** — donc en cas d'échec réel, l'application démarrerait avec un schéma non migré, potentiellement incohérent avec le code déployé (risque distinct de la question des doublons, mais à ne pas négliger).

**Ces migrations sont-elles déjà appliquées en production ?** **Je ne peux pas le déterminer avec certitude depuis le dépôt — ne pas supposer.** Éléments trouvés :
- `docs/TASKS.md` et `docs/sprints/SPRINT-SU.md` indiquent un statut `FAIT` pour SU.12/SU.13 avec « contrôle préalable d'absence de doublons en base (0 trouvé) » — mais rien n'indique explicitement si ce contrôle a été fait contre la base de **dev** (Docker, port 8432, celle utilisée pendant le sprint par l'agent) ou contre la base de **prod** (Prisma Postgres, prisma.io).
- Le test `su12-numero-unique-constraint.test.ts` prouve que l'index composite existe en base de **dev** (`DATABASE_URL` de dev) — pas en prod.
- `docker-entrypoint.sh` exécute `prisma migrate deploy` à **chaque démarrage** du conteneur de prod — donc si le conteneur de production a été redéployé/redémarré au moins une fois depuis que ces 2 migrations ont été committées (commit `61c5945`), elles ont très probablement déjà été appliquées automatiquement (le mécanisme est automatique, pas gated par l'audit manuel). Aucune trace dans le dépôt d'un horodatage de déploiement prod ni de logs de conteneur n'est disponible en lecture seule pour confirmer.
- **Recommandation à l'utilisateur** : faire confirmer l'état réel en exécutant `SELECT indexdef FROM pg_indexes WHERE tablename IN ('Facture','Depense','Commande','Vente','BonLivraison','ListeBesoins','Ponte','Incubation','LotGeniteurs','LotAlevins')` directement en prod avant toute décision — ce point est déterminant pour MG (ne jamais réécrire une migration déjà appliquée).

**Scope des contraintes** : `@@unique([siteId, numero])` ou `@@unique([siteId, code])` selon le modèle (9 familles `numero`, 4 familles `code` : Ponte, Incubation, LotGeniteurs, LotAlevins — cf. liste dans `su12-audit-doublons-numero.ts`).

**Résolution des doublons — éléments pour trancher (pas de décision prise ici)** :
- **Suffixe déterministe** (ex. `FAC-2026-001-DUP2`) : préserve la continuité opérationnelle, ne bloque pas le déploiement, mais introduit un numéro non conforme au format attendu par le reste du code (regex de parsing du prochain numéro dans `numero-utils.ts` à vérifier).
- **Renumérotation** (recalculer un nouveau numéro pour le doublon le plus récent) : cohérent avec le format, mais change un identifiant métier potentiellement déjà communiqué à un client/fournisseur (facture, bon de livraison) — impact utilisateur à peser.
- **Échec explicite** (`RAISE EXCEPTION` listant les doublons trouvés) : le plus sûr en migration automatisée (le déploiement s'arrête plutôt que de choisir silencieusement une remédiation), mais **exploite mal** le comportement actuel de `docker-entrypoint.sh` qui avale les erreurs de migration et démarre quand même — un `RAISE EXCEPTION` dans ce contexte ne bloquerait donc pas réellement le déploiement, juste le schéma resterait non migré silencieusement. Cette dernière remarque est un argument fort pour corriger `docker-entrypoint.sh` (ne plus avaler les échecs de migration) **avant ou pendant** MG, indépendamment du choix de remédiation des doublons.

## E. Les deux scripts d'audit

**`su12-audit-doublons-numero.ts`** : confirmé par lecture intégrale — aucune écriture. Utilise `pg.Pool` en lecture seule (`SELECT ... GROUP BY ... HAVING count(*) > 1`), code de sortie 0/1/2, ne fait jamais de `UPDATE`/`INSERT`/`DELETE`. C'est un vrai audit, pas un correctif déguisé.

**Le garde-fou de MG.4 rend-il `su12-audit-doublons-numero` facultatif ?** Non, il reste utile mais son utilité change de nature : comme démontré en D, la migration composite ne peut structurellement pas échouer sur des doublons puisque l'ancienne contrainte globale les empêchait déjà. L'audit reste donc pertinent uniquement (a) comme diagnostic défensif contre une dérive de schéma non documentée (ERR-038 : si l'unique global avait été retiré hors migration), et (b) comme test de non-régression futur one-shot avant de créer de **nouvelles** familles de numérotation scopées par site — mais il n'est **pas** un pré-requis bloquant à l'application des deux migrations déjà écrites. Le garde-fou structurel réellement pertinent pour MG serait plutôt de vérifier qu'aucune dérive de schéma (ERR-038) n'a modifié la contrainte `@unique` globale hors migration entre la création du code applicatif et l'application de la migration — chose que l'audit actuel ne vérifie pas explicitement (il vérifie les données, pas la définition de contrainte active).

**`px-audit-signatures-corrompues.ts`** : confirmé par lecture intégrale — aucune écriture, pagination `LIMIT/OFFSET`, réutilise `decodeImageDataUrl()` (PX.1). Détecte, pour chaque signature/cachet stocké (`BonLivraison.signatureClient/signatureLivreur`, `Site.signaturePromoteur/cachet`), si le PNG est décodable (structure PNG + inflate zlib de l'IDAT, sans vérification CRC — limitation documentée dans le décodeur, cf. commentaire `ADR-047 D1` dans le test associé).

**Le rendu dégradé est-il déjà non-bloquant ?** Oui, confirmé par lecture de `src/__tests__/export/pdf-render-guard-unconditional.test.ts` : ce test appelle le **vrai** moteur `@react-pdf/renderer` (pas mocké) et prouve que `renderPdfSafely` (garde AVAL, ADR-047 D3-b) protège la requête HTTP **indépendamment** de la pré-validation amont (`isDecodableImage`) — le scénario historique de blocage (promesse jamais réglée + exception process-level non catchée) ne peut plus se reproduire, même si une image corrompue passe la validation amont. Confirmé également par le commit récent `564ac5f fix(pdf): une image indécodable ne peut plus suspendre ni tuer une requête`.

**Un correctif de données est-il nécessaire pour PX ?** Non comme urgence bloquante — le rendu est déjà protégé côté application, l'audit sert seulement à **quantifier** combien de signatures legacy sont réellement corrompues (pour décision de remédiation manuelle éventuelle : redemander la signature, nettoyer à NULL), pas à corriger un bug de disponibilité. **Limite documentée du script lui-même à respecter** : la décodabilité SQL pure n'existe pas — `decodeImageDataUrl()` fait un vrai `zlib.inflateSync` en JavaScript ; il n'y a et il ne peut y avoir aucun équivalent en SQL pur (PostgreSQL n'a pas de fonction d'inflate zlib générique en core). Toute tentative de "diagnostic SQL en lecture seule" pour PX devra nécessairement être un script applicatif (TypeScript/Node), jamais une requête SQL — contrairement aux 4+1 correctifs de données de la section B qui, eux, se prêtent à un diagnostic SQL pur (comparaison de valeurs stockées, pas de décodage de contenu binaire).

## F. Anti-récidive

- **Emplacement des tests** : `vitest` (config `vitest.config.ts` à la racine), suites principales sous `src/__tests__/**` (exclusion `src/__tests__/e2e/**`) et localement sous `scripts/data-fixes/__tests__/**` pour les scripts hors `src/`.
- **Tests de garde structurels existants à réutiliser comme modèle** :
  - `src/__tests__/permissions-orphan-guard.test.ts` — lit un fichier (`prisma/seed.sql`) et compare à l'enum `Permission` (motif : test basé sur lecture de fichier statique, pas sur une exécution dynamique qui masquerait le bug par construction).
  - `src/__tests__/su12-unicite-numero-par-site-guard.test.ts` — garde applicative liée à SU.12/13.
  - `scripts/data-fixes/__tests__/su12-numero-unique-constraint.test.ts` — test d'intégration DB réelle (rollback systématique, `describe.runIf(!!DATABASE_URL)` pour ne pas casser la suite sans Docker).
- **Fichier de test à créer pour MG.6** : `src/__tests__/data-fixes-migration-guard.test.ts` (ou `scripts/data-fixes/__tests__/data-fixes-migration-guard.test.ts`), suivant le pattern de `permissions-orphan-guard.test.ts` (lecture de fichiers réels via `fs.readdirSync`, pas d'exécution).
- **Convention proposée, pragmatique et vérifiable par un test (pas devinatoire)** :
  1. **Tout fichier `.sql` sous `scripts/data-fixes/` dont le nom ne commence pas par `audit-` ou ne contient pas le mot `audit` doit avoir un commentaire d'en-tête contenant une ligne `-- Migration: <nom-du-dossier-de-migration>` référençant un dossier existant sous `prisma/migrations/`.** Le test vérifie : (a) le dossier de migration référencé existe et contient un `migration.sql`, (b) aucun fichier `.sql` sous `prisma/migrations/` racine (hors sous-dossiers) n'existe (interdiction absolue de fichier `.sql` orphelin à ce niveau — le test peut faire un simple `fs.readdirSync("prisma/migrations", { withFileTypes: true })` et échouer si une entrée est un fichier, pas un dossier).
  2. Cette double vérification est robuste car elle ne dépend d'aucune heuristique de contenu SQL (pas de détection UPDATE/INSERT/DELETE par regex fragile) — elle vérifie une propriété structurelle du système de fichiers, testable de façon déterministe.
  3. Les scripts d'audit purs (`*-audit-*.ts`) sont exclus de cette règle par leur nommage (déjà appliqué en pratique : `su12-audit-*`, `px-audit-*`, `CX3-audit-*`, `CF1-audit-*`) — la convention de nommage `audit` existe déjà informellement dans le dépôt, il suffit de la vérifier mécaniquement plutôt que de compter sur la discipline humaine.

## Verdict par story

- **MG.2 (analyse fonctionnelle)** : GO — analyse livrée ci-dessus (section B), aucun blocage.
- **MG.3 (conversion en migrations idempotentes)** : GO AVEC RÉSERVE — `fix-calibrage-may14-missing-biometrie.sql` nécessite une réécriture non triviale (`INSERT ... WHERE NOT EXISTS`) pour devenir idempotent ; `fix-vague2601-phantom-fish.sql` et le volet `AssignationBac` de `gd3` recalculent un agrégat dérivé avec une constante figée — risque de désynchronisation si l'état a évolué entre l'investigation et le déploiement (voir section C). Risque à mitiger, pas à ignorer.
- **MG.4 (les deux migrations d'unicité)** : **NO-GO tant que le statut prod n'est pas confirmé par l'utilisateur.** Techniquement ces deux migrations ne peuvent pas échouer sur des doublons (démontré section D), donc aucun risque de rollback lié aux données — mais le risque réel est de **réécrire une migration déjà appliquée en production**, ce qui est explicitement interdit par la consigne de la mission. Faire d'abord confirmer par une requête `pg_indexes` en prod.
- **MG.5 (scripts d'audit)** : GO — les deux scripts sont confirmés strictement read-only, aucune modification requise. `su12-audit-doublons-numero` reste utile mais pas bloquant (voir E) ; `px-audit-signatures-corrompues` ne nécessite pas de correctif de données pour lever un risque de disponibilité (déjà couvert par PX.1-PX.3).
- **MG.6 (anti-récidive)** : GO — convention et test proposés sont mécaniquement vérifiables sans heuristique fragile. Périmètre à étendre en concertation avec le PM : au moins 4 autres orphelins historiques existent (`prisma/fix-vague-26-01.sql`, `scripts/fix-*.sql`, `scripts/repair-bug041.sql`) qui violeraient la nouvelle règle si le test est appliqué rétroactivement sans les traiter ou les exclure explicitement — le test échouerait dès son introduction si ces fichiers restent en place. Décision à prendre : les supprimer (s'ils sont bien déjà appliqués, ce qui n'est pas vérifié dans ce rapport), ou les exclure nommément avec justification documentée.

## Risques identifiés
1. **`docker-entrypoint.sh` avale les échecs de `prisma migrate deploy`** (`|| echo WARNING ... continuing`) — une migration MG qui échouerait en prod (cas peu probable pour D, mais possible pour un bug non anticipé) ne bloquerait pas le déploiement, laissant l'app tourner sur un schéma partiellement migré. Recommandation : traiter ce point avant/pendant MG (hors scope strict de la mission mais directement pertinent pour la sécurité de tout futur `migrate deploy`, y compris ceux de MG lui-même).
2. **Discordance de date sur gd3** (rapport dit 15/07, mission dit "aujourd'hui" 26/07) — à faire clarifier par l'utilisateur avant toute action sur ce correctif spécifique.
3. **Recalcul d'agrégats dérivés avec valeurs littérales figées** (`nombrePoissons` sur `vague2601` et `gd3`) — une migration convertie telle quelle pourrait écraser une valeur devenue correcte entre-temps ; préférer un recalcul dynamique ou une garde temporelle stricte.
4. **Dette historique non scopée** : au moins 4 fichiers de correctif orphelins supplémentaires découverts, non mentionnés dans la mission — le sprint MG doit explicitement statuer sur leur sort pour que MG.6 (garde structurel) ne casse pas en les laissant en place.

## Prérequis manquants
1. Créer `docs/sprints/SPRINT-MG-*.md` et les entrées `MG.2`–`MG.6` dans `docs/TASKS.md` avant de commencer (aucune trace actuelle du sprint dans le backlog).
2. Confirmation utilisateur du statut prod des migrations `20260726174843` et `20260726212515` (section D) avant toute story touchant à MG.4.
3. Confirmation utilisateur de la date réelle d'application de `gd3-vague-26-03-prep-transferts.sql` en prod (section B.5) avant toute story touchant à ce correctif.
4. Décision explicite du PM sur le périmètre exact de MG.6 vis-à-vis des 4 orphelins historiques supplémentaires découverts.

## Recommandation
GO pour MG.2, MG.3 (avec réserves techniques notées), MG.5, MG.6. **NO-GO pour MG.4 tant que l'utilisateur n'a pas confirmé, par une requête `pg_indexes` directe en production, si les deux migrations d'unicité sont déjà appliquées** — c'est le seul point réellement bloquant de ce sprint, car une erreur ici (réécrire une migration déjà déployée) est le risque explicitement identifié comme inacceptable par la mission elle-même.
