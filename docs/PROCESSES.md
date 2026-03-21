# Processus de Développement — Farm Flow

> Chaque **story** suit un processus selon son type.
> Le @project-manager identifie le type, puis exécute le pipeline correspondant.

---

## Agents disponibles

| Agent | Rôle | Écrit du code ? |
|-------|------|-----------------|
| `@project-manager` | Identifie le type de story, assigne le pipeline, suit le statut | NON |
| `@pre-analyst` | Explore le code, détecte incohérences, valide prérequis | NON (lecture + build/tests) |
| `@architect` | Design, types TypeScript, DTOs, ADR | Types & docs seulement |
| `@db-specialist` | Schema Prisma, migrations, seed, queries | OUI (DB only) |
| `@developer` | API routes, UI composants, pages, services | OUI |
| `@tester` | Tests unitaires, intégration, non-régression | OUI (tests only) |
| `@code-reviewer` | Review qualité, R1-R9, rapport | NON |
| `@knowledge-keeper` | Maintient ERRORS-AND-FIXES.md | NON (docs only) |
| `@status-updater` | Met à jour les statuts dans docs/sprints/ et docs/TASKS.md | NON (statuts only) |

---

## Fichier partagé critique

| Fichier | Lu par | Écrit par |
|---------|--------|-----------|
| `docs/knowledge/ERRORS-AND-FIXES.md` | TOUS les agents (obligatoire avant de travailler) | `@knowledge-keeper` |
| `docs/TASKS.md` / `docs/sprints/*.md` | TOUS | `@status-updater` (spawné par `@project-manager`) |
| `docs/analysis/pre-analysis-story-*.md` | `@project-manager` | `@pre-analyst` |
| `docs/reviews/review-story-*.md` | `@project-manager`, `@knowledge-keeper` | `@code-reviewer` |
| `docs/decisions/ADR-*.md` | TOUS | `@architect` |

---

## Comment identifier le type d'une story

Le @project-manager lit la story et lui assigne un type :

| Type | Indice | Exemple |
|------|--------|---------|
| `SCHEMA` | Modifie schema.prisma, ajoute enums/modèles, migration | Story 30.1 — 7 enums + 7 modèles |
| `TYPES` | Ajoute interfaces TS, DTOs, constantes, exports | Story 30.2 — Interfaces TypeScript |
| `ADR` | Documente une décision architecturale | Story 30.3 — ADR paiement/lifecycle |
| `QUERIES` | Crée/modifie des fonctions dans src/lib/queries/ | Story 30.4 — Queries Prisma |
| `API` | Crée/modifie des routes dans src/app/api/ | Story 32.1 — CRUD Plans API |
| `UI` | Crée/modifie des pages ou composants React | Story 33.1 — Page checkout |
| `INTEGRATION` | Intègre un service externe (paiement, SMS, etc.) | Story 31.1 — PaymentGateway |
| `BUGFIX` | Corrige un bug existant | BUG-XXX |
| `REFACTOR` | Change un pattern transversal | Ajouter siteId partout |
| `TEST` | Écrit ou exécute des tests | Story 30.5 — Tests fondations |
| `REVIEW` | Review de code d'un sprint ou lot de stories | Story 30.5 — Review R1-R9 |

---

## Pipelines par type de story

### Type `SCHEMA` — Changement de schéma Prisma

```
@pre-analyst → @db-specialist → @code-reviewer → @knowledge-keeper
```

| Étape | Agent | Action |
|-------|-------|--------|
| 1. Pré-analyse | `@pre-analyst` | Vérifie l'état actuel du schéma, détecte conflits potentiels, valide GO |
| 2. Implémentation | `@db-specialist` | Modifie schema.prisma, crée migration (non-interactive), met à jour seed.sql |
| 3. Review | `@code-reviewer` | Vérifie R1 (enums MAJUSCULES), R7 (nullabilité), R8 (siteId), index |
| 4. Capitalisation | `@knowledge-keeper` | Si erreurs trouvées → met à jour ERRORS-AND-FIXES.md |

---

### Type `TYPES` — Interfaces TypeScript, DTOs, constantes

