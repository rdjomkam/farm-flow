"use client";

import { useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Waves,
  Container,
  NotebookPen,
  Eye,
  Package,
  Tag,
  ArrowUpDown,
  Boxes,
  PackageCheck,
  Wallet,
  Calendar,
  BarChart3,
  Fish,
  Shield,
  CheckSquare,
  Truck,
  ShoppingCart,
  BellRing,
  Settings,
  Zap,
} from "lucide-react";
import { NotificationBell } from "./notification-bell";
import { LanguageSwitcher } from "./language-switcher";
import { cn } from "@/lib/utils";
import { Permission, Role, SiteModule } from "@/types";
import { ITEM_VIEW_PERMISSIONS } from "@/lib/permissions-constants";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  disabled?: boolean;
}

interface NavGroup {
  label: string;
  items: NavItem[];
  permissionRequired?: Permission;
  moduleRequired?: SiteModule;
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Opérations",
    items: [
      { href: "/", label: "Dashboard", icon: LayoutDashboard },
      { href: "/mes-taches", label: "Tâches", icon: CheckSquare },
      { href: "/vagues", label: "Vagues", icon: Waves },
      { href: "/bacs", label: "Bacs", icon: Container },
      { href: "/releves", label: "Relevés", icon: NotebookPen },
    ],
    permissionRequired: Permission.DASHBOARD_VOIR,
  },
  {
    label: "Monitoring",
    items: [
      { href: "/monitoring", label: "Clients supervisés", icon: Eye },
      { href: "/notes", label: "Notes", icon: NotebookPen },
    ],
    permissionRequired: Permission.MONITORING_CLIENTS,
  },
  {
    label: "Stock",
    items: [
      { href: "/stock", label: "Vue stock", icon: Package },
      { href: "/stock/produits", label: "Produits", icon: Tag },
      { href: "/stock/mouvements", label: "Mouvements", icon: ArrowUpDown },
      { href: "/stock/fournisseurs", label: "Fournisseurs", icon: Truck },
      { href: "/stock/commandes", label: "Commandes", icon: ShoppingCart },
    ],
    permissionRequired: Permission.STOCK_VOIR,
    moduleRequired: SiteModule.INTRANTS,
  },
  {
    label: "Commercial",
    items: [
      { href: "/packs", label: "Packs", icon: Boxes },
      { href: "/activations", label: "Activations", icon: PackageCheck },
      { href: "/mon-portefeuille", label: "Portefeuille", icon: Wallet },
    ],
    permissionRequired: Permission.ACTIVER_PACKS,
  },
  {
    label: "Planning & Analytics",
    items: [
      { href: "/planning", label: "Planning", icon: Calendar },
      { href: "/analytics", label: "Analytics", icon: BarChart3 },
    ],
    permissionRequired: Permission.PLANNING_VOIR,
  },
  {
    label: "Configuration",
    items: [
      { href: "/settings/alertes", label: "Alertes", icon: BellRing },
      { href: "/settings/config-elevage", label: "Config élevage", icon: Settings },
      { href: "/settings/regles-activites", label: "Règles activités", icon: Zap },
    ],
  },
];

interface IngenieurSidebarProps {
  permissions: Permission[];
  siteModules: SiteModule[];
  role: Role;
  userName: string | null;
  isSuperAdmin: boolean;
}

export function IngenieurSidebar({
  permissions,
  siteModules,
  role,
  userName,
  isSuperAdmin,
}: IngenieurSidebarProps) {
  const pathname = usePathname();

  const visibleGroups = useMemo(() => {
    return NAV_GROUPS.map((group) => {
      if (group.permissionRequired && !permissions.includes(group.permissionRequired)) {
        return null;
      }
      if (group.moduleRequired && !siteModules.includes(group.moduleRequired)) {
        return null;
      }

      const visibleItems = group.items.filter((item) => {
        const required = ITEM_VIEW_PERMISSIONS[item.href];
        return !required || permissions.includes(required);
      });

      if (visibleItems.length === 0) return null;
      return { ...group, items: visibleItems };
    }).filter(Boolean) as (NavGroup & { items: NavItem[] })[];
  }, [permissions, siteModules]);

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    if (
      href === "/stock" ||
      href === "/alevins" ||
      href === "/analytics" ||
      href === "/planning" ||
      href === "/finances" ||
      href === "/mes-taches" ||
      href === "/ventes" ||
      href === "/monitoring" ||
      href === "/packs" ||
      href === "/activations" ||
      href === "/notes"
    ) {
      return pathname === href || pathname.startsWith(href + "/");
    }
    return pathname.startsWith(href);
  }

  return (
    <aside className="hidden md:flex md:w-60 md:flex-col md:border-r md:border-border md:bg-card">
      {/* Logo header */}
      <div className="flex h-14 items-center gap-2 border-b border-border px-4 shrink-0">
        <Fish className="h-6 w-6 text-primary" />
        <span className="text-lg font-bold">FarmFlow</span>
        <div className="ml-auto">
          <NotificationBell />
        </div>
      </div>

      {/* Navigation groups */}
      <nav className="flex flex-1 flex-col overflow-y-auto p-2 gap-4">
        {visibleGroups.map((group) => (
          <div key={group.label}>
            <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {group.label}
            </p>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.href);
                if (item.disabled) {
                  return (
                    <span
                      key={item.href}
                      className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground/40 cursor-not-allowed"
                    >
                      <Icon className="h-4 w-4" />
                      {item.label}
                    </span>
                  );
                }
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                      active
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}

        {/* Backoffice link — super admin only (ADR-022) */}
        {isSuperAdmin && (
          <div>
            <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Super Admin
            </p>
            <Link
              href="/backoffice"
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                pathname.startsWith("/backoffice")
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Shield className="h-4 w-4" />
              Backoffice
            </Link>
          </div>
        )}
      </nav>

      {/* Language switcher pinned at bottom */}
      <div className="border-t border-border p-2 flex justify-end shrink-0">
        <LanguageSwitcher />
      </div>
    </aside>
  );
}
