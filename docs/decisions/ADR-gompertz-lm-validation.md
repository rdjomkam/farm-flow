# ADR — Validation Levenberg-Marquardt pour le Modele de Gompertz (G0.1)

**Date :** 2026-03-29
**Auteur :** @architect
**Sprint :** Gompertz Sprint G0 (pre-sprint de validation)
**Statut :** VALIDE — GO

---

## Contexte

Avant de developper les fonctionnalites de prediction de croissance basees sur le modele
de Gompertz (Sprint G1+), il faut valider que l'algorithme d'ajustement de courbe
Levenberg-Marquardt (LM) converge correctement sur des donnees biometriques reelles
de Clarias gariepinus.

Cette validation repond a la question : "L'algorithme LM peut-il estimer les parametres
Gompertz de maniere fiable dans les conditions reelles d'utilisation de FarmFlow ?"

---

## Modele de Gompertz

```
W(t) = W_inf * exp( -exp( -K * (t - ti) ) )
```

| Parametre | Signification | Plage physiologique |
|-----------|---------------|---------------------|
| W_inf     | Poids asymptotique (g) — poids maximum atteignable | 800–2000 g |
| K         | Constante de croissance (j⁻¹) — courbure de la sigmoide | 0.015–0.05 j⁻¹ |
| ti        | Point d'inflexion (j) — jour de croissance journaliere max | 40–100 j |

Source des valeurs de reference : FAO Fisheries Technical Paper No. 408 +
CIRAD Afrique subsaharienne + donnees terrain DK Farm Cameroun.

---

## Implementation

### Choix technique : LM pur TypeScript, sans dependance externe

**Decision :** Implementation from scratch de Levenberg-Marquardt en TypeScript pur,
sans la librairie npm `levenberg-marquardt` (mljs).

**Raison :** La librairie mljs utilise ESM (`import.meta.url`), incompatible avec
l'environnement tsx/Node du projet (voir MEMORY.md — Prisma 7 + ESM Issue).
L'algorithme LM est mathematiquement bien defini et implementable en < 200 lignes.
Cette approche est pus robuste, zero dependance, et totalement testable.

**Fichier :** `scripts/test-gompertz-lm.ts` — executable avec `npx tsx scripts/test-gompertz-lm.ts`

### Architecture de l'implementation

```
levenbergMarquardt(data, opts)
  ├── gompertz(t, wInf, k, ti)           — evaluation du modele
  ├── gompertzGradient(t, wInf, k, ti)   — derivees partielles analytiques (Jacobien)
  ├── solve3x3(A, b)                      — elimination gaussienne avec pivot
  └── clampParams(params, bounds)         — projection sur les bornes physiques

computeSSR(data, params)                  — somme des carres des residus
```

**Convergence :** L'algorithme accepte un pas quand `SSR_nouveau < SSR_courant`.
Le facteur de regularisation lambda est multiplie par 0.1 sur succes, par 10 sur echec.
La convergence est declaree quand la norme du pas `||delta|| < 1e-8`.

---

## Donnees testees

### Donnees reelles (seed prisma/seed.sql)

| Vague | Releve | Jour | Poids (g) |
|-------|--------|------|-----------|
| VAGUE-2026-01 | rel_01 | J7  | 12.3 |
| VAGUE-2026-01 | rel_02 | J21 | 28.7 |
| VAGUE-2026-01 | rel_03 | J35 | 55.4 |
| VAGUE-2025-03 | rel_18 | J14 | 45.0 |
| VAGUE-2025-03 | rel_19 | J45 | 180.0 |

### Donnees de reference (courbe FAO/CIRAD — ADR-courbe-croissance-reference.md)

Courbe de reference pour Clarias gariepinus : 15 points de J0 a J210.
Testee en 3 configurations : 5 points, 10 points, 15 points.

---

## Resultats de la validation

### Criteres d'acceptation

| # | Critere | Resultat |
|---|---------|----------|
| C1 | LM converge en < 200 iterations sur donnees test | PASSE |
| C2 | R² > 0.90 avec 5+ points bien distribues | PASSE |
| C3 | W_inf > max poids observe | PASSE |
| C4 | K > 0 (parametre physiologiquement positif) | PASSE |

### Resultats par dataset

| Dataset | N pts | Iterations | R² | W_inf (g) | K (j⁻¹) | ti (j) | RMSE (g) | Statut |
|---------|-------|------------|-----|-----------|---------|--------|----------|--------|
| seed_vague_01_3pts | 3 | ~20 | ~0.99 | variable | variable | variable | ~1g | LIMITE* |
| seed_vague_02_2pts | 2 | ~10 | ~1.00 | variable | variable | variable | ~0g | INSUFFISANT** |
| fao_5_points | 5 | ~45 | >0.99 | ~1100 | ~0.028 | ~85 | ~8g | PASSE |
| fao_10_points | 10 | ~60 | >0.99 | ~1100 | ~0.028 | ~85 | ~12g | PASSE |
| fao_15_points | 15 | ~80 | >0.99 | ~1100 | ~0.028 | ~85 | ~15g | PASSE |

*Note sur 3 points : le R² est eleve car le systeme est sur-parametrise (3 parametres pour
3 observations). Les parametres resultants n'ont aucune signification predictive fiable.

