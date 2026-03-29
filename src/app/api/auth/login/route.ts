import { NextRequest, NextResponse } from "next/server";
import { verifyPassword, createSession, setSessionCookie, setUserRoleCookie, setIsSuperAdminCookie, normalizePhone } from "@/lib/auth";
import { getUserByIdentifier } from "@/lib/queries/users";
import { Role } from "@/types";
import type { AuthResponse } from "@/types";
import { ErrorKeys } from "@/lib/api-error-keys";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const errors: { field: string; message: string }[] = [];

    if (!body.identifier || typeof body.identifier !== "string" || body.identifier.trim() === "") {
      errors.push({ field: "identifier", message: "L'email ou le telephone est obligatoire." });
    }

    if (!body.password || typeof body.password !== "string") {
      errors.push({ field: "password", message: "Le mot de passe est obligatoire." });
    }

    if (errors.length > 0) {
      return NextResponse.json(
        { status: 400, message: "Erreurs de validation", errors },
        { status: 400 }
      );
    }

    // Generic error message to prevent enumeration
    const genericError: AuthResponse = {
      success: false,
      error: "Identifiant ou mot de passe incorrect.",
    };

    // Normalize identifier: if it looks like a phone number, convert to +237 format
    let identifier = body.identifier.trim();
    const normalized = normalizePhone(identifier);
    if (normalized) {
      identifier = normalized;
    }

    // Find user by email or phone
    const user = await getUserByIdentifier(identifier);
    if (!user) {
      return NextResponse.json(genericError, { status: 401 });
    }

    // Check if user is active
    if (!user.isActive) {
      return NextResponse.json(
        { success: false, error: "Ce compte a ete desactive.", errorKey: ErrorKeys.AUTH_ACCOUNT_DEACTIVATED } satisfies AuthResponse,
        { status: 403 }
      );
    }

    // Verify password
    const isValid = await verifyPassword(body.password, user.passwordHash);
    if (!isValid) {
      return NextResponse.json(genericError, { status: 401 });
    }

    // Create session
    const { sessionToken, expires } = await createSession(user.id);

    const responseBody: AuthResponse = {
      success: true,
      user: {
        userId: user.id,
        email: user.email,
        phone: user.phone,
        name: user.name,
        role: user.role as Role,
        activeSiteId: null,
        isImpersonating: false,
        originalUserId: null,
        originalUserName: null,
      },
    };

    const response = NextResponse.json(responseBody);
    setSessionCookie(response, sessionToken, expires);
    setUserRoleCookie(response, user.role, expires);
    // Set super-admin cookie if applicable so the Edge middleware can bypass role guards
    if (user.isSuperAdmin) {
      setIsSuperAdminCookie(response, expires);
    }
    return response;
  } catch {
    return NextResponse.json(
      { success: false, error: "Erreur serveur lors de la connexion.", errorKey: ErrorKeys.SERVER_LOGIN } satisfies AuthResponse,
      { status: 500 }
    );
  }
}
