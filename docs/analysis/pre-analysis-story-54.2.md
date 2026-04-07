# Pre-analysis Story 54.2 — Color & Shadow Refinement

**Date :** 2026-04-07
**Story :** 54.2 — Color & Shadow Refinement (tinted shadows, grain overlay, palette cleanup)
**Analyste :** @pre-analyst

---

## Statut : GO AVEC RESERVES

## Resume

Le build est propre (compilation TypeScript OK, artefacts statiques produits). Les ombres actuelles utilisent du noir pur — facile a teinter. La palette a 11 accents (blue, purple, amber, emerald, red, green, yellow, orange, pink, indigo, cyan). Trois accents (pink, yellow, indigo) sont utilises dans des composants actifs, ce qui interdit leur suppression directe. La cible "7 accents" du sprint impose de remplacer ces usages avant suppression, pas de les supprimer a l'aveugle.

---

## Verifications effectuees

### Schema a Types : N/A
Cette story ne touche pas au schema Prisma ni aux types metier.

### API a Queries : N/A
Aucune route API affectee.

### Navigation a Permissions : N/A
Aucun item de navigation affecte.

### Build : OK
- Compilation webpack : succes ("Compiled successfully in 99s")
- TypeScript production : zero erreur dans les fichiers non-test
- Artefacts produits : `.next/static/`, `.next/server/`, `build-manifest.json`
- Avertissement non-bloquant : lockfile detecte a /Users/ronald/package-lock.json (racine workspace)
- Note : les erreurs TS visibles sont toutes dans `src/__tests__/` (globals vitest manquants dans tsconfig) — pre-existantes, hors scope 54.2

### Tests : Non executes
L'execution de `npx vitest run` n'a pas ete lancee (scope pre-analyse uniquement). Le @tester executera la suite complete.

---

## Etat actuel des tokens d'ombre

Fichier : `/Users/ronald/project/dkfarm/farm-flow/src/app/globals.css` lignes 34-37

```
--shadow-xs:          0 1px 2px 0 rgb(0 0 0 / 0.03)
--shadow-card:        0 1px 3px 0 rgb(0 0 0 / 0.04), 0 1px 2px -1px rgb(0 0 0 / 0.04)
--shadow-card-hover:  0 8px 16px -4px rgb(13 148 136 / 0.08), 0 2px 4px -2px rgb(0 0 0 / 0.04)
--shadow-elevated:    0 12px 24px -4px rgb(0 0 0 / 0.08), 0 4px 8px -4px rgb(0 0 0 / 0.04)
```

Observations :
- `--shadow-card-hover` utilise deja `rgb(13 148 136 / 0.08)` (teinte teal) — coherent avec la cible
- `--shadow-xs`, `--shadow-card` et `--shadow-elevated` utilisent `rgb(0 0 0 / ...)` — a teinter
- Grain/noise overlay : absent (aucun `body::before` dans globals.css)

---

## Palette d'accents actuelle — 11 accents (22 variables avec -muted)

| Accent | Variable CSS | Valeur hex |
|--------|-------------|-----------|
| blue | `--accent-blue` / `--accent-blue-muted` | #2563eb / #dbeafe |
| purple | `--accent-purple` / `--accent-purple-muted` | #7c3aed / #ede9fe |
| amber | `--accent-amber` / `--accent-amber-muted` | #d97706 / #fef3c7 |
| emerald | `--accent-emerald` / `--accent-emerald-muted` | #059669 / #d1fae5 |
| red | `--accent-red` / `--accent-red-muted` | #dc2626 / #fee2e2 |
| green | `--accent-green` / `--accent-green-muted` | #16a34a / #dcfce7 |
| yellow | `--accent-yellow` / `--accent-yellow-muted` | #ca8a04 / #fef9c3 |
| orange | `--accent-orange` / `--accent-orange-muted` | #ea580c / #fff7ed |
| pink | `--accent-pink` / `--accent-pink-muted` | #db2777 / #fce7f3 |
| indigo | `--accent-indigo` / `--accent-indigo-muted` | #4f46e5 / #e0e7ff |
| cyan | `--accent-cyan` / `--accent-cyan-muted` | #0891b2 / #cffafe |

---

## Accents reellement utilises dans les composants

