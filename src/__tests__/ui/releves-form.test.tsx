// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";

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

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));

vi.mock("@/hooks/queries/use-bacs-queries", () => ({
  useBacsList: () => ({ data: [], isLoading: false }),
}));

const relevesTranslations: Record<string, string> = {
  "form.title": "Saisir un releve",
  "form.fields.submit": "Enregistrer le relevé",
  "form.fields.notes": "Notes (optionnel)",
  "form.fields.notesPlaceholder": "Observations, remarques...",
  "form.errors.vagueId": "Sélectionnez une vague.",
  "form.errors.bacId": "Sélectionnez un bac.",
  "form.errors.typeReleve": "Sélectionnez un type de relevé.",
  "form.errors.poidsMoyen": "Le poids moyen est requis.",
  "form.errors.tailleMoyenne": "La taille moyenne est requise.",
  "form.errors.echantillonCount": "Le nombre d'échantillons est requis.",
  "form.errors.nombreMorts": "Le nombre de morts est requis.",
  "form.errors.causeMortalite": "La cause de mortalité est requise.",
  "form.errors.quantiteAliment": "La quantité d'aliment est requise.",
  "form.errors.typeAliment": "Le type d'aliment est requis.",
  "form.errors.frequenceAliment": "La fréquence d'alimentation est requise.",
  "form.errors.nombreCompte": "Le nombre compté est requis.",
  "form.errors.methodeComptage": "La méthode de comptage est requise.",
  "form.errors.description": "La description est requise.",
  "form.errors.renouvellementRequis": "Le pourcentage de renouvellement est requis.",
  "form.errors.pourcentageRange": "Le pourcentage doit être entre 1 et 100.",
  "form.errors.volumePositif": "Le volume renouvellement doit être positif.",
  "form.activiteNotice.title": "Activité planifiée",
  "form.activiteNotice.description": "Ce relevé est lié à une activité planifiée.",
  "form.sections.identification.title": "Identification",
  "form.sections.identification.description": "Vague et bac concernés",
  "form.sections.date.title": "Date et heure",
  "form.sections.date.description": "Date du relevé",
  "form.sections.type.title": "Type de relevé",
  "form.sections.type.description": "Sélectionnez le type",
  "form.sections.biometrie.title": "Biométrie",
  "form.sections.biometrie.description": "Mesures des poissons",
  "form.sections.mortalite.title": "Mortalité",
  "form.sections.mortalite.description": "Mortalités constatées",
  "form.sections.alimentation.title": "Alimentation",
  "form.sections.alimentation.description": "Ration alimentaire",
  "form.sections.qualiteEau.title": "Qualité de l'eau",
  "form.sections.qualiteEau.description": "Paramètres physico-chimiques",
  "form.sections.comptage.title": "Comptage",
  "form.sections.comptage.description": "Dénombrement des poissons",
  "form.sections.observation.title": "Observation",
  "form.sections.observation.description": "Observations générales",
  "form.sections.consommationStock.title": "Consommation de stock",
  "form.sections.consommationStock.descriptionIntrant": "Intrants utilisés",
  "form.sections.consommationStock.descriptionAliment": "Aliments utilisés",
};

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => relevesTranslations[key] ?? key,
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
  useBacService: () => ({ list: mockCall, listByVague: mockCall, create: mockCall, update: mockCall }),
  useActiviteService: () => ({ list: mockCall, create: mockCall, complete: mockCall }),
  useReleveService: () => ({ list: mockCall, get: mockCall, create: mockCall, update: mockCall, remove: mockCall }),
}));

// ---------------------------------------------------------------------------
// Mock useReleveForm + ReleveFormFields to prevent Radix Select from being
// imported (its internals keep the jsdom forks worker alive indefinitely).
// ---------------------------------------------------------------------------
const mockHandleSubmit = vi.fn();
const mockFormState = {
  vagueId: "",
  bacId: "",
  typeReleve: "",
  releveDate: new Date().toISOString().slice(0, 16),
  notes: "",
  fields: { typeReleve: "" },
  errors: {} as Record<string, string>,
  consommations: [],
  activiteId: "",
  activitesPlanifiees: [],
  loadingActivites: false,
  loadingBacs: false,
  bacs: [],
  isFromActivite: false,
  initialTypeReleve: null,
  initialBacId: null,
  releveActiviteTypeMap: {},
  handleVagueChange: vi.fn(),
  handleBacChange: vi.fn(),
  handleTypeReleveChange: vi.fn(),
  handleRelEveDateChange: vi.fn(),
  handleNotesChange: vi.fn(),
  handleActiviteChange: vi.fn(),
  updateField: vi.fn(),
  setConsommations: vi.fn(),
  handleSubmit: mockHandleSubmit,
};

vi.mock("@/hooks/use-releve-form", () => ({
  useReleveForm: () => mockFormState,
}));

vi.mock("@/components/releves/releve-form-fields", () => ({
  ReleveFormFields: (props: Record<string, unknown>) => {
    const errors = props.errors as Record<string, string> | undefined;
    return (
      <div data-testid="releve-form-fields">
        {errors && Object.entries(errors).map(([k, v]) => (
          v ? <p key={k} data-field={k}>{v}</p> : null
        ))}
        <label htmlFor="notes-field">Notes (optionnel)</label>
        <textarea id="notes-field" placeholder="Observations, remarques..." />
        <button type="button" onClick={props.onSubmit as () => void}>Enregistrer le relevé</button>
      </div>
    );
  },
}));

const fakeVagues = [
  { id: "vague-1", code: "VAGUE-2026-001" },
  { id: "vague-2", code: "VAGUE-2026-002" },
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

afterEach(() => {
  cleanup();
});

describe("ReleveFormClient — Affichage initial", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
  });

  it("affiche les erreurs quand le formulaire a des erreurs", () => {
    // Simulate errors being present in form state
    mockFormState.errors = {
      vagueId: "Sélectionnez une vague.",
      bacId: "Sélectionnez un bac.",
      typeReleve: "Sélectionnez un type de relevé.",
    };

    render(<ReleveFormClient vagues={fakeVagues} produits={[]} />);

    expect(screen.getByText("Sélectionnez une vague.")).toBeInTheDocument();
    expect(screen.getByText("Sélectionnez un bac.")).toBeInTheDocument();
    expect(screen.getByText("Sélectionnez un type de relevé.")).toBeInTheDocument();

    // Reset for other tests
    mockFormState.errors = {};
  });

  it("appelle handleSubmit au clic sur le bouton", () => {
    render(<ReleveFormClient vagues={fakeVagues} produits={[]} />);
    fireEvent.click(screen.getByText("Enregistrer le relevé"));

    expect(mockHandleSubmit).toHaveBeenCalledTimes(1);
  });
});
