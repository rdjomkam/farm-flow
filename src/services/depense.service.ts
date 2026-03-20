"use client";

import { useCallback } from "react";
import { useApi } from "@/hooks/use-api";
import type {
  DepenseWithRelations,
  DepenseListResponse,
  DepenseDetailResponse,
  CreateDepenseDTO,
  UpdateDepenseDTO,
  DepenseFilters,
  CreatePaiementDepenseDTO,
  PaiementDepenseResponse,
  DepenseRecurrenteWithRelations,
  CreateDepenseRecurrenteDTO,
  UpdateDepenseRecurrenteDTO,
  GenererDepensesRecurrentesResponse,
  ListeBesoinsWithRelations,
  ListeBesoinsListResponse,
  ListeBesoinsDetailResponse,
  CreateListeBesoinsDTO,
  UpdateListeBesoinsDTO,
  TraiterBesoinsDTO,
  CloturerBesoinsDTO,
  RejeterBesoinsDTO,
} from "@/types";

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

/**
 * useDepenseService — Appels API pour /api/depenses/**, /api/depenses-recurrentes/**,
 *                     /api/besoins/**
 *
 * Gestion des depenses, des depenses recurrentes et des listes de besoins.
 */
export function useDepenseService() {
  const { call } = useApi();

  // -- Depenses --

  const listDepenses = useCallback(
    (params?: DepenseFilters) => {
      const qs = new URLSearchParams();
      if (params?.categorieDepense) qs.set("categorieDepense", params.categorieDepense);
      if (params?.statut) qs.set("statut", params.statut);
      if (params?.dateFrom) qs.set("dateFrom", params.dateFrom);
      if (params?.dateTo) qs.set("dateTo", params.dateTo);
      if (params?.vagueId) qs.set("vagueId", params.vagueId);
      const query = qs.toString();
      return call<DepenseListResponse>(`/api/depenses${query ? `?${query}` : ""}`);
    },
    [call]
  );

  const getDepense = useCallback(
    (id: string) => call<DepenseDetailResponse>(`/api/depenses/${id}`),
    [call]
  );

  const createDepense = useCallback(
    (dto: CreateDepenseDTO) =>
      call<DepenseWithRelations>(
        "/api/depenses",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(dto),
        },
        { successMessage: "Depense enregistree !" }
      ),
    [call]
  );

  const updateDepense = useCallback(
    (id: string, dto: UpdateDepenseDTO) =>
      call<DepenseWithRelations>(
        `/api/depenses/${id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(dto),
        },
        { successMessage: "Depense modifiee." }
      ),
    [call]
  );

  const deleteDepense = useCallback(
    (id: string) =>
      call<{ message: string }>(
        `/api/depenses/${id}`,
        { method: "DELETE" },
        { successMessage: "Depense supprimee." }
      ),
    [call]
  );

  /** Upload de la facture d'une depense (FormData — PDF/JPG/PNG) */
  const uploadFactureDepense = useCallback(
    async (id: string, file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      return call<{ url: string; fileName: string }>(
        `/api/depenses/${id}/upload`,
        { method: "POST", body: formData }
        // Pas de Content-Type header : le browser gere le multipart/form-data
      );
    },
    [call]
  );

  /** Recuperer l'URL signee de la facture d'une depense */
  const getFactureDepenseUrl = useCallback(
    (id: string) =>
      call<{ url: string }>(`/api/depenses/${id}/upload`),
    [call]
  );

  /** Supprimer la facture d'une depense */
  const deleteFactureDepense = useCallback(
    (id: string) =>
      call<{ message: string }>(
        `/api/depenses/${id}/upload`,
        { method: "DELETE" },
        { successMessage: "Facture supprimee." }
      ),
    [call]
  );

  const addPaiementDepense = useCallback(
    (depenseId: string, dto: CreatePaiementDepenseDTO) =>
      call<PaiementDepenseResponse>(
        `/api/depenses/${depenseId}/paiements`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(dto),
        },
        { successMessage: "Paiement enregistre." }
      ),
    [call]
  );

  // -- Depenses recurrentes --

  const listDepensesRecurrentes = useCallback(
    () => call<{ depensesRecurrentes: DepenseRecurrenteWithRelations[] }>("/api/depenses-recurrentes"),
    [call]
  );

  const createDepenseRecurrente = useCallback(
    (dto: CreateDepenseRecurrenteDTO) =>
      call<DepenseRecurrenteWithRelations>(
        "/api/depenses-recurrentes",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(dto),
        },
        { successMessage: "Depense recurrente creee." }
      ),
    [call]
  );

  const updateDepenseRecurrente = useCallback(
    (id: string, dto: UpdateDepenseRecurrenteDTO) =>
      call<DepenseRecurrenteWithRelations>(
        `/api/depenses-recurrentes/${id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(dto),
        },
        { successMessage: "Depense recurrente modifiee." }
      ),
    [call]
  );

  const deleteDepenseRecurrente = useCallback(
    (id: string) =>
      call<{ message: string }>(
        `/api/depenses-recurrentes/${id}`,
        { method: "DELETE" },
        { successMessage: "Depense recurrente supprimee." }
      ),
    [call]
  );

  const genererDepensesRecurrentes = useCallback(
    () =>
      call<GenererDepensesRecurrentesResponse>(
        "/api/depenses-recurrentes/generer",
        { method: "POST" },
        { successMessage: "Depenses generees." }
      ),
    [call]
  );

  // -- Besoins --

  const listBesoins = useCallback(
    (params?: { statut?: string }) => {
      const qs = params?.statut
        ? `?statut=${encodeURIComponent(params.statut)}`
        : "";
      return call<ListeBesoinsListResponse>(`/api/besoins${qs}`);
    },
    [call]
  );

  const getBesoin = useCallback(
    (id: string) => call<ListeBesoinsDetailResponse>(`/api/besoins/${id}`),
    [call]
  );

  const createBesoin = useCallback(
    (dto: CreateListeBesoinsDTO) =>
      call<ListeBesoinsWithRelations>(
        "/api/besoins",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(dto),
        },
        { successMessage: "Liste de besoins creee !" }
      ),
    [call]
  );

  const updateBesoin = useCallback(
    (id: string, dto: UpdateListeBesoinsDTO) =>
      call<ListeBesoinsWithRelations>(
        `/api/besoins/${id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(dto),
        },
        { successMessage: "Liste modifiee." }
      ),
    [call]
  );

  const approuverBesoin = useCallback(
    (id: string) =>
      call<ListeBesoinsWithRelations>(
        `/api/besoins/${id}/approuver`,
        { method: "POST" },
        { successMessage: "Liste approuvee." }
      ),
    [call]
  );

  const rejeterBesoin = useCallback(
    (id: string, dto: RejeterBesoinsDTO) =>
      call<ListeBesoinsWithRelations>(
        `/api/besoins/${id}/rejeter`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(dto),
        },
        { successMessage: "Liste rejetee." }
      ),
    [call]
  );

  const traiterBesoin = useCallback(
    (id: string, dto: TraiterBesoinsDTO) =>
      call<ListeBesoinsWithRelations>(
        `/api/besoins/${id}/traiter`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(dto),
        },
        { successMessage: "Besoins traites." }
      ),
    [call]
  );

  const cloturerBesoin = useCallback(
    (id: string, dto: CloturerBesoinsDTO) =>
      call<ListeBesoinsWithRelations>(
        `/api/besoins/${id}/cloturer`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(dto),
        },
        { successMessage: "Liste cloturee." }
      ),
    [call]
  );

  return {
    listDepenses,
    getDepense,
    createDepense,
    updateDepense,
    deleteDepense,
    uploadFactureDepense,
    getFactureDepenseUrl,
    deleteFactureDepense,
    addPaiementDepense,
    listDepensesRecurrentes,
    createDepenseRecurrente,
    updateDepenseRecurrente,
    deleteDepenseRecurrente,
    genererDepensesRecurrentes,
    listBesoins,
    getBesoin,
    createBesoin,
    updateBesoin,
    approuverBesoin,
    rejeterBesoin,
    traiterBesoin,
    cloturerBesoin,
  };
}
