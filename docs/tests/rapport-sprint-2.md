# Rapport de tests — Sprint 2

**Date :** 2026-03-08
**Auteur :** @tester
**Outil :** Vitest 4.0.18
**Commande :** `npx vitest run`

---

## Resultat global

| Metrique | Valeur |
|----------|--------|
| Fichiers de test | 4 |
| Tests totaux | 108 |
| Tests reussis | 108 |
| Tests echoues | 0 |
| Duree totale | ~764ms |

**Verdict : TOUS LES TESTS PASSENT**

---

## Story 2.2 — Tests des fonctions de calcul

**Fichier :** `src/__tests__/calculs.test.ts` (42 tests)

### calculerTauxSurvie — 9 tests
- Calcul avec valeurs realistes (500 alevins, 450 survivants = 90%)
- 100% quand aucune mortalite
- 0% quand aucun survivant
- null si nombreInitial = 0 (division par zero)
- null si nombreInitial negatif
- null si nombreVivants null
- null si nombreInitial null
- null si les deux null
- Mortalite elevee de silures (2000 → 1200 = 60%)

### calculerGainPoids — 7 tests
- Gain positif alevin 5g → 150g
- Gain adultes 300g → 500g
- Pas de changement = 0
- Perte de poids (stress/maladie)
- null sur parametres null

### calculerSGR — 9 tests
- Croissance rapide alevin : 5g → 150g en 60j ≈ 5.67%/jour
- Croissance moderee : 100g → 200g en 30j ≈ 2.31%/jour
- Croissance lente : 200g → 210g en 30j ≈ 0.163%/jour
- null si poids = 0, jours = 0, negatifs, ou null

### calculerFCR — 9 tests
- FCR realiste : 50kg aliment / 40kg gain = 1.25
- FCR ideal = 1.0
- FCR mauvais = 2.0
- null si gain = 0 (division par zero), gain negatif, parametres null
- FCR = 0 quand pas d'alimentation

### calculerBiomasse — 8 tests
- Valeurs realistes : 500 × 150g = 75 kg
- Alevins : 2000 × 5g = 10 kg
- Adultes : 300 × 500g = 150 kg
- 0 quand pas de poissons ou poids = 0
- null sur parametres null

---

## Story 2.5 — Tests d'integration des API routes

### API Bacs — `src/__tests__/api/bacs.test.ts` (12 tests)

**GET /api/bacs (3 tests)**
- Liste des bacs avec total
- Liste vide
- Erreur serveur 500

**POST /api/bacs (9 tests)**
- Creation avec donnees valides (201)
- Creation avec nombrePoissons optionnel (201)
- 400 si nom manquant
- 400 si nom vide (espaces)
- 400 si volume manquant
- 400 si volume = 0
- 400 si volume negatif
- 400 avec plusieurs erreurs simultanees
- 400 si nombrePoissons negatif

### API Vagues — `src/__tests__/api/vagues.test.ts` (23 tests)

**GET /api/vagues (3 tests)**
- Liste avec total et joursEcoules calcule
- Filtre par statut EN_COURS
- Liste vide

**POST /api/vagues (10 tests)**
- Creation avec donnees valides (201, bacIds assignes)
- 400 si code manquant
- 400 si dateDebut invalide
- 400 si nombreInitial = 0
- 400 si nombreInitial pas entier (3.5)
- 400 si poidsMoyenInitial manquant
- 400 si bacIds vide
- 409 si bac deja assigne (regle metier)
- 409 si code deja utilise
- 404 si bac introuvable

**GET /api/vagues/[id] (3 tests)**
- Detail avec indicateurs complets
- Indicateurs par defaut (null) quand pas de donnees
- 404 pour vague inexistante

**PUT /api/vagues/[id] (7 tests)**
- Cloture avec TERMINEE + dateFin (200, bacs liberes)
- 400 si TERMINEE sans dateFin
- 400 si statut invalide
- 404 pour vague inexistante
- 409 si vague deja cloturee
- Ajout de bacs (addBacIds)
- 409 si bac a ajouter deja assigne

### API Releves — `src/__tests__/api/releves.test.ts` (31 tests)

**GET /api/releves (4 tests)**
- Liste sans filtre
- Filtre par vagueId
- Filtre par typeReleve
- Filtre par bacId + plage de dates
- 400 pour typeReleve invalide

**POST Biometrie (4 tests)**
- Creation valide (201)
- 400 si poidsMoyen manquant
- 400 si tailleMoyenne manquante
- 400 si echantillonCount = 0

**POST Mortalite (3 tests)**
- Creation valide (201)
- 400 si causeMortalite invalide
- 400 si nombreMorts negatif

**POST Alimentation (4 tests)**
- Creation valide (201)
- 400 si typeAliment invalide
- 400 si quantiteAliment = 0
- 400 si frequenceAliment pas entier

**POST Qualite Eau (2 tests)**
- Creation valide avec tous les champs (201)
- Creation valide sans champs optionnels (201)

**POST Comptage (3 tests)**
- Creation valide (201)
- 400 si methodeComptage invalide
- 400 si nombreCompte negatif

**POST Observation (2 tests)**
- Creation valide (201)
- 400 si description vide

**Validation commune (7 tests)**
- 400 si typeReleve manquant
- 400 si typeReleve invalide
- 400 si date manquante
- 400 si vagueId manquant
- 400 si bacId manquant
- 404 si vague introuvable
- 409 si bac n'appartient pas a la vague
- 409 si vague cloturee

---

## Regles metier verifiees

1. **Un bac ne peut etre assigne qu'a une seule vague** — verifie via 409 Conflict
2. **Le code de vague est unique** — verifie via 409 Conflict
3. **Un releve ne peut etre ajoute qu'a une vague EN_COURS** — verifie via 409
4. **Le bac doit appartenir a la vague** — verifie via 409
5. **La cloture libere les bacs** — verifie via mock de updateVague
6. **Division par zero geree** — null retourne dans les calculs
7. **Tous les types de releve valides** — 6 types testes (biometrie, mortalite, alimentation, qualite_eau, comptage, observation)

---

## Approche de test

- **Tests unitaires** (calculs) : appel direct des fonctions pures
- **Tests d'integration** (API) : appel des handlers Next.js avec mocks des fonctions de requete Prisma
- Les mocks permettent de tester la logique de validation et de routage HTTP sans base de donnees
- Les erreurs metier sont testees via les messages d'erreur remontes par les fonctions de requete

---

## Fichiers de test

| Fichier | Tests | Description |
|---------|-------|-------------|
| `src/__tests__/calculs.test.ts` | 42 | Fonctions de calcul pures |
| `src/__tests__/api/bacs.test.ts` | 12 | API routes bacs |
| `src/__tests__/api/vagues.test.ts` | 23 | API routes vagues + detail + cloture |
| `src/__tests__/api/releves.test.ts` | 31 | API routes releves (6 types) |

## Configuration

- `vitest.config.ts` — alias `@/` vers `src/`
- Scripts : `npm test` (run), `npm run test:watch` (watch)
