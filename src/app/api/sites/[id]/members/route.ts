import { NextRequest, NextResponse } from "next/server";
import { requireAuth, AuthError } from "@/lib/auth";
import { getSiteById, getSiteMember, addMember } from "@/lib/queries/sites";
import { getSiteRoleById } from "@/lib/queries/roles";
import { getUserByIdentifier } from "@/lib/queries/users";
import {
  canAssignRole,
  ForbiddenError,
} from "@/lib/permissions";
import { Permission } from "@/types";

type RouteParams = { params: Promise<{ id: string }> };

/** GET /api/sites/[id]/members — list members of a site */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await requireAuth(request);
    const { id } = await params;

    const site = await getSiteById(id, session.userId);
    if (!site) {
      return NextResponse.json(
        { status: 404, message: "Site introuvable." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      members: site.members.map((m) => ({
        id: m.id,
        userId: m.user.id,
        name: m.user.name,
        email: m.user.email,
        phone: m.user.phone,
        siteRoleId: m.siteRoleId,
        siteRoleName: m.siteRole.name,
        isActive: m.isActive,
        createdAt: m.createdAt,
      })),
      total: site.members.length,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { status: 401, message: error.message },
        { status: 401 }
      );
    }
    return NextResponse.json(
      { status: 500, message: "Erreur serveur lors de la recuperation des membres." },
      { status: 500 }
    );
  }
}

/** POST /api/sites/[id]/members — add a member (with MEMBRES_GERER permission) */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await requireAuth(request);
    const { id: siteId } = await params;

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

    const body = await request.json();
    const errors: { field: string; message: string }[] = [];

    if (!body.identifier || typeof body.identifier !== "string" || body.identifier.trim() === "") {
      errors.push({ field: "identifier", message: "L'email ou le telephone du membre est obligatoire." });
    }

    if (!body.siteRoleId || typeof body.siteRoleId !== "string" || body.siteRoleId.trim() === "") {
      errors.push({ field: "siteRoleId", message: "L'identifiant du role est obligatoire." });
    }

    if (errors.length > 0) {
      return NextResponse.json(
        { status: 400, message: "Erreurs de validation", errors },
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

    // Anti-escalation: caller can only assign roles with permissions they have
    const callerPerms = callerMember.siteRole.permissions as Permission[];
    if (!canAssignRole(callerPerms, targetRole.permissions as Permission[])) {
      throw new ForbiddenError("Vous ne pouvez pas assigner un role avec des permissions que vous ne possedez pas.");
    }

    // Find target user
    const targetUser = await getUserByIdentifier(body.identifier.trim());
    if (!targetUser) {
      return NextResponse.json(
        { status: 404, message: "Aucun utilisateur trouve avec cet identifiant." },
        { status: 404 }
      );
    }

    // Check if already a member
    const existingMember = await getSiteMember(siteId, targetUser.id);
    if (existingMember) {
      return NextResponse.json(
        { status: 409, message: "Cet utilisateur est deja membre de ce site." },
        { status: 409 }
      );
    }

    const member = await addMember(siteId, targetUser.id, body.siteRoleId);

    return NextResponse.json(
      {
        id: member.id,
        userId: member.user.id,
        name: member.user.name,
        email: member.user.email,
        phone: member.user.phone,
        siteRoleId: member.siteRoleId,
        siteRoleName: member.siteRole.name,
        permissions: member.siteRole.permissions,
        isActive: member.isActive,
        createdAt: member.createdAt,
      },
      { status: 201 }
    );
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
      { status: 500, message: "Erreur serveur lors de l'ajout du membre." },
      { status: 500 }
    );
  }
}
