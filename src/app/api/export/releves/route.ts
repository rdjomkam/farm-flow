/**
 * GET /api/export/releves
 *
 * Génère et télécharge les relevés en Excel (.xlsx).
 * Query params : vagueId?, dateFrom?, dateTo?, typeReleve?, bacId?
 * Permissions requises : RELEVES_VOIR + EXPORT_DONNEES
 */

import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/permissions";
import { handleApiError } from "@/lib/api-utils";
import { getReleves } from "@/lib/queries/releves";
import { genererExcelReleves } from "@/lib/export/excel-releves";
import { Permission, TypeReleve, CauseMortalite, TypeAliment, MethodeComptage } from "@/types";
import type { ExportRelevesExcelDTO, ReleveExcelRow } from "@/types/export";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const auth = await requirePermission(
      request,
      Permission.RELEVES_VOIR,
      Permission.EXPORT_DONNEES
    );

    const { searchParams } = new URL(request.url);
    const vagueId = searchParams.get("vagueId");
    const bacId = searchParams.get("bacId");
    const typeReleveParam = searchParams.get("typeReleve");
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");

    // Valider le typeReleve si fourni
    const typeReleve =
      typeReleveParam && Object.values(TypeReleve).includes(typeReleveParam as TypeReleve)
        ? (typeReleveParam as TypeReleve)
        : null;

    // Dates par défaut : 90 derniers jours
    const dateDebutFilter = dateFrom ?? new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const dateFinFilter = dateTo ?? new Date().toISOString().slice(0, 10);

    // Récupérer les relevés avec leurs relations (bac + vague)
    const { data: releves } = await getReleves(auth.activeSiteId, {
      ...(vagueId && { vagueId }),
      ...(bacId && { bacId }),
      ...(typeReleve && { typeReleve }),
      dateFrom: dateDebutFilter,
      dateTo: dateFinFilter,
    });

    // Enrichir avec les relations bac et vague
    const releveIds = releves.map((r) => r.id);
    const relevesEnrichis = await prisma.releve.findMany({
      where: { id: { in: releveIds } },
      include: {
        bac: { select: { nom: true } },
        vague: { select: { code: true } },
      },
      orderBy: { date: "asc" },
    });

    // Construire les lignes Excel
    const rows: ReleveExcelRow[] = relevesEnrichis.map((r) => ({
      date: r.date,
      typeReleve: r.typeReleve as TypeReleve,
      codeVague: r.vague?.code ?? "—",
      nomBac: r.bac?.nom ?? "—",
      // Biométrie
      poidsMoyen: r.poidsMoyen,
      tailleMoyenne: r.tailleMoyenne,
      echantillonCount: r.echantillonCount,
      // Mortalité
      nombreMorts: r.nombreMorts,
      causeMortalite: r.causeMortalite as CauseMortalite | null,
      // Alimentation
      quantiteAliment: r.quantiteAliment,
      typeAliment: r.typeAliment as TypeAliment | null,
      frequenceAliment: r.frequenceAliment,
      // Qualité eau
      temperature: r.temperature,
      ph: r.ph,
      oxygene: r.oxygene,
      ammoniac: r.ammoniac,
      // Comptage
      nombreCompte: r.nombreCompte,
      methodeComptage: r.methodeComptage as MethodeComptage | null,
      // Observation
      description: r.description,
      // Commun
      notes: r.notes,
    }));

    // Construire le DTO
    const dto: ExportRelevesExcelDTO = {
      siteId: auth.activeSiteId,
      vagueId: vagueId ?? null,
      bacId: bacId ?? null,
      typeReleve: typeReleve ?? null,
      dateDebut: new Date(dateDebutFilter),
      dateFin: new Date(dateFinFilter),
      rows,
    };

    // Générer le fichier Excel
    const buffer = genererExcelReleves(dto);
    const uint8 = new Uint8Array(buffer);

    const dateStr = new Date().toISOString().slice(0, 10);
    return new Response(uint8, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="releves-${dateStr}.xlsx"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return handleApiError("GET /api/export/releves", error, "Erreur serveur lors de la generation de l'export des releves.");
  }
}
