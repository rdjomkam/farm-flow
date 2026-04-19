"use client";

import { useCallback } from "react";
import { useTranslations } from "next-intl";
import { useApi } from "@/hooks/use-api";
import type {
  CommandeListResponse,
  CommandeDetailResponse,
  FournisseurListResponse,
  ProduitListResponse,
  CreateCommandeDTO,
  CreateFournisseurDTO,
  UpdateFournisseurDTO,
  CreateProduitDTO,
  UpdateProduitDTO,
  CreateMouvementDTO,
  Produit,
  Fournisseur,
  CommandeWithRelations,
  LigneReceptionInput,
  RecevoirCommandeResponse,
} from "@/types";

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

/**
 * useStockService — Appels API pour /api/produits/**, /api/commandes/**,
 *                   /api/fournisseurs/**, /api/stock/**
 */
export function useStockService() {
  const { call } = useApi();
  const t = useTranslations("stock");

  // -- Produits --

  const listProduits = useCallback(
    (params?: { categorie?: string }) => {
      const qs = params?.categorie
        ? `?categorie=${encodeURIComponent(params.categorie)}`
        : "";
      return call<ProduitListResponse>(`/api/produits${qs}`);
    },
    [call]
  );

  const getProduit = useCallback(
    (id: string) => call<Produit>(`/api/produits/${id}`),
    [call]
  );

  const createProduit = useCallback(
    (dto: CreateProduitDTO) =>
      call<Produit>(
        "/api/produits",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(dto),
        },
        { successMessage: t("toasts.produitCreated") }
      ),
    [call, t]
  );

  const updateProduit = useCallback(
    (id: string, dto: UpdateProduitDTO) =>
      call<Produit>(
        `/api/produits/${id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(dto),
        },
        { successMessage: t("toasts.produitUpdated") }
      ),
    [call, t]
  );

  // -- Mouvements --

  const createMouvement = useCallback(
    (dto: CreateMouvementDTO) =>
      call<{ message: string }>(
        "/api/stock/mouvements",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(dto),
        },
        { successMessage: t("toasts.mouvementCreated") }
      ),
    [call, t]
  );

  const getStockAlertes = useCallback(
    () => call<ProduitListResponse>("/api/stock/alertes"),
    [call]
  );

  // -- Commandes --

  const listCommandes = useCallback(
    () => call<CommandeListResponse>("/api/commandes"),
    [call]
  );

  const getCommande = useCallback(
    (id: string) => call<CommandeDetailResponse>(`/api/commandes/${id}`),
    [call]
  );

  const createCommande = useCallback(
    (dto: CreateCommandeDTO) =>
      call<CommandeWithRelations>(
        "/api/commandes",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(dto),
        },
        { successMessage: t("toasts.commandeCreated") }
      ),
    [call, t]
  );

  const envoyerCommande = useCallback(
    (id: string) =>
      call<CommandeWithRelations>(
        `/api/commandes/${id}/envoyer`,
        { method: "POST" },
        { successMessage: t("toasts.commandeEnvoyee") }
      ),
    [call, t]
  );

  const annulerCommande = useCallback(
    (id: string) =>
      call<CommandeWithRelations>(
        `/api/commandes/${id}/annuler`,
        { method: "POST" },
        { successMessage: t("toasts.commandeAnnulee") }
      ),
    [call, t]
  );

  // -- Fournisseurs --

  const listFournisseurs = useCallback(
    () => call<FournisseurListResponse>("/api/fournisseurs"),
    [call]
  );

  const createFournisseur = useCallback(
    (dto: CreateFournisseurDTO) =>
      call<Fournisseur>(
        "/api/fournisseurs",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(dto),
        },
        { successMessage: t("toasts.fournisseurCreated") }
      ),
    [call, t]
  );

  const updateFournisseur = useCallback(
    (id: string, dto: UpdateFournisseurDTO) =>
      call<Fournisseur>(
        `/api/fournisseurs/${id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(dto),
        },
        { successMessage: t("toasts.fournisseurUpdated") }
      ),
    [call, t]
  );

  // -- Commandes avancees --

  const recevoirCommande = useCallback(
    async (
      id: string,
      dateLivraison: string,
      lignes: LigneReceptionInput[],
      file?: File
    ) => {
      if (file) {
        const formData = new FormData();
        formData.set("dateLivraison", dateLivraison);
        formData.set("lignes", JSON.stringify(lignes));
        formData.set("file", file);
        return call<RecevoirCommandeResponse>(
          `/api/commandes/${id}/recevoir`,
          { method: "POST", body: formData },
          { successMessage: t("toasts.commandeReceptionnee") }
        );
      }
      return call<RecevoirCommandeResponse>(
        `/api/commandes/${id}/recevoir`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ dateLivraison, lignes }),
        },
        { successMessage: t("toasts.commandeReceptionnee") }
      );
    },
    [call, t]
  );

  const uploadFactureCommande = useCallback(
    (id: string, file: File) => {
      const formData = new FormData();
      formData.set("file", file);
      return call<{ factureUrl: string }>(
        `/api/commandes/${id}/facture`,
        { method: "POST", body: formData },
        { successMessage: t("toasts.factureUploadee") }
      );
    },
    [call, t]
  );

  const getFactureCommandeUrl = useCallback(
    (id: string) =>
      call<{ url: string }>(`/api/commandes/${id}/facture`),
    [call]
  );

  const deleteFactureCommande = useCallback(
    (id: string) =>
      call<{ message: string }>(
        `/api/commandes/${id}/facture`,
        { method: "DELETE" },
        { successMessage: t("toasts.factureSupprimee") }
      ),
    [call, t]
  );

  return {
    listProduits,
    getProduit,
    createProduit,
    updateProduit,
    createMouvement,
    getStockAlertes,
    listCommandes,
    getCommande,
    createCommande,
    envoyerCommande,
    annulerCommande,
    recevoirCommande,
    uploadFactureCommande,
    getFactureCommandeUrl,
    deleteFactureCommande,
    listFournisseurs,
    createFournisseur,
    updateFournisseur,
  };
}
