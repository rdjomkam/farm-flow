/**
 * Décodeur défensif d'image (PNG / JPEG) — Sprint PX (robustesse rendu PDF).
 *
 * Contexte (voir ADR-047) : `@react-pdf/png-js` (dépendance vendue de
 * `@react-pdf/renderer`) contient un bug connu — un PNG avec canal alpha
 * (RGBA), palette indexée avec transparence, ou entrelacé, dont le flux
 * compressé IDAT est corrompu, provoque un `zlib.inflate(buf, (err) => {
 * if (err) throw err; ... })` : un `throw` dans un callback asynchrone Node.
 * Cela ne rejette AUCUNE promesse (la promesse de `renderToBuffer()` ne se
 * règle jamais) ET s'échappe en exception non interceptée au niveau
 * `process` (comportement par défaut Node : crash du worker).
 *
 * Ce module fournit un décodeur volontairement défensif, écrit à la main
 * avec le module `zlib` natif de Node (zéro nouvelle dépendance — ADR-047 D1),
 * pour détecter la décodabilité effective d'une image AVANT qu'elle
 * n'atteigne le moteur de rendu bugué (`@react-pdf/png-js`), à la fois :
 * - à l'écriture (Zod `.refine()` dans `common.schema.ts`) ;
 * - à la lecture, en mode dégradé (`pdf-bon-livraison.tsx`) ;
 * - en audit read-only (`scripts/audits/px-audit-signatures-corrompues.*`).
 *
 * IMPORTANT : ne JAMAIS réutiliser `@react-pdf/png-js` comme validateur de
 * confiance — c'est la librairie bugguée elle-même.
 */

import zlib from "node:zlib";

export type ImageDecodeFormat = "png" | "jpeg";

export interface ImageDecodeResult {
  /** true si l'image est structurellement valide et décodable. */
  ok: boolean;
  /** Format détecté, null si le MIME n'est reconnu ni comme PNG ni JPEG. */
  format: ImageDecodeFormat | null;
  /** Raison lisible (FR) du rejet — présente uniquement si ok === false. */
  reason?: string;
}

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/**
 * Borne explicite de sortie pour `zlib.inflateSync` — défense en profondeur
 * contre une bombe zlib (entrée volontairement minuscule qui décompresse en
 * centaines de Mo).
 *
 * ATTENTION (corrigé après delta-review Sprint PX, voir review-sprint-PX.md
 * Delta 1) : la taille de l'entrée base64 bornée en amont par
 * `common.schema.ts` (500 000 caractères base64) NE BORNE PAS la taille
 * décompressée. Pour un PNG à fond uni ou très majoritairement transparent
 * (profil exact d'une signature de pad tactile), le ratio de compression
 * peut être extrême : quelques Ko compressés peuvent décompresser en
 * plusieurs Mo. La taille compressée d'entrée n'est donc PAS une garantie
 * de borne sur la sortie — ne jamais présumer le contraire.
 *
 * La vraie borne de dimensions vient des deux composants clients qui
 * produisent ces images :
 * - `src/components/sites/image-upload-field.tsx` : `MAX_WIDTH = 600` —
 *   cachet / signature promoteur redimensionnés côté client avant l'envoi
 *   (fichier uploadé), largeur plafonnée à 600 px.
 * - `src/components/ui/signature-pad.tsx` : canvas de signature dont la
 *   largeur physique = `container.clientWidth × devicePixelRatio` et la
 *   hauteur physique = `height (200) × devicePixelRatio`. Sur un poste
 *   desktop large (conteneur ≈ 1200 px) avec un `devicePixelRatio = 3`
 *   (écrans haute densité courants), le canvas atteint ~3600×600 px
 *   physiques.
 *
 * Une image RGBA décompresse en scanlines brutes selon
 * `height × (1 + width × 4)` octets (1 octet de filtre + 4 canaux par pixel,
 * par ligne). Le cas limite desktop haute-densité identifié ci-dessus donne
 * `600 × (1 + 3600 × 4)` ≈ **8,24 Mo** — déjà au-dessus d'un ancien seuil de
 * 8 Mo, ce qui aurait rejeté à tort une signature parfaitement légitime.
 *
 * Valeur retenue : 16 Mo (16 * 1024 * 1024 octets) — marge de sécurité
 * confortable au-dessus du cas limite ci-dessus (~8,24 Mo), tout en bornant
 * fermement l'amplification zlib (une bombe zlib vise typiquement des
 * centaines de Mo de sortie pour une entrée compressée minuscule, très loin
 * de cette limite).
 */
