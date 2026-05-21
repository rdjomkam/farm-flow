import { NextRequest, NextResponse } from "next/server";
import { cachedJson } from "@/lib/api-cache";
import { getVentes, createVente, createVenteAlevins } from "@/lib/queries/ventes";
import { requirePermission } from "@/lib/permissions";
import { Permission, parsePaginationQuery } from "@/types";
import type { CreateVenteDTO, CreateLigneVenteDTO, CreateVenteAlevinsDTO, VenteFilters } from "@/types";
import { apiError, handleApiError } from "@/lib/api-utils";
import { checkIdempotency, storeIdempotency, hashBody } from "@/lib/idempotency";

export async function GET(request: NextRequest) {
  try {
    const auth = await requirePermission(request, Permission.VENTES_VOIR);
    const { searchParams } = new URL(request.url);

    // Pagination
    const paginationResult = parsePaginationQuery(searchParams);
    if (!paginationResult.valid) {
      return apiError(400, paginationResult.error);
    }
    const { limit, offset } = paginationResult.params;

    const filters: VenteFilters = {};
    const clientId = searchParams.get("clientId");
    if (clientId) filters.clientId = clientId;
    const vagueId = searchParams.get("vagueId");
    if (vagueId) filters.vagueId = vagueId;
    const dateFrom = searchParams.get("dateFrom");
    if (dateFrom) filters.dateFrom = dateFrom;
    const dateTo = searchParams.get("dateTo");
    if (dateTo) filters.dateTo = dateTo;

    const { data, total } = await getVentes(auth.activeSiteId, filters, { limit, offset });

    return cachedJson({ data, total, limit, offset }, "fast");
  } catch (error) {
    return handleApiError("GET /api/ventes", error, "Erreur serveur lors de la recuperation des ventes.");
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requirePermission(request, Permission.VENTES_CREER);

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

    // Discriminer le type de vente : "alevins" pour reproduction, sinon grossissement (defaut)
    const isAlevins = body.typeVente === "alevins";

    let vente;

    if (isAlevins) {
      // --- Validation vente alevins (reproduction) ---
      const errors: { field: string; message: string }[] = [];

      if (!body.clientId || typeof body.clientId !== "string") {
        errors.push({ field: "clientId", message: "Le client est obligatoire." });
      }
      if (!body.uniteProductionId || typeof body.uniteProductionId !== "string") {
        errors.push({ field: "uniteProductionId", message: "L'unite de production est obligatoire." });
      }
      if (typeof body.prixUnitaire !== "number" || body.prixUnitaire <= 0) {
        errors.push({ field: "prixUnitaire", message: "Le prix unitaire doit etre > 0." });
      }
      if (!Array.isArray(body.lignes) || body.lignes.length === 0) {
        errors.push({ field: "lignes", message: "Au moins une ligne de vente est requise." });
      } else {
        for (let i = 0; i < body.lignes.length; i++) {
          const ligne = body.lignes[i];
          if (!ligne || typeof ligne.lotAlevinsId !== "string" || !ligne.lotAlevinsId) {
            errors.push({ field: `lignes[${i}].lotAlevinsId`, message: "lotAlevinsId est obligatoire." });
          }
          if (!ligne || typeof ligne.nombrePoissons !== "number" || ligne.nombrePoissons <= 0) {
            errors.push({ field: `lignes[${i}].nombrePoissons`, message: "nombrePoissons doit etre > 0." });
          }
        }
      }

      if (errors.length > 0) {
        return apiError(400, "Erreurs de validation", { errors });
      }

      const data: CreateVenteAlevinsDTO = {
        clientId: body.clientId,
        prixUnitaire: body.prixUnitaire,
        uniteProductionId: body.uniteProductionId,
        lignes: body.lignes.map((l: { lotAlevinsId: string; nombrePoissons: number }) => ({
          lotAlevinsId: l.lotAlevinsId,
          nombrePoissons: l.nombrePoissons,
        })),
        notes: body.notes?.trim() || undefined,
        dateCommande: body.dateCommande || undefined,
      };

      vente = await createVenteAlevins(auth.activeSiteId, auth.userId, data);
    } else {
      // --- Validation vente grossissement (existant) ---
      const errors: { field: string; message: string }[] = [];

      if (!body.clientId || typeof body.clientId !== "string") {
        errors.push({ field: "clientId", message: "Le client est obligatoire." });
      }

      if (typeof body.prixUnitaireKg !== "number" || body.prixUnitaireKg <= 0) {
        errors.push({ field: "prixUnitaireKg", message: "Le prix unitaire doit etre > 0." });
      }

      // Valider les lignes de vente
      if (!Array.isArray(body.lignes) || body.lignes.length === 0) {
        errors.push({ field: "lignes", message: "Au moins une ligne de vente est requise." });
      } else {
        for (let i = 0; i < body.lignes.length; i++) {
          const ligne = body.lignes[i];
          if (!ligne || typeof ligne.vagueId !== "string" || !ligne.vagueId) {
            errors.push({ field: `lignes[${i}].vagueId`, message: "vagueId est obligatoire." });
          }
          if (!ligne || typeof ligne.bacId !== "string" || !ligne.bacId) {
            errors.push({ field: `lignes[${i}].bacId`, message: "bacId est obligatoire." });
          }
          if (!ligne || typeof ligne.poidsTotalKg !== "number" || ligne.poidsTotalKg <= 0) {
            errors.push({ field: `lignes[${i}].poidsTotalKg`, message: "poidsTotalKg doit etre > 0." });
          }
          if (
            ligne?.poidsMoyenG !== undefined &&
            ligne?.poidsMoyenG !== null &&
            (typeof ligne.poidsMoyenG !== "number" || ligne.poidsMoyenG <= 0)
          ) {
            errors.push({ field: `lignes[${i}].poidsMoyenG`, message: "poidsMoyenG doit etre > 0 si fourni." });
          }
        }
      }

      if (errors.length > 0) {
        return apiError(400, "Erreurs de validation", { errors });
      }

      const lignes: CreateLigneVenteDTO[] = (body.lignes as Array<{
        vagueId: string;
        bacId: string;
        poidsTotalKg: number;
        poidsMoyenG?: number;
      }>).map((l) => ({
        vagueId: l.vagueId,
        bacId: l.bacId,
        poidsTotalKg: l.poidsTotalKg,
        ...(typeof l.poidsMoyenG === "number" && l.poidsMoyenG > 0
          ? { poidsMoyenG: l.poidsMoyenG }
          : {}),
      }));

      const data: CreateVenteDTO = {
        clientId: body.clientId,
        prixUnitaireKg: body.prixUnitaireKg,
        uniteProductionId: body.uniteProductionId || undefined,
        lignes,
        notes: body.notes?.trim() || undefined,
        dateCommande: body.dateCommande || undefined,
      };

      vente = await createVente(auth.activeSiteId, auth.userId, data);
    }

    // Store idempotency record
    if (idempotencyKey) {
      await storeIdempotency(idempotencyKey, auth.activeSiteId, vente, 201, hashBody(body));
    }

    return NextResponse.json(vente, { status: 201 });
  } catch (error) {
    return handleApiError("POST /api/ventes", error, "Erreur serveur lors de la creation de la vente.", {
      statusMap: [
        { match: "inactif", status: 404 },
        { match: "introuvable", status: 404 },
        { match: ["insuffisant", "annulee", "biometrie", "disponible"], status: 409 },
        { match: "poids moyen", status: 400 },
        { match: "REPRODUCTION", status: 400 },
      ],
    });
  }
}
