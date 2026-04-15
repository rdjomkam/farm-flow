"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";

// ---------------------------------------------------------------------------
// Phase color palette (ADR-044 §9)
// ---------------------------------------------------------------------------

const PHASE_COLORS: Record<string, { bg: string; text: string; dot: string }> =
  {
    INCUBATION: {
      bg: "bg-[#7c3aed]",
      text: "text-white",
      dot: "bg-[#7c3aed]",
    },
    LARVAIRE: {
      bg: "bg-[#2563eb]",
      text: "text-white",
      dot: "bg-[#2563eb]",
    },
    NURSERIE: {
      bg: "bg-[#16a34a]",
      text: "text-white",
      dot: "bg-[#16a34a]",
    },
    ALEVINAGE: {
      bg: "bg-[#15803d]",
      text: "text-white",
      dot: "bg-[#15803d]",
    },
    SORTI: {
      bg: "bg-[#6b7280]",
      text: "text-white",
      dot: "bg-[#6b7280]",
    },
    PERDU: {
      bg: "bg-[#dc2626]",
      text: "text-white",
      dot: "bg-[#dc2626]",
    },
  };

function getPhaseColor(phase: string) {
  return (
    PHASE_COLORS[phase.toUpperCase()] ?? {
      bg: "bg-muted",
      text: "text-foreground",
      dot: "bg-muted",
    }
  );
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface GanttLot {
  id: string;
  code: string;
  phase: string;
  dateDebutPhase: string;
  ageJours: number;
  nombreActuel: number;
}

interface LotsGanttViewProps {
  lots: GanttLot[];
  dateDebut: Date;
  dateFin: Date;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

function formatDateShort(date: Date): string {
  return date.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function LotsGanttView({ lots, dateDebut, dateFin }: LotsGanttViewProps) {
  const t = useTranslations("reproduction.planning");

  const totalDays = useMemo(
    () => Math.max(daysBetween(dateDebut, dateFin), 1),
    [dateDebut, dateFin]
  );

  // Generate week markers
  const weekMarkers = useMemo(() => {
    const markers: { label: string; offsetPercent: number }[] = [];
    let current = new Date(dateDebut);
    // align to next Monday if not already
    while (current <= dateFin) {
      const offsetDays = daysBetween(dateDebut, current);
      const offsetPercent = (offsetDays / totalDays) * 100;
      if (offsetPercent >= 0 && offsetPercent <= 100) {
        markers.push({ label: formatDateShort(current), offsetPercent });
      }
      current = addDays(current, 7);
    }
    return markers;
  }, [dateDebut, dateFin, totalDays]);

  // Calculate bar position and width for each lot
  const lotBars = useMemo(() => {
    return lots.map((lot) => {
      const lotStart = new Date(lot.dateDebutPhase);
      const lotEnd = addDays(lotStart, lot.ageJours);

      // Clamp to range
      const clampedStart = lotStart < dateDebut ? dateDebut : lotStart;
      const clampedEnd = lotEnd > dateFin ? dateFin : lotEnd;

      const startOffset = daysBetween(dateDebut, clampedStart);
      const duration = daysBetween(clampedStart, clampedEnd);

      const leftPercent = Math.max(0, (startOffset / totalDays) * 100);
      const widthPercent = Math.max(0.5, (duration / totalDays) * 100);

      return { lot, leftPercent, widthPercent };
    });
  }, [lots, dateDebut, dateFin, totalDays]);

  if (lots.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4 text-center">
        {t("aucunEvenement")}
      </p>
    );
  }

  return (
    <div className="w-full">
      {/* Mobile: simplified list view */}
      <div className="block sm:hidden">
        <div className="flex flex-col gap-2">
          {lots.map((lot) => {
            const colors = getPhaseColor(lot.phase);
            return (
              <div
                key={lot.id}
                className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card"
              >
                <span
                  className={`w-3 h-3 rounded-full shrink-0 ${colors.dot}`}
                  aria-hidden="true"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{lot.code}</p>
                  <p className="text-xs text-muted-foreground">
                    {t("lotMobileSubline", {
                      phase: lot.phase,
                      age: lot.ageJours,
                      count: lot.nombreActuel.toLocaleString("fr-FR"),
                    })}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Desktop / tablet: Gantt chart */}
      <div className="hidden sm:block overflow-x-auto">
        <div className="min-w-[600px]">
          {/* Date header */}
          <div className="flex mb-2 relative h-6">
            {/* left label column spacer */}
            <div className="w-40 shrink-0" />
            {/* markers */}
            <div className="flex-1 relative">
              {weekMarkers.map((marker, i) => (
                <span
                  key={i}
                  className="absolute text-xs text-muted-foreground whitespace-nowrap -translate-x-1/2"
                  style={{ left: `${marker.offsetPercent}%` }}
                >
                  {marker.label}
                </span>
              ))}
            </div>
          </div>

          {/* Grid lines + lot rows */}
          <div className="relative flex flex-col gap-1">
            {/* Vertical grid lines under the bars */}
            <div
              className="absolute inset-0 pointer-events-none"
              aria-hidden="true"
            >
              {weekMarkers.map((marker, i) => (
                <div
                  key={i}
                  className="absolute top-0 bottom-0 border-l border-border/40"
                  style={{ left: `calc(160px + ${marker.offsetPercent}% * (100% - 160px) / 100)` }}
                />
              ))}
            </div>

            {lotBars.map(({ lot, leftPercent, widthPercent }) => {
              const colors = getPhaseColor(lot.phase);
              return (
                <div
                  key={lot.id}
                  className="flex items-center gap-2 h-9"
                >
                  {/* Label */}
                  <div className="w-40 shrink-0 text-right pr-3">
                    <p className="text-xs font-medium truncate">{lot.code}</p>
                    <p className="text-xs text-muted-foreground">
                      {lot.nombreActuel.toLocaleString("fr-FR")}
                    </p>
                  </div>
                  {/* Bar track */}
                  <div className="flex-1 relative h-7 bg-muted/30 rounded">
                    <div
                      className={`absolute h-full rounded group cursor-default ${colors.bg}`}
                      style={{
                        left: `${leftPercent}%`,
                        width: `${widthPercent}%`,
                      }}
                      title={t("lotTooltip", {
                        code: lot.code,
                        phase: lot.phase,
                        age: lot.ageJours,
                        count: lot.nombreActuel.toLocaleString("fr-FR"),
                      })}
                    >
                      {/* Tooltip on hover */}
                      <div
                        className={`
                          absolute bottom-full left-1/2 -translate-x-1/2 mb-1 z-10
                          hidden group-hover:flex flex-col gap-0.5
                          bg-popover border border-border rounded-md shadow-md p-2
                          text-xs text-popover-foreground whitespace-nowrap
                        `}
                      >
                        <span className="font-semibold">{lot.code}</span>
                        <span>{lot.phase}</span>
                        <span>{t("lotJours", { count: lot.ageJours })}</span>
                        <span>{t("lotPoissons", { count: lot.nombreActuel.toLocaleString("fr-FR") })}</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex flex-wrap gap-3 mt-4">
            {Object.entries(PHASE_COLORS).map(([phase, colors]) => (
              <div key={phase} className="flex items-center gap-1.5">
                <span className={`w-3 h-3 rounded-sm ${colors.bg}`} />
                <span className="text-xs text-muted-foreground">{phase}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
