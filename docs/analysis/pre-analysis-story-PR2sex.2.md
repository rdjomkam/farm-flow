# Pré-analyse — Story PR2sex.2 (Sprint PR2-sexies)

**Objet :** implémenter, dans le moteur pur `src/lib/previsions/`, la fonction qui calcule les neuf
séries « DÉTAIL PAR VAGUE — sacs consommés dans le mois (indicatif) » (`besoinsAliments.detailParVagueSacs`
du jeu d'or, extrait par la story PR2sex.1, FAIT), et l'exposer dans la projection mensuelle
(`route-orchestration.ts` → DTO → API → UI).

**Date :** 2026-08-04 | **Analyste :** @pre-analyst | Aucune écriture de code, aucune écriture SQL.

## Statut : GO AVEC RÉSERVES (une décision produit à faire trancher explicitement par l'utilisateur avant le fix de code, cf. point 2)

---

## 0. Base factuelle vérifiée (avant tout raisonnement)

- `npx vitest run` → **281 fichiers passés, 5 skippés (286), 8333 tests passés, 21 skipped, 26 todo, 0 échec.**
- `npx vitest run src/lib/previsions/__tests__/recette` → **3 fichiers, 1904 tests, 0 échec.**
- `npx prisma validate` → **schéma valide.**
- `npm run build` → **exit code 0**, build production terminé sans erreur (le premier essai a heurté un
  verrou `.next/lock` posé par un autre `next build` concurrent d'un agent parallèle sur le même dépôt —
  attendu, retenté après libération du verrou, résultat final propre).
- Ces quatre résultats sont identiques à ceux déjà rapportés par `docs/tests/rapport-story-PR2sex.1.md`
  §7 — **aucune régression détectée entre la fin de PR2sex.1 et le début de cette pré-analyse.**

---

## 1. `ROUND` vs `CEIL` — localisation exacte et non-contamination

**Le `ceil` par calibre existant** est à `src/lib/previsions/aliments.ts:64-66`, à l'intérieur de
`calculerBesoinAlimentMensuel` :

```ts
const sacs = aliment.poidsSacKg.lte(0)
  ? 0
  : quantiteKg.dividedBy(aliment.poidsSacKg).ceil().toNumber();
```

C'est la fonction **Étape 2 du moteur** (ADR-053 §4), qui répond à « combien de sacs acheter » — grain
`(AlimentPrevision, moisCycle)`, appelée par `route-orchestration.ts` (directement ligne 411, et via le
wrapper `ceilViaMoteur` ligne 282) pour peupler `AlimentParVagueEtMoisProjection.sacs`,
`MoisProjectionResult.sacsAlimentsTotal` et `.sacsParGranulometrie` — exactement les séries déjà
recettées par `besoinsAliments.sacsTotal`/`sacsParGranulometrie` du jeu d'or (lignes 7-10 du classeur,
« Sacs à acheter »). C'est une notion différente : « sacs consommés (indicatif) » (lignes 13-23) répond
à une autre question et **n'a pas vocation à influer sur les achats**.

**Non-contamination — obligatoire :** la nouvelle fonction ne doit **ni appeler**
`calculerBesoinAlimentMensuel`, **ni réutiliser** son résultat `sacs` (qui est un CEIL de kg mensuels
par calibre), **ni faire entrer** `quantiteKg`/`poidsSacKg` dans son calcul. La bonne source d'entrée
est le total de sacs déjà arrêté **au niveau du cycle complet, par calibre, par vague** — c'est-à-dire
exactement `sacsEffectifsCycle` tel que déjà calculé et utilisé en `route-orchestration.ts:432`
(`COALESCE(sacsSaisisCycle, sacsCalculesCycle)`, lui-même issu de `sacsCalculesCycle`,
`route-orchestration.ts:381`, `tonnageCibleTonnes.times(aliment.sacsParTonneStandard).ceil()`).
Confirmé sur le jeu d'or : `entreesModele.planVagues[0].sacs2mm = 32` pour V1 est un total de CYCLE, pas
une valeur mensuelle — `32 = ceil(4 tonnes × 8 sacs/tonne)`, exactement l'homologue amendé §11 de ce que
produit `sacsCalculesCycle`.

**Sémantique exacte du `ROUND` d'Excel — vérifiée par lecture de la formule brute du classeur** (pas
seulement `data_only`), `Prévisions!B13` :

