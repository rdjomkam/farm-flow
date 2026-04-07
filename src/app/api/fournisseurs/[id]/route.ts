import { NextRequest, NextResponse } from "next/server";
import { getFournisseurById,
  updateFournisseur,
  deleteFournisseur } from "@/lib/queries/fournisseurs";
import { apiError, handleApiError } from "@/lib/api-utils";
import { normalizePhone } from "@/lib/auth/phone";
import { requirePermission } from "@/lib/permissions";
import { Permission } from "@/types";
import type { UpdateFournisseurDTO } from "@/types";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const auth = await requirePermission(request, Permission.APPROVISIONNEMENT_VOIR);
    const { id } = await params;

    const fournisseur = await getFournisseurById(id, auth.activeSiteId);
    if (!fournisseur) {
      return apiError(404, "Fournisseur introuvable.");
    }

    return NextResponse.json(fournisseur);
  } catch (error) {
    return handleApiError("GET /api/fournisseurs/[id]", error, "Erreur serveur.");
  }
}

export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const auth = await requirePermission(request, Permission.APPROVISIONNEMENT_GERER);
    const { id } = await params;
    const body = await request.json();

    const data: UpdateFournisseurDTO = {};
    if (body.nom !== undefined) data.nom = body.nom.trim();
    if (body.telephone !== undefined) data.telephone = body.telephone?.trim() ? (normalizePhone(body.telephone.trim()) ?? body.telephone.trim()) : undefined;
    if (body.email !== undefined) data.email = body.email?.trim() || undefined;
    if (body.adresse !== undefined) data.adresse = body.adresse?.trim() || undefined;

    const fournisseur = await updateFournisseur(id, auth.activeSiteId, data);
    return NextResponse.json(fournisseur);
  } catch (error) {
    return handleApiError("PUT /api/fournisseurs/[id]", error, "Erreur serveur.");
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const auth = await requirePermission(request, Permission.APPROVISIONNEMENT_GERER);
    const { id } = await params;

    await deleteFournisseur(id, auth.activeSiteId);
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError("DELETE /api/fournisseurs/[id]", error, "Erreur serveur.");
  }
}