const MAX_INFLATE_OUTPUT_BYTES = 16 * 1024 * 1024;

/**
 * Data URL attendue : "data:image/<mime>;base64,<payload>".
 * Le sous-type MIME est capturé sans contrainte pour permettre de rejeter
 * explicitement (avec un message clair) les formats hors allowlist
 * (webp, gif, svg+xml, ...) plutôt que de simplement échouer le regex.
 */
const DATA_URL_PATTERN = /^data:image\/([a-zA-Z0-9.+-]+);base64,(.*)$/;

/**
 * Décode défensivement une image en data URL.
 *
 * PNG : vérifie la signature magique, parse les chunks séquentiellement,
 * concatène TOUS les chunks IDAT rencontrés (un PNG réel en a très souvent
 * plusieurs — inflate le premier seul produirait un FAUX POSITIF de rejet,
 * cf. ADR-047 D1), puis tente `zlib.inflateSync` sur le flux concaténé.
 * Le CRC des chunks est volontairement NON vérifié (ADR-047 D1, point 6).
 *
 * JPEG : validation structurelle uniquement (marqueurs SOI `FF D8` en tête,
 * EOI `FF D9` en queue) — pas de décodage entropique. Limite assumée : un
 * JPEG tronqué en plein flux DCT mais avec SOI/EOI présents ne sera pas
 * détecté (hors périmètre, ce n'est pas le vecteur du bug ciblé).
 *
 * Tout autre MIME (webp, gif, svg+xml, ...) est rejeté explicitement,
 * `format: null` — allowlist stricte (ADR-047 D1).
 *
 * Ne throw JAMAIS : toute erreur interne est capturée et retournée comme
 * un résultat `{ ok: false, ... }`.
 */
export function decodeImageDataUrl(dataUrl: string): ImageDecodeResult {
  try {
    if (typeof dataUrl !== "string" || dataUrl.length === 0) {
      return { ok: false, format: null, reason: "Data URL vide ou invalide." };
    }

    const match = DATA_URL_PATTERN.exec(dataUrl);
    if (!match) {
      return {
        ok: false,
        format: null,
        reason: "Format de data URL invalide (attendu : data:image/...;base64,...).",
      };
    }

    const [, rawMime, base64Payload] = match;
    const mime = rawMime.toLowerCase();

    let buffer: Buffer;
    try {
      buffer = Buffer.from(base64Payload, "base64");
    } catch (err) {
      return {
        ok: false,
        format: null,
        reason: `Contenu base64 invalide (${err instanceof Error ? err.message : "erreur inconnue"}).`,
      };
    }

    if (buffer.length === 0) {
      return { ok: false, format: null, reason: "Image vide (0 octet après décodage base64)." };
    }

    if (mime === "png") {
      return decodePng(buffer);
    }
    if (mime === "jpeg" || mime === "jpg") {
      return decodeJpeg(buffer);
    }

    return {
      ok: false,
      format: null,
      reason: `Format d'image non supporté (PNG ou JPEG uniquement) : "${mime}".`,
    };
  } catch (err) {
    // Filet ultime : le décodeur ne doit jamais laisser échapper d'exception,
    // quelle que soit la donnée reçue (data URL malformée, buffer inattendu, ...).
    return {
      ok: false,
      format: null,
      reason: `Erreur inattendue lors du décodage de l'image (${err instanceof Error ? err.message : "erreur inconnue"}).`,
    };
  }
}

/** Wrapper booléen pour usage direct dans un `.refine()` Zod. */
export function isDecodableImage(dataUrl: string): boolean {
  return decodeImageDataUrl(dataUrl).ok;
}

