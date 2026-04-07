"use client";

import { useState, useCallback, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  Home,
  CheckSquare,
  Eye,
  Menu,
  NotebookPen,
  Wallet,
  Boxes,
  Package,
  Bell,
  BellRing,
  User,
  LogOut,
  Shield,
  Calendar,
  BarChart3,
  PackageCheck,
  Truck,
  ShoppingCart,
  Settings,
  Zap,
} from "lucide-react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { SilureLogo } from "@/components/ui/silure-logo";
import { Permission, Role, SiteModule } from "@/types";
import { ITEM_VIEW_PERMISSIONS } from "@/lib/permissions-constants";
import { useAuthService } from "@/services";
import { LanguageSwitcher } from "./language-switcher";
import { FabReleve } from "./fab-releve";

interface IngenieurBottomNavProps {
  permissions: Permission[];
  siteModules: SiteModule[];
  role: Role;
  userName: string | null;
  isSuperAdmin: boolean;
  activeSiteId?: string | null;
}

interface SheetNavItem {
  href: string;
  labelKey: string;
  icon: React.ComponentType<{ className?: string }>;
  permissionRequired?: Permission;
}

interface SheetNavGroup {
  /** i18n key under groups.* */
  groupKey: string;
  items: SheetNavItem[];
  /** Gate: group hidden unless user has this permission */
  permissionRequired?: Permission;
  /** Gate: group hidden unless user has at least one of these permissions */
  permissionsAny?: Permission[];
}

// 4 groups aligned with ingenieur-sidebar NAV_GROUPS
const SHEET_GROUPS: SheetNavGroup[] = [
  // 1. MONITORING — gated by MONITORING_CLIENTS
  {
    groupKey: "monitoring",
    permissionRequired: Permission.MONITORING_CLIENTS,
    items: [
      {
        href: "/monitoring",
        labelKey: "items.dashboardClients",
        icon: Eye,
        permissionRequired: Permission.MONITORING_CLIENTS,
      },
      {
        href: "/notes",
        labelKey: "items.notes",
        icon: NotebookPen,
        permissionRequired: Permission.ENVOYER_NOTES,
      },
    ],
  },
  // 2. OPÉRATIONS — always visible; individual items gated by their permissions
  {
    groupKey: "operationsIngenieur",
    items: [
      {
        href: "/stock",
        labelKey: "items.stock",
        icon: Package,
        permissionRequired: Permission.STOCK_VOIR,
      },
      {
        href: "/stock/fournisseurs",
        labelKey: "items.fournisseurs",
        icon: Truck,
        permissionRequired: Permission.APPROVISIONNEMENT_VOIR,
      },
      {
        href: "/stock/commandes",
        labelKey: "items.commandes",
        icon: ShoppingCart,
        permissionRequired: Permission.APPROVISIONNEMENT_GERER,
      },
      {
        href: "/planning",
        labelKey: "items.calendrier",
        icon: Calendar,
        permissionRequired: Permission.PLANNING_VOIR,
      },
      {
        href: "/analytics",
        labelKey: "items.analyse",
        icon: BarChart3,
        permissionRequired: Permission.DASHBOARD_VOIR,
      },
    ],
  },
  // 3. COMMERCIAL — gated by ACTIVER_PACKS OR PORTEFEUILLE_VOIR
  {
    groupKey: "commercial",
    permissionsAny: [Permission.ACTIVER_PACKS, Permission.PORTEFEUILLE_VOIR],
    items: [
      {
        href: "/packs",
        labelKey: "items.packs",
        icon: Boxes,
        permissionRequired: Permission.ACTIVER_PACKS,
      },
      {
        href: "/activations",
        labelKey: "items.activationsItem",
        icon: PackageCheck,
        permissionRequired: Permission.ACTIVER_PACKS,
      },
      {
        href: "/mon-portefeuille",
        labelKey: "items.monPortefeuille",
        icon: Wallet,
        permissionRequired: Permission.PORTEFEUILLE_VOIR,
      },
    ],
  },
  // 4. CONFIGURATION — always visible; individual items gated
  {
    groupKey: "configuration",
    items: [
      {
        href: "/settings/alertes",
        labelKey: "items.alertes",
        icon: BellRing,
        permissionRequired: Permission.ALERTES_CONFIGURER,
      },
      {
        href: "/settings/config-elevage",
        labelKey: "items.profilsElevage",
        icon: Settings,
        permissionRequired: Permission.GERER_CONFIG_ELEVAGE,
      },
      {
        href: "/settings/regles-activites",
        labelKey: "items.reglesActivites",
        icon: Zap,
        permissionRequired: Permission.REGLES_ACTIVITES_VOIR,
      },
    ],
  },
];

