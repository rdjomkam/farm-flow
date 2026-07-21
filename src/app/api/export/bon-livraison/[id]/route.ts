/**
 * GET /api/export/bon-livraison/[id]
 *
 * Genere et telecharge le bon de livraison signe en PDF.
 * Permissions requises : VENTES_VOIR + EXPORT_DONNEES
 *
 * Le bon de livraison doit etre au statut SIGNE — un BL non signe n'a pas
 * de PDF (il n'y a rien a montrer : pas de signatures, pas de date de
 * livraison confirmee).
 */

import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/permissions";
import { apiError, handleApiError } from "@/lib/api-utils";
import { getBonLivraisonForPDF } from "@/lib/queries/bons-livraison";
import { renderBonLivraisonPDF } from "@/lib/export/pdf-bon-livraison";
import { Permission, StatutBonLivraison } from "@/types";
import type {
  CreateBonLivraisonPDFDTO,
  LigneBonLivraisonPDF,
} from "@/types/export";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission(
      request,
      Permission.VENTES_VOIR,
      Permission.EXPORT_DONNEES
    );

    const { id } = await params;

    const result = await getBonLivraisonForPDF(auth.activeSiteId, id);
    if (!result) {
      return apiError(404, "Bon de livraison introuvable.");
    }

    const { bonLivraison, blocPaiement } = result;

    if (bonLivraison.statut !== StatutBonLivraison.SIGNE) {
      return apiError(
        400,
        "Le bon de livraison doit être signé avant de pouvoir être exporté en PDF."
      );
    }

    const lignes: LigneBonLivraisonPDF[] = bonLivraison.vente.lignes.map(
      (ligne) => {
        const poidsCommandeKg = ligne.poidsTotalKg;
        const poidsLivreKg = ligne.poidsLivreKg ?? null;
        const ecartKg =
          poidsLivreKg === null ? null : poidsLivreKg - poidsCommandeKg;

        const designation =
          ligne.vague?.code != null
            ? `Silures — Vague ${ligne.vague.code}`
            : ligne.lotAlevins?.code != null
              ? `Alevins — Lot ${ligne.lotAlevins.code}`
              : "Poissons";

        return {
          designation,
          nomBac: ligne.bac?.nom ?? null,
          nombrePoissons: ligne.nombrePoissons,
          poidsCommandeKg,
          poidsLivreKg,
          ecartKg,
        };
      }
    );

    const dto: CreateBonLivraisonPDFDTO = {
      site: {
        name: bonLivraison.site.name,
        address: bonLivraison.site.address ?? null,
      },
      numero: bonLivraison.numero,
      statut: bonLivraison.statut as StatutBonLivraison,
      signeLe: bonLivraison.signeLe,
      venteNumero: bonLivraison.vente.numero,
      client: {
        nom: bonLivraison.vente.client.nom,
        telephone: bonLivraison.vente.client.telephone ?? null,
      },
      lignes,
      blocPaiement,
      signatureClient: {
        image: bonLivraison.signatureClient ?? null,
        nom: bonLivraison.signataireClientNom ?? null,
        date: bonLivraison.signeLe,
      },
      signatureLivreur: {
        image: bonLivraison.signatureLivreur ?? null,
        nom: bonLivraison.user?.name ?? null,
        date: bonLivraison.signeLe,
      },
      signaturePromoteur: {
        image: bonLivraison.site.signaturePromoteur ?? null,
        nom: null,
        date: null,
      },
      cachet: bonLivraison.site.cachet ?? null,
      dateGeneration: new Date().toISOString(),
    };

    const buffer = await renderBonLivraisonPDF(dto);
    // Convertir Buffer Node.js → Uint8Array pour la Web API Response
    const uint8 = new Uint8Array(buffer);

    return new Response(uint8, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${bonLivraison.numero}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return handleApiError(
      "GET /api/export/bon-livraison/[id]",
      error,
      "Erreur serveur lors de la génération du bon de livraison PDF."
    );
  }
}
