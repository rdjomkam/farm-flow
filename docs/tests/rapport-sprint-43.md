# Rapport de tests — Sprint 43

**Sprint :** 43 — Plans configurent les modules
**Date :** 2026-03-21
**Testeur :** @tester
**Statut :** VALIDE

---

## Résumé

| Categorie              | Fichier de test                                        | Tests | Statut  |
|------------------------|--------------------------------------------------------|-------|---------|
| API modulesInclus POST | `src/__tests__/api/plans-sprint43.test.ts`             | 22    | PASS    |
| API modulesInclus PUT  | `src/__tests__/api/plans-sprint43.test.ts`             | (inclus ci-dessus) | PASS |
| applyPlanModules       | `src/__tests__/lib/apply-plan-modules.test.ts`         | 17    | PASS    |
| **Total Sprint 43**    |                                                        | **39**| **PASS** |

Build production : `npm run build` — OK (aucune erreur TypeScript ni de compilation).

---

## Fichiers de test créés

- `/Users/ronald/project/dkfarm/farm-flow/src/__tests__/api/plans-sprint43.test.ts`
- `/Users/ronald/project/dkfarm/farm-flow/src/__tests__/lib/apply-plan-modules.test.ts`

---

## Détail des tests

### 1. `plans-sprint43.test.ts` — Validation `modulesInclus` dans les routes API

#### POST /api/plans — modulesInclus (11 cas)

| # | Description | Résultat |
|---|-------------|----------|
| 1 | modulesInclus valides (site-level) → 201, DTO contient les bons modules | PASS |
| 2 | Module platform ABONNEMENTS → 400 avec errorKey `validation.invalidPlatformModule` | PASS |
| 3 | Module platform COMMISSIONS → 400 | PASS |
| 4 | Module platform REMISES → 400 | PASS |
| 5 | Les trois modules platform simultanément → 400, message liste ABONNEMENTS + COMMISSIONS + REMISES | PASS |
| 6 | Module inconnu (string arbitraire) → 400 | PASS |
| 7 | modulesInclus non-tableau (string) → 400, erreur champ `modulesInclus` | PASS |
| 8 | modulesInclus absent → 201, DTO contient `modulesInclus: []` (défaut) | PASS |
| 9 | modulesInclus tableau vide → 201 (désactivation complète valide) | PASS |
| 10 | Mix module valide + platform → 400 (rejet global) | PASS |
| 11 | Message d'erreur contient les modules invalides et la liste des modules site-level acceptés | PASS |

#### PUT /api/plans/[id] — modulesInclus (11 cas)

| # | Description | Résultat |
|---|-------------|----------|
| 1 | modulesInclus valides → 200, updatePlanAbonnement appelé avec les bons modules | PASS |
| 2 | Module platform ABONNEMENTS → 400 avec errorKey `validation.invalidPlatformModule` | PASS |
| 3 | Module platform COMMISSIONS → 400 | PASS |
| 4 | Module platform REMISES → 400 | PASS |
| 5 | Module inconnu → 400 | PASS |
| 6 | modulesInclus non-tableau → 400, erreur champ `modulesInclus` | PASS |
| 7 | Sans modulesInclus → 200, `modulesInclus` absent du DTO (pas de surécrasement) | PASS |
| 8 | modulesInclus tableau vide → 200 (désactivation valide) | PASS |
| 9 | Plan inexistant → 404 (vérifié avant la validation modulesInclus) | PASS |
| 10 | Mix module valide + inconnu → 400 (rejet global) | PASS |
| 11 | Tous les 9 modules site-level → 200 | PASS |

---

### 2. `apply-plan-modules.test.ts` — Logique applyPlanModules / applyPlanModulesTx

#### applyPlanModules — plan introuvable (1 cas)

| # | Description | Résultat |
|---|-------------|----------|
| 1 | Plan inexistant → throw avec message `/Plan plan-inexistant introuvable/`, site.update NON appelé | PASS |

