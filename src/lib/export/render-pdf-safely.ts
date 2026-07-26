/**
 * Wrapper de rendu PDF inconditionnel — Sprint PX (ADR-047, D3 — révisé PX.3-bis).
 *
 * Défense en profondeur pour les 5 routes d'export PDF. `@react-pdf/renderer`
 * embarque `@react-pdf/pdfkit` et `@react-pdf/png-js`, dont un bug connu
 * (`zlib.inflate(buf, (err) => { if (err) throw err; ... })`) peut :
 * (1) laisser la promesse de `renderToBuffer()` ne JAMAIS se régler, ET
 * (2) faire s'échapper une exception au niveau `process` (uncaught
 * exception), hors de portée de tout `try/catch` applicatif — comportement
 * par défaut de Node : crash du worker.
 *
 * ---------------------------------------------------------------------------
 * RÉVISION PX.3-bis — passage FAIL-OPEN → FAIL-SAFE (voir ADR-047 §D3 mise à
 * jour pour la traçabilité complète de cette décision) :
 *
 * L'implémentation précédente (Sprint PX, story PX.3/PX.4) décidait de
 * capturer une exception UNIQUEMENT si son message/stack contenait un
 * marqueur connu (`png-js`, `pdfkit`, `@react-pdf`, `zlib`) — sinon elle
 * ré-émettait l'exception (`process.emit`), laissant le comportement fatal
 * par défaut de Node s'appliquer (crash du worker). C'était FAIL-OPEN : toute
 * exception dont la forme ne correspondait à aucun marqueur connu tuait le
 * worker, alors même qu'un rendu PDF était en vol au moment précis de
 * l'exception. Cette heuristique est structurellement incomplète : elle ne
 * couvre pas les futures versions de la librairie, ni un `throw` depuis un
 * worker/stream sans stack utile, ni une stack tronquée. Notre validateur
 * amont (`isDecodableImage`, zlib maison) et le décodeur réel de
 * `@react-pdf/png-js` NE SONT PAS le même code (cf. ADR-047 D1) : la
 * pré-validation ne peut jamais être la barrière ultime, donc ce filet aval
 * ne peut pas se permettre d'être conditionnel à une liste de marqueurs.
 *
 * Nouvelle politique, FAIL-SAFE : tant qu'au moins un rendu PDF est en vol
 * (refcount > 0), TOUTE exception non capturée est traitée comme attribuable
 * PAR DÉFAUT — jamais ré-émise, toujours journalisée avec son contexte
 * complet, et convertie en rejet `PdfRenderError({ code:
 * "UNCAUGHT_EXCEPTION" })`. Les marqueurs de stack (`KNOWN_PDF_STACK_MARKERS`)
 * ne sont plus une condition de capture : ils ne servent plus qu'à qualifier
 * le niveau de confiance dans le log (« attribution certaine » vs
 * « attribution par défaut »), à titre purement diagnostique.
 * ---------------------------------------------------------------------------
 *
 * MÉCANISME — refcount + listener PARTAGÉ UNIQUE :
 * Plusieurs rendus PDF peuvent être en vol simultanément sur le même worker
 * Node (Next.js sert des requêtes concurrentes par worker), et la librairie
 * ne permet d'attribuer une exception à AUCUN rendu précis avec certitude.
 * On installe donc UN SEUL listener `process.on('uncaughtException')`,
 * partagé par tous les rendus en cours, avec un compteur de rendus en vol
 * (`inFlightRenders`, un `Set` qui fait à la fois office de refcount et de
 * registre des rendus à faire échouer) :
 * - Le listener est installé quand le compteur passe de 0 à 1 (premier
 *   rendu qui démarre).
 * - Le listener est retiré quand le compteur retombe à 0 (dernier rendu en
 *   vol qui se règle, quelle qu'en soit la cause — résolution, rejet
 *   normal, timeout, ou capture d'une uncaughtException).
 * - JAMAIS N listeners empilés (éviterait le `MaxListenersExceededWarning`
 *   de Node au-delà de 10 rendus concurrents) : un seul listener existe à
 *   tout instant, quel que soit le nombre de rendus en vol.
 * - AUCUN rendu ne retire le listener d'un autre : le retrait n'est décidé
 *   qu'au niveau du compteur partagé (dernier arrivé retire), jamais par un
 *   rendu individuel qui se termine alors que d'autres sont encore en vol.
 *
 * POLITIQUE D'ATTRIBUTION QUAND PLUSIEURS RENDUS SONT EN VOL (décision
 * explicite, documentée) : la librairie ne permet pas d'attribuer une
 * exception uncaught à un rendu précis parmi N rendus concurrents. Le choix
 * sûr retenu ici est de faire échouer TOUS les rendus actuellement en vol
 * avec `PdfRenderError({ code: "UNCAUGHT_EXCEPTION" })` — mieux vaut N
 * réponses HTTP 500 explicites et journalisées qu'un worker mort qui
 * interromprait indistinctement toutes les requêtes en cours (y compris
 * celles qui n'ont rien à voir avec le rendu PDF). Ce choix est signalé
 * explicitement dans le log (nombre de rendus affectés, contexte de
 * chacun) et dans le message d'erreur retourné à l'appelant.
 *
 * FRONTIÈRE ASSUMÉE : si AUCUN rendu n'est en vol au moment de l'exception
 * (refcount à 0, donc listener déjà retiré), le comportement par défaut de
 * Node s'applique (log + crash). C'est VOULU : ce module ne doit jamais
 * devenir un handler `uncaughtException` global et permanent pour toute
 * l'application — sa portée doit rester strictement bornée à la fenêtre
 * d'un rendu PDF en cours.
 *
 * ---------------------------------------------------------------------------
 * GARANTIES EXPLICITES :
 *
 * G1 — LA REQUÊTE HTTP RÉPOND TOUJOURS.
 * Garanti INCONDITIONNELLEMENT par le timeout dur (`PDF_RENDER_TIMEOUT_MS`,
 * 15 secondes par défaut), indépendamment de toute capture d'exception : que
 * `renderFn()` se règle normalement, qu'une exception échappée soit captée
 * en fail-safe, ou qu'aucune des deux choses ne se produise, la promesse
 * retournée par `renderPdfSafely()` se règle au plus tard après
 * `timeoutMs`.
 *
 * G2 — UN RENDU PDF NE TUE JAMAIS LE WORKER.
 * Garanti par la capture fail-safe pendant toute la fenêtre où AU MOINS UN
 * rendu est en vol : aucune exception uncaught ne peut plus faire crasher le
 * process tant que le refcount est > 0, quelle que soit sa forme (message,
 * stack, ou absence de stack exploitable).
 *
 * LIMITES HONNÊTES QUI SUBSISTENT (assumées, pas des bugs) :
 * - Le timeout NE LIBÈRE PAS le rendu bloqué : si `renderFn()` ne se règle
 *   jamais par lui-même (callback orphelin type `zlib.inflate`), la mémoire
 *   associée à cet appel fuit jusqu'au passage du garbage collector — le
 *   timeout permet seulement à l'appelant de ne pas attendre indéfiniment.
 * - Une exception arrivant APRÈS le retour du DERNIER rendu en vol (refcount
 *   revenu à 0, listener déjà retiré) n'est PLUS couverte : le comportement
 *   Node par défaut s'applique alors. C'est la frontière documentée
 *   ci-dessus, pas un oubli.
 * - La pré-validation amont (`isDecodableImage` / `decodeImageDataUrl`, cf.
 *   ADR-047 D1) ne doit JAMAIS être supprimée sous prétexte que ce filet
 *   aval existe désormais en fail-safe : ce sont deux décodeurs différents
 *   (cf. tests `pdf-render-guard-unconditional.test.ts`), et la
 *   pré-validation reste la seule protection qui empêche l'ÉCRITURE d'une
 *   image corrompue en base — ce filet aval ne protège que la fenêtre du
 *   RENDU, jamais la qualité de la donnée stockée.
 */

