"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useDepenseService } from "@/services";
import { queryKeys } from "@/lib/query-keys";
import type {
  DepenseWithRelations,
  DepenseDetailResponse,
  CreateDepenseDTO,
  UpdateDepenseDTO,
  DepenseFilters,
  CreatePaiementDepenseDTO,
  PaiementDepenseResponse,
  DepenseRecurrenteWithRelations,
  CreateDepenseRecurrenteDTO,
  UpdateDepenseRecurrenteDTO,
  ListeBesoinsWithRelations,
  ListeBesoinsDetailResponse,
  CreateListeBesoinsDTO,
  UpdateListeBesoinsDTO,
  TraiterBesoinsDTO,
  CloturerBesoinsDTO,
  RejeterBesoinsDTO,
} from "@/types";

// ---------------------------------------------------------------------------
// Clés locales pour les ressources non encore dans queryKeys global
// ---------------------------------------------------------------------------

const depensesRecurrentesKey = ["depenses-recurrentes"] as const;
const besoinsKey = ["besoins"] as const;

// --- Depenses ---

export function useDepensesList(filters?: DepenseFilters) {
  const depenseService = useDepenseService();

  return useQuery({
    queryKey: queryKeys.depenses.list(filters as Record<string, unknown>),
    queryFn: async () => {
      const result = await depenseService.listDepenses(filters);
      if (!result.ok || !result.data) throw new Error(result.error ?? "Erreur chargement dépenses");
      return result.data.depenses;
    },
    staleTime: 2 * 60_000,
    gcTime: 5 * 60_000,
  });
}

export function useDepenseDetail(id: string | undefined) {
  const depenseService = useDepenseService();

  return useQuery({
    queryKey: [...queryKeys.depenses.all, "detail", id],
    queryFn: async () => {
      const result = await depenseService.getDepense(id!);
      if (!result.ok || !result.data) throw new Error(result.error ?? "Erreur chargement dépense");
      return result.data as DepenseDetailResponse;
    },
    enabled: !!id,
    staleTime: 2 * 60_000,
    gcTime: 5 * 60_000,
  });
}

export function useCreateDepense() {
  const queryClient = useQueryClient();
  const depenseService = useDepenseService();

  return useMutation({
    mutationFn: async (dto: CreateDepenseDTO) => {
      const result = await depenseService.createDepense(dto);
      if (!result.ok) throw new Error(result.error ?? "Erreur création dépense");
      return result.data as DepenseWithRelations;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.depenses.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all });
    },
  });
}

export function useUpdateDepense() {
  const queryClient = useQueryClient();
  const depenseService = useDepenseService();

  return useMutation({
    mutationFn: async ({ id, dto }: { id: string; dto: UpdateDepenseDTO }) => {
      const result = await depenseService.updateDepense(id, dto);
      if (!result.ok) throw new Error(result.error ?? "Erreur modification dépense");
      return result.data as DepenseWithRelations;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.depenses.all });
    },
  });
}

export function useDeleteDepense() {
  const queryClient = useQueryClient();
  const depenseService = useDepenseService();

  return useMutation({
    mutationFn: async (id: string) => {
      const result = await depenseService.deleteDepense(id);
      if (!result.ok) throw new Error(result.error ?? "Erreur suppression dépense");
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.depenses.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all });
    },
  });
}

export function useAddPaiementDepense() {
  const queryClient = useQueryClient();
  const depenseService = useDepenseService();

  return useMutation({
    mutationFn: async ({ depenseId, dto }: { depenseId: string; dto: CreatePaiementDepenseDTO }) => {
      const result = await depenseService.addPaiementDepense(depenseId, dto);
      if (!result.ok) throw new Error(result.error ?? "Erreur enregistrement paiement dépense");
      return result.data as PaiementDepenseResponse;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.depenses.all });
    },
  });
}

// --- Depenses recurrentes ---

export function useDepensesRecurrentesList() {
  const depenseService = useDepenseService();

  return useQuery({
    queryKey: depensesRecurrentesKey,
    queryFn: async () => {
      const result = await depenseService.listDepensesRecurrentes();
      if (!result.ok || !result.data) throw new Error(result.error ?? "Erreur chargement dépenses récurrentes");
      return result.data.depensesRecurrentes;
    },
    staleTime: 2 * 60_000,
    gcTime: 5 * 60_000,
  });
}

export function useCreateDepenseRecurrente() {
  const queryClient = useQueryClient();
  const depenseService = useDepenseService();

  return useMutation({
    mutationFn: async (dto: CreateDepenseRecurrenteDTO) => {
      const result = await depenseService.createDepenseRecurrente(dto);
      if (!result.ok) throw new Error(result.error ?? "Erreur création dépense récurrente");
      return result.data as DepenseRecurrenteWithRelations;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: depensesRecurrentesKey });
    },
  });
}

