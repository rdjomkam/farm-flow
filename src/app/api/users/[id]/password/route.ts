import { NextRequest, NextResponse } from "next/server";
import { requireHasPermission, ForbiddenError } from "@/lib/permissions";
import { AuthError, hashPassword } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getUserAdminDetail } from "@/lib/queries/users-admin";
import { Permission } from "@/types";

type RouteParams = { params: Promise<{ id: string }> };

/** POST /api/users/[id]/password — reinitialiser le mot de passe */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    await requireHasPermission(request, Permission.UTILISATEURS_GERER);
    const { id } = await params;

    const body = await request.json();

    if (!body.newPassword || typeof body.newPassword !== "string" || body.newPassword.length < 6) {
      return NextResponse.json(
        { status: 400, message: "Le mot de passe doit contenir au moins 6 caracteres." },
        { status: 400 }
      );
    }

    const target = await getUserAdminDetail(id);
    if (!target) {
      return NextResponse.json({ status: 404, message: "Utilisateur introuvable." }, { status: 404 });
    }

    if (target.isSystem) {
      return NextResponse.json(
        { status: 403, message: "Impossible de modifier le mot de passe d'un utilisateur systeme." },
        { status: 403 }
      );
    }

    const passwordHash = await hashPassword(body.newPassword);
    await prisma.user.update({
      where: { id },
      data: { passwordHash },
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
