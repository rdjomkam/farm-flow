"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Plus, Users, Calendar } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ReproductionKpiCards, type ReproductionKpis } from "./reproduction-kpi-cards";
import { SurvivalFunnelChart, type FunnelItem } from "./survival-funnel-chart";
import { PonteTimelineChart, type ProductionMois } from "./ponte-timeline-chart";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PhaseLotKpi {
  phase: string;
  count: number;
  totalPoissons: number;
}

interface LotsKpiData {
  parPhase: PhaseLotKpi[];
  phaseMoyenneDureeJours: Array<{ phase: string; dureeJours: number }>;
}

// ---------------------------------------------------------------------------
// Period selector options
// ---------------------------------------------------------------------------

type PeriodKey = "30j" | "3m" | "6m" | "12m" | "tout";

interface PeriodOption {
  key: PeriodKey;
  labelKey: string;
  days: number | null;
}

const PERIODS: PeriodOption[] = [
  { key: "30j", labelKey: "derniers30j", days: 30 },
  { key: "3m", labelKey: "derniers3m", days: 90 },
  { key: "6m", labelKey: "derniers6m", days: 180 },
  { key: "12m", labelKey: "derniers12m", days: 365 },
  { key: "tout", labelKey: "tout", days: null },
];

// ---------------------------------------------------------------------------
// Phase colors (ADR-044 §9)
// ---------------------------------------------------------------------------

const PHASE_COLORS: Record<string, string> = {
  INCUBATION: "#7c3aed",
  LARVAIRE: "#2563eb",
  NURSERIE: "#16a34a",
  ALEVINAGE: "#15803d",
  SORTI: "#6b7280",
  PERDU: "#dc2626",
};

// ---------------------------------------------------------------------------
// Skeleton placeholder
// ---------------------------------------------------------------------------

