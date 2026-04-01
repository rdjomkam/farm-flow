"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useBacService } from "@/services";
import { queryKeys } from "@/lib/query-keys";
import type { BacResponse, BacListResponse, CreateBacDTO, UpdateBacDTO } from "@/types";

export function useBacsList(
  filters?: { vagueId?: string },
  options?: { enabled?: boolean; initialData?: BacResponse[] },
) {
  const bacService = useBacService();

  return useQuery({
    queryKey: queryKeys.bacs.list(filters),
    queryFn: async () => {
      const result = await bacService.list(filters);
      if (!result.ok || !result.data) throw new Error(result.error ?? "Erreur chargement bacs");
      return (result.data as BacListResponse).data;
    },
    staleTime: 2 * 60_000,
    gcTime: 5 * 60_000,
    enabled: options?.enabled,
    initialData: options?.initialData,
  });
}

export function useBacsLibres(options?: { enabled?: boolean }) {
  const bacService = useBacService();

  return useQuery({
    queryKey: queryKeys.bacs.list({ libre: true }),
    queryFn: async () => {
      const result = await bacService.listLibres();
      if (!result.ok || !result.data) throw new Error(result.error ?? "Erreur chargement bacs libres");
      return (result.data as BacListResponse).data;
    },
    staleTime: 30_000,
    gcTime: 2 * 60_000,
    enabled: options?.enabled,
  });
}

export function useCreateBac() {
  const queryClient = useQueryClient();
  const bacService = useBacService();

  return useMutation({
    mutationFn: async (dto: CreateBacDTO) => {
      const result = await bacService.create(dto);
      if (!result.ok) throw new Error(result.error ?? "Erreur création bac");
      return result.data as BacResponse;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.bacs.all });
    },
  });
}

export function useUpdateBac() {
  const queryClient = useQueryClient();
  const bacService = useBacService();

  return useMutation({
    mutationFn: async ({ id, dto }: { id: string; dto: UpdateBacDTO }) => {
      const result = await bacService.update(id, dto);
      if (!result.ok) throw new Error(result.error ?? "Erreur modification bac");
      return result.data as BacResponse;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.bacs.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.vagues.all });
    },
  });
}
