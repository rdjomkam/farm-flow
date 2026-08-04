# Pré-analyse — Story PR2oct.3 (MOTEUR) — Sprint PR2-octies

## Statut : GO AVEC RÉSERVE (une, non bloquante — voir §2)

## Résumé
Le schéma (story PR2oct.2, FAIT) porte déjà `VaguePrevue.alevinsAchetes` et
`ParametresPrevision.alevinsAchetesParDefaut` (`prisma/schema.prisma:4451,4602`), backfillés
correctement sur `EXCEL-V12`. Aucun autre fichier de production n'a encore été touché : le drapeau
n'existe dans aucun type moteur (`types.ts`, `models.ts`), aucun DTO, aucune query, aucune route,
et le moteur facture encore l'achat d'alevins sur toutes les vagues, achetées ou non. Le point
critique du §6/§14.5 (logistique non gatée) est confirmé par lecture directe du code en plus des
fixtures. La cécité de recette du §7/§14.7 est reconfirmée : 2378/2378 tests passent aujourd'hui
alors que le moteur facture ~42M FCFA d'alevins jamais vérifiés contre le jeu d'or.

## 1. Où `cout_alevins` est calculé aujourd'hui — exhaustif

**Achat (le terme visé par §5.3), un seul site de calcul, jamais dupliqué :**
- `src/lib/previsions/route-orchestration.ts:567-575` — calcul par vague :
  ```ts
  const alevinsACommanderNb = calculerAlevinsACommander(
    vague.effectifAlevinsPrevu,
    scenario.parametres.margeSecuriteAlevinsPct
  );
  const coutAlevinsFCFA = new Decimal(alevinsACommanderNb).times(
    scenario.parametres.prixAlevinUnitaireFCFA
  );
  addTo(coutAlevinsParMois, moisStockageAbsolu, coutAlevinsFCFA);
  addTo(alevinsNbParMois, moisStockageAbsolu, new Decimal(alevinsACommanderNb));
  ```
- Propagé sans recalcul : `VagueProjectionResult.coutAlevinsFCFA` (ligne 201, assigné ligne 591),
  `MoisProjectionResult.coutAlevinsFCFA` (ligne 221, lu depuis `coutAlevinsParMois.get(m)` ligne
  724), entre dans `depensesFCFA` (ligne 730) et dans `calculerCoutProductionVague` (lignes
  788-792, via `vague.coutAlevinsFCFA`).
- `interface VaguePrevuePourCalcul` (`src/lib/queries/previsions-scenario-loader.ts:140-152`) et sa
  construction (lignes 323-333) : **n'a pas** `alevinsAchetes` — le champ n'est pas encore propagé
  depuis Prisma.
- Aucune fonction du moteur pur (`aliments.ts`, `charges.ts`, `logistique.ts`, `vague.ts`,
  `tresorerie.ts`, `budget.ts`) ne calcule de coût d'achat d'alevins — cohérent avec ADR-053 §4,
  tableau des 12 fonctions : aucune n'est nommée `calculerCoutAlevins`. C'est délibérément une
  fonction absente du moteur pur, tout comme GAP 1/GAP 2/GAP 3 documentés en tête de
  `route-orchestration.ts` — un choix déjà pris avant cette story, pas à reconsidérer ici.

**Transport (distinct, ne doit jamais être gaté) :**
- `src/lib/previsions/logistique.ts:148-152` `calculerLogistiqueMensuelle` — `voyagesAlevins`/
  `coutAlevinsFCFA` (nom homonyme, portée locale à cette fonction), fonction pure sans paramètre de
  gating, appelée avec `quantiteAlevinsNb` = `alevinsNbParMois.get(m)` (route-orchestration.ts:712,
  719), lui-même alimenté par `alevinsACommanderNb` (le compte, pas le coût), **jamais gaté** dans
  le code actuel — confirmé, pas de branchement conditionnel nulle part sur ce chemin.

