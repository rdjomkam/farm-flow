# ADR-033 — FCR calculé au niveau vague : suppression du calcul per-bac

**Statut :** Accepté
**Date :** 2026-04-05
**Auteur :** @architect
**Supersède :** ADR-028 (segmentation per-bac), ADR-032-fix (correction Gompertz per-bac)
**Dépend de :** ADR-029 (Gompertz VAGUE), ADR-032 (calibrage-aware nombreVivants)

---

## Résumé exécutif

Les ADR-028, 030, 031, 032 et le diagnostic ADR-032-fix ont tous convergé vers le même
constat : **le calcul FCR per-bac est structurellement incorrect** pour les élevages de
Clarias qui pratiquent le calibrage (redistribution des poissons entre bacs). Trois problèmes
distincts ont été identifiés, chacun nécessitant un patch spécifique per-bac. La solution
correcte est d'abandonner la granularité bac et de calculer le FCR au niveau vague.

Cette ADR supprime `segmenterPeriodesAlimentaires` per-bac et introduit
`segmenterPeriodesAlimentairesVague` qui opère entièrement à l'échelle de la vague.

---

## 1. Problèmes accumulés dans l'approche per-bac

### Problème 1 — Bacs post-calibrage sans biométries (ADR-032-fix)

Quand un nouveau bac est créé lors d'un calibrage (ex. Bac 03 et Bac 04 créés au jour J25),
il n'a aucun relevé biométrique sous son `bacId`. La fonction `interpolerPoidsBac` retourne
immédiatement `VALEUR_INITIALE` sans évaluer Gompertz. Résultat : gain = 0 pour ces bacs,
leur aliment est compté dans le numérateur mais pas leur gain dans le dénominateur.

**Effet observé :** FCR = 1.92 pour Skretting 3mm sur Vague 01-26 (attendu : ~1.2).

### Problème 2 — nombreVivants périmé post-calibrage (ADR-032)

Avant le patch ADR-032, `estimerNombreVivants` utilisait `bac.nombreInitial` ou une
répartition uniforme, sans tenir compte des opérations de calibrage. Un bac passé de 650 à
130 poissons lors d'un calibrage voyait son gain surestimé d'un facteur 5× → FCR < 0.5.

### Problème 3 — Biométries per-bac discontinues après calibrage

Lors d'un calibrage, les gros poissons d'un bac sont redistribués vers d'autres bacs. La
biométrie post-calibrage du bac source reflète les plus petits poissons restants — une chute
de poids moyen qui n'est pas de la croissance négative. L'interpolation Gompertz per-bac ne
peut pas modéliser ce phénomène.

### Constat architectural

Chaque calibrage invalide les hypothèses du calcul per-bac. Les calibrages sont une opération
courante dans l'élevage de Clarias (toute vague au-delà de J20-J25 en effectue au moins un).
Le calcul per-bac n'est pas le bon niveau d'abstraction.

**En revanche, le poids moyen au niveau vague est une grandeur stable.** Il représente la
croissance réelle du lot, indépendamment de comment les poissons sont répartis entre bacs. Les
biométries vague (poids moyen de tous les bacs pesés ensemble) sont la seule mesure qui reste
cohérente avant et après un calibrage.

---

## 2. Décision

**Supprimer `segmenterPeriodesAlimentaires` (per-bac) et le remplacer par
`segmenterPeriodesAlimentairesVague` qui opère au niveau vague.**

L'algorithme validé manuellement avec les données réelles de Vague 01-26 :

```
1. Identifier tous les relevés ALIMENTATION pour un produit donné dans la vague entière
2. Grouper par périodes contiguës (une période = suite de jours où ce produit est distribué,
   tous bacs confondus)
3. Pour chaque période, estimer le poids moyen vague aux bornes via Gompertz VAGUE
4. Calculer le nombre de vivants de la vague entière à chaque borne
5. Calculer la biomasse : biomasseKg = poidsMoyenG × nombreVivants / 1000
6. Calculer le gain : gainKg = biomasseFin - biomasseDebut
7. Sommer l'aliment distribué sur TOUS les bacs pendant la période
8. FCR = Σ aliment / Σ gain (uniquement périodes avec gain positif)
```

