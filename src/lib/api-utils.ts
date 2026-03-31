import { NextResponse } from "next/server";
import type { ApiErrorResponse } from "@/types";

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
