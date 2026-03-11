// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ReleveFormClient } from "@/components/releves/releve-form-client";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockRefresh = vi.fn();
const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mockRefresh, push: mockPush }),
  useSearchParams: () => new URLSearchParams(),
}));

const mockToast = vi.fn();
vi.mock("@/components/ui/toast", () => ({
  useToast: () => ({ toast: mockToast }),
}));

const fakeVagues = [
  { id: "vague-1", code: "VAGUE-2026-001" },
  { id: "vague-2", code: "VAGUE-2026-002" },
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ReleveFormClient — Affichage initial", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  it("affiche le titre du formulaire", () => {
    render(<ReleveFormClient vagues={fakeVagues} produits={[]} />);
    expect(screen.getByText("Saisir un releve")).toBeInTheDocument();
  });

  it("affiche le bouton de soumission", () => {
    render(<ReleveFormClient vagues={fakeVagues} produits={[]} />);
    expect(screen.getByText("Enregistrer le relevé")).toBeInTheDocument();
  });

  it("affiche le champ Notes optionnel", () => {
    render(<ReleveFormClient vagues={fakeVagues} produits={[]} />);
    expect(screen.getByLabelText("Notes (optionnel)")).toBeInTheDocument();
  });
});

describe("ReleveFormClient — Validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  it("affiche les erreurs quand soumission sans sélection", async () => {
    render(<ReleveFormClient vagues={fakeVagues} produits={[]} />);

    fireEvent.click(screen.getByText("Enregistrer le relevé"));

    await waitFor(() => {
      expect(screen.getByText("Sélectionnez une vague.")).toBeInTheDocument();
      expect(screen.getByText("Sélectionnez un bac.")).toBeInTheDocument();
      expect(screen.getByText("Sélectionnez un type de relevé.")).toBeInTheDocument();
    });
  });

  it("ne soumet pas le formulaire si validation échoue", async () => {
    render(<ReleveFormClient vagues={fakeVagues} produits={[]} />);
    fireEvent.click(screen.getByText("Enregistrer le relevé"));

    await waitFor(() => {
      expect(global.fetch).not.toHaveBeenCalled();
    });
  });
});
