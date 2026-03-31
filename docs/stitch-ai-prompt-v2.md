# FarmFlow — Design Brief v2.0

> Updated prompt for Google Stitch AI. Generate a full interactive prototype (clickable, navigable) for a mobile-first catfish farm management app. This version incorporates feedback from the Stitch v1 prototype.

---

## What Changed from v1

### Keep (Stitch v1 nailed these)
- Hero card concept on Élevage Home (big weight number, contextual deltas, progress bar)
- Quick Entry bottom sheet with type grid, quantity stepper, behavior toggles, smart defaults
- Business hero card with cash flow summary and Revenue/Dépenses split
- Stock severity-colored alert cards
- New Sale form (clean, single-page, auto-calculated total)
- Dark navy + Electric Teal color palette

### Fix (Stitch v1 got these wrong)
- **Bottom nav: EXACTLY 3 items** — Stitch added Planning and Stock as 4th/5th tabs. Must be: Élevage / Business / ⚙️ Settings
- **No IoT sensor cards** — Stitch hallucinated "Capteurs IoT" sections. Remove entirely.
- **No "INSIGHT IA" card** — Requires ML engine that doesn't exist. Defer to future phase.
- **Desktop layout** — Must be true 3-column (sidebar + main + contextual panel), not stretched mobile.
- **Empty states** — Need personality: illustrations, warm French copy, clear CTAs.
- **Batch Detail** — Gompertz chart must be the visual CENTERPIECE, not one card among many.

---

## The Product

FarmFlow helps catfish farmers in Central Africa manage their fish from fingerling to harvest. Farmers track growth with weekly weighing, feed their fish 3 times daily and log it, monitor water quality, manage feed inventory, sell harvested fish, and track profitability. The app predicts harvest dates using a Gompertz growth model fitted to biometric data.

Three personas use it: the hands-on farmer at the pond, the farm manager coordinating a team, and the agricultural engineer monitoring multiple farms remotely. The design must serve all three.

**All UI text is in French.**

---

## Design Philosophy — A Complete Rethink

Forget traditional farm management software. FarmFlow should feel like **Revolut meets Linear** — a premium, opinionated product that makes aquaculture feel modern. The current app suffers from too many taps, confusing navigation, a generic look, and difficulty seeing the big picture. This redesign fixes all of that.

### Core Design Principles

**1. One-screen intelligence.** The farmer should understand their entire farm's health without scrolling. Not through 12 KPI cards — through one beautifully composed view that tells a story. Think of how Revolut shows your financial health in a single glance: a big number, a trend, and context.

**2. Two-tap actions.** The most common action (recording a feeding) should take 2 taps maximum from anywhere in the app. Tap the action, confirm the quantity. Everything else should follow this philosophy — minimal friction, maximum speed.

**3. Opinionated navigation. ⚠️ CRITICAL — EXACTLY 3 BOTTOM NAV ITEMS.** Not 4, not 5. Three: **Élevage** (fish icon), **Business** (money icon), and **⚙️** (gear icon, no label). Planning lives INSIDE Élevage mode as a section. Stock lives INSIDE Business mode. No separate Planning or Stock tabs ever.

**4. Data as narrative.** Charts and numbers should tell a story, not just display data. "Your fish gained 12g this week — 20% faster than your last batch" is more useful than "SGR: 3.2%/day". The Gompertz growth curve should feel like a fitness tracker progress ring — motivating, not academic.

**5. Calm urgency.** Alerts and tasks should surface naturally in context, not interrupt. A low stock warning appears as a subtle inline note when the farmer logs a feeding ("Plus que 3 jours de stock"). A scheduled biometry appears as the first suggested action on the home screen. No notification spam.

---

## Visual Identity — Style Guide

### Color System

