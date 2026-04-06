# Rapport de tests — ADR-033 : fonctions vague-level (estimerNombreVivantsVague + segmenterPeriodesAlimentairesVague)

**Date :** 2026-04-06
**Auteur :** @tester
**Sprint de reference :** ADR-033

---

## Contexte

L'ADR-033 a transforme le calcul FCR de per-bac a vague-level. Deux nouvelles fonctions
ont ete implementees dans `src/lib/feed-periods.ts` :

- `estimerNombreVivantsVague` — estime la population totale de la vague a une date donnee
  (algorithme : nombreInitial - calibrage.nombreMorts - mortalitesTotales)
- `segmenterPeriodesAlimentairesVague` — segmente les releves alimentation de TOUS les bacs
  confondus en periodes coherentes (sans groupement par bacId), retourne des
  `PeriodeAlimentaireVague` sans champ `bacId`

Les types modifies :
- `PeriodeAlimentaireVague` — sans `bacId`, avec `biomasseDebutKg`, `biomasseFinKg`,
  `gainNegatifExclu`, `fcrPeriode`, `dureeJours`, champs `detailEstimationDebut/Fin`
- `FCRTracePeriode` — sans `bacId`/`bacNom`

---

## Resultats

### Suite de tests feed-periods.test.ts

```
npx vitest run src/__tests__/lib/feed-periods.test.ts
122 tests passes / 0 echecs
```

**Avant les nouveaux tests :** 92 tests existants.
**Apres ajout :** 122 tests (30 nouveaux).

### Build production

```
npm run build
0 erreurs TypeScript
143 pages generees
```

### Suite complete

```
npx vitest run
4216 passes + 30 echecs pre-existants (aucun lien avec ADR-033)
```

Les 30 echecs pre-existants concernent : abonnements-statut-middleware, bacs, vagues-distribution,
permissions, feed-analytics-fournisseurs, quota-enforcement — tous anterieurs a ce sprint.

---

## Nouveaux tests ajoutes

### describe("estimerNombreVivantsVague") — 9 tests

| Test | Comportement verifie |
|------|----------------------|
| retourne nombreInitial quand pas de mortalites ni calibrages | Population initiale conservee |
| soustrait les mortalites avant ou egal a targetDate | Mortalites <= targetDate comptees |
| ignore les mortalites apres targetDate | Mortalites futures ignorees |
| soustrait calibrage.nombreMorts si calibrage.date <= targetDate | Morts de calibrage comptees |
| ignore calibrage.nombreMorts si calibrage.date > targetDate | Calibrages futurs ignores |
| ne descend pas en dessous de 0 | Floor a 0 garanti |
| combine mortalites et calibrage.nombreMorts correctement | Les deux sources soustraites |
| mortalite le meme jour que targetDate est comptee (<=) | Borne inclusive confirmee |
| mortalite le meme jour que vagueDebut est ignoree (> vagueDebutMs) | Borne de depart exclusive |
| multiple calibrages : tous ceux <= targetDate sont soustraits | Accumulation correcte |

### describe("segmenterPeriodesAlimentairesVague") — 21 tests

| Test | Comportement verifie |
|------|----------------------|
| entrees vides -> tableau vide | Cas degenere |
| releves sans consommations -> tableau vide | Releves sans aliment ignores |
| 1 produit -> 1 periode vague (tous bacs confondus) | Pas de groupement par bacId |
| les periodes ne contiennent PAS de bacId | Structure PeriodeAlimentaireVague |
| changement de produit -> 2 periodes vague distinctes | Segmentation par produit |
| nombreVivants = population totale vague (pas per-bac) | Valeur 1000 (pas 500 par bac) |
| nombreVivants tient compte des mortalites avant dateDebut | Mortalites integrees |
| nombreVivants tient compte de calibrage.nombreMorts | Calibrage integre |
| l'estimation de poids utilise interpolerPoidsVague (toutes biometries) | Pas de filtre bacId |
| les gains negatifs sont exclus (gainBiomasseKg = null, gainNegatifExclu = true) | ADR anti-gain |
| gainNegatifExclu = false quand gain positif | Valeur coherente pour gain > 0 |
| fcrPeriode = quantiteKg / gainBiomasseKg quand gain positif | FCR calcule correctement |
| fcrPeriode = null quand gainBiomasseKg = null | FCR exclu si pas de gain |
| releves en entree dans le desordre -> tries correctement | Tri par date |
| dureeJours = difference en jours entre dateDebut et dateFin | Duree calculee |
| utilise Gompertz vague-level quand contexte fourni | Integration Gompertz |
| scenario production 3 bacs : 1 periode vague (tous bacs confondus) | Scenario realiste |
| scenario production 3 bacs : 2 produits -> 2 periodes vague | Changement produit realiste |
| biomasseDebutKg et biomasseFinKg calcules correctement | Formule biomasse |
| methodeEstimation = methode la moins precise des deux bornes | Conservatisme indicateur |

---

## Fichiers modifies

- `src/__tests__/lib/feed-periods.test.ts` — +30 tests (lignes 2082-2400)

---

## Conclusion

Toutes les nouvelles fonctions vague-level sont correctement couvertes. La suite de tests
confirme que les algorithmes respectent les specifications ADR-033 :

1. `estimerNombreVivantsVague` soustrait correctement calibrage.nombreMorts ET mortalitesTotales
   de la population initiale, avec les bonnes bornes (calibrage.date <= targetDate,
   mortalite.date > vagueDebutMs ET <= targetDate).

2. `segmenterPeriodesAlimentairesVague` produit des periodes sans `bacId`, avec
   `nombreVivants` = population totale vague, en utilisant `interpolerPoidsVague` sans
   filtre bacId, et en excluant les gains negatifs (gainNegatifExclu = true).

Build production OK. 0 regression introduite.
