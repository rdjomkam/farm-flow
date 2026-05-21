"use client";

import { useCallback } from "react";
import { useApi } from "@/hooks/use-api";
import type {
  CreateVenteDTO,
  UpdateVenteDTO,
  ClotureVenteDTO,
  VenteListResponse,
  FactureListResponse,
  FactureDetailResponse,
  ClientListResponse,
  CreateClientDTO,
  UpdateClientDTO,
  CreatePaiementDTO,
  VenteWithRelations,
  FactureWithRelations,
  Client,
} from "@/types";

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

/**
 * useVenteService — Appels API pour /api/ventes/**, /api/factures/**, /api/clients/**
 */
export function useVenteService() {
  const { call } = useApi();

  // -- Ventes --

  const listVentes = useCallback(
    () => call<VenteListResponse>("/api/ventes"),
    [call]
  );

  const getVente = useCallback(
    (id: string) => call<VenteWithRelations>(`/api/ventes/${id}`),
    [call]
  );

  const createVente = useCallback(
    (dto: CreateVenteDTO) =>
      call<VenteWithRelations>(
        "/api/ventes",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(dto),
        },
        {
          successMessage: "Vente enregistrée !",
        }
      ),
    [call]
  );

  /** POST /api/ventes with raw body (for reproduction alevins sales) */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const createVenteRaw = useCallback(
    (body: Record<string, unknown>) =>
      call<VenteWithRelations>(
        "/api/ventes",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
        {
          successMessage: "Vente d'alevins enregistrée !",
        }
      ),
    [call]
  );

  const updateVente = useCallback(
    (id: string, dto: UpdateVenteDTO) =>
      call<VenteWithRelations>(
        `/api/ventes/${id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(dto),
        },
        { successMessage: "Vente modifiée." }
      ),
    [call]
  );

  const cloturerVente = useCallback(
    (id: string, dto: ClotureVenteDTO) =>
      call<VenteWithRelations>(
        `/api/ventes/${id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(dto),
        },
        { successMessage: "Livraison clôturée." }
      ),
    [call]
  );

  const cloturerDefinitivement = useCallback(
    (id: string) =>
      call<VenteWithRelations>(
        `/api/ventes/${id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "cloturer_definitivement" }),
        },
        { successMessage: "Vente clôturée définitivement." }
      ),
    [call]
  );

  const deleteVente = useCallback(
    (id: string) =>
      call<{ message: string }>(
        `/api/ventes/${id}`,
        { method: "DELETE" },
        { successMessage: "Vente supprimée." }
      ),
    [call]
  );

  // -- Factures --

  const listFactures = useCallback(
    () => call<FactureListResponse>("/api/factures"),
    [call]
  );

  const getFacture = useCallback(
    (id: string) => call<FactureDetailResponse>(`/api/factures/${id}`),
    [call]
  );

  const updateFacture = useCallback(
    (id: string, body: Record<string, unknown>) =>
      call<FactureDetailResponse>(
        `/api/factures/${id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
        { successMessage: "Facture mise à jour." }
      ),
    [call]
  );

  const addPaiement = useCallback(
    (factureId: string, dto: CreatePaiementDTO) =>
      call<FactureDetailResponse>(
        `/api/factures/${factureId}/paiements`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(dto),
        },
        { successMessage: "Paiement enregistré." }
      ),
    [call]
  );

  const deletePaiement = useCallback(
    (factureId: string, paiementId: string) =>
      call<{ deleted: boolean }>(
        `/api/factures/${factureId}/paiements/${paiementId}`,
        { method: "DELETE" },
        { successMessage: "Paiement supprimé." }
      ),
    [call]
  );

  const regenererFacture = useCallback(
    (factureId: string) =>
      call<FactureDetailResponse>(
        `/api/factures/${factureId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "regenerer" }),
        },
        { successMessage: "Facture régénérée." }
      ),
    [call]
  );

  // -- Clients --

  const listClients = useCallback(
    () => call<ClientListResponse>("/api/clients"),
    [call]
  );

  const createClient = useCallback(
    (dto: CreateClientDTO) =>
      call<Client>(
        "/api/clients",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(dto),
        },
        { successMessage: "Client créé." }
      ),
    [call]
  );

  const updateClient = useCallback(
    (id: string, dto: UpdateClientDTO) =>
      call<Client>(
        `/api/clients/${id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(dto),
        },
        { successMessage: "Client mis à jour." }
      ),
    [call]
  );

  const createFacture = useCallback(
    (venteId: string) =>
      call<FactureWithRelations>(
        "/api/factures",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ venteId }),
        },
        { successMessage: "Facture créée." }
      ),
    [call]
  );

  return {
    listVentes,
    getVente,
    createVente,
    createVenteRaw,
    updateVente,
    cloturerVente,
    cloturerDefinitivement,
    deleteVente,
    listFactures,
    getFacture,
    updateFacture,
    addPaiement,
    deletePaiement,
    regenererFacture,
    listClients,
    createClient,
    updateClient,
    createFacture,
  };
}
