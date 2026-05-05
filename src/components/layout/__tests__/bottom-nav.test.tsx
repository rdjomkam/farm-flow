// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, beforeEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { render, screen } from "@testing-library/react";

// ---------------------------------------------------------------------------
// Mocks (shared for farm + ingenieur bottom navs)
// ---------------------------------------------------------------------------

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("@/services", () => ({
  useAuthService: () => ({ logout: vi.fn().mockResolvedValue(undefined) }),
}));

// Lightweight stubs for optional heavy children so the tree renders cleanly.
vi.mock("@/components/layout/language-switcher", () => ({
  LanguageSwitcher: () => null,
}));

vi.mock("@/components/layout/fab-releve", () => ({
  FabReleve: () => null,
}));

import { FarmBottomNav } from "@/components/layout/farm-bottom-nav";
import { IngenieurBottomNav } from "@/components/layout/ingenieur-bottom-nav";
import { BottomNavSkeleton } from "@/components/layout/bottom-nav-skeleton";
import { Permission, Role } from "@/types";

// ---------------------------------------------------------------------------
// BUG-043 — Bottom nav GPU-layer promotion + safe-area padding
// ---------------------------------------------------------------------------

function assertBottomNavClasses(cls: string) {
  expect(cls).toMatch(/fixed/);
  expect(cls).toMatch(/bottom-0/);
  expect(cls).toMatch(/bg-card/);
  expect(cls).toMatch(/pb-\[env\(safe-area-inset-bottom\)\]/);
  expect(cls).toMatch(/translateZ\(0\)/);
  expect(cls).toMatch(/will-change-transform/);
}

describe("BUG-043 — Bottom nav variants apply safe-area padding + GPU layer hint", () => {
  it("FarmBottomNav nav container exposes the required classes", () => {
    render(
      <FarmBottomNav
        permissions={[Permission.VAGUES_VOIR]}
        siteModules={[]}
        role={Role.GERANT}
        userName="tester"
        isSuperAdmin={false}
      />
    );
    const navs = screen.getAllByRole("navigation");
    // The fixed bottom nav is the first <nav> rendered by the component.
    const nav = navs[0] as HTMLElement;
    assertBottomNavClasses(nav.className);
  });

  it("IngenieurBottomNav nav container exposes the required classes", () => {
    render(
      <IngenieurBottomNav
        permissions={[Permission.VAGUES_VOIR]}
        siteModules={[]}
        role={Role.INGENIEUR}
        userName="tester"
        isSuperAdmin={false}
      />
    );
    const navs = screen.getAllByRole("navigation");
    const nav = navs[0] as HTMLElement;
    assertBottomNavClasses(nav.className);
  });

  it("BottomNavSkeleton nav container exposes the required classes", () => {
    render(<BottomNavSkeleton />);
    const nav = screen.getByRole("navigation") as HTMLElement;
    assertBottomNavClasses(nav.className);
  });
});

// ---------------------------------------------------------------------------
// CSS regression — mobile safe-area backdrops in globals.css
// ---------------------------------------------------------------------------

describe("BUG-043 — globals.css mobile safe-area backdrop (bottom)", () => {
  it("globals.css paints an opaque card backdrop behind the mobile safe-area via a fixed pseudo-element (not background-attachment:fixed, which iOS ignores)", () => {
    const css = fs.readFileSync(
      path.join(process.cwd(), "src/app/globals.css"),
      "utf-8"
    );
    expect(css).toMatch(/@media \(max-width: 767px\)/);
    expect(css).toMatch(/safe-area-inset-bottom/);
    expect(css).toMatch(/var\(--card\)/);
    // Must use a fixed-position pseudo-element (iOS-compatible), NOT
    // `background-attachment: fixed` which is ignored on iOS Safari.
    expect(css).toMatch(/html::after/);
    expect(css).toMatch(/position:\s*fixed/);
    // Strip CSS /* ... */ comments before asserting no `background-attachment: fixed`
    // actually applies (the comment warning readers about its iOS incompatibility is fine).
    const cssNoComments = css.replace(/\/\*[\s\S]*?\*\//g, "");
    expect(cssNoComments).not.toMatch(/background-attachment:\s*fixed/);
  });
});

// ---------------------------------------------------------------------------
// BUG-047 — top safe-area opaque backdrop + extended bottom backdrop
// ---------------------------------------------------------------------------

describe("BUG-047 — globals.css safe-area backdrops (top + extended bottom)", () => {
  let css: string;
  let cssNoComments: string;

  beforeEach(() => {
    css = fs.readFileSync(
      path.join(process.cwd(), "src/app/globals.css"),
      "utf-8"
    );
    // Strip comments so assertions target actual CSS rules, not explanatory text.
    cssNoComments = css.replace(/\/\*[\s\S]*?\*\//g, "");
  });

  it("html::before exists for the top safe-area backdrop", () => {
    expect(cssNoComments).toMatch(/html::before/);
  });

  it("html::before uses position: fixed", () => {
    // Extract the html::before block to scope the assertion.
    const beforeBlock = cssNoComments.match(/html::before\s*\{([^}]+)\}/)?.[1] ?? "";
    expect(beforeBlock).toMatch(/position:\s*fixed/);
  });

  it("html::before is pinned to the top of the viewport (top: 0)", () => {
    const beforeBlock = cssNoComments.match(/html::before\s*\{([^}]+)\}/)?.[1] ?? "";
    expect(beforeBlock).toMatch(/top:\s*0/);
  });

  it("html::before covers safe-area-inset-top height", () => {
    const beforeBlock = cssNoComments.match(/html::before\s*\{([^}]+)\}/)?.[1] ?? "";
    expect(beforeBlock).toMatch(/height:\s*env\(safe-area-inset-top\)/);
  });

  it("html::before uses var(--card) background (R6: no hardcoded colour)", () => {
    const beforeBlock = cssNoComments.match(/html::before\s*\{([^}]+)\}/)?.[1] ?? "";
    expect(beforeBlock).toMatch(/background:\s*var\(--card\)/);
  });

  it("html::before sits at z-index 49 (below header z-50, above page content)", () => {
    const beforeBlock = cssNoComments.match(/html::before\s*\{([^}]+)\}/)?.[1] ?? "";
    expect(beforeBlock).toMatch(/z-index:\s*49/);
  });

  it("html::after extends 60px past the visual viewport bottom to absorb Safari URL-bar glitch frames", () => {
    // During Safari iOS URL-bar animation, env(safe-area-inset-bottom) briefly
    // drops to 0. A negative bottom offset keeps the element visible even then.
    const afterBlock = cssNoComments.match(/html::after\s*\{([^}]+)\}/)?.[1] ?? "";
    // bottom must be a negative value (e.g. -60px)
    expect(afterBlock).toMatch(/bottom:\s*-\d+px/);
    // height must incorporate the extra buffer via calc()
    expect(afterBlock).toMatch(/height:\s*calc\(env\(safe-area-inset-bottom\)\s*\+\s*\d+px\)/);
  });
});
