# ADR-032 — Fiabilité de nombreVivants après calibrage et impact sur le FCR

**Statut :** Accepté
**Date :** 2026-04-05
**Auteur :** @architect
**Dépend de :** ADR-028, ADR-029, modèle Calibrage (Sprint 24)
**Supersède partiellement :** ADR-030 (suppression de GOMPERTZ_BAC)

---

## Résumé exécutif

Le calibrage (redistribution des poissons entre bacs) invalide silencieusement les hypothèses
sur lesquelles repose le calcul FCR per-bac introduit par ADR-028/029/030. Ce document analyse
ce problème systématiquement, identifie trois sources d'erreur distinctes, et prescrit des
corrections ciblées sans migration de schéma.

---

## 1. Évaluation critique de l'algorithme FCR en 7 étapes

### Ce qui est correct

L'architecture à trois couches (segmentation → interpolation → agrégation pondérée) est
conceptuellement solide. La décision d'utiliser `FCR = Σfeed / Σgain` au lieu de la moyenne
arithmétique des FCR de période est correcte — c'est l'unique formulation qui respecte la
conservation de la biomasse.

La chaîne de fallback à 3 niveaux pour l'interpolation du poids (BIOMETRIE_EXACTE →
GOMPERTZ_VAGUE → INTERPOLATION_LINEAIRE → VALEUR_INITIALE) est robuste et
bien implémentée dans `src/lib/feed-periods.ts`.

### Gap 1 — `nombreVivants` est figé au début de la période

Dans `estimerNombreVivants` (`src/lib/feed-periods.ts`, ligne 331-351), le nombre de vivants
est déterminé une seule fois pour tout le bac, sans tenir compte de la date de la période.
La formule actuelle :

```typescript
// bac.nombreInitial ?? round(vague.nombreInitial / nbBacs)
```

Cette valeur ne change jamais entre les périodes d'alimentation d'un même bac. Or, après un
calibrage, le `bac.nombreInitial` du schéma est périmé : il reflète la population au moment
de la création du bac, pas sa population actuelle.

**Effet :** Si Bac 04 est créé lors d'un calibrage au jour J25 avec 800 poissons venant de
Bac 01 et Bac 03, `bac.nombreInitial` vaut probablement null (nouveau bac) ou une valeur
provisoire. L'algorithme tombe dans le cas `round(vague.nombreInitial / nbBacs)` — une
répartition uniforme qui ignore complètement l'opération de calibrage.

### Gap 2 — Le gain de biomasse per-bac est calculé avec le mauvais `nombreVivants`

La formule de gain utilisée dans `segmenterPeriodesAlimentaires` (ligne 492) :

```typescript
const rawGain = ((poidsMoyenFin - poidsMoyenDebut) * nombreVivants) / 1000;
```

`nombreVivants` ici est la valeur calculée par `estimerNombreVivants`, qui ignore le calibrage.
Exemple réel (Vague 26-01) :

- Bac 01 avant calibrage (J0-J24) : ~325 poissons
- Bac 01 après calibrage (J25+) : ~130 poissons (les autres partent dans Bac 03 et Bac 04)

Si `nombreVivants = 325` est utilisé pour les deux périodes, le gain post-calibrage est
surestimé d'un facteur ≈ 2.5×, ce qui produit un FCR artificiellement bas (< 0.5) —
biologiquement implausible pour Clarias gariepinus.

**C'est la cause principale des FCR < 0.5 observés dans les données réelles.**

### Gap 3 — Les biométries post-calibrage sur Bac 01 reflètent les poissons restants

Après calibrage, Bac 01 ne contient plus que les poissons non redistribués. Ses biométries
post-J25 sont donc correctes pour les poissons qu'il contient. Le problème n'est pas dans
la mesure du poids moyen — il est entièrement dans le `nombreVivants` utilisé pour convertir
un poids moyen en biomasse.

### Gap 4 — La "chute" apparente de poids moyen per-bac n'est pas une erreur de mesure

Bac 01 : poids moyen J7 = 65g, J16 = 49g.

