# FCR by Feed — Calculation Algorithm

## Overview

This algorithm calculates the **Feed Conversion Ratio (FCR)** for a specific feed product across all vagues (batches) in a site. It combines feed consumption records, Gompertz growth modeling, and fish population tracking to produce per-period and per-vague FCR values.

**FCR = Total Feed Consumed (kg) / Total Biomass Gain (kg)**

---

## Inputs

| Parameter | Description | Example |
|-----------|-------------|---------|
| `siteId` | The site to analyze | `site_dkfarm_01` |
| `produitId` | The feed product to analyze | Aliment Skretting 3mm (Priso) |
| `minPoints` | Minimum biometric points for Gompertz calibration | 3 |
| `wInfinity` | Gompertz asymptotic weight W∞ (g) | 1500 |

---

## Algorithm Steps

### Step 1 — Identify Target Vagues

Query all vagues in the site that have at least one `ReleveConsommation` record for the specified `produitId`.

```sql
SELECT DISTINCT v.id, v.code, v.dateDebut, v.nombreInitial
FROM Vague v
JOIN Releve r ON r.vagueId = v.id
JOIN ReleveConsommation rc ON rc.releveId = r.id
WHERE v.siteId = :siteId
  AND rc.produitId = :produitId
```

### Step 2 — For Each Vague: Collect Biometric Data

Retrieve all biometric relevés (`typeReleve = 'BIOMETRIE'`) for the vague. Average the `poidsMoyen` across all tanks per day to get vague-level data points.

```
points = [
  { jour: days_since_dateDebut, poidsMoyen: avg_weight_across_tanks }
]
```

**Requirement**: At least `minPoints` biometric data points are needed. If fewer exist, the vague is skipped or flagged as `INSUFFICIENT_DATA`.

### Step 3 — Gompertz Calibration

Fit the Gompertz growth model to the biometric data points:

**W(t) = W∞ × exp(−exp(−K × (t − ti)))**

Parameters:
- **W∞** = asymptotic weight (g) — provided as input (e.g., 1500g)
- **K** = growth rate constant (day⁻¹) — fitted by Levenberg-Marquardt
- **ti** = inflection point (days) — fitted by Levenberg-Marquardt

The calibration uses W∞ as both the initial guess and the upper bound ceiling, ensuring the solver respects the farm's biological maximum.

Output: fitted parameters `{ wInfinity, k, ti }` + R² + RMSE + confidence level.

### Step 4 — Generate Daily Weight & Gain Table

Using the fitted Gompertz parameters, calculate predicted weight and daily gain for every day from the first to the last day of feed consumption:

```
For each day t from min_consumption_day to max_consumption_day:
  weight(t) = W∞ × exp(−exp(−K × (t − ti)))
  dailyGain(t) = weight(t) − weight(t − 1)
```

### Step 5 — Identify Feed Consumption Periods per Tank

**Important**: Do NOT start from the tanks currently assigned to the vague (`Bac.vagueId`). A tank may have been unassigned after a calibrage (e.g., fish transferred to another tank), but its consumption data before the calibrage still belongs to this vague. Instead, start from the `ReleveConsommation` records to discover which tanks consumed the target feed.

1. **Query all consumption records** for the target feed in this vague: join `ReleveConsommation` → `Releve` (filtered by `vagueId` and `produitId`) → `Bac` (via `Releve.bacId`). This returns all tanks that ever consumed the feed, including tanks no longer assigned to the vague.
2. **For each discovered tank**, find all days where the target feed was consumed.
3. **Classify each day** as:
   - **Only-target-feed day**: no other feed product was consumed that day in that tank.
   - **Mixed-feed day**: other feed products were also consumed that day.
4. **Group consecutive only-target-feed days** into periods using gap detection (a gap of ≥1 day with no consumption or with mixed-only consumption breaks a period).
5. **Attach mixed-feed days** to the nearest adjacent period. Mixed-feed days represent nutrition errors (e.g., wrong grammage given alongside the target feed) and their consumption is attributed to the target feed's FCR.

