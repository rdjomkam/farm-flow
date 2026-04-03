"use client";

import { useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  LayoutDashboard,
  Waves,
  Container,
  BarChart3,
  LineChart,
  Package,
  Tag,
  Truck,
  ShoppingCart,
  ArrowUpDown,
  ClipboardList,
  Wallet,
  Banknote,
  FileText,
  Receipt,
  Users,
  UserRound,
  Egg,
  Fish,
  Layers,
  Calendar,
  ClipboardCheck,
  CreditCard,
  Building2,
  BellRing,
  Shield,
  Boxes,
  PackageCheck,
  NotebookPen,
  Eye,
} from "lucide-react";
import { NotificationBell } from "./notification-bell";
import { LanguageSwitcher } from "./language-switcher";
import { cn } from "@/lib/utils";
import { Permission, Role, SiteModule } from "@/types";
import { ITEM_VIEW_PERMISSIONS } from "@/lib/permissions-constants";

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
  moduleRequired?: SiteModule;
}

interface FarmSidebarProps {
  permissions: Permission[];
  siteModules: SiteModule[];
  role: Role;
  userName: string | null;
  isSuperAdmin: boolean;
}

export function FarmSidebar({
  permissions,
  siteModules,
  role,
  userName,
  isSuperAdmin,
}: FarmSidebarProps) {
  const pathname = usePathname();
  const t = useTranslations("navigation");

  const NAV_GROUPS: NavGroup[] = useMemo(() => [
    {
      labelKey: "groups.elevage",
      items: [
        { href: "/", labelKey: "items.dashboard", icon: LayoutDashboard },
        { href: "/vagues", labelKey: "items.vagues", icon: Waves },
        { href: "/bacs", labelKey: "items.bacs", icon: Container },
        { href: "/releves", labelKey: "items.releves", icon: NotebookPen },
        { href: "/observations", labelKey: "items.observations", icon: Eye },
      ],
      permissionRequired: Permission.VAGUES_VOIR,
      moduleRequired: SiteModule.GROSSISSEMENT,
    },
    {
      labelKey: "items.stock",
      items: [
        { href: "/stock", labelKey: "items.vueStock", icon: Package },
        { href: "/stock/produits", labelKey: "items.produits", icon: Tag },
        { href: "/stock/mouvements", labelKey: "items.mouvements", icon: ArrowUpDown },
        { href: "/stock/fournisseurs", labelKey: "items.fournisseurs", icon: Truck },
        { href: "/stock/commandes", labelKey: "items.commandes", icon: ShoppingCart },
        { href: "/besoins", labelKey: "items.besoins", icon: ClipboardList },
      ],
      permissionRequired: Permission.STOCK_VOIR,
      moduleRequired: SiteModule.INTRANTS,
    },
    {
      labelKey: "items.finances",
      items: [
        { href: "/finances", labelKey: "items.dashboardFinances", icon: Wallet },
        { href: "/ventes", labelKey: "items.ventesItem", icon: Banknote },
        { href: "/factures", labelKey: "items.factures", icon: FileText },
        { href: "/clients", labelKey: "items.clientsItem", icon: UserRound },
        { href: "/depenses", labelKey: "items.depenses", icon: Receipt },
      ],
      permissionRequired: Permission.FINANCES_VOIR,
      moduleRequired: SiteModule.VENTES,
    },
    {
      labelKey: "items.alevins",
      items: [
        { href: "/alevins", labelKey: "items.vueAlevins", icon: Egg },
        { href: "/alevins/reproducteurs", labelKey: "items.reproducteurs", icon: Fish },
        { href: "/alevins/pontes", labelKey: "items.pontes", icon: Egg },
        { href: "/alevins/lots", labelKey: "items.lots", icon: Layers },
      ],
      permissionRequired: Permission.ALEVINS_VOIR,
      moduleRequired: SiteModule.REPRODUCTION,
    },
    {
      labelKey: "groups.planningTasks",
      items: [
        { href: "/planning", labelKey: "items.planning", icon: Calendar },
        { href: "/mes-taches", labelKey: "items.mesTaches", icon: ClipboardCheck },
      ],
      permissionRequired: Permission.PLANNING_VOIR,
    },
    {
      labelKey: "groups.analytics",
      items: [
        { href: "/analytics", labelKey: "items.vueGlobale", icon: BarChart3 },
        { href: "/analytics/vagues", labelKey: "items.vagues", icon: LineChart },
        { href: "/analytics/aliments", labelKey: "items.aliments", icon: BarChart3 },
        { href: "/analytics/bacs", labelKey: "items.bacs", icon: Container },
      ],
      permissionRequired: Permission.DASHBOARD_VOIR,
    },
    {
      labelKey: "groups.administration",
      items: [
        { href: "/settings/sites", labelKey: "items.gestionSites", icon: Building2 },
        { href: "/settings/alertes", labelKey: "items.alertes", icon: BellRing },
        { href: "/settings/config-elevage", labelKey: "items.configElevage", icon: ClipboardCheck },
        { href: "/users", labelKey: "modules.utilisateurs", icon: Users },
      ],
      permissionRequired: Permission.SITE_GERER,
    },
    {
      labelKey: "modules.abonnement",
      items: [
        { href: "/mon-abonnement", labelKey: "items.monAbonnement", icon: CreditCard },
        { href: "/packs", labelKey: "items.packs", icon: Boxes },
        { href: "/activations", labelKey: "items.activations", icon: PackageCheck },
      ],
      permissionRequired: Permission.ABONNEMENTS_VOIR,
    },
  ], []);

  const visibleGroups = useMemo(() => {
    return NAV_GROUPS.map((group) => {
      // Gate by group permission
      if (group.permissionRequired && !permissions.includes(group.permissionRequired)) {
        return null;
      }
      // Gate by site module
      if (group.moduleRequired && !siteModules.includes(group.moduleRequired)) {
        return null;
      }

      // Filter items by individual permissions
      const visibleItems = group.items.filter((item) => {
        const required = ITEM_VIEW_PERMISSIONS[item.href];
        return !required || permissions.includes(required);
      });

      if (visibleItems.length === 0) return null;
      return { ...group, items: visibleItems };
    }).filter(Boolean) as (NavGroup & { items: NavItem[] })[];
  }, [NAV_GROUPS, permissions, siteModules]);

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
      href === "/factures" ||
      href === "/clients" ||
      href === "/users" ||
      href === "/packs" ||
      href === "/activations" ||
      href === "/mon-abonnement" ||
      href === "/observations"
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
        {visibleGroups.map((group) => {
          // E5: if only 1 visible item, render without group header
          const showHeader = group.items.length > 1;
          return (
            <div key={group.labelKey}>
              {showHeader && (
                <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {t(group.labelKey as Parameters<typeof t>[0])}
                </p>
              )}
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
          );
        })}

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
