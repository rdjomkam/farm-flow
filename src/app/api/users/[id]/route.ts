import { NextRequest, NextResponse } from "next/server";
import { requireHasPermission, ForbiddenError } from "@/lib/permissions";
import { AuthError } from "@/lib/auth";
import { getUserAdminDetail, updateUserAdmin, countActiveAdmins } from "@/lib/queries/users-admin";
import { Permission, Role } from "@/types";

type RouteParams = { params: Promise<{ id: string }> };

/** GET /api/users/[id] — profil complet d'un utilisateur */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    await requireHasPermission(request, Permission.UTILISATEURS_VOIR, Permission.UTILISATEURS_GERER);
    const { id } = await params;

    const user = await getUserAdminDetail(id);
    if (!user) {
      return NextResponse.json({ status: 404, message: "Utilisateur introuvable." }, { status: 404 });
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
      return NextResponse.json({ status: 401, message: error.message }, { status: 401 });
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ status: 403, message: error.message }, { status: 403 });
    }
    return NextResponse.json({ status: 500, message: "Erreur serveur." }, { status: 500 });
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
      return NextResponse.json({ status: 404, message: "Utilisateur introuvable." }, { status: 404 });
    }

    // Block modification of system users
    if (target.isSystem) {
      return NextResponse.json(
        { status: 403, message: "Impossible de modifier un utilisateur systeme." },
        { status: 403 }
      );
    }

    // Guard: cannot deactivate the last ADMIN
    if (body.isActive === false && target.globalRole === Role.ADMIN) {
      const adminCount = await countActiveAdmins();
      if (adminCount <= 1) {
        return NextResponse.json(
          { status: 409, message: "Impossible de desactiver le seul administrateur de la plateforme." },
          { status: 409 }
        );
      }
    }

    // Validate globalRole if provided
    if (body.globalRole !== undefined) {
      const validRoles = Object.values(Role);
      if (!validRoles.includes(body.globalRole)) {
        return NextResponse.json({ status: 400, message: "Role invalide." }, { status: 400 });
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
      return NextResponse.json({ status: 401, message: error.message }, { status: 401 });
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ status: 403, message: error.message }, { status: 403 });
    }
    if (error && typeof error === "object" && "code" in error && (error as { code: string }).code === "P2002") {
      return NextResponse.json({ status: 409, message: "Email ou telephone deja utilise." }, { status: 409 });
    }
    return NextResponse.json({ status: 500, message: "Erreur serveur lors de la modification." }, { status: 500 });
  }
}
