/**
 * src/proxy.ts
 *
 * Middleware Next.js (Edge Runtime) — proxy.ts utilisé par Next.js 16+ / Turbopack.
 *
 * Responsabilités :
 *   1. Vérifier si l'utilisateur est authentifié (cookie session_token).
 *      Si non authentifié et route protégée → redirect /login.
 *   2. Pour les utilisateurs authentifiés, vérifier le statut d'abonnement
 *      via le cookie companion `sub_status` (set par /api/auth/site et layout.tsx).
 *      Si statut EXPIRE → redirect /abonnement-expire.
 *      Si statut SUSPENDU → NE PAS rediriger (mode lecture seule géré côté composant).
 *      Si plan DECOUVERTE → pas de restriction.
 *
 * NOTE : Le mode maintenance est vérifié dans src/app/layout.tsx (Server Component,
 * Node.js runtime, accès Prisma direct). Le middleware reste léger (Edge Runtime).
 *
 * Story 36.3 — Sprint 36
 * Story IA.1 — Redirection par rôle (INGENIEUR vs farm)
 */
import { NextRequest, NextResponse } from "next/server";
import { Role } from "@/types";

const SESSION_COOKIE = "session_token";
const ROLE_COOKIE = "user_role";
const IS_SUPER_ADMIN_COOKIE = "is_super_admin";

/** Page d'accueil de l'espace ingénieur */
const INGENIEUR_HOME = "/monitoring";

/**
 * Routes réservées à l'espace ingénieur.
 * Un non-ingénieur qui tente d'y accéder est redirigé vers l'accueil farm.
 * Note : /packs, /activations, /mes-taches sont partagés — l'accès est contrôlé par
 * les permissions de page (checkPagePermission), pas par le middleware.
 */
const INGENIEUR_ONLY_PREFIXES = [
  "/monitoring",
  "/mon-portefeuille",
  "/settings/regles-activites",
];

/**
 * Routes réservées aux rôles farm (ADMIN, GERANT, PISCICULTEUR).
 * Un ingénieur qui tente d'y accéder est redirigé vers l'accueil ingénieur.
 * SuperAdmin peut toujours accéder à ces routes.
 */
const FARM_ONLY_PREFIXES = [
  "/alevins",
  "/reproduction",
  "/depenses",
  "/finances",
  "/factures",
  "/clients",
  "/ventes",
  "/besoins",
];

/** Rôles autorisés sur les routes FARM_ONLY */
const FARM_ROLES = [Role.ADMIN, Role.GERANT, Role.PISCICULTEUR];

/** Routes that don't require authentication */
const PUBLIC_ROUTES = ["/login", "/register"];
const PUBLIC_API_PREFIX = "/api/auth/";
const PUBLIC_API_ROUTES = [
  "/api/health",
  "/api/activites/generer",
  "/api/cron/subscription-lifecycle",
  "/api/depenses/backfill",
];

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
  "/backoffice",
];