export function useUpdateDepenseRecurrente() {
  const queryClient = useQueryClient();
  const depenseService = useDepenseService();

  return useMutation({
    mutationFn: async ({ id, dto }: { id: string; dto: UpdateDepenseRecurrenteDTO }) => {
      const result = await depenseService.updateDepenseRecurrente(id, dto);
      if (!result.ok) throw new Error(result.error ?? "Erreur modification dépense récurrente");
      return result.data as DepenseRecurrenteWithRelations;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: depensesRecurrentesKey });
    },
  });
}

export function useDeleteDepenseRecurrente() {
  const queryClient = useQueryClient();
  const depenseService = useDepenseService();

  return useMutation({
    mutationFn: async (id: string) => {
      const result = await depenseService.deleteDepenseRecurrente(id);
      if (!result.ok) throw new Error(result.error ?? "Erreur suppression dépense récurrente");
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: depensesRecurrentesKey });
    },
  });
}

export function useGenererDepensesRecurrentes() {
  const queryClient = useQueryClient();
  const depenseService = useDepenseService();

  return useMutation({
    mutationFn: async () => {
      const result = await depenseService.genererDepensesRecurrentes();
      if (!result.ok) throw new Error(result.error ?? "Erreur génération dépenses récurrentes");
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.depenses.all });
    },
  });
}

// --- Besoins ---

export function useBesoinsList(
  filters?: { statut?: string },
  options?: { initialData?: ListeBesoinsWithRelations[] },
) {
  const depenseService = useDepenseService();

  return useQuery({
    queryKey: queryKeys.besoins.list(filters as Record<string, unknown>),
    queryFn: async () => {
      const result = await depenseService.listBesoins(filters);
      if (!result.ok || !result.data) throw new Error(result.error ?? "Erreur chargement besoins");
      return result.data.listesBesoins;
    },
    staleTime: 2 * 60_000,
    gcTime: 5 * 60_000,
    initialData: options?.initialData,
  });
}

export function useBesoinDetail(id: string | undefined) {
  const depenseService = useDepenseService();

  return useQuery({
    queryKey: [...besoinsKey, "detail", id],
    queryFn: async () => {
      const result = await depenseService.getBesoin(id!);
      if (!result.ok || !result.data) throw new Error(result.error ?? "Erreur chargement besoin");
      return result.data as ListeBesoinsDetailResponse;
    },
    enabled: !!id,
    staleTime: 2 * 60_000,
    gcTime: 5 * 60_000,
  });
}

export function useCreateBesoin() {
  const queryClient = useQueryClient();
  const depenseService = useDepenseService();

  return useMutation({
    mutationFn: async (dto: CreateListeBesoinsDTO) => {
      const result = await depenseService.createBesoin(dto);
      if (!result.ok) throw new Error(result.error ?? "Erreur création liste de besoins");
      return result.data as ListeBesoinsWithRelations;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: besoinsKey });
    },
  });
}

export function useUpdateBesoin() {
  const queryClient = useQueryClient();
  const depenseService = useDepenseService();

  return useMutation({
    mutationFn: async ({ id, dto }: { id: string; dto: UpdateListeBesoinsDTO }) => {
      const result = await depenseService.updateBesoin(id, dto);
      if (!result.ok) throw new Error(result.error ?? "Erreur modification liste de besoins");
      return result.data as ListeBesoinsWithRelations;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: besoinsKey });
    },
  });
}

export function useApprouverBesoin() {
  const queryClient = useQueryClient();
  const depenseService = useDepenseService();

  return useMutation({
    mutationFn: async (id: string) => {
      const result = await depenseService.approuverBesoin(id);
      if (!result.ok) throw new Error(result.error ?? "Erreur approbation besoin");
      return result.data as ListeBesoinsWithRelations;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: besoinsKey });
    },
  });
}

export function useRejeterBesoin() {
  const queryClient = useQueryClient();
  const depenseService = useDepenseService();

  return useMutation({
    mutationFn: async ({ id, dto }: { id: string; dto: RejeterBesoinsDTO }) => {
      const result = await depenseService.rejeterBesoin(id, dto);
      if (!result.ok) throw new Error(result.error ?? "Erreur rejet besoin");
      return result.data as ListeBesoinsWithRelations;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: besoinsKey });
    },
  });
}

export function useTraiterBesoin() {
  const queryClient = useQueryClient();
  const depenseService = useDepenseService();

  return useMutation({
    mutationFn: async ({ id, dto }: { id: string; dto: TraiterBesoinsDTO }) => {
      const result = await depenseService.traiterBesoin(id, dto);
      if (!result.ok) throw new Error(result.error ?? "Erreur traitement besoins");
      return result.data as ListeBesoinsWithRelations;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: besoinsKey });
      queryClient.invalidateQueries({ queryKey: queryKeys.depenses.all });
    },
  });
}

export function useCloturerBesoin() {
  const queryClient = useQueryClient();
  const depenseService = useDepenseService();

  return useMutation({
    mutationFn: async ({ id, dto }: { id: string; dto: CloturerBesoinsDTO }) => {
      const result = await depenseService.cloturerBesoin(id, dto);
      if (!result.ok) throw new Error(result.error ?? "Erreur clôture liste de besoins");
      return result.data as ListeBesoinsWithRelations;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: besoinsKey });
    },
  });
}
