# ADR — Seuils de confiance Gompertz

**Date :** 2026-03-31
**Statut :** ACCEPTÉ
**Story :** CR2.5
**Auteur :** @developer

---

## Contexte

La calibration Gompertz (`calibrerGompertz`) attribue un niveau de confiance qualitatif
(`LOW`, `MEDIUM`, `HIGH`) à chaque résultat de calibration. Ce niveau est affiché dans
l'interface et guide l'utilisateur sur la fiabilité des projections.

### Problème observé

Avec les seuils originaux, 5 points FAO parfaitement alignés sur une courbe Gompertz
(R² = 0.99) obtenaient `LOW`. C'est contre-intuitif : un excellent ajustement sur peu de
points mérite une confiance supérieure à un mauvais ajustement sur davantage de points.

**Anciens seuils (relatifs à `minPoints=5`) :**

| Condition | Niveau |
|-----------|--------|
| n < 5 | `INSUFFICIENT_DATA` (retourne null) |
| n = 5 ou 6 | `LOW` |
| n = 7, 8 ou 9 | `MEDIUM` |
| n ≥ 10 ET R² > 0.95 | `HIGH` |
| n ≥ 10 ET R² ≤ 0.95 | `MEDIUM` |

Problème fondamental : **R² n'était utilisé que pour discriminer HIGH vs MEDIUM au-delà
de 10 points**. Pour les plages LOW et MEDIUM, la qualité d'ajustement était ignorée.

---

## Décision : GO — Nouveaux seuils R²-sensibles

Les nouveaux seuils intègrent R² à tous les niveaux. La règle centrale :
**un R² élevé peut promouvoir le niveau de confiance même avec peu de points.**

### Nouveaux seuils (absolus, indépendants de `minPoints`)

| Condition (évaluée dans l'ordre) | Niveau |
|----------------------------------|--------|
| n < `minPoints` (défaut 5) | `INSUFFICIENT_DATA` (retourne null) |
| n ≥ 8 ET R² > 0.95 | `HIGH` |
| n ≥ 5 ET R² > 0.92 | `MEDIUM` |
| (sinon) n ≥ 5 | `LOW` |

### Raisonnement

1. **Seuil INSUFFICIENT_DATA inchangé** : le modèle Gompertz a 3 paramètres libres (W∞, K, ti).
   Avec 5 points, on dispose de 2 degrés de liberté — minimum acceptable pour valider la
   convergence LM. En dessous de 5, le système est quasi-indéterminé.

2. **R² > 0.92 pour MEDIUM** : en modélisation biologique, R² = 0.92 est le seuil
   communément utilisé comme "bon ajustement" (FAO, FISHBASE). En dessous, les paramètres
   sont trop incertains pour les projections de récolte.

3. **R² > 0.95 pour HIGH** : niveau standard pour une calibration "de haute qualité"
   en aquaculture. Ce seuil est cohérent avec l'ancien (≥10 pts, R²>0.95).

4. **n ≥ 8 requis pour HIGH** : avec seulement 5-7 points, même un R²=0.99 peut être dû
   à un sur-ajustement sur une portion de la courbe (ex. phase exponentielle uniquement).
   8 points garantissent une meilleure couverture des phases de la sigmoïde.

5. **Promotion par R²** : 5 points, R²=0.99 → `MEDIUM` (au lieu de `LOW`). C'est plus
   cohérent : l'utilisateur sait que l'ajustement est excellent mais que peu de points
   ont été collectés.

### Exemples concrets

| n | R² | Ancien | Nouveau | Commentaire |
|---|-----|--------|---------|-------------|
| 5 | 0.99 | `LOW` | `MEDIUM` | Fix principal — bon fit, peu de points |
| 5 | 0.85 | `LOW` | `LOW` | Fit moyen, peu de points → LOW |
| 6 | 0.94 | `LOW` | `MEDIUM` | R² > 0.92 → promu |
| 7 | 0.91 | `MEDIUM` | `LOW` | R² < 0.92 → pas de promotion |
| 7 | 0.93 | `MEDIUM` | `MEDIUM` | R² > 0.92 → MEDIUM |
| 8 | 0.96 | `MEDIUM` | `HIGH` | n ≥ 8 + R² > 0.95 → HIGH |
| 10 | 0.94 | `MEDIUM` | `MEDIUM` | R² entre 0.92 et 0.95 |
| 15 | 0.98 | `HIGH` | `HIGH` | Inchangé |

---

## Alternatives rejetées

### Alternative A : Seuils de comptage stricts (proposition initiale)
LOW (<8), MEDIUM (8-14), HIGH (15+, R²>0.95)

Rejeté : ne résout pas le cas "5 pts, R²=0.99" et introduit des discontinuités abruptes
basées uniquement sur le comptage.

### Alternative B : Score composite (α × n_score + β × R²_score)
Rejeté : trop complexe à expliquer à l'utilisateur et difficile à auditer. Les seuils
qualitatifs simples sont préférés pour la transparence.

---

## Impacts

- `src/lib/gompertz.ts` : `resolveConfidenceLevel()` mis à jour
- `src/__tests__/lib/gompertz.test.ts` : tests mis à jour pour refléter les nouveaux seuils
- Pas d'impact sur l'API, le stockage, ou l'UI (le champ `confidenceLevel` est inchangé)
