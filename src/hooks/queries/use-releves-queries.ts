"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useReleveService } from "@/services";
import { queryKeys } from "@/lib/query-keys";
import type { CreateReleveDTO } from "@/types";

export function useRelevesList(
  filters?: { vagueId?: string; bacId?: string; typeReleve?: string },
  options?: { enabled?: boolean },
) {
  const releveService = useReleveService();

  return useQuery({
    queryKey: queryKeys.releves.list(filters),
    queryFn: async () => {
      const result = await releveService.list(filters);
      if (!result.ok || !result.data) throw new Error(result.error ?? "Erreur chargement relevés");
      return result.data;
    },
    staleTime: 60_000, // 1 min
    gcTime: 5 * 60_000,
    enabled: options?.enabled,
  });
}

export function useCreateReleve() {
  const queryClient = useQueryClient();
  const releveService = useReleveService();

  return useMutation({
    mutationFn: async (dto: CreateReleveDTO) => {
      const result = await releveService.create(dto);
      if (!result.ok) throw new Error(result.error ?? "Erreur création relevé");
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.releves.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.vagues.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all });
    },
  });
}

export function useUpdateReleve() {
  const queryClient = useQueryClient();
  const releveService = useReleveService();

  return useMutation({
    mutationFn: async ({ id, dto }: { id: string; dto: { raison: string; [key: string]: unknown } }) => {
      const result = await releveService.update(id, dto);
      if (!result.ok) throw new Error(result.error ?? "Erreur modification relevé");
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.releves.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.vagues.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all });
    },
  });
}

export function useDeleteReleve() {
  const queryClient = useQueryClient();
  const releveService = useReleveService();

  return useMutation({
    mutationFn: async (id: string) => {
      const result = await releveService.remove(id);
      if (!result.ok) throw new Error(result.error ?? "Erreur suppression relevé");
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.releves.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.vagues.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all });
    },
  });
}
