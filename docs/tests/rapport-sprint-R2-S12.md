# Rapport de tests — Story R2-S12 : Tests API géniteurs + pontes

**Date :** 2026-04-07
**Agent :** @tester
**Sprint :** R2 (Module Reproduction)
**Story :** R2-S12 — Tests API géniteurs + pontes

---

## Résumé

Création de 136 tests d'intégration API couvrant le module de reproduction :
les nouveaux endpoints `/api/reproduction/geniteurs` et `/api/reproduction/pontes`.

---

## Fichiers créés

| Fichier | Tests |
|---------|-------|
| `src/__tests__/api/reproduction-geniteurs.test.ts` | 72 tests |
| `src/__tests__/api/reproduction-pontes.test.ts` | 64 tests |

---

## Résultats

### Nouveaux tests

```
Test Files   2 passed (2)
Tests        136 passed (136)
Duration     4.40s
```

### Suite complète (sans régression)

```
Test Files   140 passed | 1 failed (pre-existant)
Tests        4596 passed | 3 failed (pre-existants — src/__tests__/auth/password.test.ts)
```

Les 3 échecs pre-existants sont dans `password.test.ts` (bcrypt flaky en env CI)
et sont sans rapport avec les nouveaux tests.

---

## Couverture détaillée

### reproduction-geniteurs.test.ts

| Suite | Cas testés |
|-------|-----------|
| GET /api/reproduction/geniteurs — mode GROUPE | liste, filtres sexe/statut/bacId, mode invalide, 401/403/500 |
| GET /api/reproduction/geniteurs — mode INDIVIDUEL | liste, filtre sexe |
| POST /api/reproduction/geniteurs — mode GROUPE | création champs obligatoires, nom vide, sexe manquant/invalide, nombrePoissons<=0, poidsMoyenG<=0, dateAcquisition invalide, statut invalide, code dupliqué (409), 401 |
| POST /api/reproduction/geniteurs — mode INDIVIDUEL | création, code manquant/vide, poids manquant/<=0, age négatif, dateAcquisition invalide |
| GET /api/reproduction/geniteurs/[id] | lot trouvé (GROUPE), fallback reproducteur, 404 ni lot ni reproducteur, mode INDIVIDUEL direct, 404 INDIVIDUEL, 401 |
| PATCH /api/reproduction/geniteurs/[id] — GROUPE | mise à jour, nom vide, nombrePoissons<=0, statut invalide, 404, 403 |
| PATCH /api/reproduction/geniteurs/[id] — INDIVIDUEL | mise à jour, code vide, sexe invalide, poids<=0, age négatif, 404, 409 code dupliqué |
| DELETE /api/reproduction/geniteurs/[id] | succès GROUPE, 409 pontes actives, succès INDIVIDUEL, 404 fallback, mode invalide, 401/403 |
| POST /api/reproduction/geniteurs/[id]/utiliser-male | décrémente stock, 400 champ manquant/0/négatif/flottant, 404 introuvable, 409 stock insuffisant, 400 mauvais sexe, 400 stock non initialisé, 401, 500 |

### reproduction-pontes.test.ts

| Suite | Cas testés |
|-------|-----------|
| GET /api/reproduction/pontes | liste, filtres statut/femelleId/lotGeniteursFemellId/dateFrom+dateTo, 400 statut invalide, 400 limit/offset invalides, 401/403/500 |
| POST /api/reproduction/pontes | création avec femelleId, création avec lotGeniteursFemellId, champs minimum, 400 datePonte manquante/invalide, 400 XOR aucun champ femelle, 400 XOR les deux champs femelle, 400 doseHormone négative, accepte doseHormone=0, 400 coutHormone négatif, 400 temperatureEauC non-nombre, 404 femelle introuvable, 400 femelle non ACTIF, 401/403 |
| GET /api/reproduction/pontes/[id] | détail, 404, 401/403 |
| PATCH /api/reproduction/pontes/[id]/stripping | enregistrement avec succès, 400 heureStripping manquante/invalide, 400 poidsOeufsPontesG<=0, 400 nombreOeufsEstime<=0, champs optionnels absents OK, 404, 401 |
| PATCH /api/reproduction/pontes/[id]/resultat | résultat final + TERMINEE, tous champs optionnels, 400 tauxFecondation>100/<0, accepte 0, 400 tauxEclosion>100, 400 nombreLarvesViables<=0, 400 coutTotal négatif, accepte 0, 404, 401 |
| PATCH /api/reproduction/pontes/[id]/echec | 400 causeEchec manquante/invalide, succès avec/sans notes, toutes valeurs CauseEchecPonte, 404, 401/403 |
| DELETE /api/reproduction/pontes/[id] | 204 succès, 409 bloqué par lots, 404, 401/403, 500 |
| Workflow complet | création (EN_COURS) + stripping + résultat (TERMINEE) |
| Workflow echec | création (EN_COURS) + markEchec (ECHOUEE) |

---

## Règles métier validées

1. **XOR femelle source** — POST /pontes : exactement un parmi `femelleId` ou `lotGeniteursFemellId` est obligatoire. Les deux cas d'erreur (aucun / les deux) sont testés.

2. **Stock mâles atomique** — POST utiliser-male : validation complète (manquant, 0, négatif, flottant, introuvable, insuffisant, mauvais sexe, non initialisé).

3. **Blocage suppression** — DELETE géniteur avec pontes actives retourne 409. DELETE ponte avec lots liés retourne 409.

4. **Validation taux** — tauxFecondation et tauxEclosion doivent être [0, 100]. Les cas limites (0 et 100) sont acceptés.

5. **Workflow 3 étapes** — création EN_COURS → stripping → résultat TERMINEE.

6. **Workflow échec** — création EN_COURS → markEchec ECHOUEE avec CauseEchecPonte obligatoire et validée.

7. **Mode GROUPE/INDIVIDUEL** — GET/POST/PATCH/DELETE respectent le paramètre mode (query ou body). Mode invalide → 400.

---

## Patterns de mock utilisés

- `vi.mock("@/lib/queries/geniteurs")` — toutes les fonctions mockées
- `vi.mock("@/lib/queries/reproducteurs")` — fonctions reproducteurs individuels
- `vi.mock("@/lib/queries/pontes")` — listPontes, createPonteV2, getPonteById, deletePonte, updateStripping, updateResultat, markEchec
- `vi.mock("@/lib/permissions")` — requirePermission + ForbiddenError
- `vi.mock("@/lib/auth")` — AuthError
- `NextRequest` avec `new URL(url, "http://localhost:3000")` pour construire les requêtes
- `params: Promise.resolve({ id: "..." })` pour les routes dynamiques

---

## Statut : DONE
