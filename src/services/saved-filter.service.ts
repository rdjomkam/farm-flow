"use client";

import { useCallback } from "react";
import { useApi } from "@/hooks/use-api";
import type { SavedFilter, SavedFilterPage } from "@/types";

export function useSavedFilterService() {
  const { call } = useApi();

  const listSavedFilters = useCallback(
    (page: SavedFilterPage) =>
      call<{ data: SavedFilter[] }>(`/api/saved-filters?page=${page}`),
    [call]
  );

  const createSavedFilter = useCallback(
    (dto: { name: string; page: SavedFilterPage; filters: Record<string, unknown> }) =>
      call<SavedFilter>("/api/saved-filters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dto),
      }),
    [call]
  );

  const updateSavedFilter = useCallback(
    (id: string, filters: Record<string, unknown>) =>
      call<SavedFilter>(`/api/saved-filters/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filters }),
      }),
    [call]
  );

  const deleteSavedFilter = useCallback(
    (id: string) =>
      call<{ ok: true }>(`/api/saved-filters/${id}`, { method: "DELETE" }),
    [call]
  );

  return { listSavedFilters, createSavedFilter, updateSavedFilter, deleteSavedFilter };
}
