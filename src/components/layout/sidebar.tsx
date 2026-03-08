"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Waves, PlusCircle, Container, Fish } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/vagues", label: "Vagues", icon: Waves },
  { href: "/releves/nouveau", label: "Nouveau relevé", icon: PlusCircle },
  { href: "/bacs", label: "Bacs", icon: Container },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex md:w-60 md:flex-col md:border-r md:border-border md:bg-card">
      <div className="flex h-14 items-center gap-2 border-b border-border px-4">
        <Fish className="h-6 w-6 text-primary" />
        <span className="text-lg font-bold">Suivi Silures</span>
      </div>
      <nav className="flex flex-1 flex-col gap-1 p-2">
        {navItems.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Icon className="h-5 w-5" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
