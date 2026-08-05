# Pré-analyse P1 — Le faux vert des tests adossés à la base — 2026-08-06

## Statut : GO AVEC RÉSERVES

## Résumé
Le motif interdit par ADR-052 §1/§6 (déjà fiché ERR-192) subsiste dans **15 fichiers** de test
DB-gated sur les **17** que compte le dépôt (18 occurrences `describe.runIf` allowlistées, su12
comptant double). Baseline mesurée : avec `DATABASE_URL` définie mais pointant vers une base
injoignable, ces 15 fichiers (**49 tests**) passent tous "verts" sans exécuter une seule assertion.
Le chiffre de 15 avancé par l'utilisateur est confirmé exact (pas 16, pas un autre nombre) — il
correspond très exactement au chiffre déjà documenté dans ERR-192 le 2026-08-05, non résorbé
depuis. Le fichier modèle `previsions-poste-referentiel-sql-artefact-historique-integration.test.ts`
et `su12-numero-unique-constraint.test.ts` sont conformes et échouent bruyamment dans les mêmes
conditions (4 failed + 12 skipped, jamais "passed").

## Vérifications effectuées

### Recherche exhaustive
Recherche par motifs (`dbAvailable`, `skipTests`, `hasDb`, `dbUp`, `pool === null`, puis
confirmation manuelle de chaque occurrence `catch { ... } / if (!dbAvailable...) return;`) sur tout
le dépôt hors `node_modules`/`.next`. **17 fichiers** portent un gating DB au total (tous déjà
répertoriés dans `src/test/db-gated-allowlist.ts`, 18 entrées car `su12-numero-unique-constraint.test.ts`
compte deux blocs `describe.runIf`) :

**Conformes (2)** — pas de retour silencieux, `beforeAll`/garde interne fait échouer bruyamment :
- `scripts/data-fixes/__tests__/su12-numero-unique-constraint.test.ts` (`beforeAll` lève, aucun garde interne restant)
- `src/lib/queries/__tests__/previsions-poste-referentiel-sql-artefact-historique-integration.test.ts` (garde interne `throw new Error(MESSAGE_DB_INJOIGNABLE, { cause: erreurConnexion })` au lieu de `return`)

**Non conformes (15, 49 tests, 48 gardes défaillants sur 49 — 1 test n'a pas de garde du tout car
hors bloc `describe.runIf`)** — motif exact partout : `beforeAll` capture l'erreur de connexion dans
un `catch` muet (`dbAvailable = false`), puis chaque `it` fait
`if (!dbAvailable || !client) { console.warn(...); return; }` :

| Fichier (chemin absolu sous `/Users/ronald/project/dkfarm/farm-flow/`) | its gated | lignes des gardes |
|---|---|---|
| `src/lib/queries/__tests__/previsions-snapshot-budget-integration.test.ts` | 2 | 97-99, 147-149 |
| `src/lib/queries/__tests__/previsions-mapping-orphelins-integration.test.ts` | 7 | 136-138, 179-181, 252-254, 329-331, 380-382, 467-469, 552-554 |
| `src/lib/queries/__tests__/previsions-scenarios-copie-produits-integration.test.ts` | 2 | 143-145, 195-197 |
| `src/lib/queries/__tests__/previsions-cloture-integration.test.ts` | 4 | 98-100, 152-154, 181-183, 212-214 |
| `src/lib/queries/__tests__/bons-livraison-transaction-integration.test.ts` | 2 (sur 3 its du fichier — le 3e, ligne 400, est un test mocké hors `describe.runIf`, non concerné) | 236-238, 318-320 |
| `src/lib/queries/__tests__/previsions-rapprochement-integration.test.ts` | 6 | 168-170, 193-195, 249-251, 330-332, 374-376, 420-422 |
| `src/lib/queries/__tests__/previsions-vagues-couts-reels-integration.test.ts` | 1 | 120-122 |
| `src/lib/queries/__tests__/previsions-rapprochement-aliment-scope-integration.test.ts` | 2 | 164-166, 229-231 |
| `src/lib/queries/__tests__/previsions-int-fractional-integration.test.ts` | 2 | 123-125, 165-167 |
| `src/lib/queries/__tests__/previsions-rapprochement-mapping-non-mappees-integration.test.ts` | 4 | 124-126, 154-156, 187-189, 211-213 |
| `src/lib/queries/__tests__/previsions-rapprochement-mapping-integration.test.ts` | 3 | 79-81, 137-139, 188-190 |
| `src/lib/queries/__tests__/previsions-postes-referentiel-admin-integration.test.ts` | 4 | 127-129, 179-181, 236-238, 323-325 |
| `src/lib/queries/__tests__/bd0-savepoint-integration.test.ts` | 2 | 165-167, 227-229 |
| `src/lib/queries/__tests__/bd0-savepoint-integration-persister-origin.test.ts` | 1 | 154-156 |
| `src/lib/queries/__tests__/previsions-tresorerie-trois-series-integration.test.ts` | 6 | 136-138, 197-199, 239-241, 286-288, 356-358, 444-446 |

