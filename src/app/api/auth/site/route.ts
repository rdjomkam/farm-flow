import { NextRequest, NextResponse } from "next/server";
import { requireAuth, SESSION_COOKIE_NAME, setSubscriptionCookie } from "@/lib/auth";
import { getSiteMember } from "@/lib/queries/sites";
import { getSubscriptionStatus, isBlocked } from "@/lib/abonnements/check-subscription";
import { prisma } from "@/lib/db";
import { StatutAbonnement, TypePlan } from "@/types";
import { ErrorKeys } from "@/lib/api-error-keys";
import { apiError, handleApiError } from "@/lib/api-utils";

/** PUT /api/auth/site — change the active site for the current session */
export async function PUT(request: NextRequest) {
  try {
    const session = await requireAuth(request);
    const body = await request.json();

    if (!body.siteId || typeof body.siteId !== "string") {
      return apiError(400, "Le champ 'siteId' est obligatoire.");
    }

    // Verify user is an active member of the target site (with siteRole included)
    const member = await getSiteMember(body.siteId, session.userId);
    if (!member || !member.isActive) {
      return apiError(403, "Vous n'etes pas membre de ce site.", { code: ErrorKeys.AUTH_NOT_MEMBER });
    }

    // Update activeSiteId in current session
    const sessionToken = request.cookies.get(SESSION_COOKIE_NAME)?.value;
    if (sessionToken) {
      await prisma.session.updateMany({
        where: { sessionToken },
        data: { activeSiteId: body.siteId },
      });
    }

    // Build subscription cookie payload
    const subStatus = await getSubscriptionStatus(body.siteId);
    const isDecouverteFlag =
      subStatus.isDecouverte ||
      (subStatus.planType as string) === TypePlan.DECOUVERTE;
    const blockedFlag = isDecouverteFlag
      ? false
      : isBlocked(subStatus.statut as StatutAbonnement | null);

    const response = NextResponse.json({
      success: true,
      activeSiteId: body.siteId,
      siteRole: {
        id: member.siteRole.id,
        name: member.siteRole.name,
        permissions: member.siteRole.permissions,
      },
    });

    setSubscriptionCookie(
      response,
      {
        statut: subStatus.statut,
        isDecouverte: isDecouverteFlag,
        isBlocked: blockedFlag,
      },
      new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    );

    return response;
  } catch (error) {
    return handleApiError("PUT /api/auth/site", error, "Erreur serveur lors du changement de site.", {
      code: ErrorKeys.SERVER_CHANGE_SITE,
    });
  }
}
