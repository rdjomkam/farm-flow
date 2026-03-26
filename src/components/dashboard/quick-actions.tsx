"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { PlusCircle, Waves, FileText, Package, ClipboardCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { Permission } from "@/types";
import { useActiviteService } from "@/services";

interface QuickAction {
  href: string;
  label: string;
  icon: React.ElementType;
  bgClass: string;
  iconColor: string;
  permission: Permission;
  badge?: number;
}

const baseActions: QuickAction[] = [
  { href: "/releves/nouveau", label: "Nouveau releve", icon: PlusCircle, bgClass: "bg-primary/10", iconColor: "text-primary", permission: Permission.RELEVES_CREER },
  { href: "/mes-taches", label: "Mes taches", icon: ClipboardCheck, bgClass: "bg-accent-green-muted", iconColor: "text-accent-green", permission: Permission.PLANNING_VOIR },
  { href: "/vagues", label: "Voir les vagues", icon: Waves, bgClass: "bg-accent-blue-muted", iconColor: "text-accent-blue", permission: Permission.VAGUES_VOIR },
  { href: "/factures", label: "Factures", icon: FileText, bgClass: "bg-accent-amber-muted", iconColor: "text-accent-amber", permission: Permission.FACTURES_VOIR },
  { href: "/stock", label: "Stock", icon: Package, bgClass: "bg-accent-purple-muted", iconColor: "text-accent-purple", permission: Permission.STOCK_VOIR },
];

interface QuickActionsProps {
  permissions: Permission[];
}

export function QuickActions({ permissions }: QuickActionsProps) {
  const activiteService = useActiviteService();
  const [taskCount, setTaskCount] = useState(0);

  useEffect(() => {
    if (permissions.includes(Permission.PLANNING_VOIR)) {
      activiteService.getMesTachesCount().then(({ data }) => {
        setTaskCount(data?.count ?? 0);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [permissions]);

  const visibleActions = baseActions
    .filter((a) => permissions.includes(a.permission))
    .map((a) => {
      if (a.href === "/mes-taches") return { ...a, badge: taskCount };
      return a;
    });

  if (visibleActions.length === 0) return null;

  return (
    <section>
      <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Actions rapides</h2>
      <div className="overflow-hidden -mx-4 md:mx-0">
      <div className="flex gap-3 overflow-x-auto pb-1 px-4 md:px-0 md:grid md:grid-cols-4">
        {visibleActions.map((action) => (
          <Link key={action.href} href={action.href} className="shrink-0">
            <div className={cn("relative flex items-center gap-3 rounded-xl px-4 py-3 min-w-[140px] transition-all hover:scale-[1.02]", action.bgClass)}>
              <action.icon className={cn("h-5 w-5", action.iconColor)} />
              <span className="text-sm font-medium whitespace-nowrap">{action.label}</span>
              {action.badge !== undefined && action.badge > 0 && (
                <span className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-danger text-[10px] font-bold text-white px-1">
                  {action.badge}
                </span>
              )}
            </div>
          </Link>
        ))}
      </div>
      </div>
    </section>
  );
}
