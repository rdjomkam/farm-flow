/**
 * Tests — renderPdfSafely() (Sprint PX, story PX.4 — ADR-047 D3).
 *
 * Couvre les 4 garanties exigées par PX.3/PX.4 :
 * 1. Timeout dur atteint → PdfRenderError({ code: "TIMEOUT" }).
 * 2. Exception échappée attribuable au rendu en cours (signature pdfkit/
 *    png-js/@react-pdf/zlib dans le message ou la stack) → PdfRenderError
 *    ({ code: "UNCAUGHT_EXCEPTION" }), le listener process est retiré après
 *    (jamais laissé attaché).
 * 3. Rendus concurrents : le listener d'un rendu ne casse pas l'autre.
 * 4. Un rejet normal de la promesse de rendu (erreur légitime, pas une
 *    uncaughtException) remonte inchangé — n'est jamais masqué en
 *    PdfRenderError.
 *
 * Ces tests manipulent volontairement `process.on('uncaughtException')` —
 * chaque test qui déclenche une exception process-level vérifie explicitement
 * qu'aucun listener du wrapper ne reste attaché après coup (fuite de listener
 * = risque d'accumulation en production, un worker sert des milliers de
 * requêtes).
 */

import { describe, it, expect, afterEach } from "vitest";
import {
  renderPdfSafely,
  PdfRenderError,
  PDF_RENDER_TIMEOUT_MS,
} from "../render-pdf-safely";

function listenerCount(): number {
  return process.listenerCount("uncaughtException");
}

describe("renderPdfSafely — cas nominal", () => {
  it("résout avec le Buffer produit par renderFn en cas de succès", async () => {
    const before = listenerCount();
    const buffer = await renderPdfSafely(
      async () => Buffer.from("fake-pdf"),
      { context: { route: "test-route", documentType: "test-doc" } }
    );
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.toString()).toBe("fake-pdf");
    // Le listener attaché pendant le rendu doit être retiré après résolution.
    expect(listenerCount()).toBe(before);
  });
});

describe("renderPdfSafely — timeout dur", () => {
  it("rejette avec PdfRenderError({ code: 'TIMEOUT' }) si le délai est dépassé", async () => {
    const before = listenerCount();
    const neverResolves = () => new Promise<Buffer>(() => {});

    await expect(
      renderPdfSafely(neverResolves, {
        timeoutMs: 50,
        context: { route: "test-route", documentType: "test-doc", documentId: "doc-1" },
      })
    ).rejects.toMatchObject({
      name: "PdfRenderError",
      code: "TIMEOUT",
    });

    // Le listener uncaughtException doit être retiré même après un timeout
    // (portée temporelle minimale — ADR-047 D3, garde-fou 1).
    expect(listenerCount()).toBe(before);
  });

  it("PDF_RENDER_TIMEOUT_MS vaut 15 secondes (constante unique, référencée par les tests)", () => {
    expect(PDF_RENDER_TIMEOUT_MS).toBe(15_000);
  });
});

describe("renderPdfSafely — exception échappée attribuable au rendu", () => {
  it(
    "transforme une exception process-level portant une signature pdfkit/png-js en " +
      "PdfRenderError({ code: 'UNCAUGHT_EXCEPTION' }), et retire son listener après",
    async () => {
      const before = listenerCount();

      const renderFn = () =>
        new Promise<Buffer>(() => {
          // Simule EXACTEMENT le bug de production : un callback asynchrone
          // Node (setTimeout ici, zlib.inflate en réalité) qui `throw` au
          // lieu de rejeter une promesse — la promesse ci-dessus ne se
          // règle donc jamais par elle-même.
          setTimeout(() => {
            throw new Error("incorrect data check Z_DATA_ERROR (from png-js decodePixels)");
          }, 5);
        });

      await expect(
        renderPdfSafely(renderFn, {
          context: { route: "test-route", documentType: "test-doc" },
        })
      ).rejects.toMatchObject({
        name: "PdfRenderError",
        code: "UNCAUGHT_EXCEPTION",
      });

      expect(listenerCount()).toBe(before);
    }
  );

  it("le PdfRenderError résultant est bien une instance de PdfRenderError avec .cause renseigné", async () => {
    const renderFn = () =>
      new Promise<Buffer>(() => {
        setTimeout(() => {
          throw new Error("zlib inflate failed inside pdfkit PNGImage.embed");
        }, 5);
      });

    try {
      await renderPdfSafely(renderFn, {
        context: { route: "test-route", documentType: "test-doc" },
      });
      expect.unreachable("renderPdfSafely aurait dû rejeter");
    } catch (err) {
      expect(err).toBeInstanceOf(PdfRenderError);
      expect((err as PdfRenderError).code).toBe("UNCAUGHT_EXCEPTION");
      expect((err as PdfRenderError).cause).toBeInstanceOf(Error);
    }
  });
});

