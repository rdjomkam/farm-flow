"use client";

import { memo, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChartTooltip, ChartCrosshair } from "@/components/ui/chart-tooltip";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { buildGompertzPanelData } from "@/lib/gompertz-panel";
import { GompertzInfoPanel } from "./gompertz-info-panel";
import type { GompertzConfidenceLevel } from "@/lib/gompertz";
import type { EvolutionPoidsPoint } from "@/types";

const ResponsiveContainer = dynamic(
  () => import("recharts").then((mod) => mod.ResponsiveContainer),
  { ssr: false }
);
const LineChart = dynamic(
  () => import("recharts").then((mod) => mod.LineChart),
  { ssr: false }
);
const Line = dynamic(
  () => import("recharts").then((mod) => mod.Line),
  { ssr: false }
);
const XAxis = dynamic(
  () => import("recharts").then((mod) => mod.XAxis),
  { ssr: false }
);
const YAxis = dynamic(
  () => import("recharts").then((mod) => mod.YAxis),
  { ssr: false }
);
const CartesianGrid = dynamic(
  () => import("recharts").then((mod) => mod.CartesianGrid),
  { ssr: false }
);
const Tooltip = dynamic(
  () => import("recharts").then((mod) => mod.Tooltip),
  { ssr: false }
);

interface PoidsChartProps {
  data: EvolutionPoidsPoint[];
  /** Niveau de confiance Gompertz — null si pas de courbe Gompertz */
  gompertzConfidence?: string | null;
  /** R² du modele Gompertz — null si pas de courbe Gompertz */
  gompertzR2?: number | null;
  /** RMSE du modele Gompertz en grammes */
  gompertzRmse?: number | null;
  /** Nombre de dates uniques de biometrie utilisees */
  gompertzBiometrieCount?: number | null;
  /** Parametres calibres du modele Gompertz */
  gompertzParams?: { wInfinity: number; k: number; ti: number } | null;
  /** Poids objectif de recolte en grammes */
  poidsObjectif?: number | null;
  /** Nombre de jours ecoules depuis le debut de la vague */
  joursActuels?: number | null;
  /** Date de debut de la vague */
  dateDebut?: Date | null;
}

/** Badge de fiabilite du modele Gompertz */
const GompertzBadge = memo(function GompertzBadge({ confidence, r2 }: { confidence: string; r2: number | null }) {
  const t = useTranslations("vagues");
  const variantMap: Record<string, "terminee" | "warning" | "default"> = {
    HIGH: "terminee",
    MEDIUM: "warning",
    LOW: "default",
  };
  const variant = variantMap[confidence] ?? "default";
  const label = (["HIGH", "MEDIUM", "LOW"].includes(confidence)
    ? t(`poidsChart.gompertzBadge.${confidence as "HIGH" | "MEDIUM" | "LOW"}`)
    : "Gompertz");
  const r2Label = r2 !== null ? ` (R²=${r2.toFixed(2)})` : "";

  return (
    <Badge variant={variant} className="text-[10px]">
      {label}{r2Label}
    </Badge>
  );
});

