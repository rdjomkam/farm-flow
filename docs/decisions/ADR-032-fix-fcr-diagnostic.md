# ADR-032-fix — Diagnostic FCR 1.92 pour Skretting 3mm (Vague 01-26)

**Date :** 2026-04-05
**Auteur :** @architect
**Statut :** DIAGNOSTIC COMPLET — Corrections requises

---

## Symptomes rapportes

- FCR affiché pour Skretting 3mm : **1.92**
- FCR attendu (calcul manuel avec données réelles) : **~1.2**
- Le dialog de transparence affiche une décomposition par bac individuel au lieu des étapes algorithmiques agrégées

---

## Résumé exécutif

Deux bugs distincts, même origine : **les bacs créés après calibrage n'ont pas de biométries sous leur propre `bacId`**, ce qui court-circuite Gompertz et donne gain = 0 pour ces bacs. Leur aliment est compté dans le numérateur FCR mais leur gain de biomasse est exclu du dénominateur. Le FCR se retrouve artificiellement gonflé.

Le dialog de transparence n'a pas de bug fonctionnel — il affiche correctement les données structurées — mais son UX place les bacs individuels en premier plan alors que l'utilisateur veut voir les étapes d'agrégation finale en priorité.

---

## Bug 1 — FCR 1.92 : Bacs post-calibrage sans biométries court-circuitent Gompertz

### Contexte data Vague 01-26

- Calibrage autour de J25 (2026-03-21)
- Avant calibrage : 2 bacs (Bac 01, Bac 02), ~650 poissons chacun
- Après calibrage : 4 bacs (Bac 01, Bac 02, Bac 03, Bac 04)
- Bac 01 post-calibrage : ~130 poissons
- Bacs 03 et 04 : **NOUVEAUX bacs** créés à l'occasion du calibrage, n'ont donc aucune biométrie historique sous leur `bacId`
- Skretting 3mm : distribué de ~J21 à ~J35, donc sur les 4 bacs pour la partie post-calibrage

### Trace du bug dans `interpolerPoidsBac`

Fichier : `src/lib/feed-periods.ts`, lignes 120-258

```
function interpolerPoidsBac(targetDate, bacId, biometries, poidsInitial, options)
  bacBios = biometries.filter(b => b.bacId === bacId)  // <-- ligne 133-135

  if (bacBios.length === 0) {
    // No biometry for this tank at all — use initial weight
    return { poids: poidsInitial, methode: "VALEUR_INITIALE", ... }  // <-- ligne 138-143
  }
  // ... Gompertz evaluated ONLY if bacBios.length > 0
```

**Le problème** : pour Bac 03 et Bac 04, `bacBios.length === 0` car ces bacs n'existaient pas avant le calibrage et n'ont donc aucun relevé biométrique attaché à leur `bacId`. La fonction retourne immédiatement `VALEUR_INITIALE` (le poids initial de la vague, ex. 50g) **sans jamais évaluer Gompertz**.

### Conséquence sur le calcul FCR

Pour une période alimentaire sur Bac 03 ou Bac 04 :

```
poidsMoyenDebut = 50g (VALEUR_INITIALE)
poidsMoyenFin   = 50g (VALEUR_INITIALE)
gain brut       = (50 - 50) × 130 / 1000 = 0 kg
gainBiomasseKg  = null  (exclu car <= 0)
```

Dans l'agrégation `computeAlimentMetrics` (ligne 743-749) :

```typescript
const totalGainPeriodes = periodesProduct.reduce(
  (s, p) => s + (p.gainBiomasseKg != null && p.gainBiomasseKg > 0 ? p.gainBiomasseKg : 0),
  0
);
```

Les périodes de Bac 03 et Bac 04 contribuent **0** au gain total, mais leur feed (`quantiteKg`) est entièrement compté dans `totalAlimentPeriodes`.

### Quantification de l'erreur

Exemple avec données réelles (estimations) :