function isPublicRoute(pathname: string): boolean {
  if (PUBLIC_ROUTES.includes(pathname)) return true;
  if (pathname.startsWith(PUBLIC_API_PREFIX)) return true;
  if (PUBLIC_API_ROUTES.includes(pathname)) return true;
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
/** API routes whitelisted from subscription checks (auth, subscription management, public) */
const SUBSCRIPTION_WHITELIST_API_PREFIXES = [
  "/api/auth/",
  "/api/abonnements/",
  "/api/health",
  "/api/sites",
  "/api/cron/",
  "/api/activites/generer",
  "/api/backoffice/",
];

function isSubscriptionWhitelisted(pathname: string): boolean {
  // Only specific API routes are whitelisted — most API routes ARE subscription-gated
  if (pathname.startsWith("/api/")) {
    return SUBSCRIPTION_WHITELIST_API_PREFIXES.some(
      (prefix) => pathname === prefix || pathname.startsWith(prefix)
    );
  }
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
    const res = NextResponse.next();
    res.headers.set("x-pathname", pathname);
    return res;
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

  // Session cookie exists — vérifier le rôle pour les pages (pas les API)
  if (!pathname.startsWith("/api/") && !pathname.startsWith("/backoffice")) {
    const userRole = request.cookies.get(ROLE_COOKIE)?.value ?? "";
    const isSuperAdmin =
      request.cookies.get(IS_SUPER_ADMIN_COOKIE)?.value === "true";
    const isIngenieur = userRole === Role.INGENIEUR;

    // Guard E11 : session existe mais rôle absent (cookie corrompu/manquant)
    if (!userRole && !isSuperAdmin) {
      const loginUrl = new URL("/login", request.url);
      return NextResponse.redirect(loginUrl);
    }

    const isOnIngenieurOnlyPath = INGENIEUR_ONLY_PREFIXES.some(
      (prefix) => pathname === prefix || pathname.startsWith(prefix + "/")
    );

    const isOnFarmOnlyPath = FARM_ONLY_PREFIXES.some(
      (prefix) => pathname === prefix || pathname.startsWith(prefix + "/")
    );

    if (isIngenieur && pathname === "/") {
      // Un ingénieur accède à la racine → rediriger vers son espace monitoring
      return NextResponse.redirect(new URL(INGENIEUR_HOME, request.url));
    }

    if (!isIngenieur && isOnIngenieurOnlyPath && !isSuperAdmin) {
      // Un non-ingénieur tente d'accéder aux routes ingénieur → rediriger vers l'accueil farm
      return NextResponse.redirect(new URL("/", request.url));
    }

    if (isOnFarmOnlyPath && !FARM_ROLES.includes(userRole as Role) && !isSuperAdmin) {
      // Un ingénieur (ou rôle inconnu) tente d'accéder aux routes farm → rediriger vers l'accueil ingénieur
      return NextResponse.redirect(new URL(INGENIEUR_HOME, request.url));
    }
  }

  // Session cookie exists — vérifier le statut d'abonnement pour les routes concernées
  // Note: activeSiteId is stored in the Session DB table (not in a cookie).
  // The middleware cannot enforce site selection (Edge runtime, no DB access).
  // Site membership and active site checks happen in:
  // - requirePermission() for API routes requiring site context
  // - getServerSession() + redirect("/settings/sites") for server component pages
  // Routes in NO_SITE_ROUTES/NO_SITE_API_PREFIXES work without active site.

  // Vérification d'abonnement — uniquement pour les routes non whitelistées
  const shouldCheckSubscription = !isSubscriptionWhitelisted(pathname) && !isNoSiteRoute(pathname);

  if (shouldCheckSubscription) {
    const subCookie = request.cookies.get("sub_status")?.value;
    if (subCookie) {
      try {
        const data = JSON.parse(subCookie) as {
          statut: string | null;
          isDecouverte: boolean;
          isBlocked: boolean;
        };
        if (!data.isDecouverte && data.isBlocked) {
          // API routes → 403 JSON response
          if (pathname.startsWith("/api/")) {
            return NextResponse.json(
              {
                status: 403,
                message: "Abonnement inactif. Veuillez renouveler votre abonnement.",
                code: "SUBSCRIPTION_BLOCKED",
              },
              { status: 403 }
            );
          }
          // Pages → redirect to /abonnement-expire
          return NextResponse.redirect(new URL("/abonnement-expire", request.url));
        }
      } catch {
        // Malformed cookie — fail open
      }
    }
    // No cookie = fail open (same as before)
  }

  // Transmettre le pathname aux Server Components via un header de requête.
  // Utilisé dans src/app/layout.tsx pour le check de maintenance mode.
  const response = NextResponse.next();
  response.headers.set("x-pathname", pathname);
  return response;
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
    "/((?!_next/static|_next/image|favicon\\.ico|.*\\.png$|.*\\.svg$|manifest\\.json|sw\\.js|swe-worker.*\\.js).*)",
  ],
};
