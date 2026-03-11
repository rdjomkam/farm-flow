// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { VaguesListClient } from "@/components/vagues/vagues-list-client";
import { VagueCard } from "@/components/vagues/vague-card";
import { IndicateursCards } from "@/components/vagues/indicateurs-cards";
import { StatutVague, Permission } from "@/types";
import type { VagueSummaryResponse, BacResponse, IndicateursVague } from "@/types";

const allPermissions = Object.values(Permission);

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockRefresh = vi.fn();
const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mockRefresh, push: mockPush }),
  usePathname: () => "/vagues",
}));

const mockToast = vi.fn();
vi.mock("@/components/ui/toast", () => ({
  useToast: () => ({ toast: mockToast }),
}));

const now = new Date("2026-03-08T10:00:00Z");
const pastDate = new Date("2026-01-15T00:00:00Z");

const fakeVagues: VagueSummaryResponse[] = [
  {
    id: "vague-1",
    code: "VAGUE-2026-001",
    dateDebut: pastDate,
    dateFin: null,
    statut: StatutVague.EN_COURS,
    nombreInitial: 500,
    poidsMoyenInitial: 5.0,
    origineAlevins: "Ecloserie Douala",
    nombreBacs: 3,
    joursEcoules: 52,
    createdAt: pastDate,
  },
  {
    id: "vague-2",
    code: "VAGUE-2026-002",
    dateDebut: pastDate,
    dateFin: now,
    statut: StatutVague.TERMINEE,
    nombreInitial: 300,
    poidsMoyenInitial: 3.0,
    origineAlevins: null,
    nombreBacs: 1,
    joursEcoules: 52,
    createdAt: pastDate,
  },
];

const fakebacsLibres: BacResponse[] = [
  {
    id: "bac-libre-1",
    nom: "Bac 4",
    volume: 1500,
    nombrePoissons: null,
    vagueId: null,
    vagueCode: null,
    createdAt: now,
    updatedAt: now,
  },
];

// ---------------------------------------------------------------------------
// VaguesListClient
// ---------------------------------------------------------------------------

describe("VaguesListClient — Affichage et filtres", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("affiche le nombre total de vagues", () => {
    render(<VaguesListClient vagues={fakeVagues} bacsLibres={fakebacsLibres} permissions={allPermissions} />);
    expect(screen.getByText("2 vagues")).toBeInTheDocument();
  });

  it("affiche les onglets En cours, Terminées, Annulées", () => {
    render(<VaguesListClient vagues={fakeVagues} bacsLibres={fakebacsLibres} permissions={allPermissions} />);
    expect(screen.getByText("En cours (1)")).toBeInTheDocument();
    expect(screen.getByText("Terminées (1)")).toBeInTheDocument();
    expect(screen.getByText("Annulées (0)")).toBeInTheDocument();
  });

  it("affiche un message quand aucune vague", () => {
    render(<VaguesListClient vagues={[]} bacsLibres={[]} permissions={allPermissions} />);
    expect(screen.getByText("0 vague")).toBeInTheDocument();
  });

  it("a un bouton 'Nouvelle vague'", () => {
    render(<VaguesListClient vagues={fakeVagues} bacsLibres={fakebacsLibres} permissions={allPermissions} />);
    expect(screen.getByText("Nouvelle vague")).toBeInTheDocument();
  });
});