Il n'y a aucune segmentation par bac. L'aliment de tous les bacs est agrégé par période. Le
poids moyen est estimé à l'échelle vague. La population est la population totale de la vague.

---

## 3. Nouvelles définitions TypeScript

### 3.1 `PeriodeAlimentaireVague` (remplace `PeriodeAlimentaire`)

```typescript
/**
 * Periode alimentaire au niveau vague.
 *
 * Produite par segmenterPeriodesAlimentairesVague() dans src/lib/feed-periods.ts.
 * Remplace PeriodeAlimentaire (per-bac) pour le calcul FCR.
 *
 * Une période = une plage de dates contiguës où un produit donné a été distribué
 * dans la vague, tous bacs confondus.
 */
export interface PeriodeAlimentaireVague {
  /** Produit distribué pendant cette période */
  produitId: string;

  /** Premier relevé ALIMENTATION de la période (inclusif) */
  dateDebut: Date;

  /** Dernier relevé ALIMENTATION de la période (inclusif) */
  dateFin: Date;

  /** Nombre de jours couverts (dateFin - dateDebut + 1) */
  dureeJours: number;

  /** Total aliment distribué en kg — somme sur TOUS les bacs */
  quantiteKg: number;

  /** Poids moyen vague estimé au début de la période en grammes */
  poidsMoyenDebut: number | null;

  /** Poids moyen vague estimé à la fin de la période en grammes */
  poidsMoyenFin: number | null;

  /** Nombre de poissons vivants dans la vague au début de la période */
  nombreVivants: number | null;

  /** Biomasse au début de la période : poidsMoyenDebut × nombreVivants / 1000 */
  biomasseDebutKg: number | null;

  /** Biomasse à la fin de la période : poidsMoyenFin × nombreVivants / 1000 */
  biomasseFinKg: number | null;

  /**
   * Gain de biomasse = biomasseFinKg - biomasseDebutKg.
   * Null si poids indisponibles ou si gain brut est négatif (exclu).
   */
  gainBiomasseKg: number | null;

  /** true si le gain brut calculé était négatif — exclu du FCR */
  gainNegatifExclu: boolean;

  /** Méthode utilisée pour estimer les poids aux bornes */
  methodeEstimation: "BIOMETRIE_EXACTE" | "GOMPERTZ_VAGUE" | "INTERPOLATION_LINEAIRE" | "VALEUR_INITIALE";

  /** Détail d'estimation au début (pour le dialog de transparence) */
  detailEstimationDebut: FCRTraceEstimationDetail | null;

  /** Détail d'estimation à la fin (pour le dialog de transparence) */
  detailEstimationFin: FCRTraceEstimationDetail | null;

  /** FCR de la période = quantiteKg / gainBiomasseKg (null si gain indisponible) */
  fcrPeriode: number | null;
}
```

### 3.2 `interpolerPoidsVague` (remplace `interpolerPoidsBac`)

```typescript
/**
 * Estime le poids moyen de la vague à une date donnée.
 *
 * Stratégie (par priorité décroissante) :
 *   1. Biométrie exacte ce jour-là → BIOMETRIE_EXACTE
 *   2. Gompertz VAGUE si contexte valide → GOMPERTZ_VAGUE
 *   3. Interpolation linéaire entre les deux biométries encadrantes → INTERPOLATION_LINEAIRE
 *   4. Poids initial de la vague → VALEUR_INITIALE
 *
 * Contrairement à interpolerPoidsBac, cette fonction :
 *   - Ne filtre pas par bacId — elle utilise TOUTES les biométries de la vague
 *   - Applique Gompertz même si aucune biométrie n'existe (important pour les
 *     périodes entières sans relevé biométrique)
 *
 * @param targetDate     - date pour laquelle estimer le poids
 * @param biometries     - relevés biométriques de la vague triés ASC (bacId ignoré)
 * @param poidsInitial   - poids moyen initial de la vague (fallback)
 * @param options        - stratégie d'interpolation et contexte Gompertz
 */
export function interpolerPoidsVague(
  targetDate: Date,
  biometries: BiometriePoint[],
  poidsInitial: number,
  options?: {
    strategie?: StrategieInterpolation;
    gompertzContext?: GompertzVagueContext;
    gompertzMinPoints?: number;
  }
): { poids: number; methode: PeriodeAlimentaireVague["methodeEstimation"]; detail: FCRTraceEstimationDetail }
```

