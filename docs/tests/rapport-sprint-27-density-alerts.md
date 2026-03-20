# Rapport de tests — Sprint 27-28 : Density Alerts

**Date :** 2026-03-20
**Auteur :** @tester
**Sprint cible :** Sprint 27-28 (ADR-density-alerts)
**Reference ADR :** `docs/decisions/ADR-density-alerts.md`

---

## Resume

| Fichier de test | Tests passes | Tests todo | Total |
|-----------------|-------------|------------|-------|
| `density-calculs.test.ts` | 20 | 21 | 41 |
| `density-evaluator.test.ts` | 53 | 0 | 53 |
| `density-integration.test.ts` | 33 | 5 | 38 |
| **Total** | **106** | **26** | **132** |

**Resultat global : 106/106 tests passent. 26 `.todo` en attente des fonctions non encore implementees.**

---

## Fonctions testees

### Deja implementees (tests actifs)

| Fonction | Fichier source | Tests |
|----------|---------------|-------|
| `computeVivantsByBac()` | `src/lib/calculs.ts` | 8 tests complementaires |
| `evalCondition()` | `src/lib/activity-engine/evaluator.ts` | 14 tests (SUPERIEUR, INFERIEUR, ENTRE, EGAL) |
| `evaluateRules()` avec conditions composees ET/OU | `src/lib/activity-engine/evaluator.ts` | 23 tests |
| Regles seedees R1, R2, R4 simulees | evaluator existant | 9 tests |
| TypeReleve.RENOUVELLEMENT | `src/types/models.ts` | 4 tests |
| TypeDeclencheur nouvelles valeurs | `src/types/models.ts` | 3 tests |
| OperateurCondition, LogiqueCondition | `src/types/models.ts` | 5 tests |
| Mode legacy SEUIL_DENSITE, SEUIL_RENOUVELLEMENT, ABSENCE_RELEVE | evaluator | 4 tests |
| firedOnce ne bloque PAS SEUIL_DENSITE | evaluator | 3 tests |
| Anti-spam EC-3.1 pour regles densite | evaluator | 3 tests |
| Calcul densite manuel (computeVivantsByBac + formule) | integration | 4 tests |
| Zero false positives (val=null → false) | integration | 5 tests |
| Nouveaux champs RuleEvaluationContext | types | 5 tests |

### Fonctions a implementer (tests .todo)

| Fonction | Fichier cible | Nb tests .todo |
|----------|--------------|----------------|
| `calculerDensiteBac()` | `src/lib/calculs.ts` | 8 |
| `calculerDensiteVague()` | `src/lib/calculs.ts` | 5 |
| `computeTauxRenouvellement()` | `src/lib/calculs.ts` | 8 |
| Calcul depuis releve RENOUVELLEMENT via computeTauxRenouvellement | integration | 2 |
| Regle R6 (ammoniac cross-param) | integration | 3 |

---

## Cas de test couverts

### 1. Calculs de densite (density-calculs.test.ts)

**computeVivantsByBac (tests complementaires) :**
- nombreInitial per-bac vs distribution uniforme
- Soustraction mortalites par bac
- Comptage ecrase le calcul mortalite
- Mortalites sans bacId ignorees
- Distribution non-uniforme (bac1=300, bac2=700 → densites differentes)
- Cumul de plusieurs mortalites sur le meme bac

**Integration manuelle (computeVivantsByBac + calculerDensite) :**
- Bac commercial Nigeria (400 poissons x 375g / 3.9m3 = 38.5 kg/m3)
- Bac RAS sature (500g x 1000 poissons / 1m3 = 500 kg/m3, critique)
- Apres mortalites : densite reduite proportionnellement
- Distribution non-uniforme : bac2 a 2.33x plus de poissons → densite 2.33x

**Seuils de reference (ADR section 3.1 et 3.2) :**
- Bac beton : alerte=150, critique=200 kg/m3
- Etang terre : alerte=30, critique=40 kg/m3
- RAS : alerte=350, critique=500 kg/m3
- Renouvellement requis : 25%/j (<50 kg/m3), 50%/j (50-100), 75%/j (>100)

### 2. Evaluateur avec conditions composees (density-evaluator.test.ts)

**evalCondition via conditions composees :**
- SUPERIEUR : valeur > seuil → true ; egal ou inferieur → false
- INFERIEUR : valeur < seuil → true ; egal ou superieur → false
- ENTRE : borne basse et haute inclusives → true ; hors plage → false
- EGAL : valeur exacte → true ; autre → false
- Valeur null dans le contexte → false (safe default, ADR section 6.2)

**Logique ET :**
- (true ET true) → match
- (true ET false) → pas de match
- (false ET true) → pas de match
- (false ET false) → pas de match

