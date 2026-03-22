"use client";

import { useState, useEffect, useRef } from "react";
import { Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { NotificationBell } from "./notification-bell";
import { useMobileMenu } from "./mobile-menu-context";

interface HeaderProps {
  title: string;
  children?: React.ReactNode;
  className?: string;
}

export function Header({ title, children, className }: HeaderProps) {
  const { openMenu, isImpersonating } = useMobileMenu();
  const [visible, setVisible] = useState(true);
  const lastScrollY = useRef(0);

  useEffect(() => {
    const onScroll = () => {
      const currentY = window.scrollY;
      if (currentY <= 0) {
        setVisible(true);
      } else if (currentY < lastScrollY.current) {
        setVisible(true);
      } else if (currentY > lastScrollY.current + 10) {
        setVisible(false);
      }
      lastScrollY.current = currentY;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "sticky z-30 flex min-h-[calc(56px+env(safe-area-inset-top))] items-center justify-between border-b border-border bg-card px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] transition-transform duration-300 md:min-h-[56px] md:pt-3 md:translate-y-0",
        isImpersonating ? "top-14 sm:top-11" : "top-[env(safe-area-inset-top)]",
        !visible && "-translate-y-full",
        className
      )}
    >
      <div className="flex items-center gap-2 min-w-0">
        <div className="flex items-center gap-1 md:hidden">
          <Button variant="ghost" className="h-11 w-11 p-0" onClick={openMenu}>
            <Menu className="h-5 w-5" />
            <span className="sr-only">Menu</span>
          </Button>
          <NotificationBell />
        </div>
        <h1 className="text-lg font-semibold truncate">{title}</h1>
      </div>
      {children && <div className="flex items-center gap-2 shrink-0">{children}</div>}
    </header>
  );
}
