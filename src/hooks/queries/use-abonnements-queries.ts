"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useConfigService } from "@/services";
import { queryKeys } from "@/lib/query-keys";
import type {
  PlanAbonnement,
  Pack,
  PackWithRelations,
  CreatePackDTO,
  UpdatePackDTO,
  CreatePackProduitDTO,
  CreatePackBacDTO,
  ActivatePackDTO,
  PackActivationResponse,
} from "@/types";

// ---------------------------------------------------------------------------
// Clés locales pour abonnements (plans & packs — pas de service dédié,
// les endpoints /api/plans et /api/packs sont servis par useConfigService)
// ---------------------------------------------------------------------------

// Note : queryKeys.abonnements.plans() → ["abonnements", "plans"]
//        queryKeys.abonnements.packs() → ["abonnements", "packs"]
// Les activations utilisent une clé locale

const activationsKey = ["abonnements", "activations"] as const;

// --- Plans ---

// Les plans d'abonnement (/api/plans) ne sont pas encore exposés via un service client dédié.
// Utiliser usePlansAbonnements() ci-dessous qui effectue un fetch direct.

// --- Packs de provisioning ---

export function usePacksList() {
  const configService = useConfigService();

  return useQuery({
    queryKey: queryKeys.abonnements.packs(),
    queryFn: async () => {
      const result = await configService.listPacks();
      if (!result.ok || !result.data) throw new Error(result.error ?? "Erreur chargement packs");
      return result.data.packs as PackWithRelations[];
    },
    staleTime: 30 * 60_000, // 30 min — config stable
    gcTime: 60 * 60_000,
  });
}

export function usePackDetail(id: string | undefined) {
  const configService = useConfigService();

  return useQuery({
    queryKey: [...queryKeys.abonnements.packs(), id],
    queryFn: async () => {
      const result = await configService.getPack(id!);
      if (!result.ok || !result.data) throw new Error(result.error ?? "Erreur chargement pack");
      return result.data as PackWithRelations;
    },
    enabled: !!id,
    staleTime: 30 * 60_000,
    gcTime: 60 * 60_000,
  });
}

export function useCreatePack() {
  const queryClient = useQueryClient();
  const configService = useConfigService();

  return useMutation({
    mutationFn: async (dto: CreatePackDTO) => {
      const result = await configService.createPack(dto);
      if (!result.ok) throw new Error(result.error ?? "Erreur création pack");
      return result.data as Pack;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.abonnements.packs() });
    },
  });
}

export function useUpdatePack() {
  const queryClient = useQueryClient();
  const configService = useConfigService();

  return useMutation({
    mutationFn: async ({ id, dto }: { id: string; dto: UpdatePackDTO }) => {
      const result = await configService.updatePack(id, dto);
      if (!result.ok) throw new Error(result.error ?? "Erreur modification pack");
      return result.data as Pack;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.abonnements.packs() });
    },
  });
}

export function useAddPackProduit() {
  const queryClient = useQueryClient();
  const configService = useConfigService();

  return useMutation({
    mutationFn: async ({ packId, dto }: { packId: string; dto: CreatePackProduitDTO }) => {
      const result = await configService.addPackProduit(packId, dto);
      if (!result.ok) throw new Error(result.error ?? "Erreur ajout produit au pack");
      return result.data as PackWithRelations;
    },
    onSuccess: (_data, { packId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.abonnements.packs() });
      queryClient.invalidateQueries({ queryKey: [...queryKeys.abonnements.packs(), packId] });
    },
  });
}

export function useAddPackBac() {
  const queryClient = useQueryClient();
  const configService = useConfigService();

  return useMutation({
    mutationFn: async ({ packId, dto }: { packId: string; dto: CreatePackBacDTO }) => {
      const result = await configService.addPackBac(packId, dto);
      if (!result.ok) throw new Error(result.error ?? "Erreur ajout bac au pack");
      return result.data as PackWithRelations;
    },
    onSuccess: (_data, { packId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.abonnements.packs() });
      queryClient.invalidateQueries({ queryKey: [...queryKeys.abonnements.packs(), packId] });
    },
  });
}

export function useUpdatePackBacs() {
  const queryClient = useQueryClient();
  const configService = useConfigService();

  return useMutation({
    mutationFn: async ({ packId, body }: { packId: string; body: Record<string, unknown> }) => {
      const result = await configService.updatePackBacs(packId, body);
      if (!result.ok) throw new Error(result.error ?? "Erreur mise à jour bacs du pack");
      return result.data as PackWithRelations;
    },
    onSuccess: (_data, { packId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.abonnements.packs() });
      queryClient.invalidateQueries({ queryKey: [...queryKeys.abonnements.packs(), packId] });
    },
  });
}

export function useDeletePackProduit() {
  const queryClient = useQueryClient();
  const configService = useConfigService();

  return useMutation({
    mutationFn: async ({ packId, produitId }: { packId: string; produitId: string }) => {
      const result = await configService.deletePackProduit(packId, produitId);
      if (!result.ok) throw new Error(result.error ?? "Erreur retrait produit du pack");
      return result.data as PackWithRelations;
    },
    onSuccess: (_data, { packId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.abonnements.packs() });
      queryClient.invalidateQueries({ queryKey: [...queryKeys.abonnements.packs(), packId] });
    },
  });
}

export function useActiverPack() {
  const queryClient = useQueryClient();
  const configService = useConfigService();

  return useMutation({
    mutationFn: async ({ packId, dto }: { packId: string; dto: ActivatePackDTO }) => {
      const result = await configService.activerPack(packId, dto);
      if (!result.ok) throw new Error(result.error ?? "Erreur activation pack");
      return result.data as PackActivationResponse;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: activationsKey });
      queryClient.invalidateQueries({ queryKey: queryKeys.vagues.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.bacs.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.produits.all });
    },
  });
}

export function useActivationsList() {
  const configService = useConfigService();

  return useQuery({
    queryKey: activationsKey,
    queryFn: async () => {
      const result = await configService.listActivations();
      if (!result.ok || !result.data) throw new Error(result.error ?? "Erreur chargement activations");
      return result.data.activations;
    },
    staleTime: 2 * 60_000,
    gcTime: 5 * 60_000,
  });
}

// --- Placeholder : plans via /api/plans ---
// Il n'existe pas encore de service client pour /api/plans.
// Ce hook effectue un appel fetch direct en attendant la création du service.

export function usePlansAbonnements(options?: { includeInactive?: boolean }) {
  return useQuery({
    queryKey: [...queryKeys.abonnements.plans(), { includeInactive: options?.includeInactive }],
    queryFn: async () => {
      const url = options?.includeInactive ? "/api/plans" : "/api/plans?public=true";
      const res = await fetch(url);
      if (!res.ok) throw new Error("Erreur chargement plans d'abonnement");
      const json = await res.json() as { plans: PlanAbonnement[] };
      return json.plans;
    },
    staleTime: 30 * 60_000, // 30 min — plans changent rarement
    gcTime: 60 * 60_000,
  });
}
