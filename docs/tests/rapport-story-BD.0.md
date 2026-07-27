# Rapport de test — Story BD.0 : Un COMPTAGE correctif doit marquer la dérive résolue

**Testeur :** @tester
**Date :** 2026-07-27
**Fichiers examinés :** `src/lib/queries/releves.ts`, `src/lib/guards/assignation-invariant.ts`, `src/__tests__/bd0-comptage-recalcule-ecart.test.ts` (db-specialist), `src/__tests__/comptage-ecart-resolution.test.ts` (tester, indépendant)

## Verdict initial (2026-07-27, avant correction v2) : **FAIL** (conditionnel — un risque réel et reproductible reste ouvert)

> **Mise à jour (2026-07-27, re-vérification) : verdict final PASS.** Voir la section « Re-vérification 2026-07-27 » en fin de ce document — la correction v2 du db-specialist (SAVEPOINT + sonde canary) lève cette réserve, vérifié contre une vraie base avec les deux origines d'erreur SQL possibles.

La story livre le comportement fonctionnel demandé (résolution/aggravation d'écart au COMPTAGE, symétrie MORTALITE) et **tous les tests mockés passent**, y compris les miens. Mais une vérification en base réelle (exigée explicitement par la consigne : *« si le code est dans une transaction Prisma, un try/catch peut ne pas suffire »*) révèle qu'**une erreur SQL réelle (pas seulement une erreur JS) dans le bloc de recalcul d'écart peut faire échouer la création du relevé** — exactement le scénario que la story doit interdire. Ce risque est invisible aux tests mockés (les miens et ceux du db-specialist), qui simulent uniquement des rejets JS (`mockRejectedValue`), jamais une vraie erreur Postgres qui empoisonne la transaction.

## Constat préalable — chronologie de la vérification

Au moment où j'ai lu `docs/TASKS.md` (section Sprint BD) et fait un premier `git status`/`git diff`, **BD.0 n'était pas encore implémentée** : `src/lib/queries/releves.ts` ne contenait aucun appel à `calculerEcartsParBac`/`persisterEcartConstate`, `git status` ne montrait aucune modification de ce fichier, et aucun fichier de test dédié n'existait. J'ai donc écrit mes tests contre le comportement **attendu** (cas a/b/c/d de la consigne). En cours de vérification, le db-specialist a livré son implémentation **en tâche de fond, concurremment** — `git diff` a changé sous mes yeux entre deux lectures du même fichier. Ce n'est pas conforme à la consigne reçue (« tu es SEUL sur l'arbre de travail, aucun autre agent ne tourne ») ; je le signale pour le PM mais je n'ai pas interrompu ni stashé quoi que ce soit — j'ai simplement re-testé contre l'état final une fois stabilisé.

## Ce qui a été livré

`src/lib/queries/releves.ts` (+45 lignes) : dans `createReleve`, après le bloc historique MORTALITE (décrément `AssignationBac.nombreActuel`) et avant la liaison Planning, un nouveau bloc :
```ts
if (
  (data.typeReleve === TypeReleveEnum.MORTALITE || data.typeReleve === TypeReleveEnum.COMPTAGE) &&
  data.bacId && data.vagueId
) {
  try {
    const ecarts = await calculerEcartsParBac(tx, siteId, data.vagueId, [data.bacId]);
    const ecartBac = ecarts.get(data.bacId);
    if (ecartBac) {
      await persisterEcartConstate(tx, siteId, data.vagueId, data.bacId, ecartBac.ecart, { userId, contexte: ContexteDetectionEcart.INDETERMINE });
    }
  } catch (err) {
    console.error("[createReleve] Échec du recalcul d'écart de conservation (non bloquant)", ...);
  }
}
```
Le garde bloquant `verifyAssignationInvariant` n'est **jamais** invoqué (bon réflexe : il peut lever `ConservationError`).

Le db-specialist a aussi livré son propre fichier de test `src/__tests__/bd0-comptage-recalcule-ecart.test.ts` (7 tests, cas a-d + symétrie MORTALITE), et (hors de mon périmètre, ignorés comme demandé) `docs/decisions/ADR-051-...md` et `src/lib/bacs-en-derive-constants.ts`.

## Cas (a)(b)(c)(d) — résultats

