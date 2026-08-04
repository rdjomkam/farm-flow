# Jeu d'or du module Prévisions

Référence de recette du moteur de prévision (cf. [ADR-053](../../../docs/decisions/ADR-053-module-previsions.md), section 7).

| Fichier | Rôle |
|---|---|
| `Previsions_Elevage_Silure_v12.xlsx` | Classeur source, fourni par l'exploitant. **Ne pas modifier.** |
| `extract-golden.py` | Extraction des fixtures depuis le classeur. Reproductible. |
| `plan-v12-corrige.json` | Scénario A — le plan complet, bug `B10` corrigé. |
| `annexe-b-corrigee.json` | Scénario B — sans apports ni investissements. |

## Régénérer les fixtures

```bash
python3 prisma/fixtures/previsions/extract-golden.py
```

Requiert `openpyxl`. Le script n'accède à aucune base de données et ne lit aucune variable
d'environnement — c'est de l'outillage hors runtime applicatif.

## Tolérance de recette

- **0** sur tout entier : sacs, voyages, poissons, alevins.
- **≤ 1 FCFA** sur tout montant.

Les valeurs attendues sont lues dans les **cellules calculées du classeur**, jamais recalculées par
une réimplémentation du moteur — la recette doit comparer le moteur applicatif à une source
indépendante de lui, sinon elle ne prouve rien.

## Le patch `Dépenses!B10`

`Dépenses!B10` (Transport des alevins, août 2026) contient un `0` en dur qui **écrase la formule**
`=B9*Paramètres!$B$30`, alors que le nombre de voyages `B9` vaut bien 1. Le montant attendu est
30 000 FCFA. Les 20 autres colonnes de la ligne portent bien la formule.

Décision (ADR-053 §7) : **le moteur applique la formule partout**, sans exception pour ce mois. Les
fixtures sont patchées sur cette seule cellule et ses conséquences arithmétiques : logistique, base
de répartition, charges opérationnelles, autres dépenses, dépenses totales, résultat, épargne, et
la trésorerie cumulée de tous les mois suivants.

## Pourquoi deux scénarios

Le scénario A ne descend jamais sous zéro en trésorerie. Le scénario B est le **seul** jeu de
données qui fait passer la trésorerie négative — sans lui, la logique « point bas / besoin de
financement » des exigences §7.2 ne serait jamais testée sur son cas nominal.

| Indicateur | A — plan v12 corrigé | B — annexe B corrigée |
|---|---|---|
| Tonnage vendu | 241 t | 241 t |
| Chiffre d'affaires | 457 900 000 | 457 900 000 |
| Apports en capital | 30 000 000 | 0 |
| Dépenses totales | 342 559 600 | 308 159 600 |
| dont aliments | 277 369 600 | 277 369 600 |
| dont investissements | 34 400 000 | 0 |
| Résultat cumulé | 145 340 400 | 149 740 400 |
| Point bas de trésorerie | +2 276 600 (2026-08) | **−6 334 704 (2026-11)** |
| Besoin mensuel max en aliments | 17 100 kg | 17 100 kg |

## Écart avec l'annexe B des exigences

L'annexe B du document d'exigences annonce 308 129 600 / 149 770 400 / −6 304 704. Ces valeurs
**portent le bug `B10`** : chaque écart avec la colonne B ci-dessus vaut exactement 30 000 FCFA.
Elles décrivent par ailleurs un état antérieur du classeur, avant l'ajout des 30 000 000 FCFA
d'apports et des 34 400 000 FCFA d'investissements — d'où l'écart avec la colonne A.

L'annexe B originale n'est **plus** un jeu de données de recette valide. Elle ne documente que
l'écart et sa cause.

## Bloc d'entrées `entreesModele`

