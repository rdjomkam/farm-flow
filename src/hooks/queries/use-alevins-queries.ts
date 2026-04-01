"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAlevinsService } from "@/services";
import { queryKeys } from "@/lib/query-keys";
import type {
  LotAlevinsWithRelations,
  LotAlevinsListResponse,
  CreateLotAlevinsDTO,
  UpdateLotAlevinsDTO,
  TransfertLotDTO,
  PonteWithRelations,
  PonteListResponse,
  CreatePonteDTO,
  UpdatePonteDTO,
  ReproducteurWithRelations,
  ReproducteurListResponse,
  CreateReproducteurDTO,
  UpdateReproducteurDTO,
} from "@/types";

// --- Lots d'alevins ---

export function useLotsList(filters?: { vagueId?: string; statut?: string }) {
  const alevinsService = useAlevinsService();

  return useQuery({
    queryKey: queryKeys.alevins.lots(filters),
    queryFn: async () => {
      const result = await alevinsService.listLots(filters);
      if (!result.ok || !result.data) throw new Error(result.error ?? "Erreur chargement lots");
      return (result.data as LotAlevinsListResponse).data;
    },
    staleTime: 2 * 60_000,
    gcTime: 5 * 60_000,
  });
}

export function useLotDetail(id: string | undefined) {
  const alevinsService = useAlevinsService();

  return useQuery({
    queryKey: [...queryKeys.alevins.lots(), id],
    queryFn: async () => {
      const result = await alevinsService.getLot(id!);
      if (!result.ok || !result.data) throw new Error(result.error ?? "Erreur chargement lot");
      return result.data as LotAlevinsWithRelations;
    },
    enabled: !!id,
    staleTime: 2 * 60_000,
    gcTime: 5 * 60_000,
  });
}

export function useCreateLot() {
  const queryClient = useQueryClient();
  const alevinsService = useAlevinsService();

  return useMutation({
    mutationFn: async (dto: CreateLotAlevinsDTO) => {
      const result = await alevinsService.createLot(dto);
      if (!result.ok) throw new Error(result.error ?? "Erreur création lot");
      return result.data as LotAlevinsWithRelations;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.alevins.lots() });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all });
    },
  });
}

export function useUpdateLot() {
  const queryClient = useQueryClient();
  const alevinsService = useAlevinsService();

  return useMutation({
    mutationFn: async ({ id, dto }: { id: string; dto: UpdateLotAlevinsDTO }) => {
      const result = await alevinsService.updateLot(id, dto);
      if (!result.ok) throw new Error(result.error ?? "Erreur modification lot");
      return result.data as LotAlevinsWithRelations;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.alevins.lots() });
    },
  });
}

export function useTransfererLot() {
  const queryClient = useQueryClient();
  const alevinsService = useAlevinsService();

  return useMutation({
    mutationFn: async ({ id, dto }: { id: string; dto: TransfertLotDTO }) => {
      const result = await alevinsService.transfererLot(id, dto);
      if (!result.ok) throw new Error(result.error ?? "Erreur transfert lot");
      return result.data as LotAlevinsWithRelations;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.alevins.lots() });
      queryClient.invalidateQueries({ queryKey: queryKeys.vagues.all });
    },
  });
}

// --- Pontes ---

export function usePontesList(filters?: { reproducteurId?: string; statut?: string }) {
  const alevinsService = useAlevinsService();

  return useQuery({
    queryKey: queryKeys.alevins.pontes(filters),
    queryFn: async () => {
      const result = await alevinsService.listPontes(filters);
      if (!result.ok || !result.data) throw new Error(result.error ?? "Erreur chargement pontes");
      return (result.data as PonteListResponse).data;
    },
    staleTime: 2 * 60_000,
    gcTime: 5 * 60_000,
  });
}

export function usePonteDetail(id: string | undefined) {
  const alevinsService = useAlevinsService();

  return useQuery({
    queryKey: [...queryKeys.alevins.pontes(), id],
    queryFn: async () => {
      const result = await alevinsService.getPonte(id!);
      if (!result.ok || !result.data) throw new Error(result.error ?? "Erreur chargement ponte");
      return result.data as PonteWithRelations;
    },
    enabled: !!id,
    staleTime: 2 * 60_000,
    gcTime: 5 * 60_000,
  });
}