| Cas | Test | Résultat |
|---|---|---|
| (a) COMPTAGE ramène l'écart à 0 → `resoluLe` renseigné | Écrit par moi (`comptage-ecart-resolution.test.ts`, test "(a)") **et** par le db-specialist (`bd0-comptage-recalcule-ecart.test.ts`, test "(a)") | **PASS** (les deux) |
| (b) COMPTAGE aggrave l'écart → créé quand même, dérive enregistrée | Écrit par moi (test "(b)") et par le db-specialist (test "(b)") | **PASS mocké** (les deux) — voir réserve ci-dessous |
| (c) `persisterEcartConstate` échoue → relevé créé quand même | Écrit par moi (test "(c)") et par le db-specialist (test "(c)") | **PASS avec un mock JS (`mockRejectedValue`)** — **mais ce test ne couvre PAS le risque réel identifié (voir section suivante)** |
| (d) Bac jamais en dérive → aucune ligne parasite | Écrit par moi (test "(d)") et par le db-specialist (test "(d)") | **PASS** (les deux) |

J'ai dû corriger mes propres tests (a)(b)(c)(d) une fois écrits contre le code : mon premier jet avait oublié que `calculerEcartsParBac` relit `tx.releve.findMany` **dans la même transaction** que celle où `tx.releve.create` vient d'insérer le COMPTAGE — un mock ne le voit pas automatiquement (`read-your-own-writes` doit être simulé manuellement dans le mock, exactement comme documenté dans le commentaire d'en-tête du fichier du db-specialist). Une fois corrigé, mes 4 tests passent avec des valeurs d'écart vérifiées explicitement (`ecart: 0`, `ecart: 40`, etc.), pas seulement `toHaveBeenCalled()`.

## ⚠️ Constat central — BD.0 n'est PAS totalement non-bloquante pour COMPTAGE (risque réel confirmé sur base réelle)

**Le test (c), mocké, donne une fausse assurance.** `mockRejectedValue(new Error(...))` simule un rejet **JS pur** — mais dans une vraie transaction Prisma/Postgres, une erreur SQL réelle (perte de connexion, deadlock, contrainte violée) ne se contente pas de rejeter la promesse : elle **empoisonne toute la transaction Postgres en cours**. Toute requête réelle **suivante** dans la même transaction échoue alors avec `25P02 current transaction is aborted`, **même si l'erreur d'origine a été correctement attrapée en JS**.

J'ai vérifié ce mécanisme directement contre la base réelle (`silures-db`, le conteneur Docker du projet), avec le **même client Prisma et le même adaptateur (`@prisma/adapter-pg`)** que `src/lib/db.ts` :

```
step1 ok: [ { ok: 1 } ]
step2 caught (expected): Invalid `prisma.$queryRawUnsafe()` invocation ... 42P01 relation "..." does not exist
RESULT: prisma.$transaction REJECTED: ... 25P02 current transaction is aborted, commands ignored until end of transaction block
```
La 1ère erreur (SQL réelle) est bien attrapée par un `try/catch` JS — exactement comme le fait le code de BD.0. Mais la requête **suivante** dans la même transaction (non protégée par un `try/catch`) échoue à son tour, avec une erreur **différente et non liée** (« transaction aborted »), qui elle **n'est pas catchée** — et fait donc échouer `prisma.$transaction(...)` dans son ensemble.

**Application directe à `createReleve` :** le bloc BD.0 est placé **avant** la liaison Planning (`ACTIVITE_RELEVE_TYPE_MAP` mappe `COMPTAGE`, donc pour tout COMPTAGE en mode vague classique — le cas normal, pas le mode lot d'alevins — `findMatchingActivite(tx, ...)` exécute une **vraie requête** `tx.activite.findFirst` juste après). Si `calculerEcartsParBac` (qui n'a **aucun** `try/catch` propre — seul le bloc appelant dans `createReleve` en a un) rencontre une erreur SQL réelle (perte de connexion, timeout, deadlock — pas un cas d'école en production), voici ce qui se passe concrètement :
1. L'erreur SQL est attrapée par le `try/catch` ajouté en BD.0 → loggée, pas propagée à ce stade.
2. La transaction Postgres sous-jacente est déjà « aborted ».
3. `findMatchingActivite` (liaison Planning, qui s'exécute juste après pour tout COMPTAGE en mode vague) relance une vraie requête sur la même transaction → échoue avec `25P02`.
4. Cette 2e erreur n'est catchée nulle part → `prisma.$transaction(...)` **rejette** → `createReleve()` **rejette** → **le relevé COMPTAGE échoue**, en violation directe de la contrainte non négociable du sprint.

J'ai aussi vérifié le cas où l'erreur SQL serait la **toute dernière** opération de la transaction (aucune requête après) : dans ce cas `prisma.$transaction` **résout sans erreur** — mais un test complémentaire au niveau du driver `pg` brut montre que le `COMMIT` envoyé après une transaction Postgres avortée est **silencieusement transformé en `ROLLBACK`** (`COMMIT command result: ROLLBACK`), et que Prisma **ne détecte pas cette bascule** : `prisma.$transaction` peut donc parfaitement **résoudre en JS sans lever d'exception alors que TOUT — y compris le `releve.create` d'origine — a été annulé silencieusement en base**. Autrement dit, un simple réordonnancement (« mettre le bloc BD.0 tout à la fin ») ne corrige pas le problème : il le remplace par un problème **encore plus grave** (perte de données silencieuse plutôt qu'échec explicite).

**Conclusion sur ce point (à ne pas maquiller, conformément à la consigne) :** le mécanisme de « best-effort, jamais bloquant » promis par BD.0 fonctionne correctement contre des erreurs **applicatives/JS** (validation, données incohérentes détectées en JS) — c'est ce que couvrent les tests mockés (a)(b)(c)(d), qui sont corrects **pour ce qu'ils testent**. Mais il **ne protège pas** contre une erreur **SQL réelle** dans `calculerEcartsParBac`/`persisterEcartConstate`, qui reste capable de faire échouer (ou, pire, de faire silencieusement perdre) la création d'un relevé COMPTAGE — exactement le risque que la consigne demandait de vérifier « sérieusement ».

### Recommandation (pour le db-specialist, hors de mon périmètre d'implémentation)
La seule protection robuste contre ce risque est d'isoler le recalcul/persistance de l'écart de la transaction principale : soit via une **SAVEPOINT** Postgres explicite (`SAVEPOINT` avant le bloc, `ROLLBACK TO SAVEPOINT` dans le `catch`) pour que l'échec ne contamine que ce sous-bloc, soit en l'exécutant dans une **transaction séparée, après le commit** de la création du relevé (cohérent avec l'intention documentée « best-effort de traçabilité, pas une condition de validité de l'opération métier », ADR-048 section 6). Un simple réordonnancement dans la transaction actuelle ne suffit pas (voir ci-dessus).

## Symétrie entre types de relevé

Le db-specialist a traité MORTALITE et COMPTAGE de façon strictement symétrique (même bloc, même condition `typeReleve === MORTALITE || typeReleve === COMPTAGE`), avec des tests dédiés de symétrie (`bd0-comptage-recalcule-ecart.test.ts`, describe « symétrie »). **Je suis d'accord avec ce périmètre** : ARRIVAGE, VENTE et TRANSFERT ne sont jamais créés via `createReleve` (ils ont leurs propres modules qui appellent déjà `verifyAssignationInvariant`), et BIOMETRIE/ALIMENTATION/QUALITE_EAU/OBSERVATION/RENOUVELLEMENT n'affectent jamais le comptage de poissons. MORTALITE et COMPTAGE sont bien les deux seuls types créés par `createReleve` qui modifient l'état de conservation d'un bac — il n'y a pas d'asymétrie résiduelle non justifiée.

## Non-négociable : « un COMPTAGE ne doit jamais échouer »

- **Confirmé pour les erreurs applicatives/JS** : tests `comptage-ecart-resolution.test.ts` (mes tests, cas b/c) et `bd0-comptage-recalcule-ecart.test.ts` (tests du db-specialist, cas b/c) — tous deux montrent qu'un COMPTAGE qui aggrave l'écart, ou dont la persistance échoue via un rejet JS simulé, est créé sans exception.
- **NON confirmé pour une erreur SQL réelle empoisonnant la transaction** — voir section « Constat central » ci-dessus, reproduite directement contre `silures-db` avec le client Prisma + adaptateur du projet.

## Résultats bruts

- `npx vitest run` (suite complète, machine autrement libre au moment du run) : **5720 tests passés**, 14 skipped, 26 todo, **0 échec**, 224 fichiers passés + 1 skippé. Conforme à la baseline (5709) + mes 4 tests + les 7 tests du db-specialist = 5720. Aucun timeout observé (ERR-107 non applicable).
- `npm run build` : exit code 0, toutes les routes compilent (dont `/releves/nouveau`).
- Vérification manuelle contre base réelle (`silures-db`, Docker, même adaptateur `@prisma/adapter-pg` que `src/lib/db.ts`) : reproduit l'empoisonnement de transaction (voir ci-dessus). Scripts de vérification exécutés en ad hoc, supprimés après usage (non committés — ce n'est pas un livrable de test, seulement une preuve de diagnostic).

## Écarts entre la story et le livré

1. **Le non-bloquant n'est garanti que contre les erreurs JS/applicatives, pas contre les erreurs SQL réelles** (section « Constat central »). C'est un écart direct avec la contrainte non négociable formulée dans `docs/TASKS.md` (« un échec de la persistance ne doit pas faire échouer le relevé »), qui ne précise pas la nature de l'échec mais dont l'intention couvre manifestement ce cas.
2. **Processus** : l'implémentation a eu lieu concurremment à ma vérification alors que la consigne affirmait un arbre de travail figé et un seul agent actif — je le remonte au PM, sans avoir pris de mesure destructive de mon côté.
3. Aucun écart sur (a), (b, JS), (c, JS), (d) ni sur la symétrie MORTALITE/COMPTAGE : conformes à la spécification.

## Fichiers livrés par moi
- `src/__tests__/comptage-ecart-resolution.test.ts` (4 tests, vérification indépendante des cas a/b/c/d) — **note (re-vérification 2026-07-27)** : ce fichier a depuis été fusionné par le db-specialist dans `src/__tests__/bd0-comptage-recalcule-ecart.test.ts` (correction v2) et supprimé ; aucun de mes 4 cas n'a été perdu dans la fusion (vérifié ci-dessous).
- `docs/tests/rapport-story-BD.0.md` (ce rapport)

---

## Re-vérification 2026-07-27 — Verdict : **PASS** (réserve levée)

**Contexte :** le db-specialist a repris la story avec l'option recommandée dans ce rapport (SAVEPOINT Postgres) **plus une requête sonde (« canary »)** ajoutée après investigation complémentaire : `persisterEcartConstate` avale déjà ses propres erreurs SQL en interne sans jamais les relancer (son propre `try/catch`, ADR-048 section 6), donc le `catch` de `createReleve` ne se déclenchait jamais pour ce cas précis et le `ROLLBACK TO SAVEPOINT` n'était jamais émis — un trou que la sonde canary comble.

**Ce que j'ai re-vérifié, avec un œil adversarial, contre une vraie base (`silures-db`, Docker, `DATABASE_URL` exportée) :**

1. **Le scénario exact de ma réserve initiale (erreur SQL réelle dans `calculerEcartsParBac`, suivie d'une vraie requête Planning)** — `src/lib/queries/__tests__/bd0-savepoint-integration.test.ts` (db-specialist, 2 tests) : **PASS**. `createReleve` résout, le relevé COMPTAGE est réellement présent en base (vérifié via une connexion `pg` indépendante du client Prisma utilisé par `createReleve`, pas seulement via la résolution de la promesse — le piège COMMIT→ROLLBACK silencieux que j'avais identifié est explicitement exclu).

2. **Le deuxième mécanisme de poisoning silencieuse, non testé par le db-specialist : une erreur SQL survenant DANS `persisterEcartConstate`, avalée par son propre `try/catch` interne, jamais relancée en JS** — `src/lib/queries/__tests__/bd0-savepoint-integration-persister-origin.test.ts` (écrit par moi, 1 test) : **PASS**. Preuve que la sonde canary (`SELECT 1` après le bloc) détecte bien la transaction empoisonnée même quand aucune exception JS n'a jamais traversé l'appelant, et que le `ROLLBACK TO SAVEPOINT` désavorte correctement la transaction pour permettre au COMMIT final de réellement committer le relevé.

3. **`ROLLBACK TO SAVEPOINT` peut-il lui-même échouer ?** Oui, en théorie, si la connexion Postgres elle-même est rompue (pas seulement la transaction « aborted » mais une coupure réseau/pool) — dans ce cas l'exception remonterait non catchée jusqu'à `prisma.$transaction`, faisant échouer `createReleve()`. Non testé (nécessiterait de simuler une panne d'infrastructure, pas une erreur applicative) : documenté comme risque résiduel accepté, inhérent à toute opération qui dépend d'une connexion vivante à la base — aucun code applicatif ne peut s'en prémunir.

4. **Fusion des fichiers de test** : `src/__tests__/bd0-comptage-recalcule-ecart.test.ts` (fusionné, 9 tests) reprend mes 4 cas originaux (a/b/c/d) à l'identique (mêmes valeurs d'écart vérifiées explicitement), plus la symétrie MORTALITE (3 tests) et l'isolation SAVEPOINT (2 tests). Rien n'a été perdu dans la fusion.

**Résultats d'exécution réelle (DATABASE_URL exportée, machine libre) :**
```
src/lib/queries/__tests__/bd0-savepoint-integration.test.ts               2 passed
src/lib/queries/__tests__/bd0-savepoint-integration-persister-origin.test.ts  1 passed
src/__tests__/bd0-comptage-recalcule-ecart.test.ts                        9 passed
```
Suite complète (DATABASE_URL exportée) : **5753 passés / 0 skip / 0 échec**. Sans DATABASE_URL exportée, ces 3 tests d'intégration DB réelle sont skip par défaut (`describe.runIf(!!DATABASE_URL)`) — **la garantie centrale de BD.0 (résistance à une vraie erreur SQL) n'est vérifiée en continu que si le pipeline CI exporte bien `DATABASE_URL`**, point à faire confirmer par le PM/db-specialist.

**Verdict final BD.0 : PASS.** Détail complet dans `docs/tests/rapport-story-BD.3.md` (Partie 1).
