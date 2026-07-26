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
import { renderPdfSafely } from "@/lib/export/render-pdf-safely";
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

    // Les quantites reelles viennent du snapshot du BL (LigneBonLivraison,
    // Sprint BF) et non plus de LigneVente : LigneVente ne porte que l'etat
    // courant, alors qu'un BL rectificatif (BF.6/BF.7) devra pouvoir rendre
    // un ancien BL avec SES propres quantites. Fallback defensif sur
    // LigneVente.poidsLivreKg pour les BL signes avant Sprint BF (legacy,
    // sans LigneBonLivraison).
    const lignes: LigneBonLivraisonPDF[] = bonLivraison.vente.lignes.map(
      (ligne) => {
        const ligneBL = bonLivraison.lignes.find(
          (l) => l.ligneVenteId === ligne.id
        );

        const poidsCommandeKg = ligne.poidsTotalKg;
        const poidsLivreKg = ligneBL ? ligneBL.poidsLivreKg : ligne.poidsLivreKg ?? null;
        const ecartKg =
          poidsLivreKg === null ? null : poidsLivreKg - poidsCommandeKg;

        const designation =
          ligne.lotAlevins?.code != null ? "Alevins silure" : "Silure";

        // nombrePoissons : nombre effectivement livre. Lu en PRIORITE depuis
        // le snapshot LigneBonLivraison.nombrePoissonsLivres (fige a LA
        // signature de CE bon — review Sprint BF phase 2, finding Haute).
        // LigneVente.nombrePoissons est un champ d'etat MUTABLE, reecrit par
        // chaque rectification ulterieure : regenerer le PDF d'un bon
        // d'origine apres rectification y lisait a tort le nombre de
        // poissons post-rectification, melangeant deux instantanes
        // differents sur un document a valeur contractuelle.
        // Fallback sur LigneVente.nombrePoissons uniquement pour les BL
        // signes AVANT ce correctif (nombrePoissonsLivres alors null) : ces
        // BL legacy peuvent encore afficher une valeur post-rectification
        // s'ils sont regeneres apres une rectification — limitation acceptee,
        // aucune donnee historique ne permet de la reconstituer.
        const nombrePoissons = ligneBL?.nombrePoissonsLivres ?? ligne.nombrePoissons;

        return {
          designation,
          nomBac: ligne.bac?.nom ?? null,
          nombrePoissons,
          poidsCommandeKg,
          poidsLivreKg,
          ecartKg,
          nombreMortsTransport: ligneBL?.nombreMortsTransport ?? 0,
          motifAvarie: ligneBL?.motifAvarie ?? null,
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
      rectifieDe: bonLivraison.rectifie
        ? {
            bon: {
              numero: bonLivraison.rectifie.numero,
              signeLe: bonLivraison.rectifie.signeLe,
            },
            motif: bonLivraison.motifRectification ?? null,
          }
        : null,
      rectifiePar: bonLivraison.rectifiePar
        ? {
            numero: bonLivraison.rectifiePar.numero,
            signeLe: bonLivraison.rectifiePar.signeLe,
          }
        : null,
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
        nom: bonLivraison.site.nomPromoteur ?? null,
        date: null,
      },
      cachet: bonLivraison.site.cachet ?? null,
      dateGeneration: new Date().toISOString(),
    };

    const buffer = await renderPdfSafely(() => renderBonLivraisonPDF(dto), {
      context: {
        route: "GET /api/export/bon-livraison/[id]",
        documentType: "bon-livraison",
        documentId: id,
      },
    });
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