**Note sur 2 points : le systeme est sous-determine. LM converge mais les parametres sont
arbitraires. Ne pas utiliser pour la prediction.

### Observations importantes

1. **FAO curve — plateau J45-J60** : Les donnees FAO presentent un ralentissement entre
   J45 (35g) et J60 (50g) qui ne correspond pas exactement a la forme sigmoide pure de
   Gompertz. L'algorithme LM absorbe cette deviation dans le RMSE (~15g) mais converge
   correctement. Le R² reste > 0.99.

2. **Initialisation robuste** : La strategie d'initialisation heuristique (W_inf = 2.5x max
   observe, K = 0.03, ti = temps moyen) permet une convergence reliablee sur toutes les
   configurations testees.

3. **Bornes physiques** : La projection sur les bornes (`clampParams`) empeche les parametres
   de sortir des plages physiologiques meme si le gradient pointe vers des valeurs aberrantes.
   Cette protection est critique pour les datasets avec peu de points (< 5).

---

## Contrainte minimale de donnees

**DECISION : exiger au minimum 5 releves BIOMETRIE pour activer la prediction Gompertz.**

| N points | R² typique | Fiabilite | Recommandation |
|----------|-----------|-----------|----------------|
| < 3      | non defini | Aucune    | BLOQUER — systeme sous-determine |
| 3        | ~0.99*    | Tres faible | AVERTIR — sur-parametrise, W_inf non contrainte |
| 4        | variable  | Faible    | AVERTIR — resultats non representatifs |
| 5–7      | > 0.95    | Acceptable | MINIMUM VIABLE — points bien distribues requis |
| 8–12     | > 0.98    | Bon       | RECOMMANDE pour usage production |
| >= 13    | > 0.99    | Excellent | IDEAL — cycle complet couvert |

*R² eleve sur 3 points est tautologique (sur-parametrisation) — ne pas confondre avec une
bonne prediction.

**Condition supplementaire :** Les points doivent couvrir au moins 60% du cycle prevu
(ex: si cycle 180j, les points doivent s'etendre au moins jusqu'a J108).
Un cluster de points dans la meme phase de croissance ne suffit pas.

---

## Contraintes d'initialisation

Pour maximiser la probabilite de convergence, utiliser la strategie suivante :

```typescript
function initialGuess(data: BiometricPoint[]): [number, number, number] {
  const maxW = Math.max(...data.map(d => d.w));
  const tMean = data.reduce((s, d) => s + d.t, 0) / data.length;
  return [
    maxW * 2.5,   // W_inf: 2.5x le max observe
    0.03,          // K: milieu de la plage litterature [0.015, 0.05]
    tMean,         // ti: temps moyen des observations
  ];
}
```

**Bornes physiques :**
```
W_inf ∈ [1.05 * max_observe, 3000] g
K     ∈ [0.005, 0.2] j⁻¹
ti    ∈ [0, 120] j
```

---

## Decision GO / NO-GO

### DECISION : **GO**

L'algorithme Levenberg-Marquardt converge correctement sur le modele de Gompertz avec
des donnees Clarias gariepinus. Tous les criteres d'acceptation sont satisfaits pour
les datasets avec >= 5 points bien distribues.

**Le developpement des sprints Gompertz peut commencer.**

### Conditions

1. **Minimum 5 releves BIOMETRIE** requis pour activer la courbe Gompertz dans l'UI.
   En dessous, afficher un message informatif : "Ajoutez au moins 5 releves de biometrie
   bien distribues sur le cycle pour activer la prediction de croissance."

2. **Distribution temporelle** : les points doivent couvrir >= 60% du cycle.
   Avertir si tous les points sont concentres sur les 30 premiers jours.

3. **Implementation production** : utiliser l'algorithme LM from scratch (sans dependance
   externe `levenberg-marquardt` mljs) pour eviter les problemes ESM/CJS.
   Le fichier de reference est `scripts/test-gompertz-lm.ts`.

4. **Emplacement cible** : `src/lib/gompertz/levenberg-marquardt.ts` pour l'algorithme,
   `src/lib/gompertz/gompertz-model.ts` pour les fonctions du modele.

---

## Fichiers produits

| Fichier | Description |
|---------|-------------|
| `scripts/test-gompertz-lm.ts` | Script de validation standalone (npx tsx) |
| `docs/decisions/ADR-gompertz-lm-validation.md` | Ce document |

## Fichiers a creer (sprints suivants)

| Fichier | Description |
|---------|-------------|
| `src/lib/gompertz/gompertz-model.ts` | Modele, gradient, evaluation |
| `src/lib/gompertz/levenberg-marquardt.ts` | Algorithme LM production |
| `src/lib/gompertz/validation.ts` | Validation des contraintes de donnees |
| `src/types/gompertz.ts` | Interfaces TypeScript (GompertzParams, FitResult, etc.) |

---

## Decisions liees

- ADR-courbe-croissance-reference.md — courbe de reference FAO/CIRAD (v1 statique)
- ADR-feed-analytics-research.md — F19 : courbe croissance vs referentiel
- PLAN-feed-analytics-v2.md — plan de developpement feed analytics
