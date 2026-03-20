"use client";

import { useCallback } from "react";
import { useApi } from "@/hooks/use-api";

// ---------------------------------------------------------------------------
// Types de réponse (les interfaces de finances ne sont pas encore dans @/types)
// TODO : déplacer vers src/types/api.ts quand les structures sont stables
// ---------------------------------------------------------------------------

/** Résumé financier global */
interface FinancesResumeData {
  totalVentes: number;
  totalDepenses: number;
  marge: number;
  [key: string]: unknown;
}

/** Evolution mensuelle des finances */
interface FinancesEvolutionData {
  mois: Array<{ label: string; ventes: number; depenses: number }>;
}

/** Finances par vague */
interface FinancesParVagueData {
  vagues: Array<{
    vagueId: string;
    code: string;
    totalVentes: number;
    totalDepenses: number;
    marge: number;
  }>;
}

/** Top clients par montant */
interface FinancesTopClientsData {
  clients: Array<{
    clientId: string;
    nom: string;
    totalAchats: number;
  }>;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

/**
 * useFinanceService — Appels API pour /api/finances/**
 */
export function useFinanceService() {
  const { call } = useApi();

  const getResume = useCallback(
    (params?: { periode?: string }) => {
      const qs = params?.periode
        ? `?periode=${encodeURIComponent(params.periode)}`
        : "";
      return call<FinancesResumeData>(`/api/finances/resume${qs}`);
    },
    [call]
  );

  const getEvolution = useCallback(
    (params?: { mois?: number }) => {
      const qs = params?.mois ? `?mois=${params.mois}` : "";
      return call<FinancesEvolutionData>(`/api/finances/evolution${qs}`);
    },
    [call]
  );

  const getParVague = useCallback(
    () => call<FinancesParVagueData>("/api/finances/par-vague"),
    [call]
  );

  const getTopClients = useCallback(
    () => call<FinancesTopClientsData>("/api/finances/top-clients"),
    [call]
  );

  return { getResume, getEvolution, getParVague, getTopClients };
}