**Logique OU :**
- (true OU false) → match
- (false OU true) → match
- (true OU true) → match
- (false OU false) → pas de match

**Regles seedees simulees :**
- R1 (SEUIL_DENSITE>50 ET SEUIL_RENOUVELLEMENT<50, priorite=5) : 3 cas
- R2 (SEUIL_DENSITE>100 ET SEUIL_RENOUVELLEMENT<75, priorite=3) : 2 cas
- R4 (SEUIL_DENSITE>100 ET ABSENCE_RELEVE>3, priorite=2) : 3 cas

**Score et priorite :**
- R3 (priorite=1, score=100) > R1 (priorite=5, score=60) : tri correct
- R4 (priorite=2, score=90) > R2 (priorite=3, score=80) : tri correct

**firedOnce (ADR section 6.4) :**
- SEUIL_DENSITE avec firedOnce=true → NON bloque → se declenche
- SEUIL_RENOUVELLEMENT avec firedOnce=true → NON bloque
- Liste seuilTypesFiredOnce ne contient pas les nouveaux types

**Anti-spam EC-3.1 :**
- Deduplication meme jour + meme bac → pas de doublon
- Historique bac different → pas de dedup
- Hier → peut se declencher aujourd'hui

**Backward compatibility :**
- CALENDRIER, SEUIL_POIDS, RECURRENT, SEUIL_MORTALITE avec conditions=[] → fonctionnent comme avant

**Mode legacy (sans conditions composees) :**
- SEUIL_DENSITE legacy : densiteKgM3 > conditionValeur → declenchee
- SEUIL_RENOUVELLEMENT legacy : taux < conditionValeur → declenchee
- ABSENCE_RELEVE legacy : jours >= conditionValeur → declenchee

### 3. Scenarios d'integration (density-integration.test.ts)

- Calcul densite bac commercial Nigeria : 38.5 kg/m3 (sous alerte)
- Bac en surcharge : 200 kg/m3 (seuil critique)
- Apres mortalites : vivants reduits → densite reduite
- Contexte RuleEvaluationContext : densiteKgM3, tauxRenouvellementPctJour, joursDepuisDernierReleveQualiteEau
- R2 : 3 cas (declenche / renouvellement suffisant / densite insuffisante)
- R4 : 4 cas (declenche / releve hier / densite faible / null safe)
- Zero false positives : val=null → pas de match pour tous les nouveaux types
- EC-3.9 : vague avec 0 vivants skippee
- TypeReleve.RENOUVELLEMENT : structure, pourcentageRenouvellement, volumeRenouvele
- Enums OperateurCondition et LogiqueCondition : toutes les valeurs presentes
- Structure des regles avec conditions composees : ET et OU valides

---

## Tests non regression

Les 3 nouveaux fichiers de test n'introduisent pas de regression :
- Les 1876 tests existants continuent de passer (8 echecs pre-existants non lies)
- Les 8 echecs pre-existants sont : benchmarks.test.ts (3), sprint22.test.ts (1), api/sites.test.ts (4)

---

## Points d'attention pour l'implementation

### calculerDensiteBac() — algorithme ADR section 4.1

```typescript
function calculerDensiteBac(
  bac: { id: string; volume: number | null; nombreInitial: number | null },
  bacs: { id: string; nombreInitial: number | null }[],
  releves: ReleveCtx[],
  nombreInitialVague: number
): number | null
```

Points cles :
1. Utiliser `computeVivantsByBac()` (source unique de verite pour les vivants)
2. Filtrer la biometrie par `bacId == bac.id` en premier, fallback global ensuite
3. Retourner null si `bac.volume == null || bac.volume <= 0`
4. Retourner null si aucune biometrie disponible

### computeTauxRenouvellement() — algorithme ADR section 4.2

```typescript
function computeTauxRenouvellement(
  relevesRenouvellement: Array<{
    date: Date;
    pourcentageRenouvellement: number | null;
    volumeRenouvele: number | null;
  }>,
  bacVolumeLitres: number,
  periodeDays?: number // defaut: 7
): number | null
```

Points cles :
1. Filtrer par fenetre glissante (date >= maintenant - periodeDays)
2. Si `pourcentageRenouvellement` null mais `volumeRenouvele` present : convertir
3. Si `bacVolumeLitres` null et seul `volumeRenouvele` present : ignorer ce releve
4. Retourner null si 0 releves valides dans la fenetre
5. tauxMoyen = somme(pourcentages) / periodeDays (pas / nombre de releves)

---

## Commande d'execution

```bash
npx vitest run src/__tests__/density-calculs.test.ts src/__tests__/density-evaluator.test.ts src/__tests__/density-integration.test.ts
```
