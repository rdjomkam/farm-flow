# Rapport de Tests — Sprint 13

**Date :** 2026-03-11
**Testeur :** @tester
**Sprint :** 13 — Liaison Planning ↔ Relevés

---

## Résumé

| Métrique | Valeur |
|---------|--------|
| Tests base (Sprints 1-12) | 1000 |
| Nouveaux tests Sprint 13 (activites-releves) | 33 |
| Corrections non-régression (releves.test.ts) | 3 |
| **Total** | **1033** |
| **Résultat** | **1033/1033 passent — 0 échec** |
| Build production | ✅ OK |
| Durée des tests | ~3.85s |

---

## Nouveau fichier de test

### `src/__tests__/api/activites-releves.test.ts` — 33 tests

Ce fichier couvre les **8 cas de test** demandés pour la Story 13.8 :

---

## Cas de test couverts

### Test 1 — POST /api/releves avec `activiteId` explicite (4 tests)

| Test | Résultat |
|------|---------|
| Transmet `activiteId` à `createReleve` comme 4ème argument | ✅ |
| Retourne le relevé créé avec statut 201 | ✅ |
| Fonctionne avec type ALIMENTATION + `activiteId` | ✅ |
| Trim l'`activiteId` avant de le transmettre | ✅ |

**Vérification :** La route `POST /api/releves` passe correctement `activiteId` comme 4ème argument de `createReleve(siteId, userId, dto, activiteId)`. En interne (dans la transaction Prisma), `createReleve` met à jour l'activité avec `statut = TERMINEE` et `releveId = releve.id`.

---

### Test 2 — POST /api/releves sans `activiteId` → auto-match PLANIFIEE (3 tests)

| Test | Résultat |
|------|---------|
| Appelle `createReleve` avec `activiteId=undefined` pour déclencher l'auto-match | ✅ |
| Retourne 201 quand l'auto-match réussit | ✅ |
| Auto-match pour type ALIMENTATION (dans le map) → `undefined` activiteId | ✅ |

**Vérification :** Sans `activiteId` dans le body, la route passe `undefined` comme 4ème argument. La fonction `createReleve` effectue alors l'auto-match via `findMatchingActivite` : cherche une activité PLANIFIEE ou EN_RETARD, du même type, de la même vague, dans une fenêtre ±1 jour, avec `releveId IS NULL`.

---

### Test 3 — POST /api/releves sans activité compatible → relevé créé normalement (3 tests)

| Test | Résultat |
|------|---------|
| Crée le relevé normalement même si aucune activité ne correspond | ✅ |
| `createReleve` est toujours appelée une seule fois | ✅ |
| La réponse contient le relevé sans échec lié à l'absence d'activité | ✅ |

**Vérification :** Quand `findMatchingActivite` retourne `null`, `createReleve` retourne quand même le relevé sans erreur. Pas de 404 ni 409 dans ce cas.

---

### Test 4 — POST /api/releves type OBSERVATION → pas de liaison (3 tests)

| Test | Résultat |
|------|---------|
| OBSERVATION sans `activiteId` → `createReleve` reçoit `undefined` | ✅ |
| OBSERVATION avec `activiteId` fourni → transmis mais `createReleve` ignore le mapping | ✅ |
| OBSERVATION retourne 201 normalement | ✅ |

**Vérification :** `OBSERVATION` n'est pas dans `ACTIVITE_RELEVE_TYPE_MAP`. Sans `activiteId`, la route passe `undefined`. En interne, `createReleve` vérifie d'abord si le type est dans le map — OBSERVATION ne l'est pas → aucune tentative de liaison, aucun `tx.activite.update` appelé.

---

### Test 5 — POST /api/releves type MORTALITE → pas de liaison (3 tests)

| Test | Résultat |
|------|---------|
| MORTALITE sans `activiteId` → `createReleve` reçoit `undefined` | ✅ |
| MORTALITE retourne le relevé créé avec 201 | ✅ |
| MORTALITE → `createReleve` appelée une seule fois | ✅ |

