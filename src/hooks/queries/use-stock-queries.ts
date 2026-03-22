"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useStockService } from "@/services";
import { queryKeys } from "@/lib/query-keys";
import type {
  CreateProduitDTO,
  UpdateProduitDTO,
  CreateCommandeDTO,
  CreateMouvementDTO,
  CreateFournisseurDTO,
  UpdateFournisseurDTO,
  ProduitListResponse,
  FournisseurListResponse,
  CommandeListResponse,
} from "@/types";

// --- Produits ---

export function useProduitsList(
  filters?: { categorie?: string },
  options?: { initialData?: ProduitListResponse["produits"] },
) {
  const stockService = useStockService();

  return useQuery({
    queryKey: queryKeys.produits.list(),
    queryFn: async () => {
      const result = await stockService.listProduits(filters);
      if (!result.ok || !result.data) throw new Error(result.error ?? "Erreur chargement produits");
      return (result.data as ProduitListResponse).produits;
    },
    staleTime: 2 * 60_000,
    gcTime: 5 * 60_000,
    initialData: options?.initialData,
  });
}

export function useCreateProduit() {
  const queryClient = useQueryClient();
  const stockService = useStockService();

  return useMutation({
    mutationFn: async (dto: CreateProduitDTO) => {
      const result = await stockService.createProduit(dto);
      if (!result.ok) throw new Error(result.error ?? "Erreur création produit");
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.produits.all });
    },
  });
}

export function useUpdateProduit() {
  const queryClient = useQueryClient();
  const stockService = useStockService();

  return useMutation({
    mutationFn: async ({ id, dto }: { id: string; dto: UpdateProduitDTO }) => {
      const result = await stockService.updateProduit(id, dto);
      if (!result.ok) throw new Error(result.error ?? "Erreur modification produit");
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.produits.all });
    },
  });
}

// --- Commandes ---

export function useCommandesList(options?: { initialData?: CommandeListResponse["commandes"] }) {
  const stockService = useStockService();

  return useQuery({
    queryKey: queryKeys.stock.commandes(),
    queryFn: async () => {
      const result = await stockService.listCommandes();
      if (!result.ok || !result.data) throw new Error(result.error ?? "Erreur chargement commandes");
      return (result.data as CommandeListResponse).commandes;
    },
    staleTime: 2 * 60_000,
    gcTime: 5 * 60_000,
    initialData: options?.initialData,
  });
}

export function useCreateCommande() {
  const queryClient = useQueryClient();
  const stockService = useStockService();

  return useMutation({
    mutationFn: async (dto: CreateCommandeDTO) => {
      const result = await stockService.createCommande(dto);
      if (!result.ok) throw new Error(result.error ?? "Erreur création commande");
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.stock.commandes() });
      queryClient.invalidateQueries({ queryKey: queryKeys.produits.all });
    },
  });
}

export function useCreateMouvement() {
  const queryClient = useQueryClient();
  const stockService = useStockService();

  return useMutation({
    mutationFn: async (dto: CreateMouvementDTO) => {
      const result = await stockService.createMouvement(dto);
      if (!result.ok) throw new Error(result.error ?? "Erreur enregistrement mouvement");
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.stock.mouvements() });
      queryClient.invalidateQueries({ queryKey: queryKeys.produits.all });
    },
  });
}

// --- Fournisseurs ---

export function useFournisseursList(options?: { initialData?: FournisseurListResponse["fournisseurs"] }) {
  const stockService = useStockService();

  return useQuery({
    queryKey: queryKeys.stock.fournisseurs(),
    queryFn: async () => {
      const result = await stockService.listFournisseurs();
      if (!result.ok || !result.data) throw new Error(result.error ?? "Erreur chargement fournisseurs");
      return (result.data as FournisseurListResponse).fournisseurs;
    },
    staleTime: 2 * 60_000,
    gcTime: 5 * 60_000,
    initialData: options?.initialData,
  });
}

export function useCreateFournisseur() {
  const queryClient = useQueryClient();
  const stockService = useStockService();

  return useMutation({
    mutationFn: async (dto: CreateFournisseurDTO) => {
      const result = await stockService.createFournisseur(dto);
      if (!result.ok) throw new Error(result.error ?? "Erreur création fournisseur");
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.stock.fournisseurs() });
    },
  });
}

export function useUpdateFournisseur() {
  const queryClient = useQueryClient();
  const stockService = useStockService();

  return useMutation({
    mutationFn: async ({ id, dto }: { id: string; dto: UpdateFournisseurDTO }) => {
      const result = await stockService.updateFournisseur(id, dto);
      if (!result.ok) throw new Error(result.error ?? "Erreur modification fournisseur");
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.stock.fournisseurs() });
    },
  });
}