```
=ROUND(SUMIFS('Aliment par vague'!$D$4:$D$22,Empoissonnement!$B$4:$B$22,B$3)*N(Aliments!$F$4),0)
```

`ROUND(x, 0)` d'Excel est **half-away-from-zero** (0,5 arrondit toujours en s'éloignant de zéro, y
compris pour les négatifs — pas de banker's rounding, jamais `Math.round` JS natif dont le comportement
sur les négatifs diffère). `src/lib/previsions/decimal-config.ts:44` configure déjà
`Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP })` **globalement**, et
`Decimal.ROUND_HALF_UP` dans `decimal.js` est précisément half-away-from-zero (vérifié : documentation
decimal.js, mode 4, « rounds away from zero » en cas d'égalité) — **c'est déjà le bon mode**, déjà
appliqué par défaut à tout appel `.round()` sans argument dans ce moteur. Précédent direct déjà en place
dans le dépôt : `src/lib/previsions/plan.ts:148`, `fraction.times(daysInTargetMonth).round().toNumber()`,
qui utilise ce même rounding par défaut. **Aucun nouveau helper à écrire** : la nouvelle fonction doit
appeler `.round()` (sans argument, comme `plan.ts:148`) sur le `Decimal` résultat de la somme × pourcentage
— jamais réimplémenter un arrondi, jamais passer par `Math.round`.

---

## 2. Point d'ordre déterminant sur l'arrondi — LE POINT CENTRAL DE CETTE PRÉ-ANALYSE

**Verdict tranché par la lecture de la formule brute du classeur (ci-dessus), pas seulement par les
données :** la formule Excel ne contient **qu'un seul appel `ROUND`**, qui enveloppe l'expression
entière `SUMIFS(...) * pourcentage`. `SUMIFS` s'exécute d'abord (somme des sacs bruts — des entiers
exacts, déjà `ceil`és au niveau de la vague, aucun arrondi intermédiaire), puis la multiplication par le
pourcentage (exacte, aucun arrondi), puis **un seul** `ROUND` final. C'est donc, sans ambiguïté de
lecture : **on somme d'abord les vagues coïncidentes (valeurs exactes), on multiplie par le pourcentage,
PUIS on arrondit une seule fois** — jamais un arrondi par vague suivi d'une somme des arrondis.

**Mais — et c'est le vrai risque à signaler avant tout code — le jeu d'or ne peut PAS le prouver
empiriquement.** Vérification faite sur `entreesModele.planVagues` des deux fixtures : les 19 vagues ont
19 `moisEmpoissonnement` **strictement distincts** (2026-08 → 2028-02, cadence mensuelle stricte, jamais
deux vagues démarrées le même mois). Le mécanisme de coïncidence multi-vagues ne peut se produire, dans
ce moteur, que si **deux `VaguePrevue` partagent le même `moisStockageAbsolu`** — condition qui ne se
réalise sur aucun des 21 mois × 3 positions de cycle des deux fixtures. **Aucun mois discriminant
n'existe dans le jeu d'or actuel** : `Σ sacs(g)` ne contient jamais plus d'un terme, sur toute la
recette disponible. Confirmation croisée : ADR-053 §7 (« Défaut bénin confirmé... lignes 12/16/20
n'affichent qu'une seule vague par lookup... les quantités (`SUMIFS`) cumulent correctement ») documente
ce défaut d'affichage comme théoriquement possible dans le classeur, mais **le jeu de données réel
(v12) ne réalise jamais ce cas** — la seule preuve d'affichage bénin porte sur les étiquettes, pas sur
un vrai cas numérique multi-vagues testé.

**C'est structurellement le même piège que ERR-148/ERR-127** : « `ROUND(Σ)` et `Σ ROUND()` produisent le
même résultat sur l'intégralité du jeu de test disponible dès qu'il n'y a jamais plus d'un terme » n'est
**pas** une preuve d'équivalence générale — c'est un jeu de données qui ne peut structurellement pas
discriminer les deux candidats. La décision de ce sprint (sum-then-round) est donc justifiée **par la
lecture directe de la formule source**, jamais par une "preuve" tirée des 1904 tests de recette
existants ou des neuf nouvelles séries — aucun des deux ne peut, à ce jour, exercer la branche multi-
vagues.

**Recommandation actionnable, à formuler explicitement dans le code et les tests :**
1. Implémenter **sum-then-round** (conforme à la lecture littérale de la formule Excel), documenté dans
   le JSDoc de la fonction avec un renvoi à cette pré-analyse et un avertissement explicite : « le jeu
   d'or ne peut pas discriminer cette formule de l'alternative round-then-sum sur les données
   disponibles — voir §2 ».
2. Écrire un test **synthétique** (non issu du jeu d'or, sur le modèle déjà accepté par la review
   PR2-quinquies §8 pour `ventilerApportsParType`) qui construit un cas à deux vagues démarrées le même
   mois avec des pourcentages qui font diverger `ROUND(Σ)` de `Σ ROUND()` (ex. 2 vagues à 15 et 17 sacs,
   pct = 33 % → `ROUND((15+17)×0.33) = ROUND(10.56) = 11` contre `ROUND(15×0.33)+ROUND(17×0.33) =
   5+6 = 11` — il faut chercher une paire qui diverge réellement, ex. 3 et 3 sacs à 16,66% :
   `ROUND(6×0.1666)=ROUND(0.9996)=1` contre `ROUND(3×0.1666)+ROUND(3×0.1666)=0+0=0`). Ce test protège la
   décision prise ici contre une régression silencieuse, exactement comme l'exige ERR-148/ERR-155.
3. Signaler ce point comme **prérequis de vigilance @tester**, pas comme un blocage : la lecture de la
   formule brute est une preuve suffisante pour trancher (contrairement à ERR-148 où la « preuve »
   invoquée était une démonstration algébrique du cas dégénéré ; ici c'est la formule source elle-même,
   jamais réinterprétée) — mais elle doit être **documentée comme telle**, pas présentée comme
   « validée par le jeu d'or à 0 écart », ce qui serait trompeur au sens d'ERR-148/ERR-155.

---

## 3. Cycle paramétrable — source légitime de `dureeCycleMois`

`ScenarioPrevision.dureeCycleMois Int @default(3)` (`prisma/schema.prisma:4366`) est le paramètre
scénario ; `VaguePrevue.dureeCycleMoisFigee Int` (`prisma/schema.prisma:4571`) en est la **copie gelée
par vague** au moment de la génération (ADR-053 décision 1). `RepartitionMoisAliment.moisCycle Int`
(`prisma/schema.prisma:4552`) est borné `1..scenario.dureeCycleMois` (commentaire du schéma). C'est déjà
la source utilisée par toute la boucle existante de `route-orchestration.ts` (`for (let moisCycle = 1;
moisCycle <= vague.dureeCycleMoisFigee; moisCycle++)`, lignes 410/422/466) — **jamais un `3` en dur**.
La nouvelle fonction doit suivre exactement le même patron : boucler `k = 1..vague.dureeCycleMoisFigee`
**par vague**, jamais sur un `scenario.dureeCycleMois` global ni sur un `3` en dur — deux vagues d'un
même scénario peuvent en théorie porter des `dureeCycleMoisFigee` différents si le paramètre scénario a
changé entre deux générations de plan.

**Incohérence à rejeter explicitement (doctrine 422, ADR-053 §11.2 point 2) :** si une `AlimentPrevision`
porte des `RepartitionMoisAliment` dont le `moisCycle` maximal est **strictement inférieur** à
`vague.dureeCycleMoisFigee` pour une vague qui utilise effectivement ce calibre, la fonction pure
elle-même (zéro I/O, jamais de `throw` métier — voir `calculerBesoinAlimentMensuel`, qui traite un mois
absent comme 0 %, JSDoc ligne 53) **ne doit pas rejeter** : elle doit reproduire le comportement déjà
établi (« un mois absent des `repartitions` n'apparaît simplement pas », `apportionnerCoutAlimentMensuel`
JSDoc ligne 231) — c'est-à-dire traiter le pourcentage manquant comme 0 %, jamais planter. **Le rejet
422 explicite, lui, doit être posé côté orchestration** (`route-orchestration.ts`, comme le fait déjà le
rejet `sacsParTonneStandard === null` ligne 367-372, mappé vers 422 par `PREVISIONS_STATUS_MAP`), pas
dans le moteur pur — cohérent avec la doctrine déjà en place (le moteur ne fait jamais d'I/O ni de rejet
HTTP, seule la couche orchestration/API le fait). **Attention** : ce cas particulier (repartitions
insuffisantes vs `dureeCycleMoisFigee`) n'est aujourd'hui protégé par **aucune validation existante**
trouvée dans `validation.ts` — seule `validerSommeRepartitionMoisAliment` garantit une somme à 100 %,
pas une couverture de `1..dureeCycleMoisFigee`. C'est un gap de validation pré-existant, hors du
périmètre strict de cette story (le moteur pur reste protégé par son traitement « mois absent = 0 % »),
mais **à signaler explicitement au @knowledge-keeper** pour une story de validation dédiée avant PR3 si
elle n'existe pas déjà.

---

## 4. Où poser la fonction — fichier et signatures gelées

**Recommandation : étendre `src/lib/previsions/aliments.ts`**, pas un nouveau fichier. Justification :
c'est le fichier qui porte déjà toute la logique « sacs par granulométrie/vague/mois » (Étapes 2-4 du
moteur + `repartirSacsEntreArticles`, ajoutée en PR2-quater sans toucher aux fonctions existantes,
JSDoc ligne 302 « FONCTION AJOUTEE, ne remplace ni ne modifie aucune fonction existante »). La nouvelle
fonction (« sacs consommés, ROUND, indicatif ») est le pendant direct de `calculerBesoinAlimentMensuel`
(« sacs à acheter, CEIL ») — les documenter côte à côte réduit le risque de confusion future entre les
deux notions, au lieu de le disperser dans un fichier séparé.

