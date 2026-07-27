# BUG-CI-migration-order — Ordre lexicographique des migrations incompatible avec une base vierge

**Sévérité :** Critique
**Détecté par :** CI (nouveau pipeline naissant) — investigation @db-specialist
**Sprint :** hors-sprint (bugfix transverse)
**Fichier(s) :** `prisma/migrations/**`

## Description

`npx prisma migrate deploy` sur un conteneur `postgres:16-alpine` **vierge** échouait — un
nouvel environnement (CI, staging, disaster recovery, nouveau site) ne pouvait pas être
provisionné depuis le dépôt. La production actuelle fonctionne uniquement parce que ses
migrations ont été appliquées, historiquement, dans un ordre différent de l'ordre
lexicographique des noms de dossier.

## Étapes de reproduction

```bash
docker run -d --name fresh -e POSTGRES_USER=dkfarm -e POSTGRES_PASSWORD=x \
  -e POSTGRES_DB=farmflow -p 55432:5432 postgres:16-alpine
DATABASE_URL="postgresql://dkfarm:x@localhost:55432/farmflow?schema=public" \
  npx prisma migrate deploy
```

## Cause racine

Plusieurs dossiers de migration portent un **nom de dossier (timestamp) qui ne reflète pas
l'ordre chronologique réel de création/application**. `prisma migrate deploy` trie et applique
les migrations dans l'ordre **lexicographique des noms de dossier**. Sur un historique de
déploiements incrémentaux (chaque `migrate deploy` en production ne voit que les migrations
déjà commitées à ce moment-là), un mauvais horodatage n'est révélé que lorsque **toute** la
chaîne est rejouée d'un coup sur une base vierge — ce qui n'arrive jamais en production
normale, seulement en CI, disaster recovery, ou nouvel environnement.

Preuve empirique (voir §5) : dans la base de dev (`silures-db`), le `checksum` stocké dans
`_prisma_migrations` pour chacune des migrations fautives est **strictement identique** au
checksum du fichier actuel (jamais modifié depuis sa création) — la seule explication possible
est que ces migrations ont réellement été appliquées à un moment où leurs dépendances
existaient déjà, dans un ordre réel différent de celui que suggère leur nom de dossier.

Six familles de cas ont été identifiées et corrigées (détectées soit par analyse statique de
la chaîne de dépendances CREATE TABLE / ALTER TABLE / FOREIGN KEY, soit par rejeu réel et
itératif sur base vierge jusqu'à obtenir un déploiement complet) :

1. **`ALTER TABLE` avant `CREATE TABLE`** — `20260316120000_add_unite_pack_produit` (ajoute une
   colonne sur `PackProduit`) s'exécute avant `20260320110000_add_packs` (qui crée
   `PackProduit`). Même défaut pour `Pack` (`20260317120000_add_site_modules`),
   `PlanAbonnement` (`20260321000000_add_modules_inclus_plan`), `ModuleDefinition`
   (`20260328130000_sync_schema_drift`), `FeatureFlag` (`20260403000000_add_ligne_depense`).
   Pour `FeatureFlag` spécifiquement, une **septième variante** s'ajoute au défaut : une
   migration ultérieure (`20260410000000_fix_feature_flag_updated_at_default`) contredisait
   l'état final voulu en remettant un `DEFAULT` après coup — voir le détail dans « Contenu du
   fix — par fichier » ci-dessous, corrigé après une première passe incomplète.
2. **Contrainte `FOREIGN KEY` vers une table pas encore créée** — `PackBac_packId_fkey`
   (`20260317200000_add_pack_bacs`) référence `Pack`, créée plus tard par
   `20260320110000_add_packs`.
3. **Backfill de données référençant une table pas encore créée** —
   `20260321100000_pack_plan_id_remove_enabled_modules` fait un `UPDATE ... SELECT FROM
   "PlanAbonnement"` avant que `20260327000000_add_subscriptions` ne crée cette table.