export function PoidsChart({
  data,
  gompertzConfidence,
  gompertzR2,
  gompertzRmse,
  gompertzBiometrieCount,
  gompertzParams,
  poidsObjectif,
  joursActuels,
  dateDebut,
}: PoidsChartProps) {
  const t = useTranslations("vagues");

  const [activeChart, setActiveChart] = useState<0 | 1>(0);

  const pointByJour = useMemo(
    () => new Map(data.map((d) => [d.jour, d])),
    [data]
  );

  const dataObservations = useMemo(
    () => data.filter((d) => d.poidsMoyen != null),
    [data]
  );

  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat("fr-FR", {
        day: "numeric",
        month: "short",
        year: "numeric",
      }),
    []
  );

  const tooltipContent = useMemo(
    () => (
      <ChartTooltip
        labelFormatter={(label) => {
          const point = pointByJour.get(Number(label));
          const dateStr = point?.date
            ? dateFormatter.format(new Date(point.date))
            : "";
          if (point?.isPrediction)
            return t("poidsChart.tooltipLabelPrediction", { label, date: dateStr });
          return t("poidsChart.tooltipLabel", { label, date: dateStr });
        }}
        valueFormatter={(v) => `${v} g`}
      />
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, pointByJour, dateFormatter]
  );

  const hasGompertz =
    !!gompertzConfidence &&
    gompertzConfidence !== "INSUFFICIENT_DATA" &&
    data.some((d) => d.poidsGompertz != null);

  /** Max Y for prediction chart — rounded up to nearest 50 or 100 */
  const predictionMaxY = useMemo(() => {
    const maxVal = Math.max(
      ...data.map((d) => d.poidsGompertz ?? 0),
      ...data.map((d) => d.poidsMoyen ?? 0)
    );
    if (maxVal <= 0) return 100;
    const step = maxVal > 500 ? 100 : 50;
    return Math.ceil(maxVal / step) * step;
  }, [data]);

  const predictionTickFormatter = (v: number) =>
    v >= 1000 ? `${(v / 1000).toFixed(1)}kg` : `${v}g`;

  const panelData =
    hasGompertz &&
    gompertzParams != null &&
    gompertzR2 != null &&
    gompertzRmse != null &&
    gompertzBiometrieCount != null &&
    poidsObjectif != null &&
    joursActuels != null &&
    dateDebut != null
      ? buildGompertzPanelData({
          data,
          confidenceLevel: gompertzConfidence as GompertzConfidenceLevel,
          r2: gompertzR2,
          rmse: gompertzRmse,
          biometrieCount: gompertzBiometrieCount,
          wInfinity: gompertzParams.wInfinity,
          k: gompertzParams.k,
          ti: gompertzParams.ti,
          poidsObjectif,
          joursActuels,
          dateDebut,
        })
      : null;

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("poidsChart.title")}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="py-8 text-center text-sm text-muted-foreground">
            {t("poidsChart.noData")}
          </p>
        </CardContent>
      </Card>
    );
  }

  const maxDataJour = Math.max(...data.map((d) => d.jour));

  const observationsChart = (
    <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
      <XAxis
        dataKey="jour"
        tick={{ fontSize: 12 }}
        tickFormatter={(v) => `J${v}`}
        tickCount={8}
        domain={["dataMin", "dataMax"]}
        type="number"
      />
      <YAxis
        tick={{ fontSize: 11 }}
        tickFormatter={(v) => `${v}g`}
        width={42}
      />
      <Tooltip content={tooltipContent} cursor={<ChartCrosshair />} />
      <Line
        data={dataObservations}
        type="monotone"
        dataKey="poidsMoyen"
        name={t("poidsChart.seriesName")}
        stroke="var(--primary)"
        strokeWidth={2}
        dot={{ r: 3 }}
        activeDot={{ r: 6 }}
        connectNulls={false}
      />
      {hasGompertz && (
        <Line
          type="monotone"
          dataKey="poidsGompertz"
          name={t("poidsChart.gompertzSeriesName")}
          stroke="var(--accent-green)"
          strokeWidth={1.5}
          strokeDasharray="4 3"
          dot={false}
          activeDot={{ r: 4 }}
          connectNulls={true}
        />
      )}
    </LineChart>
  );

  const predictionChart = (
    <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
      <XAxis
        dataKey="jour"
        tick={{ fontSize: 12 }}
        tickFormatter={(v) => `J${v}`}
        tickCount={8}
        domain={[0, Math.max(maxDataJour, 120)]}
        type="number"
      />
      <YAxis
        tick={{ fontSize: 11 }}
        tickFormatter={predictionTickFormatter}
        width={52}
        domain={[0, predictionMaxY]}
      />
      <Tooltip content={tooltipContent} cursor={<ChartCrosshair />} />
      <Line
        data={dataObservations}
        type="monotone"
        dataKey="poidsMoyen"
        name={t("poidsChart.seriesName")}
        stroke="var(--primary)"
        strokeWidth={2}
        dot={{ r: 3 }}
        activeDot={{ r: 6 }}
        connectNulls={false}
      />
      <Line
        type="monotone"
        dataKey="poidsGompertz"
        name={t("poidsChart.gompertzSeriesName")}
        stroke="var(--accent-green)"
        strokeWidth={1.5}
        strokeDasharray="4 3"
        dot={false}
        activeDot={{ r: 4 }}
        connectNulls={true}
      />
    </LineChart>
  );

  return (
    <ErrorBoundary section="le graphique d'évolution du poids">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-base">{t("poidsChart.title")}</CardTitle>
            {hasGompertz && gompertzConfidence && (
              <div className="flex items-center gap-1">
                <GompertzBadge confidence={gompertzConfidence} r2={gompertzR2 ?? null} />
                {panelData && <GompertzInfoPanel data={panelData} />}
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {/* Tab pills — only when Gompertz is available */}
          {hasGompertz && (
            <div className="mb-3 flex gap-1">
              <button
                type="button"
                onClick={() => setActiveChart(0)}
                className={`min-h-[44px] rounded-md px-3 text-sm font-medium transition-colors ${
                  activeChart === 0
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                {t("poidsChart.tabObservations")}
              </button>
              <button
                type="button"
                onClick={() => setActiveChart(1)}
                className={`min-h-[44px] rounded-md px-3 text-sm font-medium transition-colors ${
                  activeChart === 1
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                {t("poidsChart.tabPrediction")}
              </button>
            </div>
          )}

          {/* Chart */}
          <div className="w-full" style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              {activeChart === 0 || !hasGompertz ? observationsChart : predictionChart}
            </ResponsiveContainer>
          </div>

          {hasGompertz && (
            <p className="text-[10px] text-muted-foreground mt-1 text-center">
              {t("poidsChart.gompertzLegend")}
            </p>
          )}
        </CardContent>
      </Card>
    </ErrorBoundary>
  );
}
