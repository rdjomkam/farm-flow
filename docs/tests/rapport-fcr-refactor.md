# Rapport de test — FCR Refactor (ADR-028)
**Date :** 2026-04-05
**Auteur :** @tester
**Fichier source :** `src/lib/feed-periods.ts`
**Fichier tests :** `src/__tests__/lib/feed-periods.test.ts`
**ADR reference :** `docs/decisions/ADR-028-fcr-feed-switch-accuracy.md`

---

## Resultat global

| Verification | Resultat |
|---|---|
| Tests feed-periods (nouveau) | **31/31 passes** |
| Suite complete `npx vitest run` | 4121 passes, 24 echecs pre-existants (inchanges) |
| `npm run build` | **Succes** — 0 erreur TypeScript, 0 avertissement |
| Regression introduite | **Aucune** |

---

## Tests unitaires : `interpolerPoidsBac`

| # | Cas de test | Methode attendue | Resultat |
|---|---|---|---|
| 1 | Biometrie exacte le meme jour | `BIOMETRIE_EXACTE` | PASSE |
| 2 | Meme jour, heure differente (08h vs 18h) | `BIOMETRIE_EXACTE` | PASSE |
| 3 | Interpolation lineaire, milieu exact | `INTERPOLATION_LINEAIRE` | PASSE |
| 4 | Interpolation lineaire, 2/3 du chemin | `INTERPOLATION_LINEAIRE` | PASSE |
| 5 | Date avant toutes les biometries | `VALEUR_INITIALE` | PASSE |
| 6 | Date apres toutes les biometries | `BIOMETRIE_EXACTE` (derniere connue) | PASSE |
| 7 | Aucune biometrie pour ce bac (autre bac present) | `VALEUR_INITIALE` | PASSE |
| 8 | Tableau biometries vide | `VALEUR_INITIALE` | PASSE |
| 9 | bacId null : filtre uniquement les biometries null | `BIOMETRIE_EXACTE` | PASSE |
| 10 | Biometrie unique le meme jour | `BIOMETRIE_EXACTE` | PASSE |

### Valeurs numeriques verifiees

- Interpolation lineaire (J0=10g, J10=20g, cible J5) → 15.0g exact
- Interpolation lineaire (J0=100g, J30=160g, cible J20) → 140.0g (precision 3 decimales)

---

## Tests unitaires : `segmenterPeriodesAlimentaires`

| # | Cas de test | Resultat attendu | Resultat |
|---|---|---|---|
| 1 | Entrees vides | Tableau vide | PASSE |
| 2 | Releves sans consommations | Tableau vide | PASSE |
| 3 | Bac unique, produit unique | 1 periode | PASSE |
| 4 | Bac unique, produit unique — bornes de date | dateDebut/dateFin correctes | PASSE |
| 5 | Bac unique, changement produit | 2 periodes | PASSE |
| 6 | Changement produit — bornes par periode | Dates correctes par periode | PASSE |
| 7 | Deux bacs, produits differents | 2 periodes separees par bac | PASSE |
| 8 | Deux bacs, bac-A switch + bac-B stable | 3 periodes (2 pour A, 1 pour B) | PASSE |
| 9 | bacId null → bacId resultat = "unknown" | `bacId === "unknown"` | PASSE |
| 10 | bacId null → nombreVivants = nombreInitial vague | `nombreVivants === 800` | PASSE |
| 11 | Gain de biomasse negatif | `gainBiomasseKg === null` | PASSE |
| 12 | Calcul gainBiomasseKg avec biometrie exacte | 20.0 kg exact | PASSE |
| 13 | Calcul gainBiomasseKg avec interpolation lineaire | 5.0 kg (precision 3 dec.) | PASSE |
| 14 | methodeEstimation = BIOMETRIE_EXACTE (deux bornes exactes) | `"BIOMETRIE_EXACTE"` | PASSE |
| 15 | methodeEstimation = VALEUR_INITIALE (aucune biometrie) | `"VALEUR_INITIALE"` | PASSE |
| 16 | Produit principal = celui avec quantiteKg max | prod-Y selectionne (2kg > 0.5kg) | PASSE |
| 17 | quantiteKg ne totalise que le produit de la periode | 4 kg (pas 4.6) | PASSE |
| 18 | nombreVivants : distribution equitable si null sur bac | 500 (1000/2) | PASSE |
| 19 | Scenario complet mono-aliment | 15 kg aliment, 20 kg gain | PASSE |
| 20 | Scenario switch partiel ADR-028 | 3 periodes, gains positifs | PASSE |
| 21 | Releves en entree desordres → tries par date | dateDebut/dateFin correctes | PASSE |