**Primary: Deep Ocean (#0A2540)** — A rich, dark navy. Used for headers, primary text, key UI surfaces. Conveys trust and professionalism. Inspired by Linear's dark sidebar aesthetic.

**Accent: Electric Teal (#00D4AA)** — Vibrant, alive, aquatic. Used for primary actions, progress indicators, the growth curve, and positive states. This is the brand color — it says "water, life, growth."

**Surface palette:**
- Background: #F7F8FA (light mode) / #0B1120 (dark mode)
- Card surface: #FFFFFF (light) / #151E2E (dark)
- Elevated surface: #FFFFFF with soft shadow (light) / #1A2435 (dark)
- Subtle surface: #F0F2F5 (light) / #0E1825 (dark)

**Semantic colors:**
- Success/Growth: #00D4AA (teal — same as accent, growth IS the product)
- Warning/Attention: #F5A623 (warm amber)
- Danger/Loss: #E5484D (soft red)
- Info/Neutral: #6B7280 (gray)

**Gradient**: For hero cards and the growth chart background, use a subtle gradient from Deep Ocean to a slightly lighter navy, with the teal accent as a glowing data line. Think dark mode Bloomberg terminal but softer.

### Typography

**Font family:** Inter (Google Fonts) — clean, highly legible, excellent number rendering.

**Scale:**
- Display (hero numbers): 48px, bold 700, letter-spacing -0.02em
- Heading 1: 24px, semibold 600
- Heading 2: 18px, semibold 600
- Body: 15px, regular 400, line-height 1.5
- Caption: 13px, regular 400, color muted
- Mono (data values): JetBrains Mono or SF Mono, 14px — for weights, quantities, prices

Numbers should use tabular figures (monospace digits) so columns align. Weights, money, and percentages should feel precise and data-rich.

### Shape & Spacing

- Border radius: 16px on cards, 12px on buttons, 8px on inputs, 24px on bottom sheets
- Spacing unit: 8px grid. Padding: 16px on mobile, 24px on desktop
- Card elevation: 0 1px 2px rgba(0,0,0,0.06) (light mode), 0 1px 3px rgba(0,0,0,0.3) (dark mode)
- No heavy borders. Use background color differences and subtle shadows to create hierarchy

### Iconography

Phosphor Icons (thin weight) — more distinctive than Lucide, slightly playful, excellent 24px rendering. Consistent 1.5px stroke weight throughout.

### Motion

- Page transitions: 200ms ease-out slide
- Card interactions: subtle scale (0.98) on press, 150ms
- Number changes: count-up animation (like Revolut balance updates)
- Chart drawing: line draws from left to right on first load, 600ms
- Success state: a single satisfying pulse of the teal accent color, not confetti

---

## App Architecture — Three Modes

⚠️ **CRITICAL: Exactly 3 bottom navigation items. This is non-negotiable.**

```
┌────────────────────────────────────────┐
│    🐟 Élevage    │  💰 Business  │  ⚙️  │
└────────────────────────────────────────┘
```

**Élevage** (Farming) — Everything about the fish: batches, measurements, growth, tanks, breeding, planning. This is where the farmer lives 90% of the time.

**Business** — Money: sales, clients, invoices, expenses, stock, orders, financial dashboard. Visited weekly or when selling fish.

**Settings (gear icon, no label)** — Farm config, team, roles, alerts, subscription. Visited rarely.

### What Lives Where

| Feature | Mode | Access |
|---------|------|--------|
| Planning / Tasks | Élevage | Section on home + contextual task cards |
| Stock / Inventory | Business | Shortcut on Business home |
| Breeding (Alevins) | Élevage | Scroll or search |
| Notifications | Shared | Bell icon in top bar |

Within each mode, navigation is **flat**: a scrollable home for that mode with inline sections, and tapping any item opens a detail view. No nested menus. No "More" drawers. A universal search bar at the top of each mode lets you find anything instantly: "Bac 2", "Coppens", "Vague Mars".

On **desktop** (≥1024px), the three modes become a minimal left sidebar:
- **Left rail (56px icons, expanding to 240px on hover)** — Linear-style sidebar with three groups
- **Main content (flexible)** — Charts at full width, tables for dense data, wider cards, 2-3 column grids
- **Contextual right panel (320px, collapsible)** — Quick entry form persists here instead of bottom sheet; shows context-sensitive details

⚠️ **DO NOT include IoT sensor cards, "Capteurs IoT" sections, or any hardware monitoring UI.** These features do not exist in the product.

---

## Screens

### SCREEN 1: Élevage — Home (The Farmer's View)

This is the app's soul. It answers: "How are my fish doing right now?"

```
┌──────────────────────────────────────┐
│ 🔍 Rechercher...            🔔 (2)  │
├──────────────────────────────────────┤
│                                      │
│  ┌────────────────────────────────┐  │
│  │     HERO CARD — Dark navy      │  │
│  │                                │  │
│  │  Vague Mars 2026        J21   │  │
│  │                                │  │
│  │      66g                       │  │
│  │  poids moyen actuel            │  │
│  │                                │  │
│  │  ┌─────────────────────────┐   │  │
│  │  │ ░░░░░░░████░░░░░░░░░░░ │   │  │
│  │  │ 17%         → 400g      │   │  │
│  │  └─────────────────────────┘   │  │
│  │                                │  │
│  │  Récolte estimée: 8 mai       │  │
│  │  dans 38 jours                │  │
│  │                                │  │
│  │  ↑12g cette semaine            │  │
│  │  +20% vs Vague Janvier        │  │
│  └────────────────────────────────┘  │
│                                      │
│  Indicateurs rapides                 │
│  ┌──────┐ ┌──────┐ ┌──────┐         │
│  │ 94%  │ │ 1.35 │ │ 8.2  │         │
│  │survie│ │ FCR  │ │kg/m³ │         │
│  │  ✓   │ │  ✓   │ │  ✓   │         │
│  └──────┘ └──────┘ └──────┘         │
│                                      │
│  À faire maintenant                  │
│  ┌────────────────────────────────┐  │
│  │ ⚖️ Biométrie J28 prévue       │  │
│  │   Vague Mars · dans 7 jours   >  │
│  ├────────────────────────────────┤  │
│  │ 📦 Stock aliment bas           │  │
│  │   Coppens 42%: 3 jours restant>  │
│  └────────────────────────────────┘  │
│                                      │
│  Courbe de croissance                │
│  ┌────────────────────────────────┐  │
│  │         ·                      │  │
│  │       ·    --- Gompertz        │  │
│  │     ·    /                     │  │
│  │   ·   /          ----400g---   │  │
│  │  · /                          │  │
│  │ /                              │  │
│  └────────────────────────────────┘  │
│  Taper pour détails                  │
│                                      │
│  Mes bacs                            │
│  ┌──────────┐ ┌──────────┐          │
│  │ Bac 1    │ │ Bac 2    │          │
│  │ 600 🐟   │ │ 530 🐟   │          │
│  │ 8.1 kg/m³│ │ 8.3 kg/m³│          │
│  │ ●  OK    │ │ ●  OK    │          │
│  └──────────┘ └──────────┘          │
│                                      │
│ [If 2+ active batches: show a        │
│  second hero card below, swipeable]  │
│                                      │
├──────────────────────────────────────┤
│  ┌──────────────────────────────┐    │
│  │  ＋ Enregistrer              │    │
│  └──────────────────────────────┘    │
│  Full-width sticky action bar        │
│  Tapping opens quick-entry sheet     │
├──────────────────────────────────────┤
│    🐟 Élevage    │ 💰 Business │ ⚙️  │
└──────────────────────────────────────┘
```

**The Hero Card** is the centerpiece. Dark navy background, big weight number in white, teal progress bar, harvest countdown. If 2+ active batches, hero cards are horizontally swipeable with dot indicators. Tappable to open batch detail.

**The "Enregistrer" bar** sits above the bottom nav, always visible. Full-width teal button. One tap opens the Quick Entry bottom sheet.

**Indicator chips** use green checkmark / amber warning / red alert iconography. Tapping opens detail.

**The growth chart** is a compact preview — tapping opens full-screen interactive chart.

⚠️ **DO NOT add an "INSIGHT IA" card.** This feature does not exist.

---

### SCREEN 2: Quick Entry Bottom Sheet

When the farmer taps "Enregistrer", a bottom sheet slides up. This is the **two-tap** experience.

```
┌──────────────────────────────────────┐
│  ──── (drag handle)                  │
│                                      │
│  Enregistrer rapidement              │
│                                      │
│  Vague Mars · Bac 1 + Bac 2  [▼]   │
│  (tap to change batch/tank)          │
│                                      │
│  ┌──────┐ ┌──────┐ ┌──────┐         │
│  │  🍽️  │ │  ⚖️  │ │  💀  │         │
│  │Alimen│ │Biomét│ │Mortal│         │
│  └──────┘ └──────┘ └──────┘         │
│  ┌──────┐ ┌──────┐ ┌──────┐         │
│  │  💧  │ │  🔢  │ │  👁️  │         │
│  │ Eau  │ │Compta│ │Observ│         │
│  └──────┘ └──────┘ └──────┘         │
│                                      │
│  Tapping "Alimentation" expands:     │
│  ┌────────────────────────────────┐  │
│  │ Coppens 42% (dernier utilisé)  │  │
│  │                                │  │
│  │  ┌─────────────────────────┐   │  │
│  │  │    [ - ]  2.4 kg  [ + ]│   │  │
│  │  └─────────────────────────┘   │  │
│  │  Quantité (dernier: 2.2 kg)   │  │
│  │                                │  │
│  │  Comportement:                 │  │
│  │  [Vorace] [Normal] [Faible]   │  │
│  │                                │  │
│  │  ┌──────────────────────────┐  │  │
│  │  │   Enregistrer   ✓       │  │  │
│  │  └──────────────────────────┘  │  │
│  └────────────────────────────────┘  │
│                                      │
└──────────────────────────────────────┘
```

**Key UX decisions:**
- The sheet **remembers the last batch, tank, product, and quantity**. For 3x/day feeding: tap "Enregistrer" → pre-filled form appears → adjust if needed → confirm. Two taps.
- The **type grid pre-selects Alimentation** (most frequent) with a subtle highlight. Expanded form appears inline.
- **Smart defaults**: quantity = average of last 3 feedings. Product = last used. Batch = active one.
- For complex types (biometrie, qualite_eau), the sheet expands to full-screen with smart defaults.

---

### SCREEN 3: Batch Detail

Tapping a hero card opens the full detail view. Single scrollable page, no tabs.

```
┌──────────────────────────────────────┐
│ ← Vague Mars 2026             ···   │
├──────────────────────────────────────┤
│                                      │
│  ┌────────────────────────────────┐  │
│  │  GROWTH CHART — HERO ELEMENT   │  │
│  │  Full width, dark background   │  │
│  │                                │  │
│  │  Actual points (teal dots)     │  │
│  │  Gompertz curve (teal line)    │  │
│  │  Projection (teal dashed)      │  │
│  │  Target 400g (amber dashed)    │  │
│  │                                │  │
│  │  Interactive: drag to see      │  │
│  │  value at any point            │  │
│  │                                │  │
│  │  Confidence: Moyenne ●●●○○     │  │
│  └────────────────────────────────┘  │
│  ⚠️ THE CHART IS THE CENTERPIECE    │
│  Not one card among many — THE hero  │
│                                      │
│  ┌──────────────────────────────┐    │
│  │ Récolte: 8 mai    dans 38j  │    │
│  │ ███████████░░░░░░░  17%     │    │
│  └──────────────────────────────┘    │
│                                      │
│  Indicateurs                         │
│  ┌───────┬───────┬───────┬───────┐  │
│  │1 130  │ 94.2% │ 1.35  │ 3.2%  │  │
│  │vivants│survie │ FCR   │SGR/j  │  │
│  │       │  ✓    │  ✓    │  ↑    │  │
│  └───────┴───────┴───────┴───────┘  │
│                                      │
│  Jalons                              │
│  ────●────●────●────○────○────○──   │
│     11g  26g  66g  100g  200g  400g  │
│     J0   J7   J21  ~J29  ~J43  ~J65 │
│                                      │
│  Derniers relevés                    │
│  ┌────────────────────────────────┐  │
│  │ Aujourd'hui                    │  │
│  │  🍽️ 2.4 kg Coppens · Normal   │  │
│  │  💧 29°C · pH 7.2 · O₂ 5.8   │  │
│  │ Hier                          │  │
│  │  🍽️ 2.2 kg Coppens · Vorace   │  │
│  │ 26 mars                       │  │
│  │  ⚖️ 66g · 15 pesés            │  │
│  │ Voir tout →                    │  │
│  └────────────────────────────────┘  │
│                                      │
│  Bacs                                │
│  ┌──────────┐ ┌──────────┐          │
│  │ Bac 1    │ │ Bac 2    │          │
│  │ 600 🐟   │ │ 530 🐟   │          │
│  │ 52.2 kg  │ │ 48.4 kg  │          │
│  │ ●  8.1   │ │ ●  8.3   │          │
│  │   kg/m³  │ │   kg/m³  │          │
│  └──────────┘ └──────────┘          │
│                                      │
├──────────────────────────────────────┤
│  ┌──────────────────────────────┐    │
│  │  ＋ Enregistrer un relevé    │    │
│  └──────────────────────────────┘    │
├──────────────────────────────────────┤
│    🐟 Élevage    │ 💰 Business │ ⚙️  │
└──────────────────────────────────────┘
```

**Key design decisions:**
- **No tabs.** One scrollable page with clear sections. The chart is the hero.
- **Gompertz chart is the CENTERPIECE** — full width, dark gradient background, interactive. This is the most important visual element on this screen.
- **Milestone timeline** is a horizontal progress track with filled dots (achieved) and hollow dots (upcoming).
- **Measurement timeline** groups by date with type icons. Dense but scannable.

---

### SCREEN 4: Batch List

Accessed via Élevage by scrolling past the hero card(s) or tapping "Toutes les vagues".

```
┌──────────────────────────────────────┐
│ 🔍 Rechercher...            🔔 (2)  │
├──────────────────────────────────────┤
│                                      │
│  Vagues                              │
│  [En cours: 2] [Terminées: 5]       │
│                                      │
│  ┌────────────────────────────────┐  │
│  │ Vague Mars 2026          J21  │  │
│  │ 66g moy · 1 130 🐟 · 94%    │  │
│  │ ███████░░░░░░░░░ 17% → 400g  │  │
│  │ Bac 1, Bac 2                  │  │
│  └────────────────────────────────┘  │
│                                      │
│  ┌────────────────────────────────┐  │
│  │ Vague Février 2026       J48  │  │
│  │ 210g moy · 980 🐟 · 91%     │  │
│  │ █████████████░░░ 53% → 400g  │  │
│  │ Bac 3                         │  │
│  └────────────────────────────────┘  │
│                                      │
│  ┌──────────────────────────────┐    │
│  │  ＋ Nouvelle vague           │    │
│  └──────────────────────────────┘    │
│                                      │
├──────────────────────────────────────┤
│    🐟 Élevage    │ 💰 Business │ ⚙️  │
└──────────────────────────────────────┘
```

---

### SCREEN 5: Business — Home

The second mode. Answers: "Is my farm making money?"

```
┌──────────────────────────────────────┐
│ 🔍 Rechercher...            🔔 (2)  │
├──────────────────────────────────────┤
│                                      │
│  ┌────────────────────────────────┐  │
│  │     HERO CARD — Finances       │  │
│  │                                │  │
│  │  Mars 2026                     │  │
│  │                                │  │
│  │     -185 000 FCFA              │  │
│  │     résultat net               │  │
│  │                                │  │
│  │  Revenus      0 FCFA           │  │
│  │  Dépenses     185 000 FCFA     │  │
│  │                                │  │
│  │  [Ce mois ▼]                   │  │
│  └────────────────────────────────┘  │
│                                      │
│  Raccourcis                          │
│  ┌──────┐ ┌──────┐ ┌──────┐         │
│  │  🐟  │ │  🧾  │ │  📦  │         │
│  │Vente │ │Factur│ │Stock │         │
│  └──────┘ └──────┘ └──────┘         │
│  Stock opens WITHIN Business mode    │
│  NOT as a separate bottom nav tab    │
│                                      │
│  Stock — Alertes                     │
│  ┌────────────────────────────────┐  │
│  │ ⚠️ Coppens 42%: 25 kg         │  │
│  │   ~3 jours restants           │  │
│  │   [Commander →]                │  │
│  └────────────────────────────────┘  │
│                                      │
│  Dernières ventes                    │
│  ┌────────────────────────────────┐  │
│  │ (empty state with personality) │  │
│  │ 🐟 Aucune vente ce mois       │  │
│  │ Votre récolte est prévue      │  │
│  │ pour le 8 mai.                │  │
│  │ [Préparer une vente →]        │  │
│  └────────────────────────────────┘  │
│                                      │
│  Dépenses récentes                   │
│  ┌────────────────────────────────┐  │
│  │ 28 mars · Aliment · 45 000    │  │
│  │ 20 mars · Aliment · 45 000    │  │
│  │ 15 mars · Main d'oeuvre · 40k │  │
│  │ Voir tout →                    │  │
│  └────────────────────────────────┘  │
│                                      │
├──────────────────────────────────────┤
│    🐟 Élevage    │ 💰 Business │ ⚙️  │
└──────────────────────────────────────┘
```

---

### SCREEN 6: Stock View

Accessed from Business → Stock shortcut. **NOT a separate bottom nav tab.**

```
┌──────────────────────────────────────┐
│ ← Stock                      ＋     │
├──────────────────────────────────────┤
│                                      │
│  Résumé: 12 produits · 3 alertes    │
│                                      │
│  ⚠️ Stock bas                        │
│  ┌────────────────────────────────┐  │
│  │ Coppens 42% P2                 │  │
│  │ ████░░░░░░░░  25 / 50 kg     │  │
│  │ ~3 jours · [Commander]        │  │
│  └────────────────────────────────┘  │
│                                      │
│  ✓ Stock OK                          │
│  ┌────────────────────────────────┐  │
│  │ Aliment local 35%   80 kg     │  │
│  │ ████████████░  80%             │  │
│  ├────────────────────────────────┤  │
│  │ Sel               5 kg        │  │
│  ├────────────────────────────────┤  │
│  │ Probiotiques      2 L         │  │
│  └────────────────────────────────┘  │
│                                      │
│  Mouvements récents                  │
│  -2.4 kg Coppens 42% · Aujourd'hui  │
│  -2.2 kg Coppens 42% · Hier         │
│  +50 kg Coppens 42% · 25 mars       │
│                                      │
├──────────────────────────────────────┤
│    🐟 Élevage    │ 💰 Business │ ⚙️  │
└──────────────────────────────────────┘
```

---

### SCREEN 7: New Sale Form

A focused, clean form. No wizard. One scrollable screen.

```
┌──────────────────────────────────────┐
│ ← Nouvelle vente                     │
├──────────────────────────────────────┤
│                                      │
│  Client                              │
│  ┌────────────────────────────────┐  │
│  │ 🔍 Rechercher ou créer...     │  │
│  └────────────────────────────────┘  │
│                                      │
│  Vague                               │
│  ┌────────────────────────────────┐  │
│  │ Vague Mars 2026 (66g moy)  ▼ │  │
│  └────────────────────────────────┘  │
│                                      │
│  Quantité                            │
│  ┌────────────────────────────────┐  │
│  │       120 kg                   │  │
│  └────────────────────────────────┘  │
│                                      │
│  Prix unitaire                       │
│  ┌────────────────────────────────┐  │
│  │     2 500 FCFA / kg            │  │
│  └────────────────────────────────┘  │
│                                      │
│  ┌────────────────────────────────┐  │
│  │  Total: 300 000 FCFA          │  │
│  │  (calcul automatique)          │  │
│  └────────────────────────────────┘  │
│                                      │
│  Notes (optionnel)                   │
│  ┌────────────────────────────────┐  │
│  │                                │  │
│  └────────────────────────────────┘  │
│                                      │
│  ┌──────────────────────────────┐    │
│  │   Enregistrer la vente  ✓   │    │
│  └──────────────────────────────┘    │
│                                      │
└──────────────────────────────────────┘
```

---

### SCREEN 8: Planning & Tasks

⚠️ **NOT a separate mode.** Lives inside Élevage. Accessed by tapping "Voir toutes les tâches" or scrolling to the planning section.

```
┌──────────────────────────────────────┐
│ ← Planning                          │
├──────────────────────────────────────┤
│                                      │
│  [Calendar week strip — selectable]  │
│  L  M  M  J  V  S  D                │
│  30 [31] 1  2  3  4  5              │
│                                      │
│  Progress: 68% cette semaine  ◐     │
│                                      │
│  Aujourd'hui                         │
│  ┌────────────────────────────────┐  │
│  │ ○ Alimentation matin          │  │
│  │   Vague Mars · 08:00          │  │
│  │                    [Faire →]  │  │
│  ├────────────────────────────────┤  │
│  │ ✓ Alimentation midi           │  │
│  │   Vague Mars · fait à 12:15   │  │
│  ├────────────────────────────────┤  │
│  │ ○ Alimentation soir           │  │
│  │   Vague Mars · 17:00          │  │
│  │                    [Faire →]  │  │
│  └────────────────────────────────┘  │
│                                      │
│  Cette semaine                       │
│  ┌────────────────────────────────┐  │
│  │ ○ Biométrie J28               │  │
│  │   Vague Mars · 1 avril        │  │
│  ├────────────────────────────────┤  │
│  │ ○ Qualité eau hebdomadaire    │  │
│  │   Tous les bacs · 2 avril     │  │
│  └────────────────────────────────┘  │
│                                      │
├──────────────────────────────────────┤
│    🐟 Élevage    │ 💰 Business │ ⚙️  │
└──────────────────────────────────────┘
```

Tapping "Faire →" opens the quick entry sheet pre-filled for that task.

---

### SCREEN 9: Notifications

```
┌──────────────────────────────────────┐
│ ← Notifications           Tout lire │
├──────────────────────────────────────┤
│                                      │
│  Aujourd'hui                         │
│  ┌────────────────────────────────┐  │
│  │ ● Densité élevée — Bac 1      │  │
│  │   14.8 kg/m³ (seuil: 15)      │  │
│  │   Il y a 2 heures             │  │
│  ├────────────────────────────────┤  │
│  │ ● Biométrie programmée        │  │
│  │   Vague Mars · J28 dans 7j    │  │
│  │   Il y a 6 heures             │  │
│  └────────────────────────────────┘  │
│                                      │
│  Hier                                │
│  ┌────────────────────────────────┐  │
│  │   Relevé enregistré           │  │
│  │   Alimentation 2.4kg confirmé │  │
│  │   Hier à 18:30                │  │
│  └────────────────────────────────┘  │
│                                      │
└──────────────────────────────────────┘
```

---

### SCREEN 10: Settings

```
┌──────────────────────────────────────┐
│  Réglages                            │
├──────────────────────────────────────┤
│                                      │
│  ┌────────────────────────────────┐  │
│  │ 👤 Ronald Djomkam             │  │
│  │    DK Farm · Douala            │  │
│  │    Plan Pro                    │  │
│  └────────────────────────────────┘  │
│                                      │
│  Exploitation                        │
│  ┌────────────────────────────────┐  │
│  │ Configuration d'élevage     → │  │
│  │ Gestion des bacs            → │  │
│  │ Modules activés             → │  │
│  └────────────────────────────────┘  │
│                                      │
│  Équipe                              │
│  ┌────────────────────────────────┐  │
│  │ Membres (3)                 → │  │
│  │ Rôles et permissions        → │  │
│  └────────────────────────────────┘  │
│                                      │
│  Alertes & Notifications             │
│  ┌────────────────────────────────┐  │
│  │ Seuils d'alerte             → │  │
│  │ Préférences notification    → │  │
│  └────────────────────────────────┘  │
│                                      │
│  Compte                              │
│  ┌────────────────────────────────┐  │
│  │ Abonnement                  → │  │
│  │ Déconnexion                   │  │
│  └────────────────────────────────┘  │
│                                      │
├──────────────────────────────────────┤
│    🐟 Élevage    │ 💰 Business │ ⚙️  │
└──────────────────────────────────────┘
```

---

### SCREEN 11: Breeding Module (Alevins)

Accessible from within Élevage mode via scroll or search.

```
Reproducteurs → list of broodstock with sex, weight, status badges
Pontes → spawning events as timeline cards (date, male+female, egg count, hatch rate)
Lots → fry batches with transfer tracking (nursery → grow-out)
```

Design as clean list views with inline detail expansion, same visual language as the rest.

---

### SCREEN 12: Desktop Layout

On screens ≥ 1024px:

```
┌──────┬──────────────────────────────┬──────────┐
│      │                              │          │
│  🐟  │   Main Content               │  Quick   │
│      │   (charts full width,        │  Entry   │
│  💰  │    2-3 col card grids,       │  Panel   │
│      │    tables for dense data)    │  (320px) │
│  ⚙️  │                              │          │
│      │                              │  Context │
│ 56px │                              │  details │
│icons │                              │          │
│expand│                              │          │
│on    │                              │          │
│hover │                              │          │
│to    │                              │          │
│240px │                              │          │
└──────┴──────────────────────────────┴──────────┘
```

Three-column layout:
1. **Left rail** (56px → 240px on hover): Linear-style icon sidebar with Élevage/Business/Settings groups
2. **Main content** (flexible): Growth charts full width, tables for dense data, wider card grids
3. **Right panel** (320px, collapsible): Quick entry form persists here. Shows context-sensitive details.

⚠️ **DO NOT include IoT sensor cards or "Capteurs IoT" on desktop.** These do not exist.

---

## Empty States

Design compelling empty states for every list/section:

| Context | Copy (French) | CTA |
|---------|--------------|-----|
| No batches | Illustration + "Commencez votre première vague d'élevage" | "+ Nouvelle vague" |
| No measurements | "Enregistrez votre premier relevé pour suivre la croissance" | "Enregistrer" |
| No sales | "Votre récolte est prévue pour le 8 mai. Préparez vos premières ventes." | "Préparer une vente" |
| No stock | "Ajoutez vos produits pour suivre votre inventaire" | "+ Ajouter un produit" |
| No clients | "Vos clients apparaîtront ici. Créez le premier !" | "+ Nouveau client" |
| No breeding | "Suivez votre production d'alevins depuis la ponte" | "+ Ajouter un reproducteur" |

Empty states must feel **inviting, not empty**. Subtle illustrations, warm copy, clear actions.

---

## Loading & Skeleton States

- Cards show skeleton pulse animation (gray shimmer) while loading
- The growth chart shows a subtle animated placeholder line
- Numbers count up from 0 when data loads (Revolut-style)
- Zero layout shift between skeleton and loaded state

---

## Dark Mode

Full dark mode support. Deep Ocean becomes the background (#0A2540). Cards use #151E2E. The Electric Teal accent pops even more. Charts use a subtle gradient background. This is the primary design target for hero shots.

---

## Sample Data

**Farm**: DK Farm, Douala, Cameroun
**Farmer**: Ronald Djomkam

**Active batch — "Vague Mars 2026"**:
- Started: 04 mars 2026, 1 200 fingerlings at 11g
- Current (J21): 1 130 fish, 66g average, 74.6 kg biomass
- Tanks: Bac 1 (600 fish), Bac 2 (530 fish)
- Target: 400g, estimated harvest: 8 mai 2026
- Survival: 94.2%, FCR: 1.35, SGR: 3.2%/day
- Recent: J7 26g, J14 50g, J21 66g

**Previous batch — "Vague Janvier 2026"**: Terminée, 450g, FCR 1.42, Survie 91%

**Stock**: Coppens 42% P2: 25 kg (low alert), Aliment local 35%: 80 kg, Sel: 5 kg

**Finances (mars)**: Revenue 0 FCFA, Expenses 185 000 FCFA

**Currency**: FCFA (no decimals). Format: "125 000 FCFA"
**Units**: g for fish weight, kg for feed/biomass, °C, L for tank volume, kg/m³ for density

---

## Deferred Features — DO NOT Include

| Feature | Reason |
|---------|--------|
| INSIGHT IA card | Requires ML engine that doesn't exist yet |
| IoT sensor cards / Capteurs IoT | No hardware integration exists |
| Planning as 4th bottom nav tab | Violates 3-mode navigation |
| Stock as separate nav tab | Violates 3-mode navigation |

---

## Prototype Requirements

1. **Mobile-first**: Design at 360px width (primary), then 1024px+ desktop
2. **Fully navigable**: Every screen links correctly. Back buttons work. Search is functional.
3. **Both light and dark mode** (dark mode is the showcase mode)
4. **Include**: loading skeletons, empty states, success feedback animations
5. **Bottom nav: EXACTLY 3 items** — Élevage / Business / ⚙️
6. **All text in French**
7. **No IoT, no AI insights** — only real product features
8. **Desktop: true 3-column layout** with collapsible sidebar + contextual right panel
