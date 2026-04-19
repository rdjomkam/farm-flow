"use client";

import { useCallback } from "react";
import { useTranslations } from "next-intl";
import { useApi } from "@/hooks/use-api";
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

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

/**
 * useAlevinsService — Appels API pour /api/lots-alevins/**, /api/pontes/**,
 *                     /api/reproducteurs/**
 *
 * Gestion de la production d'alevins : reproducteurs, pontes et lots.
 */
export function useAlevinsService() {
  const { call } = useApi();
  const t = useTranslations("reproduction");

  // -- Lots d'alevins --

  const listLots = useCallback(
    (params?: { vagueId?: string; statut?: string }) => {
      const qs = new URLSearchParams();
      if (params?.vagueId) qs.set("vagueId", params.vagueId);
      if (params?.statut) qs.set("statut", params.statut);
      const query = qs.toString();
      return call<LotAlevinsListResponse>(`/api/lots-alevins${query ? `?${query}` : ""}`);
    },
    [call]
  );

  const getLot = useCallback(
    (id: string) => call<LotAlevinsWithRelations>(`/api/lots-alevins/${id}`),
    [call]
  );

  const createLot = useCallback(
    (dto: CreateLotAlevinsDTO) =>
      call<LotAlevinsWithRelations>(
        "/api/lots-alevins",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(dto),
        },
        { successMessage: t("toasts.lotCreated") }
      ),
    [call, t]
  );

  const updateLot = useCallback(
    (id: string, dto: UpdateLotAlevinsDTO) =>
      call<LotAlevinsWithRelations>(
        `/api/lots-alevins/${id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(dto),
        },
        { successMessage: t("toasts.lotUpdated") }
      ),
    [call, t]
  );

  const transfererLot = useCallback(
    (id: string, dto: TransfertLotDTO) =>
      call<LotAlevinsWithRelations>(
        `/api/lots-alevins/${id}/transferer`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(dto),
        },
        { successMessage: t("toasts.lotTransferred") }
      ),
    [call, t]
  );

  // -- Pontes --

  const listPontes = useCallback(
    (params?: { reproducteurId?: string; statut?: string }) => {
      const qs = new URLSearchParams();
      if (params?.reproducteurId) qs.set("reproducteurId", params.reproducteurId);
      if (params?.statut) qs.set("statut", params.statut);
      const query = qs.toString();
      return call<PonteListResponse>(`/api/pontes${query ? `?${query}` : ""}`);
    },
    [call]
  );

  const getPonte = useCallback(
    (id: string) => call<PonteWithRelations>(`/api/pontes/${id}`),
    [call]
  );

  const createPonte = useCallback(
    (dto: CreatePonteDTO) =>
      call<PonteWithRelations>(
        "/api/pontes",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(dto),
        },
        { successMessage: t("toasts.ponteCreated") }
      ),
    [call, t]
  );

  const updatePonte = useCallback(
    (id: string, dto: UpdatePonteDTO) =>
      call<PonteWithRelations>(
        `/api/pontes/${id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(dto),
        },
        { successMessage: t("toasts.ponteUpdated") }
      ),
    [call, t]
  );

  const deletePonte = useCallback(
    (id: string) =>
      call<{ message: string }>(
        `/api/pontes/${id}`,
        { method: "DELETE" },
        { successMessage: t("toasts.ponteDeleted") }
      ),
    [call, t]
  );

  // -- Reproducteurs --

  const listReproducteurs = useCallback(
    (params?: { sexe?: string; statut?: string }) => {
      const qs = new URLSearchParams();
      if (params?.sexe) qs.set("sexe", params.sexe);
      if (params?.statut) qs.set("statut", params.statut);
      const query = qs.toString();
      return call<ReproducteurListResponse>(`/api/reproducteurs${query ? `?${query}` : ""}`);
    },
    [call]
  );

  const getReproducteur = useCallback(
    (id: string) => call<ReproducteurWithRelations>(`/api/reproducteurs/${id}`),
    [call]
  );

  const createReproducteur = useCallback(
    (dto: CreateReproducteurDTO) =>
      call<ReproducteurWithRelations>(
        "/api/reproducteurs",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(dto),
        },
        { successMessage: t("toasts.reproducteurCreated") }
      ),
    [call, t]
  );

  const updateReproducteur = useCallback(
    (id: string, dto: UpdateReproducteurDTO) =>
      call<ReproducteurWithRelations>(
        `/api/reproducteurs/${id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(dto),
        },
        { successMessage: t("toasts.reproducteurUpdated") }
      ),
    [call, t]
  );

  const deleteReproducteur = useCallback(
    (id: string) =>
      call<{ message: string }>(
        `/api/reproducteurs/${id}`,
        { method: "DELETE" },
        { successMessage: t("toasts.reproducteurDeleted") }
      ),
    [call, t]
  );

  return {
    listLots,
    getLot,
    createLot,
    updateLot,
    transfererLot,
    listPontes,
    getPonte,
    createPonte,
    updatePonte,
    deletePonte,
    listReproducteurs,
    getReproducteur,
    createReproducteur,
    updateReproducteur,
    deleteReproducteur,
  };
}