4. **RECREATE d'enum oubliant une colonne ajoutée par une migration mal datée** —
   `20260330000000_add_sitemodule_abonnements_commissions_remises` recrée l'enum
   `SiteModule` mais ne castait que `Site.enabledModules`, pas
   `PlanAbonnement.modulesInclus` (colonne dont l'existence, sur base vierge, dépend du fix du
   cas 3 ci-dessus).
5. **Fonctionnalité ajoutée puis intégralement retirée, mais nommée dans le désordre** —
   `20260420000000_add_strategie_interpolation` (ADR-029) et
   `20260421000000_add_gompertz_bac` (ADR-030) portent des noms de dossier **postérieurs** à
   `20260405000000_remove_gompertz_bac` (ADR-032) et
   `20260406000000_remove_strategie_interpolation` (ADR-034), alors que l'historique Git prouve
   que l'ordre réel des commits est l'inverse (ADR-029/030 le 2026-04-05 05:51, ADR-032 à
   19:56, ADR-034 à 22:55 — les deux migrations d'ajout ont été committées avec un horodatage
   de dossier arbitrairement fixé loin dans le "futur", 20260420/21, alors que les deux
   migrations de suppression portent la date réelle du jour, 20260405/06). `schema.prisma`
   actuel ne porte plus aucune trace de `interpolationStrategy`/`StrategieInterpolation`/
   `GompertzBac` — l'état cible final est bien l'absence complète de cette fonctionnalité. Sur
   une base vierge (ordre lexicographique), les migrations de suppression s'exécutaient
   d'abord en no-op (rien à supprimer), puis les migrations d'ajout recréaient la colonne/enum/
   table — laissant la base vierge dans un état qui ne correspond plus à `schema.prisma`.
6. **Backfill NOT NULL sans repli pour un site sans aucun membre** —
   `20260415000000_make_site_owner_not_null` rendait `Site.ownerId` obligatoire après un
   backfill depuis `SiteMember`/`SiteRole` ; sur une base vierge, le site `default-site`
   auto-inséré par `20260309092300_add_multi_tenancy` n'a aucun membre (aucun `User` n'existe
   encore à ce stade du bootstrap), donc `ownerId` reste `NULL` et la contrainte échoue.

## Fix

La difficulté centrale de ce correctif : les migrations fautives sont **déjà appliquées en
production** — voir §5 pour la démonstration empirique que modifier leur contenu n'a aucun
effet sur un environnement où elles sont déjà enregistrées par nom dans `_prisma_migrations`.
Le choix retenu s'appuie directement sur cette propriété.

### Options évaluées

1. **Rendre les migrations fautives tolérantes** (`IF EXISTS`/`IF NOT EXISTS`, gardes
   conditionnelles) — **retenue**, voir §5 pour la justification de son innocuité sur un
   environnement déjà migré.
2. **Renommer/réordonner les dossiers de migration** pour faire correspondre l'ordre
   lexicographique à l'ordre réel — **écartée**. Le nom de dossier (`migration_name`) est la
   clé de correspondance utilisée par Prisma pour savoir si une migration a déjà été appliquée.
   Renommer un dossier déjà appliqué en production crée un nom absent de
   `_prisma_migrations` : au prochain `migrate deploy`, Prisma le traiterait comme une
   migration **nouvelle et en attente**, tenterait de rejouer son SQL (`CREATE TABLE`, `ADD
   COLUMN`...) sur des objets déjà existants, et échouerait (`relation already exists` etc.) —
   sauf à exécuter manuellement `prisma migrate resolve --applied <nouveau-nom>` en production
   avant le déploiement, une action manuelle non garantie que cette option cherchait justement
   à éviter.