function SkeletonCard({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-xl border border-border bg-muted/30 ${className}`}
      aria-hidden
    />
  );
}

// ---------------------------------------------------------------------------
// Phase breakdown mini-chart
// ---------------------------------------------------------------------------

function PhaseBreakdown({ data }: { data: LotsKpiData }) {
  const t = useTranslations("reproduction");

  const total = data.parPhase.reduce((acc, p) => acc + p.totalPoissons, 0);

  if (!data.parPhase.length) {
    return (
      <Card className="h-full">
        <CardHeader>
          <CardTitle className="text-base">{t("dashboard.phases.title")}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-6">
            {t("dashboard.aucuneDonnee")}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-base">{t("dashboard.phases.title")}</CardTitle>
      </CardHeader>
      <CardContent className="pt-0 space-y-2">
        {data.parPhase.map((p) => {
          const pct = total > 0 ? (p.totalPoissons / total) * 100 : 0;
          const color = PHASE_COLORS[p.phase] ?? "#6b7280";
          const phaseLabel =
            t(`lots.phases.${p.phase}` as Parameters<typeof t>[0]) ?? p.phase;
          return (
            <div key={p.phase} className="space-y-0.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium" style={{ color }}>
                  {phaseLabel}
                </span>
                <span className="text-muted-foreground tabular-nums">
                  {p.totalPoissons.toLocaleString("fr-FR")}
                  <span className="ml-1 text-[10px]">({pct.toFixed(0)}%)</span>
                </span>
              </div>
              {/* Progress bar */}
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${pct}%`, backgroundColor: color }}
                />
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function ReproductionDashboardClient() {
  const t = useTranslations("reproduction.dashboard");

  const [period, setPeriod] = useState<PeriodKey>("30j");
  const [kpis, setKpis] = useState<ReproductionKpis | null>(null);
  const [funnel, setFunnel] = useState<FunnelItem[]>([]);
  const [lotsData, setLotsData] = useState<LotsKpiData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const buildDateParams = useCallback((): string => {
    const opt = PERIODS.find((p) => p.key === period);
    if (!opt || opt.days === null) return "";
    const dateFin = new Date();
    const dateDebut = new Date();
    dateDebut.setDate(dateDebut.getDate() - opt.days);
    return `dateDebut=${dateDebut.toISOString()}&dateFin=${dateFin.toISOString()}`;
  }, [period]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = buildDateParams();
      const qs = params ? `?${params}` : "";

      const [kpisRes, funnelRes, lotsRes] = await Promise.all([
        fetch(`/api/reproduction/kpis${qs}`),
        fetch(`/api/reproduction/kpis/funnel${qs}`),
        fetch(`/api/reproduction/kpis/lots`),
      ]);

      if (!kpisRes.ok || !funnelRes.ok || !lotsRes.ok) {
        throw new Error("Erreur lors du chargement des donnees.");
      }

      const [kpisJson, funnelJson, lotsJson] = await Promise.all([
        kpisRes.json(),
        funnelRes.json(),
        lotsRes.json(),
      ]);

      setKpis(kpisJson.kpis as ReproductionKpis);
      setFunnel(funnelJson.funnel as FunnelItem[]);
      setLotsData(lotsJson.data as LotsKpiData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue.");
    } finally {
      setLoading(false);
    }
  }, [buildDateParams]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  return (
    <div className="flex flex-col gap-4">
      {/* Period selector */}
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-muted-foreground shrink-0">
          {t("periode")}
        </span>
        <div className="flex overflow-x-auto gap-1 pb-0.5 -mx-1 px-1">
          {PERIODS.map((opt) => (
            <button
              key={opt.key}
              onClick={() => setPeriod(opt.key)}
              className={[
                "shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                period === opt.key
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80",
              ].join(" ")}
            >
              {t(opt.labelKey as Parameters<typeof t>[0])}
            </button>
          ))}
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="rounded-lg border border-[#dc2626]/30 bg-[#dc2626]/10 p-3 text-sm text-[#dc2626]">
          {error}
        </div>
      )}

      {/* Row 1: KPI cards */}
      {loading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} className="h-20" />
          ))}
        </div>
      ) : kpis ? (
        <ReproductionKpiCards kpis={kpis} />
      ) : null}

      {/* Row 2: Funnel (60%) + Phase breakdown (40%) */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
        <div className="md:col-span-3">
          {loading ? (
            <SkeletonCard className="h-64" />
          ) : (
            <SurvivalFunnelChart funnel={funnel} />
          )}
        </div>
        <div className="md:col-span-2">
          {loading ? (
            <SkeletonCard className="h-64" />
          ) : lotsData ? (
            <PhaseBreakdown data={lotsData} />
          ) : null}
        </div>
      </div>

      {/* Row 3: Production timeline */}
      {loading ? (
        <SkeletonCard className="h-64" />
      ) : kpis ? (
        <PonteTimelineChart data={kpis.productionMensuelle as ProductionMois[]} />
      ) : null}

      {/* Row 4: Quick actions */}
      <div className="grid grid-cols-3 gap-3">
        <Button asChild variant="primary" size="md" className="w-full text-sm">
          <Link href="/reproduction/pontes/nouvelle">
            <Plus className="h-4 w-4 shrink-0" />
            <span className="truncate">{t("actions.nouvellePonte")}</span>
          </Link>
        </Button>
        <Button asChild variant="outline" size="md" className="w-full text-sm">
          <Link href="/reproduction/geniteurs">
            <Users className="h-4 w-4 shrink-0" />
            <span className="truncate">{t("actions.voirGeniteurs")}</span>
          </Link>
        </Button>
        <Button asChild variant="outline" size="md" className="w-full text-sm">
          <Link href="/reproduction/planning">
            <Calendar className="h-4 w-4 shrink-0" />
            <span className="truncate">{t("actions.planning")}</span>
          </Link>
        </Button>
      </div>
    </div>
  );
}
