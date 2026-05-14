import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { apiError, handleApiError } from "@/lib/api-utils";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth(request);
    if (!session.activeSiteId) return apiError(400, "Aucun site actif.");

    const { id } = await params;

    const filter = await prisma.savedFilter.findUnique({ where: { id } });
    if (!filter) return apiError(404, "Filtre non trouve.");
    if (filter.userId !== session.userId || filter.siteId !== session.activeSiteId) {
      return apiError(403, "Non autorise.");
    }

    await prisma.savedFilter.delete({ where: { id } });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError("DELETE /api/saved-filters/[id]", error, "Erreur serveur.");
  }
}
