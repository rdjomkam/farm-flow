// @vitest-environment jsdom
/**
 * Tests de non-régression UI pour BUG-046.
 *
 * Vérifie que le formulaire de relevé en mode lot d'alevins :
 * - Passe isLotMode=true au ReleveFormFields pour tous les types
 * - Passe le code du lot pour la bannière
 * - Utilise la liste des bacs du site (pas filtrée par vague)
 * - Ne passe pas vagueId au formulaire
 */
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import { render, screen, cleanup } from "@testing-library/react";

import { ReleveFormClient } from "@/components/releves/releve-form-client";
import type { BacResponse } from "@/types";
import { TypeReleve, TypeSystemeBac } from "@/types";

// ---------------------------------------------------------------------------
// Mocks navigation
// ---------------------------------------------------------------------------

const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, refresh: vi.fn(), back: vi.fn() }),
  useSearchParams: () => new URLSearchParams("lotAlevinsId=lot_02&typeReleve=TRI"),
}));

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));

vi.mock("@/hooks/queries/use-bacs-queries", () => ({
  useBacsList: () => ({ data: [], isLoading: false }),
}));

// ---------------------------------------------------------------------------
// Mock useReleveForm to avoid Radix Select crash in jsdom
// ---------------------------------------------------------------------------

const mockFormState = {
  vagueId: "",
  bacId: "bac-3",
  typeReleve: TypeReleve.TRI,
  releveDate: "2026-05-03T10:00",
  notes: "",
  fields: { typeReleve: TypeReleve.TRI, description: "" },
  errors: {} as Record<string, string>,
  consommations: [],
  activiteId: "",
  activitesPlanifiees: [],
  loadingActivites: false,
  loadingBacs: false,
  bacs: [] as BacResponse[],
  produitsByCategorie: { aliment: [], intrant: [] },
  isFromActivite: false,
  isLotMode: true,
  lotAlevinsId: "lot_02",
  initialTypeReleve: TypeReleve.TRI,
  initialBacId: "bac-3",
  initialLotAlevinsId: "lot_02",
  handleVagueChange: vi.fn(),
  handleBacChange: vi.fn(),
  handleTypeReleveChange: vi.fn(),
  handleRelEveDateChange: vi.fn(),
  handleNotesChange: vi.fn(),
  handleActiviteChange: vi.fn(),
  updateField: vi.fn(),
  setConsommations: vi.fn(),
  setLotAlevinsId: vi.fn(),
  handleSubmit: vi.fn(),
  releveActiviteTypeMap: {},
};

vi.mock("@/hooks/use-releve-form", () => ({
  useReleveForm: () => mockFormState,
}));

// ---------------------------------------------------------------------------
// Mock ReleveFormFields to capture props
// ---------------------------------------------------------------------------

let capturedIsLotMode: boolean | undefined;
let capturedLotCode: string | undefined;
let capturedBacs: BacResponse[] = [];
let capturedVagueId: string | undefined;

vi.mock("@/components/releves/releve-form-fields", () => ({
  ReleveFormFields: (props: {
    isLotMode: boolean;
    lotCode?: string;
    bacs: BacResponse[];
    vagueId: string;
    onSubmit: (e: React.FormEvent) => void;
    errors: Record<string, string>;
  }) => {
    capturedIsLotMode = props.isLotMode;
    capturedLotCode = props.lotCode;
    capturedBacs = props.bacs;
    capturedVagueId = props.vagueId;
    return (
      <div data-testid="releve-form-fields">
        <span data-testid="lot-mode">{props.isLotMode ? "lot-mode" : "normal-mode"}</span>
        <span data-testid="lot-code">{props.lotCode ?? ""}</span>
        <span data-testid="vague-id">{props.vagueId ?? ""}</span>
        <button
          type="button"
          onClick={() => props.onSubmit({ preventDefault: () => {} } as React.FormEvent)}
        >
          Enregistrer le relevé
        </button>
      </div>
    );
  },
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => "fr",
}));

