"use client";

import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/hooks/use-api";
import { queryKeys } from "@/lib/query-keys";
import type {
  CreateUniteProductionDTO,
  UpdateUniteProductionDTO,
  CreateTransfertInterneDTO,
  UniteProductionWithRelations,
  TransfertInterneWithRelations,
} from "@/types";

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

/**
 * useUniteProductionService — Appels API pour /api/unites-production
 *                              et /api/transferts-internes
 *
 * Gestion des unites de production (centres de cout) et des transferts
 * internes entre unites.
 */
export function useUniteProductionService() {
  const { call } = useApi();
  const queryClient = useQueryClient();

  // -- Unites de production --

  const getUnitesProduction = useCallback(
    () =>
      call<{ unitesProduction: UniteProductionWithRelations[] }>(
        "/api/unites-production"
      ),
    [call]
  );

  const createUniteProduction = useCallback(
    async (dto: CreateUniteProductionDTO) => {
      const result = await call<UniteProductionWithRelations>(
        "/api/unites-production",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(dto),
        },
        { successMessage: "Unite de production creee !" }
      );
      await queryClient.invalidateQueries({
        queryKey: queryKeys.unitesProduction.all,
      });
      return result;
    },
    [call, queryClient]
  );

  const updateUniteProduction = useCallback(
    async (id: string, dto: UpdateUniteProductionDTO) => {
      const result = await call<UniteProductionWithRelations>(
        `/api/unites-production/${id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(dto),
        },
        { successMessage: "Unite de production modifiee." }
      );
      await queryClient.invalidateQueries({
        queryKey: queryKeys.unitesProduction.all,
      });
      return result;
    },
    [call, queryClient]
  );

  // -- Transferts internes --

  const getTransfertsInternes = useCallback(
    (filters?: { uniteProductionId?: string }) => {
      const qs = new URLSearchParams();
      if (filters?.uniteProductionId) {
        qs.set("uniteProductionId", filters.uniteProductionId);
      }
      const query = qs.toString();
      return call<{ transferts: TransfertInterneWithRelations[] }>(
        `/api/transferts-internes${query ? `?${query}` : ""}`
      );
    },
    [call]
  );

  const createTransfertInterne = useCallback(
    async (dto: CreateTransfertInterneDTO) => {
      const result = await call<TransfertInterneWithRelations>(
        "/api/transferts-internes",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(dto),
        },
        { successMessage: "Transfert interne enregistre !" }
      );
      await queryClient.invalidateQueries({
        queryKey: queryKeys.transfertsInternes.all,
      });
      await queryClient.invalidateQueries({
        queryKey: queryKeys.unitesProduction.all,
      });
      return result;
    },
    [call, queryClient]
  );

  return {
    getUnitesProduction,
    createUniteProduction,
    updateUniteProduction,
    getTransfertsInternes,
    createTransfertInterne,
  };
}