Un fichier séparé (ex. `detail-consommation.ts`) reste **acceptable** si @developer préfère isoler le
grain « détail par vague / position de cycle » — la review PR2-quinquies §7 a explicitement validé ce
choix pour `ventilations.ts` (« aucune fonction du moteur modifiée, fichier pur et testé
indépendamment ») et a reformulé la règle : ce qui est protégé, c'est **le moteur recetté** (les
fonctions déjà existantes), pas le nom du fichier — la seule exigence dure est **zéro modification** des
fichiers/fonctions déjà couverts par la recette 1904 tests.

**Signatures gelées, à ne PAS toucher (ADR-053 §12.4)** : `calculerBesoinAlimentMensuel`,
`appliquerPalierRemise`, `apportionnerCoutAlimentMensuel`, `calculerCoutAlimentVague`,
`calculerCoutAlimentGranulometrieParMois`, `repartirSacsEntreArticles` — aucune de leurs signatures ni
de leur comportement ne doit changer. La nouvelle fonction est strictement additive.

**Export** : ajouter le nom de la nouvelle fonction et son (ses) type(s) d'entrée/sortie au barrel
`src/lib/previsions/index.ts`, dans le même bloc `export { ... } from "./aliments";` (ou son propre bloc
si fichier séparé) — suivre exactement le patron déjà en place pour les 5 fonctions actuelles de ce
fichier.

