"use client";

import { useMemo } from "react";
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
  UserPlus,
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
  Receipt,
  ClipboardList,
  NotebookPen,
  UserCog,
  Boxes,
  Zap,
  CreditCard,
  ShieldCheck,
} from "lucide-react";
import { NotificationBell } from "./notification-bell";
import { cn } from "@/lib/utils";
import { Permission, Role, SiteModule } from "@/types";
import { MODULE_VIEW_PERMISSIONS, ITEM_VIEW_PERMISSIONS, MODULE_LABEL_TO_SITE_MODULE } from "@/lib/permissions-constants";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Si true, le lien est affiche mais non cliquable (page a venir) */
  disabled?: boolean;
}

// ---------------------------------------------------------------------------
// Modules communs (ADMIN / GERANT)
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
  // Phase 3 — Packs & Provisioning (Sprint 20)
  {
    label: "Packs & Provisioning",
    primaryHref: "/packs",
    icon: Boxes,
    items: [
      { href: "/packs", label: "Packs", icon: Boxes },
      { href: "/activations", label: "Activations", icon: ClipboardCheck },
    ],
  },
  // Phase 3 — Monitoring ingénieur (Sprint 23)
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
  // Abonnement — Sprint 33 (gate: ABONNEMENTS_VOIR)
  {
    label: "Abonnement",
    primaryHref: "/mon-abonnement",
    icon: CreditCard,
    items: [
      { href: "/mon-abonnement", label: "Mon abonnement", icon: CreditCard },
      { href: "/tarifs", label: "Plans & tarifs", icon: Tag },
    ],
  },
  // Admin Abonnements — Sprint 33 (gate: ABONNEMENTS_GERER)
  {
    label: "Admin Abonnements",
    primaryHref: "/admin/abonnements",
    icon: ShieldCheck,
    items: [
      { href: "/admin/abonnements", label: "Tous les abonnements", icon: ShieldCheck },
    ],
  },
  // Portefeuille Ingénieur — Sprint 34 (gate: PORTEFEUILLE_VOIR)
  {
    label: "Portefeuille",
    primaryHref: "/mon-portefeuille",
    icon: Wallet,
    items: [
      { href: "/mon-portefeuille", label: "Mon portefeuille", icon: Wallet },
    ],
  },
  // Admin Commissions — Sprint 34 (gate: COMMISSIONS_GERER)
  {
    label: "Admin Commissions",
    primaryHref: "/admin/commissions",
    icon: TrendingUp,
    items: [
      { href: "/admin/commissions", label: "Toutes les commissions", icon: TrendingUp },
    ],
  },
  // Admin Remises — Sprint 35 (gate: REMISES_GERER)
  {
    label: "Admin Remises",
    primaryHref: "/admin/remises",
    icon: Tag,
    items: [
      { href: "/admin/remises", label: "Remises & promos", icon: Tag },
    ],
  },
  // Utilisateurs — ADMIN uniquement (filtre par role dans le composant)
  {
    label: "Utilisateurs",
    primaryHref: "/users",
    icon: Users,
    items: [
      { href: "/users", label: "Liste", icon: Users },
      { href: "/users/nouveau", label: "Nouveau", icon: UserPlus },
    ],
  },
];

// ---------------------------------------------------------------------------
// Permission gates Phase 3
// ---------------------------------------------------------------------------

const PHASE3_MODULE_PERMISSIONS: Record<string, Permission> = {
  "Packs & Provisioning":  Permission.ACTIVER_PACKS,
  "Ingenieur":             Permission.MONITORING_CLIENTS,
  "Utilisateurs":          Permission.UTILISATEURS_VOIR,
  // Sprint 33 — Abonnements
  "Abonnement":            Permission.ABONNEMENTS_VOIR,
  "Admin Abonnements":     Permission.ABONNEMENTS_GERER,
  // Sprint 34 — Commissions & Portefeuille
  "Portefeuille":          Permission.PORTEFEUILLE_VOIR,
  "Admin Commissions":     Permission.COMMISSIONS_GERER,
  // Sprint 35 — Remises
  "Admin Remises":         Permission.REMISES_GERER,
};

export function Sidebar({ permissions, role, siteModules }: { permissions: Permission[]; role: Role | null; siteModules: SiteModule[] }) {
  const pathname = usePathname();

  // Sélectionner les modules selon le rôle
  const allModules = useMemo(() => {
    return modulesAdminGerant;
  }, [role]);

  // Filtrer modules par permission + site modules, puis items dans chaque module
  const visibleModules = useMemo(
    () =>
      allModules
        .filter((mod) => {
          // Gate Phase 3 spécifique
          const phase3Required = PHASE3_MODULE_PERMISSIONS[mod.label];
          if (phase3Required && !permissions.includes(phase3Required)) return false;
          // Gate de module standard
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
    // Pages racines : match exact uniquement
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

  return (
    <aside className="hidden md:flex md:w-60 md:flex-col md:border-r md:border-border md:bg-card">
      <div className="flex h-14 items-center gap-2 border-b border-border px-4">
        <Fish className="h-6 w-6 text-primary" />
        <span className="text-lg font-bold">FarmFlow</span>
        <div className="ml-auto">
          <NotificationBell />
        </div>
      </div>
      <nav className="flex flex-1 flex-col p-2 overflow-y-auto">
        <div className="space-y-2 flex-1">
          {showDashboard && (
            <Link
              href="/"
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
        </div>

      </nav>
    </aside>
  );
}