3. **Une nouvelle migration de rattrapage postérieure** (ajoutée à la fin de la chaîne) —
   **écartée seule, mais son principe est repris en aval**. `migrate deploy` applique les
   migrations séquentiellement et s'arrête à la première erreur : un correctif ajouté tout à la
   fin de la chaîne ne peut pas empêcher l'échec qui se produit bien avant lui dans l'ordre
   lexicographique. Ce principe (rejouer une action plus loin dans la chaîne une fois la
   dépendance disponible) est en revanche correctement utilisé **en complément** de l'option 1
   pour les cas 3, 4 et 5 : le contenu manquant est déplacé/dupliqué dans la migration qui crée
   réellement la dépendance (guardé pour rester un no-op silencieux si déjà fait).
4. **Correctif manuel en production** — non nécessaire, voir conclusion.

### Contenu du fix — par fichier

Pattern général : chaque `ALTER TABLE`/`FOREIGN KEY`/backfill qui s'exécute avant que sa
dépendance existe est rendu tolérant (`ALTER TABLE IF EXISTS ... ADD COLUMN IF NOT EXISTS`,
bloc `DO $$ ... IF EXISTS(...) THEN ... END IF; END $$;`), et le résultat final qu'il était
censé produire est garanti par ailleurs (colonne intégrée directement dans le `CREATE TABLE`
qui suit, ou logique rejouée dans la migration qui crée réellement la dépendance, gardée par
une vérification d'idempotence).

- `20260316120000_add_unite_pack_produit/migration.sql` — `ALTER TABLE IF EXISTS ... ADD
  COLUMN IF NOT EXISTS`.
- `20260320110000_add_packs/migration.sql` — colonnes `PackProduit.unite` et
  `Pack.enabledModules` intégrées directement dans les `CREATE TABLE` ; ajout d'un bloc `DO $$`
  guardé pour `PackBac_packId_fkey`.
- `20260317120000_add_site_modules/migration.sql` — `ALTER TABLE IF EXISTS ... ADD COLUMN IF
  NOT EXISTS` pour `Pack.enabledModules`.
- `20260317200000_add_pack_bacs/migration.sql` — `PackBac_packId_fkey` déplacée dans un bloc
  `DO $$` guardé par l'existence de `Pack`.
- `20260321000000_add_modules_inclus_plan/migration.sql` — `ALTER TABLE IF EXISTS ... ADD
  COLUMN IF NOT EXISTS` pour `PlanAbonnement.modulesInclus`.
- `20260327000000_add_subscriptions/migration.sql` — colonne `modulesInclus` intégrée
  directement dans le `CREATE TABLE PlanAbonnement` ; bloc `DO $$` de rattrapage guardé pour le
  backfill `Pack.planId` (cas 3).
- `20260321100000_pack_plan_id_remove_enabled_modules/migration.sql` — backfill/NOT
  NULL/FK/index conditionnés à l'existence de `PlanAbonnement`.
- `20260328130000_sync_schema_drift/migration.sql` — `ALTER TABLE IF EXISTS` pour
  `ModuleDefinition.updatedAt`.
- `20260402000000_add_module_definition_audit_log/migration.sql` — `updatedAt` définie sans
  `DEFAULT` directement dans le `CREATE TABLE`.
- `20260403000000_add_ligne_depense/migration.sql` — `ALTER TABLE IF EXISTS` pour
  `FeatureFlag.updatedAt`. **Insuffisant à lui seul** : le `CREATE TABLE FeatureFlag` de
  `20260409000000_add_feature_flags` ne porte déjà pas de `DEFAULT`, mais une **troisième**
  migration, `20260410000000_fix_feature_flag_updated_at_default`, s'exécute encore après (dans
  l'ordre lexicographique comme dans l'ordre réel) et **remettait** `DEFAULT
  CURRENT_TIMESTAMP` sur cette colonne (fix historique H2, pour sécuriser d'anciens `INSERT`
  qui omettaient la colonne). Ce cas n'a pas de miroir chez `PackProduit`/`ModuleDefinition` :
  aucune migration ultérieure ne réintroduit l'état contraire pour ces deux tables. Sur une
  base vierge, l'enchaînement `03 (no-op) → 09 (CREATE sans DEFAULT) → 10 (remet le DEFAULT)`
  laissait donc un `DEFAULT` SQL résiduel, alors que `schema.prisma` définit `updatedAt
  DateTime @updatedAt` **sans** `@default` — dérive détectée par `prisma migrate diff` (non
  fatale pour `migrate deploy`, mais réelle et non déclarée). **Fix complémentaire** :
  `20260410000000_fix_feature_flag_updated_at_default/migration.sql` a été réécrit pour ne plus
  remettre le `DEFAULT` mais au contraire le retirer explicitement (`ALTER TABLE IF EXISTS ...
  DROP DEFAULT`, idempotent) — aucun `INSERT` connu du dépôt (Prisma Client via `@updatedAt`,
  `prisma/seed.sql`) ne dépend d'un `DEFAULT` SQL sur cette colonne. Confirmé sûr pour la
  production par le même test empirique que pour les 15 fichiers précédents (checksum forgé à
  l'ancienne valeur + contenu modifié sur disque → `migrate deploy`/`migrate status` restent
  `No pending migrations to apply.` / `Database schema is up to date!`, aucune erreur, aucun
  rejeu).
