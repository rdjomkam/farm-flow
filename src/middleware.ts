import { NextRequest, NextResponse } from "next/server";

const SESSION_COOKIE = "session_token";

/** Routes that don't require authentication */
const PUBLIC_ROUTES = ["/login", "/register"];
const PUBLIC_API_PREFIX = "/api/auth/";

/** Routes accessible without an active site selected */
const NO_SITE_ROUTES = ["/sites", "/select-site"];
const NO_SITE_API_PREFIXES = ["/api/sites", "/api/auth/"];

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

export function middleware(request: NextRequest) {
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

  // Session cookie exists — pass through
  // Note: activeSiteId is stored in the Session DB table (not in a cookie).
  // The middleware cannot enforce site selection (Edge runtime, no DB access).
  // Site membership and active site checks happen in:
  // - requirePermission() for API routes requiring site context
  // - getServerSession() + redirect("/sites") for server component pages
  // Routes in NO_SITE_ROUTES/NO_SITE_API_PREFIXES work without active site.
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
