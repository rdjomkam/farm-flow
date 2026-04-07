# FarmFlow Design Audit & Redesign Plan

**Date:** 2026-04-07
**Stack:** Next.js 16 (App Router) + Tailwind CSS v4 + Radix UI + Recharts + Lucide Icons
**Target:** Mobile-first PWA (360px+) for Cameroonian fish farming management

---

## Part 1 — Current Design Scan

### What's Already Strong

The project has a mature, production-ready design system. These are genuine strengths worth preserving:

| Area | Status | Details |
|------|--------|---------|
| **Font choice** | Geist Sans + Geist Mono | Modern, distinctive, good readability |
| **Color tokens** | CSS variables everywhere | No hardcoded hex in components, clean `--primary`, `--surface-*`, `--accent-*` tokens |
| **Mobile-first layout** | Solid | Bottom nav on mobile, sidebar on desktop, full-screen dialogs on mobile |
| **Touch targets** | 44x44px minimum | WCAG 2.5.5 compliant on all interactive elements |
| **Form accessibility** | Excellent | `aria-invalid`, `aria-describedby`, `aria-required`, live regions for errors |
| **Loading states** | Suspense + skeletons | Per-section skeleton fallbacks, custom FishLoader, global progress bar |
| **Empty states** | Dedicated component | `EmptyState` with icon, title, description, optional CTA |
| **Error boundaries** | Per-section | Class component with retry, French error messages |
| **PWA support** | Complete | Manifest, service worker (Serwist), offline fallback, safe area insets |
| **Card-based lists** | Consistent | No tables on mobile, cards stacked vertically |
| **i18n** | next-intl | French UI, English code, structured translation keys |
| **Interactive cards** | Hover lift + press | `-translate-y-0.5`, shadow upgrade, `active:translate-y-0` |
| **Button variants** | 5 variants, 3 sizes | primary, secondary, danger, ghost, outline |
| **Badge system** | Status-mapped | `en_cours`, `terminee`, `annulee` + semantic variants |

---

## Part 2 — Design Audit (Issues Found)

### 2.1 Typography

| Issue | Severity | Location | Details |
|-------|----------|----------|---------|
| **No tabular figures for data** | Medium | KPI cards, tables, financial pages | Numbers in lists and KPIs use proportional spacing. Prices, weights, and percentages should use `font-variant-numeric: tabular-nums` for aligned columns. |
| **Missing font weight variety** | Low | Throughout | Only 400, 500, 600, 700 used. No Light (300) for contrast in hero sections or large display text. |
| **All-caps section headers everywhere** | Low | `farm-sidebar.tsx:229`, `kpi-card.tsx:30` | `text-[11px] uppercase tracking-wider` is repeated. Consider sentence-case italics or small-caps for variety. |
| **No `text-wrap: balance` on headings** | Low | Dashboard titles, card titles | Long French titles can orphan single words on narrow screens. |

### 2.2 Color & Surfaces

| Issue | Severity | Location | Details |
|-------|----------|----------|---------|
| **Shadows use pure black** | Medium | `globals.css:46-49` | `rgb(0 0 0 / 0.03)` and `rgb(0 0 0 / 0.04)`. Should tint with primary hue: `rgb(13 148 136 / 0.04)` for warmer feel. Card hover shadow already does this correctly. |
| **12 accent colors defined** | Low | `globals.css:53-65` | Blue, purple, amber, emerald, red, green, yellow, orange, pink, indigo, cyan. That's 11 accents plus primary. Consider reducing to 6-7 purposeful accents to avoid palette sprawl. |
| **No grain/texture overlay** | Low | Global | Pure flat surfaces throughout. A subtle noise overlay on `--surface-0` would add depth and break digital flatness. |
| **`--primary: #0d9488` hardcoded in meta** | Low | `layout.tsx:90` | `themeColor: "#0d9488"` should reference the variable or be documented as the canonical value. |

### 2.3 Layout

