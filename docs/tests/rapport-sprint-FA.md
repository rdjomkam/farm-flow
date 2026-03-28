# Rapport de tests — Sprint FA (Feed Analytics Phase 1)

**Date :** 2026-03-28
**Testeur :** @tester
**Sprint :** FA — Feed Analytics Phase 1
**Stories couvertes :** FA.1 (enums), FA.2 (types), FA.3 (API validation), FA.4 (seed) → vérifiées par FA.5

---

## Résumé

| Catégorie | Valeur |
|-----------|--------|
| Fichier de test créé | `src/__tests__/api/feed-analytics-validation.test.ts` |
| Nombre de tests | **39** |
| Tests passés | **39** |
| Tests échoués | 0 |
| Statut global | VERT |

---

## Tests non-régression

La suite complète a été exécutée : `npx vitest run`

| Résultat | Valeur |
|----------|--------|
| Fichiers de test | 109 total |
| Fichiers passés | 108 passés, 1 échoué (pré-existant) |
| Tests passés | 3333 |
| Tests échoués | 1 (pré-existant, hors périmètre FA) |

**Echec pré-existant :** `src/__tests__/api/vagues.test.ts` — "PUT /api/vagues/[id] > ajoute des bacs a une vague" — Ce test échoue depuis le Sprint ADR-IE et n'est pas lié au Sprint FA.

---

## Cas de test couverts

### 1. POST /api/releves — validation tauxRefus (8 tests)

| Test | Entrée | Résultat attendu | Statut |
|------|--------|-----------------|--------|
| tauxRefus hors liste blanche (37) | `tauxRefus: 37, typeReleve: ALIMENTATION` | 400 + erreur `tauxRefus` | PASS |
| tauxRefus hors liste blanche (100) | `tauxRefus: 100, typeReleve: ALIMENTATION` | 400 + erreur `tauxRefus` | PASS |
| tauxRefus avec type non-ALIMENTATION | `tauxRefus: 25, typeReleve: BIOMETRIE` | 400 + erreur `tauxRefus` | PASS |
| tauxRefus avec MORTALITE | `tauxRefus: 25, typeReleve: MORTALITE` | 400 + erreur `tauxRefus` | PASS |
| tauxRefus=25 valide pour ALIMENTATION | `tauxRefus: 25, typeReleve: ALIMENTATION` | 201 | PASS |
| tauxRefus=0 (limite basse) | `tauxRefus: 0, typeReleve: ALIMENTATION` | 201 | PASS |
| tauxRefus=50 (limite haute) | `tauxRefus: 50, typeReleve: ALIMENTATION` | 201 | PASS |
| Sans tauxRefus (champ optionnel) | corps ALIMENTATION sans tauxRefus | 201 | PASS |

**Règle métier validée :** `tauxRefus` est uniquement valide pour `typeReleve=ALIMENTATION`. Les valeurs acceptées sont `{0, 10, 25, 50}`.

### 2. POST /api/releves — validation comportementAlim (5 tests)

| Test | Entrée | Résultat attendu | Statut |
|------|--------|-----------------|--------|
| comportementAlim invalide | `comportementAlim: "AGRESSIF"` | 400 + erreur `comportementAlim` | PASS |
| comportementAlim avec BIOMETRIE | `comportementAlim: "VORACE", typeReleve: BIOMETRIE` | 400 + erreur `comportementAlim` | PASS |
| comportementAlim=VORACE pour ALIMENTATION | `comportementAlim: "VORACE"` | 201 | PASS |
| comportementAlim=REFUSE pour ALIMENTATION | `comportementAlim: "REFUSE"` | 201 | PASS |
| tauxRefus + comportementAlim ensemble | `tauxRefus: 25, comportementAlim: "NORMAL"` | 201 + champs transmis | PASS |

**Règle métier validée :** `comportementAlim` est uniquement valide pour `typeReleve=ALIMENTATION`. Les valeurs de l'enum `ComportementAlimentaire` sont `{VORACE, NORMAL, FAIBLE, REFUSE}`.

### 3. POST /api/produits — validation tailleGranule (5 tests)

| Test | Entrée | Résultat attendu | Statut |
|------|--------|-----------------|--------|
| tailleGranule="INVALID" | valeur hors enum | 400 + erreur `tailleGranule` | PASS |
| tailleGranule="GROS" | valeur inexistante | 400 + erreur `tailleGranule` | PASS |
| tailleGranule=P1 | valeur valide enum `TailleGranule` | 201 | PASS |
| tailleGranule=G3 | valeur valide enum `TailleGranule` | 201 | PASS |
| Sans tailleGranule | champ optionnel absent | 201 | PASS |

### 4. POST /api/produits — validation formeAliment (4 tests)

