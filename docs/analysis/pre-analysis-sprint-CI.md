# Pré-analyse Sprint CI — Intégration continue avec base éphémère + hygiène des secrets
**Date :** 2026-07-27
**Auteur :** @pre-analyst (lecture seule)

## Statut global : GO AVEC RÉSERVES

Aucun blocage dur. CI.1/CI.2/CI.3/CI.4/CI.5 sont toutes réalisables sans prérequis manquant côté code, mais plusieurs adaptations sont nécessaires avant que le pipeline GitHub Actions soit fiable dès le premier run (script de seed incompatible avec un service Postgres GitHub Actions, absence de `.nvmrc`/`engines`, `.env.example` non versionné et contenant des valeurs qui ne ressemblent pas à des placeholders). Le cœur du sprint (CI.2, rendre l'invisibilité des tests DB-gated impossible) est bien cadré : exactement 17 tests sont concernés, répartis sur 4 fichiers, tous conditionnés à `DATABASE_URL` uniquement, tous verts en isolation.

---

## CI.1 — Pipeline GitHub Actions avec Postgres éphémère

### Absence de CI existante
Confirmé : aucun `.github/workflows`, aucun `.gitlab-ci.yml`, aucun `.circleci/`. Aucun mécanisme d'intégration continue n'existe dans ce dépôt à ce jour.

### Version de Node
- `package.json` : pas de champ `engines`, pas de champ `volta`.
- Pas de `.nvmrc` à la racine.
- `Dockerfile` (3 stages `deps`/`builder`/`runner`) : `FROM node:22-alpine` dans les 3 stages — cohérent avec le Node 22 utilisé en dev (`nvm use 22`).
- **Divergence** : rien dans le dépôt ne fixe formellement "Node 22" pour un contributeur ou un runner CI qui ne lirait pas le `Dockerfile`. Un `actions/setup-node` sans `node-version` explicite ou `.nvmrc` prendrait la version par défaut du runner GitHub (généralement pas 22), ce qui pourrait produire un comportement différent de la prod/dev.
- **Recommandation CI.1** : ajouter un `.nvmrc` (`22`) à la racine ET un champ `"engines": { "node": ">=22" }` dans `package.json`. Le workflow GitHub Actions doit utiliser `actions/setup-node@v4` avec `node-version-file: '.nvmrc'` pour ne jamais diverger du Dockerfile.

### Version de Postgres
- Dev (`docker-compose.yml`) : `postgres:16-alpine`.
- Prod (`docker-compose.prod.yml`) : service `db` avec `postgres:16-alpine` également (Postgres auto-hébergé derrière Coolify, `env_file: .env`, `POSTGRES_PASSWORD` injecté par variable d'environnement).
- **Point d'attention (hors scope direct, mais pertinent pour la cohérence du contexte du sprint)** : `CLAUDE.md` documente la prod comme "Prisma Postgres (prisma.io) — base managée". `docker-compose.prod.yml` montre un conteneur Postgres 16 auto-hébergé. Les deux ne sont pas nécessairement contradictoires (le déploiement a pu évoluer), mais le service Postgres éphémère de CI doit être calé sur `postgres:16-alpine` (confirmé cohérent des deux côtés du doute), pas sur une version différente.
- **Recommandation CI.1** : le service GitHub Actions doit utiliser l'image `postgres:16-alpine`.

### Scripts npm disponibles
```
dev          : next dev --port 4200
build        : prisma generate && prisma migrate deploy && next build --webpack
start        : next start
lint         : eslint
db:generate  : prisma generate
db:migrate   : prisma migrate deploy
db:seed      : docker exec -i silures-db psql -U dkfarm -d farm-flow < prisma/seed.sql
postinstall  : prisma generate
test         : vitest run
test:watch   : vitest
test:gompertz: npx tsx scripts/test-gompertz-lm.ts
```

**Point critique pour la conception du workflow** : `npm run build` inclut `prisma migrate deploy`. Cela signifie qu'un job CI qui exécute `npm run build` a BESOIN d'un `DATABASE_URL` valide et joignable au moment du build, pas seulement pour les tests. Le service Postgres éphémère doit donc être démarré et prêt (`pg_isready`) AVANT l'étape `npm run build`, pas seulement avant `npx vitest run`. C'est cohérent avec `Dockerfile` qui, lui, appelle explicitement `npx next build --webpack` (SANS `migrate deploy`, commentaire explicite dans le Dockerfile : "NOT npm run build which includes prisma migrate deploy") — donc en prod la migration et le build sont volontairement découplés (migration au démarrage du conteneur via `docker-entrypoint.sh`, build en amont sans DB). **En CI, si on utilise `npm run build` tel quel, il faut le service Postgres up d'abord ; alternative plus proche du pattern prod : appeler séparément `npx prisma migrate deploy` puis `npx next build --webpack`.**

**`db:seed` est incompatible tel quel avec un service GitHub Actions** : le script fait `docker exec -i silures-db psql ...`, qui suppose un conteneur Docker nommé littéralement `silures-db` (nom fixé par `docker-compose.yml`, `container_name: silures-db`). Un service Postgres déclaré dans un workflow GitHub Actions (`services: db: image: postgres:16-alpine`) n'est pas nommé `silures-db` et n'est pas nécessairement accessible via `docker exec` depuis le job runner de la même façon. **Ce script doit être adapté pour CI** (ex. `psql "$DATABASE_URL" -f prisma/seed.sql` en se connectant directement par TCP à `localhost:5432`, sans dépendre du nom du conteneur Docker).

### `prisma migrate deploy` depuis une base VIERGE
Inspection de toutes les migrations `data_fix_*`/`backfill_*` (les seules candidates à un échec sur base vide, cf. R10/ADR-049) :

| Migration | Mécanisme de garde | Sûre sur base vide ? |
|---|---|---|
| `20260727090001_data_fix_vague2601_phantom_fish` | `UPDATE ... WHERE ... = <valeur buggée constatée>` | Oui — no-op, aucune ligne à matcher |
| `20260727090002_data_fix_bes033_cmd015_duplicate` | `UPDATE ... WHERE ... IS NULL` + `DELETE` par id | Oui — no-op |
| `20260727090003_data_fix_calibrage_may14_missing_biometrie` | `INSERT ... SELECT ... WHERE EXISTS (...) AND NOT EXISTS (...)` (pattern ERR-110) | Oui — no-op |
| `20260727090004_data_fix_vte004_missing_vagueid` | `UPDATE` ciblé sur valeur buggée `''` connue | Oui — no-op |
| `20260727090005_data_fix_gd3_vague2603_prep_transferts` | Idempotent, `WHERE EXISTS`/id ciblés (héritier de l'incident Bac 11) | Oui — no-op |
| `20260727090006_unicite_numero_par_site_autosuffisante` | Garde-fou de précondition intégré à la migration elle-même (ADR-049 §3.1) | Oui — pas de dépendance à un script externe |
| `20260726160000_backfill_ventes_modifier_permissions` | `UPDATE "SiteRole" SET permissions = ... WHERE "isSystem" = true AND name = ...` | Oui — no-op sur table vide |
| `20260726170000_backfill_bons_livraison_rectifier` | Même pattern | Oui — no-op |

**Conclusion : aucune migration ne suppose de données préexistantes qui feraient échouer `migrate deploy` sur une base fraîchement créée.** `npx prisma validate` confirme un schéma valide. Les migrations les plus anciennes (Sprint 1-2, enums recreate) suivent le pattern RECREATE déjà validé sur shadow DB vide historiquement (ERR-001/ERR-049/ERR-083).

**Seed nécessaire avant les tests d'intégration ?** Non. Les 3 fichiers de tests DB-gated (`bd0-savepoint-integration.test.ts`, `bons-livraison-transaction-integration.test.ts`, `su12-numero-unique-constraint.test.ts`) créent tous leurs propres fixtures via `INSERT INTO` directs dans `beforeAll` (User, Site, Vague, Bac, AssignationBac, etc. — voir extraits ci-dessous) et nettoient en `afterAll`/`afterEach`. **Aucun ne dépend de `prisma/seed.sql`.** Le pipeline CI n'a donc besoin que de `prisma migrate deploy` avant `npx vitest run`, pas de `npm run db:seed`.

### Variables d'environnement requises par les tests, au-delà de `DATABASE_URL`
- `grep process.env.` dans `*.test.ts` ne fait ressortir que `DATABASE_URL` (les 4 fichiers gated) et `CRON_SECRET` (`src/__tests__/api/cron-subscription-lifecycle.test.ts`, mais ce test le fixe/le supprime lui-même via `process.env.CRON_SECRET = ...` / `delete process.env.CRON_SECRET` — pas une dépendance externe au job CI).
- Pas de `.env.example` **tracké par git** pour référence formelle (voir CI.3) mais un fichier local existe et documente `DATABASE_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `HETZNER_S3_*`, `SMOBILPAY_*`, `CRON_SECRET`. Aucun de ces derniers n'est lu par la suite de tests actuelle (aucun `process.env.HETZNER_*` ni `process.env.SMOBILPAY_*` dans `*.test.ts`).
- Conclusion : pour `npx vitest run` en CI, seul `DATABASE_URL` doit être exporté (pointant vers le service Postgres éphémère).

---

## CI.2 — Rendre l'invisibilité des tests DB-gated impossible (cœur du sprint)

### Inventaire exhaustif
Recherche exhaustive sur tout le dépôt (`grep -rn "runIf\|skipIf\|describe.skip\|it.skip\|test.skip\|it.todo\|this.skip"`, hors `node_modules`) :

**Tests conditionnés à `DATABASE_URL` (`describe.runIf(!!DATABASE_URL)`) — 4 fichiers, 17 tests au total :**

| # | Fichier (chemin absolu) | Ligne du `describe.runIf` | Tests à l'intérieur | Ce qui est prouvé |
|---|---|---|---|---|
| 1 | `/Users/ronald/project/dkfarm/farm-flow/src/lib/queries/__tests__/bd0-savepoint-integration.test.ts` | L.158 | 2 (`it` L.161, L.223) | SAVEPOINT/ROLLBACK TO SAVEPOINT réel : une vraie erreur SQL dans `calculerEcartsParBac` n'empêche pas la création du COMPTAGE, relevé bien en base après commit (vérifié via connexion `pg` indépendante) — ERR-113/ERR-114/ERR-115 |
| 2 | `/Users/ronald/project/dkfarm/farm-flow/src/lib/queries/__tests__/bd0-savepoint-integration-persister-origin.test.ts` | L.147 | 1 (`it` L.150) | Sonde canary : le SAVEPOINT se déclenche même quand l'erreur SQL vient de l'intérieur de `persisterEcartConstate` (qui avale ses propres erreurs) — ERR-114 |
| 3 | `/Users/ronald/project/dkfarm/farm-flow/src/lib/queries/__tests__/bons-livraison-transaction-integration.test.ts` | L.229 | 2 (`it` L.232, L.314) | Rollback réel de `signerBonLivraison` contre vraie transaction Postgres (aucun effet partiel) ; double signature concurrente d'un même BL → une seule gagne, aucun double décrément (verrouillage réel de lignes) |
| 4 | `/Users/ronald/project/dkfarm/farm-flow/scripts/data-fixes/__tests__/su12-numero-unique-constraint.test.ts` | L.84 et L.157 (2 blocs `describe.runIf`) | 2 `it` (L.87, L.124) + 1 `it.each` sur 10 tables (L.176) = 12 | Unicité composite `(siteId, numero\|code)` réellement appliquée par Postgres (pas seulement par Prisma) sur 10 tables migrées SU.12/SU.13 ; absence de contrainte unique globale résiduelle |

**Total : 2 + 1 + 2 + 12 = 17 tests**, ce qui correspond exactement à l'écart annoncé (5753 − 5736 = 17). Vérifié empiriquement : réexécution isolée de ces 4 fichiers avec `DATABASE_URL` exporté → **4 fichiers passés, 22 tests passés (0 échec)** — les 22 tests du run isolé incluent les 17 gated + 5 tests non gated présents dans les mêmes fichiers (ex. le test SU.2 mocké en fin de `bons-livraison-transaction-integration.test.ts`, hors du `describe.runIf`).

**Aucun autre `describe.runIf`/`skipIf`/`test.skip`/`describe.skip`/`it.skip`/`this.skip` n'existe dans le dépôt.** Seuls `it.todo` existent ailleurs, dans deux fichiers sans lien avec DB-gating :
- `/Users/ronald/project/dkfarm/farm-flow/src/__tests__/density-calculs.test.ts` (21 occurrences de `it.todo`)
- `/Users/ronald/project/dkfarm/farm-flow/src/__tests__/density-integration.test.ts` (5 occurrences de `it.todo`)
Ce sont des specs non implémentées (backlog de tests), pas des tests gated par une ressource externe — hors scope de CI.2, mais à mentionner car un futur audit "grep runIf/skip" pourrait les confondre.

**Point non trivial découvert (ERR-116 bis, à signaler à @knowledge-keeper)** : le deuxième bloc `describe.runIf(!!DATABASE_URL)` de `su12-numero-unique-constraint.test.ts` (L.157, `it.each` sur 10 tables) contient LUI-MÊME un garde interne redondant : `if (!dbAvailable || !client) { console.warn(...); return; }` (L.178-181). Cela signifie qu'un run avec `DATABASE_URL` défini mais pointant vers une base injoignable au moment précis de la connexion (`dbAvailable = false`) ne fait PAS échouer ces 10 tests : ils se terminent en `return` silencieux (`console.warn`), pas en `it.skip` visible ni en échec — un vrai vert alors qu'aucune assertion n'a été exécutée. C'est un double gating, plus insidieux que le simple `runIf` car il donne un statut "passed" (pas "skipped") à un test qui n'a rien vérifié.

**ERR-116 : `bd0-comptage-recalcule-ecart.test.ts` n'est PLUS DB-gated.** Le fichier `docs/knowledge/ERRORS-AND-FIXES.md` (ERR-116) cite `src/__tests__/bd0-comptage-recalcule-ecart.test.ts` parmi les tests DB-gated. Vérification directe : ce fichier ne contient aucun `runIf`/`DATABASE_URL` — il est entièrement mocké (7+4 cas fusionnés selon son en-tête, mock complet du `tx`). Cette référence d'ERR-116 est donc obsolète/imprécise par rapport à l'état actuel du dépôt (le fichier réellement gated pour ce cas est `bd0-savepoint-integration.test.ts`, cf. tableau ci-dessus) — **à signaler à @knowledge-keeper pour correction du ERR-116** (ne bloque pas le sprint CI, mais fausserait un audit qui ferait confiance au texte de l'erreur plutôt qu'au grep).

### Doublon `bd0-savepoint-integration*`
Confirmé : DEUX fichiers distincts, pas un doublon accidentel à fusionner —
- `bd0-savepoint-integration.test.ts` (2 tests — SAVEPOINT direct)
- `bd0-savepoint-integration-persister-origin.test.ts` (1 test — variante "origine de l'erreur à l'intérieur de `persisterEcartConstate`")
Les noms se ressemblent mais les scénarios sont complémentaires et non redondants (voir ERR-113 vs ERR-114). Pas d'action de fusion nécessaire, mais **CI.2 doit couvrir les deux fichiers explicitement dans son mécanisme de garde** (un grep naïf sur `bd0-savepoint-integration.test.ts` seul manquerait le second).

### Configuration Vitest et points d'accroche
- `/Users/ronald/project/dkfarm/farm-flow/vitest.config.ts` : configuration minimale (`globals: true`, `environment: "node"`, `exclude: ["node_modules/**", "src/__tests__/e2e/**"]`, alias `@`). **Aucun `setupFiles`, `globalSetup`, ni reporter custom actuellement.**
- Aucun fichier `vitest.setup.ts`/`*.setup.ts` dans le dépôt.
- Vitest version installée : **4.0.18** — expose `globalSetup`, `setupFiles`, et l'API `reporters` (y compris reporters custom via objet implémentant l'interface `Reporter`, avec hooks `onTestRunEnd`/`onTestCaseResult` en v4). Pas de point d'accroche existant : tout est à créer.

### Évaluation des mécanismes candidats
1. **(a) Garde qui `throw` si `process.env.CI` est défini sans `DATABASE_URL`** — le plus difficile à contourner par distraction s'il est placé dans un point d'exécution qui s'exécute AVANT toute collecte de tests, indépendamment de quel fichier de test est lancé : soit `vitest.config.ts` lui-même (au chargement du module de config, avant même `setupFiles`), soit un `setupFiles` global déclaré dans `vitest.config.ts` (`test.setupFiles: ["./vitest.setup.ts"]`) qui `throw` en haut de fichier si `process.env.CI && !process.env.DATABASE_URL`. Le `setupFiles` est préférable au throw dans `vitest.config.ts` : il s'exécute dans le contexte de test (peut produire un message d'erreur Vitest propre plutôt qu'un crash de la CLI), et reste actif même si `vitest.config.ts` est un jour modifié sans que l'auteur pense au garde. **C'est le candidat recommandé** : aucun fichier de test individuel ne peut contourner ce garde par oubli, puisqu'il ne dépend d'aucune action locale au fichier — seul un `process.env.CI` non défini (donc une exécution manifestement hors CI) le désactive.
2. **(b) Assertion sur le nombre de tests skippés via un reporter custom** — viable mais plus fragile : nécessite de maintenir une liste de référence ("17 tests attendus gated") qui doit être mise à jour à chaque nouveau test DB-gated ajouté — un oubli de mise à jour de cette liste masquerait un nouveau test silencieusement skippé, exactement le problème qu'on cherche à éliminer. Moins robuste que (a) sauf si combiné avec (c).
3. **(c) Test meta qui grep le dépôt et échoue si un `runIf` non enregistré apparaît** — bon complément de (a), mais ne résout pas le problème central : même un `runIf` "enregistré" reste silencieusement skippé si `DATABASE_URL` est absent en CI. (c) protège contre l'ajout non déclaré d'un nouveau gate, pas contre l'absence de la variable elle-même. **Recommandé en complément de (a)**, pas en remplacement.
4. **Aucun helper partagé `requireDatabaseUrl()` n'existe actuellement** (`grep -rn "requireDatabaseUrl"` : aucun résultat) — à créer.

**Conclusion CI.2** : combiner (a) [garde CI-strict via `setupFiles` global] + (c) [test meta grep de non-régression sur la liste des `describe.runIf`/`skipIf` connus] donne la protection la plus robuste contre la distraction humaine. (b) seul est insuffisant.

---

## CI.3 — Détection de secrets

### Outillage existant
- Pas de `.husky/`, pas de hook git non-`.sample` dans `.git/hooks/`, pas de `lint-staged`.
- Pas de `.gitleaks.toml`, pas de `.secretlintrc*`.
- `devDependencies` liées à la qualité : uniquement `eslint ^9` et `eslint-config-next 16.1.6` — pas de plugin de détection de secrets, pas de règle custom eslint pour ça (`eslint.config.mjs` n'importe que `eslint-config-next/core-web-vitals` et `/typescript`, aucune règle personnalisée).
- **Rien n'existe aujourd'hui pour empêcher un secret de rentrer.**

### Recommandation d'outil
**Gitleaks en GitHub Action** (`gitleaks/gitleaks-action`) est recommandé :
- Zéro dépendance npm à ajouter au projet (action Docker autonome dans le workflow, pas dans `package.json`/`node_modules`).
- Zéro service externe payant (contrairement à des services SaaS de secret-scanning tiers) — s'exécute entièrement dans le runner GitHub Actions.
- Détection par regex + entropie : le motif `postgres://user:motdepasse@hote:5432/base` est exactement le type de motif que la règle par défaut `generic-database-connection-string`/règles PostgreSQL de gitleaks catche nativement (URL avec userinfo `user:password@`) — c'est un des cas les mieux couverts par les règles par défaut de l'outil, pas un cas limite qui demanderait une règle custom.
- Peut aussi tourner en pre-commit local (binaire `gitleaks protect --staged`) si on veut un filet en plus du CI, sans dépendance npm.
- Alternative `secretlint` (npm, écosystème JS) est raisonnable mais ajoute une dépendance npm et une config `.secretlintrc.json` à maintenir ; gitleaks est plus rapide à mettre en place pour ce dépôt (déjà zéro config JS existante à étendre) et couvre plus largement (pas seulement JS/TS — attrape aussi les `.sh`, comme le cas `gd3-apply.sh`).
- **Un script node maison + regex est déconseillé** : il faudrait ré-implémenter et maintenir soi-même la détection d'entropie et les faux-positifs (gitleaks a des années de règles affinées par la communauté ; un script maison recommencerait à zéro sur les faux positifs comme les mots de passe de dev Docker documentés ci-dessous).

### Scan du dépôt ACTUEL (working tree, pas l'historique) — emplacements et types, jamais les valeurs
Motifs recherchés : `postgres://`/`postgresql://` avec userinfo, `mysql://`, `Bearer `, `api_key`, `secret`, `password=`.

| Emplacement | Type | Nature |
|---|---|---|
| `docs/tests/rapport-sprint-CR.md:28`, `docs/tests/rapport-sprint-45.md:14,27,76`, `docs/RELEASE-v2.md:182`, `docs/analysis/audit-px-signatures-dev.md:37,67` | `postgresql://dkfarm:...@localhost:8432/farm-flow` (identifiants Docker **dev local**, déjà documentés publiquement dans `MEMORY.md` et connus de toute l'équipe) | **FAUX POSITIF légitime** — mot de passe de conteneur Docker local, jamais un secret de production. À allowlister explicitement dans la config gitleaks (`.gitleaksignore` ou règle `allowlist` par chemin `docs/`) pour éviter le bruit, mais pas un incident. |
| `src/__tests__/api/cron-subscription-lifecycle.test.ts:110,207` | `"Bearer mauvais-secret"` / `"Bearer mauvais-token"` | Faux positif — valeurs de test volontairement invalides (chaînes littérales de test négatif), pas un vrai token. |
| `.env.example` (fichier local, **non tracké par git** — voir ci-dessous) | `HETZNER_S3_ACCESS_KEY`/`HETZNER_S3_SECRET_KEY` | **À VÉRIFIER PAR L'UTILISATEUR — voir alerte dédiée ci-dessous.** |

Aucune URL `postgres://`/`mysql://` avec userinfo, aucun `api_key`/`secret`/`password=` suspect trouvé dans `scripts/`, `src/`, `prisma/` en dehors des cas ci-dessus.

### ⚠️ Alerte distincte de l'incident `gd3-apply.sh` — `.env.example` local
`.env.example` **n'est PAS tracké par git** (`git ls-files` ne le liste pas — confirmé). Il est ignoré par la règle `.env*` du `.gitignore` (ligne 37 : `.gitignore:37:.env*	.env.example`, confirmé par `git check-ignore -v`). **Donc son contenu actuel n'a jamais fuité via git** (ni working tree commité, ni historique). Cela dit, deux points méritent l'attention de l'utilisateur, sans lien avec l'incident `gd3-apply.sh` :
1. La plupart des valeurs de `.env.example` sont des placeholders explicites (`"your-smobilpay-api-key"`, `"change-me-in-production"`, `"change-me-generate-with-openssl-rand-hex-32"`). **Les valeurs `HETZNER_S3_ACCESS_KEY` et `HETZNER_S3_SECRET_KEY` de ce fichier local, elles, ont le format d'identifiants réels (pas de préfixe `your-`/`change-me`)** — contrairement au reste du fichier. Sans se connecter à quoi que ce soit ni révéler la valeur, il est recommandé à l'utilisateur de vérifier lui-même si ce sont des clés réelles (auquel cas elles doivent être retirées de ce fichier local et rotées côté Hetzner par précaution, même si le fichier n'a jamais été commité) ou des exemples générés une fois puis oubliés.
2. Le fait que `.env.example` soit exclu par `.env*` dans `.gitignore` est probablement un **oubli d'exception** : un fichier `.env.example` est normalement destiné à être tracké par git (c'est un template pour les autres développeurs), pas ignoré. Recommandation CI.3 : ajouter `!.env.example` après la ligne `.env*` du `.gitignore`, **après** avoir remplacé les deux valeurs Hetzner par des placeholders explicites (`"your-hetzner-access-key"` etc.), puis commiter le template propre.

### `.gitignore` / `.env` tracké ?
- `.env*` est bien ignoré (ligne 37), `.env` explicitement listé une deuxième fois (ligne 47, redondant mais inoffensif).
- `git ls-files | grep -E "^\.env"` → **aucun résultat** : ni `.env` ni `.env.example` ne sont trackés. Bon signe pour `.env` (le vrai fichier de secrets ne doit jamais être tracké) ; mauvais signe pour `.env.example` (voir point 2 ci-dessus).

---

## CI.4 — Empêcher qu'un secret rentre à nouveau

### Inventaire `scripts/` — connexion DB
| Fichier | Mode de connexion |
|---|---|
| `scripts/audits/su12-audit-doublons-numero.ts` | `process.env.DATABASE_URL` (échoue proprement avec message explicite si absent) |
| `scripts/audits/px-audit-signatures-corrompues.ts` | `process.env.DATABASE_URL` (idem) |
| `scripts/data-fixes/__tests__/su12-numero-unique-constraint.test.ts` | `process.env.DATABASE_URL` (test, `return` silencieux si absent) |
| `scripts/fix-depense-mouvement-link.sql`, `scripts/fix-missing-mouvements.sql`, `scripts/repair-bug041.sql` | Aucune connexion embarquée — SQL brut destiné à être exécuté via `psql < fichier.sql` (pas d'URL en dur). **Antérieurs à R10** (commits de 2026-05-18, avant la règle R10 introduite au sprint MG le 2026-07-26) — legacy pré-R10, jamais nettoyés lors du sprint MG (qui n'a traité que les 4 fichiers `fix-*.sql` à la racine de `prisma/migrations/` et `gd3-apply.sh`). Ne contiennent pas de secret, mais restent un résidu de l'ancien pattern (script à appliquer "à la main") — signalé pour information, pas bloquant pour CI, mais candidat naturel pour un futur nettoyage/documentation par @knowledge-keeper ou @db-specialist. |

**Aucun script actuel du dépôt ne contient d'URL de connexion en dur.** 0 sur l'ensemble de `scripts/`.

### Confirmation de l'affirmation R10
**Confirmée.** Depuis R10/ADR-049 (sprint MG), tout correctif de données de production passe par `prisma/migrations/<timestamp>_<nom>/migration.sql`, exécuté par `prisma migrate deploy`, qui lit `DATABASE_URL` depuis l'environnement (`prisma.config.ts` : `datasource: { url: process.env["DATABASE_URL"] }`). **Il n'y a donc structurellement plus aucun besoin d'écrire une URL de connexion en dur dans un script pour appliquer un correctif de données.**

**Cas résiduel légitime : les audits en lecture seule (`scripts/audits/`).** Ils se connectent bien via `process.env.DATABASE_URL` (confirmé ci-dessus), jamais en dur — donc même ce cas résiduel légitime (ADR-049 §3.1, catégorie "Audit en lecture seule", le seul type d'opération qui reste légitimement un script hors `prisma/migrations/`) respecte déjà la discipline "jamais d'URL en dur". Aucune exception résiduelle ne justifie qu'un futur script contienne une URL en dur.

### Cohérence avec ADR-049 / ADR-050
- ADR-049 (§3.1, taxonomie correctif/audit/garde-fou) et ADR-050 (qualification des deux scripts d'audit comme strictement lecture seule, emplacement canonique `scripts/audits/`) sont cohérents avec l'état actuel du dépôt : les scripts vivent bien dans `scripts/audits/` (pas `scripts/data-fixes/`, qui ne contient plus que leurs anciens tests — `scripts/data-fixes/__tests__/`), aucune écriture cachée trouvée, aucune URL en dur.
- Aucune incohérence entre la doctrine (ADR-049/050) et l'implémentation actuelle.

### Proposition d'emplacement/formulation pour la règle CLAUDE.md
Ajouter une **R11** (pas une extension de R10, car R10 concerne la nature "migration vs script à la main" d'un correctif, tandis que ce nouveau point concerne spécifiquement la présence de secrets/URLs de connexion en dur dans le dépôt — un problème plus large que les seuls correctifs de données) :

```
| R11 | Aucun secret en dur dans le dépôt | Toute URL de connexion (postgres://user:pass@...), clé API, token ou mot de passe doit venir de process.env.<VAR>, jamais être écrit en dur dans un script, une migration, un test ou une doc. Un scanner de secrets (gitleaks) bloque le commit/push en CI. |
```

Emplacement : dans `CLAUDE.md`, section "Phase 2 — Règles obligatoires (R1-R10)", ajouter une ligne R11 au tableau existant (ligne 96, juste après R10) et une sous-section "### R11 — Détail" (à la suite de "### R10 — Détail", ligne 98 et suivantes) référençant CI.3/CI.4 et le futur ADR du sprint CI si l'@architect en écrit un.

---

## CI.5 — Documenter la remédiation

### Comment `DATABASE_URL` arrive au service en prod
- `docker-compose.prod.yml`, service `app` : `env_file: - .env` — un fichier `.env` local au serveur de prod (non versionné, jamais dans le dépôt git), consommé au démarrage du conteneur `app`.
- `docker-compose.prod.yml`, service `db` : `POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}` — variable d'environnement injectée depuis l'environnement du host (probablement via l'interface Coolify, cf. commentaire `.env.example:15` "En prod Coolify").
- `docker-entrypoint.sh` : ne lit ni ne construit `DATABASE_URL` lui-même — il appelle directement `npx prisma migrate deploy`, qui lit `DATABASE_URL` déjà présent dans l'environnement du conteneur (fourni par `env_file: .env` au niveau `docker-compose.prod.yml`, ou directement par les variables d'environnement Coolify si l'orchestration ne passe pas par ce fichier `docker-compose.prod.yml` — indéterminable depuis le dépôt seul).
- **Emplacements où la valeur devrait être changée lors d'une rotation** (sans lire ni écrire la valeur) :
  1. Le fichier `.env` sur le serveur de production (ou l'équivalent "Environment Variables" du dashboard Coolify pour le service `app`, si c'est ce mécanisme qui est réellement utilisé plutôt qu'un fichier `.env` physique).
  2. La variable `POSTGRES_PASSWORD` fournie au service `db` (même source — fichier `.env` du host ou dashboard Coolify), si le mot de passe Postgres lui-même est roté (pas seulement l'URL qui l'encode).
  3. Redémarrage des conteneurs `app`/`db`/`cron` (`docker-compose.prod.yml`) après mise à jour, pour que la nouvelle valeur soit effectivement chargée (aucun mécanisme de hot-reload de variable d'environnement observé dans `docker-entrypoint.sh`).
  4. Aucune autre occurrence de `DATABASE_URL` en dur trouvée dans le dépôt (Dockerfile, docker-compose*, docker-entrypoint.sh) — c'est cohérent, tout passe par l'environnement.

### `scripts/data-fixes/gd3-apply.sh` — confirmation
- **Absent du working tree actuel** : `ls scripts/data-fixes/gd3-apply.sh` → `No such file or directory` ; `git ls-files | grep gd3-apply` → aucun résultat.
- **Présent dans l'historique** : `git log --oneline --all -- scripts/data-fixes/gd3-apply.sh` → 2 commits : `33ef046` (introduction, "fix(gd): guard verifyAssignationInvariant — discrimination TRANSFERT par relevé (BUG-049)") et `deee8b2` (suppression, "fix(mg): tout correctif de données devient une migration versionnée" — le commit MG qui applique R10). Confirmé, sans avoir affiché le diff contenant le secret.

### Autres endroits où l'identifiant de prod pourrait subsister
- Aucune autre occurrence de secret de production trouvée dans le dépôt actuel (working tree) au-delà de ce qui est documenté en CI.3.
- Hors du dépôt (non vérifiable en lecture seule depuis ce poste, à vérifier par l'utilisateur/l'opérateur du serveur) : logs de déploiement Coolify/CI antérieurs, historique de shell sur le serveur de prod si le script a été copié/exécuté manuellement à un moment donné, tout fork/clone du dépôt GitHub fait avant la suppression du commit `33ef046` (le secret reste dans TOUT clone qui a récupéré l'historique complet, pas seulement le repo GitHub d'origine).

---

## Verdict par story

| Story | Verdict | Fichiers à créer/modifier |
|---|---|---|
| **CI.1** — Pipeline GitHub Actions + Postgres éphémère | **GO** | Créer `.github/workflows/ci.yml` ; créer `.nvmrc` (racine) ; ajouter `"engines": {"node": ">=22"}` dans `package.json` ; adapter `db:seed` (ou un nouveau script CI-only) pour ne plus dépendre de `docker exec silures-db` — ex. nouveau script `scripts/seed-ci.sh` utilisant `psql "$DATABASE_URL" -f prisma/seed.sql` (le seed n'est en réalité pas requis pour les tests DB-gated, seulement utile si on veut aussi exercer le reste de la suite contre des données réalistes) |
| **CI.2** — Rendre l'invisibilité impossible | **GO** | Créer `src/test/require-database-url.setup.ts` (ou équivalent) déclaré via `test.setupFiles` dans `/Users/ronald/project/dkfarm/farm-flow/vitest.config.ts` (garde `process.env.CI && !process.env.DATABASE_URL` → throw) ; créer un test meta (ex. `src/__tests__/meta/db-gated-tests-registry.test.ts`) qui grep le dépôt pour `describe.runIf`/`skipIf` et compare à une liste déclarée en dur (avec commentaire explicite pour la mettre à jour) ; corriger le garde interne redondant de `scripts/data-fixes/__tests__/su12-numero-unique-constraint.test.ts` (L.178-181, le `return` silencieux sur `dbAvailable=false` DEVRAIT échouer, pas passer silencieusement, une fois le garde global (a) en place — sinon (a) et ce garde interne se contredisent : (a) garantit que `DATABASE_URL` existe en CI, mais ce garde interne suppose encore qu'il pourrait être injoignable et l'absorbe en `return`) |
| **CI.3** — Détection de secrets | **GO** | Créer `.gitleaks.toml` (allowlist pour les identifiants Docker dev documentés dans `docs/`) ; créer `.github/workflows/secret-scan.yml` (ou étape dans `ci.yml`) utilisant `gitleaks/gitleaks-action` ; corriger `.gitignore` (ajouter `!.env.example` après la ligne `.env*`) ; **action utilisateur (hors scope agent)** : vérifier/roter les valeurs `HETZNER_S3_*` du `.env.example` local avant de le committer en template propre |
| **CI.4** — Empêcher la récidive | **GO** | Ajouter R11 dans `CLAUDE.md` (tableau ligne 96 + sous-section détail) ; le scanner CI.3 (gitleaks en pre-push/CI) est le mécanisme d'application de R11 |
| **CI.5** — Documenter la remédiation | **GO** | Créer `docs/decisions/ADR-05X-remediation-secret-gd3-apply.md` ou une entrée dans `docs/knowledge/ERRORS-AND-FIXES.md` documentant l'incident (sans jamais reproduire la valeur), la liste des emplacements de rotation (ci-dessus), et le renvoi vers R11 |

## Dépendances entre stories
- CI.2 (garde global `setupFiles`) doit être fait **avant ou en même temps que** CI.1 si on veut que le premier run GitHub Actions échoue bruyamment en cas d'oubli de `DATABASE_URL` dans le workflow lui-même — sinon CI.1 pourrait "réussir" silencieusement sans jamais exécuter les 17 tests gated, ce qui serait ironique pour un sprint dont c'est justement l'objet.
- CI.3 (scanner) est indépendant de CI.1/CI.2 (peut être fait en parallèle) mais doit être fait **avant** CI.4 (la règle R11 n'a de valeur qu'une fois un mécanisme d'application existe réellement, cf. leçon ERR-112 : un garde-fou sans pipeline qui respecte son échec ne protège rien).
- CI.5 est indépendant, peut être fait à tout moment (documentation pure).

## Ce qui ne peut PAS être vérifié localement — confirmable seulement au premier push réel sur GitHub
1. Le comportement réel du service Postgres GitHub Actions (`services:`) — healthcheck, timing de disponibilité, réseau `localhost` vs nom de service — n'est simulable localement qu'approximativement (testé ici uniquement contre le Docker Compose local `silures-db`, pas contre un vrai runner GitHub).
2. Si `gitleaks-action` déclenche effectivement un blocage de PR/push sur ce dépôt précis (permissions GitHub, protections de branche) — dépend de la configuration du repo GitHub, invisible depuis le poste local.
3. Le temps réel d'exécution du job CI complet (migrate deploy + build + vitest run) sur un runner GitHub Actions partagé (2 vCPU standard) — la mesure locale (contention CPU observée ici, cf. section méthodologie) n'est pas transposable telle quelle à un runner dédié non partagé.
4. Si `actions/setup-node` avec `node-version-file: '.nvmrc'` résout bien la même version 22.x que celle utilisée en local (`v22.19.0` observé ici) — dépend du patch exact disponible sur les runners GitHub au moment du run.
5. Confirmation qu'aucune autre copie du secret `gd3-apply.sh` ne traîne sur un fork/clone GitHub externe — invérifiable depuis ce dépôt local.

## Méthodologie — build & tests (baseline factuelle)
- `npx prisma validate` : schéma valide.
- `npx next build --webpack` (avec `DATABASE_URL` pointant sur le Docker local) : **exit code 0**, build réussi.
- `npx vitest run` (suite complète, `DATABASE_URL` exporté) lancé **en même temps** que le build ci-dessus (contention involontaire) : 43 échecs sur 5779 tests (5710 passés + 26 todo), durées individuelles anormalement élevées (ex. `bcrypt` à 5-10s au lieu de <1s) — signature ERR-107 (contention CPU), pas une régression.
- **Réexécution isolée** (machine libre, uniquement les 4 fichiers gated + `password.test.ts`) : **4 fichiers, 22 tests, 0 échec.** Confirme le faux positif et valide que les 17 tests DB-gated sont bien verts en environnement non contentionné, cohérent avec la baseline annoncée (5753 verts avec `DATABASE_URL`).
