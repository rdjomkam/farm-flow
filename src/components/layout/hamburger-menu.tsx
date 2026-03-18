"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
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
  ClipboardCheck,
  Settings,
  LogOut,
  Receipt,
  ClipboardList,
  NotebookPen,
  UserCog,
  Boxes,
  Zap,
} from "lucide-react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { Permission, Role, SiteModule } from "@/types";
import { MODULE_VIEW_PERMISSIONS, ITEM_VIEW_PERMISSIONS, MODULE_LABEL_TO_SITE_MODULE } from "@/lib/permissions-constants";

const roleLabels: Record<Role, string> = {
  ADMIN: "Administrateur",
  GERANT: "Gerant",
  PISCICULTEUR: "Pisciculteur",
  INGENIEUR: "Ingenieur",
};

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  disabled?: boolean;
}

// ---------------------------------------------------------------------------
// Modules ADMIN / GERANT (mirrors sidebar exactly)
// ---------------------------------------------------------------------------

const modulesAdminGerant: { label: string; primaryHref: string; icon: React.ComponentType<{ className?: string }>; items: NavItem[] }[] = [
  {
    label: "Reproduction",
    primaryHref: "/alevins",
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
    primaryHref: "/vagues",
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
    primaryHref: "/stock",
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
    primaryHref: "/ventes",
    icon: ShoppingCart,
    items: [
      { href: "/clients", label: "Clients", icon: Users },
      { href: "/ventes", label: "Ventes", icon: Banknote },
      { href: "/factures", label: "Factures", icon: FileText },
      { href: "/finances", label: "Finances", icon: Wallet },
      { href: "/depenses", label: "Depenses", icon: Receipt },
      { href: "/besoins", label: "Besoins", icon: ClipboardList },
    ],
  },
  {
    label: "Analyse & Pilotage",
    primaryHref: "/analytics",
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
  {
    label: "Packs & Provisioning",
    primaryHref: "/packs",
    icon: Boxes,
    items: [
      { href: "/packs", label: "Packs", icon: Boxes },
      { href: "/activations", label: "Activations", icon: ClipboardCheck },
    ],
  },
  {
    label: "Ingenieur",
    primaryHref: "/ingenieur",
    icon: UserCog,
    items: [
      { href: "/ingenieur", label: "Dashboard clients", icon: LayoutDashboard },
      { href: "/notes", label: "Notes", icon: NotebookPen },
    ],
  },
  // Configuration — unified settings module
  {
    label: "Configuration",
    primaryHref: "/settings/sites",
    icon: Settings,
    items: [
      { href: "/settings/sites", label: "Sites", icon: Building2 },
      { href: "/settings/config-elevage", label: "Profils d'elevage", icon: Settings },
      { href: "/settings/alertes", label: "Config. alertes", icon: Settings },
      { href: "/settings/regles-activites", label: "Regles d'activites", icon: Zap },
    ],
  },
];

// ---------------------------------------------------------------------------
// Modules INGENIEUR
// ---------------------------------------------------------------------------

const modulesIngenieur: { label: string; primaryHref: string; icon: React.ComponentType<{ className?: string }>; items: NavItem[] }[] = [
  {
    label: "Clients",
    primaryHref: "/ingenieur",
    icon: Users,
    items: [
      { href: "/ingenieur", label: "Dashboard clients", icon: LayoutDashboard },
    ],
  },
  {
    label: "Notes",
    primaryHref: "/notes",
    icon: NotebookPen,
    items: [
      { href: "/notes", label: "Mes notes", icon: NotebookPen },
    ],
  },
];

// ---------------------------------------------------------------------------
// Modules PISCICULTEUR
// ---------------------------------------------------------------------------

const modulesPisciculteur: { label: string; primaryHref: string; icon: React.ComponentType<{ className?: string }>; items: NavItem[] }[] = [
  {
    label: "Elevage",
    primaryHref: "/vagues",
    icon: Waves,
    items: [
      { href: "/vagues", label: "Vagues", icon: Waves },
      { href: "/bacs", label: "Bacs", icon: Container },
      { href: "/releves/nouveau", label: "Nouveau releve", icon: PlusCircle },
    ],
  },
  {
    label: "Analyse & Pilotage",
    primaryHref: "/analytics",
    icon: BarChart3,
    items: [
      { href: "/analytics", label: "Vue globale", icon: BarChart3 },
      { href: "/mes-taches", label: "Mes taches", icon: ClipboardCheck },
      { href: "/notes", label: "Echanges", icon: NotebookPen },
    ],
  },
];

// ---------------------------------------------------------------------------
// Phase 3 permission gates
// ---------------------------------------------------------------------------

const PHASE3_MODULE_PERMISSIONS: Record<string, Permission> = {
  "Packs & Provisioning": Permission.ACTIVER_PACKS,
  "Ingenieur":            Permission.MONITORING_CLIENTS,
};

interface HamburgerMenuProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  permissions: Permission[];
  role: Role | null;
  userName: string | null;
  siteModules: SiteModule[];
}