export const PDF_RENDER_TIMEOUT_MS = 15_000;

export type PdfRenderErrorCode = "TIMEOUT" | "UNCAUGHT_EXCEPTION";

export class PdfRenderError extends Error {
  readonly code: PdfRenderErrorCode;

  constructor(message: string, code: PdfRenderErrorCode, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "PdfRenderError";
    this.code = code;
  }
}

export interface RenderPdfSafelyContext {
  route: string;
  documentType: string;
  documentId?: string;
}

export interface RenderPdfSafelyOptions {
  /** Défaut : PDF_RENDER_TIMEOUT_MS. */
  timeoutMs?: number;
  context: RenderPdfSafelyContext;
}

/**
 * Signatures (message / stack) connues des libs de rendu PDF vendues
 * (`@react-pdf/pdfkit`, `@react-pdf/png-js`) et du module `zlib` qu'elles
 * invoquent.
 *
 * IMPORTANT (révision PX.3-bis) : ces marqueurs ne sont PLUS une condition
 * de capture — ils servent UNIQUEMENT à qualifier le niveau de confiance
 * dans le log diagnostique ci-dessous (« attribution certaine » quand un
 * marqueur connu est présent, « attribution par défaut » sinon). La capture
 * elle-même est désormais inconditionnelle tant qu'un rendu est en vol
 * (fail-safe) — voir le commentaire d'en-tête du module.
 */
