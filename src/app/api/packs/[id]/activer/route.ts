import { NextRequest, NextResponse } from "next/server";
import { normalizePhone } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { Permission } from "@/types";
import { activerPack } from "@/lib/queries/provisioning";
import { runEngineForSite, generateOnboardingActivities } from "@/lib/activity-engine";
import { getOrCreateSystemUser } from "@/lib/queries/users";
import type { ActivatePackDTO } from "@/types";
import { apiError, handleApiError } from "@/lib/api-utils";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/packs/[id]/activer
 * Active un Pack pour un nouveau client — déclenche le provisioning transactionnel.
 * Permission : ACTIVER_PACKS
 *
 * Body : ActivatePackDTO
 * Retourne : ProvisioningPayload (201)
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const auth = await requirePermission(request, Permission.ACTIVER_PACKS);

    const body = await request.json();

    // Validation des champs obligatoires
    if (!body.clientSiteName || typeof body.clientSiteName !== "string" || body.clientSiteName.trim() === "") {
      return apiError(400, "Le nom du site client est requis.");
    }
    if (!body.clientUserName || typeof body.clientUserName !== "string" || body.clientUserName.trim() === "") {
      return apiError(400, "Le nom de l'utilisateur client est requis.");
    }
    if (!body.clientUserPhone || typeof body.clientUserPhone !== "string" || body.clientUserPhone.trim() === "") {
      return apiError(400, "Le telephone de l'utilisateur client est requis.");
    }
    const normalizedPhone = normalizePhone(body.clientUserPhone.trim());
    if (!normalizedPhone) {
      return apiError(400, "Numero de telephone invalide (format attendu: 6XXXXXXXX ou 2XXXXXXXX).");
    }
    if (!body.clientUserPassword || typeof body.clientUserPassword !== "string" || body.clientUserPassword.length < 6) {
      return apiError(400, "Le mot de passe doit contenir au moins 6 caracteres.");
    }

    const dto: ActivatePackDTO = {
      clientSiteName: body.clientSiteName.trim(),
      clientSiteAddress: body.clientSiteAddress ?? null,
      clientUserName: body.clientUserName.trim(),
      clientUserPhone: normalizedPhone,
      clientUserEmail: body.clientUserEmail ?? null,
      clientUserPassword: body.clientUserPassword,
      dateExpiration: body.dateExpiration ?? null,
      notes: body.notes ?? null,
    };

    const payload = await activerPack(id, auth.activeSiteId, auth.userId, dto);

    // Generate initial activities for the new client site (best-effort)
    try {
      const systemUser = await getOrCreateSystemUser();
      // 1. Generate onboarding welcome activity
      await generateOnboardingActivities(
        payload.site.id,
        payload.vague.id,
        payload.user.id,
        systemUser.id,
        payload.vague.code,
        payload.vague.nombreInitial
      );
      // 2. Run the activity engine (day-0 rule-based activities)
      await runEngineForSite(payload.site.id, systemUser.id, {
        defaultAssigneeId: payload.user.id,
      });
    } catch (error) {
      return handleApiError("POST /api/packs/[id]/activer", error, "Erreur serveur.");
    }

    return NextResponse.json(payload, { status: 201 });
  } catch (error) {
    return handleApiError("POST /api/packs/[id]/activer", error, "Erreur serveur lors de l'activation du pack.", {
      statusMap: [
        { match: "deja une activation", status: 409 },
      ],
    });
  }
}
