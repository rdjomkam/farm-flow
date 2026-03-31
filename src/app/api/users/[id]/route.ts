import { NextRequest, NextResponse } from "next/server";
import { requireHasPermission, ForbiddenError } from "@/lib/permissions";
import { AuthError } from "@/lib/auth";
import { getUserAdminDetail, updateUserAdmin, countActiveAdmins } from "@/lib/queries/users-admin";
import { Permission, Role } from "@/types";
import { apiError } from "@/lib/api-utils";

type RouteParams = { params: Promise<{ id: string }> };

/** GET /api/users/[id] — profil complet d'un utilisateur */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    await requireHasPermission(request, Permission.UTILISATEURS_VOIR, Permission.UTILISATEURS_GERER);
    const { id } = await params;

    const user = await getUserAdminDetail(id);
    if (!user) {
      return apiError(404, "Utilisateur introuvable.");
    }

    return NextResponse.json({
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      globalRole: user.globalRole,
      isActive: user.isActive,
      isSystem: user.isSystem,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    });
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

/** PATCH /api/users/[id] — modifier le profil ou le statut d'un utilisateur */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json();

    // If isActive is being modified, check UTILISATEURS_SUPPRIMER or UTILISATEURS_GERER
    if (body.isActive !== undefined) {
      await requireHasPermission(
        request,
        Permission.UTILISATEURS_SUPPRIMER,
        Permission.UTILISATEURS_GERER
      );
    } else {
      await requireHasPermission(
        request,
        Permission.UTILISATEURS_MODIFIER,
        Permission.UTILISATEURS_GERER
      );
    }

    // Load target user
    const target = await getUserAdminDetail(id);
    if (!target) {
      return apiError(404, "Utilisateur introuvable.");
    }

    // Block modification of system users
    if (target.isSystem) {
      return apiError(403, "Impossible de modifier un utilisateur systeme.");
    }

    // Guard: cannot deactivate the last ADMIN
    if (body.isActive === false && target.globalRole === Role.ADMIN) {
      const adminCount = await countActiveAdmins();
      if (adminCount <= 1) {
        return apiError(409, "Impossible de desactiver le seul administrateur de la plateforme.");
      }
    }

    // Validate globalRole if provided
    if (body.globalRole !== undefined) {
      const validRoles = Object.values(Role);
      if (!validRoles.includes(body.globalRole)) {
        return apiError(400, "Role invalide.");
      }
    }

    const updated = await updateUserAdmin(id, {
      name: body.name?.trim(),
      email: body.email,
      phone: body.phone,
      globalRole: body.globalRole,
      isActive: body.isActive,
    });

    return NextResponse.json({
      id: updated.id,
      name: updated.name,
      email: updated.email,
      phone: updated.phone,
      globalRole: updated.globalRole,
      isActive: updated.isActive,
      isSystem: updated.isSystem,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return apiError(401, error.message);
    }
    if (error instanceof ForbiddenError) {
      return apiError(403, error.message);
    }
    if (error && typeof error === "object" && "code" in error && (error as { code: string }).code === "P2002") {
      return apiError(409, "Email ou telephone deja utilise.");
    }
    return apiError(500, "Erreur serveur lors de la modification.");
  }
}