### 3.3 `estimerNombreVivantsVague` (niveau vague, remplace per-bac)

```typescript
/**
 * Estime le nombre total de poissons vivants dans la VAGUE ENTIÈRE à une date donnée.
 *
 * Algorithme :
 *   1. Partir de vagueContext.nombreInitial
 *   2. Soustraire toutes les mortalités de la vague avant targetDate
 *      (relevés MORTALITE toutes sources confondues)
 *   3. Soustraire les nombreMorts des calibrages avant targetDate
 *
 * Note : les opérations de calibrage (redistribution entre bacs) ne modifient
 * PAS le nombre total de vivants dans la vague — elles ne font que déplacer
 * des poissons d'un bac à un autre. Seules les mortalités et les nombreMorts
 * des calibrages réduisent la population totale.
 *
 * @param targetDate         - date cible
 * @param vagueContext       - contexte vague (nombreInitial, calibrages)
 * @param mortalitesTotales  - liste des relevés MORTALITE de la vague
 */
export function estimerNombreVivantsVague(
  targetDate: Date,
  vagueContext: VagueContext,
  mortalitesTotales: Array<{ nombreMorts: number; date: Date }>
): number
```

### 3.4 `segmenterPeriodesAlimentairesVague` (nouvelle fonction principale)

```typescript
/**
 * Segmente les relevés d'alimentation d'une vague en périodes cohérentes
 * au niveau vague (tous bacs confondus), pour un produit donné.
 *
 * Algorithme :
 *   1. Prendre tous les relevés ALIMENTATION de la vague pour ce produit
 *   2. Trier par date ASC
 *   3. Grouper en plages de dates contiguës (gap > maxGapJours = nouvelle période)
 *   4. Pour chaque période :
 *      a. Calculer la quantité totale d'aliment (tous bacs)
 *      b. Estimer poidsMoyenDebut via interpolerPoidsVague(dateDebut)
 *      c. Estimer poidsMoyenFin via interpolerPoidsVague(dateFin)
 *      d. Calculer nombreVivants via estimerNombreVivantsVague(dateDebut)
 *      e. Calculer biomasse début et fin
 *      f. Gain = biomasseFin - biomasseDebut
 *      g. Si gain <= 0 : gainBiomasseKg = null, gainNegatifExclu = true
 *
 * @param relevsAlim     - relevés ALIMENTATION de la vague pour CE produit
 * @param biometries     - relevés biométriques de la vague (bacId ignoré)
 * @param vagueContext   - contexte vague (nombreInitial, poidsMoyenInitial, calibrages)
 * @param mortalites     - tous les relevés MORTALITE de la vague
 * @param options        - stratégie interpolation + contexte Gompertz
 * @param maxGapJours    - nombre de jours max entre deux relevés pour rester dans la même
 *                         période (défaut : 3 jours)
 * @returns array de PeriodeAlimentaireVague
 */
export function segmenterPeriodesAlimentairesVague(
  relevsAlim: ReleveAlimPoint[],
  biometries: BiometriePoint[],
  vagueContext: VagueContext,
  mortalites: Array<{ nombreMorts: number; date: Date }>,
  options?: {
    strategie?: StrategieInterpolation;
    gompertzContext?: GompertzVagueContext;
    gompertzMinPoints?: number;
  },
  maxGapJours?: number
): PeriodeAlimentaireVague[]
```

### 3.5 Mise à jour de `FCRTracePeriode` et `FCRTraceVague`

`FCRTracePeriode` perd le champ `bacId` et `bacNom` (plus de granularité bac) :

