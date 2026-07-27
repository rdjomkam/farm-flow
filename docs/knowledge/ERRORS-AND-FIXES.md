# Base de Connaissances — Erreurs et Fixes

> **Ce fichier est lu par tous les agents avant de travailler.**
> Il contient les erreurs passées et comment les éviter.
> Maintenu par @knowledge-keeper.

---

## Catégorie : Schema

### ERR-121 — Un `migrate deploy` vert sur base vierge ne prouve pas l'absence de dérive de schéma : toujours enchaîner `migrate diff`
**Sprint :** hors-sprint (bugfix transverse, découvert par le Sprint CI) | **Date :** 2026-07-27
**Sévérité :** Moyenne
**Fichier(s) :** `prisma/migrations/20260403000000_add_ligne_depense/migration.sql`, `prisma/migrations/20260410000000_fix_feature_flag_updated_at_default/migration.sql`

**Symptôme :**
Après le premier correctif de `BUG-CI-migration-order` (voir ERR-120), les 158 migrations
s'appliquaient intégralement sur une base vierge (`migrate deploy` → « All migrations have been
successfully applied. »). Ce vert semblait suffisant. Pourtant `npx prisma migrate diff
--from-config-datasource --to-schema prisma/schema.prisma --script`, exécuté immédiatement après
sur cette même base fraîchement bootstrapée, produisait un diff **non vide** :
`ALTER TABLE "FeatureFlag" ALTER COLUMN "updatedAt" DROP DEFAULT;` — une dérive entre le schéma
réellement obtenu et `schema.prisma`, invisible à `migrate deploy` puisqu'un `DEFAULT` SQL résiduel
sur une colonne gérée par `@updatedAt` ne fait échouer aucune requête, il ne fait que diverger
silencieusement de ce que le code applicatif présuppose.

**Cause racine :**
Trois migrations touchaient la même colonne (`FeatureFlag.updatedAt`) sans jamais avoir été rejouées
ensemble dans l'ordre chronologique réel avant ce sprint : un premier `DROP DEFAULT` tolérant
(no-op sur base vierge, la table n'existant pas encore à ce stade), un `CREATE TABLE` sans
`DEFAULT` (correct), puis une **troisième** migration plus tardive qui **remettait** le `DEFAULT`
(fix historique pour sécuriser d'anciens `INSERT`). Une analyse par grep des objets référencés
(`ALTER TABLE`, `CREATE TABLE`, `REFERENCES`) — méthode qui avait servi à détecter et corriger 15
des 16 fichiers fautifs — ne voit que si un objet existe au moment où une instruction s'exécute, pas
si l'**état final** obtenu contredit le schéma cible. Deux migrations aux intentions contraires,
toutes deux syntaxiquement valides et toutes deux « guardées », peuvent laisser un résultat net
incohérent que seule la comparaison de schéma révèle.

**Fix :**
Réécriture de `20260410000000_fix_feature_flag_updated_at_default/migration.sql` pour retirer
explicitement le `DEFAULT` (`ALTER TABLE IF EXISTS ... DROP DEFAULT`, idempotent) au lieu de le
remettre, après confirmation qu'aucun `INSERT` connu du dépôt ne dépend d'un `DEFAULT` SQL sur cette
colonne (Prisma Client écrit toujours la valeur via `@updatedAt`). Re-vérification sur conteneur
jetable : `migrate deploy` (158/158) **puis** `migrate diff` → vide.

**Leçon / Règle :**
Un `migrate deploy` qui réussit sur base vierge prouve seulement qu'aucune instruction SQL n'a
échoué — pas que le schéma final obtenu correspond à `schema.prisma`. Toute vérification de
bootstrap complet (nouvel environnement, CI, disaster recovery) doit systématiquement enchaîner les
deux commandes : `npx prisma migrate deploy` (aucune erreur) **puis**
`npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script` (doit
produire `-- This is an empty migration.`) — ou l'équivalent `--exit-code` pour un contrôle
automatisable. Une analyse statique par grep des dépendances entre migrations (utile et nécessaire,
voir ERR-120) ne remplace pas cette comparaison de schéma : elle peut manquer une contradiction
nette entre deux migrations correctement écrites individuellement.

**Références :** [BUG-CI-migration-order](../bugs/BUG-CI-migration-order.md), [rapport-sprint-CI](../tests/rapport-sprint-CI.md), R10, [ADR-049](../decisions/ADR-049-correctifs-donnees-migrations.md)

---

### ERR-120 — L'ordre lexicographique des dossiers de migration n'est pas garanti être l'ordre historique d'application : toute base neuve, staging ou restauration était cassée, invisible pendant des mois
**Sprint :** hors-sprint (bugfix transverse, découvert par le Sprint CI) | **Date :** 2026-07-27
**Sévérité :** Critique
**Fichier(s) :** `prisma/migrations/**` (16 fichiers corrigés, voir `docs/bugs/BUG-CI-migration-order.md` pour la liste complète)

**Symptôme :**
`npx prisma migrate deploy` sur un conteneur Postgres **vierge** échouait. Exemple :
`20260316120000_add_unite_pack_produit` exécute `ALTER TABLE "PackProduit" ...` alors que la table
`PackProduit` n'est créée que par `20260320110000_add_packs`, treize migrations plus loin dans
l'ordre lexicographique. La production fonctionnait sans aucun symptôme parce que ses migrations
avaient été appliquées, historiquement, dans un ordre réel différent de celui que suggèrent
aujourd'hui les noms de dossier (preuve empirique : le `checksum` stocké dans
`_prisma_migrations` pour ces fichiers reste identique au checksum du fichier actuel, jamais
modifié depuis sa création — la seule explication est que ces migrations ont réellement été
appliquées à un moment où leurs dépendances existaient déjà). Six familles de cas ont été
identifiées : `ALTER TABLE` avant `CREATE TABLE`, `FOREIGN KEY` vers une table pas encore créée,
backfill référençant une table pas encore créée, `RECREATE` d'enum oubliant une colonne ajoutée par
une migration mal datée, fonctionnalité ajoutée puis retirée mais nommée dans le désordre, et
backfill `NOT NULL` sans repli pour un site sans membre.

**Cause racine :**
`prisma migrate deploy` trie et applique les migrations dans l'ordre **lexicographique** des noms
de dossier (le timestamp du nom), pas selon un ordre de dépendance réel entre objets SQL. Un
horodatage de dossier mal choisi au moment de la création de la migration (par exemple un timestamp
fixé arbitrairement dans le futur, ou une migration committée après coup avec une date de dossier
antérieure à sa dépendance réelle) n'est révélé que lorsque **toute** la chaîne est rejouée d'un
coup sur une base vierge — un scénario qui n'arrive jamais en déploiement incrémental normal
(chaque `migrate deploy` en production ne voit que les migrations déjà commitées à ce moment-là),
seulement en CI, disaster recovery, ou provisionnement d'un nouvel environnement (nouveau site
multi-tenant). C'est précisément la mise en place de la CI de ce sprint qui a révélé un défaut
invisible depuis des mois.

**Fix :**
Rendre chaque instruction fautive tolérante (`ALTER TABLE IF EXISTS ... ADD COLUMN IF NOT EXISTS`,
bloc `DO $$ ... IF EXISTS(...) THEN ... END IF; END $$;`) et garantir le résultat final par ailleurs
(colonne intégrée directement dans le `CREATE TABLE` qui suit, ou logique rejouée dans la migration
qui crée réellement la dépendance, gardée par une vérification d'idempotence). **Ne jamais renommer
les dossiers déjà appliqués en production** : le nom de dossier est la clé de correspondance
utilisée par Prisma (voir vérification empirique dans ERR-121/`BUG-CI-migration-order` : Prisma
7.4.2 ne valide le contenu d'une migration déjà enregistrée que par correspondance de **nom**,
jamais par checksum, lors de `migrate deploy`/`migrate status`) — renommer casserait le
déploiement en production en faisant apparaître une « nouvelle » migration en attente qui
retenterait un SQL déjà appliqué.

**Leçon / Règle :**
Un `migrate deploy` vert en production incrémentale ne prouve **rien** sur la validité d'un
bootstrap complet depuis zéro — la seule preuve qu'un dépôt de migrations est réellement
déployable sur un nouvel environnement (CI, staging, disaster recovery, nouveau site
multi-tenant) est un `migrate deploy` intégral sur une base **vierge**, régulièrement rejoué. C'est
exactement ce que la mise en place d'une CI (Sprint CI) a révélé, après des mois d'invisibilité
totale. Toute migration qui référence un objet (table, colonne, type, contrainte) créé par une
migration ultérieure dans l'ordre lexicographique doit être rendue tolérante (`IF EXISTS`/
`IF NOT EXISTS`) et son effet final garanti dans la migration qui crée réellement la dépendance —
jamais corrigée en renommant le dossier d'une migration déjà appliquée en production. Voir ERR-121
pour la limite de cette vérification (elle ne suffit pas seule, il faut aussi `migrate diff`).

**Références :** [BUG-CI-migration-order](../bugs/BUG-CI-migration-order.md), [rapport-sprint-CI](../tests/rapport-sprint-CI.md), R10, ERR-109, ERR-121

---

### ERR-112 — `docker-entrypoint.sh` avale un échec de `prisma migrate deploy` : le conteneur démarre sur un schéma non migré, silencieusement
**Sprint :** MG (story MG.7) | **Date :** 2026-07-26
**Sévérité :** Critique
**Fichier(s) :** `docker-entrypoint.sh`

**Symptôme :**
Une migration échoue au démarrage du conteneur de production. Rien ne le signale à l'opérateur : le script d'entrée capture l'échec (`|| echo WARNING ... continuing`) et démarre quand même le serveur Next.js. L'application tourne alors sur un schéma désynchronisé du code déployé — colonnes/contraintes/index attendus par le code mais absents en base, ou inversement — jusqu'à ce qu'une erreur runtime opaque (Prisma `P2022` colonne inconnue, contrainte manquante, etc.) survienne ailleurs, sans lien évident avec sa cause réelle.

**Cause racine :**
Le garde-fou (`migrate deploy` qui échoue proprement en cas de problème) est rendu inopérant par le pipeline de déploiement lui-même : peu importe la rigueur d'une migration (idempotence, précondition qui `RAISE EXCEPTION`, etc. — voir ERR-109, ADR-049 §3.3.d), si le processus qui l'exécute avale l'échec et continue, la migration échouée n'a plus aucun effet de blocage réel. C'est le même problème que celui identifié par la pré-analyse du sprint MG pour les deux migrations d'unicité (`20260726174843`, `20260726212515`) : un `RAISE EXCEPTION` dans une migration est censé arrêter le déploiement, mais `docker-entrypoint.sh` ne le laisse pas faire.

**Fix :**
`docker-entrypoint.sh` doit propager l'échec de `prisma migrate deploy` (arrêter le démarrage du serveur, code de sortie non nul) au lieu de le journaliser et continuer.

**Leçon / Règle :**
Un garde-fou de migration (précondition, idempotence, contrainte) n'a de valeur que si le pipeline qui l'exécute respecte réellement son code de sortie. Avant de concevoir ou de faire confiance à un garde-fou de migration, toujours vérifier comment `migrate deploy` est invoqué en production (script d'entrypoint, CI/CD) et si un échec y est réellement bloquant — un garde-fou bien écrit mais silencieusement contourné par l'orchestrateur donne une fausse impression de sécurité.

**Références :** [ADR-049](../decisions/ADR-049-correctifs-donnees-migrations.md), [pre-analysis-sprint-MG](../analysis/pre-analysis-sprint-MG.md)

---

### ERR-111 — Correctif de données recalculant un agrégat dérivé : une valeur cible littérale figée peut écraser une valeur redevenue correcte entre-temps
**Sprint :** MG (story MG.3) | **Date :** 2026-07-26
**Sévérité :** Haute
**Fichier(s) :** `prisma/migrations/*_data_fix_*/migration.sql` (tout correctif touchant un champ dérivé/recalculé : compteurs, totaux, biomasses)

**Symptôme :**
Un correctif de données idempotent, protégé par un `WHERE col != <valeur_cible>` classique, semble parfaitement sûr — mais s'il porte sur un **agrégat dérivé** (ex. `Bac.nombrePoissons`, `AssignationBac.nombreActuel`) recalculé au moment de l'investigation d'un bug, il peut écraser à tort une valeur qu'une opération métier légitime (nouveau relevé, transfert) a fait évoluer entre la rédaction du correctif et son déploiement effectif. Le `WHERE != <cible>` protège contre le rejeu du correctif, pas contre ce cas : il matche encore, et écrase, toute ligne dont la valeur diffère de la cible — y compris une valeur devenue correcte pour une raison indépendante du bug corrigé.

**Cause racine :**
La condition de garde habituelle (`WHERE col != <valeur_cible>`) répond à la question « cette ligne a-t-elle déjà été corrigée par CE correctif ? », pas à la question « cette ligne est-elle toujours dans l'état buggé que ce correctif a été écrit pour réparer ? ». Pour un champ recalculé à chaque opération métier (agrégat dérivé), ces deux questions ne sont pas équivalentes : une ligne peut avoir une valeur différente de la cible pour une bonne raison (des opérations légitimes ont eu lieu depuis l'investigation), pas seulement parce qu'elle n'a pas encore été corrigée.

**Fix :**
Conditionner l'`UPDATE` à la **valeur buggée connue** identifiée pendant l'investigation, pas à la simple différence avec la cible :
```sql
-- ANTI-PATTERN : écrase toute valeur différente de la cible, y compris une valeur légitime récente
UPDATE "Bac" SET "nombrePoissons" = 1564
WHERE id = 'bac_x' AND "nombrePoissons" != 1564;

-- PATTERN CORRECT : ne touche que la valeur buggée précisément identifiée
UPDATE "Bac" SET "nombrePoissons" = 1564
WHERE id = 'bac_x' AND "nombrePoissons" = 1812; -- 1812 = valeur buggée constatée lors de l'investigation
```
Si la valeur buggée exacte ne peut être connue avec certitude (plusieurs états buggés possibles), recalculer la valeur cible **dynamiquement** dans la migration (même formule de replay que le code applicatif) plutôt que d'utiliser une constante littérale figée.

**Leçon / Règle :**
Pour un correctif de données qui réécrit un agrégat dérivé/recalculé (pas une valeur saisie une fois pour toutes), la garde d'idempotence correcte est `WHERE col = <valeur_buggée_avant_fix>`, jamais `WHERE col != <valeur_cible>`. Cette dernière protège contre le rejeu, mais pas contre l'écrasement d'une valeur devenue légitimement correcte par une opération métier survenue entre l'investigation et le déploiement du correctif.

**Références :** [ADR-049](../decisions/ADR-049-correctifs-donnees-migrations.md), [pre-analysis-sprint-MG](../analysis/pre-analysis-sprint-MG.md)

---

### ERR-110 — `ON CONFLICT (id) DO NOTHING` ne protège pas contre une violation de clé étrangère
**Sprint :** MG (story MG.3) | **Date :** 2026-07-26
**Sévérité :** Haute
**Fichier(s) :** `prisma/migrations/*_data_fix_*/migration.sql`

