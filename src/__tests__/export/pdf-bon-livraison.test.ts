/**
 * Tests unitaires — renderBonLivraisonPDF
 *
 * Cas couverts :
 * 1. Renders without error — DTO complet (3 signatures + cachet) → Buffer
 * 2. Renders without error — assets promoteur absents (signaturePromoteur/cachet null)
 * 3. Renders without error — écarts de livraison (poids livré != poids commandé, positif/négatif)
 * 4. Renders without error — poidsLivreKg null (ligne pas encore renseignée)
 * 5. Renders without error — BL entièrement payé (resteAPayer = 0)
 */

import { describe, it, expect, vi } from "vitest";
import { StatutBonLivraison } from "@/types";
import type { CreateBonLivraisonPDFDTO } from "@/types/export";

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
  Image: () => null,
  StyleSheet: {
    create: (styles: Record<string, unknown>) => styles,
  },
  renderToBuffer: (...args: unknown[]) => mockRenderToBuffer(...args),
}));

// ---------------------------------------------------------------------------
// Import AFTER mocks are registered
// ---------------------------------------------------------------------------
const { renderBonLivraisonPDF } = await import("@/lib/export/pdf-bon-livraison");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildFullDTO(
  overrides: Partial<CreateBonLivraisonPDFDTO> = {}
): CreateBonLivraisonPDFDTO {
  return {
    site: { name: "Ferme Test", address: "Douala, Cameroun" },
    numero: "BL-2026-001",
    statut: StatutBonLivraison.SIGNE,
    signeLe: new Date("2026-07-20T10:00:00Z"),
    venteNumero: "VTE-2026-005",
    client: { nom: "Jean Client", telephone: "+237600000000" },
    lignes: [
      {
        designation: "Silure",
        nomBac: "Bac A1",
        nombrePoissons: 200,
        poidsCommandeKg: 150,
        poidsLivreKg: 148,
        ecartKg: -2,
      },
    ],
    blocPaiement: { totalVente: 750000, paye: 300000, resteAPayer: 450000 },
    signatureClient: {
      image: "data:image/png;base64,AAAA",
      nom: "Jean Client",
      date: new Date("2026-07-20T10:00:00Z"),
    },
    signatureLivreur: {
      image: "data:image/png;base64,BBBB",
      nom: "Paul Livreur",
      date: new Date("2026-07-20T10:00:00Z"),
    },
    signaturePromoteur: {
      image: "data:image/png;base64,CCCC",
      nom: null,
      date: null,
    },
    cachet: "data:image/png;base64,DDDD",
    dateGeneration: new Date("2026-07-21T08:00:00Z").toISOString(),
    ...overrides,
  };
}

describe("renderBonLivraisonPDF", () => {
  it("rend un PDF sans erreur avec un DTO complet (3 signatures + cachet)", async () => {
    const dto = buildFullDTO();
    const buffer = await renderBonLivraisonPDF(dto);
    expect(buffer).toBeInstanceOf(Buffer);
    expect(mockRenderToBuffer).toHaveBeenCalledTimes(1);
  });

  it("rend un PDF sans erreur quand les assets promoteur sont absents", async () => {
    const dto = buildFullDTO({
      signaturePromoteur: { image: null, nom: null, date: null },
      cachet: null,
    });
    await expect(renderBonLivraisonPDF(dto)).resolves.toBeInstanceOf(Buffer);
  });

  it("rend un PDF sans erreur avec des écarts de livraison positifs et négatifs", async () => {
    const dto = buildFullDTO({
      lignes: [
        {
          designation: "Silure",
          nomBac: "Bac A1",
          nombrePoissons: 100,
          poidsCommandeKg: 80,
          poidsLivreKg: 75,
          ecartKg: -5,
        },
        {
          designation: "Silure",
          nomBac: null,
          nombrePoissons: 50,
          poidsCommandeKg: 40,
          poidsLivreKg: 42,
          ecartKg: 2,
        },
      ],
    });
    await expect(renderBonLivraisonPDF(dto)).resolves.toBeInstanceOf(Buffer);
  });

  it("rend un PDF sans erreur quand poidsLivreKg est null (ligne non renseignée)", async () => {
    const dto = buildFullDTO({
      lignes: [
        {
          designation: "Alevins silure",
          nomBac: null,
          nombrePoissons: 500,
          poidsCommandeKg: 10,
          poidsLivreKg: null,
          ecartKg: null,
        },
      ],
    });
    await expect(renderBonLivraisonPDF(dto)).resolves.toBeInstanceOf(Buffer);
  });

  it("rend un PDF sans erreur quand la vente est entièrement payée", async () => {
    const dto = buildFullDTO({
      blocPaiement: { totalVente: 500000, paye: 500000, resteAPayer: 0 },
    });
    await expect(renderBonLivraisonPDF(dto)).resolves.toBeInstanceOf(Buffer);
  });

  it("rend un PDF sans erreur sans signature client ni livreur (BL edge-case rétrocompat)", async () => {
    const dto = buildFullDTO({
      signatureClient: { image: null, nom: null, date: null },
      signatureLivreur: { image: null, nom: null, date: null },
    });
    await expect(renderBonLivraisonPDF(dto)).resolves.toBeInstanceOf(Buffer);
  });

  it("rend un PDF sans erreur avec le nom du promoteur renseigné", async () => {
    const dto = buildFullDTO({
      signaturePromoteur: {
        image: "data:image/png;base64,CCCC",
        nom: "Paul Promoteur",
        date: null,
      },
    });
    await expect(renderBonLivraisonPDF(dto)).resolves.toBeInstanceOf(Buffer);
  });

  it("rend un PDF sans erreur quand le nom du promoteur est absent", async () => {
    const dto = buildFullDTO({
      signaturePromoteur: {
        image: "data:image/png;base64,CCCC",
        nom: null,
        date: null,
      },
    });
    await expect(renderBonLivraisonPDF(dto)).resolves.toBeInstanceOf(Buffer);
  });
});
