"use client";

import { useCallback } from "react";
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
        { successMessage: "Lot d'alevins cree !" }
      ),
    [call]
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
        { successMessage: "Lot modifie." }
      ),
    [call]
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
        { successMessage: "Lot transfere." }
      ),
    [call]
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
        { successMessage: "Ponte enregistree !" }
      ),
    [call]
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
        { successMessage: "Ponte modifiee." }
      ),
    [call]
  );

  const deletePonte = useCallback(
    (id: string) =>
      call<{ message: string }>(
        `/api/pontes/${id}`,
        { method: "DELETE" },
        { successMessage: "Ponte supprimee." }
      ),
    [call]
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
        { successMessage: "Reproducteur cree." }
      ),
    [call]
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
        { successMessage: "Reproducteur modifie." }
      ),
    [call]
  );

  const deleteReproducteur = useCallback(
    (id: string) =>
      call<{ message: string }>(
        `/api/reproducteurs/${id}`,
        { method: "DELETE" },
        { successMessage: "Reproducteur supprime." }
      ),
    [call]
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
