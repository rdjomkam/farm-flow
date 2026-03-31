import { NextRequest, NextResponse } from "next/server";
import {
  getClientById,
  updateClient,
  deleteClient,
} from "@/lib/queries/clients";
import { apiError } from "@/lib/api-utils";
import { AuthError } from "@/lib/auth";
import { normalizePhone } from "@/lib/auth/phone";
import { requirePermission, ForbiddenError } from "@/lib/permissions";
import { Permission } from "@/types";
import type { UpdateClientDTO } from "@/types";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const auth = await requirePermission(request, Permission.CLIENTS_VOIR);
    const { id } = await params;

    const client = await getClientById(id, auth.activeSiteId);
    if (!client) {
      return apiError(404, "Client introuvable.");
    }

    return NextResponse.json(client);
  } catch (error) {
    if (error instanceof AuthError) {
      return apiError(401, error.message);
    }
    if (error instanceof ForbiddenError) {
      return apiError(403, error.message);
    }
    return apiError(500, "Erreur serveur.");
  }
}

export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const auth = await requirePermission(request, Permission.CLIENTS_GERER);
    const { id } = await params;
    const body = await request.json();

    const data: UpdateClientDTO = {};
    if (body.nom !== undefined) data.nom = body.nom.trim();
    if (body.telephone !== undefined) data.telephone = body.telephone?.trim() ? (normalizePhone(body.telephone.trim()) ?? body.telephone.trim()) : undefined;
    if (body.email !== undefined) data.email = body.email?.trim() || undefined;
    if (body.adresse !== undefined) data.adresse = body.adresse?.trim() || undefined;
    if (body.isActive !== undefined) data.isActive = body.isActive;

    const client = await updateClient(id, auth.activeSiteId, data);
    return NextResponse.json(client);
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
    return apiError(500, message);
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const auth = await requirePermission(request, Permission.CLIENTS_GERER);
    const { id } = await params;

    await deleteClient(id, auth.activeSiteId);
    return NextResponse.json({ success: true });
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
    return apiError(500, message);
  }
}
