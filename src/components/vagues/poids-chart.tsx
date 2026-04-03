"use client";

import { memo, useMemo } from "react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
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

  const pointByJour = useMemo(
    () => new Map(data.map((d) => [d.jour, d])),
    [data]
  );

  const tooltipContent = useMemo(
    () => (
      <ChartTooltip
        labelFormatter={(label) => {
          const point = pointByJour.get(Number(label));
          if (point?.isPrediction) return t("poidsChart.tooltipLabelPrediction", { label });
          return t("poidsChart.tooltipLabel", { label });
        }}
        valueFormatter={(v) => `${v} g`}
      />
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, pointByJour]
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
                />
                <YAxis
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v) => `${v}g`}
                  width={42}
                />
                <Tooltip content={tooltipContent} />
                <Line
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
        </CardContent>
      </Card>
    </ErrorBoundary>
  );
}
