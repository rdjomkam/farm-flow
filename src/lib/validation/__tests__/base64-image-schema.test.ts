/**
 * Tests de parse Zod — base64ImageSchema / base64ImageOptionalSchema
 * (Sprint PX, ADR-047 D1/D5 — R3 étendu : Prisma = TypeScript = Zod).
 *
 * Ces tests exercent le `.refine(isDecodableImage, ...)` branché dans
 * `common.schema.ts`, aux deux niveaux : acceptation ET rejet. Le cas
 * "PNG valide multi-IDAT" est le test qui garantit qu'on n'a pas réintroduit
 * le piège du faux positif documenté en ADR-047 D1 (inflate sur le premier
 * chunk IDAT seul rejetterait à tort un PNG parfaitement valide).
 *
 * Note process : les tests de rendu réel non mocké (`@react-pdf/renderer`)
 * relèvent de la story PX.4 (@tester) — hors périmètre de ce fichier, qui
 * couvre uniquement la couche de validation Zod (PX.1).
 */

import { describe, it, expect } from "vitest";
import zlib from "node:zlib";
import {
  base64ImageSchema,
  base64ImageOptionalSchema,
} from "../common.schema";

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function pngChunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4); // CRC volontairement non vérifié par notre décodeur (ADR-047 D1)
  return Buffer.concat([length, typeBuf, data, crc]);
}

function buildIhdr(width: number, height: number, colorType = 6): Buffer {
  const buf = Buffer.alloc(13);
  buf.writeUInt32BE(width, 0);
  buf.writeUInt32BE(height, 4);
  buf[8] = 8; // bit depth
  buf[9] = colorType; // 6 = RGBA (canal alpha — format produit par un pad de signature)
  buf[10] = 0;
  buf[11] = 0;
  buf[12] = 0; // interlace = none
  return buf;
}

/** Construit un PNG RGBA 4x4 valide, avec un seul chunk IDAT ou plusieurs. */
function buildValidPngDataUrl({ multiIdat = false }: { multiIdat?: boolean } = {}): string {
  const width = 4;
  const height = 4;
  const rowBytes = 1 + width * 4; // 1 octet de filtre + 4 octets (RGBA) par pixel
  const raw = Buffer.alloc(rowBytes * height, 0);
  const compressed = zlib.deflateSync(raw);

  const idatChunks: Buffer[] = [];
  if (multiIdat && compressed.length > 4) {
    const mid = Math.ceil(compressed.length / 2);
    idatChunks.push(pngChunk("IDAT", compressed.subarray(0, mid)));
    idatChunks.push(pngChunk("IDAT", compressed.subarray(mid)));
  } else {
    idatChunks.push(pngChunk("IDAT", compressed));
  }

  const png = Buffer.concat([
    PNG_SIGNATURE,
    pngChunk("IHDR", buildIhdr(width, height)),
    ...idatChunks,
    pngChunk("IEND", Buffer.alloc(0)),
  ]);

  return `data:image/png;base64,${png.toString("base64")}`;
}

/** PNG RGBA avec un flux IDAT corrompu (bit-flip au milieu du flux compressé). */
function buildCorruptPngDataUrl(): string {
  const width = 4;
  const height = 4;
  const rowBytes = 1 + width * 4;
  const raw = Buffer.alloc(rowBytes * height, 0);
  const compressed = Buffer.from(zlib.deflateSync(raw));

  // Corrompt quelques octets au milieu du flux compressé (après l'en-tête
  // zlib, avant la fin) — reproduit le symptôme réel (Z_DATA_ERROR) sans
  // toucher aux deux premiers octets (en-tête zlib, ferait échouer avant
  // même d'entrer dans le flux Huffman).
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

function buildValidJpegDataUrl(): string {
  const payload = Buffer.from([0xff, 0xd8, 0x00, 0x11, 0x22, 0x33, 0xff, 0xd9]);
  return `data:image/jpeg;base64,${payload.toString("base64")}`;
}

describe("base64ImageSchema — parse Zod (acceptation)", () => {
  it("accepte un PNG RGBA valide mono-IDAT", () => {
    const result = base64ImageSchema.safeParse(buildValidPngDataUrl({ multiIdat: false }));
    expect(result.success).toBe(true);
  });

  it("accepte un PNG RGBA valide multi-IDAT (garde anti-faux-positif ADR-047 D1)", () => {
    const result = base64ImageSchema.safeParse(buildValidPngDataUrl({ multiIdat: true }));
    expect(result.success).toBe(true);
  });

  it("accepte un JPEG valide (SOI + EOI présents)", () => {
    const result = base64ImageSchema.safeParse(buildValidJpegDataUrl());
    expect(result.success).toBe(true);
  });

  it("base64ImageOptionalSchema accepte null et undefined", () => {
    expect(base64ImageOptionalSchema.safeParse(null).success).toBe(true);
    expect(base64ImageOptionalSchema.safeParse(undefined).success).toBe(true);
  });
});

describe("base64ImageSchema — parse Zod (rejet)", () => {
  it("rejette un PNG RGBA avec IDAT corrompu, avec message clair", () => {
    const result = base64ImageSchema.safeParse(buildCorruptPngDataUrl());
    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message);
      expect(messages).toContain("Image illisible ou corrompue.");
    }
  });

  it("rejette un data:image/webp (allowlist stricte MIME)", () => {
    const result = base64ImageSchema.safeParse(
      `data:image/webp;base64,${Buffer.from([0x00]).toString("base64")}`
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message);
      expect(messages).toContain("Format d'image non supporté (PNG ou JPEG uniquement).");
    }
  });

  it("rejette un data:image/svg+xml (risque XSS/XXE, ADR-047)", () => {
    const svgPayload = Buffer.from("<svg><script>alert(1)</script></svg>").toString("base64");
    const result = base64ImageSchema.safeParse(`data:image/svg+xml;base64,${svgPayload}`);
    expect(result.success).toBe(false);
  });

  it("rejette une chaîne qui n'est pas une data URL", () => {
    const result = base64ImageSchema.safeParse("not-a-data-url");
    expect(result.success).toBe(false);
  });

  it("rejette une image dépassant la taille maximale (500KB)", () => {
    const oversized = "data:image/png;base64," + "A".repeat(600_000);
    const result = base64ImageSchema.safeParse(oversized);
    expect(result.success).toBe(false);
  });
});
