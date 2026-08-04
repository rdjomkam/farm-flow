# Rapport de test — Story PR2sept.3 (moteur : la remise se décide au tonnage de la vague)

**Date :** 2026-08-04 · **Agent :** @tester · **Sprint :** PR2-septies · **Story :** PR2sept.3
**Périmètre vérifié :** `src/lib/previsions/aliments.ts`, `route-orchestration.ts`, harnais de recette
(`__tests__/recette/`), tests unitaires du moteur. Hors périmètre : UI et `src/messages/` (story 4).

**Verdict global : story 3 VALIDÉE.** Les trois contournements de recette ont réellement disparu, la
remise est réellement exercée de bout en bout, les quatre paliers sont couverts et le **taux retenu**
est asserté (pas seulement le montant). Aucun bug de logique découvert. Quatre tests ajoutés pour
combler des trous réels (ordre des opérations avec arrondi, non-régression ERR-143, paliers vides sur
`calculerCoutAlimentVague`).

---

## 1. Exécution — trois passages consécutifs (R9)

Sorties brutes, compteurs complets.

### Passage 1
```
 Test Files  282 passed | 5 skipped (287)
      Tests  8837 passed | 21 skipped | 26 todo (8884)
   Start at  12:26:28
   Duration  38.69s (transform 30.08s, setup 5.80s, import 105.03s, tests 165.85s, environment 60.47s)
EXIT=0
```

### Passage 2
```
 Test Files  282 passed | 5 skipped (287)
      Tests  8837 passed | 21 skipped | 26 todo (8884)
   Start at  12:27:22
   Duration  34.80s (transform 26.53s, setup 4.82s, import 96.36s, tests 142.87s, environment 54.52s)
RUN2_EXIT=0
```

### Passage 3
```
 Test Files  282 passed | 5 skipped (287)
      Tests  8837 passed | 21 skipped | 26 todo (8884)
   Start at  12:27:58
   Duration  36.37s (transform 26.86s, setup 4.94s, import 95.88s, tests 161.62s, environment 59.53s)
RUN3_EXIT=0
```

**Aucune variation de compteur** entre les trois passages (fichiers, tests, skipped, todo tous
identiques). Aucun test lent isolé, aucune dépendance à l'ordre observée, **aucun warning de fuite de
handle** (`Tests closed successfully` implicite, pas de message `hanging process`).

Base avant sprint (pré-analyse §E) : 287 fichiers / 8753 tests. Après : **8837**, soit **+84** —
chiffre annoncé par @developer, **confirmé exactement**.

Un seul point à signaler, **préexistant et non lié à cette story** : la sortie contient une trace
d'erreur Prisma `P2002` (`meta: { target: ['name'] }`) imprimée par
`src/__tests__/lib/api-utils-numero-p2002.test.ts` — c'est un `console.error` volontaire du chemin
testé (le test passe), pas un échec. Il pollue la sortie et mériterait un `vi.spyOn(console, "error")`,
mais ne relève pas de ce sprint.

### Passage 4 (après ajout de mes tests)
```
 Test Files  282 passed | 5 skipped (287)
      Tests  8841 passed | 21 skipped | 26 todo (8888)
   Duration  37.49s
EXIT=0
```

