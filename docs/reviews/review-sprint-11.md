# Review Sprint 11 — Alertes + Planning + Dashboard financier

**Reviewer :** @code-reviewer
**Date :** 2026-03-11
**Sprint :** 11
**Verdict :** CONDITIONNEL → APPROUVÉ (après corrections I-1 à I-4)

## Résumé

Sprint 11 a ajouté 3 modules :
- **Alertes** : ConfigAlerte, Notification, vérification automatique des seuils
- **Planning** : Activite, calendrier, formulaire activité
- **Finances** : Dashboard KPIs, graphiques Recharts (AreaChart, BarChart), top clients

### Périmètre
- 3 modèles Prisma + 5 enums + 1 migration
- 13 API routes (alertes, notifications, planning, finances)
- 5 pages UI + 6 composants client
- 149 tests + rapport `docs/tests/rapport-sprint-11.md`
- Build OK (69 pages)

## Issues identifiées

### Important

**I-1 — DTOs locaux dupliquent `src/types/api.ts`**
- `queries/alertes.ts` et `queries/activites.ts` définissaient leurs propres DTOs avec `string` au lieu des enums
- **Fix :** Imports depuis `@/types` ✅

**I-2 — Strings hardcodées au lieu d'enums**
- `queries/alertes.ts`, `alertes.ts` utilisaient des string literals
- **Fix :** Import enums depuis `@/generated/prisma/enums` et `@/types` ✅

**I-3 — PERMISSION_GROUPS incomplet**
- Manquait `ALERTES_CONFIGURER`, `PLANNING_VOIR`, `PLANNING_GERER`, `FINANCES_VOIR`, `FINANCES_GERER`
- **Fix :** 3 nouveaux groupes (alertes, planning, finances) + labels mis à jour ✅

**I-4 — Couleurs hardcodées dans Recharts (R6)**
- 5 fichiers utilisaient des hex (#22c55e, #ef4444, etc.) au lieu de CSS variables
- **Fix :** Remplacé par `hsl(var(--success))`, `hsl(var(--danger))`, `hsl(var(--primary))` ✅

### Mineur
- M-1 : `as never` résiduel dans certains fichiers (Sprint 12)
- M-2 : Notification.page.tsx utilise JSON.parse(JSON.stringify()) pour sérialiser les dates

## Checklist R1-R9

| # | Règle | Statut |
|---|-------|--------|
| R1 | Enums MAJUSCULES | OK — TypeAlerte, StatutAlerte, TypeActivite, StatutActivite, Recurrence |
| R2 | Importer enums | OK (après fix I-1/I-2) |
| R3 | Prisma = TypeScript | OK — champs alignés |
| R4 | Opérations atomiques | OK — updateMany dans queries |
| R5 | DialogTrigger asChild | N/A (pas de dialogs dans Sprint 11) |
| R6 | CSS variables | OK (après fix I-4) |
| R7 | Nullabilité explicite | OK — seuilValeur Float?, seuilPourcentage Float? |
| R8 | siteId PARTOUT | OK — ConfigAlerte, Notification, Activite |
| R9 | Tests avant review | OK — 905/905 tests, build OK |

## Points positifs
- Architecture alertes bien pensée : déduplication par jour, isolation des erreurs
- Finances queries complètes : résumé, par-vague, évolution, top-clients
- Navigation cohérente (sidebar, hamburger, bottom-nav)
- 149 tests couvrant tous les cas d'erreur (401, 403, 404, 500)
- Mobile-first respecté (min-h-[44px], cartes empilées)

## Résultat final
- **905 tests passent (35 fichiers, 0 échecs)**
- **Build OK (69 pages)**
- **Verdict : APPROUVÉ**

*Review produite par @code-reviewer, corrections validées le 2026-03-11*
