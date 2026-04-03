"use client";

import { memo, useMemo, useState, useRef, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { ZoomIn, ZoomOut, Maximize2 } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChartTooltip } from "@/components/ui/chart-tooltip";
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

const ZOOM_STEPS = [1, 1.5, 2, 3, 4] as const;
const BASE_HEIGHT = 220;

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

  // Zoom state: index into ZOOM_STEPS
  const [zoomIndex, setZoomIndex] = useState(0);
  const zoomLevel = ZOOM_STEPS[zoomIndex];
  const isZoomed = zoomLevel > 1;

  // Measure container width with ResizeObserver
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) setContainerWidth(entry.contentRect.width);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const handleZoomIn = useCallback(() => {
    setZoomIndex((i) => Math.min(i + 1, ZOOM_STEPS.length - 1));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoomIndex((i) => Math.max(i - 1, 0));
  }, []);

  const handleReset = useCallback(() => {
    setZoomIndex(0);
  }, []);

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

  const scaledWidth = Math.round(containerWidth * zoomLevel);
  const scaledHeight = Math.round(BASE_HEIGHT * zoomLevel);

  const chartContent = (
    <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 4 }} width={isZoomed ? scaledWidth : undefined} height={isZoomed ? scaledHeight : undefined}>
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
      <Tooltip content={tooltipContent} />
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
          {/* Scrollable container */}
          <div
            ref={containerRef}
            className="w-full max-w-full overflow-auto"
            style={{ height: `${BASE_HEIGHT}px`, overscrollBehavior: "contain" }}
          >
            {isZoomed && containerWidth > 0 ? (
              <div style={{ width: scaledWidth, height: scaledHeight }}>
                {chartContent}
              </div>
            ) : (
              <div className="h-full w-full">
                <ResponsiveContainer width="100%" height="100%">
                  {chartContent}
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {hasGompertz && (
            <p className="text-[10px] text-muted-foreground mt-1 text-center">
              {t("poidsChart.gompertzLegend")}
            </p>
          )}

          {/* Zoom toolbar */}
          <div className="mt-3 flex items-center justify-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={handleZoomIn}
              disabled={zoomIndex >= ZOOM_STEPS.length - 1}
              aria-label={t("poidsChart.zoomIn")}
              className="flex items-center justify-center gap-1 min-h-[44px] px-3 rounded-md border border-border bg-background text-foreground hover:bg-muted disabled:opacity-40 transition-colors text-sm"
            >
              <ZoomIn className="h-4 w-4" />
              <span className="hidden sm:inline">{t("poidsChart.zoomIn")}</span>
            </button>

            <span className="text-xs text-muted-foreground font-mono px-2 min-h-[44px] flex items-center">
              {isZoomed
                ? t("poidsChart.zoomLevel", { level: String(zoomLevel) })
                : t("poidsChart.zoomReset")}
            </span>

            <button
              type="button"
              onClick={handleZoomOut}
              disabled={!isZoomed}
              aria-label={t("poidsChart.zoomOut")}
              className="flex items-center justify-center gap-1 min-h-[44px] px-3 rounded-md border border-border bg-background text-foreground hover:bg-muted disabled:opacity-40 transition-colors text-sm"
            >
              <ZoomOut className="h-4 w-4" />
              <span className="hidden sm:inline">{t("poidsChart.zoomOut")}</span>
            </button>

            <button
              type="button"
              onClick={handleReset}
              disabled={!isZoomed}
              aria-label={t("poidsChart.zoomReset")}
              className="flex items-center justify-center gap-1 min-h-[44px] px-3 rounded-md border border-border bg-background text-foreground hover:bg-muted disabled:opacity-40 transition-colors text-sm"
            >
              <Maximize2 className="h-4 w-4" />
              <span className="hidden sm:inline">{t("poidsChart.zoomReset")}</span>
            </button>
          </div>
        </CardContent>
      </Card>
    </ErrorBoundary>
  );
}