describe("renderPdfSafely — rendus concurrents", () => {
  it(
    "un rendu B qui se termine AVANT l'exception d'un rendu A concurrent n'est pas affecté " +
      "(il s'est déjà retiré du registre en vol au moment où l'exception de A survient)",
    async () => {
      const before = listenerCount();

      const succeedingRenderFn = () =>
        new Promise<Buffer>((resolve) => {
          // Se règle et se retire du registre en vol AVANT l'exception du rendu A.
          setTimeout(() => resolve(Buffer.from("ok-pdf")), 5);
        });

      const failingRenderFn = () =>
        new Promise<Buffer>(() => {
          setTimeout(() => {
            throw new Error("png-js zlib.inflate corrupted stream");
          }, 30);
        });

      const [succeeding, failing] = await Promise.allSettled([
        renderPdfSafely(succeedingRenderFn, {
          context: { route: "route-B", documentType: "doc-B" },
        }),
        renderPdfSafely(failingRenderFn, {
          context: { route: "route-A", documentType: "doc-A" },
        }),
      ]);

      expect(succeeding.status).toBe("fulfilled");
      if (succeeding.status === "fulfilled") {
        expect(succeeding.value.toString()).toBe("ok-pdf");
      }

      expect(failing.status).toBe("rejected");
      if (failing.status === "rejected") {
        expect(failing.reason).toBeInstanceOf(PdfRenderError);
        expect((failing.reason as PdfRenderError).code).toBe("UNCAUGHT_EXCEPTION");
      }

      // Le listener partagé (unique, quel que soit le nombre de rendus en
      // vol) a bien été retiré une fois le dernier rendu réglé.
      expect(listenerCount()).toBe(before);
    }
  );

  // -------------------------------------------------------------------------
  // FIX (Sprint PX.3-bis) — voir docs/decisions/ADR-047-robustesse-rendu-pdf.md
  // §D3 (révision fail-open -> fail-safe) et docs/tests/rapport-sprint-PX.md.
  //
  // Politique d'attribution EXPLICITE quand plusieurs rendus sont en vol
  // simultanément : la librairie ne permet pas d'attribuer une exception
  // uncaught à un rendu précis parmi N rendus concurrents. Le choix RETENU
  // (fail-safe) est de faire échouer TOUS les rendus en vol au moment de
  // l'exception — y compris un rendu B qui, individuellement, n'a rencontré
  // aucune erreur. C'est un compromis assumé et documenté : mieux vaut une
  // réponse HTTP 500 explicite et journalisée pour B qu'un worker mort qui
  // interromprait indistinctement toutes les requêtes du worker (y compris
  // celles sans rapport avec le rendu PDF). Ce test vérifie ce comportement
  // VOULU, pas un défaut à corriger.
  // -------------------------------------------------------------------------
  it(
    "POLITIQUE FAIL-SAFE VOULUE : un rendu B encore en vol au moment de l'exception de A " +
      "est mis en échec par la politique d'attribution par défaut (aucun n'a été absorbé " +
      "silencieusement ; aucun worker mort)",
    async () => {
      const before = listenerCount();

      const failingRenderFn = () =>
        new Promise<Buffer>(() => {
          setTimeout(() => {
            throw new Error("png-js zlib.inflate corrupted stream");
          }, 10);
        });

      const healthyRenderFn = () =>
        new Promise<Buffer>((resolve) => {
          // B est TOUJOURS en vol (registre partagé pas encore vidé) quand
          // l'exception de A survient à 10ms.
          setTimeout(() => resolve(Buffer.from("ok-pdf")), 30);
        });

      const [failing, healthy] = await Promise.allSettled([
        renderPdfSafely(failingRenderFn, {
          context: { route: "route-A", documentType: "doc-A" },
        }),
        renderPdfSafely(healthyRenderFn, {
          context: { route: "route-B", documentType: "doc-B" },
        }),
      ]);

      expect(failing.status).toBe("rejected");
      if (failing.status === "rejected") {
        expect(failing.reason).toBeInstanceOf(PdfRenderError);
        expect((failing.reason as PdfRenderError).code).toBe("UNCAUGHT_EXCEPTION");
      }

      // Politique fail-safe assumée : B échoue aussi, explicitement, plutôt
      // que le worker ne meure. Voir commentaire ci-dessus.
      expect(healthy.status).toBe("rejected");
      if (healthy.status === "rejected") {
        expect(healthy.reason).toBeInstanceOf(PdfRenderError);
        expect((healthy.reason as PdfRenderError).code).toBe("UNCAUGHT_EXCEPTION");
      }

      expect(listenerCount()).toBe(before);
    }
  );

  it(
    "un seul listener partagé est installé pour N rendus concurrents (pas un par rendu) " +
      "et il est retiré uniquement quand le DERNIER rendu en vol se règle",
    async () => {
      const before = listenerCount();

      const makeRenderFn = (delayMs: number) => () =>
        new Promise<Buffer>((resolve) => {
          setTimeout(() => resolve(Buffer.from("ok-pdf")), delayMs);
        });

      const p1 = renderPdfSafely(makeRenderFn(10), {
        context: { route: "route-1", documentType: "doc-1" },
      });
      const p2 = renderPdfSafely(makeRenderFn(20), {
        context: { route: "route-2", documentType: "doc-2" },
      });
      const p3 = renderPdfSafely(makeRenderFn(30), {
        context: { route: "route-3", documentType: "doc-3" },
      });

      // 3 rendus en vol simultanément : un seul listener partagé installé,
      // jamais 3 (avant = before, avant+1 = un seul listener supplémentaire).
      expect(listenerCount()).toBe(before + 1);

      await Promise.all([p1, p2, p3]);

      // Après que le DERNIER rendu se soit réglé, le listener partagé est
      // retiré — retour exact au compte initial, aucune fuite.
      expect(listenerCount()).toBe(before);
    }
  );
});

