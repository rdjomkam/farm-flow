"use client";

import { useState, useCallback } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "./sidebar";
import { BottomNav } from "./bottom-nav";
import { HamburgerMenu } from "./hamburger-menu";
import { MobileMenuContext } from "./mobile-menu-context";
import type { Permission, Role, SiteModule } from "@/types";

const AUTH_ROUTES = ["/login", "/register"];
const NO_NAV_ROUTES = ["/select-site"];

export function AppShell({
  children,
  permissions,
  role,
  userName,
  siteModules,
}: {
  children: React.ReactNode;
  permissions: Permission[];
  role: Role | null;
  userName: string | null;
  siteModules: SiteModule[];
}) {
  const pathname = usePathname();
  const isAuthPage = AUTH_ROUTES.includes(pathname);
  const isNoNavPage = NO_NAV_ROUTES.includes(pathname);
  const [menuOpen, setMenuOpen] = useState(false);

  const openMenu = useCallback(() => setMenuOpen(true), []);

  if (isAuthPage || isNoNavPage) {
    return <>{children}</>;
  }

  return (
    <MobileMenuContext.Provider value={{ openMenu }}>
      <div className="flex min-h-dvh">
        <Sidebar permissions={permissions} role={role} siteModules={siteModules} />
        <main className="flex-1 overflow-x-hidden pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-0">{children}</main>
      </div>
      <HamburgerMenu
        open={menuOpen}
        onOpenChange={setMenuOpen}
        permissions={permissions}
        role={role}
        userName={userName}
        siteModules={siteModules}
      />
      <BottomNav permissions={permissions} role={role} siteModules={siteModules} />
    </MobileMenuContext.Provider>
  );
}
