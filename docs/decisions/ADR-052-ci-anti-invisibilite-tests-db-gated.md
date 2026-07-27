# ADR-052 — CI.2 : rendre structurellement impossible l'invisibilité d'un test d'intégration DB-gated

**Statut :** Acceptée
**Date :** 2026-07-27
**Sprint :** CI (story CI.2, avec spécification d'implémentation pour CI.1 et CI.3)
**Auteur :** @architect
**Réfs :** `docs/analysis/pre-analysis-sprint-CI.md`, ERR-116 (`docs/knowledge/ERRORS-AND-FIXES.md`),
ADR-049, ADR-050, R10 (`CLAUDE.md`)

---

## 1. Contexte

17 tests d'intégration, répartis sur 4 fichiers, prouvent des garanties critiques du projet contre
une vraie base Postgres (pas des mocks) :

- Atomicité de signature de bon de livraison (rollback réel, verrouillage de lignes contre double
  signature concurrente).
- Le SAVEPOINT de `calculerEcartsParBac` (story BD.0) : une vraie erreur SQL pendant le recalcul
  d'écart de conservation ne doit jamais faire échouer la création du relevé de comptage qui l'a
  déclenché — ERR-113/ERR-114/ERR-115.
- L'unicité composite `(siteId, numero|code)` réellement appliquée par le moteur Postgres sur 10
  tables (SU.12/SU.13), pas seulement simulée côté Prisma.

Ces 17 tests sont tous conditionnés par `describe.runIf(!!DATABASE_URL)`. En l'absence de
`DATABASE_URL` dans l'environnement — c'est le cas de tout `npx vitest run` exécuté aujourd'hui,
puisqu'aucune CI n'existe — ils sont **skippés silencieusement** : aucun échec, aucun avertissement
visible dans un résumé de run standard, juste un compteur de « skipped » qui augmente (ERR-116).
Une régression sur l'une de ces trois garanties passerait au vert.

Un cas encore plus insidieux a été découvert dans le second bloc `describe.runIf` de
`scripts/data-fixes/__tests__/su12-numero-unique-constraint.test.ts` (12 tests, dont un
`it.each` sur 10 tables) : un garde interne redondant, `if (!dbAvailable || !client) { … ; return; }`,
fait qu'un run avec `DATABASE_URL` **défini** mais pointant vers une base injoignable au moment de
la connexion se termine en **`return` silencieux** — statut « passed », pas « skipped », alors
qu'aucune assertion n'a été exécutée. C'est un faux vert, pire qu'un skip visible.

L'objectif de cette décision est de rendre **structurellement impossible** — pas seulement
« découragé par convention » — qu'un futur test d'intégration DB-gated tourne dans le vide sans que
personne ne s'en aperçoive.

## 2. Options envisagées

### (a) Garde global dans `setupFiles` : `throw` si `process.env.CI` est défini sans `DATABASE_URL`
Un fichier de setup Vitest déclaré globalement (`test.setupFiles` dans `vitest.config.ts`)
s'exécute avant toute collecte de tests, indépendamment de quel fichier de test est lancé et de ce
que ce fichier fait ou omet de faire. Si `process.env.CI` est défini (GitHub Actions le positionne
à `true` par défaut sur tout job) et que `DATABASE_URL` est absent, le setup lève une exception qui
fait échouer tout `npx vitest run` avant même que le premier test ne s'exécute.

**Force :** ne dépend d'aucune action locale à un fichier de test précis — un nouveau fichier gated
mal écrit ne peut pas « oublier » de passer par ce garde, puisqu'il ne le sait même pas et n'a rien
à faire pour l'activer.
**Faille identifiée par la pré-analyse, confirmée :** ce garde protège uniquement la présence de
`DATABASE_URL` en CI. Il ne dit rien sur ce qu'un fichier de test fait *ensuite* avec cette
variable. Un test qui définit son propre `runIf` sur une variable différente (ex. `REDIS_URL`), ou
qui — comme le cas su12 — avale silencieusement une erreur de connexion au lieu de la laisser
remonter, reste invisible à ce garde seul. (a) rend « CI sans base » impossible, pas « nouveau test
gated ajouté sans discipline » impossible.

### (b) Assertion sur le nombre de tests skippés (reporter custom)
Nécessite de maintenir une liste de référence (« 17 tests gated attendus ») mise à jour à chaque
nouveau test DB-gated. Un oubli de mise à jour de cette liste masque exactement le problème qu'on
cherche à éliminer — la liste elle-même devient un point de défaillance humain non garanti.
**Rejetée seule.** Utile uniquement si elle est dérivée automatiquement (voir (c)), pas si elle est
maintenue à la main comme un chiffre magique.

### (c) Test méta qui grep le dépôt et échoue si un `runIf`/`skipIf`/`describe.skip` apparaît hors d'une allowlist déclarée et justifiée
Un test (`vitest`, exécuté comme tout autre test — donc lui-même soumis au garde (a) puisqu'il
tourne dans le même run) parcourt le dépôt, extrait toute occurrence de `describe.runIf`,
`it.skip`, `test.skip`, `describe.skip`, `skipIf`, `this.skip`, et compare l'ensemble trouvé à une
allowlist déclarée dans le dépôt, où chaque entrée porte une justification et une référence ADR.
Deux directions de non-régression : une occurrence trouvée mais non allowlistée échoue (empêche
l'ajout non déclaré d'un nouveau gate) ; une entrée allowlistée mais introuvable dans le dépôt
échoue aussi (empêche l'allowlist de pourrir avec des entrées obsolètes qui masqueraient un vrai
audit).
**Ne résout pas seule le problème central** : même un `runIf` « enregistré » reste silencieusement
skippé si `DATABASE_URL` est absent en CI — c'est le rôle de (a). (c) est un complément de (a), pas
un remplacement.

### (d) Combinaison (a) + (c) + helper partagé obligatoire + correction du double-gating su12
**Retenue.** Voir section 3.

## 3. Décision

**Combinaison (a) + (c)**, plus deux mesures structurelles supplémentaires qui ferment les angles
morts que (a) et (c) ne couvrent pas isolément : un **helper partagé obligatoire** pour tout futur
test DB-gated, et la **correction du double-gating** de `su12-numero-unique-constraint.test.ts`.
Aucune des deux mesures n'est optionnelle : (a)+(c) sans elles laisseraient le cas su12 (faux vert
« passed ») intact, et n'empêcheraient pas un futur test d'écrire son propre garde ad hoc au lieu de
passer par un point de contrôle commun.