```typescript
export interface FCRTracePeriode {
  // SUPPRIMÉ : bacId, bacNom

  dateDebut: Date;
  dateFin: Date;
  dureeJours: number;
  quantiteKg: number;

  poidsMoyenDebut: number | null;
  methodeDebut: MethodeEstimationPoids;
  detailEstimationDebut: FCRTraceEstimationDetail | null;

  poidsMoyenFin: number | null;
  methodeFin: MethodeEstimationPoids;
  detailEstimationFin: FCRTraceEstimationDetail | null;

  methodeRetenue: MethodeEstimationPoids;

  nombreVivants: number | null;
  biomasseDebutKg: number | null;
  biomasseFinKg: number | null;
  gainBiomasseKg: number | null;
  gainNegatifExclu: boolean;

  fcrPeriode: number | null;
}
```

`FCRTraceVague` supprime `modeLegacy` (plus de distinction bac/legacy) et ajoute
les paramètres Gompertz en tête pour l'affichage :

```typescript
export interface FCRTraceVague {
  vagueId: string;
  vagueCode: string;
  dateDebut: Date;
  dateFin: Date | null;
  nombreInitial: number;
  poidsMoyenInitial: number;
  nombreVivantsEstime: number | null;

  quantiteKg: number;
  gainBiomasseKg: number | null;
  fcrVague: number | null;

  /** Paramètres Gompertz si modèle calibré et stratégie GOMPERTZ_VAGUE active */
  gompertzVague: FCRTraceGompertzParams | null;

  /** Périodes alimentaires pour ce produit dans cette vague (niveau vague, pas per-bac) */
  periodes: FCRTracePeriode[];

  // SUPPRIMÉ : modeLegacy
}
```

---

## 4. Nouvelle interface `VagueContext`

```typescript
export interface VagueContext {
  dateDebut: Date;
  nombreInitial: number;
  poidsMoyenInitial: number; // grammes
  /**
   * Pour le calcul per-vague, bacs n'est plus nécessaire pour la segmentation.
   * Conservé pour compatibilité avec l'appelant estimerNombreVivantsADate (legacy).
   */
  bacs: { id: string; nombreInitial: number | null }[];
  /** Calibrages de la vague, triés par date ASC. */
  calibrages?: CalibragePoint[];
}
```

---

## 5. Règles de segmentation des périodes

### Critère de contiguïté

Deux relevés ALIMENTATION appartiennent à la même période si :

```
date[i+1] - date[i] <= maxGapJours (défaut : 3 jours)
```

Un écart de plus de 3 jours crée une nouvelle période. Cela permet de gérer les
week-ends sans alimentation (jours 0 d'aliment) sans fragmenter artificiellement
les périodes.

### Changement de produit

Si un relevé change de produit principal (produit avec la plus grande quantiteKg),
une nouvelle période commence pour le nouveau produit. La même date peut donc
marquer la fin d'une période pour le produit A et le début d'une période pour B.

### Aliment mixte (plusieurs produits le même jour)

Si un relevé contient des consommations pour plusieurs produits, chaque produit
est traité indépendamment dans sa propre famille de périodes. Le `quantiteKg`
d'une période inclut uniquement les quantités du produit de cette période.

### Gain négatif

Un gain brut <= 0 est acceptable biologiquement dans des cas de stress ou de
maladie. La règle est conservée : `gainBiomasseKg = null` si gain <= 0, et
`gainNegatifExclu = true`. La période contribue 0 au dénominateur FCR mais
son aliment n'est pas non plus compté dans le numérateur (cohérence stricte :
seules les paires aliment/gain valides contribuent au FCR).

---

## 6. Calcul de `nombreVivants` au niveau vague

```
nombreVivantsVague(targetDate) =
  vagueContext.nombreInitial
  - Σ mortalites.nombreMorts  [pour tous les relevés MORTALITE dont date <= targetDate]
  - Σ calibrage.nombreMorts   [pour tous les calibrages dont date <= targetDate]
```

Les redistributions de calibrage (poissons déplacés entre bacs) ne changent pas la
population totale de la vague. Seules les `mortalites` explicites et les
`calibrage.nombreMorts` sont soustraites.

**Cas limites :**

| Situation | Traitement |
|-----------|-----------|
| Aucune mortalité enregistrée | nombreVivants = nombreInitial |
| Calibrage sans nombreMorts | Pas de soustraction pour ce calibrage |
| nombreVivants calculé < 0 | Clamp à 0 |
| Mortalités sans date | Ignorer |

---

