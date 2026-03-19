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
  UserPlus,
  FileText,
  Banknote,
  Egg,
  Fish,
  Layers,
  Tag,
  Wallet,
  Calendar,
  ClipboardCheck,
  Receipt,
  ClipboardList,
  NotebookPen,
  UserCog,
  Boxes,
  Building2,
  Settings,
  Zap,
} from "lucide-react";

export interface SubNavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

export interface ModuleNavConfig {
  label: string;
  /** Pathnames that belong to this module (used to match current route) */
  matchPaths: string[];
  items: SubNavItem[];
}

/**
 * Module navigation configurations shared by ModuleSubNav and BottomNav.
 * Each entry defines a module with its sub-page items and the path prefixes
 * that indicate we are inside that module.
 */
export const MODULE_NAV: ModuleNavConfig[] = [
  {
    label: "Reproduction",
    matchPaths: ["/alevins"],
    items: [
      { href: "/alevins", label: "Dashboard", icon: LayoutDashboard },
      { href: "/alevins/reproducteurs", label: "Reproducteurs", icon: Fish },
      { href: "/alevins/pontes", label: "Pontes", icon: Egg },
      { href: "/alevins/lots", label: "Lots", icon: Layers },
    ],
  },
  {
    label: "Grossissement",
    matchPaths: ["/vagues", "/bacs", "/releves", "/analytics/bacs", "/analytics/vagues"],
    items: [
      { href: "/vagues", label: "Vagues", icon: Waves },
      { href: "/bacs", label: "Bacs", icon: Container },
      { href: "/releves/nouveau", label: "Releve", icon: PlusCircle },
      { href: "/analytics/bacs", label: "An. bacs", icon: BarChart3 },
      { href: "/analytics/vagues", label: "An. vagues", icon: LineChart },
    ],
  },
  {
    label: "Intrants",
    matchPaths: ["/stock", "/analytics/aliments"],
    items: [
      { href: "/stock", label: "Dashboard", icon: LayoutDashboard },
      { href: "/stock/produits", label: "Produits", icon: Tag },
      { href: "/stock/fournisseurs", label: "Fournisseurs", icon: Truck },
      { href: "/stock/commandes", label: "Commandes", icon: ShoppingCart },
      { href: "/stock/mouvements", label: "Mouvements", icon: ArrowUpDown },
    ],
  },
  {
    label: "Ventes",
    matchPaths: ["/ventes", "/clients", "/factures", "/finances", "/depenses", "/besoins"],
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
    matchPaths: ["/analytics", "/planning", "/mes-taches", "/notifications"],
    items: [
      { href: "/analytics", label: "Vue globale", icon: BarChart3 },
      { href: "/planning", label: "Calendrier", icon: Calendar },
      { href: "/mes-taches", label: "Taches", icon: ClipboardCheck },
    ],
  },
  {
    label: "Packs & Provisioning",
    matchPaths: ["/packs", "/activations"],
    items: [
      { href: "/packs", label: "Packs", icon: Boxes },
      { href: "/activations", label: "Activations", icon: ClipboardCheck },
    ],
  },
  {
    label: "Configuration",
    matchPaths: ["/settings/sites", "/settings/config-elevage", "/settings/alertes", "/settings/regles-activites"],
    items: [
      { href: "/settings/sites", label: "Sites", icon: Building2 },
      { href: "/settings/config-elevage", label: "Profils", icon: Settings },
      { href: "/settings/alertes", label: "Alertes", icon: Settings },
      { href: "/settings/regles-activites", label: "Regles d'activites", icon: Zap },
    ],
  },
  {
    label: "Utilisateurs",
    matchPaths: ["/users"],
    items: [
      { href: "/users", label: "Liste", icon: Users },
      { href: "/users/nouveau", label: "Nouveau", icon: UserPlus },
    ],
  },
  {
    label: "Ingenieur",
    matchPaths: ["/ingenieur", "/notes"],
    items: [
      { href: "/ingenieur", label: "Clients", icon: UserCog },
      { href: "/notes", label: "Notes", icon: NotebookPen },
    ],
  },
];

/**
 * Given a pathname, return the matching ModuleNavConfig or null.
 * Matches the most specific path first (longer matchPaths checked first).
 */
export function getModuleNavForPath(pathname: string): ModuleNavConfig | null {
  // Check specific sub-paths first (e.g. /analytics/bacs before /analytics)
  for (const mod of MODULE_NAV) {
    for (const mp of mod.matchPaths) {
      if (pathname === mp || pathname.startsWith(mp + "/")) {
        return mod;
      }
    }
  }
  return null;
}
