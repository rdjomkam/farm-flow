import { NextRequest, NextResponse } from "next/server";
import { cachedJson } from "@/lib/api-cache";
import { getClients, createClient } from "@/lib/queries/clients";
import { normalizePhone } from "@/lib/auth/phone";
import { requirePermission } from "@/lib/permissions";
import { Permission } from "@/types";
import type { CreateClientDTO } from "@/types";
import { apiError, handleApiError } from "@/lib/api-utils";

export async function GET(request: NextRequest) {
  try {
    const auth = await requirePermission(request, Permission.CLIENTS_VOIR);
    const clients = await getClients(auth.activeSiteId);

    return cachedJson({ clients, total: clients.length }, "medium");
  } catch (error) {
    return handleApiError("GET /api/clients", error, "Erreur serveur lors de la recuperation des clients.");
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requirePermission(request, Permission.CLIENTS_GERER);
    const body = await request.json();
    const errors: { field: string; message: string }[] = [];

    if (!body.nom || typeof body.nom !== "string" || body.nom.trim() === "") {
      errors.push({ field: "nom", message: "Le nom est obligatoire." });
    }

    if (body.email && typeof body.email === "string") {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(body.email.trim())) {
        errors.push({ field: "email", message: "L'email n'est pas valide." });
      }
    }

    if (errors.length > 0) {
      return apiError(400, "Erreurs de validation", { errors });
    }

    const data: CreateClientDTO = {
      nom: body.nom.trim(),
      telephone: body.telephone?.trim() ? (normalizePhone(body.telephone.trim()) ?? body.telephone.trim()) : undefined,
      email: body.email?.trim() || undefined,
      adresse: body.adresse?.trim() || undefined,
    };

    const client = await createClient(auth.activeSiteId, data);
    return NextResponse.json(client, { status: 201 });
  } catch (error) {
    return handleApiError("POST /api/clients", error, "Erreur serveur lors de la creation du client.");
  }
}
