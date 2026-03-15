"use client";

import { cn } from "@/lib/utils";
import type { BenchmarkLevel } from "@/lib/benchmarks";

interface BenchmarkBadgeProps {
  level: BenchmarkLevel | null;
  className?: string;
}

const levelConfig: Record<BenchmarkLevel, { label: string; classes: string }> = {
  EXCELLENT: {
    label: "Excellent",
    classes: "bg-accent-green-muted text-accent-green",
  },
  BON: {
    label: "Bon",
    classes: "bg-accent-blue-muted text-accent-blue",
  },
  ACCEPTABLE: {
    label: "Acceptable",
    classes: "bg-accent-amber-muted text-accent-amber",
  },
  MAUVAIS: {
    label: "Mauvais",
    classes: "bg-accent-red-muted text-accent-red",
  },
};

/**
 * Badge visuel indiquant le niveau de benchmark d'un indicateur.
 * 4 niveaux : EXCELLENT (vert), BON (bleu), ACCEPTABLE (orange), MAUVAIS (rouge).
 *
 * Utilise les CSS variables du theme (R6).
 */
export function BenchmarkBadge({ level, className }: BenchmarkBadgeProps) {
  if (level === null) return null;

  const config = levelConfig[level];

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        config.classes,
        className
      )}
    >
      {config.label}
    </span>
  );
}

/**
 * Point coloré (indicateur compact) pour une utilisation dans des listes.
 */
export function BenchmarkDot({ level, className }: BenchmarkBadgeProps) {
  const dotClasses: Record<BenchmarkLevel, string> = {
    EXCELLENT: "bg-accent-green",
    BON: "bg-accent-blue",
    ACCEPTABLE: "bg-accent-amber",
    MAUVAIS: "bg-accent-red",
  };

  if (level === null) return <span className={cn("h-2 w-2 rounded-full bg-muted-foreground/40", className)} />;

  return (
    <span
      className={cn(
        "inline-block h-2 w-2 rounded-full shrink-0",
        dotClasses[level],
        className
      )}
    />
  );
}
