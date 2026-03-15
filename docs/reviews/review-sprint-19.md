# Code Review — Sprint 19 (ConfigElevage & Refactoring Benchmarks)

**Date :** 2026-03-15
**Reviewer :** @code-reviewer (PM proxy)
**Sprint :** 19 — Phase 3

---

## Statut : VALIDE

---

## Checklist R1-R9

| Regle | Description | Statut |
|-------|-------------|--------|
| R1 | Enums MAJUSCULES | OK — PhaseElevage.ACCLIMATATION etc. |
| R2 | Import enums | OK — `import { PhaseElevage } from "@/types"` utilise comme valeur |
| R3 | Prisma = TypeScript identiques | OK — ConfigElevage interface miroir du schema |
| R4 | Operations atomiques | OK — isDefault enforced via $transaction.updateMany |
| R5 | DialogTrigger asChild | N/A — pas de Dialog dans ce sprint |
| R6 | CSS variables du theme | OK — `text-muted-foreground`, `border-border`, `bg-card` |
| R7 | Nullabilite explicite | OK — description nullable explicite, JSON non nullables |
| R8 | siteId PARTOUT | OK — ConfigElevage a siteId String NOT NULL + index |
| R9 | Tests avant review | OK — npx vitest run (1175/1175) + npm run build |

---

## Points forts

1. **Architecture de validation robuste** : separation `baseConfigElevageObject` / `createConfigElevageSchema` / `updateConfigElevageSchema` pour contourner la limitation Zod v4 (.partial() sur superRefine)
2. **Fallback EC-5.1 propre** : `CONFIG_ELEVAGE_DEFAULTS` hardcodes + flag `isFallback: true` dans /defaut
3. **Atomicite EC-5.2** : $transaction pour unset isDefault avant set (pas de race condition)
4. **Retrocompatibilite** : benchmarks.ts et calculs.ts avec config? optionnel, aucun appel existant modifie
5. **UI mobile-first** : cartes empilees, sections repliables, form avec template selector
6. **Type safety** : z.nativeEnum(PhaseElevage) pour alignement enum TypeScript/Zod

---

## Problemes identifies et corriges pendant le sprint

### BUG-1 : `auth.role` sur AuthContext
**Severite :** Haute
**Description :** AuthContext n'a pas de propriete `role` mais `globalRole`. Les checks PISCICULTEUR etaient donc impossibles. De plus, requirePermission(SITE_GERER) bloque deja les PISCICULTEUR par design.
**Fix :** Retire les checks redondants. La permission SITE_GERER enforce EC-12.2 implicitement.

### BUG-2 : Toast variant "destructive"
**Severite :** Moyenne (build failure)
**Description :** Ce codebase utilise `variant: "error"` pas `"destructive"`.
**Fix :** Remplacement systematique dans les 3 composants config-elevage.

### BUG-3 : PhaseElevage string literals vs enum
**Severite :** Haute (build failure)
**Description :** `return "ACCLIMATATION"` dans detecterPhase() non assignable a `PhaseElevage`.
**Fix :** Utilise `PhaseElevage.ACCLIMATATION` + import valeur (pas type).

### BUG-4 : Zod .partial() sur schema avec .superRefine()
**Severite :** Critique (runtime error)
**Description :** Zod v4 interdit `.partial()` sur un schema avec `.superRefine()`.
**Fix :** Separe le schema de base sans refinements, les deux schemas derivent de la base.

### BUG-5 : alimentTailleConfig JsonValue null dans dupliquer
**Severite :** Haute (build failure)
**Description :** Prisma retourne `JsonValue` (peut etre null) mais create attend `InputJsonValue`.
**Fix :** Destructure et applique `?? []` fallback sur les champs JSON.

### BUG-6 : Champs oxygene/nitrite manquants dans FORM_DEFAULTS
**Severite :** Haute (build failure TypeScript)
**Description :** ConfigElevage interface requiert oxygeneMin, oxygeneAlerte, oxygeneOptimal, nitriteMax, nitriteAlerte mais absents de FORM_DEFAULTS.
**Fix :** Ajoute les 5 champs + sections UI dans form-client et edit-client.

---

## Points d'amelioration (non bloquants)

1. Les composants edit-client et form-client sont tres longs (330+ lignes). Dans un sprint suivant, extraire les sections individuelles en composants.
2. La validation cote client (Zod schemas) n'est pas encore wired dans le formulaire — uniquement la validation API. A implementer dans Sprint 20+.
3. L'alimentation JSON (alimentTailleConfig, alimentTauxConfig) n'est pas editable dans l'UI — seulement copie depuis un template. Un editeur JSON avance pourrait etre ajoute.

---

## Fichiers cles

| Fichier | Description |
|---------|-------------|
| `prisma/schema.prisma` | PhaseElevage enum + ConfigElevage model |
| `prisma/migrations/20260319100000_add_config_elevage/migration.sql` | Migration Sprint 19 |
| `src/lib/validation/config-elevage.ts` | Schemas Zod avec baseConfigElevageObject |
| `src/lib/queries/config-elevage.ts` | CRUD + dupliquer + CONFIG_ELEVAGE_DEFAULTS |
| `src/app/api/config-elevage/` | 4 routes (GET/POST, GET/PUT/DELETE, defaut, dupliquer) |
| `src/lib/benchmarks.ts` | getBenchmark*() avec config optionnel |
| `src/lib/calculs.ts` | detecterPhase, getTauxAlimentation, getTailleAliment, convertirUniteStock |
| `src/lib/alertes.ts` | verifierAlertes avec configElevage optionnel |
| `src/components/config-elevage/` | list-client, edit-client, form-client |
| `src/app/settings/config-elevage/` | 3 pages server component |

---

## Conclusion

Sprint 19 valide. Toutes les stories sont implementees correctement. Les 6 bugs detectes pendant le sprint ont ete corriges avant la review. Le code respecte les regles R1-R9. La non-regression est confirmee. Le build production est propre.

**Decision : SPRINT 19 — APPROUVE**
