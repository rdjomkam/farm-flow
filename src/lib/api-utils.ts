import { NextResponse } from "next/server";
import type { ApiErrorResponse } from "@/types";
import { AuthError } from "@/lib/auth";
import { ForbiddenError } from "@/lib/permissions";

/**
 * Options supplementaires pour le helper apiError.
 */
export interface ApiErrorOptions {
  /** Code machine optionnel (ex: "NOT_FOUND_VAGUE", "QUOTA_DEPASSE"). */
  code?: string;
  /** Erreurs de validation par champ (utilisees pour les reponses 400). */
  errors?: Array<{ field: string; message: string }>;
}

/**
 * Helper qui construit une NextResponse d'erreur au format unifie ApiErrorResponse.
 *
 * Toutes les routes API doivent utiliser ce helper pour garantir que les erreurs
 * repondent toujours avec la meme structure :
 * `{ status, message, code?, errors? }`
 *
 * @param status  Code HTTP (400, 401, 403, 404, 409, 500, etc.)
 * @param message Message lisible en francais destine a l'utilisateur.
 * @param opts    Options optionnelles : code machine et/ou erreurs de validation.
 *
 * @example
 * // Erreur simple
 * return apiError(404, "Vague introuvable.");
 *
 * // Avec code machine
 * return apiError(401, "Non authentifie.", { code: "AUTH_UNAUTHORIZED" });
 *
 * // Avec erreurs de validation
 * return apiError(400, "Erreurs de validation.", {
 *   errors: [{ field: "nom", message: "Le champ est obligatoire." }],
 * });
 *
 * // Quota depasse (code + message personnalise)
 * return apiError(402, "Limite de vagues atteinte.", { code: "QUOTA_DEPASSE" });
 */
export function apiError(
  status: number,
  message: string,
  opts?: ApiErrorOptions
): NextResponse<ApiErrorResponse> {
  const body: ApiErrorResponse = { status, message };

  if (opts?.code !== undefined) {
    body.code = opts.code;
  }

  if (opts?.errors !== undefined && opts.errors.length > 0) {
    body.errors = opts.errors;
  }

  return NextResponse.json(body, { status });
}

/**
 * Options for handleApiError.
 */
export interface HandleApiErrorOptions {
  /** Additional message-substring → HTTP status mappings specific to this route. */
  statusMap?: Array<{ match: string | string[]; status: number }>;
  /** Error key for the 500 fallback response. */
  code?: string;
}

/**
 * Centralised catch-block handler for API routes.
 *
 * 1. AuthError  → 401 (no log — normal auth flow)
 * 2. ForbiddenError → 403 (no log — normal permission flow)
 * 3. Route-specific statusMap matches (checked first)
 * 4. Common message patterns:
 *    - "introuvable" / "n'existe pas" → 404
 *    - Prisma P2002 (unique constraint) → 409
 *    - "Impossible" / "deja assigne" / "déjà assigné" / "deja utilise" / "déjà utilisé"
 *      / "deja une" / "Transition invalide" / "n'est pas ACTIF"
 *      / "statut doit etre" → 409
 *    - "n'appartient pas" / "Stock insuffisant" / "n'est pas de categorie"
 *      / "negative" / "n'est pas couverte"
 *      / "plateforme" / "platform-level" → 400
 * 5. All other errors → console.error + 500 with fallbackMsg
 *
 * @param routeLabel  Label for logging (e.g. "POST /api/commandes/[id]/recevoir")
 * @param error       The caught error
 * @param fallbackMsg User-facing message for the 500 response
 * @param opts        Optional route-specific statusMap and error code
 */
export function handleApiError(
  routeLabel: string,
  error: unknown,
  fallbackMsg: string,
  opts?: HandleApiErrorOptions
): NextResponse<ApiErrorResponse> {
  // Auth / permission errors — no log (normal flow)
  if (error instanceof AuthError) {
    return apiError(401, error.message);
  }
  if (error instanceof ForbiddenError) {
    return apiError(403, error.message);
  }

  const message = error instanceof Error ? error.message : "Erreur serveur.";

  // Prisma unique constraint violation (P2002) → 409
  if (
    error !== null &&
    typeof error === "object" &&
    "code" in error &&
    (error as { code: unknown }).code === "P2002"
  ) {
    return apiError(409, message || "Cette valeur existe déjà.");
  }

  // Route-specific mappings (highest priority)
  if (opts?.statusMap) {
    for (const { match, status } of opts.statusMap) {
      const patterns = Array.isArray(match) ? match : [match];
      if (patterns.some((p) => message.includes(p))) {
        return apiError(status, message);
      }
    }
  }

  // Common 404 patterns
  if (message.includes("introuvable") || message.includes("n'existe pas")) {
    return apiError(404, message);
  }

  // Common 409 patterns
  if (
    message.includes("Impossible") ||
    message.includes("deja assigne") ||
    message.includes("déjà assigné") ||
    message.includes("deja utilise") ||
    message.includes("déjà utilisé") ||
    message.includes("deja une") ||
    message.includes("Transition invalide") ||
    message.includes("n'est pas ACTIF") ||
    message.includes("statut doit etre")
  ) {
    return apiError(409, message);
  }

  // Common 400 patterns
  if (
    message.includes("n'appartient pas") ||
    message.includes("Stock insuffisant") ||
    message.includes("n'est pas de categorie") ||
    message.includes("negative") ||
    message.includes("n'est pas couverte") ||
    message.includes("plateforme") ||
    message.includes("platform-level")
  ) {
    return apiError(400, message);
  }

  // Unexpected error — log + 500
  console.error(`[${routeLabel}]`, error);
  return apiError(500, fallbackMsg, opts?.code ? { code: opts.code } : undefined);
}
