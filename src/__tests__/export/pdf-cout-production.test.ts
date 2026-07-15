/**
 * Tests unitaires — renderCoutProductionPDF
 *
 * Cas couverts :
 * 1. Renders without error — full mock DTO → returns a Buffer
 * 2. Handles null values gracefully — coutParKg/prixMoyenVenteKg/margeParKg/roi null
 * 3. Handles empty arrays — detailAliments/depensesDirectes/depensesMultiVagues/depensesRecurrentes/ventes vides
 * 4. Handles MULTI_VAGUE category — coutParCategorie avec categorie "MULTI_VAGUE" (ERR-098)
 * 5. Handles zero coutTotal — tout à zéro, pas de throw
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { StatutVague, CategorieDepense } from "@/types";
import type { CreateCoutProductionPDFDTO } from "@/types/export";
import type { CoutProductionVague } from "@/lib/queries/finances";

// ---------------------------------------------------------------------------
// Mock @react-pdf/renderer
// ---------------------------------------------------------------------------
// renderToBuffer is the only side-effecting function we care about.
// We stub it to return a fake Buffer so tests can run without native PDF binaries.

const mockRenderToBuffer = vi.fn().mockResolvedValue(Buffer.from("fake-pdf"));

vi.mock("@react-pdf/renderer", () => ({
  Document: ({ children }: { children: unknown }) => children,
  Page: ({ children }: { children: unknown }) => children,
  Text: ({ children }: { children: unknown }) => children,
  View: ({ children }: { children: unknown }) => children,
  StyleSheet: {
    create: (styles: Record<string, unknown>) => styles,
  },
  renderToBuffer: (...args: unknown[]) => mockRenderToBuffer(...args),
}));

// Also mock @/lib/format (used by the template for formatNumber)
vi.mock("@/lib/format", () => ({
  formatNumber: (n: number) => n.toLocaleString("fr-FR"),
}));

// ---------------------------------------------------------------------------
// Import AFTER mocks are registered
// ---------------------------------------------------------------------------
// Dynamic import needed because Vitest hoists vi.mock() calls, but we still
// need to import the module under test after the mock setup.
const { renderCoutProductionPDF } = await import(
  "@/lib/export/pdf-cout-production"
);

// ---------------------------------------------------------------------------
// Helpers — mock DTO builders
// ---------------------------------------------------------------------------

/** Builds a full CoutProductionVague with all sections populated */
function buildFullCoutProduction(
  overrides: Partial<CoutProductionVague["resume"]> = {}
): CoutProductionVague {
  return {
    vague: {
      id: "vague-001",
      code: "V-2026-001",
      statut: StatutVague.EN_COURS,
      dateDebut: new Date("2026-01-01"),
      dateFin: new Date("2026-03-01"),
      nombreInitial: 1000,
      dureeJours: 59,
    },
    resume: {
      coutTotal: 150000,
      poidsTotalVendu: 250,
      nombrePoissonsVendus: 500,
      biomasseKg: 100,
      biomasseTransferee: null,
      nombrePoissonsTransferes: 0,
      biomasseProduite: 350,
      coutParKg: 600,
      prixMoyenVenteKg: 2500,
      margeParKg: 1900,
      revenusBruts: 625000,
      depensesVentes: 0,
      revenus: 625000,
      marge: 475000,
      roi: 316.67,
      ...overrides,
    },
    coutParCategorie: [
      {
        categorie: CategorieDepense.ALIMENT,
        montant: 120000,
        pourcentage: 80,
        parKg: 480,
      },
      {
        categorie: CategorieDepense.VETERINAIRE,
        montant: 30000,
        pourcentage: 20,
        parKg: 120,
      },
    ],
    detailAliments: [
      {
        produit: "Granulé flottant 3mm",
        quantite: 200,
        prixUnitaire: 600,
        total: 120000,
        contenanceSac: 15,
        nombreSacs: 13.3,
      },
    ],
    depensesDirectes: [
      {
        date: new Date("2026-01-15"),
        categorie: CategorieDepense.VETERINAIRE,
        description: "Traitement antibiotique",
        montant: 30000,
      },
    ],
    depensesMultiVagues: [
      {
        description: "Achat commun matériel",
        montantTotal: 50000,
        ratio: 0.4,
        montantImpute: 20000,
      },
    ],
    depensesRecurrentes: [
      {
        description: "Électricité",
        categorie: CategorieDepense.ELECTRICITE,
        montantPayeTotal: 50000,
        moisCouverts: 2,
        ratioMoyen: 0.5,
        montantImpute: 25000,
        ratioDetail: [],
      },
    ],
    ventes: [
      {
        date: new Date("2026-02-28"),
        client: "Client Alpha",
        poidsKg: 250,
        prixKg: 2500,
        montant: 625000,
      },
    ],
    depensesVentes: [],
    formule: {
      coutAliments: 120000,
      coutDepensesDirectes: 30000,
      coutMultiVagues: 20000,
      coutRecurrents: 25000,
      coutTotal: 195000,
      poidsVendu: 250,
      biomasseKg: 100,
      coutParKg: 780,
    },
  };
}

