"use client";

import { useCallback } from "react";
import { useTranslations } from "next-intl";
import { useApi } from "@/hooks/use-api";
import type {
  CreateVenteDTO,
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
  const t = useTranslations("ventes");

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
          successMessage: t("toasts.venteCreated"),
          offlineCapable: true,
          entityType: "vente",
          entityLabel: "Vente",
          priority: 2,
        }
      ),
    [call, t]
  );

  const deleteVente = useCallback(
    (id: string) =>
      call<{ message: string }>(
        `/api/ventes/${id}`,
        { method: "DELETE" },
        { successMessage: t("toasts.venteDeleted") }
      ),
    [call, t]
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
        { successMessage: t("toasts.factureUpdated") }
      ),
    [call, t]
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
        { successMessage: t("toasts.paiementCreated") }
      ),
    [call, t]
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
        { successMessage: t("toasts.clientCreated") }
      ),
    [call, t]
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
        { successMessage: t("toasts.clientUpdated") }
      ),
    [call, t]
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
        { successMessage: t("toasts.factureCreated") }
      ),
    [call, t]
  );

  return {
    listVentes,
    getVente,
    createVente,
    deleteVente,
    listFactures,
    getFacture,
    updateFacture,
    addPaiement,
    listClients,
    createClient,
    updateClient,
    createFacture,
  };
}
