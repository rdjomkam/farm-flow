import { NextRequest, NextResponse } from "next/server";
import { requireAuth, AuthError, SESSION_COOKIE_NAME } from "@/lib/auth";
import { getSiteMember } from "@/lib/queries/sites";
import { prisma } from "@/lib/db";
import { ErrorKeys } from "@/lib/api-error-keys";

/** PUT /api/auth/site — change the active site for the current session */
export async function PUT(request: NextRequest) {
  try {
    const session = await requireAuth(request);
    const body = await request.json();

    if (!body.siteId || typeof body.siteId !== "string") {
      return NextResponse.json(
        { status: 400, message: "Le champ 'siteId' est obligatoire." },
        { status: 400 }
      );
    }

    // Verify user is an active member of the target site (with siteRole included)
    const member = await getSiteMember(body.siteId, session.userId);
    if (!member || !member.isActive) {
      return NextResponse.json(
        { status: 403, message: "Vous n'etes pas membre de ce site.", errorKey: ErrorKeys.AUTH_NOT_MEMBER },
        { status: 403 }
      );
    }

    // Update activeSiteId in current session
    const sessionToken = request.cookies.get(SESSION_COOKIE_NAME)?.value;
    if (sessionToken) {
      await prisma.session.updateMany({
        where: { sessionToken },
        data: { activeSiteId: body.siteId },
      });
    }

    return NextResponse.json({
      success: true,
      activeSiteId: body.siteId,
      siteRole: {
        id: member.siteRole.id,
        name: member.siteRole.name,
        permissions: member.siteRole.permissions,
      },
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { status: 401, message: error.message },
        { status: 401 }
      );
    }
    return NextResponse.json(
      { status: 500, message: "Erreur serveur lors du changement de site.", errorKey: ErrorKeys.SERVER_CHANGE_SITE },
      { status: 500 }
    );
  }
}