```
@pre-analyst → @architect → @code-reviewer
```

| Étape | Agent | Action |
|-------|-------|--------|
| 1. Pré-analyse | `@pre-analyst` | Vérifie que le schéma Prisma existe (dépendance SCHEMA satisfaite), compare champs |
| 2. Implémentation | `@architect` | Crée/modifie models.ts, api.ts, constantes, index.ts barrel exports |
| 3. Review | `@code-reviewer` | Vérifie R2 (imports enums), R3 (Prisma = TS identiques), pas de `any` |

---

### Type `ADR` — Décision architecturale

```
@architect (seul)
```

| Étape | Agent | Action |
|-------|-------|--------|
| 1. Rédaction | `@architect` | Crée docs/decisions/ADR-XXX.md avec contexte, options, décision, conséquences |

> Pas de pré-analyse ni review : un ADR est un document de design, pas du code.

---

### Type `QUERIES` — Fonctions de query Prisma

```
@pre-analyst → @db-specialist → @tester → @code-reviewer → @knowledge-keeper
```

| Étape | Agent | Action |
|-------|-------|--------|
| 1. Pré-analyse | `@pre-analyst` | Vérifie que schéma + types existent, que les modèles référencés sont en place |
| 2. Implémentation | `@db-specialist` | Crée src/lib/queries/xxx.ts, respecte pattern siteId + atomique (R4, R8) |
| 3. Tests | `@tester` | Tests unitaires des queries (cas nominal + cas limites) |
| 4. Review | `@code-reviewer` | Vérifie R4 (atomique), R8 (siteId), pas de N+1, types de retour |
| 5. Capitalisation | `@knowledge-keeper` | Si erreurs trouvées → met à jour ERRORS-AND-FIXES.md |

---

### Type `API` — Route API (src/app/api/)

```
@pre-analyst → @developer → @tester → @code-reviewer → @knowledge-keeper
```

| Étape | Agent | Action |
|-------|-------|--------|
| 1. Pré-analyse | `@pre-analyst` | Vérifie que queries + types + permissions existent |
| 2. Implémentation | `@developer` | Crée route.ts, requirePermission(), validation, gestion d'erreurs |
| 3. Tests | `@tester` | Tests d'intégration de la route (200, 400, 401, 403, 404) |
| 4. Review | `@code-reviewer` | Vérifie auth, validation, erreurs, R2 (imports), pas de secrets en dur |
| 5. Capitalisation | `@knowledge-keeper` | Si erreurs trouvées → met à jour ERRORS-AND-FIXES.md |

---

### Type `UI` — Page ou composant React

```
@pre-analyst → @developer → @tester → @code-reviewer
```

| Étape | Agent | Action |
|-------|-------|--------|
| 1. Pré-analyse | `@pre-analyst` | Vérifie que les API routes existent, que les types sont définis, permissions en place |
| 2. Implémentation | `@developer` | Crée page.tsx (Server Component), Client Components, navigation (sidebar/bottom-nav) |
| 3. Tests | `@tester` | Tests de rendu, interactions, mobile-first (360px) |
| 4. Review | `@code-reviewer` | Vérifie R5 (asChild), R6 (CSS variables), mobile-first, Server Components par défaut |

---

### Type `INTEGRATION` — Service externe (paiement, SMS, etc.)

```
@pre-analyst → @architect → @developer → @tester → @code-reviewer → @knowledge-keeper
```

| Étape | Agent | Action |
|-------|-------|--------|
| 1. Pré-analyse | `@pre-analyst` | Vérifie que les modèles de persistance existent (PaiementAbonnement, etc.) |
| 2. Design | `@architect` | Définit l'interface d'abstraction, le factory pattern, les types |
| 3. Implémentation | `@developer` | Implémente le(s) gateway(s), webhook routes, retry logic |
| 4. Tests | `@tester` | Tests des gateways (mock API externe), tests webhooks, tests idempotence |
| 5. Review | `@code-reviewer` | Review sécurité : idempotence, validation webhook, secrets dans .env, HTTPS |
| 6. Capitalisation | `@knowledge-keeper` | Documente les pièges de l'intégration (timeouts, formats, edge cases) |

