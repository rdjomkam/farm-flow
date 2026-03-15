# Rapport de tests — Sprint 22 (UX Guidee & Instructions)

**Sprint :** 22
**Tester :** @tester
**Date :** 2026-03-15
**Statut final :** PASSE

---

## Resume

| Metrique | Valeur |
|----------|--------|
| Tests avant Sprint 22 | 1436 (48 fichiers) |
| Tests apres Sprint 22 | 1489 (49 fichiers) |
| Nouveaux tests ajoutes | 53 |
| Tests en echec | 0 |
| Build OK | Oui |
| Regressions detectees | 0 |

---

## Fichiers de test crees

### `src/__tests__/sprint22.test.ts` — 53 tests

Couvre les nouvelles fonctionnalites Sprint 22 non encore testees dans les fichiers existants.

---

## Stories testees

### S16-3 — Lien activite→releve (23 tests)

**Constantes testees :** `RELEVE_COMPATIBLE_TYPES` et `ACTIVITE_RELEVE_TYPE_MAP` (depuis `src/types/api.ts`)

**Tests — RELEVE_COMPATIBLE_TYPES (11 tests) :**
- Contient exactement 4 types : ALIMENTATION, BIOMETRIE, QUALITE_EAU, COMPTAGE
- N'inclut pas : NETTOYAGE, TRAITEMENT, RECOLTE, TRI, MEDICATION, AUTRE

**Tests — ACTIVITE_RELEVE_TYPE_MAP (12 tests) :**
- Chaque type compatible mappe vers le bon TypeReleve
- Les types sans releve retournent `undefined`
- Coherence bidirectionnelle : tous les types avec mapping sont dans RELEVE_COMPATIBLE_TYPES et vice-versa

### S16-5 — Projections de performance (24 tests)

**Fonctions testees :** les 5 fonctions de projection deja presentes dans `calculs.test.ts` sont ici testees dans un **scenario d'integration realiste** (vague Clarias gariepinus en milieu de cycle).

**Scenario utilise :** 500 alevins, 60 jours ecoules, poids 200g → objectif 800g en 180j, FCR 1.6

- `calculerSGRRequis(200, 800, 120)` → ~1.155%/j (verifie formule logarithmique)
- `calculerSGR(5, 200, 60)` → SGR eleve (~6.15%), phase juvenile validee
- `calculerDateRecolteEstimee` → date future coherente (10-50 jours)
- `calculerAlimentRestantEstime(200, 800, 480, 1.6)` → ~460.8 kg (formule gBiomasse * FCR)
- `calculerRevenuAttendu` → null si prixVenteKg null, 576 000 CFA si 1500 CFA/kg
- `genererCourbeProjection` avec 90 jours → 91 points, jourDepart respecte
- Logique `enAvance` (sgrActuel >= sgrRequis) : true/false/null selon les donnees disponibles
- Pipeline complet : calculerBiomasse + calculerFCR + FCR fallback 1.5

**Cas limites supplementaires :**
- SGR faible (0.5%/j) → croissance lente verifiee numeriquement (~232g apres 30j depuis 200g)
- SGR eleve (10%/j) → doublement du poids en ~7 jours
- Objectif deja atteint → alimentRestant null, joursRestants plafonnes a 1
- joursProjection plafonne a 90 jours

### S16-6 — Alertes graduees benchmark (7 tests)

**Fonctions testees :** `evaluerBenchmark` + `getBenchmarks` avec `ConfigElevage` personnalisee

**Tests :**
- Seuils FCR personnalises (1.4 excellent vs 1.5 par defaut) : FCR 1.45 est BON avec config, EXCELLENT avec defaut
- Seuils SGR personnalises (2.5 excellent vs 2.0 par defaut) : SGR 2.3 est BON avec config, EXCELLENT avec defaut
- Seuils survie personnalises (92% vs 90%) : 91% est BON avec config, EXCELLENT avec defaut
- null retourne null pour toutes les metriques
- Fallback vers benchmarks hardcodes si config est null

---

## Couverture par story (audit pre-existant)

Les stories suivantes avaient DEJA une couverture complete avant Sprint 22 :

| Story | Fichier de test existant |
|-------|--------------------------|
| S16-1 (Page Mes taches) | N/A — composant UI, non unit-testable directement |
| S16-2 (Instructions Markdown) | `activites.test.ts` lignes 709-802 (GET /instructions) |
| S16-3 (Lien activite→releve) | `activites-releves.test.ts` (8 suites, 60+ tests) |
| S16-4 (Recommandations alimentation) | `feeding.test.ts` (27 tests, calculerQuantiteAlimentParBac + detecterTaillesDifferentes) |
| S16-5 (Projections calculs) | `calculs.test.ts` lignes 736-912 (5 fonctions, 35 tests) |
| S16-6 (Alertes benchmark) | `benchmarks.test.ts` (36 tests) |
| S16-7 (API instructions + completion) | `activites.test.ts` (PUT completion, instructions, complete POST) |

Le fichier `sprint22.test.ts` ajoute des **tests d'integration et scenarios realistes** complementaires, pas des doublons.

---

## Bug corrige pendant les tests

### BUG : Build TypeScript echoue — conflict typeActiviteLabels dans instruction-viewer.tsx

**Fichier :** `src/components/activites/instruction-viewer.tsx`
**Cause :** Import de `typeActiviteLabels` depuis `@/lib/labels/activite` + redeclaration locale de la meme constante
**Fix :** Suppression de la declaration locale redondante (la version importee est la source de verite)
**Statut :** Corrige avant la premiere execution du build

---

## Commandes de validation

```bash
# Tests unitaires
npx vitest run
# Resultat : 1489 tests passes (49 fichiers), 0 echecs

# Build production
npm run build
# Resultat : ✓ Compiled successfully, 95 pages generees, TypeScript OK
```

---

## Prochaines etapes recommandees

- Sprint 22 est pret pour la review `@code-reviewer`
- La suite de tests totale (1489 tests) offre une regression solide
- Les tests d'integration UI (jsdom) sont dans `src/__tests__/ui/` — pas de nouveaux ajouts necessaires pour Sprint 22 (les composants sont "use client" sans logique metier testable en isolation)
