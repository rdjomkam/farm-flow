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
  CreditCard,
} from "lucide-react";

export interface SubNavItem {
  href: string;
  /** Display label (kept for backward compatibility) */
  label: string;
  /** i18n key under navigation.items.* — used by BottomNav */
  itemKey: string;
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
    matchPaths: ["/reproduction", "/alevins"],
    items: [
      { href: "/reproduction", label: "Dashboard", itemKey: "dashboard", icon: LayoutDashboard },
      { href: "/reproduction/geniteurs", label: "Géniteurs", itemKey: "geniteurs", icon: Fish },
      { href: "/reproduction/pontes", label: "Pontes", itemKey: "pontes", icon: Egg },
      { href: "/reproduction/lots", label: "Lots", itemKey: "lots", icon: Layers },
      { href: "/reproduction/planning", label: "Planning", itemKey: "planning", icon: Calendar },
    ],
  },
  {
    label: "Grossissement",
    matchPaths: ["/vagues", "/bacs", "/releves", "/analytics/bacs", "/analytics/vagues"],
    items: [
      { href: "/vagues", label: "Vagues", itemKey: "vagues", icon: Waves },
      { href: "/bacs", label: "Bacs", itemKey: "bacs", icon: Container },
      { href: "/releves/nouveau", label: "Releve", itemKey: "releve", icon: PlusCircle },
      { href: "/analytics/bacs", label: "An. bacs", itemKey: "anBacs", icon: BarChart3 },
      { href: "/analytics/vagues", label: "An. vagues", itemKey: "anVagues", icon: LineChart },
    ],
  },
  {
    label: "Intrants",
    matchPaths: ["/stock"],
    items: [
      { href: "/stock", label: "Dashboard", itemKey: "dashboard", icon: LayoutDashboard },
      { href: "/stock/produits", label: "Produits", itemKey: "produits", icon: Tag },
      { href: "/stock/fournisseurs", label: "Fournisseurs", itemKey: "fournisseurs", icon: Truck },
      { href: "/stock/commandes", label: "Commandes", itemKey: "commandes", icon: ShoppingCart },
      { href: "/stock/mouvements", label: "Mouvements", itemKey: "mouvements", icon: ArrowUpDown },
    ],
  },
  {
    label: "Ventes",
    matchPaths: ["/ventes", "/clients", "/factures", "/finances", "/depenses", "/besoins"],
    items: [
      { href: "/clients", label: "Clients", itemKey: "clients", icon: Users },
      { href: "/ventes", label: "Ventes", itemKey: "ventesItem", icon: Banknote },
      { href: "/factures", label: "Factures", itemKey: "factures", icon: FileText },
      { href: "/finances", label: "Finances", itemKey: "finances", icon: Wallet },
      { href: "/depenses", label: "Depenses", itemKey: "depenses", icon: Receipt },
      { href: "/besoins", label: "Besoins", itemKey: "besoins", icon: ClipboardList },
    ],
  },
  {
    label: "Analyse & Pilotage",
    matchPaths: ["/analytics", "/planning", "/mes-taches", "/notifications"],
    items: [
      { href: "/analytics", label: "Vue globale", itemKey: "vueGlobale", icon: BarChart3 },
      { href: "/analytics/aliments", label: "Aliments", itemKey: "aliments", icon: Package },
      { href: "/planning", label: "Calendrier", itemKey: "calendrier", icon: Calendar },
      { href: "/mes-taches", label: "Taches", itemKey: "taches", icon: ClipboardCheck },
    ],
  },
  {
    label: "Packs & Provisioning",
    matchPaths: ["/packs", "/activations"],
    items: [
      { href: "/packs", label: "Packs", itemKey: "packs", icon: Boxes },
      { href: "/activations", label: "Activations", itemKey: "activations", icon: ClipboardCheck },
    ],
  },
  {
    label: "Configuration",
    matchPaths: ["/settings/sites", "/settings/config-elevage", "/settings/alertes", "/settings/regles-activites"],
    items: [
      { href: "/settings/sites", label: "Sites", itemKey: "sites", icon: Building2 },
      { href: "/settings/config-elevage", label: "Profils", itemKey: "profils", icon: Settings },
      { href: "/settings/alertes", label: "Alertes", itemKey: "alertes", icon: Settings },
      { href: "/settings/regles-activites", label: "Regles d'activites", itemKey: "reglesActivites", icon: Zap },
    ],
  },
  {
    label: "Utilisateurs",
    matchPaths: ["/users"],
    items: [
      { href: "/users", label: "Liste", itemKey: "liste", icon: Users },
      { href: "/users/nouveau", label: "Nouveau", itemKey: "nouveau", icon: UserPlus },
    ],
  },
  {
    label: "Ingenieur",
    matchPaths: ["/monitoring", "/notes"],
    items: [
      { href: "/monitoring", label: "Clients", itemKey: "clients", icon: UserCog },
      { href: "/notes", label: "Notes", itemKey: "notes", icon: NotebookPen },
    ],
  },
  // Sprint 33 — Abonnement (gate: ABONNEMENTS_VOIR)
  {
    label: "Abonnement",
    matchPaths: ["/mon-abonnement", "/tarifs", "/checkout"],
    items: [
      { href: "/mon-abonnement", label: "Mon abonnement", itemKey: "monAbonnement", icon: CreditCard },
      { href: "/tarifs", label: "Plans & tarifs", itemKey: "plansTarifs", icon: Tag },
    ],
  },
  // Sprint 34 — Portefeuille (gate: PORTEFEUILLE_VOIR)
  {
    label: "Portefeuille",
    matchPaths: ["/mon-portefeuille"],
    items: [
      { href: "/mon-portefeuille", label: "Mon portefeuille", itemKey: "monPortefeuille", icon: Wallet },
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