---

## Verification de non-regression

Les fichiers de tests precedents lies aux analytics aliments ont ete controles :

| Fichier de test | Statut avant refactor | Statut apres refactor |
|---|---|---|
| `src/__tests__/lib/feed-analytics-calculs.test.ts` | PASSE | PASSE (inchange) |
| `src/__tests__/lib/feed-analytics-benchmarks.test.ts` | PASSE | PASSE (inchange) |
| `src/__tests__/lib/feed-analytics-fournisseurs.test.ts` | PASSE | PASSE (inchange) |
| `src/__tests__/api/analytics-aliments.test.ts` | PASSE | PASSE (inchange) |
| `src/__tests__/api/feed-analytics-validation.test.ts` | PASSE | PASSE (inchange) |
| `src/__tests__/calculs.test.ts` | PASSE | PASSE (inchange) |

---

## Echecs pre-existants (hors perimetre)

Les 24 echecs identifies dans la suite complete existaient avant ce refactor et ne sont
pas lies au module `feed-periods.ts`. Ils concernent :

- `abonnements-statut-middleware.test.ts` — mock vitest incompatible (`getSubscriptionStatusForSite`)
- `permissions.test.ts` — compte de permissions attendu obsolete (47 → plus recents)
- `api/bacs.test.ts` — limite plan DECOUVERTE
- `api/vagues.test.ts` et `api/vagues-distribution.test.ts` — logique d'assignation bac
- `integration/quota-enforcement.test.ts` — quota DECOUVERTE
- `lib/check-subscription.test.ts` — null → false
- `middleware/proxy-redirect.test.ts` — subscription API unavailable en test

Aucun de ces echecs n'est introduit par ce refactor.

---

## Couverture des cas de degradation gracieuse (ADR-028)

| Regle ADR | Implementation | Couverture test |
|---|---|---|
| Aucune biometrie par bac → `gainBiomasseKg = null` | Oui — `interpolerPoidsBac` retourne VALEUR_INITIALE, debut = fin → gain = null | Cas #15 |
| Mono-aliment → resultat identique algorithme precedent | Oui — une seule periode par bac | Cas #19 |
| Releves sans `bacId` → bac "unknown" | Oui — bacGroups avec cle `null` → bacId = "unknown" | Cas #9, #10 |
| Gain de biomasse negatif → exclu | Oui — `rawGain > 0 ? rawGain : null` | Cas #11 |
| Vague avec un seul bac → identique precedent | Inclus dans cas #3, #4, #5, #6, #19 | Couvre |

---

## Validation des formules

### interpolation lineaire
```
poids(t) = poids_avant + (poids_apres - poids_avant) * (t - t_avant) / (t_apres - t_avant)
```
Verifie avec :
- J0=10g, J10=20g, t=J5 → 15.0g (exacte)
- J0=100g, J30=160g, t=J20 → 140.0g (precis a 3 decimales)
- Cas utilisé dans gainBiomasseKg : J0=10g, J20=30g, t=J5 → 15g, t=J15 → 25g, gain=(25-15)*500/1000=5kg

### gainBiomasseKg
```
gain = (poidsMoyenFin - poidsMoyenDebut) * nombreVivants / 1000
```
Verifie avec 500 poissons, debut 10g, fin 50g → 20 kg.

---

## Fichiers produits

- `src/__tests__/lib/feed-periods.test.ts` — 31 tests unitaires
- `docs/tests/rapport-fcr-refactor.md` — ce rapport
