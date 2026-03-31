import Link from "next/link";
import { AlertTriangle, TrendingUp, TrendingDown, Droplets, HeartPulse, BarChart3, ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BenchmarkBadge } from "@/components/dashboard/benchmark-badge";
import {
  evaluerBenchmark,
  BENCHMARK_SURVIE,
  BENCHMARK_FCR,
  BENCHMARK_SGR,
  BENCHMARK_MORTALITE,
  BENCHMARK_DENSITE,
} from "@/lib/benchmarks";
import type { IndicateursBenchmarkVague } from "@/types";
import { getTranslations } from "next-intl/server";
import { formatNumber } from "@/lib/format";

interface IndicateursPanelProps {
  indicateurs: IndicateursBenchmarkVague[];
}

interface IndicateurRowProps {
  label: string;
  value: number | null;
  unit: string;
  level: ReturnType<typeof evaluerBenchmark>;
  icon: React.ComponentType<{ className?: string }>;
}

function IndicateurRow({ label, value, unit, level, icon: Icon }: IndicateurRowProps) {
  const iconColorClass =
    level === "EXCELLENT"
      ? "text-accent-green"
      : level === "BON"
        ? "text-accent-blue"
        : level === "ACCEPTABLE"
          ? "text-accent-amber"
          : level === "MAUVAIS"
            ? "text-accent-red"
            : "text-muted-foreground";

  return (
    <div className="flex items-center justify-between gap-1.5 py-2">
      <div className="flex items-center gap-2 min-w-0">
        <Icon className={`h-4 w-4 shrink-0 ${iconColorClass}`} />
        <span className="text-sm text-muted-foreground truncate">{label}</span>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-sm font-semibold tabular-nums">
          {value !== null ? `${value}${unit ? "\u00a0" + unit : ""}` : "\u2014"}
        </span>
        <BenchmarkBadge level={level} />
      </div>
    </div>
  );
}

/**
 * Panneau des indicateurs de performance avec niveaux de benchmark.
 *
 * Affiche FCR, SGR, Survie, Mortalite, Densite pour chaque vague active.
 * Quand un indicateur est MAUVAIS, affiche une notification prominente
 * avec un lien vers l'activite corrective si elle existe.
 *
 * Server Component — pas de "use client" (donnees passees en props depuis la page).
 * Mobile first : cartes empilees sur 360px, grille sur desktop.
 * R6 : utilise les CSS variables du theme via les classes Tailwind.
 */
