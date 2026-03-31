import { NextRequest, NextResponse } from "next/server";
import { getCommandes, createCommande } from "@/lib/queries/commandes";
import { AuthError } from "@/lib/auth";
import { requirePermission, ForbiddenError } from "@/lib/permissions";
import { Permission, StatutCommande, parsePaginationQuery } from "@/types";
import type { CreateCommandeDTO, CommandeFilters } from "@/types";
import { apiError } from "@/lib/api-utils";

const VALID_STATUTS = Object.values(StatutCommande);

export async function GET(request: NextRequest) {
  try {
    const auth = await requirePermission(request, Permission.APPROVISIONNEMENT_VOIR);
    const { searchParams } = new URL(request.url);

    // Pagination
    const paginationResult = parsePaginationQuery(searchParams);
    if (!paginationResult.valid) {
      return apiError(400, paginationResult.error);
    }
    const { limit, offset } = paginationResult.params;

    const filters: CommandeFilters = {};
    const statut = searchParams.get("statut");
    if (statut && VALID_STATUTS.includes(statut as StatutCommande)) {
      filters.statut = statut as StatutCommande;
    }
    const fournisseurId = searchParams.get("fournisseurId");
    if (fournisseurId) filters.fournisseurId = fournisseurId;
    const dateFrom = searchParams.get("dateFrom");
    if (dateFrom) filters.dateFrom = dateFrom;
    const dateTo = searchParams.get("dateTo");
    if (dateTo) filters.dateTo = dateTo;

    const { data, total } = await getCommandes(auth.activeSiteId, filters, { limit, offset });

    return NextResponse.json({ data, total, limit, offset });
  } catch (error) {
    if (error instanceof AuthError) {
      return apiError(401, error.message);
    }
    if (error instanceof ForbiddenError) {
      return apiError(403, error.message);
    }
    return apiError(500, "Erreur serveur lors de la recuperation des commandes.");
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requirePermission(request, Permission.APPROVISIONNEMENT_GERER);
    const body = await request.json();
    const errors: { field: string; message: string }[] = [];

    if (!body.fournisseurId || typeof body.fournisseurId !== "string") {
      errors.push({ field: "fournisseurId", message: "Le fournisseur est obligatoire." });
    }

    if (!body.dateCommande || typeof body.dateCommande !== "string" || isNaN(Date.parse(body.dateCommande))) {
      errors.push({ field: "dateCommande", message: "La date de commande est obligatoire (format ISO 8601)." });
    }

    if (!Array.isArray(body.lignes) || body.lignes.length === 0) {
      errors.push({ field: "lignes", message: "Au moins une ligne de commande est requise." });
    } else {
      body.lignes.forEach((ligne: Record<string, unknown>, i: number) => {
        if (!ligne.produitId || typeof ligne.produitId !== "string") {
          errors.push({ field: `lignes[${i}].produitId`, message: "Le produit est obligatoire." });
        }
        if (typeof ligne.quantite !== "number" || (ligne.quantite as number) <= 0) {
          errors.push({ field: `lignes[${i}].quantite`, message: "La quantite doit etre > 0." });
        }
        if (typeof ligne.prixUnitaire !== "number" || (ligne.prixUnitaire as number) < 0) {
          errors.push({ field: `lignes[${i}].prixUnitaire`, message: "Le prix unitaire doit etre >= 0." });
        }
      });
    }

    if (errors.length > 0) {
      return apiError(400, "Erreurs de validation", { errors });
    }

    const data: CreateCommandeDTO = {
      fournisseurId: body.fournisseurId,
      dateCommande: body.dateCommande,
      lignes: body.lignes.map((l: Record<string, unknown>) => ({
        produitId: l.produitId as string,
        quantite: l.quantite as number,
        prixUnitaire: l.prixUnitaire as number,
      })),
      notes: body.notes?.trim() || undefined,
    };

    const commande = await createCommande(auth.activeSiteId, auth.userId, data);
    return NextResponse.json(commande, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) {
      return apiError(401, error.message);
    }
    if (error instanceof ForbiddenError) {
      return apiError(403, error.message);
    }
    const message = error instanceof Error ? error.message : "Erreur serveur.";
    if (message.includes("introuvable")) {
      return apiError(404, message);
    }
    return apiError(500, "Erreur serveur lors de la creation de la commande.");
  }
}
