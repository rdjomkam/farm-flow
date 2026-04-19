"use client";

import { useCallback } from "react";
import { useTranslations } from "next-intl";
import { useApi } from "@/hooks/use-api";
import type {
  ConfigElevage,
  ConfigElevageWithRelations,
  ConfigElevageListResponse,
  ConfigElevageDetailResponse,
  CreateConfigElevageDTO,
  UpdateConfigElevageDTO,
  RegleActiviteWithRelations,
  RegleActiviteWithCount,
  CreateRegleActiviteDTO,
  UpdateRegleActiviteDTO,
  ConfigAlerteWithRelations,
  CreateConfigAlerteDTO,
  UpdateConfigAlerteDTO,
  CustomPlaceholder,
  CreateCustomPlaceholderDTO,
  UpdateCustomPlaceholderDTO,
  Pack,
  PackWithRelations,
  PackListResponse,
  CreatePackDTO,
  UpdatePackDTO,
  CreatePackProduitDTO,
  CreatePackBacDTO,
  ActivatePackDTO,
  PackActivationResponse,
  PackActivationListResponse,
} from "@/types";

// ---------------------------------------------------------------------------
// Types internes
// ---------------------------------------------------------------------------

interface RegleActiviteListResult {
  regles: RegleActiviteWithCount[];
}

interface ConfigAlerteListResult {
  configs: ConfigAlerteWithRelations[];
}

interface PlaceholderListResult {
  placeholders: CustomPlaceholder[];
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

/**
 * useConfigService — Appels API pour /api/config-elevage/**, /api/regles-activites/**,
 *                    /api/alertes/config/**, /api/packs/**
 *
 * Centralise toute la configuration du site : elevage, regles d'activites,
 * alertes, packs de provisioning et placeholders personnalises.
 */
export function useConfigService() {
  const { call } = useApi();
  const t = useTranslations("config-elevage");
  const tPacks = useTranslations("packs");

  // -- Config elevage --

  const listConfigs = useCallback(
    () => call<ConfigElevageListResponse>("/api/config-elevage"),
    [call]
  );

  const getConfig = useCallback(
    (id: string) => call<ConfigElevageDetailResponse>(`/api/config-elevage/${id}`),
    [call]
  );

  const getConfigDefaut = useCallback(
    () => call<ConfigElevage>("/api/config-elevage/defaut"),
    [call]
  );

  const createConfig = useCallback(
    (dto: CreateConfigElevageDTO) =>
      call<ConfigElevageWithRelations>(
        "/api/config-elevage",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(dto),
        },
        { successMessage: t("toasts.configCreated") }
      ),
    [call, t]
  );

  const updateConfig = useCallback(
    (id: string, dto: UpdateConfigElevageDTO) =>
      call<ConfigElevageWithRelations>(
        `/api/config-elevage/${id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(dto),
        },
        { successMessage: t("toasts.configUpdated") }
      ),
    [call, t]
  );

  const deleteConfig = useCallback(
    (id: string) =>
      call<{ message: string }>(
        `/api/config-elevage/${id}`,
        { method: "DELETE" },
        { successMessage: t("toasts.configDeleted") }
      ),
    [call, t]
  );

  const dupliquerConfig = useCallback(
    (id: string, body?: { nom?: string }) =>
      call<ConfigElevageWithRelations>(
        `/api/config-elevage/${id}/dupliquer`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body ?? {}),
        },
        { successMessage: t("toasts.configDuplicated") }
      ),
    [call, t]
  );

  // -- Regles d'activites --

  const listRegles = useCallback(
    () => call<RegleActiviteListResult>("/api/regles-activites"),
    [call]
  );

  const getRegle = useCallback(
    (id: string) => call<RegleActiviteWithRelations>(`/api/regles-activites/${id}`),
    [call]
  );

  const createRegle = useCallback(
    (dto: CreateRegleActiviteDTO) =>
      call<RegleActiviteWithRelations>(
        "/api/regles-activites",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(dto),
        },
        { successMessage: t("toasts.regleCreated") }
      ),
    [call, t]
  );

  const updateRegle = useCallback(
    (id: string, dto: UpdateRegleActiviteDTO) =>
      call<RegleActiviteWithRelations>(
        `/api/regles-activites/${id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(dto),
        },
        { successMessage: t("toasts.regleUpdated") }
      ),
    [call, t]
  );

  const deleteRegle = useCallback(
    (id: string) =>
      call<{ message: string }>(
        `/api/regles-activites/${id}`,
        { method: "DELETE" },
        { successMessage: t("toasts.regleDeleted") }
      ),
    [call, t]
  );

  const toggleRegle = useCallback(
    (id: string) =>
      call<RegleActiviteWithRelations>(
        `/api/regles-activites/${id}/toggle`,
        { method: "PATCH" },
        { successMessage: t("toasts.regleUpdated") }
      ),
    [call, t]
  );

  const resetRegle = useCallback(
    (id: string) =>
      call<RegleActiviteWithRelations>(
        `/api/regles-activites/${id}/reset`,
        { method: "POST" },
        { successMessage: t("toasts.regleReset") }
      ),
    [call, t]
  );

  // -- Placeholders personnalises --

  const listPlaceholders = useCallback(
    (params?: { regleId?: string; onlyActive?: boolean }) => {
      const qs = new URLSearchParams();
      if (params?.regleId) qs.set("regleId", params.regleId);
      if (params?.onlyActive !== undefined) qs.set("onlyActive", String(params.onlyActive));
      const query = qs.toString();
      return call<PlaceholderListResult>(`/api/regles-activites/placeholders${query ? `?${query}` : ""}`);
    },
    [call]
  );