---

## 5. Où l'exposer dans la projection — fichiers exacts, nom de champ recommandé

Chaîne de bout en bout déjà établie pour les séries calendaires analogues (`sacsAlimentsTotal`,
`sacsParGranulometrie`, story PR2q.3) :

1. **`src/lib/previsions/route-orchestration.ts`** — `MoisProjectionResult` (interface, ligne 208) : y
   ajouter un champ, ex. `detailParVagueSacs: { moisCycle1: Record<string, number>; moisCycle2:
   Record<string, number>; moisCycle3: Record<string, number> }` — **mais voir réserve ci-dessous sur la
   généricité `1..dureeCycleMois`, la clé du jeu d'or fige `moisCycle1/2/3`, alors que le moteur doit
   rester générique (§3)**. Recommandation : structurer plutôt comme `Record<number,
   Record<string, number>>` (clé = position de cycle entière, valeur = sacs par `TailleGranule`), pour
   rester cohérent avec un `dureeCycleMois` non figé à 3, et laisser la story de recette (prochaine du
   sprint) mapper `moisCycle1/2/3` du jeu d'or vers les clés `1/2/3` de cette structure — jamais l'
   inverse (ne pas figer le moteur sur la forme du jeu d'or, ADR-053 §12.5 le proscrit explicitement :
   « le moteur pur ne doit jamais être façonné sur la seule richesse structurelle d'un jeu d'or »).
   Calculée dans la boucle par vague déjà existante (lignes 352-490), accumulée par
   `(moisAbsolu, positionCycle, granulometrie)` dans une nouvelle `Map` associative, suivant exactement
   le patron déjà en place (`addTo`, `kgParGranulometrieEtMois`, ligne 340/348).