export function useCreatePonte() {
  const queryClient = useQueryClient();
  const alevinsService = useAlevinsService();

  return useMutation({
    mutationFn: async (dto: CreatePonteDTO) => {
      const result = await alevinsService.createPonte(dto);
      if (!result.ok) throw new Error(result.error ?? "Erreur création ponte");
      return result.data as PonteWithRelations;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.alevins.pontes() });
      queryClient.invalidateQueries({ queryKey: queryKeys.alevins.lots() });
    },
  });
}

export function useUpdatePonte() {
  const queryClient = useQueryClient();
  const alevinsService = useAlevinsService();

  return useMutation({
    mutationFn: async ({ id, dto }: { id: string; dto: UpdatePonteDTO }) => {
      const result = await alevinsService.updatePonte(id, dto);
      if (!result.ok) throw new Error(result.error ?? "Erreur modification ponte");
      return result.data as PonteWithRelations;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.alevins.pontes() });
    },
  });
}

export function useDeletePonte() {
  const queryClient = useQueryClient();
  const alevinsService = useAlevinsService();

  return useMutation({
    mutationFn: async (id: string) => {
      const result = await alevinsService.deletePonte(id);
      if (!result.ok) throw new Error(result.error ?? "Erreur suppression ponte");
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.alevins.pontes() });
    },
  });
}

// --- Reproducteurs ---

export function useReproducteursList(filters?: { sexe?: string; statut?: string }) {
  const alevinsService = useAlevinsService();

  return useQuery({
    queryKey: queryKeys.alevins.reproducteurs(),
    queryFn: async () => {
      const result = await alevinsService.listReproducteurs(filters);
      if (!result.ok || !result.data) throw new Error(result.error ?? "Erreur chargement reproducteurs");
      return (result.data as ReproducteurListResponse).data;
    },
    staleTime: 2 * 60_000,
    gcTime: 5 * 60_000,
  });
}

export function useReproducteurDetail(id: string | undefined) {
  const alevinsService = useAlevinsService();

  return useQuery({
    queryKey: [...queryKeys.alevins.reproducteurs(), id],
    queryFn: async () => {
      const result = await alevinsService.getReproducteur(id!);
      if (!result.ok || !result.data) throw new Error(result.error ?? "Erreur chargement reproducteur");
      return result.data as ReproducteurWithRelations;
    },
    enabled: !!id,
    staleTime: 2 * 60_000,
    gcTime: 5 * 60_000,
  });
}

export function useCreateReproducteur() {
  const queryClient = useQueryClient();
  const alevinsService = useAlevinsService();

  return useMutation({
    mutationFn: async (dto: CreateReproducteurDTO) => {
      const result = await alevinsService.createReproducteur(dto);
      if (!result.ok) throw new Error(result.error ?? "Erreur création reproducteur");
      return result.data as ReproducteurWithRelations;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.alevins.reproducteurs() });
    },
  });
}

export function useUpdateReproducteur() {
  const queryClient = useQueryClient();
  const alevinsService = useAlevinsService();

  return useMutation({
    mutationFn: async ({ id, dto }: { id: string; dto: UpdateReproducteurDTO }) => {
      const result = await alevinsService.updateReproducteur(id, dto);
      if (!result.ok) throw new Error(result.error ?? "Erreur modification reproducteur");
      return result.data as ReproducteurWithRelations;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.alevins.reproducteurs() });
    },
  });
}

export function useDeleteReproducteur() {
  const queryClient = useQueryClient();
  const alevinsService = useAlevinsService();

  return useMutation({
    mutationFn: async (id: string) => {
      const result = await alevinsService.deleteReproducteur(id);
      if (!result.ok) throw new Error(result.error ?? "Erreur suppression reproducteur");
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.alevins.reproducteurs() });
      queryClient.invalidateQueries({ queryKey: queryKeys.alevins.pontes() });
    },
  });
}
