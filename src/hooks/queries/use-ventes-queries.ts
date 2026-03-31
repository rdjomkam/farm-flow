"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useVenteService } from "@/services";
import { queryKeys } from "@/lib/query-keys";
import type {
  CreateVenteDTO,
  VenteWithRelations,
  FactureDetailResponse,
  FactureWithRelations,
  Client,
  CreateClientDTO,
  UpdateClientDTO,
  CreatePaiementDTO,
} from "@/types";

// --- Ventes ---

export function useVentesList(
  filters?: Record<string, unknown>,
  initialData?: VenteWithRelations[]
) {
  const venteService = useVenteService();

  return useQuery({
    queryKey: queryKeys.ventes.list(filters),
    queryFn: async () => {
      const result = await venteService.listVentes();
      if (!result.ok || !result.data) throw new Error(result.error ?? "Erreur chargement ventes");
      return (result.data as unknown as { data: VenteWithRelations[]; total: number }).data;
    },
    initialData,
    staleTime: 2 * 60_000,
    gcTime: 5 * 60_000,
  });
}

export function useVenteDetail(id: string | undefined) {
  const venteService = useVenteService();

  return useQuery({
    queryKey: queryKeys.ventes.detail(id!),
    queryFn: async () => {
      const result = await venteService.getVente(id!);
      if (!result.ok || !result.data) throw new Error(result.error ?? "Erreur chargement vente");
      return result.data as VenteWithRelations;
    },
    enabled: !!id,
    staleTime: 2 * 60_000,
    gcTime: 5 * 60_000,
  });
}

export function useCreateVente() {
  const queryClient = useQueryClient();
  const venteService = useVenteService();

  return useMutation({
    mutationFn: async (dto: CreateVenteDTO) => {
      const result = await venteService.createVente(dto);
      if (!result.ok) throw new Error(result.error ?? "Erreur création vente");
      return result.data as VenteWithRelations;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.ventes.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.factures.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all });
    },
  });
}

export function useDeleteVente() {
  const queryClient = useQueryClient();
  const venteService = useVenteService();

  return useMutation({
    mutationFn: async (id: string) => {
      const result = await venteService.deleteVente(id);
      if (!result.ok) throw new Error(result.error ?? "Erreur suppression vente");
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.ventes.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.factures.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all });
    },
  });
}

// --- Factures ---

export function useFacturesList(
  filters?: Record<string, unknown>,
  initialData?: FactureWithRelations[]
) {
  const venteService = useVenteService();

  return useQuery({
    queryKey: queryKeys.factures.list(filters),
    queryFn: async () => {
      const result = await venteService.listFactures();
      if (!result.ok || !result.data) throw new Error(result.error ?? "Erreur chargement factures");
      return (result.data as unknown as { data: FactureWithRelations[]; total: number }).data;
    },
    initialData,
    staleTime: 2 * 60_000,
    gcTime: 5 * 60_000,
  });
}

export function useFactureDetail(id: string | undefined) {
  const venteService = useVenteService();

  return useQuery({
    queryKey: queryKeys.factures.detail(id!),
    queryFn: async () => {
      const result = await venteService.getFacture(id!);
      if (!result.ok || !result.data) throw new Error(result.error ?? "Erreur chargement facture");
      return result.data as FactureDetailResponse;
    },
    enabled: !!id,
    staleTime: 2 * 60_000,
    gcTime: 5 * 60_000,
  });
}

export function useCreateFacture() {
  const queryClient = useQueryClient();
  const venteService = useVenteService();

  return useMutation({
    mutationFn: async (venteId: string) => {
      const result = await venteService.createFacture(venteId);
      if (!result.ok) throw new Error(result.error ?? "Erreur création facture");
      return result.data as FactureWithRelations;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.factures.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.ventes.all });
    },
  });
}

export function useUpdateFacture() {
  const queryClient = useQueryClient();
  const venteService = useVenteService();

  return useMutation({
    mutationFn: async ({ id, body }: { id: string; body: Record<string, unknown> }) => {
      const result = await venteService.updateFacture(id, body);
      if (!result.ok) throw new Error(result.error ?? "Erreur modification facture");
      return result.data as FactureDetailResponse;
    },
    onSuccess: (_data, { id }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.factures.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.factures.detail(id) });
    },
  });
}

export function useAddPaiement() {
  const queryClient = useQueryClient();
  const venteService = useVenteService();

  return useMutation({
    mutationFn: async ({ factureId, dto }: { factureId: string; dto: CreatePaiementDTO }) => {
      const result = await venteService.addPaiement(factureId, dto);
      if (!result.ok) throw new Error(result.error ?? "Erreur enregistrement paiement");
      return result.data as FactureDetailResponse;
    },
    onSuccess: (_data, { factureId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.factures.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.factures.detail(factureId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all });
    },
  });
}

// --- Clients ---

export function useClientsList(initialData?: Client[]) {
  const venteService = useVenteService();

  return useQuery({
    queryKey: queryKeys.clients.list(),
    queryFn: async () => {
      const result = await venteService.listClients();
      if (!result.ok || !result.data) throw new Error(result.error ?? "Erreur chargement clients");
      return result.data.clients;
    },
    initialData,
    staleTime: 2 * 60_000,
    gcTime: 5 * 60_000,
  });
}

export function useCreateClient() {
  const queryClient = useQueryClient();
  const venteService = useVenteService();

  return useMutation({
    mutationFn: async (dto: CreateClientDTO) => {
      const result = await venteService.createClient(dto);
      if (!result.ok) throw new Error(result.error ?? "Erreur création client");
      return result.data as Client;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.clients.all });
    },
  });
}

export function useUpdateClient() {
  const queryClient = useQueryClient();
  const venteService = useVenteService();

  return useMutation({
    mutationFn: async ({ id, dto }: { id: string; dto: UpdateClientDTO }) => {
      const result = await venteService.updateClient(id, dto);
      if (!result.ok) throw new Error(result.error ?? "Erreur modification client");
      return result.data as Client;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.clients.all });
    },
  });
}