**Types/DTO/API — aucun ne porte `alevinsAchetes` aujourd'hui :**
- `src/types/models.ts:4419-4444` (`VaguePrevue`) et `4232-4273` (`ParametresPrevision`) — absents.
- `src/lib/queries/previsions-vagues.ts:61-66` (`CreateVaguePrevueDTO`), `76-81`
  (`UpdateVaguePrevueDTO`), `83-88` (`ScissionVaguePrevueDTO`) — absents.
- `src/lib/queries/previsions-scenarios.ts:52-69` (`CreateScenarioPrevisionDTO.parametres`),
  `72-88` (`UpdateParametresPrevisionDTO`) — absents.
- `src/lib/validation/previsions.schema.ts:58-80` (`parametresPrevisionCreateSchema`), `230-235`
  (`createVaguePrevueSchema`, dont héritent `updateVaguePrevueSchema` ligne 238 et
  `scinderVaguePrevueSchema` ligne 241-243 par `.partial()`/composition) — absents.
- Générés uniquement dans `src/generated/prisma/**` (client Prisma) — confirmé par grep, aucune
  fuite dans le code applicatif.

**Confirmé par grep exhaustif** (`grep -rln "alevinsAchetes" src/ prisma/`, hors `src/generated`) :
seuls `prisma/schema.prisma`, les deux fixtures JSON, et deux fichiers de recette
(`__tests__/recette/helpers.ts:62` — type `GoldenVague.alevinsAchetes`, `orchestration.ts:523` —
un commentaire) référencent ce nom. Aucun code de production ne le lit.

## 2. La forme exacte — tranchée, avec une réserve documentée sur la remise

**Formule retenue pour `route-orchestration.ts:567-575` :**
```ts
const alevinsACommanderNb = calculerAlevinsACommander(
  vague.effectifAlevinsPrevu,
  scenario.parametres.margeSecuriteAlevinsPct
);
const coutAlevinsFCFA = vague.alevinsAchetes
  ? new Decimal(alevinsACommanderNb).times(scenario.parametres.prixAlevinUnitaireFCFA)
  : new Decimal(0);
addTo(coutAlevinsParMois, moisStockageAbsolu, coutAlevinsFCFA);
addTo(alevinsNbParMois, moisStockageAbsolu, new Decimal(alevinsACommanderNb));
```
`alevinsACommanderNb` (le COMPTE, pas le coût) reste calculé et transporté **inconditionnellement**
— voir §3, il alimente la logistique qui ne dépend pas du drapeau.

- **`nb_alevins` utilisé : `alevinsACommanderNb`, MARGE DE SÉCURITÉ INCLUSE**, pas
  `effectifAlevinsPrevu` brut. C'est déjà la variable en place ligne 567-570 (issue de
  `calculerAlevinsACommander`, moteur pur `plan.ts`, story PR2bis.3/ERR-141-142) — cohérent avec le
  §5.3 des exigences qui parle de "nb_alevins" au sens de ce qui est effectivement commandé/produit
  pour compenser la mortalité prévue, pas du nombre de poissons visés à la vente
  (`effectifAlevinsPrevu`, = D). Ne change pas : seule la multiplication par le prix devient
  conditionnelle.
- **Type : `Decimal`**, cohérent avec ADR-053 décision 5/section 4 (Decimal partout dans le
  moteur) et avec le code déjà en place (`new Decimal(alevinsACommanderNb).times(...)`) — aucun
  changement de convention numérique nécessaire.