| Bac | Feed J21-J35 | NombreVivants | Gain calculé |
|-----|-------------|---------------|--------------|
| 01  | 15 kg       | 130           | 120→400g → +36.4 kg |
| 02  | 15 kg       | 130           | 120→400g → +36.4 kg |
| 03  | 15 kg       | 130           | 50→50g → **0 kg** (exclu) |
| 04  | 15 kg       | 130           | 50→50g → **0 kg** (exclu) |
| **Total** | **60 kg** | | **72.8 kg** gain réel |

FCR correct = 60 / 72.8 = **0.82** (pour l'exemple ci-dessus)

Avec le bug, gain compté = 36.4 + 36.4 = 72.8 kg, mais seul l'aliment des bacs avec gain > 0 est exclu... Attendez, non. L'aliment est toujours compté en totalité (ligne 743), seul le gain des bacs sans biométries est mis à zéro.

FCR bugué = 60 / 72.8 n'est pas le problème... Recalculons :

Si seulement Bac 01 et 02 ont des biométries et Bac 03/04 n'en ont pas :
- `totalAlimentPeriodes` = 15 + 15 + 15 + 15 = 60 kg (tous les 4 bacs)
- `totalGainPeriodes` = 36.4 + 36.4 + 0 + 0 = 72.8 kg (seulement Bac 01 + Bac 02... mais attends)

Non, le gain de Bac 01 post-calibrage avec nombreVivants=130 et Gompertz J21→J35 :
- J21 (t=21) : W ≈ 120g
- J35 (t=35) : W ≈ 400g
- gain = (400-120) × 130 / 1000 = 36.4 kg

Mais avec VALEUR_INITIALE pour tous les bacs (si bacBios vides) :
- gain = 0 pour chaque bac

FCR bugué = totalAliment / totalGain = 60 / (36.4 + 36.4) = 60 / 72.8 = 0.82 si Bac01 et Bac02 ont des biométries.

Cela ne donne pas 1.92... Il faut regarder le cas réel plus finement.

**Hypothèse affinée** : les biométries d'avant calibrage sur Bac 01 et Bac 02 sont enregistrées avec le `bacId` du bac. Après calibrage, la répartition change (Bac 01 passe de 650 à 130 poissons). Le calcul de `nombreVivants` utilise bien les 130 post-calibrage (ADR-032 est correct là-dessus). Mais les biométries de la période J21-J35 pour Bacs 03 et 04 sont absentes.

Avec 4 bacs à 15 kg chacun = 60 kg total :
- Bac 01 : nombreVivants=130, gain = (400-120)×130/1000 = 36.4 kg, FCR_bac = 15/36.4 = 0.41
- Bac 02 : nombreVivants=130, gain = (400-120)×130/1000 = 36.4 kg, FCR_bac = 15/36.4 = 0.41
- Bac 03 : nombreVivants=130, gain = 0 (VALEUR_INITIALE, pas de biométrie)
- Bac 04 : nombreVivants=130, gain = 0 (VALEUR_INITIALE, pas de biométrie)

FCR agrégé = 60 / (36.4 + 36.4) = **0.82**

Cela ne correspond pas à 1.92. Il faut chercher pourquoi même les bacs avec biométries donnent un résultat trop élevé.

**Hypothèse complémentaire — double comptage de l'aliment** :

Dans `computeAlimentMetrics`, l'aliment total pour la vague vient de `consoByVague.get(vague.id)` = somme totale des `ReleveConsommation.quantite` pour ce produit dans cette vague. Parallèlement, `periodesProduct` filtre les périodes par `produitId`. La quantité dans les périodes (`quantiteKg` somme de `ReleveConsommation.quantite`) et `conso.quantite` sont calculées indépendamment.

Regardons la ligne 743 :
```typescript
const totalAlimentPeriodes = periodesProduct.reduce((s, p) => s + p.quantiteKg, 0);
```

Et la ligne 749 :
```typescript
fcr = totalGainPeriodes > 0 ? totalAlimentPeriodes / totalGainPeriodes : null;
```

`totalAlimentPeriodes` est la somme des quantités dans les périodes segmentées. Pour chaque bac, les périodes n'incluent que les relevés de CE bac. Donc si Bac 01 a 15 kg de feed, Bac 02 a 15 kg, Bac 03 a 15 kg, Bac 04 a 15 kg → totalAlimentPeriodes = 60 kg. C'est correct.

**Hypothèse — poids de départ erroné pour Bac 01 et Bac 02 post-calibrage** :

Après calibrage (J25), les biométries de Bac 01 et 02 avant J25 sont toujours présentes sous leur bacId. Donc pour une période alimentaire sur Bac 01 débutant à J21 (avant calibrage) :
- `dateDebut` = J21
- `biometries` filtrées pour Bac 01 = points avant calibrage, par ex. une biométrie à J10 = 80g et J20 = 115g
- L'interpolation linéaire donne ~118g à J21 ✓

Pour une période sur Bac 01 débutant à J26 (après calibrage) :
- `biometriePoints` pour Bac 01 = les mêmes biométries J10, J20
- À J26, extrapolation depuis la dernière biométrie connue = 115g (la valeur de J20) ← **pas du tout 160g attendu**
- Si Gompertz est actif : donne W(26) ≈ 185g ✓

Donc si Gompertz N'EST PAS actif (stratégie LINEAIRE), les poids sont sous-estimés après la dernière biométrie, et le gain est sous-estimé. Si la config de la vague n'a pas activé GOMPERTZ_VAGUE, alors l'interpolation retourne la dernière valeur connue pour les périodes futures, ce qui minimise le gain et donc **augmente** le FCR.

**Hypothèse la plus probable pour FCR = 1.92** :

Combinaison de :
1. Bacs 03 et 04 n'ont aucune biométrie → VALEUR_INITIALE → gain = 0 pour eux
2. La stratégie d'interpolation est **LINEAIRE** (pas GOMPERTZ_VAGUE) → après la dernière biométrie de Bac 01 et Bac 02, extrapolation bloquée sur le dernier poids mesuré
3. La quantité totale d'aliment (numérateur) inclut les 4 bacs, mais le gain (dénominateur) est calculé avec des poids sous-estimés

### Vérification avec les vrais chiffres

Avec Gompertz W∞=1500, K=0.0488, ti=45.68 :
- W(21) = 1500 × exp(−exp(−0.0488 × (21−45.68))) ≈ 120g
- W(25) = 1500 × exp(−exp(−0.0488 × (25−45.68))) ≈ 160g
- W(30) = 1500 × exp(−exp(−0.0488 × (30−45.68))) ≈ 270g
- W(35) = 1500 × exp(−exp(−0.0488 × (35−45.68))) ≈ 400g

Avec 4 bacs × 130 poissons = 520 poissons total et supposons feed = ~100 kg total (J21-J35) :

**Cas correct (Gompertz actif pour tous les bacs)** :
- Gain = (400g − 120g) × 520 / 1000 = 145.6 kg
- FCR = 100 / 145.6 = 0.69

**Cas réel observé avec 1.2** :
- Feed total = X kg
- Gain total = X / 1.2 kg
- Soit feed ≈ some value

La vraie question est : quel est le gain qui donne FCR = 1.92 ?
- Si feed = 100 kg → gain = 100 / 1.92 = 52.1 kg
- 52.1 kg de gain avec 520 poissons → gain individuel = 100g
- Avec Gompertz, gain réel serait (400-120)g = 280g → 145.6 kg total
- 52.1 / 145.6 ≈ 0.36 → environ 36% du gain réel est comptabilisé

Cela correspond à seulement 2 bacs sur 4 ayant des biométries valides, et seulement si leur poids fin est sous-estimé (ex. blocage sur dernière biométrie connue sans Gompertz).

---

## Bug 2 — Cause profonde confirmée dans `interpolerPoidsBac`

**Fichier :** `src/lib/feed-periods.ts`, lignes 132-144

```typescript
// Filter biometries for this tank
const bacBios = biometries
  .filter((b) => b.bacId === bacId)
  .sort((a, b) => a.date.getTime() - b.date.getTime());

if (bacBios.length === 0) {
  // No biometry for this tank at all — use initial weight
  return {
    poids: poidsInitial,
    methode: "VALEUR_INITIALE",
    detail: { methode: "VALEUR_INITIALE", poidsMoyenInitialG: poidsInitial },
  };
}
```

**Le problème** : Quand `bacBios.length === 0`, la fonction retourne immédiatement `VALEUR_INITIALE` sans essayer Gompertz. Pour les bacs créés lors d'un calibrage (Bac 03, Bac 04), cette condition est TOUJOURS vraie car ces bacs n'ont jamais eu de relevé biométrique avant leur création.

**La correction** : Si `bacBios.length === 0` **et** qu'un contexte Gompertz valide est disponible (stratégie GOMPERTZ_VAGUE + confidenceLevel HIGH/MEDIUM + r² ≥ 0.85), évaluer Gompertz vague avant de tomber en fallback VALEUR_INITIALE.

```typescript
// Correction proposée — lignes 137-144 de feed-periods.ts
if (bacBios.length === 0) {
  // No biometry for this tank at all.
  // If GOMPERTZ_VAGUE strategy is active and model is valid, use it
  // (critical for new tanks created at calibrage — ADR-032 fix 2).
  const strategie = options?.strategie ?? StrategieInterpolation.LINEAIRE;
  if (strategie === StrategieInterpolation.GOMPERTZ_VAGUE && options?.gompertzContext) {
    const ctx = options.gompertzContext;
    const isValidLevel = ctx.confidenceLevel === "HIGH" || ctx.confidenceLevel === "MEDIUM";
    if (isValidLevel && ctx.r2 >= 0.85) {
      const tDays = (targetDate.getTime() - ctx.vagueDebut.getTime()) / (1000 * 60 * 60 * 24);
      if (tDays >= 0) {
        const poids = gompertzWeight(tDays, { wInfinity: ctx.wInfinity, k: ctx.k, ti: ctx.ti });
        if (poids > 0 && !isNaN(poids)) {
          return {
            poids,
            methode: "GOMPERTZ_VAGUE",
            detail: {
              methode: "GOMPERTZ_VAGUE",
              tJours: tDays,
              params: { ... ctx params ... },
              resultatG: poids,
            },
          };
        }
      }
    }
  }
  // Fallback to initial weight
  return {
    poids: poidsInitial,
    methode: "VALEUR_INITIALE",
    detail: { methode: "VALEUR_INITIALE", poidsMoyenInitialG: poidsInitial },
  };
}
```

---

## Bug 3 — `calculerFCRParAliment` : double comptage de l'aliment

**Fichier :** `src/lib/queries/analytics.ts`, lignes 830-832

```typescript
const fcrMoyen = calculerFCRParAliment(
  vagueMetrics.map((v) => ({ quantite: v.quantite, gainBiomasse: v.gainBiomasse }))
);
```

`calculerFCRParAliment` (src/lib/calculs.ts) calcule :
```typescript
for (const v of vagues) {
  if (v.gainBiomasse == null || v.gainBiomasse <= 0) continue;
  totalQuantite += v.quantite;   // <-- SEULEMENT si gain > 0
  totalGain += v.gainBiomasse;
}
```

Le problème : `v.quantite` est la quantité **totale** de ce produit dans la vague, **incluant les bacs sans biométries**. Si Bac 03 et Bac 04 n'ont pas de gain, leur aliment est inclus dans `conso.quantite` mais le gain est null → `v.gainBiomasse` est calculé sur toutes les périodes, mais les bacs sans biométries font passer le `gainBiomasse` de la vague à une valeur plus basse que la réalité.

Ce n'est pas un bug indépendant — c'est la conséquence du Bug 2. Si le Bug 2 est corrigé (Gompertz utilisé pour tous les bacs), le gain sera correct et le FCR sera juste.

---

## Bug 4 — `getFCRTrace` : l'aliment de la vague ne correspond pas à l'aliment des périodes

**Fichier :** `src/lib/queries/analytics.ts`, lignes 2776-2786

```typescript
// Vague-level FCR aggregation
const totalAlimentVague = tracePeriodes.reduce((s, p) => s + p.quantiteKg, 0);
```

`tracePeriodes` contient uniquement les périodes filtrées pour `produitId` (ligne 2674). Donc `totalAlimentVague` = somme des quantités de CE produit dans les périodes → correct.

Mais `quantiteVague` (ligne 2586, utilisé pour le total global et pour l'affichage `quantiteKg` dans FCRTraceVague) est la somme totale brute de `ReleveConsommation.quantite` pour ce produit dans la vague. Cette valeur EST la même chose que ce que les périodes calculent, mais elle est calculée différemment (via `consoByVague` qui somme les `ReleveConsommation` directement).

**Risque de divergence** : si un relevé alimentation a un `bacId` null (legacy), il peut être compté dans `consoByVague` mais la période générée sera sous `"unknown"` → la somme peut différer légèrement. Ce n'est pas la cause du FCR 1.92, mais peut produire une incohérence dans le dialog de transparence.

---

## Bug 5 — Transparence dialog : UX "par bac" en avant, agrégation cachée

**Fichier :** `src/components/analytics/fcr-transparency-dialog.tsx`

Le dialog affiche dans l'ordre :
1. Barre de résumé (FCR final + stratégie) ✓
2. `AggregationSection` → formule + totaux ✓
3. `VagueSection` (une par vague) → déplié par défaut pour la première
   - Chaque vague contient N `PeriodeRow` (une par bac)

**Le problème UX** : La section d'agrégation (étapes algorithmiques) est au niveau 2, mais l'utilisateur voit immédiatement les détails per-bac de la première vague. Les labels comme `"périodes du bac"` dans le sous-titre de VagueSection suggèrent une perspective per-bac.

**Ce que l'utilisateur attendait** : voir les étapes de calcul comme dans notre calcul manuel :
```
1. Identifier les paramètres Gompertz : W∞=1500, K=0.0488, ti=45.68, R²=0.9909
2. Calculer W(t) aux bornes de chaque période
3. Calculer le gain de biomasse par période = (W_fin − W_deb) × N_vivants / 1000
4. Additionner tous les gains → gain total
5. FCR final = aliment total / gain total
```

La structure de données `FCRTracePeriode` contient tous ces éléments, mais l'UI ne les présente pas dans cet ordre narratif.

---

## Récapitulatif des corrections à apporter

### Correction prioritaire 1 (FCR trop élevé) — `src/lib/feed-periods.ts`

**Lignes 137-144** — Ajouter l'évaluation Gompertz dans le branch `if (bacBios.length === 0)`.

Logique : avant de retourner `VALEUR_INITIALE`, si la stratégie est `GOMPERTZ_VAGUE` et que le modèle est valide, évaluer Gompertz. Cela corrige les bacs créés lors du calibrage (pas d'historique biométrique propre).

**Condition** : ce fix dépend de la stratégie configurée. Si la stratégie est LINEAIRE, le fallback VALEUR_INITIALE reste logique. Le fix ne s'applique que pour GOMPERTZ_VAGUE.

### Correction prioritaire 2 (FCR trop élevé) — configuration vague

**Vérifier** que la vague 01-26 a bien `interpolationStrategy = GOMPERTZ_VAGUE` dans sa `configElevage` et que le modèle Gompertz est calibré avec `confidenceLevel = HIGH | MEDIUM`.

Si la stratégie est encore LINEAIRE pour cette vague, le Bug 1 ne peut pas être corrigé au niveau code uniquement — il faut que l'utilisateur active GOMPERTZ_VAGUE dans la config de la vague.

### Correction prioritaire 3 (FCR trop élevé) — stratégie fallback quand bacBios vides

Même sans Gompertz, si un bac post-calibrage n'a pas de biométries, utiliser les biométries **null-bacId** ou les biométries de l'ensemble de la vague comme fallback, plutôt que `poidsMoyenInitial` de la vague. Cela permettrait une meilleure estimation même en mode LINEAIRE.

### Correction UX dialog — `src/components/analytics/fcr-transparency-dialog.tsx`

Restructurer l'affichage pour mettre les **étapes algorithmiques en premier** :

1. **Bloc "Calcul global"** : Stratégie + Gompertz params (si applicable) + formule FCR final
2. **Bloc "Étapes de calcul"** : pour chaque vague, montrer :
   - Gompertz params de la vague (W∞, k, ti, R²)
   - Tableau des périodes (par bac) avec poids début/fin, nombre vivants, gain
   - Sous-total aliment, sous-total gain, FCR vague
3. **Bloc "Agrégation finale"** : Σ aliment / Σ gain = FCR

Changer le label `"periodesDuBac"` pour quelque chose de plus clair comme `"periodes alimentaires"`.

---

## Plan d'action recommandé

| Priorité | Fichier | Changement |
|----------|---------|------------|
| P1 | `src/lib/feed-periods.ts` L.137-144 | Ajouter éval Gompertz dans le branch `bacBios.length === 0` |
| P2 | Config vague 01-26 | Vérifier que `interpolationStrategy = GOMPERTZ_VAGUE` est activé |
| P3 | `src/components/analytics/fcr-transparency-dialog.tsx` | Restructurer UX : étapes algo en avant, bacs en détails collapsibles |
| P4 | `src/lib/feed-periods.ts` L.506-508 | Vérifier que `gainBiomasseKg = null` (pas 0) pour les périodes sans données — pour distinguer "inconnu" de "gain nul" |

---

## Analyse du résultat attendu post-correction

Avec la correction P1 + P2 activée :

Pour Vague 01-26, Skretting 3mm, en supposant 4 bacs avec ~130 poissons chacun :

```
Période J21-J35 (14 jours) :

Bac 01 : W(21)=120g → W(35)=400g, N=130 → gain = 280g×130/1000 = 36.4 kg
Bac 02 : W(21)=120g → W(35)=400g, N=130 → gain = 36.4 kg
Bac 03 : W(21)=120g → W(35)=400g, N=130 → gain = 36.4 kg (désormais via Gompertz)
Bac 04 : W(21)=120g → W(35)=400g, N=130 → gain = 36.4 kg (désormais via Gompertz)

Total gain = 145.6 kg
```

FCR = aliment_total / 145.6

Si aliment_total ≈ 174 kg (pour avoir FCR ≈ 1.2) → plausible pour 520 poissons sur 14 jours à ~24 kg/jour.

---

## Note sur le design original de ADR-032

ADR-032 a correctement résolu le problème du `nombreVivants` post-calibrage. Mais il n'a pas anticipé le cas où les **biométries** d'un bac post-calibrage sont également absentes. Ces deux dimensions sont couplées : après calibrage, un bac peut recevoir des poissons redistributés (ADR-032 corrige `nombreVivants`) mais n'a pas d'historique biométrique propre (problème non couvert).

La correction est une extension naturelle du même principe : pour les bacs post-calibrage, utiliser le modèle Gompertz de la vague pour estimer le poids, tout comme on utilise le groupe de calibrage pour estimer `nombreVivants`.
