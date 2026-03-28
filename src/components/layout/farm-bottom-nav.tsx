"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  Home,
  Layers,
  Wallet,
  MessageSquare,
  Menu,
  LayoutDashboard,
  Waves,
  Container,
  Package,
  Egg,
  Calendar,
  BarChart3,
  CreditCard,
  Users,
  Settings,
  Fish,
  User,
  LogOut,
  Shield,
  Boxes,
} from "lucide-react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
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
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  permissionRequired?: Permission;
  moduleRequired?: SiteModule;
}

const SHEET_ITEMS: SheetNavItem[] = [
  {
    href: "/stock",
    label: "Stock",
    icon: Package,
    permissionRequired: Permission.STOCK_VOIR,
    moduleRequired: SiteModule.INTRANTS,
  },
  {
    href: "/alevins",
    label: "Alevins",
    icon: Egg,
    permissionRequired: Permission.ALEVINS_VOIR,
    moduleRequired: SiteModule.REPRODUCTION,
  },
  {
    href: "/planning",
    label: "Planning",
    icon: Calendar,
    permissionRequired: Permission.PLANNING_VOIR,
  },
  {
    href: "/analytics",
    label: "Analytics",
    icon: BarChart3,
    permissionRequired: Permission.DASHBOARD_VOIR,
  },
  {
    href: "/mon-abonnement",
    label: "Mon abonnement",
    icon: CreditCard,
    permissionRequired: Permission.ABONNEMENTS_VOIR,
  },
  {
    href: "/users",
    label: "Utilisateurs",
    icon: Users,
    permissionRequired: Permission.UTILISATEURS_VOIR,
  },
  {
    href: "/settings/sites",
    label: "Paramètres",
    icon: Settings,
    permissionRequired: Permission.SITE_GERER,
  },
  {
    href: "/packs",
    label: "Packs",
    icon: Boxes,
    permissionRequired: Permission.ACTIVER_PACKS,
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

  const openSheet = useCallback(() => setSheetOpen(true), []);

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

  const visibleSheetItems = SHEET_ITEMS.filter((item) => {
    if (item.permissionRequired && !permissions.includes(item.permissionRequired))
      return false;
    if (item.moduleRequired && !siteModules.includes(item.moduleRequired))
      return false;
    const itemPerm = ITEM_VIEW_PERMISSIONS[item.href];
    if (itemPerm && !permissions.includes(itemPerm)) return false;
    return true;
  });

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
            <span>Accueil</span>
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
              <span>Ma ferme</span>
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
              <span>Finances</span>
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
              <span>Messages</span>
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
        <SheetContent className="inset-y-auto bottom-0 top-auto left-0 right-0 w-full h-auto max-h-[80vh] overflow-y-auto rounded-t-2xl border-r-0 border-t border-border" style={{ borderRight: "none" }}>
          <div className="flex flex-col gap-0">
            {/* Header */}
            <div className="flex h-12 items-center gap-2 border-b border-border px-4 mb-2">
              <Fish className="h-5 w-5 text-primary" />
              <span className="text-base font-bold">FarmFlow</span>
            </div>

            {/* Secondary nav items */}
            <nav className="grid grid-cols-3 gap-2 p-3">
              {visibleSheetItems.map((item) => {
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
                    <span className="text-center leading-tight">{item.label}</span>
                  </Link>
                );
              })}

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
                  <span>Backoffice</span>
                </Link>
              )}
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
