import { NextRequest, NextResponse } from "next/server";
import { requireAuth, getSessionToken, AuthError } from "@/lib/auth";
import { ForbiddenError } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { apiError } from "@/lib/api-utils";

/** DELETE /api/users/impersonate — arreter l'impersonation en cours */
export async function DELETE(request: NextRequest) {
  try {
    const session = await requireAuth(request);

    if (!session.isImpersonating || !session.originalUserId) {
      return apiError(409, "Vous n'etes pas en mode impersonation.");
    }

    const sessionToken = getSessionToken(request);
    if (!sessionToken) {
      return apiError(401, "Token de session manquant.");
    }

    // Restore original admin user
    await prisma.session.update({
      where: { sessionToken },
      data: {
        userId: session.originalUserId,
        originalUserId: null,
        activeSiteId: null,
      },
    });

    return NextResponse.json({ success: true });
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
