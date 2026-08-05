"use client";

import { useCallback } from "react";
import { useToast } from "@/components/ui/toast";
import { useGlobalLoading } from "@/contexts/global-loading.context";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ApiCallOptions {
  silentError?: boolean;
  silentLoading?: boolean;
  successMessage?: string;
}

export interface ApiResult<T> {
  /** Données parsées (null si erreur) */
  data: T | null;
  /** Message d'erreur (null si succès) — inclut le detail par champ si l'API en a fourni un (voir `errors`). */
  error: string | null;
  /** true si la requête a réussi (res.ok) */
  ok: boolean;
  /** Code HTTP de la réponse (null si erreur réseau) */
  status?: number;
  /**
   * Erreurs de validation par champ, telles que renvoyées par `apiError()`
   * (`src/lib/api-utils.ts`, `errors?: Array<{ field, message }>`). Permet à
   * un appelant qui connaît le formulaire d'afficher l'erreur sur le champ
   * précis plutôt que de se fier uniquement au message générique.
   */
  errors?: Array<{ field: string; message: string }>;
  /**
   * Code machine stable (`ApiErrorResponse.code`, `src/lib/api-utils.ts`) —
   * permet à un appelant de mapper une erreur métier vers une clé i18n
   * locale plutôt que d'afficher `error` (le message serveur brut, jamais
   * garanti bilingue). Introduit pour ADR-053 §16.12 (codes
   * `POSTE_REFERENTIEL_*`), généralisé (aucun champ réservé à un seul
   * usage).
   */
  code?: string;
  /**
   * Payload structuré optionnel, propre à un `code` donné
   * (`ApiErrorResponse.details`, ADR-053 §16.12) — ex.
   * `{ posteReferentielExistant: { id, libelle } }` sur les 409
   * `POSTE_REFERENTIEL_CODE_COLLISION`/`POSTE_REFERENTIEL_INACTIF`.
   */
  details?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * useApi — Hook de base pour tous les appels fetch client-side.
 *
 * Fonctionnalités :
 * - Incrémente/décrémente automatiquement le compteur de loading global
 * - Parse le JSON de réponse automatiquement
 * - Affiche un toast d'erreur automatiquement (sauf silentError)
 * - Retourne toujours ApiResult — jamais de throw non géré
 * - Gère les downloads (blob → fichier) via la méthode `download`
 *
 * NE PAS utiliser directement dans les composants.
 * Utiliser les services de domaine (useVagueService, useReleveService, etc.)
 *
 * @example
 * // Dans un service :
 * const { call } = useApi();
 * const result = await call<VagueResponse>("/api/vagues/123");
 * if (result.ok) { ... }
 */
export function useApi() {
  const { toast } = useToast();
  const { increment, decrement, incrementMutation, decrementMutation } = useGlobalLoading();

  /**
   * call — Effectue un appel fetch avec gestion automatique du loading et des erreurs.
   *
   * Pour les mutations (POST/PUT/PATCH/DELETE), utilise incrementMutation/decrementMutation
   * qui déclenche l'overlay bloquant. Pour les requêtes GET, utilise increment/decrement
   * qui déclenche uniquement la barre fine.
   */
  const call = useCallback(
    async <T>(
      url: string,
      init?: RequestInit,
      options?: ApiCallOptions
    ): Promise<ApiResult<T>> => {
      const {
        silentError = false,
        silentLoading = false,
        successMessage,
      } = options ?? {};

      const isMutation =
        init?.method !== undefined &&
        ["POST", "PUT", "PATCH", "DELETE"].includes(init.method.toUpperCase());

      if (!silentLoading) {
        if (isMutation) incrementMutation();
        else increment();
      }

      try {
        const res = await fetch(url, init);

        // Parser la réponse JSON si applicable
        let data: T | null = null;
        const contentType = res.headers.get("content-type") ?? "";
        if (contentType.includes("application/json")) {
          try {
            data = await res.json() as T;
          } catch {
            // Ignore JSON parse errors — data reste null
          }
        }

        if (!res.ok) {
          // Extraire le message d'erreur de la réponse
          const errorData = data as
            | (Record<string, string> & {
                errors?: Array<{ field: string; message: string }>;
                code?: string;
                details?: Record<string, unknown>;
              })
            | null;
          const baseMessage =
            errorData?.message ??
            errorData?.error ??
            `Erreur serveur (${res.status})`;

          // `errors` (400 de validation, cf. `parseBody`/`apiError` dans
          // `src/lib/api-utils.ts`) porte le detail par champ. Le message
          // generique seul ("Erreurs de validation.") ne dit jamais QUEL
          // champ est refuse — sur un formulaire de plusieurs dizaines de
          // champs, l'utilisateur ne peut pas deviner. On l'ajoute au
          // message affiche, sans rien retirer : le message generique reste
          // en tete, le detail par champ suit.
          const fieldErrors = Array.isArray(errorData?.errors) ? errorData.errors : [];
          const message =
            fieldErrors.length > 0
              ? `${baseMessage} ${fieldErrors.map((e) => `${e.field} : ${e.message}`).join(" ; ")}`
              : baseMessage;

          if (!silentError) {
            toast({ title: message, variant: "error" });
          }

          return {
            data: null,
            error: message,
            ok: false,
            status: res.status,
            errors: fieldErrors.length > 0 ? fieldErrors : undefined,
            code: errorData?.code,
            details: errorData?.details,
          };
        }

        if (successMessage) {
          toast({ title: successMessage, variant: "success" });
        }

        return { data, error: null, ok: true, status: res.status };
      } catch {
        const message = "Erreur réseau. Vérifiez votre connexion.";
        if (!silentError) {
          toast({ title: message, variant: "error" });
        }
        return { data: null, error: message, ok: false };
      } finally {
        if (!silentLoading) {
          if (isMutation) decrementMutation();
          else decrement();
        }
      }
    },
    [toast, increment, decrement, incrementMutation, decrementMutation]
  );

  /**
   * download — Télécharge un fichier depuis une URL API.
   *
   * Gère le flux blob → URL.createObjectURL → <a> click → cleanup.
   * Affiche un toast de succès avec le nom du fichier.
   * Affiche un toast d'erreur automatiquement.
   *
   * @returns true si le téléchargement a réussi, false sinon
   */
  const download = useCallback(
    async (
      url: string,
      filename: string,
      options?: Pick<ApiCallOptions, "silentLoading">
    ): Promise<boolean> => {
      const { silentLoading = false } = options ?? {};

      if (!silentLoading) increment();

      try {
        const res = await fetch(url);

        if (!res.ok) {
          let errorMsg = "Erreur lors du téléchargement";
          try {
            const data = await res.json();
            errorMsg = (data as Record<string, string>).error ??
              (data as Record<string, string>).message ??
              errorMsg;
          } catch { /* ignore */ }
          toast({ title: errorMsg, variant: "error" });
          return false;
        }

        const blob = await res.blob();
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = blobUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(blobUrl);

        toast({ title: `${filename} téléchargé`, variant: "success" });
        return true;
      } catch {
        toast({ title: "Erreur réseau lors du téléchargement", variant: "error" });
        return false;
      } finally {
        if (!silentLoading) decrement();
      }
    },
    [toast, increment, decrement]
  );

  return { call, download };
}