### 3.1 Le garde global (a)

**Fichier à créer par le developer :** `/Users/ronald/project/dkfarm/farm-flow/src/test/ci-db-guard.setup.ts`

**Déclaration :** dans `vitest.config.ts`, ajouter `test.setupFiles: ["./src/test/ci-db-guard.setup.ts"]`.

**Contrat exact du fichier :**
- Au chargement du module (code de niveau supérieur, pas dans un hook `beforeAll` — le garde doit
  s'exécuter avant toute collecte de test, pas seulement avant leur exécution) :
  - Si `process.env.CI` est défini (non vide) **et** `process.env.DATABASE_URL` est absent ou vide
    → lever une `Error` avec un message explicite : quelle variable manque, pourquoi c'est
    bloquant (« 17 tests d'intégration DB-gated ne peuvent pas s'exécuter sans elle »), et où
    corriger (`.github/workflows/ci.yml`, service `postgres`, export de `DATABASE_URL` avant
    `npx vitest run`).
  - Sinon (hors CI, ou `DATABASE_URL` présent) → ne rien faire, aucun effet de bord.
- Ce fichier ne doit dépendre d'aucun import applicatif — il doit rester exécutable même si le
  reste du projet ne compile pas, pour ne jamais lui-même devenir une source de faux négatif.

### 3.2 Le helper partagé `requireDatabaseUrl()`

**Fichier à créer par le developer :** `/Users/ronald/project/dkfarm/farm-flow/src/test/require-database-url.ts`

**Objectif :** centraliser le point de décision « ce test doit-il tourner ? » de sorte qu'un futur
test d'intégration DB-gated n'ait techniquement aucune raison d'écrire son propre `!!process.env.DATABASE_URL`
ou son propre garde de connexion — il appelle ce helper et rien d'autre.

**Contrat exact :**
- Signature : `export function requireDatabaseUrl(): boolean`.
- Hors CI (`process.env.CI` non défini) :
  - `DATABASE_URL` absent → retourne `false` (permet à `describe.runIf(requireDatabaseUrl())` de
    skipper proprement en dev local sans Docker — ce skip reste visible dans le résumé Vitest
    comme un skip normal, jamais masqué).
  - `DATABASE_URL` présent → retourne `true`.
- En CI (`process.env.CI` défini) :
  - `DATABASE_URL` absent → ce cas ne devrait jamais être atteint puisque le garde global (3.1) a
    déjà fait échouer le run avant la collecte des tests. Le helper lève quand même une `Error` par
    défense en profondeur (double protection, pas une redondance inutile : si `ci-db-guard.setup.ts`
    était un jour retiré de `setupFiles` par erreur, ce helper resterait le dernier filet).
  - `DATABASE_URL` présent → retourne `true`.
- Le helper ne se connecte jamais lui-même à la base et ne teste jamais la joignabilité réseau —
  il vérifie uniquement la présence de la variable d'environnement. La vérification de joignabilité
  réelle reste la responsabilité du `beforeAll` de chaque fichier de test (voir 3.3, correction du
  cas su12) : si `DATABASE_URL` est présent mais que la base n'est pas joignable, ce n'est plus un
  problème de *gating* (le test a légitimement décidé de tourner), c'est un **échec d'infrastructure
  du run** — qui doit faire échouer les tests bruyamment, pas les faire passer silencieusement.

**Usage attendu dans un fichier de test DB-gated :**
```
import { requireDatabaseUrl } from "@/test/require-database-url";

describe.runIf(requireDatabaseUrl())("...", () => {
  // ...
});
```

### 3.3 Correction du double-gating de `su12-numero-unique-constraint.test.ts`

Le garde interne `if (!dbAvailable || !client) { console.warn(...); return; }` (présent dans les
deux blocs `describe.runIf`, y compris dans le corps de `it.each` sur les 10 tables) doit être
**supprimé**, pas conservé « au cas où ». Décision :

- Le `beforeAll` qui tente la connexion Postgres doit **lever une exception** si la connexion
  échoue (`await client.query("SELECT 1")` qui rejette), au lieu de positionner silencieusement
  `dbAvailable = false` et de laisser chaque `it` gérer ce cas individuellement. Une exception dans
  `beforeAll` fait échouer tous les tests du fichier avec un message d'erreur explicite — c'est le
  comportement recherché : une fois que `requireDatabaseUrl()` a décidé que le fichier doit tourner
  (parce que `DATABASE_URL` est défini), une base injoignable est une panne d'infrastructure à
  signaler bruyamment, pas une raison de skip.
- Les gardes `if (!dbAvailable || !client) { return; }` à l'intérieur de chaque `it` et de l'`it.each`
  sont supprimés. Ils n'ont plus de raison d'exister une fois que le `beforeAll` garantit que si les
  tests s'exécutent, `client` est forcément utilisable.
- Ce changement ne modifie aucune assertion métier — il retire uniquement le mécanisme qui pouvait
  transformer « la base n'a pas répondu » en « test réussi ».

### 3.4 L'allowlist du test méta (c)

**Fichier à créer par le developer :** `/Users/ronald/project/dkfarm/farm-flow/src/test/db-gated-allowlist.ts`

**Format :** un tableau TypeScript exporté, une entrée par occurrence de `describe.runIf` (pas une
entrée par fichier — `su12-numero-unique-constraint.test.ts` en compte deux, une par bloc) :

```
export interface DbGatedAllowlistEntry {
  file: string;          // chemin relatif à la racine du dépôt
  linePattern: string;   // motif littéral de la ligne (ex. "describe.runIf(requireDatabaseUrl())")
  justification: string; // pourquoi ce gate est légitime : quelle ressource externe réelle, quelle garantie prouvée
  adr: string;            // "ADR-052"
}

export const DB_GATED_ALLOWLIST: DbGatedAllowlistEntry[] = [
  // 5 entrées attendues au moment de ce sprint — voir section 3.5 pour la liste exacte.
];
```

**Exigence de friction délibérée :** chaque entrée doit porter une `justification` non vide décrivant
la ressource externe réelle en jeu (ici : moteur Postgres — SAVEPOINT, transaction, contrainte
unique — jamais une justification générique du type « test lent » ou « pratique »). Le test méta
doit vérifier que `justification.length` dépasse un seuil minimal (ex. 20 caractères) pour empêcher
une entrée ajoutée à la hâte sans explication. Étendre l'allowlist doit être visiblement plus
pénible que d'écrire un test qui n'a pas besoin d'être gated (mock au lieu d'intégration réelle) —
c'est le comportement par défaut souhaité : un test devrait rester mocké sauf s'il prouve un
comportement du moteur DB lui-même, exactement comme le documente déjà le commentaire d'en-tête de
`su12-numero-unique-constraint.test.ts`.

