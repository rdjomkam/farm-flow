"use client";

import { useLocale } from "next-intl";
import type { AssignationBacForVague } from "@/types";

interface VagueBacsTimelineProps {
  /** Toutes les assignations de la vague (actives + terminées) */
  assignations: AssignationBacForVague[];
  /** Date de début de la vague */
  dateDebutVague: Date;
  /** Date de fin de la vague (null si en cours) */
  dateFinVague: Date | null;
}

function formatDate(d: Date, locale: string): string {
  return d.toLocaleDateString(locale, { day: "2-digit", month: "short" });
}

/**
 * VagueBacsTimeline — Client Component.
 *
 * Diagramme Gantt CSS Grid montrant la durée des assignations de chaque bac
 * dans la vague. Masqué sur mobile (hidden sm:block).
 * ADR-043 — Phase 2 Feature 3.
 */
export function VagueBacsTimeline({
  assignations,
  dateDebutVague,
  dateFinVague,
}: VagueBacsTimelineProps) {
  const locale = useLocale();
  if (assignations.length === 0) return null;

  const now = new Date();
  const vagueEnd = dateFinVague ?? now;
  const vagueStart = dateDebutVague;
  const totalMs = vagueEnd.getTime() - vagueStart.getTime();

  if (totalMs <= 0) return null;

  return (
    <div className="hidden sm:block overflow-x-auto">
      {/* En-tête des dates */}
      <div className="flex items-center justify-between text-xs text-muted-foreground mb-2 px-32">
        <span>{formatDate(vagueStart, locale)}</span>
        <span>{formatDate(vagueEnd, locale)}</span>
      </div>

      {/* Lignes de bac */}
      <div className="flex flex-col gap-1">
        {assignations.map((a) => {
          const barStart = Math.max(0, a.dateAssignation.getTime() - vagueStart.getTime());
          const barEnd = Math.min(totalMs, (a.dateFin ?? now).getTime() - vagueStart.getTime());
          const leftPct = (barStart / totalMs) * 100;
          const widthPct = Math.max(1, ((barEnd - barStart) / totalMs) * 100);
          const active = a.dateFin === null;

          return (
            <div key={a.id} className="flex items-center gap-3 h-7">
              {/* Nom du bac */}
              <div className="w-28 shrink-0 text-sm truncate text-right text-muted-foreground">
                {a.bac.nom}
              </div>

              {/* Piste */}
              <div className="relative flex-1 h-4 bg-muted rounded-full overflow-hidden">
                <div
                  className={`absolute top-0 h-full rounded-full transition-all ${
                    active
                      ? "bg-primary"
                      : "bg-muted-foreground/40"
                  }`}
                  style={{
                    left: `${leftPct}%`,
                    width: `${widthPct}%`,
                  }}
                  title={
                    active
                      ? `${a.bac.nom} — actif depuis ${formatDate(a.dateAssignation, locale)}`
                      : `${a.bac.nom} — ${formatDate(a.dateAssignation, locale)} → ${formatDate(a.dateFin!, locale)}`
                  }
                >
                  <span className="sr-only">
                    {active
                      ? `${a.bac.nom} — actif depuis ${formatDate(a.dateAssignation, locale)}`
                      : `${a.bac.nom} — ${formatDate(a.dateAssignation, locale)} → ${formatDate(a.dateFin!, locale)}`}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
