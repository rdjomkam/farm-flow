import { NextRequest, NextResponse } from "next/server";
import { requireAuth, AuthError } from "@/lib/auth";
import {
  getSiteMember,
  updateMemberSiteRole,
  removeMember,
} from "@/lib/queries/sites";
import { getSiteRoleById } from "@/lib/queries/roles";
import {
  canAssignRole,
  ForbiddenError,
} from "@/lib/permissions";
import { Permission } from "@/types";

type RouteParams = { params: Promise<{ id: string; userId: string }> };

/** PUT /api/sites/[id]/members/[userId] — change a member's site role */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await requireAuth(request);
    const { id: siteId, userId: targetUserId } = await params;

    // Check caller's membership and MEMBRES_GERER permission
    const callerMember = await getSiteMember(siteId, session.userId);
    if (!callerMember || !callerMember.isActive) {
      return NextResponse.json(
        { status: 403, message: "Vous n'etes pas membre de ce site." },
        { status: 403 }
      );
    }
    if (!callerMember.siteRole) {
      return NextResponse.json(
        { status: 500, message: "Erreur de configuration des roles." },
        { status: 500 }
      );
    }
    if (!(callerMember.siteRole.permissions as Permission[]).includes(Permission.MEMBRES_GERER)) {
      throw new ForbiddenError("Permission insuffisante pour gerer les membres.");
    }

    // Cannot change own siteRoleId
    if (targetUserId === session.userId) {
      throw new ForbiddenError("Vous ne pouvez pas modifier votre propre role.");
    }

    const body = await request.json();

    if (!body.siteRoleId || typeof body.siteRoleId !== "string" || body.siteRoleId.trim() === "") {
      return NextResponse.json(
        { status: 400, message: "L'identifiant du role est obligatoire." },
        { status: 400 }
      );
    }

    // Load target role and verify it belongs to this site
    const targetRole = await getSiteRoleById(body.siteRoleId, siteId);
    if (!targetRole) {
      return NextResponse.json(
        { status: 404, message: "Role introuvable." },
        { status: 404 }
      );
    }

    // Load target member
    const targetMember = await getSiteMember(siteId, targetUserId);
    if (!targetMember) {
      return NextResponse.json(
        { status: 404, message: "Membre introuvable." },
        { status: 404 }
      );
    }

    const callerPerms = callerMember.siteRole.permissions as Permission[];
    const currentTargetPerms = targetMember.siteRole.permissions as Permission[];

    // Anti-escalation check 1: caller must have >= permissions than target member's current role
    if (!canAssignRole(callerPerms, currentTargetPerms)) {
      throw new ForbiddenError("Vous ne pouvez pas modifier un membre ayant des permissions superieures aux votres.");
    }

    // Anti-escalation check 2: caller must have >= permissions than the new role
    if (!canAssignRole(callerPerms, targetRole.permissions as Permission[])) {
      throw new ForbiddenError("Vous ne pouvez pas assigner un role avec des permissions que vous ne possedez pas.");
    }

    await updateMemberSiteRole(siteId, targetUserId, body.siteRoleId);

    return NextResponse.json({
      success: true,
      userId: targetUserId,
      siteRoleId: targetRole.id,
      siteRoleName: targetRole.name,
      permissions: targetRole.permissions,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { status: 401, message: error.message },
        { status: 401 }
      );
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json(
        { status: 403, message: error.message },
        { status: 403 }
      );
    }
    return NextResponse.json(
      { status: 500, message: "Erreur serveur lors de la modification du role." },
      { status: 500 }
    );
  }
}

/** DELETE /api/sites/[id]/members/[userId] — remove a member */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await requireAuth(request);
    const { id: siteId, userId: targetUserId } = await params;

    // Check caller's membership and MEMBRES_GERER permission
    const callerMember = await getSiteMember(siteId, session.userId);
    if (!callerMember || !callerMember.isActive) {
      return NextResponse.json(
        { status: 403, message: "Vous n'etes pas membre de ce site." },
        { status: 403 }
      );
    }
    if (!callerMember.siteRole) {
      return NextResponse.json(
        { status: 500, message: "Erreur de configuration des roles." },
        { status: 500 }
      );
    }
    if (!(callerMember.siteRole.permissions as Permission[]).includes(Permission.MEMBRES_GERER)) {
      throw new ForbiddenError("Permission insuffisante pour gerer les membres.");
    }

    // Cannot remove yourself
    if (targetUserId === session.userId) {
      throw new ForbiddenError("Vous ne pouvez pas vous retirer vous-meme du site.");
    }

    // Load target member
    const targetMember = await getSiteMember(siteId, targetUserId);
    if (!targetMember) {
      return NextResponse.json(
        { status: 404, message: "Membre introuvable." },
        { status: 404 }
      );
    }

    const callerPerms = callerMember.siteRole.permissions as Permission[];
    const targetPerms = targetMember.siteRole.permissions as Permission[];

    // Anti-escalation: cannot remove a member with more permissions
    if (!canAssignRole(callerPerms, targetPerms)) {
      throw new ForbiddenError("Vous ne pouvez pas retirer un membre ayant des permissions superieures aux votres.");
    }

    await removeMember(siteId, targetUserId);

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { status: 401, message: error.message },
        { status: 401 }
      );
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json(
        { status: 403, message: error.message },
        { status: 403 }
      );
    }
    return NextResponse.json(
      { status: 500, message: "Erreur serveur lors de la suppression du membre." },
      { status: 500 }
    );
  }
}
