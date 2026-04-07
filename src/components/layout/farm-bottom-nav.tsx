"use client";

import { useState, useCallback, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  Home,
  Layers,
  Wallet,
  MessageSquare,
  Menu,
  Waves,
  Container,
  Package,
  Egg,
  Calendar,
  BarChart3,
  CreditCard,
  Users,
  Settings,
  User,
  LogOut,
  Shield,
  Boxes,
  Receipt,
  Eye,
  UserRound,
  Truck,
  ShoppingCart,
  ClipboardList,
  BellRing,
  PackageCheck,
  ClipboardCheck,
  NotebookPen,
  Banknote,
  FileText,
  LayoutDashboard,
  Fish,
  ThermometerSun,
} from "lucide-react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { SilureLogo } from "@/components/ui/silure-logo";
import { Permission, Role, SiteModule } from "@/types";
import { ITEM_VIEW_PERMISSIONS, MODULE_LABEL_TO_SITE_MODULE } from "@/lib/permissions-constants";
import { useAuthService } from "@/services";
import { LanguageSwitcher } from "./language-switcher";

interface FarmBottomNavProps {
  permissions: Permission[];
  siteModules: SiteModule[];
  role: Role;
  userName: string | null;
  isSuperAdmin: boolean;
}

interface SheetNavItem {
  href: string;
  labelKey: string;
  icon: React.ComponentType<{ className?: string }>;
  permissionRequired?: Permission;
  moduleRequired?: SiteModule;
  superAdminOnly?: boolean;
}

interface SheetNavGroup {
  /** i18n key under navigation:modules.* */
  groupKey: string;
  /** Gate: group is visible only if any item passes visibility check */
  gatePermission?: Permission;
  items: SheetNavItem[];
}