2. **`src/components/previsions/projection-types.ts`** — `MoisProjectionDTO` (ligne 30) : nouveau champ
   miroir, même forme après conversion `Decimal -> number` (aucun `Decimal` ne doit traverser cette
   frontière, cf. header du fichier).
3. **`src/app/api/previsions/scenarios/[id]/calculer/route.ts`** — la sérialisation `mois.map(...)`
   (ligne 46-70) : ajouter le champ dans l'objet JSON renvoyé, avec la même fonction `n()` de conversion
   pour chaque valeur.
4. **`src/types/api.ts`** n'est **pas** concerné à ce stade : cette DTO de projection est un type local
   (`projection-types.ts`, distinct des DTOs CRUD de `api.ts`, cf. header du fichier) — pas de nouveau
   type dans `src/types/` attendu pour cette story, sauf si @developer choisit d'exposer aussi la liste
   de vagues (point 7) via une route CRUD séparée.
5. **UI (`previsions-mensuelles-tab.tsx`)** : explicitement **hors scope** de cette story si elle reste
   « QUERIES/moteur » comme titré — mais signalé ici car le champ existera dans le DTO sans consommateur
   visuel avant une story dédiée, ce qui est exactement le risque ERR-155 (« une série présente dans le
   jeu d'or mais jamais assertée par la recette/jamais affichée est un angle mort invisible ») —
   **acceptable pour cette story si le @developer documente explicitement, dans son rapport, que
   l'exposition UI est différée à une story suivante**, pas laissée silencieuse.

**Nom de champ recommandé** : `detailParVagueSacs`, identique à la clé du jeu d'or
(`besoinsAliments.detailParVagueSacs`), pour minimiser la friction de mapping entre le moteur, la DTO et
la future recette.

---

## 6. Modèle à deux niveaux calibre → articles — la donnée est déjà disponible au niveau calibre

`sacsCalculesCycle`/`sacsEffectifsCycle` (`route-orchestration.ts:381/432`) sont calculés **au niveau du
calibre** (`AlimentPrevision`, via `aliment.sacsParTonneStandard`), **indépendamment de tout article** —
confirmé par le commentaire ligne 375-380 (« le nombre total de sacs du CALIBRE ne dépend, et n'a jamais
dépendu, que du tonnage et de `sacsParTonneStandard` — INDÉPENDANT de tout `poidsSacKg` »). Le classeur
Excel lui-même ne connaît que 3 calibres (2/3/4 mm), jamais d'article — cohérent. **La nouvelle fonction
doit donc travailler au niveau calibre**, en prenant `sacsEffectifsCycle` (déjà calculé, post-COALESCE
avec la surcharge manuelle) comme entrée, **jamais** `repartirSacsEntreArticles` ni aucune donnée
d'article — ces séries sont indicatives et n'ont pas vocation à descendre au grain article.

---

## 7. Libellé de cohorte — liste des vagues, faisable sans I/O supplémentaire

Le défaut INDEX/MATCH des lignes 12/16/20 (une seule vague affichée par lookup même quand plusieurs
coïncident) est explicitement documenté comme un défaut à ne PAS reproduire (ADR-053 §7, README
`prisma/fixtures/previsions/README.md` §« Défaut bénin confirmé », rapport PR2sex.1 §1). La boucle
existante de `calculerProjectionScenario` itère déjà `vaguesActives` avec accès à `vague.code` — accumuler,
en parallèle de la `Map<moisAbsolu, Map<positionCycle, Decimal>>` des sacs, une
`Map<moisAbsolu, Map<positionCycle, string[]>>` des codes de vague contributrices est une opération pure
supplémentaire, **zéro I/O** (la donnée `vague.code` est déjà chargée en mémoire par
`chargerScenarioPourMoteur`, en amont de la fonction pure). Type recommandé, si exposé :
`vaguesCodes: string[]` en regard de chaque cellule `(moisAbsolu, positionCycle)` du DTO — **mais cette
liste de codes est une préoccupation d'orchestration (elle a besoin de `vague.code`, une donnée
applicative), pas du moteur pur** (`src/lib/previsions/aliments.ts` ne connaît que des `id` opaques,
jamais un `code` métier, cf. `AlimentPrevisionCalcInput.id` JSDoc « traçabilité du résultat uniquement,
jamais lu comme FK »). Recommandation : la fonction pure retourne les sacs indexés par un identifiant de
vague fourni en entrée (ex. `vagueId` déjà présent dans l'input, à ajouter à la signature de la nouvelle
fonction si elle opère par vague), et c'est `route-orchestration.ts` qui compose la liste de codes par
cellule — cohérent avec la séparation déjà en place partout ailleurs dans ce fichier.