const KNOWN_PDF_STACK_MARKERS = ["png-js", "pdfkit", "@react-pdf", "zlib"];

function hasKnownPdfSignature(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const haystack = `${error.message ?? ""}\n${error.stack ?? ""}`;
  return KNOWN_PDF_STACK_MARKERS.some((marker) => haystack.includes(marker));
}

function contextLabel(context: RenderPdfSafelyContext): string {
  return `${context.route} (${context.documentType}${
    context.documentId ? `, id=${context.documentId}` : ""
  })`;
}

interface InFlightEntry {
  context: RenderPdfSafelyContext;
  /** Fait échouer CE rendu suite à une uncaughtException fail-safe. */
  failDueToUncaughtException: (error: unknown) => void;
}

/**
 * Registre des rendus PDF actuellement en vol sur ce worker. Sert à la fois
 * de refcount (sa taille) et de liste des rendus à faire échouer en cas
 * d'exception non capturée fail-safe. Un seul listener `uncaughtException`
 * partagé est installé/retiré en fonction de la taille de ce Set — jamais un
 * listener par rendu.
 */
const inFlightRenders = new Set<InFlightEntry>();

/**
 * Listener PARTAGÉ unique, installé quand `inFlightRenders` passe de 0 à 1
 * et retiré quand il retombe à 0. Politique FAIL-SAFE : toute exception
 * échappée pendant que ce listener est attaché est journalisée puis fait
 * échouer TOUS les rendus actuellement en vol (impossible d'attribuer avec
 * certitude l'exception à un seul rendu précis parmi plusieurs concurrents —
 * cf. commentaire d'en-tête du module pour la justification de ce choix).
 */
