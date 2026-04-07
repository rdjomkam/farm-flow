import { NextRequest, NextResponse } from "next/server";
import { requireHasPermission } from "@/lib/permissions";
import { getSession, getSessionToken } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Permission, Role } from "@/types";
import { apiError, handleApiError } from "@/lib/api-utils";

type RouteParams = { params: Promise<{ id: string }> };

/** POST /api/users/[id]/impersonate — demarrer une impersonation */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await requireHasPermission(request, Permission.UTILISATEURS_IMPERSONNER);
    const { id: targetId } = await params;

    // Guard: cannot nest impersonations
    if (session.isImpersonating) {
      return apiError(409, "Impossible d'imbriquer des impersonations. Arretez d'abord l'impersonation en cours.");
    }

    // Load target user
    const targetUser = await prisma.user.findUnique({
      where: { id: targetId },
      select: { id: true, name: true, email: true, role: true, isActive: true, isSystem: true },
    });

    if (!targetUser) {
      return apiError(404, "Utilisateur introuvable.");
    }

    if (targetUser.isSystem) {
      return apiError(403, "Impossible d'impersonner un utilisateur systeme.");
    }

    if (!targetUser.isActive) {
      return apiError(403, "Impossible d'impersonner un compte desactive.");
    }

    if (targetUser.role === Role.ADMIN) {
      return apiError(403, "Impossible d'impersonner un administrateur.");
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
      return apiError(401, "Token de session manquant.");
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
    return handleApiError("POST /api/users/[id]/impersonate", error, "Erreur serveur.");
  }
}
