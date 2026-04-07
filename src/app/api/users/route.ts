import { NextRequest, NextResponse } from "next/server";
import { requireHasPermission } from "@/lib/permissions";
import { ForbiddenError } from "@/lib/permissions";
import { hashPassword } from "@/lib/auth";
import { normalizePhone } from "@/lib/auth";
import { getUserByEmail, getUserByPhone, createUser } from "@/lib/queries/users";
import { listUsers } from "@/lib/queries/users-admin";
import { Permission, Role } from "@/types";
import { apiError, handleApiError } from "@/lib/api-utils";

/** GET /api/users — lister les utilisateurs (pagine, filtrable) */
export async function GET(request: NextRequest) {
  try {
    await requireHasPermission(request, Permission.UTILISATEURS_VOIR, Permission.UTILISATEURS_GERER);

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || undefined;
    const roleParam = searchParams.get("role") || undefined;
    const isActiveParam = searchParams.get("isActive");
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "25", 10)));

    const role = roleParam && Object.values(Role).includes(roleParam as Role)
      ? (roleParam as Role)
      : undefined;

    const isActive =
      isActiveParam === "true" ? true : isActiveParam === "false" ? false : undefined;

    const { users, total } = await listUsers({ search, role, isActive, page, limit });

    const result = users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      phone: u.phone,
      globalRole: u.globalRole,
      isActive: u.isActive,
      isSystem: u.isSystem,
      siteCount: u.siteCount,
      createdAt: u.createdAt.toISOString(),
    }));

    return NextResponse.json({ users: result, total, page, limit });
  } catch (error) {
    return handleApiError("GET /api/users", error, "Erreur serveur.");
  }
}

/** POST /api/users — creer un utilisateur */
export async function POST(request: NextRequest) {
  try {
    await requireHasPermission(request, Permission.UTILISATEURS_CREER, Permission.UTILISATEURS_GERER);

    const body = await request.json();
    const errors: { field: string; message: string }[] = [];

    if (!body.name || typeof body.name !== "string" || body.name.trim() === "") {
      errors.push({ field: "name", message: "Le nom est obligatoire." });
    }
    if (!body.email && !body.phone) {
      errors.push({ field: "email", message: "Email ou telephone est requis." });
    }
    if (!body.password || typeof body.password !== "string" || body.password.length < 6) {
      errors.push({ field: "password", message: "Le mot de passe doit contenir au moins 6 caracteres." });
    }

    if (errors.length > 0) {
      return apiError(400, "Erreurs de validation", { errors });
    }

    // Check email uniqueness
    if (body.email) {
      const existing = await getUserByEmail(body.email);
      if (existing) {
        return apiError(409, "Cet email est deja utilise.");
      }
    }

    // Check phone uniqueness
    let normalizedPhone: string | null | undefined;
    if (body.phone) {
      normalizedPhone = normalizePhone(body.phone);
      if (normalizedPhone) {
        const existing = await getUserByPhone(normalizedPhone);
        if (existing) {
          return apiError(409, "Ce numero de telephone est deja utilise.");
        }
      }
    }

    const validRoles = Object.values(Role);
    const globalRole: Role =
      body.globalRole && validRoles.includes(body.globalRole)
        ? body.globalRole
        : Role.PISCICULTEUR;

    const passwordHash = await hashPassword(body.password);
    const phone = normalizedPhone ?? undefined;

    const user = await createUser({
      name: body.name.trim(),
      email: body.email || undefined,
      phone: phone || undefined,
      passwordHash,
      role: globalRole,
    });

    return NextResponse.json(
      {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        globalRole: user.role,
        isActive: user.isActive,
        isSystem: user.isSystem,
        siteCount: 0,
        createdAt: user.createdAt.toISOString(),
      },
      { status: 201 }
    );
  } catch (error) {
    return handleApiError("POST /api/users", error, "Erreur serveur lors de la creation.");
  }
}
