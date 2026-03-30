// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));

const mockMutateVague = vi.fn().mockResolvedValue({});
vi.mock("@/hooks/queries/use-vagues-queries", () => ({
  useCreateVague: () => ({
    mutateAsync: mockMutateVague,
    isPending: false,
  }),
  useVaguesList: () => ({ data: undefined, isLoading: false }),
}));

const vaguesTranslations: Record<string, string | ((p: Record<string, unknown>) => string)> = {
  "list.countPlural": (p) => `${p.count} vagues`,
  "list.count": (p) => `${p.count} vague`,
  "list.newButton": "Nouvelle vague",
  "list.emptyTitle": "Aucune vague",
  "list.emptyDescription": "Créez votre première vague",
  "list.tabs.enCours": (p) => `En cours (${p.count})`,
  "list.tabs.terminees": (p) => `Terminées (${p.count})`,
  "list.tabs.annulees": (p) => `Annulées (${p.count})`,
  "form.create.title": "Nouvelle vague",
  "form.create.description": "Créez une nouvelle vague de poissons",
  "form.create.submit": "Créer la vague",
  "form.cancel": "Annuler",
  "form.errors.code": "Le code est obligatoire.",
  "form.errors.dateDebut": "La date de début est obligatoire.",
  "form.errors.nombreInitial": "Le nombre initial est requis.",
  "form.errors.poidsMoyenInitial": "Le poids moyen initial est requis.",
  "form.errors.bacIds": "Sélectionnez au moins un bac.",
  "form.errors.distributionIncomplete": "Répartition incomplète.",
  "form.errors.distributionDesequilibree": (p) => `Total ${p.total} ≠ ${p.nombreInitial}`,
  "form.distribution.placeholder": "Nombre",
  "form.distribution.totalLabel": (p) => `Total: ${p.total} / ${p.nombreInitial}`,
  "form.distribution.repartirButton": "Répartir équitablement",
  "form.distribution.warningManquant": (p) => `Il manque ${p.manquant}`,
  "form.distribution.warningExcedent": (p) => `Excédent de ${p.excedent}`,
  "form.distribution.equilibre": "Répartition équilibrée",
  "form.sections.identification.title": "Identification",
  "form.sections.identification.description": "Informations de la vague",
  "form.sections.population.title": "Population initiale",
  "form.sections.population.description": "Données initiales",
  "form.sections.bacs.title": "Bacs assignés",
  "form.sections.bacs.description": "Sélectionnez les bacs",
  "form.fields.code": "Code de la vague",
  "form.fields.codePlaceholder": "Ex: VAGUE-2026-001",
  "form.fields.dateDebut": "Date de mise en eau",
  "form.fields.nombreInitial": "Nombre d'alevins",
  "form.fields.poidsMoyenInitial": "Poids moyen initial (g)",
  "form.fields.origineAlevins": "Origine des alevins",
  "form.fields.origineAlevinsFr": "Ex: Écloserie Douala",
  "form.fields.configElevage": "Configuration d'élevage",
  "form.fields.configElevagePlaceholder": "Sélectionnez une configuration",
  "form.errors.configElevageRequired": "La configuration d'élevage est obligatoire.",
  "form.fields.aucunBacLibre": "Aucun bac libre disponible.",
  "statuts.EN_COURS": "En cours",
  "statuts.TERMINEE": "Terminée",
  "statuts.ANNULEE": "Annulée",
  "card.bacs": (p) => `${p.count} bacs`,
  "card.bac": (p) => `${p.count} bac`,
  "card.alevins": (p) => `${p.count} alevins`,
  "indicateurs.tauxSurvie": "Taux de survie",
  "indicateurs.biomasse": "Biomasse",
  "indicateurs.poidsMoyen": "Poids moyen",
};

const analyticsTranslations: Record<string, string> = {
  "benchmarks.sgr.label": "SGR",
  "benchmarks.fcr.label": "FCR",
  "labels.sgrUnit": "%/j",
};

function makeTFn(namespace: string) {
  return (key: string, params?: Record<string, unknown>) => {
    const ns = namespace === "vagues" ? vaguesTranslations : analyticsTranslations;
    const val = ns[key];
    if (typeof val === "function") return val(params ?? {});
    return (val as string) ?? key;
  };
}

vi.mock("next-intl", () => ({
  useTranslations: (namespace: string) => makeTFn(namespace),
}));

