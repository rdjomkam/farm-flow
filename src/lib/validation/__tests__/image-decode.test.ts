/**
 * Tests unitaires — decodeImageDataUrl() / isDecodableImage()
 * (Sprint PX, ADR-047 D1/D5 — R3 étendu : Prisma = TypeScript = Zod).
 *
 * Ces tests exercent directement le décodeur (indépendamment du branchement
 * Zod, couvert par `base64-image-schema.test.ts`), avec les 8 cas minimaux
 * exigés par l'ADR §D5. Le cas "PNG valide multi-IDAT" est le test qui
 * garantit qu'on n'a pas réintroduit le piège du faux positif documenté en
 * D1 : inflate sur le premier chunk IDAT seul rejetterait à tort un PNG
 * parfaitement valide (le format PNG découpe volontairement les gros flux
 * compressés en plusieurs chunks IDAT).
 */

import { describe, it, expect } from "vitest";
import zlib from "node:zlib";
import { decodeImageDataUrl, isDecodableImage } from "../image-decode";

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function pngChunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4); // CRC volontairement non vérifié (ADR-047 D1, point 6)
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

/** PNG structurellement valide (signature + IHDR) mais sans aucun chunk IDAT. */
function buildPngWithoutIdatDataUrl(): string {
  const png = Buffer.concat([
    PNG_SIGNATURE,
    pngChunk("IHDR", buildIhdr(4, 4)),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
  return `data:image/png;base64,${png.toString("base64")}`;
}

function buildValidJpegDataUrl(): string {
  const payload = Buffer.from([0xff, 0xd8, 0x00, 0x11, 0x22, 0x33, 0xff, 0xd9]);
  return `data:image/jpeg;base64,${payload.toString("base64")}`;
}

function buildInvalidJpegDataUrl(): string {
  // Ni SOI ni EOI aux bons emplacements.
  const payload = Buffer.from([0x00, 0x11, 0x22, 0x33]);
  return `data:image/jpeg;base64,${payload.toString("base64")}`;
}

describe("decodeImageDataUrl — PNG", () => {
  it("accepte un PNG valide mono-IDAT", () => {
    const result = decodeImageDataUrl(buildValidPngDataUrl({ multiIdat: false }));
    expect(result.ok).toBe(true);
    expect(result.format).toBe("png");
  });

  it("accepte un PNG valide multi-IDAT (garde anti-faux-positif ADR-047 D1)", () => {
    const result = decodeImageDataUrl(buildValidPngDataUrl({ multiIdat: true }));
    expect(result.ok).toBe(true);
    expect(result.format).toBe("png");
  });

  it("rejette un PNG à IDAT corrompu, avec reason renseignée", () => {
    const result = decodeImageDataUrl(buildCorruptPngDataUrl());
    expect(result.ok).toBe(false);
    expect(result.format).toBe("png");
    expect(result.reason).toBeTruthy();
  });

  it("rejette un PNG sans chunk IDAT", () => {
    const result = decodeImageDataUrl(buildPngWithoutIdatDataUrl());
    expect(result.ok).toBe(false);
    expect(result.reason).toBeTruthy();
  });
});

describe("decodeImageDataUrl — JPEG", () => {
  it("accepte un JPEG avec SOI+EOI présents", () => {
    const result = decodeImageDataUrl(buildValidJpegDataUrl());
    expect(result.ok).toBe(true);
    expect(result.format).toBe("jpeg");
  });

  it("rejette un JPEG sans marqueur SOI/EOI", () => {
    const result = decodeImageDataUrl(buildInvalidJpegDataUrl());
    expect(result.ok).toBe(false);
    expect(result.format).toBe("jpeg");
  });
});

describe("decodeImageDataUrl — formats hors allowlist", () => {
  it("rejette data:image/webp (format: null)", () => {
    const result = decodeImageDataUrl(
      `data:image/webp;base64,${Buffer.from([0x00]).toString("base64")}`
    );
    expect(result.ok).toBe(false);
    expect(result.format).toBeNull();
  });

  it("rejette data:image/gif (format: null)", () => {
    const result = decodeImageDataUrl(
      `data:image/gif;base64,${Buffer.from([0x00]).toString("base64")}`
    );
    expect(result.ok).toBe(false);
    expect(result.format).toBeNull();
  });

  it("rejette data:image/svg+xml (format: null)", () => {
    const svgPayload = Buffer.from("<svg><script>alert(1)</script></svg>").toString("base64");
    const result = decodeImageDataUrl(`data:image/svg+xml;base64,${svgPayload}`);
    expect(result.ok).toBe(false);
    expect(result.format).toBeNull();
  });
});

describe("decodeImageDataUrl — data URL malformée", () => {
  it("ne throw jamais sur une chaîne qui n'est pas une data URL", () => {
    expect(() => decodeImageDataUrl("not-a-data-url")).not.toThrow();
    const result = decodeImageDataUrl("not-a-data-url");
    expect(result.ok).toBe(false);
    expect(result.format).toBeNull();
  });

  it("ne throw jamais sur un base64 invalide", () => {
    expect(() => decodeImageDataUrl("data:image/png;base64,!!!not-base64!!!")).not.toThrow();
  });

  it("ne throw jamais sur une chaîne vide ou des entrées inattendues", () => {
    expect(() => decodeImageDataUrl("")).not.toThrow();
    // @ts-expect-error — vérification défensive contre une entrée non-string
    expect(() => decodeImageDataUrl(null)).not.toThrow();
  });
});

describe("decodeImageDataUrl — borne maxOutputLength (défense en profondeur anti-bombe zlib)", () => {
  it("accepte une image légitime volumineuse (base64 proche de la limite Zod de 500 000 caractères)", () => {
    // ~500 000 caractères base64 => ~375 Ko décodés en amont (limite Zod).
    // On construit un PNG RGBA dont le flux IDAT compressé, une fois inflaté,
    // reste largement sous la borne maxOutputLength (8 Mo) mais est volumineux
    // (plusieurs centaines de Ko), pour vérifier l'absence de faux positif.
    const width = 300;
    const height = 300;
    const rowBytes = 1 + width * 4;
    // Contenu pseudo-aléatoire (non-nul) pour éviter une compression trop
    // efficace qui réduirait le data URL final à une taille non représentative.
    const raw = Buffer.alloc(rowBytes * height);
    for (let i = 0; i < raw.length; i++) raw[i] = (i * 37) % 256;
    const compressed = zlib.deflateSync(raw);

    const png = Buffer.concat([
      PNG_SIGNATURE,
      pngChunk("IHDR", buildIhdr(width, height)),
      pngChunk("IDAT", compressed),
      pngChunk("IEND", Buffer.alloc(0)),
    ]);
    const dataUrl = `data:image/png;base64,${png.toString("base64")}`;

    const result = decodeImageDataUrl(dataUrl);
    expect(result.ok).toBe(true);
    expect(result.format).toBe("png");
  });

  it("accepte une signature desktop haute-densité (~3600x600 RGBA, non-régression du faux positif — delta-review Sprint PX Delta 1)", () => {
    // Reproduit le cas limite concret identifié par la delta-review : un
    // canvas de signature (signature-pad.tsx) sur un conteneur desktop large
    // (~1200 px) avec un devicePixelRatio non plafonné de 3 aurait produit un
    // canvas physique ~3600x600 px, soit ~8,24 Mo décompressés — au-dessus
    // de l'ancien seuil de 8 Mo. Ce test garantit qu'une telle image reste
    // ACCEPTÉE avec le nouveau seuil de 16 Mo (même si le plafonnement du
    // devicePixelRatio à 2 dans signature-pad.tsx réduit aussi ce risque en
    // pratique, cette borne doit rester correcte indépendamment de ce
    // second garde-fou côté client).
    const width = 3600;
    const height = 600;
    const rowBytes = 1 + width * 4;
    const raw = Buffer.alloc(rowBytes * height);
    for (let i = 0; i < raw.length; i++) raw[i] = (i * 37) % 256;
    const compressed = zlib.deflateSync(raw);

    const png = Buffer.concat([
      PNG_SIGNATURE,
      pngChunk("IHDR", buildIhdr(width, height)),
      pngChunk("IDAT", compressed),
      pngChunk("IEND", Buffer.alloc(0)),
    ]);
    const dataUrl = `data:image/png;base64,${png.toString("base64")}`;

    const result = decodeImageDataUrl(dataUrl);
    expect(result.ok).toBe(true);
    expect(result.format).toBe("png");
  });

  it("rejette proprement une bombe zlib avec une reason distincte d'un échec de flux illisible (delta-review Sprint PX Delta 1)", () => {
    // 50 Mo de zéros compressent en un flux zlib minuscule — amplification
    // classique de bombe zlib. maxOutputLength doit stopper l'inflate avant
    // d'allouer les 50 Mo, sans jamais laisser échapper d'exception. La
    // reason doit être honnête (image trop volumineuse) et non confondue
    // avec un message de "flux illisible / corrompu".
    const bomb = zlib.deflateSync(Buffer.alloc(50_000_000));
    const png = Buffer.concat([
      PNG_SIGNATURE,
      pngChunk("IHDR", buildIhdr(4, 4)),
      pngChunk("IDAT", bomb),
      pngChunk("IEND", Buffer.alloc(0)),
    ]);
    const dataUrl = `data:image/png;base64,${png.toString("base64")}`;

    expect(() => decodeImageDataUrl(dataUrl)).not.toThrow();
    const result = decodeImageDataUrl(dataUrl);
    expect(result.ok).toBe(false);
    expect(result.format).toBe("png");
    expect(result.reason).toBeTruthy();
    expect(result.reason).toContain("trop volumineuse");
    expect(result.reason).not.toContain("Flux IDAT illisible");
  });
});

describe("isDecodableImage — wrapper booléen", () => {
  it("retourne true pour un PNG valide", () => {
    expect(isDecodableImage(buildValidPngDataUrl())).toBe(true);
  });

  it("retourne false pour un PNG corrompu", () => {
    expect(isDecodableImage(buildCorruptPngDataUrl())).toBe(false);
  });
});
