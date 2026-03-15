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
  Receipt,
  ClipboardList,
  NotebookPen,
  UserCog,
  Boxes,
  Settings,
  Eye,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Permission, Role } from "@/types";
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

// Navigation PISCICULTEUR — opérations de base terrain
const pisciculteurItems: NavItem[] = [
  { href: "/", label: "Accueil", icon: LayoutDashboard },
  { href: "/mes-taches", label: "Mes tâches", icon: ClipboardCheck },
  { href: "/notes", label: "Notes", icon: NotebookPen },
  { href: "/releves/nouveau", label: "Observations", icon: Eye },
];

// Navigation INGENIEUR — suivi clients et notes
const ingenieurItems: NavItem[] = [
  { href: "/", label: "Accueil", icon: LayoutDashboard },
  { href: "/ingenieur", label: "Clients", icon: Users },
  { href: "/notes", label: "Notes", icon: NotebookPen },
];

// Navigation ADMIN/GERANT — gestion complète
const adminGerantItems: NavItem[] = [
  { href: "/", label: "Accueil", icon: LayoutDashboard },
  { href: "/vagues", label: "Vagues", icon: Waves },
  { href: "/stock", label: "Stock", icon: Package },
  { href: "/ingenieur", label: "Ingénieur", icon: UserCog },
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
  { href: "/depenses", label: "Depenses", icon: Receipt },
  { href: "/besoins", label: "Besoins", icon: ClipboardList },
];

const pilotageItems: NavItem[] = [
  { href: "/analytics", label: "Analyse", icon: BarChart3 },
  { href: "/planning", label: "Planning", icon: Calendar },
  { href: "/mes-taches", label: "Taches", icon: ClipboardCheck },
  { href: "/notifications", label: "Alertes", icon: Bell },
];

// Navigation Phase 3 — Packs, Activations, Config élevage
const phase3Items: NavItem[] = [
  { href: "/packs", label: "Packs", icon: Boxes },
  { href: "/activations", label: "Activations", icon: ClipboardCheck },
  { href: "/settings/config-elevage", label: "Config.", icon: Settings },
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
    pathname.startsWith("/finances") ||
    pathname.startsWith("/depenses") ||
    pathname.startsWith("/besoins")
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

/**
 * Détermine les items de navigation par défaut selon le rôle utilisateur.
 * PISCICULTEUR et INGENIEUR ont une navigation simplifiée et ciblée.
 * ADMIN et GERANT voient la navigation complète.
 */
function getDefaultItemsByRole(role: Role | null): NavItem[] {
  if (role === Role.PISCICULTEUR) return pisciculteurItems;
  if (role === Role.INGENIEUR) return ingenieurItems;
  // ADMIN, GERANT ou null (non authentifié) → nav complète
  return adminGerantItems;
}

export function BottomNav({ permissions, role }: { permissions: Permission[]; role: Role | null }) {
  const pathname = usePathname();

  // Masquer la bottom-nav sur les pages de gestion de sites (hors scope site)
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
    pathname.startsWith("/finances") ||
    pathname.startsWith("/depenses") ||
    pathname.startsWith("/besoins");
  const isPilotage =
    pathname === "/analytics" ||
    pathname.startsWith("/planning") ||
    pathname.startsWith("/mes-taches") ||
    pathname.startsWith("/notifications") ||
    pathname.startsWith("/settings/alertes");
  // Phase 3 — Packs & Config élevage
  const isPhase3 =
    pathname.startsWith("/packs") ||
    pathname.startsWith("/activations") ||
    pathname.startsWith("/settings/config-elevage");
  // Ingénieur & Notes
  const isIngenieur = pathname.startsWith("/ingenieur");
  const isNotes = pathname.startsWith("/notes");

  let navItems: NavItem[];

  // Pour PISCICULTEUR et INGENIEUR : pas de navigation contextuelle — toujours leur nav dédiée
  if (role === Role.PISCICULTEUR) {
    navItems = pisciculteurItems;
  } else if (role === Role.INGENIEUR) {
    navItems = ingenieurItems;
  } else {
    // ADMIN / GERANT : navigation contextuelle selon la section
    navItems = isReproduction
      ? reproductionItems
      : isGrossissement
        ? grossissementItems
        : isIntrants
          ? intrantsItems
          : isVentes
            ? ventesItems
            : isPilotage
              ? pilotageItems
              : isPhase3
                ? phase3Items
                : (isIngenieur || isNotes)
                  ? ingenieurItems
                  : getDefaultItemsByRole(role);

    // Pour la nav contextuelle, vérifier la permission de module
    const currentModule = getModuleForPath(pathname);
    if (currentModule) {
      const required = MODULE_VIEW_PERMISSIONS[currentModule];
      if (required && !permissions.includes(required)) {
        navItems = getDefaultItemsByRole(role);
      }
    }

    // Filtrer les items par défaut par permission
    if (navItems === adminGerantItems) {
      navItems = adminGerantItems.filter((item) => {
        if (item.href === "/") return permissions.includes(Permission.DASHBOARD_VOIR);
        if (item.href === "/vagues") return permissions.includes(Permission.VAGUES_VOIR);
        if (item.href === "/stock") return permissions.includes(Permission.STOCK_VOIR);
        if (item.href === "/ingenieur") return permissions.includes(Permission.MONITORING_CLIENTS);
        return true;
      });
    }
  }

  // Appliquer le filtre par permission sur tous les ensembles (sauf pour les items custom)
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
            item.href === "/" || item.href === "/stock" || item.href === "/alevins" || item.href === "/analytics" || item.href === "/planning" || item.href === "/finances" || item.href === "/mes-taches" || item.href === "/depenses" || item.href === "/besoins" || item.href === "/ingenieur" || item.href === "/notes" || item.href === "/packs" || item.href === "/activations"
              ? pathname === item.href || pathname.startsWith(item.href + "/")
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
