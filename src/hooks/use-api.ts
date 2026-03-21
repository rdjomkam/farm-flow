"use client";

import { useCallback } from "react";
import { useToast } from "@/components/ui/toast";
import { useGlobalLoading } from "@/contexts/global-loading.context";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ApiCallOptions {
  /**
   * Ne pas afficher de toast en cas d'erreur.
   * A utiliser quand l'appelant gère l'erreur lui-même.
   */
  silentError?: boolean;
  /**
   * Ne pas contribuer au compteur de loading global.
   * A utiliser pour le polling silencieux (ex: notification-bell).
   */
  silentLoading?: boolean;
  /**
   * Message toast affiché en cas de succès.
   * Si absent, aucun toast de succès n'est affiché.
   */
  successMessage?: string;
  /** Enable offline queue for this mutation (POST/PUT/PATCH/DELETE) */
  offlineCapable?: boolean;
  /** Entity type for queue categorization (e.g. "releve", "vente") */
  entityType?: string;
  /** Human-readable label for queue display (e.g. "Relevé mortalité 12/03") */
  entityLabel?: string;
  /** Queue priority: 1=Critical, 2=Standard, 3=Low */
  priority?: 1 | 2 | 3;
}

export interface ApiResult<T> {
  /** Données parsées (null si erreur) */
  data: T | null;
  /** Message d'erreur (null si succès) */
  error: string | null;
  /** true si la requête a réussi (res.ok) */
  ok: boolean;
  /** True if item was queued offline instead of sent */
  offline?: boolean;
  /** Temporary ID assigned to offline item */
  tempId?: string;
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
  const { increment, decrement } = useGlobalLoading();

  /**
   * call — Effectue un appel fetch avec gestion automatique du loading et des erreurs.
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
        offlineCapable = false,
        entityType,
        entityLabel,
        priority,
      } = options ?? {};

      if (!silentLoading) increment();

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
          const errorData = data as Record<string, string> | null;
          const message =
            errorData?.message ??
            errorData?.error ??
            `Erreur serveur (${res.status})`;

          if (!silentError) {
            toast({ title: message, variant: "error" });
          }

          return { data: null, error: message, ok: false };
        }

        if (successMessage) {
          toast({ title: successMessage, variant: "success" });
        }

        return { data, error: null, ok: true };
      } catch {
        // Offline queue: if mutation + offlineCapable, queue instead of error
        if (
          offlineCapable &&
          init?.method &&
          ["POST", "PUT", "PATCH", "DELETE"].includes(init.method.toUpperCase())
        ) {
          try {
            // Get session info from cookie or session mirror
            const sessionRes = await fetch("/api/auth/session", { cache: "no-store" }).catch(() => null);
            let userId = "";
            let siteId = "";
            if (sessionRes?.ok) {
              const session = await sessionRes.json();
              userId = session.userId ?? "";
              siteId = session.activeSiteId ?? "";
            }

            if (userId && siteId) {
              const { enqueue } = await import("@/lib/offline/queue");
              const body = init.body ? JSON.parse(init.body as string) : null;
              const tempId = crypto.randomUUID();
              await enqueue({
                url,
                method: init.method,
                body,
                entityType: entityType ?? "unknown",
                entityLabel: entityLabel ?? url,
                priority: priority ?? 2,
                userId,
                siteId,
              });

              toast({ title: "Enregistré hors ligne", variant: "info" });
              return {
                data: { _offline: true, tempId } as T,
                error: null,
                ok: true,
                offline: true,
                tempId,
              };
            }
          } catch (queueError) {
            console.error("[Offline Queue] Failed to enqueue:", queueError);
          }
        }

        const message = "Erreur réseau. Vérifiez votre connexion.";
        if (!silentError) {
          toast({ title: message, variant: "error" });
        }
        return { data: null, error: message, ok: false };
      } finally {
        if (!silentLoading) decrement();
      }
    },
    [toast, increment, decrement]
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
