/**
 * Preuve du garde-fou inconditionnel, au niveau ROUTE — Sprint PX (ADR-047).
 *
 * Contrairement à `route.test.ts` (qui mocke `renderBonLivraisonPDF`
 * intégralement — angle mort documenté par la pré-analyse Sprint PX), CE
 * fichier NE MOCKE NI `@/lib/export/pdf-bon-livraison` NI
 * `@/lib/export/render-pdf-safely` : seuls `requirePermission` et
 * `getBonLivraisonForPDF` (couche auth/DB) sont mockés. Le VRAI moteur
 * `@react-pdf/renderer` est invoqué.
 *
 * But : prouver qu'une défaillance de rendu (image qui franchit la
 * pré-validation amont mais casse `@react-pdf/png-js`, cf.
 * `pdf-render-guard-unconditional.test.ts`) produit bien une RÉPONSE HTTP
 * (500, via `handleApiError`) — jamais une requête suspendue indéfiniment.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import zlib from "node:zlib";
import { StatutBonLivraison } from "@/types";

const mockRequirePermission = vi.fn();
const mockGetBonLivraisonForPDF = vi.fn();

vi.mock("@/lib/permissions", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/permissions")>();
  return {
    ...actual,
    requirePermission: (...args: unknown[]) => mockRequirePermission(...args),
  };
});
vi.mock("@/lib/queries/bons-livraison", () => ({
  getBonLivraisonForPDF: (...args: unknown[]) => mockGetBonLivraisonForPDF(...args),
}));
// IMPORTANT : PAS de vi.mock sur "@/lib/export/pdf-bon-livraison" ni sur
// "@/lib/export/render-pdf-safely" — c'est précisément le point de cette
// mission : prouver le comportement avec le VRAI pipeline de rendu.

const { GET } = await import("../[id]/route");

const SITE_ID = "site-1";
const LIGNE_ID = "ligne-1";

/**
 * Même fixture que `pdf-render-guard-unconditional.test.ts` : un PNG RGBA
 * dont l'IDAT est un flux zlib PARFAITEMENT VALIDE (notre validateur amont
 * `isDecodableImage()` le juge décodable), mais dont le contenu décompressé
 * porte un octet de "filter type" invalide (7 — la spec PNG n'autorise que
 * 0 à 4), qui fait planter `@react-pdf/png-js` (`decodePixels()` → `pass()`
 * → `throw new Error("Invalid filter algorithm: 7")`) dans son callback
 * asynchrone `zlib.inflate`.
 */
function buildPngThatPassesUpstreamButBreaksReactPdf(): string {
  const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  function pngChunk(type: string, data: Buffer): Buffer {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length, 0);
    return Buffer.concat([length, Buffer.from(type, "ascii"), data, Buffer.alloc(4)]);
  }
  function ihdr(width: number, height: number, colorType = 6): Buffer {
    const buf = Buffer.alloc(13);
    buf.writeUInt32BE(width, 0);
    buf.writeUInt32BE(height, 4);
    buf[8] = 8;
    buf[9] = colorType;
    buf[10] = 0;
    buf[11] = 0;
    buf[12] = 0;
    return buf;
  }

  const width = 4;
  const height = 4;
  const rowBytes = 1 + width * 4;
  const raw = Buffer.alloc(rowBytes * height, 0);
  for (let y = 0; y < height; y++) {
    raw[y * rowBytes] = 7;
  }
  const compressed = zlib.deflateSync(raw);

  const png = Buffer.concat([
    PNG_SIGNATURE,
    pngChunk("IHDR", ihdr(width, height)),
    pngChunk("IDAT", compressed),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);

  return `data:image/png;base64,${png.toString("base64")}`;
}

function makeRequest() {
  return new Request("http://localhost/api/export/bon-livraison/bl-1") as unknown as Parameters<
    typeof GET
  >[0];
}

function makeBonLivraison(signatureClientImage: string | null) {
  return {
    bonLivraison: {
      numero: "BL-2026-099",
      statut: StatutBonLivraison.SIGNE,
      signeLe: new Date("2026-07-20"),
      signatureClient: signatureClientImage,
      signataireClientNom: "Jean Dupont",
      signatureLivreur: null,
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
            nombrePoissons: 200,
            bac: { nom: "Bac 01" },
            lotAlevins: null,
          },
        ],
      },
      lignes: [
        {
          ligneVenteId: LIGNE_ID,
          poidsLivreKg: 90,
          nombreMortsTransport: 0,
          motifAvarie: null,
          nombrePoissonsLivres: 200,
        },
      ],
    },
    blocPaiement: { totalVente: 100000, paye: 0, resteAPayer: 100000 },
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  mockRequirePermission.mockResolvedValue({ activeSiteId: SITE_ID });
});

describe("GET /api/export/bon-livraison/[id] — garde-fou inconditionnel (pipeline de rendu RÉEL, non mocké)", () => {
  it(
    "cas nominal : sans image corrompue, la route répond 200 avec un vrai buffer PDF (pipeline réel, non mocké)",
    async () => {
      mockGetBonLivraisonForPDF.mockResolvedValue(makeBonLivraison(null));

      const response = await GET(makeRequest(), { params: Promise.resolve({ id: "bl-1" }) });

      expect(response.status).toBe(200);
      const buf = Buffer.from(await response.arrayBuffer());
      expect(buf.length).toBeGreaterThan(0);
      // Signature PDF ("%PDF-")
      expect(buf.subarray(0, 5).toString("ascii")).toBe("%PDF-");
    },
    10000
  );

  it(
    "cas de défaillance : image qui passe l'amont mais casse @react-pdf/png-js -> la route répond (500), jamais de requête suspendue",
    async () => {
      mockGetBonLivraisonForPDF.mockResolvedValue(
        makeBonLivraison(buildPngThatPassesUpstreamButBreaksReactPdf())
      );

      const start = Date.now();
      const response = await GET(makeRequest(), { params: Promise.resolve({ id: "bl-1" }) });
      const elapsedMs = Date.now() - start;

      // La requête a bien reçu une réponse HTTP, dans un délai borné — bien
      // avant le timeout dur de 15s de renderPdfSafely (l'exception est
      // interceptée par le listener uncaughtException scopé, pas par le
      // timeout). Marge généreuse pour tolérer la contention CPU d'une
      // exécution en suite complète.
      expect(elapsedMs).toBeLessThan(9000);
      expect(response).toBeInstanceOf(Response);
      expect(response.status).toBe(500);

      const body = await response.json();
      expect(body).toHaveProperty("message");
      expect(body.status).toBe(500);
    },
    10000
  );
});