**Result per tank**: a list of periods `{ debut, fin, qty_target_feed_kg }` where the total `qty_target_feed_kg` includes both only-target and mixed days.

**Verification**: the sum of `qty_target_feed_kg` across all periods for a tank must equal the total consumption of the target feed in that tank.

**Example**: Vague 26-01 currently has Bac 01, 02, 04 assigned. But Bac 03 consumed Skretting 3mm from March 22–25 before being emptied on March 26 (fish transferred to Bac 04). Starting from `ReleveConsommation` correctly includes Bac 03's 18 kg of consumption.

### Step 6 — Estimate Fish Count per Tank per Period

Fish count is needed to convert per-fish weight gain (g) into biomass gain (kg).

**Method — Anchor + Mortality Adjustment**:

1. **Anchor**: Use the most recent `COMPTAGE` relevé (counting) as the reference fish count for each tank.
2. **Adjust forward**: Subtract cumulative mortality (`MORTALITE` relevés) after the counting date.
3. **Adjust backward**: Add back cumulative mortality before the counting date.
4. **Average**: Use the average fish count over the period (start count + end count) / 2.

**Special cases**:
- **Tank emptied** (count = 0): Fish were transferred to another tank. Reconstruct the pre-transfer count from: transferred count (destination tank) + cumulative mortality.
- **No counting data**: Fall back to proportional distribution of `vague.nombreInitial` across tanks, minus cumulative mortality.

### Step 7 — Calculate FCR per Period

For each period in each tank:

```
weight_gain_per_fish = sum of dailyGain(t) for each day t in the period
biomass_gain_kg = weight_gain_per_fish × avg_fish_count / 1000
FCR = qty_target_feed_kg / biomass_gain_kg
```

### Step 8 — Aggregate FCR per Vague

```
total_feed_kg = sum of qty_target_feed_kg across all periods and tanks
total_biomass_gain_kg = sum of biomass_gain_kg across all periods and tanks
FCR_vague = total_feed_kg / total_biomass_gain_kg
```

---

## Output Table

| Vague | Bac | Period | Days | Qty Feed (kg) | Gain/fish (g) | Avg Fish | Biomass Gain (kg) | FCR |
|-------|-----|--------|------|---------------|--------------|----------|------------------|-----|
| 26-01 | Bac 01 | 21-22 mars | 2 | 3.30 | 6.95 | 2 304 | 16.01 | 0.21 |
| ... | ... | ... | ... | ... | ... | ... | ... | ... |
| **26-01** | **Total** | | | **203.48** | | | **309.51** | **0.66** |

---

## Edge Cases & Flags

| Situation | Handling |
|-----------|----------|
| < `minPoints` biometric data | Skip vague, flag `INSUFFICIENT_DATA` |
| Gompertz R² < 0.85 | Flag `LOW_CONFIDENCE` — FCR may be unreliable |
| Tank with abnormally high FCR (> 3.0) | Flag for review — possible data entry error or very few fish |
| No counting data available | Use proportional distribution + mortality |
| Mixed-feed days | Fold into adjacent only-target-feed period |
| Feed consumed before first biometric point | Extrapolate Gompertz backward (model is valid from t=0) |

---

## Reference Values — Clarias gariepinus

| Metric | Expected Range | Source |
|--------|---------------|--------|
| FCR (grow-out, commercial feed) | 0.8 – 1.5 | FAO / Literature |
| FCR (fingerling stage, < 100g) | 0.5 – 1.0 | Early growth phase |
| Gompertz W∞ (pond culture, Cameroon) | 1200 – 1500g | ADR + local data |
| Gompertz K (typical) | 0.015 – 0.025 day⁻¹ | ADR |

---

# Algorithme de calcul du FCR par aliment

## Vue d'ensemble

Cet algorithme calcule le **taux de conversion alimentaire (FCR)** pour un aliment spécifique dans toutes les vagues d'un site. Il combine les données de consommation, la modélisation de croissance Gompertz et le suivi de population pour produire des valeurs de FCR par période et par vague.

**FCR = Aliment total consommé (kg) / Gain de biomasse total (kg)**

---