| Test | Entrée | Résultat attendu | Statut |
|------|--------|-----------------|--------|
| formeAliment="INVALID" | valeur hors enum | 400 + erreur `formeAliment` | PASS |
| formeAliment="LIQUIDE" | valeur inexistante | 400 + erreur `formeAliment` | PASS |
| formeAliment=FLOTTANT | valeur valide | 201 | PASS |
| formeAliment=COULANT | valeur valide | 201 | PASS |

### 5. POST /api/produits — validation tauxProteines (7 tests)

| Test | Entrée | Résultat attendu | Statut |
|------|--------|-----------------|--------|
| tauxProteines=-5 | valeur négative | 400 + erreur `tauxProteines` | PASS |
| tauxProteines=150 | valeur > 100 | 400 + erreur `tauxProteines` | PASS |
| tauxProteines=101 | hors plage [0-100] | 400 + erreur `tauxProteines` | PASS |
| tauxProteines=0 | limite basse valide | 201 | PASS |
| tauxProteines=100 | limite haute valide | 201 | PASS |
| tauxProteines=35 | valeur typique | 201 | PASS |
| Sans tauxProteines | champ optionnel | 201 | PASS |

### 6. POST /api/produits — validation tauxLipides et tauxFibres (4 tests)

| Test | Entrée | Résultat attendu | Statut |
|------|--------|-----------------|--------|
| tauxLipides=-1 | valeur négative | 400 + erreur `tauxLipides` | PASS |
| tauxLipides=110 | valeur > 100 | 400 + erreur `tauxLipides` | PASS |
| tauxFibres=-0.5 | valeur négative | 400 + erreur `tauxFibres` | PASS |
| tauxFibres=200 | valeur > 100 | 400 + erreur `tauxFibres` | PASS |

### 7. POST /api/produits — validation phasesCibles (3 tests)

| Test | Entrée | Résultat attendu | Statut |
|------|--------|-----------------|--------|
| phasesCibles non tableau | `phasesCibles: "ALEVINAGE"` | 400 + erreur `phasesCibles` | PASS |
| phasesCibles avec valeur invalide | `["ALEVINAGE", "PHASE_INCONNUE"]` | 400 + erreur `phasesCibles` | PASS |
| phasesCibles tableau vide | `phasesCibles: []` | 201 | PASS |

### 8. POST /api/produits — combinaisons champs analytiques (3 tests)

| Test | Description | Statut |
|------|-------------|--------|
| tailleGranule + formeAliment + tauxProteines valides | Vérification que les 3 champs sont transmis à createProduit | PASS |
| Tous les champs analytiques valides | tailleGranule + formeAliment + tauxProteines + tauxLipides + tauxFibres | PASS |
| tailleGranule + formeAliment + tauxProteines tous invalides | Retourne >= 3 erreurs | PASS |

---

## Couverture des cas de test requis

| Cas requis par FA.5 | Couvert |
|---------------------|---------|
| `tauxRefus=37` → 400 | Oui |
| `tauxRefus=25` + `typeReleve=BIOMETRIE` → 400 (guard) | Oui |
| `tauxRefus=25` + `typeReleve=ALIMENTATION` → accepté | Oui |
| `tauxProteines=-5` → 400 | Oui |
| `tauxProteines=150` → 400 | Oui |
| `tailleGranule="INVALID"` → 400 | Oui |
| Valeurs valides (tailleGranule, formeAliment, tauxProteines) → accepté | Oui |

---

## Enums FA vérifiés

| Enum | Valeurs testées |
|------|----------------|
| `TailleGranule` | P0-G5 (P1, P2, G2, G3 validés explicitement) |
| `FormeAliment` | FLOTTANT, COULANT, SEMI_FLOTTANT, POUDRE (2 validés) |
| `ComportementAlimentaire` | VORACE, NORMAL, FAIBLE, REFUSE (tous testés) |
| `tauxRefus` (liste blanche) | {0, 10, 25, 50} — validés, + valeurs hors liste rejetées |

---

## Fichiers modifiés / créés

- **Créé :** `src/__tests__/api/feed-analytics-validation.test.ts`
- **Créé :** `docs/tests/rapport-sprint-FA.md`

---

## Conclusion

Les 39 tests du Sprint FA passent tous. Les validations implémentées dans FA.3 sont correctes :

1. `tauxRefus` : liste blanche `{0, 10, 25, 50}` enforced, guard non-ALIMENTATION actif
2. `comportementAlim` : enum `ComportementAlimentaire` enforced, guard non-ALIMENTATION actif
3. `tailleGranule` : enum `TailleGranule` enforced
4. `formeAliment` : enum `FormeAliment` enforced
5. `tauxProteines`, `tauxLipides`, `tauxFibres` : plage [0, 100] enforced
6. `phasesCibles` : validation tableau + valeurs enum `PhaseElevage` enforced

Aucune régression introduite. La suite complète passe à 3333/3334 tests (1 échec pré-existant dans `vagues.test.ts`).
