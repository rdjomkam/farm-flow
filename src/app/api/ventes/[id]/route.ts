import { NextRequest, NextResponse } from "next/server";
import { getVenteById, updateVente, cloturerVente, cloturerDefinitivement, deleteVente } from "@/lib/queries/ventes";
import { requirePermission } from "@/lib/permissions";
import { Permission } from "@/types";
import type { UpdateVenteDTO, ClotureVenteDTO } from "@/types";
import { apiError, handleApiError } from "@/lib/api-utils";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const auth = await requirePermission(request, Permission.VENTES_VOIR);
    const { id } = await params;

    const vente = await getVenteById(id, auth.activeSiteId);
    if (!vente) {
      return apiError(404, "Vente introuvable.");
    }

    return NextResponse.json(vente);
  } catch (error) {
    return handleApiError("GET /api/ventes/[id]", error, "Erreur serveur.");
  }
}

export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const auth = await requirePermission(request, Permission.VENTES_MODIFIER);
    const { id } = await params;
    const body = (await request.json()) as UpdateVenteDTO;

    if (!body.motif || body.motif.trim().length === 0) {
      return apiError(400, "Le motif de modification est obligatoire.");
    }

    // Au moins un champ doit changer
    const hasChange =
      body.clientId !== undefined ||
      body.prixUnitaireKg !== undefined ||
      body.dateCommande !== undefined ||
      body.notes !== undefined ||
      (Array.isArray(body.lignes) && body.lignes.length > 0);

    if (!hasChange) {
      return apiError(400, "Aucun champ a modifier.");
    }

    // Valider les nouvelles lignes si fournies
    if (body.lignes !== undefined) {
      if (!Array.isArray(body.lignes) || body.lignes.length === 0) {
        return apiError(400, "lignes doit etre un tableau non vide si fourni.");
      }
      for (let i = 0; i < body.lignes.length; i++) {
        const ligne = body.lignes[i];
        if (!ligne.vagueId || typeof ligne.vagueId !== "string") {
          return apiError(400, `lignes[${i}].vagueId est obligatoire.`);
        }
        if (!ligne.bacId || typeof ligne.bacId !== "string") {
          return apiError(400, `lignes[${i}].bacId est obligatoire.`);
        }
        if (typeof ligne.poidsTotalKg !== "number" || ligne.poidsTotalKg <= 0) {
          return apiError(400, `lignes[${i}].poidsTotalKg doit etre > 0.`);
        }
      }
    }

    const updated = await updateVente(id, auth.activeSiteId, auth.userId, body);
    return NextResponse.json(updated);
  } catch (error) {
    return handleApiError("PUT /api/ventes/[id]", error, "Erreur serveur.", {
      statusMap: [
        { match: "inactif", status: 404 },
        { match: ["insuffisant", "annulee", "biometrie"], status: 409 },
        { match: "cloturee", status: 422 },
      ],
    });
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const auth = await requirePermission(request, Permission.VENTES_MODIFIER);
    const { id } = await params;

    const result = await deleteVente(id, auth.activeSiteId, auth.userId);
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError("DELETE /api/ventes/[id]", error, "Erreur serveur.", {
      statusMap: [
        { match: "cloturee", status: 422 },
      ],
    });
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const auth = await requirePermission(request, Permission.VENTES_MODIFIER);
    const { id } = await params;
    const body = await request.json();

    if (body.action === "cloturer_definitivement") {
      const result = await cloturerDefinitivement(id, auth.activeSiteId, auth.userId);
      return NextResponse.json(result);
    }

    const dto = body as ClotureVenteDTO;
    if (!dto.poidsLivreKg || dto.poidsLivreKg <= 0) {
      return apiError(400, "Le poids livre doit etre superieur a 0.");
    }

    const result = await cloturerVente(id, auth.activeSiteId, auth.userId, dto);
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError("PATCH /api/ventes/[id]", error, "Erreur serveur.", {
      statusMap: [
        { match: ["insuffisant", "avarie"], status: 409 },
        { match: "cloturee", status: 422 },
      ],
    });
  }
}