**Réserve sur la remise — vérifiée, pas supposée, non tranchée par cette pré-analyse :**
Le §14.2 de l'ADR cite littéralement le §5.3 des exigences : `cout_alevins(vague) = alevins_achetes
? nb_alevins × prix_alevin × (1 − remise) : 0`. J'ai vérifié dans le classeur (fixtures
`prisma/fixtures/previsions/plan-v12-corrige.json`) qu'**un seul mécanisme de remise existe dans
tout le modèle** : `entreesModele.paliersRemise` (`Paramètres!B16:C19`, 4 paliers en tonnes), et
que ce mécanisme est **explicitement scopé au coût aliment** — ADR-053 §13.3 : `coutAlimentVagueFCFA
= (1 − remisePct/100) × Σ_calibres Σ_articles (sacs × prixSac)`, confirmé par le README des
fixtures (« `Aliment par vague!T4:V4` pointe vers `Dépenses!ligne 31` », jamais vers une ligne
alevins). Aucune fixture, aucune cellule du classeur, aucun champ de schéma ne porte de remise
distincte pour les alevins — `entreesModele.planVagues[0].remisePct` est un champ **unique par
vague**, déjà consommé pour l'aliment, jamais réutilisé ailleurs dans les données. Le code actuel
(`route-orchestration.ts:571-573`, avant cette story) n'applique **aucune** remise au coût d'achat
d'alevins.

**Conclusion tranchée pour cette story : ne pas ajouter de remise au coût d'achat des alevins.**
Trois raisons convergentes : (a) ADR-053 §14 — la référence explicite de cette story — ne mandate
aucune formule de remise pour les alevins, contrairement à §13 qui tranche noir sur blanc la remise
aliment ; (b) aucune donnée du dépôt (schéma, fixture, classeur) ne modélise de remise alevins
distincte à appliquer, et le seul mécanisme existant est déjà explicitement scopé à l'aliment par
une décision actée (§13.3) ; (c) inventer une réutilisation du `PalierRemise` de la vague pour les
alevins serait une décision d'architecture non validée, invérifiable par la recette (aucune fixture
n'exerce `alevinsAchetes = true`, donc aucun nombre ne permettrait de trancher entre « pas de
remise » et « remise réutilisée » — même piège qu'ERR-160). Le `(1 − remise)` du §5.3 cité par
l'ADR est donc traité comme une **citation fidèle d'un texte externe non encore opérationnalisé**,
exactement comme le §5.7 (ADR §6) et le `seuilSacs` (ADR §13.1) l'ont été avant correction — sauf
qu'ici aucune correction n'est actée, donc rien à implémenter au-delà de ce que dit §14.2 littéral
(la branche conditionnelle sur `alevinsAchetes`), pas la sous-formule de remise. **À signaler
explicitement dans le brief développeur et dans le rapport de test comme un écart documenté entre
le texte des exigences et l'implémentation** — si un futur sprint doit modéliser une remise alevins,
il lui faudra d'abord une donnée de recette capable de la discriminer, ce qui n'existe pas
aujourd'hui.

## 3. QUESTION CRITIQUE — la logistique alevins ne dépend PAS du drapeau (confirmé, code + fixtures)

**Vérifié par lecture directe du code, pas seulement par les fixtures :**
- `route-orchestration.ts:712` : `const quantiteAlevinsNb = alevinsNbParMois.get(m) ?? new
  Decimal(0);` — alimenté ligne 575 par `alevinsACommanderNb` **inconditionnellement** (aucun test
  sur `vague.alevinsAchetes` sur ce chemin).
- `route-orchestration.ts:714-721` : `calculerLogistiqueMensuelle({ ..., quantiteAlevinsNb,
  transportAlevins: scenario.parametres.transportAlevins })` — la fonction
  (`logistique.ts:133-153`) n'a **aucun paramètre de gating** dans sa signature
  (`LogistiqueMensuelleInput`), c'est une fonction pure de transport, indépendante par construction
  de la provenance des alevins.

**Vérifié contre les fixtures (valeurs numériques exactes, `plan-v12-corrige.json`), sur un
scénario où les 19 vagues portent `alevinsAchetes: "NON"` sans exception :**
```
logistique.voyagesAlevins   = [1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 0, 0]
logistique.transportAlevins = [30000, 30000, 60000, 60000, 60000, 60000, 90000, 90000, 90000,
                                90000, 90000, 90000, 90000, 90000, 90000, 90000, 90000, 90000,
                                90000, 0, 0]
