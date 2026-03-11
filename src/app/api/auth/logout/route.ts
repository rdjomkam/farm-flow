import { NextRequest, NextResponse } from "next/server";
import { deleteSession, clearSessionCookie, SESSION_COOKIE_NAME } from "@/lib/auth";
import type { AuthResponse } from "@/types";

export async function POST(request: NextRequest) {
  try {
    const sessionToken = request.cookies.get(SESSION_COOKIE_NAME)?.value;

    if (sessionToken) {
      await deleteSession(sessionToken);
    }

    const response = NextResponse.json({
      success: true,
    } satisfies AuthResponse);
    clearSessionCookie(response);
    return response;
  } catch {
    return NextResponse.json(
      { success: false, error: "Erreur serveur lors de la deconnexion." } satisfies AuthResponse,
      { status: 500 }
    );
  }
}