export function HamburgerMenu({ open, onOpenChange, permissions, role, userName, siteModules }: HamburgerMenuProps) {
  const [loading, setLoading] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  // Select modules by role (same logic as sidebar)
  const allModules = useMemo(() => {
    if (role === Role.INGENIEUR) return modulesIngenieur;
    if (role === Role.PISCICULTEUR) return modulesPisciculteur;
    return modulesAdminGerant;
  }, [role]);

  // Filter modules by permission + site modules, then items within each module
  const visibleModules = useMemo(
    () =>
      allModules
        .filter((mod) => {
          const phase3Required = PHASE3_MODULE_PERMISSIONS[mod.label];
          if (phase3Required && !permissions.includes(phase3Required)) return false;
          const required = MODULE_VIEW_PERMISSIONS[mod.label];
          if (required && !permissions.includes(required)) return false;
          // Gate par modules actifs du site
          const siteModule = MODULE_LABEL_TO_SITE_MODULE[mod.label];
          if (siteModule && !siteModules.includes(siteModule)) return false;
          return true;
        })
        .map((mod) => ({
          ...mod,
          items: mod.items.filter((item) => {
            const required = ITEM_VIEW_PERMISSIONS[item.href];
            return !required || permissions.includes(required);
          }),
        }))
        .filter((mod) => mod.items.length > 0),
    [permissions, allModules, siteModules]
  );

  const showDashboard = permissions.includes(Permission.DASHBOARD_VOIR) && role !== Role.INGENIEUR && role !== Role.PISCICULTEUR;

  function isActive(href: string) {
    if (href === "/" || href === "/stock" || href === "/alevins" || href === "/analytics" || href === "/planning" || href === "/finances" || href === "/mes-taches" || href === "/ingenieur" || href === "/notes" || href === "/packs" || href === "/activations")
      return pathname === href || pathname.startsWith(href + "/");
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

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <div className="flex h-full flex-col overflow-y-auto">
          {/* Logo header */}
          <div className="flex h-14 items-center gap-2 border-b border-border px-4">
            <Fish className="h-6 w-6 text-primary" />
            <span className="text-lg font-bold">FarmFlow</span>
          </div>

          {/* Modules */}
          <nav className="flex-1 p-3 space-y-2 overflow-y-auto">
            {showDashboard && (
              <Link
                href="/"
                onClick={() => onOpenChange(false)}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  pathname === "/"
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <LayoutDashboard className="h-4 w-4" />
                Dashboard
              </Link>
            )}
            {visibleModules.map((mod) => {
              const ModIcon = mod.icon;
              const isModActive = mod.label === activeModuleLabel;
              return (
                <Link
                  key={mod.label}
                  href={mod.primaryHref}
                  onClick={() => onOpenChange(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                    isModActive
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <ModIcon className="h-4 w-4" />
                  {mod.label}
                </Link>
              );
            })}

          </nav>

          {/* Footer -- User info + Logout */}
          <div className="border-t border-border p-3 space-y-2">
            {userName && role && (
              <div className="flex items-center gap-3 px-3 py-2">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <User className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{userName}</p>
                  <p className="text-xs text-muted-foreground">{roleLabels[role] ?? role}</p>
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
