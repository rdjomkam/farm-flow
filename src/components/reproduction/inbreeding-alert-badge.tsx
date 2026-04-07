"use client";

import { AlertTriangle } from "lucide-react";
import { useTranslations } from "next-intl";

interface InbreedingAlertBadgeProps {
  ponteCount?: number;
  generation?: string;
  className?: string;
}

/**
 * Generations that trigger a caution indicator.
 * G3_PLUS is the enum value meaning F3 or higher.
 */
const HIGH_RISK_GENERATIONS = new Set(["G3_PLUS", "F3", "F4", "F5"]);

/** Number of reuses of the same pair that triggers the inbreeding alert. */
const PONTE_COUNT_THRESHOLD = 3;

export function InbreedingAlertBadge({
  ponteCount,
  generation,
  className = "",
}: InbreedingAlertBadgeProps) {
  const t = useTranslations("reproduction.badge");

  const hasPonteRisk =
    ponteCount !== undefined && ponteCount >= PONTE_COUNT_THRESHOLD;
  const hasGenerationRisk =
    generation !== undefined && HIGH_RISK_GENERATIONS.has(generation);

  if (!hasPonteRisk && !hasGenerationRisk) {
    return null;
  }

  const tooltipText = hasPonteRisk
    ? t("consanguiniteTooltip", { count: ponteCount })
    : t("generationElevee", { gen: generation ?? "" });

  return (
    <span
      role="status"
      aria-label={t("consanguinite")}
      title={tooltipText}
      className={[
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1",
        "text-xs font-medium cursor-default select-none",
        "bg-amber-100 text-amber-700",
        "dark:bg-amber-900/30 dark:text-amber-400",
        "border border-amber-200 dark:border-amber-700/50",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <AlertTriangle className="h-3 w-3 shrink-0" aria-hidden="true" />
      {t("consanguinite")}
    </span>
  );
}