**Test méta à créer par le developer :** `/Users/ronald/project/dkfarm/farm-flow/src/__tests__/meta/db-gated-tests-registry.test.ts`
- Grep le dépôt (hors `node_modules`, hors `.next`) pour `describe.runIf(`, `describe.skipIf(`,
  `it.skip(`, `test.skip(`, `describe.skip(`, `this.skip(`. `it.todo`/`test.todo` sont explicitement
  **exclus** du périmètre (backlog de specs non implémentées, pas du DB-gating — cf.
  `density-calculs.test.ts`, `density-integration.test.ts`, hors sujet de cet ADR).
- Pour chaque occurrence trouvée : doit correspondre à une entrée de `DB_GATED_ALLOWLIST` (même
  fichier). Sinon → échec avec message pointant vers ADR-052 et invitant soit à retirer le gate
  (préférer le mock), soit à l'ajouter à l'allowlist avec justification.
- Pour chaque entrée de `DB_GATED_ALLOWLIST` : doit correspondre à une occurrence réellement présente
  dans le fichier désigné. Sinon → échec (entrée obsolète, à retirer).
- Vérification additionnelle : tout fichier contenant une occurrence allowlistée de
  `describe.runIf` doit importer `requireDatabaseUrl` depuis `@/test/require-database-url` (grep du
  contenu du fichier). Empêche un futur test d'écrire son propre `!!process.env.DATABASE_URL` en
  contournant le helper commun tout en se faisant allowlister.

