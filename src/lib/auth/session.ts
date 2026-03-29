import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { cache } from "react";
import { prisma } from "@/lib/db";
import type { UserSession } from "@/types";

const COOKIE_NAME = "session_token";
const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const SESSION_MAX_AGE_S = 30 * 24 * 60 * 60; // 30 days in seconds
export const ROLE_COOKIE_NAME = "user_role";

/** Create a new session in DB for the given userId */
export async function createSession(userId: string): Promise<{
  sessionToken: string;
  expires: Date;
}> {
  const sessionToken = crypto.randomUUID();
  const expires = new Date(Date.now() + SESSION_DURATION_MS);

  await prisma.session.create({
    data: { sessionToken, userId, expires },
  });

  return { sessionToken, expires };
}

/** Read the session cookie, validate in DB, return user data or null */
export async function getSession(
  request: NextRequest
): Promise<UserSession | null> {
  const token = request.cookies.get(COOKIE_NAME)?.value;
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { sessionToken: token },
    include: {
      user: true,
      originalUser: true,
    },
  });

  if (!session) return null;

  // Check expiration
  if (session.expires < new Date()) {
    // Clean up expired session
    await prisma.session.delete({ where: { id: session.id } });
    return null;
  }

  // Check user is active
  if (!session.user.isActive) return null;

  return {
    userId: session.user.id,
    email: session.user.email,
    phone: session.user.phone,
    name: session.user.name,
    role: session.user.role as UserSession["role"],
    activeSiteId: session.activeSiteId,
    isImpersonating: session.originalUserId !== null,
    originalUserId: session.originalUserId,
    originalUserName: session.originalUser?.name ?? null,
  };
}

/** Read session from cookies() (for Server Components / Server Actions).
 *  Wrapped with React cache() so it runs at most once per HTTP request. */
export const getServerSession = cache(async (): Promise<UserSession | null> => {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { sessionToken: token },
    include: {
      user: true,
      originalUser: true,
    },
  });

  if (!session) return null;

  if (session.expires < new Date()) {
    await prisma.session.delete({ where: { id: session.id } });
    return null;
  }

  if (!session.user.isActive) return null;

  return {
    userId: session.user.id,
    email: session.user.email,
    phone: session.user.phone,
    name: session.user.name,
    role: session.user.role as UserSession["role"],
    activeSiteId: session.activeSiteId,
    isImpersonating: session.originalUserId !== null,
    originalUserId: session.originalUserId,
    originalUserName: session.originalUser?.name ?? null,
  };
});

/** Get the raw session token from the request cookie */
export function getSessionToken(request: NextRequest): string | null {
  return request.cookies.get(COOKIE_NAME)?.value ?? null;
}

/** Get the raw session token from server cookies() */
export async function getServerSessionToken(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(COOKIE_NAME)?.value ?? null;
}

/** Validate session or throw a 401-style error */
export async function requireAuth(request: NextRequest): Promise<UserSession> {
  const session = await getSession(request);
  if (!session) {
    throw new AuthError("Non authentifie. Veuillez vous connecter.");
  }
  return session;
}

/** Delete a session from DB by its token */
export async function deleteSession(sessionToken: string): Promise<void> {
  await prisma.session.deleteMany({ where: { sessionToken } });
}

/** Set the session cookie on a response */
export function setSessionCookie(
  response: NextResponse,
  sessionToken: string,
  expires: Date
): void {
  response.cookies.set(COOKIE_NAME, sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_S,
    expires,
  });
}

/** Clear the session cookie on a response */
export function clearSessionCookie(response: NextResponse): void {
  response.cookies.set(COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

/**
 * Set a companion non-httpOnly cookie containing the user's role.
 * This allows the Edge middleware to read the role without a DB call.
 * The value is not sensitive (role is not a secret), but it must be
 * consistent with the session. If the session is invalid, the middleware
 * will redirect to /login anyway.
 */
export function setUserRoleCookie(
  response: NextResponse,
  role: string,
  expires: Date
): void {
  response.cookies.set(ROLE_COOKIE_NAME, role, {
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_S,
    expires,
  });
}

/** Clear the user role cookie on a response */
export function clearUserRoleCookie(response: NextResponse): void {
  response.cookies.set(ROLE_COOKIE_NAME, "", {
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

/** Auth error with status code for API route handlers */
export class AuthError extends Error {
  public readonly status = 401;

  constructor(message: string) {
    super(message);
    this.name = "AuthError";
  }
}

/** Cookie name exported for use by middleware */
export const SESSION_COOKIE_NAME = COOKIE_NAME;

/**
 * Cookie name for super-admin flag.
 * Non-httpOnly so the Edge middleware (proxy.ts) can read it.
 * The value is not a secret — the actual privilege check for backoffice routes
 * (requireSuperAdmin) always re-validates against the DB.
 * This cookie is only used for lightweight route-guard redirects in the middleware.
 */
export const IS_SUPER_ADMIN_COOKIE_NAME = "is_super_admin";

/** Set the super-admin companion cookie on a response */
export function setIsSuperAdminCookie(
  response: NextResponse,
  expires: Date
): void {
  response.cookies.set(IS_SUPER_ADMIN_COOKIE_NAME, "true", {
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_S,
    expires,
  });
}

/** Clear the super-admin companion cookie on a response */
export function clearIsSuperAdminCookie(response: NextResponse): void {
  response.cookies.set(IS_SUPER_ADMIN_COOKIE_NAME, "", {
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}
