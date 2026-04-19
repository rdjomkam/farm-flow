"use client";

import { useCallback } from "react";
import { useTranslations } from "next-intl";
import { useApi } from "@/hooks/use-api";
import type { NotificationWithRelations } from "@/types";

// ---------------------------------------------------------------------------
// Types internes
// ---------------------------------------------------------------------------

interface NotificationListResult {
  notifications: NotificationWithRelations[];
}

interface NotificationCountResult {
  count: number;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

/**
 * useNotificationService — Appels API pour /api/notifications/**
 *
 * Note : getCount utilise silentLoading + silentError pour le polling
 * toutes les 60 secondes dans notification-bell.tsx — aucun impact visuel.
 */
export function useNotificationService() {
  const { call } = useApi();
  const t = useTranslations("alertes");

  /**
   * Récupère le nombre de notifications non lues.
   * Silencieux : ne déclenche ni la barre de chargement ni de toast d'erreur.
   */
  const getCount = useCallback(
    () =>
      call<NotificationCountResult>("/api/notifications/count", undefined, {
        silentLoading: true,
        silentError: true,
      }),
    [call]
  );

  const list = useCallback(
    () => call<NotificationListResult>("/api/notifications"),
    [call]
  );

  const markRead = useCallback(
    (id: string, statut: string = "LUE") =>
      call<{ message: string }>(
        `/api/notifications/${id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ statut }),
        }
      ),
    [call]
  );

  const markAllRead = useCallback(
    () =>
      call<{ message: string }>(
        "/api/notifications/mark-all-read",
        { method: "POST" },
        { successMessage: t("toasts.allRead") }
      ),
    [call, t]
  );

  return { getCount, list, markRead, markAllRead };
}
