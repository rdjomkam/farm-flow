"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import { useTranslations } from "next-intl";
import { CalendarDays, Fish, Egg, Layers } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LotsGanttView, GanttLot } from "./lots-gantt-view";
import { ProductionCalculator } from "./production-calculator";

// ---------------------------------------------------------------------------
// API response shapes
// ---------------------------------------------------------------------------

interface PontePlanifiee {
  id: string;
  code: string;
  dateInjection: string | null;
  datePonte: string;
  statut: string;
  femelle: { code: string } | null;
}

interface IncubationEnCours {
  id: string;
  code: string;
  dateDebutIncubation: string;
  dateEclosionPrevue: string | null;
  statut: string;
}

interface LotEnElevage {
  id: string;
  code: string;
  phase: string;
  dateDebutPhase: string;
  ageJours: number;
  nombreActuel: number;
}

interface EclosionPrevue {
  incubationId: string;
  code: string;
  dateEclosionPrevue: string;
}

interface PlanningData {
  pontesPlanifiees: PontePlanifiee[];
  incubationsEnCours: IncubationEnCours[];
  lotsEnElevage: LotEnElevage[];
  eclosionsPrevues: EclosionPrevue[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function toDateInputValue(date: Date): string {
  return date.toISOString().split("T")[0];
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function getDaysInMonth(year: number, month: number): Date[] {
  const days: Date[] = [];
  const date = new Date(year, month, 1);
  while (date.getMonth() === month) {
    days.push(new Date(date));
    date.setDate(date.getDate() + 1);
  }
  return days;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SummaryCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="flex items-center gap-3 p-4 rounded-xl border border-border bg-card shadow-[var(--shadow-card)]">
      <div className={`p-2 rounded-lg ${color}`}>
        <Icon className="w-5 h-5" aria-hidden="true" />
      </div>
      <div>
        <p className="text-2xl font-bold tabular-nums">{value}</p>
        <p className="text-xs text-muted-foreground leading-tight">{label}</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Calendar grid
// ---------------------------------------------------------------------------

interface CalendarEvent {
  date: string; // YYYY-MM-DD
  type: "ponte" | "eclosion";
  label: string;
}

function MonthCalendar({
  year,
  month,
  events,
}: {
  year: number;
  month: number;
  events: CalendarEvent[];
}) {
  const [expandedDay, setExpandedDay] = useState<string | null>(null);

  const days = getDaysInMonth(year, month);
  const firstDayOfWeek = (new Date(year, month, 1).getDay() + 6) % 7; // Mon=0

  const eventsByDay = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {};
    for (const ev of events) {
      if (!map[ev.date]) map[ev.date] = [];
      map[ev.date].push(ev);
    }
    return map;
  }, [events]);

  const dayHeaders = ["Lu", "Ma", "Me", "Je", "Ve", "Sa", "Di"];

  return (
    <div className="w-full">
      {/* Day headers */}
      <div className="grid grid-cols-7 mb-1">
        {dayHeaders.map((d) => (
          <div
            key={d}
            className="text-center text-xs font-medium text-muted-foreground py-1"
          >
            {d}
          </div>
        ))}
      </div>

      {/* Calendar cells */}
      <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden">
        {/* Empty cells before first day */}
        {Array.from({ length: firstDayOfWeek }).map((_, i) => (
          <div key={`empty-${i}`} className="bg-muted/20 min-h-[48px]" />
        ))}

        {days.map((day) => {
          const key = toDateInputValue(day);
          const dayEvents = eventsByDay[key] ?? [];
          const isToday = isSameDay(day, new Date());
          const isExpanded = expandedDay === key;

          return (
            <div
              key={key}
              className={`bg-background p-1 min-h-[48px] cursor-pointer hover:bg-muted/30 transition-colors ${
                isToday ? "ring-1 ring-inset ring-primary" : ""
              }`}
              onClick={() =>
                setExpandedDay(isExpanded ? null : dayEvents.length > 0 ? key : null)
              }
              aria-label={`${day.getDate()} ${dayEvents.length > 0 ? `— ${dayEvents.length} événement(s)` : ""}`}
            >
              <span
                className={`text-xs font-medium leading-none block mb-0.5 ${
                  isToday
                    ? "text-primary font-bold"
                    : "text-foreground"
                }`}
              >
                {day.getDate()}
              </span>
              {/* Event dots */}
              <div className="flex flex-wrap gap-0.5">
                {dayEvents.slice(0, 3).map((ev, i) => (
                  <span
                    key={i}
                    className={`w-1.5 h-1.5 rounded-full ${
                      ev.type === "ponte"
                        ? "bg-primary"
                        : "bg-[#7c3aed]"
                    }`}
                    aria-hidden="true"
                  />
                ))}
                {dayEvents.length > 3 && (
                  <span className="text-[10px] text-muted-foreground">+{dayEvents.length - 3}</span>
                )}
              </div>
              {/* Expanded events */}
              {isExpanded && dayEvents.length > 0 && (
                <div className="mt-1 flex flex-col gap-0.5">
                  {dayEvents.map((ev, i) => (
                    <span
                      key={i}
                      className={`inline-block text-[10px] px-1 py-0.5 rounded font-medium truncate max-w-full ${
                        ev.type === "ponte"
                          ? "bg-primary/10 text-primary"
                          : "bg-[#7c3aed]/10 text-[#7c3aed]"
                      }`}
                    >
                      {ev.label}
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Upcoming events list (mobile-first)
// ---------------------------------------------------------------------------

function UpcomingEventsList({
  events,
  emptyLabel,
}: {
  events: CalendarEvent[];
  emptyLabel: string;
}) {
  const sorted = useMemo(
    () => [...events].sort((a, b) => a.date.localeCompare(b.date)),
    [events]
  );

  if (sorted.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-4">
        {emptyLabel}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {sorted.map((ev, i) => {
        const d = new Date(ev.date);
        return (
          <div
            key={i}
            className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card"
          >
            <div
              className={`w-2 h-2 rounded-full shrink-0 ${
                ev.type === "ponte" ? "bg-primary" : "bg-[#7c3aed]"
              }`}
              aria-hidden="true"
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{ev.label}</p>
              <p className="text-xs text-muted-foreground">
                {d.toLocaleDateString("fr-FR", {
                  weekday: "short",
                  day: "numeric",
                  month: "short",
                })}
              </p>
            </div>
            <span
              className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                ev.type === "ponte"
                  ? "bg-primary/10 text-primary"
                  : "bg-[#7c3aed]/10 text-[#7c3aed]"
              }`}
            >
              {ev.type === "ponte" ? "Ponte" : "Éclosion"}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main client component
// ---------------------------------------------------------------------------

export function ReproductionPlanningClient() {
  const t = useTranslations("reproduction.planning");

  const now = new Date();
  const [dateDebut, setDateDebut] = useState<string>(
    toDateInputValue(startOfMonth(now))
  );
  const [dateFin, setDateFin] = useState<string>(
    toDateInputValue(endOfMonth(now))
  );
  const [data, setData] = useState<PlanningData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPlanning = useCallback(
    async (debut: string, fin: string) => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ dateDebut: debut, dateFin: fin });
        const res = await fetch(`/api/reproduction/planning?${params}`);
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? `Erreur ${res.status}`);
        }
        const json: PlanningData = await res.json();
        setData(json);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur inconnue");
      } finally {
        setLoading(false);
      }
    },
    []
  );

  // Auto-load on mount
  useEffect(() => {
    fetchPlanning(dateDebut, dateFin);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleApply = () => {
    if (dateDebut && dateFin && dateDebut < dateFin) {
      fetchPlanning(dateDebut, dateFin);
    }
  };

  // Build calendar events
  const calendarEvents = useMemo<CalendarEvent[]>(() => {
    if (!data) return [];
    const events: CalendarEvent[] = [];
    for (const p of data.pontesPlanifiees) {
      events.push({
        date: p.datePonte.split("T")[0],
        type: "ponte",
        label: `${p.code}${p.femelle ? ` (${p.femelle.code})` : ""}`,
      });
    }
    for (const e of data.eclosionsPrevues) {
      events.push({
        date: e.dateEclosionPrevue.split("T")[0],
        type: "eclosion",
        label: e.code,
      });
    }
    return events;
  }, [data]);

  // Gantt lots
  const ganttLots = useMemo<GanttLot[]>(() => {
    if (!data) return [];
    return data.lotsEnElevage.map((l) => ({
      id: l.id,
      code: l.code,
      phase: l.phase,
      dateDebutPhase: l.dateDebutPhase,
      ageJours: l.ageJours,
      nombreActuel: l.nombreActuel,
    }));
  }, [data]);

  const dateDebutObj = useMemo(
    () => (dateDebut ? new Date(dateDebut) : startOfMonth(now)),
    [dateDebut, now]
  );
  const dateFinObj = useMemo(
    () => (dateFin ? new Date(dateFin) : endOfMonth(now)),
    [dateFin, now]
  );

  // Calendar month from dateDebut
  const calYear = dateDebutObj.getFullYear();
  const calMonth = dateDebutObj.getMonth();

  return (
    <div className="flex flex-col gap-6">
      {/* Period selector */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-end">
            <div className="flex flex-col gap-1 flex-1 w-full">
              <label className="text-sm font-medium" htmlFor="plan-debut">
                {t("periodeDebut")}
              </label>
              <input
                id="plan-debut"
                type="date"
                value={dateDebut}
                onChange={(e) => setDateDebut(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring h-11"
              />
            </div>
            <div className="flex flex-col gap-1 flex-1 w-full">
              <label className="text-sm font-medium" htmlFor="plan-fin">
                {t("periodeFin")}
              </label>
              <input
                id="plan-fin"
                type="date"
                value={dateFin}
                onChange={(e) => setDateFin(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring h-11"
              />
            </div>
            <button
              onClick={handleApply}
              disabled={loading || !dateDebut || !dateFin || dateDebut >= dateFin}
              className="w-full sm:w-auto h-11 px-5 rounded-lg bg-primary text-primary-foreground font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary/90 transition-colors"
            >
              {loading ? "Chargement..." : "Appliquer"}
            </button>
          </div>
          {error && (
            <p className="mt-2 text-sm text-danger">{error}</p>
          )}
        </CardContent>
      </Card>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <SummaryCard
          icon={Fish}
          label={t("pontesPlanifiees")}
          value={data?.pontesPlanifiees.length ?? 0}
          color="bg-primary/10 text-primary"
        />
        <SummaryCard
          icon={Egg}
          label={t("eclosionsPrevues")}
          value={data?.eclosionsPrevues.length ?? 0}
          color="bg-[#7c3aed]/10 text-[#7c3aed]"
        />
        <SummaryCard
          icon={Layers}
          label={t("lotsActifs")}
          value={data?.lotsEnElevage.length ?? 0}
          color="bg-[#16a34a]/10 text-[#16a34a]"
        />
      </div>

      {/* Calendar — hidden on mobile, visible on md+ */}
      <div className="hidden md:block">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarDays className="w-5 h-5 text-primary" aria-hidden="true" />
              {t("calendrier")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <MonthCalendar
              year={calYear}
              month={calMonth}
              events={calendarEvents}
            />
            {/* Legend */}
            <div className="flex gap-4 mt-3">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="w-2.5 h-2.5 rounded-full bg-primary inline-block" />
                Ponte
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="w-2.5 h-2.5 rounded-full bg-[#7c3aed] inline-block" />
                Éclosion
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Upcoming events list (mobile) */}
      <div className="block md:hidden">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("evenements")}</CardTitle>
          </CardHeader>
          <CardContent>
            <UpcomingEventsList
              events={calendarEvents}
              emptyLabel={t("aucunEvenement")}
            />
          </CardContent>
        </Card>
      </div>

      {/* Gantt section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("gantt")}</CardTitle>
        </CardHeader>
        <CardContent>
          <LotsGanttView
            lots={ganttLots}
            dateDebut={dateDebutObj}
            dateFin={dateFinObj}
          />
        </CardContent>
      </Card>

      {/* Production calculator */}
      <ProductionCalculator />
    </div>
  );
}
