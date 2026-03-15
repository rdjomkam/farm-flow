"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Menu,
  LayoutDashboard,
  Waves,
  PlusCircle,
  Container,
  Package,
  ShoppingCart,
  Truck,
  ArrowUpDown,
  BarChart3,
  LineChart,
  User,
  Users,
  Banknote,
  FileText,
  Building2,
  Fish,
  Egg,
  Layers,
  Tag,
  Wallet,
  TrendingUp,
  Calendar,
  Settings,
  Bell,
  LogOut,
  ChevronDown,
} from "lucide-react";
import { Sheet, SheetTrigger, SheetContent } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { NotificationBell } from "./notification-bell";
import { SiteSelector } from "./site-selector";
import { cn } from "@/lib/utils";
import { Permission, Role } from "@/types";
import { MODULE_VIEW_PERMISSIONS, ITEM_VIEW_PERMISSIONS, SECONDARY_VIEW_PERMISSIONS } from "@/lib/permissions-constants";
import type { UserSession } from "@/types";

const roleLabels: Record<Role, string> = {
  ADMIN: "Administrateur",
  GERANT: "Gerant",
  PISCICULTEUR: "Pisciculteur",
};

interface NavSubItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  disabled?: boolean;
}

interface NavModule {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  prefix: string[];
  items: NavSubItem[];
}

const modules: NavModule[] = [
  {
    label: "Reproduction",
    icon: Egg,
    href: "/alevins",
    prefix: ["/alevins"],
    items: [
      { href: "/alevins", label: "Dashboard", icon: LayoutDashboard },
      { href: "/alevins/reproducteurs", label: "Reproducteurs", icon: Fish },
      { href: "/alevins/pontes", label: "Pontes", icon: Egg },
      { href: "/alevins/lots", label: "Lots d'alevins", icon: Layers },
    ],
  },
  {
    label: "Grossissement",
    icon: Waves,
    href: "/vagues",
    prefix: ["/vagues", "/releves", "/bacs", "/analytics/bacs", "/analytics/vagues"],
    items: [
      { href: "/vagues", label: "Vagues", icon: Waves },
      { href: "/bacs", label: "Bacs", icon: Container },
      { href: "/releves/nouveau", label: "Nouveau releve", icon: PlusCircle },
      { href: "/analytics/bacs", label: "Analytiques bacs", icon: BarChart3 },
      { href: "/analytics/vagues", label: "Analytiques vagues", icon: LineChart },
    ],
  },
  {
    label: "Intrants",
    icon: Package,
    href: "/stock",
    prefix: ["/stock", "/analytics/aliments"],
    items: [
      { href: "/stock", label: "Dashboard", icon: LayoutDashboard },
      { href: "/stock/produits", label: "Produits", icon: Tag },
      { href: "/stock/fournisseurs", label: "Fournisseurs", icon: Truck },
      { href: "/stock/commandes", label: "Commandes", icon: ShoppingCart },
      { href: "/stock/mouvements", label: "Mouvements", icon: ArrowUpDown },
      { href: "/analytics/aliments", label: "Analytiques aliments", icon: BarChart3 },
    ],
  },
  {
    label: "Ventes",
    icon: ShoppingCart,
    href: "/clients",
    prefix: ["/clients", "/ventes", "/factures", "/finances"],
    items: [
      { href: "/clients", label: "Clients", icon: Users },
      { href: "/ventes", label: "Ventes", icon: Banknote },
      { href: "/factures", label: "Factures", icon: FileText },
      { href: "/finances", label: "Finances", icon: Wallet },
    ],
  },
  {
    label: "Analyse & Pilotage",
    icon: BarChart3,
    href: "/analytics",
    prefix: ["/analytics", "/planning", "/notifications", "/settings/alertes", "/settings/config-elevage"],
    items: [
      { href: "/analytics", label: "Vue globale", icon: BarChart3 },
      { href: "/planning", label: "Calendrier", icon: Calendar },
      { href: "/planning/nouvelle", label: "Nouvelle activite", icon: PlusCircle },
      { href: "/analytics/finances", label: "Finances", icon: Banknote, disabled: true },
      { href: "/analytics/tendances", label: "Tendances", icon: TrendingUp, disabled: true },
    ],
  },
];