Ceci est une redistribution lors d'un calibrage : les gros poissons du bac ont été envoyés
vers d'autres bacs (les "calibrés"), et les petits sont restés ou ont été recombinés.
L'interpolation Gompertz per-vague, calibrée sur la moyenne de tous les bacs, ne voit pas
cette chute — elle prédit une croissance monotone. En revanche, si on utilise les biométries
per-bac pour interpoler, on obtient des poids qui "reculent", ce qui produit des gains négatifs,
qui sont exclus par la règle `gainBiomasseKg = rawGain > 0 ? rawGain : null`.

**Résultat :** Pour les périodes entourant un calibrage, le gain est `null`, et ces périodes
sont exclues du FCR. C'est le comportement correct — mais il signifie que tout l'aliment
consommé sur la période de calibrage est ignoré dans le numérateur FCR aussi (puisque seules
les périodes avec `gainBiomasseKg != null` contribuent). En réalité l'aliment a bien été
consommé. Il faudrait inclure le numérateur tout en excluant le dénominateur de ces périodes,
ce qui revient à biaiser le FCR à la hausse.

**La règle d'exclusion d'ADR-028 est donc correcte dans son principe** — exclure les périodes
avec gain négatif ou nul est la seule option honnête. Le vrai problème est Gap 1 et Gap 2 :
si `nombreVivants` est correct, la plupart de ces "gains négatifs" disparaissent.

### Gap 5 — GOMPERTZ_BAC est une abstraction inutile : à supprimer

ADR-030 a introduit GOMPERTZ_BAC en partant de l'hypothèse que les bacs d'une même vague
peuvent avoir des trajectoires de croissance différentes (aliments différents). En théorie,
c'est vrai. En pratique, les calibrages (redistribution des poissons entre bacs) sont une
opération courante dans l'élevage de Clarias — et dès qu'un calibrage a lieu, les biométries
per-bac incluent des discontinuités qui ne reflètent pas de la croissance réelle. Le modèle
Gompertz per-bac convergera mal (R² faible) et le fallback vers GOMPERTZ_VAGUE s'activera
systématiquement.

**Résultat : GOMPERTZ_BAC n'est jamais effectivement utilisé.** C'est du code mort qui :

1. Ajoute de la complexité dans la chaîne de fallback pour un bénéfice nul
2. Nécessite un modèle `GompertzBac` en DB, une route de calibration per-bac, et du code
   de sélection dans `interpolerPoidsBac` — tout cela pour toujours tomber en fallback
3. Induit en erreur l'éleveur qui pourrait sélectionner cette stratégie dans ConfigElevage
   en pensant obtenir un calcul plus précis

**Décision : supprimer GOMPERTZ_BAC** de la chaîne d'interpolation, du `StrategieInterpolation`
enum, du formulaire ConfigElevage, et du modèle `GompertzBac`. La chaîne devient :

```
BIOMETRIE_EXACTE → GOMPERTZ_VAGUE → INTERPOLATION_LINEAIRE → VALEUR_INITIALE
```

Cela simplifie l'ensemble de l'architecture FCR et élimine une source de confusion.

---

## 2. Modèle `Calibrage` existant — ce qu'il contient déjà

Le modèle `Calibrage` (Sprint 24) stocke :

```
Calibrage.date           — date de l'opération
Calibrage.vagueId        — vague concernée
Calibrage.sourceBacIds   — tableau des bacs source
Calibrage.nombreMorts    — mortalités pendant le calibrage
Calibrage.groupes        — CalibrageGroupe[] :
    destinationBacId     — bac destination
    nombrePoissons       — poissons envoyés vers ce bac
    poidsMoyen           — poids moyen du groupe
    tailleMoyenne        — taille moyenne du groupe
Calibrage.snapshotAvant  — état de la vague avant (JSON)
```

`CalibrageGroupe.nombrePoissons` et `CalibrageGroupe.destinationBacId` sont exactement
ce dont le FCR a besoin pour calculer `nombreVivants` par bac après calibrage.

**Aucune migration de schéma n'est nécessaire.** Toutes les données requises sont déjà
présentes. Le problème est uniquement dans la logique de calcul.

---

