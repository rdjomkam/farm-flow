# Rapport de falsification — Sprint PR3-ter (Portée du mapping, trésorerie à trois séries, reprévision glissante)

**Sprint :** PR3-ter | **Date :** 2026-08-05 | **Auteur :** @tester, exécution réelle (re-vérification
des falsifications rapportées par les agents d'implémentation + falsifications nouvelles pour les
réserves de la review), pas une consolidation de confiance.

## Pourquoi ce document existe

`docs/reviews/review-sprint-PR3-ter.md`, Majeur #1 : ce document manquait au moment de la review — ADR-053
§15.6 point 3 l'exige avant clôture, ERR-172 le rend non négociable pour un module sans jeu d'or externe
(le rapprochement prévu/réel n'a aucune donnée de référence dans `Previsions_Elevage_Silure_v12.xlsx`).

**Méthode appliquée pour ce rapport** : chaque mutation listée ci-dessous a été **rejouée par moi**
(pas recopiée du récit des agents d'implémentation) — code de production muté, `npx vitest run` sur le(s)
fichier(s) de test concerné(s), nombre d'assertions/tests tombés relevé, restauration immédiate vérifiée
par `diff` contre une copie de sauvegarde prise avant mutation (les fichiers `previsions-mapping-
orphelins.ts`, `previsions-tresorerie-trois-series.ts` et `previsions-presentation/*` sont **nouveaux,
non trackés par git** ce sprint — `git checkout` ne les restaure pas, la restauration a été faite
manuellement puis vérifiée par `diff` fichier à fichier, jamais par confiance dans `git diff --stat`
seul). Toute divergence entre le chiffre annoncé par les agents et celui que j'ai mesuré est signalée
explicitement, jamais lissée.

## A — Portée du mapping (A.1 filet, A.2 UI, A.3 format composé)

| # | Mutation appliquée au code de production | Fichier | Assertions/tests tombés (mesuré) | Conforme au chiffre annoncé ? |
|---|---|---|---|---|
| A.1 | `cibleOrpheline` forcé à `false` (jamais calculé) | `src/lib/queries/previsions-mapping-orphelins.ts` | **3** tests pré-existants tombent (1 unitaire `previsions-mapping-orphelins.test.ts` ×2, 1 intégration `previsions-mapping-orphelins-integration.test.ts` ×1). Avec le nouveau test de composition ajouté par ce rapport (voir Réserve Moyenne #3 ci-dessous), **4** au total aujourd'hui. | Oui (3, avant l'ajout de mon test) |
| A.3 | `versMappingActif` (ALIMENT_PREVISION) retombe sur `ligne.cibleId` brut au lieu de résoudre dynamiquement par `tailleGranule` — comportement pré-A.3 | `src/lib/queries/previsions-rapprochement.ts` | **2** (`previsions-rapprochement-aliment-scope-integration.test.ts`) — `expected 12, received 0` sur le premier test, `expected undefined to be defined` sur le second (l'argent disparaît réellement, comme documenté). | Oui |
| A.3 | Garde Zod du format composé neutralisée (`if (false && ...)`) | `src/lib/validation/previsions.schema.ts` | **3** (`previsions-mapping-schema.test.ts`) | Oui |

## B — Trésorerie à trois séries + reprévision glissante

### B.1 — `tresorerie-reelle-nette.ts` (netting du RÉEL)

| Mutation | Assertions tombées |
|---|---|
| Signe `DEPENSE` inversé (`return 1` au lieu de `return -1`) | **3** |
| Garde `QUANTITE` retirée (kg mélangés aux FCFA) | **2** |
| Garde `SANS_SOURCE_REELLE` retirée | **2** (`TypeError` — `l.reel` est `null`, jamais additionné en production) |
| Cumul remplacé par une affectation (`cumul = soldeNetFCFA` au lieu de `cumul.plus(...)`) | **1** |

Toutes conformes aux chiffres annoncés (3, 2, 2, 1).

### B.2 — `reprevision-glissante.ts` (fusion REEL/PRÉVISION ACTUALISÉE)

| Mutation | Assertions tombées |
|---|---|
| `estClos` figé à `false` | **2** |
| Cumul recopié (`cumul = soldeMensuelFCFA` au lieu d'un cumul accumulé) | **2** |
| Fallback d'un mois clos sans reel vers la prévision actualisée (`?? mois.resultatFCFA` au lieu de `?? new Decimal(0)`) | **2** |

Toutes conformes aux chiffres annoncés (2, 2, 2).

### B.3/B.4 — « LE GEL MORD » (`previsions-tresorerie-trois-series.ts`)

Mutation : `budgetInitialParMois` recalculé à la volée depuis `projection.mois[].soldeFCFA` au lieu
d'être lu depuis `SnapshotBudgetInitial` (`getSnapshotBudgetInitial`).

Résultat : **2** assertions tombent (`previsions-tresorerie-trois-series-integration.test.ts`, test (a)
« LE GEL MORD »). Conforme au chiffre annoncé.

### B.5 — Gradient et courbe primaire (`tresorerie-trois-series-chart.tsx`)

| Mutation | Chiffre annoncé | Mesuré (re-vérification) |
|---|---|---|
| Offset du gradient : `calculerOffsetGradientSousZero(minSolde, maxSolde)` (arguments inversés) | 3/6 | **1 test sur 8** échoue (« bascule Reprevision change l'offset du gradient ») |
| Courbe primaire inversée (`reprevisionActive ? previsionActualisee : reprevision`) | 1/8 | **1 test sur 8** échoue |
| Bascule figée à `false` (`const primaire = false ? ... : ...`) | 1/8 | **1 test sur 8** échoue |

**Divergence signalée, pas lissée** : le fichier `tresorerie-trois-series-chart.test.tsx` contient
aujourd'hui **8** tests, pas 6 — l'écart entre 3/6 et 1/8 pour la première mutation n'est donc pas
qu'un changement de dénominateur ; je n'ai mesuré qu'**1** test en échec là où 3 étaient annoncés. Cause
possible : le chiffre « 3 » du rapport initial comptait peut-être des assertions internes à un même
`it()` (que Vitest ne peut pas toutes révéler puisqu'il s'arrête à la première `expect` en échec), ou une
version antérieure du fichier de test répartissait la preuve sur plus de blocs `it()`. Je ne peux pas
reconstituer cette différence a posteriori sans accès à l'état exact du fichier au moment de la mesure
initiale — **signalé comme non confirmé**, pas recopié tel quel.

## C — Réserves mineures C.1-C.4

| # | Mutation | Fichier | Assertions tombées | Conforme ? |
|---|---|---|---|---|
| C.1 | Retour à `SourceRapprochement.MOUVEMENT_STOCK` (collision avec la nature QUANTITE) | `src/lib/queries/previsions-rapprochement.ts` (`getDepensesAlimentReellesParGranulometrie`) | **2** (`previsions-rapprochement-integration.test.ts`) | Oui |
| C.2 | `partitionnerParGrandeur` neutralisée (tout classé "monétaire") | `src/lib/queries/previsions-vue-rapprochement.ts` | **4/4** (`previsions-vue-rapprochement-partition.test.ts`, les 4 tests du fichier tombent) | Oui |
| C.2 | « Formatage par nature » (kg vs FCFA, `rapprochement-lignes-liste.tsx`) | `src/components/previsions/rapprochement-lignes-liste.tsx` | **COMBLÉ** (session de clôture ultérieure, voir §« Trou de couverture C.2 comblé » ci-dessous) — **6** tests tombent (**4** dans un nouveau fichier dédié `rapprochement-lignes-liste.test.tsx`, **2** dans `rapprochement-tab.test.tsx`), restauré et vérifié par `diff` binaire. Le chiffre « 2/2 » initialement annoncé par l'agent d'implémentation **n'a jamais été reproduit tel quel** — voir le détail ci-dessous, qui documente l'écart plutôt que de le lisser. | **Oui, désormais — mesuré directement, chiffre différent du « 2/2 » annoncé** |
| C.3 | `getVersionsDisponibles` filtre `actif: true` (perd l'historique des versions) | `src/lib/queries/previsions-rapprochement-mapping.ts` | **1** (`previsions-rapprochement-mapping-integration.test.ts`, test « renvoie TOUTES les versions »). Note : ce test est un test d'**intégration** (DB réelle), pas le test de route mocké `versions/__tests__/route.test.ts` (celui-ci mocke `getVersionsDisponibles` et ne peut structurellement pas détecter cette mutation — vérifié : 0/4 échoue quand on l'applique). | Oui, avec précision de localisation |
| C.3 | Garde `!consultationHistorique` retirée (carte « catégories non mappées » visible même en lecture seule) | `src/components/previsions/rapprochement-mapping-tab.tsx` | **1** (`rapprochement-mapping-tab.test.tsx`) | Oui |
| C.4 | `CATEGORIE_LABELS` codé en dur réintroduit (enum brut affiché) dans `depense-vente-dialog.tsx` | `src/components/ventes/depense-vente-dialog.tsx` | **1** (`depense-vente-dialog-categories.test.tsx`) | Chiffre non annoncé précisément par la tâche, mesuré ici |
| C.4 | Désaccentuation `"PAYEE"` (`vente-detail-client.tsx`) | `src/components/ventes/vente-detail-client.tsx` | **NON REJOUÉ** — ce fichier est **explicitement interdit de modification** pour ce sprint (un @developer y corrige en parallèle un défaut d'affichage d'enum brut, `review-sprint-PR3-ter.md` « Ce qui reste ouvert », ligne 818). Je n'ai donc **pas** falsifié cette ligne ; je ne peux ni confirmer ni infirmer le chiffre annoncé. | **Non vérifié, par contrainte explicite du sprint** |

## Falsification à 0 test, documentée comme telle (comme PR3-bis l'a fait pour sa falsification (j))

**Mutation** : neutralisation de la boucle `versionParMois`/`versionsDistinctes` dans
`getMappingResoluParMois` (`src/lib/queries/previsions-rapprochement.ts`) — le mapping résolu par mois
retombe systématiquement sur `mappingActifCourant`, quelle que soit la clôture, comme si
`ClotureMois.versionMapping` n'existait jamais.

- **(c)** `previsions-rapprochement-integration.test.ts` : **1** assertion tombe.
- **(d2)** `previsions-tresorerie-trois-series-integration.test.ts` : **0** assertion tombe — **y compris
  avec l'assertion `series[m].reelFCFA` ajoutée par ce rapport pour la Réserve Mineure #5** (voir plus
  bas). Rejoué explicitement avec le complément en place : toujours 0.

**Raison structurelle, revérifiée** : `netterTresorerieReelleParMois` (story B.1) compte les lignes
`RAPPROCHE` **et** `NON_RAPPROCHE` dans le **même** total netté (seule `SANS_SOURCE_REELLE` et
`QUANTITE` sont exclues). Dans le scénario du test (d2), le changement de mapping actif après clôture
fait basculer la dépense SALAIRE de `RAPPROCHE` (via le poste "Salaires") à `NON_RAPPROCHE` — mais le
montant total netté du mois reste `-77 000` dans les deux cas, puisque les deux statuts sont sommés
ensemble. La bascule n'est donc **pas discriminable** au niveau agrégé de `getTresorerieTroisSeries`,
même en ajoutant une assertion sur `reelFCFA` — cette limite est **structurelle au design de
`netterTresorerieReelleParMois`**, pas un oubli de test. Un test capable de discriminer cette mutation
devrait descendre au niveau de `calculerRapprochementScenario` (ce que fait déjà (c), qui la détecte).

Nommé, expliqué, non masqué — comme demandé.

## Falsifications nouvelles écrites pour ce rapport (réserves de la review)

### Réserve Moyenne #3 — composition filet (A.1) + moteur (rapprochement.ts)

**Constat de départ** : `previsions-mapping-orphelins-integration.test.ts` ne prouvait, avant ce rapport,
que la détection isolée (`cibleOrpheline: true/false`) — jamais conjointement avec le moteur
(`calculerRapprochementScenario`). La review avait raison : cette preuve manquait.

**Test ajouté** : `previsions-mapping-orphelins-integration.test.ts`, nouveau test « (Moyenne #3,
review PR3-ter) COMPOSITION filet + moteur ». Construit un mapping `POSTE_PREVISION` créé contre le
scénario A, une dépense réelle de 31 415 FCFA (montant distinctif) sur ce site, puis :
1. appelle `detecterCiblesOrphelinesDuMappingActif(scenarioB.id, ...)` → `cibleOrpheline: true` ;
2. appelle **le vrai pipeline** `calculerRapprochementScenario(scenarioB.id, ...)` → vérifie qu'**aucune**
   ligne ne porte `reel === 31415` et que le total réel de toutes les lignes ne vaut jamais 31 415.

**Falsifications appliquées pour prouver que ce nouveau test discrimine réellement (ERR-160)** :
- Détection neutralisée (`cibleOrpheline = false`) → le nouveau test tombe (mesuré ci-dessus, inclus
  dans les 4 échecs de la falsification A.1).
- Moteur modifié pour **récupérer** le montant orphelin au lieu de le laisser disparaître (ajout d'une
  boucle de récupération dans `reconcilierPrevuEtReel`, `src/lib/previsions/rapprochement.ts`) → le
  nouveau test tombe (`expected true to be false` sur `uneLigneContient31415`). **1** assertion tombe
  avant l'arrêt de Vitest (la seconde, `montantTotalReel.not.toBe(31415)`, aurait également échoué —
  non atteinte).
- Restauration vérifiée par `diff` contre copie de sauvegarde : identique, aucun résidu.

Verdict : la composition filet + moteur est désormais prouvée par un test unique, falsifié dans les
deux sens (filet cassé, moteur « réparé » à tort).

### Réserve Mineure #4 — immuabilité mécanisée de `SnapshotBudgetInitial`

**Test ajouté** : `src/__tests__/meta/snapshot-budget-initial-immuable.test.ts` — grep du dépôt (`src/`
hors `src/generated/`) pour toute occurrence de `snapshotBudgetInitial.update(`, `.delete(`, `.upsert(`.

**Falsification** : ajout temporaire de `prisma.snapshotBudgetInitial.update(...)` dans
`activerScenarioAvecSnapshot` (`src/lib/queries/previsions-snapshot-budget.ts`) → **1** assertion tombe.
Restauré, `diff` vide confirmé.

### Réserve Mineure #5 — assertion `reelFCFA` dans le test (d2)

**Ajouté** : deux assertions supplémentaires dans `previsions-tresorerie-trois-series-integration.test.ts`,
test (d2), sur `avantChangementMapping.series[0].reelFCFA` et `apresChangementMapping.series[0].reelFCFA`
(avant/après changement de mapping post-clôture).

**Falsification** : `reelFCFA` forcé à `new Decimal(0)` dans `previsions-tresorerie-trois-series.ts` →
**3** tests tombent dans le fichier (dont le (d2) modifié, dont (e) isolation site, dont (c) réel netté) —
confirmé et restauré.

**Limite honnête** (déjà indiquée dans la section précédente) : ce complément ne discrimine **pas** la
falsification `versionParMois`/`versionsDistinctes` — 0 assertion tombe même avec ce complément en place.
Le complément lève l'ambiguïté demandée par la review pour un lecteur futur, mais ne comble pas le trou
structurel de (d2) au niveau agrégé.

## Trou de couverture C.2 comblé (session de clôture ultérieure à ce rapport)

**Contexte** : ce rapport documentait ci-dessus (ligne C.2 « Formatage par nature ») un gap de
couverture réel — aucun fichier de test ne visait directement `rapprochement-lignes-liste.tsx`, donc
le chiffre « 2/2 » annoncé par l'agent d'implémentation de C.2 n'avait rien à falsifier et n'a jamais
pu être reproduit. Une session distincte, dédiée à combler ce trou avant clôture définitive du sprint,
a produit ce qui suit — **remplace** la mention « non vérifiable » ci-dessus, sans l'effacer.

**Tests écrits** :
1. `src/components/previsions/__tests__/rapprochement-lignes-liste.test.tsx` (nouveau, 9 tests) — teste
   `RapprochementLignesListe` **isolément** (pas via `RapprochementTab`) : formatage `QUANTITE` → tonnes
   (`formatTonnagePrevision`), formatage `DEPENSE`/`ENTREE` → FCFA (`formatMontantPrevision`), les
   totaux déjà partitionnés (`formatValeurSelonUnite`), `SANS_SOURCE_REELLE`, filtrage des totaux à
   `nombreLignes = 0`, état vide.
2. `src/components/previsions/__tests__/rapprochement-tab.test.tsx` (préexistant dans le working tree,
   déjà modifié — non écrit par moi mais vérifié et intégré à la mesure) — 3 tests d'intégration
   C.2 au niveau de `RapprochementTab` (vue mensuelle, vue cumulée, top écarts), qui transitent par
   `RapprochementLignesListe` via les composants de vue.

**Piège ERR-160 traité explicitement** : la fixture dédiée du nouveau fichier construit une ligne
`DEPENSE` et une ligne `QUANTITE` portant **la même valeur numérique** (1 200 000) — un formatage
correct produit deux textes disjoints (« 1 200 000 FCFA » vs « 1 200,0 t »), un formatage neutralisé
en produirait un seul répété. Les assertions négatives (`queryByText(...).not.toBeInTheDocument()`)
vérifient l'absence du texte croisé, pas seulement la présence du texte attendu — un test qui ne
vérifierait que la présence passerait aussi avec un formatage mélangé.

**Falsification appliquée** (mutation dans `rapprochement-lignes-liste.tsx`, production) :
`formatValeurSelonNature` et `formatValeurSelonUnite` réduites à toujours retourner
`formatMontantPrevision(valeur)`, ignorant `natureGrandeur`/`unite` — comportement pré-C.2 simulé.

**Résultat mesuré** :
- `rapprochement-lignes-liste.test.tsx` (nouveau, 9 tests) : **4** tests tombent (formatage QUANTITE en
  tonnes, piège ERR-160 DEPENSE/QUANTITE disjoints, SANS_SOURCE_REELLE colonne prévu en tonnes, total
  MONETAIRE/QUANTITE disjoints).
- `rapprochement-tab.test.tsx` (14 tests) : **2** tests tombent (vue mensuelle formatage tonnes, top
  écarts classement disjoint kg/FCFA).
- **Total : 6 tests tombent** (sur 23 tests des deux fichiers), tous liés directement au formatage par
  nature. Restauration vérifiée par `diff` contre copie de sauvegarde (`rapprochement-lignes-liste.tsx`
  est tracké par git, donc `git diff --stat` confirme aussi une absence de changement résiduel après
  restauration) : identique, 0 différence, `git diff --stat
  src/components/previsions/rapprochement-lignes-liste.tsx` redevient vide après restauration (il ne
  l'était pas avant restauration : `103 ++++--- lignes` de diff pendant la falsification).

**Verdict sur le chiffre « 2/2 » initialement annoncé** : **non reproduit tel quel**. Le trou de
couverture signalé plus haut dans ce rapport était réel — il n'y avait, au moment de la review, aucun
test capable de faire tomber quoi que ce soit sur ce fichier. La mesure réelle établie par cette session
de clôture est **6 tests sur 6 mutants d'une seule mutation** (`formatValeurSelonNature` +
`formatValeurSelonUnite` neutralisées ensemble, pas testées séparément par mutation distincte comme les
autres lignes de ce rapport) — un chiffre **différent par construction** du « 2/2 » annoncé (qui
n'était fondé sur aucun test existant). Pas d'arrondi, pas de reconstruction a posteriori du chiffre
initial : le « 2/2 » reste non expliqué et n'a pas à être expliqué, puisqu'il ne correspondait à aucune
preuve vérifiable.

## Ce que je n'ai pas pu vérifier ou reproduire à l'identique

- **B.5** : les chiffres « 3/6 » et « 1/8 » annoncés pour les trois mutations du gradient ne
  correspondent pas exactement à ce que j'ai mesuré (1/8 pour les trois). Signalé plus haut, pas corrigé
  après coup par supposition. **Toujours ouvert** — non réexaminé par la session de clôture C.2, hors
  périmètre de cette dernière.
- **C.4 désaccentuation `"PAYEE"`** : non rejoué, `vente-detail-client.tsx` étant explicitement hors
  périmètre de ce sprint (modification en cours par un autre agent).
- **A.2** (parité compose client/serveur, `libelleCible` revenu à `a.id === cibleId`, garde `!open` de
  l'effet de résolution, `?scenarioId=`, bandeau orphelin vs `NON_RAPPROCHE`) : lu et confirmé présent
  dans `mapping-rapprochement-helpers.test.ts` et `rapprochement-mapping-tab.test.tsx` (tests explicitement
  nommés « FALSIFICATION » qui documentent chacun de ces points), mais **je n'ai pas rejoué de mutation
  moi-même** sur ces points faute de temps dans le budget de cette vérification — je m'appuie sur la
  lecture des tests existants, pas sur une falsification personnellement exécutée. À signaler comme
  moins solide que le reste de ce rapport.

## Réserve honnête (héritée de PR3, toujours valable)

Les compteurs mesurés ici s'arrêtent à la **première assertion en échec** de chaque `it()` (comportement
Vitest standard) — un test avec plusieurs `expect` séquentiels ne révèle jamais les échecs suivants une
fois le premier atteint. Les chiffres rapportés sont donc un **plancher**, pas un compte exhaustif.

## Vérification finale (mesures réelles de cette session)

- `npx vitest run` (avec `DATABASE_URL` exportée), **trois passages consécutifs** :
  - Passage 1 : **324 fichiers / 9 523 tests / 26 todo / 0 skip / 0 échec**
  - Passage 2 : **324 fichiers / 9 523 tests / 26 todo / 0 skip / 0 échec**
  - Passage 3 : **324 fichiers / 9 523 tests / 26 todo / 0 skip / 0 échec**
- Recette moteur (`npx vitest run src/lib/previsions/__tests__/recette`) : **2 709 / 2 709, 0 écart**.
- `npm run build` : exit **0**.
- `npx prisma migrate deploy` : **170 migrations, aucune en attente**.
- `EXCEL-V12` (scénario `cmsdnypml0000n4ekuadykn0f`), comptage SQL direct (Docker `silures-db`) :
  **19 vagues / 602 500 alevins**, **3 calibres**, **4 paliers**, apports **30 000 000**, journal
  **34 400 000**, charges **20 580 000**, `ParametresPrevision` intacte (1 ligne, valeurs inchangées),
  identique à la baseline exigée par `docs/sprints/SPRINT-PR3-TER.md`.
- `MappingRapprochement` : **0 ligne** (confirmé par comptage SQL après toute la session de
  falsification).
- `git diff --stat src/lib/previsions/` : **vide** (Observation #7, confirmé — voir ci-dessous).
- Aucun résidu de falsification : `grep -rn "FALSIFICATION.*TEMPORAIRE"` sur l'ensemble des fichiers
  mutés pendant cette session → **0 occurrence**.

## Vérification finale — session de clôture (trou C.2 comblé)

**Date :** 2026-08-05, session distincte de celle ci-dessus, dédiée à combler le trou de couverture
C.2 signalé à la clôture et à établir les mesures finales définitives du sprint. Rejoue l'intégralité
des mesures de clôture après ajout de `rapprochement-lignes-liste.test.tsx` (+9 tests, 1 fichier).

- `npx prisma migrate deploy` : **170 migrations, aucune en attente**.
- `npx vitest run` (avec `DATABASE_URL` exportée via `set -a && source .env && set +a`), **trois
  passages consécutifs** :
  - Passage 1 : **325 fichiers / 9 532 tests / 26 todo / 0 skip / 0 échec**
  - Passage 2 : **325 fichiers / 9 532 tests / 26 todo / 0 skip / 0 échec**
  - Passage 3 : **325 fichiers / 9 532 tests / 26 todo / 0 skip / 0 échec**
  (+1 fichier / +9 tests par rapport à la mesure précédente de ce rapport, exactement le delta du
  nouveau fichier `rapprochement-lignes-liste.test.tsx` — aucune autre variation, aucun test disparu.)
- Recette moteur (`npx vitest run src/lib/previsions/__tests__/recette`) : **2 709 / 2 709, 0 écart**.
- `git diff --stat src/lib/previsions/` : **vide** (aucun fichier du moteur pur protégé touché par
  cette session — seul `src/components/previsions/` a été modifié, hors périmètre protégé).
- `npm run build` : exit **0**.
- `EXCEL-V12` (scénario `cmsdnypml0000n4ekuadykn0f`), comptage SQL direct (Docker `silures-db`,
  lecture seule stricte, aucune écriture) :

  | Grandeur | Valeur mesurée | Attendu |
  |---|---|---|
  | `VaguePrevue` | 19 | 19 |
  | Somme `effectifAlevinsPrevu` | 602 500 | 602 500 |
  | `AlimentPrevision` (calibres) | 3 | 3 |
  | `PalierRemise` (paliers) | 4 | 4 |
  | `ApportCapital`, somme `montantFCFA` | 30 000 000 | 30 000 000 |
  | `JournalDepensePrevue`, somme `montantFCFA` | 34 400 000 | 34 400 000 |
  | `ChargeMensuellePrevue`, somme `montantFCFA` | 20 580 000 | 20 580 000 |
  | `MappingRapprochement` (tous sites) | 0 ligne | 0 ligne |

  `ParametresPrevision` colonne par colonne, identique à la baseline : `effectifAlevinsParVague=10000`,
  `margeSecuriteAlevinsPct=10`, `poidsMoyenInitialG=5`, `poidsObjectifG=400`,
  `prixAlevinUnitaireFCFA=70`, `prixVenteKgFCFA=1900`, `nombreBacsSimultanesCible=4`,
  `frequenceStockageMois=1`, `capaciteTransportAlevinsNb=20000`, `capaciteTransportAlimentsSacs=60`,
  `capaciteTransportPoissonsKg=1500`, `coutTransportAlevinsFCFA=30000`,
  `coutTransportAlimentsFCFA=15000`, `coutTransportPoissonsFCFA=25000`, `tauxEpargnePct=30`,
  `alevinsAchetesParDefaut=false`, `tresorerieInitialeFCFA=0`.

- Aucun résidu de falsification : `grep -rn "FALSIFICATION.*TEMPORAIRE" src/` → **0 occurrence** après
  la restauration de `rapprochement-lignes-liste.tsx`.

## Réserve 5 (Observation #7) — confirmation par la mesure

```
$ git diff --stat src/lib/previsions/
(sortie vide)
```

Confirmé : aucune ligne du moteur pur protégé (`src/lib/previsions/`) n'a été modifiée de façon
persistante pendant ce sprint. Les falsifications temporaires que j'ai appliquées à
`src/lib/previsions/rapprochement.ts` pendant cette session (falsification A.3 « id brut », falsification
`versionParMois`, falsification composition Moyenne #3) ont chacune été restaurées et vérifiées par
`diff` contre une copie de sauvegarde avant d'être considérées closes — le fichier étant déjà tracké par
git avec des changements non commités de ce sprint, `git diff --stat` seul aurait été insuffisant pour
détecter une falsification laissée par erreur ; la vérification par `diff` contre sauvegarde binaire est
la preuve retenue ici, pas `git diff --stat` seul.

**Références :** ERR-160, ERR-168 (pratique de falsification), ERR-171, ERR-172, ADR-053 §15.6 point 3,
`docs/reviews/review-sprint-PR3-ter.md`, `docs/tests/rapport-falsification-sprint-PR3.md` (format
repris), `docs/sprints/SPRINT-PR3-TER.md`.
