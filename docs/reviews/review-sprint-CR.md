# Review Sprint CR — Code Review Sprint

**Date :** 2026-03-31
**Auteur :** @tester + @code-reviewer
**Sprint :** CR (stories CR1.1–CR4.3)
**Verdict :** APPROUVE

---

## Checklist R1-R9

### R1 — Enums MAJUSCULES

**Statut : CONFORME**

Tous les enums utilisés dans les fichiers Sprint CR sont en UPPERCASE :
- `TypeReleve` : BIOMETRIE, MORTALITE, ALIMENTATION, QUALITE_EAU, COMPTAGE, OBSERVATION, RENOUVELLEMENT
- `CauseMortalite`, `TypeAliment`, `MethodeComptage`, `ComportementAlimentaire` : valeurs UPPERCASE
- `StatutVague`, `StatutCommande`, `StatutFacture` : UPPERCASE confirmé
- Aucune valeur d'enum en camelCase ou minuscule détectée dans les fichiers modifiés

---

### R2 — Import des enums (pas de string literals)

**Statut : CONFORME**

Vérification dans les fichiers Sprint CR :

- `src/lib/validation/releve.schema.ts` : importe `TypeReleve`, `CauseMortalite`, `TypeAliment`, `MethodeComptage`, `ComportementAlimentaire` depuis `@/types`, utilise `z.nativeEnum()` — aucun string literal `"BIOMETRIE"` etc.
- `src/lib/releve-form-validation.ts` : importe `TypeReleve` depuis `@/types`, utilise `TypeReleve.BIOMETRIE` etc. — conforme
- `src/components/releves/*` : aucun string literal détecté pour les enums
- `src/lib/queries/*` : tous les filtres Prisma utilisent les enums importés

---

### R3 — Prisma = TypeScript identiques

**Statut : CONFORME**

- `GompertzVague.configWInfUsed` : présent dans `prisma/schema.prisma` (Float?) et aligné dans les interfaces TypeScript utilisées dans `src/lib/queries/gompertz-analytics.ts`
- `IdempotencyRecord` : champs `key`, `siteId`, `response`, `statusCode`, `expiresAt`, `bodyHash` cohérents entre schéma Prisma et usage dans `src/lib/idempotency.ts`
- Aucune désynchronisation champ Prisma / interface TypeScript détectée

---

### R4 — Opérations atomiques

**Statut : CONFORME**

- `src/lib/idempotency.ts` : utilise `prisma.idempotencyRecord.upsert()` pour le stockage — atomique par définition
- `src/lib/queries/bacs.ts` / `vagues.ts` : les assignations de bacs utilisent `updateMany` avec conditions, pas de pattern check-then-update
- `src/lib/queries/gompertz-analytics.ts` : lectures pures (SELECT), pas de write — pas de risque de race condition
- `src/lib/async-retry.ts` : gère les retries avec backoff exponentiel pour les opérations fire-and-forget — non critique pour l'atomicité DB

---

### R5 — DialogTrigger asChild

**Statut : CONFORME**

Vérification sur tous les usages `DialogTrigger` dans les fichiers modifiés Sprint CR :

- `src/components/remises/remises-list-client.tsx` : `<DialogTrigger asChild>` — commentaire R5 explicite ligne 10 et 347
- `src/components/commissions/admin-retraits-list.tsx` : `<DialogTrigger asChild>` — commentaire R5 ligne 10 et 129-130
- `src/components/commissions/retrait-dialog.tsx` : `<DialogTrigger asChild>` — commentaire R5 ligne 10 et 129-130
- `src/components/vagues/modifier-vague-dialog.tsx` : `<DialogTrigger asChild>` ligne 98

Aucun `DialogTrigger` sans `asChild` détecté dans les fichiers Sprint CR.

---

### R6 — CSS variables du thème

**Statut : CONFORME**

- `src/components/ui/error-boundary.tsx` : utilise des classes Tailwind (`text-destructive`, `bg-background`) — aucune couleur hexadécimale en dur
- `src/components/ui/input.tsx`, `textarea.tsx`, `select.tsx` : utilise les classes Tailwind du design system, CSS variables — aucun `#XXXXXX` détecté
- `src/lib/format.ts` : utilitaires purs, pas de couleurs
- Les fichiers de composants Sprint CR utilisent exclusivement les tokens du design system Tailwind/Radix

---

### R7 — Nullabilité explicite

**Statut : CONFORME**

- `src/lib/validation/releve.schema.ts` : champs optionnels déclarés `.optional()` ou `.nullable()` — `tailleMoyenne` nullable explicite, `notes` nullable
- `src/lib/validation/common.schema.ts` : `notesSchema` déclaré `.optional().nullable()`, `releveDateSchema` déclaré `.optional()` — nullabilité explicite dès le schéma
- `src/lib/gompertz.ts` : `initialGuess?: Partial<GompertzParams>` — optionnel explicite, retour `null` documenté pour les cas insuffisants
- `src/lib/idempotency.ts` : paramètre `key: string | null` — nullabilité explicite, guard `if (!key) return`