## 3. Décision

### Principe

`estimerNombreVivants` dans `feed-periods.ts` doit devenir consciente du calibrage
(calibrage-aware). Pour une période d'alimentation `[dateDebut, dateFin]` sur `bacId`,
elle doit utiliser la population du bac au moment de `dateDebut`, en tenant compte de
toutes les opérations de calibrage qui ont eu lieu avant cette date.

### Algorithme de calcul de `nombreVivantsAuDebut(bacId, date)`

```
1. Partir de la population initiale du bac : bac.nombreInitial ?? round(vague.nombreInitial / nbBacs)
2. Pour chaque Calibrage de la vague dont calibrage.date < date, trié ASC :
   a. Si bacId est dans calibrage.sourceBacIds :
      Soustraire les poissons qui PARTENT de ce bac :
      sortants = sum(groupe.nombrePoissons pour tous les groupes de ce calibrage
                     SAUF le groupe dont destinationBacId = bacId)
      Ajouter les poissons qui RESTENT (re-assignment vers le même bac) :
      restants = groupe.nombrePoissons du groupe avec destinationBacId = bacId
      delta = restants - (total_source_avant - restants) ← simplifié ci-dessous
   b. Si bacId est dans calibrage.groupes[*].destinationBacId et bacId N'EST PAS sourceBacId :
      Ajouter groupe.nombrePoissons du groupe destinationBacId = bacId
      (nouveau bac créé lors du calibrage, ou bac qui reçoit des poissons)
3. Soustraire les mortalités enregistrées pour ce bac avant cette date
```

**Simplification : calcul direct depuis les groupes**

Pour un bacId donné à une date donnée :

```
populationBac(bacId, date) =
  IF bacId est la destination d'un groupe du dernier calibrage avant date :
    groupe.nombrePoissons
    + mortalitesPostCalibrage(bacId, calibrage.date, date) × -1
  ELSE :
    bac.nombreInitial_ou_repartition
    + sum(groupes entrants vers bacId dans calibrages avant date)
    - sum(poissons sortants de bacId dans calibrages avant date)
    - mortalités(bacId, avant date)
```

La forme la plus fiable en pratique est :

> **Pour chaque période d'alimentation, prendre le dernier CalibrageGroupe dont
> `destinationBacId = bacId` et dont `calibrage.date <= dateDebut`, et utiliser
> `groupe.nombrePoissons` comme population de base, puis soustraire les mortalités
> post-calibrage enregistrées avant `dateDebut`.**

