/**
 * GET /api/export/bon-livraison/[id] — test de bout en bout SANS mocker
 * `renderBonLivraisonPDF` (Sprint PX, story PX.4).
 *
 * Le fichier `route.test.ts` (existant) mocke `@/lib/export/pdf-bon-livraison`
 * en entier — angle mort de bout en bout identifié par la pré-analyse
 * Sprint PX : aucun test n'exerçait jamais le vrai moteur de rendu depuis la
 * route HTTP. Ce fichier comble cet angle mort : seules `requirePermission`
 * et `getBonLivraisonForPDF` sont mockées (frontières I/O légitimes — auth
 * et DB), le reste de la chaîne (route → renderPdfSafely → renderBonLivraisonPDF
 * → @react-pdf/renderer réel) s'exécute pour de vrai.
 *
 * Garantit qu'une image corrompue ne produit JAMAIS une requête suspendue :
 * réponse HTTP 200 avec PDF en mode dégradé (cf. ADR-047 D2/D3-a — la
 * pré-validation dans pdf-bon-livraison.tsx écarte l'image AVANT tout appel
 * à renderToBuffer, donc aucune erreur ne remonte pour ce cas).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { StatutBonLivraison } from "@/types";
import zlib from "node:zlib";

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
// IMPORTANT : ni "@react-pdf/renderer" ni "@/lib/export/pdf-bon-livraison" ne
// sont mockés ici — c'est tout l'objet de ce fichier compagnon.

const { GET } = await import("../[id]/route");

const SITE_ID = "site-1";
const LIGNE_ID = "ligne-1";

// ---------------------------------------------------------------------------
// Fixtures PNG (mêmes helpers que pdf-render-real.test.ts)
// ---------------------------------------------------------------------------

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function pngChunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  return Buffer.concat([length, typeBuf, data, crc]);
}

function buildIhdr(width: number, height: number, colorType = 6): Buffer {
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

function buildValidRgbaPngDataUrl(): string {
  const width = 8;
  const height = 8;
  const rowBytes = 1 + width * 4;
  const raw = Buffer.alloc(rowBytes * height, 0);
  const compressed = zlib.deflateSync(raw);
  const png = Buffer.concat([
    PNG_SIGNATURE,
    pngChunk("IHDR", buildIhdr(width, height)),
    pngChunk("IDAT", compressed),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
  return `data:image/png;base64,${png.toString("base64")}`;
}

function buildCorruptRgbaPngDataUrl(): string {
  const width = 8;
  const height = 8;
  const rowBytes = 1 + width * 4;
  const raw = Buffer.alloc(rowBytes * height, 0);
  const compressed = Buffer.from(zlib.deflateSync(raw));
  const mid = Math.floor(compressed.length / 2);
  compressed[mid] ^= 0xff;
  compressed[mid + 1] ^= 0xff;
  const png = Buffer.concat([
    PNG_SIGNATURE,
    pngChunk("IHDR", buildIhdr(width, height)),
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

function makeBonLivraison(signatureClient: string | null) {
  return {
    bonLivraison: {
      numero: "BL-2026-PX01",
      statut: StatutBonLivraison.SIGNE,
      signeLe: new Date("2026-07-20"),
      signatureClient,
      signataireClientNom: "Jean Dupont",
      signatureLivreur: buildValidRgbaPngDataUrl(),
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
            nombrePoissons: 90,
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
          nombrePoissonsLivres: 90,
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

describe("GET /api/export/bon-livraison/[id] — rendu réel (pas de mock du moteur PDF)", () => {
  it(
    "signature valide → 200, PDF valide en Content-Type application/pdf",
    async () => {
      mockGetBonLivraisonForPDF.mockResolvedValue(
        makeBonLivraison(buildValidRgbaPngDataUrl())
      );

      const response = await GET(makeRequest(), { params: Promise.resolve({ id: "bl-1" }) });

      expect(response.status).toBe(200);
      expect(response.headers.get("Content-Type")).toBe("application/pdf");
      const buffer = Buffer.from(await response.arrayBuffer());
      expect(buffer.length).toBeGreaterThan(0);
      expect(buffer.subarray(0, 4).toString("ascii")).toBe("%PDF");
    },
    20_000
  );

  it(
    "signature client RGBA à IDAT corrompu (repro exacte du bug de production) → " +
      "réponse HTTP 200 avec PDF en mode dégradé, JAMAIS de requête suspendue",
    async () => {
      mockGetBonLivraisonForPDF.mockResolvedValue(
        makeBonLivraison(buildCorruptRgbaPngDataUrl())
      );

      let uncaughtError: unknown = null;
      const onUncaught = (err: unknown) => {
        uncaughtError = err;
      };
      process.on("uncaughtException", onUncaught);

      let response: Response;
      try {
        // Si le bug était réintroduit, cet await ne se résoudrait JAMAIS —
        // le timeout vitest explicite ci-dessous (20s) ferait échouer le test
        // plutôt que de le laisser passer par défaut.
        response = await GET(makeRequest(), { params: Promise.resolve({ id: "bl-1" }) });
      } finally {
        process.removeListener("uncaughtException", onUncaught);
      }

      expect(uncaughtError).toBeNull();
      // ADR-047 D2 : mode dégradé, jamais un échec franc pour ce cas — le
      // document existe toujours (pièce contractuelle), avec un placeholder.
      expect(response.status).toBe(200);
      expect(response.headers.get("Content-Type")).toBe("application/pdf");
      const buffer = Buffer.from(await response.arrayBuffer());
      expect(buffer.length).toBeGreaterThan(0);
      expect(buffer.subarray(0, 4).toString("ascii")).toBe("%PDF");
    },
    20_000
  );
});
