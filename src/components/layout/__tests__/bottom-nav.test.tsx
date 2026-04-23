// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi } from "vitest";
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
// CSS regression — mobile safe-area backdrop in globals.css
// ---------------------------------------------------------------------------

describe("BUG-043 — globals.css mobile safe-area backdrop", () => {
  it("globals.css paints an opaque card backdrop behind the mobile safe-area", () => {
    const css = fs.readFileSync(
      path.join(process.cwd(), "src/app/globals.css"),
      "utf-8"
    );
    expect(css).toMatch(/@media \(max-width: 767px\)/);
    expect(css).toMatch(/safe-area-inset-bottom/);
    expect(css).toMatch(/var\(--card\)/);
  });
});
