# Review CR-010 + CR-011 — Analytiques par bac et par aliment

**Date :** 2026-03-10
**Revieweur :** @developer-cr003
**Statut :** VALIDE

## Perimetre

- **CR-010** : Analytiques par bac (Tank-Level Analytics)
- **CR-011** : Analytiques par aliment / marque (Feed Brand Analytics)

## Checklist R1-R9

| # | Regle | CR-010 | CR-011 | Notes |
|---|-------|--------|--------|-------|
| R1 | Enums MAJUSCULES | OK | OK | TypeReleve.BIOMETRIE, CategorieProduit.ALIMENT |
| R2 | Toujours importer les enums | OK | OK | `import { Permission } from "@/types"` partout |
| R3 | Prisma = TypeScript identiques | OK | OK | Types alignes avec schema.prisma |
| R4 | Operations atomiques | OK | OK | Pas de check-then-update |
| R5 | DialogTrigger asChild | N/A | N/A | Pas de Dialog dans ces CRs |
| R6 | CSS variables du theme | OK | OK | `var(--primary)`, `var(--border)` dans les charts |
| R7 | Nullabilite explicite | OK | OK | Tous les indicateurs nullable avec `| null` |
| R8 | siteId PARTOUT | OK | OK | Tous les queries filtrent par siteId |
| R9 | Tests avant review | OK | OK | 569 tests passent, build OK |

## Tests

| Fichier | Tests | Statut |
|---------|-------|--------|
| `src/__tests__/calculs.test.ts` | 98 (dont 23 CR-011) | PASS |
| `src/__tests__/api/analytics-bacs.test.ts` | 15 | PASS |
| `src/__tests__/ui/analytics-bacs.test.tsx` | 15 | PASS |
| `src/__tests__/api/analytics-aliments.test.ts` | 14 | PASS |
| `src/__tests__/ui/analytics-aliments.test.tsx` | 13 | PASS |
| **Total nouveaux tests** | **155** | **PASS** |
| **Total suite complete** | **569** | **PASS** |

## Build

```
npm run build — OK (Turbopack, 14.8s)
npx vitest run — 569 tests, 24 files, 0 failures
```

## Fichiers CR-010

### Crees (11)
- `src/lib/benchmarks.ts` — Benchmarks Clarias gariepinus (survie, FCR, SGR, densite, mortalite)
- `src/lib/queries/analytics.ts` — Queries analytiques (getIndicateursBac, getComparaisonBacs, getHistoriqueBac)
- `src/app/api/analytics/bacs/route.ts` — GET comparaison bacs
- `src/app/api/analytics/bacs/[bacId]/route.ts` — GET detail bac
- `src/app/api/analytics/bacs/[bacId]/historique/route.ts` — GET historique bac
- `src/components/analytics/benchmark-badge.tsx` — Badge couleur par niveau
- `src/components/analytics/bac-comparison-cards.tsx` — Cartes comparaison bacs
- `src/components/analytics/bac-detail-charts.tsx` — Graphiques detail bac
- `src/app/analytics/bacs/page.tsx` — Page comparaison bacs
- `src/app/analytics/bacs/[bacId]/page.tsx` — Page detail bac
- `src/__tests__/api/analytics-bacs.test.ts` + `src/__tests__/ui/analytics-bacs.test.tsx`

### Modifies (6)
- `src/lib/calculs.ts` — +5 fonctions (calculerDensite, calculerTauxMortalite, calculerGainQuotidien, calculerCoutParKg, calculerROI)
- `src/types/calculs.ts` — +5 interfaces (IndicateursBac, ComparaisonBacs, AlerteBac, HistoriqueBac, HistoriqueBacCycle)
- `src/types/index.ts` — Exports
- `src/lib/queries/index.ts` — Exports
- `src/components/layout/sidebar.tsx` — Module Analytiques + "Par bac"
- `src/components/layout/bottom-nav.tsx` — Lien Analytiques (5eme onglet)

## Fichiers CR-011

### Crees (12)
- `src/app/api/analytics/aliments/route.ts` — GET comparaison aliments
- `src/app/api/analytics/aliments/[produitId]/route.ts` — GET detail aliment
- `src/app/api/analytics/aliments/simulation/route.ts` — POST simulation
- `src/components/analytics/feed-comparison-cards.tsx` — Cartes classees par cout/kg gain
- `src/components/analytics/feed-detail-charts.tsx` — Graphiques FCR evolution + breakdown vague
- `src/components/analytics/feed-simulator.tsx` — Formulaire simulation changement aliment
- `src/components/analytics/recommendation-card.tsx` — Carte recommandation auto-generee
- `src/app/analytics/aliments/page.tsx` — Page comparaison aliments
- `src/app/analytics/aliments/[produitId]/page.tsx` — Page detail aliment
- `src/app/analytics/aliments/simulation/page.tsx` — Page simulateur
- `src/__tests__/api/analytics-aliments.test.ts` — Tests API
- `src/__tests__/ui/analytics-aliments.test.tsx` — Tests UI

### Modifies (5)
- `src/lib/calculs.ts` — +3 fonctions (calculerFCRParAliment, calculerCoutParKgGain, genererRecommandation)
- `src/lib/queries/analytics.ts` — +3 queries (getComparaisonAliments, getDetailAliment, getSimulationChangementAliment) + helper computeAlimentMetrics
- `src/types/calculs.ts` — +5 interfaces (AnalytiqueAliment, ComparaisonAliments, DetailAliment, DetailAlimentVague, SimulationResult)
- `src/types/index.ts` — Exports
- `src/components/layout/sidebar.tsx` — "Par aliment" sous Analytiques

## Points forts

1. **Fonctions pures** : Tous les calculs dans `calculs.ts` sans dependance DB — faciles a tester
2. **Benchmarks separees** : `benchmarks.ts` centralise les seuils Clarias gariepinus avec sources FAO
3. **Pattern coherent** : Les 2 CRs suivent exactement les memes patterns (API routes, components, pages)
4. **Mobile-first** : Cartes empilees, pas de tableaux, grilles 2×3 sur mobile → 3 colonnes sur desktop
5. **Recommandation SaaS** : Texte auto-genere compare les aliments avec economie chiffree
6. **Simulateur** : Interface complete pour comparer 2 aliments avec resultat economique

## Points d'attention

1. **ReleveConsommation** : Les metriques aliments dependent de la saisie reguliere de ReleveConsommation. Si l'utilisateur ne saisit pas les consommations, les analytiques seront vides.
2. **Multi-aliments par vague** : Le FCR par aliment est calcule en repartissant le gain de biomasse proportionnellement a la quantite — methode standard mais approximative si les aliments sont utilises a des periodes differentes.
3. **Navigation** : BottomNav a maintenant 5 items (Suivi) — proche de la limite recommandee pour mobile.

## Verdict

Les deux CRs sont correctement implementes, bien testes, et respectent toutes les regles R1-R9. **VALIDE**.