## 7. Algorithme de calcul du poids moyen vague

`interpolerPoidsVague` utilise les biométries de la vague entière (toutes entrées
confondues, bacId ignoré). La biométrie peut être saisie per-bac dans les relevés,
mais pour le calcul FCR vague, la valeur utilisée est le `poidsMoyen` du relevé tel
qu'enregistré — qu'il soit per-bac ou global.

Si plusieurs biométries existent le même jour (ex. un relevé per-bac), la fonction
utilise la **médiane** des poids moyens de ce jour comme valeur représentative.

Chaîne de priorité (inchangée depuis ADR-029) :

```
BIOMETRIE_EXACTE → GOMPERTZ_VAGUE → INTERPOLATION_LINEAIRE → VALEUR_INITIALE
```

La différence clé avec `interpolerPoidsBac` :
- Pas de filtre sur `bacId`
- Gompertz est évalué même si `biometries.length === 0` (Gompertz est une fonction
  de temps, pas de données observées)

---

## 8. Dialog FCR Transparency — nouvelle structure narrative

Le dialog doit afficher le calcul dans l'ordre où il est réalisé algorithmiquement,
sans exposer les bacs individuels. Structure recommandée :

### Niveau 1 — Résumé global (toujours visible)

```
[Aliment : Skretting 3mm]
Stratégie : Gompertz VAGUE
FCR final : 1.21
```

### Niveau 2 — Paramètres Gompertz (si stratégie GOMPERTZ_VAGUE)

```
Modèle de croissance Gompertz calibré
W∞ = 1500 g   K = 0.0488 j⁻¹   ti = 45.68 j
R² = 0.9909   (12 biométries)
W(t) = 1500 × exp(−exp(−0.0488 × (t − 45.68)))
```

### Niveau 3 — Périodes alimentaires (une rangée par période, pas par bac)

```
Période 1 : 21/03 → 04/04  (14 jours)
  Aliment : 174.2 kg
  Poids début : W(21) = 120 g  [GOMPERTZ_VAGUE]
  Poids fin   : W(35) = 400 g  [GOMPERTZ_VAGUE]
  Vivants     : 520
  Biomasse début : 120 × 520 / 1000 = 62.4 kg
  Biomasse fin   : 400 × 520 / 1000 = 208.0 kg
  Gain : +145.6 kg
  FCR période : 174.2 / 145.6 = 1.196
```

### Niveau 4 — Agrégation finale (toujours visible)

```
Σ aliment = 174.2 kg
Σ gain    = 145.6 kg
FCR final = 174.2 / 145.6 = 1.196 ≈ 1.21
```

**Supprimé :** les `PeriodeRow` per-bac, le badge `modeLegacy`, le label `periodesDuBac`.

---

## 9. Fichiers à modifier

### A — `src/lib/feed-periods.ts`

| Action | Description |
|--------|-------------|
| Supprimer | `estimerNombreVivantsADate` (per-bac) |
| Ajouter | `estimerNombreVivantsVague(targetDate, vagueContext, mortalites)` |
| Remplacer | `interpolerPoidsBac` → `interpolerPoidsVague(targetDate, biometries, poidsInitial, options)` |
| Ajouter | `segmenterPeriodesAlimentairesVague(...)` |
| Supprimer | `segmenterPeriodesAlimentaires` (per-bac) |
| Conserver | `CalibragePoint`, `VagueContext`, `GompertzVagueContext`, `ReleveAlimPoint`, `BiometriePoint` |

### B — `src/types/calculs.ts`

| Action | Description |
|--------|-------------|
| Remplacer | `PeriodeAlimentaire` → `PeriodeAlimentaireVague` |
| Modifier | `FCRTracePeriode` : supprimer `bacId`, `bacNom` |
| Modifier | `FCRTraceVague` : supprimer `modeLegacy` |

### C — `src/lib/queries/analytics.ts`

| Action | Description |
|--------|-------------|
| Modifier | `computeAlimentMetrics` : utiliser `segmenterPeriodesAlimentairesVague` au lieu de `segmenterPeriodesAlimentaires` |
| Modifier | `getFCRTrace` : même changement + supprimer map par bacId dans la construction des `FCRTracePeriode` |
| Simplifier | La map `bacByReleve` et la construction `mortalitesParBac` ne sont plus nécessaires |
| Ajouter | Pré-calcul `mortalitesTotales` (tableau plat, pas de map par bac) |

