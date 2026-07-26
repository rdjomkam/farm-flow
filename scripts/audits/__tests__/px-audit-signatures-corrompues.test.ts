/**
 * Test unitaire — PX.5 : preuve que le script d'audit read-only détecte
 * réellement un cas corrompu.
 *
 * IMPORTANT : ce test ne se connecte à AUCUNE base de données. Il importe
 * directement `auditValue()` (la fonction d'inspection d'une valeur unique
 * utilisée par le script pour chaque ligne lue) et lui passe des fixtures
 * PNG construites en mémoire — un PNG RGBA valide et un PNG RGBA à IDAT
 * corrompu (bit-flip), sans jamais insérer de donnée corrompue en base.
 *
 * `auditValue()` délègue à `decodeImageDataUrl()` (src/lib/validation/
 * image-decode.ts, PX.1) — ce test vérifie que le script d'audit
 * lui-même (pas seulement le décodeur générique) classe correctement
 * la fixture corrompue comme non décodable, avec le format et la raison
 * attendus, et calcule une taille en octets cohérente.
 */

import { describe, it, expect } from "vitest";
import zlib from "node:zlib";
import { auditValue, dataUrlByteSize } from "../px-audit-signatures-corrompues";

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function pngChunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4); // CRC volontairement non vérifié (ADR-047 D1)
  return Buffer.concat([length, typeBuf, data, crc]);
}

function buildIhdr(width: number, height: number): Buffer {
  const buf = Buffer.alloc(13);
  buf.writeUInt32BE(width, 0);
  buf.writeUInt32BE(height, 4);
  buf[8] = 8; // bit depth
  buf[9] = 6; // colorType 6 = RGBA (format produit par un pad de signature)
  buf[10] = 0;
  buf[11] = 0;
  buf[12] = 0; // interlace = none
  return buf;
}

/** PNG RGBA 4x4 structurellement valide (mono-IDAT). */
function buildValidPngDataUrl(): string {
  const width = 4;
  const height = 4;
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

/**
 * PNG RGBA avec un flux IDAT corrompu (bit-flip au milieu du flux zlib
 * compressé) — reproduit exactement le scénario de la pré-analyse (ADR-047) :
 * un PNG structurellement valide (signature + IHDR + IDAT + IEND présents)
 * mais dont le contenu compressé ne peut pas être inflaté.
 */
function buildCorruptPngDataUrl(): string {
  const width = 4;
  const height = 4;
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

describe("px-audit-signatures-corrompues — auditValue() (aucune connexion DB)", () => {
  it("classe un PNG RGBA valide comme décodable", () => {
    const result = auditValue(
      { table: "BonLivraison", identifiant: "fixture-valide", champ: "signatureClient" },
      buildValidPngDataUrl()
    );

    expect(result.decodable).toBe(true);
    expect(result.format).toBe("png");
    expect(result.reason).toBeUndefined();
    expect(result.tailleOctets).toBeGreaterThan(0);
  });

  it("détecte un PNG RGBA à IDAT corrompu comme non décodable (preuve que l'audit détecte un cas corrompu)", () => {
    const result = auditValue(
      { table: "Site", identifiant: "fixture-corrompue", champ: "signaturePromoteur" },
      buildCorruptPngDataUrl()
    );

    expect(result.decodable).toBe(false);
    expect(result.format).toBe("png");
    expect(result.reason).toBeTruthy();
    expect(result.reason).toMatch(/IDAT/i);
  });

  it("conserve l'identifiant et le champ transmis dans le résultat (traçabilité du rapport)", () => {
    const result = auditValue(
      { table: "BonLivraison", identifiant: "abc123 (BL-2026-099)", champ: "signatureLivreur" },
      buildCorruptPngDataUrl()
    );

    expect(result.table).toBe("BonLivraison");
    expect(result.identifiant).toBe("abc123 (BL-2026-099)");
    expect(result.champ).toBe("signatureLivreur");
  });
});

describe("px-audit-signatures-corrompues — dataUrlByteSize() (aucune connexion DB)", () => {
  it("calcule une taille décodée cohérente avec le payload base64 réel", () => {
    const dataUrl = buildValidPngDataUrl();
    const commaIndex = dataUrl.indexOf(",");
    const base64Payload = dataUrl.slice(commaIndex + 1);
    const expectedBytes = Buffer.from(base64Payload, "base64").length;

    expect(dataUrlByteSize(dataUrl)).toBe(expectedBytes);
  });

  it("retourne 0 pour une chaîne sans payload", () => {
    expect(dataUrlByteSize("data:image/png;base64,")).toBe(0);
  });
});
