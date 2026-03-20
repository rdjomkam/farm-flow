"use client";

import { useCallback } from "react";
import { useApi } from "@/hooks/use-api";

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

/**
 * useExportService — Téléchargements de fichiers depuis /api/export/**
 *
 * Toutes les méthodes utilisent `download()` (blob → fichier local).
 * Le toast de succès inclut le nom du fichier.
 *
 * @example
 * const exportService = useExportService();
 * await exportService.vaguePdf(vagueId, vagueCode);
 */
export function useExportService() {
  const { download } = useApi();

  const vaguePdf = useCallback(
    (vagueId: string, vagueCode: string) =>
      download(
        `/api/export/vague/${vagueId}`,
        `rapport-vague-${vagueCode}.pdf`
      ),
    [download]
  );

  const vagueReleves = useCallback(
    (vagueId: string, vagueCode: string) =>
      download(
        `/api/export/releves?vagueId=${vagueId}`,
        `releves-${vagueCode}.xlsx`
      ),
    [download]
  );

  const relevesCsv = useCallback(
    (params?: { vagueId?: string; bacId?: string }) => {
      const qs = new URLSearchParams();
      if (params?.vagueId) qs.set("vagueId", params.vagueId);
      if (params?.bacId) qs.set("bacId", params.bacId);
      const query = qs.toString();
      return download(
        `/api/export/releves${query ? `?${query}` : ""}`,
        "releves.xlsx"
      );
    },
    [download]
  );

  const ventes = useCallback(
    () => download("/api/export/ventes", "ventes.xlsx"),
    [download]
  );

  const stock = useCallback(
    () => download("/api/export/stock", "stock.xlsx"),
    [download]
  );

  const finances = useCallback(
    () => download("/api/export/finances", "finances.xlsx"),
    [download]
  );

  const facturePdf = useCallback(
    (factureId: string, factureNumero: string) =>
      download(
        `/api/export/facture/${factureId}`,
        `facture-${factureNumero}.pdf`
      ),
    [download]
  );

  return {
    vaguePdf,
    vagueReleves,
    relevesCsv,
    ventes,
    stock,
    finances,
    facturePdf,
  };
}