| Issue | Severity | Location | Details |
|-------|----------|----------|---------|
| **No max-width container** | Medium | Page content | Content stretches edge-to-edge on ultrawide screens. Needs a `max-w-7xl mx-auto` wrapper on main content. |
| **Uniform vertical padding** | Low | Card components | Top and bottom padding always identical (`p-4`). Bottom often needs +4px for optical balance. |
| **KPI grid always equal columns** | Low | `stats-cards.tsx:46` | `grid-cols-2 lg:grid-cols-4` is the default AI pattern. Consider making the primary KPI span 2 columns or use asymmetric sizing. |
| **Consistent `rounded-xl` everywhere** | Low | Cards, form sections, badges | Every container uses the same radius. Vary: tighter `rounded-lg` on inner elements, `rounded-2xl` on page-level containers. |

### 2.4 Interactivity & States

| Issue | Severity | Location | Details |
|-------|----------|----------|---------|
| **`transition-colors` only on buttons** | Medium | `button.tsx` | Should be `transition-all` or include `transition-shadow, transition-transform` for hover lift to feel smooth. |
| **No scroll-behavior: smooth** | Low | `globals.css` | Anchor navigation jumps instantly. Add `scroll-behavior: smooth` on `html`. |
| **No staggered entry animations** | Low | Card lists | All cards appear simultaneously. A staggered `fade-in-up` with 50ms delay per item would feel polished. |
| **Chart hover feels flat** | Low | Recharts components | Default Recharts tooltip. Custom tooltip exists but chart lines don't respond to hover (no `activeDot` glow). |

### 2.5 Semantic HTML & Accessibility

| Issue | Severity | Location | Details |
|-------|----------|----------|---------|
| **No skip-to-content link** | High | `layout.tsx` / `app-shell.tsx` | Users cannot bypass navigation. Essential for keyboard users. |
| **Card lists use `<div>` soup** | Medium | `vagues-list-client.tsx`, `releves-global-list.tsx`, `ventes-list-client.tsx` | Should use `<ul>` + `<li>` or `<article>` for each card item. |
| **Card component is a `<div>`** | Medium | `card.tsx` | The Card primitive should optionally render as `<article>` or `<section>`. |
| **Charts not wrapped in `<figure>`** | Low | All chart components | Should use `<figure>` + `<figcaption>` for semantic meaning. |
| **`maximumScale=1` blocks zoom** | Medium | `layout.tsx` viewport | Prevents user zoom. Acceptable for PWA but an accessibility concern. Document the trade-off. |
| **Inline styles in error fallback** | Low | `layout.tsx:204-214` | Critical error fallback uses inline styles. Acceptable since Tailwind may not be loaded, but should be noted. |

### 2.6 Meta & SEO

| Issue | Severity | Location | Details |
|-------|----------|----------|---------|
| **No Open Graph tags** | Medium | `layout.tsx` metadata | No `og:title`, `og:description`, `og:image`. Sharing links shows no preview. |
| **No Twitter Card tags** | Low | `layout.tsx` metadata | No `twitter:card`, `twitter:title`. |
| **No canonical URL** | Low | Root layout | Missing `<link rel="canonical">`. |
| **No custom 404 page** | Medium | `src/app/` | No `not-found.tsx` detected. Users hitting dead routes see default Next.js 404. |

### 2.7 Component Patterns

| Issue | Severity | Location | Details |
|-------|----------|----------|---------|
| **Lucide icons exclusively** | Low | Throughout | Most common AI icon choice. Consider Phosphor Icons for differentiation (same weight consistency, more character). |
| **Fish icon for logo** | Info | Sidebar, header | Lucide `Fish` icon. Could benefit from a custom SVG silure (catfish) silhouette for branding. |
| **Dialog for everything** | Low | Create/edit flows | Bac creation, vague creation, releve forms all open as dialogs. Consider slide-over panels for creation flows on desktop. |
| **Badge always pill-shaped** | Low | `badge.tsx` | `rounded-full` on every badge. Try `rounded-md` square badges for status indicators. |

