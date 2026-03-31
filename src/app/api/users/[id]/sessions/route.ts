import { NextRequest, NextResponse } from "next/server";
import { requireHasPermission, ForbiddenError } from "@/lib/permissions";
import { AuthError } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Permission } from "@/types";
import { apiError } from "@/lib/api-utils";

type RouteParams = { params: Promise<{ id: string }> };

/** POST /api/users/[id]/sessions — forcer la deconnexion (supprimer toutes les sessions) */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    await requireHasPermission(request, Permission.UTILISATEURS_GERER);
    const { id } = await params;

    const result = await prisma.session.deleteMany({
      where: { userId: id },
    });

    return NextResponse.json({ deletedCount: result.count });
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