// ---------------------------------------------------------------------------
// PNG
// ---------------------------------------------------------------------------

function decodePng(buffer: Buffer): ImageDecodeResult {
  if (buffer.length < 8 || !buffer.subarray(0, 8).equals(PNG_SIGNATURE)) {
    return { ok: false, format: null, reason: "Signature PNG invalide." };
  }

  const idatChunks: Buffer[] = [];
  let sawIhdr = false;
  let offset = 8;

  while (offset + 8 <= buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString("ascii", offset + 4, offset + 8);
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;

    // Chunk annonçant plus de données que ce qui est réellement disponible
    // (+ 4 octets de CRC) : fichier tronqué.
    if (length < 0 || dataEnd + 4 > buffer.length) {
      return { ok: false, format: "png", reason: "Fichier PNG tronqué (chunk incomplet)." };
    }

    if (type === "IHDR") {
      sawIhdr = true;
    } else if (type === "IDAT") {
      idatChunks.push(buffer.subarray(dataStart, dataEnd));
    } else if (type === "IEND") {
      offset = dataEnd + 4;
      break;
    }

    // CRC (4 octets) volontairement NON vérifié — cf. ADR-047 D1, point 6.
    offset = dataEnd + 4;
  }

  if (!sawIhdr) {
    return { ok: false, format: "png", reason: "Chunk IHDR manquant." };
  }
  if (idatChunks.length === 0) {
    return { ok: false, format: "png", reason: "Aucun chunk IDAT trouvé." };
  }

  // Piège documenté (ADR-047 D1) : un PNG réel a très souvent plusieurs
  // chunks IDAT. Concaténer TOUS les chunks AVANT l'inflate — inflater le
  // premier chunk seul produirait un FAUX POSITIF de rejet (flux zlib
  // tronqué mais pas réellement corrompu).
  const concatenatedIdat = Buffer.concat(idatChunks);

  try {
    // maxOutputLength : défense en profondeur anti-bombe zlib (voir
    // MAX_INFLATE_OUTPUT_BYTES ci-dessus pour la justification du seuil).
    // Si dépassé, Node lève une erreur `ERR_BUFFER_TOO_LARGE` — capturée
    // ci-dessous, jamais laissée s'échapper en exception non gérée. Ce cas
    // est distingué explicitement d'un vrai échec de décompression zlib :
    // l'image est structurellement valide, simplement plus volumineuse que
    // la borne de sécurité — un message "flux illisible / corrompu" serait
    // trompeur (voir review-sprint-PX.md Delta 1).
    zlib.inflateSync(concatenatedIdat, { maxOutputLength: MAX_INFLATE_OUTPUT_BYTES });
  } catch (err) {
    if (err instanceof Error && (err as NodeJS.ErrnoException).code === "ERR_BUFFER_TOO_LARGE") {
      return {
        ok: false,
        format: "png",
        reason:
          "Image trop volumineuse une fois décompressée (limite de sécurité dépassée) — réduisez la résolution avant l'envoi.",
      };
    }
    return {
      ok: false,
      format: "png",
      reason: `Flux IDAT illisible (${err instanceof Error ? err.message : "erreur zlib"}).`,
    };
  }

  return { ok: true, format: "png" };
}

// ---------------------------------------------------------------------------
// JPEG
// ---------------------------------------------------------------------------

function decodeJpeg(buffer: Buffer): ImageDecodeResult {
  if (buffer.length < 4) {
    return { ok: false, format: "jpeg", reason: "Fichier JPEG trop court." };
  }

  const hasSoi = buffer[0] === 0xff && buffer[1] === 0xd8;
  const hasEoi =
    buffer[buffer.length - 2] === 0xff && buffer[buffer.length - 1] === 0xd9;

  if (!hasSoi || !hasEoi) {
    return { ok: false, format: "jpeg", reason: "Marqueurs JPEG SOI/EOI manquants." };
  }

  return { ok: true, format: "jpeg" };
}