const SHEET_GROUPS: SheetNavGroup[] = [
  {
    groupKey: "grossissement",
    gatePermission: Permission.VAGUES_VOIR,
    items: [
      {
        href: "/vagues",
        labelKey: "items.vagues",
        icon: Waves,
        permissionRequired: Permission.VAGUES_VOIR,
      },
      {
        href: "/bacs",
        labelKey: "items.bacs",
        icon: Container,
        permissionRequired: Permission.BACS_GERER,
      },
      {
        href: "/releves",
        labelKey: "items.releve",
        icon: NotebookPen,
        permissionRequired: Permission.RELEVES_VOIR,
      },
      {
        href: "/observations",
        labelKey: "items.observations",
        icon: Eye,
        permissionRequired: Permission.RELEVES_VOIR,
      },
    ],
  },
  {
    groupKey: "intrants",
    gatePermission: Permission.STOCK_VOIR,
    items: [
      {
        href: "/stock",
        labelKey: "items.stock",
        icon: Package,
        permissionRequired: Permission.STOCK_VOIR,
        moduleRequired: SiteModule.INTRANTS,
      },
      {
        href: "/stock/fournisseurs",
        labelKey: "items.fournisseurs",
        icon: Truck,
        permissionRequired: Permission.APPROVISIONNEMENT_VOIR,
        moduleRequired: SiteModule.INTRANTS,
      },
      {
        href: "/stock/commandes",
        labelKey: "items.commandes",
        icon: ShoppingCart,
        permissionRequired: Permission.APPROVISIONNEMENT_GERER,
        moduleRequired: SiteModule.INTRANTS,
      },
      {
        href: "/besoins",
        labelKey: "items.besoins",
        icon: ClipboardList,
        permissionRequired: Permission.BESOINS_SOUMETTRE,
      },
    ],
  },
  {
    groupKey: "ventes",
    gatePermission: Permission.FINANCES_VOIR,
    items: [
      {
        href: "/finances",
        labelKey: "items.finances",
        icon: Wallet,
        permissionRequired: Permission.FINANCES_VOIR,
      },
      {
        href: "/ventes",
        labelKey: "items.ventesItem",
        icon: Banknote,
        permissionRequired: Permission.VENTES_VOIR,
      },
      {
        href: "/factures",
        labelKey: "items.factures",
        icon: FileText,
        permissionRequired: Permission.FACTURES_VOIR,
      },
      {
        href: "/clients",
        labelKey: "items.clientsItem",
        icon: UserRound,
        permissionRequired: Permission.CLIENTS_VOIR,
      },
      {
        href: "/depenses",
        labelKey: "items.depenses",
        icon: Receipt,
        permissionRequired: Permission.DEPENSES_VOIR,
      },
    ],
  },
  {
    groupKey: "reproduction",
    gatePermission: Permission.ALEVINS_VOIR,
    items: [
      {
        href: "/reproduction",
        labelKey: "items.dashboardReproduction",
        icon: LayoutDashboard,
        permissionRequired: Permission.ALEVINS_VOIR,
        moduleRequired: SiteModule.REPRODUCTION,
      },
      {
        href: "/reproduction/geniteurs",
        labelKey: "items.geniteurs",
        icon: Fish,
        permissionRequired: Permission.GENITEURS_VOIR,
        moduleRequired: SiteModule.REPRODUCTION,
      },
      {
        href: "/reproduction/pontes",
        labelKey: "items.pontes",
        icon: Egg,
        permissionRequired: Permission.PONTES_VOIR,
        moduleRequired: SiteModule.REPRODUCTION,
      },
      {
        href: "/reproduction/lots",
        labelKey: "items.lotsAlevins",
        icon: Layers,
        permissionRequired: Permission.LOTS_ALEVINS_VOIR,
        moduleRequired: SiteModule.REPRODUCTION,
      },
      {
        href: "/reproduction/planning",
        labelKey: "items.planningReproduction",
        icon: Calendar,
        permissionRequired: Permission.PLANNING_REPRODUCTION_VOIR,
        moduleRequired: SiteModule.REPRODUCTION,
      },
    ],
  },
  {
    groupKey: "analysePilotage",
    gatePermission: Permission.DASHBOARD_VOIR,
    items: [
      {
        href: "/analytics",
        labelKey: "items.analyse",
        icon: BarChart3,
        permissionRequired: Permission.DASHBOARD_VOIR,
      },
      {
        href: "/planning",
        labelKey: "items.calendrier",
        icon: Calendar,
        permissionRequired: Permission.PLANNING_VOIR,
      },
      {
        href: "/mes-taches",
        labelKey: "items.mesTaches",
        icon: ClipboardCheck,
        permissionRequired: Permission.PLANNING_VOIR,
      },
    ],
  },
  {
    groupKey: "configuration",
    items: [
      {
        href: "/settings/sites",
        labelKey: "items.sites",
        icon: Settings,
        permissionRequired: Permission.SITE_GERER,
      },
      {
        href: "/settings/alertes",
        labelKey: "items.alertes",
        icon: BellRing,
        permissionRequired: Permission.ALERTES_CONFIGURER,
      },
      {
        href: "/settings/config-elevage",
        labelKey: "items.profilsElevage",
        icon: ClipboardCheck,
        permissionRequired: Permission.GERER_CONFIG_ELEVAGE,
      },
      {
        href: "/users",
        labelKey: "modules.utilisateurs",
        icon: Users,
        permissionRequired: Permission.UTILISATEURS_VOIR,
      },
      {
        href: "/mon-abonnement",
        labelKey: "items.monAbonnement",
        icon: CreditCard,
        permissionRequired: Permission.ABONNEMENTS_VOIR,
      },
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
        href: "/backoffice",
        labelKey: "items.backoffice",
        icon: Shield,
        superAdminOnly: true,
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

export function FarmBottomNav({
  permissions,
  siteModules,
  role,
  userName,
  isSuperAdmin,
}: FarmBottomNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const t = useTranslations("navigation");
  const authService = useAuthService();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [isLandscape, setIsLandscape] = useState(false);

  const openSheet = useCallback(() => setSheetOpen(true), []);

  useEffect(() => {
    function checkOrientation() {
      setIsLandscape(window.innerHeight < 500);
    }
    checkOrientation();
    window.addEventListener("resize", checkOrientation);
    return () => window.removeEventListener("resize", checkOrientation);
  }, []);

  const visibleFinances =
    permissions.includes(Permission.FINANCES_VOIR) &&
    siteModules.includes(SiteModule.VENTES);

  const visibleNotes =
    ITEM_VIEW_PERMISSIONS["/notes"]
      ? permissions.includes(ITEM_VIEW_PERMISSIONS["/notes"]!)
      : true;

  const visibleVagues = permissions.includes(Permission.VAGUES_VOIR);

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(href + "/");
  }

  function isItemVisible(item: SheetNavItem): boolean {
    if (item.superAdminOnly) return isSuperAdmin;
    if (item.permissionRequired && !permissions.includes(item.permissionRequired))
      return false;
    if (item.moduleRequired && !siteModules.includes(item.moduleRequired))
      return false;
    const itemPerm = ITEM_VIEW_PERMISSIONS[item.href];
    if (itemPerm && !permissions.includes(itemPerm)) return false;
    return true;
  }

  const visibleGroups = SHEET_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter(isItemVisible),
  })).filter((group) => group.items.length > 0);

  async function handleLogout() {
    await authService.logout();
    router.push("/login");
    router.refresh();
  }

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-card pb-[env(safe-area-inset-bottom)] md:hidden">
        <div className="flex items-center justify-around">
          {/* 1. Accueil */}
          <Link
            href="/"
            className={cn(
              "flex min-h-[56px] flex-1 flex-col items-center justify-center gap-1 text-xs transition-colors",
              isActive("/") ? "text-primary" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Home className="h-5 w-5" />
            <span>{t("items.accueil")}</span>
          </Link>

          {/* 2. Ma ferme */}
          {visibleVagues && (
            <Link
              href="/vagues"
              className={cn(
                "flex min-h-[56px] flex-1 flex-col items-center justify-center gap-1 text-xs transition-colors",
                isActive("/vagues") || isActive("/bacs") || isActive("/releves")
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Layers className="h-5 w-5" />
              <span>{t("items.vagues")}</span>
            </Link>
          )}

          {/* 3. Finances — conditional on FINANCES_VOIR + VENTES module */}
          {visibleFinances && (
            <Link
              href="/finances"
              className={cn(
                "flex min-h-[56px] flex-1 flex-col items-center justify-center gap-1 text-xs transition-colors",
                isActive("/finances") || isActive("/ventes") || isActive("/factures")
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Wallet className="h-5 w-5" />
              <span>{t("items.finances")}</span>
            </Link>
          )}

          {/* 4. Messages / Notes */}
          {visibleNotes && (
            <Link
              href="/notes"
              className={cn(
                "flex min-h-[56px] flex-1 flex-col items-center justify-center gap-1 text-xs transition-colors",
                isActive("/notes")
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <MessageSquare className="h-5 w-5" />
              <span>{t("items.notes")}</span>
            </Link>
          )}

          {/* 5. Menu — opens Sheet */}
          <button
            onClick={openSheet}
            className="flex min-h-[56px] flex-1 flex-col items-center justify-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <Menu className="h-5 w-5" />
            <span>{t("actions.menu")}</span>
          </button>
        </div>
      </nav>

      {/* Secondary modules sheet / drawer */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent
          className={cn(
            "overflow-y-auto overscroll-contain border-border",
            isLandscape
              ? "inset-y-0 right-0 left-auto top-0 bottom-0 h-full w-80 rounded-l-2xl border-l border-t-0"
              : "inset-y-auto bottom-0 top-auto left-0 right-0 w-full h-auto max-h-[80vh] rounded-t-2xl border-r-0 border-t"
          )}
          style={isLandscape ? {} : { borderRight: "none" }}
        >
          <div className="flex flex-col gap-0">
            {/* Header */}
            <div className="flex h-12 items-center gap-2 border-b border-border px-4 mb-2">
              <SilureLogo size={20} className="text-primary" />
              <span className="text-base font-bold">FarmFlow</span>
            </div>

            {/* Secondary nav items — grouped */}
            <nav className="flex flex-col gap-4 p-3">
              {visibleGroups.map((group) => {
                const showHeader = group.items.length > 1;
                return (
                  <div key={group.groupKey}>
                    {/* E5: hide group header when only 1 item visible */}
                    {showHeader && (
                      <p className="mb-1.5 px-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        {t(`modules.${group.groupKey}` as Parameters<typeof t>[0])}
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
                            <span className="text-center leading-tight">{t(item.labelKey as Parameters<typeof t>[0])}</span>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </nav>

            {/* User info + logout */}
            <div className="border-t border-border px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] space-y-2 mt-1">
              {userName && (
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <User className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{userName}</p>
                    <p className="text-xs text-muted-foreground">
                      {t(`roles.${roleKeyMap[role]}`)}
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