---

## 8. Risques de régression — tests concernés

Aucun test existant ne devrait casser : la story est strictement additive (nouvelle fonction, nouveau
champ optionnel/additionnel dans des interfaces déjà étendues à plusieurs reprises sans casse — cf.
`MoisProjectionResult` déjà étendu par PR2q.2/PR2q.3 sans régression). Fichiers à surveiller en review :

- `src/lib/previsions/__tests__/aliments.test.ts` — si la fonction est ajoutée à ce fichier, nouveau
  `describe` à ajouter, aucun test existant à modifier.
- `src/lib/previsions/__tests__/recette/route-orchestration.recette.test.ts` (982 tests) — extension
  attendue par la story suivante du sprint (pas PR2sex.2 elle-même, sauf si le développeur choisit de
  livrer la recette dans la même story) pour comparer `detailParVagueSacs` du DTO/résultat
  d'orchestration aux neuf séries du jeu d'or — **à ne pas oublier** (ERR-155 : une série disponible et
  jamais assertée est un angle mort invisible, exactement le risque qui a motivé PR2sex.1).
- `src/components/previsions/__tests__/previsions-mensuelles-tab.test.tsx` — seulement si l'UI est
  touchée dans la même story ; sinon aucun impact (nouveau champ DTO non consommé par ce composant tant
  qu'une story UI dédiée ne l'exploite pas).
- `src/app/api/previsions/scenarios/[id]/calculer/route.ts` — tests d'intégration API existants (s'il y
  en a) : vérifier qu'aucune assertion stricte sur la forme complète du JSON (`toEqual` exhaustif) ne
  casse par l'ajout d'un nouveau champ ; grep recommandé avant implémentation :
  `grep -rn "toEqual" src/app/api/previsions/scenarios/__tests__/` (à faire par @developer/@tester, hors
  périmètre lecture seule de cette pré-analyse).

Sorties réelles collées ci-dessus en §0 (base avant la story) : **8333 tests / 0 échec, recette 1904/0
écart, build exit 0, `prisma validate` OK.**

---

## Incohérences trouvées

1. **Aucune validation n'existe pour garantir que `RepartitionMoisAliment` couvre `1..dureeCycleMoisFigee`**
   de chaque vague qui utilise le calibre concerné (voir §3) — gap de validation pré-existant, pas
   introduit par cette story, mais qui devient pertinent dès que cette nouvelle fonction est appelée sur
   des données réelles potentiellement incomplètes. À signaler au @knowledge-keeper pour une story
   dédiée si aucune n'existe déjà dans le backlog PR3.
2. **Le jeu d'or ne peut structurellement pas discriminer `ROUND(Σ)` de `Σ ROUND()`** (§2) — pas une
   incohérence de code, mais une limite de preuve à documenter explicitement dans le JSDoc du code
   produit et dans le rapport de test, pour ne pas répéter l'erreur méthodologique d'ERR-148.

## Risques identifiés

