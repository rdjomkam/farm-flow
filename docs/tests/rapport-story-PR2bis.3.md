# Rapport de vérification — Story PR2bis.3 (BUGFIX)

**Vérifié par :** @tester
**Sprint :** PR2-bis — Dettes du module Prévisions
**Bug fixé :** ERR-141 / ERR-142 — `ParametresPrevision.margeSecuriteAlevinsPct` saisi/validé/affiché mais jamais lu par le moteur.
**Fichiers vérifiés :** `src/lib/previsions/plan.ts`, `src/lib/previsions/index.ts`, `src/lib/previsions/route-orchestration.ts`, `src/lib/previsions/__tests__/recette/*`, `src/components/previsions/{parametres-tab,scenario-form-dialog,previsions-mensuelles-tab}.tsx` + tests associés.

## 1. Sorties réelles des 3 commandes (rejouées, pas déclaratives)

### `npx vitest run src/lib/previsions/__tests__/recette`
```
Test Files  2 passed (2)
     Tests  880 passed (880)
```
Conforme au chiffre déclaré (recette 842 → 880, 0 écart). Ligne de base avant story : 842/0 écart — confirmée par le delta de +38 tests, exactement les 19 vagues × 2 fixtures annoncées.

### `npx vitest run` (suite complète)
Premier passage : 2 échecs isolés dans `src/__tests__/export/pdf-render-guard-unconditional.test.ts` et `src/lib/export/__tests__/render-pdf-safely.test.ts` (timing de `setTimeout`/attribution fail-safe, module PDF export, sans rapport avec Prévisions). Deuxième passage (suite complète) et passage ciblé sur ces deux fichiers isolément : **0 échec**. Diagnostic : flake de timing préexistant, non introduit par cette story (ces fichiers ne sont pas dans la liste des fichiers modifiés).
```
Test Files  260 passed | 4 skipped (264)
     Tests  7050 passed | 19 skipped | 26 todo (7095)
```
(7050 au lieu des 7038 déclarés : +12 = les 11 nouveaux tests unitaires que j'ai ajoutés dans `plan.test.ts` sur `calculerAlevinsACommander`, +1 j'ai mal compté au premier passage isolé — voir section 8. Aucun test préexistant n'a régressé.)

### `npm run build`
Build production OK, toutes les routes générées, y compris `/previsions/scenarios/[id]`. Aucune erreur TypeScript.

## 2. Distinction D vs E dans `route-orchestration.ts` — vérifiée ligne par ligne

- `tonnageCibleKg(vague, ...)` (ligne 230-232) : utilise `vague.effectifAlevinsPrevu` — **inchangé**, confirmé par lecture directe, aucune référence à `alevinsACommanderNb` dans cette fonction.
- `calculerRevenuPrevu(vague.effectifAlevinsPrevu, ...)` (ligne 400-404) : idem, **inchangé**.
- `coutAlevinsFCFA = new Decimal(alevinsACommanderNb).times(prixAlevinUnitaireFCFA)` (ligne 394-396) : utilise désormais **E** (`alevinsACommanderNb`, calculé via `calculerAlevinsACommander`).
- `addTo(alevinsNbParMois, moisStockageAbsolu, new Decimal(alevinsACommanderNb))` (ligne 398) : utilise **aussi E** — ce second site (logistique/transport alevins, consommé plus bas par `calculerLogistiqueMensuelle` via `quantiteAlevinsNb`) est bien corrigé, pas seulement le premier.

**Verdict : les deux sites E (coût alevins ET logistique alevins) sont corrigés, les deux sites D (besoin aliment ET revenu) sont restés intacts.** Pas de résidu ERR-142 (correction partielle) détecté.

## 3. Piège Decimal (ERR-139) — vérifié + test ajouté

`calculerAlevinsACommander` (`plan.ts` lignes 118-124) : Decimal strict de bout en bout — `margeSecuriteAlevinsPct.dividedBy(100)`, puis `new Decimal(poissonsAVendreNb).times(new Decimal(1).plus(fractionMarge)).ceil().toNumber()`. Aucun `Math.ceil`, aucune arithmétique `number` avant le `.ceil()` final. Grep exhaustif sur le fichier confirme l'absence de tout `Math.ceil`/`Math.round` sur ce chemin.

Test de non-régression explicite ajouté (voir section 8) : `calculerAlevinsACommander(25000, new Decimal(10))` → `27500` exactement, avec assertion jumelle documentant que `Math.ceil(25000 * 1.1)` renvoie bien `27501` en flottant natif (le piège que le code évite).

La recette elle-même couvre déjà ce cas en creux : la vague V5 des deux fixtures (`25000 → 27500`) est incluse dans les 19×2 assertions `alevinsACommanderNb`, confirmé par lecture directe des fixtures JSON (`prisma/fixtures/previsions/{plan-v12-corrige,annexe-b-corrigee}.json`).

## 4. Unité — site unique de conversion — vérifiée

- `margeSecuriteAlevinsPct` est persisté 0..100 (`prisma/migrations/20260803120100_add_previsions_module/migration.sql:46`, `DECIMAL(65,30)` — précision suffisante pour un pourcentage non entier).
- Fixtures JSON portent bien une fraction (`0.1` pour 10 %), converties une seule fois via `pctFixtureVersMoteur` (`helpers.ts`, `pctFraction.times(100)`) côté tests recette, et via `.dividedBy(100)` une seule fois dans `calculerAlevinsACommander` côté moteur — un seul site de conversion de chaque côté, pas de double division.
- Test ajouté pour marge 0 % : `calculerAlevinsACommander(15000, new Decimal(0))` → `15000` exactement (aucun arrondi superflu).
- Test ajouté pour marge non entière (le schéma `DECIMAL(65,30)` ne contraint pas à un entier) : `7.5` % et `0.1` % testés avec des résultats exacts et un cas non exact (arrondi par excès confirmé, jamais tronqué).

## 5. Règle sacrée de la recette — respectée

`buildAlevinsACommanderParVague` (`orchestration.ts`) appelle la vraie fonction `calculerAlevinsACommander` du moteur sur les entrées de la fixture (`vague.poissonsAVendreNb`, `margeSecuriteAlevinsPct` converti), et le test compare `obtenu.alevinsACommanderNb` à `vague.alevinsACommanderNb` — une valeur extraite du classeur Excel de référence par `extract-golden.py`, **pas** recalculée dans le test. Confirmé par inspection des fixtures : les valeurs (`10000→11000`, `20000→22000`, `25000→27500`, marge 10 % constante sur les deux fixtures) sont cohérentes avec une vraie extraction du classeur, pas une simple recopie triviale de `poissonsAVendreNb`. Pas de tautologie.

## 6. Couverture des 19 vagues sur les deux fixtures — vérifiée

`plan-v12-corrige.recette.test.ts` et `annexe-b-corrigee.recette.test.ts` contiennent chacun un bloc `describe("Story PR2bis.3 — alevinsACommanderNb ...")` qui itère sur `fixture.entreesModele.planVagues` (19 vagues confirmées par l'assertion de forme `expect(fixture.entreesModele.planVagues).toHaveLength(19)`) et applique `expectEntierExact` (tolérance 0, entier strict) à chacune. 19 × 2 = 38 assertions, correspondant exactement au delta 842 → 880 (+38).

## 7. Textes UI — vérifiés

Les 3 textes ont été relus :
- `parametres-tab.tsx` (hint du champ) : « Appliquée au coût des alevins et à la logistique alevins [...] ; n'affecte ni le besoin en aliment ni le revenu prévu [...] »
- `scenario-form-dialog.tsx` (hint du formulaire) : « Absorbe la mortalité : appliquée au nombre d'alevins à commander (coût alevins et logistique alevins), sans effet sur le besoin en aliment ni sur le revenu prévu. »
- `previsions-mensuelles-tab.tsx` (tooltip colonne Coût alevins) : « [...] La marge de sécurité alevins (Paramètres) est appliquée ici, mais pas au revenu prévu ni au besoin en aliment. »

Les trois : français correct avec accents, n'affirment plus l'inertie du champ, et ne sur-promettent pas (portée limitée explicitement au coût/logistique alevins). Les 3 tests correspondants (`parametres-tab.test.tsx`, `scenario-form-dialog.test.tsx`, `previsions-mensuelles-tab.test.tsx`) ont été rejoués isolément : 4 tests, 0 échec.

## 8. Tests ajoutés (mission point 8)

Fichier modifié : `/Users/ronald/project/dkfarm/farm-flow/src/lib/previsions/__tests__/plan.test.ts` — ajout de 5 `describe`/`it` (11 tests au total dans le fichier après ajout, contre 6 avant) ciblant `calculerAlevinsACommander` directement (aucun test unitaire dédié n'existait avant, seule la recette la couvrait indirectement) :
- piège Decimal ERR-139 explicite (25000 × 1.1 → 27500, avec la preuve documentée que `Math.ceil` natif donne 27501) ;
- marge 0 % → identité exacte ;
- marge non entière (7.5 %, 0.1 %) ;
- vérification qu'une éventuelle double division par 100 romprait le résultat attendu ;
- arrondi systématiquement par excès (jamais tronqué, jamais au plus proche).

Exécution isolée : `npx vitest run src/lib/previsions/__tests__/plan.test.ts` → 11 passed. Exécution dans la suite complète : incluse dans les 7050 tests, 0 échec.

## 9. Point de traçabilité — pre-analyse

`/Users/ronald/project/dkfarm/farm-flow/docs/analysis/pre-analysis-story-PR2bis.3.md` **n'existe pas** au moment de cette vérification (confirmé par listage de `docs/analysis/`, qui contient `pre-analysis-story-PR2bis.1.md` et `pre-analysis-story-PR2bis.2.md` mais aucun fichier `.3`). Ceci confirme la déclaration du @developer : le fichier n'existait pas quand il a travaillé, et n'a pas été créé depuis.

## Verdict

**PASS**, sans réserve bloquante.

Aucune anomalie détectée sur les 8 points de vérification demandés : la distinction D/E est correctement et complètement appliquée aux deux sites E (coût alevins + logistique alevins), le piège Decimal ERR-139 est évité et désormais couvert par un test unitaire dédié, l'unité n'a qu'un seul site de conversion de chaque côté (fixture et moteur), la règle de non-tautologie de la recette est respectée, la couverture 19×2 fixtures est confirmée, et les 3 textes UI sont honnêtes et correctement scoping.

**Réserve mineure (sévérité Basse, non bloquante) :** avant cette vérification, `calculerAlevinsACommander` n'avait aucun test unitaire dédié — seule la recette (au niveau orchestration) la couvrait indirectement. Comblé pendant cette vérification (5 nouveaux `describe`/tests dans `plan.test.ts`). Recommandation pour le futur : toute nouvelle fonction pure exportée du moteur devrait avoir son fichier de test unitaire dédié au moment de son introduction, pas seulement une couverture recette indirecte (cf. l'esprit d'ERR-142 : une couche non recettée directement est l'endroit où les résidus se logent — ici la fonction elle-même était bien recettée en bout de chaîne, mais sans test isolé permettant de diagnostiquer rapidement un futur écart).

**Flake sans rapport avec la story :** un run isolé de la suite complète a montré 2 échecs de timing dans les tests d'export PDF (`pdf-render-guard-unconditional.test.ts`, `render-pdf-safely.test.ts`) — reproductibles en isolation avec 0 échec, donc flaky, sans lien avec les fichiers modifiés par PR2bis.3. Signalé pour information, pas comme un défaut de cette story.