### D — `src/components/analytics/fcr-transparency-dialog.tsx`

| Action | Description |
|--------|-------------|
| Supprimer | `PeriodeRow` (affichage per-bac) |
| Modifier | `VagueSection` : afficher les périodes vague avec structure narrative |
| Ajouter | `GompertzParamsBlock` : affichage des paramètres Gompertz en tête de vague |
| Modifier | Labels : `periodesDuBac` → `periodes`, supprimer badge `modeLegacy` |
| Modifier | `PeriodeVagueRow` : nouvelle structure sans champ bac, avec biomasse début/fin |

---

## 10. Types TypeScript mis à jour — vue d'ensemble

```typescript
// src/types/calculs.ts — champs modifiés

// PeriodeAlimentaire (ancienne) → PeriodeAlimentaireVague (nouvelle)
// Champs supprimés : bacId
// Champs ajoutés  : biomasseDebutKg, biomasseFinKg, gainNegatifExclu,
//                   detailEstimationDebut, detailEstimationFin, fcrPeriode, dureeJours

// FCRTracePeriode
// Champs supprimés : bacId, bacNom
// Champs inchangés : dateDebut, dateFin, dureeJours, quantiteKg, poidsMoyenDebut,
//                    methodeDebut, detailEstimationDebut, poidsMoyenFin, methodeFin,
//                    detailEstimationFin, methodeRetenue, nombreVivants, biomasseDebutKg,
//                    biomasseFinKg, gainBiomasseKg, gainNegatifExclu, fcrPeriode

// FCRTraceVague
// Champs supprimés : modeLegacy
// Champs inchangés : tous les autres
```

---

## 11. Compatibilité ascendante

### `PeriodeAlimentaire` (ancienne interface)

L'ancienne interface `PeriodeAlimentaire` est utilisée dans :
- `src/lib/feed-periods.ts` (produite)
- `src/lib/queries/analytics.ts` (consommée)
- `src/types/calculs.ts` (définie)

Elle peut être supprimée une fois que `segmenterPeriodesAlimentaires` (per-bac) est
supprimée. Aucune UI ne consomme directement `PeriodeAlimentaire` — elle est interne
à la chaîne analytics.

### Tests existants

Les tests dans `src/__tests__/lib/feed-periods.test.ts` couvrent
`segmenterPeriodesAlimentaires` per-bac. Ces tests doivent être réécrits pour
`segmenterPeriodesAlimentairesVague`. Les cas de test ADR-032 (calibrage-aware
per-bac) sont remplacés par des cas vague-level équivalents.

---

## 12. Cas de test requis

```typescript
// src/__tests__/lib/feed-periods.test.ts — cas ADR-033

describe("interpolerPoidsVague", () => {
  it("retourne BIOMETRIE_EXACTE si une biométrie existe ce jour")
  it("retourne GOMPERTZ_VAGUE si contexte valide et pas de biométrie exacte")
  it("évalue Gompertz même si aucune biométrie dans le tableau")
  it("retourne INTERPOLATION_LINEAIRE entre deux biométries")
  it("retourne VALEUR_INITIALE si aucune donnée et pas de Gompertz")
  it("utilise la médiane si plusieurs biométries le même jour")
})

describe("estimerNombreVivantsVague", () => {
  it("retourne nombreInitial si aucune mortalité")
  it("soustrait les mortalités enregistrées avant targetDate")
  it("ignore les mortalités après targetDate")
  it("soustrait calibrage.nombreMorts")
  it("clamp à 0 si résultat négatif")
  it("n'est pas affecté par les redistributions de calibrage (pas de soustraction)")
})

describe("segmenterPeriodesAlimentairesVague", () => {
  it("crée une seule période pour un produit distribué en continu")
  it("crée deux périodes séparées si gap > maxGapJours")
  it("somme l'aliment de tous les bacs dans la même période")
  it("utilise Gompertz pour les poids aux bornes")
  it("FCR correct sur données synthétiques Vague 01-26 (4 bacs, 2 post-calibrage)")
  it("gainNegatifExclu = true si biomasseFin < biomasseDebut")
  it("plusieurs produits indépendants dans la même vague")
  it("FCR final dans l'intervalle [0.8, 1.5] pour données réalistes Clarias")
})
```

