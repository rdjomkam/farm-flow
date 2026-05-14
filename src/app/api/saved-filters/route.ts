import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { apiError, handleApiError } from "@/lib/api-utils";

const VALID_PAGES = ["besoins", "commandes", "releves"];

export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth(request);
    if (!session.activeSiteId) return apiError(400, "Aucun site actif.");

    const page = new URL(request.url).searchParams.get("page");
    if (!page || !VALID_PAGES.includes(page)) {
      return apiError(400, "Parametre page invalide.");
    }

    const data = await prisma.savedFilter.findMany({
      where: { userId: session.userId, siteId: session.activeSiteId, page },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ data });
  } catch (error) {
    return handleApiError("GET /api/saved-filters", error, "Erreur serveur.");
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth(request);
    if (!session.activeSiteId) return apiError(400, "Aucun site actif.");

    const body = await request.json();
    const { name, page, filters } = body;

    if (!name || typeof name !== "string" || name.trim().length === 0 || name.trim().length > 50) {
      return apiError(400, "Le nom est requis (max 50 caracteres).");
    }
    if (!page || !VALID_PAGES.includes(page)) {
      return apiError(400, "Page invalide.");
    }
    if (!filters || typeof filters !== "object" || Array.isArray(filters)) {
      return apiError(400, "Filtres invalides.");
    }

    const existing = await prisma.savedFilter.findUnique({
      where: {
        userId_siteId_page_name: {
          userId: session.userId,
          siteId: session.activeSiteId,
          page,
          name: name.trim(),
        },
      },
    });

    if (existing) {
      return apiError(409, "Un filtre avec ce nom existe deja.");
    }

    const saved = await prisma.savedFilter.create({
      data: {
        name: name.trim(),
        page,
        filters,
        userId: session.userId,
        siteId: session.activeSiteId,
      },
    });

    return NextResponse.json(saved, { status: 201 });
  } catch (error) {
    return handleApiError("POST /api/saved-filters", error, "Erreur serveur.");
  }
}
