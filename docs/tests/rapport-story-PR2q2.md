# Rapport de vérification indépendante — Story PR2q.2 « L'épargne dans le moteur »

**Sprint :** PR2-quinquies | **Vérifié par :** @tester | **Date :** 2026-08-04

## Verdict

**Livraison conforme.** `tauxEpargnePct` est réellement consommé de bout en bout (paramètre →
chargement → `calculerProjectionScenario` → sortie), la recette n'est pas tautologique, la
mutation volontaire fait échouer les tests attendus (et a été restaurée à l'identique), et aucune
fixture du jeu d'or n'a été modifiée. Un trou de couverture réel a été trouvé (§4) et comblé par un
test dédié écrit par moi (pas de modification de code de production).

---

## 1. Rejeu des commandes

### `npx prisma migrate deploy`
```
166 migrations found in prisma/migrations
No pending migrations to apply.
```
La migration `20260803170000_add_taux_epargne_pct` était déjà appliquée (vérifié par requête directe :
`_prisma_migrations` contient bien `20260803170000_add_taux_epargne_pct`, et
`\d "ParametresPrevision"` confirme `tauxEpargnePct numeric(65,30) NOT NULL DEFAULT 30`).

### `npx vitest run src/lib/previsions/__tests__/recette`
```
✓ plan-v12-corrige.recette.test.ts (461 tests)
✓ annexe-b-corrigee.recette.test.ts (461 tests)
✓ route-orchestration.recette.test.ts (560 tests)

Test Files  3 passed (3)
     Tests  1482 passed (1482)
```
Conforme au chiffre annoncé (1270 → 1482, soit +212 exactement : +21+21 assertions `epargne` dans
les deux fixtures niveau chaîne financière, + les nouvelles assertions Section C sur `mois[]`, sur
les deux fixtures).

### `npx vitest run` (suite complète, x2 pour détecter la flakiness signalée)
Run 1 :
```
Test Files  277 passed | 5 skipped (282)
     Tests  7880 passed | 21 skipped | 26 todo (7927)
Duration    17.27s
```
Run 2 :
```
Test Files  277 passed | 5 skipped (282)
     Tests  7880 passed | 21 skipped | 26 todo (7927)
Duration    16.75s
```
Résultat **identique et stable** sur les deux runs — voir §7 pour le détail sur l'instabilité
signalée.

### `npm run build`
Build production terminé sans erreur (`ƒ` sur toutes les routes dynamiques, dont
`/previsions/scenarios` et `/previsions/scenarios/[id]`). Aucune ligne `error`/`Type error` dans la
sortie.

---

## 2. Non-tautologie de la recette

Lu directement dans le code :

- `plan-v12-corrige.recette.test.ts:186-188` et `annexe-b-corrigee.recette.test.ts` (même patron) :
  ```ts
  it(`mois ${i} (${moisLabel}) — epargne (tolerance <= 1 FCFA, story PR2q.2)`, () => {
    expectMontantFCFA(chaine.epargneFCFA[i], fixture.resultats.epargne[i], `resultats.epargne[${moisLabel}]`);
  });
  ```
  `chaine` vient de `buildChaineFinanciereCalendrier(...)` (`orchestration.ts`), qui appelle
  **réellement** `calculerEpargne` (`tresorerie.ts:556` : `epargneFCFA.push(calculerEpargne(resultatMois, tauxEpargnePct))`)
  — `fixture.resultats.epargne[i]` est lu tel quel depuis le JSON du jeu d'or, jamais recalculé
  dans le test. Confirmé par lecture de `orchestration.ts:541-571` : aucune formule `max(0,...)
  x taux / 100` réimplémentée localement, seul l'appel à la fonction pure importée.

- `route-orchestration.recette.test.ts:198-201` (Section C, ERR-142) :
  ```ts
  it(`... epargneFCFA == calculerEpargne(resultatFCFA, tauxEpargnePct) (moteur reel appele directement)`, () => {
    const attendu = calculerEpargne(moisCourant.resultatFCFA, scenario.parametres.tauxEpargnePct);
    const ecart = moisCourant.epargneFCFA.minus(attendu).abs();
    expect(ecart.lte(1)).toBe(true);
  });
  ```
  Ici l'« attendu » est un appel **direct au moteur pur réel** (`tresorerie.ts`), jamais une
  réimplémentation de la formule — commentaire explicite en tête de `runSectionC` (lignes 141-171)
  justifiant ce choix : au grain `mois[]` de `calculerProjectionScenario`, le scénario construit
  par le builder de recette (`postes: []`/`journal: []`/`apports: []`) diverge architecturalement
  du jeu d'or complet, donc une comparaison directe à `fixture.resultats.epargne` produirait un
  **faux** écart. Ce test-là ne prouve donc pas la formule (déjà prouvée par les deux tests
  fixture-based ci-dessus) mais la **composition/le câblage** dans `route-orchestration.ts` — un
  test d'identité légitime, pas une tautologie sur la formule elle-même puisque la formule est
  vérifiée ailleurs contre le jeu d'or.

Verdict : **aucune tautologie**. Les valeurs attendues des deux tests « source de vérité » viennent
bien de `fixture.resultats.epargne`, jamais recalculées.

---

## 3. Preuve que le test échoue si le code régresse (mutation volontaire)

**Mutation appliquée** (`src/lib/previsions/tresorerie.ts`) :
```diff
 export function calculerEpargne(resultat: Decimal, tauxEpargnePct: Decimal): Decimal {
-  return Decimal.max(0, resultat).times(tauxEpargnePct).dividedBy(100);
+  return resultat.times(tauxEpargnePct).dividedBy(100);
 }
```
(suppression du `max(0, ...)`)

**Rejeu** (`npx vitest run src/lib/previsions/__tests__/recette src/lib/previsions/__tests__/tresorerie.test.ts`) :
```
Test Files  3 failed | 1 passed (4)
     Tests  11 failed | 1479 passed (1490)
```
Détail des échecs :
- `plan-v12-corrige.recette.test.ts` : mois `2026-11` et `2027-05` — « montant attendu 0 FCFA,
  obtenu -419352 FCFA » / « -1995180 FCFA » (résultat négatif propagé sans clamp).
- `annexe-b-corrigee.recette.test.ts` : même famille d'échec, mois négatifs de la seconde fixture.
- `route-orchestration.recette.test.ts` : 6 échecs sur l'assertion
  `epargneFCFA n'est jamais negative` (Section C), mois 0/1/3 des deux scénarios.

**Restauration** :
```diff
 export function calculerEpargne(resultat: Decimal, tauxEpargnePct: Decimal): Decimal {
-  return resultat.times(tauxEpargnePct).dividedBy(100);
+  return Decimal.max(0, resultat).times(tauxEpargnePct).dividedBy(100);
 }
```
**Rejeu après restauration** :
```
Test Files  4 passed (4)
     Tests  1490 passed (1490)
```
Contenu du fichier relu après restauration : identique au texte livré (`Decimal.max(0,
resultat).times(tauxEpargnePct).dividedBy(100);`), confirmé par grep direct.

---

## 4. ERR-141 — le paramètre est-il réellement consommé de bout en bout ? (trou de couverture trouvé)

**Constat avant intervention** : aucun test existant ne fait transiter deux valeurs *différentes*
de `tauxEpargnePct` par le chemin complet DB → `chargerScenarioPourMoteur` →
`calculerProjectionScenario` → sortie.
- `src/lib/queries/__tests__/previsions-scenario-loader.test.ts` (`seedFullScenario`) **ne seed
  jamais `tauxEpargnePct`** dans l'objet `parametresPrevision` (absent des 93 lignes du fixture, cf.
  lecture directe lignes 76-93) et n'assert jamais dessus.