#### applyPlanModules — filtrage modules platform (4 cas)

| # | Description | Résultat |
|---|-------------|----------|
| 1 | Mix site-level + platform → seuls les modules site-level dans enabledModules | PASS |
| 2 | Uniquement ABONNEMENTS → enabledModules vide | PASS |
| 3 | COMMISSIONS + GROSSISSEMENT → uniquement GROSSISSEMENT conservé | PASS |
| 4 | REMISES + VENTES → uniquement VENTES conservé | PASS |

#### applyPlanModules — modules valides (4 cas)

| # | Description | Résultat |
|---|-------------|----------|
| 1 | 3 modules site-level → tous passent le filtre, appel site.update avec les bons modules | PASS |
| 2 | Liste vide → enabledModules vide (désactivation valide) | PASS |
| 3 | findUnique appelé avec le bon planId | PASS |
| 4 | site.update appelé avec le bon siteId | PASS |

#### applyPlanModulesTx — transaction Prisma (5 cas)

| # | Description | Résultat |
|---|-------------|----------|
| 1 | Plan inexistant dans la transaction → throw, tx.site.update NON appelé | PASS |
| 2 | Mix site-level + platform dans tx → filtrage correct, seuls les modules site-level écrits | PASS |
| 3 | 3 modules valides dans tx → tous conservés dans enabledModules | PASS |
| 4 | Liste vide dans tx → enabledModules vide | PASS |
| 5 | Utilise `tx.planAbonnement.findUnique` (pas le client global prisma) | PASS |

#### applyPlanModules — cas limites (3 cas)

| # | Description | Résultat |
|---|-------------|----------|
| 1 | Uniquement les 3 modules platform → enabledModules vide | PASS |
| 2 | Les 9 modules site-level → tous conservés (length === 9) | PASS |
| 3 | Appelé deux fois de suite → site.update appelé deux fois (idempotence) | PASS |

---

## Règles métier vérifiées

| Règle | Vérification |
|-------|-------------|
| `ABONNEMENTS` interdit dans `modulesInclus` d'un plan | Testé POST + PUT + applyPlanModules |
| `COMMISSIONS` interdit dans `modulesInclus` d'un plan | Testé POST + PUT + applyPlanModules |
| `REMISES` interdit dans `modulesInclus` d'un plan | Testé POST + PUT + applyPlanModules |
| Module inconnu rejeté | Testé POST + PUT |
| modulesInclus absent → défaut `[]` appliqué à la création | Testé POST |
| applyPlanModules filtre les modules platform avant écriture | Testé applyPlanModules + Tx |
| applyPlanModulesTx utilise la transaction (pas le client global) | Testé Tx |
| errorKey `validation.invalidPlatformModule` présent dans la réponse 400 | Testé POST + PUT |

---

## Etat de la suite complète

La suite complète (`npx vitest run`) compte 197 échecs pré-existants non liés au Sprint 43. Ces échecs concernent principalement :

- Tests i18n (traductions affichées vs clés de traduction) — fichiers `components/plans-admin-list.test.tsx`, `i18n/messages-sprint*.test.ts`
- Tests de régression antérieurs — `benchmarks.test.ts`, `sprint22.test.ts`, `api/vagues.test.ts`, `api/sites.test.ts`
- Tests de remises — `api/remises-verifier.test.ts`

Ces échecs sont présents avant Sprint 43 et ne sont pas causés par les fichiers de ce sprint.

**Les 39 tests Sprint 43 passent tous.**

---

## Build

```
npm run build → OK (aucune erreur de compilation TypeScript)
```

---

## Conclusion

Sprint 43 validé. La logique de validation `modulesInclus` dans les routes POST/PUT `/api/plans` et la fonction `applyPlanModules` / `applyPlanModulesTx` sont correctement couvertes par 39 tests unitaires et d'intégration, tous au vert.
