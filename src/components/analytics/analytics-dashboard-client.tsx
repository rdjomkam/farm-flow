"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import {
  Container,
  Package,
  Waves,
  BarChart3,
  Banknote,
  TrendingUp,
  AlertTriangle,
  ArrowRight,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { formatNumber } from "@/lib/format";
// Type local compatible avec la valeur retournee par getAnalyticsDashboard
// (tauxSurvie peut etre null dans la query meme si le type formel dit number)
interface DashboardMeilleurBac {
  id: string;
  nom: string;
  densite: number;
}

interface DashboardData {
  meilleurBac: DashboardMeilleurBac | null;
  meilleurAliment: { nom: string; coutParKgGain: number } | null;
  alertesPerformance: number;
  tendanceFCR: { mois: string; fcr: number }[];
  stats: {
    vaguesEnCours: number;
    bacsActifs: number;
    totalReproducteurs: number;
    totalLotsEnElevage: number;
  };
}

// Recharts chargé en mode client uniquement (SSR incompatible)
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

// ---------------------------------------------------------------------------
// KPI card
// ---------------------------------------------------------------------------

interface KpiCardProps {
  title: string;
  href?: string;
  children: React.ReactNode;
}

function KpiCard({ title, href, children }: KpiCardProps) {
  const inner = (
    <Card className="h-full">
      <CardContent className="p-3 sm:p-4 flex flex-col gap-2 h-full">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {title}
          </span>
          {href && (
            <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
          )}
        </div>
        {children}
      </CardContent>
    </Card>
  );

  if (href) {
    return (
      <Link href={href} className="hover:opacity-80 transition-opacity">
        {inner}
      </Link>
    );
  }
  return inner;
}

// ---------------------------------------------------------------------------
// Sparkline FCR
// ---------------------------------------------------------------------------

interface SparklineFCRProps {
  data: { mois: string; fcr: number }[];
}

function SparklineFCR({ data }: SparklineFCRProps) {
  if (data.length === 0) {
    return (
      <p className="text-xs text-muted-foreground py-4 text-center">Aucune donnee</p>
    );
  }

  return (
    <div className="w-full h-[50px]">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <Line
            type="monotone"
            dataKey="fcr"
            stroke="hsl(var(--primary))"
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stat secondaire
// ---------------------------------------------------------------------------

interface StatItemProps {
  label: string;
  value: number | string;
  icon: React.ComponentType<{ className?: string }>;
}

function StatItem({ label, value, icon: Icon }: StatItemProps) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border p-3">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 shrink-0">
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <div>
        <p className="text-lg font-bold leading-tight">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Lien rapide
// ---------------------------------------------------------------------------

interface QuickLinkProps {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  disabled?: boolean;
  description?: string;
}

function QuickLink({ href, label, icon: Icon, disabled, description }: QuickLinkProps) {
  if (disabled) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-border/50 p-3 opacity-40 cursor-not-allowed">
        <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
        <div>
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          {description && (
            <p className="text-xs text-muted-foreground">{description}</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-lg border border-border p-3 hover:bg-muted transition-colors"
    >
      <Icon className="h-4 w-4 text-primary shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{label}</p>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
      </div>
      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Composant principal
// ---------------------------------------------------------------------------

interface AnalyticsDashboardClientProps {
  dashboard: DashboardData;
}

export function AnalyticsDashboardClient({ dashboard }: AnalyticsDashboardClientProps) {
  const { meilleurBac, meilleurAliment, alertesPerformance, tendanceFCR, stats } = dashboard;

  return (
    <div className="flex flex-col gap-6 p-4">
      {/* Section KPIs — 4 cartes */}
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">
          Indicateurs cles
        </h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {/* Meilleur bac */}
          <KpiCard title="Meilleur bac" href="/analytics/bacs">
            {meilleurBac ? (
              <>
                <p className="text-base font-bold truncate">{meilleurBac.nom}</p>
                <p className="text-xs text-muted-foreground">
                  Densite {meilleurBac.densite} kg/m³
                </p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Aucune vague en cours</p>
            )}
          </KpiCard>

          {/* Meilleur aliment */}
          <KpiCard title="Meilleur aliment" href="/analytics/aliments">
            {meilleurAliment ? (
              <>
                <p className="text-base font-bold truncate">{meilleurAliment.nom}</p>
                <p className="text-xs text-muted-foreground">
                  {formatNumber(meilleurAliment.coutParKgGain)} CFA/kg gain
                </p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Aucune donnee disponible</p>
            )}
          </KpiCard>

          {/* Alertes performance */}
          <KpiCard title="Alertes performance">
            <div className="flex items-center gap-2">
              {alertesPerformance > 0 ? (
                <>
                  <AlertTriangle className="h-5 w-5 text-danger shrink-0" />
                  <span className="text-2xl font-bold text-danger">{alertesPerformance}</span>
                  <span className="inline-flex items-center rounded-full bg-danger/10 px-2 py-0.5 text-[10px] font-medium text-danger">
                    Actives
                  </span>
                </>
              ) : (
                <>
                  <span className="text-2xl font-bold text-success">0</span>
                  <span className="text-xs text-muted-foreground">Tout est OK</span>
                </>
              )}
            </div>
          </KpiCard>

          {/* Tendance FCR */}
          <KpiCard title="Tendance FCR">
            <ErrorBoundary section="le graphique FCR">
              <SparklineFCR data={tendanceFCR} />
            </ErrorBoundary>
            {tendanceFCR.length > 0 && (
              <p className="text-xs text-muted-foreground">
                Dernier : FCR {tendanceFCR[tendanceFCR.length - 1]?.fcr}
              </p>
            )}
          </KpiCard>
        </div>
      </section>

      {/* Section stats secondaires */}
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">
          Vue generale
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatItem label="Vagues en cours" value={stats.vaguesEnCours} icon={Waves} />
          <StatItem label="Bacs actifs" value={stats.bacsActifs} icon={Container} />
          <StatItem label="Reproducteurs" value={stats.totalReproducteurs} icon={Package} />
          <StatItem label="Lots en elevage" value={stats.totalLotsEnElevage} icon={BarChart3} />
        </div>
      </section>

      {/* Section liens rapides */}
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">
          Accès rapide
        </h2>
        <div className="flex flex-col gap-2">
          <QuickLink
            href="/analytics/bacs"
            label="Par bac"
            icon={Container}
            description="Comparer les indicateurs par bac"
          />
          <QuickLink
            href="/analytics/aliments"
            label="Par aliment"
            icon={Package}
            description="Analyser l'efficacite des aliments"
          />
          <QuickLink
            href="/analytics/vagues"
            label="Par vague"
            icon={Waves}
            description="Comparer les performances inter-vagues"
          />
          <QuickLink
            href="/analytics/finances"
            label="Finances"
            icon={Banknote}
            description="Dashboard financier — bientot disponible"
            disabled
          />
          <QuickLink
            href="/analytics/tendances"
            label="Tendances"
            icon={TrendingUp}
            description="Analyse des tendances — bientot disponible"
            disabled
          />
        </div>
      </section>
    </div>
  );
}
