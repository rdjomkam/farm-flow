"use client";

import { useState, useCallback } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "./sidebar";
import { BottomNav } from "./bottom-nav";
import { HamburgerMenu } from "./hamburger-menu";
import { FarmSidebar } from "./farm-sidebar";
import { FarmBottomNav } from "./farm-bottom-nav";
import { IngenieurSidebar } from "./ingenieur-sidebar";
import { IngenieurBottomNav } from "./ingenieur-bottom-nav";
import { MobileMenuContext } from "./mobile-menu-context";
import type { Permission, Role, SiteModule } from "@/types";
import { Role as RoleEnum } from "@/types";

const AUTH_ROUTES = ["/login", "/register"];
const NO_NAV_ROUTES = ["/select-site"];
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
  const [menuOpen, setMenuOpen] = useState(false);

  const openMenu = useCallback(() => setMenuOpen(true), []);

  if (isAuthPage || isNoNavPage || isBackofficePage) {
    return <>{children}</>;
  }

  // -------------------------------------------------------------------------
  // Ingénieur layout — role-specific navigation
  // -------------------------------------------------------------------------
  if (role === RoleEnum.INGENIEUR) {
    return (
      <MobileMenuContext.Provider value={{ openMenu, isImpersonating }}>
        <div className="flex min-h-dvh overflow-x-hidden">
          <IngenieurSidebar
            permissions={permissions}
            siteModules={siteModules}
            role={role}
            userName={userName}
            isSuperAdmin={isSuperAdmin}
          />
          <main className="flex-1 overflow-x-clip max-w-full pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-0">
            {children}
          </main>
        </div>
        <IngenieurBottomNav
          permissions={permissions}
          siteModules={siteModules}
          role={role}
          userName={userName}
          isSuperAdmin={isSuperAdmin}
          activeSiteId={activeSiteId}
        />
      </MobileMenuContext.Provider>
    );
  }

  // -------------------------------------------------------------------------
  // Farm layout — ADMIN, GERANT, PISCICULTEUR
  // -------------------------------------------------------------------------
  if (role !== null && FARM_ROLES.includes(role)) {
    return (
      <MobileMenuContext.Provider value={{ openMenu, isImpersonating }}>
        <div className="flex min-h-dvh overflow-x-hidden">
          <FarmSidebar
            permissions={permissions}
            siteModules={siteModules}
            role={role}
            userName={userName}
            isSuperAdmin={isSuperAdmin}
          />
          <main className="flex-1 overflow-x-clip max-w-full pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-0">
            {children}
          </main>
        </div>
        <FarmBottomNav
          permissions={permissions}
          siteModules={siteModules}
          role={role}
          userName={userName}
          isSuperAdmin={isSuperAdmin}
        />
      </MobileMenuContext.Provider>
    );
  }

  // -------------------------------------------------------------------------
  // Fallback — generic navigation for unauthenticated or unknown roles
  // -------------------------------------------------------------------------
  return (
    <MobileMenuContext.Provider value={{ openMenu, isImpersonating }}>
      <div className="flex min-h-dvh overflow-x-hidden">
        <Sidebar permissions={permissions} role={role} siteModules={siteModules} isSuperAdmin={isSuperAdmin} />
        <main className="flex-1 overflow-x-clip max-w-full pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-0">{children}</main>
      </div>
      <HamburgerMenu
        open={menuOpen}
        onOpenChange={setMenuOpen}
        permissions={permissions}
        role={role}
        userName={userName}
        siteModules={siteModules}
        isSuperAdmin={isSuperAdmin}
      />
      <BottomNav permissions={permissions} role={role} siteModules={siteModules} />
    </MobileMenuContext.Provider>
  );
}