Chaque fichier a aussi le même motif dans son `beforeAll` :
`try { pool = new Pool(...); client = await pool.connect(); await client.query("SELECT 1"); dbAvailable = true; } catch { dbAvailable = false; }`
(pas de capture de `erreurConnexion`, contrairement au modèle).

### Le contrat modèle (à répliquer)
`previsions-poste-referentiel-sql-artefact-historique-integration.test.ts` :
- `beforeAll` **catch toujours** l'erreur de connexion (ne la relance pas lui-même), mais la
  **stocke** dans une variable `erreurConnexion` en plus de `dbAvailable = false`.
- Chaque `it` conserve son garde `if (!dbAvailable || !client) { ... }` mais remplace
  `console.warn(...); return;` par `throw new Error(MESSAGE_DB_INJOIGNABLE, { cause: erreurConnexion })`
  — un message constant `MESSAGE_DB_INJOIGNABLE`, actionnable (explique que `DATABASE_URL` est
  définie donc que le gating a légitimement décidé que le test devait tourner, que ce n'est pas un
  skip mais un échec d'infrastructure, et donne la commande de remédiation
  `docker compose up -d`), avec `{ cause: erreurConnexion }` pour ne pas perdre l'erreur Postgres
  d'origine.
- `requireDatabaseUrl()` (`src/test/require-database-url.ts`) ne change pas : il ne vérifie que la
  présence de la variable d'environnement, jamais la joignabilité réseau — c'est le rôle du
  `beforeAll`/des gardes internes de chaque fichier.
- `src/test/db-gated-allowlist.ts` n'a **pas besoin d'être modifié** pour ce fix : le `linePattern`
  enregistré est `describe.runIf(requireDatabaseUrl())(` (ou la variante littérale déjà présente
  pour `previsions-vagues-couts-reels-integration.test.ts`), qui ne change pas — seul le corps
  interne des `it` change, pas la ligne du `describe.runIf` lui-même.
- Le test méta `src/__tests__/meta/db-gated-tests-registry.test.ts` scanne uniquement les motifs
  syntaxiques `describe.runIf(`/`skipIf(`/`*.skip(` — il ne détectera jamais lui-même ce motif
  `dbAvailable`/`return` (c'est explicitement la leçon d'ERR-192) donc **aucune modification requise
  ici non plus**, et son statut restera vert avant et après le fix (comportement attendu, pas un
  signal d'alerte).
- `src/test/ci-db-guard.setup.ts` n'interfère pas : il ne concerne que l'absence totale de
  `DATABASE_URL` en CI, un cas différent de "DATABASE_URL présente mais base injoignable" qui est
  précisément le trou que ce fix comble.

### Baseline (preuve du faux vert actuel)
Commande exécutée (base bidon, jamais la base de dev réelle, aucune écriture) :
```
export DATABASE_URL="postgresql://invalid:invalid@127.0.0.1:1/nonexistent"
unset CI
npx vitest run <15 fichiers non conformes>
```
Résultat : **`Test Files 15 passed (15)` / `Tests 49 passed (49)`** — 100% vert, alors qu'aucune
requête SQL n'a abouti (`ECONNREFUSED` capturé et avalé dans chaque `beforeAll`), confirmé par les
`console.warn("[...] DB de dev injoignable — test ignore (dbAvailable=false).")` visibles en stderr
pour chacun des 49 tests.

Même commande sur les 2 fichiers conformes :
```
npx vitest run previsions-poste-referentiel-sql-artefact-historique-integration.test.ts su12-numero-unique-constraint.test.ts
```
Résultat : **`Test Files 2 failed (2)` / `Tests 4 failed | 12 skipped (16)`** — jamais "passed" ;
`previsions-poste-referentiel...` échoue 4/4 avec le message actionnable et `Caused by: Error:
connect ECONNREFUSED 127.0.0.1:1` ; `su12` échoue au niveau du `beforeAll` (les 12 `it` du fichier
sont marqués "skipped" par Vitest suite à l'échec du hook, le fichier lui-même reste "failed" — la
suite globale n'est jamais verte).

### Interactions signalées
- **Allowlist / test méta** : aucune modification nécessaire (voir ci-dessus).
- **Garde global `ci-db-guard.setup.ts`** : n'interfère pas, périmètre disjoint (CI + absence totale
  de `DATABASE_URL`).
- **Faux positifs à ne PAS corriger** : aucun trouvé. Les 17 fichiers du périmètre gating DB
  correspondent tous à de vrais tests d'intégration Postgres légitimes (allowlistés avec
  justification). Le 3e `it` (ligne 400) de `bons-livraison-transaction-integration.test.ts` est
  hors périmètre : c'est un test unitaire mocké (`vi.fn()`), sans connexion réelle, il ne doit
  **pas** recevoir de garde `dbAvailable`.