describe("renderPdfSafely — erreur légitime (rejet normal de la promesse de rendu)", () => {
  it("un rejet normal de renderFn (ex. DTO invalide) remonte INCHANGÉ, jamais masqué en PdfRenderError", async () => {
    const before = listenerCount();
    const legitimateError = new Error("DTO invalide : champ 'numero' manquant");

    await expect(
      renderPdfSafely(
        async () => {
          throw legitimateError;
        },
        { context: { route: "test-route", documentType: "test-doc" } }
      )
    ).rejects.toBe(legitimateError);

    expect(listenerCount()).toBe(before);
  });

  it("un rejet normal via Promise.reject() (pas un throw synchrone) remonte aussi inchangé", async () => {
    const legitimateError = new Error("Erreur métier normale, non liée au rendu PDF");

    await expect(
      renderPdfSafely(() => Promise.reject(legitimateError), {
        context: { route: "test-route", documentType: "test-doc" },
      })
    ).rejects.toBe(legitimateError);
  });
});

describe("renderPdfSafely — attribution FAIL-SAFE (révision PX.3-bis, ADR-047 §D3)", () => {
  it(
    "une exception process-level survenant pendant la fenêtre mais SANS signature connue " +
      "pdfkit/png-js/@react-pdf/zlib est désormais capturée PAR DÉFAUT (fail-safe) — " +
      "JAMAIS ré-émise vers le process, JAMAIS laissée tuer le worker",
    async () => {
      const before = listenerCount();

      const unrelatedError = new Error(
        "Erreur générique, sans marqueur connu (ex. bug potentiel dans une autre requête)"
      );

      const renderFn = () =>
        new Promise<Buffer>((resolve) => {
          // Reproduction du pattern historique : un callback asynchrone throw
          // hors chaîne de promesse, avec un message générique ne portant
          // AUCUN des marqueurs de KNOWN_PDF_STACK_MARKERS. Avant PX.3-bis,
          // ce cas était fail-open (ré-émission -> crash du worker si aucun
          // autre listener n'existait). Depuis PX.3-bis : capturé par défaut.
          setTimeout(() => {
            throw unrelatedError;
          }, 5);
          // Cette promesse ne se serait jamais réglée par elle-même (bug
          // reproduit), donc SEULE la capture fail-safe permet à
          // renderPdfSafely() de se régler malgré tout.
          setTimeout(() => resolve(Buffer.from("ok-pdf")), 200);
        });

      await expect(
        renderPdfSafely(renderFn, {
          context: { route: "test-route", documentType: "test-doc" },
        })
      ).rejects.toMatchObject({
        name: "PdfRenderError",
        code: "UNCAUGHT_EXCEPTION",
      });

      // Aucune fuite de listener : le listener partagé est retiré dès que
      // le (seul) rendu en vol a été réglé par la capture fail-safe.
      expect(listenerCount()).toBe(before);
    }
  );
});

afterEach(() => {
  // Garde-fou de test : si un test précédent laissait un listener orphelin
  // (bug du wrapper ou bug du test lui-même), les tests suivants de CE
  // fichier échoueraient sur leurs propres assertions listenerCount() —
  // rien à nettoyer ici explicitement, ce commentaire documente l'invariant.
});
