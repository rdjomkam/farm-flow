# Rapport de test — ADR-030 Gompertz per-tank

**Date :** 2026-04-05
**Auteur :** @tester
**ADR :** ADR-030 — Gompertz per-tank : calibrage et interpolation par bac individuel
**Fichier testé :** `src/lib/feed-periods.ts`
**Fichier de tests :** `src/__tests__/lib/feed-periods.test.ts`

---

## Contexte

ADR-030 introduit une cinquieme strategie d'interpolation `GOMPERTZ_BAC` qui calibre un modele
Gompertz distinct pour chaque bac en utilisant uniquement ses propres biometries. Une chaine de
fallback a 4 niveaux garantit la degradation gracieuse :

```
GOMPERTZ_BAC -> GOMPERTZ_VAGUE -> INTERPOLATION_LINEAIRE -> VALEUR_INITIALE
```

Les tests ADR-030 ont ete ajoutes a la fin du fichier de tests existant, apres les blocs ADR-028
et ADR-029, sans toucher aux tests precedents.

---

## Resultats des tests

### feed-periods.test.ts

**76 tests passes — 0 echec**

| Bloc describe | Tests | Resultat |
|---|---|---|
| `interpolerPoidsBac` (ADR-028) | 9 | Tous passes |
| `segmenterPeriodesAlimentaires` (ADR-028) | 18 | Tous passes |
| `interpolerPoidsBac — strategie GOMPERTZ_VAGUE (ADR-029)` | 14 | Tous passes |
| `segmenterPeriodesAlimentaires — strategie GOMPERTZ_VAGUE (ADR-029)` | 6 | Tous passes |
| `methodeRank — ordre de priorite 0-3 (ADR-029)` | 4 | Tous passes |
| `interpolerPoidsBac — strategie GOMPERTZ_BAC (ADR-030)` | 4 | **Nouveaux — tous passes** |
| `interpolerPoidsBac — fallbacks GOMPERTZ_BAC (ADR-030)` | 10 | **Nouveaux — tous passes** |
| `segmenterPeriodesAlimentaires — strategie GOMPERTZ_BAC (ADR-030)` | 2 | **Nouveaux — tous passes** |
| `methodeRank — ordre de priorite 5 niveaux (ADR-030)` | 4 | **Nouveaux — tous passes** |
| **Total feed-periods.test.ts** | **76** | **76 passes** |

**Duree d'execution :** 515ms

---

## Detail des nouveaux tests ADR-030

### 1. `interpolerPoidsBac — strategie GOMPERTZ_BAC` (4 tests)

| Test | Cas couvert | Resultat |
|---|---|---|
| GOMPERTZ_BAC + contexte HIGH valide | Cas nominal : poids Gompertz du bac retourne, methode = GOMPERTZ_BAC | Passe |
| GOMPERTZ_BAC + contexte MEDIUM valide | MEDIUM est accepte comme HIGH | Passe |
| biometrie exacte prime sur GOMPERTZ_BAC | Etape 1 inchangee — priorite absolue de la biometrie exacte | Passe |
| GOMPERTZ_BAC avec n=3 minPoints | Le choix de l'eleveur d'abaisser le seuil a 3 fonctionne | Passe |

### 2. `interpolerPoidsBac — fallbacks GOMPERTZ_BAC` (10 tests)

| Test | Cas couvert | Resultat |
|---|---|---|
| bacId absent de gompertzBacContexts | Fallback GOMPERTZ_VAGUE quand le bac n'est pas dans la Map | Passe |
| gompertzBacContexts non fourni | Fallback GOMPERTZ_VAGUE quand la Map n'est pas transmise | Passe |
| confidenceLevel bac = LOW | LOW refuse -> fallback GOMPERTZ_VAGUE | Passe |
| confidenceLevel bac = INSUFFICIENT_DATA | INSUFFICIENT_DATA refuse -> fallback GOMPERTZ_VAGUE | Passe |
| r2 bac < 0.85 | r2 insuffisant -> fallback GOMPERTZ_VAGUE | Passe |
| biometrieCount bac < gompertzMinPoints | Pas assez de biometries -> fallback GOMPERTZ_VAGUE | Passe |
| bac LOW + vague LOW | Double fallback -> INTERPOLATION_LINEAIRE quand biometries disponibles | Passe |
| bac LOW + vague LOW + pas de biometries | Triple fallback -> VALEUR_INITIALE | Passe |
| strategie LINEAIRE ignore gompertzBacContexts | Isolation : LINEAIRE n'est pas affecte par la Map | Passe |
| strategie GOMPERTZ_VAGUE ignore gompertzBacContexts | Isolation : GOMPERTZ_VAGUE n'est pas affecte par la Map | Passe |

