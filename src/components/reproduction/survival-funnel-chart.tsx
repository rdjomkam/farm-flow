"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  LabelList,
} from "recharts";
import { useTranslations, useLocale } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FunnelItem {
  etape: string;
  count: number;
  pourcentage: number;
}

interface SurvivalFunnelChartProps {
  funnel: FunnelItem[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Color map keyed by lowercase etape name (partial match) */
const ETAPE_COLORS: Record<string, string> = {
  oeufs: "#f59e0b",
  larves: "#2563eb",
  alevins: "#16a34a",
};

function colorForEtape(etape: string): string {
  const lower = etape.toLowerCase();
  for (const [key, color] of Object.entries(ETAPE_COLORS)) {
    if (lower.includes(key)) return color;
  }
  return "#6b7280";
}

// ---------------------------------------------------------------------------
// Custom Tooltip
// ---------------------------------------------------------------------------

interface TooltipPayloadItem {
  name: string;
  value: number;
  payload: FunnelItem;
}

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: TooltipPayloadItem[];
}) {
  const locale = useLocale();
  if (!active || !payload?.length) return null;
  const item = payload[0].payload as FunnelItem;
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 text-xs shadow-md">
      <p className="font-semibold text-foreground">{item.etape}</p>
      <p className="text-muted-foreground">
        {item.count.toLocaleString(locale)} ({item.pourcentage.toFixed(1)}%)
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SurvivalFunnelChart({ funnel }: SurvivalFunnelChartProps) {
  const t = useTranslations("reproduction.dashboard.funnel");

  if (!funnel.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("title")}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground py-8 text-center">
            {/* no data */}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("title")}</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <ResponsiveContainer width="100%" height={220}>
          <BarChart
            data={funnel}
            layout="vertical"
            margin={{ top: 4, right: 60, bottom: 4, left: 4 }}
          >
            <XAxis
              type="number"
              hide
              domain={[0, funnel[0]?.count ?? 1]}
            />
            <YAxis
              type="category"
              dataKey="etape"
              width={90}
              tick={{ fontSize: 12 }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip
              content={<CustomTooltip />}
              cursor={{ fill: "rgba(0,0,0,0.04)" }}
            />
            <Bar
              dataKey="count"
              radius={[0, 6, 6, 0]}
              maxBarSize={44}
            >
              {funnel.map((entry) => (
                <Cell
                  key={entry.etape}
                  fill={colorForEtape(entry.etape)}
                  opacity={0.9}
                />
              ))}
              <LabelList
                dataKey="pourcentage"
                position="right"
                formatter={(v: unknown) =>
                  typeof v === "number" ? `${v.toFixed(1)}%` : ""
                }
                style={{ fontSize: 11, fill: "var(--muted-foreground)" }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