vi.mock("next-intl/server", () => ({
  getTranslations: vi.fn().mockImplementation(async (namespace: string) => makeTFn(namespace)),
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
  useVagueService: () => ({
    list: mockCall,
    get: mockCall,
    create: mockCall,
    update: mockCall,
    cloture: mockCall,
    listBacs: mockCall,
  }),
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

const fakeConfigElevages = [
  { id: "config-1", nom: "Config Standard" },
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
    render(<VaguesListClient vagues={fakeVagues} bacsLibres={fakebacsLibres} permissions={allPermissions} configElevages={fakeConfigElevages} />);
    expect(screen.getByText("2 vagues")).toBeInTheDocument();
  });

  it("affiche les onglets En cours, Terminées, Annulées", () => {
    render(<VaguesListClient vagues={fakeVagues} bacsLibres={fakebacsLibres} permissions={allPermissions} configElevages={fakeConfigElevages} />);
    expect(screen.getByText("En cours (1)")).toBeInTheDocument();
    expect(screen.getByText("Terminées (1)")).toBeInTheDocument();
    expect(screen.getByText("Annulées (0)")).toBeInTheDocument();
  });

  it("affiche un message quand aucune vague", () => {
    render(<VaguesListClient vagues={[]} bacsLibres={[]} permissions={allPermissions} configElevages={fakeConfigElevages} />);
    expect(screen.getByText("0 vague")).toBeInTheDocument();
  });

  it("a un bouton 'Nouvelle vague'", () => {
    render(<VaguesListClient vagues={fakeVagues} bacsLibres={fakebacsLibres} permissions={allPermissions} configElevages={fakeConfigElevages} />);
    expect(screen.getByText("Nouvelle vague")).toBeInTheDocument();
  });
});

describe("VaguesListClient — Formulaire de création", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("ouvre le dialogue au clic sur 'Nouvelle vague'", async () => {
    render(<VaguesListClient vagues={fakeVagues} bacsLibres={fakebacsLibres} permissions={allPermissions} configElevages={fakeConfigElevages} />);
    fireEvent.click(screen.getByText("Nouvelle vague"));

    await waitFor(() => {
      expect(screen.getByText("Créer la vague")).toBeInTheDocument();
    });
  });

  it("affiche les erreurs de validation si champs vides", async () => {
    render(<VaguesListClient vagues={fakeVagues} bacsLibres={fakebacsLibres} permissions={allPermissions} configElevages={fakeConfigElevages} />);
    fireEvent.click(screen.getByText("Nouvelle vague"));

    await waitFor(() => {
      expect(screen.getByText("Créer la vague")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Créer la vague"));

    await waitFor(() => {
      expect(screen.getByText("Le code est obligatoire.")).toBeInTheDocument();
      expect(screen.getByText("La date de début est obligatoire.")).toBeInTheDocument();
      expect(screen.getByText("La configuration d'élevage est obligatoire.")).toBeInTheDocument();
      expect(screen.getByText("Sélectionnez au moins un bac.")).toBeInTheDocument();
    });
  });

  it("affiche les bacs libres disponibles dans le formulaire", async () => {
    render(<VaguesListClient vagues={fakeVagues} bacsLibres={fakebacsLibres} permissions={allPermissions} configElevages={fakeConfigElevages} />);
    fireEvent.click(screen.getByText("Nouvelle vague"));

    await waitFor(() => {
      expect(screen.getByText(/Bac 4/)).toBeInTheDocument();
      expect(screen.getByText(/1500L/)).toBeInTheDocument();
    });
  });

  it("affiche un message quand aucun bac libre", async () => {
    render(<VaguesListClient vagues={fakeVagues} bacsLibres={[]} permissions={allPermissions} configElevages={fakeConfigElevages} />);
    fireEvent.click(screen.getByText("Nouvelle vague"));

    await waitFor(() => {
      expect(screen.getByText("Aucun bac libre disponible.")).toBeInTheDocument();
    });
  });

  it("soumet le formulaire avec des données valides", async () => {
    render(<VaguesListClient vagues={fakeVagues} bacsLibres={fakebacsLibres} permissions={allPermissions} configElevages={fakeConfigElevages} />);
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

    // Select config elevage — Radix Select uses pointer events not supported in JSDOM.
    // We interact with the hidden native <select> that Radix renders for accessibility.
    const nativeSelect = document.querySelector("select[aria-hidden]") as HTMLSelectElement | null;
    if (nativeSelect) {
      fireEvent.change(nativeSelect, { target: { value: "config-1" } });
    }

    // Select bac
    const bacCheckbox = screen.getByRole("checkbox");
    fireEvent.click(bacCheckbox);

    // Fill in the distribution input (how many fish go in this bac)
    const distributionInput = screen.getByPlaceholderText("Nombre");
    fireEvent.change(distributionInput, { target: { value: "1000" } });

    fireEvent.click(screen.getByText("Créer la vague"));

    await waitFor(() => {
      expect(mockMutateVague).toHaveBeenCalled();
    });
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
    expect(screen.getByText("92.5 %")).toBeInTheDocument();
    expect(screen.getByText("Taux de survie")).toBeInTheDocument();
  });

  it("affiche la biomasse", () => {
    render(<IndicateursCards indicateurs={indicateurs} />);
    expect(screen.getByText("45.60 kg")).toBeInTheDocument();
  });

  it("affiche le poids moyen", () => {
    render(<IndicateursCards indicateurs={indicateurs} />);
    expect(screen.getByText("98.5 g")).toBeInTheDocument();
  });

  it("affiche le SGR et FCR", () => {
    render(<IndicateursCards indicateurs={indicateurs} />);
    expect(screen.getByText("2.10%/j")).toBeInTheDocument();
    expect(screen.getByText("1.30")).toBeInTheDocument();
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