## Paramètres d'entrée

| Paramètre | Description | Exemple |
|-----------|-------------|---------|
| `siteId` | Le site à analyser | `site_dkfarm_01` |
| `produitId` | L'aliment à analyser | Aliment Skretting 3mm (Priso) |
| `minPoints` | Nombre minimum de points biométriques pour le calibrage Gompertz | 3 |
| `wInfinity` | Poids asymptotique W∞ du modèle Gompertz (g) | 1500 |

---

## Étapes de l'algorithme

### Étape 1 — Identifier les vagues concernées

Récupérer toutes les vagues du site ayant au moins un enregistrement `ReleveConsommation` pour le `produitId` spécifié.

### Étape 2 — Pour chaque vague : collecter les données biométriques

Récupérer tous les relevés biométriques (`typeReleve = 'BIOMETRIE'`) de la vague. Calculer la moyenne du `poidsMoyen` par jour sur l'ensemble des bacs pour obtenir des points au niveau de la vague.

**Exigence** : au moins `minPoints` points biométriques sont nécessaires. Si moins de points existent, la vague est ignorée ou signalée comme `INSUFFICIENT_DATA`.

### Étape 3 — Calibrage Gompertz

Ajuster le modèle de croissance Gompertz sur les points biométriques :

**W(t) = W∞ × exp(−exp(−K × (t − ti)))**

Paramètres :
- **W∞** = poids asymptotique (g) — fourni en entrée (ex : 1500g)
- **K** = constante de croissance (jour⁻¹) — ajustée par Levenberg-Marquardt
- **ti** = point d'inflexion (jours) — ajusté par Levenberg-Marquardt

Le calibrage utilise W∞ comme estimation initiale et plafond supérieur, garantissant que le solveur respecte le maximum biologique de la ferme.

Sortie : paramètres ajustés `{ wInfinity, k, ti }` + R² + RMSE + niveau de confiance.

### Étape 4 — Générer le tableau de poids et gain quotidiens

À partir des paramètres Gompertz ajustés, calculer le poids prédit et le gain quotidien pour chaque jour depuis le premier jusqu'au dernier jour de consommation de l'aliment :

```
Pour chaque jour t de min_jour_consommation à max_jour_consommation :
  poids(t) = W∞ × exp(−exp(−K × (t − ti)))
  gainQuotidien(t) = poids(t) − poids(t − 1)
```

### Étape 5 — Identifier les périodes de consommation par bac

**Important** : Ne PAS partir des bacs actuellement assignés à la vague (`Bac.vagueId`). Un bac peut avoir été désassigné après un calibrage (ex : poissons transférés dans un autre bac), mais ses données de consommation avant le calibrage appartiennent toujours à cette vague. Il faut donc partir des enregistrements `ReleveConsommation` pour découvrir quels bacs ont consommé l'aliment cible.

1. **Requêter tous les enregistrements de consommation** de l'aliment cible dans cette vague : jointure `ReleveConsommation` → `Releve` (filtré par `vagueId` et `produitId`) → `Bac` (via `Releve.bacId`). Cela retourne tous les bacs ayant consommé l'aliment, y compris ceux qui ne sont plus assignés à la vague.
2. **Pour chaque bac découvert**, trouver tous les jours où l'aliment cible a été consommé.
3. **Classifier chaque jour** comme :
   - **Jour exclusif** : aucun autre aliment n'a été consommé ce jour dans ce bac.
   - **Jour mixte** : d'autres aliments ont aussi été consommés ce jour.
4. **Grouper les jours exclusifs consécutifs** en périodes par détection de rupture (un écart ≥1 jour sans consommation ou avec seulement des jours mixtes crée une rupture).
5. **Rattacher les jours mixtes** à la période adjacente la plus proche. Les jours mixtes représentent des erreurs nutritionnelles (ex : mauvais grammage donné en parallèle) et leur consommation est attribuée au FCR de l'aliment cible.

**Résultat par bac** : une liste de périodes `{ debut, fin, qty_aliment_cible_kg }` où le total inclut les jours exclusifs et les jours mixtes.

