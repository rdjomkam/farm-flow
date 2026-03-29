"use client";

import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

interface HeaderProps {
  title: string;
  children?: React.ReactNode;
  className?: string;
}

export function Header({ title, children, className }: HeaderProps) {
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
        // Mobile: simple static bar showing only the page title — no fixed positioning,
        // no hamburger, no bell (FarmHeader/IngenieurHeader handles those at z-50).
        "flex min-h-[48px] items-center justify-between border-b border-border bg-card px-4 py-3",
        // Desktop: sticky title bar with hide-on-scroll behaviour
        "md:sticky md:top-0 md:z-30 md:min-h-[56px] md:transition-transform md:duration-300",
        !visible && "md:-translate-y-full",
        className
      )}
    >
      <div className="flex items-center gap-2 min-w-0">
        <h1 className="text-lg font-semibold truncate">{title}</h1>
      </div>
      {children && <div className="flex items-center gap-2 shrink-0">{children}</div>}
    </header>
  );
}
