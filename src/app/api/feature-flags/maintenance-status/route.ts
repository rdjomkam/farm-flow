/**
 * GET /api/feature-flags/maintenance-status
 *
 * Route publique — pas d'authentification requise.
 * Retourne l'etat du mode maintenance pour les Server Components
 * (notamment la page /maintenance) afin d'afficher un message personnalise.
 *
 * Response :
 *   { maintenanceMode: boolean; message: string | null; estimatedEnd: string | null }
 *
 * ADR-maintenance-mode
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import type { MaintenanceStatusResponse } from "@/types";

export async function GET() {
  try {
    const flag = await prisma.featureFlag.findUnique({
      where: { key: "MAINTENANCE_MODE" },
      select: { enabled: true, value: true },
    });

    const cacheHeaders = {
      "Cache-Control": "public, max-age=30, s-maxage=30",
    };

    if (!flag || !flag.enabled) {
      const response: MaintenanceStatusResponse = {
        maintenanceMode: false,
        message: null,
        estimatedEnd: null,
      };
      return NextResponse.json(response, { headers: cacheHeaders });
    }

    const value = (flag.value as Record<string, unknown> | null) ?? null;

    const response: MaintenanceStatusResponse = {
      maintenanceMode: true,
      message: typeof value?.message === "string" ? value.message : null,
      estimatedEnd:
        typeof value?.estimatedEnd === "string" ? value.estimatedEnd : null,
    };

    return NextResponse.json(response, { headers: cacheHeaders });
  } catch {
    // Fail-open : si la DB est indisponible, on considere qu'il n'y a pas de maintenance
    const response: MaintenanceStatusResponse = {
      maintenanceMode: false,
      message: null,
      estimatedEnd: null,
    };
    return NextResponse.json(response, {
      headers: { "Cache-Control": "no-store" },
    });
  }
}
