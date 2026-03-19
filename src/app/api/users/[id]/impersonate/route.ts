import { NextRequest, NextResponse } from "next/server";
import { requireHasPermission, ForbiddenError } from "@/lib/permissions";
import { AuthError, getSession, getSessionToken } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Permission, Role } from "@/types";

type RouteParams = { params: Promise<{ id: string }> };

/** POST /api/users/[id]/impersonate — demarrer une impersonation */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await requireHasPermission(request, Permission.UTILISATEURS_IMPERSONNER);
    const { id: targetId } = await params;

    // Guard: cannot nest impersonations
    if (session.isImpersonating) {
      return NextResponse.json(
        { status: 409, message: "Impossible d'imbriquer des impersonations. Arretez d'abord l'impersonation en cours." },
        { status: 409 }
      );
    }

    // Load target user
    const targetUser = await prisma.user.findUnique({
      where: { id: targetId },
      select: { id: true, name: true, email: true, role: true, isActive: true, isSystem: true },
    });

    if (!targetUser) {
      return NextResponse.json({ status: 404, message: "Utilisateur introuvable." }, { status: 404 });
    }

    if (targetUser.isSystem) {
      return NextResponse.json(
        { status: 403, message: "Impossible d'impersonner un utilisateur systeme." },
        { status: 403 }
      );
    }

    if (!targetUser.isActive) {
      return NextResponse.json(
        { status: 403, message: "Impossible d'impersonner un compte desactive." },
        { status: 403 }
      );
    }

    if (targetUser.role === Role.ADMIN) {
      return NextResponse.json(
        { status: 403, message: "Impossible d'impersonner un administrateur." },
        { status: 403 }
      );
    }

    // Find first active site for the target user
    const firstMembership = await prisma.siteMember.findFirst({
      where: { userId: targetId, isActive: true },
      include: { site: { select: { id: true, isActive: true } } },
      orderBy: { createdAt: "asc" },
    });

    const firstActiveSiteId = firstMembership?.site?.isActive
      ? firstMembership.site.id
      : null;

    // Get the current session token
    const sessionToken = getSessionToken(request);
    if (!sessionToken) {
      return NextResponse.json({ status: 401, message: "Token de session manquant." }, { status: 401 });
    }

    // Update session: swap userId, store originalUserId
    await prisma.session.update({
      where: { sessionToken },
      data: {
        userId: targetId,
        originalUserId: session.userId,
        activeSiteId: firstActiveSiteId,
      },
    });

    return NextResponse.json({
      success: true,
      targetUser: {
        id: targetUser.id,
        name: targetUser.name,
        email: targetUser.email,
      },
    });
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