### `npm run build`
```
⚠ Warning: Next.js inferred your workspace root, but it may not be correct.
  To silence this warning, set `outputFileTracingRoot` in your Next.js config,
  or consider removing one of the lockfiles if it's not needed.
✓ Compiled successfully in 18.3s
Route (app)  … (toutes les routes générées)
ƒ Proxy (Middleware)
BUILD_EXIT=0
```
Le warning `outputFileTracingRoot` est préexistant (lockfiles multiples dans l'arborescence parente),
sans rapport avec la story.

### Recette ciblée `src/lib/previsions/__tests__/recette/`
```
 ✓ src/lib/previsions/__tests__/recette/annexe-b-corrigee.recette.test.ts   (480 tests) 18ms
 ✓ src/lib/previsions/__tests__/recette/plan-v12-corrige.recette.test.ts    (480 tests) 20ms
 ✓ src/lib/previsions/__tests__/recette/route-orchestration.recette.test.ts (1418 tests) 43ms

 Test Files  3 passed (3)
      Tests  2378 passed (2378)
   Duration  463ms
```
**2378 assertions, 0 écart** — au-dessus du seuil exigé (≥ 2300) et conforme au chiffre annoncé.

---

## 2. Vérification point par point des affirmations de @developer (section B)

### B.1 — Les trois contournements ont-ils disparu ? **VÉRIFIÉ**

| Vérification mécanique | Résultat |
|---|---|
| `grep -rn "seuilSacs" src/ prisma/schema.prisma` | **0 occurrence** |
| `sacsParTonneStandard` **en contexte de palier** dans `__tests__/recette/` | **0 occurrence**. Les 8 occurrences restantes sont toutes légitimes : `besoinTotalCycleKg` (l. 86), `sacsCalcules`/`sacsCalculesCycle` (l. 202, 391), le champ de type (helpers l. 29), la construction du scénario (builder l. 96) et deux transpositions de `quantiteKg` dans la recette (l. 89-93, 585). Aucune n'entre dans un seuil. |
| `paliersRemise: []` dans `route-orchestration-builder.ts` | **disparu** — remplacé par `options.paliersRemise ?? buildPaliersRemise(fixture)` (l. 219), les 4 paliers réels par défaut. La JSDoc qui justifiait la neutralisation est supprimée et remplacée par une interdiction explicite de la recréer. |
| `buildCoutAlimentsParVague` / `buildCoutAlimentsParVagueEtMois` | les deux passent `buildPaliersRemise(fixture)` (seuils en tonnes, non mis à l'échelle) et `objectifTonnes` ; les blocs JSDoc « Adaptation d'unité nécessaire » sont supprimés, pas reformulés. |

**Preuve que le retrait n° 3 est réel et non cosmétique — expérience de falsification.** J'ai remis
temporairement `paliersRemise: []` dans le builder d'orchestration et relancé la recette :

```
 Test Files  1 failed | 2 passed (3)
      Tests  71 failed | 2307 passed (2378)
```

**71 assertions tombent** dès que la remise est neutralisée. La recette d'orchestration exerce donc
réellement la remise ; elle n'est pas verte « par indifférence ». (Fichier restauré à l'identique.)

### `paliersRemise: []` restant en `route-orchestration-detail-consommation.test.ts:126` — **RAISONNEMENT VALIDE, tranché en faveur de @developer**

Le raisonnement (« ce fichier n'asserte que des nombres de sacs consommés, aucune grandeur
monétaire ») tient, et il est écrit dans le fichier même (l. 119-125), ce qui le rend vérifiable.
**Je l'ai en outre vérifié empiriquement** : j'ai injecté les 4 paliers réels (0/5/10/15 t →
0/2/4/6 %) dans ce scénario synthétique et relancé le fichier :

```
 Test Files  1 passed (1)
      Tests  5 passed (5)
```

Aucune assertion ne change. Ce n'est donc pas une neutralisation de la règle testée (le contournement
proscrit par §13.4), mais l'absence d'un paramètre hors sujet. Les 6 autres `paliersRemise: []`
restants sont dans des tests d'API/UI/sérialisation qui n'évaluent aucun coût d'aliment — même
statut. **Aucune correction nécessaire.**

### B.2 — 277 369 600 FCFA dans les deux fixtures ? **VÉRIFIÉ**

`prisma/fixtures/previsions/plan-v12-corrige.json:1727` et
`prisma/fixtures/previsions/annexe-b-corrigee.json:1727` portent tous deux
`"dontAliments": 277369600`. L'assertion, identique dans les deux fichiers de recette
(`plan-v12-corrige.recette.test.ts:88-91`, `annexe-b-corrigee.recette.test.ts:95-98`) :

```ts
it("somme des 19 vagues = cumuls.dontAliments", () => {
  const total = resultats.reduce((s, r) => s.plus(r.coutFCFA), new Decimal(0));
  expectMontantFCFA(total, fixture.cumuls.dontAliments, "cumuls.dontAliments");
});
```

où `resultats = buildCoutAlimentsParVague(fixture)` — donc via le moteur réel, seuils en tonnes
passés tels quels. **Le total remisé est bien atteint dans les deux fixtures**, en plus des 19
assertions par vague (`coutAlimentsFCFA`, tolérance ≤ 1 FCFA) et des 19 assertions équivalentes sur
le chemin d'orchestration (`route-orchestration.recette.test.ts:98-108`).

### B.3 — Les 4 paliers sont-ils exercés, et le pourcentage retenu asserté ? **VÉRIFIÉ**

Le **pourcentage lui-même** est asserté à trois endroits distincts :

