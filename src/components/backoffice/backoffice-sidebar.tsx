"use client";

/**
 * BackofficeSidebar — barre de navigation du backoffice DKFarm.
 *
 * Items : Dashboard, Sites, Abonnements, Plans, Commissions, Remises, Modules
 * Lien "Retour a l'application" → /
 * Mobile : collapse automatique (hidden sur mobile, sheet via hamburger)
 *
 * Story C.1 — ADR-022 Backoffice
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  LayoutDashboard,
  Building2,
  ShieldCheck,
  LayoutList,
  TrendingUp,
  Tag,
  Boxes,
  ArrowLeft,
  Shield,
  Flag,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  labelKey: string;
  icon: React.ComponentType<{ className?: string }>;
}

const NAV_ITEM_DEFS: NavItem[] = [
  { href: "/backoffice/dashboard",      labelKey: "dashboard",      icon: LayoutDashboard },
  { href: "/backoffice/sites",          labelKey: "sites",          icon: Building2 },
  { href: "/backoffice/abonnements",    labelKey: "abonnements",    icon: ShieldCheck },
  { href: "/backoffice/plans",          labelKey: "plans",          icon: LayoutList },
  { href: "/backoffice/commissions",    labelKey: "commissions",    icon: TrendingUp },
  { href: "/backoffice/remises",        labelKey: "remises",        icon: Tag },
  { href: "/backoffice/modules",        labelKey: "modules",        icon: Boxes },
  { href: "/backoffice/feature-flags",  labelKey: "featureFlags",   icon: Flag },
];

export function BackofficeSidebar() {
  const t = useTranslations("backoffice");
  const pathname = usePathname();

  function isActive(href: string) {
    if (href === "/backoffice/dashboard") {
      return pathname === "/backoffice" || pathname.startsWith("/backoffice/dashboard");
    }
    return pathname.startsWith(href);
  }

  return (
    <aside className="hidden md:flex md:w-56 md:flex-col md:border-r md:border-border md:bg-card">
      {/* Header */}
      <div className="flex h-14 items-center gap-2 border-b border-border px-4">
        <Shield className="h-5 w-5 text-primary" />
        <div className="min-w-0">
          <span className="text-sm font-bold leading-tight">DKFarm</span>
          <span className="ml-1.5 rounded bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary">
            {t("sidebar.badge")}
          </span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex flex-1 flex-col overflow-y-auto p-2">
        <div className="space-y-1">
          {NAV_ITEM_DEFS.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {t(`nav.${item.labelKey}`)}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Footer — retour app */}
      <div className="border-t border-border p-2">
        <Link
          href="/"
          className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4 shrink-0" />
          {t("sidebar.retourApp")}
        </Link>
      </div>
    </aside>
  );
}
