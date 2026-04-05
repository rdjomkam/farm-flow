# Rapport de test — ADR-032 : Calibrage-aware nombreVivants + suppression GOMPERTZ_BAC

**Date :** 2026-04-05
**Auteur :** @tester
**ADR :** ADR-032
**Fichier de tests :** `src/__tests__/lib/feed-periods.test.ts`

---

## Résumé

ADR-032 supprime GOMPERTZ_BAC de la chaine d'interpolation et rend le calcul de
`nombreVivants` conscient des opérations de calibrage. Le @developer a implementé :

1. Suppression de GOMPERTZ_BAC (GompertzBacContext, branche interpolation, methodeRank)
2. Ajout de `CalibragePoint` interface dans `feed-periods.ts`
3. Extension de `VagueContext` avec champ `calibrages?: CalibragePoint[]`
4. Nouvelle fonction `estimerNombreVivantsADate` remplacant l'ancienne `estimerNombreVivants`
5. Mise a jour de `segmenterPeriodesAlimentaires` pour transmettre `dateDebut` a la nouvelle fonction

---

## Résultats des tests

### Avant (état initial reçu)
- 73 tests passaient
- 17 tests échouaient (tous sur GOMPERTZ_BAC supprimé)
- Total : 90 tests

### Après (état final)
- **79 tests passent**
- **0 test en échec**
- Build : OK (avertissement `outputFileTracingRoot` pré-existant non bloquant)

---

## Tâche 1 : Correction des tests GOMPERTZ_BAC (17 tests)

### Tests supprimés

Les describe blocks suivants ont été supprimés car ils testaient une fonctionnalité
entièrement supprimée (GOMPERTZ_BAC n'existe plus dans le code) :

| Describe block | Raison |
|----------------|--------|
| `interpolerPoidsBac — strategie GOMPERTZ_BAC (ADR-030)` | GOMPERTZ_BAC supprimé, 4 tests |
| `interpolerPoidsBac — fallbacks GOMPERTZ_BAC (ADR-030)` | Fallbacks depuis GOMPERTZ_BAC n'existent plus, 9 tests |
| `segmenterPeriodesAlimentaires — strategie GOMPERTZ_BAC (ADR-030)` | Stratégie supprimée, 2 tests |
| `methodeRank — ordre de priorite 5 niveaux (ADR-030)` | Réduit à 4 niveaux, 4 tests |
| `GOMPERTZ_BAC : detail contient methode, tJours, params et resultatG` (ADR-031) | Supprimé |
| `GOMPERTZ_BAC : params.wInfinity correspond au contexte bac` (ADR-031) | Supprimé |

### Tests adaptés

| Test original | Adaptation |
|---------------|------------|
| `GOMPERTZ_VAGUE (fallback depuis GOMPERTZ_BAC sans contexte bac)` | Adapté en `GOMPERTZ_VAGUE avec contexte valide : detail.methode = GOMPERTZ_VAGUE` |
| `methodeRank 5 niveaux` | Remplacé par `methodeRank 4 niveaux (ADR-032)` avec les rangs actuels |

### Nouveau describe bloc de remplacement

`methodeRank — ordre de priorite 4 niveaux (ADR-032)` avec 2 tests vérifiant :
- L'ordre VALEUR_INITIALE(0) < INTERPOLATION_LINEAIRE(1) < GOMPERTZ_VAGUE(2) < BIOMETRIE_EXACTE(3)
- BIOMETRIE_EXACTE > GOMPERTZ_VAGUE -> GOMPERTZ_VAGUE conservateur

---

## Tâche 2 : Tests calibrage-aware ADR-032

### describe `estimerNombreVivantsADate — calibrage-aware (ADR-032)` (6 tests)

| Test | Vérifie |
|------|---------|
| `retourne nombreInitial si aucun calibrage avant la date` | Comportement legacy préservé quand pas de calibrage |
| `utilise groupe.nombrePoissons du dernier calibrage avant la date` | Logique principale ADR-032 |
| `soustrait les mortalites post-calibrage` | Mortalites après le calibrage sont déduites |
| `gere un bac nouveau apparu lors d'un calibrage` | Nouveau bac (nombreInitial null) est géré via CalibrageGroupe |
| `ignore les calibrages dont date > targetDate` | Calibrages futurs ignorés |
| `retombe sur nombreInitial si calibrage.groupes ne contient pas ce bacId` | Fallback si bac absent des groupes |

### describe `segmenterPeriodesAlimentaires — avec calibrages (ADR-032)` (3 tests)

| Test | Vérifie |
|------|---------|
| `FCR plausible pour bac ayant perdu 60% de population` | FCR entre 0.5 et 3.0 après calibrage (problème principal ADR-032) |
| `pas de FCR < 0.5 sur donnees synthetiques de calibrage realiste` | Aucun FCR biologiquement implausible (< 0.5) sur 3 bacs |
| `periodes pre-calibrage et post-calibrage utilisent des nombreVivants differents` | Pre-calibrage = 650, post-calibrage = 130 pour bac-01 |

### Scenario de données réalistes utilisé

Basé sur Vague 26-01 (issue ADR-032 section 12) :
- 1300 poissons initiaux, 2 bacs de 650 chacun
- Calibrage au J25 : bac-01 garde 130, bac-03 = 520, nouveau bac-04 = 650
- Poids J25 = 200g, poids J35 = 350g
- Aliment 50kg par bac sur J26-J35
- FCR calculé pour bac-01 : 50 / ((350-200)*130/1000) = 50/19.5 ≈ 2.56 (biologiquement plausible)

Sans la correction ADR-032, nombreVivants = 650 (erroné) donnerait :
- gain = (350-200)*650/1000 = 97.5 kg
- FCR = 50/97.5 = 0.51 → implausible pour Clarias gariepinus

---

## Vérification finale

```
npx vitest run src/__tests__/lib/feed-periods.test.ts
Tests     79 passed (79)

npm run build
Build : OK (1 warning pré-existant non bloquant)
```

---

## Import changes

Le fichier de tests importe désormais :
- `estimerNombreVivantsADate` (nouvelle fonction exportée)
- `type CalibragePoint` (nouvelle interface exportée)
- Suppression : `type GompertzBacContext` (plus exportée)
