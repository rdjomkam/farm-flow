import { NextRequest, NextResponse } from "next/server";
import { requireAuth, AuthError, SESSION_COOKIE_NAME } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { locales, type Locale } from "@/i18n/config";
import { apiError } from "@/lib/api-utils";

/**
 * PUT /api/locale
 * Change the locale preference for the current user's session.
 *
 * Body: { locale: "fr" | "en" }
 *
 * - Auth required
 * - Validates locale against the allowed list from src/i18n/config.ts
 * - Updates session.locale in DB
 * - Sets NEXT_LOCALE cookie for next-intl detection
 * - Returns { locale }
 */
export async function PUT(request: NextRequest) {
  try {
    await requireAuth(request);

    const body = await request.json();
    const { locale } = body as { locale?: unknown };

    // Validate locale
    if (!locale || typeof locale !== "string" || !locales.includes(locale as Locale)) {
      return apiError(400, `La locale doit etre l'une des valeurs suivantes : ${locales.join(", ")}.`);
    }

    const validLocale = locale as Locale;

    // Update session.locale in DB using the session token (R4: updateMany is atomic)
    const sessionToken = request.cookies.get(SESSION_COOKIE_NAME)?.value;
    if (sessionToken) {
      await prisma.session.updateMany({
        where: { sessionToken },
        data: { locale: validLocale },
      });
    }

    // Set NEXT_LOCALE cookie so next-intl can detect the preference on the next request
    const response = NextResponse.json({ success: true, locale: validLocale });
    response.cookies.set("NEXT_LOCALE", validLocale, {
      httpOnly: false, // Must be readable by next-intl middleware / server
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 365 * 24 * 60 * 60, // 1 year
    });

    return response;
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { success: false, error: "Erreur serveur lors du changement de locale." },
      { status: 500 }
    );
  }
}
