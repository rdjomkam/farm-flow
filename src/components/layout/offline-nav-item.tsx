"use client";

import { useCallback } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

/** Routes that remain active offline (cached shell) */
const OFFLINE_CACHED_ROUTES = ["/", "/mes-taches"];

interface OfflineNavLinkProps {
  href: string;
  isOnline: boolean;
  className?: string;
  activeClassName?: string;
  children: React.ReactNode;
  onClick?: () => void;
}

export function OfflineNavLink({
  href,
  isOnline,
  className,
  children,
  onClick,
}: OfflineNavLinkProps) {
  const isCached = OFFLINE_CACHED_ROUTES.some(
    (r) => href === r || href.startsWith(r + "/")
  );
  const isDisabled = !isOnline && !isCached;

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if (isDisabled) {
        e.preventDefault();
        // Could show a toast here — for now just prevent navigation
      } else {
        onClick?.();
      }
    },
    [isDisabled, onClick]
  );

  if (isDisabled) {
    return (
      <span
        className={cn(className, "opacity-50 pointer-events-none")}
        aria-disabled="true"
        role="link"
      >
        {children}
      </span>
    );
  }

  return (
    <Link href={href} className={className} onClick={handleClick}>
      {children}
    </Link>
  );
}