- Toutes les recettes `__tests__/recette/*.recette.test.ts` **bypassent entièrement**
  `chargerScenarioPourMoteur` : `route-orchestration-builder.ts` construit le `ScenarioPourCalcul`
  directement depuis le JSON, sans jamais passer par le loader Prisma réel. La ligne
  `previsions-scenario-loader.ts:278` (`tauxEpargnePct: prismaDecimalToEngine(parametres.tauxEpargnePct)`)
  n'était donc couverte par **aucun** test qui aurait échoué si elle avait mappé le mauvais champ
  (famille exacte du bug historique sur `margeSecuriteAlevinsPct`, ERR-141).

**Action** : test dédié écrit (pas de modification de code de production) —
`src/lib/queries/__tests__/previsions-scenario-loader-tauxepargne-e2e.test.ts`. Il charge un même
scénario deux fois via le **vrai** `chargerScenarioPourMoteur` (mock Prisma via
`previsions-fake-db.ts`, même pattern que le fichier de test existant) avec `tauxEpargnePct = "10"`
puis `"50"`, passe chaque résultat à `calculerProjectionScenario`, et vérifie :
1. `resultatFCFA` identique des deux côtés (le taux ne doit jamais influencer le résultat lui-même) ;
2. sur tout mois à résultat strictement positif, `epargne(50)/epargne(10) == 5` exactement, et
   `epargne(50) > epargne(10)` ;
