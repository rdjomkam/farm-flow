"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useVagueService } from "@/services";
import { queryKeys } from "@/lib/query-keys";
import type { VagueSummaryResponse, VagueDetailResponse, CreateVagueDTO, UpdateVagueDTO } from "@/types";

interface VagueListResult {
  data: VagueSummaryResponse[];
  total: number;
  limit: number;
  offset: number;
}

export function useVaguesList(
  filters?: Record<string, unknown>,
  options?: { initialData?: VagueSummaryResponse[] },
) {
  const vagueService = useVagueService();

  return useQuery({
    queryKey: queryKeys.vagues.list(filters),
    queryFn: async () => {
      const result = await vagueService.list();
      if (!result.ok || !result.data) throw new Error(result.error ?? "Erreur chargement vagues");
      return (result.data as unknown as VagueListResult).data;
    },
    staleTime: 2 * 60_000, // 2 min
    gcTime: 5 * 60_000,
    initialData: options?.initialData,
  });
}

export function useVagueDetail(id: string | undefined) {
  const vagueService = useVagueService();

  return useQuery({
    queryKey: queryKeys.vagues.detail(id!),
    queryFn: async () => {
      const result = await vagueService.get(id!);
      if (!result.ok || !result.data) throw new Error(result.error ?? "Erreur chargement vague");
      return result.data;
    },
    enabled: !!id,
    staleTime: 2 * 60_000,
    gcTime: 5 * 60_000,
  });
}

export function useCreateVague() {
  const queryClient = useQueryClient();
  const vagueService = useVagueService();

  return useMutation({
    mutationFn: async (dto: CreateVagueDTO) => {
      const result = await vagueService.create(dto);
      if (!result.ok) throw new Error(result.error ?? "Erreur création vague");
      return result.data as VagueDetailResponse;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.vagues.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.bacs.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all });
    },
  });
}

export function useUpdateVague() {
  const queryClient = useQueryClient();
  const vagueService = useVagueService();

  return useMutation({
    mutationFn: async ({ id, dto }: { id: string; dto: UpdateVagueDTO }) => {
      const result = await vagueService.update(id, dto);
      if (!result.ok) throw new Error(result.error ?? "Erreur modification vague");
      return result.data as VagueDetailResponse;
    },
    onSuccess: (_data, { id }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.vagues.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.vagues.detail(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all });
    },
  });
}

export function useClotureVague() {
  const queryClient = useQueryClient();
  const vagueService = useVagueService();

  return useMutation({
    mutationFn: async ({ id, dto }: { id: string; dto: { dateFin: string; notes?: string } }) => {
      const result = await vagueService.cloture(id, dto);
      if (!result.ok) throw new Error(result.error ?? "Erreur clôture vague");
      return result.data as VagueDetailResponse;
    },
    onSuccess: (_data, { id }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.vagues.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.vagues.detail(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.bacs.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all });
    },
  });
}
