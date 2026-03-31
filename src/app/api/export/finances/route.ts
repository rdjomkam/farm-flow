/**
 * GET /api/export/finances
 *
 * Génère et télécharge le rapport financier en PDF.
 * Query params : dateFrom (ISO), dateTo (ISO)
 * Permissions requises : FINANCES_VOIR + EXPORT_DONNEES
 */

import { NextRequest, NextResponse } from "next/server";
import { AuthError } from "@/lib/auth";
import { requirePermission, ForbiddenError } from "@/lib/permissions";
import {
  getResumeFinancier,
  getRentabiliteParVague,
  getEvolutionFinanciere,
  getTopClients,
} from "@/lib/queries/finances";
import { renderRapportFinancierPDF } from "@/lib/export/pdf-rapport-financier";
import { Permission } from "@/types";
import type { CreateRapportFinancierPDFDTO } from "@/types/export";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const auth = await requirePermission(
      request,
      Permission.FINANCES_VOIR,
      Permission.EXPORT_DONNEES
    );

    const { searchParams } = new URL(request.url);
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");

    // Dates par défaut : 30 derniers jours si non fournies
    const dateDebut = dateFrom
      ? new Date(dateFrom)
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const dateFin = dateTo ? new Date(dateTo) : new Date();

    const periode = dateFrom && dateTo
      ? { dateFrom, dateTo }
      : undefined;

    // Récupérer toutes les données financières en parallèle
    const [resume, parVague, evolution, topClientsData, site] = await Promise.all([
      getResumeFinancier(auth.activeSiteId, periode),
      getRentabiliteParVague(auth.activeSiteId),
      getEvolutionFinanciere(auth.activeSiteId, 12),
      getTopClients(auth.activeSiteId, 10),
      prisma.site.findUnique({
        where: { id: auth.activeSiteId },
        select: { name: true, address: true },
      }),
    ]);

    if (!site) {
      return NextResponse.json({ status: 404, message: "Site introuvable" }, { status: 404 });
    }

    // Construire le DTO
    const dto: CreateRapportFinancierPDFDTO = {
      site: {
        name: site.name,
        address: site.address ?? null,
      },
      periode: {
        dateDebut,
        dateFin,
      },
      kpis: {
        revenusTotal: resume.revenus,
        coutsTotal: resume.coutsTotaux,
        margeNette: resume.margeBrute,
        tauxMarge: resume.tauxMarge ?? 0,
      },
      ventesParVague: parVague.vagues.map((v) => ({
        codeVague: v.code,
        quantiteTotaleKg: v.poidsTotalVendu,
        montantTotal: v.revenus,
        nombreVentes: v.nombreVentes,
      })),
      topClients: topClientsData.clients.map((c) => ({
        nomClient: c.nom,
        montantTotal: c.totalVentes,
        nombreAchats: c.nombreVentes,
      })),
      evolutionMensuelle: evolution.evolution.map((m) => ({
        mois: m.mois,
        revenus: m.revenus,
        couts: m.couts,
        marge: m.marge,
      })),
    };

    // Générer le PDF (renderRapportFinancierPDF utilise JSX natif dans le fichier .tsx)
    const buffer = await renderRapportFinancierPDF(dto);
    const uint8 = new Uint8Array(buffer);

    const dateStr = new Date().toISOString().slice(0, 10);
    return new Response(uint8, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="rapport-financier-${dateStr}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ status: 401, message: error.message }, { status: 401 });
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ status: 403, message: error.message }, { status: 403 });
    }
    const message =
      error instanceof Error ? error.message : "Erreur serveur inattendue";
    return NextResponse.json({ status: 500, message: message }, { status: 500 });
  }
}