const secondaryItems: { href: string; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { href: "/sites", label: "Sites", icon: Building2 },
  { href: "/notifications", label: "Notifications", icon: Bell },
  { href: "/settings/config-elevage", label: "Configuration elevage", icon: Settings },
  { href: "/settings/alertes", label: "Configuration alertes", icon: Settings },
];

export function HamburgerMenu() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<UserSession | null>(null);
  const [permissions, setPermissions] = useState<Permission[]>([]);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.user) setUser(data.user);
        if (data?.permissions) setPermissions(data.permissions);
      })
      .catch(() => {});
  }, []);

  // Filter modules by permission, then filter items within each module
  const visibleModules = useMemo(
    () =>
      modules
        .filter((mod) => {
          const required = MODULE_VIEW_PERMISSIONS[mod.label];
          return !required || permissions.includes(required);
        })
        .map((mod) => ({
          ...mod,
          items: mod.items.filter((item) => {
            const required = ITEM_VIEW_PERMISSIONS[item.href];
            return !required || permissions.includes(required);
          }),
        }))
        .filter((mod) => mod.items.length > 0),
    [permissions]
  );

  const visibleSecondary = useMemo(
    () => secondaryItems.filter((item) => {
      const required = SECONDARY_VIEW_PERMISSIONS[item.href];
      return !required || permissions.includes(required);
    }),
    [permissions]
  );

  const showDashboard = permissions.includes(Permission.DASHBOARD_VOIR);

  async function handleLogout() {
    setLoading(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  function isActive(href: string) {
    if (href === "/" || href === "/stock" || href === "/alevins" || href === "/analytics" || href === "/planning" || href === "/finances")
      return pathname === href;
    return pathname.startsWith(href);
  }

  function isModuleActive(prefix: string[]) {
    return prefix.some((p) => (p === "/" || p === "/analytics" ? pathname === p : pathname.startsWith(p)));
  }

  // Determine which module is active based on current pathname
  const activeModuleLabel = useMemo(() => {
    for (const mod of visibleModules) {
      if (isModuleActive(mod.prefix)) {
        return mod.label;
      }
    }
    return null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, visibleModules]);

  const [expanded, setExpanded] = useState<Set<string>>(() => {
    // Initialize with the active module expanded
    for (const mod of modules) {
      if (mod.prefix.some((p) => (p === "/" || p === "/analytics" ? pathname === p : pathname.startsWith(p)))) {
        return new Set([mod.label]);
      }
    }
    return new Set(["Grossissement"]);
  });

  // Auto-expand the active module when pathname changes
  useEffect(() => {
    if (activeModuleLabel) {
      setExpanded((prev) => {
        if (prev.has(activeModuleLabel)) return prev;
        const next = new Set(prev);
        next.add(activeModuleLabel);
        return next;
      });
    }
  }, [activeModuleLabel]);

  function toggleModule(label: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(label)) {
        next.delete(label);
      } else {
        next.add(label);
      }
      return next;
    });
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <div className="flex items-center gap-1">
        <SheetTrigger asChild>
          <Button variant="ghost" className="h-11 w-11 p-0">
            <Menu className="h-5 w-5" />
            <span className="sr-only">Menu</span>
          </Button>
        </SheetTrigger>
        <NotificationBell />
      </div>
      <SheetContent>
        <div className="flex h-full flex-col overflow-y-auto">
          {/* Logo header */}
          <div className="flex h-14 items-center gap-2 border-b border-border px-4">
            <Fish className="h-6 w-6 text-primary" />
            <span className="text-lg font-bold">FarmFlow</span>
          </div>

          {/* Site actif */}
          <div className="px-3 pt-3 pb-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-2 mb-1.5">
              Site actif
            </p>
            <SiteSelector fullWidth />
          </div>

          {/* Modules */}
          <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
            {showDashboard && (
              <Link
                href="/"
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-lg py-2 text-sm font-medium transition-colors",
                  pathname === "/"
                    ? "bg-primary/10 text-primary border-l-2 border-primary pl-2.5"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground pl-3"
                )}
              >
                <LayoutDashboard className="h-4 w-4" />
                Dashboard
              </Link>
            )}
            {visibleModules.map((mod) => {
              const ModIcon = mod.icon;
              const isExpanded = expanded.has(mod.label);
              const isModActive = mod.label === activeModuleLabel;
              return (
                <div key={mod.label}>
                  <button
                    onClick={() => toggleModule(mod.label)}
                    className={cn(
                      "flex w-full items-center gap-2 px-2 py-1.5 text-xs font-semibold uppercase tracking-wider rounded-md transition-colors",
                      isModActive
                        ? "text-primary"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <ModIcon className="h-3.5 w-3.5" />
                    {mod.label}
                    <span className="ml-auto flex items-center gap-1.5">
                      <span className="text-[10px] font-normal normal-case tracking-normal text-muted-foreground">
                        {mod.items.filter(i => !i.disabled).length}
                      </span>
                      <ChevronDown
                        className={cn(
                          "h-3.5 w-3.5 transition-transform duration-200",
                          isExpanded && "rotate-180"
                        )}
                      />
                    </span>
                  </button>
                  <div
                    className={cn(
                      "overflow-hidden transition-all duration-200",
                      isExpanded
                        ? "max-h-[500px] opacity-100"
                        : "max-h-0 opacity-0"
                    )}
                  >
                    <div className="space-y-0.5 pt-0.5">
                      {mod.items.map((item) => {
                        const Icon = item.icon;
                        const itemActive = isActive(item.href);

                        if (item.disabled) {
                          return (
                            <div
                              key={item.href}
                              className="flex items-center gap-3 rounded-lg pl-3 pr-3 py-2 text-sm font-medium text-muted-foreground/40 cursor-not-allowed"
                            >
                              <Icon className="h-4 w-4" />
                              {item.label}
                              <span className="ml-auto text-[9px] uppercase tracking-wide bg-muted rounded px-1">
                                Bientot
                              </span>
                            </div>
                          );
                        }

                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            onClick={() => setOpen(false)}
                            className={cn(
                              "flex items-center gap-3 rounded-lg py-2 text-sm font-medium transition-colors",
                              itemActive
                                ? "bg-primary/10 text-primary border-l-2 border-primary pl-2.5"
                                : "text-muted-foreground hover:bg-muted hover:text-foreground pl-3"
                            )}
                          >
                            <Icon className="h-4 w-4" />
                            {item.label}
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Separator */}
            <div className="border-t border-border" />

            {/* Secondary */}
            {visibleSecondary.length > 0 && (
              <div className="space-y-0.5">
                {visibleSecondary.map((item) => {
                  const itemActive = isActive(item.href);
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setOpen(false)}
                      className={cn(
                        "flex items-center gap-3 rounded-lg py-2.5 text-sm font-medium transition-colors",
                        itemActive
                          ? "bg-primary/10 text-primary border-l-2 border-primary pl-2.5"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground pl-3"
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            )}
          </nav>

          {/* Footer -- User info + Logout */}
          <div className="border-t border-border p-3 space-y-2">
            {user && (
              <div className="flex items-center gap-3 px-3 py-2">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <User className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{user.name}</p>
                  <p className="text-xs text-muted-foreground">{roleLabels[user.role] ?? user.role}</p>
                </div>
              </div>
            )}
            <button
              onClick={handleLogout}
              disabled={loading}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
            >
              <LogOut className="h-4 w-4" />
              Se deconnecter
            </button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
