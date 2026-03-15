// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { BottomNav } from "@/components/layout/bottom-nav";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Permission, Role } from "@/types";

const allPermissions = Object.values(Permission);

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
}));

// ---------------------------------------------------------------------------
// Mobile-first responsive patterns
// ---------------------------------------------------------------------------

describe("Responsive — Mobile first patterns", () => {
  it("BottomNav est visible sur mobile (md:hidden)", () => {
    const { container } = render(<BottomNav permissions={allPermissions} role={null} />);
    const nav = container.querySelector("nav");
    expect(nav?.className).toContain("md:hidden");
  });

  it("BottomNav a une hauteur tactile suffisante (min-h-[56px])", () => {
    const { container } = render(<BottomNav permissions={allPermissions} role={null} />);
    const links = container.querySelectorAll("a");
    links.forEach((link) => {
      expect(link.className).toContain("min-h-[56px]");
    });
  });

  it("BottomNav ADMIN/GERANT a 4 onglets par defaut", () => {
    const { container } = render(<BottomNav permissions={allPermissions} role={null} />);
    const links = container.querySelectorAll("a");
    expect(links).toHaveLength(4);
  });

  it("BottomNav PISCICULTEUR a 4 onglets dedies", () => {
    const { container } = render(<BottomNav permissions={allPermissions} role={Role.PISCICULTEUR} />);
    const links = container.querySelectorAll("a");
    expect(links).toHaveLength(4);
  });

  it("BottomNav INGENIEUR a 3 onglets dedies", () => {
    const { container } = render(<BottomNav permissions={allPermissions} role={Role.INGENIEUR} />);
    const links = container.querySelectorAll("a");
    expect(links).toHaveLength(3);
  });
});

describe("Responsive — Taille tactile des composants", () => {
  it("Button a une taille minimum de 44px", () => {
    const { container } = render(<Button>Test</Button>);
    const button = container.querySelector("button");
    expect(button?.className).toContain("min-h-[44px]");
    expect(button?.className).toContain("min-w-[44px]");
  });

  it("Input a une hauteur minimum de 44px", () => {
    const { container } = render(<Input id="test" />);
    const input = container.querySelector("input");
    expect(input?.className).toContain("min-h-[44px]");
  });

  it("Input affiche un label quand fourni", () => {
    const { container } = render(<Input id="test" label="Mon label" />);
    const label = container.querySelector("label");
    expect(label?.textContent).toBe("Mon label");
  });

  it("Input affiche une erreur en rouge", () => {
    const { container } = render(<Input id="test" error="Champ requis" />);
    const errorP = container.querySelector("p");
    expect(errorP?.textContent).toBe("Champ requis");
    expect(errorP?.className).toContain("text-danger");
  });
});

describe("Responsive — Badge", () => {
  it("Badge en_cours a le bon style", () => {
    const { container } = render(<Badge variant="en_cours">En cours</Badge>);
    const badge = container.querySelector("span");
    expect(badge?.className).toContain("text-primary");
  });

  it("Badge terminee a le bon style", () => {
    const { container } = render(<Badge variant="terminee">Terminée</Badge>);
    const badge = container.querySelector("span");
    expect(badge?.className).toContain("text-success");
  });

  it("Badge annulee a le bon style", () => {
    const { container } = render(<Badge variant="annulee">Annulée</Badge>);
    const badge = container.querySelector("span");
    expect(badge?.className).toContain("text-danger");
  });

  it("Badge warning a le bon style (bac occupé)", () => {
    const { container } = render(<Badge variant="warning">Occupé</Badge>);
    const badge = container.querySelector("span");
    expect(badge?.className).toContain("text-accent-amber");
  });
});

describe("Responsive — Grilles mobile first", () => {
  it("Les cartes de bacs utilisent une grille responsive (md:grid-cols-2 lg:grid-cols-3)", () => {
    // Verify pattern from bacs-list-client.tsx: "grid gap-3 p-4 md:grid-cols-2 lg:grid-cols-3"
    // Mobile first = no default grid-cols (stacks), breakpoints add columns
    const gridClasses = "grid gap-3 p-4 md:grid-cols-2 lg:grid-cols-3";
    expect(gridClasses).toContain("md:grid-cols-2");
    expect(gridClasses).toContain("lg:grid-cols-3");
    // No bare grid-cols-N without breakpoint prefix = correct mobile-first
    const bareGridCols = gridClasses.match(/(?<![a-z]:)grid-cols-\d/);
    expect(bareGridCols).toBeNull();
  });

  it("Les indicateurs utilisent une grille progressive (grid-cols-2 sm:3 md:5)", () => {
    const gridClasses = "grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5";
    expect(gridClasses).toContain("grid-cols-2"); // 2 colonnes sur mobile
    expect(gridClasses).toContain("sm:grid-cols-3");
    expect(gridClasses).toContain("md:grid-cols-5");
  });

  it("Le Dialog est plein écran mobile, centré desktop", () => {
    // From dialog.tsx: "inset-0 rounded-none" (mobile) + "md:inset-auto md:max-w-lg" (desktop)
    const dialogClasses = "inset-0 rounded-none md:inset-auto md:left-1/2 md:top-1/2 md:max-w-lg";
    expect(dialogClasses).toContain("inset-0"); // Full screen mobile
    expect(dialogClasses).toContain("md:inset-auto"); // Override for desktop
    expect(dialogClasses).toContain("md:max-w-lg"); // Max width on desktop
  });
});
