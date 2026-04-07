"use client";

import { usePathname } from "next/navigation";
import { FarmSidebar } from "./farm-sidebar";
import { FarmBottomNav } from "./farm-bottom-nav";
import { FarmHeader } from "./farm-header";
import { IngenieurSidebar } from "./ingenieur-sidebar";
import { IngenieurBottomNav } from "./ingenieur-bottom-nav";
import { IngenieurHeader } from "./ingenieur-header";
import { PullToRefresh } from "@/components/pwa/pull-to-refresh";
import type { Permission, Role, SiteModule } from "@/types";
import { Role as RoleEnum } from "@/types";

const AUTH_ROUTES = ["/login", "/register"];
const NO_NAV_ROUTES = ["/select-site", "/maintenance", "/abonnement-expire"];
const BACKOFFICE_PREFIX = "/backoffice";

/** Roles that use the farm-specific navigation */
const FARM_ROLES: Role[] = [RoleEnum.ADMIN, RoleEnum.GERANT, RoleEnum.PISCICULTEUR];

export function AppShell({
  children,
  permissions,
  role,
  userName,
  siteModules,
  isImpersonating = false,
  isSuperAdmin = false,
  activeSiteId = null,
}: {
  children: React.ReactNode;
  permissions: Permission[];
  role: Role | null;
  userName: string | null;
  siteModules: SiteModule[];
  isImpersonating?: boolean;
  isSuperAdmin?: boolean;
  activeSiteId?: string | null;
}) {
  const pathname = usePathname();
  const isAuthPage = AUTH_ROUTES.includes(pathname);
  const isNoNavPage = NO_NAV_ROUTES.includes(pathname);
  const isBackofficePage = pathname.startsWith(BACKOFFICE_PREFIX);

  if (isAuthPage || isNoNavPage || isBackofficePage) {
    return <>{children}</>;
  }

  // -------------------------------------------------------------------------
  // Ingénieur layout — role-specific navigation
  // -------------------------------------------------------------------------
  if (role === RoleEnum.INGENIEUR) {
    return (
      <>
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[9999] focus:bg-background focus:px-4 focus:py-2 focus:text-sm focus:rounded-md focus:shadow-md focus:outline-none focus:ring-2 focus:ring-ring"
        >
          Aller au contenu principal
        </a>
        <div className="flex min-h-dvh overflow-x-clip">
          <IngenieurSidebar
            permissions={permissions}
            siteModules={siteModules}
            role={role}
            userName={userName}
            isSuperAdmin={isSuperAdmin}
          />
          <div className="flex flex-1 flex-col overflow-x-clip max-w-full">
            <IngenieurHeader />
            <PullToRefresh />
            <main
              id="main-content"
              className="flex-1 pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-0"
            >
              <div className="max-w-7xl mx-auto w-full">{children}</div>
            </main>
          </div>
        </div>
        <IngenieurBottomNav
          permissions={permissions}
          siteModules={siteModules}
          role={role}
          userName={userName}
          isSuperAdmin={isSuperAdmin}
          activeSiteId={activeSiteId}
        />
      </>
    );
  }

  // -------------------------------------------------------------------------
  // Farm layout — ADMIN, GERANT, PISCICULTEUR
  // -------------------------------------------------------------------------
  if (role !== null && FARM_ROLES.includes(role)) {
    return (
      <>
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[9999] focus:bg-background focus:px-4 focus:py-2 focus:text-sm focus:rounded-md focus:shadow-md focus:outline-none focus:ring-2 focus:ring-ring"
        >
          Aller au contenu principal
        </a>
        <div className="flex min-h-dvh overflow-x-clip">
          <FarmSidebar
            permissions={permissions}
            siteModules={siteModules}
            role={role}
            userName={userName}
            isSuperAdmin={isSuperAdmin}
          />
          <div className="flex flex-1 flex-col overflow-x-clip max-w-full">
            <FarmHeader />
            <PullToRefresh />
            <main
              id="main-content"
              className="flex-1 pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-0"
            >
              <div className="max-w-7xl mx-auto w-full">{children}</div>
            </main>
          </div>
        </div>
        <FarmBottomNav
          permissions={permissions}
          siteModules={siteModules}
          role={role}
          userName={userName}
          isSuperAdmin={isSuperAdmin}
        />
      </>
    );
  }

  // -------------------------------------------------------------------------
  // Fallback — unknown or null role (middleware should redirect to /login)
  // -------------------------------------------------------------------------
  return <>{children}</>;
}