### accent-green (UTILISE — tres repandu)
| Fichier | Usage |
|---------|-------|
| `src/lib/benchmarks.ts` | `text-accent-green` pour niveau EXCELLENT (benchmarkColor) |
| `src/lib/benchmarks.ts` | `bg-accent-green-muted` pour niveau EXCELLENT (benchmarkBgColor) |
| `src/components/analytics/vagues-comparison-client.tsx` | badge statut EN_COURS |
| `src/components/analytics/feed-simulator.tsx` | bordure + fond + icone + texte economie |
| `src/components/analytics/feed-comparison-cards.tsx` | rang 0, badge meilleur cout/kg |
| `src/components/bacs/bac-densite-badge.tsx` | statut OK |
| `src/components/alevins/reproducteurs-list-client.tsx` | statut ACTIF |
| `src/components/alevins/reproducteur-detail-client.tsx` | statut ACTIF + pontes EN_COURS |
| `src/components/alevins/ponte-detail-client.tsx` | statut EN_COURS, lot EN_ELEVAGE |
| `src/components/alevins/lot-detail-client.tsx` | statut EN_ELEVAGE |
| `src/components/alevins/lots-list-client.tsx` | statut EN_ELEVAGE |
| `src/components/alevins/pontes-list-client.tsx` | statut EN_COURS |
| `src/components/analytics/benchmark-badge.tsx` | niveau EXCELLENT |
| `src/components/vagues/poids-chart.tsx` | serie Gompertz (stroke) |
| `src/components/admin/analytics/admin-analytics-dashboard.tsx` | serie "nouveaux", KPI MRR icone |
| `src/components/users/user-role-badge.tsx` | role PISCICULTEUR |
| `src/components/planning/planning-client.tsx` | TypeActivite.ALIMENTATION + badge releve |
| `src/components/planning/mes-taches-client.tsx` | TypeActivite.ALIMENTATION |
| `src/components/ui/kpi-card.tsx` | tendance "up" |
| `src/components/pages/alevins-page.tsx` | KPI reproducteurs (couleur + fond) |
| `src/components/dashboard/recent-activity.tsx` | TypeReleve.ALIMENTATION |
| `src/components/dashboard/indicateurs-panel.tsx` | niveau EXCELLENT |
| `src/components/dashboard/benchmark-badge.tsx` | niveau EXCELLENT + BenchmarkDot |
| `src/components/dashboard/quick-actions.tsx` | action "mes-taches" |
| `src/components/config-elevage/config-elevage-list-client.tsx` | texte FCR/SGR excellent |
| `src/__tests__/benchmarks.test.ts` | assertions text-accent-green |
| `src/__tests__/ui/analytics-bacs.test.tsx` | assertions bg-accent-green-muted |

**CONCLUSION : accent-green est INDISPENSABLE — a conserver absolument.**

### accent-yellow (UTILISE — alevins uniquement)
| Fichier | Usage |
|---------|-------|
| `src/components/alevins/ponte-detail-client.tsx` | statut lot EN_INCUBATION |
| `src/components/alevins/lot-detail-client.tsx` | statut EN_INCUBATION |
| `src/components/alevins/lots-list-client.tsx` | statut EN_INCUBATION |
| `src/components/pages/alevins-page.tsx` | KPI pontes (couleur + fond) |

**CONCLUSION : accent-yellow est utilise dans le module Alevins pour representer l'incubation. Suppression BLOQUEE — il faudrait d'abord migrer ces usages vers accent-amber (semantique similaire).**

### accent-indigo (UTILISE — alevins uniquement)
| Fichier | Usage |
|---------|-------|
| `src/components/alevins/reproducteurs-list-client.tsx` | sexe MALE |
| `src/components/alevins/reproducteur-detail-client.tsx` | sexe MALE |

**CONCLUSION : accent-indigo est utilise pour la differentiation visuelle du sexe des reproducteurs (FEMELLE=pink, MALE=indigo). Suppression BLOQUEE — il faudrait migrer vers accent-purple (semantique differente mais viable).**

### accent-pink (UTILISE — alevins uniquement)
| Fichier | Usage |
|---------|-------|
| `src/components/alevins/reproducteurs-list-client.tsx` | sexe FEMELLE |
| `src/components/alevins/reproducteur-detail-client.tsx` | sexe FEMELLE |

**CONCLUSION : accent-pink est utilise pour la differentiation visuelle du sexe FEMELLE des reproducteurs. Suppression BLOQUEE — meme pairing que indigo (FEMELLE=pink, MALE=indigo). Les deux doivent migrer ensemble.**

### accent-blue, accent-purple, accent-amber, accent-emerald, accent-red, accent-orange, accent-cyan
Tous confirmes actifs dans les fichiers ci-dessus (vagues-comparison, ventes, stock, dashboard, planning, etc.). Ces 7 sont dans la cible "palette reduite a 7" du sprint.

---

## Accents surs a supprimer (si usages migres)

