"use client";

import { useCallback } from "react";
import { useApi } from "@/hooks/use-api";
import type { CreateReleveDTO, ReleveListResponse, PatchReleveResponse } from "@/types";

// ---------------------------------------------------------------------------
// Types internes
// ---------------------------------------------------------------------------

interface UpdateReleveDTO {
  raison: string;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

/**
 * useReleveService — Appels API pour /api/releves/**
 */
export function useReleveService() {
  const { call } = useApi();

  const list = useCallback(
    (params?: { vagueId?: string; bacId?: string; typeReleve?: string }) => {
      const qs = new URLSearchParams();
      if (params?.vagueId) qs.set("vagueId", params.vagueId);
      if (params?.bacId) qs.set("bacId", params.bacId);
      if (params?.typeReleve) qs.set("typeReleve", params.typeReleve);
      const query = qs.toString();
      return call<ReleveListResponse>(`/api/releves${query ? `?${query}` : ""}`);
    },
    [call]
  );

  const get = useCallback(
    (id: string) => call<PatchReleveResponse>(`/api/releves/${id}`),
    [call]
  );

  const create = useCallback(
    (dto: CreateReleveDTO) =>
      call<PatchReleveResponse>(
        "/api/releves",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(dto),
        },
        {
          successMessage: "Relevé enregistré !",
          offlineCapable: true,
          entityType: "releve",
          entityLabel: `Relevé ${dto.typeReleve?.toLowerCase() ?? ""}`,
          priority: dto.typeReleve === "MORTALITE" ? 1 : 2,
        }
      ),
    [call]
  );

  const update = useCallback(
    (id: string, dto: UpdateReleveDTO) =>
      call<PatchReleveResponse>(
        `/api/releves/${id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(dto),
        },
        { successMessage: "Relevé modifié." }
      ),
    [call]
  );

  const remove = useCallback(
    (id: string) =>
      call<{ message: string }>(
        `/api/releves/${id}`,
        { method: "DELETE" },
        { successMessage: "Relevé supprimé." }
      ),
    [call]
  );

  return { list, get, create, update, remove };
}
