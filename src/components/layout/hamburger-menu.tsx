"use client";

import { useMemo } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
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
  UserPlus,
  CreditCard,
  ShieldCheck,
  LayoutList,
  Globe,
  Shield,
} from "lucide-react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { Permission, Role, SiteModule } from "@/types";
import { MODULE_VIEW_PERMISSIONS, ITEM_VIEW_PERMISSIONS, MODULE_LABEL_TO_SITE_MODULE } from "@/lib/permissions-constants";
import { useAuthService } from "@/services";
import { LanguageSwitcher } from "./language-switcher";

const roleKeyMap: Record<Role, string> = {
  ADMIN: "admin",
  GERANT: "gerant",
  PISCICULTEUR: "pisciculteur",
  INGENIEUR: "ingenieur",
};

interface NavItem {
  href: string;
  /** i18n key under navigation.items.* */
  itemKey: string;
  icon: React.ComponentType<{ className?: string }>;
  disabled?: boolean;
}

// ---------------------------------------------------------------------------
// Modules ADMIN / GERANT (mirrors sidebar exactly)
// ---------------------------------------------------------------------------

const modulesAdminGerant: {
  /** Internal permission-lookup key */
  label: string;
  /** i18n key under navigation.modules.* */
  moduleKey: string;
  primaryHref: string;
  icon: React.ComponentType<{ className?: string }>;
  items: NavItem[];
}[] = [
  {
    label: "Reproduction",
    moduleKey: "reproduction",
    primaryHref: "/alevins",
    icon: Egg,
    items: [
      { href: "/alevins", itemKey: "dashboard", icon: LayoutDashboard },
      { href: "/alevins/reproducteurs", itemKey: "reproducteurs", icon: Fish },
      { href: "/alevins/pontes", itemKey: "pontes", icon: Egg },
      { href: "/alevins/lots", itemKey: "lotsAlevins", icon: Layers },
    ],
  },
  {
    label: "Grossissement",
    moduleKey: "grossissement",
    primaryHref: "/vagues",
    icon: Waves,
    items: [
      { href: "/vagues", itemKey: "vagues", icon: Waves },
      { href: "/bacs", itemKey: "bacs", icon: Container },
      { href: "/releves/nouveau", itemKey: "nouveauReleve", icon: PlusCircle },
      { href: "/analytics/bacs", itemKey: "analytiquesBacs", icon: BarChart3 },
      { href: "/analytics/vagues", itemKey: "analytiquesVagues", icon: LineChart },
    ],
  },
  {
    label: "Intrants",
    moduleKey: "intrants",
    primaryHref: "/stock",
    icon: Package,
    items: [
      { href: "/stock", itemKey: "dashboard", icon: LayoutDashboard },
      { href: "/stock/produits", itemKey: "produits", icon: Tag },
      { href: "/stock/fournisseurs", itemKey: "fournisseurs", icon: Truck },
      { href: "/stock/commandes", itemKey: "commandes", icon: ShoppingCart },
      { href: "/stock/mouvements", itemKey: "mouvements", icon: ArrowUpDown },
      { href: "/analytics/aliments", itemKey: "analytiquesAliments", icon: BarChart3 },
    ],
  },
  {
    label: "Ventes",
    moduleKey: "ventes",
    primaryHref: "/ventes",
    icon: ShoppingCart,
    items: [
      { href: "/clients", itemKey: "clients", icon: Users },
      { href: "/ventes", itemKey: "ventesItem", icon: Banknote },
      { href: "/factures", itemKey: "factures", icon: FileText },
      { href: "/finances", itemKey: "finances", icon: Wallet },
      { href: "/depenses", itemKey: "depenses", icon: Receipt },
      { href: "/besoins", itemKey: "besoins", icon: ClipboardList },
    ],
  },
  {
    label: "Analyse & Pilotage",
    moduleKey: "analysePilotage",
    primaryHref: "/analytics",
    icon: BarChart3,
    items: [
      { href: "/analytics", itemKey: "vueGlobale", icon: BarChart3 },
      { href: "/planning", itemKey: "calendrier", icon: Calendar },
      { href: "/planning/nouvelle", itemKey: "nouvelleActivite", icon: PlusCircle },
      { href: "/mes-taches", itemKey: "mesTaches", icon: ClipboardCheck },
      { href: "/analytics/finances", itemKey: "analytiquesFinances", icon: Banknote, disabled: true },
      { href: "/analytics/tendances", itemKey: "tendances", icon: TrendingUp, disabled: true },
    ],
  },
  {
    label: "Packs & Provisioning",
    moduleKey: "packsProvisioning",
    primaryHref: "/packs",
    icon: Boxes,
    items: [
      { href: "/packs", itemKey: "packs", icon: Boxes },
      { href: "/activations", itemKey: "activations", icon: ClipboardCheck },
    ],
  },
  {
    label: "Ingenieur",
    moduleKey: "ingenieur",
    primaryHref: "/ingenieur",
    icon: UserCog,
    items: [
      { href: "/ingenieur", itemKey: "dashboardClients", icon: LayoutDashboard },
      { href: "/notes", itemKey: "notes", icon: NotebookPen },
    ],
  },
  // Configuration — unified settings module
  {
    label: "Configuration",
    moduleKey: "configuration",
    primaryHref: "/settings/sites",
    icon: Settings,
    items: [
      { href: "/settings/sites", itemKey: "sites", icon: Building2 },
      { href: "/settings/config-elevage", itemKey: "profilsElevage", icon: Settings },
      { href: "/settings/alertes", itemKey: "configAlertes", icon: Settings },
      { href: "/settings/regles-activites", itemKey: "reglesActivites", icon: Zap },
    ],
  },
  // Abonnement — Sprint 33 (gate: ABONNEMENTS_VOIR)
  {
    label: "Abonnement",
    moduleKey: "abonnement",
    primaryHref: "/mon-abonnement",
    icon: CreditCard,
    items: [
      { href: "/mon-abonnement", itemKey: "monAbonnement", icon: CreditCard },
      { href: "/tarifs", itemKey: "plansTarifs", icon: Tag },
    ],
  },
  // ADR-022: Admin Plateforme supprimé. Remplacé par lien Backoffice conditionnel (isSuperAdmin).
  // Portefeuille Ingénieur — Sprint 34 (gate: PORTEFEUILLE_VOIR)
  {
    label: "Portefeuille",
    moduleKey: "portefeuille",
    primaryHref: "/mon-portefeuille",
    icon: Wallet,
    items: [
      { href: "/mon-portefeuille", itemKey: "monPortefeuille", icon: Wallet },
    ],
  },
  {
    label: "Utilisateurs",
    moduleKey: "utilisateurs",
    primaryHref: "/users",
    icon: Users,
    items: [
      { href: "/users", itemKey: "liste", icon: Users },
      { href: "/users/nouveau", itemKey: "nouveau", icon: UserPlus },
    ],
  },
];