export async function IndicateursPanel({ indicateurs }: IndicateursPanelProps) {
  const tAnalytics = await getTranslations("analytics");

  if (indicateurs.length === 0) return null;

  // Collecter toutes les alertes MAUVAIS pour la notification prominente
  const alertesMauvaises: { vagueCode: string; indicateur: string; value: string }[] = [];

  for (const ind of indicateurs) {
    if (evaluerBenchmark(ind.tauxSurvie, BENCHMARK_SURVIE) === "MAUVAIS" && ind.tauxSurvie !== null) {
      alertesMauvaises.push({ vagueCode: ind.vagueCode, indicateur: tAnalytics("indicators.survival"), value: `${ind.tauxSurvie}%` });
    }
    if (evaluerBenchmark(ind.fcr, BENCHMARK_FCR) === "MAUVAIS" && ind.fcr !== null) {
      alertesMauvaises.push({ vagueCode: ind.vagueCode, indicateur: tAnalytics("benchmarks.fcr.label"), value: `${ind.fcr}` });
    }
    if (evaluerBenchmark(ind.sgr, BENCHMARK_SGR) === "MAUVAIS" && ind.sgr !== null) {
      alertesMauvaises.push({ vagueCode: ind.vagueCode, indicateur: tAnalytics("benchmarks.sgr.label"), value: `${ind.sgr}${tAnalytics("labels.sgrUnit")}` });
    }
    if (evaluerBenchmark(ind.tauxMortalite, BENCHMARK_MORTALITE) === "MAUVAIS" && ind.tauxMortalite !== null) {
      alertesMauvaises.push({ vagueCode: ind.vagueCode, indicateur: tAnalytics("indicators.mortality"), value: `${ind.tauxMortalite}%` });
    }
    if (evaluerBenchmark(ind.densite, BENCHMARK_DENSITE) === "MAUVAIS" && ind.densite !== null) {
      alertesMauvaises.push({ vagueCode: ind.vagueCode, indicateur: tAnalytics("indicators.density"), value: `${ind.densite} p/m\u00b3` });
    }
  }

  // Trouver une activite corrective associee aux alertes MAUVAIS
  const activitesCorrectives = indicateurs
    .filter((ind) => ind.activiteCorrectiveId !== null)
    .slice(0, 1);

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {tAnalytics("indicators.title")}
      </h2>

      {/* Notification prominente si des indicateurs sont MAUVAIS */}
      {alertesMauvaises.length > 0 && (
        <div
          className="flex flex-col gap-2 rounded-xl border p-4"
          style={{
            borderColor: "var(--accent-red)",
            background: "var(--accent-red-muted)",
          }}
        >
          <div className="flex items-start gap-3">
            <AlertTriangle
              className="h-5 w-5 shrink-0 mt-0.5"
              style={{ color: "var(--accent-red)" }}
            />
            <div className="flex-1 min-w-0">
              <p
                className="text-sm font-semibold"
                style={{ color: "var(--accent-red)" }}
              >
                {tAnalytics("indicators.criticalCount", { count: alertesMauvaises.length })}
              </p>
              <ul className="mt-1 space-y-0.5">
                {alertesMauvaises.slice(0, 3).map((alerte, i) => (
                  <li key={i} className="text-xs" style={{ color: "var(--accent-red)" }}>
                    {alerte.vagueCode} &mdash; {alerte.indicateur} : {alerte.value}
                  </li>
                ))}
                {alertesMauvaises.length > 3 && (
                  <li className="text-xs" style={{ color: "var(--accent-red)" }}>
                    +{alertesMauvaises.length - 3} autre{alertesMauvaises.length - 3 > 1 ? "s" : ""}...
                  </li>
                )}
              </ul>
            </div>
          </div>
          {activitesCorrectives.length > 0 && activitesCorrectives[0].activiteCorrectiveId && (
            <Link
              href={`/planning?id=${activitesCorrectives[0].activiteCorrectiveId}`}
              className="flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-colors text-white"
              style={{
                background: "var(--accent-red)",
              }}
            >
              <span className="truncate">{tAnalytics("indicators.viewCorrectiveAction")}</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          )}
          {activitesCorrectives.length === 0 && (
            <Link
              href="/planning/nouvelle"
              className="flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-colors text-white"
              style={{
                background: "var(--accent-red)",
              }}
            >
              <span className="truncate">{tAnalytics("indicators.planCorrectiveAction")}</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          )}
        </div>
      )}

      {/* Cartes d'indicateurs par vague */}
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {indicateurs.map((ind, index) => {
          const niveauSurvie = evaluerBenchmark(ind.tauxSurvie, BENCHMARK_SURVIE);
          const niveauFcr = evaluerBenchmark(ind.fcr, BENCHMARK_FCR);
          const niveauSgr = evaluerBenchmark(ind.sgr, BENCHMARK_SGR);
          const niveauMortalite = evaluerBenchmark(ind.tauxMortalite, BENCHMARK_MORTALITE);
          const niveauDensite = evaluerBenchmark(ind.densite, BENCHMARK_DENSITE);

          const aMauvaisIndicateur =
            niveauSurvie === "MAUVAIS" ||
            niveauFcr === "MAUVAIS" ||
            niveauSgr === "MAUVAIS" ||
            niveauMortalite === "MAUVAIS" ||
            niveauDensite === "MAUVAIS";

          return (
            <div
              key={ind.vagueId}
              className="animate-fade-in-up opacity-0"
              style={{ animationDelay: `${index * 60}ms` }}
            >
              <Card
                className={aMauvaisIndicateur ? "border-accent-red/40" : undefined}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-base">{ind.vagueCode}</CardTitle>
                    {aMauvaisIndicateur && (
                      <AlertTriangle className="h-4 w-4 text-accent-red" />
                    )}
                  </div>
                  {ind.nombreVivants !== null && (
                    <p className="text-xs text-muted-foreground">
                      {formatNumber(ind.nombreVivants)} {tAnalytics("indicators.livingFish")}
                    </p>
                  )}
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="divide-y divide-border">
                    <IndicateurRow
                      label={tAnalytics("indicators.survival")}
                      value={ind.tauxSurvie}
                      unit="%"
                      level={niveauSurvie}
                      icon={HeartPulse}
                    />
                    <IndicateurRow
                      label={tAnalytics("benchmarks.fcr.label")}
                      value={ind.fcr}
                      unit=""
                      level={niveauFcr}
                      icon={BarChart3}
                    />
                    <IndicateurRow
                      label={tAnalytics("benchmarks.sgr.label")}
                      value={ind.sgr}
                      unit={tAnalytics("labels.sgrUnit")}
                      level={niveauSgr}
                      icon={TrendingUp}
                    />
                    <IndicateurRow
                      label={tAnalytics("indicators.mortality")}
                      value={ind.tauxMortalite}
                      unit="%"
                      level={niveauMortalite}
                      icon={TrendingDown}
                    />
                    <IndicateurRow
                      label={tAnalytics("indicators.density")}
                      value={ind.densite}
                      unit="p/m\u00b3"
                      level={niveauDensite}
                      icon={Droplets}
                    />
                  </div>

                  {ind.activiteCorrectiveId && aMauvaisIndicateur && (
                    <Link
                      href={`/planning?id=${ind.activiteCorrectiveId}`}
                      className="mt-3 flex items-center justify-between rounded-lg px-3 py-2 text-xs font-medium transition-colors"
                      style={{
                        background: "var(--accent-red-muted)",
                        color: "var(--accent-red)",
                      }}
                    >
                      <span className="truncate">{ind.activiteCorrectiveTitre ?? tAnalytics("indicators.correctiveAction")}</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  )}
                </CardContent>
              </Card>
            </div>
          );
        })}
      </div>
    </section>
  );
}
