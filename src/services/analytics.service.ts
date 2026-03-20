"use client";

import { useCallback } from "react";
import { useApi } from "@/hooks/use-api";
import type { AnalyticsDashboard } from "@/types";

// ---------------------------------------------------------------------------
// Types de réponse analytics
// Les structures détaillées sont dans src/lib/queries/analytics.ts
// TODO : exporter formellement depuis @/types
// ---------------------------------------------------------------------------

/** Réponse comparaison de vagues */
interface AnalyticsVaguesData {
  vagues: Array<Record<string, unknown>>;
}

/** Liste des bacs avec indicateurs */
interface AnalyticsBacsData {
  bacs: Array<Record<string, unknown>>;
}

/** Détail d'un bac avec historique */
interface AnalyticsBacDetailData {
  bac: Record<string, unknown>;
  historique: Array<Record<string, unknown>>;
}

/** Comparaison d'aliments */
interface AnalyticsAlimentsData {
  produits: Array<Record<string, unknown>>;
}

/** Détail d'un aliment */
interface AnalyticsAlimentDetailData {
  produit: Record<string, unknown>;
  consommations: Array<Record<string, unknown>>;
}

/** Résultat d'une simulation de ration */
interface AnalyticsSimulationResult {
  rationJournaliereKg: number;
  coutJournalier: number;
  coutTotal: number;
  [key: string]: unknown;
}

interface SimulationParams {
  vagueId: string;
  produitId: string;
  tauxRation?: number;
  frequence?: number;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

/**
 * useAnalyticsService — Appels API pour /api/analytics/**
 */
export function useAnalyticsService() {
  const { call } = useApi();

  const getDashboard = useCallback(
    () => call<AnalyticsDashboard>("/api/analytics/dashboard"),
    [call]
  );

  const getVagues = useCallback(
    (params?: { vagueIds?: string[] }) => {
      const qs = params?.vagueIds?.length
        ? `?vagueIds=${params.vagueIds.join(",")}`
        : "";
      return call<AnalyticsVaguesData>(`/api/analytics/vagues${qs}`);
    },
    [call]
  );

  const getBacs = useCallback(
    () => call<AnalyticsBacsData>("/api/analytics/bacs"),
    [call]
  );

  const getBacDetail = useCallback(
    (bacId: string) =>
      call<AnalyticsBacDetailData>(`/api/analytics/bacs/${bacId}`),
    [call]
  );

  const getBacHistorique = useCallback(
    (bacId: string) =>
      call<AnalyticsBacDetailData>(`/api/analytics/bacs/${bacId}/historique`),
    [call]
  );

  const getAliments = useCallback(
    () => call<AnalyticsAlimentsData>("/api/analytics/aliments"),
    [call]
  );

  const getAlimentDetail = useCallback(
    (produitId: string) =>
      call<AnalyticsAlimentDetailData>(`/api/analytics/aliments/${produitId}`),
    [call]
  );

  const simulerAlimentation = useCallback(
    (params: SimulationParams) =>
      call<AnalyticsSimulationResult>(
        "/api/analytics/aliments/simulation",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(params),
        }
      ),
    [call]
  );

  /** Simuler un changement d'aliment (ancienProduitId → nouveauProduitId) */
  const simulerChangementAliment = useCallback(
    (params: { ancienProduitId: string; nouveauProduitId: string; productionCible: number }) =>
      call<AnalyticsSimulationResult>(
        "/api/analytics/aliments/simulation",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(params),
        }
      ),
    [call]
  );

  return {
    getDashboard,
    getVagues,
    getBacs,
    getBacDetail,
    getBacHistorique,
    getAliments,
    getAlimentDetail,
    simulerAlimentation,
    simulerChangementAliment,
  };
}