depenses.alevins             = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
```
Le transport est non nul sur 19/21 mois pendant que l'achat vaut 0 sur les 21 mois — preuve
chiffrée que le classeur de référence continue de facturer le transport d'une ferme en production
100% interne.

**Conclusion formelle : le drapeau `alevinsAchetes` gate `coutAlevinsFCFA` (achat,
`route-orchestration.ts:571-573`) et UNIQUEMENT lui. Il ne doit JAMAIS gater `voyagesAlevins` ni
`transportAlevins` (`logistique.ts`).** Raison métier (ADR-053 §14.5, déjà écrite en toutes
lettres) : une ferme qui produit ses propres alevins les transporte quand même, de l'écloserie
interne jusqu'aux bacs de grossissement — le déplacement physique ne dépend pas de qui l'a payé.
`logistique.ts` reste **intouché** par cette story.

## 4. Le défaut de scénario — où et comment `alevinsAchetesParDefaut` s'applique

Quatre points d'application, tous côté couche query (le moteur pur `plan.ts` reste intouché — il ne
connaît pas `ParametresPrevision`) :

1. **`createVaguePrevue`** (`src/lib/queries/previsions-vagues.ts:165-199`) — le `select` du
   scénario à la ligne 173-176 (`select: { id: true, dureeCycleMois: true }`) doit être étendu pour
   inclure `parametres: { select: { alevinsAchetesParDefaut: true } }` (ou charger `parametres`
   dans le même appel), puis `data.alevinsAchetes ?? scenario.parametres.alevinsAchetesParDefaut`
   à la création (ligne 181-192), même patron que `effectifAlevinsPrevu`/
   `effectifAlevinsParVague` déjà en place pour ce même fichier.
2. **`genererPlanVaguesPrevues`** (ligne 635-687) — `chargerPourGenerationPlan` (ligne 525-549)
   charge déjà `scenario.parametres` en entier (`include: { parametres: true }`, ligne 532), donc
   `parametres.alevinsAchetesParDefaut` est déjà disponible sans changement de requête. Le
   `createMany` (ligne 670-681) doit ajouter `alevinsAchetes: parametres.alevinsAchetesParDefaut`
   à chaque ligne créée — **jamais dans `genererTheorique`/`genererPlanEmpoissonnement`** (moteur
   pur, `plan.ts:57-85`, `VaguePrevueGeneree` n'a et ne doit pas avoir ce champ — c'est la couche
   query qui fusionne, exactement la conclusion déjà actée par la pré-analyse PR2oct.2 §2).
3. **`scinderVaguePrevue`** (ligne 249-299) — copie depuis le **parent**, jamais depuis le défaut
   scénario (même règle que `dureeCycleMoisFigee`, ligne 280, commentée explicitement « copiée
   depuis le PARENT »). Le `select` du parent (ligne 263-266, `select: { id: true, scenarioId:
   true, dureeCycleMoisFigee: true }`) doit ajouter `alevinsAchetes: true`, et chaque enfant créé
   (ligne 271-287) doit porter `alevinsAchetes: parent.alevinsAchetes`.
4. **`updateVaguePrevue`** (ligne 205-234) — champ librement éditable après création (comme
   `effectifAlevinsPrevu`), pas un défaut à appliquer mais une écriture directe si fournie
   (`UpdateVaguePrevueDTO.alevinsAchetes?: boolean`).

`ParametresPrevision.alevinsAchetesParDefaut` lui-même n'a besoin d'aucune logique d'application —
c'est une colonne simple, créée/mise à jour telle quelle par `createScenario`
(`previsions-scenarios.ts:142-...`, ligne ~195 zone d'assignation des champs `parametres`) et
`updateParametresPrevision` (ligne 364-..., zone ~404-406).

## 5. `prixAlevinUnitaireFCFA` quand le drapeau est `false` — confirmé, rien ne le force à 0

Vérifié par grep sur tout `src/lib/queries/previsions-*.ts` et les routes API du module : aucune
écriture conditionnelle sur `prixAlevinUnitaireFCFA` n'existe nulle part — ni à la création
(`previsions-scenarios.ts` l'assigne telle quelle depuis le DTO), ni à l'update (idem), ni dans le
moteur (`route-orchestration.ts` le lit, ne l'écrit jamais). Aucune validation zod
(`parametresPrevisionCreateSchema:58-80`) ne le rend conditionnellement nul. Le champ reste
`nonNegativeNumber` sans lien avec un autre champ. **Aucun chemin ne le remet à 0 ni ne le valide
comme obligatoirement nul** — cohérent avec ADR-053 §14.4 et avec le fait que ce contournement a
déjà eu lieu une fois (le `0` constaté sur `EXCEL-V12` avant le backfill de la story PR2oct.2) : la
story MOTEUR ne doit **rien ajouter** qui reproduirait ce contournement — juste gater la
consommation du prix (§2), jamais son stockage.

## 6. La cécité de la recette (réserve ERR-160/§14.7) — confirmée par exécution, pas seulement lue

**Preuve exécutée pendant cette pré-analyse** (`npx vitest run
src/lib/previsions/__tests__/recette`) : **2378/2378 tests passent aujourd'hui**, moteur actuel
(avant tout fix) qui facture un coût d'achat d'alevins non nul sur chaque mois de stockage
(`prixAlevinUnitaireFCFA = 70` lu directement depuis la fixture par
`route-orchestration-builder.ts:162`).

**Deux trous distincts, confirmés par lecture directe :**
1. `src/lib/previsions/__tests__/recette/orchestration.ts:557-563`
   (`buildChaineFinanciereCalendrier`) lit `vague.coutAlevinsFCFA` **directement depuis la
   fixture** (jamais depuis une sortie du moteur réel) — documenté honnêtement dans son propre
   JSDoc (lignes 522-526) comme une entrée de modèle, pas une sortie calculée. Ce helper reste
   correct après le fix (la fixture porte déjà `alevinsAchetes: "NON"` partout, donc `0` reste la
   bonne valeur), mais il **ne prouve rien** sur le nouveau drapeau : à laisser tel quel, sans
   toucher à sa logique, en s'assurant que son JSDoc reste honnête sur cette limite.
2. `src/lib/previsions/__tests__/recette/route-orchestration.recette.test.ts` — appelle bien le
   vrai code (`calculerProjectionScenario`), mais **aucune assertion** ne compare
   `coutAlevinsFCFA` (ni au niveau vague `VagueProjectionResult.coutAlevinsFCFA`, ligne 201 du
   fichier source, ni au niveau mois calendaire `MoisProjectionResult.coutAlevinsFCFA`, ligne 221)
   à une valeur du jeu d'or. Confirmé par lecture ligne à ligne des blocs `describe` existants
   (lignes ~90-320) : le seul champ lié aux alevins testé est `alevinsACommanderNb` (ligne
   135-137 pour la vague, ligne 306-312 pour le mois) — un **compte**, insensible au prix par
   construction, jamais le coût.

**Assertions manquantes à ajouter, deux grains, valeurs exactes :**
- **Niveau vague** — après le bloc existant ligne 135-137 (`alevinsACommanderNb`), ajouter :
  ```ts
  it(`${vague.vague} — coutAlevinsFCFA == planVagues[].coutAlevinsFCFA (0 sur alevinsAchetes=NON, tolerance 1 FCFA)`, () => {
    expectMontantFCFA(projection.coutAlevinsFCFA, vague.coutAlevinsFCFA, `${vague.vague}.coutAlevinsFCFA`);
  });
  ```
  comparé à `fixture.entreesModele.planVagues[i].coutAlevinsFCFA` (toujours `0` dans le jeu d'or) —
  19 vagues × 2 fixtures = 38 nouvelles assertions.
- **Niveau mois calendaire** — après le bloc existant ligne 306-312 (`alevinsACommanderNb`),
  ajouter :
  ```ts
  it(`${label} — mois ${libelleMois} — coutAlevinsFCFA == depenses.alevins`, () => {
    expectMontantFCFA(moisCourant.coutAlevinsFCFA, fixture.depenses.alevins[m], `${label}.mois[${libelleMois}].coutAlevinsFCFA`);
  });
  ```
  comparé à `fixture.depenses.alevins[m]` (série de 21 zéros dans les deux fixtures, vérifié
  `python3` ci-dessus) — 21 mois × 2 fixtures = 42 nouvelles assertions.
- `expectMontantFCFA` existe déjà (`helpers.ts:179-...`, tolérance ≤ 1 FCFA, cohérent README).
  Total : **+80 assertions**, base 2378 → 2458 attendu après ce seul ajout (avant même la
  couverture synthétique du §7).

## 7. Couverture synthétique du cas `alevinsAchetes = true`

Aucune fixture réelle ne l'exerce (19/19 vagues à `NON`). Plan de test précis, **hors recette**
(nouveau fichier, ne touche pas aux fixtures ni aux 2378+80 tests de recette qui doivent rester à 0
écart) :

**Fichier proposé :** `src/lib/previsions/__tests__/route-orchestration-alevins-achetes.test.ts`
(à côté des autres tests unitaires ciblés de `route-orchestration.ts`, ex.
`route-orchestration-detail-consommation.test.ts` déjà cité par ERR-160 — même dossier, même
patron : construire un `ScenarioPourCalcul` synthétique minimal à la main, sans passer par les
builders de recette).

**Entrées, calculées à la main :**
- Une vague unique, `effectifAlevinsPrevu = 10000`, `margeSecuriteAlevinsPct = 10` (%) →
  `alevinsACommanderNb = calculerAlevinsACommander(10000, 10) = 11000` (moteur pur `plan.ts`,
  arrondi déjà couvert par ses propres tests unitaires — pas à revalider ici).
- `prixAlevinUnitaireFCFA = 70`.
- **Cas A — `alevinsAchetes = true`** : `coutAlevinsFCFA` attendu = `11000 × 70 = 770 000` FCFA
  exactement (aucune remise appliquée, §2).
- **Cas B — `alevinsAchetes = false`**, mêmes entrées par ailleurs : `coutAlevinsFCFA` attendu =
  `0` (non-régression explicite du comportement déjà couvert par la recette, mais avec une
  assertion dédiée et un nom de test qui documente le contraste).
- **Cas C — deux vagues le même mois de stockage, l'une à `true` l'autre à `false`** :
  `MoisProjectionResult.coutAlevinsFCFA` de ce mois doit valoir exactement le coût de la seule
  vague `true`, pas la somme des deux ni zéro — ce cas exerce l'agrégation par mois calendaire
  (`addTo(coutAlevinsParMois, ...)`, ligne 574) avec un mélange des deux drapeaux dans le même mois,
  jamais exercé autrement.
- **Cas D — transport non gaté même à `alevinsAchetes = false`** : sur le cas B, vérifier que
  `MoisProjectionResult.logistique.voyagesAlevins` et `.sousTotalFCFA` restent non nuls
  (`calculerVoyages(11000, capacite)` avec une capacité de test, ex. 20000 → 1 voyage), preuve
  directe et automatisée de la garantie du §3 — un test qui casserait immédiatement si un futur
  développeur gate `logistique.ts` par erreur.

**La recette reste à 0 écart et son nombre d'assertions ne diminue pas** : ce fichier est
entièrement séparé des trois fichiers de recette (`plan-v12-corrige`, `annexe-b-corrigee`,
`route-orchestration.recette.test.ts`), n'importe aucune fixture, ne modifie aucun fichier
existant de recette — base 2378 (+80 du §6) reste intacte, ce fichier synthétique s'additionne par
au-dessus (nombre exact de tests laissé à l'implémentation, ~6-8 `it()` suffisent pour les 4 cas).

## 8. Fichiers à modifier — liste exhaustive et ordonnée

**@developer (moteur + couches d'accès, dans cet ordre de dépendance) :**
1. `src/types/models.ts` — `VaguePrevue.alevinsAchetes: boolean` (après ligne 4433, avant
   `statut`) et `ParametresPrevision.alevinsAchetesParDefaut: boolean` (après ligne 4241, avant
   `prixVenteKgFCFA`, ou en fin de bloc alevins).
2. `src/lib/validation/previsions.schema.ts` — `alevinsAchetesParDefaut: z.boolean().optional()`
   dans `parametresPrevisionCreateSchema` (ligne 58-80) ; `alevinsAchetes: z.boolean().optional()`
   dans `createVaguePrevueSchema` (ligne 230-235) — `updateVaguePrevueSchema`/
   `scinderVaguePrevueSchema` en héritent automatiquement.
3. `src/lib/queries/previsions-scenarios.ts` — `CreateScenarioPrevisionDTO.parametres` (ligne
   52-69) et `UpdateParametresPrevisionDTO` (72-88) : ajout `alevinsAchetesParDefaut?: boolean`.
   Zone d'assignation Prisma dans `createScenario` (~ligne 195) et `updateParametresPrevision`
   (~ligne 404-406) : propager le champ (avec `??` défaut Prisma `false` si absent en create,
   conditionnel `!== undefined` en update, même patron que `prixAlevinUnitaireFCFA`).
4. `src/lib/queries/previsions-vagues.ts` :
   - `CreateVaguePrevueDTO` (61-66), `UpdateVaguePrevueDTO` (76-81), `ScissionVaguePrevueDTO`
     (83-88) : ajout `alevinsAchetes?: boolean`.
   - `createVaguePrevue` (165-199) : étendre le `select` scénario (173-176) pour charger
     `parametres.alevinsAchetesParDefaut`, appliquer `data.alevinsAchetes ??
     scenario.parametres.alevinsAchetesParDefaut` (ligne ~181-192).
   - `updateVaguePrevue` (205-234) : ajouter la branche conditionnelle standard pour
     `alevinsAchetes`.
   - `scinderVaguePrevue` (249-299) : étendre le `select` parent (263-266) avec
     `alevinsAchetes: true`, copier `alevinsAchetes: parent.alevinsAchetes` dans chaque enfant créé
     (271-287).
   - `chargerPourGenerationPlan` (525-549) : aucun changement de requête nécessaire
     (`include: { parametres: true }` charge déjà tout).
   - `genererPlanVaguesPrevues` (635-687) : ajouter `alevinsAchetes:
     parametres.alevinsAchetesParDefaut` dans le `createMany` (670-681).
5. `src/lib/queries/previsions-scenario-loader.ts` — `interface VaguePrevuePourCalcul` (140-152) :
   ajouter `alevinsAchetes: boolean`. Construction (323-333) : ajouter `alevinsAchetes:
   v.alevinsAchetes`.
6. `src/lib/previsions/route-orchestration.ts` — lignes 567-575 : gater `coutAlevinsFCFA` sur
   `vague.alevinsAchetes` (formule §2), **ne pas toucher** `alevinsACommanderNb`/
   `alevinsNbParMois` (compte, inconditionnel), **ne pas toucher** `logistique.ts` ni l'appel
   `calculerLogistiqueMensuelle` (714-721).
7. `docs/knowledge/ERRORS-AND-FIXES.md` — nouvelle entrée si le @developer découvre un écart
   pendant l'implémentation (ex. si la réserve §2 sur la remise doit être révisée) ; sinon rien à
   ajouter côté MOTEUR au-delà de ce que ERR-160/§14.7 documentent déjà.

**@tester :**
1. `src/lib/previsions/__tests__/recette/route-orchestration-builder.ts` — mapper
   `v.alevinsAchetes === "OUI"` (fixture) vers `VaguePrevuePourCalcul.alevinsAchetes` dans
   `buildScenarioPourCalculDepuisFixture` (ligne 180-209, dans l'objet retourné ligne 197-208).
2. `src/lib/previsions/__tests__/recette/route-orchestration.recette.test.ts` — deux nouveaux
   blocs d'assertions décrits §6 (niveau vague après ligne 137, niveau mois calendaire après ligne
   312).
3. Nouveau fichier `src/lib/previsions/__tests__/route-orchestration-alevins-achetes.test.ts` —
   les 4 cas synthétiques du §7.
4. `docs/tests/rapport-story-PR2oct.3.md` — rapport de test, avec le décompte exact avant/après
   (2378 → attendu ~2458 sur la recette + N tests synthétiques), et la réserve du §2 (pas de remise
   alevins) rapportée explicitement au PM/architect.

**Fichiers explicitement à NE PAS toucher (confirmé intouchés par cette story) :**
`src/lib/previsions/logistique.ts`, `src/lib/previsions/plan.ts` (`genererPlanEmpoissonnement`
reste sans `alevinsAchetes`), `src/lib/previsions/__tests__/recette/orchestration.ts`
(`buildChaineFinanciereCalendrier` reste correct tel quel, § 6 point 1), `prisma/schema.prisma`
(déjà fait par PR2oct.2), toute fixture JSON (`plan-v12-corrige.json`, `annexe-b-corrigee.json` —
lecture seule, jamais régénérées par cette story).

## 9. Risques de régression

- **Risque majeur si `coutAlevinsFCFA` reste inconditionnel (fix non appliqué ou mal branché) :**
  aucun montant du jeu d'or actuel ne bouge (les 19 vagues sont déjà à `alevinsAchetes = false`
  après backfill PR2oct.2, donc la formule `false ? ... : 0` et l'ancien code inconditionnel
  produisent la même sortie `0` **si et seulement si** `prixAlevinUnitaireFCFA` reste à 70 côté
  production — mais le calcul RÉEL actuel, avant ce fix, facture bien `alevinsACommanderNb × 70`
  sur `EXCEL-V12` en production (le bug lui-même), un écart d'environ 42 175 000 FCFA sur
  l'ensemble du plan déjà quantifié en §7.4/§14.7. C'est précisément ce que les **80 nouvelles
  assertions du §6** attrapent — sans elles, aucun test actuel ne le détecterait (2378/2378 verts
  aujourd'hui malgré le bug).
- **Risque si `alevinsACommanderNb`/`alevinsNbParMois` (le compte) est gaté par erreur en même
  temps que le coût :** le transport (`logistique.voyagesAlevins`/`transportAlevins`) tomberait à 0
  sur toutes les vagues internes, cassant `depenses.baseRepartition` et la trésorerie sur 19/21
  mois — attrapé par les tests de recette **déjà existants** sur `logistique.transportAlevins`
  (déjà vérifiés exacts, README « Vérifications numériques », point 4) et par le **Cas D** du §7
  (test synthétique dédié).
- **Risque si le défaut scénario n'est pas correctement copié à la génération de plan
  (`genererPlanVaguesPrevues`) :** des vagues nouvellement générées porteraient `alevinsAchetes =
  false` par le `@default(false)` Prisma plutôt que la valeur explicite du scénario — inoffensif
  tant que `alevinsAchetesParDefaut` reste `false` (défaut identique), mais casserait silencieusement
  un scénario où l'utilisateur aurait explicitement mis `alevinsAchetesParDefaut = true`. Aucun
  test de recette ne peut l'attraper (le jeu d'or n'a pas ce cas) — seul un test de query dédié
  (`previsions-vagues.test.ts` ou équivalent DB-gated, hors périmètre recette) le couvrirait ; à
  signaler à @tester comme point d'attention si un tel test existe déjà pour
  `effectifAlevinsParVague`/`effectifAlevinsPrevu` (patron à dupliquer).
- **Risque de confusion entre les deux `coutAlevinsFCFA` homonymes** (achat vs transport) : déjà
  mis en garde explicitement par ADR-053 §14.5 et par cette pré-analyse (§3) — le risque existe
  précisément parce que le nom est partagé entre `route-orchestration.ts` (achat, portée globale du
  fichier) et `logistique.ts` (transport, portée locale à `LogistiqueMensuelleResult`). Le Cas D du
  §7 est le filet de sécurité automatisé contre ce risque précis.

## Verdict

**GO** pour la story MOTEUR, avec une réserve non bloquante à porter explicitement dans le brief de
l'implémenteur et dans le rapport de test :

1. **Aucune remise n'est appliquée au coût d'achat des alevins** (§2) — c'est un écart documenté et
   assumé entre le texte littéral du §5.3 des exigences (qui porte un terme `(1 − remise)`) et
   l'implémentation, faute de tout mécanisme de remise alevins modélisé dans le schéma, les
   fixtures ou le classeur source, et faute de toute donnée capable de discriminer une formule
   candidate d'une autre (même famille de piège qu'ERR-160). Si un futur besoin exige une remise
   alevins, il faudra d'abord une donnée de recette qui l'exerce, avant d'écrire le code.
2. Les **80 assertions de recette manquantes (§6) sont un prérequis de la story, pas une extension
   optionnelle** : sans elles, le fix du drapeau ne serait démontré correct par aucun test contre
   le jeu d'or, exactement le trou que §14.7 dénonce par avance.
