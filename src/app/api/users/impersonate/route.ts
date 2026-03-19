import { NextRequest, NextResponse } from "next/server";
import { requireAuth, getSessionToken, AuthError } from "@/lib/auth";
import { ForbiddenError } from "@/lib/permissions";
import { prisma } from "@/lib/db";

/** DELETE /api/users/impersonate — arreter l'impersonation en cours */
export async function DELETE(request: NextRequest) {
  try {
    const session = await requireAuth(request);

    if (!session.isImpersonating || !session.originalUserId) {
      return NextResponse.json(
        { status: 409, message: "Vous n'etes pas en mode impersonation." },
        { status: 409 }
      );
    }

    const sessionToken = getSessionToken(request);
    if (!sessionToken) {
      return NextResponse.json({ status: 401, message: "Token de session manquant." }, { status: 401 });
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
      return NextResponse.json({ status: 401, message: error.message }, { status: 401 });
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ status: 403, message: error.message }, { status: 403 });
    }
    return NextResponse.json({ status: 500, message: "Erreur serveur." }, { status: 500 });
  }
}
