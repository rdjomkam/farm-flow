/**
 * GET /api/export/ventes
 *
 * Génère et télécharge les ventes en Excel (.xlsx).
 * Query params : dateFrom?, dateTo?, clientId?, vagueId?
 * Permissions requises : VENTES_VOIR + EXPORT_DONNEES
 */

import { NextRequest, NextResponse } from "next/server";
import { AuthError } from "@/lib/auth";
import { requirePermission, ForbiddenError } from "@/lib/permissions";
import { getVentes } from "@/lib/queries/ventes";
import { genererExcelVentes } from "@/lib/export/excel-ventes";
import { Permission, StatutFacture } from "@/types";
import type { ExportVentesExcelDTO, VenteExcelRow } from "@/types/export";

export async function GET(request: NextRequest) {
  try {
    const auth = await requirePermission(
      request,
      Permission.VENTES_VOIR,
      Permission.EXPORT_DONNEES
    );

    const { searchParams } = new URL(request.url);
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");
    const clientId = searchParams.get("clientId");
    const vagueId = searchParams.get("vagueId");

    // Dates par défaut : 90 derniers jours
    const dateDebutFilter = dateFrom
      ?? new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const dateFinFilter = dateTo ?? new Date().toISOString().slice(0, 10);

    // Récupérer les ventes avec leurs relations
    const { data: ventes } = await getVentes(auth.activeSiteId, {
      ...(clientId && { clientId }),
      ...(vagueId && { vagueId }),
      dateFrom: dateDebutFilter,
      dateTo: dateFinFilter,
    });

    // Construire les lignes Excel
    const rows: VenteExcelRow[] = ventes.map((v) => ({
      numero: v.numero,
      date: v.createdAt,
      nomClient: v.client.nom,
      codeVague: v.vague.code,
      quantitePoissons: v.quantitePoissons,
      poidsTotalKg: v.poidsTotalKg,
      prixUnitaireKg: v.prixUnitaireKg,
      montantTotal: v.montantTotal,
      statutFacture: (v.facture?.statut ?? null) as StatutFacture | null,
      notes: v.notes ?? null,
    }));

    // Construire le DTO
    const dto: ExportVentesExcelDTO = {
      siteId: auth.activeSiteId,
      clientId: clientId ?? null,
      vagueId: vagueId ?? null,
      dateDebut: new Date(dateDebutFilter),
      dateFin: new Date(dateFinFilter),
      rows,
    };

    // Générer le fichier Excel
    const buffer = genererExcelVentes(dto);
    const uint8 = new Uint8Array(buffer);

    const dateStr = new Date().toISOString().slice(0, 10);
    return new Response(uint8, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="ventes-${dateStr}.xlsx"`,
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