Les deux fixtures contiennent désormais, en plus des séries de sortie agrégées, un bloc de premier
niveau `entreesModele` — identique dans les deux scénarios (mêmes cellules de saisie du même
classeur ; seule la zone `resultats` diverge entre A et B). Toute valeur est lue dans une cellule de
saisie du classeur (feuille + coordonnée documentées par une clé `$source` sur chaque sous-bloc),
jamais recalculée par le script.

| Sous-bloc | Contenu | Feuille(s) source |
|---|---|---|
| `parametresScenario` | Prix de vente, poids moyen à la vente, marge de sécurité alevins, prix alevin, taux d'épargne, trésorerie initiale | `Paramètres!B5,B6,B7,B8,B11,B12,B22,B36,B37` |
| `paliersRemise` | 4 paliers (seuil en tonnes, % de remise, ordre) | `Paramètres!B16:C19` |
| `transport` | Capacités et coûts au voyage (aliments, poissons, alevins) | `Paramètres!B25:B30` |
| `aliments` | 3 granulométries : marque, poids du sac, prix du sac, répartition % par mois de cycle, sacs par tonne standard | `Aliments!A4:J6` |
| `planVagues` | 19 vagues : mois de stockage, tonnage visé, alevins à commander, remise appliquée, sacs par granulométrie, coût aliments (total + réparti sur les 3 mois du cycle) | `Empoissonnement!A4:H22` + `'Aliment par vague'!D4:P22` |
| `chargesExploitation` | 4 postes non nuls (sur 8 lignes, dont 4 à zéro sur les 21 mois) : main-d'œuvre, énergie, produits vétérinaires, loyer, série sur 21 mois chacun | `Dépenses!A14:V21` |
| `journalDepensesPonctuelles` | Les deux lignes en dur `Crédits` (ligne 28) et `Investissements et exceptionnels` (ligne 33) — voir section suivante, ce ne sont pas de vraies lignes de journal | `Dépenses!A28:V28`, `Dépenses!A33:V33` |
| `donneesManquantes` | Liste explicite de ce que le classeur ne porte nulle part (voir ci-dessous) | — |

### Capacités de transport : elles étaient dans le classeur, pas déduites empiriquement

Contrairement à l'hypothèse initiale, `Paramètres!B25:B30` porte bien les 6 valeurs de transport en
saisie directe : 60 sacs/voyage aliment (15 000 FCFA), 1 500 kg/voyage poisson (25 000 FCFA), et
**20 000** alevins/voyage (30 000 FCFA) — pas 15 000 comme supposé empiriquement avant cette
extraction. La capacité alevins a donc été corrigée par cette extraction.

### Données d'entrée introuvables dans le classeur (`entreesModele.donneesManquantes`)

Aucune de ces valeurs n'a été inventée ou déduite d'un calcul — elles sont documentées comme
absentes :

- **`poidsMoyenInitialG`** (poids des alevins au stockage) : aucune cellule ne le porte. Seul
  `Paramètres!B6` (poids moyen **à la vente**, 400 g) existe. Impact : le moteur ne peut pas dériver
  une courbe de croissance alevin→vente depuis le seul classeur.
- **`poidsObjectifG`** en tant que paramètre nommé séparé n'existe pas : c'est la même cellule que
  ci-dessus (`Paramètres!B6`), réutilisée.
- **`effectifAlevinsParVague`** en tant que constante unique de scénario n'existe pas : c'est une
  série par vague (`planVagues[].alevinsACommanderNb`), pas un paramètre scalaire.
- **`nombreBacsSimultanesCible`** : absent. Le classeur raisonne uniquement en tonnage par vague,
  jamais en nombre de bacs.
- **`frequenceStockageMois`** : absent comme paramètre nommé. Le plan des vagues montre
  empiriquement une cadence d'un stockage par mois, mais ce n'est écrit nulle part comme une valeur
  modifiable.
- **`dureeCycleMois`** : absent comme paramètre nommé. Le cycle de 3 mois est implicite dans la
  structure des feuilles (colonnes mois 1/2/3 de `Aliment par vague`, `M1/M2-ventes/M3-ventes` du
  Gantt), jamais une cellule de saisie.

