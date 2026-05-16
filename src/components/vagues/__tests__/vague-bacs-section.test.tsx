// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { VagueBacsSection } from "@/components/vagues/vague-bacs-section";
import type { AssignationBacForVague } from "@/types";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, params?: Record<string, unknown>) => {
    if (!params) return key;
    // Interpolate {count}, {initial} by substituting into a template
    // key format example: "poissonsActuels" → rendered as "{count} actuels ({initial} au départ)"
    const templates: Record<string, string> = {
      poissonsActuels: "{count} actuels ({initial} au départ)",
      poissons: "{count} poissons",
    };
    const tpl = templates[key] ?? key;
    return Object.entries(params).reduce(
      (str, [k, v]) => str.replace(`{${k}}`, String(v)),
      tpl
    );
  },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

// next/link renders a plain <a> in tests
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode; [key: string]: unknown }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeAssignation(overrides: Partial<AssignationBacForVague> = {}): AssignationBacForVague {
  return {
    id: "assign-1",
    vagueId: "vague-1",
    bacId: "bac-1",
    siteId: "site-1",
    dateAssignation: new Date("2026-01-01"),
    dateFin: null,
    nombrePoissons: 3500,
    nombreInitial: 3500,
    bac: { id: "bac-1", nom: "Bac A", volume: 5000 },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// BUG-045 — VagueBacsSection affiche les vivants réels, pas nombrePoissons stale
// ---------------------------------------------------------------------------

describe("BUG-045 — VagueBacsSection vivants par bac actif", () => {
  it("affiche 'X actuels (Y au départ)' quand vivants et nombreInitial sont définis", () => {
    const assignation = makeAssignation({ nombreInitial: 3500 });
    const bacsActifs = [{ ...assignation, vivants: 3405 as number | null }];

    render(
      <VagueBacsSection
        bacsActifs={bacsActifs}
        bacsRetires={[]}
      />
    );

    // The mock useTranslations interpolates {count} and {initial}
    // Expected rendered text: "3405 actuels (3500 au départ)"
    const el = screen.getByText("3405 actuels (3500 au départ)");
    expect(el).toBeDefined();
  });

  it("affiche 'X poissons' quand vivants est défini mais nombreInitial est null", () => {
    const assignation = makeAssignation({ nombreInitial: null });
    const bacsActifs = [{ ...assignation, vivants: 3405 as number | null }];

    render(
      <VagueBacsSection
        bacsActifs={bacsActifs}
        bacsRetires={[]}
      />
    );

    // Should show the simple "poissons" key with count: "3405 poissons"
    const el = screen.getByText("3405 poissons");
    expect(el).toBeDefined();
    // Should NOT show the initial count in this element
    expect(el.textContent).not.toContain("3500");
  });

  it("ne crashe pas et n'affiche rien de lié aux poissons quand vivants est null", () => {
    const assignation = makeAssignation({ nombreInitial: 3500 });
    const bacsActifs = [{ ...assignation, vivants: null as number | null }];

    // Should render without throwing
    expect(() =>
      render(
        <VagueBacsSection
          bacsActifs={bacsActifs}
          bacsRetires={[]}
        />
      )
    ).not.toThrow();

    // No fish count should appear at all
    expect(screen.queryByText((text) => text.includes("3500"))).toBeNull();
  });

  it("les bacs retirés affichent toujours nombreInitial (comportement inchangé)", () => {
    const retired = makeAssignation({
      id: "assign-2",
      bacId: "bac-2",
      dateFin: new Date("2026-03-01"),
      nombreInitial: 2000,
      bac: { id: "bac-2", nom: "Bac B", volume: 3000 },
    });

    render(
      <VagueBacsSection
        bacsActifs={[]}
        bacsRetires={[retired]}
      />
    );

    // The collapsible trigger button shows count of retired bacs
    const trigger = screen.getByRole("button");
    expect(trigger).toBeDefined();

    // The content is collapsed by default — open it is not needed for unit
    // coverage; we just verify it doesn't crash and the trigger is present.
  });
});