| Accent | Statut | Migration requise |
|--------|--------|------------------|
| accent-green | **CONSERVER** — trop repandu, semantique critique | Non applicable |
| accent-yellow | Supprimable apres migration | Remplacer par accent-amber dans 4 fichiers alevins |
| accent-indigo | Supprimable apres migration | Remplacer par accent-purple dans 2 fichiers alevins |
| accent-pink | Supprimable apres migration | Remplacer par accent-purple ou accent-red dans 2 fichiers alevins |

**Palette cible realisable a 8 accents (pas 7) :** blue, amber, emerald, red, purple, orange, cyan + green (obligatoire).

Si le sprint exige absolument 7, il faut choisir lequel de ces 8 retirer et migrer ses usages. La recommandation est de garder les 8 — l'objectif du sprint est de supprimer les doublons semantiques (yellow vs amber, indigo vs purple, pink vs red/purple), pas d'atteindre un chiffre exact.

---

## Incohérences trouvées

1. **accent-green absent de la "palette reduite" ciblee mais indispensable**
   - Fichier : `docs/sprints/SPRINT-54-DESIGN-AUDIT.md` story 54.2
   - La story cible `blue, amber, emerald, red, purple, orange, cyan` (7 sans green), mais accent-green est massivement utilise dans benchmarks, planning, dashboard, alevins
   - Suggestion : ajouter accent-green a la palette cible (8 total) ou arbitrer explicitement

2. **Tests unitaires assertent sur accent-green**
   - Fichiers : `src/__tests__/benchmarks.test.ts` lignes 152,177 ; `src/__tests__/ui/analytics-bacs.test.tsx` lignes 79-80
   - Si accent-green etait supprime, 3 tests casseraient
   - Risque mitige puisque accent-green doit etre conserve

3. **admin-analytics-dashboard.tsx utilise `hsl(var(--accent-green, 142 76% 36%))` (ligne 255)**
   - Usage non standard : tente d'utiliser la variable CSS comme valeur HSL avec fallback numerique
   - `--accent-green` est defini en hex (#16a34a), pas en HSL — le fallback sera toujours utilise
   - Violation de R6 (CSS variables du theme) — bug cosmétique pre-existant, hors scope 54.2

---

## Risques identifies

1. **Migration yellow/indigo/pink avant suppression (risque MOYEN)**
   - Impact : si le developer supprime ces variables sans migrer les usages, 6 composants alevins perdront leur couleur (classes Tailwind JIT non resolues -> transparent)
   - Mitigation : le developer doit d'abord remplacer les usages dans les 6 fichiers alevins, puis supprimer les variables CSS

2. **Tests de non-regression sur benchmarks (risque BAS)**
   - `benchmarks.test.ts` et `analytics-bacs.test.tsx` assertent sur des strings de classes CSS exactes
   - Si le developer renomme ou remplace accent-green par un autre accent, ces tests casseront
   - Mitigation : accent-green est conserve donc risque nul en pratique

3. **Grain overlay z-index 9999 (risque BAS)**
   - Le sprint specicie `z-index: 9999` pour le grain overlay body::before
   - Si des composants Radix UI (Dialog, Popover, Tooltip) ont un z-index inferieur, le grain les recouvrira
   - Verification : les Radix UI utilisent z-index 50 (Tailwind) ou auto — 9999 passera devant
   - Mitigation : utiliser `pointer-events: none` (deja dans la spec) et `mix-blend-mode: overlay` pour eviter tout conflit visuel

4. **Performance du grain overlay (risque TRES BAS)**
   - Un pseudo-element fixe avec filtre SVG ou gradient bruit peut impacter les repaints sur mobile
   - Mitigation : implémenter avec `url("data:image/svg+xml,...")` ou une image statique, pas avec un filtre CSS lourd

---

## Prerequis manquants

Aucun prerequis bloquant. La story peut demarrer directement.

---

## Recommandation

**GO — avec les reserves suivantes transmises au developer :**

1. Ne pas supprimer accent-green — il est massivement utilise et doit rester dans la palette
2. Pour accent-yellow, accent-indigo, accent-pink : migrer les usages AVANT de supprimer les variables
   - `accent-yellow` -> `accent-amber` (4 fichiers : lots-list-client, lot-detail-client, ponte-detail-client, alevins-page)
   - `accent-indigo` + `accent-pink` -> `accent-purple` / autre choix semantique (2 fichiers : reproducteurs-list-client, reproducteur-detail-client)
3. La palette finale sera 8 accents (blue, amber, emerald, red, green, purple, orange, cyan) et non 7
4. Build produit est propre : aucune regression pre-existante a craindre