### 2.8 Content & Copy

| Issue | Severity | Location | Details |
|-------|----------|----------|---------|
| **Round numbers in seed data** | Low | `prisma/seed.sql` | Weights like `50.0`, `100.0`. Use organic numbers: `47.3`, `98.6`. |
| **Generic error copy** | Low | Error boundary | "Une erreur est survenue" is vague. Be more specific per context. |

---

## Part 3 — Redesign Plan (Priority Order)

Following the skill's fix priority: font → color → hover → layout → components → states → polish.

### Priority 1 — Typography Polish (Low risk, high impact)

**Files to modify:**
- `src/app/globals.css`
- `src/components/ui/kpi-card.tsx`
- `src/components/ui/card.tsx`

**Changes:**
1. Add `font-variant-numeric: tabular-nums` globally for elements with `font-mono` class and on KPI value elements
2. Add `text-wrap: balance` on heading elements (`h1`, `h2`, `h3`)
3. Introduce a `.display-text` utility with `font-weight: 300; letter-spacing: -0.02em` for hero/large headings
4. Vary section header styles: keep uppercase for sidebar labels, use sentence-case with medium weight for form section legends

**Estimated scope:** ~30 lines changed across 3 files

---

### Priority 2 — Color & Shadow Refinement (Low risk, medium impact)

**Files to modify:**
- `src/app/globals.css`

**Changes:**
1. Tint card shadows with primary hue:
   ```css
   --shadow-card: 0 1px 3px 0 rgb(13 148 136 / 0.04), 0 1px 2px -1px rgb(0 0 0 / 0.02);
   --shadow-elevated: 0 12px 24px -4px rgb(13 148 136 / 0.08), 0 4px 8px -4px rgb(0 0 0 / 0.03);
   ```
2. Add a subtle grain noise overlay on `--surface-0`:
   ```css
   body::before {
     content: "";
     position: fixed;
     inset: 0;
     pointer-events: none;
     z-index: 9999;
     opacity: 0.015;
     background-image: url("data:image/svg+xml,..."); /* noise pattern */
   }
   ```
3. Reduce accent palette from 12 to 7 purposeful colors (blue, amber, emerald, red, purple, orange, cyan). Remove unused pink, yellow, indigo, green duplicates.

**Estimated scope:** ~25 lines changed in 1 file

---

### Priority 3 — Hover & Motion Upgrades (Low risk, high impact)

**Files to modify:**
- `src/app/globals.css`
- `src/components/ui/button.tsx`

**Changes:**
1. Add `scroll-behavior: smooth` on `html`
2. Upgrade button transition from `transition-colors` to `transition-all duration-200`
3. Add staggered animation utility:
   ```css
   .stagger-children > * {
     animation: fade-in-up 0.4s ease-out both;
   }
   .stagger-children > *:nth-child(1) { animation-delay: 0ms; }
   .stagger-children > *:nth-child(2) { animation-delay: 50ms; }
   .stagger-children > *:nth-child(3) { animation-delay: 100ms; }
   /* ... up to 12 */
   ```
4. Add active dot glow on Recharts charts:
   ```tsx
   <Line activeDot={{ r: 6, stroke: "var(--primary)", strokeWidth: 2, fill: "white" }} />
   ```

**Estimated scope:** ~40 lines across 3-4 files

---

### Priority 4 — Layout & Spacing Fixes (Medium risk, medium impact)

**Files to modify:**
- `src/components/layout/app-shell.tsx`
- `src/components/ui/card.tsx`
- `src/components/dashboard/stats-cards.tsx`

**Changes:**
1. Add `max-w-7xl mx-auto` container wrapper on main content for ultrawide screens
2. Make primary KPI card span 2 columns on desktop: `lg:col-span-2` on first card
3. Adjust Card padding: `pb-5` (20px bottom) vs `pt-4` (16px top) for optical balance
4. Vary border-radius: `rounded-lg` on inner cards (badges, form sections), keep `rounded-xl` on page-level cards

