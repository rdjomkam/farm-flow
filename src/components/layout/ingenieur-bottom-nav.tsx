"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  Home,
  CheckSquare,
  Plus,
  Users,
  Menu,
  NotebookPen,
  Wallet,
  Boxes,
  Package,
  Bell,
  User,
  LogOut,
  Fish,
  Shield,
} from "lucide-react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { Permission, Role, SiteModule } from "@/types";
import { ITEM_VIEW_PERMISSIONS } from "@/lib/permissions-constants";
import { useAuthService } from "@/services";
import { LanguageSwitcher } from "./language-switcher";

interface IngenieurBottomNavProps {
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
}

const SHEET_ITEMS: SheetNavItem[] = [
  {
    href: "/notes",
    label: "Notes",
    icon: NotebookPen,
    permissionRequired: Permission.ENVOYER_NOTES,
  },
  {
    href: "/mon-portefeuille",
    label: "Portefeuille",
    icon: Wallet,
    permissionRequired: Permission.PORTEFEUILLE_VOIR,
  },
  {
    href: "/packs",
    label: "Packs",
    icon: Boxes,
    permissionRequired: Permission.ACTIVER_PACKS,
  },
  {
    href: "/stock",
    label: "Stock",
    icon: Package,
    permissionRequired: Permission.STOCK_VOIR,
  },
  {
    href: "/settings/alertes",
    label: "Alertes",
    icon: Bell,
    permissionRequired: Permission.ALERTES_CONFIGURER,
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
}: IngenieurBottomNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const t = useTranslations("navigation");
  const authService = useAuthService();
  const [sheetOpen, setSheetOpen] = useState(false);

  const openSheet = useCallback(() => setSheetOpen(true), []);

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(href + "/");
  }

  const visibleSheetItems = SHEET_ITEMS.filter((item) => {
    if (item.permissionRequired && !permissions.includes(item.permissionRequired))
      return false;
    const itemPerm = ITEM_VIEW_PERMISSIONS[item.href];
    if (itemPerm && !permissions.includes(itemPerm)) return false;
    return true;
  });

  const canSeeClients = permissions.includes(Permission.MONITORING_CLIENTS);
  const canSeeTasks = permissions.includes(Permission.DASHBOARD_VOIR);
  const canAddReleve = permissions.includes(Permission.RELEVES_CREER);

  async function handleLogout() {
    await authService.logout();
    router.push("/login");
    router.refresh();
  }

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
            <span>Accueil</span>
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
              <span>Tâches</span>
            </Link>
          )}

          {/* 3. +Relevé — FAB style, centered, visually distinct */}
          {canAddReleve && (
            <div className="flex flex-1 flex-col items-center justify-end pb-2">
              <Link
                href="/releves/nouveau"
                className={cn(
                  "flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition-all",
                  "bg-primary text-primary-foreground hover:opacity-90 active:scale-95",
                  "-translate-y-3" // lifts the FAB above the nav bar
                )}
                aria-label="Nouveau relevé"
              >
                <Plus className="h-7 w-7" strokeWidth={2.5} />
              </Link>
              <span className="mt-0.5 text-[10px] text-muted-foreground">Relevé</span>
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
              <Users className="h-5 w-5" />
              <span>Clients</span>
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

      {/* Secondary modules sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="inset-y-auto bottom-0 top-auto left-0 right-0 w-full h-auto max-h-[80vh] overflow-y-auto rounded-t-2xl border-r-0 border-t border-border" style={{ borderRight: "none" }}>
          <div className="flex flex-col gap-0">
            {/* Header */}
            <div className="flex h-12 items-center gap-2 border-b border-border px-4 mb-2">
              <Fish className="h-5 w-5 text-primary" />
              <span className="text-base font-bold">FarmFlow</span>
            </div>

            {/* Secondary nav grid */}
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
                <span>Profil</span>
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
