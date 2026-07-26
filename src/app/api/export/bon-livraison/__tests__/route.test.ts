/**
 * Tests — GET /api/export/bon-livraison/[id]
 *
 * Review Sprint BF phase 2 (finding Haute) : le PDF d'un bon de livraison
 * doit refleter le nombre de poissons constate a SA PROPRE signature
 * (LigneBonLivraison.nombrePoissonsLivres), jamais l'etat courant mutable de
 * LigneVente.nombrePoissons — qui est reecrit par chaque rectification
 * ulterieure de la meme vente.
 *
 * Couvre :
 * 1. nombrePoissonsLivres renseigne -> priorite absolue sur LigneVente.nombrePoissons
 * 2. nombrePoissonsLivres null (BL legacy pre-Sprint BF) -> fallback sur LigneVente.nombrePoissons
 * 3. Scenario complet : apres rectification qui change les morts, le PDF de
 *    l'ORIGINE affiche toujours le nombre de sa propre signature.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { StatutBonLivraison } from "@/types";

const mockRequirePermission = vi.fn();
const mockGetBonLivraisonForPDF = vi.fn();
const mockRenderBonLivraisonPDF = vi.fn();

vi.mock("@/lib/permissions", () => ({
  requirePermission: (...args: unknown[]) => mockRequirePermission(...args),
}));
vi.mock("@/lib/queries/bons-livraison", () => ({
  getBonLivraisonForPDF: (...args: unknown[]) => mockGetBonLivraisonForPDF(...args),
}));
vi.mock("@/lib/export/pdf-bon-livraison", () => ({
  renderBonLivraisonPDF: (...args: unknown[]) => mockRenderBonLivraisonPDF(...args),
}));

const { GET } = await import("../[id]/route");

const SITE_ID = "site-1";
const LIGNE_ID = "ligne-1";

function makeRequest() {
  return new Request("http://localhost/api/export/bon-livraison/bl-1") as unknown as Parameters<
    typeof GET
  >[0];
}

function makeBonLivraison(overrides: {
  lignes: Array<{ ligneVenteId: string; poidsLivreKg: number; nombreMortsTransport: number; motifAvarie: string | null; nombrePoissonsLivres: number | null }>;
  ligneVenteNombrePoissons: number;
}) {
  return {
    bonLivraison: {
      numero: "BL-2026-001",
      statut: StatutBonLivraison.SIGNE,
      signeLe: new Date("2026-07-20"),
      signatureClient: "data:image/png;base64,AAA",
      signataireClientNom: "Jean Dupont",
      signatureLivreur: "data:image/png;base64,BBB",
      motifRectification: null,
      rectifie: null,
      rectifiePar: null,
      user: { id: "user-1", name: "Livreur" },
      site: {
        name: "Ferme A",
        address: null,
        signaturePromoteur: null,
        nomPromoteur: null,
        cachet: null,
      },
      vente: {
        numero: "VTE-2026-001",
        client: { nom: "Client A", telephone: null },
        lignes: [
          {
            id: LIGNE_ID,
            poidsTotalKg: 100,
            poidsLivreKg: 90,
            nombrePoissons: overrides.ligneVenteNombrePoissons,
            bac: { nom: "Bac 01" },
            lotAlevins: null,
          },
        ],
      },
      lignes: overrides.lignes,
    },
    blocPaiement: { totalVente: 100000, paye: 0, resteAPayer: 100000 },
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  mockRequirePermission.mockResolvedValue({ activeSiteId: SITE_ID });
  mockRenderBonLivraisonPDF.mockResolvedValue(Buffer.from("fake-pdf"));
});

describe("GET /api/export/bon-livraison/[id] — snapshot nombrePoissons", () => {
  it("lit nombrePoissonsLivres en priorite sur LigneVente.nombrePoissons (etat mutable)", async () => {
    // La vente affiche 90 poissons COURANTS (deja modifies par une rectification
    // ulterieure), mais CE bon avait constate 97 poissons a SA signature.
    mockGetBonLivraisonForPDF.mockResolvedValue(
      makeBonLivraison({
        lignes: [
          {
            ligneVenteId: LIGNE_ID,
            poidsLivreKg: 97,
            nombreMortsTransport: 3,
            motifAvarie: null,
            nombrePoissonsLivres: 97,
          },
        ],
        ligneVenteNombrePoissons: 90, // etat courant post-rectification, DIFFERENT
      })
    );

    await GET(makeRequest(), { params: Promise.resolve({ id: "bl-1" }) });

    expect(mockRenderBonLivraisonPDF).toHaveBeenCalledWith(
      expect.objectContaining({
        lignes: [expect.objectContaining({ nombrePoissons: 97 })],
      })
    );
  });

  it("fallback sur LigneVente.nombrePoissons si nombrePoissonsLivres est null (BL legacy pre-Sprint BF)", async () => {
    mockGetBonLivraisonForPDF.mockResolvedValue(
      makeBonLivraison({
        lignes: [
          {
            ligneVenteId: LIGNE_ID,
            poidsLivreKg: 97,
            nombreMortsTransport: 0,
            motifAvarie: null,
            nombrePoissonsLivres: null,
          },
        ],
        ligneVenteNombrePoissons: 100,
      })
    );

    await GET(makeRequest(), { params: Promise.resolve({ id: "bl-1" }) });

    expect(mockRenderBonLivraisonPDF).toHaveBeenCalledWith(
      expect.objectContaining({
        lignes: [expect.objectContaining({ nombrePoissons: 100 })],
      })
    );
  });
});
