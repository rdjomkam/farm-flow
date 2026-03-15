"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Waves,
  PlusCircle,
  Container,
  Package,
  ShoppingCart,
  Truck,
  ArrowUpDown,
  Building2,
  Fish,
  BarChart3,
  LineChart,
  Users,
  FileText,
  Banknote,
  Egg,
  Layers,
  Tag,
  Wallet,
  TrendingUp,
  Calendar,
  ClipboardCheck,
  Settings,
  ChevronDown,
  Receipt,
  ClipboardList,
  RefreshCw,
} from "lucide-react";
import { SiteSelector } from "./site-selector";
import { NotificationBell } from "./notification-bell";
import { cn } from "@/lib/utils";
import { Permission } from "@/types";
import { MODULE_VIEW_PERMISSIONS, ITEM_VIEW_PERMISSIONS, SECONDARY_VIEW_PERMISSIONS } from "@/lib/permissions-constants";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Si true, le lien est affiche mais non cliquable (page a venir) */
  disabled?: boolean;
}

const modules: { label: string; icon: React.ComponentType<{ className?: string }>; items: NavItem[] }[] = [
  {
    label: "Reproduction",
    icon: Egg,
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
    items: [
      { href: "/clients", label: "Clients", icon: Users },
      { href: "/ventes", label: "Ventes", icon: Banknote },
      { href: "/factures", label: "Factures", icon: FileText },
      { href: "/finances", label: "Finances", icon: Wallet },
      { href: "/depenses", label: "Depenses", icon: Receipt },
      { href: "/depenses/recurrentes", label: "Recurrentes", icon: RefreshCw },
      { href: "/besoins", label: "Besoins", icon: ClipboardList },
    ],
  },
  {
    label: "Analyse & Pilotage",
    icon: BarChart3,
    items: [
      { href: "/analytics", label: "Vue globale", icon: BarChart3 },
      { href: "/planning", label: "Calendrier", icon: Calendar },
      { href: "/planning/nouvelle", label: "Nouvelle activite", icon: PlusCircle },
      { href: "/mes-taches", label: "Mes taches", icon: ClipboardCheck },
      { href: "/analytics/finances", label: "Finances", icon: Banknote, disabled: true },
      { href: "/analytics/tendances", label: "Tendances", icon: TrendingUp, disabled: true },
    ],
  },
];

const secondaryItems: NavItem[] = [
  { href: "/sites", label: "Sites", icon: Building2 },
  { href: "/settings/alertes", label: "Config. alertes", icon: Settings },
];

export function Sidebar({ permissions }: { permissions: Permission[] }) {
  const pathname = usePathname();

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

  function isActive(href: string) {
    // Pages racines : match exact uniquement
    if (href === "/" || href === "/stock" || href === "/alevins" || href === "/analytics" || href === "/planning" || href === "/finances" || href === "/mes-taches")
      return pathname === href;
    if (href === "/ventes")
      return pathname === "/ventes" || pathname.startsWith("/ventes/");
    return pathname.startsWith(href);
  }

  // Determine which module is active based on current pathname
  const activeModuleLabel = useMemo(() => {
    for (const mod of visibleModules) {
      if (mod.items.some((item) => isActive(item.href))) {
        return mod.label;
      }
    }
    return null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, visibleModules]);

  const [expanded, setExpanded] = useState<Set<string>>(() => {
    // Initialize with the active module expanded
    for (const mod of visibleModules) {
      if (mod.items.some((item) => {
        const href = item.href;
        if (href === "/" || href === "/stock" || href === "/alevins" || href === "/analytics" || href === "/planning" || href === "/finances" || href === "/mes-taches")
          return pathname === href;
        if (href === "/ventes")
          return pathname === "/ventes" || pathname.startsWith("/ventes/");
        return pathname.startsWith(href);
      })) {
        return new Set([mod.label]);
      }
    }
    return new Set(visibleModules[0]?.label ? [visibleModules[0].label] : []);
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
    <aside className="hidden md:flex md:w-60 md:flex-col md:border-r md:border-border md:bg-card">
      <div className="flex h-14 items-center gap-2 border-b border-border px-4">
        <Fish className="h-6 w-6 text-primary" />
        <span className="text-lg font-bold">FarmFlow</span>
        <div className="ml-auto">
          <NotificationBell />
        </div>
      </div>
      <div className="px-3 pt-3 pb-1 border-b border-border mb-1">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-2 mb-1.5">
          Site actif
        </p>
        <SiteSelector fullWidth />
      </div>
      <nav className="flex flex-1 flex-col p-2 overflow-y-auto">
        <div className="space-y-1 flex-1">
          {showDashboard && (
            <Link
              href="/"
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
                    {mod.items.map((item, itemIndex) => {
                      const Icon = item.icon;
                      const active = isActive(item.href);

                      if (item.disabled) {
                        return (
                          <div
                            key={item.href}
                            className="animate-slide-in-left opacity-0 flex items-center gap-3 rounded-lg pl-3 pr-3 py-2 text-sm font-medium text-muted-foreground/40 cursor-not-allowed"
                            style={{ animationDelay: `${itemIndex * 40}ms` }}
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
                          className={cn(
                            "animate-slide-in-left opacity-0 flex items-center gap-3 rounded-lg py-2 text-sm font-medium transition-colors",
                            active
                              ? "bg-primary/10 text-primary border-l-2 border-primary pl-2.5"
                              : "text-muted-foreground hover:bg-muted hover:text-foreground pl-3"
                          )}
                          style={{ animationDelay: `${itemIndex * 40}ms` }}
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
        </div>

        {/* Secondary items at bottom */}
        {visibleSecondary.length > 0 && (
          <div className="border-t border-border pt-2 mt-2 space-y-0.5">
            {visibleSecondary.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-lg py-2 text-sm font-medium transition-colors",
                    active
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
    </aside>
  );
}