- `20260330000000_add_sitemodule_abonnements_commissions_remises/migration.sql` — cast de
  `PlanAbonnement.modulesInclus` ajouté, guardé par existence de la colonne (cas 4).
- `20260405000000_remove_gompertz_bac/migration.sql`,
  `20260420000000_add_strategie_interpolation/migration.sql`,
  `20260421000000_add_gompertz_bac/migration.sql` — logique entièrement guardée ; les deux
  migrations d'ajout se neutralisent elles-mêmes si
  `20260406000000_remove_strategie_interpolation` est déjà enregistrée dans
  `_prisma_migrations` au moment de leur exécution (signal fiable, car sur base vierge cette
  dernière s'exécute nécessairement avant elles dans l'ordre lexicographique) (cas 5).
- `20260415000000_make_site_owner_not_null/migration.sql` — suppression idempotente du site
  orphelin sans membre avant l'application de la contrainte `NOT NULL` (cas 6).

Tous les correctifs respectent R10/ADR-049 : idempotents (valeur cible, jamais de delta),
no-op silencieux si la précondition n'est pas remplie, aucun script hors migration.

## Vérification

### Base vierge (critère A)

Conteneur `postgres:16-alpine` jetable, port 55432 (jamais 8432) :

```
158 migrations found in prisma/migrations
...
All migrations have been successfully applied.
```

`SELECT count(*) FROM _prisma_migrations WHERE finished_at IS NOT NULL` → **158** (= nombre
total de dossiers de migration sur disque, `migration_lock.toml` exclu). Dernière migration
appliquée : `20260727090006_unicite_numero_par_site_autosuffisante`. `npx prisma migrate
status` sur ce même conteneur : `Database schema is up to date!`.

**Comparaison au datamodel, après correction complète (16 fichiers, incluant le fix
`FeatureFlag` ci-dessus) :**

```
$ DATABASE_URL="postgresql://dkfarm:***@localhost:55432/farmflow" \
  npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script
-- This is an empty migration.

$ npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --exit-code
No difference detected.
EXIT=0
```

Vide — plus aucune dérive entre le schéma obtenu par bootstrap complet et
`schema.prisma`. C'était le seul défaut résiduel : `PackProduit` et `ModuleDefinition`
n'apparaissent pas dans ce diff (déjà corrects), et `FeatureFlag.updatedAt` n'a plus de
`DEFAULT` (`SELECT column_default FROM information_schema.columns WHERE
table_name='FeatureFlag' AND column_name='updatedAt'` → vide).

### Non-régression checksum (critère B)

Constat empirique préalable, déterminant pour le choix du fix (option 1) : sur `silures-db`
(dev, port 8432 — jamais touché en écriture par cette investigation), le `checksum` stocké
dans `_prisma_migrations` pour `20260316120000_add_unite_pack_produit` et
`20260320110000_add_packs` est identique au checksum SHA-256 du fichier actuel (jamais modifié
depuis sa création selon `git log`). Test direct : une copie du dépôt avec un octet ajouté à
`20260316120000_add_unite_pack_produit/migration.sql` (checksum local `81d998...` ≠ checksum
enregistré `84ab48...`) donne, avec `DATABASE_URL` pointant vers `silures-db` :

