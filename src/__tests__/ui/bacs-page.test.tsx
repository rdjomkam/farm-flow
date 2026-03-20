// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { BacsListClient } from "@/components/bacs/bacs-list-client";
import { Permission } from "@/types";
import type { BacResponse } from "@/types";

const allPermissions = Object.values(Permission);

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockRefresh = vi.fn();
const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mockRefresh, push: mockPush }),
  usePathname: () => "/bacs",
}));

const mockToast = vi.fn();
vi.mock("@/components/ui/toast", () => ({
  useToast: () => ({ toast: mockToast }),
}));

const mockCall = vi.fn().mockResolvedValue({ data: null, error: null, ok: true });
vi.mock("@/contexts/global-loading.context", () => ({
  useGlobalLoading: () => ({ isLoading: false, increment: vi.fn(), decrement: vi.fn() }),
  GlobalLoadingProvider: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock("@/services", () => ({
  useBacService: () => ({
    list: mockCall,
    listByVague: mockCall,
    create: mockCall,
    update: mockCall,
  }),
}));

const fakeBacs: BacResponse[] = [
  {
    id: "bac-1",
    nom: "Bac 1",
    volume: 1000,
    nombrePoissons: null,
    vagueId: null,
    vagueCode: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: "bac-2",
    nom: "Bac 2",
    volume: 2000,
    nombrePoissons: 500,
    vagueId: "vague-1",
    vagueCode: "VAGUE-2026-001",
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("BacsListClient — Affichage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("affiche le nombre total de bacs", () => {
    render(<BacsListClient bacs={fakeBacs} permissions={allPermissions} />);
    expect(screen.getByText("2 bacs")).toBeInTheDocument();
  });

  it("affiche le nom et volume de chaque bac", () => {
    render(<BacsListClient bacs={fakeBacs} permissions={allPermissions} />);
    expect(screen.getByText("Bac 1")).toBeInTheDocument();
    expect(screen.getByText("1000 L")).toBeInTheDocument();
    expect(screen.getByText("Bac 2")).toBeInTheDocument();
    expect(screen.getByText("2000 L")).toBeInTheDocument();
  });

  it("affiche 'Libre' pour un bac sans vague", () => {
    render(<BacsListClient bacs={fakeBacs} permissions={allPermissions} />);
    expect(screen.getByText("Libre")).toBeInTheDocument();
  });

  it("affiche le code vague pour un bac occupé", () => {
    render(<BacsListClient bacs={fakeBacs} permissions={allPermissions} />);
    expect(screen.getByText("VAGUE-2026-001")).toBeInTheDocument();
  });

  it("affiche un message quand aucun bac", () => {
    render(<BacsListClient bacs={[]} permissions={allPermissions} />);
    expect(screen.getByText("Aucun bac")).toBeInTheDocument();
  });

  it("a un bouton 'Nouveau bac'", () => {
    render(<BacsListClient bacs={fakeBacs} permissions={allPermissions} />);
    expect(screen.getByText("Nouveau bac")).toBeInTheDocument();
  });
});

describe("BacsListClient — Formulaire de création", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("ouvre le dialogue de création au clic sur 'Nouveau bac'", async () => {
    render(<BacsListClient bacs={fakeBacs} permissions={allPermissions} />);
    fireEvent.click(screen.getByText("Nouveau bac"));

    await waitFor(() => {
      expect(screen.getByText("Créer le bac")).toBeInTheDocument();
    });
  });

  it("affiche une erreur si le nom est vide à la soumission", async () => {
    render(<BacsListClient bacs={fakeBacs} permissions={allPermissions} />);
    fireEvent.click(screen.getByText("Nouveau bac"));

    await waitFor(() => {
      expect(screen.getByText("Créer le bac")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Créer le bac"));

    await waitFor(() => {
      expect(screen.getByText("Le nom est obligatoire.")).toBeInTheDocument();
    });
  });

  it("affiche une erreur si le volume est 0", async () => {
    render(<BacsListClient bacs={fakeBacs} permissions={allPermissions} />);
    fireEvent.click(screen.getByText("Nouveau bac"));

    await waitFor(() => {
      expect(screen.getByText("Créer le bac")).toBeInTheDocument();
    });

    const nomInput = screen.getByLabelText("Nom du bac");
    fireEvent.change(nomInput, { target: { value: "Bac Test" } });

    fireEvent.click(screen.getByText("Créer le bac"));

    await waitFor(() => {
      expect(
        screen.getByText("Le volume doit être supérieur à 0.")
      ).toBeInTheDocument();
    });
  });

  it("soumet le formulaire avec des données valides", async () => {
    render(<BacsListClient bacs={fakeBacs} permissions={allPermissions} />);
    fireEvent.click(screen.getByText("Nouveau bac"));

    await waitFor(() => {
      expect(screen.getByText("Créer le bac")).toBeInTheDocument();
    });

    const nomInput = screen.getByLabelText("Nom du bac");
    const volumeInput = screen.getByLabelText("Volume (litres)");

    fireEvent.change(nomInput, { target: { value: "Bac Test" } });
    fireEvent.change(volumeInput, { target: { value: "1500" } });

    fireEvent.click(screen.getByText("Créer le bac"));

    await waitFor(() => {
      expect(mockCall).toHaveBeenCalled();
    });
  });
});