---

## 13. Analyse de l'impact sur le FCR 1.92 → attendu ~1.2

Avec l'algorithme vague-level et Gompertz actif (W∞=1500, K=0.0488, ti=45.68, R²=0.9909)
pour Vague 01-26, Skretting 3mm :

```
Période : J21 → J35 (14 jours)
  poidsMoyenDebut = W(21) ≈ 120 g  [GOMPERTZ_VAGUE — pas de filtre bacId]
  poidsMoyenFin   = W(35) ≈ 400 g  [GOMPERTZ_VAGUE]
  nombreVivants   = 650 − mortalités − calibrage.nombreMorts ≈ 520
  biomasseDebut   = 120 × 520 / 1000 = 62.4 kg
  biomasseFin     = 400 × 520 / 1000 = 208.0 kg
  gain            = 208.0 − 62.4 = 145.6 kg

  Si aliment total = 174 kg → FCR = 174 / 145.6 ≈ 1.19
```

Le FCR 1.92 était dû à :
1. Bacs 03/04 (post-calibrage) → VALEUR_INITIALE → gain = 0 → aliment compté, gain non
2. Extrapolation linéaire bloquée sur dernier poids connu pour Bacs 01/02 post J20

Avec l'algorithme vague-level, ces deux sources d'erreur disparaissent structurellement.

---

## 14. Conséquences

### Positives

- FCR biologiquement plausibles pour toutes les vagues avec calibrages
- Algorithme plus simple : une boucle sur les périodes vague, pas une boucle sur les bacs
- Dialog de transparence plus lisible : 4 à 6 rangées par vague au lieu de N_bacs × N_périodes
- Gompertz utilisé systématiquement (même sans biométries) — valeur R² toujours contextualisée
- Suppression de code mort : map `mortalitesParBac`, fonction `estimerNombreVivantsADate`
- Résultat reproductible manuellement par l'éleveur (calcul en 4 lignes)

### Contraintes

- `PeriodeAlimentaire` (ancienne) est supprimée — tests à réécrire
- Le FCR per-bac n'est plus calculé ni affiché — cette information est définitivement
  abandonnée (conformément au commentaire dans `IndicateursBac` : "FCR tracked at vague level")
- `FCRTracePeriode.bacId` est supprimé — si une UI externe lisait ce champ, elle doit
  être mise à jour (aucun consommateur externe identifié)

---

## 15. Plan d'implémentation

| Étape | Agent | Fichier | Action |
|-------|-------|---------|--------|
| 1 | @architect | `docs/decisions/ADR-033-fcr-vague-level.md` | Ce document — FAIT |
| 2 | @developer | `src/types/calculs.ts` | Ajouter `PeriodeAlimentaireVague`, mettre à jour `FCRTracePeriode` et `FCRTraceVague` |
| 3 | @developer | `src/lib/feed-periods.ts` | Ajouter `interpolerPoidsVague`, `estimerNombreVivantsVague`, `segmenterPeriodesAlimentairesVague` |
| 4 | @developer | `src/lib/feed-periods.ts` | Supprimer `segmenterPeriodesAlimentaires`, `interpolerPoidsBac`, `estimerNombreVivantsADate` |
| 5 | @developer | `src/lib/queries/analytics.ts` | `computeAlimentMetrics` : utiliser `segmenterPeriodesAlimentairesVague` |
| 6 | @developer | `src/lib/queries/analytics.ts` | `getFCRTrace` : construire `FCRTracePeriode[]` sans bac |
| 7 | @developer | `src/components/analytics/fcr-transparency-dialog.tsx` | Restructurer : GompertzParamsBlock + PeriodeVagueRow sans champ bac |
| 8 | @tester | `src/__tests__/lib/feed-periods.test.ts` | Réécrire tous les tests ADR-028/030/032 → ADR-033 |
| 9 | @tester | — | `npx vitest run` + `npm run build` |
