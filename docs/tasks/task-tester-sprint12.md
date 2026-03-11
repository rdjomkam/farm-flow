# Tâche @tester — Sprint 12 — Story 12.8

**Date :** 2026-03-11
**Assigné par :** @project-manager
**Priorité :** Haute — commence après que @developer a terminé les stories 12.2-12.7

## Prérequis

1. Les stories 12.2-12.7 sont marquées FAIT dans docs/TASKS.md
2. Les bug fixes (BUG-002, BUG-005, M4, M5, S3) sont marqués FAIT

## Story 12.8 — Tests complets Phase 2

### 1. Tests export PDF

Fichier : src/__tests__/api/export.test.ts (nouveau)

Tests pour les routes export :
```typescript
describe("GET /api/export/facture/[id]", () => {
  it("retourne 200 avec Content-Type application/pdf", ...)
  it("retourne 401 sans authentification", ...)
  it("retourne 403 sans permission FINANCES_VOIR", ...)
  it("retourne 404 si facture inexistante", ...)
})

describe("GET /api/export/vague/[id]", () => {
  it("retourne 200 avec PDF", ...)
  it("retourne 401/403/404", ...)
})

describe("GET /api/export/finances", () => {
  it("retourne 200 avec PDF", ...)
  it("accepte filtres dateFrom/dateTo", ...)
})
```

### 2. Tests export Excel

Suite du fichier export.test.ts :
```typescript
describe("GET /api/export/releves", () => {
  it("retourne 200 avec Content-Type xlsx", ...)
  it("accepte filtres vagueId, dateFrom, dateTo", ...)
  it("retourne 401 sans auth", ...)
})

describe("GET /api/export/stock", () => { ... })
describe("GET /api/export/ventes", () => { ... })
```

### 3. Tests non-régression bug fixes

Vérifier les corrections :
```typescript
describe("BUG-002 — Normalisation téléphone", () => {
  it("POST /api/auth/login normalise 6XXXXXXXXX → +2376XXXXXXXXX", ...)
})

describe("M5 — Switch avec default", () => {
  it("POST /api/releves avec typeReleve inconnu retourne 400", ...)
})
```

### 4. Régression complète

```bash
npx vitest run --reporter=verbose
```

Résultat attendu : 905 (base) + nouveaux tests = tous passent, 0 échec.

### 5. Build production

```bash
npm run build
```

Résultat attendu : compilation TypeScript OK, pas d'erreur.

### 6. Rapport

Créer docs/tests/rapport-sprint-12.md :

```markdown
# Rapport de Tests — Sprint 12

**Date :** 2026-03-11
**Testeur :** @tester

## Résumé

- Tests base : 905 (Phase 1 + Sprints 2-11)
- Nouveaux tests : XX (sprint 12 + bug fixes)
- Total : XXX
- Résultat : XX/XX passent, 0 échec

## Fichiers de test

| Fichier | Tests | Statut |
|---------|-------|--------|
| src/__tests__/api/export.test.ts | XX | OK |
| (régression) tous les autres | 905 | OK |

## Build

npm run build : ✅ OK

## Notes

[Observations importantes]
```

## Mise à jour TASKS.md

Quand terminé :
- Story 12.8 : marquer toutes les tâches [x] FAIT
- Ajouter commentaire `<!-- Story 12.8 FAIT le 2026-03-11. @tester. XXX tests, build OK. -->`
