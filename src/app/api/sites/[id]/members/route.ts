import { NextRequest, NextResponse } from "next/server";
import { requireAuth, AuthError } from "@/lib/auth";
import { normalizePhone } from "@/lib/auth/phone";
import { getSiteById, getSiteMember, addMember } from "@/lib/queries/sites";
import { getSiteRoleById } from "@/lib/queries/roles";
import { getUserByIdentifier } from "@/lib/queries/users";
import {
  canAssignRole,
  ForbiddenError,
} from "@/lib/permissions";
import { apiError } from "@/lib/api-utils";
import { Permission } from "@/types";

type RouteParams = { params: Promise<{ id: string }> };

/** GET /api/sites/[id]/members — list members of a site */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await requireAuth(request);
    const { id } = await params;

    const site = await getSiteById(id, session.userId);
    if (!site) {
      return apiError(404, "Site introuvable.");
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
      return apiError(401, error.message);
    }
    return apiError(500, "Erreur serveur lors de la recuperation des membres.");
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
      return apiError(403, "Vous n'etes pas membre de ce site.");
    }
    if (!callerMember.siteRole) {
      return apiError(500, "Erreur de configuration des roles.");
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
      return apiError(400, "Erreurs de validation", { errors });
    }

    // Load target role and verify it belongs to this site
    const targetRole = await getSiteRoleById(body.siteRoleId, siteId);
    if (!targetRole) {
      return apiError(404, "Role introuvable.");
    }

    // Anti-escalation: caller can only assign roles with permissions they have
    const callerPerms = callerMember.siteRole.permissions as Permission[];
    if (!canAssignRole(callerPerms, targetRole.permissions as Permission[])) {
      throw new ForbiddenError("Vous ne pouvez pas assigner un role avec des permissions que vous ne possedez pas.");
    }

    // Normalize phone identifier before lookup (e.g. 699123456 → +237699123456)
    const rawIdentifier = body.identifier.trim();
    const normalizedIdentifier = normalizePhone(rawIdentifier) ?? rawIdentifier;
    const targetUser = await getUserByIdentifier(normalizedIdentifier);
    if (!targetUser) {
      return apiError(404, "Aucun utilisateur trouve avec cet identifiant.");
    }

    // Check if already a member
    const existingMember = await getSiteMember(siteId, targetUser.id);
    if (existingMember) {
      return apiError(409, "Cet utilisateur est deja membre de ce site.");
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
      return apiError(401, error.message);
    }
    if (error instanceof ForbiddenError) {
      return apiError(403, error.message);
    }
    return apiError(500, "Erreur serveur lors de l'ajout du membre.");
  }
}