1. `plan-v12-corrige.recette.test.ts:102-112` et `annexe-b-corrigee.recette.test.ts:109-119` —
   19 tests par fixture comparant `determinerPourcentageRemise(objectifTonnes, paliers)` à
   `planVagues[].remisePct` du jeu d'or.
2. `route-orchestration.recette.test.ts:110-124` — 19 tests **extrayant le taux effectivement
   appliqué par l'orchestration** (`1 − coût_remisé / coût_brut`) et le comparant à `remisePct`
   (écart ≤ 1e-9). C'est la preuve du taux sur le chemin applicatif, pas seulement sur le moteur pur.

Couverture des 4 paliers par les 19 vagues : 4 t → 0 %, 8 t → 2 %, 10 t et 12 t → 4 %, 15 t → 6 %.
Les seuils exacts (V5 à 10 t, V7-V19 à 15 t) sont donc bien exercés.

**Frontière `≤` vs `<` — prouvée par falsification.** J'ai remplacé `tonnageVagueT.gte(...)` par
`.gt(...)` dans `determinerPourcentageRemise` et relancé recette + tests unitaires :

```
 Test Files  4 failed (4)
      Tests  317 failed | 2106 passed (2423)
```

**317 assertions tombent.** La sémantique « seuil atteint exactement → palier applicable » est
réellement prouvée, pas supposée. (Fichier restauré à l'identique.) Elle est en outre figée
explicitement par `aliments.test.ts:104-107` (10 t → 4 %, 15 t → 6 %).

### B.4 — Cas limites : **VÉRIFIÉ, deux compléments ajoutés**

Déjà couverts avant mon intervention, dans `describe("determinerPourcentageRemise")` :

| Cas limite | Test | Statut |
|---|---|---|
| paliers vide (état réel de la base : 0 ligne) | l. 116 | ✅ |
| tonnage strictement sous le plus petit seuil | l. 109 | ✅ |
| paliers non triés en entrée (re-tri interne par `ordre`) | l. 128 | ✅ |
| `ordre` incohérent avec les seuils (frontière assumée §13.8) | l. 133 | ✅ |
| tonnage nul | l. 120 | ✅ |
| tonnage négatif | l. 124 | ✅ |
| paliers vide sur `appliquerPalierRemise` | l. 166 | ✅ |

**Manquait** : paliers vide sur `calculerCoutAlimentVague` (le point d'entrée réellement appelé par la
recette) — **ajouté** (voir §4).

### B.5 — ADR §13.7, `sacsSaisis` : **VÉRIFIÉ, les deux sens sont figés**

`aliments.test.ts:416-445` (« COALESCE(sacsSaisisCycle, sacsCalculesCycle) : la surcharge manuelle
pilote le MONTANT, jamais le palier de remise (ADR-053 §13.7) ») contient bien **les deux moitiés
prescrites** :

- moitié 1 — surcharge à 50 sacs, tonnage 4 t **sous** le seuil : `montant = 750 000`, aucune remise
  (la surcharge ne franchit plus de seuil) ;
- moitié 2 — **même** surcharge, tonnage 12 t **au-dessus** du seuil : `montant = 675 000`, la remise
  s'applique **quand même** sur le montant issu de la surcharge.

La moitié 2 est exactement l'assertion qui **interdit la lecture inverse** « surcharger désactive la
remise ». Elle existe. Un commentaire de justification renvoyant à §13.7 accompagne la réécriture,
comme prescrit. Le pendant côté `calculerCoutAlimentVague` existe aussi (l. 188-195).

### B.6 — Ordre des opérations : **PARTIELLEMENT vérifié → complété par moi**

L'ordre `ceil` par granulométrie → coût brut par ligne → somme → remise sur l'agrégat est bien celui
du code (`aliments.ts:260-265`, `route-orchestration.ts:404-504`), et le `ceil` par granulométrie est
prouvé par le test « PIÈGE MAJEUR » (l. 20).

**Mais aucun test ne distinguait l'ordre inverse (remise par ligne puis somme).** Et il faut être
précis sur pourquoi : **sans arrondi intermédiaire, les deux ordres sont algébriquement identiques**
(`Σ cᵢ(1−r) = (Σ cᵢ)(1−r)`) — un test qui ne compare que ces deux formes ne prouverait donc
strictement rien (même piège méthodologique qu'ERR-148/ERR-155). Le candidat rejeté qui est
réellement distinguable est **« remise + arrondi FCFA par ligne, puis somme »**. J'ai ajouté ce test
(§4). Il échoue si un arrondi s'intercale un jour entre les étapes 3 et 4.

Observation annexe, sans gravité : `route-orchestration.ts:502-504` **réécrit** la multiplication
`× (1 − r/100)` au lieu d'appeler `appliquerPalierRemise`. Le commentaire justifie ce choix (la
ventilation mensuelle a besoin d'un montant remisé par calibre). Ce n'est pas une violation de la
« règle sacrée » (qui vise les harnais de recette), mais c'est une seconde écriture de la formule de
remise dans le dépôt — à surveiller, pas à corriger dans cette story.

---

## 3. Recherche active de régressions (section C)

### « Aucun écart dormant n'est apparu en activant la remise » — **plausible et expliqué, pas suspect**

L'affirmation paraissait remarquable ; elle ne l'est pas, et voici pourquoi. Avant ce sprint, le
chemin d'orchestration **avait déjà** ses 19 assertions `coutAlimentFCFA`, mais comparées à un coût
**brut** reconstruit. En activant les 4 paliers, l'attendu comparé est devenu directement
`planVagues[].coutAlimentsFCFA` du jeu d'or — donc l'assertion a **gagné** en contrainte, elle n'a
pas été relâchée. Vérifications menées :

- **Aucune tolérance élargie.** Les tolérances de la recette sont inchangées et strictes :
  `ecart.lte(1)` sur les montants FCFA, `lte(1e-9)` sur le taux, `expectEntierExact` (tolérance 0)
  sur `alevinsACommanderNb`.
- **Aucune assertion supprimée sans remplacement.** Le diff de `aliments.test.ts` retire 5 cas de
  l'ancien `appliquerPalierRemise` (signature en sacs, devenus inexprimables) et les remplace par
  **10 cas** sur `determinerPourcentageRemise` + 3 sur `appliquerPalierRemise`. Solde nettement
  positif.
- **Une seule contre-preuve a changé de forme** — à signaler, sans que ce soit une régression : le
  test V7 comparait auparavant le montant à `remiseSiRecalculeeParMois` (preuve que le taux n'était
  pas recalculé sur le volume mensuel). Cette contre-preuve n'est plus **exprimable** (la fonction ne
  reçoit plus aucun volume de sacs) ; elle est remplacée par
  `expect(mois1.montantFCFA.equals(1728000)).toBe(false)` (preuve que la remise est bien appliquée).
  C'est un affaiblissement **formel** compensé par le fait que le défaut visé est devenu impossible
  par le type. Acceptable.
- **Les 71 échecs de l'expérience de falsification** (§B.1) sont la preuve la plus directe que la
  recette d'orchestration n'est pas verte par indifférence.

### Les +84 tests sont-ils du remplissage ? **NON — ce sont de vraies assertions**

Ventilation vérifiée par lecture : 38 tests `remisePct` par vague (19 × 2 fixtures, comparaison à
une valeur du jeu d'or), 19 tests d'extraction du taux effectif sur le chemin d'orchestration, le
reste en cas limites du moteur pur avec **valeurs attendues chiffrées calculées à la main et
commentées** (`(26×15000 + 15×12000) × 0,9 = 513 000`, `120 × 18000 × 0,94 × 0,8 = 1 624 320`, etc.).
Aucun test tautologique, aucun `expect(true).toBe(true)`, aucun snapshot. Chaque test paramétré porte
un titre distinct incluant la valeur attendue.

---

## 4. Tests que j'ai ajoutés

Fichier : `/Users/ronald/project/dkfarm/farm-flow/src/lib/previsions/__tests__/aliments.test.ts`
(+4 tests, 45 → 49 ; suite globale 8837 → 8841, toujours 0 échec).

1. **`ERR-143 (non-regression) : deux vagues de MEME tonnage obtiennent le MEME taux`** — fige au
   niveau du comportement ce que la signature rend aujourd'hui impossible à exprimer, pour qu'un
   futur élargissement de signature ne puisse pas réintroduire le défaut sans casser une assertion.
2. **`ERR-143 (non-regression) : un GROS volume de sacs sur une PETITE vague ne declenche aucune
   remise`** — 4 t → 0 %, alors que la même vague consomme 200 sacs de 4 mm, volume qui aurait
   franchi tous les seuils sous l'ancienne règle en sacs.
3. **`liste de paliers VIDE (etat reel de la base) -> cout brut`** sur `calculerCoutAlimentVague` —
   le cas limite manquant sur le point d'entrée réellement utilisé par la recette.
4. **`ORDRE DES OPERATIONS (ADR-053 §13.3, points 3-4)`** — prouve que la somme précède la remise et
   qu'**aucun arrondi ne s'intercale**, en discriminant le candidat rejeté « remise + arrondi par
   ligne puis somme » : `(15001 + 10001) × 0,93 = 23 251,86` (obtenu) contre
   `round(13950,93) + round(9300,93) = 23 252` (rejeté). Le test asserte explicitement que les deux
   valeurs diffèrent, sinon il ne prouverait rien.

### Ce qui manque encore (hors périmètre de la story 3)

- **Trou de couverture UI sur les paliers, toujours ouvert** :
  `src/components/previsions/__tests__/parametres-tab.test.tsx:74` monte le composant avec
  `paliersRemise: []` — le champ seuil, son libellé et son binding ne sont couverts par **aucun**
  test de rendu. Signalé par la pré-analyse (point 6), non traité par la story 3. **À traiter en
  story 4.**
- **Le libellé i18n dit encore « Seuil (sacs) »** (`src/messages/fr/previsions.json:180`,
  et son pendant `en`), alors que le champ TypeScript et la colonne s'appellent désormais
  `seuilTonnes`. **C'est le périmètre exact de la story 4** — signalé ici pour mémoire, pas touché.
- **Aucun test ne couvre `ordre` dupliqué** entre deux paliers du même scénario. La contrainte
  `@@unique([scenarioId, ordre])` existe désormais en base (vérifiée, §5), donc le cas est fermé au
  niveau écriture ; le moteur pur, lui, ne le revalide pas. Trou documentaire mineur, non bloquant.

---

## 5. Intégrité de la base — `EXCEL-V12` (lecture seule stricte, R11)

`DATABASE_URL` lue depuis l'environnement (`.env` non tracké), aucune valeur reproduite ici, aucune
écriture émise (uniquement des `SELECT`).

```
   code    |  statut   | nb_vagues | somme_alevins |        updatedAt
-----------+-----------+-----------+---------------+-------------------------
 EXCEL-V12 | BROUILLON |        19 |        602500 | 2026-08-03 20:10:26.493

 nb_apports
------------
          3

 nb_paliers_total
------------------
                0
```

**`EXCEL-V12` intact** : 19 vagues, 602 500 alevins, 3 apports — conformes à l'attendu.
`updatedAt` = **2026-08-03 20:10:26**, soit *antérieur* à ce sprint (2026-08-04) : le scénario n'a
été touché par personne pendant la story.

Vérifications corollaires sur `PalierRemise` (story 2, contrôlée au passage) :

```
    column_name
-------------------
 id
 ordre
 pourcentageRemise
 scenarioId
 seuilTonnes        ← renommage effectif en base, aucune colonne seuilSacs résiduelle
 siteId

 PalierRemise_scenarioId_ordre_key | CREATE UNIQUE INDEX … ON ("scenarioId", ordre)   ← §13.8 point 3 appliqué
 PalierRemise_pkey / _scenarioId_idx / _siteId_idx
```

Table toujours **vide (0 ligne)** : le renommage était bien un renommage pur, aucune donnée
réinterprétée.

---

## 6. Bugs de logique découverts

**Aucun.** Les trois expériences de falsification (neutralisation de la remise, bascule `≥` → `>`,
injection de paliers dans le test hors sujet) se comportent toutes exactement comme la spécification
le prédit. Tous les fichiers modifiés pour ces expériences ont été **restaurés à l'identique** ; les
seules modifications que je laisse dans le dépôt sont les 4 tests ajoutés en §4.

## 7. Points d'attention pour @code-reviewer

1. `route-orchestration.ts:502-504` réécrit `× (1 − r/100)` au lieu d'appeler `appliquerPalierRemise` —
   seconde écriture de la formule de remise, justifiée par un commentaire, à arbitrer.
2. Le libellé i18n « Seuil (sacs) » et le trou de couverture UI sur les paliers restent ouverts et
   relèvent de la story 4 : ne pas clore le sprint sans eux.
3. Les fichiers les plus critiques de cette story (`route-orchestration-builder.ts`,
   `route-orchestration.recette.test.ts`, `route-orchestration.ts`) sont **non suivis par git** (créés
   depuis le dernier commit) : aucune base de comparaison `git diff` n'existe pour eux. La
   vérification d'un éventuel affaiblissement d'assertion a donc dû être faite par lecture **et par
   falsification empirique** (§B.1, §B.3), pas par diff. À garder à l'esprit lors de la review.