const roleKeyMap: Record<Role, string> = {
  ADMIN: "admin",
  GERANT: "gerant",
  PISCICULTEUR: "pisciculteur",
  INGENIEUR: "ingenieur",
};

export function IngenieurBottomNav({
  permissions,
  siteModules,
  role,
  userName,
  isSuperAdmin,
  activeSiteId = null,
}: IngenieurBottomNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const t = useTranslations("navigation");
  const authService = useAuthService();
  const [sheetOpen, setSheetOpen] = useState(false);
  // E12: landscape detection (innerHeight < 500px → side drawer from right)
  const [isLandscape, setIsLandscape] = useState(false);

  useEffect(() => {
    function check() {
      setIsLandscape(window.innerHeight < 500);
    }
    check();
    window.addEventListener("resize", check);
    window.addEventListener("orientationchange", check);
    return () => {
      window.removeEventListener("resize", check);
      window.removeEventListener("orientationchange", check);
    };
  }, []);

  const openSheet = useCallback(() => setSheetOpen(true), []);

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(href + "/");
  }

  function isItemVisible(item: SheetNavItem): boolean {
    if (item.permissionRequired && !permissions.includes(item.permissionRequired))
      return false;
    const itemPerm = ITEM_VIEW_PERMISSIONS[item.href];
    if (itemPerm && !permissions.includes(itemPerm)) return false;
    return true;
  }

  // Filter groups: apply group-level gates, then filter items
  const visibleGroups = SHEET_GROUPS.map((group) => {
    // Check group-level permission gates
    if (
      group.permissionRequired &&
      !permissions.includes(group.permissionRequired)
    )
      return null;
    if (
      group.permissionsAny &&
      !group.permissionsAny.some((p) => permissions.includes(p))
    )
      return null;

    const visibleItems = group.items.filter(isItemVisible);
    if (visibleItems.length === 0) return null;
    return { ...group, items: visibleItems };
  }).filter(Boolean) as (SheetNavGroup & { items: SheetNavItem[] })[];

  const canSeeClients = permissions.includes(Permission.MONITORING_CLIENTS);
  const canSeeTasks = permissions.includes(Permission.DASHBOARD_VOIR);
  const canAddReleve = permissions.includes(Permission.RELEVES_CREER);

  async function handleLogout() {
    await authService.logout();
    router.push("/login");
    router.refresh();
  }

  // E12: landscape → side drawer from right (w-80), portrait → bottom sheet
  const sheetContentClass = isLandscape
    ? "inset-y-0 right-0 left-auto bottom-auto top-0 w-80 h-full max-h-full overflow-y-auto rounded-none border-l border-border border-t-0 border-r-0"
    : "inset-y-auto bottom-0 top-auto left-0 right-0 w-full h-auto max-h-[80vh] overflow-y-auto rounded-t-2xl border-r-0 border-t border-border";

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-card pb-[env(safe-area-inset-bottom)] md:hidden">
        <div className="flex items-end justify-around px-2">
          {/* 1. Accueil */}
          <Link
            href="/"
            className={cn(
              "flex min-h-[56px] flex-1 flex-col items-center justify-center gap-1 text-xs transition-colors pb-1",
              isActive("/") ? "text-primary" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Home className="h-5 w-5" />
            <span>{t("items.accueil")}</span>
          </Link>

          {/* 2. Tâches */}
          {canSeeTasks && (
            <Link
              href="/mes-taches"
              className={cn(
                "flex min-h-[56px] flex-1 flex-col items-center justify-center gap-1 text-xs transition-colors pb-1",
                isActive("/mes-taches")
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <CheckSquare className="h-5 w-5" />
              <span>{t("items.taches")}</span>
            </Link>
          )}

          {/* 3. +Relevé — FAB smart, centered, visually distinct */}
          {canAddReleve && (
            <div className="flex flex-1 flex-col items-center justify-end pb-2">
              <FabReleve activeSiteId={activeSiteId} />
              <span className="mt-0.5 text-[10px] text-muted-foreground">{t("items.releve")}</span>
            </div>
          )}

          {/* 4. Clients — multi-fermes monitoring */}
          {canSeeClients && (
            <Link
              href="/monitoring"
              className={cn(
                "flex min-h-[56px] flex-1 flex-col items-center justify-center gap-1 text-xs transition-colors pb-1",
                isActive("/monitoring")
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Eye className="h-5 w-5" />
              <span>{t("items.dashboardClients")}</span>
            </Link>
          )}

          {/* 5. Menu — opens Sheet */}
          <button
            onClick={openSheet}
            className="flex min-h-[56px] flex-1 flex-col items-center justify-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors pb-1"
          >
            <Menu className="h-5 w-5" />
            <span>{t("actions.menu")}</span>
          </button>
        </div>
      </nav>

      {/* Secondary modules sheet — portrait: bottom drawer, landscape: right side drawer (E12) */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className={sheetContentClass} style={{ borderRight: "none" }}>
          <div className="flex flex-col gap-0">
            {/* Header */}
            <div className="flex h-12 items-center gap-2 border-b border-border px-4 mb-2">
              <SilureLogo size={20} className="text-primary" />
              <span className="text-base font-bold">FarmFlow</span>
            </div>

            {/* Grouped secondary nav */}
            <nav className="flex flex-col gap-3 p-3">
              {visibleGroups.map((group) => {
                // E5: group with exactly 1 visible item → no group header
                const showHeader = group.items.length > 1;
                return (
                  <div key={group.groupKey}>
                    {showHeader && (
                      <p className="mb-1.5 px-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        {t(`groups.${group.groupKey}` as Parameters<typeof t>[0])}
                      </p>
                    )}
                    <div className="grid grid-cols-3 gap-2">
                      {group.items.map((item) => {
                        const Icon = item.icon;
                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            onClick={() => setSheetOpen(false)}
                            className={cn(
                              "flex min-h-[72px] flex-col items-center justify-center gap-1.5 rounded-xl px-2 py-3 text-xs font-medium transition-colors",
                              isActive(item.href)
                                ? "bg-primary/10 text-primary"
                                : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
                            )}
                          >
                            <Icon className="h-5 w-5" />
                            <span className="text-center leading-tight">
                              {t(item.labelKey as Parameters<typeof t>[0])}
                            </span>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

              {/* Static items: Profil + Backoffice — always last */}
              <div>
                <div className="grid grid-cols-3 gap-2">
                  {/* Profil */}
                  <Link
                    href="/profil"
                    onClick={() => setSheetOpen(false)}
                    className={cn(
                      "flex min-h-[72px] flex-col items-center justify-center gap-1.5 rounded-xl px-2 py-3 text-xs font-medium transition-colors",
                      isActive("/profil")
                        ? "bg-primary/10 text-primary"
                        : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    <User className="h-5 w-5" />
                    <span>{t("items.profil")}</span>
                  </Link>

                  {/* Backoffice — super admin only */}
                  {isSuperAdmin && (
                    <Link
                      href="/backoffice"
                      onClick={() => setSheetOpen(false)}
                      className={cn(
                        "flex min-h-[72px] flex-col items-center justify-center gap-1.5 rounded-xl px-2 py-3 text-xs font-medium transition-colors",
                        isActive("/backoffice")
                          ? "bg-primary/10 text-primary"
                          : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
                      )}
                    >
                      <Shield className="h-5 w-5" />
                      <span>{t("items.backoffice")}</span>
                    </Link>
                  )}
                </div>
              </div>
            </nav>

            {/* User info + logout */}
            <div className="border-t border-border px-4 py-3 space-y-2 mt-1">
              {userName && (
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <User className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{userName}</p>
                    <p className="text-xs text-muted-foreground">
                      {t(`roles.${roleKeyMap[role]}` as Parameters<typeof t>[0])}
                    </p>
                  </div>
                  <div className="ml-auto">
                    <LanguageSwitcher />
                  </div>
                </div>
              )}
              <button
                onClick={handleLogout}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors"
              >
                <LogOut className="h-4 w-4" />
                {t("actions.logout")}
              </button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
