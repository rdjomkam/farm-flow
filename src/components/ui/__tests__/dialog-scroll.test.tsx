// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

// ---------------------------------------------------------------------------
// BUG-042 — Dialog mobile scroll + sticky footer regression tests
// ---------------------------------------------------------------------------

describe("BUG-042 — DialogContent scroll par défaut sur mobile", () => {
  it("DialogContent inner container active overflow-y-auto par défaut", () => {
    render(
      <Dialog open>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Test dialog</DialogTitle>
          </DialogHeader>
          <div>contenu long</div>
          <DialogFooter>
            <button type="button">Annuler</button>
            <button type="button">OK</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );

    const dialog = screen.getByRole("dialog");
    // L'élément racine (DialogPrimitive.Content) ou son enfant flex-col doit
    // porter overflow-y-auto. Le conteneur interne est le premier enfant div.
    const innerContainer = dialog.querySelector(
      "div.flex.flex-col"
    ) as HTMLElement | null;

    expect(innerContainer).not.toBeNull();
    const cls = innerContainer!.className;
    expect(cls).toContain("overflow-y-auto");
    // Mobile doit contenir le token de hauteur dynamique viewport
    expect(cls).toContain("100dvh");
    expect(cls).toContain("max-h-[100dvh]");
  });

  it("DialogFooter est sticky avec safe-area bottom", () => {
    const { container } = render(
      <DialogFooter data-testid="footer">
        <button type="button">OK</button>
      </DialogFooter>
    );

    const footer = container.firstElementChild as HTMLElement;
    expect(footer).not.toBeNull();
    const cls = footer.className;
    expect(cls).toContain("sticky");
    expect(cls).toContain("bottom-0");
    // Préserve la safe-area iOS (home indicator)
    expect(cls).toContain("pb-[max(1rem,env(safe-area-inset-bottom))]");
    // Fond cohérent avec la carte (R6 — variable CSS du thème)
    expect(cls).toContain("bg-card");
  });
});