---

### Type `BUGFIX` — Correction de bug

```
@pre-analyst → Agent fixeur → @tester → @code-reviewer (si sévère) → @knowledge-keeper
```

| Étape | Agent | Action |
|-------|-------|--------|
| 1. Diagnostic | `@pre-analyst` | Reproduit le bug, identifie la cause racine, identifie les fichiers impactés |
| 2. Fix | Agent selon la zone : `@db-specialist` (schema/query), `@developer` (API/UI), `@architect` (types) | Corrige + écrit un test de non-régression |
| 3. Vérification | `@tester` | Vérifie le fix + exécute la suite complète |
| 4. Review | `@code-reviewer` | Review obligatoire si sévérité Critique ou Haute |
| 5. Capitalisation | `@knowledge-keeper` | Ajoute ERR-XXX dans ERRORS-AND-FIXES.md (TOUJOURS, même pour bugs mineurs) |

---

### Type `REFACTOR` — Changement transversal

```
@pre-analyst → @architect → Agent implémenteur → @tester → @code-reviewer → @knowledge-keeper
```

| Étape | Agent | Action |
|-------|-------|--------|
| 1. Inventaire | `@pre-analyst` | Liste TOUS les fichiers impactés, identifie les risques de régression |
| 2. Plan | `@architect` | Valide le plan, crée ADR si nécessaire |
| 3. Implémentation | `@developer` ou `@db-specialist` | Applique les changements, `npm run build` après chaque groupe |
| 4. Tests | `@tester` | Suite complète + tests de non-régression ciblés |
| 5. Review | `@code-reviewer` | Vérifie qu'aucun fichier n'est oublié |
| 6. Capitalisation | `@knowledge-keeper` | Documente le pattern avant/après |

---

### Type `TEST` — Écriture ou exécution de tests

```
@tester (seul, ou + @developer si fix nécessaire)
```

| Étape | Agent | Action |
|-------|-------|--------|
| 1. Écriture | `@tester` | Écrit les tests (unitaires, intégration), exécute `npx vitest run` + `npm run build` |
| 2. Fix si échec | `@developer` ou `@db-specialist` | Corrige le code si les tests révèlent un bug |
| 3. Rapport | `@tester` | Produit docs/tests/rapport-story-XX.md |

---

### Type `REVIEW` — Review de code

```
@code-reviewer → @knowledge-keeper
```

| Étape | Agent | Action |
|-------|-------|--------|
| 1. Review | `@code-reviewer` | Review R1-R9 sur les fichiers modifiés, produit rapport |
| 2. Capitalisation | `@knowledge-keeper` | Extrait les erreurs récurrentes → ERRORS-AND-FIXES.md |

> Si la review identifie des problèmes, le @project-manager spawne l'agent concerné pour corriger, puis relance la review.

---

## Règles transversales

### Avant de travailler, chaque agent DOIT lire :
1. `CLAUDE.md` — conventions du projet
2. `docs/knowledge/ERRORS-AND-FIXES.md` — erreurs connues à éviter

### Après avoir codé, chaque agent DOIT exécuter :
1. `npm run build` — compilation OK
2. `npx vitest run` — tests passent

### Le @project-manager DOIT :
1. Identifier le type de chaque story avant de l'assigner
2. Suivre le pipeline correspondant dans l'ordre exact
3. Ne jamais sauter la pré-analyse pour les types SCHEMA, QUERIES, API, UI, INTEGRATION, BUGFIX, REFACTOR
4. Toujours spawner @knowledge-keeper après un BUGFIX ou une REVIEW avec problèmes
5. Ne jamais coder lui-même
6. Spawner `@status-updater` pour toute mise à jour de statut (ne jamais éditer docs/sprints/ ou docs/TASKS.md directement)

### Parallélisation :
- Deux stories de types différents SANS dépendance entre elles → pipelines en parallèle
- Au sein d'un pipeline → toujours séquentiel (chaque étape dépend de la précédente)
- Exception : Type `ADR` peut être parallélisé avec n'importe quoi (c'est de la doc)