- **`bd0-savepoint-integration-persister-origin.test.ts`** contient un `catch`/`return` distinct
  aux lignes 76-82, **à ne pas toucher** : ce n'est pas un garde de test, c'est le comportement
  réel de la fonction testée (`persisterEcartConstate` avale ses erreurs sans les relancer,
  documenté explicitement dans le commentaire du fichier) — seul le garde de test aux lignes
  154-156 relève du périmètre du fix.

### Contraintes de lecture seule
Aucune écriture en base effectuée. Toutes les vérifications ont utilisé soit une URL Postgres
délibérément invalide (`127.0.0.1:1`, connexion refusée), soit la lecture du code source. Aucun
`SELECT` n'a été lancé contre la base de dev partagée EXCEL-V12 — non nécessaire pour cette
pré-analyse, le périmètre P1 est structurel (code des tests), pas une vérification de données.

### Build / Tests
Non lancés dans leur intégralité pour cette pré-analyse (aucune modification de code produite,
lecture seule demandée). `npx tsc --noEmit` déjà connu à 178 erreurs (tests uniquement, zéro
production) par le contexte fourni — non ré-exécuté ici, sans lien avec P1.

## Incohérences trouvées
1. 15 fichiers de test DB-gated réintroduisent le motif interdit ADR-052 §1/§6 (déjà fiché ERR-192,
   non corrigé depuis le 2026-08-05) — liste et lignes ci-dessus.

## Risques identifiés
1. Tant que ces 15 fichiers ne sont pas corrigés, une régression réelle sur les garanties Postgres
   qu'ils prétendent prouver (SAVEPOINT/rollback, verrouillage concurrent, contraintes d'unicité
   composite, agrégations SQL, versionnement de mapping, gel budgétaire, etc. — voir justifications
   de l'allowlist) peut passer complètement inaperçue si la base de dev est down au moment d'un run
   local avec `DATABASE_URL` pointant vers une base injoignable (ex. Docker arrêté mais variable
   restée exportée dans le shell). Impact : Haute, mêmes garanties critiques que citées dans
   ADR-052 §1. Mitigation : appliquer le patron modèle aux 15 fichiers (mécanique, faible risque de
   régression fonctionnelle — seul le comportement d'échec change, aucune assertion métier n'est
   modifiée).
2. Risque d'oubli du `erreurConnexion` (perte du `cause` de l'erreur d'origine) si le fix est fait
   à la main fichier par fichier sans repartir strictement du patron modèle — le message d'erreur
   deviendrait moins actionnable mais resterait bruyant (pas un risque de régression vers le faux
   vert, juste un DX dégradé).

## Prérequis manquants
Aucun. Le helper `requireDatabaseUrl()`, l'allowlist et le test méta sont déjà en place et n'ont
besoin d'aucune évolution — le travail est un remplacement mécanique de corps de garde dans 15
fichiers existants.

## Recommandation
**GO.** Appliquer le patron exact de
`previsions-poste-referentiel-sql-artefact-historique-integration.test.ts` (capture
`erreurConnexion` dans le `beforeAll`, remplacement de chaque
`if (!dbAvailable || !client) { console.warn(...); return; }` par
`if (!dbAvailable || !client) { throw new Error(MESSAGE_DB_INJOIGNABLE, { cause: erreurConnexion }); }`)
aux 15 fichiers listés ci-dessus (48 gardes au total). Ne pas toucher : le garde métier interne de
`bd0-savepoint-integration-persister-origin.test.ts` (lignes 76-82), le 3e test mocké de
`bons-livraison-transaction-integration.test.ts` (ligne 400), l'allowlist, le test méta, le garde
CI global. Après le fix, rejouer la même commande baseline (`DATABASE_URL` invalide) sur les 15
fichiers : ils doivent tous passer en `failed`, jamais `passed` — c'est le critère d'acceptation
falsifiable de cette story (par analogie avec ERR-192 : "4/4 échouent, 8/8 passent" côté modèle,
ici "49/49 échouent" en base injoignable et "49/49 passent" en base joignable — à vérifier par le
tester avec `docker compose up -d` réel).
