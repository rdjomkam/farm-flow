import { NextRequest, NextResponse } from "next/server";
import { requireAuth, AuthError } from "@/lib/auth";
import { getSiteById, updateSite, getSiteMember } from "@/lib/queries/sites";
import { ForbiddenError } from "@/lib/permissions";
import { Permission, SiteModule } from "@/types";
import { SITE_TOGGLEABLE_MODULES } from "@/lib/site-modules-config";

const VALID_MODULES = SITE_TOGGLEABLE_MODULES.map((m) => m.value);

type RouteParams = { params: Promise<{ id: string }> };

/** GET /api/sites/[id] — site detail (requires membership) */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await requireAuth(request);
    const { id } = await params;

    const site = await getSiteById(id, session.userId);
    if (!site) {
      return NextResponse.json(
        { status: 404, message: "Site introuvable." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      id: site.id,
      name: site.name,
      address: site.address,
      isActive: site.isActive,
      enabledModules: site.enabledModules,
      bacCount: site._count.bacs,
      vagueCount: site._count.vagues,
      members: site.members.map((m) => ({
        id: m.id,
        userId: m.user.id,
        name: m.user.name,
        email: m.user.email,
        phone: m.user.phone,
        siteRoleId: m.siteRoleId,
        siteRoleName: m.siteRole.name,
        permissions: m.siteRole.permissions,
        isActive: m.isActive,
        createdAt: m.createdAt,
      })),
      createdAt: site.createdAt,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { status: 401, message: error.message },
        { status: 401 }
      );
    }
    return NextResponse.json(
      { status: 500, message: "Erreur serveur lors de la recuperation du site." },
      { status: 500 }
    );
  }
}

/** PUT /api/sites/[id] — update site (requires SITE_GERER permission) */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await requireAuth(request);
    const { id } = await params;

    // Check membership and permission
    const member = await getSiteMember(id, session.userId);
    if (!member || !member.isActive) {
      return NextResponse.json(
        { status: 403, message: "Vous n'etes pas membre de ce site." },
        { status: 403 }
      );
    }

    if (!(member.siteRole.permissions as Permission[]).includes(Permission.SITE_GERER)) {
      throw new ForbiddenError("Permission insuffisante pour modifier ce site.");
    }

    const body = await request.json();

    if (body.name !== undefined && (typeof body.name !== "string" || body.name.trim() === "")) {
      return NextResponse.json(
        { status: 400, message: "Le nom du site ne peut pas etre vide." },
        { status: 400 }
      );
    }

    if (body.enabledModules !== undefined) {
      if (!Array.isArray(body.enabledModules)) {
        return NextResponse.json(
          { status: 400, message: "enabledModules doit etre un tableau." },
          { status: 400 }
        );
      }
      const invalid = (body.enabledModules as unknown[]).filter(
        (m) => !VALID_MODULES.includes(m as SiteModule)
      );
      if (invalid.length > 0) {
        return NextResponse.json(
          { status: 400, message: `Modules invalides : ${invalid.join(", ")}` },
          { status: 400 }
        );
      }
    }

    const updated = await updateSite(id, {
      ...(body.name !== undefined && { name: body.name.trim() }),
      ...(body.address !== undefined && { address: body.address?.trim() ?? null }),
      ...(body.enabledModules !== undefined && {
        enabledModules: body.enabledModules as SiteModule[],
      }),
    });

    return NextResponse.json({
      id: updated.id,
      name: updated.name,
      address: updated.address,
      isActive: updated.isActive,
      enabledModules: updated.enabledModules,
      updatedAt: updated.updatedAt,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { status: 401, message: error.message },
        { status: 401 }
      );
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json(
        { status: 403, message: error.message },
        { status: 403 }
      );
    }
    return NextResponse.json(
      { status: 500, message: "Erreur serveur lors de la modification du site." },
      { status: 500 }
    );
  }
}
