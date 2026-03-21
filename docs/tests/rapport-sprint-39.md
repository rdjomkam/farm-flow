# Rapport de tests — Sprint 39 (i18n Infrastructure)

**Tester :** @tester
**Date :** 2026-03-21
**Sprint :** 39
**Status :** PASSE

---

## Résumé

| Fichier de test | Tests | Statut |
|-----------------|-------|--------|
| `src/__tests__/lib/format-i18n.test.ts` | 26 | PASSE |
| `src/__tests__/api/locale.test.ts` | 15 | PASSE |
| `src/__tests__/i18n/messages.test.ts` | 37 | PASSE |
| **Total Sprint 39** | **78** | **PASSE** |

---

## Fichiers couverts

### 1. `src/__tests__/lib/format-i18n.test.ts`

Tests unitaires pour `src/lib/format.ts` avec le nouveau paramètre `locale`.

**Suites :**
- `formatXAF — locale fr (défaut)` : séparateur espace en français, valeur 0, appel sans paramètre identique à `fr` explicite
- `formatXAF — locale en` : séparateur virgule en anglais, divergence fr vs en vérifiée
- `formatXAFOrFree — locale fr (défaut)` : retourne "Gratuit" pour 0, délègue à formatXAF pour montants non nuls
- `formatXAFOrFree — locale en` : retourne "Free" pour 0, ne retourne pas "Gratuit"
- `formatDate — avec locale parameter` : format dd/mm/yyyy en fr, m/dd/yyyy en en, divergence confirmée, backward compat
- `Compatibilité ascendante` : chaque fonction fonctionne sans paramètre locale, les valeurs par défaut sont bien françaises

**Cas limites couverts :**
- `formatXAF(0)` → "0 FCFA" (pas de division par zéro, pas de séparateur parasite)
- Appel sans locale → identique à locale "fr"
- Locale "fr" et "en" produisent des résultats différents pour un même montant ou une même date

### 2. `src/__tests__/api/locale.test.ts`

Tests d'intégration pour `PUT /api/locale`.

**Suites :**
- Cas valides : 200 avec "en", 200 avec "fr", updateMany DB appelé, cookie NEXT_LOCALE défini, locale retournée dans le JSON
- Cas invalides (400) : locale "de", locale "es", locale absente, locale null, locale nombre, message d'erreur mentionne les locales autorisées, updateMany non appelé
- Non authentifié (401) : AuthError → 401, updateMany non appelé
- Sans cookie de session : 200 retourné, updateMany non appelé (comportement documenté dans le code source)

**Mocks utilisés :**
- `@/lib/auth` : `requireAuth`, `AuthError`, `SESSION_COOKIE_NAME`
- `@/lib/db` : `prisma.session.updateMany`

### 3. `src/__tests__/i18n/messages.test.ts`

Tests de structure des fichiers de messages i18n.

**Suites :**
- `common.json — chargement` : les deux fichiers chargent, sont des objets, contiennent les 6 sections attendues, les clés de premier niveau sont identiques
- `common.json — parité de clés fr/en` : toutes les clés imbriquées sont identiques (extraction récursive dot-path), les valeurs fr ne sont pas vides, les valeurs en ne sont pas vides, fr.buttons.add != en.buttons.add
- `format.json — chargement` : les deux fichiers chargent, contiennent les 4 sections attendues, les clés de premier niveau sont identiques
- `format.json — parité de clés fr/en` : toutes les clés imbriquées sont identiques, `price.free` = "Gratuit" (fr) / "Free" (en), `units.currency` = "FCFA" dans les deux, le placeholder `{count}` est présent dans `dates.daysAgo` des deux locales
- `messages/index.ts — barrel exports` : `namespaces` est un tableau, contient "common" et "format", a exactement 2 entrées

---

## Suite complète

| Statut | Fichiers | Tests |
|--------|----------|-------|
| PASSE (avant Sprint 39) | 85 | 2510 |
| PASSE (Sprint 39 nouveaux) | 3 | 78 |
| **PASSE total** | **88** | **2588** |
| ECHEC pre-existants | 6 | 19 |

Les 19 échecs pré-existants ne sont PAS causés par Sprint 39. Ils concernent :
- `benchmarks.test.ts` (3) : evaluerBenchmark densité — régressions sprint antérieurs
- `sprint22.test.ts` (1) : RELEVE_COMPATIBLE_TYPES — régression sprint antérieur
- `plans.test.ts` (1) : plan inactif sans auth — régression sprint antérieur
- `remises-verifier.test.ts` (6) : route modifiée sprint 35 — mocks desynchronisés
- `sites.test.ts` (4) : roles custom — régression sprint antérieur
- `vagues.test.ts` (4) : refactoring R4 — mocks desynchronisés (voir ERR-017)

---

## Build

```
npm run build → SUCCESS
```

Avertissement non bloquant : Turbopack workspace root (Next.js config), sans lien avec Sprint 39.

---

## Règles R1-R9 vérifiées

| Règle | Statut | Note |
|-------|--------|------|
| R1 — Enums UPPERCASE | N/A | Pas d'enum dans les tests i18n |
| R2 — Importer enums | N/A | Pas d'enum dans les tests i18n |
| R3 — Prisma = TypeScript | N/A | Pas de modèle Prisma testé directement |
| R4 — Opérations atomiques | Vérifié | Route PUT /api/locale utilise `updateMany` (atomique) |
| R5 — DialogTrigger asChild | N/A | Pas de composant UI |
| R6 — CSS variables | N/A | Pas de CSS |
| R7 — Nullabilité explicite | Vérifié | Tests couvrent locale null → 400 |
| R8 — siteId partout | N/A | Session.locale ne nécessite pas siteId |
| R9 — Tests avant review | Vérifié | `npx vitest run` + `npm run build` exécutés |