3. sur tout mois à résultat ≤ 0, `epargne = 0` des deux côtés ;
4. un second test dédié : `tauxEpargnePct = 0` produit `epargne = 0` sur **tous** les mois, y
   compris ceux à résultat positif.

**Résultat, code livré intact** :
```
✓ src/lib/queries/__tests__/previsions-scenario-loader-tauxepargne-e2e.test.ts (2 tests)
  Tests  2 passed (2)
```

**Preuve que ce nouveau test n'est pas non plus vacuously vrai** — mutation volontaire du mapping
du loader (`tauxEpargnePct: prismaDecimalToEngine(parametres.margeSecuriteAlevinsPct)`, c.-à-d. le
bug exact ERR-141 : lire le mauvais champ) :
```
✗ deux valeurs de tauxEpargnePct differentes produisent des epargneFCFA differentes ...
  AssertionError: expected '0' to be '10' // Object.is equality
```
Restauré immédiatement (`tauxEpargnePct: prismaDecimalToEngine(parametres.tauxEpargnePct)`), rejeu :
```
✓ 2 tests passed
```
`git status` confirme le fichier de production `previsions-scenario-loader.ts` est retourné à
l'identique (aucune trace de la mutation dans le contenu relu).

**Conclusion ERR-141** : `tauxEpargnePct` est réellement consommé de bout en bout — ce n'est **pas**
un paramètre inerte comme l'a été `margeSecuriteAlevinsPct` avant PR2bis.3. Le trou de couverture
identifié (aucun test n'aurait détecté une régression à ce niveau précis) est désormais comblé.

---

## 5. Conversion d'échelle — un seul site de chaque côté

Grep exhaustif de `tauxEpargnePct` sur tout le dépôt (hors `/generated/`) :

- **Côté moteur (fraction/pct → application)** : un seul site de division, `tresorerie.ts:90`
  (`.dividedBy(100)`), à l'intérieur de `calculerEpargne`. Aucun autre `/100` ni `.dividedBy(100)`
  appliqué à `tauxEpargnePct` ailleurs (`route-orchestration.ts:605` passe la valeur brute,
  sans transformation, à `calculerEpargne`).
- **Côté chargement DB → moteur** (`previsions-scenario-loader.ts:278`) : `prismaDecimalToEngine`
  ne fait qu'un `.toString()` → `new Decimal(...)`, aucune division — cohérent avec le fait que la
  base est déjà sur l'échelle 0..100 (`ParametresPrevision.tauxEpargnePct Decimal @default(30)`,
  schema.prisma:4440).
- **Côté validation/API/UI** (`previsions.schema.ts:79`, `parametres-tab.tsx`,
  `previsions-scenarios.ts`, `previsions-scenario-detail-page.tsx:225`) : passage direct de
  chaînes/nombres 0..100, aucune conversion d'échelle nulle part.
- **Côté fixtures du jeu d'or (fraction 0..1 → 0..100)** : un seul site,
  `pctFixtureVersMoteur` (`helpers.ts:203`), appelé une seule fois par valeur dans
  `orchestration.ts:546` (`const tauxEpargnePct = pctFixtureVersMoteur(fixture.entreesModele.parametresScenario.tauxEpargnePct)`)
  et `route-orchestration-builder.ts:162`. Aucune double conversion trouvée.