### 3. `segmenterPeriodesAlimentaires — strategie GOMPERTZ_BAC` (2 tests)

| Test | Cas couvert | Resultat |
|---|---|---|
| options transmises avec gompertzBacContexts | La Map est correctement transmise a interpolerPoidsBac | Passe |
| scenario mixte bac-A (BAC) + bac-B (VAGUE) | Bac A dans la Map -> GOMPERTZ_BAC ; bac B absent -> GOMPERTZ_VAGUE | Passe |

### 4. `methodeRank — ordre de priorite 5 niveaux` (4 tests)

| Test | Rang verifie | Resultat |
|---|---|---|
| BIOMETRIE_EXACTE (4) > GOMPERTZ_BAC (3) | Borne fin GOMPERTZ_BAC (3) < debut BIOMETRIE_EXACTE (4) -> GOMPERTZ_BAC retenu | Passe |
| GOMPERTZ_BAC (3) > GOMPERTZ_VAGUE (2) | Borne debut GOMPERTZ_VAGUE (2) < fin GOMPERTZ_BAC (3) -> GOMPERTZ_VAGUE retenu | Passe |
| BIOMETRIE_EXACTE (4) sur les deux bornes | Les deux biometries exactes -> BIOMETRIE_EXACTE meme avec GOMPERTZ_BAC | Passe |
| Les 5 rangs en sequence | Verification individuelle de chaque methode par appel direct | Passe |

---

## Chaine de fallback verifiee

La chaine complete a ete validee :

```
GOMPERTZ_BAC (conditions invalides)
  -> confidenceLevel LOW/INSUFFICIENT_DATA -> GOMPERTZ_VAGUE
  -> r2 < 0.85                             -> GOMPERTZ_VAGUE
  -> biometrieCount < minPoints             -> GOMPERTZ_VAGUE
  -> bacId absent de la Map                -> GOMPERTZ_VAGUE
  -> Map non fournie                       -> GOMPERTZ_VAGUE

GOMPERTZ_VAGUE (conditions invalides)
  -> avec biometries encadrantes           -> INTERPOLATION_LINEAIRE
  -> sans biometries encadrantes           -> VALEUR_INITIALE
```

---

## Tests de non-regression

Aucun test ADR-028 ou ADR-029 n'a ete modifie. Les 44 tests precedents continuent de passer.
L'ajout de l'import `GompertzBacContext` au bloc d'import du fichier de test est le seul
changement apporte aux parties existantes du fichier.

---

## Build

```
npm run build -> OK
```

Aucune erreur de compilation TypeScript. Seul un avertissement Next.js non lie (workspace root
inferenciation) est present, present avant ces modifications.

---

## Couverture des cas de test ADR-030

Tous les cas de test listés dans la section "Cas de test requis" de ADR-030 ont été implementes :

- Cas nominal GOMPERTZ_BAC (HIGH et MEDIUM) : couvert
- Biometrie exacte prime sur GOMPERTZ_BAC : couvert
- Fallback vers GOMPERTZ_VAGUE (absent de Map, low confidence, r2 insuffisant, biometrieCount insuffisant) : couvert
- Double fallback GOMPERTZ_BAC -> GOMPERTZ_VAGUE -> LINEAIRE : couvert
- Triple fallback -> VALEUR_INITIALE : couvert
- n=3 minPoints (choix eleveur) : couvert
- Options forwarded avec gompertzBacContexts dans segmenterPeriodesAlimentaires : couvert
- Scenario mixte bac A (BAC) + bac B (VAGUE fallback) : couvert
- Rang 5 niveaux BIOMETRIE_EXACTE(4) > GOMPERTZ_BAC(3) > GOMPERTZ_VAGUE(2) > LINEAIRE(1) > VALEUR_INITIALE(0) : couvert
- Strategies LINEAIRE et GOMPERTZ_VAGUE non affectees par gompertzBacContexts : couvert

---

## Statut

**PASSE — 76/76 tests, build OK, 0 regression**
