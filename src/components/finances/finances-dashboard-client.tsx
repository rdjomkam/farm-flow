"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { TrendingUp, TrendingDown, DollarSign, AlertCircle, Receipt } from "lucide-react";

// Lazy loading Recharts — ssr: false obligatoire (no SSR, window/document deps)
const ResponsiveContainer = dynamic(
  () => import("recharts").then((m) => m.ResponsiveContainer),
  { ssr: false }
);
const AreaChart = dynamic(
  () => import("recharts").then((m) => m.AreaChart),
  { ssr: false }
);
const Area = dynamic(
  () => import("recharts").then((m) => m.Area),
  { ssr: false }
);
const BarChart = dynamic(
  () => import("recharts").then((m) => m.BarChart),
  { ssr: false }
);
const Bar = dynamic(
  () => import("recharts").then((m) => m.Bar),
  { ssr: false }
);
const XAxis = dynamic(
  () => import("recharts").then((m) => m.XAxis),
  { ssr: false }
);
const YAxis = dynamic(
  () => import("recharts").then((m) => m.YAxis),
  { ssr: false }
);
const CartesianGrid = dynamic(
  () => import("recharts").then((m) => m.CartesianGrid),
  { ssr: false }
);
const Tooltip = dynamic(
  () => import("recharts").then((m) => m.Tooltip),
  { ssr: false }
);
const Legend = dynamic(
  () => import("recharts").then((m) => m.Legend),
  { ssr: false }
);
const Cell = dynamic(
  () => import("recharts").then((m) => m.Cell),
  { ssr: false }
);
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartTooltip, ChartCrosshair } from "@/components/ui/chart-tooltip";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { ExportButton } from "@/components/ui/export-button";
import type {
  ResumeFinancier,
  RentabiliteParVague,
  EvolutionFinanciere,
  TopClients,
} from "@/lib/queries/finances";

// FCFA number formatter
function formatFCFA(amount: number): string {
  return new Intl.NumberFormat("fr-FR").format(Math.round(amount)) + " FCFA";
}

function formatCompact(amount: number): string {
  if (Math.abs(amount) >= 1_000_000) {
    return (amount / 1_000_000).toFixed(1) + " M FCFA";
  }
  if (Math.abs(amount) >= 1_000) {
    return (amount / 1_000).toFixed(0) + " k FCFA";
  }
  return new Intl.NumberFormat("fr-FR").format(Math.round(amount)) + " FCFA";
}

import { KPICard } from "@/components/ui/kpi-card";

interface FinancesDashboardClientProps {
  resume: ResumeFinancier;
  parVague: RentabiliteParVague;
  evolution: EvolutionFinanciere;
  topClients: TopClients;
}

