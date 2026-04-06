/**
 * GET /api/export/vague/[id]
 *
 * Génère et télécharge le rapport de vague en PDF.
 * Permissions requises : VAGUES_VOIR + EXPORT_DONNEES
 */

import { NextRequest, NextResponse } from "next/server";
import { AuthError } from "@/lib/auth";
import { requirePermission, ForbiddenError } from "@/lib/permissions";
import { getVagueById } from "@/lib/queries/vagues";
import { getIndicateursVague } from "@/lib/queries/indicateurs";
import { renderRapportVaguePDF } from "@/lib/export/pdf-rapport-vague";
import { Permission, TypeReleve, StatutVague, CauseMortalite } from "@/types";
import type { CreateRapportVaguePDFDTO, ReleveRapportPDF } from "@/types/export";
import { prisma } from "@/lib/db";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission(
      request,
      Permission.VAGUES_VOIR,
      Permission.EXPORT_DONNEES
    );

    const { id } = await params;

    // Récupérer la vague + relevés séparément (ADR-038 — getVagueById ne retourne plus de relevés)
    const [vague, allReleves, indicateurs, site] = await Promise.all([
      getVagueById(id, auth.activeSiteId),
      prisma.releve.findMany({
        where: { vagueId: id, siteId: auth.activeSiteId },
        orderBy: { date: "asc" },
      }),
      getIndicateursVague(auth.activeSiteId, id),
      prisma.site.findUnique({
        where: { id: auth.activeSiteId },
        select: { name: true, address: true },
      }),
    ]);

    if (!vague) {
      return NextResponse.json(
        { status: 404, message: "Vague introuvable" },
        { status: 404 }
      );
    }

    if (!site) {
      return NextResponse.json(
        { status: 404, message: "Site introuvable" },
        { status: 404 }
      );
    }

    // Construire les relevés pour le rapport
    const releves: ReleveRapportPDF[] = allReleves.map((r) => ({
      date: r.date,
      typeReleve: r.typeReleve as TypeReleve,
      nomBac:
        vague.bacs.find((b) => b.id === r.bacId)?.nom ?? "—",
      poidsMoyen: r.poidsMoyen,
      tailleMoyenne: r.tailleMoyenne,
      nombreMorts: r.nombreMorts,
      causeMortalite: r.causeMortalite as CauseMortalite | null,
      quantiteAliment: r.quantiteAliment,
      temperature: r.temperature,
      ph: r.ph,
      nombreCompte: r.nombreCompte,
      notes: r.notes,
    }));

    // Points d'évolution du poids (biométrie uniquement)
    const evolutionPoids = allReleves
      .filter((r) => r.typeReleve === TypeReleve.BIOMETRIE && r.poidsMoyen !== null)
      .map((r) => ({
        date: r.date,
        poidsMoyen: r.poidsMoyen as number,
      }));

    // Construire le DTO
    const dto: CreateRapportVaguePDFDTO = {
      site: {
        name: site.name,
        address: site.address ?? null,
      },
      code: vague.code,
      dateDebut: vague.dateDebut,
      dateFin: vague.dateFin,
      statut: vague.statut as StatutVague,
      nombreInitial: vague.nombreInitial,
      poidsMoyenInitial: vague.poidsMoyenInitial,
      origineAlevins: vague.origineAlevins,
      kpis: {
        tauxSurvie: indicateurs?.tauxSurvie ?? 100,
        fcr: indicateurs?.fcr ?? null,
        sgr: indicateurs?.sgr ?? null,
        biomasseTotale: indicateurs?.biomasse ?? null,
        poidsMoyenFinal: indicateurs?.poidsMoyen ?? null,
        nombreActuel: indicateurs?.nombreVivants ?? vague.nombreInitial,
      },
      bacs: vague.bacs.map((b) => ({
        nom: b.nom,
        volume: b.volume,
        nombrePoissons: b.nombrePoissons,
      })),
      releves: releves.sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
      ),
      evolutionPoids,
    };

    // Générer le PDF (renderRapportVaguePDF utilise JSX natif dans le fichier .tsx)
    const buffer = await renderRapportVaguePDF(dto);
    const uint8 = new Uint8Array(buffer);

    return new Response(uint8, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="rapport-vague-${vague.code}.pdf"`,
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
