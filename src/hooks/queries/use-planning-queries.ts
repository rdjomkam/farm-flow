"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useActiviteService, useConfigService } from "@/services";
import { queryKeys } from "@/lib/query-keys";
import type {
  ActiviteWithRelations,
  CreateActiviteDTO,
  RegleActiviteWithCount,
  RegleActiviteWithRelations,
  CreateRegleActiviteDTO,
  UpdateRegleActiviteDTO,
} from "@/types";

// ---------------------------------------------------------------------------
// Interfaces locales (types internes au service non exportés)
// ---------------------------------------------------------------------------

interface CompleterActiviteDTO {
  releveId?: string;
  notes?: string;
}

// --- Activites ---

export function useActivitesList(filters?: {
  vagueId?: string;
  typeActivite?: string;
  statut?: string;
}) {
  const activiteService = useActiviteService();

  return useQuery({
    queryKey: queryKeys.planning.activites(filters),
    queryFn: async () => {
      const result = await activiteService.list(filters);
      if (!result.ok || !result.data) throw new Error(result.error ?? "Erreur chargement activités");
      return result.data.activites;
    },
    staleTime: 2 * 60_000,
    gcTime: 5 * 60_000,
  });
}

export function useActivitesAujourdhui() {
  const activiteService = useActiviteService();

  return useQuery({
    queryKey: [...queryKeys.planning.activites(), "aujourdhui"],
    queryFn: async () => {
      const result = await activiteService.getAujourdhui();
      if (!result.ok || !result.data) throw new Error(result.error ?? "Erreur chargement activités du jour");
      return result.data.activites;
    },
    staleTime: 2 * 60_000,
    gcTime: 5 * 60_000,
  });
}

export function useMesTaches() {
  const activiteService = useActiviteService();

  return useQuery({
    queryKey: [...queryKeys.planning.activites(), "mes-taches"],
    queryFn: async () => {
      const result = await activiteService.getMesTaches();
      if (!result.ok || !result.data) throw new Error(result.error ?? "Erreur chargement mes tâches");
      return result.data.activites;
    },
    staleTime: 2 * 60_000,
    gcTime: 5 * 60_000,
  });
}

export function useMesTachesCount() {
  const activiteService = useActiviteService();

  return useQuery({
    queryKey: [...queryKeys.planning.activites(), "mes-taches-count"],
    queryFn: async () => {
      const result = await activiteService.getMesTachesCount();
      if (!result.ok || !result.data) return 0;
      return result.data.count;
    },
    staleTime: 30_000, // 30s — utilisé en polling
    gcTime: 60_000,
    refetchInterval: 60_000,
  });
}

export function useCreateActivite() {
  const queryClient = useQueryClient();
  const activiteService = useActiviteService();

  return useMutation({
    mutationFn: async (dto: CreateActiviteDTO) => {
      const result = await activiteService.create(dto);
      if (!result.ok) throw new Error(result.error ?? "Erreur création activité");
      return result.data as ActiviteWithRelations;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.planning.activites() });
    },
  });
}

export function useUpdateActivite() {
  const queryClient = useQueryClient();
  const activiteService = useActiviteService();

  return useMutation({
    mutationFn: async ({ id, body }: { id: string; body: Record<string, unknown> }) => {
      const result = await activiteService.update(id, body);
      if (!result.ok) throw new Error(result.error ?? "Erreur modification activité");
      return result.data as ActiviteWithRelations;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.planning.activites() });
    },
  });
}

export function useDeleteActivite() {
  const queryClient = useQueryClient();
  const activiteService = useActiviteService();

  return useMutation({
    mutationFn: async (id: string) => {
      const result = await activiteService.remove(id);
      if (!result.ok) throw new Error(result.error ?? "Erreur suppression activité");
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.planning.activites() });
    },
  });
}

export function useCompleterActivite() {
  const queryClient = useQueryClient();
  const activiteService = useActiviteService();

  return useMutation({
    mutationFn: async ({ id, dto }: { id: string; dto: CompleterActiviteDTO }) => {
      const result = await activiteService.complete(id, dto);
      if (!result.ok) throw new Error(result.error ?? "Erreur complétion activité");
      return result.data as ActiviteWithRelations;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.planning.activites() });
      queryClient.invalidateQueries({ queryKey: queryKeys.releves.all });
    },
  });
}

export function useGenererActivites() {
  const queryClient = useQueryClient();
  const activiteService = useActiviteService();

  return useMutation({
    mutationFn: async () => {
      const result = await activiteService.generer();
      if (!result.ok) throw new Error(result.error ?? "Erreur génération activités");
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.planning.activites() });
    },
  });
}

// --- Regles d'activites ---

export function useReglesActivitesList() {
  const configService = useConfigService();

  return useQuery({
    queryKey: queryKeys.planning.regles(),
    queryFn: async () => {
      const result = await configService.listRegles();
      if (!result.ok || !result.data) throw new Error(result.error ?? "Erreur chargement règles");
      return result.data.regles as RegleActiviteWithCount[];
    },
    staleTime: 30 * 60_000, // 30 min — config stable
    gcTime: 60 * 60_000,
  });
}

export function useCreateRegleActivite() {
  const queryClient = useQueryClient();
  const configService = useConfigService();

  return useMutation({
    mutationFn: async (dto: CreateRegleActiviteDTO) => {
      const result = await configService.createRegle(dto);
      if (!result.ok) throw new Error(result.error ?? "Erreur création règle");
      return result.data as RegleActiviteWithRelations;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.planning.regles() });
    },
  });
}

export function useUpdateRegleActivite() {
  const queryClient = useQueryClient();
  const configService = useConfigService();

  return useMutation({
    mutationFn: async ({ id, dto }: { id: string; dto: UpdateRegleActiviteDTO }) => {
      const result = await configService.updateRegle(id, dto);
      if (!result.ok) throw new Error(result.error ?? "Erreur modification règle");
      return result.data as RegleActiviteWithRelations;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.planning.regles() });
    },
  });
}

export function useDeleteRegleActivite() {
  const queryClient = useQueryClient();
  const configService = useConfigService();

  return useMutation({
    mutationFn: async (id: string) => {
      const result = await configService.deleteRegle(id);
      if (!result.ok) throw new Error(result.error ?? "Erreur suppression règle");
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.planning.regles() });
    },
  });
}

export function useToggleRegleActivite() {
  const queryClient = useQueryClient();
  const configService = useConfigService();

  return useMutation({
    mutationFn: async (id: string) => {
      const result = await configService.toggleRegle(id);
      if (!result.ok) throw new Error(result.error ?? "Erreur activation/désactivation règle");
      return result.data as RegleActiviteWithRelations;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.planning.regles() });
    },
  });
}

export function useResetRegleActivite() {
  const queryClient = useQueryClient();
  const configService = useConfigService();

  return useMutation({
    mutationFn: async (id: string) => {
      const result = await configService.resetRegle(id);
      if (!result.ok) throw new Error(result.error ?? "Erreur réinitialisation règle");
      return result.data as RegleActiviteWithRelations;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.planning.regles() });
    },
  });
}
