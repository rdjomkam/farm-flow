import { NextRequest, NextResponse } from "next/server";
import { requireHasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { Permission } from "@/types";
import { apiError, handleApiError } from "@/lib/api-utils";

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
    return handleApiError("POST /api/users/[id]/sessions", error, "Erreur serveur.");
  }
}
