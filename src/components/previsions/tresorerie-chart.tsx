"use client";

/**
 * src/components/previsions/tresorerie-chart.tsx
 *
 * Graphique UNIQUE de tresorerie sur l'horizon du plan (ADR-053 §7.2,
 * Sprint PR2, story PR2.4) : courbe cumulee `soldeFCFA` avec la zone SOUS
 * ZERO coloree distinctement ("besoin de financement"). Recharts n'a aucune
 * fonctionnalite native de "couleur conditionnelle au signe" pour une
 * Area/Line continue (verifie exhaustivement par la pre-analyse PR2.4,
 * section 3.1) — technique retenue : un gradient SVG a `offset` calcule
 * dynamiquement depuis le min/max affiche de la serie, complete par une
 * `ReferenceLine y={0}` (meme patron que `src/components/dashboard/projections.tsx`).
 *
 * Sous-composants Recharts charges via `next/dynamic` (`ssr: false`) —
 * patron systematique du depot pour Recharts (aucun import statique en haut
 * de fichier), suivi ici comme dans `dashboard/projections.tsx` et
 * `finances/finances-dashboard-client.tsx`. Couleurs exclusivement via
 * variables CSS du theme (R6) : `var(--success)` / `var(--danger)` /
 * `var(--primary)`, jamais une couleur en dur.
 */
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { ChartTooltip, ChartCrosshair } from "@/components/ui/chart-tooltip";
import { formatMontantPrevision } from "@/lib/previsions/format-previsions";
import { libelleMoisCalendaire } from "@/lib/previsions/tableau-de-bord-helpers";

const ResponsiveContainer = dynamic(() => import("recharts").then((m) => m.ResponsiveContainer), { ssr: false });
const AreaChart = dynamic(() => import("recharts").then((m) => m.AreaChart), { ssr: false });
const Area = dynamic(() => import("recharts").then((m) => m.Area), { ssr: false });
const XAxis = dynamic(() => import("recharts").then((m) => m.XAxis), { ssr: false });
const YAxis = dynamic(() => import("recharts").then((m) => m.YAxis), { ssr: false });
const CartesianGrid = dynamic(() => import("recharts").then((m) => m.CartesianGrid), { ssr: false });
const Tooltip = dynamic(() => import("recharts").then((m) => m.Tooltip), { ssr: false });
const ReferenceLine = dynamic(() => import("recharts").then((m) => m.ReferenceLine), { ssr: false });

interface TresorerieChartPoint {
  moisAbsolu: number;
  soldeFCFA: number;
  libelleMois: string;
}

interface TresorerieChartProps {
  /** ISO string ou Date — `ScenarioPrevision.dateDebutPlan`. */
  dateDebutPlan: string | Date;
  mois: { moisAbsolu: number; soldeFCFA: number }[];
}

export function TresorerieChart({ dateDebutPlan, mois }: TresorerieChartProps) {
  const t = useTranslations("previsions");

  if (mois.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        {t("tresorerieChart.noData")}
      </p>
    );
  }

  const dateDebut = typeof dateDebutPlan === "string" ? new Date(dateDebutPlan) : dateDebutPlan;
  const data: TresorerieChartPoint[] = mois.map((m) => ({
    moisAbsolu: m.moisAbsolu,
    soldeFCFA: m.soldeFCFA,
    libelleMois: libelleMoisCalendaire(dateDebut, m.moisAbsolu),
  }));

  const soldes = data.map((d) => d.soldeFCFA);
  // Domaine affiche : force l'inclusion de zero pour que l'offset du
  // gradient reste dans [0, 1] meme si toute la serie reste d'un seul cote.
  const maxSolde = Math.max(...soldes, 0);
  const minSolde = Math.min(...soldes, 0);
  const offset = maxSolde <= 0 ? 0 : minSolde >= 0 ? 1 : maxSolde / (maxSolde - minSolde);

  return (
    <figure aria-label={t("tresorerieChart.ariaLabel")}>
      <div className="h-[260px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
            <defs>
              <linearGradient id="gradTresorerie" x1="0" y1="0" x2="0" y2="1">
                <stop offset={0} stopColor="var(--success)" stopOpacity={0.35} />
                <stop offset={offset} stopColor="var(--success)" stopOpacity={0.35} />
                <stop offset={offset} stopColor="var(--danger)" stopOpacity={0.35} />
                <stop offset={1} stopColor="var(--danger)" stopOpacity={0.35} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="libelleMois" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
            <YAxis tick={{ fontSize: 10 }} width={64} tickFormatter={(v: number) => formatMontantPrevision(v)} />
            <Tooltip
              cursor={<ChartCrosshair />}
              content={
                <ChartTooltip
                  labelFormatter={(label) => label}
                  valueFormatter={(v) => formatMontantPrevision(v)}
                />
              }
            />
            <ReferenceLine y={0} stroke="var(--muted-foreground)" strokeDasharray="4 4" />
            <Area
              type="monotone"
              dataKey="soldeFCFA"
              name={t("tresorerieChart.seriesName")}
              stroke="var(--primary)"
              strokeWidth={2}
              fill="url(#gradTresorerie)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </figure>
  );
}
