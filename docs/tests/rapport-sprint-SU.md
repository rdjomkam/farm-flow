# Rapport de tests — Sprint SU, Story SU.4

**Story :** Robustesse transactionnelle de la signature d'un bon de livraison
(`signerBonLivraison`, `src/lib/queries/bons-livraison.ts`)
**Testeur :** @tester
**Date :** 2026-07-26

## Fichiers livrés

- `src/lib/queries/__tests__/bons-livraison-transaction-integration.test.ts` (nouveau)

## Approche retenue et justification

La pré-analyse (`docs/analysis/pre-analysis-sprint-SU-BL.md`, section SU.4) a établi
qu'aucun test du projet n'utilise un vrai `PrismaClient` : `@/lib/db` est mocké
partout, y compris `$transaction` (passthrough factice sans rollback). Un mock de ce
type ne peut structurellement pas prouver l'atomicité réelle ni le comportement de
concurrence — seul le moteur Postgres peut le faire.

J'ai donc retenu l'approche **test d'intégration réel**, en réutilisant le pattern
introduit par SU.12 (`scripts/data-fixes/__tests__/su12-numero-unique-constraint.test.ts`) :
connexion directe via `pg.Pool`/`PoolClient`, `describe.runIf(!!DATABASE_URL)` pour ne
jamais bloquer `npx vitest run` sur une machine sans Docker.

**Différence importante avec SU.12** : SU.12 encapsule tout dans un seul
`BEGIN`/`ROLLBACK` sur une connexion `pg` unique. Ce n'est pas possible ici :
`signerBonLivraison` gère sa **propre** transaction via `prisma.$transaction`, sur sa
propre connexion (le client Prisma partagé de `src/lib/db.ts`, jamais mocké dans ce
fichier de test — c'est la clé qui permet d'appeler la vraie fonction avec un vrai
moteur). On ne peut donc pas englober son appel dans un `BEGIN`/`ROLLBACK` piloté
depuis `pg` : le nettoyage se fait par `DELETE` explicites scoping sur des `siteId`
préfixés `su4-test-*`, dans un `finally`, systématiquement.

Pour déclencher un **vrai** échec en milieu de transaction (sans mocker le moteur, cf.
ERR-103 leçon (e)), j'ai exploité un chemin de code réel et déjà existant :
`verifyAssignationInvariant` (le guard de conservation GT.1/GT.2/SU.2) est appelé en
toute fin de `signerBonLivraison`, après plusieurs écritures. En semant délibérément
une anomalie de données réaliste — un `LigneBonLivraison.nombreMortsTransport > 0`
**sans** le `Releve` VENTE correspondant sur ce bac (le seul cas où
`signerBonLivraison` ne compense pas la nouvelle mortalité par une baisse symétrique
de `nombreVendus`, cf. commentaire du code) — le guard calcule un écart réel et
**rejette réellement** (`ConservationError`), sans aucun mock. C'est un vrai rejet du
vrai moteur de calcul, appliqué à de vraies données en base.

## Ce que les tests prouvent RÉELLEMENT

### 1. Atomicité — échec en milieu de transaction → aucun effet partiel
- Seed réel (Site, User, Vague, Bac, AssignationBac cohérente, Client, Vente
  EN_PREPARATION, LigneVente, BonLivraison EN_ATTENTE_SIGNATURE, LigneBonLivraison
  avec 5 morts transport, **sans** Releve VENTE — anomalie délibérée).
- Appel réel de `signerBonLivraison` (vrai Prisma, vrai Postgres) → rejette
  effectivement avec un message contenant "écart" (`ConservationError`).
- Vérifications en base (vraie lecture SQL, après l'échec) :
  - `LigneVente.nombrePoissons` toujours à 100 (pas décrémenté à 95)
  - `LigneVente.poidsLivreKg` toujours `NULL`
  - `BonLivraison.statut` toujours `EN_ATTENTE_SIGNATURE`, `signeLe` `NULL`
  - `LigneBonLivraison.nombrePoissonsLivres` toujours `NULL`
  - `Vente.statut` toujours `EN_PREPARATION`, `montantTotal` inchangé
  - Aucun `Releve` `MORTALITE` créé pour cette vente (count = 0)
  - Aucune ligne `SiteAuditLog` créée (count = 0)
  - `AssignationBac.nombreActuel` inchangé

Ce test prouve que **toutes** les écritures listées dans l'inventaire de la
pré-analyse (update `LigneVente`, update `LigneBonLivraison`, update `Vente`,
`updateMany` `BonLivraison`) ont été réellement annulées par un **vrai rollback
Postgres** quand une exception survient tard dans la transaction — pas une
simulation, un comportement moteur observé.

### 2. Double signature concurrente
- Seed d'un BL sain (0 mort transport, Releve VENTE présent — isole la question de
  la concurrence de celle du guard, déjà couverte par le test 1).
- Deux appels réels et concurrents (`Promise.allSettled`) de `signerBonLivraison`
  avec les mêmes arguments sur le même `bonLivraisonId`.
- Résultat observé : exactement 1 `fulfilled` + 1 `rejected` (message "deja signe"),
  jamais 2 succès.