```
No pending migrations to apply.   (exit 0, migrate deploy)
Database schema is up to date!    (migrate status)
```

Aucune erreur de checksum, aucune tentative de rejeu, et le `checksum` stocké en base **n'est
pas mis à jour** — confirmant que Prisma 7.4.2 ne valide le contenu d'une migration déjà
enregistrée que par correspondance de **nom** (`migration_name`), jamais par comparaison de
checksum, lors de `migrate deploy`/`migrate status`. C'est cette propriété, vérifiée
empiriquement et non supposée, qui rend l'option 1 sûre : modifier le contenu SQL d'une
migration déjà appliquée (par nom) n'a strictement aucun effet sur l'environnement où elle est
déjà enregistrée.

Confirmation finale avec l'ensemble des correctifs réels de ce fix : `npx prisma migrate
status` et `npx prisma migrate deploy` contre `silures-db` (dev, 165 lignes dans
`_prisma_migrations`, incluant des entrées orphelines d'un ancien squash) rapportent
respectivement `Database schema is up to date!` et `No pending migrations to apply.` —
`SELECT count(*) FROM "Site"` sur `silures-db` toujours à **2** avant/après (donnée non
touchée).

**Limite honnête :** ceci prouve que Prisma ne re-tentera jamais d'exécuter ces migrations sur
un environnement où elles sont déjà enregistrées par nom — donc aucun risque d'erreur ni de
rejeu destructeur au prochain déploiement. Ça ne prouve pas, et ne peut pas prouver depuis cet
environnement, que l'état actuel des données de production est identique à celui qu'aurait
produit un rejeu propre dans l'ordre correct — seule une inspection des données réelles de
production pourrait le confirmer, et ce n'est pas nécessaire ici puisque prod n'est justement
jamais rejouée.

### Autres vérifications

- `npx prisma validate` → `The schema at prisma/schema.prisma is valid`.
- `npm run build` (inclut `prisma migrate deploy` contre `silures-db`, confirmant à nouveau
  "No pending migrations to apply", puis `next build --webpack`) → exit 0, toutes les routes
  compilées.
- `npx vitest run` contre `silures-db` → 26 échecs, tous `Test timed out in 5000ms` (bottom-nav,
  dialog-scroll, vague-bacs-section, bon-livraison-flow, db-gated-tests-registry — aucun test
  lié aux migrations). Ré-exécution isolée (`--no-file-parallelism`) des 5 fichiers concernés :
  **28/28 tests passent** — confirme la contention connue (ERR-107), pas une régression liée à
  ce fix.

## Action manuelle requise en production

**Aucune.** C'est la conclusion centrale de cette investigation : parce que Prisma 7.4.2 ne
valide jamais le checksum d'une migration déjà enregistrée par nom (vérifié empiriquement,
§ci-dessus, jamais supposé), toutes les migrations concernées restent, du point de vue de
`migrate deploy`, strictement identiques à ce qu'elles étaient avant ce fix sur tout
environnement où elles sont déjà appliquées. Le prochain `migrate deploy` en production ne
verra aucune migration en attente parmi celles modifiées ici et n'exécutera donc aucun de leurs
nouveaux blocs conditionnels. Seuls les nouveaux environnements (CI, staging, disaster
recovery, nouveau site) bénéficient du correctif — exactement l'objectif recherché.

## Statut : CORRIGÉ

Non clos : aucun `git commit`, aucun déploiement. Les 16 fichiers de migration modifiés
(`prisma/migrations/**`, listés ci-dessus) et ce document sont présents uniquement dans l'arbre
de travail local au moment de la rédaction. @project-manager tranche la clôture (commit +
mise à jour de `docs/TASKS.md`/du rapport de sprint).
