"use client";

import { useCallback } from "react";
import { useApi } from "@/hooks/use-api";
import type {
  CreateVagueDTO,
  UpdateVagueDTO,
  VagueDetailResponse,
  VagueSummaryResponse,
  VagueListResponse,
  BacResponse,
  BacListResponse,
} from "@/types";

// ---------------------------------------------------------------------------
// Types internes
// ---------------------------------------------------------------------------

type VagueListResult = VagueListResponse;

interface CloturerDTO {
  dateFin: string;
  notes?: string;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

/**
 * useVagueService — Appels API pour /api/vagues/**
 *
 * @example
 * const vagueService = useVagueService();
 * const { data, ok } = await vagueService.create(dto);
 * if (ok) router.refresh();
 */
export function useVagueService() {
  const { call } = useApi();

  const list = useCallback(
    () => call<VagueListResult>("/api/vagues"),
    [call]
  );

  const get = useCallback(
    (id: string) => call<VagueDetailResponse>(`/api/vagues/${id}`),
    [call]
  );

  const create = useCallback(
    (dto: CreateVagueDTO) =>
      call<VagueDetailResponse>(
        "/api/vagues",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(dto),
        },
        { successMessage: "Vague créée avec succès !" }
      ),
    [call]
  );

  const update = useCallback(
    (id: string, dto: UpdateVagueDTO) =>
      call<VagueDetailResponse>(
        `/api/vagues/${id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(dto),
        },
        { successMessage: "Vague modifiée." }
      ),
    [call]
  );

  const cloture = useCallback(
    (id: string, dto: CloturerDTO) =>
      call<VagueDetailResponse>(
        `/api/vagues/${id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ statut: "TERMINEE", ...dto }),
        },
        { successMessage: "Vague clôturée." }
      ),
    [call]
  );

  const listBacs = useCallback(
    (vagueId: string) =>
      call<BacListResponse>(`/api/bacs?vagueId=${encodeURIComponent(vagueId)}`),
    [call]
  );

  return { list, get, create, update, cloture, listBacs };
}
