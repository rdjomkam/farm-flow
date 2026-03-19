import { NextRequest, NextResponse } from "next/server";
import { requireHasPermission, ForbiddenError } from "@/lib/permissions";
import { AuthError } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Permission } from "@/types";

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
      return NextResponse.json({ status: 401, message: error.message }, { status: 401 });
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ status: 403, message: error.message }, { status: 403 });
    }
    return NextResponse.json({ status: 500, message: "Erreur serveur." }, { status: 500 });
  }
}
