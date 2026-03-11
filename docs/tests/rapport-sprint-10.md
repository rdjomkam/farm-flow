# Rapport de tests — Sprint 10 : Production Alevins

**Auteur :** @tester
**Date :** 2026-03-10
**Sprint :** 10 — Production Alevins (Reproducteurs, Pontes, Lots d'alevins)

---

## Résumé

| Indicateur | Valeur |
|---|---|
| Nouveaux fichiers de test | 3 |
| Nouveaux tests ajoutés | 113 |
| Tests anciens (non-régression) | 636 |
| Total tests exécutés | 749 |
| Tests passants | 748 |
| Tests échouants | 1 (bug préexistant Sprint 10, non lié aux nouveaux tests) |
| Build production | KO (2 bugs préexistants Sprint 10) |

---

## Fichiers de test créés

### 1. `src/__tests__/api/reproducteurs.test.ts`

**36 tests** couvrant le CRUD complet des reproducteurs.

| Groupe | Tests |
|---|---|
| GET /api/reproducteurs | 9 tests (liste, filtres sexe/statut/search, invalides, 401/403/500) |
| POST /api/reproducteurs | 11 tests (création valide, champs obligatoires, validation code/sexe/poids/age/date) |
| GET /api/reproducteurs/[id] | 3 tests (trouvé, 404, 401) |
| PUT /api/reproducteurs/[id] | 7 tests (mise à jour valide, code vide, sexe invalide, poids <=0, statut invalide, 404, 403) |
| DELETE /api/reproducteurs/[id] | 5 tests (suppression OK, 404, 409 pontes liées, 401, 403) |

**Cas limites validés :**
- Code vide ou absent → 400
- Sexe invalide (ex: "NEUTRE") → 400 (enum ignoré côté GET, rejeté côté POST/PUT)
- Poids <= 0 → 400
- Age négatif → 400
- Date d'acquisition invalide (non-ISO) → 400
- Suppression avec pontes liées → 409

### 2. `src/__tests__/api/pontes.test.ts`

**35 tests** couvrant le CRUD complet des pontes.

| Groupe | Tests |
|---|---|
| GET /api/pontes | 8 tests (liste, filtres statut/femelleId/search, statut invalide, 401/403/500) |
| POST /api/pontes | 13 tests (création valide, champs min, code/femelleId/datePonte manquants, tauxFecondation bornes, nombreOeufs <=0, 401) |
| GET /api/pontes/[id] | 3 tests (trouvé, 404, 401) |
| PUT /api/pontes/[id] | 6 tests (mise à jour valide, tauxFecondation >100, statut invalide, datePonte invalide, 404, 403) |
| DELETE /api/pontes/[id] | 5 tests (suppression OK, 404, 409 lots liés, 401, 403) |

**Cas limites validés :**
- `tauxFecondation` hors [0, 100] → 400
- Valeurs limites acceptées : tauxFecondation = 0 → 201, tauxFecondation = 100 → 201
- `femelleId` vide ou absent → 400
- `datePonte` absente ou invalide → 400
- `nombreOeufs` = 0 → 400 (doit être strictement > 0)
- Suppression avec lots d'alevins liés → 409

### 3. `src/__tests__/api/lots-alevins.test.ts`

**42 tests** couvrant le CRUD et l'opération de transfert des lots d'alevins.

| Groupe | Tests |
|---|---|
| GET /api/lots-alevins | 8 tests (liste, filtres statut/ponteId/search, statut invalide, 401/403/500) |
| POST /api/lots-alevins | 11 tests (création valide, nombreActuel par défaut, validation code/ponteId/nombreInitial/nombreActuel/ageJours/poidsMoyen, 401) |
| GET /api/lots-alevins/[id] | 4 tests (trouvé, 404, 401, 403) |
| PUT /api/lots-alevins/[id] | 7 tests (mise à jour valide, nombreActuel/ageJours négatif, poidsMoyen <=0, statut invalide, 404, 403) |
| POST /api/lots-alevins/[id]/transferer | 12 tests (transfert valide, nom/bacIds manquants, bacIds vide/non-tableau/absent, 404, 409 statut, 409 bacs occupés, 401, 403, 500) |

**Cas limites validés :**
- `nombreInitial` <= 0 → 400
- `nombreActuel` négatif → 400
- `ageJours` négatif → 400
- `poidsMoyen` <= 0 → 400
- `nombreActuel` par défaut = `nombreInitial` si absent
- Transfert avec `bacIds` non-tableau → 400
- Transfert avec `bacIds` vide → 400
- Lot non en statut `EN_ELEVAGE` → 409
- Bacs déjà assignés à une autre vague → 409
- Erreur serveur inattendue → 500

---

## Résultats vitest run

```
Test Files  1 failed | 29 passed (30)
Tests       1 failed | 748 passed (749)
```

### Détail des fichiers passants (30 fichiers)

| Fichier | Tests |
|---|---|
| src/__tests__/api/reproducteurs.test.ts | 36 PASS |
| src/__tests__/api/pontes.test.ts | 35 PASS |
| src/__tests__/api/lots-alevins.test.ts | 42 PASS |
| src/__tests__/api/fournisseurs.test.ts | PASS |
| src/__tests__/api/commandes.test.ts | PASS |
| src/__tests__/api/ventes.test.ts | PASS |
| src/__tests__/api/factures.test.ts | PASS |
| src/__tests__/api/clients.test.ts | PASS |
| src/__tests__/api/produits.test.ts | PASS |
| src/__tests__/api/sites.test.ts | PASS |
| src/__tests__/api/mouvements.test.ts | PASS |
| src/__tests__/api/bacs.test.ts | PASS |
| src/__tests__/api/vagues.test.ts | PASS |
| src/__tests__/api/releves.test.ts | PASS |
| src/__tests__/api/alertes-stock.test.ts | PASS |
| src/__tests__/api/analytics-bacs.test.ts | PASS |
| src/__tests__/api/analytics-aliments.test.ts | PASS |
| src/__tests__/api/auth.test.ts | PASS |
| src/__tests__/api/auth-protection.test.ts | PASS |
| src/__tests__/auth/phone.test.ts | PASS |
| src/__tests__/auth/password.test.ts | PASS |
| src/__tests__/calculs.test.ts | PASS |
| src/__tests__/permissions.test.ts | 1 FAIL (voir ci-dessous) |
| src/__tests__/ui/*.test.tsx | PASS |

---

## Bug préexistant détecté : permissions.test.ts

### Échec

```
FAIL src/__tests__/permissions.test.ts > PERMISSION_GROUPS > couvre exactement 27 permissions sans doublon
AssertionError: expected [ Array(30) ] to have a length of 33 but got 30
```

### Cause racine

Le Sprint 10 a ajouté 3 nouvelles permissions à l'enum `Permission` dans `src/types/models.ts` :
- `ALEVINS_CREER`
- `ALEVINS_MODIFIER`
- `ALEVINS_SUPPRIMER`

Mais la constante `PERMISSION_GROUPS` dans `src/lib/permissions-constants.ts` (groupe `alevins`) ne contient que :
```typescript
alevins: [Permission.ALEVINS_VOIR, Permission.ALEVINS_GERER],
```

Il manque les 3 nouvelles permissions dans ce groupe.

### Statut

Ce bug était présent AVANT la création des nouveaux tests Sprint 10. Il n'est pas introduit par les tests de ce rapport. Il doit être corrigé par le @developer ou @architect responsable du Sprint 10.

**Fichier à corriger :** `src/lib/permissions-constants.ts` — ajouter `ALEVINS_CREER`, `ALEVINS_MODIFIER`, `ALEVINS_SUPPRIMER` dans le groupe `alevins`.

---

## Bug préexistant détecté : build production

### Échec

```
./src/components/alevins/ponte-detail-client.tsx:286:19
Type error: Type '"destructive"' is not assignable to type '"primary" | "secondary" | "danger" | "ghost" | "outline" | undefined'.
```

### Cause racine

Le composant `src/components/alevins/ponte-detail-client.tsx` utilise `variant="destructive"` sur un composant `Button`, mais la variante `"destructive"` n'existe pas dans la définition du composant Button du projet (qui accepte : `"primary"`, `"secondary"`, `"danger"`, `"ghost"`, `"outline"`).

### Statut

Bug préexistant Sprint 10, non lié aux tests. Le @developer doit corriger `variant="destructive"` en `variant="danger"` dans ce composant.

---

## Conclusion

Les **113 nouveaux tests** du Sprint 10 passent tous. La non-régression sur les 636 tests existants est confirmée sauf pour le test `permissions.test.ts` qui révèle un bug préexistant dans la synchronisation des permissions alevins entre l'enum et `PERMISSION_GROUPS`.

**Actions requises avant la review Sprint 10 :**

1. Corriger `src/lib/permissions-constants.ts` : ajouter `ALEVINS_CREER`, `ALEVINS_MODIFIER`, `ALEVINS_SUPPRIMER` au groupe `alevins`
2. Corriger `src/components/alevins/ponte-detail-client.tsx` : remplacer `variant="destructive"` par `variant="danger"`
3. Relancer `npx vitest run` et `npm run build` pour vérification finale

**Résultat vitest (hors bug préexistant) :** 748/749 tests passent, les 113 nouveaux tests Sprint 10 passent tous a 100%.
