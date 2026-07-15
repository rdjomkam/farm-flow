"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSavedFilterService } from "@/services/saved-filter.service";
import { queryKeys } from "@/lib/query-keys";
import type { SavedFilterPage } from "@/types";

export function useSavedFilters(page: SavedFilterPage) {
  const service = useSavedFilterService();
  return useQuery({
    queryKey: queryKeys.savedFilters.list(page),
    queryFn: async () => {
      const result = await service.listSavedFilters(page);
      if (!result.ok || !result.data) throw new Error("Failed to load saved filters");
      return result.data.data;
    },
    staleTime: 5 * 60_000,
  });
}

export function useCreateSavedFilter() {
  const service = useSavedFilterService();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (dto: { name: string; page: SavedFilterPage; filters: Record<string, unknown> }) => {
      const result = await service.createSavedFilter(dto);
      if (!result.ok) throw new Error(result.error ?? "Failed to create");
      return result.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.savedFilters.list(variables.page) });
    },
  });
}

export function useUpdateSavedFilter() {
  const service = useSavedFilterService();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      page,
      filters,
      name,
    }: {
      id: string;
      page: SavedFilterPage;
      filters?: Record<string, unknown>;
      name?: string;
    }) => {
      const result = await service.updateSavedFilter(id, filters, name);
      if (!result.ok) throw new Error(result.error ?? "Failed to update");
      return { id, page };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.savedFilters.list(data.page) });
    },
  });
}

export function useDeleteSavedFilter() {
  const service = useSavedFilterService();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, page }: { id: string; page: SavedFilterPage }) => {
      const result = await service.deleteSavedFilter(id);
      if (!result.ok) throw new Error("Failed to delete");
      return { id, page };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.savedFilters.list(data.page) });
    },
  });
}
