"use client";

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
  BarChart3,
  LineChart,
  Users,
  FileText,
  Banknote,
  Egg,
  Fish,
  Layers,
  Tag,
  Wallet,
  Calendar,
  Bell,
  ClipboardCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Permission } from "@/types";
import { MODULE_VIEW_PERMISSIONS, ITEM_VIEW_PERMISSIONS } from "@/lib/permissions-constants";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const defaultItems: NavItem[] = [
  { href: "/", label: "Accueil", icon: LayoutDashboard },
  { href: "/vagues", label: "Vagues", icon: Waves },
  { href: "/releves/nouveau", label: "Relevé", icon: PlusCircle },
  { href: "/bacs", label: "Bacs", icon: Container },
  { href: "/analytics", label: "Analyse", icon: BarChart3 },
];

const reproductionItems: NavItem[] = [
  { href: "/alevins", label: "Alevins", icon: Egg },
  { href: "/alevins/reproducteurs", label: "Reprod.", icon: Fish },
  { href: "/alevins/pontes", label: "Pontes", icon: Egg },
  { href: "/alevins/lots", label: "Lots", icon: Layers },
];

const grossissementItems: NavItem[] = [
  { href: "/vagues", label: "Vagues", icon: Waves },
  { href: "/releves/nouveau", label: "Relevé", icon: PlusCircle },
  { href: "/bacs", label: "Bacs", icon: Container },
  { href: "/analytics/bacs", label: "An. bacs", icon: BarChart3 },
  { href: "/analytics/vagues", label: "An. vagues", icon: LineChart },
];

const intrantsItems: NavItem[] = [
  { href: "/stock", label: "Stock", icon: Package },
  { href: "/stock/produits", label: "Produits", icon: Tag },
  { href: "/stock/fournisseurs", label: "Fourn.", icon: Truck },
  { href: "/stock/commandes", label: "Cmd.", icon: ShoppingCart },
  { href: "/stock/mouvements", label: "Mouv.", icon: ArrowUpDown },
];

const ventesItems: NavItem[] = [
  { href: "/clients", label: "Clients", icon: Users },
  { href: "/ventes", label: "Ventes", icon: Banknote },
  { href: "/factures", label: "Factures", icon: FileText },
  { href: "/finances", label: "Finances", icon: Wallet },
];

const pilotageItems: NavItem[] = [
  { href: "/analytics", label: "Analyse", icon: BarChart3 },
  { href: "/planning", label: "Planning", icon: Calendar },
  { href: "/mes-taches", label: "Taches", icon: ClipboardCheck },
  { href: "/notifications", label: "Alertes", icon: Bell },
];

// Map contextual item groups to their module label for permission checking
function getModuleForPath(pathname: string): string | null {
  if (pathname.startsWith("/alevins")) return "Reproduction";
  if (
    pathname.startsWith("/vagues") ||
    pathname.startsWith("/bacs") ||
    pathname.startsWith("/releves") ||
    pathname.startsWith("/analytics/bacs") ||
    pathname.startsWith("/analytics/vagues")
  ) return "Grossissement";
  if (pathname.startsWith("/stock") || pathname.startsWith("/analytics/aliments")) return "Intrants";
  if (
    pathname.startsWith("/ventes") ||
    pathname.startsWith("/clients") ||
    pathname.startsWith("/factures") ||
    pathname.startsWith("/finances")
  ) return "Ventes";
  if (
    pathname === "/analytics" ||
    pathname.startsWith("/planning") ||
    pathname.startsWith("/mes-taches") ||
    pathname.startsWith("/notifications") ||
    pathname.startsWith("/settings/alertes")
  ) return "Analyse & Pilotage";
  return null;
}

export function BottomNav({ permissions }: { permissions: Permission[] }) {
  const pathname = usePathname();

  // Hide bottom nav on sites management pages (not site-scoped)
  if (pathname.startsWith("/sites")) return null;

  const isReproduction = pathname.startsWith("/alevins");
  const isGrossissement =
    pathname.startsWith("/vagues") ||
    pathname.startsWith("/bacs") ||
    pathname.startsWith("/releves") ||
    pathname.startsWith("/analytics/bacs") ||
    pathname.startsWith("/analytics/vagues");
  const isIntrants =
    pathname.startsWith("/stock") ||
    pathname.startsWith("/analytics/aliments");
  const isVentes =
    pathname.startsWith("/ventes") ||
    pathname.startsWith("/clients") ||
    pathname.startsWith("/factures") ||
    pathname.startsWith("/finances");
  const isPilotage =
    pathname === "/analytics" ||
    pathname.startsWith("/planning") ||
    pathname.startsWith("/mes-taches") ||
    pathname.startsWith("/notifications") ||
    pathname.startsWith("/settings/alertes");

  let navItems = isReproduction
    ? reproductionItems
    : isGrossissement
      ? grossissementItems
      : isIntrants
        ? intrantsItems
        : isVentes
          ? ventesItems
          : isPilotage
            ? pilotageItems
            : defaultItems;

  // For contextual nav, check if user has the module permission
  const currentModule = getModuleForPath(pathname);
  if (currentModule) {
    const required = MODULE_VIEW_PERMISSIONS[currentModule];
    if (required && !permissions.includes(required)) {
      navItems = defaultItems;
    }
  }

  // Filter default items by permission (Dashboard needs DASHBOARD_VOIR, etc.)
  if (navItems === defaultItems) {
    navItems = defaultItems.filter((item) => {
      if (item.href === "/") return permissions.includes(Permission.DASHBOARD_VOIR);
      if (item.href === "/vagues") return permissions.includes(Permission.VAGUES_VOIR);
      if (item.href === "/releves/nouveau") return permissions.includes(Permission.RELEVES_CREER);
      if (item.href === "/bacs") return permissions.includes(Permission.BACS_GERER);
      if (item.href === "/analytics") return permissions.includes(Permission.DASHBOARD_VOIR);
      return true;
    });
  }

  // Apply per-item permission filter to all item sets
  navItems = navItems.filter((item) => {
    const required = ITEM_VIEW_PERMISSIONS[item.href];
    return !required || permissions.includes(required);
  });

  if (navItems.length === 0) return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-card md:hidden">
      <div className="flex items-center justify-around">
        {navItems.map((item) => {
          const isActive =
            item.href === "/" || item.href === "/stock" || item.href === "/alevins" || item.href === "/analytics" || item.href === "/planning" || item.href === "/finances" || item.href === "/mes-taches"
              ? pathname === item.href
              : pathname.startsWith(item.href);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex min-h-[56px] flex-1 flex-col items-center justify-center gap-1 text-xs transition-colors",
                isActive
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="h-5 w-5" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
