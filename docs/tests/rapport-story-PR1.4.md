# Rapport de test — Story PR1.4 : recette du moteur de prévision contre le jeu d'or

**Sprint :** PR1 | **Story :** PR1.4 | **Testeur :** @tester | **Date :** 2026-08-03 (mise à jour :
2026-08-03, extension recette — gaps 1 et 2 comblés par @developer)

## 0. Mise à jour — extension de la recette (gaps 1 et 2 comblés)

@developer a comblé les deux gaps signalés au §5 de la version initiale de ce rapport :
- **Gap 1** : `src/lib/previsions/logistique.ts` (nouveau) — `calculerVoyages`,
  `calculerCoutTransport`, `calculerLogistiqueMensuelle`.
- **Gap 2** : ajouts dans `src/lib/previsions/aliments.ts` — `apportionnerCoutAlimentMensuel`,
  `calculerCoutAlimentGranulometrieParMois`.

La recette a été étendue en conséquence (ligne à ligne, 21 mois, sur les deux scénarios), et surtout
**renforcée en chaîne** : plusieurs séries auparavant testées avec une valeur du jeu d'or prise en
entrée (`logistique.sousTotal`, `resultats.depensesTotales`) sont désormais calculées de bout en
bout par le moteur réel et comparées au jeu d'or, sans plus jamais lire cette série depuis la
fixture comme entrée. Détail complet aux §3bis, §5bis et §9 (nouvelles sections) ci-dessous. Le
verdict global passe de « PARTIELLEMENT RÉUSSIE » à **RÉUSSIE** : toutes les séries à valeur
métier documentées par l'ADR-053 §4 sont désormais couvertes, à l'exception de `resultats.epargne`
(hors périmètre, aucune fonction ADR correspondante — inchangé) et de `calculerBudgetTotalPlan`
(non exercé, absence de cible de comparaison fiable dans le jeu d'or — inchangé).

**Total recette : 842/842 tests passent, 0 écart** (374 tests ajoutés : 421 par scénario × 2, contre
234 avant). Aucune tolérance élargie, aucun test masqué.

## 1. Périmètre

Recette du moteur pur `src/lib/previsions/` (12 fonctions ADR-053 §4, déjà couvertes par 52 tests
unitaires, review passée « VALIDÉ AVEC RÉSERVES ») contre les deux fixtures du jeu d'or
(`prisma/fixtures/previsions/plan-v12-corrige.json` — scénario A, `annexe-b-corrigee.json` —
scénario B), extraites des cellules calculées du classeur source. Aucune modification du moteur, ni
du classeur, ni des blocs de sortie des fixtures. **Aucune valeur attendue n'a été recalculée** —
toutes viennent des blocs de sortie déjà présents dans les fixtures.

Livrables :
- `src/lib/previsions/__tests__/recette/helpers.ts` — chargement des fixtures, assertions à
  tolérance explicite (`expectEntierExact` = 0, `expectMontantFCFA` ≤ 1 FCFA, `expectKgApprox` =
  bruit flottant résiduel de l'extraction, epsilon 1e-6, jamais une tolérance métier).
- `src/lib/previsions/__tests__/recette/orchestration.ts` — construit les entrées typées du moteur
  à partir de `entreesModele` et appelle les fonctions réelles (`calculerBesoinAlimentMensuel`,
  `calculerCoutAlimentVague`) ; aucune formule métier n'y est réimplémentée (voir §3 pour le détail
  de ce qui est et n'est pas de l'orchestration légitime).
- `src/lib/previsions/__tests__/recette/plan-v12-corrige.recette.test.ts` (234 tests)
- `src/lib/previsions/__tests__/recette/annexe-b-corrigee.recette.test.ts` (234 tests)

## 2. Verdict

**Recette PARTIELLEMENT RÉUSSIE — 0 écart sur tout ce que le moteur sait produire, mais le moteur
ne sait produire ni la logistique/transport, ni l'apportionnement mensuel du coût aliment, ni
l'épargne.** Chaque série effectivement testée reproduit le jeu d'or exactement (0 sur les entiers,
0 FCFA d'écart réel sur les montants — voir §5, aucun écart réel constaté). Les séries non
couvertes ne le sont pas parce qu'aucune fonction documentée par l'ADR-053 §4 ne les produit — les
combler dans le fichier de test aurait été réimplémenter le moteur, ce que la story interdit
explicitement.

**468/468 tests de recette passent. Aucun bug du moteur détecté** — chaque écart potentiel identifié
pendant l'investigation s'est avéré être soit une adaptation d'unité légitime à la charge de
l'appelant (documentée dans `orchestration.ts`), soit un gap de couverture (fonction manquante),
jamais un défaut de calcul dans les 12 fonctions existantes.

## 3. Séries reproduites par le moteur — détail

| Série (fixture) | Fonction(s) engagée(s) | Résultat | Note |
|---|---|---|---|
| `besoinsAliments.totalKg[mois]` (21 mois) | `calculerBesoinAlimentMensuel` (appelée par vague × moisCycle, sommée) | **0 écart** (epsilon flottant only) | Somme = opération associative, pas une formule métier |
| `besoinsAliments.kgParGranulometrie.{2mm,3mm,4mm}[mois]` (21×3) | idem | **0 écart** | idem |
| `besoinsAliments.sacsTotal[mois]` (21 mois) | idem + 2e appel de `calculerBesoinAlimentMensuel` pour le ceil agrégé (voir §4.1) | **0 écart exact** | Piège découvert : ceil-après-somme, pas somme-de-ceils (§4.1) |
| `besoinsAliments.sacsParGranulometrie.{2mm,3mm,4mm}[mois]` (21×3) | idem | **0 écart exact** | idem |
| `cumuls.besoinMensuelMaxKg` | `max(totalKg)` | **0 écart** | 17 100 kg, les deux scénarios |
| `planVagues[].coutAlimentsFCFA` (19 vagues) | `appliquerPalierRemise` (interne) + `calculerCoutAlimentVague` | **0 écart** (≤ 1 FCFA) | Adaptation d'unité tonnes→sacs nécessaire (§4.2), pas un bug |
| `cumuls.dontAliments` (somme des 19 vagues) | idem, sommé | **0 écart** | 277 369 600 FCFA, les deux scénarios |
| `depenses.baseRepartition[mois]` (21 mois) | `calculerChargesMensuelles` + `calculerBaseRepartition` | **0 écart** (≤ 1 FCFA) | `logistique.sousTotal` pris en DONNÉE du jeu d'or (non dérivable, §4.3) ; journal général = 0 sur les 21 mois des deux fixtures (vérifié) |
| `resultats.tresorerie[mois]` (21 mois × 2 scénarios) | `genererSerieTresorerie` (→ `calculerTresorerieMensuelle`) | **0 écart** (≤ 1 FCFA) | revenus/dépenses/apports pris en DONNÉE du jeu d'or (`depensesTotales` non intégralement reconstructible, §4.3) — teste la formule de cumul elle-même |
| `cumuls.tresorerieFinale` | idem (dernier mois de la série) | **0 écart** | |
| `cumuls.pointBasTresorerie` + `cumuls.moisPointBas` | `calculerPointBasTresorerie` | **0 écart**, sur les DEUX scénarios | Scénario A : +2 276 600 FCFA en 2026-08 (non négatif, vérifié `.gte(0)`) ; **scénario B : −6 334 704 FCFA en 2026-11, seul cas qui exerce réellement la logique de point bas négatif — vérifié `.lt(0)`** |

Total : **468 assertions/tests** répartis sur 2 fichiers (234 par scénario), tolérance strictement
respectée (0 sur les entiers, ≤ 1 FCFA sur les montants, epsilon flottant résiduel documenté
uniquement sur les kg, jamais une tolérance élargie pour faire passer un test).

Contrôle négatif effectué (hors suite livrée, exécuté puis retiré) : en injectant volontairement un
écart de 1 dans un `sacsTotal` attendu, `expectEntierExact` lève bien
`entier attendu 42, obtenu 41 (ecart -1, tolerance = 0)` — les helpers d'assertion échouent
réellement, ce ne sont pas des no-op silencieux.

### 3.1 Cas limites (ADR-053, docstrings « section 8 »)

Tous les 6 cas limites listés par la story sont **déjà couverts** par les 52 tests unitaires
existants — aucun ajout nécessaire :

| Cas limite | Fichier existant |
|---|---|
| Somme des pourcentages ≠ 100 % (blocage) | `validation.test.ts:18-24` |
| Seuils de remise non croissants (blocage) | `validation.test.ts:49-56` |
| `poidsSacKg = 0` (granulométrie ignorée, pas de division par zéro) | `aliments.test.ts:61-74` |
| `poidsMoyenVenteKg`/`poidsObjectifG = 0` (poissons = 0 + alerte) | `vague.test.ts:30-35` |
| Deux vagues le même mois (cumul correct) | `charges.test.ts:84-88` (`calculerQuotePartVague`), **et exercé en conditions réelles par la recette** : V1/V2 se chevauchent en septembre 2026 dans `besoinsAliments`, reproduit exactement (§4.1) |
| `besoin_total_kg` d'un mois = 0 (quote-part = 0) | `charges.test.ts:77-80, 95-98` |

## 4. Découvertes pendant l'investigation (documentées dans `orchestration.ts`, pas dans le rapport
seulement)

### 4.1 Piège découvert : agrégation multi-vague — ceil-après-somme, pas somme-de-ceils

Vérifié numériquement (script Python indépendant, avant tout code TS) : pour un mois calendaire où
**deux** `VaguePrevue` se chevauchent (ex. septembre 2026 : V1 en `moisCycle 2`, V2 en
`moisCycle 1`, toutes deux granulométrie 2mm), la fixture donne `sacsParGranulometrie.2mm[1] = 32`.
`ceil(96/15) + ceil(384/15) = 7 + 26 = 33` (somme-de-ceils, **faux**) ;
`ceil((96+384)/15) = ceil(480/15) = 32` (ceil-après-somme, **exact**).

`calculerBesoinAlimentMensuel` (ADR-053 §4) opère à l'échelle d'**une seule** `VaguePrevue` — la
signature documentée est `calculerBesoinAlimentMensuel(vaguePrevue, aliments, moisCycle)`. Aucune
des 12 fonctions ne combine plusieurs `VaguePrevue` actives le même mois calendaire en un seul ceil.
Le test reproduit ce comportement en rappelant `calculerBesoinAlimentMensuel` **une seconde fois**,
avec le besoin déjà sommé comme entrée (`repartitions: [{moisCycle: 1, pourcentage: 100}]`) — le
ceil lui-même reste exécuté par le moteur, la sommation préalable (associative, sans formule
métier) est la seule chose faite dans le test. Documenté en détail dans `orchestration.ts`.

**Recommandation @developer :** si l'API/queries qui appellera ce moteur reproduit la somme-de-ceils
par vague (le pattern « naïf » d'appeler la fonction une fois par vague et sommer les `sacs`), elle
produira une commande d'achat mensuelle **supérieure** à la réalité chaque fois que ≥ 2 vagues
partagent une granulométrie le même mois (ordre de grandeur observé : +1 sac). Ce n'est pas un bug
du moteur (les 12 fonctions ADR ne prétendent pas le couvrir), mais un piège d'intégration à éviter
à l'appel.

### 4.2 Adaptation d'unité nécessaire (pas un bug) : la remise volume est en tonnes dans le jeu d'or, en sacs dans le schéma ADR

`PalierRemise.seuilSacs` (ADR-053 §3.4) et `appliquerPalierRemise(sacs, ...)` raisonnent en nombre
de sacs. Le jeu d'or (`entreesModele.paliersRemise[].seuilTonnes`) applique la remise sur le
**tonnage de la vague** (`objectifTonnes`), vérifié exact sur les 19 vagues (0, 5, 10, 15 tonnes →
0/2/4/6 %). Les deux sont équivalents à une mise à l'échelle près : en passant à
`appliquerPalierRemise` le total de sacs **sur tout le cycle** de la vague pour une granulométrie
donnée (`objectifTonnes × sacsParTonneStandard`) et des seuils mis à l'échelle par le même facteur
(`seuilTonnes × sacsParTonneStandard`), le rapport obtenu est strictement identique à
`objectifTonnes / seuilTonnes`, quelle que soit la granulométrie — vérifié exact sur les 19 vagues,
les 3 granulométries. Documenté en détail dans `orchestration.ts`. Aucun changement de moteur requis
si l'appelant applique cette mise à l'échelle au point d'appel (ce que `orchestration.ts` fait).

### 4.3 Gap découvert, distinct de celui signalé par la pré-analyse : pas de fonction d'apportionnement mensuel du coût aliment

`calculerCoutAlimentVague` (ADR-053 §4, Étape 4) ne renvoie qu'**un seul total par vague, sur tout
le cycle** — exactement ce qui correspond à `planVagues[].coutAlimentsFCFA` (§3, ligne
« coutAlimentsFCFA »), pas à `depenses.aliments[mois]` (série calendaire) ni à
`AlimentParVaguePrevue.coutCalculeFCFA` (grain vague × granulométrie × moisCycle, ADR-053 §3.6).

Vérifié numériquement (V7, 15 tonnes, remise 6 %) : le coût du mois 1 pour la granulométrie 2mm
(96 sacs sur ce mois, 120 sacs sur tout le cycle) vaut **1 624 320 FCFA**, obtenu par
`coutCycleTotalRemisé(2mm) × répartitionMois1% = (120 × 18 000 × 0,94) × 0,8`, **et non**
`96 × 18 000 × (remise déterminée sur 96 sacs)` — une remise recalculée sur le seul volume mensuel
(96 sacs, sous le seuil suivant) donnerait un taux de remise incorrect. La remise est donc décidée
une fois pour toute la vague (§4.2), puis le montant total remisé est réparti par le pourcentage
mensuel — **aucune des 12 fonctions ne fait cet apportionnement**. Le combler dans le test aurait
exigé de réimplémenter cette formule de répartition (`coutCycleTotal × répartitionPct`), ce que la
story interdit explicitement.

**Conséquence pour la recette :** `depenses.aliments[mois]` (série calendaire) et
`AlimentParVaguePrevue.coutCalculeFCFA` (grain vague×granulométrie×mois) **ne sont pas testés** par
cette recette — pas parce qu'un écart a été constaté, mais parce qu'aucune fonction du moteur ne les
produit. Le test utilise `resultats.depensesTotales[mois]` (qui inclut ce montant) en DONNÉE fournie
pour tester la formule de trésorerie elle-même (§3, ligne tresorerie), pas pour tester
l'apportionnement du coût aliment.

**Recommandation @developer :** signaler ce gap au même titre que le gap transport (§5) — une
fonction d'apportionnement mensuel du coût aliment (répartir `calculerCoutAlimentVague` par
pourcentage mensuel) sera nécessaire pour peupler `AlimentParVaguePrevue.coutCalculeFCFA` et
afficher `depenses.aliments[mois]` dans l'UI.

## 3bis. Extension — gaps 1 et 2 comblés, séries désormais couvertes

Nouveaux fichiers/fonctions de la recette (mêmes deux fichiers de test, `orchestration.ts`
étendu) : `buildLogistiqueCalendrier`, `buildCoutAlimentsParVagueEtMois`,
`aggregerDepensesAlimentsParMoisCalendaire`, `aggregerCoutAlimentsParVagueEtMoisCycle`,
`buildChaineFinanciereCalendrier`.

| Série (fixture) | Fonction(s) moteur engagée(s) | Résultat | Note |
|---|---|---|---|
| `logistique.voyagesAliments[mois]` (21) | `calculerLogistiqueMensuelle` (→ `calculerVoyages`) | **0 écart** (tolérance 0, entier) | `quantiteAlimentsSacs` = `sacsTotal` **calculé par le moteur** (`buildBesoinsAlimentsCalendrier`), jamais lu depuis le jeu d'or — renforcement de chaîne |
| `logistique.voyagesPoissons[mois]` (21) | idem | **0 écart** | `quantitePoissonsKg` = `entrees.ventesT[mois] × 1000` (entrée, voir §5bis) |
| `logistique.voyagesAlevins[mois]` (21) | idem | **0 écart** | `quantiteAlevinsNb` = somme de `entreesModele.planVagues[].alevinsACommanderNb` par mois d'empoissonnement (entrée de modèle) |
| `logistique.transportAlevins[mois]` (21) | `calculerCoutTransport` | **0 écart** (≤ 1 FCFA) | |
| `logistique.sousTotal[mois]` (21) | `calculerLogistiqueMensuelle` | **0 écart** (≤ 1 FCFA) | Cette série n'est plus jamais lue depuis le jeu d'or ailleurs dans la recette |
| `depenses.aliments[mois]` (calendaire, 21) | `apportionnerCoutAlimentMensuel` (via `calculerCoutAlimentGranulometrieParMois`), sommé par vague×granulométrie sur le mois calendaire | **0 écart** (≤ 1 FCFA) | Gap 2 comblé. Sommation = opération associative (mêmes principes que §4.1), pas une formule métier |
| `planVagues[].coutAlimentsMois1FCFA/Mois2FCFA/Mois3FCFA` (19 vagues × 3) | idem, sommé par granulométrie à vague/moisCycle fixé | **0 écart** (≤ 1 FCFA) | Grain fin distinct de la série calendaire, teste directement `calculerCoutAlimentGranulometrieParMois` sans agrégation multi-vague |
| `depenses.baseRepartition[mois]` (21) — **reconstruit** | `calculerLogistiqueMensuelle` (sousTotal) + `chargesExploitation` sommé | **0 écart** (≤ 1 FCFA) | `logistique.sousTotal` n'est plus une entrée du jeu d'or ici, c'est la sortie du moteur elle-même |
| `resultats.depensesTotales[mois]` (21) — **reconstruit** | composition (aliments calculé + alevins entrée + baseRepartition calculé + investissements entrée) | **0 écart** (≤ 1 FCFA) | Composition arithmétique (addition), pas une formule ADR-053 §4 dédiée — détail des entrées restantes au §5bis |
| `resultats.resultat[mois]` (21) — **reconstruit** | `totalEntrees(entrée) − depensesTotales(calculé)` | **0 écart** (≤ 1 FCFA) | idem |
| `resultats.tresorerie[mois]`, `cumuls.tresorerieFinale`, `cumuls.pointBasTresorerie`/`moisPointBas` (21 + cumuls, ×2 scénarios) — **reconstruit** | `genererSerieTresorerie` + `calculerPointBasTresorerie`, alimentés par `depensesTotales` **calculé** | **0 écart** | Avant l'extension, `depenses` de `genererSerieTresorerie` provenait de `fixture.resultats.depensesTotales` (une sortie du jeu d'or). Désormais c'est la sortie de la chaîne calculée — seuls `chiffreAffaires` et `apportsCapital` restent des entrées (§5bis). Scénario A (non négatif) et B (négatif, seul cas exerçant `.lt(0)`) vérifiés |