// ---------------------------------------------------------------------------
// Phase 3 permission gates
// ---------------------------------------------------------------------------

const PHASE3_MODULE_PERMISSIONS: Record<string, Permission> = {
  "Packs & Provisioning": Permission.ACTIVER_PACKS,
  "Ingenieur":            Permission.MONITORING_CLIENTS,
  "Utilisateurs":         Permission.UTILISATEURS_VOIR,
  // Sprint 33 — Abonnements
  "Abonnement":           Permission.ABONNEMENTS_VOIR,
  // ADR-022: Admin Plateforme supprimé — accès via /backoffice (isSuperAdmin)
  // Sprint 34 — Commissions & Portefeuille
  "Portefeuille":         Permission.PORTEFEUILLE_VOIR,
};

interface HamburgerMenuProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  permissions: Permission[];
  role: Role | null;
  userName: string | null;
  siteModules: SiteModule[];
  isSuperAdmin?: boolean;
}

export function HamburgerMenu({ open, onOpenChange, permissions, role, userName, siteModules, isSuperAdmin = false }: HamburgerMenuProps) {
  const pathname = usePathname();
  const router = useRouter();
  const authService = useAuthService();
  const t = useTranslations("navigation");

  // Select modules by role (same logic as sidebar)
  const allModules = useMemo(() => {
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
    if (href === "/" || href === "/stock" || href === "/alevins" || href === "/analytics" || href === "/planning" || href === "/finances" || href === "/mes-taches" || href === "/ingenieur" || href === "/notes" || href === "/packs" || href === "/activations" || href === "/users")
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
    await authService.logout();
    router.push("/login");
    router.refresh();
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
                {t("items.dashboard")}
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
                  {t(`modules.${mod.moduleKey}`)}
                </Link>
              );
            })}

            {/* Lien Backoffice — visible uniquement pour les super-admins (ADR-022) */}
            {isSuperAdmin && (
              <Link
                href="/backoffice"
                onClick={() => onOpenChange(false)}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  pathname.startsWith("/backoffice")
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <Shield className="h-4 w-4" />
                Backoffice
              </Link>
            )}

          </nav>

          {/* Footer -- User info + Language + Logout */}
          <div className="border-t border-border p-3 space-y-2">
            {userName && role && (
              <div className="flex items-center gap-3 px-3 py-2">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <User className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{userName}</p>
                  <p className="text-xs text-muted-foreground">{t(`roles.${roleKeyMap[role]}`)}</p>
                </div>
              </div>
            )}
            <div className="flex items-center justify-between px-1">
              <span className="text-xs text-muted-foreground px-2">{t("actions.language")}</span>
              <LanguageSwitcher />
            </div>
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
  );
}
