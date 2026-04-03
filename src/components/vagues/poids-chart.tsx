"use client";

import { memo, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { ZoomIn, ZoomOut, Maximize2, ChevronLeft, ChevronRight } from "lucide-react";
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

const ZOOM_WINDOW = 30;

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

  // Zoom state: null = vue globale, [from, to] = fenetre zoomee
  const [zoomDomain, setZoomDomain] = useState<[number, number] | null>(null);

  const pointByJour = useMemo(
    () => new Map(data.map((d) => [d.jour, d])),
    [data]
  );

  // Dataset filtré : seulement les points avec une observation réelle (poidsMoyen != null)
  // Utilisé pour la Line poidsMoyen afin de connecter les observations entre elles
  const dataObservations = useMemo(
    () => data.filter((d) => d.poidsMoyen != null),
    [data]
  );

  // Formatter de date pour le tooltip (Intl, pas de dépendance supplémentaire)
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

  // Bornes du dataset complet
  const dataMin = useMemo(() => (data.length > 0 ? data[0].jour : 0), [data]);
  const dataMax = useMemo(
    () => (data.length > 0 ? data[data.length - 1].jour : 0),
    [data]
  );

  // Handlers de zoom
  const handleZoomIn = () => {
    const [from, to] = zoomDomain ?? [dataMin, dataMax];
    const mid = Math.round((from + to) / 2);
    const half = Math.floor(ZOOM_WINDOW / 2);
    const rawFrom = mid - half;
    const rawTo = rawFrom + ZOOM_WINDOW;
    const newTo = Math.min(dataMax, rawTo);
    const newFrom = Math.max(dataMin, newTo - ZOOM_WINDOW);
    setZoomDomain([newFrom, newTo]);
  };

  const handleZoomOut = () => {
    if (!zoomDomain) return;
    const [from, to] = zoomDomain;
    const mid = Math.round((from + to) / 2);
    const currentWindow = to - from;
    const newWindow = Math.min(dataMax - dataMin, currentWindow * 2);
    const half = Math.floor(newWindow / 2);
    const newFrom = Math.max(dataMin, mid - half);
    const newTo = Math.min(dataMax, newFrom + newWindow);
    if (newFrom <= dataMin && newTo >= dataMax) {
      setZoomDomain(null);
    } else {
      setZoomDomain([newFrom, newTo]);
    }
  };

  const handleReset = () => setZoomDomain(null);

  const handlePanLeft = () => {
    if (!zoomDomain) return;
    const [from, to] = zoomDomain;
    const rangeSize = to - from;
    const step = Math.max(1, Math.floor(rangeSize / 4));
    const newFrom = Math.max(dataMin, from - step);
    setZoomDomain([newFrom, Math.min(dataMax, newFrom + rangeSize)]);
  };

  const handlePanRight = () => {
    if (!zoomDomain) return;
    const [from, to] = zoomDomain;
    const rangeSize = to - from;
    const step = Math.max(1, Math.floor(rangeSize / 4));
    const newTo = Math.min(dataMax, to + step);
    setZoomDomain([Math.max(dataMin, newTo - rangeSize), newTo]);
  };

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

  const isZoomed = zoomDomain !== null;
  const xDomain: [number | string, number | string] = isZoomed
    ? zoomDomain
    : ["dataMin", "dataMax"];

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
        <CardContent className="overflow-hidden">
          <div className="h-[220px] w-full max-w-full">
            <ResponsiveContainer
              width="100%"
              height="100%"
            >
              <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis
                  dataKey="jour"
                  tick={{ fontSize: 12 }}
                  tickFormatter={(v) => `J${v}`}
                  tickCount={8}
                  domain={xDomain}
                  type="number"
                  allowDataOverflow
                />
                <YAxis
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v) => `${v}g`}
                  width={42}
                />
                <Tooltip content={tooltipContent} />
                {/* Courbe poids moyen : utilise dataObservations pour connecter les points réels */}
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
            </ResponsiveContainer>
          </div>

          {hasGompertz && (
            <p className="text-[10px] text-muted-foreground mt-1 text-center">
              {t("poidsChart.gompertzLegend")}
            </p>
          )}

          {/* Barre de zoom */}
          <div className="mt-3 flex items-center justify-center gap-2 flex-wrap">
            {isZoomed && (
              <button
                type="button"
                onClick={handlePanLeft}
                disabled={zoomDomain[0] <= dataMin}
                aria-label={t("poidsChart.panLeft")}
                className="flex items-center justify-center min-h-[44px] min-w-[44px] rounded-md border border-border bg-background text-foreground hover:bg-muted disabled:opacity-40 transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
            )}

            <button
              type="button"
              onClick={handleZoomIn}
              aria-label={t("poidsChart.zoomIn")}
              className="flex items-center justify-center gap-1 min-h-[44px] px-3 rounded-md border border-border bg-background text-foreground hover:bg-muted transition-colors text-sm"
            >
              <ZoomIn className="h-4 w-4" />
              <span className="hidden sm:inline">{t("poidsChart.zoomIn")}</span>
            </button>

            {isZoomed ? (
              <span className="text-xs text-muted-foreground font-mono px-2 min-h-[44px] flex items-center">
                {t("poidsChart.zoomRange", { from: zoomDomain[0], to: zoomDomain[1] })}
              </span>
            ) : (
              <span className="text-xs text-muted-foreground px-2 min-h-[44px] flex items-center">
                {t("poidsChart.zoomReset")}
              </span>
            )}

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

            {isZoomed && (
              <button
                type="button"
                onClick={handlePanRight}
                disabled={zoomDomain[1] >= dataMax}
                aria-label={t("poidsChart.panRight")}
                className="flex items-center justify-center min-h-[44px] min-w-[44px] rounded-md border border-border bg-background text-foreground hover:bg-muted disabled:opacity-40 transition-colors"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            )}
          </div>
        </CardContent>
      </Card>
    </ErrorBoundary>
  );
}