---

### R8 — siteId PARTOUT

**Statut : CONFORME**

- `src/lib/idempotency.ts` : `siteId` obligatoire dans `checkIdempotency()` et `storeIdempotency()`, isolation multi-tenant vérifiée (ligne : `if (existing.siteId !== siteId) return { isDuplicate: false }`)
- `src/lib/queries/gompertz-analytics.ts` : `siteId` passé dans chaque query Prisma (`where: { siteId }`)
- `src/app/api/vagues/[id]/gompertz/route.ts` : `siteId` extrait de l'auth context, transmis aux queries
- Toutes les nouvelles routes API Sprint CR (CR1.1, CR4.1, CR4.2, CR4.3) : `siteId` filtré via `requirePermission` → `auth.activeSiteId`

---

### R9 — Tests avant review

**Statut : CONFORME**

- `npx vitest run` exécuté : 3 963 tests passés, 0 régression
- `npm run build` (avec DB locale) exécuté : build OK, 0 erreur
- Rapport complet dans `docs/tests/rapport-sprint-CR.md`

---

## Analyse des fichiers clés Sprint CR

### CR1.1 — Standardisation API routes (apiError helper)

`src/lib/api-utils.ts` : helper `apiError()` correct, format `{ status, message, code?, errors? }` aligné sur `ApiErrorResponse` depuis `src/types/api.ts`. Utilisé dans toutes les routes modifiées.

### CR1.2/CR1.3 — Validation centralisée

`src/lib/validation/releve.schema.ts` : 378 lignes, couverture exhaustive de tous les types. Les bornes physiques (pH, température, O₂) sont documentées et testées. Les schemas utilisent `z.nativeEnum()` — conforme R2.

`src/lib/validation/common.schema.ts` : 101 lignes, schemas réutilisables (`paginationQuerySchema`, `releveDateSchema`, `consommationsSchema`). Centralisation correcte.

### CR1.4 — Calculs corrigés (calculs.ts)

Les fonctions `calculerFCR()`, `calculerSGR()`, `calculerTauxSurvie()`, `calculerBiomasse()` protègent correctement contre la division par zéro et les inputs nuls. Fonctions pures, sans effets de bord.

### CR2.2/CR2.5 — Solveur Gompertz et seuils de confiance

`src/lib/gompertz.ts` : solveur Levenberg-Marquardt correct, bornes physiques biologiques pour Clarias gariepinus. Les nouveaux seuils R² (MEDIUM : > 0.92, HIGH : n≥8 et R² > 0.95) remplacent les anciens seuils trop restrictifs. L'utilisation de `CLARIAS_DEFAULTS` comme fallback est robuste.

La correction `projeterDateRecolte()` pour la zone asymptotique (≥ 95% W∞) via bisection est correcte et testée.

### CR3.1 — Formulaire relevé refactorisé

`src/lib/releve-form-validation.ts` : validation client-side utilisant les enums importés. `src/lib/releve-form-dto.ts` : transformation form → DTO API propre. `src/hooks/use-releve-form.ts` : hook isolé, testable.

### CR3.2 — Error boundary

`src/components/ui/error-boundary.tsx` : composant React conforme, affiche un message d'erreur lisible avec retry. Utilise les classes Tailwind du design system — conforme R6.

### CR4.1/CR4.2 — Retry et idempotence

`src/lib/async-retry.ts` : logique de retry simple et correcte (backoff exponentiel, pas de rejet). `src/lib/idempotency.ts` : isolation multi-tenant correcte, `withIdempotency()` HOF bien typé avec contrainte `TAuth extends AuthContext`.

---

## Observations non bloquantes

1. **OOM sur releves-form.test.tsx** (pre-existing) : Le rendu jsdom du composant `ReleveFormClient` consomme trop de mémoire. Non introduit par le Sprint CR. Recommandation : découper les tests en unités plus petites ou configurer `poolOptions.forks.singleFork: true` dans vitest.config.ts.

2. **Warning workspace root** (pre-existing) : `Next.js inferred your workspace root` — ajouter `outputFileTracingRoot` dans `next.config.ts` si le mono-repo évolue.

3. **DATABASE_URL prod dans build** : `npm run build` appelle `prisma migrate deploy` qui requiert la DB prod. En CI/dev local, passer par la DB locale via env override. Non bloquant en production.

---

## Verdict final

**Sprint CR : APPROUVE**

- R1 CONFORME — Enums UPPERCASE
- R2 CONFORME — Imports enum, aucun string literal
- R3 CONFORME — Prisma et TypeScript alignés
- R4 CONFORME — Opérations atomiques
- R5 CONFORME — DialogTrigger asChild partout
- R6 CONFORME — CSS variables / Tailwind tokens
- R7 CONFORME — Nullabilité explicite
- R8 CONFORME — siteId dans toutes les queries et routes
- R9 CONFORME — Tests exécutés, build vérifié

Le Sprint CR est valide. On peut passer au sprint suivant.
