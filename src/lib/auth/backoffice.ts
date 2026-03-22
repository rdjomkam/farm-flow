/**
 * Backoffice authentication helpers (ADR-022).
 *
 * Provides two functions to enforce super-admin access:
 * - requireSuperAdmin()  — for API routes (throws on failure)
 * - checkBackofficeAccess() — for Server Components (returns null on failure)
 *
 * The isSuperAdmin check ALWAYS reads from the DB (not from the session cookie)
 * to prevent privilege escalation through tampered cookies.
 */

import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getSession, getServerSession, AuthError } from "./session";
import { ForbiddenError } from "@/lib/permissions";
import type { BackofficeSession } from "@/types";

// ---------------------------------------------------------------------------
// Internal helper — build BackofficeSession from a verified DB user record
// ---------------------------------------------------------------------------

interface SuperAdminRow {
  id: string;
  email: string | null;
  phone: string | null;
  name: string;
  isSuperAdmin: boolean;
}

function buildBackofficeSession(userId: string, user: SuperAdminRow): BackofficeSession {
  return {
    userId,
    email: user.email,
    phone: user.phone,
    name: user.name,
    isSuperAdmin: true,
  };
}

// ---------------------------------------------------------------------------
// requireSuperAdmin — for API route handlers
// Throws AuthError (401) or ForbiddenError (403) on failure.
// ---------------------------------------------------------------------------

export async function requireSuperAdmin(request: NextRequest): Promise<BackofficeSession> {
  // 1. Validate session from the request cookie
  const session = await getSession(request);
  if (!session) {
    throw new AuthError("Non authentifie. Veuillez vous connecter.");
  }

  // 2. Load isSuperAdmin from DB — never trust the session cookie for this
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      id: true,
      email: true,
      phone: true,
      name: true,
      isSuperAdmin: true,
    },
  });

  if (!user) {
    throw new AuthError("Utilisateur introuvable.");
  }

  // 3. Enforce super-admin check
  if (!user.isSuperAdmin) {
    throw new ForbiddenError("Acces refuse. Droits super-administrateur requis.");
  }

  return buildBackofficeSession(session.userId, user);
}

// ---------------------------------------------------------------------------
// checkBackofficeAccess — for Server Components
// Returns null instead of throwing so pages can redirect gracefully.
// ---------------------------------------------------------------------------

export async function checkBackofficeAccess(): Promise<BackofficeSession | null> {
  // 1. Validate session from server cookies
  const session = await getServerSession();
  if (!session) {
    return null;
  }

  // 2. Load isSuperAdmin from DB
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      id: true,
      email: true,
      phone: true,
      name: true,
      isSuperAdmin: true,
    },
  });

  if (!user || !user.isSuperAdmin) {
    return null;
  }

  return buildBackofficeSession(session.userId, user);
}