Ces six absences limitent la testabilité de tout calcul de croissance biologique (poids initial →
poids de vente) ou de dimensionnement de bacs à partir du seul classeur — elles ne bloquent pas la
recette des séries financières et logistiques déjà couvertes par le jeu d'or (tonnage, sacs,
dépenses, trésorerie), qui reposent sur `planVagues` (tonnage visé par vague, saisi directement) et
non sur une reconstruction biologique.

### Vérifications numériques effectuées (script Python indépendant, hors moteur)

Toutes exactes (diff = 0) sur les 21 mois / 19 vagues, à partir des seules valeurs de
`entreesModele` et des séries de sortie déjà présentes :

1. `sacs(granulométrie, mois) = ceil(kg(granulométrie, mois) / poidsSacKg)` — le `ceil` s'applique
   bien **par granulométrie**, jamais sur le total agrégé (confirmé sur 21 mois × 3 granulométries).
2. `depenses.aliments(mois)` est reproductible **à condition de passer par `planVagues`** (montant
   par vague, réparti sur les 3 mois de son cycle), pas directement depuis les sacs mensuels
   agrégés (`besoinsAliments.sacsTotal`) : la remise fournisseur (`paliersRemise`) s'applique **au
   niveau de chaque vague** (selon son propre tonnage visé), pas au niveau du total mensuel toutes
   vagues confondues. Un mois donné peut agréger la contribution de deux ou trois vagues à des
   remises différentes. `planVagues[].coutAlimentsFCFA` lui-même est reproductible depuis
   `sacs2mm/3mm/4mm × prixSacFCFA`, remisé par le palier de la vague (`objectifTonnes` de la vague
   contre les seuils de `paliersRemise`) — vérifié exact sur les 19 vagues.
3. `depenses.baseRepartition(mois) = logistique.sousTotal(mois) + depenses.chargesExploitation(mois)`
   — exact sur 21/21 mois (déjà vérifié par la pré-analyse, reconfirmé ici). `chargesExploitation`
   lui-même est la somme des 6 postes non nuls de `entreesModele.chargesExploitation`.
4. `logistique.transportAlevins(mois) = logistique.voyagesAlevins(mois) × transport.voyageAlevinsCoutFCFA`
   (30 000 FCFA) — exact sur 21/21 mois, y compris août 2026 une fois le patch `B10` appliqué dans
   le fixture.

**Conséquence pour @developer :** la recette PR1.4 est possible pour l'ensemble de la chaîne
financière et logistique (tonnage, sacs, dépenses, trésorerie), à condition que le moteur applique
la remise fournisseur par vague (sur le tonnage propre à chaque vague), pas sur un total mensuel
agrégé — c'est un piège de conception à éviter, pas une limite de la recette elle-même.

## `besoinsAliments.detailParVagueSacs` — les neuf séries « DÉTAIL PAR VAGUE » (Sprint PR2-sexies)

Les deux fixtures portent désormais un nouveau bloc `besoinsAliments.detailParVagueSacs`, extrait
du bloc `Prévisions!A11:V23` (« DÉTAIL PAR VAGUE — sacs consommés dans le mois (indicatif) »),
délibérément écarté par le sprint PR2-quinquies (voir story PR2sex.1). Neuf séries numériques :

| Sous-clé | Ligne du classeur | Mois de cycle | Granulométrie |
|---|---|---|---|
| `moisCycle1.2mm` | 13 | 1er | 2 mm |
| `moisCycle1.3mm` | 14 | 1er | 3 mm |
| `moisCycle1.4mm` | 15 | 1er | 4 mm |
| `moisCycle2.2mm` | 17 | 2e | 2 mm |
| `moisCycle2.3mm` | 18 | 2e | 3 mm |
| `moisCycle2.4mm` | 19 | 2e | 4 mm |
| `moisCycle3.2mm` | 21 | 3e | 2 mm |
| `moisCycle3.3mm` | 22 | 3e | 3 mm |
| `moisCycle3.4mm` | 23 | 3e | 4 mm |

