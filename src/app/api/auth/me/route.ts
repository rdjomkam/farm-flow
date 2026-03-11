import { NextRequest, NextResponse } from "next/server";
import { requireAuth, AuthError } from "@/lib/auth";
import { getSiteMember } from "@/lib/queries/sites";
import { Permission, Role } from "@/types";
import type { AuthResponse } from "@/types";

export async function GET(request: NextRequest) {
  try {
    const userSession = await requireAuth(request);

    let permissions: Permission[] = [];
    if (userSession.activeSiteId) {
      if (userSession.role === Role.ADMIN) {
        permissions = Object.values(Permission);
      } else {
        const member = await getSiteMember(userSession.activeSiteId, userSession.userId);
        if (member?.siteRole) {
          permissions = member.siteRole.permissions as Permission[];
        }
      }
    }

    return NextResponse.json({
      success: true,
      user: userSession,
      permissions,
    } satisfies AuthResponse);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { success: false, error: error.message } satisfies AuthResponse,
        { status: error.status }
      );
    }

    return NextResponse.json(
      { success: false, error: "Erreur serveur." } satisfies AuthResponse,
      { status: 500 }
    );
  }
}