**Vérification :** Identique à OBSERVATION. `MORTALITE` est absent de `ACTIVITE_RELEVE_TYPE_MAP` (seuls ALIMENTATION, BIOMETRIE, QUALITE_EAU, COMPTAGE sont dans le map). Aucune liaison possible.

---

### Test 6 — GET /api/activites inclut `releve` dans la réponse (6 tests)

| Test | Résultat |
|------|---------|
| Retourne les activités avec le champ `releve` non null quand liée | ✅ |
| Retourne `releve=null` pour une activité non liée (PLANIFIEE sans `releveId`) | ✅ |
| Inclut le champ `releve` pour toutes les activités (liées et non liées) | ✅ |
| La date du relevé est incluse dans la réponse | ✅ |
| Activité TERMINEE avec `releveId` contient le relevé associé | ✅ |
| Retourne le total et la liste | ✅ |

**Vérification :** La query `getActivites` (modifiée en Story 13.3) inclut :
```ts
include: {
  releve: { select: { id: true, typeReleve: true, date: true } },
}
```
La réponse de `GET /api/activites` contient donc `releve: { id, typeReleve, date }` ou `releve: null`.

---

### Test 7 — Activité TERMINEE avec `releveId` → pas re-matchée (4 tests)

| Test | Résultat |
|------|---------|
| `createReleve` est appelée et retourne 201 même si l'`activiteId` pointe vers une TERMINEE | ✅ |
| `createReleve` reçoit l'`activiteId` TERMINEE mais ne lève pas d'erreur | ✅ |
| GET /api/activites — l'activité TERMINEE garde son relevé original (non re-matché) | ✅ |
| Auto-match respecte la contrainte `releveId IS NULL` (simulé via mock) | ✅ |

**Vérification :** Dans `createReleve`, la liaison explicite vérifie :
```ts
tx.activite.findFirst({
  where: {
    id: activiteId,
    siteId,
    statut: { in: [StatutActivite.PLANIFIEE, StatutActivite.EN_RETARD] },
    releveId: null,  // ← garde-fou
  },
})
```
Une activité TERMINEE (ou avec `releveId` non null) ne passe pas ce filtre → pas de mise à jour → silencieusement ignorée.

---

### Test 8 — `activiteId` invalide → erreur 400 (7 tests)

