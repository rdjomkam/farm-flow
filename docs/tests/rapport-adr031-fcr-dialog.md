# Rapport de test — ADR-031 FCR Transparency Dialog

**Date :** 2026-04-05
**Testeur :** @tester
**ADR :** ADR-031 — FCR Transparency Dialog
**Fichier de tests :** `src/__tests__/lib/feed-periods.test.ts`

---

## Contexte

ADR-031 ajoute un dialog de transparence FCR qui expose la trace d'audit complète du
calcul FCR depuis les données brutes jusqu'à la valeur finale. Le changement technique
principal est l'enrichissement du type de retour de `interpolerPoidsBac` avec un champ
`detail: FCRTraceEstimationDetail` qui documente comment chaque estimation de poids a
été produite.

Ce rapport couvre les tests unitaires ajoutés pour valider ce champ `detail`.

---

## Tests ajoutés

### Suite : `interpolerPoidsBac — detail FCRTraceEstimationDetail (ADR-031)`

14 tests couvrant les 5 méthodes d'estimation + compatibilité rétrograde.

| # | Nom du test | Méthode couverte | Résultat |
|---|-------------|-----------------|----------|
| 1 | BIOMETRIE_EXACTE : detail contient methode, dateBiometrie et poidsMesureG | BIOMETRIE_EXACTE | PASS |
| 2 | BIOMETRIE_EXACTE : poidsMesureG correspond exactement a la valeur de la biometrie | BIOMETRIE_EXACTE | PASS |
| 3 | INTERPOLATION_LINEAIRE : detail contient methode, pointAvant, pointApres et ratio | INTERPOLATION_LINEAIRE | PASS |
| 4 | INTERPOLATION_LINEAIRE : ratio reflete la position proportionnelle dans l'intervalle | INTERPOLATION_LINEAIRE | PASS |
| 5 | INTERPOLATION_LINEAIRE : extrapolation (date apres toutes les biometries) -> pointApres null et ratio null | INTERPOLATION_LINEAIRE extrapolation | PASS |
| 6 | GOMPERTZ_BAC : detail contient methode, tJours, params et resultatG | GOMPERTZ_BAC | PASS |
| 7 | GOMPERTZ_BAC : params.wInfinity correspond au contexte bac (pas au contexte vague) | GOMPERTZ_BAC isolation | PASS |
| 8 | GOMPERTZ_VAGUE : detail contient methode, tJours, params et resultatG | GOMPERTZ_VAGUE | PASS |
| 9 | GOMPERTZ_VAGUE : tJours calcule correctement a partir de vagueDebut | GOMPERTZ_VAGUE tJours | PASS |
| 10 | GOMPERTZ_VAGUE (fallback depuis GOMPERTZ_BAC sans contexte bac) : detail.methode = GOMPERTZ_VAGUE | GOMPERTZ_BAC -> fallback VAGUE | PASS |
| 11 | VALEUR_INITIALE : detail contient methode et poidsMoyenInitialG quand aucune biometrie | VALEUR_INITIALE | PASS |
| 12 | VALEUR_INITIALE : detail contient la valeur poidsInitial correcte | VALEUR_INITIALE | PASS |
| 13 | VALEUR_INITIALE : date avant toutes les biometries -> detail.poidsMoyenInitialG = poidsInitial | VALEUR_INITIALE fallback | PASS |
| 14 | backward compat : les champs poids et methode sont toujours presentes (detail est additif) | Rétrocompatibilité | PASS |

---

## Vérifications par méthode

### BIOMETRIE_EXACTE
- `detail.methode === "BIOMETRIE_EXACTE"` — discriminant correct
- `detail.dateBiometrie` correspond à la date de la biométrie utilisée
- `detail.poidsMesureG` correspond à la valeur mesurée

### INTERPOLATION_LINEAIRE
- `detail.methode === "INTERPOLATION_LINEAIRE"` — discriminant correct
- `detail.pointAvant.poidsMoyenG` et `detail.pointAvant.date` présents
- `detail.pointApres.poidsMoyenG` et `detail.pointApres.date` présents
- `detail.ratio` calculé correctement : `(targetDate - dateAvant) / (dateApres - dateAvant)`
- Cas extrapolation (date après toutes biométries) : `detail.pointApres === null`, `detail.ratio === null`

### GOMPERTZ_BAC
- `detail.methode === "GOMPERTZ_BAC"` — discriminant correct
- `detail.tJours === (targetDate - vagueDebut) / ms_per_day`
- `detail.params` : tous les champs du contexte bac (wInfinity, k, ti, r2, biometrieCount, confidenceLevel)
- `detail.params.wInfinity` correspond au contexte BAC (pas au contexte VAGUE quand les deux sont fournis)
- `detail.resultatG === result.poids` — cohérence entre la valeur retournée et le détail

### GOMPERTZ_VAGUE
- `detail.methode === "GOMPERTZ_VAGUE"` — discriminant correct (y compris en fallback depuis GOMPERTZ_BAC)
- `detail.tJours` calculé depuis `vagueDebut` du contexte vague
- `detail.params` : tous les champs du contexte vague
- `detail.resultatG === result.poids`

### VALEUR_INITIALE
- `detail.methode === "VALEUR_INITIALE"` — discriminant correct
- `detail.poidsMoyenInitialG === poidsInitial` — paramètre passé à la fonction

---

## Compatibilité rétrograde

Les tests ADR-028, ADR-029 et ADR-030 existants (76 tests) ont tous passé sans
modification. Le champ `detail` est strictement additif : les propriétés `poids`
et `methode` restent inchangées dans tous les cas.

---

## Résultats de la suite complète

### feed-periods.test.ts

```
Test Files   1 passed (1)
Tests        90 passed (90)
```

- 76 tests existants (ADR-028 / ADR-029 / ADR-030) : tous PASS
- 14 nouveaux tests (ADR-031) : tous PASS

### Suite complète du projet

```
Test Files   8 failed | 126 passed (134)
Tests        24 failed | 4180 passed
```

Les 8 fichiers en échec et leurs 24 tests sont des régressions **pré-existantes**
non liées à ADR-031 :

| Fichier | Tests en échec | Cause |
|---------|----------------|-------|
| `check-subscription.test.ts` | 1 | Logique subscription (null → isBlocked) |
| `quota-enforcement.test.ts` | 1 | Attente `QUOTA_DEPASSE` vs `NO_SUBSCRIPTION` |
| `proxy-redirect.test.ts` | 22 | Comportement middleware redirect |

Ces échecs existaient avant ce sprint et ne sont pas liés à `interpolerPoidsBac` ni
à `FCRTraceEstimationDetail`.

---

## Build

```
npm run build → SUCCESS (0 erreurs TypeScript, 0 erreurs de build)
```

Seul un warning non bloquant : `Next.js inferred your workspace root` (présent dans
tous les sprints précédents).

---

## Conclusion

L'implémentation ADR-031 est correcte :

1. `interpolerPoidsBac` retourne désormais `detail: FCRTraceEstimationDetail` pour
   chaque méthode d'estimation, avec les champs attendus par ADR-031.
2. Le champ `detail` est strictement additif : aucune régression sur les tests
   existants (ADR-028 / ADR-029 / ADR-030).
3. Le build TypeScript passe sans erreur.
4. Les types `FCRTraceEstimationDetail` et ses sous-types sont définis dans
   `src/types/calculs.ts` et correspondent exactement aux valeurs retournées.
