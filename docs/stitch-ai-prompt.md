# FarmFlow — Complete App Redesign

> Prompt for Google Stitch AI. Generate a full interactive prototype (clickable, navigable) for a mobile-first catfish farm management app.

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

**2. Two-tap actions.** The most common action (recording a feeding) should take 2 taps maximum from anywhere in the app. Not 3 steps. Not a wizard. Two taps: tap the action, confirm the quantity. Everything else should follow this philosophy — minimal friction, maximum speed.

**3. Opinionated navigation.** Instead of a traditional 5-tab bottom bar with "More" menus and nested sheets, use a bold, clear navigation model. The app has 3 modes, not 15 sections: **Farm** (what's happening now), **Business** (money in, money out), **Settings** (configure once). Within each mode, content is flat and searchable — not buried in hierarchies.

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

Instead of a traditional tab bar with 5 items and "More" menus, FarmFlow uses **three clear modes** accessible via a bottom navigation:

```
┌────────────────────────────────────────┐
│    🐟 Élevage    │  💰 Business  │  ⚙️  │
└────────────────────────────────────────┘
```

**Élevage** (Farming) — Everything about the fish: batches, measurements, growth, tanks, breeding, planning. This is where the farmer lives 90% of the time.

**Business** — Money: sales, clients, invoices, expenses, stock, orders, financial dashboard. Visited weekly or when selling fish.

**Settings (gear icon, no label)** — Farm config, team, roles, alerts, subscription. Visited rarely.

Within each mode, navigation is **flat**: a scrollable home for that mode with inline sections, and tapping any item opens a detail view. No nested menus. No "More" drawers. A universal search bar at the top of each mode lets you find anything instantly: "Bac 2", "Coppens", "Vague Mars".

On **desktop**, the three modes become a minimal left sidebar with the same three groups, expanded to show all sub-items. The sidebar is narrow (56px icons only, expanding to 240px on hover) — Linear style.

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

**The Hero Card** is the centerpiece. It's the active batch — dark navy background, big weight number in white, teal progress bar, harvest countdown. If the farmer has 2+ active batches, the hero cards are horizontally swipeable (with dot indicators). Each hero card is tappable to open the batch detail.

**The "Enregistrer" bar** sits above the bottom nav, always visible. It's a full-width teal button. One tap opens a bottom sheet with quick actions — not a multi-step form. This replaces the FAB.

**Indicator chips** use green checkmark / amber warning / red alert iconography. Tapping one opens its detail.

**The growth chart** is a compact preview — tapping it opens a full-screen interactive chart.

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
- The sheet **remembers the last batch, tank, product, and quantity**. For the 3x/day feeding, the farmer literally taps "Enregistrer" → sees the pre-filled alimentation with yesterday's product and quantity → adjusts if needed → taps "Enregistrer ✓". Two taps.
- The **type grid pre-selects Alimentation** (most frequent action) with a subtle highlight. The expanded form appears inline, no page transition.
- **Smart defaults**: quantity defaults to the average of the last 3 feedings. Product defaults to the last used. Batch/tank defaults to the active one.
- For types needing more fields (biometrie, qualite_eau), the sheet expands to full-screen or opens a focused form — but always with smart defaults and minimal fields.

---

### SCREEN 3: Batch Detail

Tapping a hero card or batch item opens the full detail view.

```
┌──────────────────────────────────────┐
│ ← Vague Mars 2026             ···   │
├──────────────────────────────────────┤
│                                      │
│  ┌────────────────────────────────┐  │
│  │  GROWTH CHART — Full width     │  │
│  │  Dark background               │  │
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
│  │                                │  │
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
- **No tabs.** Instead of Résumé/Relevés/Bacs/Projections tabs, everything lives on one scrollable page with clear sections. The chart is the hero. Measurements are a timeline. Tanks are inline cards. Less navigation, more content.
- **Milestone timeline** is a horizontal progress track with filled dots (achieved) and hollow dots (upcoming). Visually satisfying, shows progress at a glance.
- **Measurement timeline** groups by date with type icons. Dense but scannable. No separate "measurements list" page needed — this IS the list, inline.
- Tapping "Voir tout" opens a filterable full list if needed, but most farmers won't need it.

---

### SCREEN 4: Batch List

Accessed via the Élevage mode by scrolling past the hero card(s) or tapping "Toutes les vagues".

```
┌──────────────────────────────────────┐
│ 🔍 Rechercher...            🔔 (2)  │
├──────────────────────────────────────┤
│                                      │
│  Vagues                              │
│  [En cours: 2] [Terminées: 5]       │
│   ↑ selected                         │
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
│  │ (empty state)                  │  │
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
│  │ 04 mars · Alevins · 30 000   │  │
│  │ Voir tout →                    │  │
│  └────────────────────────────────┘  │
│                                      │
├──────────────────────────────────────┤
│    🐟 Élevage    │ 💰 Business │ ⚙️  │
└──────────────────────────────────────┘
```

**Design decision:** No separate "Finances", "Ventes", "Stock", "Commandes" pages at the top level. The Business home shows a financial summary + quick shortcuts + inline lists. Each shortcut (Vente, Factures, Stock) opens a focused view. The farmer thinks in terms of money — not in terms of database tables.

---

### SCREEN 6: Stock View

Accessed from Business → Stock shortcut.

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

Not a separate mode — it lives inside Élevage as a section, and tasks also appear contextually on the home screen. But tapping "Voir toutes les tâches" opens:

```
┌──────────────────────────────────────┐
│ ← Planning                          │
├──────────────────────────────────────┤
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
└──────────────────────────────────────┘
```

Tapping "Faire →" on a task opens the quick entry sheet pre-filled for that task. One tap to start, one tap to confirm.

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
└──────────────────────────────────────┘
```

---

### SCREEN 11: Breeding Module (Alevins)

Accessible from a section within Élevage home (scrolling down) or via search.

```
Reproducteurs → list of broodstock with sex, weight, status badges
Pontes → spawning events as timeline cards (date, male+female, egg count, hatch rate)
Lots → fry batches with transfer tracking (nursery → grow-out)
```

Design these as clean list views with inline detail expansion, same visual language as the rest.

---

### SCREEN 12: Desktop Layout

On screens ≥ 1024px, the app transforms:

```
┌──────┬───────────────────────────────────────────┐
│      │                                           │
│  🐟  │   [Same content as mobile screens,        │
│      │    but wider cards, 2-3 column grids,     │
│  💰  │    charts at full width, and the quick    │
│      │    entry panel can be a persistent         │
│  ⚙️  │    right sidebar instead of a bottom      │
│      │    sheet]                                  │
│      │                                           │
│      │   The growth chart gets more room.        │
│      │   Tables replace card lists for dense     │
│      │   data (measurements, transactions).      │
│      │   Financial charts can show more detail.  │
│      │                                           │
│ 56px │                                           │
│icons │                                           │
│only, │                                           │
│expand│                                           │
│on    │                                           │
│hover │                                           │
│to    │                                           │
│240px │                                           │
└──────┴───────────────────────────────────────────┘
```

The sidebar is **icon-only (56px)** by default, expanding to 240px with labels on hover. Linear-style. Three groups: Élevage, Business, Settings — same as the mobile bottom nav.

---

## Empty States

Design compelling empty states for:

- **No batches yet**: Illustration of a fish + "Commencez votre première vague" + big CTA button
- **No measurements**: "Enregistrez votre premier relevé pour suivre la croissance"
- **No sales**: "Votre récolte est prévue pour le 8 mai. Préparez vos premières ventes."
- **No stock**: "Ajoutez vos produits pour suivre votre inventaire"

Empty states should feel inviting, not empty. Use subtle illustrations or icons, warm copy, and a clear action.

---

## Loading & Skeleton States

- Cards show skeleton pulse animation (gray shimmer) while loading
- The growth chart shows a subtle animated placeholder line
- Numbers count up from 0 when data loads (Revolut-style)

---

## Dark Mode

Full dark mode support. The Deep Ocean primary becomes the background (#0A2540). Cards use #151E2E. The Electric Teal accent pops even more against dark surfaces. Charts use a subtle gradient background. This is the mode that looks best on the marketing site.

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

## Prototype Requirements

- **Mobile-first**: Design at 360px width (primary), then 1024px+ desktop
- **Fully navigable**: Every screen links to every other screen it should. Tap a batch → see batch detail. Tap Enregistrer → see the quick entry sheet. Tap back → go back.
- **Both light and dark mode**
- **Include**: loading skeletons, empty states, success feedback animations
- **All text in French**