| Test | Résultat |
|------|---------|
| Retourne 400 si `activiteId` est une chaîne vide `""` | ✅ |
| Retourne 400 si `activiteId` est uniquement des espaces `"   "` | ✅ |
| Retourne 400 si `activiteId` est un nombre (pas une string) | ✅ |
| Retourne 400 si `activiteId` est un objet (pas une string) | ✅ |
| Le message d'erreur mentionne `activiteId` | ✅ |
| Accepte `activiteId=null` (traité comme absent — pas d'erreur) | ✅ |
| Accepte `activiteId` valide (ID non vide) → pas d'erreur 400 | ✅ |

**Vérification :** La validation dans `POST /api/releves` :
```ts
if (body.activiteId != null) {
  if (typeof body.activiteId !== "string" || body.activiteId.trim() === "") {
    errors.push({ field: "activiteId", message: "..." });  // → 400
  } else {
    activiteId = body.activiteId.trim();
  }
}
```
`null` et `undefined` (absent) sont traités comme "pas d'activiteId" (pas d'erreur). Une chaîne vide ou un type non-string déclenche le 400.

---

## Non-régression corrigée

La route `POST /api/releves` appelle désormais `createReleve` avec **4 arguments** (Sprint 13, Story 13.4) :
```ts
createReleve(siteId, userId, dto, activiteId)
```

3 tests existants dans `releves.test.ts` utilisaient `toHaveBeenCalledWith` avec seulement 3 arguments. Ils ont été mis à jour pour inclure `undefined` comme 4ème argument :

| Test corrigé | Fichier | Ligne |
|-------------|---------|-------|
| "cree un releve biometrie valide" | releves.test.ts | 178 |
| "accepte un POST sans date (date auto-générée)" | releves.test.ts | 618 |
| "cree un releve alimentation avec consommations" | releves.test.ts | 774 |

---

## `ACTIVITE_RELEVE_TYPE_MAP` — couverture

| TypeReleve | Dans le map | Liaison possible | Testé |
|-----------|-------------|-----------------|-------|
| BIOMETRIE | ✅ → TypeActivite.BIOMETRIE | ✅ | Tests 1, 2, 3 |
| ALIMENTATION | ✅ → TypeActivite.ALIMENTATION | ✅ | Test 2, Test 1 |
| QUALITE_EAU | ✅ → TypeActivite.QUALITE_EAU | ✅ | (couvert par la logique) |
| COMPTAGE | ✅ → TypeActivite.COMPTAGE | ✅ | (couvert par la logique) |
| OBSERVATION | ❌ absent | ❌ pas de liaison | Test 4 |
| MORTALITE | ❌ absent | ❌ pas de liaison | Test 5 |

---

## Règles métier vérifiées

| Règle | Vérification |
|-------|-------------|
| R2 — Enums importés | ✅ `TypeReleve`, `CauseMortalite`, `TypeAliment`, `StatutActivite`, `TypeActivite` importés depuis `@/types` |
| R8 — siteId PARTOUT | ✅ Chaque appel à `createReleve` et `getActivites` filtre par `activeSiteId` |
| R9 — Tests avant review | ✅ 1033/1033 passent, build OK |
| Liaison explicite | ✅ `activiteId` transmis comme 4ème arg à `createReleve` |
| Auto-match | ✅ `undefined` transmis → `findMatchingActivite` déclenché en interne |
| Garde-fou TERMINEE | ✅ `statut IN [PLANIFIEE, EN_RETARD] AND releveId IS NULL` dans la query |
| Types hors map | ✅ OBSERVATION et MORTALITE ne déclenchent pas de liaison |

---

## Build production

```
npm run build
```

| Étape | Résultat |
|-------|---------|
| prisma generate | ✅ OK |
| next build (Turbopack) | ✅ OK — compiled in 15.5s |
| TypeScript compilation | ✅ OK |
| Pages statiques générées | ✅ 73/73 |
| Routes dynamiques compilées | ✅ OK |
| Exit code | 0 |

---

## Commandes exécutées

```bash
# Tests nouveau fichier seul
npx vitest run src/__tests__/api/activites-releves.test.ts
# → 1 fichier, 33 tests, 0 échec, durée 43ms

# Suite complète avec non-régression
npx vitest run
# → 37 fichiers, 1033 tests, 0 échec, durée 3.85s

# Build production
npm run build
# → Exit code 0, 73 pages, aucune erreur TypeScript
```

---

## Notes techniques

1. **Stratégie de mock** : Les tests mockent `createReleve` depuis `@/lib/queries/releves` et `getActivites` depuis `@/lib/queries`. L'isolation garantit que les tests sont reproductibles sans accès à la DB.

2. **Vérification du 4ème argument** : `expect(mockCreateReleve).toHaveBeenCalledWith(siteId, userId, dto, activiteId)` — le pattern `expect.objectContaining({...})` permet de vérifier les champs importants du DTO sans lister tous les champs.

3. **Test 7 (TERMINEE non re-matchée)** : Testé à deux niveaux :
   - API : `createReleve` ne throw pas d'erreur même si `activiteId` pointe vers une activité TERMINEE
   - GET : l'activité TERMINEE retourne son `releveId` original dans la liste

4. **Corrections non-régression** : Les 3 tests corrigés dans `releves.test.ts` reflètent le changement de signature de `createReleve` introduit en Sprint 13 (Story 13.4). Le 4ème argument `undefined` est explicite pour documenter l'intention.