Correspondance ligne↔série vérifiée directement dans le classeur (libellés de colonne A, lignes
11-23) avant extraction, jamais présumée — voir `docs/tests/rapport-story-PR2sex.1.md`. Chaque
sous-bloc `moisCycleN` porte sa propre clé `$source` (ex. `"Prévisions!B13:V13, B14:V14, B15:V15"`).

**Un `ROUND`, pas un `CEIL`.** Ces séries sont les sacs **consommés** dans le mois (indicatif,
lignes 13-23), une notion différente des sacs **à acheter** (lignes 7-10, déjà extraites via
`besoinsAliments.sacsTotal`/`sacsParGranulometrie`, qui appliquent un `CEIL` par granulométrie — cf.
section « Vérifications numériques » ci-dessus). Les deux séries répondent à des questions
différentes du classeur et ne doivent jamais être confondues dans une recette future.

**Non affectées par le patch `B10` ni par le scénario B.** Ce sont des décomptes de sacs, pas des
montants en FCFA : le patch `Dépenses!B10` (transport des alevins) et la mise à zéro des apports en
capital/investissements du scénario B ne touchent que des lignes monétaires de la feuille
`Dépenses`/`Prévisions`, jamais les lignes 13-23. Confirmé empiriquement : les deux fixtures portent
des valeurs strictement identiques pour `detailParVagueSacs` (seule la zone `resultats` diverge entre
A et B, comme documenté plus haut pour `entreesModele`).

**Cumuls de contrôle (colonne W du classeur, `SUM` sur les 21 mois), vérifiés exacts :**

| | 2 mm | 3 mm | 4 mm |
|---|---|---|---|
| 1er mois de cycle | 1 543 | 867 | 0 |
| 2e mois de cycle | 385 | 3 471 | 4 820 |
| 3e mois de cycle | 0 | 0 | 7 230 |

**Les lignes 12/16/20 (« Vague en 1er/2e/3e mois de cycle ») ne sont PAS des séries numériques.**
Ce sont des lookups `INDEX`/`MATCH` qui n'affichent qu'**une seule** vague par mois de cycle, même
quand plusieurs vagues coïncident réellement le même mois — un défaut bénin déjà documenté
(ADR-053 §7, « Défaut bénin confirmé »). Les quantités elles-mêmes (lignes 13-23, `SUMIFS`)
cumulent correctement toutes les vagues concernées ; seul l'affichage de l'étiquette de vague est
dégradé. Ce script extrait donc `B12`/`B16`/`B20` **uniquement** comme métadonnée
`moisCycleNVagueLabelIndexMatch`, marquée explicitement `$defectueux` — jamais comme une entrée
numérique consommable par une recette, pour ne pas reproduire ce défaut d'affichage dans le moteur
farm-flow (qui, lui, agrège nativement toutes les `VaguePrevue` actives d'un mois donné).

## Cinq montants absents du jeu d'or

Le lien Journal → Dépenses est cassé dans le classeur lui-même : le journal ne contient que deux
lignes d'exemple à 0, pourtant `Dépenses!ligne 28` porte 5 M / 5 M / 4 M / 4 M en dur (écrasant les
`SUMIFS` censés les calculer) et la ligne 33 porte 4 M puis 16 400 000 FCFA en dur — ce dernier
montant n'est adossé à aucune ligne de journal nulle part dans le classeur.

En base, cette incohérence est structurellement impossible : toute dépense ponctuelle **est** une
ligne de `JournalDepensePrevue`. Ces cinq montants devront être **re-saisis manuellement** par
l'exploitant qui reprendra ce plan dans farm-flow. Ils n'ont aucune ligne source dont les dériver,
donc ils ne font pas partie du jeu d'or rejouable — ce n'est pas un défaut de portage.
