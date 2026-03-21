"use client";

import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { ChartTooltip } from "@/components/ui/chart-tooltip";
import { Skeleton } from "@/components/ui/skeleton";
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
}

export function PoidsChart({ data }: PoidsChartProps) {
  const t = useTranslations("vagues");

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
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("poidsChart.title")}</CardTitle>
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
              />
              <YAxis
                tick={{ fontSize: 11 }}
                tickFormatter={(v) => `${v}g`}
                width={42}
              />
              <Tooltip
                content={
                  <ChartTooltip
                    labelFormatter={(label) => t("poidsChart.tooltipLabel", { label })}
                    valueFormatter={(v) => `${v} g`}
                  />
                }
              />
              <Line
                type="monotone"
                dataKey="poidsMoyen"
                name={t("poidsChart.seriesName")}
                stroke="var(--primary)"
                strokeWidth={2}
                dot={{ r: 3 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
