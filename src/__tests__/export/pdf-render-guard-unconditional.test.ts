/**
 * Preuve du garde-fou inconditionnel — Sprint PX (ADR-047).
 *
 * Mission explicite du PM : prouver que le garde-fou AVAL (`renderPdfSafely`,
 * ADR-047 D3-b) protège la requête HTTP INDÉPENDAMMENT de la validation AMONT
 * (`isDecodableImage`, ADR-047 D1). Les deux décodeurs ne sont PAS le même
 * code : notre validateur maison (`zlib.inflateSync` + parsing de chunks,
 * sans vérification CRC ni cohérence IHDR/données) peut juger une image
 * "décodable" alors que `@react-pdf/png-js` plante dessus au rendu réel.
 *
 * Ce fichier NE MOCKE PAS `@react-pdf/renderer` (contrairement à
 * `pdf-bon-livraison.test.ts`) : il appelle le VRAI moteur de rendu pour
 * prouver que le blocage historique (promesse jamais réglée + uncaught
 * exception process-level) ne peut plus se reproduire au niveau de la
 * requête HTTP, même si l'image franchit la pré-validation amont.
 *
 * Voir aussi :
 * - `src/lib/validation/__tests__/image-decode.test.ts` (tests unitaires du
 *   décodeur amont, hors périmètre de ce fichier — pas dupliqués ici).
 * - `src/__tests__/export/pdf-bon-livraison.test.ts` (cas nominaux, mock
 *   complet du renderer — rapide, pas concerné par ce bug).
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import zlib from "node:zlib";
import { StatutBonLivraison } from "@/types";
import type { CreateBonLivraisonPDFDTO } from "@/types/export";
import { isDecodableImage } from "@/lib/validation/image-decode";
import {
  renderPdfSafely,
  PdfRenderError,
  PDF_RENDER_TIMEOUT_MS,
} from "@/lib/export/render-pdf-safely";

// ---------------------------------------------------------------------------
// Fixture : PNG qui PASSE isDecodableImage() mais CASSE @react-pdf/png-js
// ---------------------------------------------------------------------------
//
// Piste retenue (parmi celles suggérées) : notre validateur amont vérifie
// uniquement que `zlib.inflateSync` réussit sur le flux IDAT concaténé — il
// ne vérifie ni le CRC des chunks, ni la cohérence entre les données
// décompressées et l'IHDR (dimensions, colorType), ni la validité de chaque
// octet de type de filtre PNG (0-4, spec RFC 2083 §6.2).
//
// `@react-pdf/png-js` (node_modules/@react-pdf/png-js/lib/png-js.js,
// fonction `pass()` dans `decodePixels()`) lit le premier octet de chaque
// ligne de balayage comme un "filter type" et fait un `switch` dessus ; le
// `default` de ce switch est : `throw new Error("Invalid filter algorithm: " + ...)`.
// Ce throw survient DANS le callback asynchrone `zlib.inflate(this.imgData,
// (err, data) => { ... })` — exactement la même famille de bug documentée
// par l'ADR-047 (throw dans un callback Node sans chaîne de promesse à
// rejeter → promesse jamais réglée + exception non interceptée au niveau
// process).
//
// En forgeant un flux PNG dont les octets de filtre valent 7 (invalide, la
// spec n'autorise que 0-4), on obtient une image dont l'IDAT est un flux
// zlib PARFAITEMENT VALIDE (notre `inflateSync` réussit → `isDecodableImage`
// retourne `true`), mais dont le CONTENU décompressé fait planter le
// décodeur pixel de `@react-pdf/png-js` au rendu réel.
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
    buf[8] = 8; // bit depth
    buf[9] = colorType; // 6 = RGBA — colorType qui déclenche splitAlphaChannel() -> decodePixels()
    buf[10] = 0;
    buf[11] = 0;
    buf[12] = 0; // interlace = none
    return buf;
  }

  const width = 4;
  const height = 4;
  const rowBytes = 1 + width * 4; // 1 octet de filtre + 4 octets RGBA par pixel
  const raw = Buffer.alloc(rowBytes * height, 0);
  // Octet de filtre invalide (7 — la spec PNG n'autorise que 0 à 4) en tête
  // de chaque ligne de balayage. Le flux compressé reste un zlib valide :
  // c'est le CONTENU, pas la compression, qui est incohérent.
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

function buildFullDTO(overrides: Partial<CreateBonLivraisonPDFDTO> = {}): CreateBonLivraisonPDFDTO {
  return {
    site: { name: "Ferme Test", address: "Douala, Cameroun" },
    numero: "BL-2026-099",
    statut: StatutBonLivraison.SIGNE,
    signeLe: new Date("2026-07-20T10:00:00Z"),
    venteNumero: "VTE-2026-099",
    rectifieDe: null,
    rectifiePar: null,
    client: { nom: "Jean Client", telephone: "+237600000000" },
    lignes: [
      {
        designation: "Silure",
        nomBac: "Bac A1",
        nombrePoissons: 200,
        poidsCommandeKg: 150,
        poidsLivreKg: 148,
        ecartKg: -2,
        nombreMortsTransport: 0,
        motifAvarie: null,
      },
    ],
    blocPaiement: { totalVente: 750000, paye: 300000, resteAPayer: 450000 },
    signatureClient: { image: null, nom: "Jean Client", date: new Date("2026-07-20T10:00:00Z") },
    signatureLivreur: { image: null, nom: "Paul Livreur", date: new Date("2026-07-20T10:00:00Z") },
    signaturePromoteur: { image: null, nom: null, date: null },
    cachet: null,
    dateGeneration: new Date("2026-07-21T08:00:00Z").toISOString(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Garde-fou de test : capture toute `uncaughtException` qui survient pendant
// un test de ce fichier — plutôt que de laisser Node appliquer son
// comportement fatal par défaut (qui tuerait le worker vitest), notre propre
// listener joue ici le rôle de "reste du monde process-level" (le
// comportement fatal par défaut de Node, OU un éventuel autre handler
// applicatif légitime — monitoring, Sentry, etc.).
//
// IMPORTANT — sémantique Node à connaître pour interpréter les compteurs
// ci-dessous : quand une exception non interceptée est émise, Node invoque
// TOUS les listeners `uncaughtException` actuellement enregistrés, PAS
// seulement le premier. Puisque notre listener de test est attaché AVANT
// l'appel à `renderPdfSafely()` (qui attache le sien en interne au début de
// son exécution), notre listener REÇOIT TOUJOURS l'émission INITIALE de
// l'exception. Ce n'est PAS un signe de fuite : c'est un artefact inévitable
// du multi-listener de Node. Le signal réellement significatif est le NOMBRE
// d'invocations :
//   - 1 invocation  = notre listener a vu l'émission initiale UNE SEULE
//     fois ; `renderPdfSafely` a absorbé l'exception en interne (capture
//     FAIL-SAFE par défaut, ADR-047 §D3 révisé PX.3-bis) SANS jamais la
//     ré-émettre — c'est désormais le SEUL comportement possible, quelle que
//     soit la forme (message/stack) de l'exception : aucune fuite.
//   - 2 invocations (ou plus) signalerait une régression vers l'ancien
//     comportement fail-open (ré-émission `process.emit` d'une exception
//     jugée "non attribuable") — ce cas ne doit plus jamais se produire
//     depuis PX.3-bis et n'est plus exercé par ce fichier de test (voir
//     `render-pdf-safely.test.ts` pour la politique fail-safe explicite en
//     cas de rendus concurrents).
// ---------------------------------------------------------------------------
let escapedExceptions: Error[] = [];
function captureEscapedExceptions(err: unknown) {
  escapedExceptions.push(err instanceof Error ? err : new Error(String(err)));
}

beforeEach(() => {
  escapedExceptions = [];
  process.on("uncaughtException", captureEscapedExceptions);
});

afterEach(() => {
  process.removeListener("uncaughtException", captureEscapedExceptions);
});

describe("Preuve — image qui passe la validation amont mais casse @react-pdf/png-js", () => {
  it("sanity check : la fixture est bien jugée décodable par notre validateur amont (isDecodableImage === true)", () => {
    const dataUrl = buildPngThatPassesUpstreamButBreaksReactPdf();
    expect(isDecodableImage(dataUrl)).toBe(true);
  });

  it(
    "le VRAI moteur @react-pdf/renderer plante sur cette fixture si on l'invoque sans le garde-fou aval (preuve que la piste est valide)",
    async () => {
      const { renderToBuffer, Document, Page, Image } = await import("@react-pdf/renderer");
      const React = await import("react");
      const dataUrl = buildPngThatPassesUpstreamButBreaksReactPdf();

      const el = React.createElement(
        Document,
        {},
        React.createElement(Page, { size: "A4" }, React.createElement(Image, { src: dataUrl }))
      );

      let settled = false;
      // IMPORTANT — cette promesse ne se règle JAMAIS (c'est tout le point de
      // ce test). Ne JAMAIS laisser cet appel "en l'air" au-delà du présent
      // test : le callback `zlib.inflate` orphelin va throw de façon
      // asynchrone et détachée — s'il fire APRÈS la fin de ce test (ex. sous
      // charge CPU en suite complète), notre listener de test attaché par le
      // `beforeEach` du test SUIVANT le capterait à tort (contamination
      // croisée entre tests, documentée en creux par ADR-047 D3 point 5 sur
      // la fuite de ressource résiduelle). On attend donc explicitement,
      // AVANT de terminer ce test, que l'exception se soit produite et ait
      // été drainée par notre listener local — jamais un `setTimeout` fixe
      // qui laisserait la promesse continuer à vivre après coup.
      renderToBuffer(el as never).then(() => {
        settled = true;
      });

      const deadline = Date.now() + 8000;
      while (escapedExceptions.length === 0 && Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 20));
      }

      // Le bug historique : la promesse renderToBuffer() ne se règle JAMAIS.
      expect(settled).toBe(false);
      // Et l'exception s'est bien échappée au niveau process (captée par
      // notre garde-fou de test, PAS par un try/catch applicatif) — DRAINÉE
      // ici, avant la fin de ce test, pour ne contaminer aucun test suivant.
      expect(escapedExceptions.length).toBeGreaterThan(0);
      expect(escapedExceptions[0]?.message).toMatch(/Invalid filter algorithm/i);
    },
    10000
  );

  it(
    "renderPdfSafely() protège le rendu réel de BonLivraisonPDF avec cette image : règlement borné, aucune exception ne s'échappe au process",
    async () => {
      const { renderBonLivraisonPDF } = await import("@/lib/export/pdf-bon-livraison");
      const dto = buildFullDTO({
        signatureClient: {
          image: buildPngThatPassesUpstreamButBreaksReactPdf(),
          nom: "Jean Client",
          date: new Date("2026-07-20T10:00:00Z"),
        },
      });

      const listenersBefore = process.listenerCount("uncaughtException");
      const start = Date.now();
      const result = await renderPdfSafely(() => renderBonLivraisonPDF(dto), {
        timeoutMs: 8000,
        context: { route: "test", documentType: "bon-livraison", documentId: dto.numero },
      }).then(
        (buffer) => ({ kind: "resolved" as const, buffer }),
        (error: unknown) => ({ kind: "rejected" as const, error })
      );
      const elapsedMs = Date.now() - start;

      // Règlement BORNÉ (jamais de promesse pendante), bien avant le timeout
      // dur (8s ici) : l'exception échappée est interceptée par le listener
      // scopé de renderPdfSafely (quasi immédiatement dans un environnement
      // non chargé), pas par le timeout. Marge généreuse pour tolérer la
      // contention CPU d'une exécution en suite complète (parallélisme
      // vitest) sans pour autant valider un "borné" qui serait en réalité
      // équivalent à un hang (8s reste très inférieur au PDF_RENDER_TIMEOUT_MS
      // de production, 15s).
      expect(elapsedMs).toBeLessThan(8000);

      // Le composant BonLivraisonPDF pré-valide déjà chaque image avec
      // isDecodableImage()/decodeImageDataUrl() (protection primaire,
      // ADR-047 D3-a) — MAIS notre fixture est spécifiquement construite
      // pour passer CETTE validation (sanity check ci-dessus). Le résultat
      // dépend donc uniquement du garde-fou AVAL :
      if (result.kind === "rejected") {
        expect(result.error).toBeInstanceOf(PdfRenderError);
        expect((result.error as InstanceType<typeof PdfRenderError>).code).toBe(
          "UNCAUGHT_EXCEPTION"
        );
      } else {
        // Si jamais la protection primaire interceptait quand même cette
        // image (ce que le sanity check ci-dessus réfute), le document se
        // génère simplement en mode dégradé — également un résultat sain.
        expect(result.buffer).toBeInstanceOf(Buffer);
      }

      // Preuve centrale de la mission : notre listener de test voit
      // l'exception EXACTEMENT une fois (dispatch initial inévitable, cf.
      // commentaire du garde-fou de test ci-dessus) — JAMAIS une seconde
      // fois. `renderPdfSafely` l'a donc attribuée avec certitude au rendu
      // en cours et absorbée en interne, sans la ré-émettre plus loin dans
      // le process. Et son propre listener a bien été retiré (pas de fuite).
      expect(escapedExceptions).toHaveLength(1);
      expect(escapedExceptions[0]?.message).toMatch(/Invalid filter algorithm/i);
      expect(process.listenerCount("uncaughtException")).toBe(listenersBefore);
    },
    10000
  );
});

describe("Preuve — renderPdfSafely() est un filet BORNÉ, indépendamment de la validation amont", () => {
  it(
    "renderFn qui lève une exception async ATTRIBUABLE (signature connue pdfkit/png-js/zlib) : rejette proprement, sans être ré-émise plus loin",
    async () => {
      const renderFn = () =>
        new Promise<Buffer>(() => {
          // Ne se règle JAMAIS — reproduit le comportement de
          // renderToBuffer() face au bug historique.
          setTimeout(() => {
            // Un vrai throw de zlib porte "zlib" dans son message et/ou sa
            // stack (confirmé empiriquement : `Inflate.zlibBufferOnEnd
            // (node:zlib:...)`). On simule ce cas ATTRIBUABLE en construisant
            // une erreur dont le message porte l'un des marqueurs connus de
            // `KNOWN_PDF_STACK_MARKERS` (render-pdf-safely.ts).
            throw new Error("zlib: incorrect data check (simulated pdfkit/png-js failure)");
          }, 20);
        });

      const listenersBefore = process.listenerCount("uncaughtException");
      const start = Date.now();
      await expect(
        renderPdfSafely(renderFn, {
          timeoutMs: 4000,
          context: { route: "test", documentType: "test" },
        })
      ).rejects.toMatchObject({ code: "UNCAUGHT_EXCEPTION" });
      expect(Date.now() - start).toBeLessThan(4000);
      // Vue UNE SEULE fois (dispatch initial inévitable) : pas de ré-émission.
      expect(escapedExceptions).toHaveLength(1);
      expect(process.listenerCount("uncaughtException")).toBe(listenersBefore);
    },
    6000
  );

  it(
    "renderFn qui ne se règle JAMAIS et ne throw jamais : rejette avec PdfRenderError(code: TIMEOUT) dans le délai imparti",
    async () => {
      const renderFn = () => new Promise<Buffer>(() => {});

      const start = Date.now();
      await expect(
        renderPdfSafely(renderFn, {
          timeoutMs: 500,
          context: { route: "test", documentType: "test" },
        })
      ).rejects.toMatchObject({ code: "TIMEOUT" });
      const elapsed = Date.now() - start;
      expect(elapsed).toBeGreaterThanOrEqual(480); // tolérance
      expect(elapsed).toBeLessThan(4000);
      expect(escapedExceptions).toHaveLength(0);
    },
    6000
  );

  it("la constante par défaut PDF_RENDER_TIMEOUT_MS vaut bien 15 000 ms", () => {
    expect(PDF_RENDER_TIMEOUT_MS).toBe(15_000);
  });

  it(
    "FIX PX.3-bis — reproduction EXACTE demandée (setTimeout qui throw hors chaîne de promesse, message générique 'incorrect data check') : " +
      "l'exception N'ÉCHAPPE PLUS au process même si son message/stack ne porte AUCUN marqueur connu (png-js/pdfkit/@react-pdf/zlib) — " +
      "renderPdfSafely la capture désormais PAR DÉFAUT (fail-safe, ADR-047 §D3 révisé) et produit un PdfRenderError " +
      "AVANT que le timeout n'ait la moindre chance de se déclencher.",
    async () => {
      const renderFn = () =>
        new Promise<Buffer>(() => {
          // Reproduction LITTÉRALE du pattern demandé par le PM, mimant la
          // signature de `zlib.zlibOnError` (throw asynchrone hors chaîne de
          // promesse). Message volontairement générique, SANS marqueur
          // reconnu par `KNOWN_PDF_STACK_MARKERS` — exactement le cas que
          // l'ancienne heuristique fail-open laissait s'échapper.
          setTimeout(() => {
            throw new Error("incorrect data check");
          }, 50);
        });

      const start = Date.now();
      const settled = await renderPdfSafely(renderFn, {
        timeoutMs: 800,
        context: { route: "test", documentType: "test" },
      }).then(
        () => ({ kind: "resolved" as const }),
        (error: unknown) => ({ kind: "rejected" as const, error })
      );
      const elapsed = Date.now() - start;

      // 1. Le wrapper reste BORNÉ et se règle bien AVANT le timeout dur
      //    (800ms) : l'exception, capturée par défaut quasi immédiatement
      //    après son émission (~50ms), produit UNCAUGHT_EXCEPTION — jamais
      //    TIMEOUT. C'est la preuve que la capture fail-safe agit avant même
      //    que le compte à rebours du timeout n'ait le temps d'expirer.
      expect(settled.kind).toBe("rejected");
      if (settled.kind === "rejected") {
        expect(settled.error).toBeInstanceOf(PdfRenderError);
        expect((settled.error as InstanceType<typeof PdfRenderError>).code).toBe(
          "UNCAUGHT_EXCEPTION"
        );
      }
      expect(elapsed).toBeLessThan(800);

      // 2. L'exception a été vue UNE SEULE FOIS par notre listener de test
      //    (dispatch initial inévitable, cf. garde-fou de test ci-dessus) —
      //    JAMAIS une seconde fois. `renderPdfSafely` ne ré-émet plus AUCUNE
      //    exception tant qu'un rendu est en vol : elle a été absorbée en
      //    interne (capture par défaut / fail-safe) et convertie en
      //    PdfRenderError, sans jamais atteindre le comportement fatal par
      //    défaut de Node. C'est exactement l'inversion du défaut de
      //    conception identifié par le PM (voir ADR-047 §D3, révision
      //    PX.3-bis) : plus aucune forme d'exception, connue ou non, ne peut
      //    faire mourir le worker tant qu'un rendu PDF est en vol.
      expect(escapedExceptions).toHaveLength(1);
      expect(escapedExceptions[0]?.message).toBe("incorrect data check");
    },
    6000
  );
});
