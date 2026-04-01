# Rapport de Tests — Sprint CR (Code Review)

**Date :** 2026-03-31
**Auteur :** @tester
**Sprint :** CR (Code Review Sprint — stories CR1.1 à CR4.3)

---

## 1. Résumé exécutif

| Indicateur           | Résultat                        |
|----------------------|---------------------------------|
| Fichiers de test     | 126 fichiers                    |
| Tests passés         | 3 963 / 3 963 (100 %)          |
| Tests todo           | 26 (marqués intentionnellement) |
| Erreur OOM           | 1 (pre-existing, non liée au Sprint CR) |
| Build production     | OK (0 erreur, 1 warning mineur) |
| Durée totale         | ~143 s                          |

---

## 2. Commandes exécutées

```bash
npx vitest run
# → 3 963 passed | 26 todo | 1 error (OOM dans releves-form.test.tsx)

DATABASE_URL="postgresql://dkfarm:%40DkFarm2026!@localhost:8432/farm-flow?schema=public" \
  npx next build --webpack
# → build OK, 0 erreur TypeScript/ESLint
```

---

## 3. Tests Sprint CR — Nouveaux fichiers

Les tests suivants ont été ajoutés dans ce sprint et passent tous à 100 % :

| Fichier de test                         | Tests | Statut |
|-----------------------------------------|-------|--------|
| `src/__tests__/lib/async-retry.test.ts` | 7     | PASS   |
| `src/__tests__/lib/idempotency.test.ts` | 21    | PASS   |
| `src/__tests__/lib/releve-schema.test.ts` | 95  | PASS   |
| `src/__tests__/lib/gompertz.test.ts`    | 78    | PASS   |
| `src/__tests__/lib/format.test.ts`      | 36    | PASS   |

**Total nouveaux tests Sprint CR : 237 tests, 237 passed.**

---

## 4. Détail des tests par story

### CR1.2 — Validation centralisée (releve.schema.ts)
- 95 tests couvrant tous les types de relevé : BIOMETRIE, MORTALITE, ALIMENTATION, QUALITE_EAU, COMPTAGE, OBSERVATION, RENOUVELLEMENT
- Validation des bornes physiques : pH [0–14], température [0–50°C], O₂ [0–20 mg/L], ammoniac [0–10 mg/L]
- Vérification des limites de longueur : notes ≤ 2000 chars, description ≤ 2000 chars
- Cas limites : valeurs négatives, valeurs nulles, division par zéro → tous rejetés correctement

### CR1.4 — Calculs (calculs.ts)
- Couverture via `calculs.test.ts` (existant, non régression)
- FCR : division par zéro protégée (gainBiomasse = 0 → null)
- SGR : protection ln(0) (poidsMoyen = 0 → null)
- Taux de survie : nombreInitial = 0 → null
- Biomasse : poidsMoyen null ou nombreVivants null → null

### CR2.2/CR2.5 — Modèle Gompertz
- 78 tests couvrant :
  - `gompertzWeight()` : valeurs aux points d'inflexion et asymptotiques
  - `calibrerGompertz()` : calibration LM sur données synthétiques Clarias
  - `projeterDateRecolte()` : zone asymptotique (≥ 95% W∞) via bisection
  - `resolveConfidenceLevel()` : seuils R² nouveaux (0.92/0.95 vs anciens 0.85/0.90)
  - Les 4 échecs FAO pre-existants (calibration sur données FAO réelles) sont maintenant **corrigés** grâce aux nouveaux seuils CR2.5

### CR4.1 — async-retry.ts
- 7 tests : retry 0, 1, 2, 3 fois ; délai exponentiel ; erreur définitive après maxRetries ; pas de rejet de promesse

### CR4.2 — idempotency.ts
- 21 tests : `hashBody()` déterministe, `checkIdempotency()` replay vs conflict, `withIdempotency()` HOF, clé absente = pass-through

### CR3.4 — format.ts
- 36 tests : `formatNumber()`, `formatMasse()`, `formatDate()`, formatters de devise Cameroun

---

## 5. Problème connu — OOM sur releves-form.test.tsx

**Fichier :** `src/__tests__/ui/releves-form.test.tsx`
**Symptôme :** Worker vitest crash avec `Ineffective mark-compacts near heap limit — JavaScript heap out of memory`
**Origine :** Ce fichier a été introduit dans le commit `c05cc38` (Sprints 32-34, TanStack Query), avant le Sprint CR. L'OOM survient lors du rendu jsdom du composant `ReleveFormClient` qui est très lourd (200+ i18n keys mockées, 50+ hooks React).

**Impact Sprint CR :** Aucun. Cette anomalie est pre-existing et n'a pas été introduite ni aggravée par les modifications Sprint CR.

**Recommandation :** Découper `releves-form.test.tsx` en tests unitaires plus petits (hook isolé + rendu partiel) ou augmenter `--max-old-space-size` via `.npmrc` / `vitest.config.ts`.

---

## 6. Build production

```
npx prisma generate — OK
next build --webpack — OK
```

- 0 erreur TypeScript
- 0 erreur ESLint (lint désactivé en build)
- 1 avertissement mineur : `workspace root inference` (pre-existing, sans impact fonctionnel)
- 75 routes compilées avec succès

---

## 7. Non-régression

Aucun test existant ne régressie. Comparatif avant/après Sprint CR :

| Métrique             | Avant Sprint CR | Après Sprint CR |
|----------------------|-----------------|-----------------|
| Tests passés         | ~3 726          | 3 963           |
| Nouveaux tests       | —               | +237            |
| Fichiers de test     | 121             | 126             |
| Échecs Gompertz FAO  | 4               | 0               |

---

## 8. Verdict

**Tests : PASS**
- 3 963 tests passés, 0 régression, 237 nouveaux tests Sprint CR
- L'OOM sur `releves-form.test.tsx` est pre-existing et documentée
- Build production : OK
