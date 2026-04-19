"use client";

import { useCallback } from "react";
import { useTranslations } from "next-intl";
import { useApi } from "@/hooks/use-api";
import type {
  CalibrageWithRelations,
  CreateCalibrageDTO,
  UpdateCalibrageGroupeDTO,
  PatchCalibrageBody,
  PatchCalibrageResponse,
} from "@/types";

// ---------------------------------------------------------------------------
// Types internes
// ---------------------------------------------------------------------------

interface CalibrageListResult {
  calibrages: CalibrageWithRelations[];
  total: number;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

/**
 * useCalibrageService — Appels API pour /api/calibrages/**
 *
 * Gestion du calibrage (tri par taille) des lots de poissons.
 */
export function useCalibrageService() {
  const { call } = useApi();
  const t = useTranslations("calibrage");

  const list = useCallback(
    (params?: { vagueId?: string }) => {
      const qs = params?.vagueId
        ? `?vagueId=${encodeURIComponent(params.vagueId)}`
        : "";
      return call<CalibrageListResult>(`/api/calibrages${qs}`);
    },
    [call]
  );

  const get = useCallback(
    (id: string) => call<PatchCalibrageResponse>(`/api/calibrages/${id}`),
    [call]
  );

  const create = useCallback(
    (dto: CreateCalibrageDTO) =>
      call<CalibrageWithRelations>(
        "/api/calibrages",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(dto),
        },
        { successMessage: t("toasts.created") }
      ),
    [call, t]
  );

  const update = useCallback(
    (id: string, body: PatchCalibrageBody) =>
      call<PatchCalibrageResponse>(
        `/api/calibrages/${id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
        { successMessage: t("toasts.updated") }
      ),
    [call, t]
  );

  const updateGroupe = useCallback(
    (id: string, dto: UpdateCalibrageGroupeDTO) =>
      call<CalibrageWithRelations>(
        `/api/calibrages/${id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(dto),
        },
        { successMessage: t("toasts.groupeUpdated") }
      ),
    [call, t]
  );

  return { list, get, create, update, updateGroupe };
}
