"use client";

import { useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
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
import { SilureLogo } from "@/components/ui/silure-logo";

interface NavItem {
  href: string;
  labelKey: string;
  icon: React.ComponentType<{ className?: string }>;
  disabled?: boolean;
}

interface NavGroup {
  labelKey: string;
  items: NavItem[];
  permissionRequired?: Permission;
  permissionsAny?: Permission[];
  moduleRequired?: SiteModule;
}

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
  const t = useTranslations("navigation");

  const NAV_GROUPS: NavGroup[] = useMemo(() => [
    // 1. MONITORING — shown only if user has MONITORING_CLIENTS permission
    {
      labelKey: "groups.monitoring",
      items: [
        { href: "/monitoring", labelKey: "items.dashboardClients", icon: Eye },
        { href: "/notes", labelKey: "items.notes", icon: NotebookPen },
      ],
      permissionRequired: Permission.MONITORING_CLIENTS,
    },
    // 2. OPÉRATIONS — always visible for INGENIEUR; individual items gated by ITEM_VIEW_PERMISSIONS
    {
      labelKey: "groups.operations",
      items: [
        { href: "/", labelKey: "items.dashboard", icon: LayoutDashboard },
        { href: "/mes-taches", labelKey: "items.taches", icon: CheckSquare },
        { href: "/vagues", labelKey: "items.vagues", icon: Waves },
        { href: "/bacs", labelKey: "items.bacs", icon: Container },
        { href: "/releves", labelKey: "items.releves", icon: NotebookPen },
        { href: "/stock", labelKey: "items.vueStock", icon: Package },
        { href: "/stock/produits", labelKey: "items.produits", icon: Tag },
        { href: "/stock/mouvements", labelKey: "items.mouvements", icon: ArrowUpDown },
        { href: "/stock/fournisseurs", labelKey: "items.fournisseurs", icon: Truck },
        { href: "/stock/commandes", labelKey: "items.commandes", icon: ShoppingCart },
        { href: "/planning", labelKey: "items.planning", icon: Calendar },
        { href: "/analytics", labelKey: "items.analyse", icon: BarChart3 },
      ],
    },
    // 3. COMMERCIAL — shown if user has ACTIVER_PACKS OR PORTEFEUILLE_VOIR
    {
      labelKey: "groups.commercial",
      items: [
        { href: "/packs", labelKey: "items.packs", icon: Boxes },
        { href: "/activations", labelKey: "items.activationsItem", icon: PackageCheck },
        { href: "/mon-portefeuille", labelKey: "items.monPortefeuille", icon: Wallet },
      ],
      permissionsAny: [Permission.ACTIVER_PACKS, Permission.PORTEFEUILLE_VOIR],
    },
    // 4. CONFIGURATION — always shown; individual items gated by ITEM_VIEW_PERMISSIONS
    {
      labelKey: "groups.configuration",
      items: [
        { href: "/settings/alertes", labelKey: "items.alertes", icon: BellRing },
        { href: "/settings/config-elevage", labelKey: "items.configElevage", icon: Settings },
        { href: "/settings/regles-activites", labelKey: "items.reglesActivites", icon: Zap },
      ],
    },
  ], []);

  const visibleGroups = useMemo(() => {
    return NAV_GROUPS.map((group) => {
      if (group.permissionRequired && !permissions.includes(group.permissionRequired)) {
        return null;
      }
      if (group.permissionsAny && !group.permissionsAny.some((p) => permissions.includes(p))) {
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
  }, [NAV_GROUPS, permissions, siteModules]);

  const allHrefs = useMemo(
    () => visibleGroups.flatMap((g) => g.items.map((i) => i.href)),
    [visibleGroups]
  );

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    if (pathname === href) return true;
    if (!pathname.startsWith(href + "/")) return false;
    return !allHrefs.some(
      (other) =>
        other !== href &&
        other.startsWith(href + "/") &&
        (pathname === other || pathname.startsWith(other + "/"))
    );
  }

  return (
    <aside className="hidden md:flex md:w-60 md:flex-col md:border-r md:border-border md:bg-card">
      {/* Logo header */}
      <div className="flex h-14 items-center gap-2 border-b border-border px-4 shrink-0">
        <SilureLogo size={24} className="text-primary" />
        <span className="text-lg font-bold">FarmFlow</span>
        <div className="ml-auto">
          <NotificationBell />
        </div>
      </div>

      {/* Navigation groups */}
      <nav className="flex flex-1 flex-col overflow-y-auto p-2 gap-4">
        {visibleGroups.map((group) => (
          <div key={group.labelKey}>
            <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {t(group.labelKey as Parameters<typeof t>[0])}
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
                      {t(item.labelKey as Parameters<typeof t>[0])}
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
                    {t(item.labelKey as Parameters<typeof t>[0])}
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
              {t("groups.superAdmin")}
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
              {t("items.backoffice")}
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
