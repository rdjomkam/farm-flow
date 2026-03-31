"use client";

import { useCallback } from "react";
import { useApi } from "@/hooks/use-api";
import type { ActiviteWithRelations, CreateActiviteDTO } from "@/types";

// ---------------------------------------------------------------------------
// Types internes
// ---------------------------------------------------------------------------

interface ActiviteListResult {
  data: ActiviteWithRelations[];
  total: number;
  limit: number;
  offset: number;
}

interface ActiviteCountResult {
  count: number;
}

interface CompleterActiviteDTO {
  releveId?: string;
  notes?: string;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

/**
 * useActiviteService — Appels API pour /api/activites/**
 */
export function useActiviteService() {
  const { call } = useApi();

  const list = useCallback(
    (params?: {
      vagueId?: string;
      typeActivite?: string;
      statut?: string;
      dateDebut?: string;
      dateFin?: string;
    }) => {
      const qs = new URLSearchParams();
      if (params?.vagueId) qs.set("vagueId", params.vagueId);
      if (params?.typeActivite) qs.set("typeActivite", params.typeActivite);
      if (params?.statut) qs.set("statut", params.statut);
      if (params?.dateDebut) qs.set("dateDebut", params.dateDebut);
      if (params?.dateFin) qs.set("dateFin", params.dateFin);
      const query = qs.toString();
      return call<ActiviteListResult>(`/api/activites${query ? `?${query}` : ""}`);
    },
    [call]
  );

  const getAujourdhui = useCallback(
    () => call<ActiviteListResult>("/api/activites/aujourdhui"),
    [call]
  );

  const getMesTaches = useCallback(
    () => call<ActiviteListResult>("/api/activites/mes-taches"),
    [call]
  );

  /**
   * Récupère le nombre de tâches assignées à l'utilisateur courant.
   * Silencieux : ne déclenche pas la barre de chargement (utilisé en polling).
   */
  const getMesTachesCount = useCallback(
    () =>
      call<ActiviteCountResult>("/api/activites/mes-taches/count", undefined, {
        silentLoading: true,
        silentError: true,
      }),
    [call]
  );

  const create = useCallback(
    (dto: CreateActiviteDTO) =>
      call<ActiviteWithRelations>(
        "/api/activites",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(dto),
        },
        { successMessage: "Activité planifiée." }
      ),
    [call]
  );

  const complete = useCallback(
    (id: string, dto: CompleterActiviteDTO) =>
      call<ActiviteWithRelations>(
        `/api/activites/${id}/complete`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(dto),
        },
        { successMessage: "Activité complétée." }
      ),
    [call]
  );

  const update = useCallback(
    (id: string, body: Record<string, unknown>) =>
      call<ActiviteWithRelations>(
        `/api/activites/${id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
        { successMessage: "Activité modifiée." }
      ),
    [call]
  );

  const remove = useCallback(
    (id: string) =>
      call<{ message: string }>(
        `/api/activites/${id}`,
        { method: "DELETE" },
        { successMessage: "Activité supprimée." }
      ),
    [call]
  );

  const generer = useCallback(
    () =>
      call<{ generated: number }>(
        "/api/activites/generer",
        { method: "POST" },
        { successMessage: "Activités générées." }
      ),
    [call]
  );

  return { list, getAujourdhui, getMesTaches, getMesTachesCount, create, update, remove, complete, generer };
}