vi.mock("@/contexts/global-loading.context", () => ({
  useGlobalLoading: () => ({ isLoading: false, increment: vi.fn(), decrement: vi.fn() }),
  GlobalLoadingProvider: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock("@/services", () => ({
  useBacService: () => ({ list: vi.fn(), listLibres: vi.fn(), create: vi.fn(), update: vi.fn() }),
  useActiviteService: () => ({ list: vi.fn() }),
  useReleveService: () => ({ list: vi.fn(), get: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn() }),
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const fakeBacsDuSite: BacResponse[] = [
  {
    id: "bac-3",
    nom: "Bac 3",
    volume: 2000,
    nombrePoissons: 200,
    nombreInitial: 250,
    poidsMoyenInitial: null,
    typeSysteme: TypeSystemeBac.BASSIN,
    isBlocked: false,
    vagueId: null,
    siteId: "site-1",
    vagueCode: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

const fakeLotAlevins = { id: "lot_02", code: "LOT-2026-002", bacId: "bac-3" };

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

afterEach(() => {
  cleanup();
  capturedIsLotMode = undefined;
  capturedLotCode = undefined;
  capturedBacs = [];
  capturedVagueId = undefined;
});

describe("ReleveFormClient — mode lot d'alevins (BUG-046)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("passe isLotMode=true au ReleveFormFields quand lotAlevinsId est dans l'URL", () => {
    render(
      <ReleveFormClient
        vagues={[]}
        produits={[]}
        lotAlevins={fakeLotAlevins}
        bacsDuSite={fakeBacsDuSite}
      />
    );
    expect(capturedIsLotMode).toBe(true);
    expect(screen.getByTestId("lot-mode").textContent).toBe("lot-mode");
  });

  it("passe le code du lot pour la bannière", () => {
    render(
      <ReleveFormClient
        vagues={[]}
        produits={[]}
        lotAlevins={fakeLotAlevins}
        bacsDuSite={fakeBacsDuSite}
      />
    );
    expect(capturedLotCode).toBe("LOT-2026-002");
  });

  it("utilise les bacs du site (bacsDuSite) au lieu des bacs filtrés par vague", () => {
    render(
      <ReleveFormClient
        vagues={[]}
        produits={[]}
        lotAlevins={fakeLotAlevins}
        bacsDuSite={fakeBacsDuSite}
      />
    );
    expect(capturedBacs).toHaveLength(1);
    expect(capturedBacs[0].id).toBe("bac-3");
  });

  it("ne passe pas vagueId au formulaire en mode lot", () => {
    render(
      <ReleveFormClient
        vagues={[]}
        produits={[]}
        lotAlevins={fakeLotAlevins}
        bacsDuSite={fakeBacsDuSite}
      />
    );
    expect(capturedVagueId).toBe("");
  });

  it("affiche le titre du formulaire en mode lot", () => {
    render(
      <ReleveFormClient
        vagues={[]}
        produits={[]}
        lotAlevins={fakeLotAlevins}
        bacsDuSite={fakeBacsDuSite}
      />
    );
    expect(screen.getByTestId("releve-form-fields")).toBeInTheDocument();
  });
});

describe("ReleveFormClient — mode normal sans lot (non-régression BUG-046)", () => {
  beforeEach(() => {
    // Simuler le mode normal : isLotMode=false
    mockFormState.isLotMode = false;
    mockFormState.lotAlevinsId = "";
    mockFormState.initialLotAlevinsId = "";
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Restaurer le mode lot pour les autres tests
    mockFormState.isLotMode = true;
    mockFormState.lotAlevinsId = "lot_02";
    mockFormState.initialLotAlevinsId = "lot_02";
  });

  it("passe isLotMode=false sans lotAlevins prop", () => {
    render(
      <ReleveFormClient
        vagues={[{ id: "v1", code: "VAG-001" }]}
        produits={[]}
      />
    );
    expect(capturedIsLotMode).toBe(false);
    expect(screen.getByTestId("lot-mode").textContent).toBe("normal-mode");
  });

  it("ne passe pas lotCode sans lotAlevins prop", () => {
    render(
      <ReleveFormClient
        vagues={[{ id: "v1", code: "VAG-001" }]}
        produits={[]}
      />
    );
    expect(capturedLotCode).toBeUndefined();
  });

  it("utilise les bacs du hook (filtrés par vague) en mode normal", () => {
    render(
      <ReleveFormClient
        vagues={[{ id: "v1", code: "VAG-001" }]}
        produits={[]}
      />
    );
    // mockFormState.bacs est [] — les bacs du hook sont utilisés
    expect(capturedBacs).toHaveLength(0);
  });
});
