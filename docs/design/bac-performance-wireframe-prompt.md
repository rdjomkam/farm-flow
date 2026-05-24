# Claude Design Prompt — Bac Performance Section (Wireframe)

## Context

You are designing a new section for **FarmFlow**, a fish farming management app for catfish (Clarias gariepinus) in Cameroon. The app is mobile-first (360px primary, desktop secondary) and used by fish farmers in the field, often on low-end Android phones.

The app tracks **vagues** (batches/waves of fish) distributed across **bacs** (tanks). Farmers take regular **relevés** (records) — biometry measurements (average weight per fish), mortality counts, feeding records, water quality, etc.

---

## What we're designing

A new **"Performance par Bac"** (Per-Tank Performance) section to be added to the **Vague Detail Page**. This section gives farmers at-a-glance insight into how each tank is performing — growth rate, feed efficiency, and cost — so they can make better operational decisions (reallocate feed, harvest early, investigate problems).

---

## Design System — Colors & Tokens

Light theme only. White background (#ffffff), dark text (#0f172a).

### Primary palette
| Token | Hex | Usage |
|---|---|---|
| `primary` | `#0d9488` (teal-600) | Buttons, links, active states, ring |
| `primary-gradient` | `linear-gradient(135deg, #0d9488, #0f766e, #115e59)` | Header backgrounds |

### Semantic colors
| Token | Hex | Usage |
|---|---|---|
| `success` | `#22c55e` | Survival rate, positive trends |
| `warning` | `#f59e0b` | Alerts, caution |
| `danger` | `#ef4444` | Mortality, negative trends |

### Accent palette (for data visualization & differentiation)
| Token | Hex | Muted | Usage in this feature |
|---|---|---|---|
| `accent-blue` | `#2563eb` | `#dbeafe` | Biomass, weight data |
| `accent-purple` | `#7c3aed` | `#ede9fe` | Average weight |
| `accent-amber` | `#d97706` | `#fef3c7` | FCR (feed conversion) |
| `accent-green` | `#16a34a` | `#dcfce7` | Growth rate, GMQ |
| `accent-cyan` | `#0891b2` | `#cffafe` | Cost per kg |
| `accent-red` | `#dc2626` | `#fee2e2` | Mortality |
| `accent-orange` | `#ea580c` | `#fff7ed` | Feed consumption |

### Surfaces & borders
| Token | Hex |
|---|---|
| `background` | `#ffffff` |
| `card` | `#ffffff` |
| `muted` | `#f1f5f9` (slate-100) |
| `muted-foreground` | `#64748b` (slate-500) |
| `border` | `#e2e8f0` (slate-200) |

### Shadows (teal-tinted for warmth)
- `shadow-card`: `0 1px 3px 0 rgb(13 148 136 / 0.04), 0 1px 2px -1px rgb(13 148 136 / 0.04)`
- `shadow-card-hover`: `0 8px 16px -4px rgb(13 148 136 / 0.08), 0 2px 4px -2px rgb(0 0 0 / 0.04)`

### Typography
- Font: System stack (Inter if available)
- Section title: `text-base font-semibold` (16px)
- Card title: `text-sm font-medium` (14px)
- Values: `text-lg font-bold` or `text-xl font-bold` (18-20px)
- Labels: `text-xs text-muted-foreground` (12px)
- Units: `text-xs text-muted-foreground` inline with value

### Spacing & Radius
- Card padding: `p-3` (12px)
- Gap between cards: `gap-3` (12px)
- Border radius: `rounded-xl` (12px) on cards
- Inner elements: `rounded-lg` (8px)

---

## Current Vague Detail Page Structure (top to bottom)

The page currently has these sections in order:

### 1. Header bar
- Back arrow + vague code (e.g., "26-01") as title

### 2. Info strip (horizontal flex wrap)
- Badge: statut (EN COURS / green, TERMINÉE / gray, ANNULÉE / red)
- Calendar icon + date range
- Fish icon + "2500 alevins à 3g"
- Container icon + "4 bacs (Bac 01, Bac 03, Bac 05, Bac 07)"
- Action menu (⋮) on the right

### 3. Indicateurs Cards (5 KPIs in a single card, grid 3×2 on mobile, 5 columns on desktop)
- Taux de survie (heart icon, green) — e.g., "92.4%"
- Biomasse (weight icon, blue) — e.g., "156.8 kg"
- Poids moyen (scale icon, purple) — e.g., "245.3 g"
- SGR (trending up icon, teal) — e.g., "1.82 %/j"
- FCR (activity icon, amber) — e.g., "1.45"

### 4. Progress bars (biomasse vs objectif + ventes vs production)
- Green bar: "Objectif biomasse — 156.8 / 400 kg — 39%"
- Blue bar: "Ventes / Production — 45.2 / 202.0 kg — 22%"

### 5. Weight chart (Recharts area chart)
- X: days since start, Y: average weight (g)
- Observed data (teal fill) + Gompertz prediction curve (dashed)
- Horizontal line at target weight

### 6. Coût de production card (expandable)
- Summary: total cost, cost/kg, selling price/kg, margin/kg, ROI
- Expandable: breakdown by category

### 7. Calibrages section
- List of calibrage events (sorting fish between tanks)

### 8. Bacs section (current per-bac display — basic)
- Simple list of active bacs: name, volume, fish count
- Collapsible section for removed bacs

### 9. Derniers relevés (last 3 records)
- Cards showing recent biometry/mortality/feeding records

### 10. Back button

---

## NEW SECTION TO DESIGN: "Performance par Bac"

**Position**: Insert AFTER the Indicateurs Cards (section 3) and progress bars (section 4), BEFORE the weight chart (section 5). This gives it prominent placement because it's the most actionable data on the page.

### Data available per bac

For each active bac in the vague, we can compute:

| Metric | Source | Example |
|---|---|---|
| **Poids moyen actuel** | Latest BIOMETRIE relevé for this bac | 312 g |
| **Poids moyen précédent** | Previous BIOMETRIE relevé | 245 g |
| **Gain (GMQ)** | (current - previous) / days between | +4.8 g/j |
| **Nombre vivants** | AssignationBac.nombreActuel - mortalités | 580 |
| **Biomasse** | poidsMoyen × vivants / 1000 | 181.0 kg |
| **Taux de survie** | vivants / nombreInitial × 100 | 93.5% |
| **FCR** | totalFeedKg / gainBiomasseKg | 1.38 |
| **Total aliment consommé** | SUM of ALIMENTATION relevés (kg) | 78.5 kg |
| **Coût aliment** | SUM(quantité × prix unitaire) | 47,100 FCFA |
| **Coût par kg produit** | feedCost / gainBiomasseKg | 620 FCFA/kg |
| **Mini sparkline** | poidsMoyen over time (5-10 data points) | ↗ ascending curve |
| **Dernière biométrie** | Date of last measurement | "il y a 3j" |

### Design requirements

#### Mobile (360px) — PRIMARY
- Each bac = one card, stacked vertically
- Card should be compact but information-dense (farmers check this daily)
- Most important info visible without scrolling: bac name, current weight, growth trend, FCR
- Sparkline should be tiny (about 60×24px) but readable
- Color-code FCR and GMQ against benchmarks:
  - Excellent (green bg): FCR < 1.5, GMQ > 5 g/j
  - Good (no highlight): FCR 1.5-2.0, GMQ 3-5 g/j
  - Poor (amber bg): FCR 2.0-2.5, GMQ 1-3 g/j
  - Bad (red bg): FCR > 2.5, GMQ < 1 g/j
- Consider a "ranking" indicator — which bac is performing best

#### Desktop (768px+)
- Cards can be side by side (2 columns on md, 3 on lg)
- More room to show the sparkline larger
- Consider a comparison view / table-like layout for desktop

#### Section header
- Title: "Performance par Bac" with a small icon
- Optional: tab/toggle to switch between "Croissance" and "Coûts" views (to keep mobile cards compact)

#### Empty state
- If no biometry data exists for any bac yet: "Aucune biométrie enregistrée. Créez un relevé de biométrie pour voir les performances par bac."

#### Interactions
- Tap a bac card → navigate to `/bacs/{id}` (bac detail page)
- Cards should have subtle hover/active states matching the app's `shadow-card-hover`

---

## What to produce

Create **lo-fi wireframes** showing:

1. **Mobile (360px wide)** — The full section as it would appear on the vague detail page, with 3-4 bac cards stacked. Show the card layout with placeholder data. Include annotations for what each element is.

2. **Desktop (1024px wide)** — Same section in a wider layout. Show the multi-column card grid.

3. **Single bac card — annotated close-up** — Mobile version of one card with all elements labeled: where the sparkline goes, where each metric is, icon placement, color coding.

4. **Empty state** — What shows when there's no biometry data yet.

Use simple boxes, lines, and text labels. No need for pixel-perfect design — focus on **layout, hierarchy, and information architecture**. Use actual realistic data values in the wireframes so it feels grounded.

Label colors with their token names (e.g., "accent-amber bg" or "success text") rather than trying to show actual colors in the wireframe.

---

## Constraints to respect

- **Mobile-first**: The 360px version is the primary design. Desktop is a responsive expansion.
- **No tables on mobile**: Card-based layout only.
- **French UI language**: All labels in French (Poids moyen, Biomasse, Aliment consommé, etc.)
- **Consistent with existing patterns**: Follow the same Card → CardContent pattern, same spacing, same badge styles as the existing VagueBacsSection.
- **Minimal chrome**: The app uses clean, minimal design. No decorative elements. Let the data breathe.
- **Touch targets**: Minimum 44px touch targets. Cards are fully tappable.
