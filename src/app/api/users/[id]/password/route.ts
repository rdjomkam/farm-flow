import { NextRequest, NextResponse } from "next/server";
import { requireHasPermission } from "@/lib/permissions";
import { hashPassword } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getUserAdminDetail } from "@/lib/queries/users-admin";
import { Permission } from "@/types";
import { apiError, handleApiError } from "@/lib/api-utils";

type RouteParams = { params: Promise<{ id: string }> };

/** POST /api/users/[id]/password — reinitialiser le mot de passe */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    await requireHasPermission(request, Permission.UTILISATEURS_GERER);
    const { id } = await params;

    const body = await request.json();

    if (!body.newPassword || typeof body.newPassword !== "string" || body.newPassword.length < 6) {
      return apiError(400, "Le mot de passe doit contenir au moins 6 caracteres.");
    }

    const target = await getUserAdminDetail(id);
    if (!target) {
      return apiError(404, "Utilisateur introuvable.");
    }

    if (target.isSystem) {
      return apiError(403, "Impossible de modifier le mot de passe d'un utilisateur systeme.");
    }

    const passwordHash = await hashPassword(body.newPassword);
    await prisma.user.update({
      where: { id },
      data: { passwordHash },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError("POST /api/users/[id]/password", error, "Erreur serveur.");
  }
}