export function FinancesDashboardClient({
  resume,
  parVague,
  evolution,
  topClients,
}: FinancesDashboardClientProps) {
  const t = useTranslations("ventes");

  // Format evolution data for Recharts
  const evolutionData = evolution.evolution.map((m) => ({
    name: m.mois.replace(/^\d{4}-/, ""), // "2026-01" → "01"
    Revenus: m.revenus,
    Couts: m.couts,
    Marge: m.marge,
    Encaissements: m.encaissements,
  }));

  // Format profitability data by vague
  const vagueData = parVague.vagues.map((v) => ({
    name: v.code.length > 15 ? v.code.slice(0, 15) + "..." : v.code,
    roi: v.roi ?? 0,
    positif: (v.roi ?? 0) >= 0,
  }));

  return (
    <div className="flex flex-col gap-6">
      {/* Export buttons */}
      <div className="flex flex-wrap gap-2">
        <ExportButton
          href="/api/export/finances"
          filename={`rapport-financier-${new Date().toISOString().slice(0, 10)}.pdf`}
          label={t("finances.exports.rapportPdf")}
          variant="outline"
        />
        <ExportButton
          href="/api/export/ventes"
          filename={`ventes-${new Date().toISOString().slice(0, 10)}.xlsx`}
          label={t("finances.exports.ventesExcel")}
          variant="outline"
        />
        <ExportButton
          href="/api/export/stock"
          filename={`stock-${new Date().toISOString().slice(0, 10)}.xlsx`}
          label={t("finances.exports.stockExcel")}
          variant="outline"
        />
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KPICard
          title={t("finances.kpis.revenusTotal")}
          value={formatCompact(resume.revenus)}
          subtitle={t("finances.kpis.revenusSub", { count: resume.nombreVentes })}
          icon={TrendingUp}
          iconColor="text-success"
          iconBgColor="bg-success/10"
        />
        <KPICard
          title={t("finances.kpis.coutsTotal")}
          value={formatCompact(resume.coutsTotaux)}
          subtitle={t("finances.kpis.coutsSub", { montant: formatCompact(resume.coutsAliments) })}
          icon={TrendingDown}
          iconColor="text-danger"
          iconBgColor="bg-danger/10"
        />
        <KPICard
          title={t("finances.kpis.margeBrute")}
          value={formatCompact(resume.margeBrute)}
          subtitle={resume.tauxMarge !== null
            ? t("finances.kpis.margeSub", { taux: resume.tauxMarge.toFixed(1) })
            : undefined}
          icon={DollarSign}
          iconColor={resume.margeBrute >= 0 ? "text-primary" : "text-danger"}
          iconBgColor="bg-primary/10"
        />
        <KPICard
          title={t("finances.kpis.creances")}
          value={formatCompact(resume.creances)}
          subtitle={t("finances.kpis.creancesSub", { montant: formatCompact(resume.encaissements) })}
          icon={AlertCircle}
          iconColor="text-warning"
          iconBgColor="bg-warning/10"
        />
      </div>

      {/* Expenses section (Sprint 18) */}
      {resume.depensesTotales > 0 && (
        <Card>
          <CardHeader className="pb-0">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Receipt className="h-4 w-4" />
                {t("finances.depenses.title")}
              </CardTitle>
              <Link
                href="/depenses"
                className="text-xs text-primary hover:underline"
              >
                {t("finances.depenses.voirTout")}
              </Link>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                  {t("finances.depenses.total")}
                </p>
                <p className="text-lg font-bold">{formatCompact(resume.depensesTotales)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                  {t("finances.depenses.payees")}
                </p>
                <p className="text-lg font-bold text-success">{formatCompact(resume.depensesPayees)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                  {t("finances.depenses.impayees")}
                </p>
                <p className="text-lg font-bold text-warning">{formatCompact(resume.depensesImpayees)}</p>
              </div>
            </div>

            {/* Category breakdown */}
            {Object.keys(resume.depensesParCategorie).length > 0 && (
              <div className="mt-4">
                <p className="text-xs text-muted-foreground mb-2">
                  {t("finances.depenses.repartition")}
                </p>
                <div className="flex flex-col gap-1.5">
                  {Object.entries(resume.depensesParCategorie)
                    .sort(([, a], [, b]) => (b as number) - (a as number))
                    .slice(0, 5)
                    .map(([cat, montant]) => {
                      const pct =
                        resume.depensesTotales > 0
                          ? Math.round(((montant as number) / resume.depensesTotales) * 100)
                          : 0;
                      return (
                        <div key={cat} className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground w-24 truncate shrink-0">
                            {cat}
                          </span>
                          <div className="flex-1 bg-muted rounded-full h-1.5 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-primary"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="text-xs text-muted-foreground w-10 text-right shrink-0">
                            {pct}%
                          </span>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Evolution chart */}
      <ErrorBoundary section="le graphique d'évolution financière">
      <Card>
        <CardHeader className="pb-0">
          <CardTitle className="text-base">{t("finances.evolution.title")}</CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          {evolutionData.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              {t("finances.evolution.aucuneDonnee")}
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart
                data={evolutionData}
                margin={{ top: 4, right: 4, left: 4, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="colorRevenus" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--success))" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="hsl(var(--success))" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorCouts" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--danger))" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="hsl(var(--danger))" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorMarge" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tickFormatter={(v) => formatCompact(v).replace(" FCFA", "")}
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  width={60}
                />
                <Tooltip
                  content={
                    <ChartTooltip
                      labelFormatter={(label) => t("finances.evolution.moisLabel", { label })}
                      valueFormatter={(v) => formatFCFA(v)}
                    />
                  }
                />
                <Legend
                  wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
                />
                <Area
                  type="monotone"
                  dataKey="Revenus"
                  stroke="hsl(var(--success))"
                  strokeWidth={2}
                  fill="url(#colorRevenus)"
                />
                <Area
                  type="monotone"
                  dataKey="Couts"
                  stroke="hsl(var(--danger))"
                  strokeWidth={2}
                  fill="url(#colorCouts)"
                />
                <Area
                  type="monotone"
                  dataKey="Marge"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  fill="url(#colorMarge)"
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
      </ErrorBoundary>

      {/* Profitability by vague */}
      {vagueData.length > 0 && (
        <ErrorBoundary section="le graphique de rentabilité">
        <Card>
          <CardHeader className="pb-0">
            <CardTitle className="text-base">{t("finances.rentabilite.title")}</CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <ResponsiveContainer width="100%" height={Math.max(160, vagueData.length * 40)}>
              <BarChart
                data={vagueData}
                layout="vertical"
                margin={{ top: 0, right: 40, left: 4, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                <XAxis
                  type="number"
                  tickFormatter={(v) => `${v}%`}
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  width={80}
                />
                <Tooltip
                  content={
                    <ChartTooltip
                      valueFormatter={(v) => `${v.toFixed(1)}%`}
                    />
                  }
                />
                <Bar dataKey="roi" radius={[0, 4, 4, 0]}>
                  {vagueData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.positif ? "hsl(var(--success))" : "hsl(var(--danger))"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        </ErrorBoundary>
      )}

      {/* Top clients */}
      {topClients.clients.length > 0 && (
        <Card>
          <CardHeader className="pb-0">
            <CardTitle className="text-base">{t("finances.topClients.title")}</CardTitle>
          </CardHeader>
          <CardContent className="pt-4 flex flex-col gap-3">
            {topClients.clients.map((client) => {
              const ratioPaye = client.totalVentes > 0
                ? Math.min(100, (client.totalPaye / client.totalVentes) * 100)
                : 0;
              return (
                <div key={client.id} className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{client.nom}</p>
                      <p className="text-xs text-muted-foreground">
                        {t("finances.topClients.ventes", { count: client.nombreVentes })} &middot;{" "}
                        {formatFCFA(client.totalVentes)}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs font-medium text-success">
                        {t("finances.topClients.paye", { montant: formatCompact(client.totalPaye) })}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {ratioPaye.toFixed(0)}%
                      </p>
                    </div>
                  </div>
                  {/* Progress bar */}
                  <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-success transition-all"
                      style={{ width: `${ratioPaye}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Additional stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
              {t("finances.stats.factures")}
            </p>
            <p className="text-xl font-bold">{resume.nombreFactures}</p>
          </CardContent>
        </Card>
        {resume.prixMoyenVenteKg !== null && (
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                {t("finances.stats.prixMoyenKg")}
              </p>
              <p className="text-xl font-bold">
                {new Intl.NumberFormat("fr-FR").format(Math.round(resume.prixMoyenVenteKg))} F
              </p>
            </CardContent>
          </Card>
        )}
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
              {t("finances.stats.aliments")}
            </p>
            <p className="text-xl font-bold">{formatCompact(resume.coutsAliments)}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