### 3.5 Les 4 fichiers (5 occurrences, 17 tests) à migrer

| # | Fichier (chemin absolu) | Occurrence(s) `describe.runIf` | Tests couverts |
|---|---|---|---|
| 1 | `/Users/ronald/project/dkfarm/farm-flow/src/lib/queries/__tests__/bd0-savepoint-integration.test.ts` | L.158 | 2 |
| 2 | `/Users/ronald/project/dkfarm/farm-flow/src/lib/queries/__tests__/bd0-savepoint-integration-persister-origin.test.ts` | L.147 | 1 |
| 3 | `/Users/ronald/project/dkfarm/farm-flow/src/lib/queries/__tests__/bons-livraison-transaction-integration.test.ts` | L.229 | 2 |
| 4 | `/Users/ronald/project/dkfarm/farm-flow/scripts/data-fixes/__tests__/su12-numero-unique-constraint.test.ts` | L.84 et L.157 (2 blocs) | 12 |

Total : 5 occurrences allowlistées, 17 tests couverts. Chaque occurrence doit être migrée de
`describe.runIf(!!DATABASE_URL)` (ou équivalent local) vers `describe.runIf(requireDatabaseUrl())`,
avec l'import du helper (3.2). Le fichier #4 reçoit en plus la correction du double-gating (3.3).

## 4. Ce que ce mécanisme protège — et ce qu'il ne protège PAS

**Protège :**
- Un `npx vitest run` en CI sans `DATABASE_URL` échoue bruyamment (3.1), quel que soit le fichier de
  test concerné, y compris un fichier qui n'existe pas encore.
- Un nouveau test qui introduit un gate non déclaré (nouveau `runIf`, nouveau `skip`) fait échouer
  la suite via le test méta (3.4), qu'il soit gated sur `DATABASE_URL` ou toute autre condition
  détectable par les mots-clés surveillés.
- Le faux vert du double-gating su12 (base injoignable malgré `DATABASE_URL` présent) devient un
  échec bruyant (3.3), pas un `console.warn` perdu dans les logs.
- Un test alloué qui n'utilise pas le helper commun échoue (3.4, vérification d'import).

