"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Waves,
  Package,
  ClipboardCheck,
  NotebookPen,
  UserCog,
  BarChart3,
  Users,
  LayoutGrid,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Permission, Role, SiteModule } from "@/types";
import { ITEM_VIEW_PERMISSIONS, MODULE_VIEW_PERMISSIONS, MODULE_LABEL_TO_SITE_MODULE } from "@/lib/permissions-constants";
import { getModuleNavForPath } from "@/lib/module-nav-items";
import { useMobileMenu } from "./mobile-menu-context";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

// Navigation PISCICULTEUR — operations de base terrain
const pisciculteurItems: NavItem[] = [
  { href: "/", label: "Accueil", icon: LayoutDashboard },
  { href: "/analytics", label: "Analyse", icon: BarChart3 },
  { href: "/mes-taches", label: "Mes taches", icon: ClipboardCheck },
  { href: "/notes", label: "Echanges", icon: NotebookPen },
];

// Navigation INGENIEUR — suivi clients et notes
const ingenieurItems: NavItem[] = [
  { href: "/", label: "Accueil", icon: LayoutDashboard },
  { href: "/ingenieur", label: "Clients", icon: Users },
  { href: "/notes", label: "Notes", icon: NotebookPen },
];

// Navigation ADMIN/GERANT — gestion complete
const adminGerantItems: NavItem[] = [
  { href: "/", label: "Accueil", icon: LayoutDashboard },
  { href: "/vagues", label: "Vagues", icon: Waves },
  { href: "/stock", label: "Stock", icon: Package },
  { href: "/ingenieur", label: "Ingenieur", icon: UserCog },
];

function getDefaultItemsByRole(role: Role | null): NavItem[] {
  if (role === Role.PISCICULTEUR) return pisciculteurItems;
  if (role === Role.INGENIEUR) return ingenieurItems;
  return adminGerantItems;
}

export function BottomNav({ permissions, role, siteModules }: { permissions: Permission[]; role: Role | null; siteModules: SiteModule[] }) {
  const pathname = usePathname();
  const { openMenu } = useMobileMenu();
  const showPlusButton = role === Role.ADMIN || role === Role.GERANT;

  // --- Contextual switching: inside a module → show module sub-pages ---
  const moduleConfig = getModuleNavForPath(pathname);

  let navItems: NavItem[];
  let isModuleNav = false;

  if (moduleConfig && moduleConfig.items.length > 1) {
    // Check module-level permission gate
    const modulePermission = MODULE_VIEW_PERMISSIONS[moduleConfig.label];
    // Check site-level module gate
    const siteModule = MODULE_LABEL_TO_SITE_MODULE[moduleConfig.label];
    if ((modulePermission && !permissions.includes(modulePermission)) ||
        (siteModule && !siteModules.includes(siteModule))) {
      // User lacks module permission or module disabled — fall back to default
      navItems = getDefaultItemsByRole(role);
    } else {
      // Filter individual items by permission
      const filtered = moduleConfig.items.filter((item) => {
        const required = ITEM_VIEW_PERMISSIONS[item.href];
        return !required || permissions.includes(required);
      });
      if (filtered.length > 1) {
        navItems = filtered;
        isModuleNav = true;
      } else {
        navItems = getDefaultItemsByRole(role);
      }
    }
  } else {
    navItems = getDefaultItemsByRole(role);
  }

  // --- Permission + site module filtering for default admin/gerant items ---
  if (!isModuleNav && navItems === adminGerantItems) {
    navItems = adminGerantItems.filter((item) => {
      if (item.href === "/") return permissions.includes(Permission.DASHBOARD_VOIR);
      if (item.href === "/vagues") return permissions.includes(Permission.VAGUES_VOIR) && siteModules.includes(SiteModule.GROSSISSEMENT);
      if (item.href === "/stock") return permissions.includes(Permission.STOCK_VOIR) && siteModules.includes(SiteModule.INTRANTS);
      if (item.href === "/ingenieur") return permissions.includes(Permission.MONITORING_CLIENTS) && siteModules.includes(SiteModule.INGENIEUR);
      return true;
    });
  }

  if (navItems.length === 0) return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-card pb-[env(safe-area-inset-bottom)] md:hidden">
      <div className="flex items-center justify-around overflow-x-auto scrollbar-hide">
        {navItems.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex min-h-[56px] flex-col items-center justify-center gap-1 text-xs transition-colors",
                "flex-1 min-w-0",
                isActive
                  ? isModuleNav
                    ? "text-primary border-b-2 border-primary"
                    : "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="h-5 w-5" />
              <span className={isModuleNav ? "text-[11px] whitespace-nowrap" : ""}>{item.label}</span>
            </Link>
          );
        })}
        {!isModuleNav && showPlusButton && (
          <button
            onClick={openMenu}
            className="flex min-h-[56px] flex-1 flex-col items-center justify-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <LayoutGrid className="h-5 w-5" />
            <span>Plus</span>
          </button>
        )}
      </div>
    </nav>
  );
}
