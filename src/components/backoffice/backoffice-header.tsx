"use client";

/**
 * BackofficeHeader — header du backoffice DKFarm.
 *
 * - Titre "DKFarm Backoffice" avec badge distinctif
 * - Nom de l'utilisateur connecte
 * - Bouton hamburger sur mobile pour le sheet de navigation
 * - Mobile first 360px
 *
 * Story C.1 — ADR-022 Backoffice
 */

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  Shield,
  Menu,
  X,
  LayoutDashboard,
  Building2,
  ShieldCheck,
  LayoutList,
  TrendingUp,
  Tag,
  Boxes,
  ArrowLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  labelKey: string;
  icon: React.ComponentType<{ className?: string }>;
}

const NAV_ITEM_DEFS: NavItem[] = [
  { href: "/backoffice/dashboard",    labelKey: "dashboard",    icon: LayoutDashboard },
  { href: "/backoffice/sites",        labelKey: "sites",        icon: Building2 },
  { href: "/backoffice/abonnements",  labelKey: "abonnements",  icon: ShieldCheck },
  { href: "/backoffice/plans",        labelKey: "plans",        icon: LayoutList },
  { href: "/backoffice/commissions",  labelKey: "commissions",  icon: TrendingUp },
  { href: "/backoffice/remises",      labelKey: "remises",      icon: Tag },
  { href: "/backoffice/modules",      labelKey: "modules",      icon: Boxes },
];

interface BackofficeHeaderProps {
  userName: string;
  title?: string;
}

export function BackofficeHeader({ userName, title }: BackofficeHeaderProps) {
  const t = useTranslations("backoffice");
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();

  function isActive(href: string) {
    if (href === "/backoffice/dashboard") {
      return pathname === "/backoffice" || pathname.startsWith("/backoffice/dashboard");
    }
    return pathname.startsWith(href);
  }

  return (
    <>
      <header className="sticky top-0 z-30 flex min-h-14 items-center justify-between border-b border-border bg-card px-4 py-3">
        {/* Left — logo + title */}
        <div className="flex items-center gap-2 min-w-0">
          {/* Mobile hamburger */}
          <Button
            variant="ghost"
            className="h-9 w-9 p-0 md:hidden"
            onClick={() => setMenuOpen(true)}
          >
            <Menu className="h-5 w-5" />
            <span className="sr-only">{t("header.menuLabel")}</span>
          </Button>

          <Shield className="h-5 w-5 shrink-0 text-primary" />
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-sm font-bold truncate hidden sm:inline">{t("header.title")}</span>
            <span className="text-sm font-bold truncate sm:hidden">{t("header.titleMobile")}</span>
            <span className="hidden sm:inline rounded bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary shrink-0">
              {t("header.badge")}
            </span>
          </div>
          {title && (
            <>
              <span className="text-muted-foreground mx-1 hidden sm:inline">/</span>
              <span className="text-sm font-medium text-muted-foreground truncate hidden sm:inline">{title}</span>
            </>
          )}
        </div>

        {/* Right — user name */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-semibold">
            {userName.slice(0, 1).toUpperCase()}
          </div>
          <span className="hidden sm:block text-sm font-medium text-foreground truncate max-w-32">
            {userName}
          </span>
        </div>
      </header>

      {/* Mobile navigation sheet */}
      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent className="w-64 p-0">
          <div className="flex h-full flex-col">
            {/* Sheet header */}
            <div className="flex h-14 items-center justify-between border-b border-border px-4">
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                <span className="text-sm font-bold">DKFarm</span>
                <span className="rounded bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary">
                  BO
                </span>
              </div>
              <Button
                variant="ghost"
                className="h-8 w-8 p-0"
                onClick={() => setMenuOpen(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Nav items */}
            <nav className="flex-1 overflow-y-auto p-3 space-y-1">
              {NAV_ITEM_DEFS.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMenuOpen(false)}
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
            </nav>

            {/* Footer */}
            <div className="border-t border-border p-3">
              <Link
                href="/"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                <ArrowLeft className="h-4 w-4 shrink-0" />
                {t("header.retourApp")}
              </Link>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
