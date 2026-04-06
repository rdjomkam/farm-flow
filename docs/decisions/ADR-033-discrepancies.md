# ADR-033 — Discrepancies Between Confirmed FCR Algorithm and Current Implementation

**Statut :** FAIT — Tous les DISC implémentés, tests passent (122), build OK, review validée (2026-04-06)
**Date :** 2026-04-05
**Auteur :** @architect
**Contexte :** ADR-033 a défini l'algorithme FCR au niveau vague (vague-level). Ce document
recense TOUTES les divergences entre l'algorithme confirmé et le code actuel, fichier par
fichier, ligne par ligne.

---

## Algorithme confirmé — rappel concis

1. Calibrer Gompertz sur la vague entière (W∞, K, ti) → courbe unique par vague
2. Récupérer tous les relevés ALIMENTATION pour le produit cible
3. Segmenter en **périodes** par contiguïté de dates, **tous bacs confondus**
4. Pour chaque période : estimer poids aux bornes via **Gompertz VAGUE** (jamais per-bac)
5. `nombreVivants` = population totale de la **vague** (pas d'un bac)
6. Gain par période = (poidsFin − poidsDebut) × nombreVivants / 1000
7. FCR = Σ aliment sur toutes périodes / Σ gain sur toutes périodes

---

## 1. `src/lib/feed-periods.ts`

### DISC-01 — `interpolerPoidsBac` : filtre par `bacId` au lieu d'utiliser la vague entière

**Lignes :** 133–144

**Ce que fait le code :**
```typescript
const bacBios = biometries
  .filter((b) => b.bacId === bacId)   // ← filtre par bac
  .sort((a, b) => a.date.getTime() - b.date.getTime());

if (bacBios.length === 0) {
  // No biometry for this tank at all — use initial weight
  return {
    poids: poidsInitial,
    methode: "VALEUR_INITIALE",   // ← retourne VALEUR_INITIALE sans évaluer Gompertz
    ...
  };
}
```

**Ce qu'il devrait faire :**
Utiliser TOUTES les biométries de la vague (ignorer `bacId`). Si aucune biométrie exacte ce
jour, évaluer Gompertz avant de tomber sur l'interpolation linéaire, puis VALEUR_INITIALE.
Les bacs créés post-calibrage (Bac 03, Bac 04) n'ont aucune biométrie sous leur `bacId` — ils
retombent immédiatement sur VALEUR_INITIALE, rendant leur gain nul même si Gompertz aurait
donné un poids valide.

**Conséquence :** FCR artificiellement élevé pour les vagues avec calibrage (observé : 1.92
au lieu de ~1.2 pour Vague 01-26, Skretting 3mm).

**Fix :** Remplacer `interpolerPoidsBac` par `interpolerPoidsVague` (ADR-033 §3.2) qui
ne filtre pas par `bacId` et évalue Gompertz même si `biometries.length === 0`.

---

### DISC-02 — `interpolerPoidsBac` : Gompertz non évalué si aucune biométrie pour ce bac

**Lignes :** 137–144

**Ce que fait le code :**
```typescript
if (bacBios.length === 0) {
  return {
    poids: poidsInitial,
    methode: "VALEUR_INITIALE",
    detail: { methode: "VALEUR_INITIALE", poidsMoyenInitialG: poidsInitial },
  };
  // ← retour immédiat, Gompertz jamais évalué
}
```

**Ce qu'il devrait faire :**
Même en l'absence de biométries per-bac, si un `gompertzContext` valide est fourni, la
fonction doit évaluer `gompertzWeight(t, vagueParams)`. Gompertz est une fonction de temps
pur — il n'a pas besoin de données per-bac pour s'évaluer.

**Conséquence :** Pour tout bac créé après J0 (post-calibrage), Gompertz est sauté et
VALEUR_INITIALE est retournée, ce qui sous-estime le poids de fin de période.

**Fix :** Dans `interpolerPoidsVague`, ne pas préfiltrer par bacId. Évaluer Gompertz en
étape 2 indépendamment de si des biométries sont disponibles (Gompertz utilise uniquement `t`).

---

### DISC-03 — `segmenterPeriodesAlimentaires` : segmentation per-bac au lieu de per-vague

**Lignes :** 393–399

**Ce que fait le code :**
```typescript
const bacGroups = new Map<string | null, ReleveAlimPoint[]>();
for (const r of relevsAlim) {
  const key = r.bacId;              // ← groupe par bac
  if (!bacGroups.has(key)) bacGroups.set(key, []);
  bacGroups.get(key)!.push(r);
}

for (const [bacId, bacReleves] of bacGroups) {
  // ... période par bac
```

**Ce qu'il devrait faire :**
Ne pas grouper par `bacId`. Prendre TOUS les relevés ALIMENTATION de la vague pour le
produit ciblé, les trier par date, et les segmenter en périodes contiguës (gap ≤ N jours)
tous bacs confondus.

**Conséquence structurelle majeure :** Toute la logique de segmentation est au mauvais
niveau de granularité. Avec 4 bacs, on obtient jusqu'à 4× plus de périodes que nécessaire,
chacune avec une fraction de l'aliment et un gain potentiellement nul (bacs sans biométries).

**Fix :** Remplacer par `segmenterPeriodesAlimentairesVague` (ADR-033 §3.4) qui opère sur
la vague entière.

---

### DISC-04 — `segmenterPeriodesAlimentaires` : `interpolerPoidsBac` appelé avec `bacId` filtrant

**Lignes :** 407–410, 460–473

**Ce que fait le code :**
```typescript
const bacBios = biometries
  .filter((b) => b.bacId === bacId)   // filtre per-bac
  .sort(...);

const debutEstim = interpolerPoidsBac(
  dateDebut,
  bacId,           // ← bacId filtrant transmis
  bacBios,         // ← biométries filtrées
  vagueContext.poidsMoyenInitial,
  interpolOpts
);
```

**Ce qu'il devrait faire :**
Passer TOUTES les biométries de la vague à `interpolerPoidsVague`, sans filtre par `bacId`.

**Fix :** Dans `segmenterPeriodesAlimentairesVague`, transmettre le tableau complet des
biométries vague à `interpolerPoidsVague`.

---

### DISC-05 — `estimerNombreVivantsADate` : retourne la population d'un bac, pas de la vague

**Lignes :** 281–336

**Ce que fait le code :**
```typescript
export function estimerNombreVivantsADate(
  bacId: string | null,     // ← spécifique à un bac
  targetDate: Date,
  vagueContext: VagueContext,
  mortalitesParBac?: Map<string, ...>   // ← mortalités per-bac
): number | null {
  // cherche le groupe de calibrage pour CE bacId spécifique
  const groupe = calibrage.groupes.find((g) => g.destinationBacId === bacId);
  // retourne le nombrePoissons de CE bac
```

**Ce qu'il devrait faire :**
Pour le calcul FCR vague, `nombreVivants` doit être le total de la vague entière :
```
nombreInitial - Σ mortalitesToutes - Σ calibrage.nombreMorts (avant targetDate)
```
Les redistributions de calibrage ne changent pas le nombre total de vivants.

**Conséquence :** Si un bac a 130 poissons post-calibrage (sur 650 dans la vague),
le gain calculé est ×5 trop petit, ce qui donne un FCR ×5 trop grand pour ce bac.

**Fix :** Remplacer par `estimerNombreVivantsVague` (ADR-033 §3.3) qui somme toutes les
mortalités de la vague plutôt que de filtrer per-bac.

---

### DISC-06 — `segmenterPeriodesAlimentaires` : `nombreVivants` per-bac transmis à la période

**Lignes :** 496–501

**Ce que fait le code :**
```typescript
const nombreVivants = estimerNombreVivantsADate(
  bacId,       // ← population du bac, pas de la vague
  dateDebut,
  vagueContext,
  options?.mortalitesParBac   // ← map per-bac
);
```

**Ce qu'il devrait faire :**
```typescript
const nombreVivants = estimerNombreVivantsVague(
  dateDebut,
  vagueContext,
  mortalitesTotales   // ← tableau plat de toutes les mortalités
);
```

**Fix :** Utiliser `estimerNombreVivantsVague` dans `segmenterPeriodesAlimentairesVague`.

---

### DISC-07 — `interpolerPoidsBac` : extrapolation plate après la dernière biométrie

**Lignes :** 239–250**

**Ce que fait le code :**
```typescript
// 5. Target date is after all biometries — extrapolate using last known biometry
if (before && !after) {
  return {
    poids: before.poidsMoyen,   // ← poids constant = dernier connu
    methode: "INTERPOLATION_LINEAIRE",
    ...
  };
}
```

**Ce qu'il devrait faire :**
Si `gompertzContext` est valide et que la date cible est après toutes les biométries, évaluer
Gompertz (`GOMPERTZ_VAGUE`) avant de tomber sur la valeur plate. Gompertz est précisément
utile pour les dates hors plage biométrique.

**Conséquence :** Pour un bac dont la dernière biométrie est à J20 et dont on évalue la fin
de période à J35, le poids de fin sera plafonné à la valeur J20, sous-estimant le gain.

**Note :** Dans `interpolerPoidsVague` (future fonction), l'ordre des priorités (ADR-033 §7)
doit être : BIOMETRIE_EXACTE → GOMPERTZ_VAGUE → INTERPOLATION_LINEAIRE → VALEUR_INITIALE.
Gompertz doit être évalué avant l'interpolation linéaire ET avant l'extrapolation plate.

**Fix :** Dans `interpolerPoidsVague`, évaluer Gompertz en étape 2, avant de passer aux
branches linéaire et extrapolation plate (étapes 3-4).

---

## 2. `src/lib/queries/analytics.ts`

### DISC-08 — `computeAlimentMetrics` : appelle `segmenterPeriodesAlimentaires` (per-bac)

**Lignes :** 725–735

**Ce que fait le code :**
```typescript
const allPeriodes = segmenterPeriodesAlimentaires(
  relevsAlimPoints,
  biometriePoints,
  vagueCtxWithCalibrages,
  {
    strategie: interpolStrategy as StrategieInterpolation,
    gompertzContext,
    gompertzMinPoints: config?.gompertzMinPoints,
    mortalitesParBac,
  }
);
```

**Ce qu'il devrait faire :**
```typescript
const allPeriodes = segmenterPeriodesAlimentairesVague(
  relevsAlimPoints,
  biometriePoints,
  vagueCtxWithCalibrages,
  mortalitesTotales,   // tableau plat, pas Map per-bac
  { strategie: interpolStrategy, gompertzContext, gompertzMinPoints: config?.gompertzMinPoints }
);
```

**Fix :** Remplacer l'appel par `segmenterPeriodesAlimentairesVague` avec `mortalitesTotales`
(tableau plat) à la place de `mortalitesParBac` (Map).

---

### DISC-09 — `computeAlimentMetrics` : construction inutile de `mortalitesParBac`

**Lignes :** 702–712

**Ce que fait le code :**
```typescript
const mortalitesParBac = new Map<string, Array<{ nombreMorts: number; date: Date }>>();
for (const r of (relevesByVague.get(vague.id) ?? []).filter(
  (r) => r.typeReleve === TypeReleve.MORTALITE
)) {
  if (r.bacId) {
    const list = mortalitesParBac.get(r.bacId) ?? [];
    list.push({ nombreMorts: r.nombreMorts ?? 0, date: r.date });
    mortalitesParBac.set(r.bacId, list);
  }
}
```

**Ce qu'il devrait faire :**
Pour l'algorithme vague-level, construire un tableau plat `mortalitesTotales` :
```typescript
const mortalitesTotales = (relevesByVague.get(vague.id) ?? [])
  .filter((r) => r.typeReleve === TypeReleve.MORTALITE)
  .map((r) => ({ nombreMorts: r.nombreMorts ?? 0, date: r.date }));
```

**Fix :** Remplacer la Map per-bac par un tableau plat.

---

### DISC-10 — `computeAlimentMetrics` : Gompertz conditionnel à `interpolStrategy`

**Lignes :** 689–700

**Ce que fait le code :**
```typescript
const gompertzContext: GompertzVagueContext | undefined =
  gompertz && interpolStrategy === StrategieInterpolation.GOMPERTZ_VAGUE
    ? { ... }
    : undefined;
```

**Ce qu'il devrait faire :**
Selon l'algorithme confirmé (Step 1 — "Calibrate Gompertz on the whole vague"), Gompertz
doit être utilisé **systématiquement** pour le calcul FCR dès que le modèle est disponible
et valide (R² ≥ seuil, biometrieCount ≥ minPoints), indépendamment de la stratégie
d'interpolation configurée par l'utilisateur.

La `interpolationStrategy` dans `ConfigElevage` est une préférence UX pour l'affichage
des graphiques de croissance — elle ne devrait pas désactiver Gompertz dans le calcul FCR.

**Impact :** Si un site utilise la stratégie `LINEAIRE` (défaut), Gompertz est désactivé
dans le FCR même si le modèle est parfaitement calibré, ce qui dégrade la précision.

**Fix :** Dans `computeAlimentMetrics` et `getFCRTrace`, toujours construire
`gompertzContext` si `vague.gompertz` est présent et valide, indépendamment de
`interpolStrategy`. La stratégie peut rester un paramètre de `segmenterPeriodesAlimentairesVague`
mais avec un fallback automatique à Gompertz si disponible.

---

### DISC-11 — `getFCRTrace` : même problème — `mortalitesParBac` au lieu de `mortalitesTotales`

**Lignes :** 2630–2637

**Ce que fait le code :**
Identique à DISC-09 mais dans `getFCRTrace`.

**Fix :** Même correction — tableau plat `mortalitesTotales`.

---

### DISC-12 — `getFCRTrace` : appelle `segmenterPeriodesAlimentaires` (per-bac)

**Lignes :** 2668–2673

**Ce que fait le code :**
```typescript
const allPeriodes = segmenterPeriodesAlimentaires(
  relevsAlimPoints,
  biometriePoints,
  vagueCtxWithCalibrages,
  interpolOptions
);
```

**Ce qu'il devrait faire :**
Même remplacement que DISC-08.

---

### DISC-13 — `getFCRTrace` : recalcule `interpolerPoidsBac` par période pour la trace

**Lignes :** 2687–2700

**Ce que fait le code :**
```typescript
const debutEstim = interpolerPoidsBac(
  periode.dateDebut,
  resolvedBacId,      // ← bacId filtrant
  biometriePoints,    // ← toutes biométries mais filtrées en interne par bacId
  vague.poidsMoyenInitial,
  interpolOptions
);
```

**Ce qu'il devrait faire :**
```typescript
const debutEstim = interpolerPoidsVague(
  periode.dateDebut,
  biometriePoints,   // ← toutes biométries, sans filtre
  vague.poidsMoyenInitial,
  interpolOptions
);
```

**Fix :** Remplacer par `interpolerPoidsVague` dans la construction de `FCRTracePeriode`.

---

### DISC-14 — `getFCRTrace` : `FCRTracePeriode` contient `bacId` et `bacNom`

**Lignes :** 2752–2754

**Ce que fait le code :**
```typescript
tracePeriodes.push({
  bacId: periode.bacId,
  bacNom: bacNomMap.get(periode.bacId) ?? ...
  ...
});
```

**Ce qu'il devrait faire :**
Selon ADR-033 §3.5, `FCRTracePeriode` ne doit plus contenir `bacId` ni `bacNom`.
Les périodes sont au niveau vague — un bac n'a plus de sens à ce niveau.

**Fix :** Supprimer `bacId` et `bacNom` de `FCRTracePeriode` et de la construction dans
`getFCRTrace`. La construction de `bacNomMap` (ligne 2680) devient inutile.

---

### DISC-15 — `getFCRTrace` : Gompertz conditionnel à `interpolStrategy` (même que DISC-10)

**Lignes :** 2616–2627

**Ce que fait le code :**
Même problème que DISC-10 — `gompertzContext` n'est construit que si
`interpolStrategy === GOMPERTZ_VAGUE`.

**Fix :** Même correction que DISC-10.

---

### DISC-16 — `computeAlimentMetrics` : agrégation FCR incorrecte via `calculerFCRParAliment`

**Lignes :** 830–832

**Ce que fait le code :**
```typescript
const fcrMoyen = calculerFCRParAliment(
  vagueMetrics.map((v) => ({ quantite: v.quantite, gainBiomasse: v.gainBiomasse }))
);
```

`calculerFCRParAliment` dans `src/lib/calculs.ts` fait :
```typescript
for (const v of vagues) {
  if (v.gainBiomasse == null || v.gainBiomasse <= 0) continue;
  totalQuantite += v.quantite;   // ← quantité de TOUTE la vague, pas seulement la période
  totalGain += v.gainBiomasse;
}
```

**Problème spécifique :** `v.quantite` ici est la quantité totale d'aliment du produit pour
la vague entière (ligne 787 : `quantite: conso.quantite`), pas la somme des quantités des
périodes avec gain positif seulement. Résultat : si une vague a un gain négatif, TOUTE son
aliment est quand même exclue du numérateur, ce qui est correct. Mais si la vague a
plusieurs périodes dont certaines avec gain négatif, la quantité des périodes à gain négatif
devrait aussi être exclue du numérateur. Le code actuel exclut la vague entière ou l'inclut
entière — il ne permet pas l'exclusion sélective des périodes.

**Ce qu'il devrait faire :**
Le FCR doit être calculé depuis les périodes directement :
```
FCR = Σ(periode.quantiteKg pour periods avec gain > 0) / Σ(periode.gainBiomasseKg > 0)
```

Actuellement, `v.quantite = conso.quantite` (total vague), `v.gainBiomasse` = somme des
gains positifs des périodes. Cette combinaison est incohérente : le numérateur inclut
l'aliment des périodes à gain négatif mais le dénominateur non.

**Fix :** Calculer le FCR vague directement depuis les sommes des périodes :
```typescript
const totalAlimentValide = periodesProduct
  .filter((p) => p.gainBiomasseKg !== null && p.gainBiomasseKg > 0)
  .reduce((s, p) => s + p.quantiteKg, 0);
const totalGainValide = periodesProduct
  .reduce((s, p) => s + (p.gainBiomasseKg ?? 0), 0);
const fcr = totalGainValide > 0 ? totalAlimentValide / totalGainValide : null;
```

Et l'agrégation globale somme ces totaux par vague, pas par `conso.quantite`.

---

## 3. `src/types/calculs.ts`

### DISC-17 — `PeriodeAlimentaire` : champ `bacId` présent (doit être supprimé)

**Lignes :** 643–667

**Ce que fait le code :**
```typescript
export interface PeriodeAlimentaire {
  bacId: string;   // ← champ per-bac
  produitId: string;
  ...
}
```

**Ce qu'il devrait faire :**
Selon ADR-033 §3.1, l'interface doit devenir `PeriodeAlimentaireVague` sans `bacId`.
Les périodes sont maintenant au niveau vague — le `bacId` n'a plus de sens.

**Fix :** Remplacer `PeriodeAlimentaire` par `PeriodeAlimentaireVague` (ADR-033 §3.1).

---

### DISC-18 — `FCRTracePeriode` : champs `bacId` et `bacNom` présents (doivent être supprimés)

**Lignes :** 841–844

**Ce que fait le code :**
```typescript
export interface FCRTracePeriode {
  bacId: string;    // ← doit être supprimé
  bacNom: string;   // ← doit être supprimé
  ...
}
```

**Ce qu'il devrait faire :**
Selon ADR-033 §3.5, `FCRTracePeriode` ne doit plus exposer de granularité bac.

**Fix :** Supprimer `bacId` et `bacNom` de `FCRTracePeriode`.

---

### DISC-19 — `FCRTraceVague` : champ `modeLegacy` présent (doit être supprimé)

**Lignes :** 940–942

**Ce que fait le code :**
```typescript
export interface FCRTraceVague {
  ...
  modeLegacy: boolean;   // ← doit être supprimé
}
```

**Ce qu'il devrait faire :**
Selon ADR-033 §3.5, `modeLegacy` est supprimé car la distinction bac/legacy disparaît
avec l'algorithme vague-level.

**Fix :** Supprimer `modeLegacy` de `FCRTraceVague`.

---

### DISC-20 — Absence de `PeriodeAlimentaireVague` dans les types

**Fichier :** `src/types/calculs.ts`

**Ce que fait le code :**
L'interface `PeriodeAlimentaireVague` définie dans ADR-033 §3.1 n'existe pas encore.
Seule `PeriodeAlimentaire` (per-bac) est présente.

**Ce qu'il devrait faire :**
Ajouter `PeriodeAlimentaireVague` avec les champs :
`produitId, dateDebut, dateFin, dureeJours, quantiteKg, poidsMoyenDebut, poidsMoyenFin,
nombreVivants, biomasseDebutKg, biomasseFinKg, gainBiomasseKg, gainNegatifExclu,
methodeEstimation, detailEstimationDebut, detailEstimationFin, fcrPeriode`

**Fix :** Ajouter l'interface selon ADR-033 §3.1.

---

## 4. `src/components/analytics/fcr-transparency-dialog.tsx`

### DISC-21 — `PeriodeRow` : affiche `bacNom` et `bacId` dans le titre

**Lignes :** 159

**Ce que fait le code :**
```typescript
const title = `${t("bac")} ${periode.bacNom}  ${formatDate(periode.dateDebut)} → ...`;
```

**Ce qu'il devrait faire :**
Le dialog ne doit plus afficher de granularité bac. Le titre d'une période doit être :
```
Période N : DD/MM → DD/MM (X jours)
```
Sans référence à un bac particulier.

**Fix :** Supprimer la référence à `periode.bacNom` dans le titre. Numéroter les périodes.

---

### DISC-22 — `VagueSection` : label `periodesDuBac` sémantiquement incorrect

**Ligne :** 280

**Ce que fait le code :**
```typescript
{vague.periodes.length} {t("periodesDuBac")}
```

**Ce qu'il devrait faire :**
Le label doit être `periodes` (périodes vague, pas per-bac).

**Fix :** Changer la clé de traduction de `periodesDuBac` à `periodes`.

---

### DISC-23 — `VagueSection` : badge `modeLegacy` affiché

**Lignes :** 308–310

**Ce que fait le code :**
```typescript
{vague.modeLegacy && (
  <p className="text-[10px] text-amber-600 font-medium mb-2">{t("modeLegacy")}</p>
)}
```

**Ce qu'il devrait faire :**
`modeLegacy` est supprimé de `FCRTraceVague` (DISC-19). Ce bloc doit être retiré.

**Fix :** Supprimer le bloc `modeLegacy`.

---

### DISC-24 — Absence de `GompertzParamsBlock` dans le dialog

**Fichier :** `src/components/analytics/fcr-transparency-dialog.tsx`

**Ce que fait le code :**
Le dialog affiche la stratégie d'interpolation dans un label texte simple
(`strategieLabel` ligne 434) mais n'affiche pas les paramètres Gompertz (W∞, K, ti, R²).

**Ce qu'il devrait faire :**
Selon ADR-033 §8 (Niveau 2), si `gompertzVague` est non-null dans `FCRTraceVague`, afficher :
```
Modèle Gompertz calibré
W∞ = 1500 g   K = 0.0488 j⁻¹   ti = 45.68 j
R² = 0.9909   (12 biométries)
W(t) = 1500 × exp(−exp(−0.0488 × (t − 45.68)))
```

**Fix :** Ajouter le composant `GompertzParamsBlock` dans `VagueSection`.

---

### DISC-25 — `PeriodeRow` : clé de déduplication utilise `bacId`

**Ligne :** 319

**Ce que fait le code :**
```typescript
key={`${periode.bacId}-${periode.dateDebut}-${idx}`}
```

**Ce qu'il devrait faire :**
Sans `bacId`, la clé doit utiliser `dateDebut` et `idx` seulement :
```typescript
key={`${periode.dateDebut}-${idx}`}
```

**Fix :** Supprimer `periode.bacId` de la clé React.

---

## 5. Récapitulatif par fichier

| # | Fichier | Type | Sévérité | Description courte |
|---|---------|------|----------|--------------------|
| DISC-01 | `feed-periods.ts` | Logique | **Critique** | `interpolerPoidsBac` filtre par `bacId` → gain nul pour bacs post-calibrage |
| DISC-02 | `feed-periods.ts` | Logique | **Critique** | Gompertz non évalué si aucune biométrie per-bac |
| DISC-03 | `feed-periods.ts` | Architecture | **Critique** | Segmentation per-bac au lieu de per-vague |
| DISC-04 | `feed-periods.ts` | Logique | **Critique** | Biométries filtrées per-bac transmises à `interpolerPoidsBac` |
| DISC-05 | `feed-periods.ts` | Logique | **Critique** | `estimerNombreVivantsADate` retourne population d'un bac, pas de la vague |
| DISC-06 | `feed-periods.ts` | Logique | **Critique** | `nombreVivants` per-bac dans la période au lieu du total vague |
| DISC-07 | `feed-periods.ts` | Logique | **Haute** | Extrapolation plate après dernière biométrie au lieu de Gompertz |
| DISC-08 | `analytics.ts` | Appel | **Critique** | `computeAlimentMetrics` appelle `segmenterPeriodesAlimentaires` (per-bac) |
| DISC-09 | `analytics.ts` | Structure | **Haute** | `mortalitesParBac` (Map) au lieu de `mortalitesTotales` (tableau plat) |
| DISC-10 | `analytics.ts` | Logique | **Haute** | Gompertz désactivé si `interpolStrategy !== GOMPERTZ_VAGUE` |
| DISC-11 | `analytics.ts` | Structure | **Haute** | Même que DISC-09 dans `getFCRTrace` |
| DISC-12 | `analytics.ts` | Appel | **Critique** | `getFCRTrace` appelle `segmenterPeriodesAlimentaires` (per-bac) |
| DISC-13 | `analytics.ts` | Appel | **Critique** | `getFCRTrace` appelle `interpolerPoidsBac` avec `bacId` filtrant |
| DISC-14 | `analytics.ts` | Structure | **Moyenne** | `FCRTracePeriode` construit avec `bacId`/`bacNom` |
| DISC-15 | `analytics.ts` | Logique | **Haute** | Gompertz conditionnel à `interpolStrategy` dans `getFCRTrace` |
| DISC-16 | `analytics.ts` | Calcul | **Haute** | Numérateur FCR inclut aliment de périodes à gain négatif |
| DISC-17 | `calculs.ts` | Types | **Haute** | `PeriodeAlimentaire.bacId` doit être supprimé |
| DISC-18 | `calculs.ts` | Types | **Moyenne** | `FCRTracePeriode.bacId/bacNom` doivent être supprimés |
| DISC-19 | `calculs.ts` | Types | **Basse** | `FCRTraceVague.modeLegacy` doit être supprimé |
| DISC-20 | `calculs.ts` | Types | **Haute** | `PeriodeAlimentaireVague` manquante |
| DISC-21 | `dialog.tsx` | UI | **Moyenne** | Titre période affiche `bacNom` |
| DISC-22 | `dialog.tsx` | UI | **Basse** | Label `periodesDuBac` sémantiquement incorrect |
| DISC-23 | `dialog.tsx` | UI | **Basse** | Badge `modeLegacy` affiché |
| DISC-24 | `dialog.tsx` | UI | **Moyenne** | `GompertzParamsBlock` absent |
| DISC-25 | `dialog.tsx` | UI | **Basse** | Clé React utilise `bacId` supprimé |

**Total : 25 discrepancies — 6 Critiques, 8 Hautes, 4 Moyennes, 7 Basses**

---

## 6. Ordre d'implémentation recommandé

L'ordre respecte les dépendances (les fonctions sont créées avant d'être appelées) :

1. **`src/types/calculs.ts`** — Ajouter `PeriodeAlimentaireVague`, modifier `FCRTracePeriode`
   (retirer `bacId`, `bacNom`), modifier `FCRTraceVague` (retirer `modeLegacy`) [DISC-17 à 20]

2. **`src/lib/feed-periods.ts`** — Ajouter `interpolerPoidsVague`, `estimerNombreVivantsVague`,
   `segmenterPeriodesAlimentairesVague` [DISC-01 à 07]

3. **`src/lib/queries/analytics.ts`** — Mettre à jour `computeAlimentMetrics` et
   `getFCRTrace` [DISC-08 à 16]

4. **`src/components/analytics/fcr-transparency-dialog.tsx`** — Restructurer
   [DISC-21 à 25]

5. **`src/__tests__/lib/feed-periods.test.ts`** — Réécrire les tests per-bac en vague-level

Les anciennes fonctions (`interpolerPoidsBac`, `estimerNombreVivantsADate`,
`segmenterPeriodesAlimentaires`) peuvent être supprimées une fois leurs remplaçants opérationnels
et testés.
