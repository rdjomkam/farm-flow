import { NextRequest, NextResponse } from "next/server";
import { AuthError, normalizePhone } from "@/lib/auth";
import { requirePermission, ForbiddenError } from "@/lib/permissions";
import { Permission } from "@/types";
import { activerPack } from "@/lib/queries/provisioning";
import { runEngineForSite, generateOnboardingActivities } from "@/lib/activity-engine";
import { getOrCreateSystemUser } from "@/lib/queries/users";
import type { ActivatePackDTO } from "@/types";

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
      return NextResponse.json(
        { status: 400, message: "Le nom du site client est requis." },
        { status: 400 }
      );
    }
    if (!body.clientUserName || typeof body.clientUserName !== "string" || body.clientUserName.trim() === "") {
      return NextResponse.json(
        { status: 400, message: "Le nom de l'utilisateur client est requis." },
        { status: 400 }
      );
    }
    if (!body.clientUserPhone || typeof body.clientUserPhone !== "string" || body.clientUserPhone.trim() === "") {
      return NextResponse.json(
        { status: 400, message: "Le telephone de l'utilisateur client est requis." },
        { status: 400 }
      );
    }
    const normalizedPhone = normalizePhone(body.clientUserPhone.trim());
    if (!normalizedPhone) {
      return NextResponse.json(
        { status: 400, message: "Numero de telephone invalide (format attendu: 6XXXXXXXX ou 2XXXXXXXX)." },
        { status: 400 }
      );
    }
    if (!body.clientUserPassword || typeof body.clientUserPassword !== "string" || body.clientUserPassword.length < 6) {
      return NextResponse.json(
        { status: 400, message: "Le mot de passe doit contenir au moins 6 caracteres." },
        { status: 400 }
      );
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
      // Non-blocking: pack activation already succeeded
      console.error("[Pack activation] Failed to generate initial activities:", error);
    }

    return NextResponse.json(payload, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ status: 401, message: error.message }, { status: 401 });
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ status: 403, message: error.message }, { status: 403 });
    }
    if (error instanceof Error) {
      // EC-2.1 : double activation
      if (error.message.includes("deja une activation")) {
        return NextResponse.json({ status: 409, message: error.message }, { status: 409 });
      }
      // Pack introuvable
      if (error.message.includes("introuvable")) {
        return NextResponse.json({ status: 404, message: error.message }, { status: 404 });
      }
      // Autres erreurs métier
      return NextResponse.json({ status: 400, message: error.message }, { status: 400 });
    }
    return NextResponse.json(
      { status: 500, message: "Erreur serveur lors de l'activation du pack." },
      { status: 500 }
    );
  }
}