- Vérification en base : `Vente.quantitePoissons` = 50 (pas 0, pas de double
  décrément), `Vente.montantTotal` = 50 000 (une seule fois), `BonLivraison.statut`
  = `SIGNE`, exactement 1 ligne `SiteAuditLog` (action `VENTE_CLOTUREE`) — pas 2.

## Ce que les tests NE prouvent PAS (limitation honnête)

Le client Prisma partagé (`src/lib/db.ts`) est configuré avec
`new PrismaPg({ max: 1, ... })` — **une seule connexion physique** dans le pool.
Les deux appels concurrents du test 2 sont donc nécessairement **sérialisés** au
niveau de la connexion Postgres (la deuxième transaction ne peut débuter réellement
qu'après que la première ait libéré la connexion), même s'ils sont lancés
concurremment côté JavaScript (`Promise.allSettled`).

Ce test prouve donc que le garde applicatif (`updateMany` conditionnel sur
`statut != SIGNE`, règle R4) fonctionne correctement contre un **vrai** Postgres
sous un ordonnancement JS concurrent — mais **pas** un scénario de vraie
concurrence moteur (deux transactions Postgres réellement imbriquées dans le
temps, avec verrouillage de ligne disputé entre deux connexions distinctes
simultanées). Prouver ce dernier point nécessiterait de modifier `src/lib/db.ts`
(augmenter `max`) ou d'introduire un second `PrismaClient` dédié au test — les
deux sont hors du périmètre "ne pas modifier le code de production" fixé pour
cette story. Je le signale explicitement plutôt que de laisser croire que le test
couvre un vrai scénario de course entre connexions.

Le test 1 (atomicité) n'a en revanche pas cette limitation : une seule transaction
est en vol, la preuve du rollback réel est complète et ne dépend pas du pool.

## Point de vigilance SU.2 (persistance de l'écart ne doit jamais bloquer l'opération)

Ajouté dans le même fichier (dernier `describe`, hors périmètre "vraie DB" — mock
légitime ici car on teste le comportement propre de la fonction, pas le moteur) :
`persisterEcartConstate` (appelée par `verifyAssignationInvariant`) est invoquée
avec un `tx` factice dont `ecartAssignationConstate.upsert` rejette
systématiquement. Le test vérifie que la promesse **résout** quand même
(`resolves.toBeUndefined()`), confirmant que le `try/catch` interne avale bien
l'erreur d'écriture du journal sans jamais la propager à l'appelant métier — cf.
ADR-048 section 6, déjà en place dans le code actuel de
`src/lib/guards/assignation-invariant.ts`. Ce n'est pas une régression détectée,
c'est une confirmation du comportement voulu, avec un test de non-régression pour
l'avenir.

## Bugs découverts

Aucun bug d'atomicité ou de concurrence détecté dans `signerBonLivraison` lui-même :
le rollback Postgres et le garde `updateMany` conditionnel fonctionnent comme
attendu contre une vraie base.

Aucune anomalie non plus dans le comportement de `persisterEcartConstate` (avale
bien les erreurs, comme documenté par SU.2/ADR-048).

Le seul point notable (pas un bug, informationnel) : une `DeprecationWarning`
node-postgres ("Calling client.query() when the client is already executing a
query is deprecated...") apparaît lors de l'exécution du test de concurrence,
probablement émise en interne par l'adaptateur `@prisma/adapter-pg` sous
contention du pool `max: 1` face à deux transactions concurrentes. N'affecte pas
le résultat du test (3/3 verts) ; à surveiller si `pg` durcit ce comportement en
version 9 (pas d'action requise maintenant).

## Exécution complète (R9)

### `npx vitest run` (avec `DATABASE_URL` exporté vers le Postgres Docker dev,
port 8432 — sans cette variable les 2 tests d'intégration SU.4 et les tests SU.12
existants sont automatiquement `skip`, jamais en échec)

```
Test Files  222 passed (222)
     Tests  5697 passed | 26 todo (5723)
  Duration  72.95s
```

Aucun échec. Test isolé du nouveau fichier (`bons-livraison-transaction-integration.test.ts`)
également vérifié seul, à froid : **3/3 verts**, ~6s. Vérification post-exécution
en base (`docker exec silures-db psql ...`) : **0 ligne résiduelle** portant le
préfixe `su4-test-*` (nettoyage `finally` confirmé effectif même en cas d'échec
attendu du test 1).

### `npm run build`

```
prisma generate → OK (Prisma Client 7.4.2)
prisma migrate deploy → 151 migrations, aucune en attente
next build --webpack → OK, toutes les routes générées, exit 0
```

Aucune erreur TypeScript ni de lint. (Note d'exécution : une première tentative de
build a rencontré un verrou `.next/lock` posé par un build concurrent d'un autre
agent sur la même machine — attendu la fin de ce process, supprimé le lock résiduel,
relancé proprement. Résultat final propre, pas une régression liée à SU.4.)

## Conclusion

Story SU.4 : tests livrés, prouvent réellement l'atomicité (rollback Postgres
complet et vérifié) et un aspect réel (mais partiellement limité par le pool
`max: 1`, documenté ci-dessus) de la protection anti-double-signature. Aucun bug
détecté. Suite complète verte, build propre.
