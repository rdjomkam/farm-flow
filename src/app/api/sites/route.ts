import { NextRequest, NextResponse } from "next/server";
import { requireAuth, AuthError } from "@/lib/auth";
import { getUserSites, createSite } from "@/lib/queries/sites";
import { Role } from "@/types";

/** GET /api/sites — list sites the user is a member of */
export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth(request);
    const sites = await getUserSites(session.userId);

    return NextResponse.json({
      sites: sites.map((s) => ({
        id: s.id,
        name: s.name,
        address: s.address,
        isActive: s.isActive,
        memberCount: s._count.members,
        bacCount: s._count.bacs,
        vagueCount: s._count.vagues,
        createdAt: s.createdAt,
      })),
      total: sites.length,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { status: 401, message: error.message },
        { status: 401 }
      );
    }
    return NextResponse.json(
      { status: 500, message: "Erreur serveur lors de la recuperation des sites." },
      { status: 500 }
    );
  }
}

/** POST /api/sites — create a new site (creator becomes Administrateur) */
export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth(request);

    if (session.role !== Role.ADMIN) {
      return NextResponse.json(
        { status: 403, message: "Seuls les administrateurs peuvent creer des sites." },
        { status: 403 }
      );
    }

    const body = await request.json();

    const errors: { field: string; message: string }[] = [];

    if (!body.name || typeof body.name !== "string" || body.name.trim() === "") {
      errors.push({ field: "name", message: "Le nom du site est obligatoire." });
    }

    if (body.address !== undefined && typeof body.address !== "string") {
      errors.push({ field: "address", message: "L'adresse doit etre une chaine de caracteres." });
    }

    if (errors.length > 0) {
      return NextResponse.json(
        { status: 400, message: "Erreurs de validation", errors },
        { status: 400 }
      );
    }

    const site = await createSite(
      { name: body.name.trim(), address: body.address?.trim() },
      session.userId
    );

    return NextResponse.json(
      {
        id: site.id,
        name: site.name,
        address: site.address,
        isActive: site.isActive,
        createdAt: site.createdAt,
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { status: 401, message: error.message },
        { status: 401 }
      );
    }
    return NextResponse.json(
      { status: 500, message: "Erreur serveur lors de la creation du site." },
      { status: 500 }
    );
  }
}