**Ne protège PAS (angles morts assumés) :**
- Un test qui **n'utilise aucun des mots-clés surveillés** pour se rendre inopérant — par exemple
  un `try { ... } catch { return; }` interne qui avale une erreur de connexion sans jamais passer
  par `describe.runIf`/`it.skip`. Le grep du test méta ne détecte que des motifs syntaxiques connus
  ; il ne peut pas prouver l'absence de tout mécanisme de skip caché imaginable. C'est pourquoi la
  correction 3.3 traite spécifiquement ce cas pour le fichier où il a été trouvé, mais un nouveau
  fichier pourrait réintroduire un pattern équivalent sans se faire attraper par ce mécanisme —
  la checklist de @code-reviewer (R1-R11, à étendre) reste la deuxième ligne de défense pour ce cas,
  pas l'outillage automatique seul.
- Une variable d'environnement **autre que `DATABASE_URL`** requise par un futur test d'intégration
  (ex. un `REDIS_URL` si un cache est introduit). Le garde global (3.1) ne connaît que
  `DATABASE_URL`. Si un futur sprint introduit une nouvelle ressource externe testée en intégration,
  ce garde doit être étendu explicitement (ou dupliqué pour la nouvelle variable) — ce n'est pas
  automatique.
- Un contournement du grep par obfuscation délibérée (ex. `const runIf = describe["runIf"]`). Ce
  mécanisme protège contre l'oubli et la distraction, objectif explicite de ce sprint — pas contre
  une volonté délibérée de le contourner, qui relève de la revue de code humaine, pas de l'outillage.
- Le temps d'exécution ou la fiabilité réseau du service Postgres GitHub Actions lui-même (variable
  runtime, hors du contrôle de ce mécanisme — cf. angle mort explicitement noté par la
  pré-analyse).

## 5. Implémentation attendue (spécification pour @developer)

Cette section fixe la spécification. Le developer implémente le code, le workflow YAML et les
fichiers de test — cet ADR n'en contient aucun.

### 5.1 CI.1 — `.github/workflows/ci.yml`

- **Déclencheurs :** `push` (toutes branches ou au moins `main`) et `pull_request`.
- **Node :** version 22, résolue via un fichier `.nvmrc` (contenu : `22`) à créer à la racine du
  dépôt, avec `actions/setup-node@v4` configuré en `node-version-file: '.nvmrc'` — jamais une
  version codée en dur dans le YAML, pour ne jamais diverger du `Dockerfile` (`FROM node:22-alpine`).
  Ajouter également `"engines": { "node": ">=22" }` dans `package.json`.
- **Service Postgres :** `postgres:16-alpine` (cohérent avec `docker-compose.yml` dev et
  `docker-compose.prod.yml`), déclaré comme `services:` du job, avec un healthcheck
  (`pg_isready`) attendu avant toute étape qui en dépend.
- **Ordre des étapes — point critique confirmé par la pré-analyse :** `npm run build` exécute
  `prisma generate && prisma migrate deploy && next build --webpack` — la migration fait donc
  partie du build. Le service Postgres doit être disponible **avant** l'étape de build, pas
  seulement avant `npx vitest run`. Deux options équivalentes, au choix du developer :
  (i) garder `npm run build` tel quel, en s'assurant que le service Postgres et l'attente de
  disponibilité (`pg_isready` ou équivalent) précèdent cette étape dans le job ; ou
  (ii) découpler explicitement `npx prisma migrate deploy` puis `npx next build --webpack` comme le
  fait déjà le `Dockerfile` en prod (commentaire du `Dockerfile` : « NOT npm run build which
  includes prisma migrate deploy »), ce qui documente plus explicitement la dépendance dans le YAML
  lui-même. Le choix est laissé au developer ; ce qui n'est pas négociable, c'est que le service
  Postgres soit up et joignable avant la première commande qui a besoin de `DATABASE_URL`, qui est
  le build, pas les tests.
- **`DATABASE_URL` exportée** dans l'environnement du job (pointant vers le service Postgres
  éphémère, ex. `postgresql://postgres:postgres@localhost:5432/farm_flow_ci`) — nécessaire pour
  `prisma migrate deploy`, `npx vitest run`, et pour satisfaire le garde global (3.1).