Verdict : **un seul site de conversion de chaque côté**, comme documenté dans le docstring de
`calculerEpargne` (« l'appelant est responsable de la conversion ... AVANT d'appeler cette
fonction : un seul site de conversion d'échelle, jamais deux »).

---

## 6. Mois à résultat négatif dans le jeu d'or

Confirmé pendant la mutation du §3 (les échecs révèlent exactement ces mois) :
- `plan-v12-corrige.json` : au moins **2026-11** (résultat -419 352 FCFA) et **2027-05**
  (résultat -1 995 180 FCFA), tous deux avec `epargne = 0` assertée à
  `plan-v12-corrige.recette.test.ts:186-188`.
- `annexe-b-corrigee.json` : mois négatifs également présents (échecs symétriques observés dans la
  même mutation, mêmes indices `epargne (tolerance <= 1 FCFA, story PR2q.2)`).
- Confirmé indépendamment côté Section C (`route-orchestration.recette.test.ts`) : les mois 0, 1 et
  3 des **deux** scénarios ont fait échouer l'assertion `epargneFCFA n'est jamais negative` sous la
  mutation, donc `resultatFCFA` y est négatif dans les deux fixtures.

La branche `max(0, ...)` de `calculerEpargne` **est bien exercée** par le jeu d'or — pas besoin d'un
test unitaire dédié supplémentaire pour la couvrir (elle l'est déjà, à plusieurs mois, dans les deux
fixtures).

---

## 7. Instabilité signalée sur `scenario-form-dialog.test.tsx`

- Suite complète rejouée **deux fois** (§1) : `277 passed | 5 skipped`, `7880 passed` sur les deux
  runs, aucun échec, y compris sur ce fichier.
- Fichier rejoué isolément une troisième fois :
  ```
  ✓ src/components/previsions/__tests__/scenario-form-dialog.test.tsx (11 tests) 2114ms
  Test Files  1 passed (1)
       Tests  11 passed (11)
  ```
- **L'instabilité ne s'est pas reproduite** sur les 3 exécutions de cette session (2 runs de suite
  complète + 1 run isolé). Aucune assertion n'a été affaiblie. Reste un point à surveiller côté CI
  (charge machine différente en environnement CI vs local peut faire ressortir la course
  `setTimeout(fn, 0)` documentée sous `@radix-ui/react-dismissable-layer`, cf. ERR-145) — je ne
  peux confirmer ni infirmer une flakiness qui ne s'est pas manifestée dans mon environnement.

---

## 8. Fixtures du jeu d'or

```
$ git diff --stat prisma/fixtures/previsions/
(aucune sortie)
$ git status --short prisma/fixtures/previsions/
(aucune sortie)
```
**Aucune fixture modifiée.**

---

## Livrables de cette vérification

- Nouveau test (comble un trou de couverture réel, aucune modification de code de production) :
  `/Users/ronald/project/dkfarm/farm-flow/src/lib/queries/__tests__/previsions-scenario-loader-tauxepargne-e2e.test.ts`
  (2 tests, tous deux verts contre le code livré).
- Ce rapport :
  `/Users/ronald/project/dkfarm/farm-flow/docs/tests/rapport-story-PR2q2.md`

## Fichiers vérifiés (lecture, aucune modification durable)
- `/Users/ronald/project/dkfarm/farm-flow/prisma/schema.prisma`
- `/Users/ronald/project/dkfarm/farm-flow/prisma/migrations/20260803170000_add_taux_epargne_pct/migration.sql`
- `/Users/ronald/project/dkfarm/farm-flow/src/lib/previsions/tresorerie.ts`
- `/Users/ronald/project/dkfarm/farm-flow/src/lib/previsions/route-orchestration.ts`
- `/Users/ronald/project/dkfarm/farm-flow/src/lib/queries/previsions-scenario-loader.ts`
- `/Users/ronald/project/dkfarm/farm-flow/src/lib/previsions/__tests__/recette/plan-v12-corrige.recette.test.ts`
- `/Users/ronald/project/dkfarm/farm-flow/src/lib/previsions/__tests__/recette/annexe-b-corrigee.recette.test.ts`
- `/Users/ronald/project/dkfarm/farm-flow/src/lib/previsions/__tests__/recette/route-orchestration.recette.test.ts`
- `/Users/ronald/project/dkfarm/farm-flow/src/lib/previsions/__tests__/recette/orchestration.ts`
- `/Users/ronald/project/dkfarm/farm-flow/src/lib/previsions/__tests__/recette/helpers.ts`
- `/Users/ronald/project/dkfarm/farm-flow/src/components/previsions/parametres-tab.tsx`
- `/Users/ronald/project/dkfarm/farm-flow/src/messages/fr/previsions.json`, `en/previsions.json`
