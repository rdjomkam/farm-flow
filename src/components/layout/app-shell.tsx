"use client";

import { usePathname } from "next/navigation";
import { Sidebar } from "./sidebar";
import { BottomNav } from "./bottom-nav";
import type { Permission, Role } from "@/types";

const AUTH_ROUTES = ["/login", "/register"];
const NO_NAV_ROUTES = ["/select-site"];

export function AppShell({ children, permissions, role }: { children: React.ReactNode; permissions: Permission[]; role: Role | null }) {
  const pathname = usePathname();
  const isAuthPage = AUTH_ROUTES.includes(pathname);
  const isNoNavPage = NO_NAV_ROUTES.includes(pathname);

  if (isAuthPage || isNoNavPage) {
    return <>{children}</>;
  }

  return (
    <>
      <div className="flex min-h-dvh">
        <Sidebar permissions={permissions} role={role} />
        <main className="flex-1 overflow-x-hidden pb-16 md:pb-0">{children}</main>
      </div>
      <BottomNav permissions={permissions} role={role} />
    </>
  );
}