**Symptôme :**
Un `INSERT` de correctif de données référence des FK codées en dur (`bacId`, `vagueId`, `siteId`, `userId`, `calibrageId` de production) et est protégé par `ON CONFLICT (id) DO NOTHING`, censé le rendre idempotent et sans risque. Sur une base qui ne possède pas ces lignes de référence (dev, environnement de test, nouveau site multi-tenant), la migration échoue en dur avec une violation de contrainte de clé étrangère — pas un no-op silencieux comme attendu. Pire : la migration en échec bloque alors définitivement tout futur `migrate deploy` sur cet environnement (la table `_prisma_migrations` reste dans un état "failed", aucune migration ultérieure ne s'applique tant que l'échec n'est pas résolu manuellement).

**Cause racine :**
`ON CONFLICT` ne s'évalue qu'**après** que PostgreSQL a validé toutes les contraintes de la ligne à insérer, y compris les FK. Une violation de FK est détectée et lève une exception **avant** que le moteur n'atteigne la clause `ON CONFLICT` — cette clause ne protège donc que contre les doublons de clé primaire/unique, jamais contre une FK pointant vers une ligne absente.

**Fix :**
Réécrire en `INSERT ... SELECT ... WHERE EXISTS (<toutes les FK référencées existent>) AND NOT EXISTS (<la ligne cible existe déjà>)` :
```sql
-- ANTI-PATTERN : échoue en dur sur une base sans les FK de production
INSERT INTO "Releve" (id, "bacId", "vagueId", "siteId", "calibrageId", ...)
VALUES ('releve_x', 'bac_prod_07', 'vague_prod_2601', 'site_prod_1', 'calibrage_prod_may14', ...)
ON CONFLICT (id) DO NOTHING;

-- PATTERN CORRECT : vrai no-op silencieux si les FK n'existent pas sur cette base
INSERT INTO "Releve" (id, "bacId", "vagueId", "siteId", "calibrageId", ...)
SELECT 'releve_x', 'bac_prod_07', 'vague_prod_2601', 'site_prod_1', 'calibrage_prod_may14', ...
WHERE EXISTS (SELECT 1 FROM "Bac" WHERE id = 'bac_prod_07')
  AND EXISTS (SELECT 1 FROM "Vague" WHERE id = 'vague_prod_2601')
  AND EXISTS (SELECT 1 FROM "Site" WHERE id = 'site_prod_1')
  AND EXISTS (SELECT 1 FROM "Calibrage" WHERE id = 'calibrage_prod_may14')
  AND NOT EXISTS (SELECT 1 FROM "Releve" WHERE id = 'releve_x');
```

**Leçon / Règle :**
`ON CONFLICT DO NOTHING` protège uniquement contre une violation d'unicité (clé primaire ou contrainte `UNIQUE`) sur la ligne insérée elle-même — jamais contre une violation de clé étrangère référencée par cette ligne. Tout `INSERT` de correctif de données qui code en dur des FK de production doit systématiquement être un `INSERT ... SELECT ... WHERE EXISTS (...) AND NOT EXISTS (...)`, jamais un simple `INSERT ... VALUES ... ON CONFLICT DO NOTHING`, pour rester un no-op silencieux sur toute base (dev, test, nouveau site) qui ne possède pas ces lignes de référence.

**Références :** [ADR-049](../decisions/ADR-049-correctifs-donnees-migrations.md), [pre-analysis-sprint-MG](../analysis/pre-analysis-sprint-MG.md)

---

### ERR-109 — Un `.sql` à la racine de `prisma/migrations/` est inerte : Prisma ne lit que les sous-dossiers contenant `migration.sql`
**Sprint :** MG (stories MG.1-MG.3) | **Date :** 2026-07-26
**Sévérité :** Critique
**Fichier(s) :** `prisma/migrations/fix-vague2601-phantom-fish.sql`, `prisma/migrations/fix-bes033-cmd015-duplicate.sql`, `prisma/migrations/fix-calibrage-may14-missing-biometrie.sql`, `prisma/migrations/fix-vte004-missing-vagueid.sql` (commit `c259b48`)

**Symptôme :**
Un fichier de correctif de données (`.sql`) est présent au dépôt, directement à la racine de `prisma/migrations/` (pas dans un sous-dossier). `npx prisma migrate status` répond que tout est à jour, aucune migration en attente. Pourtant les données visées par le correctif ne sont pas corrigées en base — et aucune erreur n'apparaît nulle part : ni au déploiement, ni dans les logs, ni dans `migrate status`. Le correctif est silencieusement resté lettre morte, potentiellement pendant plusieurs sprints, sans qu'aucun signal n'alerte quiconque.

**Cause racine :**
Prisma ne considère comme migration que les **sous-dossiers** de `prisma/migrations/` contenant un fichier `migration.sql` — c'est cette structure de dossier, et seulement elle, que `migrate deploy` lit et enregistre dans la table `_prisma_migrations`. Un fichier `.sql` posé directement à la racine (hors de tout sous-dossier) est totalement invisible au mécanisme de migration : il n'est ni exécuté, ni signalé comme en attente, ni signalé comme absent. Mais le problème de fond dépasse ce simple mécanisme technique : un correctif appliqué (ou censé l'être) « à la main » sur la production ne laisse ni trace, ni date d'exécution, ni indication de la base cible, ni garantie qu'il a tourné sur tous les environnements qui en auraient besoin (nouveau site multi-tenant, restauration, staging). Même si le fichier avait été exécuté manuellement une fois, rien dans le dépôt ne permettrait de le confirmer ni de le rejouer de façon fiable ailleurs.

**Fix :**
Convertir chaque correctif en une véritable migration Prisma versionnée : créer manuellement `prisma/migrations/<timestamp>_<nom>/migration.sql` (le dossier de migration standard ne peut pas être généré par `migrate diff` pour un correctif de données pur, puisqu'aucun changement de `schema.prisma` n'y correspond — voir ADR-049 §3.2), rendre le SQL idempotent et no-op silencieux si les données visées sont absentes, puis déployer via `npx prisma migrate deploy` comme toute autre migration. Voir ADR-049 pour la taxonomie complète (correctif de données / audit lecture seule / garde-fou de précondition) et les exigences détaillées (idempotence, journalisation, échec avant modification).

**Leçon / Règle :**
Un fichier `.sql`, aussi correctement écrit soit-il, n'a aucun effet s'il n'est pas dans un sous-dossier de `prisma/migrations/` portant un `migration.sql` — vérifier systématiquement la structure de dossier, pas seulement le contenu SQL, avant de croire qu'un correctif a été ou sera appliqué. Plus largement (R10, ADR-049) : tout correctif de données de production doit être une migration Prisma versionnée, jamais un script exécuté à la main — c'est la seule façon de rendre son application vérifiable (`_prisma_migrations`), reproductible sur tout environnement, et incluse automatiquement dans le pipeline de déploiement standard.

**Références :** [ADR-049](../decisions/ADR-049-correctifs-donnees-migrations.md), [ADR-050](../decisions/ADR-050-sort-des-scripts-audit.md), [pre-analysis-sprint-MG](../analysis/pre-analysis-sprint-MG.md)

---

### ERR-083 — ADD VALUE seul (sans UPDATE) est valide hors transaction : ERR-001 ne couvre pas ce cas
**Sprint :** ADR-045 | **Date :** 2026-04-07
**Sévérité :** Moyenne
**Fichier(s) :** `docs/knowledge/ERRORS-AND-FIXES.md` (ERR-001), `prisma/schema.prisma`

**Symptôme :**
ERR-001 dit "JAMAIS `ADD VALUE` + `UPDATE` dans la même migration. Toujours RECREATE." La MEMORY.md dit "Use RECREATE approach only". Un agent lisant ces règles pourrait choisir l'approche RECREATE même pour une migration qui n'ajoute que des valeurs nouvelles (sans retrait ni UPDATE), ce qui est inutilement complexe et risqué sur un enum avec 55+ valeurs existantes.

**Cause racine :**
ERR-001 a été formulé pour interdire le pattern `ADD VALUE` + `UPDATE` dans la même transaction (ce qui échoue sur la shadow DB). La règle a été généralisée en "RECREATE toujours" sans documenter l'exception : l'ajout pur de valeurs sans UPDATE associé est valide avec `ADD VALUE IF NOT EXISTS` hors transaction.

**Fix :**
Pour une migration qui n'ajoute que des valeurs (aucune valeur retirée, aucun `UPDATE` dans la même migration) : utiliser `ADD VALUE IF NOT EXISTS` dans un fichier SQL manuel avec le flag `-- DISABLE_DDL_TRANSACTION` ou via le workflow `migrate deploy` (voir ERR-002). L'approche RECREATE reste obligatoire dès qu'une valeur est retirée ou renommée.

Règle précisée :
- Ajout pur → `ADD VALUE IF NOT EXISTS` hors transaction (OK)
- Retrait / renommage / ADD + UPDATE → RECREATE (obligatoire)

**Leçon / Règle :**
ERR-001 s'applique uniquement quand `ADD VALUE` et `UPDATE` coexistent dans la même transaction. Pour un ajout pur de valeurs enum, utiliser `ADD VALUE IF NOT EXISTS` hors transaction est la bonne approche — ne pas déclencher RECREATE par réflexe sur un enum large.

---

### ERR-049 — Suppression de valeur d'enum : CAST échoue si des lignes portent encore l'ancienne valeur
**Sprint :** ADR-032 | **Date :** 2026-04-05
**Sévérité :** Critique
**Fichier(s) :** `prisma/migrations/*/migration.sql`, `prisma/schema.prisma`

**Symptôme :**
La migration RECREATE pour supprimer `GOMPERTZ_BAC` de l'enum `StrategieInterpolation` échoue au moment du `ALTER COLUMN ... USING ... ::new_enum_type` avec une erreur PostgreSQL du type `invalid input value for enum` ou `cannot cast type text to enum`. Les lignes `ConfigElevage` qui contiennent encore la valeur `GOMPERTZ_BAC` font échouer le CAST.

**Cause racine :**
L'approche RECREATE (rename old → create new → cast columns → drop old) presuppose que toutes les lignes existantes portent des valeurs présentes dans le nouvel enum. Si une valeur est supprimée sans avoir d'abord migré les lignes qui la portent, le CAST échoue à l'exécution avec des données réelles (la shadow DB est vide, donc le problème ne se manifeste pas lors du `migrate diff`).

**Fix :**
Ajouter un `UPDATE` qui remplace l'ancienne valeur par sa valeur de remplacement AVANT le CAST, dans la même migration :
```sql
-- 1. Renommer l'ancien type
ALTER TYPE "StrategieInterpolation" RENAME TO "StrategieInterpolation_old";

-- 2. Créer le nouveau type sans la valeur supprimée
CREATE TYPE "StrategieInterpolation" AS ENUM ('LINEAIRE', 'GOMPERTZ_VAGUE');

-- 3. Migrer les données AVANT de caster la colonne
UPDATE "ConfigElevage"
SET "interpolationStrategy" = 'GOMPERTZ_VAGUE'
WHERE "interpolationStrategy"::text = 'GOMPERTZ_BAC';

-- 4. Caster la colonne vers le nouveau type
ALTER TABLE "ConfigElevage"
  ALTER COLUMN "interpolationStrategy"
  TYPE "StrategieInterpolation"
  USING "interpolationStrategy"::text::"StrategieInterpolation";

-- 5. Supprimer l'ancien type
DROP TYPE "StrategieInterpolation_old";
```

**Leçon / Règle :**
Quand une valeur d'enum est supprimée, toujours inclure un `UPDATE` de migration des données existantes vers la valeur de remplacement AVANT l'étape CAST de la colonne. La shadow DB étant vide, les tests de migration ne détectent pas ce problème — il faut anticiper les données de production. Voir aussi ERR-001 pour le pattern RECREATE général.

---

### ERR-038 — migrate diff regroupe la dérive de schéma non liée dans la nouvelle migration
**Sprint :** ADR-029 | **Date :** 2026-04-05
**Sévérité :** Haute
**Fichier(s) :** `prisma/migrations/*/migration.sql`

**Symptôme :**
Un `npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script` génère un fichier SQL contenant des colonnes ou tables inattendues — des changements qui n'ont rien à voir avec la feature en cours (par exemple, des `ALTER TABLE` sur des modèles existants déjà en production).

**Cause racine :**
`migrate diff` compare l'état réel de la base (ou shadow DB) au schéma Prisma courant. Si des colonnes ont été ajoutées directement en base (hors migrations : hotfix manuel, script de dev, seed), elles constituent une "dérive" (`drift`) que Prisma détecte et inclut dans le diff suivant. La migration générée mélange alors la feature cible et le rattrapage de dérive.

**Fix :**
1. Toujours inspecter le SQL généré avant de le valider :
   ```bash
   npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script > /tmp/check.sql
   cat /tmp/check.sql
   ```
2. Si des changements non liés à la feature apparaissent, les séparer dans leurs propres fichiers de migration avant de déployer.
3. En cas de dérive avérée, créer d'abord une migration de "rattrapage" (`fix-drift`) séparée avant la migration de feature.

**Leçon / Règle :**
Ne jamais modifier le schéma de base de données directement (hors migrations Prisma) en dev partagé ou en prod. Toute modification de schéma passe par une migration. Avant tout `migrate deploy`, relire le SQL généré ligne par ligne pour détecter les changements parasites.

---

### ERR-001 — Enums PostgreSQL : ADD VALUE + UPDATE dans la même migration
**Sprint :** 1-2 | **Date :** 2026-03-08
**Sévérité :** Critique
**Fichier(s) :** `prisma/migrations/`

**Symptôme :**
Migration échoue sur la shadow database avec `ADD VALUE` + `UPDATE` dans la même transaction.

**Cause racine :**
PostgreSQL ne permet pas d'utiliser une valeur d'enum ajoutée dans la même transaction.

**Fix :**
Utiliser l'approche RECREATE : renommer l'ancien type → créer le nouveau → caster les colonnes → supprimer l'ancien.

**Leçon / Règle :**
JAMAIS `ADD VALUE` + `UPDATE` dans la même migration. Toujours RECREATE.

---

### ERR-002 — Prisma migrate dev échoue en mode non-interactif
**Sprint :** 1 | **Date :** 2026-03-08
**Sévérité :** Haute
**Fichier(s) :** `prisma/schema.prisma`

**Symptôme :**
`npx prisma migrate dev` attend une réponse interactive (y/n) et échoue sous Claude Code.

**Cause racine :**
L'environnement Claude Code ne supporte pas les prompts interactifs.

**Fix :**
Utiliser `npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script` pour générer le SQL, créer le dossier de migration manuellement, puis `npx prisma migrate deploy`.

**Leçon / Règle :**
Toujours utiliser le workflow non-interactif pour les migrations Prisma.

---

### ERR-003 — Prisma 7 ESM : seed TypeScript impossible
**Sprint :** 1 | **Date :** 2026-03-08
**Sévérité :** Haute
**Fichier(s) :** `prisma/seed.sql`

**Symptôme :**
Le Prisma Client généré utilise `import.meta.url` (ESM-only). tsx, jiti et Node natif échouent à exécuter les seed files TypeScript.

**Cause racine :**
Le générateur `prisma-client` avec output custom produit du code ESM incompatible avec les runners CJS.

**Fix :**
Utiliser du SQL brut via `docker exec -i silures-db psql -U dkfarm -d farm-flow < prisma/seed.sql`. Script npm : `npm run db:seed`.

**Leçon / Règle :**
Le seed est toujours en SQL brut, jamais en TypeScript.

---

## Catégorie : Code

### ERR-119 — Un `return` silencieux à l'intérieur d'un test vaut moins qu'un skip : « passed » sans aucune assertion évaluée
**Sprint :** CI (story CI.2) | **Date :** 2026-07-27
**Sévérité :** Haute
**Fichier(s) :** `scripts/data-fixes/__tests__/su12-numero-unique-constraint.test.ts`

**Symptôme :**
Deux blocs `describe.runIf(!!DATABASE_URL)` de ce fichier (12 tests au total, dont un `it.each` sur
10 tables) contenaient chacun un garde interne redondant : `if (!dbAvailable || !client) { … ;
return; }`, exécuté au début de chaque `it`. Quand `DATABASE_URL` était défini mais pointait vers
une base injoignable au moment de la connexion, le `beforeAll` capturait silencieusement l'échec
(`dbAvailable = false`) au lieu de le laisser remonter, et chaque `it` se terminait alors par ce
`return` précoce — statut **« passed »** dans le résumé Vitest, alors qu'**aucune assertion n'a
jamais été évaluée**. Aucun sprint précédent, y compris celui qui a introduit ce fichier, ne l'avait
détecté.

**Cause racine :**
Un `describe.runIf(...)` skippe *le bloc entier* de façon visible (statut « skipped », compteur
dédié dans le résumé). Un `return` précoce *à l'intérieur* d'un `it` déjà collecté, lui, ne change
pas le statut du test — Vitest le compte comme « passed » puisque aucune assertion n'a échoué, ce
qui est vrai au sens strict (aucune assertion n'a échoué parce qu'aucune n'a été exécutée). Le garde
de connexion avait été écrit une fois de plus « au cas où DATABASE_URL serait présent mais la base
indisponible » (un scénario réel, ex. service Postgres pas encore prêt), mais la manière de le
traiter — avaler l'échec plutôt que le remonter — transforme un problème d'infrastructure en faux
positif silencieux.

**Fix :**
Le `beforeAll` doit désormais **lever une exception** si la connexion échoue
(`await client.query("SELECT 1")` sans `try/catch` qui avale le rejet), au lieu de positionner
`dbAvailable = false`. Une exception dans `beforeAll` fait échouer bruyamment tous les tests du
fichier avec un message explicite. Les gardes `if (!dbAvailable || !client) { return; }` à
l'intérieur de chaque `it` (3 occurrences : 2 `it` du premier bloc, l'`it.each` du second) sont
supprimés — ils n'ont plus de raison d'exister une fois que le `beforeAll` garantit que si les tests
s'exécutent, `client` est forcément utilisable.

**Leçon / Règle :**
Un `return` précoce à l'intérieur d'un `it`/`test` (par opposition à un `describe.skip`/`it.skip`
explicite ou un `describe.runIf` au niveau du bloc) est **pire qu'un skip** : il produit un statut «
passed » trompeur, invisible dans tout résumé de run standard, sans qu'aucune assertion n'ait été
évaluée. Une fois qu'une ressource externe (base, service) est déterminée comme *devant* être
disponible pour ce fichier (`requireDatabaseUrl()` a répondu vrai, voir ERR-118), toute panne
ultérieure de cette ressource (connexion refusée, timeout) doit faire échouer bruyamment le
`beforeAll` — jamais être absorbée par un garde qui transforme l'absence d'exécution en un faux
succès. Ne jamais écrire `if (!ressourceDisponible) { return; }` à l'intérieur d'un corps de test
individuel ; ce type de garde n'a de place légitime qu'au niveau `describe.runIf`/`skipIf`, où le
statut résultant reste visible.

**Références :** [ADR-052](../decisions/ADR-052-ci-anti-invisibilite-tests-db-gated.md), [rapport-sprint-CI](../tests/rapport-sprint-CI.md)

---

### ERR-118 — Un test d'intégration conditionné à une variable d'environnement skippe silencieusement, sans garde-fou structurel : 17 tests, 4 fichiers, invisibles deux sprints d'affilée
**Sprint :** CI (stories CI.2) | **Date :** 2026-07-27
**Sévérité :** Haute
**Fichier(s) :** `src/lib/queries/__tests__/bd0-savepoint-integration.test.ts`, `bd0-savepoint-integration-persister-origin.test.ts`, `bons-livraison-transaction-integration.test.ts`, `scripts/data-fixes/__tests__/su12-numero-unique-constraint.test.ts`, `src/test/ci-db-guard.setup.ts` (nouveau), `src/test/require-database-url.ts` (nouveau), `src/test/db-gated-allowlist.ts` (nouveau), `src/__tests__/meta/db-gated-tests-registry.test.ts` (nouveau)

**Symptôme :**
Deux sprints d'affilée (SU, BD — voir ERR-116) ont produit des tests prouvant des garanties
critiques du projet contre une vraie base Postgres, pas des mocks : atomicité de la signature d'un
bon de livraison (rollback réel, verrouillage de lignes contre double signature concurrente) ;
SAVEPOINT/canary de `createReleve` garantissant qu'un relevé de terrain ne peut jamais échouer à
cause du recalcul d'écart de conservation (ERR-113/ERR-114) ; unicité composite
`(siteId, numero|code)` réellement appliquée par le moteur Postgres sur 10 tables. **17 tests, 4
fichiers**, tous conditionnés par `describe.runIf(!!DATABASE_URL)`. Sans `DATABASE_URL` exportée,
`npx vitest run` les skippait silencieusement — aucune CI n'existait avant ce sprint pour garantir
que cette variable soit jamais exportée en continu.

**Cause racine :**
`runIf` est le bon outil pour éviter un échec dur quand une ressource externe n'est pas disponible,
mais son coût est de rendre la garantie qu'il protège optionnelle et silencieuse par défaut — rien
dans la sortie standard de `npx vitest run` n'attire l'attention sur le fait qu'une preuve centrale
n'a pas été rejouée. Documenté une première fois par ERR-116 comme un point d'attention transverse,
sans fix de code à ce moment-là.

**Fix (ADR-052, défense à trois niveaux) :**
1. **Garde global** (`src/test/ci-db-guard.setup.ts`, déclaré dans `vitest.config.ts` via
   `test.setupFiles`) : au chargement du module (avant toute collecte de test), si `process.env.CI`
   est défini et `DATABASE_URL` absent → `throw` immédiat, message explicite. Rend « CI sans base »
   structurellement impossible, quel que soit le fichier de test concerné, y compris un fichier qui
   n'existe pas encore.
2. **Helper obligatoire** `requireDatabaseUrl()` (`src/test/require-database-url.ts`) : centralise
   la décision « ce test doit-il tourner ? ». Tout fichier gated l'appelle
   (`describe.runIf(requireDatabaseUrl())`) au lieu d'écrire son propre
   `!!process.env.DATABASE_URL`.
3. **Allowlist + test méta** (`src/test/db-gated-allowlist.ts`, `src/__tests__/meta/db-gated-tests-registry.test.ts`) :
   grep bidirectionnel du dépôt — une occurrence de `runIf`/`skip` non allowlistée échoue (empêche
   l'ajout non déclaré d'un nouveau gate) ; une entrée allowlistée mais introuvable échoue aussi
   (empêche l'allowlist de pourrir). Chaque entrée exige une justification substantielle (ressource
   externe réelle, pas « test lent »).
Les 5 occurrences `describe.runIf` des 4 fichiers ont été migrées vers `requireDatabaseUrl()`.

**Leçon / Règle :**
Un test `runIf`/gated qui passe une fois n'est pas un filet de sécurité pérenne tant que (1) la
condition de déclenchement n'est pas elle-même garantie par un mécanisme structurel indépendant de
la discipline de chaque fichier de test, et (2) qu'aucun test méta ne vérifie que tout gate présent
dans le dépôt est déclaré et justifié. Avant de merger un nouveau test d'intégration DB-gated,
vérifier qu'il passe par `requireDatabaseUrl()` et qu'il est enregistré dans
`db-gated-allowlist.ts` — c'est désormais vérifié automatiquement par le test méta, mais rester
vigilant : ce mécanisme protège la famille `DATABASE_URL` et les gates syntaxiquement détectables
(`runIf`/`skip`/`skipIf`), pas un test rendu inopérant par une autre voie non syntaxique (voir
ERR-119, cas du `return` silencieux).

**Note de correction associée :** cette entrée corrige et remplace, pour le périmètre CI, la
recommandation d'ERR-116 (« vérifier explicitement à chaque sprint » — remplacée par un mécanisme
structurel, plus une vérification manuelle ponctuelle).

**Références :** [ADR-052](../decisions/ADR-052-ci-anti-invisibilite-tests-db-gated.md), ERR-116, ERR-119, [rapport-sprint-CI](../tests/rapport-sprint-CI.md)

---

### ERR-117 — Un défaut de call site ne se voit pas dans un ADR : vérifier par grep que chaque transition d'un cycle de vie documenté a un point d'appel réel
**Sprint :** BD (story BD.0) | **Date :** 2026-07-27
**Sévérité :** Haute
**Fichier(s) :** `src/lib/queries/releves.ts`, `src/lib/guards/assignation-invariant.ts`, `docs/decisions/ADR-048-persistance-ecarts-conservation.md`

**Symptôme :**
Le sprint BD a découvert que le geste censé résoudre une dérive de conservation (un relevé
COMPTAGE correctif) ne déclenchait aucun recalcul d'écart, alors qu'ADR-048 décrivait le cycle
détection → résolution comme fonctionnel de bout en bout. `verifyAssignationInvariant` n'avait
que 6 call sites, et `createReleve` n'en faisait pas partie. Pire : MORTALITE, réputé « le faire
déjà » (parce qu'il décrémente bien `AssignationBac.nombreActuel`), ne déclenchait pas non plus
le recalcul d'écart pour autant.

**Cause racine :**
Un ADR qui documente un cycle de vie (état A → événement → état B) décrit une intention, pas une
garantie vérifiée par le compilateur ou un test. Rien ne force chaque transition métier décrite à
avoir un call site réel dans le code — l'absence d'un call site est invisible à la lecture de
l'ADR lui-même, elle ne se découvre qu'en auditant le code appelant.

**Fix :**
Ajout du call site manquant dans `createReleve` (voir ERR-113/ERR-114 pour le détail
d'implémentation SAVEPOINT), avec une story dédiée (BD.0) et des tests explicites vérifiant que
le recalcul a bien lieu pour MORTALITE et COMPTAGE.

**Leçon / Règle :**
Quand un ADR décrit un cycle de vie (détection → résolution, ouverture → fermeture, création →
validation), vérifier par `grep` que **chaque** transition documentée a un call site réel dans le
code, avant de construire une fonctionnalité (UI, rapport, alerte) qui présuppose que ce cycle
est complet. Ne jamais présumer qu'une transition « doit déjà fonctionner » parce qu'un
comportement voisin (ici, le décrément de `nombreActuel` par MORTALITE) donne cette impression —
deux effets différents du même événement métier peuvent être câblés indépendamment, et l'un peut
manquer sans que l'autre le signale.

**Références :** [ADR-048](../decisions/ADR-048-persistance-ecarts-conservation.md), [ADR-051](../decisions/ADR-051-formulation-limite-detection-bacs-en-derive.md), [review-sprint-BD](../reviews/review-sprint-BD.md), [rapport-story-BD.0](../tests/rapport-story-BD.0.md)

---

### ERR-116 — Tests DB-gated invisibles : `describe.runIf(!!DATABASE_URL)` skippe silencieusement une garantie centrale
**Sprint :** BD (stories BD.0, BD.3) | **Date :** 2026-07-27
**Sévérité :** Moyenne
**Fichier(s) :** `src/lib/queries/__tests__/bd0-savepoint-integration.test.ts`, `bd0-savepoint-integration-persister-origin.test.ts`, `src/__tests__/bd0-comptage-recalcule-ecart.test.ts`

**Symptôme :**
Les 3 tests qui prouvent réellement la résilience de BD.0 à une vraie erreur SQL (pas un mock)
sont dans des fichiers `describe.runIf(!!DATABASE_URL)`. Sans `DATABASE_URL` exportée dans
l'environnement, `npx vitest run` les **skippe silencieusement** — aucun échec, aucun
avertissement visible dans un résumé de run standard, juste un compteur de skip qui augmente.
Aucun fichier `.github/workflows/*.yml` n'existe dans ce dépôt à la date du sprint BD : rien ne
garantit que ces tests s'exécutent réellement en continu.

**Cause racine :**
`runIf` est le bon outil pour éviter un échec dur quand une ressource externe (ici, une vraie
base Postgres) n'est pas disponible — mais son coût est de rendre la garantie qu'il protège
optionnelle et silencieuse par défaut. Rien dans la sortie standard de `npx vitest run` n'attire
l'attention sur le fait qu'une preuve centrale n'a pas été rejouée.

**Fix :**
Aucun fix de code requis pour ce sprint (limitation acceptée, signalée au PM). Documenté comme
point d'attention transverse : à chaque sprint qui introduit un test `runIf(!!DATABASE_URL)`
prouvant une garantie non négociable, vérifier explicitement (1) que la machine locale
d'exécution du tester exporte bien la variable avant le run final documenté dans le rapport, et
(2) que le pipeline CI/CD du projet (une fois qu'il existe) exporte la même variable.

**Leçon / Règle :**
Avant de considérer qu'une preuve obtenue via un test `runIf`/gated est acquise **en continu**
(pas seulement lors d'une vérification ponctuelle par un agent), vérifier explicitement la
condition qui déclenche son exécution et si un pipeline CI la garantit. Un test gated qui passe
une fois n'est pas un filet de sécurité pérenne tant que la condition de déclenchement n'est pas
elle-même garantie à chaque run.

**Références :** [rapport-story-BD.3](../tests/rapport-story-BD.3.md), [review-sprint-BD](../reviews/review-sprint-BD.md)

**Mise à jour (Sprint CI, 2026-07-27) — [RÉSOLU pour les 3 fichiers cités] :** le Sprint CI a
traité structurellement ce point (ADR-052) : `describe.runIf(!!DATABASE_URL)` a été remplacé par
`describe.runIf(requireDatabaseUrl())` dans `bd0-savepoint-integration.test.ts` et
`bd0-savepoint-integration-persister-origin.test.ts`, plus un garde global (`ci-db-guard.setup.ts`)
qui fait échouer bruyamment tout `npx vitest run` en CI sans `DATABASE_URL`, et un test méta qui
grep le dépôt dans les deux sens pour empêcher qu'un futur `runIf` reste non déclaré (voir
ERR-118). **Correction factuelle :** la référence de cette entrée à
`src/__tests__/bd0-comptage-recalcule-ecart.test.ts` comme fichier DB-gated est **obsolète** — la
pré-analyse du sprint CI a constaté que ce fichier est aujourd'hui **entièrement mocké**, sans
aucun `runIf` (confirmé par ADR-052 §6, « Suivi hors du périmètre de cet ADR »). Le périmètre réel
migré par le sprint CI est donc les 4 fichiers listés dans ERR-118 (`bd0-savepoint-integration`,
`bd0-savepoint-integration-persister-origin`, `bons-livraison-transaction-integration`,
`su12-numero-unique-constraint`), pas ce troisième fichier.

---

### ERR-115 — Un test mocké ne peut pas prouver la résilience à une vraie erreur SQL (variante ERR-103 appliquée aux transactions Prisma/Postgres)
**Sprint :** BD (story BD.0) | **Date :** 2026-07-27
**Sévérité :** Haute
**Fichier(s) :** `src/lib/queries/releves.ts`, `src/lib/queries/__tests__/bd0-savepoint-integration.test.ts`, `bd0-savepoint-integration-persister-origin.test.ts`

**Symptôme :**
Les premiers tests de BD.0 utilisaient `mockRejectedValue(new Error(...))` pour simuler l'échec
de la persistance d'un écart de conservation, et concluaient « la création du relevé n'échoue
jamais ». En réalité, `mockRejectedValue` simule un rejet JS pur — pas une transaction Postgres
avortée. Une vérification contre une vraie base (`silures-db`, Docker) a montré que le
comportement réel diverge radicalement du comportement mocké (voir ERR-113 et ERR-114).

**Cause racine :**
Un mock de fonction ne peut reproduire que ce qu'on lui dit de reproduire : un rejet de promesse.
Il ne peut pas reproduire un effet de bord au niveau du protocole SQL sous-jacent (transaction
empoisonnée, `25P02`, dégradation silencieuse d'un `COMMIT` en `ROLLBACK`). Deux mécanismes
d'échec structurellement différents (rejet JS vs transaction Postgres avortée) produisent des
conséquences différentes en aval, qu'un mock ne peut pas distinguer.

**Fix :**
Toute garantie « best-effort, non bloquant » enveloppant une opération SQL réelle à l'intérieur
d'une transaction Prisma doit être prouvée par un test contre une **vraie base** (pas un mock du
client Prisma), avec une vraie requête SQL invalide comme déclencheur. La vérification du
résultat final doit lire la ligne persistée via une **connexion indépendante** (`pg` séparée) du
client utilisé par l'opération testée — sinon impossible de distinguer un vrai commit d'un COMMIT
dégradé en ROLLBACK (Prisma ne détecte pas cette dégradation, la promesse résout normalement dans
les deux cas).

**Leçon / Règle :**
Variante d'ERR-103 (« un test qui mocke le moteur ne teste pas le moteur ») appliquée
spécifiquement aux transactions Prisma/Postgres : un `mockRejectedValue` prouve la résilience à un
rejet JS, jamais à une vraie erreur SQL. Pour toute opération enveloppée dans une transaction
Prisma dont la robustesse SQL est un critère non négociable, exiger un test d'intégration contre
une vraie base en plus des tests mockés — les deux ne sont pas substituables l'un à l'autre.

**Références :** ERR-103, [rapport-story-BD.0](../tests/rapport-story-BD.0.md), [rapport-story-BD.3](../tests/rapport-story-BD.3.md)

---

### ERR-113 — `try/catch` JS ne protège pas contre une vraie erreur SQL dans une transaction Prisma : SAVEPOINT + sonde canary requis
**Sprint :** BD (story BD.0) | **Date :** 2026-07-27
**Sévérité :** Critique
**Fichier(s) :** `src/lib/queries/releves.ts` (~L.393-433)

**Symptôme :**
Un bloc de recalcul « best-effort, non bloquant » (recalcul et persistance d'un écart de
conservation lors d'un relevé MORTALITE ou COMPTAGE) était protégé par un simple `try/catch` JS.
Contre une vraie base Postgres, une erreur SQL réelle survenant dans ce bloc laisse la
transaction en état `25P02 current transaction is aborted, commands ignored until end of
transaction block` : la **commande suivante** dans la même transaction (ici, la liaison
Planning) échoue à son tour, hors du `catch` d'origine, et fait échouer toute l'opération
(`createReleve()` rejette) — exactement le résultat que le `try/catch` était censé empêcher.

Réordonner le bloc en toute fin de transaction (pour qu'aucune commande ne le suive) ne corrige
rien et introduit un défaut **pire** : Postgres dégrade alors silencieusement le `COMMIT` final
en `ROLLBACK` (`COMMIT command result: ROLLBACK`), Prisma ne détecte pas cette dégradation, et
l'opération entière (y compris le relevé d'origine) est **silencieusement perdue alors que la
promesse `$transaction` résout avec succès**.

**Cause racine :**
Un `try/catch` JS n'a aucune prise sur l'état interne d'une transaction Postgres. Catcher
l'exception en JS empêche seulement la propagation de *cette* erreur — cela ne « désavorte » pas
la transaction côté serveur. Toute requête réelle suivante sur cette même transaction continue
d'être rejetée par Postgres tant que la transaction reste dans l'état aborted, quel que soit le
code JS qui l'entoure.

**Fix :**
`SAVEPOINT` explicite avant le bloc à risque (`tx.$executeRawUnsafe("SAVEPOINT ecart_constate_sp")`),
`ROLLBACK TO SAVEPOINT` dans le `catch` (`tx.$executeRawUnsafe("ROLLBACK TO SAVEPOINT
ecart_constate_sp")`). Un `ROLLBACK TO SAVEPOINT` désavorte spécifiquement la transaction et
rend les commandes suivantes (et le `COMMIT` final) à nouveau exécutables normalement, sans
annuler ce qui précède le savepoint. Voir ERR-114 pour la complémentaire sur la sonde canary
nécessaire pour que ce mécanisme se déclenche réellement dans tous les cas.

```ts
await tx.$executeRawUnsafe("SAVEPOINT ecart_constate_sp");
try {
  // ... bloc à risque (recalcul + persistance) ...
} catch (err) {
  await tx.$executeRawUnsafe("ROLLBACK TO SAVEPOINT ecart_constate_sp");
  console.error("[createReleve] Échec du recalcul (non bloquant)", ..., err);
}
```

**Leçon / Règle :**
Dans une transaction Prisma, un `try/catch` JS autour d'un bloc SQL best-effort ne suffit **pas**
si une commande réelle s'exécute après ce bloc dans la même transaction — une vraie erreur SQL
laisse la transaction Postgres avortée, indépendamment du catch JS. Ne jamais réordonner un bloc
à risque en fin de transaction pour « éviter » ce problème : cela remplace un échec explicite par
une perte de données silencieuse (COMMIT dégradé en ROLLBACK, non détecté par Prisma). La
solution correcte est un `SAVEPOINT` explicite avant le bloc et un `ROLLBACK TO SAVEPOINT` dans
le `catch`. Voir ERR-114 pour un piège complémentaire qui peut rendre ce mécanisme inopérant.

**Références :** [ADR-048](../decisions/ADR-048-persistance-ecarts-conservation.md), [rapport-story-BD.0](../tests/rapport-story-BD.0.md), [rapport-story-BD.3](../tests/rapport-story-BD.3.md), [review-sprint-BD](../reviews/review-sprint-BD.md)

---

### ERR-114 — Piège complémentaire au SAVEPOINT : une fonction interne qui avale ses propres erreurs SQL rend le SAVEPOINT inopérant sans sonde canary
**Sprint :** BD (story BD.0) | **Date :** 2026-07-27
**Sévérité :** Haute
**Fichier(s) :** `src/lib/queries/releves.ts` (~L.393-433), `src/lib/queries/__tests__/bd0-savepoint-integration-persister-origin.test.ts`

**Symptôme :**
Même avec un `SAVEPOINT`/`ROLLBACK TO SAVEPOINT` correctement posé (ERR-113), le mécanisme
restait inopérant pour une origine d'erreur précise : quand l'erreur SQL survient **à l'intérieur**
de `persisterEcartConstate`, celle-ci a son propre `try/catch` interne (par design, ADR-048 §6 —
« ne doit jamais faire échouer l'opération métier appelante ») qui avale l'erreur sans jamais la
relancer. Le `catch` englobant dans `createReleve` ne se déclenche donc jamais pour ce cas
précis, le `ROLLBACK TO SAVEPOINT` n'est jamais émis, et la transaction reste empoisonnée
silencieusement malgré la présence du SAVEPOINT.

**Cause racine :**
Un SAVEPOINT ne protège que ce qui est effectivement rattrapé par le `catch` qui l'entoure. Si
une fonction appelée à l'intérieur du bloc a elle-même un `try/catch` qui absorbe l'erreur sans la
relancer (souvent un choix délibéré et documenté pour une autre raison, ici la non-blocance de
l'opération métier appelante), l'exception n'atteint jamais le `catch` englobant — le mécanisme de
protection en amont ne se déclenche donc jamais pour cette origine d'erreur, même s'il est
correctement écrit.

**Fix :**
Ajouter une **requête sonde (« canary »)** — `SELECT 1` via `tx.$queryRawUnsafe`, sans effet de
bord — juste après le bloc à risque, à l'intérieur du même `try`. Cette sonde échoue avec `25P02`
si la transaction est empoisonnée, quelle que soit l'origine de l'empoisonnement (erreur relancée
normalement ou avalée silencieusement en interne par une fonction appelée) — ce qui déclenche
alors le `catch` englobant et le `ROLLBACK TO SAVEPOINT`, même dans ce cas silencieux.

```ts
await tx.$executeRawUnsafe("SAVEPOINT ecart_constate_sp");
try {
  await persisterEcartConstate(tx, ...); // peut avaler sa propre erreur SQL en interne
  await tx.$queryRawUnsafe("SELECT 1"); // sonde canary : détecte l'empoisonnement silencieux
} catch (err) {
  await tx.$executeRawUnsafe("ROLLBACK TO SAVEPOINT ecart_constate_sp");
  console.error("[createReleve] Échec du recalcul (non bloquant)", ..., err);
}
```

**Leçon / Règle :**
Un `SAVEPOINT` + `catch` englobant ne suffit pas si une fonction appelée à l'intérieur du bloc a
son propre `try/catch` qui avale ses erreurs sans les relancer — un cas fréquent quand cette
fonction est elle-même conçue pour être non-bloquante (best-effort) pour une autre raison
légitime. Avant de considérer un mécanisme SAVEPOINT comme complet, vérifier explicitement si
chaque fonction appelée à l'intérieur du bloc protégé peut avaler ses propres erreurs SQL en
interne — si oui, ajouter une requête sonde sans effet de bord après le bloc, dans le même `try`,
pour détecter l'empoisonnement même quand aucune exception JS n'a traversé l'appelant.

**Références :** [ADR-048](../decisions/ADR-048-persistance-ecarts-conservation.md), [rapport-story-BD.3](../tests/rapport-story-BD.3.md), [review-sprint-BD](../reviews/review-sprint-BD.md)

---

### ERR-108 — Race condition de génération de numéro : forme de transaction et périmètre du retry
**Sprint :** SU (story SU.3) | **Date :** 2026-07-26
**Sévérité :** Haute
**Fichier(s) :** `src/lib/queries/numero-utils.ts`, `src/lib/queries/besoins.ts`, `src/lib/queries/factures.ts`, `src/lib/queries/commandes.ts`, `src/lib/queries/ventes.ts`, `src/lib/queries/bons-livraison.ts`

**Symptôme :**
Le pattern « lire le max existant + 1 » pour générer un `numero`/`code` séquentiel (Facture, Commande, Vente, BonLivraison, Besoin) est dupliqué à l'identique dans 4 modules. En isolation Read Committed (le niveau par défaut de PostgreSQL), deux transactions concurrentes peuvent lire le même max et calculer le même numéro suivant avant que l'une des deux ne commit — la contrainte `@unique` transforme alors la collision en 500 opaque au lieu d'un retry ou d'un message actionnable.

**Cause racine :**
Read Committed ne bloque pas une lecture concurrente d'un `SELECT MAX(...)` — chaque transaction voit l'état commité au moment de sa propre lecture, pas les écritures en cours d'une transaction sœur non encore commitée. Le pattern « lire puis calculer puis écrire » n'est jamais atomique sans un verrou explicite.

**Fix :**
`pg_advisory_xact_lock` posé sur `tx` (jamais sur le client Prisma global — un verrou posé hors transaction ne protège rien, il se relâche immédiatement), avec une clé dérivée de la portée réelle du compteur (modèle + préfixe + année + site) pour ne pas bloquer des portées disjointes entre elles. Piège associé : un `$transaction([...])` de forme **array** ne fournit aucun client `tx` sur lequel poser un verrou — il faut convertir en forme **callback** `$transaction(async (tx) => { ... })`.

**Leçon / Règle :**
1. Le pattern « lire le max + 1 » pour une séquence est intrinsèquement vulnérable en Read Committed — ne jamais le considérer safe sans verrou explicite ou séquence PostgreSQL dédiée.
2. Un verrou (`pg_advisory_xact_lock` ou équivalent) n'a de sens que posé sur le client de la transaction en cours (`tx`), jamais sur le client global.
3. Un retry sur violation `P2002` (unicité) ne peut jamais se limiter à relancer uniquement la génération du numéro : une transaction Postgres avortée par une violation de contrainte rejette **toute** requête suivante sur cette même transaction — le retry doit englober la transaction entière, pas seulement le calcul du numéro.
4. Corriger ce pattern une fois dans un module partagé (`numero-utils.ts`), jamais dans chaque appelant séparément — la duplication de ce pattern précis est elle-même le facteur de risque (4 corrections à maintenir en synchronisation au lieu d'une).

**Références :** [review-sprint-SU](../reviews/review-sprint-SU.md)

---

### ERR-107 — Faux positifs de tests sous forte contention CPU (timeouts sans assertion cassée)
**Sprint :** SU | **Date :** 2026-07-26
**Sévérité :** Moyenne
**Fichier(s) :** (transverse — n'importe quel fichier de test sous `npx vitest run`)

**Symptôme :**
Lors d'un sprint fortement parallélisé (plusieurs agents actifs simultanément sur la même machine), `npx vitest run` a produit jusqu'à 69 échecs, **tous** de la forme `Test timed out in 5000ms`, sans aucune assertion cassée, répartis sur des fichiers sans rapport entre eux, et **variables d'un run à l'autre** (un fichier en échec à un run passe au run suivant sans modification de code).

**Cause racine :**
Signature classique de saturation machine (CPU/mémoire partagés entre plusieurs process concurrents), pas une régression de code. Un timeout par défaut de 5 s devient statistiquement franchissable dès que le scheduler de la machine est sous forte pression, indépendamment de la correction du code testé.

**Fix :**
Ne jamais conclure à une régression uniquement sur la base d'un run global bruyant. Relancer le(s) fichier(s) suspect(s) **en isolation** (`npx vitest run <fichier>`, machine autrement libre) — un résultat vert en isolation confirme le faux positif. Utiliser `--testTimeout` pour neutraliser le bruit ponctuel si la contention est connue et temporaire.

**Leçon / Règle :**
La baseline de référence pour "la suite est verte" doit être obtenue **machine libre de tout agent concurrent**. Un échec en timeout pur (aucune assertion cassée), non reproductible en isolation, et dispersé sur des fichiers sans rapport thématique est un signal de contention, pas de bug — ne jamais lancer une investigation de régression ou un rollback sur cette seule base. Documenter ce contexte dans le rapport de test si un sprint a été fortement parallélisé (cf. constat de process, `review-sprint-SU.md`).

**Références :** [review-sprint-SU](../reviews/review-sprint-SU.md), [rapport-sprint-SU](../tests/rapport-sprint-SU.md)

**Mise à jour (Sprint CI, 2026-07-27) :** confirmé à nouveau, deux fois, dans des conditions bien
pires (load average jusqu'à 480 sur 12 CPU, utilisateurs/process tiers sans lien avec le projet) :
43 échecs en un run, puis 5, puis 3, **tous** `Test timed out in 5000ms`, tous infirmés par
ré-exécution isolée des fichiers concernés (0 échec à chaque fois). Règle de méthode ajoutée par ce
sprint, à appliquer systématiquement désormais : **ne jamais déclarer une régression sans
ré-exécution isolée du fichier concerné**, et **ne jamais lancer deux suites de tests en
parallèle** sur la même machine (voir ERR-118 pour le cas de contention inter-agents sur les
fichiers, distinct mais lié). Voir [rapport-sprint-CI](../tests/rapport-sprint-CI.md) section 0 et
partie H.4 pour le détail des trois occurrences de ce sprint.

---

### ERR-106 — Unicité `@unique` globale sur un champ généré par compteur scopé par site (collision multi-tenant déterministe)
**Sprint :** SU (story SU.12) | **Date :** 2026-07-26
**Sévérité :** Haute
**Fichier(s) :** `prisma/schema.prisma` (10 familles : Facture, Commande, Vente, BonLivraison, Besoin, et 5 autres — dont `LotAlevins.code`, cf. SU.13), `src/lib/queries/**` (call sites `findUnique({ where: { numero } })`)

**Symptôme :**
Un champ `numero`/`code` généré par une séquence **scopée par `siteId`** (ex. `FAC-2026-001` recommence à 001 pour chaque site) mais contraint `@unique` **global** en base produit une collision **déterministe**, pas une simple race : deux sites différents génèrent chacun légitimement `FAC-2026-001`, et le second `create()` échoue systématiquement avec une violation de contrainte unique — sans qu'aucune concurrence ne soit nécessaire pour déclencher le bug.

**Cause racine :**
Le compteur de génération est raisonné "par site" (relance à 1 par site et par année), mais la contrainte de schéma n'a pas été alignée sur cette portée — elle reste `@unique` sur la seule colonne, donc globale à toute la table, toutes tenants confondus.

**Fix :**
Remplacer `@unique` global par `@@unique([siteId, numero])` (ou `[siteId, code]`) — la contrainte doit exactement matcher la portée du compteur, ni plus étroite ni plus large. **Ne pas conserver les deux contraintes en parallèle** : garder `@unique` global en plus du composite rend le composite inutile (le global continue de bloquer la collision légitime inter-site). Penser systématiquement aux call sites `findUnique({ where: { numero } })`, qui cessent de compiler une fois `numero` retiré de `@unique` seul — remplacer par `where: { siteId_numero: { siteId, numero } }`.

**Leçon / Règle :**
Dès qu'un identifiant métier est généré par une séquence **scopée** (par site, par année, par tenant), la contrainte d'unicité en base doit être composite et **exactement** alignée sur cette portée — jamais laissée globale "pour faire simple", et jamais dupliquée (global + composite) en même temps. Lors de toute revue de schéma multi-tenant (R8), vérifier systématiquement la correspondance entre la logique de génération de compteur et la contrainte `@unique`/`@@unique` réelle. Un audit read-only (grep `@unique` sur les champs `numero`/`code`/`reference` face à leur logique de génération) doit faire partie de la checklist R8 pour tout nouveau modèle avec compteur.

**Références :** [review-sprint-SU](../reviews/review-sprint-SU.md)

---

### ERR-105 — Permissions orphelines : ajout d'une valeur d'enum `Permission` sans backfill des `SiteRole` existants
**Sprint :** SU (stories SU.8, SU.10) | **Date :** 2026-07-26
**Sévérité :** Haute
**Fichier(s) :** `prisma/schema.prisma` (enum `Permission`), `src/lib/role-form-labels.ts`, `prisma/seed.sql`, migrations `20260401000000_backfill_subscription_permissions`, `20260726160000_backfill_ventes_modifier_permissions`, `20260726170000_backfill_bons_livraison_rectifier`, `src/__tests__/permissions-orphan-guard.test.ts`

**Symptôme :**
Une nouvelle valeur ajoutée à l'enum `Permission` (et présente dans `SYSTEM_ROLE_DEFINITIONS` pour les *nouveaux* sites) reste absente du tableau `SiteRole.permissions` de tous les sites **déjà créés** en base. Concrètement lors du sprint SU : 4 permissions étaient orphelines de tout `SiteRole` seedé (`VENTES_MODIFIER`, `PAIEMENTS_SUPPRIMER`, `DEPENSES_VENTE_RETRO`, `BESOINS_MODIFIER_RETRO`), dont une (`VENTES_MODIFIER`) cassait entièrement le flux de création/signature de bon de livraison pour tout utilisateur non-admin (seul `Role.ADMIN` global court-circuite les permissions et n'était donc pas affecté, masquant le bug en test superficiel).

**Cause racine :**
`SiteRole.permissions` est un tableau **stocké en base** au moment de la création du rôle, pas recalculé dynamiquement depuis `SYSTEM_ROLE_DEFINITIONS`. Ajouter une permission à l'enum et à la définition des rôles système ne change donc que le comportement des rôles créés **après** ce changement — les lignes `SiteRole` déjà persistées restent figées avec leur ancien tableau de permissions. C'est une généralisation du problème déjà identifié en ERR-088 (labels UI oubliés) : ici la portée est plus large, elle inclut aussi les données déjà en base, pas seulement le mapping d'affichage.

**Fix :**
Toute nouvelle permission ajoutée à l'enum `Permission` exige systématiquement les 4 actions suivantes, jamais 3 :
1. Une **migration de backfill idempotente** qui ajoute la permission aux `SiteRole` existants concernés (précédents : les 3 migrations listées ci-dessus) ;
2. Un **label** dans `src/lib/role-form-labels.ts` — sans label la permission est invisible dans l'UI de gestion des rôles, donc **inattribuable manuellement** même après un backfill correct (cf. ERR-088) ;
3. L'ajout de la permission au **seed** (`prisma/seed.sql`), pour que les environnements re-seedés (dev, tests, démo) reflètent le même état que la prod backfillée ;
4. Un **test de garde** (`src/__tests__/permissions-orphan-guard.test.ts`) qui échoue si une valeur de l'enum `Permission` n'est portée par aucun `SiteRole` seedé **ou** n'a pas de label — avec une liste d'exclusion explicite et commentée pour les permissions réellement plateforme (justifiées individuellement, jamais une exclusion large "pour que le test passe").

**Leçon / Règle :**
Ajouter une valeur à l'enum `Permission` sans backfill est un bug latent qui ne se déclenche qu'en production, sur des sites déjà créés — il est invisible en dev/seed frais où les rôles sont toujours créés après la modification. Toute PR touchant l'enum `Permission` doit systématiquement produire les 4 livrables ci-dessus, jamais seulement le code + label. Le test de garde `permissions-orphan-guard.test.ts` doit rester dans la suite standard exécutée à chaque `npx vitest run` — c'est le seul filet qui détecte l'oubli avant la prod.

**Références :** [review-sprint-SU](../reviews/review-sprint-SU.md), ERR-088 (variante restreinte aux seuls labels)

---

### ERR-104 — Piège WinAnsi : `toLocaleString("fr-FR")` produit un séparateur invisible dans un PDF sans police custom
**Sprint :** SU (story SU.11) | **Date :** 2026-07-26
**Sévérité :** Haute
**Fichier(s) :** `src/lib/export/pdf-format-utils.ts`, `src/lib/export/pdf-cout-production-insights.ts`, `src/__tests__/export/pdf-winansi-format-guard.test.ts`

**Symptôme :**
Un nombre formaté avec `(1234).toLocaleString("fr-FR")` sur Node 22 produit `"1 234"` où l'espace de séparation des milliers est en réalité le caractère **U+202F** (narrow no-break space / espace fine insécable), pas un espace ASCII classique (U+0020). Ce caractère est absent de la table d'encodage WinAnsi/Windows-1252. Aucun template PDF du projet n'enregistre de police custom (`Font.register` absent partout) : la police par défaut Helvetica de `@react-pdf/pdfkit` est un `AFMFont` utilisant `WinAnsiEncoding`. Un caractère hors table **ne lève aucune exception** au rendu : il retombe silencieusement sur `.notdef` (glyphe vide, largeur nulle) — le séparateur de milliers disparaît sans laisser de trace, un bug totalement silencieux, indétectable sans extraction de texte réelle du PDF généré (une inspection visuelle superficielle du rendu peut manquer l'absence d'un simple espace).

**Cause racine :**
`Intl.NumberFormat`/`toLocaleString` avec la locale `fr-FR` a changé de comportement selon les versions de Node/ICU : les versions récentes utilisent U+202F pour le séparateur de milliers en français (conforme à la norme Unicode CLDR), un caractère qui n'a jamais fait partie du jeu WinAnsi historique conçu pour Windows-1252 (issu de l'ère pré-Unicode). react-pdf/pdfkit, en l'absence de police custom enregistrée, encode tout le texte en WinAnsi — tout code point hors de cette table est purement et simplement ignoré au rendu.

**Fix :**
Utiliser exclusivement `formatNumPDF`/`formatDecimalPDF` de `src/lib/export/pdf-format-utils.ts` pour tout texte numérique destiné à être injecté dans un composant `<Text>` react-pdf — ces helpers utilisent un séparateur ASCII construit manuellement, jamais `toLocaleString`. Ne jamais utiliser `toLocaleString`/`Intl.NumberFormat` avec une locale pour du texte react-pdf tant qu'aucune police custom couvrant Unicode n'est enregistrée.

**Non concerné (vérifié empiriquement) :**
- `toLocaleDateString("fr-FR")` ne produit que des espaces ASCII standards — pas de piège identique sur les dates.
- Les exports Excel ne passent par aucune police PDF (pas de contrainte WinAnsi) — `toLocaleString` y reste sans risque.

**Garde anti-récidive :** `src/__tests__/export/pdf-winansi-format-guard.test.ts`, à deux volets :
1. Structurel : échoue si le pattern `.toLocaleString(` apparaît dans un fichier de `src/lib/export/*` (grep de code) ;
2. Runtime : détecte tout caractère hors table WinAnsi dans un texte réellement destiné à un composant PDF.

**Leçon / Règle :**
Un caractère hors table d'encodage dans un moteur de rendu bas niveau (WinAnsi, Latin-1, etc.) ne provoque généralement **pas d'exception** — il est silencieusement supprimé ou remplacé par un glyphe vide. Ce type de bug ne se détecte jamais par inspection visuelle rapide ni par un test qui vérifie seulement "le PDF se génère sans erreur" : il faut extraire le texte réel du PDF produit et le comparer caractère par caractère. Toute fonction de formatage numérique/textuel destinée à react-pdf doit passer par un helper dédié (`pdf-format-utils.ts`), jamais par les API d'internationalisation standard du navigateur/Node, tant que le projet n'enregistre pas de police custom couvrant Unicode.

**Références :** [review-sprint-SU](../reviews/review-sprint-SU.md)

---

### ERR-103 — `throw` dans un callback zlib async : promesse jamais réglée + uncaughtException hors chaîne (lib tierce sur entrée utilisateur)
**Sprint :** PX | **Date :** 2026-07-26
**Sévérité :** Critique
**Fichier(s) :**
- `node_modules/@react-pdf/png-js/lib/png-js.js` (lib vendue, non modifiée)
- `src/lib/validation/image-decode.ts` (nouveau)
- `src/lib/export/render-pdf-safely.ts` (nouveau)
- `src/lib/export/pdf-bon-livraison.tsx`

**Symptôme :**
Une requête HTTP qui ne répond jamais (`render: 90s` dans les logs, `curl` renvoie HTTP `000`), sans 500 ni timeout, lors de la génération d'un PDF de bon de livraison. En parallèle, une `Uncaught Exception: Error: incorrect data check` (`Z_DATA_ERROR`) apparaît dans les logs serveur, émise depuis `Zlib.zlibOnError`, hors de toute route ou requête identifiable.

**Cause racine :**
`@react-pdf/png-js` (`lib/png-js.js` l. 145) fait `zlib.inflate(data, (err) => { if (err) throw err })`. Un `throw` dans un **callback asynchrone Node** n'a aucune chaîne de promesse à rejeter : la promesse englobante (`renderToBuffer()`) reste pendante **pour toujours**, et l'exception s'échappe directement au niveau `process` (comportement Node par défaut : le worker est tué). Ce chemin bugué n'est emprunté que pour les PNG **avec canal alpha (RGBA)**, à palette indexée avec transparence, ou entrelacés — exactement le format produit par une signature de pad tactile (canvas HTML à fond transparent). Un PNG RGB opaque corrompu à l'identique rend **sans aucune erreur** (le flux brut est ré-embarqué sans jamais appeler le décodeur bugué), ce qui rend le bug particulièrement trompeur à reproduire et à corréler.

**Fix :**
Double barrière, aucune des deux ne remplace l'autre :
1. **Pré-validation à l'écriture** (`src/lib/validation/image-decode.ts`) : décoder défensivement toute image base64 issue d'une entrée utilisateur avant qu'elle n'entre en base — concaténer **tous** les chunks `IDAT` d'un PNG avant `zlib.inflateSync` (inflater le premier chunk seul produirait un faux positif de rejet sur les PNG multi-IDAT légitimes, cas fréquent et testé explicitement).
2. **Wrapper de rendu inconditionnel** (`src/lib/export/render-pdf-safely.ts`), en défense en profondeur pour couvrir tout bug similaire futur : timeout dur (indépendant de tout le reste) + capture fail-safe de `uncaughtException` par refcount partagé tant qu'au moins un rendu est en vol — pas de filtrage par heuristique de reconnaissance de stack (voir leçon c).

**Leçon / Règle :**
a. Une bibliothèque tierce qui traite des **entrées utilisateur** doit être considérée comme pouvant ne jamais rendre la main. Tout appel de ce type doit être borné par un **timeout dur** — un `try/catch` local ne protège **pas** contre une promesse jamais réglée.
b. Un `throw` dans un callback async (`zlib.*`, `fs.*`, streams, callbacks de libs C-bindings) ne devient **jamais** un rejet de promesse. Ne jamais présumer qu'une erreur de lib remontera dans le `.catch()` englobant.
c. Un garde-fou basé sur une **heuristique de reconnaissance** (marqueurs de stack, patterns de message) est **fail-open** : il laisse passer tout ce qu'il ne reconnaît pas. Sur un chemin de disponibilité (une requête qui doit toujours répondre), préférer le **fail-safe** (capturer par défaut pendant toute la fenêtre à risque, ne qualifier l'attribution qu'à titre diagnostique dans le log).
d. Un validateur maison et le décodeur réel de la lib **ne sont pas le même code**. La validation amont est un filtre d'ergonomie (message d'erreur utile, fermeture du vecteur d'écriture) — jamais la barrière ultime. La barrière de disponibilité doit être posée au point d'usage (au moment du rendu), pas seulement à l'écriture.
e. **Un test qui mocke le moteur ne teste pas le moteur.** `src/__tests__/export/pdf-bon-livraison.test.ts` mockait intégralement `@react-pdf/renderer` (y compris `Image: () => null`) ; ses 15 tests intitulés « rend un PDF sans erreur » passaient en 86 ms sans rendre aucun PDF et n'auraient jamais pu attraper ce bug. Tout module de rendu/sérialisation/parsing doit avoir **au moins un test qui exerce le vrai moteur**, avec une entrée valide **et** une entrée hostile construite pour passer la validation amont tout en cassant le moteur réel (pas un mock du moteur qui simule l'échec).

**Références :** [ADR-047](../decisions/ADR-047-robustesse-rendu-pdf.md) | [pre-analysis-sprint-PX](../analysis/pre-analysis-sprint-PX.md) | [review-sprint-PX](../reviews/review-sprint-PX.md)

---

### ERR-100 — ExportButton : `className="h-8"` écrase le touch target mobile interne
**Sprint :** CP-3 | **Date :** 2026-05-11
**Sévérité :** Moyenne
**Fichier(s) :** `src/components/vagues/cout-production-card.tsx`

**Symptôme :**
Le bouton d'export PDF dans la carte de coût de production mesure 32 px de hauteur sur mobile au lieu des 44 px minimum requis. Le composant `ExportButton` possède en interne un `min-h-[44px]` pour respecter les cibles tactiles mobile, mais le consommateur lui passe `className="h-8"` (32 px), ce qui l'écrase via la cascade Tailwind.

**Cause racine :**
`h-8` (hauteur fixe) a une spécificité supérieure à `min-h-[44px]` dans la cascade CSS. Passer une classe de hauteur fixe à un composant qui exprime sa contrainte d'accessibilité via `min-height` annule silencieusement cette contrainte.

**Fix :**
Supprimer `h-8` du `className` passé à `ExportButton`. Laisser la hauteur être gouvernée par les variants internes du composant.

**Leçon / Règle :**
Ne jamais passer de classes de hauteur fixe (`h-*`) à des composants UI qui définissent leur accessibilité via `min-h-[44px]`. Si une variante de taille est nécessaire, utiliser les props `size` ou `variant` exposées par le composant — pas un override CSS externe. Valider les touch targets (min 44 px) lors de la review mobile.

---

### ERR-099 — R2 : `labelCategorie()` utilise des strings en dur absents de l'enum `CategorieDepense`
**Sprint :** CP-2 | **Date :** 2026-05-11
**Sévérité :** Haute
**Fichier(s) :** `src/lib/export/pdf-cout-production.tsx`

**Symptôme :**
La fonction `labelCategorie()` contient un `switch` avec des cas `"MEDICAMENT"`, `"ENTRETIEN"`, `"ENERGIE"`, `"MAIN_OEUVRE"` — valeurs qui n'existent pas dans l'enum `CategorieDepense`. Les valeurs réelles de l'enum sont : `ALIMENT`, `INTRANT`, `EQUIPEMENT`, `ELECTRICITE`, `EAU`, `LOYER`, `SALAIRE`, `TRANSPORT`, `VETERINAIRE`, `REPARATION`, `INVESTISSEMENT`, `AUTRE`. Au runtime, aucun cas du switch ne correspond, toutes les catégories tombent dans le `default`, et les libellés affichés sont tous identiques (la valeur par défaut).

**Cause racine :**
Double violation R2 : (1) les noms de valeurs ont été écrits de mémoire sans consulter la définition de l'enum dans `prisma/schema.prisma` ou `src/types/index.ts` ; (2) l'enum `CategorieDepense` n'a pas été importé, donc TypeScript ne pouvait pas signaler les cas non couverts.

**Fix :**
Importer `CategorieDepense` depuis `@/types`. Réécrire le switch en utilisant `CategorieDepense.ALIMENT`, `CategorieDepense.ELECTRICITE`, etc. Ajouter un cas `"MULTI_VAGUE"` (bucket synthétique, voir ERR-098) pour les coûts partagés.

```typescript
import { CategorieDepense } from "@/types";

function labelCategorie(cat: CategorieDepense | "MULTI_VAGUE"): string {
  switch (cat) {
    case CategorieDepense.ALIMENT:      return "Alimentation";
    case CategorieDepense.SALAIRE:      return "Salaires";
    case CategorieDepense.ELECTRICITE:  return "Électricité";
    // ... tous les 12 membres + "MULTI_VAGUE"
    default: return cat;
  }
}
```

**Leçon / Règle :**
Avant d'écrire un label mapping pour un enum, toujours lire sa définition dans `prisma/schema.prisma` (section `enum CategorieDepense`) ou `src/types/index.ts`. Ne jamais deviner les noms de valeurs. Importer l'enum et utiliser ses membres : TypeScript signalera alors tout cas manquant si le switch n'est pas exhaustif (avec `--noImplicitReturns` ou un `default` retournant `never`).

---

### ERR-098 — Type union non créé pour un bucket synthétique hors-enum (variante F4)
**Sprint :** CP-1 | **Date :** 2026-05-11
**Sévérité :** Basse
**Fichier(s) :** `src/lib/queries/finances.ts`

**Symptôme :**
La fonction `getCoutProductionVague()` agrège les dépenses par catégorie, dont un bucket synthétique `"MULTI_VAGUE"` pour les coûts partagés entre plusieurs vagues. Ce bucket n'existe pas dans l'enum `CategorieDepense`. Le type de retour de la fonction l'acceptait silencieusement car tout était typé `string`, masquant l'incohérence.

**Cause racine :**
Quand un bucket synthétique est introduit dans une logique d'agrégation (valeur non présente dans l'enum officiel), il doit être rendu explicite dans le système de types. Sans type union, toute la couche type doit être élargie à `string` — ce qui perd la sûreté sur les valeurs légitimes.

**Fix :**
Créer un type union local : `type CategorieDepenseOuSynthetique = CategorieDepense | "MULTI_VAGUE"`. Utiliser ce type dans l'interface de retour de la fonction à la place de `string`.

```typescript
type CategorieDepenseOuSynthetique = CategorieDepense | "MULTI_VAGUE";

interface CoutParCategorie {
  categorie: CategorieDepenseOuSynthetique;
  total: number;
}
```

**Leçon / Règle :**
Quand une fonction d'agrégation introduit un bucket synthétique absent de l'enum officiel, ne pas élargir le type à `string` — créer un type union local `EnumOfficiel | "VALEUR_SYNTHETIQUE"`. Cela documente explicitement les valeurs non-standard tout en préservant la sûreté de type sur les valeurs légitimes.

---

### ERR-097 — R3 : interfaces de retour typées `string` au lieu de l'enum correspondant
**Sprint :** CP-1 | **Date :** 2026-05-11
**Sévérité :** Moyenne
**Fichier(s) :** `src/lib/queries/finances.ts`

**Symptôme :**
Les interfaces TypeScript décrivant le retour de `getCoutProductionVague()` contenaient `categorie: string` et `statut: string` à la place de `CategorieDepense` et `StatutVague`. TypeScript ne se plaignait pas à la compilation car les valeurs réelles (issues de Prisma) sont assignables à `string`. Mais les consommateurs de ces interfaces ne bénéficiaient d'aucune sûreté de type sur ces champs.

**Cause racine :**
Lors de l'écriture rapide d'une interface de retour, on a utilisé `string` comme type "générique" pour des champs qui correspondent en réalité à des enums Prisma. Ce pattern est une violation de R3 (Prisma = TypeScript identiques) : les champs Prisma typés `CategorieDepense` ou `StatutVague` doivent avoir le même type dans l'interface TypeScript miroir.

**Fix :**
Remplacer `string` par l'enum importé dans chaque interface de retour :

```typescript
// Avant (violation R3) :
interface CoutParCategorie {
  categorie: string;
}
interface CoutProductionResult {
  statut: string;
}

// Après (R3 respectée) :
import { CategorieDepense, StatutVague } from "@/types";
interface CoutParCategorie {
  categorie: CategorieDepense;
}
interface CoutProductionResult {
  statut: StatutVague;
}
```

**Leçon / Règle :**
R3 s'applique aux interfaces de retour de fonctions, pas seulement aux modèles miroirs de Prisma. Chaque champ d'une interface qui correspond à un enum Prisma doit être typé avec cet enum (importé depuis `@/types`), jamais avec `string`. Auditer les interfaces de retour des fonctions de query layer lors de chaque review.

---

### ERR-096 — R2 : string en dur comme valeur dans une `Map` initialisée avec des clés d'enum
**Sprint :** CP-1 | **Date :** 2026-05-11
**Sévérité :** Moyenne
**Fichier(s) :** `src/lib/queries/finances.ts`

**Symptôme :**
Une `Map` de correspondance (lookup) est initialisée avec des strings en dur comme clés : `new Map([["ALIMENT", "Alimentation"], ...])`. TypeScript ne lève aucune erreur si la Map est typée `Map<string, string>`. Si la valeur de l'enum `CategorieDepense.ALIMENT` change de nom, aucun compilateur ne signale la clé obsolète.

**Cause racine :**
Variante de ERR-018 : R2 est respecté pour les comparaisons et les filtres Prisma, mais oublié lors de l'initialisation des structures de données (Map, objet littéral) qui servent de lookup par valeur d'enum. Le problème est identique que la structure soit un objet (`{ ALIMENT: "..." }`) ou une Map.

**Fix :**
Typer la Map avec l'enum et utiliser les membres de l'enum comme clés :

```typescript
// Avant (violation R2) :
const categorieMap = new Map([
  ["ALIMENT", "Alimentation"],
  ["MEDICAMENT", "Médicaments"],
]);

// Après (R2 respectée) :
import { CategorieDepense } from "@/types";
const categorieMap = new Map<CategorieDepense, string>([
  [CategorieDepense.ALIMENT, "Alimentation"],
  [CategorieDepense.MEDICAMENT, "Médicaments"],
]);
```

**Leçon / Règle :**
ERR-018 (objet constant indexé par enum) et cette entrée (Map initialisée avec des clés d'enum) sont la même violation R2. Typer explicitement `Map<MonEnum, ...>` et utiliser `MonEnum.VALEUR` comme clé garantit que le compilateur détecte toute clé obsolète après renommage d'enum. Voir aussi ERR-018 et ERR-031 pour les autres variantes du pattern.

---

### ERR-093 — Prisma `select` partiel + cast forcé = helper de calcul reçoit des champs manquants silencieusement
**Sprint :** Bugfixing | **Date :** 2026-05-03
**Sévérité :** Haute
**Fichier(s) :**
- `src/lib/queries/vagues.ts`
- `src/lib/calculs.ts`

**Symptôme :**
Le graphique "Evolution du poids moyen" affiche une valeur incorrecte en production alors que le tableau de bord (stats board) affiche la valeur correcte pour la même vague. L'écart n'est visible qu'avec des données de production où les bacs ont des populations très inégales.

**Cause racine :**
Quatre problèmes combinés :
1. Le `select` Prisma dans `getVagueById` ne sélectionnait que `{ id, nom, volume }` sur les bacs — `nombreInitial` et `poidsMoyenInitial` étaient absents du résultat.
2. Un cast `as Bac[]` masquait l'incohérence : TypeScript croyait que le champ existait, le runtime recevait `undefined`.
3. Le helper `computeVivantsByBac` (calculs.ts) tombait silencieusement sur un fallback "répartition uniforme" quand `bac.nombreInitial` vaut `undefined`, produisant des vivants erronés par bac.
4. Le chemin stats board (`getIndicateursVague`) sélectionnait `nombreInitial` explicitement — asymétrie invisible dans les tests unitaires.

**Fix :**
Ajouter `nombreInitial` et `poidsMoyenInitial` dans le `select` des deux fonctions (`getVagueById` et `getVagueByIdWithReleves`), dans les deux branches de l'union. Supprimer les casts forcés `as Bac[]`.

**Leçon / Règle :**
- **Auditer les consommateurs avant de réduire un `select` Prisma.** Chaque champ absent du select est `undefined` au runtime — TypeScript ne le détecte pas si un cast forcé (`as Foo`, `as unknown as`) est présent.
- **Interdire les casts forcés sur les retours Prisma.** Préférer un type intermédiaire (`Pick<Bac, ...>`) aligné sur le select réel, pour que les champs manquants deviennent des erreurs de compilation.
- **Les helpers à fallback silencieux cachent des bugs upstream.** Un helper qui remplace un champ `undefined` par une valeur par défaut doit au moins émettre un `console.warn` en dev, ou être strict (throw) si le champ est requis pour l'exactitude du calcul.
- **Quand deux chemins calculent la même valeur et divergent en production**, chercher d'abord un `select` mismatch entre les deux requêtes Prisma correspondantes.

**Références :** [BUG-044](../bugs/BUG-044.md)

---

### ERR-094 — Context state perdu dans un discriminated union form : `lotAlevinsId` invisible hors du cas TRI
**Sprint :** Bugfixing | **Date :** 2026-05-03
**Sévérité :** Haute
**Fichier(s) :**
- `src/components/releves/releve-form-client.tsx`

**Symptôme :**
Le formulaire `/releves/nouveau` refuse de valider pour les types BIOMETRIE, MORTALITE, etc. quand il est ouvert depuis un lot d'alevins (lotAlevinsId présent dans l'URL). Le champ `lotAlevinsId` n'est jamais envoyé au backend — seul le cas `TRI` fonctionnait.

**Cause racine :**
`lotAlevinsId` était placé dans la variante `TRI` du discriminated union `TypedFormFields`. La factory `getEmptyFields(type)` est appelée à chaque changement de type, ce qui réinitialise l'intégralité du state typé — y compris le contexte de navigation (d'où vient l'utilisateur). Le backend supportait déjà `lotAlevinsId` pour tous les types (relation XOR, vagueId/bacId nullable), mais l'UI n'exposait jamais ce champ en dehors de TRI.

**Fix :**
Sortir `lotAlevinsId` du discriminated union et le placer dans un `useState` séparé (state de contexte). Remplacer la condition `isTriWithLot` (type ET contexte) par `isLotMode = Boolean(lotAlevinsId)` (contexte seul). Passer `lotAlevinsId` dans le DTO indépendamment du type.

**Leçon / Règle :**
- **Discriminated unions = shape de données, pas contexte.** Le contexte (qui est l'utilisateur, depuis quelle entité la navigation arrive) doit vivre dans un `useState` ou prop séparé. Le placer dans une variante du union garantit sa perte à chaque changement de variante.
- **`getEmptyFields(type)` ne doit toucher que les champs propres au type.** Tous les champs cross-type (identifiants de contexte, mode de navigation) doivent rester en dehors de cette factory.
- **Quand le backend supporte une relation pour N types mais l'UI ne l'expose que pour un seul**, c'est le signal que la condition UI est trop spécialisée. Dériver depuis le contexte (`Boolean(lotAlevinsId)`), pas depuis la variante du type discriminé.
- **Une condition `typeX ET contexteY` dans le code est presque toujours réductible à `contexteY` seul.** Se demander : ce comportement est-il vraiment lié au type, ou seulement au contexte ?

**Références :** [BUG-046](../bugs/BUG-046.md)

---

### ERR-089 — Lecture dual-source en mode tout-ou-rien (ADR-043 Bac/AssignationBac)
**Sprint :** Bugfixing | **Date :** 2026-04-19
**Sévérité :** Haute
**Fichier(s) :**
- `src/app/api/bacs/route.ts`
- `src/lib/queries/vagues.ts`
- `src/lib/queries/calibrages.ts`

**Symptôme :**
Des bacs apparaissent dans le formulaire de calibrage mais sont absents de la liste de sélection du formulaire de relevé pour la même vague — et inversement. Le symptôme est asymétrique selon l'écran car chaque endpoint lit la relation bac↔vague depuis une source primaire différente.

**Cause racine :**
ADR-043 duplique la relation bac↔vague entre une FK directe (`Bac.vagueId`) et une table associative (`AssignationBac`). Deux endpoints lisaient ces deux sources selon un pattern fallback :

```ts
// ANTI-PATTERN : fallback tout-ou-rien — NE PAS FAIRE
const fromAssignations = await prisma.assignationBac.findMany({ where: { vagueId, dateFin: null } });
if (fromAssignations.length > 0) {
  return fromAssignations.map(a => a.bac); // bacs présents UNIQUEMENT via Bac.vagueId silencieusement masqués
} else {
  return await prisma.bac.findMany({ where: { vagueId } }); // fallback jamais déclenché si 1+ assignation existe
}
```

Quand un bac est présent dans une seule source (état incohérent fréquent après calibrage), il est masqué par l'endpoint qui ne consulte pas cette source.

**Fix :**
UNION des deux sources déduplicée par Map :

```ts
// PATTERN CORRECT : UNION déduplicée
const [fromVagueId, fromAssignations] = await Promise.all([
  prisma.bac.findMany({ where: { vagueId, siteId } }),
  prisma.assignationBac.findMany({ where: { vagueId, dateFin: null, siteId }, include: { bac: true } }),
]);
const map = new Map<string, Bac>();
fromVagueId.forEach(b => map.set(b.id, b));
fromAssignations.forEach(a => map.set(a.bac.id, a.bac));
return [...map.values()].sort((a, b) => a.nom.localeCompare(b.nom));
```

**Leçon / Règle :**
Quand une relation est stockée dans deux sources parallèles (FK directe + table associative, cache + DB, etc.), **toute lecture doit UNION les deux sources** et dédupliquer. Un fallback `if (primary.length > 0) return primary` est toujours faux : il masque silencieusement les entités présentes uniquement dans la source secondaire. Appliquer systématiquement le pattern UNION dès l'introduction d'une table associative en parallèle d'une FK existante.

Réserves de suivi ouvertes après fix : aligner la priorité UNION entre `/api/bacs?vagueId` et `getVagueById` (revue : incohérence non bloquante), appliquer clause `OR` d'appartenance à `patchCalibrage` (étape 5 non corrigée).

**Références :** [BUG-040](../bugs/BUG-040.md) | [ADR-043](../decisions/ADR-043-bac-vague-associative-model.md)

---

### ERR-088 — Migration de permissions : fichiers de labels UI absents du scope ADR
**Sprint :** ADR-045 | **Date :** 2026-04-07
**Sévérité :** Moyenne
**Fichier(s) :** `src/lib/role-form-labels.ts`

**Symptôme :**
L'ADR-045 liste les fichiers à modifier pour la migration des permissions. `src/lib/role-form-labels.ts` n'y figure pas. Après implémentation, les 9 nouvelles permissions (`GENITEURS_VOIR`, `GENITEURS_GERER`, `PONTES_VOIR`, etc.) n'ont pas de labels lisibles dans le formulaire de gestion des rôles — les clés brutes d'enum s'affichent à la place.

**Cause racine :**
Lors de la rédaction de l'ADR, le fichier `role-form-labels.ts` n'a pas été identifié dans la recherche de dépendances. Ce fichier contient des libellés UI pour chaque valeur de l'enum `Permission` et doit être mis à jour chaque fois que des permissions sont ajoutées.

**Fix :**
Ajouter les labels UI pour chaque nouvelle valeur de permission dans `src/lib/role-form-labels.ts` (section correspondante au groupe concerné). La pré-analyse ADR-045 a détecté ce fichier et l'a ajouté au scope d'implémentation.

**Leçon / Règle :**
Lors de toute migration ou extension de l'enum `Permission`, toujours inclure `src/lib/role-form-labels.ts` dans le scope. Plus généralement : quand on ajoute des valeurs à un enum métier, grep systématiquement `role-form-labels`, `permissions-constants`, et tout fichier `*-labels*` ou `*-constants*` pour détecter les fichiers de mapping qui nécessitent une mise à jour manuelle.

---

### ERR-087 — src/types/models.ts : enum TypeScript manuel, non auto-généré depuis Prisma
**Sprint :** ADR-045 | **Date :** 2026-04-07
**Sévérité :** Haute
**Fichier(s) :** `src/types/models.ts`

**Symptôme :**
Un ADR indique "aucune modification manuelle de `src/types/models.ts` nécessaire si le type est re-exporté depuis le client Prisma généré". En réalité, les types dans ce fichier sont des enums TypeScript maintenus à la main — ils ne sont pas auto-générés. Résultat : après une migration Prisma, les nouvelles valeurs d'enum sont dans le client Prisma mais absentes de `src/types/models.ts`. Les composants qui importent depuis `@/types` voient des types incomplets, causant des erreurs TypeScript silencieuses ou des `as any` compensatoires.

**Cause racine :**
Ce projet maintient ses types dans `src/types/models.ts` manuellement, en parallèle du client Prisma généré. Cette décision d'architecture (Phase 1) n'était pas documentée dans les ADR ultérieures, causant des hypothèses fausses sur le comportement d'auto-synchronisation.

**Fix :**
Après chaque migration Prisma qui ajoute ou modifie un enum, mettre à jour manuellement les enums correspondants dans `src/types/models.ts`. Il n'y a pas d'auto-synchronisation dans ce projet.

**Leçon / Règle :**
`src/types/models.ts` dans ce projet est la source de vérité TypeScript, maintenu manuellement. Toute migration de schéma Prisma qui touche un enum DOIT aussi mettre à jour `src/types/models.ts`. Ne jamais présumer d'une auto-synchronisation — vérifier systématiquement les deux fichiers.

---

### ERR-086 — Route migration : code mort `isActive` laissé derrière après changement de chemin
**Sprint :** ADR-045 | **Date :** 2026-04-07
**Sévérité :** Basse
**Fichier(s) :** `src/components/layout/farm-sidebar.tsx`, `src/components/layout/farm-bottom-nav.tsx`

**Symptôme :**
Après la migration des routes `/alevins/*` vers `/reproduction/*`, la logique `isActive` dans la sidebar contenait encore `href === "/alevins"` comme condition de détection de route active. Ce code mort n'a aucun effet fonctionnel (la route `/alevins` redirige vers `/reproduction`) mais pollue le code et peut induire en erreur lors d'une prochaine modification.

**Cause racine :**
La migration de routes a mis à jour les `href` dans les items de navigation, mais n'a pas nettoyé les vérifications d'état actif (`isActive`) qui référencent les anciens chemins. La logique `isActive` est souvent dans une zone séparée du fichier, facilement oubliée lors d'un remplacement ciblé.

**Fix :**
Lors d'un remplacement de route, rechercher toutes les occurrences de l'ancien chemin dans le fichier (pas seulement dans les propriétés `href`) : `isActive`, `includes()`, `startsWith()`, commentaires, tests.

**Leçon / Règle :**
Quand une route est renommée ou déplacée, grep l'ancien chemin dans TOUS les composants de navigation (sidebar, bottom-nav, breadcrumb) et corriger chaque occurrence : `href`, `isActive`, `includes`, `startsWith`, constantes de chemin, et commentaires. Un remplacement partiel laisse du code mort difficile à détecter.

---

### ERR-085 — Commentaires JSDoc non mis à jour lors d'une migration de permissions
**Sprint :** ADR-045 | **Date :** 2026-04-07
**Sévérité :** Basse
**Fichier(s) :** `src/app/api/reproduction/pontes/[id]/resultat/route.ts`, `src/app/api/reproduction/pontes/[id]/stripping/route.ts`, `src/app/api/reproduction/pontes/[id]/echec/route.ts`

**Symptôme :**
Après la migration de `ALEVINS_MODIFIER` → `PONTES_GERER` dans le code runtime des routes, les commentaires JSDoc au-dessus des fonctions mentionnaient encore l'ancienne permission (`@requires ALEVINS_MODIFIER`). La permission effective est correcte à l'exécution, mais la documentation interne est trompeuse.

**Cause racine :**
Le remplacement de permissions a ciblé les appels `requirePermission()` dans le corps des fonctions, sans passer en revue les commentaires JSDoc environnants. Les outils de remplacement (find/replace, grep) ne cherchent généralement pas dans les blocs de commentaires lors d'une migration de code.

**Fix :**
Mettre à jour les commentaires JSDoc dans les 3 routes pontes pour référencer `PONTES_GERER` à la place de `ALEVINS_MODIFIER`.

**Leçon / Règle :**
Lors d'une migration de permissions, le grep de remplacement doit cibler AUSSI les commentaires — pas uniquement le code runtime. Après tout remplacement de `requirePermission()`, relire les blocs JSDoc ou commentaires environnants dans chaque fichier modifié. La checklist de review doit inclure : "les commentaires JSDoc reflètent-ils les permissions actuelles ?"

---

### ERR-084 — Sous-estimation du scope API dans un ADR : grep exhaustif obligatoire avant de chiffrer
**Sprint :** ADR-045 | **Date :** 2026-04-07
**Sévérité :** Haute
**Fichier(s) :** `src/app/api/reproduction/**`, `src/app/api/reproducteurs/**`, `src/app/api/pontes/**`, `src/app/api/lots-alevins/**`

**Symptôme :**
ADR-045 liste 3 fichiers API à modifier pour la migration des permissions reproduction. La pré-analyse révèle 22 fichiers avec 53 call sites `ALEVINS_*`. Les routes sous `/api/reproduction/` (créées dans les sprints R1–R5 postérieurement à la rédaction de l'ADR) n'ont pas été prises en compte. Un agent qui implémente sans re-grepper ne corrige que 3 fichiers sur 22, laissant 19 fichiers avec les anciennes permissions.

**Cause racine :**
L'ADR a été rédigé en listant les fichiers de mémoire (ou depuis un état antérieur du code). Les sprints R1–R5 ont ajouté de nombreuses routes sous `/api/reproduction/` qui utilisent toutes `ALEVINS_*` par défaut. Le scope ADR n'a pas été mis à jour après ces ajouts.

**Fix :**
Avant toute implémentation impliquant des permissions : lancer un grep exhaustif sur toutes les valeurs à remplacer, noter le nombre exact de fichiers et de call sites, et comparer au scope de l'ADR. Si un écart existe, l'agent implémenteur doit étendre le scope et en informer le PM.

```bash
# Exemple de grep de vérification avant implémentation
grep -r "ALEVINS_" src/app/api/ --include="*.ts" -l
grep -r "ALEVINS_" src/app/api/ --include="*.ts" -c | grep -v ":0"
```

**Leçon / Règle :**
Ne jamais implémenter une migration de permissions en se basant uniquement sur la liste de fichiers de l'ADR. Toujours lancer un grep exhaustif (code runtime + commentaires + tests + constantes + labels + seed) avant de commencer. L'ADR peut être obsolète si des fichiers ont été ajoutés après sa rédaction. Voir aussi ERR-088 pour les fichiers de labels oubliés.

---

### ERR-082 — console.log debug dans layout.tsx déclenché à chaque requête en production
**Sprint :** 54 | **Date :** 2026-04-07
**Sévérité :** Basse
**Fichier(s) :** `src/app/layout.tsx` lignes 119, 124

**Symptôme :**
Les logs `[RootLayout] START` et `SESSION` s'affichent dans les logs serveur en production à chaque rendu de la route racine, polluant les traces et consommant des ressources inutilement.

**Cause racine :**
Les `console.log` de débogage ont été ajoutés pendant le développement et n'ont pas été retirés ni conditionnés avant la mise en production. En Next.js App Router, `layout.tsx` est un Server Component exécuté côté serveur à chaque requête non-cachée.

**Fix :**
Supprimer les `console.log` de débogage, ou les conditionner explicitement :
```typescript
if (process.env.NODE_ENV !== "production") {
  console.log("[RootLayout] START");
}
```

**Leçon / Règle :**
Tout `console.log` dans un Server Component (layout, page, route handler) s'exécute côté serveur à chaque requête. Avant toute review ou merge, vérifier que les logs de débogage sont supprimés ou conditionnés par `process.env.NODE_ENV !== "production"`. La checklist de review doit inclure un grep sur `console.log` dans les fichiers layout.

---

### ERR-081 — Grain overlay avec z-index 9999 : risque de collision avec les modales
**Sprint :** 54 | **Date :** 2026-04-07
**Sévérité :** Basse
**Fichier(s) :** `src/app/globals.css` ligne 132

**Symptôme :**
L'overlay de texture grain utilise `z-index: 9999` avec `pointer-events: none`. Fonctionnel en l'état, mais toute modale ou popover utilisant un z-index inférieur à 9999 (ex. Radix Dialog par défaut à 50) sera visuellement recouvert par l'overlay.

**Cause racine :**
La valeur 9999 est choisie "pour être sûr d'être au-dessus de tout" sans considérer que des composants Radix UI ou des toasts peuvent aussi vouloir être au premier plan. Les overlays purement décoratifs n'ont pas besoin d'un z-index élevé.

**Fix :**
Utiliser un z-index bas (1 ou 2) pour les overlays décoratifs avec `pointer-events: none`. Les composants interactifs (Dialog, Sheet, Toast) utilisent des z-index élevés via leurs propres stacking contexts :
```css
.grain-overlay {
  z-index: 1;
  pointer-events: none;
}
```

**Leçon / Règle :**
Les overlays décoratifs (`pointer-events: none`) doivent avoir le z-index le plus bas possible — idéalement 1. Réserver les z-index élevés (50+) aux composants interactifs qui doivent couvrir le contenu (Dialog, Sheet, Toast, Tooltip). Ne jamais utiliser 9999 sauf pour un système de notification global explicitement conçu pour dominer tout le reste.

---

### ERR-080 — R6 : classes Tailwind directes `bg-emerald-500/15 text-emerald-600` dans Badge contournent le système de tokens
**Sprint :** 54 | **Date :** 2026-04-07
**Sévérité :** Basse
**Fichier(s) :** `src/components/ui/badge.tsx` ligne 11

**Symptôme :**
La variante `success` du composant Badge utilise des classes Tailwind directes (`bg-emerald-500/15 text-emerald-600`) au lieu des tokens CSS du thème (`--accent-emerald`, `--accent-emerald-muted`). En mode sombre ou lors d'un changement de palette, la couleur ne s'adapte pas.

**Cause racine :**
Violation de la règle R6 : les classes Tailwind de couleur brutes (`emerald-500`, `emerald-600`) sont des valeurs absolues non reliées au système de design tokens défini dans `globals.css`. Le composant Badge a été créé sans consulter les variables CSS disponibles.

**Fix :**
Remplacer les classes Tailwind directes par des références aux variables CSS du thème :
```tsx
// Au lieu de :
"bg-emerald-500/15 text-emerald-600"

// Utiliser :
"bg-[var(--accent-emerald-muted)] text-[var(--accent-emerald)]"
```

**Leçon / Règle :**
R6 s'applique aussi aux classes Tailwind de couleur — `bg-emerald-500` est aussi une couleur "en dur" que `#10b981`. Toujours vérifier `globals.css` pour les tokens disponibles (`--accent-*`, `--primary`, `--muted`, etc.) avant d'utiliser une classe Tailwind de couleur dans un composant UI partagé. Lors de la review, grep `bg-[a-z]+-[0-9]` et `text-[a-z]+-[0-9]` dans les composants UI pour détecter les violations R6.

---

### ERR-079 — R6 : `fill="white"` dans SVG/logo ne fonctionne pas en mode sombre
**Sprint :** 54 | **Date :** 2026-04-07
**Sévérité :** Basse
**Fichier(s) :** `src/components/silure-logo.tsx` ligne 43, `public/icons/silure.svg` ligne 21

**Symptôme :**
L'attribut `fill="white"` sur un élément SVG (oeil du silure) rend l'élément invisible en mode sombre si le fond du SVG devient aussi sombre. La couleur `white` est absolue et ne s'adapte pas au thème.

**Cause racine :**
Violation de la règle R6 : la valeur `"white"` est une couleur littérale non reliée au système de tokens CSS. En mode sombre, `--background` est une couleur sombre, et `fill="white"` crée un contraste inversé ou invisible selon le contexte de rendu.

**Fix :**
Remplacer `fill="white"` par `fill="var(--background)"` pour que la couleur de remplissage suive automatiquement le thème :
```tsx
// silure-logo.tsx
<circle cx="..." cy="..." r="..." fill="var(--background)" />
```
```xml
<!-- silure.svg -->
<circle cx="..." cy="..." r="..." fill="var(--background)" />
```

**Leçon / Règle :**
R6 s'applique aux attributs SVG inline (`fill`, `stroke`) autant qu'aux propriétés CSS. Ne jamais utiliser `fill="white"`, `fill="black"`, `fill="#fff"` ou toute couleur absolue dans un SVG embarqué. Utiliser `fill="currentColor"` pour hériter de la couleur de texte du parent, ou `fill="var(--background)"` / `fill="var(--foreground)"` pour les remplissages de fond. Vérifier les SVG inline lors de toute review R6.

---

### ERR-076 — tendanceFCR : query Prisma sans `consommations` dans le select — fallback dual-source impossible
**Sprint :** ADR-043 | **Date :** 2026-04-06
**Sévérité :** Haute
**Fichier(s) :** `src/lib/queries/analytics.ts` lignes ~1162-1173

**Symptôme :**
La correction du calcul `totalAliment` (passage à un reducer hybrid `quantiteAliment ?? SUM(consommations)`) ne produit aucun effet : `consommations` est toujours vide même pour les relevés liés au stock. FCR reste 0 ou null pour les relevés stock-linked.

**Cause racine :**
Le select Prisma de la query `tendanceFCR` dans `getAnalyticsDashboard` ne listait pas `consommations` dans les champs à charger. Prisma n'inclut jamais les relations implicitement — sans `consommations: { select: { quantite: true } }`, le tableau est absent de l'objet retourné.

**Fix :**
Ajouter `consommations: { select: { quantite: true } }` dans le bloc `select` des relevés d'alimentation de la query `tendanceFCR`.

**Leçon / Règle :**
Quand on corrige un problème de source de données (legacy field → nouvelle relation), vérifier en premier que la query charge effectivement la nouvelle relation. Un reducer hybrid écrit correctement restera silencieusement no-op si Prisma ne sélectionne pas la relation. Toujours vérifier le `select` avant de déboguer la logique de calcul.

---

### ERR-075 — tendanceFCR : gain utilise la biomasse cumulée (toute la vague) au lieu de la biomasse sur le mois
**Sprint :** ADR-043 | **Date :** 2026-04-06
**Sévérité :** Haute
**Fichier(s) :** `src/lib/queries/analytics.ts` lignes ~1204-1207 (`getAnalyticsDashboard`)

**Symptôme :**
Le FCR mensuel affiché dans la courbe de tendance est incohérent d'un mois à l'autre. En début de vague les valeurs sont anormalement élevées ; tous les mois affichent sensiblement le même dénominateur (gain) même si la croissance mensuelle varie.

**Cause racine :**
`biomasseFin` et `biomasseDebut` étaient tous deux calculés depuis `vagueRef.nombreInitial * vagueRef.poidsMoyenInitial`, c'est-à-dire la biomasse au démarrage de la vague. Le "gain" résultant était donc le gain depuis le début de la vague (gain cumulé), identique quel que soit le mois. Diviser la nourriture mensuelle par le gain cumulé donne un FCR sans signification périodique.

**Fix :**
Utiliser la première et la dernière biométrie détectées dans le mois comme `biomasseDebut` et `biomasseFin`. Ajouter une garde : si le mois contient moins de 2 biométries, sauter ce mois plutôt que d'afficher une valeur fausse.

**Leçon / Règle :**
Pour tout indicateur périodique (mensuel, hebdomadaire), s'assurer que le numérateur ET le dénominateur sont tous deux scopés à la même période. Un numérateur mensuel divisé par un dénominateur cumulatif produit une métrique sans sens. Appliquer la règle : "même fenêtre temporelle pour les deux termes du ratio".

---

### ERR-074 — totalAliment à 0 pour les relevés stock-linked : `quantiteAliment` ignoré le champ legacy, `consommations` pas consulté
**Sprint :** ADR-043 | **Date :** 2026-04-06
**Sévérité :** Haute
**Fichier(s) :** `src/lib/queries/analytics.ts` ligne ~1332 (`getComparaisonVagues`)

**Symptôme :**
Dans `getComparaisonVagues`, le FCR d'une vague utilisant des relevés d'alimentation liés au stock (dual-write via `ReleveConsommation`) est 0 ou null. Le `totalAliment` calculé est 0 même si des enregistrements `ReleveConsommation` existent.

**Cause racine :**
Le reducer utilisait uniquement `r.quantiteAliment ?? 0`. Pour les relevés créés via le stock, `quantiteAliment` est null (le champ legacy n'est pas renseigné) ; la quantité réelle est stockée dans la relation `ReleveConsommation`. Le reducer ignorait complètement cette relation, rendant le numérateur FCR nul.

**Fix :**
Remplacer le reducer simple par un reducer hybrid :
```typescript
alimentations.reduce((s, r) => {
  if (r.quantiteAliment != null) return s + r.quantiteAliment;
  const fromConso = r.consommations?.reduce((sc, c) => sc + c.quantite, 0) ?? 0;
  return s + fromConso;
}, 0)
```

**Leçon / Règle :**
Le système gère deux chemins d'écriture pour la quantité d'aliment : (1) `Releve.quantiteAliment` (champ legacy, relevé manuel) et (2) `ReleveConsommation.quantite` (dual-write via stock). Tout calcul impliquant la quantité d'aliment doit utiliser ce reducer hybrid. Ce pattern s'applique à au moins 5 autres fonctions : `computeIndicateursBac`, `getIndicateursVague`, `getDashboardProjections`, `getDashboardIndicateurs`, `detectFCRAlerte`. Voir aussi ERR-069 pour le pattern de conservation des quantités par période.

---

### ERR-073 — Dialog avec deux modes (lazy vs pre-loaded) : concevoir l'interface pour les deux contextes dès le départ
**Sprint :** ADR-036 intégration | **Date :** 2026-04-06
**Sévérité :** Basse
**Fichier(s) :** `src/components/analytics/fcr-transparency-dialog.tsx`

**Symptôme :**
`FCRTransparencyDialog` avait besoin des données `parVague: DetailAlimentVague[]` pour afficher le détail bac × période (ADR-036), mais la page liste `/analytics/aliments` ne charge que `ComparaisonAliments` — sans `parVague`. La page détail, elle, charge `getDetailAliment` qui inclut `parVague`. Sans anticipation, le dialog doit choisir entre enrichir la page liste (N appels coûteux) ou ne rien afficher.

**Cause racine :**
Le dialog était conçu pour un seul contexte d'usage (page détail). Quand il a été réutilisé depuis la page liste, les données disponibles étaient insuffisantes. L'interface de props n'anticipait pas deux niveaux de disponibilité des données.

**Fix :**
Interface à prop optionnelle couvrant les deux modes :
```typescript
interface FCRTransparencyDialogProps {
  produitId: string;
  produitNom: string;
  fcrMoyen: number | null;
  /** Pre-loaded per-vague data (from detail page). If absent, lazy-fetched from API. */
  parVague?: DetailAlimentVague[];
}
```
- Si `parVague` est fourni : rendu direct depuis `FCRByFeedContentFromParVague` (zéro fetch réseau).
- Si `parVague` est absent : `FCRByFeedContentLazy` fait un fetch vers `/api/analytics/aliments/[produitId]/fcr-by-feed` au montage du dialog.

La route `fcr-by-feed` a été créée pour couvrir le mode lazy. Le mode lazy est le fallback universel.

**Leçon / Règle :**
Quand un dialog peut être invoqué depuis des contextes avec des disponibilités de données différentes (page détail avec pré-chargement vs page liste avec données partielles), concevoir dès le départ une interface à mode optionnel. Le mode lazy nécessite une route API dédiée — la créer en même temps que le composant, pas après. Éviter de créer deux composants distincts pour les deux contextes : un seul composant avec une prop optionnelle est plus maintenable.

---

### ERR-072 — Types code mort dans le barrel export après remplacement d'un algorithme
**Sprint :** ADR-036 intégration | **Date :** 2026-04-06
**Sévérité :** Basse
**Fichier(s) :** `src/types/calculs.ts`, `src/types/index.ts`

**Symptôme :**
Après la migration vers ADR-036, les types `FCRTrace`, `FCRTraceVague`, `FCRTracePeriode`, `FCRTraceGompertzParams` et leurs sous-types (7 types au total) sont devenus code mort. `getFCRTrace` et la route `fcr-trace` ont été supprimés, `FCRTransparencyDialog` a été réécrit. Mais ces types restaient dans `src/types/index.ts` et exportés publiquement. Un agent consultant le barrel export croyait que ces types étaient en usage actif.

**Cause racine :**
Quand un algorithme est remplacé, on supprime le code (fonctions, routes, composants) mais on oublie de supprimer les types du barrel export. TypeScript ne signale pas d'erreur si un type exporté n'est pas utilisé — contrairement à une variable ou une fonction. Les types morts dans un barrel sont invisibles au compilateur.

**Fix :**
Après suppression de `getFCRTrace` et de la route, retirer les types `FCRTrace*` de `src/types/calculs.ts` et leurs re-exports de `src/types/index.ts`. Vérifier avec `grep -r "FCRTrace"` qu'aucun import résiduel ne subsiste avant de supprimer les définitions.

**Leçon / Règle :**
Quand un algorithme ou une feature est supprimé, procéder dans l'ordre inverse des dépendances : (1) supprimer les consommateurs, (2) supprimer les fonctions, (3) supprimer les types du fichier de définition, (4) retirer les re-exports du barrel `index.ts`. L'étape 4 est systématiquement oubliée. Utiliser `grep -r "TypeSupprime"` pour confirmer l'absence de tout import résiduel. Les types morts dans un barrel sont une forme de dette documentaire qui induit en erreur les futurs agents.

---

### ERR-071 — `saisonFilter` avec mapping mois → saison : dépendance géographique Cameroun non documentée
**Sprint :** ADR-036 intégration | **Date :** 2026-04-06
**Sévérité :** Moyenne
**Fichier(s) :** `src/lib/queries/fcr-by-feed.ts` (`dateMatchesSaison`), `src/types/fcr-by-feed.ts`

**Symptôme :**
La feature FD.3 (filtrage des consommations par saison sèche/pluies) applique un mapping mois → saison codé en dur. La constante `MOIS_SECHE = new Set([11, 12, 1, 2, 3])` correspond aux mois secs au Cameroun. Pour un autre pays de la zone tropicale (ex. Sénégal : saison sèche = nov–mai), ce mapping est silencieusement faux.

**Cause racine :**
La pré-analyse avait identifié que `saisonFilter` n'existait pas dans `FCRByFeedParams`. L'ajout a été fait directement dans `fcr-by-feed.ts` sans créer une couche de configuration géographique. Le mapping de mois est une constante hardcodée non marquée comme site-specific.

**Fix :**
Commenter explicitement l'origine géographique :
```typescript
/** Mois (1-12) de la saison seche au Cameroun : novembre, decembre, janvier, fevrier, mars */
const MOIS_SECHE = new Set([11, 12, 1, 2, 3]);
```
Si l'application s'étend à d'autres pays, externaliser cette constante dans `ConfigElevage` ou `Site`.

**Leçon / Règle :**
Tout mapping de dates vers des catégories climatiques, fiscales ou agricoles doit être : (1) documenté avec le pays/région d'origine dans le commentaire, (2) isolé dans une constante nommée (jamais inline dans la condition), (3) marqué "site-specific" si l'application est multi-pays. Pour ce projet : `MOIS_SECHE` est Cameroun-spécifique et devra être externalisé si DKFarm s'étend à d'autres pays.

---

### ERR-070 — Wrapper sur grande fonction : les champs secondaires peuvent être oubliés si aucun mapping exhaustif n'est établi
**Sprint :** ADR-036 intégration | **Date :** 2026-04-06
**Sévérité :** Haute
**Fichier(s) :** `src/lib/queries/analytics.ts` (`computeAlimentMetrics`)

**Symptôme :**
Quand on remplace le corps de `computeAlimentMetrics` par un wrapper délégant à `getFCRByFeed`, l'attention se concentre sur le champ principal (FCR). Les champs secondaires — SGR, ADG, PER, taux de survie, score qualité — sont calculés par des fonctions distinctes (`calculerSGR`, `calculerADG`, `calculerPER`, `calculerTauxSurvie`) qui ont besoin des relevés biométriques et de mortalité. Ces données ne sont pas retournées par `getFCRByFeed`. Sans mapping exhaustif, ces champs peuvent être retournés `null` sans erreur de compilation.

**Cause racine :**
`getFCRByFeed` ne couvre que les métriques alimentaires (FCR, quantité consommée, gain biomasse). Les métriques de croissance et de survie doivent être recalculées dans le wrapper à partir de queries séparées sur les relevés. Si l'auteur ne consulte pas le type complet `AnalytiqueAliment`, il manque les champs qui ne viennent pas de `getFCRByFeed`.

**Fix :**
Avant d'écrire le wrapper, établir un mapping complet de TOUS les champs du type retourné :

| Champ `AnalytiqueAliment` | Source | Transformation dans le wrapper |
|---------------------------|--------|---------------------------------|
| `fcrMoyen` | `FCRByFeedResult.fcrGlobal` | Direct |
| `quantiteTotale` | `FCRByFeedResult.totalAlimentKg` | Direct |
| `coutTotal` | `totalAlimentKg × prixUnitaire` | Calcul identique |
| `nombreVagues` | `nombreVaguesIncluses + nombreVaguesIgnorees` | Somme |
| `sgrMoyen` | Calculé via `calculerSGR()` sur biométries | Query séparée requise |
| `tauxSurvieAssocie` | Calculé via mortalités vague | Query séparée requise |
| `adgMoyen` | Calculé via `calculerADG()` | Query séparée requise |
| `perMoyen` | Calculé via `calculerPER()` | Query séparée requise |
| `scoreQualite` | `calculerScoreAliment(fcrMoyen, sgrMoyen, ...)` | Recalculé après SGR |

Le wrapper fait une query séparée des relevés biométriques/mortalités pour les vagues identifiées par `getFCRByFeed`.

**Leçon / Règle :**
Avant de remplacer une grande fonction par un wrapper délégant, lister TOUS les champs du type retourné et tracer explicitement l'origine de chacun dans la nouvelle implémentation. La pré-analyse doit produire ce mapping : toute case "Query séparée requise" indique du code supplémentaire à écrire dans le wrapper. Ne jamais supposer que la sous-fonction déléguée couvre tous les champs du type de sortie.

---

### ERR-067 — Tableau `sourceBacIds` : seul l'index 0 traité — les bacs 2, 3... invisibles
**Sprint :** ADR-036 | **Date :** 2026-04-06
**Sévérité :** Haute
**Fichier(s) :** `src/lib/queries/fcr-by-feed.ts`

**Symptôme :**
`sourceBacIds` est un champ de type `string[]` (tableau). Dans la logique de détection des "bacs vidés" lors d'un calibrage, seul `sourceBacIds[0]` est lu. Si un calibrage implique 2 ou 3 bacs sources, seul le premier bac est détecté comme "vidé" — les autres restent avec une population incorrecte, faussant le calcul FCR de leurs périodes post-calibrage.

**Cause racine :**
L'implémenteur a supposé qu'un calibrage n'implique qu'un seul bac source et a accédé à l'index 0 directement. La structure de données (`sourceBacIds: string[]`) indique explicitement qu'un calibrage peut avoir plusieurs sources.

**Fix :**
```typescript
// Avant (incomplet) :
const isVideSource = calibrage.sourceBacIds[0] === bacId;

// Après (correct) :
const isVideSource = calibrage.sourceBacIds.includes(bacId);
```
Et lors du mapping vers un type intermédiaire, produire une entrée par bac source :
```typescript
const calibragesExpanded = rawCalibrages.flatMap(c =>
  c.sourceBacIds.map(sourceId => ({ ...c, bacSourceId: sourceId }))
);
```

**Leçon / Règle :**
Quand un champ est un tableau (`string[]`, `number[]`, etc.), toujours traiter TOUS ses éléments. Accéder à l'index 0 d'un tableau est un anti-pattern sauf si le tableau est garanti de longueur 1 par le schéma. Lors de la review, tout accès `array[0]` sur un champ dont le type est `T[]` doit être justifié ou remplacé par une itération.

---

### ERR-066 — `as any` pour adapter un type intermédiaire au lieu de créer le bon type
**Sprint :** ADR-036 | **Date :** 2026-04-06
**Sévérité :** Haute
**Fichier(s) :** `src/lib/queries/fcr-by-feed.ts`

**Symptôme :**
`as any[]` est utilisé pour passer un tableau de `CalibrageWithSource` à la fonction `estimerPopulationBac`. Double `as any` dans la même fonction. TypeScript ne signale aucune erreur mais la sécurité de type est perdue — une incohérence de structure sera silencieuse au runtime.

**Cause racine :**
La query Prisma retourne un type inféré qui ne correspond pas exactement au type attendu par la fonction destination. Plutôt que de créer un type intermédiaire précis et de mapper correctement, le cast `as any` court-circuite TypeScript.

**Fix :**
Définir un type intermédiaire explicite et mapper les données :
```typescript
// Avant (dangereux) :
estimerPopulationBac(..., calibrages as any[], ...);

// Après (sûr) :
interface CalibrageForEstimation { date: Date; bacSourceId: string; bacDestId: string; nombreTransfere: number; }
const calibragesFormatted: CalibrageForEstimation[] = rawCalibrages.flatMap(c =>
  c.sourceBacIds.map(sourceId => ({ date: c.date, bacSourceId: sourceId, bacDestId: c.bacDestId, nombreTransfere: c.nombreTransfere }))
);
estimerPopulationBac(..., calibragesFormatted, ...);
```

**Leçon / Règle :**
Un `as any` ou `as any[]` dans une query Prisma est toujours le symptôme d'un type intermédiaire manquant. La solution correcte est : (1) définir le type de destination, (2) mapper explicitement. La review doit refuser tout `as any` dans les fichiers de query.

---

### ERR-065 — R2 : string literals TypeReleve dans les queries Prisma au lieu de l'enum
**Sprint :** ADR-036 | **Date :** 2026-04-06
**Sévérité :** Haute
**Fichier(s) :** `src/lib/queries/fcr-by-feed.ts`

**Symptôme :**
Les filtres Prisma utilisent des strings en dur : `typeReleve: "BIOMETRIE"`, `typeReleve: "COMPTAGE"`, `typeReleve: "MORTALITE"`. Aucune erreur TypeScript à la compilation car Prisma accepte les strings compatibles avec l'enum, mais la règle R2 est violée.

**Cause racine :**
Le développeur a écrit les filtres de query directement avec les valeurs string au lieu d'importer `TypeReleve` depuis `@/types`. Ce pattern est fréquent dans les nouvelles queries car les strings "semblent" fonctionner.

**Fix :**
```typescript
// Avant (violation R2) :
where: { typeReleve: "BIOMETRIE", siteId }

// Après (R2 respectée) :
import { TypeReleve } from "@/types";
where: { typeReleve: TypeReleve.BIOMETRIE, siteId }
```

**Leçon / Règle :**
Toujours importer et utiliser les enums TypeScript dans les filtres Prisma. Ne jamais passer une string en dur — même si TypeScript ne proteste pas, cela viole R2 et rend les refactorings d'enum silencieusement cassants. Voir aussi ERR-020 (pattern identique sur `TypeReleve.MORTALITE`).

---

### ERR-063 — Route export PDF utilise `vague.releves` non listée dans le scope ADR : régression silencieuse
**Sprint :** ADR-038 | **Date :** 2026-04-06
**Sévérité :** Haute
**Fichier(s) :** `src/app/api/export/vague/[id]/route.ts`, `src/lib/queries/vagues.ts`

**Symptôme :**
Après que `getVagueById()` a été modifiée pour ne plus inclure les relevés (split ADR-038 Partie A), la route `GET /api/export/vague/[id]` continuait d'accéder à `vague.releves` — un champ désormais absent du type de retour. TypeScript n'avait pas détecté l'erreur car le type de retour de `getVagueById()` était inféré, non annoté explicitement. L'export PDF vague aurait produit une erreur runtime en production.

**Cause racine :**
L'ADR-038 listait la route export comme "surface exclue de la pagination" (tableau "Surfaces exclues") — donc non modifiée en apparence. Mais la modification de `getVagueById()` (retrait de l'include relevés) impactait implicitement tous les appelants qui accédaient à `vague.releves`. La route export n'était pas dans le tableau "Impact sur les fichiers" de l'ADR, ce qui a conduit à l'omettre. Le type de retour inféré de la fonction (non annoté `Promise<VagueWithBacs | null>`) n'a pas provoqué d'erreur de compilation car TypeScript ne peut pas signaler l'accès à un champ absent sur un type inféré silencieusement changé.

**Fix :**
1. Annoter explicitement le type de retour de `getVagueById()` en `Promise<VagueWithBacs | null>` — cela fait apparaître l'erreur TypeScript dans tous les appelants qui accèdent à `vague.releves`.
2. Migrer `src/app/api/export/vague/[id]/route.ts` pour charger les relevés séparément : `prisma.releve.findMany({ where: { vagueId: id, siteId } })` — en même temps que l'étape 2 de l'ADR (queries), pas après.

**Leçon / Règle :**
Quand une query est modifiée pour supprimer un champ de son include, annoter immédiatement son type de retour explicitement. Tous les appelants qui accédaient au champ supprimé doivent être auditables via `grep -r "fonctionModifiee" src/`. Un tableau "surfaces exclues" dans un ADR ne suffit pas — chaque exclusion doit être vérifiée contre la liste des appelants pour confirmer qu'elle ne dépend pas du champ retiré.

---

### ERR-062 — Wrapper App Router re-export sans props bloquant la transmission de `searchParams`
**Sprint :** ADR-038 | **Date :** 2026-04-06
**Sévérité :** Moyenne
**Fichier(s) :** `src/app/(farm)/vagues/[id]/releves/page.tsx`, `src/components/pages/vague-releves-page.tsx`

**Symptôme :**
La page `/vagues/[id]/releves` était implémentée comme un re-export simple du composant `VagueRelevesPage` (`export { default } from "@/components/pages/vague-releves-page"`). Quand l'ADR-038 a ajouté la pagination URL (lecture de `searchParams.offset`), le composant ne recevait pas `searchParams` — il n'était pas un Page component App Router et le wrapper ne les transmettait pas. La pagination ne fonctionnait pas : l'offset était toujours 0 quel que soit l'URL.

**Cause racine :**
En Next.js App Router, `searchParams` est uniquement disponible dans les composants qui sont des fichiers Page (`app/.../page.tsx`). Un composant importé depuis `components/` n'y a pas accès directement via les props App Router — il doit les recevoir explicitement depuis le wrapper.

**Fix :**
Modifier le wrapper `src/app/(farm)/vagues/[id]/releves/page.tsx` pour accepter `searchParams` en props et les transmettre au composant :
```typescript
// Avant : re-export simple sans props
export { default } from "@/components/pages/vague-releves-page";

// Après : wrapper explicite avec transmission de searchParams
export default async function Page({ searchParams }: { searchParams: Record<string, string | string[]> }) {
  const { default: VagueRelevesPage } = await import("@/components/pages/vague-releves-page");
  return <VagueRelevesPage searchParams={searchParams} />;
}
```

**Leçon / Règle :**
Un re-export simple (`export { default } from "..."`) est uniquement valide pour les wrappers qui n'ont pas besoin de transmettre des props App Router (`params`, `searchParams`). Dès qu'une page doit lire `searchParams` ou `params` depuis l'URL, le wrapper doit être un composant async explicite qui reçoit ces props et les transmet au composant enfant. La pré-analyse doit vérifier si les wrappers existants sont des re-exports simples avant d'ajouter un besoin de `searchParams`.

---

### ERR-058 — Composant extrait non retiré de la source d'origine (copie fantôme)
**Sprint :** ADR-034 | **Date :** 2026-04-06
**Sévérité :** Moyenne
**Fichier(s) :** `src/components/vagues/releves-list.tsx`, `src/components/releves/releve-details.tsx`

**Symptôme :**
Après extraction de `ReleveDetails` vers `src/components/releves/releve-details.tsx` pour le partage entre `releves-list.tsx` et la nouvelle `RelevesGlobalList`, la définition locale du composant restait dans `releves-list.tsx`. Deux définitions identiques coexistaient — l'une partagée, l'autre orpheline. L'import `memo` de React était également importé inutilement dans `releves-list.tsx` alors que le seul usage de `memo` était la définition locale devenue redondante.

**Cause racine :**
L'étape d'extraction d'un composant comprend deux actions : créer le nouveau fichier partagé ET supprimer la définition locale d'origine. La seconde action a été omise — l'implémenteur s'est concentré sur la création du fichier cible sans supprimer la source.

**Fix :**
Remplacer la définition locale de `ReleveDetails` dans `releves-list.tsx` par un import depuis `@/components/releves/releve-details.tsx`. Retirer `memo` des imports React si c'était son seul usage.

**Leçon / Règle :**
Toute extraction de composant est une opération en deux étapes atomiques : (1) créer le fichier partagé, (2) supprimer la définition locale et la remplacer par un import. La review et les tests doivent vérifier l'absence de copie fantôme avec `grep -r "ComponentName" src/` sur le nom du composant extrait. Si le nom apparaît dans plus d'un fichier de définition, l'extraction est incomplète.

---

### ERR-057 — API endpoint manquant un paramètre de filtre requis par une feature en cours
**Sprint :** ADR-034 | **Date :** 2026-04-06
**Sévérité :** Haute
**Fichier(s) :** `src/app/api/bacs/route.ts`, `src/lib/queries/bacs.ts`

**Symptôme :**
La page `/releves` avec filtrage avancé devait proposer un sélecteur de bac dynamique : quand une vague est sélectionnée dans les filtres, seuls les bacs de cette vague sont listés. Cela nécessite `GET /api/bacs?vagueId=...`. La route existante ignorait ce paramètre — seul `?libre=true` était géré — ce qui rendait le sélecteur non fonctionnel (listait tous les bacs du site au lieu de ceux de la vague choisie).

**Cause racine :**
L'endpoint `/api/bacs` avait été créé pour un besoin différent (libérer un bac ou assigner une vague). Le besoin de filtrer les bacs par vague n'était apparu que plus tard, lors de la conception du filtrage global des relevés. La route n'avait jamais été étendue pour ce cas d'usage.

**Fix :**
Ajouter la lecture du paramètre `vagueId` dans `route.ts` et étendre `getBacs()` dans `queries/bacs.ts` avec un filtre optionnel `vagueId` : `prisma.bac.findMany({ where: { siteId, ...(vagueId ? { vagueId } : {}) } })`.

**Leçon / Règle :**
Lors de la pré-analyse d'une feature qui consomme des données d'endpoints existants, vérifier explicitement que chaque paramètre de filtre nécessaire est exposé dans la route. Ne pas supposer qu'un endpoint couvre tous les cas de filtrage futurs parce qu'il couvre le cas d'usage initial. Documenter dans l'ADR les extensions d'API requises comme des dépendances bloquantes (D-n) à traiter en priorité.

---

### ERR-056 — Composant UI supposé présent mais absent — bloquant détecté en pré-analyse
**Sprint :** ADR-034 | **Date :** 2026-04-06
**Sévérité :** Moyenne
**Fichier(s) :** `src/components/ui/switch.tsx`, `package.json`

**Symptôme :**
Le wireframe de `RelevesFilterSheet` utilisait un Radix Switch pour le toggle "Relevés modifiés seulement". Ni `src/components/ui/switch.tsx` ni le paquet `@radix-ui/react-switch` n'étaient présents dans le projet. L'implémentation aurait échoué à l'import si la pré-analyse n'avait pas détecté l'absence avant le développement.

**Cause racine :**
L'ADR a été rédigé en supposant la présence d'un composant Switch (présent dans d'autres projets Radix UI standard) sans vérifier son existence réelle dans `src/components/ui/`. La bibliothèque Radix UI est modulaire — chaque composant est une dépendance séparée et doit être installé explicitement.

**Fix :**
La pré-analyse a proposé deux options : installer `@radix-ui/react-switch` ou utiliser une checkbox native (`input type="checkbox"`) stylée Tailwind. La solution retenue a été la checkbox native — pas de nouvelle dépendance, cohérente avec les inputs natifs déjà utilisés pour les dates dans les filtres.

**Leçon / Règle :**
Avant de référencer un composant UI dans un ADR ou une story, vérifier son existence dans `src/components/ui/` ET sa dépendance dans `package.json`. Pour Radix UI en particulier : chaque primitive est un paquet npm distinct (`@radix-ui/react-switch`, `@radix-ui/react-checkbox`, etc.) — la présence d'un composant Radix ne garantit pas la présence d'un autre. La pré-analyse doit lister explicitement les composants requis et leur statut PRESENT/ABSENT.

---

### ERR-055 — Gompertz CLARIAS_DEFAULTS produit des poids absurdes sur vague non calibrée
**Sprint :** ADR-033 fix | **Date :** 2026-04-06
**Sévérité :** Haute
**Fichier(s) :** `src/lib/queries/analytics.ts`, `src/lib/feed-periods.ts`

**Symptôme :**
Sur une vague sans calibrage (`vague.gompertz === null`), le FCR calculé affiche des valeurs aberrantes : des périodes entières ont un gain négatif car le poids estimé au début de la période (43 g) est supérieur au poids estimé en fin de période (pourtant basé sur des biométries réelles de 100 g). Ces périodes à gain négatif sont exclues du calcul FCR, ce qui réduit artificiellement le nombre de périodes exploitables et biaise le résultat.

**Cause racine :**
Lors du passage à "Gompertz systématiquement" (ADR-034 initial), le contexte Gompertz était construit depuis `CLARIAS_DEFAULTS` (`W∞ = 1500 g`, `k = 0.018`, `ti = 95 jours`) quand `vague.gompertz` était absent. Ces paramètres génériques ne correspondent pas à l'élevage réel — ils produisent une courbe qui diverge massivement des mesures terrain (43 g prédit vs 100 g mesuré à J30). Le modèle était donc pire que l'interpolation linéaire pour les vagues non calibrées.

**Fix :**
Ne construire le contexte Gompertz que si un enregistrement calibré existe en base (`vague.gompertz !== null`). Quand `null`, laisser `gompertzCtx = undefined` afin que le système retombe en interpolation linéaire entre les points de biométrie réels :
```typescript
// Avant (incorrect — produit des poids absurdes) :
const gompertzCtx = vague.gompertz
  ? buildGompertzContext(vague.gompertz)
  : buildGompertzContext(CLARIAS_DEFAULTS); // diverge si non calibré

// Après (correct) :
const gompertzCtx = vague.gompertz
  ? buildGompertzContext(vague.gompertz)
  : undefined; // fallback vers interpolation linéaire
```

**Leçon / Règle :**
Les paramètres Gompertz génériques (`CLARIAS_DEFAULTS`) ne peuvent être utilisés comme fallback d'interpolation : ils représentent une population moyenne, pas la vague spécifique en cours d'élevage. Le Gompertz n'est valide que lorsqu'il est ajusté sur les données réelles de la vague (calibrage). Pour toute vague sans calibrage, l'interpolation linéaire entre biométries mesurées est toujours plus précise qu'un modèle générique. Utiliser `CLARIAS_DEFAULTS` dans un calcul de FCR est une source de biais systématique.

---

### ERR-054 — Type `PeriodeAlimentaireVague` créé avec `bacId` malgré la spec ADR
**Sprint :** ADR-033 discrepancies | **Date :** 2026-04-06
**Sévérité :** Moyenne
**Fichier(s) :** `src/types/calculs.ts`

**Symptôme :**
L'interface `PeriodeAlimentaireVague` — censée représenter une période d'alimentation au niveau vague (sans distinction par bac) — contient un champ `bacId: string`. Les fonctions qui consomment ce type peuvent alors filtrer ou grouper par bac, réintroduisant exactement le comportement per-bac que l'ADR cherchait à éliminer. La pré-analyse détecte cette incohérence avant que des bugs ne soient causés en production.

**Cause racine :**
L'interface a été créée lors d'un premier pass d'implémentation ADR-033 en copiant la structure de `PeriodeAlimentaire` (per-bac) sans supprimer le champ `bacId`. La spec ADR-033 §3.1 stipule explicitement que `PeriodeAlimentaireVague` n'a pas de `bacId` — mais le développeur n'a pas relu la spec au moment de créer l'interface. Le champ en trop est passé inaperçu car aucun consommateur immédiat ne testait son absence.

**Fix :**
Supprimer `bacId` de `PeriodeAlimentaireVague` dans `src/types/calculs.ts`. Vérifier à la compilation que les fonctions produisant ce type ne tentent plus de le remplir, et que les consommateurs ne l'utilisent pas.

**Leçon / Règle :**
Quand on crée un nouveau type en "clonant" un type existant, relire la spec ADR pour identifier les champs à ne PAS inclure — pas seulement ceux à ajouter. Appliquer un diff mental systématique : Nouveau type = Ancien type − {champs supprimés par la spec} + {champs ajoutés par la spec}. Un champ hérité par inadvertance dans un type "vague-level" qui ne devrait pas avoir de clé d'entité peut être détecté par la pré-analyse avant tout merge.

---

### ERR-053 — Commentaire ADR "fix appliqué" sur du code per-bac non corrigé
**Sprint :** ADR-033 discrepancies | **Date :** 2026-04-06
**Sévérité :** Haute
**Fichier(s) :** `src/lib/feed-periods.ts`, `src/lib/queries/analytics.ts`

**Symptôme :**
Le commentaire dans `segmenterPeriodesAlimentaires` indique "Weight estimation uses the VAGUE-LEVEL Gompertz curve via `interpolerPoidsVague` (ALL biometries, NOT filtered by bacId)" — ce qui est vrai pour l'estimation du poids, mais la segmentation elle-même reste per-bac (groupement par `bacId` ligne 536). De même, `analytics.ts` porte le commentaire "ADR-033 DISC-09: build `mortalitesParBac` (flat Map)" alors que DISC-09 demandait de passer à un tableau plat `mortalitesTotales`. La pré-analyse détecte des commentaires contradictoires avec le code réel.

**Cause racine :**
L'implémentation a été réalisée en deux passes : une première passe a corrigé l'estimation du poids (interpolation vague-level), puis des commentaires "ADR-033 fixé" ont été ajoutés. Mais la deuxième correction (segmentation vague-level) n'a jamais été effectuée. Les commentaires optimistes ont masqué l'état réel du code lors des reviews suivantes.

**Fix :**
Les discrepancies DISC-03/05/06/08/09/11/12 ont finalement été reclassées "hors-scope" après validation utilisateur : l'algorithme confirmé maintient la segmentation per-bac et le `nombreVivants` per-bac — seule l'estimation du poids passe en vague-level. Les commentaires trompeurs ont été corrigés lors de la review ADR-033 (remarque I5 dans `review-ADR-033.md`).

**Leçon / Règle :**
Ne pas ajouter de commentaire "fix ADR-XXX DISC-YY" avant que la totalité de la correction correspondante soit effectuée. Un commentaire qui décrit un état futur désiré plutôt que l'état réel du code est plus dangereux qu'une absence de commentaire : il induit en erreur les reviewers et bloque la détection du travail restant. Utiliser plutôt un `// TODO(ADR-033 DISC-09): replace mortalitesParBac Map with flat mortalitesTotales array` tant que la correction n'est pas faite.

---

### ERR-052 — FCR : numérateur et dénominateur agrégés sur des périodes différentes
**Sprint :** ADR-033 | **Date :** 2026-04-05
**Sévérité :** Haute
**Fichier(s) :** `src/lib/feed-periods.ts`

**Symptôme :**
Le FCR calculé est incohérent : des périodes avec gain négatif (perte de biomasse) sont exclues du dénominateur (gain total) mais leur consommation alimentaire reste incluse dans le numérateur (aliment total). Le ratio aliment/gain est donc artificiellement gonflé.

**Cause racine :**
La logique de filtrage des périodes ne s'appliquait pas symétriquement. Le dénominateur ne sommait que les périodes à gain positif (filtre correct pour éviter un FCR négatif), mais le numérateur sommait toute la consommation sans appliquer le même filtre. Les deux grandeurs n'étaient donc pas calculées sur le même ensemble de périodes.

**Fix :**
Filtrer les deux termes sur le même prédicat (`gain > 0`) avant l'agrégation :
```typescript
const periodesPositives = periodes.filter(p => p.gainBiomasse > 0);
const alimentTotal = periodesPositives.reduce((s, p) => s + p.alimentConsome, 0);
const gainTotal   = periodesPositives.reduce((s, p) => s + p.gainBiomasse,  0);
const fcr = gainTotal > 0 ? alimentTotal / gainTotal : null;
```

**Leçon / Règle :**
Quand un ratio est calculé avec un filtre sur le dénominateur, appliquer le même filtre au numérateur. Ne jamais filtrer un seul terme d'un ratio — cela produit une agrégation incohérente et un résultat trompeur. Vérifier systématiquement que numérateur et dénominateur utilisent exactement le même ensemble de périodes/lignes.

---

### ERR-051 — Contexte Gompertz non construit pour les stratégies LINEAIRE
**Sprint :** ADR-033 | **Date :** 2026-04-05
**Sévérité :** Haute
**Fichier(s) :** `src/lib/feed-periods.ts`

**Symptôme :**
Une vague dont la `ConfigElevage.interpolationStrategy` vaut `LINEAIRE` n'utilise jamais le modèle Gompertz même si la vague a été calibrée (champ `vague.gompertz` renseigné avec des paramètres valides). L'interpolation reste linéaire même après calibrage, sous-estimant le poids des poissons dans les bacs créés après le calibrage.

**Cause racine :**
Le contexte Gompertz (`gompertzCtx`) était construit conditionnellement, uniquement quand `interpolStrategy === GOMPERTZ_VAGUE`. Or la stratégie configurée dans `ConfigElevage` contrôle le mode d'interpolation choisi par l'éleveur, mais la disponibilité du modèle Gompertz (existence de `vague.gompertz`) est une propriété indépendante. Conditionner la construction du contexte à la stratégie empêchait toute exploitation de Gompertz hors de ce chemin explicite.

**Fix :**
Séparer la construction du contexte Gompertz de la sélection de stratégie. Construire `gompertzCtx` dès que `vague.gompertz` est présent, indépendamment de `interpolStrategy` :
```typescript
const gompertzCtx = vague.gompertz
  ? buildGompertzContext(vague.gompertz)
  : null;

// Ensuite, utiliser gompertzCtx là où c'est pertinent,
// quelle que soit la valeur de interpolStrategy.
```

**Leçon / Règle :**
Ne pas conditionner la construction d'un contexte de calcul à la stratégie configurée si ce contexte peut être utile indépendamment. La disponibilité d'un modèle (données présentes) et son activation par configuration sont deux choses distinctes. Construire le contexte quand les données existent ; décider de l'utiliser ensuite selon la stratégie.

---

### ERR-050 — `interpolerPoidsBac` filtrait par bacId, rendant les bacs post-calibrage invisibles
**Sprint :** ADR-033 | **Date :** 2026-04-05
**Sévérité :** Haute
**Fichier(s) :** `src/lib/feed-periods.ts`

**Symptôme :**
Les bacs créés après un calibrage (redistribution des poissons) reçoivent un poids interpolé de `VALEUR_INITIALE` (50 g) au lieu du poids Gompertz correspondant à leur date de création. Le FCR et la biomasse sont fortement sous-estimés pour ces bacs.

**Cause racine :**
`interpolerPoidsBac` filtrait les biométries par `bacId` (`biometries.filter(b => b.bacId === bacId)`) pour obtenir l'historique du bac. Les bacs créés post-calibrage n'ont aucune biométrie propre dans leur fenêtre d'existence — les biométries appartiennent aux bacs sources. Le filtre retournait un tableau vide, ce qui déclenchait le fallback vers `VALEUR_INITIALE`.

**Fix :**
Créer `interpolerPoidsVague` qui utilise toutes les biométries de la vague sans filtre `bacId`, et qui évalue systématiquement Gompertz quand les paramètres sont disponibles :
```typescript
// Avant (incorrect) :
const biometriesBac = biometries.filter(b => b.bacId === bacId);

// Après (correct) :
// interpolerPoidsVague reçoit toutes les biométries de la vague,
// sans filtre bacId, et évalue Gompertz en priorité si gompertzCtx est non nul.
```

**Leçon / Règle :**
Le poids d'un poisson dans un bac post-calibrage dépend de l'historique de la vague entière, pas de l'historique du bac seul. Ne jamais filtrer les biométries par `bacId` pour alimenter un modèle de croissance (Gompertz ou linéaire) — filtrer par `vagueId` et laisser le modèle interpoler à la date voulue. Réserver le filtre `bacId` uniquement aux affichages de mesures brutes par bac.

---

### ERR-048 — GOMPERTZ_BAC : code mort car le fallback vers GOMPERTZ_VAGUE s'active systématiquement
**Sprint :** ADR-032 | **Date :** 2026-04-05
**Sévérité :** Moyenne
**Fichier(s) :** `src/lib/feed-periods.ts`, `src/lib/queries/analytics.ts`, `src/app/api/vagues/[id]/gompertz/route.ts`, `prisma/schema.prisma`

**Symptôme :**
L'option `GOMPERTZ_BAC` dans `StrategieInterpolation` (introduite par ADR-030) n'est jamais effectivement utilisée. Quand elle est sélectionnée dans `ConfigElevage`, le code de `interpolerPoidsBac` tombe systématiquement dans le fallback `GOMPERTZ_VAGUE`. Le FCR affiché est identique à `GOMPERTZ_VAGUE` quel que soit le choix de l'éleveur.

**Cause racine :**
Les calibrages (redistribution des poissons entre bacs) sont une opération courante dans l'élevage de Clarias gariepinus — toute vague au-delà de J20-J25 en subit au moins un. Les biométries per-bac incluent alors des discontinuités (le poids moyen "recule" après un calibrage) qui ne reflètent pas une vraie perte de poids. Le modèle Gompertz per-bac ne peut pas converger correctement sur ces données (R² faible), ce qui déclenche le fallback vers `GOMPERTZ_VAGUE`. En pratique, `GOMPERTZ_BAC` n'est jamais utilisé sur des données réelles.

**Fix (ADR-032) :**
Suppression complète de `GOMPERTZ_BAC` :
- Enum `StrategieInterpolation` réduit à `LINEAIRE` + `GOMPERTZ_VAGUE` (migration RECREATE)
- Modèle `GompertzBac` supprimé du schéma Prisma
- Branche `GOMPERTZ_BAC` supprimée de `interpolerPoidsBac` dans `feed-periods.ts`
- Chargement `gompertzBacs` supprimé de `analytics.ts`
- Boucle de calibration per-bac supprimée de la route `/api/vagues/[id]/gompertz`
- Option supprimée du formulaire `config-elevage-form-client.tsx` et du dialog `fcr-transparency-dialog.tsx`
- ConfigElevage existants avec `interpolationStrategy = GOMPERTZ_BAC` migrés vers `GOMPERTZ_VAGUE` par la migration SQL

**Leçon / Règle :**
Avant d'implémenter une stratégie d'interpolation per-entité (per-bac, per-lot), vérifier si les données terrain contiennent des discontinuités qui empêcheraient le modèle de converger. Si le fallback vers la stratégie vague/globale s'activera systématiquement, la stratégie per-entité est du code mort. Il vaut mieux une chaîne d'interpolation simple et fiable qu'une chaîne complexe dont les niveaux supérieurs ne sont jamais atteints. Voir ADR-032 qui supersède ADR-030 sur ce point.

---

### ERR-047 — nombreVivants figé au démarrage de la vague : FCR 2.5× trop bas après calibrage
**Sprint :** ADR-032 | **Date :** 2026-04-05
**Sévérité :** Haute
**Fichier(s) :** `src/lib/feed-periods.ts` (fonction `estimerNombreVivants`, remplacée par `estimerNombreVivantsADate`)

**Symptôme :**
Le FCR calculé par `computeAlimentMetrics` et `getFCRTrace` est biologiquement implausible (< 0.5) pour les bacs ayant subi un calibrage. Pour Clarias gariepinus, un FCR normal est entre 1.0 et 2.0. Un FCR de 0.4 signifie que les poissons ont pris plus de biomasse que d'aliment consommé — impossible.

**Cause racine :**
La fonction `estimerNombreVivants` dans `src/lib/feed-periods.ts` calculait le nombre de vivants d'un bac une seule fois pour toute sa durée de vie, à partir de `bac.nombreInitial ?? round(vague.nombreInitial / nbBacs)`. Cette valeur ne changeait jamais entre les périodes d'alimentation. Or, après un calibrage, `bac.nombreInitial` est périmé : il reflète la population au moment de la création du bac, pas la population post-calibrage.

Exemple concret (Vague 26-01) : Bac 01 part de 325 poissons, en perd 195 lors d'un calibrage à J25 (redistribués vers Bac 03 et Bac 04). Post-calibrage, Bac 01 ne contient plus que 130 poissons. Mais l'algorithme continuait d'utiliser `nombreVivants = 325`. Le gain de biomasse calculé était donc `poidsMoyenGain × 325` au lieu de `poidsMoyenGain × 130`, soit 2.5× trop élevé. Un gain surestimé → FCR sous-estimé.

**Fix (ADR-032) :**
Remplacement de `estimerNombreVivants` par `estimerNombreVivantsADate(bacId, targetDate, vagueContext, mortalitesParBac)` :
1. Chercher le dernier `CalibrageGroupe` dont `destinationBacId = bacId` et `calibrage.date <= targetDate`
2. Si trouvé, partir de `groupe.nombrePoissons` (source de vérité post-calibrage depuis le modèle `Calibrage` existant depuis Sprint 24)
3. Sinon, partir de `bac.nombreInitial ?? round(vague.nombreInitial / nbBacs)` (comportement précédent)
4. Soustraire les mortalités enregistrées pour ce bac entre la date de base et `targetDate`

Les requêtes Prisma dans `computeAlimentMetrics` et `getFCRTrace` incluent désormais `calibrages { groupes { destinationBacId, nombrePoissons, poidsMoyen } }`. Aucune migration de schéma requise — toutes les données nécessaires existaient déjà dans le modèle `Calibrage`.

**Leçon / Règle :**
Tout calcul de population par bac sur une vague doit être calibrage-aware. La source de vérité pour la population d'un bac après un calibrage est `CalibrageGroupe.nombrePoissons` (dernier calibrage avant la date cible), et non `Bac.nombreInitial` ni `Bac.nombrePoissons` (ce dernier est un champ legacy Phase 1 non fiable). Ne jamais utiliser une population "initiale" figée quand des opérations de redistribution peuvent avoir eu lieu. Voir `VagueContext.calibrages` et l'interface `CalibragePoint` dans `src/lib/feed-periods.ts`.

---

### ERR-046 — Suppression de paiement : le message d'erreur "n'appartient pas" est masqué par "introuvable"
**Sprint :** ADR-032 feature | **Date :** 2026-04-05
**Sévérité :** Basse
**Fichier(s) :** `src/app/api/depenses/[id]/paiements/[paiementId]/route.ts`

**Symptôme :**
La route DELETE `/api/depenses/[id]/paiements/[paiementId]` distingue deux cas d'erreur dans son handler : `message.includes("introuvable")` → 404, et `message.includes("n'appartient pas")` → 422. Mais la query `supprimerPaiementDepense` utilise `paiementDepense.findFirst({ where: { id: paiementId, depenseId } })` : si le paiement existe mais appartient à une autre dépense, `findFirst` retourne `null`, et la query lève "Paiement introuvable ou n'appartient pas a cette depense" — message qui contient "introuvable" en premier, donc l'API retourne toujours 404, jamais 422.

**Cause racine :**
Le contrôle d'ownership (le paiement appartient-il à cette dépense ?) est fusionné dans le même `findFirst` que l'existence du paiement. Il est impossible de distinguer les deux cas sans une deuxième requête.

**Fix appliqué :**
Les tests acceptent ce comportement : le cas "paiement d'une autre dépense" retourne 404 (même message). Ce n'est pas un bug fonctionnel — la sécurité est préservée (l'appelant ne peut pas accéder à des paiements hors-siteId). La distinction 404 vs 422 est cosmétique pour cette ressource.

**Leçon / Règle :**
Quand on rédige les handler HTTP d'erreur, s'assurer que l'ordre des `message.includes()` est cohérent avec les messages que la query peut réellement lever. Si plusieurs cas d'erreur partagent un mot commun (ici "introuvable"), le cas le plus spécifique doit être contrôlé en premier — ou la query doit lever des messages sans ambiguïté (`throw new Error("PAYMENT_NOT_FOUND")` vs `throw new Error("PAYMENT_WRONG_DEPENSE")`).

---

### ERR-045 — Suppression d'un modèle (ADR) sans nettoyer les références dans le code source
**Sprint :** ADR-032 | **Date :** 2026-04-05
**Sévérité :** Critique
**Fichier(s) :** `src/app/api/vagues/[id]/gompertz/route.ts`, `src/components/config-elevage/config-elevage-form-client.tsx`, `src/components/analytics/fcr-transparency-dialog.tsx`

**Symptôme :**
Le build échoue avec trois erreurs TypeScript après qu'une ADR (ADR-032) a supprimé le modèle `GompertzBac` et la valeur d'enum `GOMPERTZ_BAC` de `StrategieInterpolation` :
1. `prisma.gompertzBac` référencé dans la route gompertz → `Property 'gompertzBac' does not exist on type PrismaClient`
2. `StrategieInterpolation.GOMPERTZ_BAC` dans le select de config-elevage → `Property 'GOMPERTZ_BAC' does not exist`
3. Type local `MethodeEstimation` dans fcr-transparency-dialog inclut `"GOMPERTZ_BAC"` → comparaison impossible avec l'union réduite

Ces trois fichiers avaient été mentionnés dans le plan d'implémentation de l'ADR (section 11.B), mais n'avaient pas été mis à jour lors de l'implémentation. Le bug a été découvert par le tester au moment du `npm run build`.

**Cause racine :**
L'implémenteur (Phase A de l'ADR) a nettoyé les fichiers de types et de logique (`src/types/`, `src/lib/feed-periods.ts`, `src/lib/queries/analytics.ts`) mais a omis de nettoyer les trois fichiers de composants/routes listés dans l'ADR. La migration SQL existait déjà dans `prisma/migrations/` mais le code applicatif n'avait pas suivi.

**Fix :**
- `gompertz/route.ts` : supprimer le bloc de calibration par bac (lignes 249-410), retourner `calibrationsBacs: []` pour compatibilité ascendante.
- `config-elevage-form-client.tsx` : supprimer l'option `GOMPERTZ_BAC` du select `interpolationStrategy`.
- `fcr-transparency-dialog.tsx` : supprimer `"GOMPERTZ_BAC"` du type local `MethodeEstimation`, du `config` record, et simplifier les branches conditionnelles.

**Leçon / Règle :**
Quand une ADR supprime un modèle ou une valeur d'enum, tous les fichiers mentionnés dans la section "Impact sur les fichiers" de l'ADR doivent être modifiés dans le même commit/PR. Ne jamais supposer qu'un fichier "UI" n'a pas besoin d'être mis à jour. Avant tout `npm run build`, chercher le symbole supprimé dans tout le projet : `grep -r "GOMPERTZ_BAC" src/`. Un build vert est la condition nécessaire pour clore une ADR.

---

### ERR-044 — Suppression de paiement sans audit trail : perte de traçabilité
**Sprint :** ADR-032 feature | **Date :** 2026-04-05
**Sévérité :** Haute
**Fichier(s) :** `src/lib/queries/depenses.ts` — `supprimerPaiementDepense()`

**Symptôme :**
Pattern initial (avant la feature) : supprimer un `PaiementDepense` directement avec `prisma.paiementDepense.delete()` et recalculer les agrégats. Aucune trace de la suppression n'est conservée ; l'historique financier de la dépense devient incomplet et impossible à auditer.

**Cause racine :**
La suppression d'un paiement est une opération financière irréversible qui modifie le montant payé et le statut de la dépense. Sans audit trail, un bug ou une action malveillante sur cette route ne laisse aucune trace permettant de reconstituer l'état avant suppression.

**Fix :**
Créer un `AjustementDepense` (avec `typeAjustement: MONTANT_TOTAL`, `montantAvant: paiement.montant`, `montantApres: 0`, `paiementId`) **avant** la suppression, dans la même transaction. Si la transaction échoue après la création de l'audit trail mais avant la suppression, la transaction est annulée entièrement — aucun état incohérent.

```typescript
// 1. Create audit trail BEFORE deletion
await tx.ajustementDepense.create({
  data: {
    depenseId,
    montantAvant: paiement.montant,
    montantApres: 0,
    raison: `Suppression du paiement du ${paiement.date.toLocaleDateString("fr-FR")}`,
    userId,
    siteId,
    typeAjustement: TypeAjustementDepense.MONTANT_TOTAL,
    paiementId,
  },
});
// 2. Delete (FraisPaiementDepense cascade automatically)
await tx.paiementDepense.delete({ where: { id: paiementId } });
```

**Leçon / Règle :**
Toute suppression d'un enregistrement financier (paiement, facture, ligne de commande) doit créer un enregistrement d'audit **avant** la suppression, dans la même transaction (R4). L'audit trail doit inclure le `paiementId` de la ligne supprimée pour permettre la reconstitution. Le modèle `AjustementDepense` est le bon outil pour cela dans ce projet.

---

### ERR-043 — Variables mortes issues d'un copy-paste : supprimées avec `void` faute d'être câblées
**Sprint :** ADR-031 | **Date :** 2026-04-05
**Sévérité :** Moyenne
**Fichier(s) :** `src/lib/calculs/fcr-trace.ts`

**Symptôme :**
Une variable `bacBios` est construite par filtrage des biométries sur un bac précis, puis immédiatement supprimée avec `void bacBios` pour éviter un avertissement TypeScript "variable déclarée mais non utilisée". Le résultat de ce filtrage n'alimente aucun calcul.

**Cause racine :**
Code adapté depuis un contexte où `bacBios` était consommé (traitement bac par bac). Dans le nouveau contexte (`getFCRTrace`), la logique avait été réécrite pour opérer sur l'ensemble des biométries ; `bacBios` n'avait donc plus de consommateur. L'auteur a masqué l'avertissement avec `void` au lieu de supprimer la variable.

**Fix :**
Supprimer la déclaration de `bacBios` et l'expression `void bacBios`. Tracer chaque variable jusqu'à son consommateur avant de valider l'adaptation.

**Leçon / Règle :**
Quand on adapte du code d'un contexte à un autre, tracer chaque variable locale jusqu'à son consommateur. Si une variable n'a aucun consommateur dans le nouveau contexte, la supprimer entièrement. Masquer un avertissement avec `void` est un signal d'alarme : soit la variable est nécessaire et doit être câblée, soit elle est morte et doit être retirée.

---

### ERR-042 — Fetch de données déclenché dans le corps de rendu React au lieu d'un `useEffect`
**Sprint :** ADR-031 | **Date :** 2026-04-05
**Sévérité :** Haute
**Fichier(s) :** `src/components/releves/fcr-transparency-dialog.tsx`

**Symptôme :**
`loadTrace()` est appelée directement dans le corps du composant avec un garde `if (!loaded && !loading && !error)`. En React Strict Mode (développement), le composant est rendu deux fois, déclenchant deux appels réseau simultanés. En production, le comportement dépend du timing du premier rendu.

**Cause racine :**
Le développeur a tenté d'éviter un `useEffect` vide en plaçant la logique de fetch directement dans le render avec des gardes booléennes. Cette approche est incorrecte : les effets de bord (appels réseau, mutations d'état dérivées) ne doivent jamais être produits dans le corps de rendu.

**Fix :**
Déplacer l'appel dans un `useEffect` sans dépendances (ou avec `[open]` si le fetch doit se déclencher à l'ouverture du dialog) :
```tsx
useEffect(() => {
  loadTrace();
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []);
```

**Leçon / Règle :**
Ne jamais déclencher de side effects (fetch, setTimeout, mutation d'état externe) dans le corps de rendu d'un composant React, même avec des gardes booléennes. Toujours utiliser `useEffect`. En React Strict Mode, le corps de rendu est exécuté deux fois — toute logique conditionnelle y placée sera invoquée deux fois avant que l'état ne soit mis à jour.

---

### ERR-041 — Arrondi intermédiaire qui se propage dans les calculs suivants (rounding leak)
**Sprint :** ADR-031 | **Date :** 2026-04-05
**Sévérité :** Haute
**Fichier(s) :** `src/lib/calculs/fcr-trace.ts`

**Symptôme :**
Le `fcrMoyenFinal` affiché dans le dialog de transparence FCR diffère légèrement du `fcrMoyen` affiché sur la carte de synthèse (ex : `2.34` vs `2.35`). Les deux valeurs sont calculées à partir des mêmes données source mais divergent d'un epsilon visible.

**Cause racine :**
Dans `getFCRTrace`, les valeurs de biomasse intermédiaires (`biomasseCourante`, `biomassePrecedente`) étaient arrondies à 2 décimales pour alimenter les lignes du tableau de détail. Ces valeurs arrondies étaient ensuite réutilisées pour calculer `gainBiomasseKg` et `fcrPeriode`. L'erreur d'arrondi s'accumulait à chaque période et produisait un `fcrMoyenFinal` légèrement différent du FCR calculé depuis les valeurs brutes dans la carte.

**Fix :**
Conserver les valeurs brutes non arrondies dans toutes les variables intermédiaires de calcul. N'appliquer `toFixed()` ou `Math.round()` qu'au moment de construire l'objet destiné à l'affichage, jamais avant.

**Leçon / Règle :**
L'arrondi est une opération d'affichage, pas de calcul. Dans toute chaîne de calcul multi-étapes, les valeurs intermédiaires doivent rester en virgule flottante native. Une valeur arrondie ne doit jamais servir d'entrée à un calcul ultérieur. Appliquer l'arrondi uniquement à la dernière étape, sur la valeur finale destinée à être affichée ou sérialisée.

---

### ERR-037 — TypeScript : Array.includes() rejette une union plus large que le tuple readonly
**Sprint :** ADR-029 | **Date :** 2026-04-05
**Sévérité :** Moyenne
**Fichier(s) :** `src/lib/interpolation/strategy.ts` (et tout fichier utilisant `.includes()` sur un tuple `as const`)

**Symptôme :**
TypeScript émet une erreur de type lors d'un appel `.includes()` sur un tuple `readonly` quand la valeur testée est d'un type union plus large que le type des éléments du tuple :
```
Argument of type '"A" | "B" | "C" | "D"' is not assignable to parameter of type '"A" | "B"'.
```

**Cause racine :**
`Array.prototype.includes(searchElement: T)` exige que `searchElement` soit assignable à `T`. Pour un tuple `readonly ["A", "B"]`, `T` est `"A" | "B"`, ce qui est plus étroit que la valeur de type `"A" | "B" | "C" | "D"` à tester. TypeScript considère l'appel comme type-unsafe car le tuple ne peut logiquement pas contenir `"C"` ou `"D"`.

**Fix :**
Remplacer `.includes()` par des égalités directes :
```typescript
// Incorrect :
const SIMPLE_STRATEGIES = ["LAST_KNOWN", "ZERO"] as const;
if (SIMPLE_STRATEGIES.includes(strategy)) { ... } // erreur TS

// Correct :
if (strategy === "LAST_KNOWN" || strategy === "ZERO") { ... }
```

**Leçon / Règle :**
Ne pas utiliser `.includes()` pour tester l'appartenance d'une valeur à un sous-ensemble de son type union. Utiliser des comparaisons d'égalité directes (`===`) ou un cast explicite `(arr as readonly string[]).includes(val)` si le tuple est large. Les comparaisons directes sont plus lisibles et entièrement type-safe.

---

### ERR-036 — Prisma $Enums vs TypeScript enum : cast obligatoire à la frontière
**Sprint :** ADR-029 | **Date :** 2026-04-05
**Sévérité :** Moyenne
**Fichier(s) :** `src/lib/interpolation/strategy.ts`, tout service lisant un champ Prisma typé `$Enums.XxxEnum`

**Symptôme :**
Une review signale un cast `as SomeEnum` comme "redondant" ou "cosmétique" sur un champ lu depuis Prisma. Supprimer le cast provoque une erreur TypeScript à la compilation :
```
Type '$Enums.InterpolationStrategy' is not assignable to type 'InterpolationStrategy'.
```

**Cause racine :**
Prisma génère ses propres types nominaux dans l'espace `$Enums`. Ces types sont structurellement compatibles avec les enums TypeScript du projet (`src/types/`) mais nominalement distincts. TypeScript enforce la nominalité des enums : même si les valeurs sont identiques, les deux types ne sont pas interchangeables sans cast.

**Fix :**
Conserver le cast `as InterpolationStrategy` (ou l'enum applicatif équivalent) au point de lecture depuis Prisma :
```typescript
// Lecture depuis Prisma :
const strategy = vague.interpolationStrategy as InterpolationStrategy;
// Maintenant strategy est typé comme l'enum applicatif, pas $Enums.InterpolationStrategy
```

**Leçon / Règle :**
Tout champ Prisma dont le type est un enum (`$Enums.X`) doit être casté vers le type enum applicatif (`import { X } from "@/types"`) au point de lecture. Ce cast est **obligatoire**, pas cosmétique. Ne jamais le supprimer lors d'une review sans vérifier que `npm run build` passe toujours. Voir aussi ERR-008 et ERR-012 pour des variantes de ce problème.

---

### ERR-004 — updatedAt affiché au lieu de date de mesure
**Sprint :** 29+ | **Date :** 2026-03-20
**Sévérité :** Moyenne
**Fichier(s) :** `src/lib/queries/releves.ts`, `src/components/vagues/releves-list.tsx`

**Symptôme :**
La liste des relevés affichait la date de modification système (`updatedAt`) au lieu de la date de mesure (`date`).

**Cause racine :**
Le `orderBy` et l'affichage utilisaient `updatedAt` par erreur.

**Fix :**
Changer `orderBy: { updatedAt: "desc" }` → `orderBy: { date: "desc" }` et `r.updatedAt` → `r.date` dans l'affichage.

**Leçon / Règle :**
Toujours utiliser le champ métier (`date`) pour le tri et l'affichage, pas les timestamps système (`createdAt`/`updatedAt`).

---

## Catégorie : Build

### ERR-095 — Turbopack cache silencieux sur des règles CSS globales (pseudo-éléments, @media)
**Sprint :** Bugfixing | **Date :** 2026-05-03
**Sévérité :** Haute
**Fichier(s) :** `src/app/globals.css`

**Symptôme :**
Des nouvelles règles CSS ajoutées dans `globals.css` (pseudo-éléments `html::before` / `html::after`, sélecteurs top-level ou imbriqués dans `@media`) ne sont pas servies par le dev server Next.js (Turbopack). Le fichier sur disque est à jour. `touch` + reload ne changent rien. Les tests Vitest et le build webpack passent, mais `getComputedStyle` sur le pseudo-élément retourne `content: none, position: static` en runtime — la règle est absente du bundle CSS servi.

**Cause racine :**
Turbopack maintient un cache de modules CSS. Pour certains sélecteurs non-utilitaires (pseudo-éléments, sélecteurs globaux imbriqués dans `@media`), Turbopack ne détecte pas le changement comme nécessitant une recompilation. Le bundle hash ne change pas, aucune erreur n'est émise.

**Diagnostic rapide :**
Dans la console du navigateur :
```js
fetch('/_next/static/chunks/app/layout.css')
  .then(r => r.text())
  .then(t => console.log(t.includes('html::after')));
// false → le sélecteur est absent du CSS servi
```
Si le sélecteur est absent alors qu'il est dans le fichier source, c'est ce bug.

**Fix :**
Arrêter le dev server, supprimer le cache Turbopack, relancer :
```bash
rm -rf .next
npm run dev
```
Turbopack recompile depuis zéro et les nouvelles règles apparaissent.

**Leçon / Règle :**
Ne jamais valider un fix CSS uniquement sur la base "tests passent + build webpack OK". Pour toute règle globale non-utilitaire (`globals.css`, pseudo-éléments, `@media` top-level), vérifier le CSS réellement servi en inspectant le bundle dans le navigateur. En cas de doute sur Turbopack, `rm -rf .next` avant toute validation visuelle.

**Références :** [BUG-047](../bugs/BUG-047.md)

---

### ERR-006 — Prisma migrate diff inclut le texte de sortie CLI dans le SQL
**Sprint :** 30 | **Date :** 2026-03-20
**Sévérité :** Moyenne
**Fichier(s) :** `prisma/migrations/*/migration.sql`

**Symptôme :**
La migration échoue avec `ERROR: syntax error at or near "Loaded"` ou un texte de bannière Prisma
au début ou à la fin du fichier SQL généré.

**Cause racine :**
`npx prisma migrate diff --script > file.sql` redirige TOUT le stdout, y compris les messages
de config (`Loaded Prisma config from...`) et les bannières de mise à jour (`Update available...`).

**Fix :**
Après génération, supprimer manuellement les lignes non-SQL au début et à la fin du fichier :
- Supprimer la ligne `Loaded Prisma config from prisma.config.ts.` en tête
- Supprimer le bloc `┌─────...┐` de mise à jour en pied si présent

Puis si la migration a échoué, résoudre avec :
```bash
npx prisma migrate resolve --rolled-back NOM_MIGRATION
npx prisma migrate deploy
```

**Leçon / Règle :**
Toujours vérifier que le fichier migration.sql ne contient que du SQL pur avant de déployer.
Utiliser `head -3 migration.sql` et `tail -5 migration.sql` pour vérifier.

---

## Catégorie : Pattern

### ERR-123 — Fichier de test doublon créé parce que le lancement d'un agent a été déduit au lieu d'être attendu
**Sprint :** BD (contexte), confirmé et généralisé au Sprint CI | **Date :** 2026-07-27
**Sévérité :** Moyenne
**Fichier(s) :** transverse — tout fichier créé/modifié en parallèle par plusieurs agents sur le même dépôt

**Symptôme :**
Le sprint BD a produit un **fichier de test doublon** parce que le lancement d'un second agent en
écriture a été supposé terminé (« il a dû rendre la main ») au lieu d'être réellement vérifié. Le
sprint CI a reproduit un cas structurellement identique lors de la vérification finale : `git
status` lu au tout début de la mission du tester ne montrait que 2 fichiers modifiés
(`CLAUDE.md`, `package.json`) ; en cours de run, une deuxième vérification a révélé l'apparition en
temps réel (horodatée pendant l'exécution même de `npx vitest run`) de 6 fichiers `src/test/*`
supplémentaires, d'un test méta, d'un `.gitleaks.toml`, et de la modification de 5 autres fichiers —
un `ps aux` a confirmé qu'un second process `vitest` d'un autre agent tournait en parallèle. Le
premier run de test a dû être invalidé et refait, une fois le dépôt confirmé stable.

**Cause racine :**
Un agent en écriture (implementer, developer) n'a aucune obligation de signaler explicitement et de
façon fiable qu'il a fini d'écrire — un agent orchestrateur ou un agent en aval (tester,
reviewer) qui *déduit* la fin d'un travail (silence, temps écoulé, apparente disponibilité d'un
fichier) plutôt que de la *vérifier* (retour de contrôle explicite de l'outil de lancement d'agent,
`git status` stable dans le temps, absence de process actif) s'expose à lire/tester un état
transitoire du dépôt — soit un fichier partiellement écrit, soit une collision d'écriture entre deux
agents sur la même zone.

**Fix :**
Aucun fix de code — discipline de processus. Le tester du sprint CI a appliqué la bonne pratique en
réaction : `find -newer` sans nouveau fichier pendant 15s + absence de process `vitest`/`npm` actif
(`ps aux`) comme critère de stabilité avant de considérer le dépôt exploitable, et invalidation
explicite (pas de dissimulation) du premier run contaminé plutôt que de rapporter des chiffres
douteux comme s'ils étaient fiables.

**Leçon / Règle :**
Un agent en écriture doit avoir **réellement rendu la main** — pas être *supposé* avoir terminé —
avant qu'un autre agent touche les mêmes fichiers ou lance une vérification qui en dépend
(exécution de tests, review, build). Avant de conclure qu'un dépôt est dans un état stable pour
vérification : croiser au minimum deux signaux indépendants (état `git status` inchangé sur une
fenêtre de temps + absence de process actif lié au projet), jamais un seul coup d'œil ponctuel.
Toute anomalie constatée en cours de vérification (apparition de fichiers non prévus, changement
inattendu de `git status`) doit invalider le run en cours plutôt que d'être ignorée — un rapport
produit sur un dépôt en mouvement n'a aucune valeur, même si les chiffres semblent cohérents après
coup.

**Références :** [rapport-sprint-CI](../tests/rapport-sprint-CI.md) section 0

---

### ERR-122 — Un secret peut être tracké depuis le commit initial sans que personne ne le voie : un fichier de configuration d'outillage n'est audité par personne, par défaut
**Sprint :** CI (stories CI.3, CI.4) | **Date :** 2026-07-27
**Sévérité :** Critique
**Fichier(s) :** `.claude/settings.local.json` (jamais son contenu — voir consigne de sécurité), `CLAUDE.md` (R11), `.gitleaks.toml`, `.gitignore`

**Symptôme :**
`.claude/settings.local.json` — un fichier de **configuration d'outillage/agent**, catégorie que
personne ne pense à auditer parce qu'elle semble hors du périmètre naturel d'une revue de code
applicative — était tracké par git **depuis le commit initial** du dépôt (`169c559`), et contenait
un identifiant de connexion Postgres de production en clair (compte, hôte externe, mot de passe à
haute entropie). Il n'a été trouvé ni par une revue humaine, ni par aucun sprint antérieur, mais par
le **scan de secrets construit par ce sprint (gitleaks), dès sa toute première exécution** — la
faille a donc existé, invisible, sur toute la durée de vie publique du dépôt.

**Cause racine :**
La première version de R11 (avant ce sprint) énumérait un périmètre fermé de catégories de fichiers
concernées par l'interdiction des secrets en dur : « script, migration, test, doc ». Cette
énumération, en apparence prudente, produisait l'effet inverse de celui recherché : elle invitait à
conclure, par contraste, que tout ce qui n'y figurait pas explicitement (en particulier la
configuration d'outillage/IDE/agent — `.claude/`, `.vscode/`, `.idea/`, `*.local.*`) était hors
périmètre. Le mécanisme technique (le scanner gitleaks lui-même) n'avait, lui, aucune restriction
d'extension ni de catégorie — c'est la formulation de la règle qui portait la faille, pas
l'outillage.

**Fix :**
Détrackage du fichier (`git rm --cached .claude/settings.local.json` — opération d'index
uniquement, le fichier reste présent et inchangé sur le disque local, intentionnellement, pour ne
pas casser la configuration locale de l'agent), ajout à `.gitignore`. R11 reformulée dans
`CLAUDE.md` : le périmètre est désormais défini par principe (« ce fichier est-il tracké par git
dans ce dépôt ? ») et non par une liste fermée de catégories — toute exception explicite
(`.claude/`, `.vscode/`, `.idea/`, `*.local.*`) est citée comme **exemple non exhaustif**, jamais
comme périmètre limitatif. Voir `docs/security/REMEDIATION-SECRET-HISTORIQUE.md` pour la
remédiation complète (rotation requise côté production, hors périmètre agent — le détrackage
n'efface rien de l'historique déjà poussé sur GitHub).

**Leçon / Règle :**
Le périmètre d'une règle anti-secret doit être **exhaustif par principe** (« tout fichier tracké par
git, sans exception de nature ni d'extension »), jamais défini par une énumération fermée de
catégories — une énumération, aussi bien intentionnée soit-elle, crée par contraste une zone
présumée hors périmètre, exactement la zone où un secret réel a fini par se cacher. Avant de
formuler ou de réviser toute règle de sécurité par liste de catégories, se demander explicitement :
« quel type de fichier n'apparaît dans aucune de ces catégories, et pourquoi supposerait-on qu'il
est sans risque ? » — la configuration d'outillage/agent (fichiers `*local*`, censés rester privés
par leur nom même) est un candidat systématique à vérifier, pas une exception implicite.

**Références :** [ADR-052](../decisions/ADR-052-ci-anti-invisibilite-tests-db-gated.md) section 6, R11 (`CLAUDE.md`), [REMEDIATION-SECRET-HISTORIQUE](../security/REMEDIATION-SECRET-HISTORIQUE.md), [rapport-sprint-CI](../tests/rapport-sprint-CI.md) section 4

---

### ERR-101 — Guard `verifyAssignationInvariant` : `isEntrant` calculé par bac au lieu de par relevé (bacs source+dest dans la même vague)
**Sprint :** GD (BUG-049) | **Date :** 2026-07-15
**Sévérité :** Critique
**Fichier(s) :** `src/lib/guards/assignation-invariant.ts`, `src/lib/calculs.ts` (`computeVivantsByBac`, dette liée)

**Symptôme :**
En production, `Vague-26-03-Prep` / Bac 11 : toute vente antidatée déclenchait une erreur du guard `verifyAssignationInvariant` du type `Invariant cassé... AssignationBac.nombreActuel=X mais le calcul des opérations donne Y (écart Z)`. L'opération était bloquée alors que les données étaient en réalité cohérentes.

**Cause racine :**
Le guard calculait `entrantBacIds = Set<bacDestId>` **une seule fois pour tout le replay**, puis appliquait ce flag binaire à TOUS les relevés `TRANSFERT` d'un bac donné. Un bac qui est **source** d'un `TransfertGroupe` ET **destination** d'un autre (fréquent en intra-vague : Bac 08 → Bac 12 → Bac 11) voyait donc tous ses relevés `TRANSFERT` signés identiquement (`+1` ou `-1` pour tous), au lieu d'un signe différent selon le relevé concerné. Le replay produisait un solde faux, et le guard levait une `ConservationError` erronée.

`isEntrant` était une propriété du **bac**, alors que la question "ce relevé de transfert est-il un flux entrant ou sortant" ne peut être répondue qu'au niveau du **relevé** (via son `transfertGroupeId` + comparaison à `bacSourceId`/`bacDestId` du `TransfertGroupe` référencé).

**Fix :**
- Charger les `TransfertGroupe` par les `id` réellement référencés dans les relevés du replay (au lieu de filtrer par `vagueDestId`, ce qui ratait certains groupes).
- Construire `Map<transfertGroupeId, { bacSourceId, bacDestId }>` (`tgById`).
- Ajouter une fonction `transfertSigne(releve)` qui, pour chaque relevé `TRANSFERT`, compare le `bacId` du relevé à `bacSourceId`/`bacDestId` du groupe référencé et retourne `+1` (entrant), `-1` (sortant), ou signale un orphelin si le groupe est introuvable.
- Fallback : `transfertGroupeId == null` → traité comme sortant (comportement historique conservé pour compatibilité).
- Data-fix rétroactif ponctuel : `scripts/data-fixes/gd3-vague-26-03-prep-transferts.sql` (3 relevés `COMPTAGE` déguisés en transferts remplacés par 2 vrais `TransfertGroupe`, chaîne Bac 08 → Bac 12 → Bac 11). Rapport : `docs/analysis/GD3-data-fix-report.md`.

**Tests de non-régression :**
`src/__tests__/assignation-invariant-guard.test.ts` — 16/16 verts. Cas ajouté crucial : un bac source d'un `TG-A` ET destination d'un `TG-B` dans la même vague doit être discriminé relevé par relevé (`1000 - 150 + 400 = 1250`), pas globalement par bac.

**Leçon / Règle :**
Toute logique "ce mouvement est-il entrant ou sortant pour ce bac" doit être décidée **par relevé/mouvement**, jamais par bac de façon globale.
- **Anti-pattern** : `Set<bacId>` (ou tout flag booléen) construit une seule fois pour classifier tous les mouvements d'un bac.
- **Pattern correct** : `Map<transfertGroupeId, { bacSourceId, bacDestId }>` + comparaison au `bacId` de **chaque relevé individuellement**.
Ce pattern s'applique à toute fonction qui reconstitue un solde par replay de mouvements (guards d'invariant, calculs de vivants, agrégations de stock avec entrées/sorties).

**⚠️ Dette technique connue (non corrigée dans ce sprint, hors scope) :** `src/lib/calculs.ts` lignes ~330-345, fonction `computeVivantsByBac`, contient le **même anti-pattern** via `transfertDestBacIds` (Set construit une fois par bac). Cette fonction est utilisée dans **16 fichiers** (dashboards, indicateurs, pages finances). Elle peut silencieusement afficher des "vivants" incorrects pour tout bac qui est à la fois source et destination de transferts dans la même vague. À traiter dans un sprint dédié — grep `transfertDestBacIds` et `computeVivantsByBac` pour lister les call sites avant intervention.

**Références :** [BUG-049](../bugs/BUG-049.md) | [docs/reviews/review-story-GD.1.md](../reviews/review-story-GD.1.md) | [docs/analysis/GD3-data-fix-report.md](../analysis/GD3-data-fix-report.md)

---

### ERR-102 — `computeVivantsByBac` discrimination TRANSFERT par relevé (bug jumeau ERR-101)
**Sprint :** GV | **Date :** 2026-07-15
**Sévérité :** Critique
**Fichier(s) :** `src/lib/calculs.ts` (`computeVivantsByBac`), `src/lib/queries/transferts.ts` (`getTransfertGroupesByVague`, `getTransfertGroupesByVagues`), ~22 callers (dashboards, indicateurs, finances, analytics, pages, API)

**Symptôme :**
Follow-up du sprint GD/ERR-101 : la dette technique documentée dans ERR-101 s'est confirmée. Nombre de "vivants" affiché faux, **silencieusement** (pas d'erreur levée), pour tout bac qui est à la fois source d'un `TransfertGroupe` et destination d'un autre dans la même vague. Impact indirect en cascade sur biomasse, FCR, coûts/kg, ADG/PER, SGR, et alertes de ration.

**Cause racine :**
Même anti-pattern qu'ERR-101, dans une fonction sœur. `computeVivantsByBac` recevait `options.transfertDestBacIds: Set<string>`, construit une seule fois par `getTransfertDestBacIds` pour discriminer entrant/sortant **au niveau du bac** (flag binaire), au lieu de discriminer **au niveau du relevé** via son `transfertGroupeId`.

**Fix :**
- Nouvelle fonction `getTransfertGroupesByVague(siteId, vagueId): Promise<Map<tgId, {bacSourceId, bacDestId}>>` et sa variante batchée `getTransfertGroupesByVagues` (`src/lib/queries/transferts.ts:1317-1370`).
- `computeVivantsByBac` (`src/lib/calculs.ts:280-387`) prend désormais `options.transfertGroupesById: Map<...>`, et les relevés passés en entrée doivent inclure `transfertGroupeId: string | null` — champ rendu **obligatoire** dans le type pour forcer, via le compilateur TypeScript, la migration de tous les call sites.
- Comparaison par relevé : `tg?.bacDestId === r.bacId` → entrant ; `tg?.bacSourceId === r.bacId` → sortant ; fallback (orphelin/`transfertGroupeId` null) → sortant (compat historique).
- 22 callers migrés, dont `analytics.ts` qui avait été manqué lors d'un premier passage — attrapé en review, corrigé en batch avec `getTransfertGroupesByVagues`.

**Tests de non-régression :**
`src/__tests__/calculs-transfert-entrant.test.ts`, describe `"GV.3 — discrimination PAR RELEVÉ"`. Suite complète : 119 échecs (baseline pré-fix) → 66 échecs (net -53, dont 5 pré-existants du sprint GD.1 corrigés en bonus par ce fix).

**Leçon / Règle :**
Identique à ERR-101 — **toute logique "entrant vs sortant" doit être décidée par relevé/mouvement, jamais par entité globale (bac, produit, etc.)**.
- Anti-pattern : `Set<bacId>` construit une seule fois pour classifier tous les mouvements d'un ensemble de bacs.
- Pattern correct : `Map<transfertGroupeId, {bacSourceId, bacDestId}>` + comparaison au `bacId` de chaque relevé individuellement.
- Astuce process : quand on corrige ce pattern, rendre le champ discriminant (ex: `transfertGroupeId`) **obligatoire** (non-optionnel) dans le type TypeScript de la fonction corrigée — cela force le compilateur à faire remonter tous les call sites non migrés, plutôt que de compter sur une revue manuelle qui peut en manquer (cf. `analytics.ts` manqué au 1er passage).
- Avant toute modification de `computeVivantsByBac` ou logique de transfert similaire : grep `transfertGroupeId`, `transfertGroupesById`, `TransfertGroupe` pour lister tous les call sites concernés.

**Lien :** Voir ERR-101 (même pattern, sur le guard `verifyAssignationInvariant`). Ces deux entrées sont solidaires — ERR-101 documentait cette dette comme non traitée ; ERR-102 la clôt.

**Références :** Sprint GV, [docs/sprints/SPRINT-GV-VIVANTS-DISCRIMINATION.md](../sprints/SPRINT-GV-VIVANTS-DISCRIMINATION.md)

---

### ERR-078 — Rapport de test produit avant le commit final : résultats "NON CONFORME" sur du code pourtant correct
**Sprint :** 54 | **Date :** 2026-04-07
**Sévérité :** Basse
**Fichier(s) :** `docs/tests/rapport-story-54.4.md`

**Symptôme :**
Le rapport de test pour la story 54.4 marquait `stats-cards.tsx` comme "NON CONFORME" alors que la modification était bien présente dans le code source. Faux négatif générant une confusion lors de la review.

**Cause racine :**
Le tester a lancé ses vérifications avant que le développeur effectue son commit final. Le rapport documente l'état d'une version intermédiaire du code, pas l'état livré. Ce désynchronisation entre le moment du test et le moment du commit est un anti-pattern dans le pipeline story.

**Fix :**
Le rapport a été corrigé manuellement après vérification de la présence réelle des modifications dans le fichier final.

**Leçon / Règle :**
Le tester ne doit pas produire son rapport tant que le développeur n'a pas signalé que son implémentation est complète et committée. Le pipeline story est séquentiel : implementer → commit → tester → review. Vérifier le hash de commit ou la date du dernier fichier modifié avant de lancer les checks. Un rapport "NON CONFORME" sur du code correct est plus dommageable qu'un retard de quelques minutes.

---

### ERR-077 — Agents parallèles sur des fichiers partagés : modifications perdues par écrasement
**Sprint :** 54 | **Date :** 2026-04-07
**Sévérité :** Haute
**Fichier(s) :** `src/app/globals.css`, `src/components/ui/card.tsx`, `src/components/ui/button.tsx`

**Symptôme :**
Plusieurs agents (stories 54.2, 54.3, 54.4, 54.5, 54.6) ont modifié les mêmes fichiers partagés (`globals.css`, `card.tsx`, `button.tsx`) en parallèle. Les modifications d'un agent ont écrasé celles d'un autre, forçant des ré-applications manuelles et des réconciliations en fin de sprint.

**Cause racine :**
Le modèle d'exécution parallèle d'agents indépendants ne gère pas les conflits d'écriture sur les fichiers partagés. Chaque agent lit la version du fichier au moment de son démarrage, travaille sur sa copie locale, puis écrit — écrasant silencieusement les changements des agents qui ont écrit entre-temps.

**Fix :**
Les fichiers partagés ont été réconciliés manuellement après la complétion de toutes les stories.

**Leçon / Règle :**
Les fichiers partagés entre plusieurs stories d'un même sprint (`globals.css`, composants UI de base comme `card.tsx`, `button.tsx`, `layout.tsx`) ne doivent pas être modifiés par plusieurs agents en parallèle. Deux stratégies acceptables :
1. **Séquentialisation** : les stories touchant des fichiers partagés s'exécutent en séquence, pas en parallèle.
2. **Agent dédié** : un seul agent "intégrateur" est responsable des fichiers partagés — les autres stories lui délèguent leurs besoins via une spec, sans écrire directement.
Identifier les fichiers partagés en pré-analyse de sprint et planifier les dépendances en conséquence.

---

### ERR-069 — Invariant de conservation non testé : sum(qtyPériodes) doit égaler total consommation bac
**Sprint :** ADR-036 | **Date :** 2026-04-06
**Sévérité :** Haute
**Fichier(s) :** `src/lib/queries/fcr-by-feed.ts`, `src/__tests__/lib/fcr-by-feed.test.ts`

**Symptôme :**
La fonction `segmenterPeriodesParBac` divise les jours de consommation d'un bac en périodes. Si l'invariant de conservation n'est pas testé, une logique incorrecte de rattachement des jours mixtes ou de gestion des gaps peut silencieusement "perdre" de la quantité d'aliment — du tonnage qui existait dans `ReleveConsommation` n'apparaît dans aucune période, faussant le FCR.

**Cause racine :**
L'invariant de conservation est une propriété globale difficile à vérifier visuellement dans le code. Sans test unitaire dédié, une régression dans la segmentation peut passer inaperçue tant que les valeurs calculées "semblent raisonnables".

**Fix :**
Ajouter un test d'invariant explicite :
```typescript
it("conservation : sum(qtyTargetKg) over toutes les périodes == total consommation bac", () => {
  const consoByDay = new Map([
    ["2026-01-01", { qtyTargetKg: 2.5, autresProduits: [] }],
    ["2026-01-02", { qtyTargetKg: 3.0, autresProduits: [{ produitId: "other", quantiteKg: 1.0 }] }],
    ["2026-01-05", { qtyTargetKg: 1.8, autresProduits: [] }], // gap de 2 jours
  ]);
  const totalConso = [...consoByDay.values()].reduce((s, d) => s + d.qtyTargetKg, 0);
  const periodes = segmenterPeriodesParBac(consoByDay, "bac1", "Bac 1");
  const totalPeriodes = periodes.reduce((s, p) => s + p.qtyTargetKg, 0);
  expect(totalPeriodes).toBeCloseTo(totalConso, 6);
});
```

**Leçon / Règle :**
Toute fonction qui partitionne des données en sous-ensembles (segmentation, groupement, splitting) DOIT avoir un test d'invariant de conservation : la somme des parties doit égaler le tout. Cet invariant doit être le premier test écrit, avant les cas nominaux. Pour FCR-by-feed : `Σ qtyTargetKg sur toutes les périodes d'un bac == Σ quantite de ReleveConsommation pour ce bac et cet aliment`. Tout écart indique une perte ou un double-comptage silencieux.

---

### ERR-068 — Découverte des bacs depuis `Bac.vagueId` au lieu de `ReleveConsommation` : bacs désassignés invisibles
**Sprint :** ADR-036 | **Date :** 2026-04-06
**Sévérité :** Critique
**Fichier(s) :** `src/lib/queries/analytics.ts` (ancien `computeAlimentMetrics`), `src/lib/queries/fcr-by-feed.ts`

**Symptôme :**
L'ancienne fonction `computeAlimentMetrics` découvrait les bacs d'une vague via `prisma.bac.findMany({ where: { vagueId } })`. Après un calibrage (transfert de poissons), le bac source est désassigné (`vagueId = null`). Sa consommation de nourriture AVANT le calibrage était ignorée du calcul FCR — FCR sous-estimé (moins d'aliment au numérateur, même gain au dénominateur).

**Cause racine :**
`Bac.vagueId` reflète l'état ACTUEL de l'assignation du bac. Après un calibrage, un bac peut être libéré (`vagueId = null`) alors que ses relevés de consommation historiques contiennent des données valides appartenant à la vague. La query sur `Bac.vagueId` ne remonte jamais dans le passé.

**Fix (Step 5 ADR-036) :**
Découvrir les bacs depuis les enregistrements `ReleveConsommation` :
```typescript
// Avant (incorrect — manque les bacs désassignés) :
const bacs = await prisma.bac.findMany({ where: { vagueId, siteId } });

// Après (correct — inclut tous les bacs ayant réellement consommé) :
const consommations = await prisma.releveConsommation.findMany({
  where: { releve: { vagueId, siteId }, produitId },
  include: { releve: { include: { bac: true } } }
});
const bacsActifs = [...new Map(
  consommations.map(c => [c.releve.bacId, c.releve.bac])
).values()];
```

**Leçon / Règle :**
Pour calculer des métriques basées sur la consommation historique d'une vague, toujours partir de `ReleveConsommation` pour découvrir les bacs impliqués — jamais de `Bac.vagueId`. `Bac.vagueId` est l'état courant, pas l'historique. Ce pattern s'applique à tout calcul rétrospectif : FCR, SGR, bilan alimentaire. Voir aussi ERR-050 (bacs désassignés invisibles dans `interpolerPoidsBac`).

---

### ERR-061 — Constante de liste de paramètres URL hard-codée dans chaque composant : oubli lors d'un ajout
**Sprint :** ADR-038 | **Date :** 2026-04-06
**Sévérité :** Moyenne
**Fichier(s) :** `src/components/releves/releves-filter-bar.tsx`, `src/lib/releve-search-params.ts`

**Symptôme :**
La fonction `updateMultipleParams()` dans `releves-filter-bar.tsx` hard-codait la liste des 6 paramètres URL à effacer lors d'un reset ou d'un changement de type : `["vagueId", "bacId", "typeReleve", "dateFrom", "dateTo", "modifie"]`. Quand l'ADR-038 a ajouté 22 nouveaux paramètres de filtres spécifiques, ils n'étaient pas dans cette liste — un reset partiel laissait donc les filtres BIOMETRIE/MORTALITE/etc. actifs dans l'URL même si le type avait changé. Les filtres croisés produisaient des résultats incorrects (filtre BIOMETRIE actif sur une liste de MORTALITE).

**Cause racine :**
La liste des paramètres était dupliquée à plusieurs endroits (filter-bar, filter-sheet, active-filters) sans source de vérité partagée. Chaque ajout de paramètre nécessitait de mettre à jour N endroits séparément — une mise à jour partielle était difficile à détecter car aucun test ne vérifiait l'exhaustivité de cette liste.

**Fix :**
Créer une constante `ALL_FILTER_PARAMS` dans `src/lib/releve-search-params.ts` contenant l'ensemble de tous les paramètres de filtre, et l'utiliser partout :
```typescript
export const ALL_FILTER_PARAMS = [
  "vagueId", "bacId", "typeReleve", "dateFrom", "dateTo", "modifie",
  "poidsMoyenMin", "poidsMoyenMax", "tailleMoyenneMin", "tailleMoyenneMax",
  "causeMortalite", "nombreMortsMin", "nombreMortsMax",
  // ... 22 params au total
] as const;
```
Remplacer le tableau inline dans `updateMultipleParams()` par `ALL_FILTER_PARAMS`. Écrire un test qui vérifie qu'`ALL_FILTER_PARAMS` contient tous les champs de `ReleveSearchParams` (exhaustivité).

**Leçon / Règle :**
Toute liste de paramètres URL (ou de champs de filtre) partagée entre plusieurs composants doit vivre dans une constante exportée unique, dans le fichier utilitaire dédié (ex: `releve-search-params.ts`). Ne jamais dupliquer un tableau de paramètres URL inline dans les composants. Un test d'exhaustivité (`expect(ALL_FILTER_PARAMS).toContain(key)` pour chaque clé de l'interface) garantit qu'un nouveau paramètre ne sera pas oublié.

---

### ERR-060 — Query lourde chargée pour un sous-ensemble de données : pattern split query
**Sprint :** ADR-038 | **Date :** 2026-04-06
**Sévérité :** Haute (performance)
**Fichier(s) :** `src/lib/queries/vagues.ts`, `src/components/pages/vague-detail-page.tsx`

**Symptôme :**
`getVagueById()` chargeait tous les relevés d'une vague avec leurs relations complètes (bac, consommations, modifications) sans limite. Sur une vague de 6 bacs pendant 6 mois (~2 relevés/jour/bac), cela représente ~2 160 relevés soit ~500 KB de JSON Prisma en mémoire serveur — pour afficher uniquement 2 relevés en preview et quelques biométries sur le graphique. Les pages et le serveur étaient pénalisés sur toute vague mature.

**Cause racine :**
La query initiale avait été conçue quand les données étaient peu volumineuses. L'include `releves` était pratique pour l'accès direct à `vague.releves` dans les composants. Au fur et à mesure que des fonctionnalités dépendant de cette query ont été ajoutées (preview, graphique, page complète, export), le volume réel chargé a crû sans que la query soit adaptée.

**Fix :**
Séparer `getVagueById()` en deux fonctions distinctes avec des contrats explicites :
- `getVagueById(id, siteId)` : retourne `VagueWithBacs | null` — vague + bacs uniquement, sans relevés. Type de retour annoté explicitement pour bloquer tout accès à `.releves`.
- `getVagueByIdWithReleves(id, siteId, pagination?)` : retourne `{ vague, releves, total } | null` — charge relevés paginés en parallèle via `Promise.all`.
Les appelants qui avaient besoin de sous-ensembles de relevés (biométries pour graphique, preview 3 relevés) utilisent maintenant des queries directes ciblées avec `select` restreint.

**Leçon / Règle :**
Une query qui charge un include sans limite (sans `take`) doit être remise en question dès que le volume peut croître. Pour les modèles en relation 1-N potentiellement volumineuse (vague → relevés, commande → lignes), ne jamais inclure l'entité enfant dans la query parent sans `take`. Créer des fonctions de query distinctes selon le besoin : une sans l'enfant (métadonnées) et une avec pagination. Annoter explicitement les types de retour pour que TypeScript détecte les accès aux champs manquants chez les appelants.

---

### ERR-064 — Sheet Radix avec override `!inset-y-0` annule les safe areas iOS/Android
**Sprint :** ADR-038 | **Date :** 2026-04-06
**Sévérité :** Basse (UX mobile)
**Fichier(s) :** `src/components/releves/releves-filter-bar.tsx`, `src/components/releves/releves-filter-sheet.tsx`

**Symptôme :**
Le `SheetContent` du filtre relevés utilisait les classes Tailwind `!inset-y-0 !left-auto !right-0` pour positionner le Sheet en panneau latéral plein écran droit. Ces classes utilisent `!important` qui annule le `pt-[env(safe-area-inset-top)]` défini dans le composant `sheet.tsx` de base. Sur iPhone avec notch ou indicateur home (barre de gestes bas), le contenu du Sheet empiétait sur les zones système réservées : le titre se cachait sous la notch, les boutons d'action se trouvaient derrière la barre home.

**Cause racine :**
L'override `!inset-y-0` est nécessaire pour le positionnement du Sheet mais annule les paddings safe area. Le composant `SheetContent` de base avait prévu les safe areas via `pt-[env(safe-area-inset-top)]` mais le `!important` de l'override positionnement prenait le dessus. Modifier `SheetContent` globalement aurait cassé la sidebar et tous les autres usages partagés.

**Fix :**
Gérer les safe areas directement dans le contenu du Sheet (pas dans `SheetContent`), avec un layout flex-col h-full + header/footer sticky :
```tsx
<div className="flex flex-col h-full">
  {/* Header fixe — safe area top */}
  <div className="shrink-0 px-4 pt-[env(safe-area-inset-top)] pb-3 border-b">
    ...
  </div>
  {/* Corps scrollable */}
  <div className="flex-1 overflow-y-auto px-4 py-4">...</div>
  {/* Footer fixe — safe area bottom + right landscape */}
  <div className="shrink-0 px-4 pt-3
                  pb-[max(0.75rem,env(safe-area-inset-bottom))]
                  pr-[max(1rem,env(safe-area-inset-right))]
                  border-t">
    ...
  </div>
</div>
```
L'utilisation de `max(0.75rem, env(safe-area-inset-bottom))` garantit un minimum de 12px même sur les appareils sans geste système (où `safe-area-inset-bottom = 0`).

**Leçon / Règle :**
Quand un `SheetContent` ou `DialogContent` utilise des classes de positionnement avec `!important` qui annulent les safe areas, ne pas modifier le composant partagé — gérer les safe areas dans le contenu interne avec `pt-[env(safe-area-inset-top)]` et `pb-[max(0.75rem,env(safe-area-inset-bottom))]`. Cette approche isole le fix à l'usage spécifique sans impacter les autres Sheets/Dialogs. `max()` est le pattern correct pour garantir un minimum de padding sur les appareils sans safe area.

---

### ERR-059 — Route group Next.js : déplacement partiel de dossier casse le loading state des sous-routes
**Sprint :** ADR-034 | **Date :** 2026-04-06
**Sévérité :** Haute
**Fichier(s) :** `src/app/releves/`, `src/app/(farm)/releves/`

**Symptôme :**
`src/app/releves/` contenait deux fichiers : `loading.tsx` (pour `/releves`) et `nouveau/page.tsx` (pour `/releves/nouveau`). L'ADR demandait de déplacer uniquement `loading.tsx` vers `src/app/(farm)/releves/`. Ce déplacement partiel aurait cassé le loading state de `/releves/nouveau` : `loading.tsx` dans `(farm)/releves/` ne s'applique plus aux sous-routes restées dans l'ancien dossier `releves/nouveau/`.

**Cause racine :**
En Next.js App Router, un fichier `loading.tsx` couvre les routes du même segment et de ses sous-segments dans le même dossier. Si le dossier parent est divisé entre deux emplacements (`(farm)/releves/` et `releves/`), le `loading.tsx` du nouveau dossier n'a aucun effet sur les fichiers restés dans l'ancien dossier.

**Fix :**
Déplacer l'intégralité du dossier `src/app/releves/` vers `src/app/(farm)/releves/` en une seule opération : `loading.tsx` ET `nouveau/page.tsx` ensemble. Supprimer ensuite le dossier d'origine. Vérifier que les liens FAB (`/releves/nouveau`) fonctionnent toujours après déplacement.

**Leçon / Règle :**
Quand un dossier de route Next.js App Router est déplacé dans un route group (ex: `(farm)/`), déplacer toujours l'intégralité du sous-arbre du dossier en une seule opération. Un déplacement partiel (seulement certains fichiers du dossier) est presque toujours incorrect en App Router car les conventions de fichiers (`loading.tsx`, `error.tsx`, `layout.tsx`) s'appliquent au segment et à tous ses enfants dans le même arbre.

---

### ERR-040 — ADR interne incohérent : hypothèse d'homogénéité contredite par l'ADR précédent
**Sprint :** ADR-030 | **Date :** 2026-04-05
**Sévérité :** Haute
**Fichier(s) :** `docs/decisions/ADR-029.md`, `docs/decisions/ADR-030.md`

**Symptôme :**
ADR-029 rejette le calibrage Gompertz par bac avec l'argument que "les bacs d'une même vague ont des conditions quasi-identiques". ADR-030 doit annuler ce choix car les bacs ont en réalité des conditions différentes — en particulier des changements d'aliment qui surviennent à des dates distinctes par bac.

**Cause racine :**
ADR-028 avait introduit la segmentation des périodes d'alimentation par bac précisément parce que les bacs ne changent pas d'aliment en même temps. ADR-029, rédigé sans recroiser ADR-028, a posé une hypothèse d'homogénéité que le modèle avait déjà invalidée. Les deux ADR étaient en contradiction directe sur la nature des données.

**Fix :**
ADR-030 a été rédigé pour documenter l'invalidation d'ADR-029 et rétablir le calibrage par bac. Le travail d'implémentation a dû reprendre depuis la décision d'architecture.

**Leçon / Règle :**
Avant de rédiger un ADR qui suppose quelque chose sur la structure ou l'homogénéité des données, relire les ADR précédents pour détecter toute contradiction. En particulier : si un ADR antérieur a introduit une segmentation par entité (par bac, par période, par site), un nouvel ADR ne peut pas supposer que ces entités sont interchangeables. Documenter explicitement dans le nouvel ADR les hypothèses posées et les ADR croisés.

---

### ERR-039 — Pondération multi-entité copy-collée dans un contexte mono-entité devient un no-op
**Sprint :** ADR-030 | **Date :** 2026-04-05
**Sévérité :** Moyenne
**Fichier(s) :** `src/lib/calculs-gompertz.ts` (route de calibrage par bac)

**Symptôme :**
Le calibrage Gompertz par bac produit des résultats identiques qu'avec ou sans pondération. Aucune erreur TypeScript ou runtime, mais la pondération n'a aucun effet.

**Cause racine :**
La route de calibrage par vague pondérait les points biométriques par `vivantsByBac` (nombre de poissons par bac) pour agréger plusieurs bacs à la même date. Quand cette logique a été copy-collée dans la boucle de calibrage par bac, tous les enregistrements avaient le même `bacId`. Le numérateur et le dénominateur de la moyenne pondérée étaient proportionnels à la même constante, ce qui ramène le calcul à une moyenne simple — la pondération ne change rien.

**Fix :**
Dans le contexte mono-entité (boucle par bac), remplacer la moyenne pondérée par une moyenne arithmétique simple. L'abstraction de pondération multi-entité n'est pertinente que lorsque plusieurs entités différentes sont agrégées sur la même dimension temporelle.

**Leçon / Règle :**
Quand on adapte du code d'agrégation multi-entité à un contexte mono-entité, simplifier plutôt que copier. Une moyenne pondérée sur des enregistrements qui partagent tous le même identifiant d'entité est algébriquement équivalente à une moyenne simple — conserver la pondération est trompeur car elle suggère une variance entre entités qui n'existe pas. Se poser la question : "quelle diversité ce code est-il censé compenser ?" Si la diversité n'est pas présente dans le jeu de données courant, l'abstraction ne doit pas être transférée.

---

### ERR-018 — String en dur comme clé d'accès à un objet constant indexé par enum (variante R2)
**Sprint :** 37 | **Date :** 2026-03-21
**Sévérité :** Moyenne
**Fichier(s) :** `src/lib/services/abonnements.ts`, divers

**Symptôme :**
Un accès à un objet constant (`PLAN_LIMITES`) utilisait une string littérale comme clé d'index (`PLAN_LIMITES["DECOUVERTE"]`) au lieu de l'enum (`PLAN_LIMITES[TypePlan.DECOUVERTE]`). Pas d'erreur TypeScript immédiate si l'objet est typé `Record<string, ...>`, mais la valeur d'accès est découplée de l'enum : si l'enum change de nom, le compilateur ne détecte pas la régression.

**Cause racine :**
R2 est souvent appliqué aux comparaisons (`statut === "ACTIF"`) et aux paramètres Prisma, mais oublié pour les accès à des objets constants (`MAP[cle]`). L'accès par string en dur ressemble visuellement à un accès valide mais contourne le système de types.

**Fix :**
Utiliser l'enum comme clé d'index dans tous les accès à des objets constants indexés par des valeurs d'enum :

```typescript
// Incorrect (string en dur) :
const limites = PLAN_LIMITES["DECOUVERTE"];

// Correct (enum comme clé) :
import { TypePlan } from "@/types";
const limites = PLAN_LIMITES[TypePlan.DECOUVERTE];
```

**Leçon / Règle :**
R2 ("Toujours importer les enums") s'applique partout où une valeur d'enum est utilisée comme identifiant : comparaisons, paramètres de fonction, clés d'objet/Map, switch-case. Si un objet constant est indexé par des valeurs d'enum, chaque accès à cet objet doit utiliser `Enum.VALEUR` comme clé, jamais `"VALEUR"` en dur.

---

### ERR-017 — Tests existants cassés après refactoring de route API (régression silencieuse)
**Sprint :** 36 | **Date :** 2026-03-21
**Sévérité :** Haute
**Fichier(s) :** `src/__tests__/api/vagues.test.ts`, `src/app/api/vagues/route.ts`

**Symptôme :**
4 tests de la suite `vagues.test.ts` passent en régression après le refactoring R4 de la route `POST /api/vagues`. Le build CI détecte des échecs que le développeur n'a pas vus car il n'a relancé que les nouveaux tests.

**Cause racine :**
Le refactoring R4 a déplacé le check quota et la création dans une `$transaction()`, changeant le flow interne de la route (plus d'appel direct à `getQuotasUsage()`, erreur levée différemment via `throw` dans la transaction). Les mocks dans les tests existants ciblaient l'ancien flow et n'ont pas été mis à jour en même temps que le code.

**Fix :**
Après le refactoring, mettre à jour les mocks de la suite de tests correspondante pour refléter le nouveau flow : retirer le mock de `getQuotasUsage`, adapter les stubs de `prisma.$transaction` pour simuler le reject ou resolve selon les cas.

**Leçon / Règle :**
Après tout refactoring de route API qui change le flow interne (ordre des appels, encapsulation dans une transaction, remplacement d'une fonction par une autre), toujours relancer `npx vitest run` sur la suite de tests de cette route spécifiquement avant de déclarer le refactoring terminé. Si des mocks ne correspondent plus au nouveau flow, les mettre à jour dans le même commit que le refactoring.

---

### ERR-016 — Race condition check-then-create sur les quotas de plan (R4)
**Sprint :** 36 | **Date :** 2026-03-21
**Sévérité :** Haute
**Fichier(s) :** `src/app/api/bacs/route.ts`, `src/app/api/vagues/route.ts`

**Symptôme :**
Deux requêtes POST concurrentes passent simultanément le check de quota (`getQuotasUsage()`) et créent toutes les deux leur ressource, dépassant la limite du plan. Aucune erreur n'est levée, le dépassement est silencieux.

**Cause racine :**
Le pattern `getQuotasUsage() → if quota atteint → create` n'est pas atomique. Entre le moment du count et celui de la création, une autre requête concurrente peut effectuer le même count (qui retourne la même valeur) et procéder à sa propre création.

**Fix :**
Encapsuler le count et la création dans `prisma.$transaction()` pour que le check et la création soient atomiques :

```typescript
// Avant (non-atomique, vulnérable aux race conditions) :
const usage = await getQuotasUsage(siteId);
if (usage.bacs >= plan.limiteBacs) {
  return NextResponse.json({ error: "Quota atteint" }, { status: 403 });
}
const bac = await prisma.bac.create({ data });

// Après (atomique) :
const bac = await prisma.$transaction(async (tx) => {
  const count = await tx.bac.count({ where: { siteId } });
  if (count >= plan.limiteBacs) {
    throw new Error("QUOTA_ATTEINT");
  }
  return tx.bac.create({ data });
});
```

**Leçon / Règle :**
R4 s'applique aussi aux créations conditionnelles : quand une création dépend d'un comptage de limite (quotas, stock, places disponibles, etc.), toujours mettre le count + create dans la même transaction. Le pattern check-then-create hors transaction est toujours vulnérable aux race conditions sous charge.

**Complément Sprint 36 :** Quand on refactorise une route pour appliquer R4, identifier toutes les routes similaires dans le même fichier ou dans des fichiers parallèles (ex : `/api/bacs` ET `/api/vagues` traitent toutes les deux des quotas de plan). Corriger le pattern sur TOUTES ces routes en même temps. Un fix partiel laisse une surface d'attaque résiduelle.

---

### ERR-005 — Check-then-update au lieu d'opérations atomiques (R4)
**Sprint :** 2 | **Date :** 2026-03-08
**Sévérité :** Haute
**Fichier(s) :** divers

**Symptôme :**
Race conditions possibles quand on fait `findFirst` puis `update` sans transaction.

**Cause racine :**
Pattern "vérifier puis modifier" non atomique.

**Fix :**
Utiliser `$transaction()` avec `updateMany` conditionnel ou `findFirst` + `update` dans la même transaction.

**Leçon / Règle :**
R4 : Toujours utiliser des opérations atomiques. `$transaction()` pour les opérations multi-étapes.

---

### ERR-008 — Conflit enum Prisma généré vs TypeScript dans les routes/services
**Sprint :** 31 | **Date :** 2026-03-20
**Sévérité :** Haute
**Fichier(s) :** `src/app/api/webhooks/`, `src/lib/services/billing.ts`

**Symptôme :**
Erreur TypeScript `Type 'import(".../prisma/enums").StatutPaiementAbo' is not assignable to
type 'import(".../types/models").StatutPaiementAbo'` lors de l'utilisation des résultats
de queries Prisma dans les routes ou services.

**Cause racine :**
Prisma génère ses propres enums dans `src/generated/prisma/enums`. Ces enums sont
distincts des enums TypeScript dans `src/types/models.ts`, même si les valeurs sont identiques.
Quand une query retourne un objet Prisma (ex: `paiementAbonnement.statut`), son type est
`prisma/enums.StatutPaiementAbo`, pas `types/models.StatutPaiementAbo`.

**Fix :**
Option 1 (comparaison) : Caster en string pour comparer :
```typescript
if ((paiement.statut as string) === StatutPaiementAbo.CONFIRME) { ... }
```

Option 2 (passage à Prisma) : Caster le type pour les fonctions Prisma directes :
```typescript
const gateway = getPaymentGateway(paiement.fournisseur as FournisseurPaiement);
```

Option 3 (recommandée) : Utiliser les fonctions de query Sprint 30/31 qui gèrent les
enums en interne plutôt que d'appeler Prisma directement dans les routes :
```typescript
// Au lieu de : tx.abonnement.updateMany({ data: { statut: "ACTIF" as never } })
// Utiliser : activerAbonnement(abonnementId) — qui fait le updateMany en interne
await confirmerPaiement(referenceExterne);
await activerAbonnement(abonnementId);
```

**Leçon / Règle :**
Dans les routes API et services, TOUJOURS utiliser les fonctions de query plutôt que d'appeler
Prisma directement avec des statuts d'enum. Les fonctions de query gèrent le conflit d'enum
correctement. Si la comparaison directe est nécessaire, utiliser `(val as string) === Enum.VALUE`.

---

### ERR-007 — Prisma Json field : type InputJsonValue requis pour update
**Sprint :** 30 | **Date :** 2026-03-20
**Sévérité :** Basse
**Fichier(s) :** `src/lib/queries/*.ts`

**Symptôme :**
Erreur TypeScript `Type 'Record<string, unknown> | undefined' is not assignable to type 'NullableJsonNullValueInput | InputJsonValue | undefined'`
lors de la mise à jour d'un champ `Json?` Prisma.

**Cause racine :**
Prisma génère des types spécifiques pour les champs Json. `Record<string, unknown>` est compatible
mais TypeScript ne peut pas l'inférer directement sans cast.

**Fix :**
Utiliser un cast vers `Prisma.InputJsonValue` :
```typescript
import type { Prisma } from "@/generated/prisma/client";

// Dans l'update :
...(metadata !== undefined && {
  metadata: metadata as Prisma.InputJsonValue
})
```

**Leçon / Règle :**
Pour les champs `Json?` Prisma en update, toujours caster avec `as Prisma.InputJsonValue`.

---

### ERR-012 — Cast enums Prisma généré vs @/types dans les Server Components
**Sprint :** 33 | **Date :** 2026-03-21
**Sévérité :** Moyenne
**Fichier(s) :** `src/app/*/page.tsx`, `src/generated/prisma/enums.ts`

**Symptôme :**
```
Type '"DECOUVERTE"' is not assignable to type 'TypePlan'
```
Les enums Prisma générés dans `src/generated/prisma/enums.ts` ne sont pas compatibles avec les enums de `src/types/models.ts` même si les valeurs string sont identiques (R1 garantit l'identité).

**Cause racine :**
Prisma génère ses propres enums dans un namespace isolé. TypeScript refuse l'assignation directe même si les valeurs sont les mêmes.

**Fix :**
Utiliser le cast `as unknown as import("@/types").TypePlan` pour convertir les retours Prisma avant de les passer à des composants typés `@/types`.

```typescript
// Dans la Server Component page.tsx :
statut: prismaResult.statut as unknown as import("@/types").StatutAbonnement,
typePlan: prismaResult.plan.typePlan as unknown as import("@/types").TypePlan,
```

**Leçon / Règle :**
Quand une Server Component lit depuis Prisma et passe les données à un composant avec des types `@/types`, toujours caster les enums Prisma via `as unknown as TypeCible`. Ce cast est sûr car R1 garantit que toutes les valeurs d'enum sont UPPERCASE et identiques entre Prisma et `@/types`.

---

### ERR-015 — Double vérification redondante avant une opération déjà conditionnelle
**Sprint :** 36-37 | **Date :** 2026-03-21
**Sévérité :** Moyenne
**Fichier(s) :** `src/lib/services/rappels-abonnement.ts`, divers

**Symptôme :**
Deux formes observées :

1. (Sprint 36) Le service effectuait une requête `COUNT` en base (`rappelExisteAujourdhui`) avant chaque appel à `creerNotificationSiAbsente`, entraînant une double requête DB par rappel traité.

2. (Sprint 37) Un `findFirst` de vérification précédait un `updateMany` qui filtrait déjà par condition. Le `findFirst` était du code mort : si aucun enregistrement ne matchait la condition, le `updateMany` ne faisait rien de toute façon.

**Cause racine :**
Dans le cas 1 : `creerNotificationSiAbsente` inclut déjà une vérification interne d'unicité. La pré-vérification externe dupliquait cette logique.

Dans le cas 2 : un `updateMany` avec clause `where` est par nature conditionnel — il ne met à jour que les lignes qui matchent et ne lève pas d'erreur si aucune ne matche. Un `findFirst` préalable n'ajoute aucune garantie.

**Fix :**
Cas 1 : Supprimer la pré-vérification, déléguer entièrement la logique à la fonction appelée.

Cas 2 : Supprimer le `findFirst`. Laisser le `updateMany` gérer seul la condition :
```typescript
// Inutile (code mort) :
const existing = await prisma.foo.findFirst({ where: { id, siteId, statut: "ACTIF" } });
if (!existing) return; // updateMany ferait de toute façon 0 lignes
await prisma.foo.updateMany({ where: { id, siteId, statut: "ACTIF" }, data: { statut: "INACTIF" } });

// Correct :
await prisma.foo.updateMany({ where: { id, siteId, statut: "ACTIF" }, data: { statut: "INACTIF" } });
```

**Leçon / Règle :**
Avant d'ajouter une vérification en amont d'un appel, se demander : "que se passe-t-il si cette vérification retourne faux/vide ?". Si la réponse est "l'opération suivante ne fait rien de toute façon", la pré-vérification est du code mort. Une double vérification identique double le nombre de requêtes DB sans garantie supplémentaire et donne une fausse impression de sécurité.

---

### ERR-014 — Boucle de updateMany séquentiels sans $transaction (R4)
**Sprint :** 36 | **Date :** 2026-03-21
**Sévérité :** Haute
**Fichier(s) :** `src/lib/services/abonnement-lifecycle.ts`

**Symptôme :**
Un CRON job exécutait une boucle `for` de plusieurs `updateMany` séquentiels sans transaction globale. Un crash ou une erreur en milieu de boucle laissait la base dans un état partiellement mis à jour (certains abonnements transitionnnés, d'autres non).

**Cause racine :**
Chaque `updateMany` est atomique individuellement, mais une séquence de `updateMany` dans une boucle sans `$transaction` n'est pas atomique globalement. Une interruption entre deux itérations produit une exécution partielle.

**Fix :**
Collecter toutes les opérations dans un tableau, puis les envelopper dans `prisma.$transaction([...])` (forme batch) :

```typescript
// Avant (non-atomique) :
for (const operation of operations) {
  await prisma.abonnement.updateMany({ where: operation.where, data: operation.data });
}

// Après (atomique) :
const updates = operations.map((operation) =>
  prisma.abonnement.updateMany({ where: operation.where, data: operation.data })
);
await prisma.$transaction(updates);
```

**Leçon / Règle :**
R4 s'applique aussi aux boucles : quand plusieurs `updateMany` (ou autres opérations Prisma) doivent s'exécuter ensemble, toujours les regrouper dans `prisma.$transaction([...])`. L'atomicité individuelle de chaque opération ne suffit pas — c'est l'ensemble de la séquence qui doit être atomique.

---

### ERR-013 — Rate limiting en mémoire non partagé entre instances serverless
**Sprint :** 35 | **Date :** 2026-03-21
**Sévérité :** Basse (dev/staging), Moyenne (production)
**Fichier(s) :** `src/app/api/remises/verifier/route.ts`

**Symptôme :**
En production avec plusieurs instances serverless (Vercel), le rate limiting via `Map` en mémoire n'est pas partagé entre les instances. Un même utilisateur peut dépasser la limite en envoyant des requêtes sur des instances différentes.

**Cause racine :**
Chaque instance serverless a sa propre mémoire. La `Map` est locale à l'instance.

**Fix pour production :**
Utiliser un store partagé comme Redis (Upstash) ou le middleware Vercel pour le rate limiting.

```typescript
// Alternative avec Upstash Redis :
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, "1 m"),
});
```

**Leçon / Règle :**
Le rate limiting in-memory est acceptable en Phase 2 (dev/staging). Pour la production, migrer vers un store partagé avant le déploiement final.

---

### ERR-019 — R6 : couleurs Tailwind hardcodées dans les composants PWA (pattern systémique)
**Sprint :** 27, 29, 30, 31 | **Date :** 2026-03-21
**Sévérité :** Haute
**Fichier(s) :** `src/app/~offline/page.tsx`, `src/components/sw-register.tsx`, `src/components/install-prompt.tsx`, `src/components/sync-status-panel.tsx`, `src/components/offline-indicator.tsx`

**Symptôme :**
Les composants PWA utilisent des classes Tailwind avec des couleurs en dur : `bg-teal-600`, `text-teal-600`, `bg-white`, `text-gray-400`. Le thème dark mode et toute modification de la palette de couleurs ne se propagent pas à ces composants.

**Cause racine :**
Lors de la création de nouveaux composants standalone (page offline, bannière SW, indicateurs sync), les développeurs ont utilisé les couleurs Tailwind directes au lieu des classes de thème. Ce pattern se répète sur tous les sprints PWA (27, 29, 30, 31), indiquant que la règle R6 n'est pas consultée lors de l'écriture des nouveaux composants.

**Fix :**
Remplacer systématiquement les couleurs Tailwind directes par leurs équivalents de thème :
- `bg-teal-600` → `bg-primary`
- `text-teal-600` → `text-primary`
- `bg-white` → `bg-background`
- `text-gray-400` → `text-muted-foreground`
- `text-gray-600` → `text-foreground`
- `border-gray-200` → `border-border`

**Leçon / Règle :**
R6 : Jamais de couleurs Tailwind directes (teal-*, gray-*, white, black) dans les composants. Toujours utiliser les classes de thème (`bg-primary`, `bg-background`, `text-foreground`, `text-muted-foreground`, `border-border`, etc.). Les composants PWA (offline, SW, install prompt, sync panel) sont des composants UI comme les autres et soumis aux mêmes règles. Pendant la creation d'un nouveau composant, chercher toute occurrence de `-teal-`, `-gray-`, `bg-white`, `text-white` avant de terminer.

---

### ERR-020 — R2 : string literal "MORTALITE" au lieu de TypeReleve.MORTALITE dans un service
**Sprint :** 29 | **Date :** 2026-03-21
**Sévérité :** Haute
**Fichier(s) :** `src/lib/services/releve.service.ts` (ligne 57)

**Symptôme :**
Le service utilise la string `"MORTALITE"` en dur pour filtrer les relevés de mortalité. Si la valeur de l'enum TypeReleve change ou est renommée, TypeScript ne détecte pas la régression dans ce fichier.

**Cause racine :**
R2 est souvent respecté dans les routes API et les requêtes Prisma, mais oublié dans les services métier où les comparaisons de type sont moins visibles. Les services reçoivent souvent des données typées depuis Prisma et comparent avec des strings en dur sans importer l'enum.

**Fix :**
```typescript
// Incorrect :
if (releve.typeReleve === "MORTALITE") { ... }

// Correct :
import { TypeReleve } from "@/types";
if (releve.typeReleve === TypeReleve.MORTALITE) { ... }
```

**Leçon / Règle :**
R2 s'applique dans TOUS les fichiers sans exception : routes API, services, queries, hooks, composants. Dans les services métier en particulier, auditer systématiquement les comparaisons `=== "VALEUR"` sur des champs qui correspondent à des enums. Utiliser `TypeReleve.MORTALITE`, jamais `"MORTALITE"`.

---

### ERR-021 — Securite crypto : unwrapDataKey retourne une cle extractable
**Sprint :** 28 | **Date :** 2026-03-21
**Sévérité :** Haute (securite)
**Fichier(s) :** `src/lib/offline/crypto.ts`

**Symptôme :**
La fonction `unwrapDataKey` appelle `crypto.subtle.unwrapKey` avec `extractable: true`. Cela signifie que la cle dechiffree peut etre exportee hors du contexte WebCrypto par n'importe quel code JavaScript ayant acces a l'objet `CryptoKey`, y compris du code malveillant injecte (XSS).

**Cause racine :**
La valeur par defaut ou une copie depuis un exemple d'unwrap a conserve `extractable: true`. La difference entre `true` et `false` est subtile visuellement mais critique pour la securite.

**Fix :**
```typescript
// Incorrect (cle exportable hors WebCrypto) :
const dataKey = await crypto.subtle.unwrapKey(
  "raw", wrappedKey, kek,
  { name: "AES-KW" },
  { name: "AES-GCM" },
  true,        // extractable — DANGEREUX
  ["encrypt", "decrypt"]
);

// Correct (cle confinee dans WebCrypto) :
const dataKey = await crypto.subtle.unwrapKey(
  "raw", wrappedKey, kek,
  { name: "AES-KW" },
  { name: "AES-GCM" },
  false,       // extractable: false — cle non exportable
  ["encrypt", "decrypt"]
);
```

**Leçon / Règle :**
Dans toute utilisation de `crypto.subtle.importKey`, `crypto.subtle.unwrapKey` ou `crypto.subtle.generateKey`, poser `extractable: false` sauf si l'export explicite de la cle est necessaire (ex: sauvegarde). Les cles de chiffrement de donnees utilisateur ne doivent jamais etre exportables. Auditer tous les appels WebCrypto lors de chaque code review de la couche crypto.

---

### ERR-022 — Securite : delai exponentiel absent apres echecs de PIN (tentatives 3 a 5)
**Sprint :** 28 | **Date :** 2026-03-21
**Sévérité :** Haute (securite)
**Fichier(s) :** `src/lib/offline/auth-cache.ts`

**Symptôme :**
La validation du PIN offline n'applique pas de delai exponentiel entre les tentatives 3 et 5. Un attaquant peut bruteforcer un PIN a 4 chiffres (10 000 combinaisons) sans contrainte de temps apres 2 echecs.

**Cause racine :**
L'ADR definissait ce comportement (blocage progressif des tentatives 3-5) mais l'implementation dans `auth-cache.ts` ne l'a pas inclus. Le compteur d'echecs est maintenu mais le delai correspondant n'est pas applique.

**Fix :**
Apres verification du nombre d'echecs, appliquer un delai avant de retourner la reponse :
```typescript
const DELAYS_MS = [0, 0, 0, 2_000, 5_000, 10_000]; // index = nb echecs

async function verifyPin(pin: string): Promise<boolean> {
  const meta = await getAuthMeta();
  const failCount = meta.failedAttempts ?? 0;
  const delay = DELAYS_MS[Math.min(failCount, DELAYS_MS.length - 1)];
  if (delay > 0) await new Promise(r => setTimeout(r, delay));
  // ... verification PBKDF2 ...
}
```

**Leçon / Règle :**
Toute interface de validation de secret (PIN, code, mot de passe) doit implementer un delai exponentiel cote serveur/service — pas uniquement cote UI. Si l'ADR specifie un comportement de securite, l'implementation doit l'inclure explicitement. Lors de la review d'une couche d'authentification, verifier que chaque spec de securite de l'ADR a un test de non-regression correspondant.

---

### ERR-023 — R8 : RefRecord sans siteId dans la couche de cache offline (fuite multi-tenant)
**Sprint :** 28 | **Date :** 2026-03-21
**Sévérité :** Haute (multi-tenancy)
**Fichier(s) :** `src/lib/offline/ref-cache.ts`, `src/lib/offline/db.ts`

**Symptôme :**
Le modele `RefRecord` (donnees de reference mises en cache dans IndexedDB) ne possede pas de champ `siteId`. Un utilisateur membre de plusieurs sites peut lire les donnees de reference d'un site dans le contexte d'un autre site. La fonction `clearSiteRefData` efface tous les sites faute de filtre.

**Cause racine :**
R8 ("siteId PARTOUT") est bien applique aux modeles Prisma mais pas aux interfaces TypeScript des structures IndexedDB offline. Les structures de cache cote client sont des "modeles" au sens large et doivent aussi isoler les donnees par site.

**Fix :**
Ajouter `siteId: string` au type `RefRecord` et a tous les stores IndexedDB contenant des donnees multi-tenant. Toutes les fonctions de lecture/ecriture doivent filtrer par `siteId`. La fonction `clearSiteRefData` doit accepter un `siteId` en parametre et ne supprimer que les entrees correspondantes :
```typescript
interface RefRecord {
  id: string;
  siteId: string;   // OBLIGATOIRE — R8
  type: string;
  data: unknown;
  cachedAt: number;
}

async function clearSiteRefData(siteId: string): Promise<void> {
  const db = await getDb();
  const tx = db.transaction("refData", "readwrite");
  const index = tx.store.index("by-site");
  const keys = await index.getAllKeys(siteId);
  await Promise.all(keys.map(k => tx.store.delete(k)));
}
```

**Leçon / Règle :**
R8 s'applique a TOUTES les structures de donnees qui stockent des informations metier : modeles Prisma, interfaces TypeScript, stores IndexedDB, caches locaux, fichiers JSON. Toute structure contenant des donnees qui appartiennent a un site doit avoir `siteId`. Le mode offline ne fait pas exception : les donnees isolees en base doivent l'etre aussi en cache local.

---

### ERR-024 — R4 : count + put non atomique dans la queue offline (race condition)
**Sprint :** 28 | **Date :** 2026-03-21
**Sévérité :** Moyenne
**Fichier(s) :** `src/lib/offline/queue.ts`

**Symptôme :**
La fonction `enqueue` effectue un `count` des items en attente puis un `put` pour ajouter le nouvel item en deux operations IndexedDB separees. Sous acces concurrent (deux onglets, deux requetes simultanees), deux `count` peuvent retourner la meme valeur avant que l'un des `put` ne soit execute, permettant de depasser la limite de la queue.

**Cause racine :**
R4 ("operations atomiques") est applique aux mutations Prisma mais oublié pour les operations IndexedDB. La transaction IndexedDB existe pour exactement ce cas : grouper count + put dans une seule transaction garantit l'atomicite.

**Fix :**
Encapsuler `count` et `put` dans la meme transaction IndexedDB :
```typescript
async function enqueue(item: QueueItem): Promise<void> {
  const db = await getDb();
  const tx = db.transaction("queue", "readwrite");
  const count = await tx.store.count();
  if (count >= MAX_QUEUE_SIZE) {
    tx.abort();
    throw new Error("QUEUE_FULL");
  }
  await tx.store.put(item);
  await tx.done;
}
```

**Leçon / Règle :**
R4 s'applique aussi aux operations IndexedDB : count + put, get + put, et tout pattern check-then-write doit s'executer dans la meme transaction IndexedDB. IndexedDB dispose de transactions pour cette raison. Ne pas confondre "base de donnees locale" avec "pas besoin d'atomicite".

---

### ERR-025 — Sync : delai de retry calcule depuis createdAt au lieu de lastAttemptAt
**Sprint :** 29-30 | **Date :** 2026-03-21
**Sévérité :** Haute
**Fichier(s) :** `src/lib/offline/sync.ts` (ligne 106), `src/lib/offline/db.ts`, `src/lib/offline/queue.ts`

**Symptôme :**
Le calcul du delai de backoff exponentiel entre les tentatives de synchronisation utilise `createdAt` (date de creation de l'item dans la queue) au lieu de `lastAttemptAt` (date de la derniere tentative). Un item cree il y a plusieurs heures mais avec une seule tentative recente peut se voir attribuer un delai incorrect, causant soit des retries trop frequents soit des retries indefiniment bloques.

**Cause racine :**
Le champ `lastAttemptAt` n'existe pas dans le schema `QueueItem` dans `db.ts`. La logique de retry dans `sync.ts` utilise le seul timestamp disponible (`createdAt`) faute d'alternative. C'est a la fois un bug de schema et un bug de logique.

**Fix :**
1. Ajouter `lastAttemptAt: number | null` au type `QueueItem` dans `db.ts`.
2. Mettre a jour `lastAttemptAt` a chaque tentative dans `sync.ts` (via un `put` avant de tenter la requete).
3. Calculer le delai de retry depuis `lastAttemptAt` (ou `createdAt` si `lastAttemptAt` est null pour la premiere tentative) :
```typescript
const baseTime = item.lastAttemptAt ?? item.createdAt;
const delay = Math.min(BASE_DELAY_MS * 2 ** item.retryCount, MAX_DELAY_MS);
if (Date.now() - baseTime < delay) continue; // pas encore le moment
```

**Leçon / Règle :**
Dans tout systeme de retry avec backoff, le delai doit etre calcule depuis le dernier echec (`lastAttemptAt`), pas depuis la creation (`createdAt`). Ces deux timestamps ont des semantiques differentes. Lors de la conception d'un schema de queue, toujours inclure `lastAttemptAt`, `retryCount` et `status` comme champs obligatoires.

---

### ERR-026 — TypeScript : IdempotencyResult non discrimine — statusCode potentiellement undefined
**Sprint :** 29-30 | **Date :** 2026-03-21
**Sévérité :** Moyenne
**Fichier(s) :** `src/lib/offline/idempotency.ts`

**Symptôme :**
Le type `IdempotencyResult` n'est pas une union discriminante. Le champ `statusCode` peut etre `undefined` meme dans les branches ou il est attendu. TypeScript ne peut pas affiner le type dans les switch/if, forcant des assertions non nulles (`!`) ou des verifications redondantes.

**Cause racine :**
Le type a ete defini comme une interface plate avec des champs optionnels au lieu d'une union discriminante avec un champ litterale commun (`kind` ou `type`).

**Fix :**
Refactoriser en union discriminante :
```typescript
// Incorrect (interface plate) :
interface IdempotencyResult {
  found: boolean;
  statusCode?: number;
  body?: unknown;
}

// Correct (union discriminante) :
type IdempotencyResult =
  | { kind: "HIT"; statusCode: number; body: unknown }
  | { kind: "MISS" };

// Usage :
if (result.kind === "HIT") {
  return new Response(JSON.stringify(result.body), { status: result.statusCode });
  // TypeScript sait que statusCode est number ici
}
```

**Leçon / Règle :**
Toute interface representant un resultat a plusieurs etats mutuellement exclusifs (trouve/non trouve, succes/echec, ok/erreur) doit etre une union discriminante TypeScript avec un champ litterale (`kind`, `type`, `status`). Les interfaces plates avec champs optionnels forcent des verifications defensives a chaque usage et masquent les etats invalides. Lors de la creation d'un type de resultat, se demander : "tous les champs ont-ils du sens dans tous les etats ?" Si non, utiliser une union discriminante.

---

### ERR-027 — API deprecie : navigator.platform au lieu de navigator.userAgentData
**Sprint :** 29-31 | **Date :** 2026-03-21
**Sévérité :** Moyenne
**Fichier(s) :** `src/hooks/use-install-prompt.ts` (ligne 48)

**Symptôme :**
Le hook utilise `navigator.platform` pour detecter iOS et ainsi conditionner l'affichage du prompt d'installation PWA. `navigator.platform` est marque comme deprecie dans les specs et peut retourner des valeurs incorrectes ou vides sur les navigateurs recents.

**Cause racine :**
`navigator.platform` etait la solution standard pour la detection de plateforme avant l'introduction de `navigator.userAgentData`. Son utilisation persiste par habitude ou copie d'exemples anciens.

**Fix :**
Utiliser `navigator.userAgentData` avec fallback sur `navigator.platform` pour la compatibilite :
```typescript
function isIOS(): boolean {
  // Priorite a l'API moderne (Chrome 90+, Edge 90+)
  if ("userAgentData" in navigator) {
    return (navigator as Navigator & { userAgentData: { platform: string } })
      .userAgentData.platform === "iOS";
  }
  // Fallback legacy
  return /iPhone|iPad|iPod/.test(navigator.platform);
}
```

**Leçon / Règle :**
Ne pas utiliser `navigator.platform` dans le nouveau code. Utiliser `navigator.userAgentData.platform` (avec fallback) pour la detection de plateforme. Plus generalement, avant d'utiliser une API navigateur, verifier son statut de depreciation sur MDN. Les APIs deprecated peuvent disparaitre silencieusement dans les mises a jour navigateur.

---

### ERR-032 — Next.js 16+ : `revalidateTag` requiert 2 arguments (faux positif de review)
**Sprint :** 46 | **Date :** 2026-04-04
**Sévérité :** Basse (faux positif)
**Fichier(s) :** `src/app/api/*/route.ts`, tout fichier appelant `revalidateTag`

**Symptôme :**
Un reviewer signale `revalidateTag(tag, {})` comme un bug ("le deuxième argument n'existe pas"). Mais le build passe sans erreur et l'invalidation fonctionne correctement.

**Cause racine :**
L'API `revalidateTag` a changé entre les versions Next.js. En Next.js 14, la signature est `revalidateTag(tag: string)` (1 argument). En Next.js 16.1.6+, la signature est `revalidateTag(tag: string, profile: string | CacheLifeConfig)` (2 arguments requis). Passer `{}` comme deuxième argument est valide pour le profil par défaut.

**Fix :**
Aucun fix nécessaire si le projet utilise Next.js 16.1.6+. Vérifier la version dans `package.json` avant de signaler ce pattern comme bug.

**Leçon / Règle :**
Avant de signaler l'usage d'un argument "non existant" sur une API Next.js, vérifier la version du package dans `package.json`. Les signatures des APIs Next.js évoluent entre versions majeures. Un appel à `revalidateTag(tag, {})` est correct en Next.js 16+ et incorrect en Next.js 14. Ne pas supposer la version à partir de la documentation en ligne — lire `package.json` en priorité.

---

### ERR-031 — R2 : `as keyof typeof` pour accéder à un objet constant indexé par enum (Story 46.1)
**Sprint :** 46 | **Date :** 2026-04-04
**Sévérité :** Moyenne
**Fichier(s) :** `src/lib/abonnements/check-subscription.ts`

**Symptôme :**
Accès à `PLAN_LIMITES` via `PLAN_LIMITES[plan.typePlan as keyof typeof PLAN_LIMITES]`. Pas d'erreur TypeScript immédiate mais le cast `as keyof typeof` contourne le système de types : si la valeur de l'enum ou le type de l'objet constant divergent, le compilateur ne détecte pas la régression.

Variante additionnelle (Stories 46.2-46.3) : `PLAN_LIMITES[plan.typePlan as string]`. Le cast `as string` est encore plus permissif que `as keyof typeof` — TypeScript n'émet aucune erreur mais l'accès est complètement découplé du système de types. Les deux casts (`as string` et `as keyof typeof`) sont des violations R2 équivalentes.

**Cause racine :**
Variante de la violation R2 déjà documentée en ERR-018 : au lieu d'une string littérale en dur, on utilise ici un cast de type pour accéder à l'objet constant. Le résultat est identique — la valeur d'enum n'est pas utilisée via l'enum importé, ce qui découple l'accès du système de types.

**Fix :**
```typescript
// Incorrect — cast as keyof typeof :
const limites = PLAN_LIMITES[plan.typePlan as keyof typeof PLAN_LIMITES];

// Incorrect — cast as string (tout aussi problématique) :
const limites = PLAN_LIMITES[plan.typePlan as string];

// Correct (enum comme clé, avec import explicite) :
import { TypePlan } from "@/types";
const limites = PLAN_LIMITES[plan.typePlan as TypePlan];
// ou, si la valeur est une constante connue :
const limites = PLAN_LIMITES[TypePlan.DECOUVERTE];
```

**Leçon / Règle :**
Voir ERR-018 pour la règle générale. Cette entrée couvre deux variantes du même anti-pattern : `as keyof typeof OBJ` et `as string`. Les deux sont des violations R2. Toujours utiliser `as TypeEnum` (le type de l'enum importé) si un cast est nécessaire. Si l'objet constant est `Record<TypePlan, ...>`, TypeScript accepte directement `PLAN_LIMITES[valeurTypee]` sans cast dès que la variable est typée `TypePlan`.

**Voir aussi :** ERR-018 (même pattern avec string littérale en dur), Sprint 37.

---

### ERR-030 — R4 : quota check + création de ressource dans des transactions séparées (Story 46.1)
**Sprint :** 46 | **Date :** 2026-04-04
**Sévérité :** Haute
**Fichier(s) :** `src/app/api/vagues/route.ts`

**Symptôme :**
La route `POST /api/vagues` effectuait le check de quota dans une fonction externe (`checkSubscription`) puis créait la vague dans un appel Prisma séparé. Deux requêtes concurrentes peuvent passer le check simultanément et créer toutes les deux une vague, dépassant silencieusement la limite du plan.

**Cause racine :**
Nouveau pattern de violation R4 : la séparation n'est pas un `findFirst` + `update` classique (ERR-005) mais un appel de service externe + create. La logique de quota est encapsulée dans `checkSubscription`, ce qui masque le fait que check et création ne sont pas dans la même transaction.

**Fix :**
Inliner la création de la vague à l'intérieur de la même `$transaction` que le check de quota, sur le modèle de la route `/api/bacs` :

```typescript
// Avant (non-atomique) :
const quotaCheck = await checkSubscription(siteId, "VAGUE");
if (!quotaCheck.allowed) return NextResponse.json(..., { status: 403 });
const vague = await prisma.vague.create({ data });

// Après (atomique) :
const vague = await prisma.$transaction(async (tx) => {
  const count = await tx.vague.count({ where: { siteId } });
  if (count >= plan.limiteVagues) throw new Error("QUOTA_ATTEINT");
  return tx.vague.create({ data });
});
```

**Leçon / Règle :**
R4 s'applique dès que la décision de créer/modifier dépend d'un état lu en base, même si le check est encapsulé dans une fonction de service externe. L'encapsulation ne confère pas l'atomicité. Avant d'appeler un service de check suivi d'une mutation, se demander : "ces deux opérations sont-elles dans la même transaction ?". Si non, et si la cohérence est requise, les réunir dans `prisma.$transaction`.

**Voir aussi :** ERR-016 (même pattern sur `/api/bacs`, fix de référence), ERR-005 (R4 générale).

---

### ERR-029 — Double `unstable_cache` imbriqué sur le même tag (anti-pattern cache)
**Sprint :** 46 | **Date :** 2026-04-04
**Sévérité :** Haute
**Fichier(s) :** `src/lib/queries/abonnements.ts`, `src/lib/abonnements/check-subscription.ts`

**Symptôme :**
Deux fonctions wrappent leur résultat avec `unstable_cache` en utilisant le même tag (ex: `["abonnement", siteId]`). La fonction de plus haut niveau (`checkSubscription`) encapsule une fonction déjà cachée (`getAbonnementActif`). Les deux caches peuvent diverger : une invalidation via `revalidateTag` purge le cache interne mais pas nécessairement le cache externe, ou vice versa, selon l'ordre d'appel et la durée de vie respective.

**Cause racine :**
Le wrapping `unstable_cache` a été appliqué mécaniquement à plusieurs niveaux d'abstraction sans vérifier si les niveaux inférieurs étaient déjà cachés. Le cache Next.js `unstable_cache` est composable mais pas transparent : deux caches imbriqués avec le même tag ne se comportent pas comme un seul cache — ils créent deux entrées distinctes dans le cache Next.js.

**Fix :**
Cacher uniquement au niveau le plus bas (la requête Prisma), pas au niveau du wrapper de service :

```typescript
// src/lib/queries/abonnements.ts — cache ici (niveau bas) :
export const getAbonnementActif = unstable_cache(
  async (siteId: string) => prisma.abonnement.findFirst({ where: { siteId, statut: "ACTIF" } }),
  ["abonnement-actif"],
  { tags: ["abonnement"] }
);

// src/lib/abonnements/check-subscription.ts — PAS de cache ici (niveau haut) :
export async function checkSubscription(siteId: string, ressource: string) {
  const abonnement = await getAbonnementActif(siteId); // déjà caché
  // ... logique de check ...
}
```

**Leçon / Règle :**
`unstable_cache` se place au niveau de la requête de données (queries), pas au niveau des fonctions de service ou des wrappers de logique métier. Si une fonction de service appelle une query déjà cachée, ne pas ajouter un deuxième `unstable_cache` sur le service. Un seul niveau de cache par chemin de données. Les tags d'invalidation (`revalidateTag`) ne traversent pas les caches imbriqués de façon fiable.

---

### ERR-035 — Filter-before-map : filtrer les nullables avant le mapping, pas après (FCR refactor)
**Sprint :** ADR-028 | **Date :** 2026-04-05
**Sévérité :** Basse
**Fichier(s) :** `src/lib/calculs/fcr.ts` (ou équivalent calculs aliment)

**Symptôme :**
`biometriePoints` était construit avec `.map(b => b.poids ?? 0).filter(p => p > 0)`. Si le `.filter` est un jour retiré par erreur (refactoring, simplification), des valeurs `0` silencieuses entrent dans les calculs de biomasse ou d'interpolation, produisant des résultats faux sans erreur TypeScript ni runtime.

**Cause racine :**
Le mapping transforme `null` en `0` avant le filtre, créant un état intermédiaire sémantiquement incorrect (`0` n'est pas la même chose que "donnée absente"). La correction de l'absence est portée par le `.filter` qui suit, mais ce couplage est fragile : retirer le filtre ne produit aucun avertissement.

**Fix :**
Filtrer les nulls avant le mapping :
```typescript
// Incorrect (filter après map — fragile) :
const biometriePoints = biometries
  .map(b => b.poids ?? 0)
  .filter(p => p > 0);

// Correct (filter avant map — robuste) :
const biometriePoints = biometries
  .filter((b): b is typeof b & { poids: number } => b.poids !== null && b.poids > 0)
  .map(b => b.poids);
```

**Leçon / Règle :**
Ne jamais transformer une valeur nulle en valeur sentinelle (0, "", -1) pour la filtrer ensuite. Filtrer les nulls en premier avec un type guard, puis mapper uniquement des valeurs valides. Le pattern `map(null → 0).filter(> 0)` est sémantiquement incorrect et fragile : un refactoring anodin qui retire le filtre introduit silencieusement des données invalides dans les calculs.

---

### ERR-034 — Agrégation de qualité/confiance : utiliser le pire cas, pas le meilleur (FCR refactor)
**Sprint :** ADR-028 | **Date :** 2026-04-05
**Sévérité :** Moyenne
**Fichier(s) :** `src/lib/calculs/fcr.ts` (ou équivalent calculs aliment)

**Symptôme :**
La `methodeEstimation` d'une période était dérivée en prenant le `max` du rang de précision des méthodes utilisées aux deux bornes de la période (biométrie exacte > interpolation > extrapolation). Utiliser le max revient à annoncer la méthode la plus précise, ce qui surestime la confiance réelle de l'estimation.

**Cause racine :**
L'intuition "prendre le max pour avoir la meilleure représentation" est incorrecte pour une métrique de qualité/confiance où la qualité de l'ensemble est limitée par le maillon le plus faible. Si une borne de la période est extrapolée, toute la période est de qualité "extrapolation", peu importe la précision de l'autre borne.

**Fix :**
Utiliser `min` (pire cas) pour l'agrégation de méthodes d'estimation :
```typescript
// Incorrect (max = surclasse la confiance réelle) :
const methodeEstimation = [methodeDebut, methodeFin]
  .map(m => PRECISION_RANK[m])
  .reduce((a, b) => Math.max(a, b));

// Correct (min = conservateur, borne inférieure de qualité) :
const methodeEstimation = [methodeDebut, methodeFin]
  .map(m => PRECISION_RANK[m])
  .reduce((a, b) => Math.min(a, b));
```

**Leçon / Règle :**
Quand on agrège des indicateurs de qualité, précision ou confiance provenant de plusieurs sources, toujours utiliser le **pire cas** (min, worst-case) comme valeur consolidée. La qualité globale est limitée par l'estimation la moins précise, pas par la plus précise. Ce principe s'applique à toute fonction d'estimation, interpolation, ou calcul basé sur plusieurs points de mesure de qualités hétérogènes.

---

### ERR-033 — Interpolation : extrapolation étiquetée "BIOMETRIE_EXACTE" (FCR refactor)
**Sprint :** ADR-028 | **Date :** 2026-04-05
**Sévérité :** Haute
**Fichier(s) :** `src/lib/calculs/fcr.ts` (ou équivalent calculs aliment)

**Symptôme :**
La fonction `interpolerPoidsBac` retournait `methode: "BIOMETRIE_EXACTE"` lorsque la date cible était postérieure à toutes les biométries disponibles (cas d'extrapolation). L'appelant recevait une estimation extrapolée avec une étiquette de confiance maximale, ce qui pouvait conduire à des décisions basées sur des données présentées comme plus fiables qu'elles ne l'étaient.

**Cause racine :**
La branche de code gérant le cas "date cible après la dernière biométrie" copiait le retour de la branche "date cible exactement sur un point de mesure" (match exact = `BIOMETRIE_EXACTE`) sans adapter la valeur de `methode`. L'extrapolation et la lecture exacte étaient traitées de façon identique dans le label retourné.

**Fix :**
Retourner `"INTERPOLATION_LINEAIRE"` (ou un label dédié `"EXTRAPOLATION"`) pour les cas hors des bornes connues :
```typescript
// Incorrect (extrapolation labellisée comme lecture exacte) :
if (dateTarget > dernierPoint.date) {
  return { poids: dernierPoint.poids, methode: "BIOMETRIE_EXACTE" }; // FAUX
}

// Correct (label reflète la nature de l'estimation) :
if (dateTarget > dernierPoint.date) {
  return { poids: dernierPoint.poids, methode: "INTERPOLATION_LINEAIRE" };
  // ou : methode: "EXTRAPOLATION" si le type le supporte
}
```

**Leçon / Règle :**
Dans toute fonction d'interpolation/extrapolation, chaque branche de retour doit porter un label `methode` qui correspond à ce que la branche fait réellement :
- Date exacte sur un point mesuré → `"BIOMETRIE_EXACTE"`
- Date entre deux points → `"INTERPOLATION_LINEAIRE"`
- Date avant ou après toutes les mesures → `"INTERPOLATION_LINEAIRE"` ou `"EXTRAPOLATION"` (jamais `"BIOMETRIE_EXACTE"`)

L'exactitude du label de méthode est aussi importante que l'exactitude de la valeur calculée : les appelants utilisent ce label pour communiquer la confiance aux utilisateurs finaux.

---

### ERR-028 — SW : listener controllerchange non retire au cleanup du composant React
**Sprint :** 27 | **Date :** 2026-03-21
**Sévérité :** Basse (fuite memoire)
**Fichier(s) :** `src/components/sw-register.tsx`

**Symptôme :**
Le `useEffect` qui enregistre le Service Worker ajoute un listener `controllerchange` sur `navigator.serviceWorker` mais ne le retire pas dans la fonction de cleanup. En mode strict React (double montage/demontage en dev) ou lors de la navigation, le listener s'accumule et peut declencher des rappels multiples lors d'un changement de controleur.

**Cause racine :**
Le pattern `addEventListener` sans `removeEventListener` correspondant dans le return du `useEffect` est une fuite memoire classique. Particulierement impactant ici car `navigator.serviceWorker` est un objet global — le listener persiste apres le demontage du composant.

**Fix :**
```typescript
useEffect(() => {
  if (!("serviceWorker" in navigator)) return;

  const handleControllerChange = () => {
    window.location.reload();
  };

  navigator.serviceWorker.addEventListener("controllerchange", handleControllerChange);

  // Cleanup obligatoire — evite les fuites et les doubles declenchements
  return () => {
    navigator.serviceWorker.removeEventListener("controllerchange", handleControllerChange);
  };
}, []);
```

**Leçon / Règle :**
Tout `addEventListener` dans un `useEffect` React doit avoir son `removeEventListener` correspondant dans le return du cleanup. Cette regle s'applique a tous les objets globaux (window, document, navigator.serviceWorker, etc.). Les objets globaux ne sont pas garbage collectes avec le composant — leurs listeners survivent au demontage. Verifier systematiquement chaque `useEffect` contenant un `addEventListener` lors de la review de composants PWA/SW.

---

### ERR-090 — Route handler duplique la query layer et oublie le dual-write ADR-043 AssignationBac
**Sprint :** Bugfixing | **Date :** 2026-04-23
**Sévérité :** Haute
**Fichier(s) :**
- `src/app/api/vagues/route.ts`
- `src/__tests__/api/vagues-distribution.test.ts`
- `src/__tests__/api/vagues-bug041-assignation-dual-write.test.ts`
- `scripts/repair-bug041.sql`

**Symptôme :**
Après création d'une vague avec distribution sur un ou plusieurs bacs via `POST /api/vagues`, la liste des vagues affiche « 0 bac » pour la vague nouvellement créée. Le bac est pourtant bien lié via `Bac.vagueId`. Le problème disparaît après redémarrage ou réassignation manuelle.

**Cause racine :**
Le route handler `POST /api/vagues` réimplémente sa propre transaction Prisma au lieu de déléguer à `createVague()` dans `src/lib/queries/vagues.ts`. Dans cette transaction, seul `tx.bac.update({ vagueId })` est exécuté ; l'écriture parallèle `tx.assignationBac.create({ bacId, vagueId, dateDebut, dateFin: null })` imposée par ADR-043 (dual-write) a été omise. Or la requête de liste utilise `_count.assignations` pour afficher le nombre de bacs → renvoie 0.

Le test de distribution existant mockait `assignationBac.create` mais n'assertait jamais son appel : la régression est passée silencieusement. C'est la version « write » du jumeau [ERR-089](#err-089) (qui corrigeait la version « read »).

**Fix :**
1. Ajouter `tx.assignationBac.create({ data: { bacId, vagueId, dateDebut: vague.dateDemarrage, siteId } })` dans la transaction POST pour chaque bac assigné.
2. Ajouter une assertion `expect(tx.assignationBac.create).toHaveBeenCalledWith(...)` dans `vagues-distribution.test.ts`.
3. Ajouter un test de non-régression dédié `vagues-bug041-assignation-dual-write.test.ts` couvrant mono-bac et multi-bacs.
4. Script `scripts/repair-bug041.sql` pour régénérer les `AssignationBac` manquantes sur les données déjà créées en prod.

**Leçon / Règle :**
- **Ne jamais mocker une méthode Prisma dans un test sans au moins une assertion `toHaveBeenCalled` sur le chemin success.** Un mock silencieux masque les omissions d'écriture.
- **Toute mutation de données doit être déléguée à `src/lib/queries/*`**, jamais réimplémentée dans un route handler. Si le handler a besoin d'une variante, étendre la query layer, pas dupliquer la logique.
- Lorsqu'un ADR impose un dual-write (FK directe + table associative), ajouter une assertion jumelle côté read ET côté write dans la suite de tests.

**Références :** [BUG-041](../bugs/BUG-041.md) | [ERR-089](#err-089-—-lecture-dual-source-en-mode-tout-ou-rien-adr-043-bacassignationbac) | [ADR-043](../decisions/ADR-043-bac-vague-associative-model.md)

---

### ERR-091 — Radix Dialog : scroll par défaut absent sur mobile, submit inaccessible
**Sprint :** Bugfixing | **Date :** 2026-04-23
**Sévérité :** Haute
**Fichier(s) :**
- `src/components/ui/dialog.tsx`
- `src/components/ui/__tests__/dialog-scroll.test.tsx`

**Symptôme :**
Sur mobile (375×812, iOS/Android), le bouton « Créer » / « Enregistrer » de ~51 dialogs (dont « Nouvelle vague ») est inatteignable : le contenu déborde sous le bas du viewport et la dialog ne scroll pas. Le problème ne se manifeste pas sur desktop (≥ md).

**Cause racine :**
Le wrapper partagé `DialogContent` appliquait `md:max-h-[85dvh]` (desktop uniquement) et aucune règle d'overflow par défaut. Radix Dialog n'impose **aucun scroll** nativement sur son content. Le scroll était opt-in via un composant interne `<DialogBody>` que seuls 19/70 dialogs utilisaient — les 51 autres (dont les formulaires de création) n'avaient donc aucun scroll mobile. Violation R-mobile (mobile-first).

**Fix :**
Appliquer par défaut sur `DialogContent` :
```tsx
// mobile-first : prend tout le viewport, scrollable
"h-[100dvh] max-h-[100dvh] overflow-y-auto"
// desktop : revient à la modale centrée
"md:h-auto md:max-h-[85dvh]"
```
Et sur `DialogFooter` : `sticky bottom-0 bg-card` pour que les actions restent visibles pendant que le formulaire scrolle. Préserver `padding-bottom: env(safe-area-inset-bottom)` sur le footer pour iOS.

**Leçon / Règle :**
- **Ne jamais rendre le scroll mobile opt-in.** Tout wrapper de dialog/sheet/drawer DOIT scroller par défaut sur mobile, et imposer un footer sticky si le composant expose un footer.
- Les règles `max-h-*` doivent cibler mobile d'abord (`max-h-[100dvh]`), puis desktop via `md:`. L'inverse laisse des trous silencieux.
- Toujours préserver `env(safe-area-inset-bottom)` sur tout élément sticky/fixed en bas de viewport.
- Un test d'accessibilité doit vérifier que le submit est atteignable à 375px de hauteur réduite (`container.scrollTo(...)` + `isVisible`).

**Références :** [BUG-042](../bugs/BUG-042.md)

---

### ERR-092 — Mobile web : bottom nav jitter + safe-area transparente sans backdrop global
**Sprint :** Bugfixing | **Date :** 2026-04-23
**Sévérité :** Moyenne
**Fichier(s) :**
- `src/components/layout/farm-bottom-nav.tsx`
- `src/components/layout/ingenieur-bottom-nav.tsx`
- `src/components/layout/bottom-nav-skeleton.tsx`
- `src/app/globals.css`
- `src/components/layout/__tests__/bottom-nav.test.tsx`

**Symptôme :**
Sur navigateur mobile (non-PWA, Safari iOS / Chrome Android), deux glitches visuels sur la bottom nav fixée :
1. **Jitter** : saccades pendant l'animation de la barre d'URL (show/hide du chrome).
2. **Safe-area transparente** : la bande `env(safe-area-inset-bottom)` (home indicator iOS) laisse transparaître le fond `var(--surface-0)` du `body` au lieu d'afficher `var(--card)` de la nav.

**Cause racine :**
- **(A) Jitter** : `position: fixed` est ancré au *visual viewport* sur mobile. Sans promotion GPU (`translateZ(0)`), le navigateur repeint la nav à chaque frame d'animation du chrome URL.
- **(B) Safe-area** : la règle `bg-card` de la nav peint uniquement la *box* de la nav. La bande `env(safe-area-inset-bottom)` est située *sous* cette box (padding-bottom du body) → ne reçoit aucun background. Aucun backdrop global ne garantit `var(--card)` dans cette bande.

**Fix :**
1. Ajouter `[transform:translateZ(0)] will-change-transform` aux trois variantes de nav (farm, ingenieur, skeleton) pour les promouvoir en couche GPU.
2. Ajouter dans `globals.css` une règle mobile-only peignant la safe-area :
```css
@media (max-width: 767px) {
  body::after {
    content: "";
    position: fixed;
    left: 0; right: 0; bottom: 0;
    height: env(safe-area-inset-bottom);
    background: linear-gradient(var(--card), var(--card));
    background-attachment: fixed;
    pointer-events: none;
    z-index: 40; /* sous la nav, au-dessus du body */
  }
}
```

**Leçon / Règle :**
- **Ne jamais compter sur le `bg-*` d'un élément fixed pour couvrir la safe-area.** La safe-area est *hors* de la box de l'élément — prévoir un backdrop global (`body::after`, `html` background ou `<div>` dédié).
- **Toute élément `position: fixed` susceptible d'être animé sur mobile doit être promu en couche GPU** via `transform: translateZ(0)` + `will-change: transform`. Sans ça, le browser repaint à chaque transition du chrome URL.
- Tester systématiquement sur Safari iOS *et* Chrome Android avec barre d'URL visible/masquée — les deux navigateurs déclenchent le jitter différemment.

**Références :** [BUG-043](../bugs/BUG-043.md)

**Addendum v2 (2026-04-23) — iOS Safari ignore `background-attachment: fixed`** :
Le fix v1 utilisait `linear-gradient` + `background-attachment: fixed` sur `body`. **iOS Safari ignore `background-attachment: fixed`** (décision historique MDN pour raisons perf) et Chrome Android a un support incohérent — le dégradé ne se "fixait" jamais en bas du viewport visuel sur mobile réel.

Pattern corrigé (v2, à utiliser désormais) : pseudo-élément `position: fixed` dédié, **sans** `background-attachment` :
```css
@media (max-width: 767px) {
  html::after {
    content: "";
    position: fixed;
    left: 0; right: 0; bottom: 0;
    height: env(safe-area-inset-bottom);
    background: var(--card);        /* couleur unie, pas de gradient nécessaire */
    pointer-events: none;
    z-index: 39;                    /* juste sous la nav à z-40 */
  }
}
```

Note architecturale : `html::after` est préférable à `body::after` ici car `body::before` est déjà utilisé par le grain noise overlay. Utiliser deux pseudo-éléments du même élément peut être gérable mais `html::after` évite toute ambiguïté.

**Règle additionnelle :** **ne jamais utiliser `background-attachment: fixed` pour peindre quelque chose de visible en bas du viewport mobile**. Toujours préférer un élément/pseudo-élément `position: fixed` — compatible iOS + Android.
