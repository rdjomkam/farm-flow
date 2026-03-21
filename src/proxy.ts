/**
 * src/proxy.ts
 *
 * Middleware Next.js (Edge Runtime) — proxy.ts utilisé par Next.js 16+ / Turbopack.
 *
 * Responsabilités :
 *   1. Vérifier si l'utilisateur est authentifié (cookie session_token).
 *      Si non authentifié et route protégée → redirect /login.
 *   2. Pour les utilisateurs authentifiés, vérifier le statut d'abonnement
 *      via l'API interne /api/abonnements/statut-middleware (Node.js runtime).
 *      Si statut EXPIRE → redirect /abonnement-expire.
 *      Si statut SUSPENDU → NE PAS rediriger (mode lecture seule géré côté composant).
 *      Si plan DECOUVERTE → pas de restriction.
 *
 * IMPORTANT : Prisma ne tourne PAS sur Edge Runtime.
 * La vérification d'abonnement se fait via fetch vers l'API interne Node.js.
 *
 * Story 36.3 — Sprint 36
 */
import { NextRequest, NextResponse } from "next/server";
import { StatutAbonnement } from "@/types";

const SESSION_COOKIE = "session_token";

/** Routes that don't require authentication */
const PUBLIC_ROUTES = ["/login", "/register"];
const PUBLIC_API_PREFIX = "/api/auth/";

/** Routes accessible without an active site selected */
const NO_SITE_ROUTES = ["/settings/sites", "/select-site"];
const NO_SITE_API_PREFIXES = ["/api/sites", "/api/auth/"];

/**
 * Routes exclues de la vérification d'abonnement.
 * Même un compte EXPIRE peut accéder à ces routes.
 */
const SUBSCRIPTION_WHITELIST_ROUTES = [
  "/login",
  "/register",
  "/tarifs",
  "/mon-abonnement",
  "/abonnement-expire",
  "/checkout",
];

function isPublicRoute(pathname: string): boolean {
  if (PUBLIC_ROUTES.includes(pathname)) return true;
  if (pathname.startsWith(PUBLIC_API_PREFIX)) return true;
  return false;
}

/** Routes that work without an active site (but still require auth) */
function isNoSiteRoute(pathname: string): boolean {
  if (NO_SITE_ROUTES.includes(pathname)) return true;
  for (const prefix of NO_SITE_API_PREFIXES) {
    if (pathname.startsWith(prefix)) return true;
  }
  return false;
}

/**
 * Vérifie si le pathname est dans la whitelist d'abonnement.
 * Les routes API et les assets sont toujours exclus de la vérification.
 */
function isSubscriptionWhitelisted(pathname: string): boolean {
  // API routes — jamais vérifiées pour l'abonnement
  if (pathname.startsWith("/api/")) return true;
  return SUBSCRIPTION_WHITELIST_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(route + "/")
  );
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Public routes — always pass through
  // Note: we do NOT redirect logged-in users away from /login here because
  // the middleware cannot verify if the session cookie is still valid in DB.
  // An invalid cookie + redirect would cause an infinite loop:
  // /login → / (middleware) → /login (server component) → / ...
  if (isPublicRoute(pathname)) {
    return NextResponse.next();
  }

  // Protected routes — check for session cookie
  const sessionToken = request.cookies.get(SESSION_COOKIE)?.value;

  if (!sessionToken) {
    // API routes → 401 JSON
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { status: 401, message: "Non authentifie. Veuillez vous connecter." },
        { status: 401 }
      );
    }

    // Pages → redirect to /login with return URL
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Session cookie exists — vérifier le statut d'abonnement pour les routes concernées
  // Note: activeSiteId is stored in the Session DB table (not in a cookie).
  // The middleware cannot enforce site selection (Edge runtime, no DB access).
  // Site membership and active site checks happen in:
  // - requirePermission() for API routes requiring site context
  // - getServerSession() + redirect("/settings/sites") for server component pages
  // Routes in NO_SITE_ROUTES/NO_SITE_API_PREFIXES work without active site.

  // Vérification d'abonnement — uniquement pour les routes non whitelistées
  if (!isSubscriptionWhitelisted(pathname) && !isNoSiteRoute(pathname)) {
    try {
      const apiUrl = new URL("/api/abonnements/statut-middleware", request.url);
      const response = await fetch(apiUrl.toString(), {
        method: "GET",
        headers: {
          // Transmettre le cookie de session à l'API interne
          cookie: request.headers.get("cookie") ?? "",
        },
      });

      if (response.ok) {
        const data = (await response.json()) as {
          statut: string | null;
          isDecouverte: boolean;
          planId: string | null;
          isBlocked: boolean;
        };

        // Plan DECOUVERTE → jamais bloqué
        // Statut null → pas d'abonnement enregistré → laisser passer
        if (
          !data.isDecouverte &&
          data.isBlocked &&
          (data.statut === StatutAbonnement.EXPIRE ||
            data.statut === StatutAbonnement.ANNULE)
        ) {
          // Statut EXPIRE ou ANNULE → redirect /abonnement-expire
          const expireUrl = new URL("/abonnement-expire", request.url);
          return NextResponse.redirect(expireUrl);
        }
        // SUSPENDU → NE PAS rediriger (mode lecture seule géré côté composant)
      }
      // En cas d'erreur de l'API → fail open (laisser passer)
    } catch {
      // Fail open : ne pas bloquer l'utilisateur si le check d'abonnement échoue
      // Erreur loguée côté serveur dans la route API
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all routes except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico, icons, manifest
     * - public assets
     */
    "/((?!_next/static|_next/image|favicon\\.ico|.*\\.png$|.*\\.svg$|manifest\\.json).*)",
  ],
};
