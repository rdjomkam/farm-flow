/**
 * GET /api/export/facture/[id]
 *
 * Génère et télécharge la facture en PDF.
 * Permissions requises : FACTURES_VOIR + EXPORT_DONNEES
 */

import { NextRequest, NextResponse } from "next/server";
import { AuthError } from "@/lib/auth";
import { requirePermission, ForbiddenError } from "@/lib/permissions";
import { getFactureById } from "@/lib/queries/factures";
import { renderFacturePDF } from "@/lib/export/pdf-facture";
import { Permission, StatutFacture, ModePaiement } from "@/types";
import type { CreateFacturePDFDTO } from "@/types/export";
import { prisma } from "@/lib/db";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission(
      request,
      Permission.FACTURES_VOIR,
      Permission.EXPORT_DONNEES
    );

    const { id } = await params;

    // Récupérer la facture avec toutes ses relations
    const facture = await getFactureById(id, auth.activeSiteId);
    if (!facture) {
      return NextResponse.json(
        { status: 404, message: "Facture introuvable" },
        { status: 404 }
      );
    }

    // Récupérer les infos du site
    const site = await prisma.site.findUnique({
      where: { id: auth.activeSiteId },
      select: { name: true, address: true },
    });

    if (!site) {
      return NextResponse.json(
        { status: 404, message: "Site introuvable" },
        { status: 404 }
      );
    }

    // Construire le DTO
    const dto: CreateFacturePDFDTO = {
      site: {
        name: site.name,
        address: site.address ?? null,
      },
      numero: facture.numero,
      dateEmission: facture.dateEmission,
      dateEcheance: facture.dateEcheance,
      statut: facture.statut as StatutFacture,
      notes: facture.notes,
      client: {
        nom: facture.vente.client.nom,
        email: facture.vente.client.email ?? null,
        telephone: facture.vente.client.telephone ?? null,
        adresse: facture.vente.client.adresse ?? null,
      },
      venteNumero: facture.vente.numero,
      vagueCode: facture.vente.vague?.code ?? "—",
      quantitePoissons: facture.vente.quantitePoissons,
      poidsTotalKg: facture.vente.poidsTotalKg,
      prixUnitaireKg: facture.vente.prixUnitaireKg,
      montantTotal: facture.vente.montantTotal,
      montantFacture: facture.montantTotal,
      montantPaye: facture.montantPaye,
      soldeRestant: facture.montantTotal - facture.montantPaye,
      paiements: facture.paiements.map((p) => ({
        montant: p.montant,
        mode: p.mode as ModePaiement,
        reference: p.reference ?? null,
        date: p.date,
      })),
    };

    // Générer le PDF (renderFacturePDF utilise JSX natif dans le fichier .tsx)
    const buffer = await renderFacturePDF(dto);
    // Convertir Buffer Node.js → Uint8Array pour la Web API Response
    const uint8 = new Uint8Array(buffer);

    return new Response(uint8, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="facture-${facture.numero}.pdf"`,
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
