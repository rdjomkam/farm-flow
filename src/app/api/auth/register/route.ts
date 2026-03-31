import { NextRequest, NextResponse } from "next/server";
import { hashPassword, createSession, setSessionCookie, normalizePhone } from "@/lib/auth";
import { getUserByEmail, getUserByPhone, createUser } from "@/lib/queries/users";
import { Role } from "@/types";
import type { AuthResponse } from "@/types";
import { ErrorKeys } from "@/lib/api-error-keys";
import { apiError } from "@/lib/api-utils";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_MIN_LENGTH = 6;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const errors: { field: string; message: string }[] = [];

    const email = typeof body.email === "string" ? body.email.trim() : "";
    const rawPhone = typeof body.phone === "string" ? body.phone.trim() : "";
    const phone = rawPhone ? normalizePhone(rawPhone) : "";

    // At least one identifier required
    if (!email && !rawPhone) {
      errors.push({ field: "email", message: "L'email ou le telephone est obligatoire." });
    }

    // Validate email format if provided
    if (email && !EMAIL_REGEX.test(email)) {
      errors.push({ field: "email", message: "L'adresse email n'est pas valide." });
    }

    // Validate phone format if provided
    if (rawPhone && !phone) {
      errors.push({ field: "phone", message: "Le numero de telephone n'est pas valide. Format: 6XX XX XX XX." });
    }

    // Validate name
    if (!body.name || typeof body.name !== "string" || body.name.trim() === "") {
      errors.push({ field: "name", message: "Le nom est obligatoire." });
    }

    // Validate password
    if (!body.password || typeof body.password !== "string") {
      errors.push({ field: "password", message: "Le mot de passe est obligatoire." });
    } else if (body.password.length < PASSWORD_MIN_LENGTH) {
      errors.push({
        field: "password",
        message: `Le mot de passe doit contenir au moins ${PASSWORD_MIN_LENGTH} caracteres.`,
      });
    }

    if (errors.length > 0) {
      return apiError(400, "Erreurs de validation", { errors });
    }

    const name = body.name.trim();

    // Check if email already exists
    if (email) {
      const existingByEmail = await getUserByEmail(email);
      if (existingByEmail) {
        return NextResponse.json(
          { success: false, error: "Cette adresse email est deja utilisee.", errorKey: ErrorKeys.CONFLICT_EMAIL_ALREADY_USED } satisfies AuthResponse,
          { status: 409 }
        );
      }
    }

    // Check if phone already exists
    if (phone) {
      const existingByPhone = await getUserByPhone(phone);
      if (existingByPhone) {
        return NextResponse.json(
          { success: false, error: "Ce numero de telephone est deja utilise.", errorKey: ErrorKeys.CONFLICT_PHONE_ALREADY_USED } satisfies AuthResponse,
          { status: 409 }
        );
      }
    }

    // Create user
    const passwordHash = await hashPassword(body.password);
    const user = await createUser({
      ...(email && { email }),
      ...(phone && { phone }),
      name,
      passwordHash,
    });

    // Auto-login after registration
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

    const response = NextResponse.json(responseBody, { status: 201 });
    setSessionCookie(response, sessionToken, expires);
    return response;
  } catch {
    return NextResponse.json(
      { success: false, error: "Erreur serveur lors de l'inscription.", errorKey: ErrorKeys.SERVER_REGISTER } satisfies AuthResponse,
      { status: 500 }
    );
  }
}