function buildDTO(
  coutProductionOverride?: Partial<CoutProductionVague>
): CreateCoutProductionPDFDTO {
  const base = buildFullCoutProduction();
  return {
    site: { name: "Ferme DKFarm", address: "Douala, Cameroun" },
    dateGeneration: "2026-05-11",
    coutProduction: { ...base, ...coutProductionOverride },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("renderCoutProductionPDF", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRenderToBuffer.mockResolvedValue(Buffer.from("fake-pdf"));
  });

  // -----------------------------------------------------------------------
  // 1. Renders without error — full DTO
  // -----------------------------------------------------------------------

  it("returns a Buffer when called with a full DTO", async () => {
    const dto = buildDTO();
    const result = await renderCoutProductionPDF(dto);

    expect(result).toBeInstanceOf(Buffer);
    expect(mockRenderToBuffer).toHaveBeenCalledOnce();
  });

  it("calls renderToBuffer with a React element (truthy argument)", async () => {
    const dto = buildDTO();
    await renderCoutProductionPDF(dto);

    const [arg] = mockRenderToBuffer.mock.calls[0];
    // renderToBuffer receives the JSX element — must be a non-null object
    expect(arg).toBeTruthy();
    expect(typeof arg).toBe("object");
  });

  // -----------------------------------------------------------------------
  // 2. Handles null values gracefully
  // -----------------------------------------------------------------------

  it("does not throw when coutParKg, prixMoyenVenteKg, margeParKg, roi are null", async () => {
    const dto = buildDTO({
      resume: {
        coutTotal: 150000,
        poidsTotalVendu: 0,
        nombrePoissonsVendus: 0,
        biomasseKg: null,
        biomasseTransferee: null,
        nombrePoissonsTransferes: 0,
        biomasseProduite: null,
        coutParKg: null,
        prixMoyenVenteKg: null,
        margeParKg: null,
        revenusBruts: 0,
        depensesVentes: 0,
        revenus: 0,
        marge: -150000,
        roi: null,
      },
    });

    await expect(renderCoutProductionPDF(dto)).resolves.not.toThrow();
  });

  it("does not throw when formule.coutParKg is null", async () => {
    const dto = buildDTO({
      formule: {
        coutAliments: 10000,
        coutDepensesDirectes: 0,
        coutMultiVagues: 0,
        coutRecurrents: 0,
        coutTotal: 10000,
        poidsVendu: 0,
        biomasseKg: null,
        coutParKg: null,
      },
    });

    await expect(renderCoutProductionPDF(dto)).resolves.not.toThrow();
  });

  it("does not throw when site.address is null", async () => {
    const dto: CreateCoutProductionPDFDTO = {
      site: { name: "Ferme sans adresse", address: null },
      dateGeneration: "2026-05-11",
      coutProduction: buildFullCoutProduction(),
    };

    await expect(renderCoutProductionPDF(dto)).resolves.not.toThrow();
  });

  it("does not throw when vague.dateFin is null (vague EN_COURS)", async () => {
    const dto = buildDTO({
      vague: {
        id: "vague-001",
        code: "V-2026-002",
        statut: StatutVague.EN_COURS,
        dateDebut: new Date("2026-01-01"),
        dateFin: null,
        nombreInitial: 500,
        dureeJours: 130,
      },
    });

    await expect(renderCoutProductionPDF(dto)).resolves.not.toThrow();
  });

  // -----------------------------------------------------------------------
  // 3. Handles empty arrays
  // -----------------------------------------------------------------------

  it("does not throw when all detail arrays are empty", async () => {
    const dto = buildDTO({
      coutParCategorie: [],
      detailAliments: [],
      depensesDirectes: [],
      depensesMultiVagues: [],
      depensesRecurrentes: [],
      ventes: [],
    });

    await expect(renderCoutProductionPDF(dto)).resolves.not.toThrow();
  });

  it("does not throw when only detailAliments is empty", async () => {
    const dto = buildDTO({ detailAliments: [] });
    await expect(renderCoutProductionPDF(dto)).resolves.not.toThrow();
  });

  it("does not throw when only depensesDirectes is empty", async () => {
    const dto = buildDTO({ depensesDirectes: [] });
    await expect(renderCoutProductionPDF(dto)).resolves.not.toThrow();
  });

  it("does not throw when only depensesMultiVagues is empty", async () => {
    const dto = buildDTO({ depensesMultiVagues: [] });
    await expect(renderCoutProductionPDF(dto)).resolves.not.toThrow();
  });

  it("does not throw when only depensesRecurrentes is empty", async () => {
    const dto = buildDTO({ depensesRecurrentes: [] });
    await expect(renderCoutProductionPDF(dto)).resolves.not.toThrow();
  });

  it("does not throw when only ventes is empty", async () => {
    const dto = buildDTO({ ventes: [] });
    await expect(renderCoutProductionPDF(dto)).resolves.not.toThrow();
  });

  // -----------------------------------------------------------------------
  // 4. Handles MULTI_VAGUE category (ERR-098)
  // -----------------------------------------------------------------------

  it("does not throw when coutParCategorie contains a MULTI_VAGUE entry", async () => {
    const dto = buildDTO({
      coutParCategorie: [
        {
          categorie: "MULTI_VAGUE",
          montant: 20000,
          pourcentage: 13.33,
          parKg: 80,
        },
        {
          categorie: CategorieDepense.ALIMENT,
          montant: 120000,
          pourcentage: 80,
          parKg: 480,
        },
        {
          categorie: CategorieDepense.ELECTRICITE,
          montant: 10000,
          pourcentage: 6.67,
          parKg: 40,
        },
      ],
    });

    await expect(renderCoutProductionPDF(dto)).resolves.not.toThrow();
  });

  it("does not throw when coutParCategorie contains ONLY a MULTI_VAGUE entry", async () => {
    const dto = buildDTO({
      coutParCategorie: [
        {
          categorie: "MULTI_VAGUE",
          montant: 50000,
          pourcentage: 100,
          parKg: null,
        },
      ],
    });

    await expect(renderCoutProductionPDF(dto)).resolves.not.toThrow();
  });

  it("does not throw when MULTI_VAGUE entry has parKg = null", async () => {
    const dto = buildDTO({
      coutParCategorie: [
        {
          categorie: "MULTI_VAGUE",
          montant: 30000,
          pourcentage: 100,
          parKg: null,
        },
      ],
      resume: {
        coutTotal: 30000,
        poidsTotalVendu: 0,
        nombrePoissonsVendus: 0,
        biomasseKg: null,
        biomasseTransferee: null,
        nombrePoissonsTransferes: 0,
        biomasseProduite: null,
        coutParKg: null,
        prixMoyenVenteKg: null,
        margeParKg: null,
        revenusBruts: 0,
        depensesVentes: 0,
        revenus: 0,
        marge: -30000,
        roi: null,
      },
    });

    await expect(renderCoutProductionPDF(dto)).resolves.not.toThrow();
  });

  // -----------------------------------------------------------------------
  // 5. Handles zero coutTotal
  // -----------------------------------------------------------------------

  it("does not throw when all monetary values are zero", async () => {
    const dto = buildDTO({
      resume: {
        coutTotal: 0,
        poidsTotalVendu: 0,
        nombrePoissonsVendus: 0,
        biomasseKg: null,
        biomasseTransferee: null,
        nombrePoissonsTransferes: 0,
        biomasseProduite: null,
        coutParKg: null,
        prixMoyenVenteKg: null,
        margeParKg: null,
        revenusBruts: 0,
        depensesVentes: 0,
        revenus: 0,
        marge: 0,
        roi: null,
      },
      coutParCategorie: [],
      detailAliments: [],
      depensesDirectes: [],
      depensesMultiVagues: [],
      depensesRecurrentes: [],
      ventes: [],
      depensesVentes: [],
      formule: {
        coutAliments: 0,
        coutDepensesDirectes: 0,
        coutMultiVagues: 0,
        coutRecurrents: 0,
        coutTotal: 0,
        poidsVendu: 0,
        biomasseKg: null,
        coutParKg: null,
      },
    });

    await expect(renderCoutProductionPDF(dto)).resolves.not.toThrow();
  });

  it("still returns a Buffer even when coutTotal is zero", async () => {
    const dto = buildDTO({
      resume: {
        coutTotal: 0,
        poidsTotalVendu: 0,
        nombrePoissonsVendus: 0,
        biomasseKg: null,
        biomasseTransferee: null,
        nombrePoissonsTransferes: 0,
        biomasseProduite: null,
        coutParKg: null,
        prixMoyenVenteKg: null,
        margeParKg: null,
        revenusBruts: 0,
        depensesVentes: 0,
        revenus: 0,
        marge: 0,
        roi: null,
      },
    });

    const result = await renderCoutProductionPDF(dto);
    expect(result).toBeInstanceOf(Buffer);
  });

  // -----------------------------------------------------------------------
  // 6. All StatutVague values are handled
  // -----------------------------------------------------------------------

  it.each([
    [StatutVague.EN_COURS, "En cours"],
    [StatutVague.TERMINEE, "Terminée"],
    [StatutVague.ANNULEE, "Annulée"],
  ])("does not throw for statut %s", async (statut) => {
    const dto = buildDTO({
      vague: {
        id: "vague-001",
        code: "V-2026-001",
        statut,
        dateDebut: new Date("2026-01-01"),
        dateFin: statut === StatutVague.EN_COURS ? null : new Date("2026-03-01"),
        nombreInitial: 1000,
        dureeJours: 59,
      },
    });

    await expect(renderCoutProductionPDF(dto)).resolves.not.toThrow();
  });
});
