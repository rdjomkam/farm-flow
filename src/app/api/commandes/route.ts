import { NextRequest, NextResponse } from "next/server";
import { getCommandes, createCommande } from "@/lib/queries/commandes";
import { requirePermission } from "@/lib/permissions";
import { Permission, StatutCommande, parsePaginationQuery } from "@/types";
import type { CreateCommandeDTO, CommandeFilters } from "@/types";
import { apiError, handleApiError } from "@/lib/api-utils";
import { checkIdempotency, storeIdempotency, hashBody } from "@/lib/idempotency";

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
    return handleApiError("GET /api/commandes", error, "Erreur serveur lors de la recuperation des commandes.");
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requirePermission(request, Permission.APPROVISIONNEMENT_GERER);

    // Parse body once (needed before idempotency check for body hash)
    const body = await request.json();

    // Idempotency check
    const idempotencyKey = request.headers.get("X-Idempotency-Key");
    if (idempotencyKey) {
      const bHash = hashBody(body);
      const check = await checkIdempotency(idempotencyKey, auth.activeSiteId, bHash);
      if ("isConflict" in check) {
        return apiError(409, "Cle d'idempotence deja utilisee avec un corps de requete different.");
      } else if (check.isDuplicate) {
        return NextResponse.json(check.response, { status: check.statusCode });
      }
    }

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

    // Store idempotency record
    if (idempotencyKey) {
      await storeIdempotency(idempotencyKey, auth.activeSiteId, commande, 201, hashBody(body));
    }

    return NextResponse.json(commande, { status: 201 });
  } catch (error) {
    return handleApiError("POST /api/commandes", error, "Erreur serveur lors de la creation de la commande.");
  }
}