Total ajouté : **374 tests** (187 par scénario × 2) — 468 (version initiale) + 374 = 842.

## 5bis. Vigilance capitale — entrées vs valeurs attendues, revue exhaustive de `orchestration.ts`

Demande explicite de la story : lister précisément quelles valeurs du jeu d'or servent d'ENTRÉE à la
chaîne de calcul (par opposition à valeur ATTENDUE comparée en sortie). Idéalement seules
`entreesModele.*` devraient être des entrées — chaque série de SORTIE du jeu d'or réinjectée en
entrée affaiblit la recette. Revue complète, fonction par fonction :

| Valeur du jeu d'or utilisée comme ENTRÉE | Bloc fixture | `entreesModele.*` ? | Fonction(s) qui la consomme | Pourquoi ce n'est pas un gap supplémentaire |
|---|---|---|---|---|
| `entreesModele.transport.*` (capacités, coûts unitaires) | `entreesModele` | **OUI** | `buildLogistiqueCalendrier` | Paramètre de scénario par construction — jamais une sortie |
| `entreesModele.aliments[].*` (poidsSacKg, prixSacFCFA, répartitions, sacsParTonneStandard) | `entreesModele` | **OUI** | `buildBesoinsAlimentsCalendrier`, `buildCoutAlimentsParVague(EtMois)` | idem |
| `entreesModele.planVagues[].objectifTonnes`, `.moisEmpoissonnement`, `.alevinsACommanderNb`, `.coutAlevinsFCFA` | `entreesModele` | **OUI** | idem + `buildLogistiqueCalendrier`, `buildChaineFinanciereCalendrier` | idem — `.coutAlevinsFCFA` toujours 0 dans les deux fixtures (aucune vague `alevinsAchetes = "OUI"`), donc cette entrée n'exerce jamais de logique non triviale, mais reste structurellement correcte |
| `entreesModele.paliersRemise[].*` | `entreesModele` | **OUI** | `buildCoutAlimentsParVague(EtMois)` | idem |
| `entreesModele.chargesExploitation[].valeursParMoisFCFA` | `entreesModele` | **OUI** | `buildChaineFinanciereCalendrier` | idem |
| `entreesModele.parametresScenario.tresorerieInitialeFCFA` | `entreesModele` | **OUI** | `buildChaineFinanciereCalendrier` | idem |
| `entrees.ventesT[mois]` | `entrees` (racine, PAS `entreesModele`) | **NON** | `buildLogistiqueCalendrier` (quantité poissons à transporter) | Planning de récolte mensuel — aucune des 12 fonctions ADR-053 §4 ne produit de calendrier de récolte ; `calculerRevenuPrevu` opère par VAGUE avec un `effectifFinal` qui n'existe pas à l'échelle du mois calendaire agrégé sans être fabriqué artificiellement (le construire aurait été gamer la fonction, pas la tester — écarté délibérément) |
| `entrees.chiffreAffaires[mois]` | `entrees` (racine) | **NON** | `buildChaineFinanciereCalendrier` (`revenus` de `genererSerieTresorerie`) | Même raison : revenu mensuel encaissé, aucune fonction ne l'agrège à l'échelle du mois calendaire depuis un tonnage vendu sans `effectifFinal` fabriqué. Vérifié séparément (script indépendant) : `chiffreAffaires[mois] = ventesT[mois] × 1000 × prixVenteKgFCFA` — relation arithmétique correcte mais qui ne correspond à aucune signature de fonction du moteur |
| `resultats.apportsCapital[mois]` | `resultats` (racine) | **NON** | `buildChaineFinanciereCalendrier` (`apports` de `genererSerieTresorerie`) | Décision de financement du scénario (plan d'apports/crédits) — jamais calculée par aucune fonction |
| `resultats.investissements[mois]` | `resultats` (racine) | **NON** | `buildChaineFinanciereCalendrier` (`autresDepenses`) | Plan de capex du scénario — jamais calculé |

**Bilan honnête** : 4 entrées restent hors `entreesModele.*` au sens strict du JSON (`ventesT`,
`chiffreAffaires`, `apportsCapital`, `investissements`), et par transitivité tout ce qui en dépend
(`resultats.resultat`, `resultats.tresorerie`). Ce ne sont **pas** des valeurs de sortie d'une des 12
fonctions ADR-053 §4 réinjectées à tort — aucune de ces 4 séries n'apparaît nulle part ailleurs dans
la recette comme un résultat produit par le moteur qu'on aurait pu obtenir autrement. Ce sont des
données de planification/scénario (récolte, ventes, financement, capex) qui, structurellement, n'ont
jamais eu de formule associée dans l'ADR-053 §4. Leur présence sous les blocs `entrees`/`resultats`
(plutôt que `entreesModele`) dans le JSON du jeu d'or est un artefact de la structure d'export
(`extract-golden.py`, qui reflète l'organisation des onglets du classeur, pas une distinction
formelle entrée/sortie) — pas une preuve qu'il s'agit de sorties calculées manquées par la recette.

**Recommandation @architect :** si un futur sprint modélise ces séries en base (`ParametresPrevision`
ou modèle dédié pour le calendrier de récolte/financement), l'ADR-053 §4 devrait les faire apparaître
explicitement comme entrées de scénario, au même titre que `entreesModele.transport` aujourd'hui —
cela clarifierait qu'aucune fonction n'est censée les produire, ce qui n'est pas limpide à la simple
lecture du JSON actuel.

**Ce qui n'est PLUS une entrée du jeu d'or depuis cette extension** (comparé à la version initiale du
rapport) : `logistique.sousTotal[mois]` (désormais calculé) et `resultats.depensesTotales[mois]`
(désormais calculé) — les deux plus importantes à avoir été retirées, car elles alimentaient
directement `depenses.baseRepartition` et `resultats.tresorerie` respectivement.

## 5. Séries que le moteur NE SAIT PAS produire — liste exhaustive demandée (mise à jour)

| Série du jeu d'or | Le moteur la produit-il ? | Raison |
|---|---|---|
| `besoinsAliments.totalKg`, `kgParGranulometrie`, `sacsTotal`, `sacsParGranulometrie` | **OUI** (via orchestration multi-appel documentée §4.1) | — |
| `planVagues[].coutAlimentsFCFA`, `cumuls.dontAliments` | **OUI** (via adaptation d'unité documentée §4.2) | — |
| `logistique.voyagesAliments`, `voyagesPoissons`, `voyagesAlevins`, `transportAlevins`, `sousTotal` | **OUI, depuis cette extension** (`calculerVoyages`, `calculerCoutTransport`, `calculerLogistiqueMensuelle` — gap 1 comblé, §3bis) | Ancien gap comblé par @developer, recette étendue en conséquence |
| `depenses.aliments[mois]` (calendaire), `planVagues[].coutAlimentsMois{1,2,3}FCFA` (grain vague×mois) | **OUI, depuis cette extension** (`apportionnerCoutAlimentMensuel`, `calculerCoutAlimentGranulometrieParMois` — gap 2 comblé, §3bis) | Ancien gap comblé par @developer, recette étendue en conséquence. `AlimentParVaguePrevue.coutCalculeFCFA` (grain vague×granulométrie×mois) est le grain exact produit par `calculerCoutAlimentGranulometrieParMois`, exercé par la série calendaire agrégée (voir §3bis) |
| `depenses.baseRepartition`, `resultats.depensesTotales`, `resultats.resultat`, `resultats.tresorerie`, `cumuls.tresorerieFinale`, `cumuls.pointBasTresorerie`/`moisPointBas` | **OUI, chaîne renforcée** (voir §3bis) | Ne dépendent plus de `logistique.sousTotal` ni `resultats.depensesTotales` du jeu d'or comme entrées — seules `ventesT`, `chiffreAffaires`, `apportsCapital`, `investissements` restent des entrées (§5bis), aucune n'étant elle-même une sortie testée ailleurs |
| `resultats.epargne` | **NON, hors périmètre** | Aucune mention dans l'ADR-053 (grep vide sur « épargne »/« tauxEpargne » dans le texte de l'ADR, hors le champ brut `parametresScenario.tauxEpargnePct` du jeu d'or). Ce n'est pas une des 12 fonctions listées, ni une conséquence documentée. **Déclaré explicitement hors périmètre de cette recette**, pas un gap à corriger dans ce sprint — à confirmer avec @architect si un futur sprint doit l'ajouter à l'ADR. |
| `calculerBudgetTotalPlan` (Étape 12) | **Non exercé par cette recette** | Aucun champ du bloc `cumuls` du jeu d'or ne correspond directement à `budgetTotalFCFA` (pas de « total budget » publié par le classeur) — reconstituer une valeur de comparaison exigerait de dériver `quotePartCharges` par vague sur tout son cycle, ce qui aurait mélangé donnée réelle et hypothèse de reconstruction sans cible de comparaison fiable. Déjà couvert structurellement par `budget.test.ts` (2 tests unitaires, non liés au jeu d'or). |

## 6. Aucun bug du moteur détecté

Aucune des 12 fonctions n'a produit un résultat divergent de sa spécification ADR-053 §4 pendant
cette recette. Chaque "écart" identifié pendant l'investigation (§4.1, §4.2, §4.3) s'est résolu par
une adaptation légitime au point d'appel (unité, agrégation), documentée dans `orchestration.ts`,
jamais par une correction du moteur lui-même — conforme à l'interdiction de la story de toucher à
`src/lib/previsions/`.

## 7. Exécution — sortie réelle des commandes (mise à jour, extension gaps 1+2)

Ligne de base fournie pour cette extension : **239 fichiers, 6303 tests passés, 26 todo, 0 échec**
(état après que @developer a comblé les gaps 1/2 et ajouté ses propres tests unitaires, avant
extension de la recette).

### `npx vitest run` (DATABASE_URL exportée, cf. ERR-118)

> Note (R11, ajoutée a posteriori par @knowledge-keeper) : l'identifiant réel de la base de
> développement locale a été retiré de la commande ci-dessous et remplacé par un placeholder — voir
> ERR-159. Les valeurs réelles sont dans `.env` (non tracké), jamais dans ce dépôt.

```
export DATABASE_URL="postgresql://<user>:<password>@localhost:8432/farm-flow"
npx vitest run
```

```
 Test Files  239 passed (239)
      Tests  6677 passed | 26 todo (6703)
   Start at  04:35:16
   Duration  8.73s (transform 13.62s, setup 1.72s, import 32.89s, tests 27.35s, environment 10.23s)
```

Comparaison à la ligne de base (239 fichiers, 6303 tests, 26 todo, 0 échec) : **+0 fichier
(fichiers de recette déjà existants, contenu étendu), +374 tests** (187 tests ajoutés par scénario ×
2 fichiers) — soit exactement 6303+374=6677 tests. **0 échec, 26 todo inchangés.**

Sous-ensemble recette isolé :

```
npx vitest run src/lib/previsions/__tests__/recette
 ✓ src/lib/previsions/__tests__/recette/plan-v12-corrige.recette.test.ts (421 tests) 8ms
 ✓ src/lib/previsions/__tests__/recette/annexe-b-corrigee.recette.test.ts (421 tests) 9ms
 Test Files  2 passed (2)
      Tests  842 passed (842)
```

(842 = 468 tests de la version initiale + 374 tests ajoutés par cette extension — 421 tests par
fichier, contre 234 avant.)

### `npm run build`

```
> farm-flow@0.1.0 build
> prisma generate && prisma migrate deploy && next build --webpack

✔ Generated Prisma Client (7.4.2) to ./src/generated/prisma in 648ms
Datasource "db": PostgreSQL database "farm-flow", schema "public" at "localhost:8432"
161 migrations found in prisma/migrations
No pending migrations to apply.

▲ Next.js 16.1.6 (webpack)
```

Build production terminé sans erreur (seul avertissement : inférence de racine de workspace
Next.js, non bloquant, préexistant, identique aux runs précédents). Toutes les routes (API + pages)
compilées.

## 8. Fichiers livrés

Version initiale (inchangés dans leur existence, tous étendus par cette story sauf mention
contraire) :
- `src/lib/previsions/__tests__/recette/helpers.ts` — **étendu** (`GoldenVague` : 7 champs
  supplémentaires nécessaires à la nouvelle recette : `coutAlimentsMois1/2/3FCFA`,
  `alevinsACommanderNb`, `coutAlevinsFCFA`, `alevinsAchetes`)
- `src/lib/previsions/__tests__/recette/orchestration.ts` — **étendu** (5 nouvelles fonctions :
  `buildLogistiqueCalendrier`, `buildCoutAlimentsParVagueEtMois`,
  `aggregerDepensesAlimentsParMoisCalendaire`, `aggregerCoutAlimentsParVagueEtMoisCycle`,
  `buildChaineFinanciereCalendrier`)
- `src/lib/previsions/__tests__/recette/plan-v12-corrige.recette.test.ts` — **étendu** (3 nouveaux
  `describe` : logistique, apportionnement aliment mensuel, chaîne financière renforcée)
- `src/lib/previsions/__tests__/recette/annexe-b-corrigee.recette.test.ts` — **étendu** (idem)
- `docs/tests/rapport-story-PR1.4.md` (ce fichier) — **mis à jour** (§0, §3bis, §5bis, §5, §7 revus)

Aucun fichier de `src/lib/previsions/` (moteur — `logistique.ts` et `aliments.ts` ont été modifiés
par @developer avant cette extension, pas par @tester), `prisma/fixtures/previsions/*.json` (blocs
de sortie), ni le classeur `.xlsx` n'a été modifié par cette story.