**Estimated scope:** ~20 lines across 4 files

---

### Priority 5 — Semantic HTML & Accessibility (Medium risk, high importance)

**Files to modify:**
- `src/components/layout/app-shell.tsx` or `src/app/layout.tsx`
- `src/components/ui/card.tsx`
- `src/components/vagues/vagues-list-client.tsx` (and similar list components)

**Changes:**
1. Add skip-to-content link:
   ```tsx
   <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:bg-primary focus:text-primary-foreground focus:px-4 focus:py-2 focus:rounded-lg">
     Aller au contenu principal
   </a>
   ```
2. Add `id="main-content"` to `<main>` element
3. Add optional `as` prop to Card component: `as?: "article" | "section" | "div"`
4. Wrap card lists in `<ul role="list">` with `<li>` per card
5. Wrap charts in `<figure>` + `<figcaption>`

**Estimated scope:** ~50 lines across 6-8 files

---

### Priority 6 — Component Pattern Upgrades (Medium risk, medium impact)

**Files to modify:**
- `src/components/ui/badge.tsx`
- Various list/creation components

**Changes:**
1. Add `rounded-md` badge variant for status indicators (keep `rounded-full` as default)
2. Consider slide-over panel for desktop creation flows (new `SlidePanel` component wrapping Radix Dialog with `side="right"` — similar to existing Sheet but wider, `w-[480px]`)
3. Add custom catfish SVG logo to replace generic Lucide Fish (brand differentiation)

**Estimated scope:** ~60 lines, 1 new component + modifications

---

### Priority 7 — Meta & 404 Page (Low risk, important for completeness)

**Files to create/modify:**
- `src/app/layout.tsx` (add OG tags)
- `src/app/not-found.tsx` (create)

**Changes:**
1. Add Open Graph metadata:
   ```tsx
   openGraph: {
     type: "website",
     locale: "fr_CM",
     siteName: "FarmFlow",
     title: "FarmFlow — Suivi d'elevage de silures",
     description: "Application de suivi piscicole pour l'elevage de silures",
   }
   ```
2. Create branded 404 page with FishLoader, message, and link back to dashboard

**Estimated scope:** ~40 lines, 1 new file + 1 modification

---

## Part 4 — Summary Matrix

| # | Fix | Impact | Risk | Files | Lines |
|---|-----|--------|------|-------|-------|
| 1 | Typography polish (tabular nums, text-wrap, display text) | High | Low | 3 | ~30 |
| 2 | Shadow tinting + grain overlay + palette reduction | Medium | Low | 1 | ~25 |
| 3 | Smooth scroll + button transitions + stagger animations | High | Low | 3-4 | ~40 |
| 4 | Max-width container + KPI grid + optical padding | Medium | Medium | 4 | ~20 |
| 5 | Skip-to-content + semantic lists + figure wrapping | High | Medium | 6-8 | ~50 |
| 6 | Badge variants + slide panel + custom logo | Medium | Medium | 3 | ~60 |
| 7 | OG meta tags + 404 page | Medium | Low | 2 | ~40 |

**Total estimated:** ~265 lines across ~15 files. No framework migration. No breaking changes.

---

## Part 5 — What NOT to Change

These are already well-done and should be preserved:

- **Geist font choice** — distinctive, modern, no need to swap
- **Teal primary color** — fits the aquaculture domain perfectly
- **Mobile-first card layout** — correct for the target audience (farmers on phones)
- **44px touch targets** — WCAG compliant, critical for field use
- **Radix UI primitives** — solid accessibility foundation
- **FishLoader animation** — charming, on-brand loading state
- **CSS variable architecture** — clean token system, no hardcoded values
- **Form validation pattern** — ARIA-first, inline errors, live regions
- **PWA/safe area support** — essential for the target market
- **Bottom nav + sidebar split** — correct pattern for mobile-first dashboard app
