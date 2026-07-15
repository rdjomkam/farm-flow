import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { apiError, handleApiError } from "@/lib/api-utils";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth(request);
    if (!session.activeSiteId) return apiError(400, "Aucun site actif.");

    const { id } = await params;
    const body = await request.json();
    const { name, filters } = body;

    const hasName = name !== undefined;
    const hasFilters = filters !== undefined;

    if (!hasName && !hasFilters) {
      return apiError(400, "Aucune donnee a mettre a jour.");
    }

    let trimmedName: string | undefined;
    if (hasName) {
      if (typeof name !== "string" || name.trim().length === 0 || name.trim().length > 50) {
        return apiError(400, "Le nom est requis (max 50 caracteres).");
      }
      trimmedName = name.trim();
    }

    if (hasFilters && (typeof filters !== "object" || filters === null || Array.isArray(filters))) {
      return apiError(400, "Filtres invalides.");
    }

    const filter = await prisma.savedFilter.findUnique({ where: { id } });
    if (!filter) return apiError(404, "Filtre non trouve.");
    if (filter.userId !== session.userId || filter.siteId !== session.activeSiteId) {
      return apiError(403, "Non autorise.");
    }

    if (trimmedName !== undefined && trimmedName !== filter.name) {
      const existing = await prisma.savedFilter.findUnique({
        where: {
          userId_siteId_page_name: {
            userId: session.userId,
            siteId: session.activeSiteId,
            page: filter.page,
            name: trimmedName,
          },
        },
      });
      if (existing) {
        return apiError(409, "Un filtre avec ce nom existe deja.");
      }
    }

    const updated = await prisma.savedFilter.update({
      where: { id },
      data: {
        ...(trimmedName !== undefined && { name: trimmedName }),
        ...(hasFilters && { filters }),
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    return handleApiError("PUT /api/saved-filters/[id]", error, "Erreur serveur.");
  }
}

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