  const createPlaceholder = useCallback(
    (dto: CreateCustomPlaceholderDTO) =>
      call<CustomPlaceholder>(
        "/api/regles-activites/placeholders",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(dto),
        },
        { successMessage: t("toasts.placeholderCreated") }
      ),
    [call, t]
  );

  const updatePlaceholder = useCallback(
    (id: string, dto: UpdateCustomPlaceholderDTO) =>
      call<CustomPlaceholder>(
        `/api/regles-activites/placeholders/${id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(dto),
        },
        { successMessage: t("toasts.placeholderUpdated") }
      ),
    [call, t]
  );

  const deletePlaceholder = useCallback(
    (id: string) =>
      call<{ message: string }>(
        `/api/regles-activites/placeholders/${id}`,
        { method: "DELETE" },
        { successMessage: t("toasts.placeholderDeleted") }
      ),
    [call, t]
  );

  // -- Config alertes --

  const listConfigAlertes = useCallback(
    () => call<ConfigAlerteListResult>("/api/alertes/config"),
    [call]
  );

  const createConfigAlerte = useCallback(
    (dto: CreateConfigAlerteDTO) =>
      call<ConfigAlerteWithRelations>(
        "/api/alertes/config",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(dto),
        },
        { successMessage: t("toasts.alerteCreated") }
      ),
    [call, t]
  );

  const updateConfigAlerte = useCallback(
    (id: string, dto: UpdateConfigAlerteDTO) =>
      call<ConfigAlerteWithRelations>(
        `/api/alertes/config/${id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(dto),
        },
        { successMessage: t("toasts.alerteUpdated") }
      ),
    [call, t]
  );

  const deleteConfigAlerte = useCallback(
    (id: string) =>
      call<{ message: string }>(
        `/api/alertes/config/${id}`,
        { method: "DELETE" },
        { successMessage: t("toasts.alerteDeleted") }
      ),
    [call, t]
  );

  const checkAlertes = useCallback(
    () =>
      call<{ checked: number; triggered: number }>("/api/alertes/check", {
        method: "POST",
      }),
    [call]
  );

  // -- Packs de provisioning --

  const listPacks = useCallback(
    () => call<PackListResponse>("/api/packs"),
    [call]
  );

  const getPack = useCallback(
    (id: string) => call<PackWithRelations>(`/api/packs/${id}`),
    [call]
  );

  const createPack = useCallback(
    (dto: CreatePackDTO) =>
      call<Pack>(
        "/api/packs",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(dto),
        },
        { successMessage: tPacks("toasts.packCreated") }
      ),
    [call, tPacks]
  );

  const updatePack = useCallback(
    (id: string, dto: UpdatePackDTO) =>
      call<Pack>(
        `/api/packs/${id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(dto),
        },
        { successMessage: tPacks("toasts.packUpdated") }
      ),
    [call, tPacks]
  );

  const addPackProduit = useCallback(
    (packId: string, dto: CreatePackProduitDTO) =>
      call<PackWithRelations>(
        `/api/packs/${packId}/produits`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(dto),
        },
        { successMessage: tPacks("toasts.produitAdded") }
      ),
    [call, tPacks]
  );

  const addPackBac = useCallback(
    (packId: string, dto: CreatePackBacDTO) =>
      call<PackWithRelations>(
        `/api/packs/${packId}/bacs`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(dto),
        },
        { successMessage: tPacks("toasts.bacAdded") }
      ),
    [call, tPacks]
  );

  const updatePackBacs = useCallback(
    (packId: string, body: Record<string, unknown>) =>
      call<PackWithRelations>(
        `/api/packs/${packId}/bacs`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
        { successMessage: tPacks("toasts.bacsSaved") }
      ),
    [call, tPacks]
  );

  const deletePackProduit = useCallback(
    (packId: string, produitId: string) =>
      call<PackWithRelations>(
        `/api/packs/${packId}/produits?produitId=${encodeURIComponent(produitId)}`,
        { method: "DELETE" },
        { successMessage: tPacks("toasts.produitRemoved") }
      ),
    [call, tPacks]
  );

  const activerPack = useCallback(
    (packId: string, dto: ActivatePackDTO) =>
      call<PackActivationResponse>(
        `/api/packs/${packId}/activer`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(dto),
        },
        { successMessage: tPacks("toasts.packActivated") }
      ),
    [call, tPacks]
  );

  const listActivations = useCallback(
    () => call<PackActivationListResponse>("/api/activations"),
    [call]
  );

  return {
    listConfigs,
    getConfig,
    getConfigDefaut,
    createConfig,
    updateConfig,
    deleteConfig,
    dupliquerConfig,
    listRegles,
    getRegle,
    createRegle,
    updateRegle,
    deleteRegle,
    toggleRegle,
    resetRegle,
    listPlaceholders,
    createPlaceholder,
    updatePlaceholder,
    deletePlaceholder,
    listConfigAlertes,
    createConfigAlerte,
    updateConfigAlerte,
    deleteConfigAlerte,
    checkAlertes,
    listPacks,
    getPack,
    createPack,
    updatePack,
    addPackProduit,
    addPackBac,
    updatePackBacs,
    deletePackProduit,
    activerPack,
    listActivations,
  };
}