function sharedUncaughtExceptionHandler(error: unknown): void {
  const err = error instanceof Error ? error : new Error(String(error));
  const attribution = hasKnownPdfSignature(err) ? "certaine" : "par défaut (fail-safe)";
  const affected = [...inFlightRenders];
  const affectedLabels = affected.map((entry) => contextLabel(entry.context));

  console.error(
    `[renderPdfSafely] Exception non capturée pendant ${affected.length} rendu(s) PDF en vol ` +
      `(attribution ${attribution}). Rendu(s) affecté(s) : ${
        affectedLabels.join(", ") || "aucun"
      }. ` +
      `Politique fail-safe : tous les rendus en vol listés ci-dessus sont mis en échec ` +
      `(PdfRenderError/UNCAUGHT_EXCEPTION) plutôt que de laisser le worker mourir. ` +
      `Message : ${err.message}`,
    err
  );

  // Snapshot avant itération : chaque failDueToUncaughtException() retire
  // son entrée du Set en cours de route (via cleanup), il ne faut donc pas
  // itérer directement sur `inFlightRenders` pendant sa propre mutation.
  for (const entry of affected) {
    entry.failDueToUncaughtException(err);
  }
}

/**
 * Enveloppe un appel `renderToBuffer` (ou équivalent) avec :
 * 1. un timeout dur (`PDF_RENDER_TIMEOUT_MS` par défaut) — garantit G1 ;
 * 2. une capture fail-safe des exceptions `uncaughtException` survenant
 *    tant qu'au moins un rendu est en vol (refcount partagé, listener
 *    unique) — garantit G2.
 *
 * Ne masque JAMAIS silencieusement une exception : toute exception captée
 * par le listener partagé est journalisée (niveau `error`, avec le contexte
 * complet de chaque rendu affecté) puis transformée en rejet
 * `PdfRenderError({ code: "UNCAUGHT_EXCEPTION" })`.
 *
 * Un rejet NORMAL de la promesse retournée par `renderFn()` (ex. erreur
 * métier, DTO invalide) n'est jamais intercepté par ce mécanisme : il
 * remonte inchangé à l'appelant.
 */
export function renderPdfSafely(
  renderFn: () => Promise<Buffer>,
  options: RenderPdfSafelyOptions
): Promise<Buffer> {
  const timeoutMs = options.timeoutMs ?? PDF_RENDER_TIMEOUT_MS;
  const { context } = options;
  const label = contextLabel(context);

  return new Promise<Buffer>((resolve, reject) => {
    let settled = false;
    let timeoutHandle: ReturnType<typeof setTimeout> | undefined;

    const entry: InFlightEntry = {
      context,
      failDueToUncaughtException: (error) => {
        settleOnce(() => {
          reject(
            new PdfRenderError(
              "Le document PDF n'a pas pu être généré (erreur interne du moteur de rendu).",
              "UNCAUGHT_EXCEPTION",
              { cause: error }
            )
          );
        });
      },
    };

    function cleanup() {
      if (timeoutHandle) clearTimeout(timeoutHandle);
      inFlightRenders.delete(entry);
      // Retrait du listener PARTAGÉ uniquement quand le DERNIER rendu en vol
      // se règle — jamais par un rendu individuel tant que d'autres sont
      // encore en cours. Le refcount est la taille du Set lui-même.
      if (inFlightRenders.size === 0) {
        process.removeListener("uncaughtException", sharedUncaughtExceptionHandler);
      }
    }

    function settleOnce(action: () => void) {
      if (settled) return;
      settled = true;
      cleanup();
      action();
    }

    // Installation du listener PARTAGÉ uniquement au passage 0 -> 1 : si un
    // ou plusieurs rendus sont déjà en vol, on réutilise le listener existant
    // (jamais de doublon, jamais de MaxListenersExceededWarning).
    inFlightRenders.add(entry);
    if (inFlightRenders.size === 1) {
      process.on("uncaughtException", sharedUncaughtExceptionHandler);
    }

    timeoutHandle = setTimeout(() => {
      settleOnce(() => {
        reject(
          new PdfRenderError(
            `Délai dépassé lors de la génération du PDF (${label}).`,
            "TIMEOUT"
          )
        );
      });
    }, timeoutMs);

    renderFn()
      .then((buffer) => {
        settleOnce(() => resolve(buffer));
      })
      .catch((error: unknown) => {
        settleOnce(() => reject(error));
      });
  });
}