**Vérification** : la somme des `qty_aliment_cible_kg` de toutes les périodes d'un bac doit être égale à la consommation totale de l'aliment dans ce bac.

**Exemple** : La vague 26-01 a actuellement les Bacs 01, 02, 04 assignés. Mais le Bac 03 a consommé du Skretting 3mm du 22 au 25 mars avant d'être vidé le 26 mars (poissons transférés au Bac 04). En partant des `ReleveConsommation`, on inclut correctement les 18 kg de consommation du Bac 03.

### Étape 6 — Estimer le nombre de poissons par bac et par période

Le nombre de poissons est nécessaire pour convertir le gain de poids par poisson (g) en gain de biomasse (kg).

**Méthode — Ancrage + Ajustement par mortalité** :

1. **Ancrage** : utiliser le relevé de `COMPTAGE` le plus récent comme référence pour chaque bac.
2. **Ajustement vers l'avant** : soustraire la mortalité cumulée (relevés `MORTALITE`) après la date de comptage.
3. **Ajustement vers l'arrière** : ajouter la mortalité cumulée avant la date de comptage.
4. **Moyenne** : utiliser le nombre moyen de poissons sur la période (début + fin) / 2.

**Cas particuliers** :
- **Bac vidé** (comptage = 0) : les poissons ont été transférés. Reconstituer le nombre avant transfert : comptage destination + mortalité cumulée.
- **Pas de données de comptage** : répartition proportionnelle de `vague.nombreInitial` entre les bacs, moins la mortalité cumulée.

### Étape 7 — Calculer le FCR par période

Pour chaque période de chaque bac :

```
gain_poids_par_poisson = somme des gainQuotidien(t) pour chaque jour t de la période
gain_biomasse_kg = gain_poids_par_poisson × nb_poissons_moyen / 1000
FCR = qty_aliment_cible_kg / gain_biomasse_kg
```

### Étape 8 — Agréger le FCR par vague

```
total_aliment_kg = somme des qty_aliment_cible_kg de toutes les périodes et bacs
total_biomasse_kg = somme des gain_biomasse_kg de toutes les périodes et bacs
FCR_vague = total_aliment_kg / total_biomasse_kg
```

---

## Tableau de sortie

| Vague | Bac | Période | Jours | Qty Aliment (kg) | Gain/poisson (g) | Nb poissons moy. | Gain biomasse (kg) | FCR |
|-------|-----|---------|-------|-----------------|-----------------|-------------------|-------------------|-----|
| 26-01 | Bac 01 | 21-22 mars | 2 | 3,30 | 6,95 | 2 304 | 16,01 | 0,21 |
| ... | ... | ... | ... | ... | ... | ... | ... | ... |
| **26-01** | **Total** | | | **203,48** | | | **309,51** | **0,66** |

---

## Cas limites et signalements

| Situation | Traitement |
|-----------|------------|
| < `minPoints` données biométriques | Ignorer la vague, signaler `INSUFFICIENT_DATA` |
| Gompertz R² < 0,85 | Signaler `LOW_CONFIDENCE` — FCR potentiellement peu fiable |
| Bac avec FCR anormalement élevé (> 3,0) | Signaler pour vérification — possible erreur de saisie ou très peu de poissons |
| Pas de données de comptage | Utiliser répartition proportionnelle + mortalité |
| Jours mixtes (plusieurs aliments) | Rattacher à la période exclusivement aliment cible adjacente |
| Consommation avant le premier point biométrique | Extrapoler le Gompertz en arrière (le modèle est valide depuis t=0) |

---

## Valeurs de référence — Clarias gariepinus

| Métrique | Plage attendue | Source |
|----------|---------------|--------|
| FCR (grossissement, aliment commercial) | 0,8 – 1,5 | FAO / Littérature |
| FCR (stade alevin, < 100g) | 0,5 – 1,0 | Phase de croissance initiale |
| Gompertz W∞ (bacs béton, Cameroun) | 1200 – 1500g | ADR + données locales |
| Gompertz K (typique) | 0,015 – 0,025 jour⁻¹ | ADR |