1. **Risque de contamination CEIL/ROUND** (§1) — si le développeur réutilise par erreur
   `calculerBesoinAlimentMensuel` ou son résultat `sacs` comme source, la série produite serait fausse
   silencieusement (les deux notions donnent des ordres de grandeur proches, l'erreur ne sautera pas aux
   yeux). Mitigation : JSDoc explicite + test qui compare la nouvelle fonction à un mois où CEIL et ROUND
   divergent numériquement (garantit qu'un mélange accidentel des deux échouerait le test).
2. **Risque de figer le moteur sur `moisCycle1/2/3`** au lieu de `1..dureeCycleMois` générique (§3, §5)
   — céderait à la même erreur méthodologique que celle documentée à l'ADR-053 §12.5 (« modèle façonné
   sur la seule richesse structurelle du jeu d'or disponible »). Mitigation : structure de sortie indexée
   par entier de position de cycle, jamais par un nom de champ `moisCycleN` en dur dans le moteur (le
   nommage `moisCycle1/2/3` peut rester dans la fixture JSON et dans le mapping de test, jamais dans la
   signature TypeScript du moteur).
3. **Angle mort ERR-155** si la story ne prévoit pas, dès maintenant, la story de recette qui comparera
   `detailParVagueSacs` aux neuf séries du jeu d'or — sans elle, le champ existerait sans jamais être
   vérifié, répétant exactement le schéma qui a motivé PR2sex.1 elle-même.

## Prérequis manquants

Aucun. Toutes les données nécessaires existent déjà :
- Le jeu d'or (`besoinsAliments.detailParVagueSacs`, story PR2sex.1, FAIT).
- `sacsEffectifsCycle`/`sacsCalculesCycle` par calibre et par vague (déjà calculés dans
  `route-orchestration.ts`).
- `RepartitionMoisAliment`/`repartitions` par calibre (déjà chargé, déjà consommé par le moteur existant).
- `decimal.js` configuré avec le bon mode d'arrondi (`ROUND_HALF_UP`, déjà en place).

## Recommandation

**GO.** Implémenter dans l'ordre :

1. Nouvelle fonction pure dans `src/lib/previsions/aliments.ts` (ou fichier séparé au choix du
   développeur, cf. §4), signature suggérée :
   ```ts
   export interface DetailConsommationCycleInput {
     alimentPrevisionId: string;
     sacsEffectifsCycle: number; // déjà COALESCE(sacsSaisisCycle, sacsCalculesCycle), calibre
     repartitions: RepartitionMoisInput[];
   }
   export interface DetailConsommationMoisResult {
     alimentPrevisionId: string;
     moisCycle: number; // position 1..N, jamais 3 en dur
     sacsConsommes: number; // ROUND, half-away-from-zero
   }
   export function calculerDetailConsommationParVague(
     ligne: DetailConsommationCycleInput
   ): DetailConsommationMoisResult[]
   ```
   — pour UNE vague, UN calibre : `sacsConsommes = round(sacsEffectifsCycle × pourcentage / 100)` par
   mois de cycle présent dans `repartitions` (même patron que `apportionnerCoutAlimentMensuel`, jamais
   de `ceil`, jamais d'appel à `calculerBesoinAlimentMensuel`).
2. Tests unitaires dédiés dans `__tests__/aliments.test.ts` (ou fichier miroir), incluant explicitement
   le test synthétique de divergence `ROUND(Σ)` vs `Σ ROUND()` décrit en §2, point 2.
3. Export dans `src/lib/previsions/index.ts`.
4. Agrégation multi-vague par mois calendaire dans `route-orchestration.ts` : nouvelle
   `Map<number /* moisAbsolu */, Map<number /* positionCycle */, Map<string /* alimentPrevisionId */,
   Decimal>>>`, alimentée dans la boucle existante (lignes 352-490), puis matérialisée dans
   `MoisProjectionResult.detailParVagueSacs` juste avant le `return` de la boucle mensuelle. Sommer les
   contributions de plusieurs vagues **avant** d'appeler `.round()` (jamais round par vague), conforme
   à §2.
5. Extension `MoisProjectionDTO` (`projection-types.ts`) + sérialisation
   (`api/previsions/scenarios/[id]/calculer/route.ts`) — champ `detailParVagueSacs`.
6. Story de recette séparée (ou section de cette même story si le développeur préfère) : comparer les
   neuf séries du jeu d'or (`besoinsAliments.detailParVagueSacs.moisCycleN.Xmm`) à la sortie réelle de
   `calculerProjectionScenario`/`route-orchestration.ts`, tolérance **0** (entier), sur les 21 mois × 3
   granulométries × 3 positions de cycle — **ne pas différer indéfiniment** (ERR-155).
7. Documenter, dans le rapport de test final, la limite du §2 (jeu d'or non discriminant sur l'ordre
   d'arrondi) de façon aussi explicite que dans cette pré-analyse — ne jamais la présenter comme
   « validée à 0 écart » sans cette réserve.

Aucun blocage technique, aucune dépendance manquante, base (tests/build/schema) saine et vérifiée à
l'instant de cette pré-analyse.
