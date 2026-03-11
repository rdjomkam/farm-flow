"use client";

import { cn } from "@/lib/utils";
import type { BenchmarkLevel } from "@/lib/benchmarks";

const levelStyles: Record<BenchmarkLevel, string> = {
  EXCELLENT: "bg-accent-green-muted text-accent-green",
  BON: "bg-accent-emerald-muted text-accent-emerald",
  ACCEPTABLE: "bg-accent-amber-muted text-accent-amber",
  MAUVAIS: "bg-accent-red-muted text-accent-red",
};

const levelLabels: Record<BenchmarkLevel, string> = {
  EXCELLENT: "Excellent",
  BON: "Bon",
  ACCEPTABLE: "Acceptable",
  MAUVAIS: "Mauvais",
};

interface BenchmarkBadgeProps {
  level: BenchmarkLevel | null;
  className?: string;
}

export function BenchmarkBadge({ level, className }: BenchmarkBadgeProps) {
  if (!level) {
    return (
      <span
        className={cn(
          "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-muted text-muted-foreground",
          className
        )}
      >
        —
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        levelStyles[level],
        className
      )}
    >
      {levelLabels[level]}
    </span>
  );
}
