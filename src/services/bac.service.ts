"use client";

import { useCallback } from "react";
import { useApi } from "@/hooks/use-api";
import type { BacResponse, BacListResponse, CreateBacDTO, UpdateBacDTO } from "@/types";

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

/**
 * useBacService — Appels API pour /api/bacs/**
 */
export function useBacService() {
  const { call } = useApi();

  const list = useCallback(
    (params?: { vagueId?: string }) => {
      const qs = params?.vagueId
        ? `?vagueId=${encodeURIComponent(params.vagueId)}`
        : "";
      return call<BacListResponse>(`/api/bacs${qs}`);
    },
    [call]
  );

  const listByVague = useCallback(
    (vagueId: string) =>
      call<BacListResponse>(`/api/bacs?vagueId=${encodeURIComponent(vagueId)}`),
    [call]
  );

  const create = useCallback(
    (dto: CreateBacDTO) =>
      call<BacResponse>(
        "/api/bacs",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(dto),
        },
        { successMessage: "Bac créé avec succès !" }
      ),
    [call]
  );

  const update = useCallback(
    (id: string, dto: UpdateBacDTO) =>
      call<BacResponse>(
        `/api/bacs/${id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(dto),
        },
        { successMessage: "Bac modifié." }
      ),
    [call]
  );

  return { list, listByVague, create, update };
}
