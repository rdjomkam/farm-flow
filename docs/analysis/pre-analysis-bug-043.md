# Pre-analysis — BUG-043 Mobile web: bottom nav jitter + transparent safe-area

**Agent:** @pre-analyst (opus) — 2026-04-23
**Status:** GO — Surgical, no dependency blockers.
**Severité recommandée :** **Moyenne**

## Root cause

### Cause A — Jittering during URL bar transition
The three bottom-nav variants use `className="fixed bottom-0 ..."`. This is correct in principle, but `position: fixed` on mobile browsers is anchored to the **visual viewport**, not the layout viewport. When the URL bar collapses, the visual viewport changes height and Safari/Chrome re-anchor the fixed element — that transition causes the visible "move".

The app-shell correctly uses `min-h-dvh` (`src/components/layout/app-shell.tsx:63,106`), and `globals.css:102-107` has `overscroll-behavior-y: none` on `html` and `body`. These are correct but insufficient: the fixed element still re-paints on each visual-viewport update. Mitigation:

- `transform: translateZ(0)` (GPU layer promotion) or `will-change: transform` — the nav becomes a composited layer, so browsers don't re-layout it during URL-bar animation.

### Cause B — Transparent safe-area
Structural review:

- Nav element has `bg-card` + `pb-[env(safe-area-inset-bottom)]`. Tailwind's `bg-card` paints the nav's entire box, INCLUDING its padding. So the safe-area band under the nav icons SHOULD be `var(--card)`.
- **However**: during URL-bar animation, the nav may briefly detach from the visual viewport bottom. The area BELOW the nav (but above where the nav was) reveals the `<body>` background = `var(--surface-0)` `#f7fafa`. That off-white against the nav's `#ffffff` reads as transparency.
- Grain overlay `body::before` (`globals.css:122-132`) at `z-index: 9999` sits above the nav. Opacity 0.015 is imperceptible, so not the cause.

Additional context:
- `src/app/layout.tsx:72` sets `apple-mobile-web-app-status-bar-style: "black-translucent"` and `viewportFit: "cover"` — correct.
- `public/manifest.json` has `background_color` and `theme_color` — correct.

## Surgical fix

### Edit 1 — Bottom nav GPU promotion
`src/components/layout/farm-bottom-nav.tsx` (line 383), `src/components/layout/ingenieur-bottom-nav.tsx` (line 268), and `src/components/layout/bottom-nav-skeleton.tsx` (line 3):

Change className from:
```
fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-card pb-[env(safe-area-inset-bottom)] md:hidden
```
to:
```
fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-card pb-[env(safe-area-inset-bottom)] md:hidden [transform:translateZ(0)] will-change-transform
```

### Edit 2 — `src/app/globals.css` — mobile safe-area backdrop
Add after line 119 (after the existing `body` rule block):

```css
/* BUG-043: Mobile bottom safe-area — paint an opaque card-colored backdrop
   so the home-indicator area never looks transparent when the URL bar
   animates, even if the fixed nav briefly detaches from the viewport. */
@media (max-width: 767px) {
  body {
    background:
      linear-gradient(
        to top,
        var(--card) 0,
        var(--card) env(safe-area-inset-bottom),
        transparent env(safe-area-inset-bottom)
      )
      var(--surface-0);
    background-attachment: fixed;
  }
}
```

### Edit 3 — (Optional, cosmetic) `public/manifest.json`
Consider aligning `background_color` from `#f7fafa` to `#ffffff` so PWA splash matches `--card`. Not required for the fix.

### No change needed
- `src/app/layout.tsx` — viewport meta already has `viewport-fit: cover`.
- `public/manifest.json` — non-blocking.

## Regression test plan

New test file: `src/components/layout/__tests__/bottom-nav.test.tsx`

```ts
it("applies safe-area padding and GPU-layer hint to the bottom nav", () => {
  render(<FarmBottomNav permissions={[Permission.VAGUES_VOIR]} siteModules={[]} role={RoleEnum.GERANT} userName="u" isSuperAdmin={false} />);
  const nav = screen.getAllByRole("navigation")[0];
  const cls = nav.className;
  expect(cls).toMatch(/fixed/);
  expect(cls).toMatch(/bottom-0/);
  expect(cls).toMatch(/bg-card/);
  expect(cls).toMatch(/pb-\[env\(safe-area-inset-bottom\)\]/);
  expect(cls).toMatch(/translateZ\(0\)/);
});
```

Repeat for `IngenieurBottomNav` and `BottomNavSkeleton`.

CSS regression:
```ts
it("globals.css paints an opaque card backdrop behind the mobile safe-area", () => {
  const css = fs.readFileSync(path.join(process.cwd(), "src/app/globals.css"), "utf-8");
  expect(css).toMatch(/@media \(max-width: 767px\)/);
  expect(css).toMatch(/safe-area-inset-bottom/);
  expect(css).toMatch(/var\(--card\)/);
});
```

## Impacted files (absolute paths)

- `/Users/ronald/project/dkfarm/farm-flow/src/components/layout/farm-bottom-nav.tsx` (line 383)
- `/Users/ronald/project/dkfarm/farm-flow/src/components/layout/ingenieur-bottom-nav.tsx` (line 268)
- `/Users/ronald/project/dkfarm/farm-flow/src/components/layout/bottom-nav-skeleton.tsx` (line 3)
- `/Users/ronald/project/dkfarm/farm-flow/src/app/globals.css` (insert after line 119)
- **New test:** `/Users/ronald/project/dkfarm/farm-flow/src/components/layout/__tests__/bottom-nav.test.tsx`

## Dependencies

- No new Tailwind utilities required (arbitrary `[transform:translateZ(0)]` + built-in `will-change-transform`).
- No change to `viewport` meta (already `viewport-fit: cover`).
- All three nav variants must update together to avoid skeleton/hydration mismatch.

## Risks

1. `background-attachment: fixed` + `overscroll-behavior-y: none` — well-supported, but smoke-test on iOS Safari, Chrome Android.
2. GPU layer promotion marginally increases memory on low-end Android — acceptable.
3. Skeleton and real navs must share the same classes to avoid visual flash on hydration.

## Severity — **Moyenne**
UX-degraded but non-blocking; no data integrity impact; mobile web only (not PWA install or desktop).