describe("VaguesListClient — Formulaire de création", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  it("ouvre le dialogue au clic sur 'Nouvelle vague'", async () => {
    render(<VaguesListClient vagues={fakeVagues} bacsLibres={fakebacsLibres} permissions={allPermissions} />);
    fireEvent.click(screen.getByText("Nouvelle vague"));

    await waitFor(() => {
      expect(screen.getByText("Créer la vague")).toBeInTheDocument();
    });
  });

  it("affiche les erreurs de validation si champs vides", async () => {
    render(<VaguesListClient vagues={fakeVagues} bacsLibres={fakebacsLibres} permissions={allPermissions} />);
    fireEvent.click(screen.getByText("Nouvelle vague"));

    await waitFor(() => {
      expect(screen.getByText("Créer la vague")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Créer la vague"));

    await waitFor(() => {
      expect(screen.getByText("Le code est obligatoire.")).toBeInTheDocument();
      expect(screen.getByText("La date de début est obligatoire.")).toBeInTheDocument();
      expect(screen.getByText("Sélectionnez au moins un bac.")).toBeInTheDocument();
    });
  });

  it("affiche les bacs libres disponibles dans le formulaire", async () => {
    render(<VaguesListClient vagues={fakeVagues} bacsLibres={fakebacsLibres} permissions={allPermissions} />);
    fireEvent.click(screen.getByText("Nouvelle vague"));

    await waitFor(() => {
      expect(screen.getByText(/Bac 4/)).toBeInTheDocument();
      expect(screen.getByText(/1500L/)).toBeInTheDocument();
    });
  });

  it("affiche un message quand aucun bac libre", async () => {
    render(<VaguesListClient vagues={fakeVagues} bacsLibres={[]} permissions={allPermissions} />);
    fireEvent.click(screen.getByText("Nouvelle vague"));

    await waitFor(() => {
      expect(screen.getByText("Aucun bac libre disponible.")).toBeInTheDocument();
    });
  });

  it("soumet le formulaire avec des données valides", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: "vague-new", code: "VAGUE-2026-003" }),
    });

    render(<VaguesListClient vagues={fakeVagues} bacsLibres={fakebacsLibres} permissions={allPermissions} />);
    fireEvent.click(screen.getByText("Nouvelle vague"));

    await waitFor(() => {
      expect(screen.getByText("Créer la vague")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText("Code de la vague"), {
      target: { value: "VAGUE-2026-003" },
    });
    fireEvent.change(screen.getByLabelText("Date de mise en eau"), {
      target: { value: "2026-03-01" },
    });
    fireEvent.change(screen.getByLabelText("Nombre d'alevins"), {
      target: { value: "1000" },
    });
    fireEvent.change(screen.getByLabelText("Poids moyen initial (g)"), {
      target: { value: "5" },
    });

    // Select bac
    const bacCheckbox = screen.getByRole("checkbox");
    fireEvent.click(bacCheckbox);

    fireEvent.click(screen.getByText("Créer la vague"));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith("/api/vagues", expect.objectContaining({
        method: "POST",
      }));
    });

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: "success" })
    );
  });
});

// ---------------------------------------------------------------------------
// VagueCard
// ---------------------------------------------------------------------------

describe("VagueCard — Rendu", () => {
  it("affiche le code et statut de la vague", () => {
    render(<VagueCard vague={fakeVagues[0]} />);
    expect(screen.getByText("VAGUE-2026-001")).toBeInTheDocument();
    expect(screen.getByText("En cours")).toBeInTheDocument();
  });

  it("affiche le nombre de bacs et alevins", () => {
    render(<VagueCard vague={fakeVagues[0]} />);
    expect(screen.getByText("3 bacs")).toBeInTheDocument();
    expect(screen.getByText("500 alevins")).toBeInTheDocument();
  });

  it("affiche les jours écoulés", () => {
    render(<VagueCard vague={fakeVagues[0]} />);
    expect(screen.getByText("J52")).toBeInTheDocument();
  });

  it("est un lien vers la page de détail", () => {
    render(<VagueCard vague={fakeVagues[0]} />);
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/vagues/vague-1");
  });
});

// ---------------------------------------------------------------------------
// IndicateursCards
// ---------------------------------------------------------------------------

describe("IndicateursCards — Rendu des indicateurs", () => {
  const indicateurs: IndicateursVague = {
    tauxSurvie: 92.5,
    fcr: 1.3,
    sgr: 2.1,
    biomasse: 45.6,
    poidsMoyen: 98.5,
    tailleMoyenne: 22.3,
    nombreVivants: 463,
    totalMortalites: 37,
    totalAliment: 28.5,
    gainPoids: 93.5,
    joursEcoules: 45,
  };

  it("affiche le taux de survie", () => {
    render(<IndicateursCards indicateurs={indicateurs} />);
    expect(screen.getByText("92.5%")).toBeInTheDocument();
    expect(screen.getByText("Taux de survie")).toBeInTheDocument();
  });

  it("affiche la biomasse", () => {
    render(<IndicateursCards indicateurs={indicateurs} />);
    expect(screen.getByText("45.6 kg")).toBeInTheDocument();
  });

  it("affiche le poids moyen", () => {
    render(<IndicateursCards indicateurs={indicateurs} />);
    expect(screen.getByText("98.5 g")).toBeInTheDocument();
  });

  it("affiche le SGR et FCR", () => {
    render(<IndicateursCards indicateurs={indicateurs} />);
    expect(screen.getByText("2.1%/j")).toBeInTheDocument();
    expect(screen.getByText("1.3")).toBeInTheDocument();
  });

  it("affiche '—' quand les indicateurs sont null", () => {
    const emptyIndicateurs: IndicateursVague = {
      tauxSurvie: null,
      fcr: null,
      sgr: null,
      biomasse: null,
      poidsMoyen: null,
      tailleMoyenne: null,
      nombreVivants: null,
      totalMortalites: 0,
      totalAliment: 0,
      gainPoids: null,
      joursEcoules: 0,
    };
    render(<IndicateursCards indicateurs={emptyIndicateurs} />);
    const dashes = screen.getAllByText("—");
    expect(dashes.length).toBe(5);
  });
});