- **`npm run db:seed` ne doit PAS être appelé tel quel** : ce script exécute
  `docker exec -i silures-db psql ...`, qui suppose un conteneur Docker nommé littéralement
  `silures-db` — un service GitHub Actions n'est pas ce conteneur. La pré-analyse confirme que le
  seed n'est pas requis pour que les 17 tests DB-gated passent (ils créent et nettoient leurs
  propres fixtures via `INSERT INTO`/`beforeAll`/`afterAll` ou `afterEach`, indépendamment de
  `prisma/seed.sql`). **Confirmation de cette décision : ne pas appeler `npm run db:seed` dans le
  workflow CI.** Si un futur sprint a besoin de données de seed en CI pour un autre usage (tests
  E2E par exemple), ce sera un script séparé qui se connecte par TCP via `psql "$DATABASE_URL" -f
  prisma/seed.sql`, jamais une adaptation de `db:seed` qui resterait couplée au nom du conteneur
  Docker local.
- **Étapes attendues, dans l'ordre :** checkout → setup Node (via `.nvmrc`) → service Postgres up
  → `npm ci` → `prisma generate` (ou inclus dans le build) → migration + build (ordre 5.1 ci-dessus)
  → `npx vitest run` avec `DATABASE_URL` exportée → (le job échoue si l'une de ces étapes échoue,
  configuration par défaut de GitHub Actions, pas de `continue-on-error`).

### 5.2 CI.2 — récapitulatif des fichiers à créer/modifier par le developer

- Créer `src/test/ci-db-guard.setup.ts` (3.1).
- Créer `src/test/require-database-url.ts` (3.2).
- Créer `src/test/db-gated-allowlist.ts` (3.4), avec les 5 entrées de la section 3.5.
- Créer `src/__tests__/meta/db-gated-tests-registry.test.ts` (3.4).
- Modifier `vitest.config.ts` : ajouter `test.setupFiles: ["./src/test/ci-db-guard.setup.ts"]`.
- Modifier les 4 fichiers de la section 3.5 : remplacer `describe.runIf(!!DATABASE_URL)` par
  `describe.runIf(requireDatabaseUrl())` + import du helper.
- Modifier `scripts/data-fixes/__tests__/su12-numero-unique-constraint.test.ts` (3.3) : le
  `beforeAll` lève une exception sur échec de connexion, les gardes internes `if (!dbAvailable || !client) { return; }` sont supprimés (3 occurrences : les deux `it` du premier bloc et l'`it.each`
  du second).
- Le developer écrit un test de non-régression pour le comportement du garde global lui-même (3.1)
  — ex. un test qui simule `process.env.CI` défini sans `DATABASE_URL` dans un sous-processus ou en
  import dynamique isolé, afin de prouver que le `throw` a bien lieu. La conception précise de ce
  test de non-régression est laissée au developer/tester ; cet ADR n'en fixe que l'exigence
  d'existence.

### 5.3 CI.3 — scan de secrets

- **Outil retenu : gitleaks**, exécuté en GitHub Action (`gitleaks/gitleaks-action`), zéro
  dépendance npm ajoutée au projet, zéro service externe payant — cohérent avec la recommandation
  de la pré-analyse (détection par regex + entropie déjà affinée par la communauté, contrairement à
  un script maison qui redécouvrirait les faux positifs un par un).
- **Fichier de config à créer :** `.gitleaks.toml` à la racine, avec une section `allowlist` par
  chemin de fichier pour les faux positifs identifiés par la pré-analyse — les identifiants Docker
  de **dev local** déjà documentés publiquement dans `MEMORY.md` et plusieurs fichiers `docs/`
  (`docs/tests/rapport-sprint-CR.md`, `docs/tests/rapport-sprint-45.md`, `docs/RELEASE-v2.md`,
  `docs/analysis/audit-px-signatures-dev.md`) et les chaînes de test négatif littérales
  (`"Bearer mauvais-secret"`/`"Bearer mauvais-token"` dans
  `src/__tests__/api/cron-subscription-lifecycle.test.ts`).