Si aucun CalibrageGroupe ne correspond (bac n'a jamais été destination de calibrage),
le comportement actuel (nombreInitial - mortalités) est correct.

---

## 4. Interface TypeScript — `CalibragePoint`

À ajouter dans `src/lib/feed-periods.ts` :

```typescript
/**
 * Représentation d'un calibrage pertinente pour le calcul FCR.
 *
 * Transmis par l'appelant (computeAlimentMetrics / getFCRTrace) depuis les
 * enregistrements Calibrage de la DB.
 *
 * Un CalibragePoint par opération de calibrage de la vague, avec uniquement
 * les champs nécessaires au calcul de nombreVivants.
 */
export interface CalibragePoint {
  /** Date de l'opération de calibrage */
  date: Date;
  /** Mortalités enregistrées pendant le calibrage */
  nombreMorts: number;
  /**
   * Groupes de redistribution : chaque groupe décrit combien de poissons
   * ont été envoyés vers quel bac.
   *
   * Note : si un bac source reçoit certains de ses propres poissons en retour
   * (tri et remise), il apparaîtra aussi comme destinationBacId.
   */
  groupes: Array<{
    destinationBacId: string;
    nombrePoissons: number;
    poidsMoyen: number;
  }>;
}
```

### Mise à jour de `VagueContext`

```typescript
export interface VagueContext {
  dateDebut: Date;
  nombreInitial: number;
  poidsMoyenInitial: number; // grammes
  bacs: { id: string; nombreInitial: number | null }[];
  /** Calibrages de la vague, triés par date ASC. Vide si aucun calibrage. */
  calibrages?: CalibragePoint[];
}
```

L'ajout est optionnel (`?`) : tous les appels existants sans `calibrages` continuent
de fonctionner avec le comportement actuel (pas de calibrage-awareness).

---

## 5. Mise à jour de `estimerNombreVivants`

Renommer et réécrire la fonction pour qu'elle accepte une date cible :

```typescript
/**
 * Estime le nombre de poissons vivants dans un bac à une date donnée,
 * en tenant compte des opérations de calibrage (ADR-032).
 *
 * Algorithme :
 * 1. Chercher le dernier CalibrageGroupe dont destinationBacId = bacId
 *    et calibrage.date <= targetDate. Si trouvé, partir de groupe.nombrePoissons.
 * 2. Sinon, partir de bac.nombreInitial ?? round(vague.nombreInitial / nbBacs).
 * 3. Soustraire les mortalités enregistrées pour ce bac entre la date de base
 *    (calibrage ou début de vague) et targetDate.
 *
 * @param bacId       - identifiant du bac (null = vague entière, fallback legacy)
 * @param targetDate  - date de début de la période
 * @param vagueContext - contexte vague avec calibrages (ADR-032)
 * @param mortalitesParBac - Map<bacId, {nombreMorts, date}[]> pré-calculée
 * @returns nombre de vivants estimé, ou null si impossible
 */
export function estimerNombreVivantsADate(
  bacId: string | null,
  targetDate: Date,
  vagueContext: VagueContext,
  mortalitesParBac?: Map<string, Array<{ nombreMorts: number; date: Date }>>
): number | null
```

La signature de `segmenterPeriodesAlimentaires` reste inchangée externellement — elle
transmet `targetDate = periode.dateDebut` à `estimerNombreVivantsADate` en interne.

---

## 6. Mise à jour de l'appelant dans `computeAlimentMetrics` et `getFCRTrace`

Les deux fonctions dans `src/lib/queries/analytics.ts` doivent inclure les calibrages
dans leur requête Prisma et les transmettre dans `VagueContext` :

```typescript
// Dans la requête Prisma (include pour vague) :
calibrages: {
  select: {
    date: true,
    nombreMorts: true,
    groupes: {
      select: {
        destinationBacId: true,
        nombrePoissons: true,
        poidsMoyen: true,
      },
    },
  },
  orderBy: { date: "asc" },
},
```

```typescript
// Construction de VagueContext :
const vagueCtx: VagueContext = {
  dateDebut: vague.dateDebut,
  nombreInitial: vague.nombreInitial,
  poidsMoyenInitial: vague.poidsMoyenInitial,
  bacs: vague.bacs,
  calibrages: vague.calibrages.map((c) => ({
    date: c.date,
    nombreMorts: c.nombreMorts,
    groupes: c.groupes,
  })),
};
```

---

## 7. Traitement des mortalités dans le contexte FCR

`computeNombreVivantsVague` (dans `src/lib/calculs.ts`) est utilisé ailleurs dans
`analytics.ts` pour le nombre de vivants final de la vague. Cette fonction est déjà
correcte pour le total vague — elle somme par bac en tenant compte des comptages.

Pour le FCR per-bac per-période, seule `estimerNombreVivantsADate` est affectée.

Les mortalités à transmettre à `estimerNombreVivantsADate` peuvent être extraites
directement des relevés MORTALITE déjà chargés dans `computeAlimentMetrics` :

```typescript
// Pré-calcul une seule fois par vague (pas par période) :
const mortalitesParBac = new Map<string, Array<{nombreMorts: number; date: Date}>>();
for (const r of releves.filter(r => r.typeReleve === TypeReleve.MORTALITE)) {
  if (r.bacId) {
    const list = mortalitesParBac.get(r.bacId) ?? [];
    list.push({ nombreMorts: r.nombreMorts ?? 0, date: r.date });
    mortalitesParBac.set(r.bacId, list);
  }
}
```

Ce tableau est passé à `VagueContext` (ou directement à `segmenterPeriodesAlimentaires`
via les options) pour éviter de recalculer par période.

---

## 8. Réponse aux questions posées

### Q1 : L'algorithme en 7 étapes est-il correct et complet ?

**Oui, structurellement.** Les étapes 1-7 sont correctes. L'incomplétude est dans l'étape 5
(calcul de biomasse) : `nombreVivants` est calculé sans considérer la date de la période ni
les calibrages. La correction est dans cette ADR.

### Q2 : Cause principale des FCR < 0.5

**Le `nombreVivants` surestimé post-calibrage est la cause principale.** Si un bac perd
60% de sa population lors d'un calibrage (ex. 325 → 130 poissons) mais que l'algorithme
continue d'utiliser 325, le gain de biomasse calculé est 2.5× trop élevé, donc le FCR
calculé est 2.5× trop bas.

Il ne s'agit pas d'une surestimation Gompertz — la courbe Gompertz vague donne des poids
moyens plausibles. C'est uniquement le multiplicateur `nombreVivants` qui est faux.

### Q3 : L'algorithme doit-il détecter les calibrages et s'ajuster ?

**Oui, mais le modèle `Calibrage` contient déjà tout ce qu'il faut.** Il n'y a pas de
"concept de calibrage event à ajouter" — il existe depuis Sprint 24. Il faut seulement
le lire dans les requêtes analytics, qui ne l'incluaient pas jusqu'ici.

### Q4 : `Bac.nombrePoissons` est-il fiable post-calibrage ?

**Non, et il ne doit pas être utilisé pour le FCR.** `Bac.nombrePoissons` est un champ
legacy de la Phase 1. Il peut être mis à jour manuellement lors d'un calibrage, mais
rien ne garantit sa synchronisation. La source de vérité post-calibrage est
`CalibrageGroupe.nombrePoissons` (population redistribuée lors du dernier calibrage)
+ mortalités ultérieures.

`Bac.nombreInitial` (différent de `nombrePoissons`) est la population initiale au
démarrage de la vague pour ce bac — correct au départ, périmé après tout calibrage.

### Q5 : Pourquoi supprimer GOMPERTZ_BAC plutôt que le garder en fallback ?

**GOMPERTZ_BAC est supprimé** (cf. Gap 5) pour les raisons suivantes :

1. Les calibrages sont une opération courante, pas exceptionnelle. Toute vague de Clarias
   au-delà de J20-J25 passe par au moins un calibrage. GOMPERTZ_BAC serait donc en fallback
   permanent pour la majorité des vagues — c'est du code mort fonctionnel.

2. Le cas théorique "bacs avec aliments différents sans calibrage" est trop rare pour
   justifier la complexité : modèle `GompertzBac`, route de calibration per-bac, code de
   sélection dans `interpolerPoidsBac`, option dans ConfigElevage.

3. GOMPERTZ_VAGUE avec la correction `nombreVivants` (cette ADR) produit des FCR fiables.
   L'interpolation per-vague est biologiquement correcte car le poids moyen vague représente
   la courbe de croissance réelle, indépendante des redistributions entre bacs.

**L'enum `StrategieInterpolation` passe de 3 à 2 valeurs : `LINEAIRE` et `GOMPERTZ_VAGUE`.**

---

## 9. Faux positif : la règle d'exclusion des gains négatifs

La règle dans `segmenterPeriodesAlimentaires` :

```typescript
gainBiomasseKg = rawGain > 0 ? rawGain : null;
```

Cette règle est correcte mais masque un symptôme. Avec `nombreVivants` juste :

- Les gains négatifs per-bac après calibrage disparaissent presque entièrement (la
  redistribution des poissons était la cause, pas une véritable perte de biomasse).
- Il reste des gains négatifs légitimes (maladie, stress thermique), qui doivent
  continuer à être exclus.

**Il n'est pas recommandé de changer cette règle.** La correction de `nombreVivants`
via les calibrages réduira le nombre de périodes exclues sans changer la règle.

---

## 10. Cas limites à gérer

| Situation | Traitement recommandé |
|-----------|----------------------|
| Bac créé pendant calibrage (nouveau bac) | `CalibrageGroupe.destinationBacId` = ce bacId, `nombrePoissons` = source de vérité |
| Bac source entièrement vidé lors du calibrage | Période post-calibrage sans relevés alim → pas de période à calculer |
| Calibrage sans `groupes` (calibrage simplifié ou legacy) | Fallback vers comportement actuel (nombreInitial) |
| Plusieurs calibrages sur la même période | Utiliser le dernier calibrage dont `date <= dateDebut` |
| `bac.nombreInitial = null` ET aucun calibrage | Continuer avec `round(vague.nombreInitial / nbBacs)` |
| Mortalités enregistrées sans `bacId` | Ignorer pour le calcul per-bac (global seulement) |

---

## 11. Impact sur les fichiers

### A. Calibrage-aware `nombreVivants`

| Fichier | Action | Description |
|---------|--------|-------------|
| `src/lib/feed-periods.ts` | Modifier | Ajouter `CalibragePoint`, mettre à jour `VagueContext`, remplacer `estimerNombreVivants` par `estimerNombreVivantsADate` |
| `src/lib/queries/analytics.ts` | Modifier | Inclure `calibrages + groupes` dans les requêtes Prisma, transmettre dans `VagueContext` |
| `src/types/` | Aucun | `CalibragePoint` est une interface locale de `feed-periods.ts`, pas besoin de l'exporter dans `src/types/` |
| `src/__tests__/lib/feed-periods.test.ts` | Modifier | Ajouter cas de test calibrage-aware |

### B. Suppression de GOMPERTZ_BAC

| Fichier | Action | Description |
|---------|--------|-------------|
| `prisma/schema.prisma` | Modifier | Supprimer valeur `GOMPERTZ_BAC` de l'enum `StrategieInterpolation`, supprimer modèle `GompertzBac` |
| `prisma/migrations/` | Créer | Migration RECREATE pour l'enum (rename → create → cast → drop) + DROP TABLE GompertzBac |
| `src/types/models.ts` | Modifier | Supprimer `GOMPERTZ_BAC` de l'enum `StrategieInterpolation`, supprimer interface `GompertzBac` |
| `src/types/calculs.ts` | Modifier | Supprimer `"GOMPERTZ_BAC"` de `methodeEstimation` union type |
| `src/lib/feed-periods.ts` | Modifier | Supprimer branche GOMPERTZ_BAC dans `interpolerPoidsBac`, supprimer `GompertzBacContext`, simplifier `methodeRank` |
| `src/lib/queries/analytics.ts` | Modifier | Supprimer chargement/construction de `gompertzBacs` context |
| `src/app/api/vagues/[id]/gompertz/route.ts` | Modifier | Supprimer boucle de calibration per-bac, supprimer `calibrationsBacs` de la réponse |
| `src/components/config-elevage/config-elevage-form-client.tsx` | Modifier | Supprimer option GOMPERTZ_BAC du select `interpolationStrategy` |
| `src/components/analytics/fcr-transparency-dialog.tsx` | Modifier | Supprimer badge/affichage GOMPERTZ_BAC |
| `src/__tests__/lib/feed-periods.test.ts` | Modifier | Supprimer/adapter les 20 tests ADR-030 liés à GOMPERTZ_BAC |

### Aucune migration Prisma pour le calibrage

Tous les champs nécessaires (`CalibrageGroupe.nombrePoissons`, `CalibrageGroupe.destinationBacId`,
`Calibrage.date`, `Calibrage.nombreMorts`) existent depuis Sprint 24.

### Migration Prisma pour GOMPERTZ_BAC

Une migration est nécessaire pour supprimer la valeur `GOMPERTZ_BAC` de l'enum
`StrategieInterpolation` et le modèle `GompertzBac`. Utiliser l'approche RECREATE
(rename old → create new → cast columns → drop old) conformément aux conventions du projet.

---

## 12. Cas de test requis

```typescript
// src/__tests__/lib/feed-periods.test.ts — nouveaux cas ADR-032

describe("estimerNombreVivantsADate — calibrage-aware", () => {
  it("retourne nombreInitial si aucun calibrage avant la date")
  it("utilise groupe.nombrePoissons du dernier calibrage avant la date")
  it("soustrait les mortalités post-calibrage")
  it("gère un bac nouveau (jamais mentionné comme source) apparu lors d'un calibrage")
  it("ignore les calibrages dont date > targetDate")
  it("retombe sur nombreInitial si calibrage.groupes est vide")
})

describe("segmenterPeriodesAlimentaires — avec calibrages", () => {
  it("FCR > 0.5 pour Bac ayant perdu 60% de population lors d'un calibrage")
  it("pas de FCR < 0.5 sur données synthétiques de calibrage réaliste")
  it("périodes pré-calibrage et post-calibrage utilisent des nombreVivants différents")
})
```

---

## 13. Conséquences

### Positives

- Les FCR biologiquement implausibles (< 0.5) disparaissent pour les vagues avec calibrages.
- `nombreVivants` dans `FCRTracePeriode` (ADR-031) devient une valeur fiable et auditable.
- L'éleveur peut vérifier le chiffre en le recoupant avec le `CalibrageGroupe` enregistré.
- La suppression de GOMPERTZ_BAC simplifie significativement le code : ~200 lignes de code
  en moins, un modèle DB en moins, une option de configuration en moins.
- La chaîne d'interpolation à 3 niveaux est plus facile à comprendre et à débuguer.
- ADR-030 est **supersédé** par cette ADR pour la partie GOMPERTZ_BAC.

### Contraintes

- La requête Prisma dans `computeAlimentMetrics` et `getFCRTrace` inclut désormais `calibrages`.
  C'est un join supplémentaire mais léger (≤ 10 calibrages par vague en pratique).
- Si `Calibrage.groupes` est vide ou mal rempli (cas de données legacy ou calibrages
  simplifiés), le comportement dégradé actuel est conservé. La correction est non-destructive.
- Les ConfigElevage existantes avec `interpolationStrategy = GOMPERTZ_BAC` seront migrées
  vers `GOMPERTZ_VAGUE` par la migration SQL (CAST avec mapping).

---

## Plan d'implémentation

### Phase A — Suppression de GOMPERTZ_BAC (faire en premier)

| Étape | Agent | Action |
|-------|-------|--------|
| 1 | @architect | Ce document (ADR-032) — FAIT |
| 2 | @db-specialist | Migration RECREATE : supprimer `GOMPERTZ_BAC` de l'enum, DROP TABLE `GompertzBac` |
| 3 | @developer | Supprimer GOMPERTZ_BAC de `src/types/models.ts`, `src/types/calculs.ts` |
| 4 | @developer | Supprimer branche GOMPERTZ_BAC + `GompertzBacContext` dans `src/lib/feed-periods.ts` |
| 5 | @developer | Supprimer chargement `gompertzBacs` dans `src/lib/queries/analytics.ts` |
| 6 | @developer | Supprimer calibration per-bac dans `src/app/api/vagues/[id]/gompertz/route.ts` |
| 7 | @developer | Supprimer option GOMPERTZ_BAC dans `config-elevage-form-client.tsx` et badge dans `fcr-transparency-dialog.tsx` |
| 8 | @tester | Adapter tests : supprimer/modifier les 20 tests ADR-030 liés à GOMPERTZ_BAC |

### Phase B — Calibrage-aware `nombreVivants`

| Étape | Agent | Action |
|-------|-------|--------|
| 9 | @developer | Ajouter `CalibragePoint` + mettre à jour `VagueContext` dans `src/lib/feed-periods.ts` |
| 10 | @developer | Implémenter `estimerNombreVivantsADate` en remplacement de `estimerNombreVivants` |
| 11 | @developer | Mettre à jour `segmenterPeriodesAlimentaires` pour passer `dateDebut` à `estimerNombreVivantsADate` |
| 12 | @developer | Modifier `computeAlimentMetrics` et `getFCRTrace` dans `analytics.ts` : inclure calibrages dans Prisma query + VagueContext |
| 13 | @tester | Ajouter cas de test ADR-032 dans `src/__tests__/lib/feed-periods.test.ts` |
| 14 | @tester | Vérifier `npx vitest run` + `npm run build` |