- **Décision sur ces occurrences documentées :** elles restent en place (allowlist par chemin dans
  `.gitleaks.toml`), plutôt que nettoyées, parce qu'elles ne décrivent qu'un identifiant de
  conteneur Docker local (port `8432`, jamais joignable depuis l'extérieur de la machine de
  développement) — un secret de production n'a jamais eu cette forme documentée. Nettoyer ces
  mentions n'apporterait aucun gain de sécurité et dégraderait la documentation existante
  (`MEMORY.md` et les rapports de sprint perdraient une information légitimement utile à l'équipe).
  L'allowlist doit cibler ces chemins précisément (pas un blanket-allow de tout `docs/`), pour ne
  pas neutraliser la détection sur un vrai secret qui atterrirait un jour dans `docs/` par erreur.
- **Périmètre du scan :** le working tree complet à chaque run (`push`/`pull_request`), pas
  seulement le diff — pour attraper aussi un secret déjà présent avant l'activation du scanner
  (defense in depth), en plus du diff qui est ce qui bloque une nouvelle introduction. Le scan de
  l'historique complet (`git log`) n'est **pas** demandé par ce sprint : le secret déjà fuité
  (`gd3-apply.sh`) est un fait acquis de l'historique, documenté séparément (section 6 de cet ADR /
  `docs/security/REMEDIATION-SECRET-HISTORIQUE.md`) — le scanner sert à empêcher la **récidive**,
  pas à auditer rétroactivement tout l'historique existant à chaque run (coût CI disproportionné
  pour un gain marginal, l'incident connu est déjà traité par la rotation, pas par un scan répété).
- **Exigence explicite de couverture :** la règle par défaut de gitleaks pour les URL de connexion
  avec `userinfo` (`user:password@hote`) doit être active et non désactivée dans `.gitleaks.toml` —
  c'est le motif exact qui a échappé dans `gd3-apply.sh` (`.sh`, pas `.ts`/`.js` — confirmer que la
  config gitleaks ne restreint le scan à aucune extension de fichier spécifique, gitleaks scanne par
  défaut tous les fichiers texte du dépôt sans distinction d'extension).
- **`.gitignore` :** ajouter `!.env.example` après la ligne `.env*` (ligne 37), pour que
  `.env.example` redevienne trackable — **à ne faire qu'après** que l'utilisateur ait confirmé et,
  le cas échéant, remplacé les valeurs `HETZNER_S3_*` par des placeholders explicites dans son
  `.env.example` local (voir `docs/security/REMEDIATION-SECRET-HISTORIQUE.md`, section « points de
  vérification utilisateur »). Le developer ne doit pas committer `.env.example` avant cette
  confirmation utilisateur.

## 6. Conséquences

- **Ce qui devient interdit :** ajouter un `describe.runIf`/`skipIf`/`*.skip` sur une ressource
  externe sans l'enregistrer dans `db-gated-allowlist.ts` avec une justification substantielle ;
  écrire un garde de connexion DB qui avale une erreur de connexion par un `return` silencieux au
  lieu de la laisser remonter en échec ; écrire son propre `!!process.env.DATABASE_URL` dans un
  test au lieu de passer par `requireDatabaseUrl()`.
- **Ce qui change pour l'équipe :** tout futur test d'intégration DB-gated suit le même chemin —
  helper commun, entrée d'allowlist justifiée, `beforeAll` qui échoue fort sur panne de connexion.
  Le test méta et le garde global tournent à chaque `npx vitest run`, en CI comme en local (le garde
  global est inerte hors CI, le test méta s'exécute partout).
- **Lien avec R10/R11 :** ce mécanisme est indépendant de R10/R11 (qui concernent les correctifs de
  données et les secrets en dur) mais partage la même philosophie : rendre une garantie
  **structurellement vérifiable par la machine**, pas seulement documentée pour un humain qui doit
  s'en souvenir. Le scanner de secrets (5.3), qui n'a aucune restriction d'extension ni de type de
  fichier, a d'ailleurs détecté pendant ce sprint un secret dans un fichier de configuration
  d'outillage (`.claude/settings.local.json`, tracké depuis le commit initial) — un cas hors du
  périmètre littéral que R11 énumérait initialement (script/migration/test/doc). La règle R11 a été
  reformulée en conséquence (`CLAUDE.md`) pour couvrir tout fichier du dépôt par principe plutôt que
  par liste fermée ; l'outillage (ce scanner) n'a pas eu besoin d'être modifié, la faille étant dans
  le texte de la règle, pas dans le mécanisme.
- **Suivi hors du périmètre de cet ADR :** ERR-116 (`docs/knowledge/ERRORS-AND-FIXES.md`) cite
  encore `src/__tests__/bd0-comptage-recalcule-ecart.test.ts` comme DB-gated — la pré-analyse a
  confirmé que ce fichier est aujourd'hui entièrement mocké, sans `runIf`. Cette référence est
  obsolète et doit être corrigée par @knowledge-keeper (signalé, pas traité ici, car hors du
  périmètre « architecture/décision » de ce sprint).
