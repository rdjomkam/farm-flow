"use client";

/**
 * src/components/previsions/tresorerie-trois-series-chart.tsx
 *
 * Graphique TRESORERIE A TROIS SERIES (ADR-053 §6.5 des exigences
 * fonctionnelles, amendement §15.2, Sprint PR3-ter, story B.5) :
 * BUDGET INITIAL (fige, ligne pointillee, `null` sur toute la serie si le
 * scenario n'a jamais ete active — jamais une courbe a zero qui ferait
 * croire a un budget initial nul, cf. `budgetInitialDisponible` gere par
 * l'appelant) / PRÉVISION ACTUALISÉE ou Reprevision glissante selon la
 * bascule "Reprevision" (courbe PRIMAIRE, zone sous zero coloree) / RÉEL
 * (ligne de comparaison), plus une BANDE D'ECART entre la courbe primaire
 * et RÉEL (§6.4 vue 4 des exigences : "courbe tresorerie prevue vs reelle
 * avec bande d'ecart").
 *
 * REUTILISATION, PAS DUPLICATION (instruction explicite du sprint) : la
 * technique de la zone sous zero coloree (gradient SVG dont l'`offset` est
 * calcule dynamiquement depuis le min/max affiche) est EXACTEMENT celle de
 * `tresorerie-chart.tsx` (Sprint PR2, story PR2.4) — extraite dans
 * `calculerOffsetGradientSousZero`
 * (`src/lib/previsions-presentation/gradient-tresorerie.ts`) et importee
 * ici SANS reimplementation locale. `tresorerie-chart.tsx` reste par
 * ailleurs INCHANGE dans son rendu (toujours consomme tel quel par
 * `tableau-bord-tab.tsx`) — ce fichier est un composant NOUVEAU et
 * DISTINCT, pas un remplacement, car la vue a 3 series + bande d'ecart +
 * bascule Reprevision n'a pas de commun structurel suffisant avec le
 * graphique mono-serie du tableau de bord pour justifier de le rendre
 * polymorphe sans risquer de le casser (ADR-053 §15.8.f : le snapshot a
 * ete livre et teste isolement avant cette vue, exactement comme demande).
 *
 * BANDE D'ECART, technique Recharts standard pour un "range" (aucune API
 * native pour une bande entre deux series independantes) : deux `Area`
 * empilees (`stackId` commun) — une base invisible
 * (`min(primaire, reel)`), une bande visible (`abs(reel - primaire)`).
 *
 * PRÉVISION ACTUALISÉE != Reprevision (ADR-053 §15.2, dernier paragraphe) :
 * la bascule `reprevisionActive` ci-dessous choisit QUELLE courbe est la
 * courbe PRIMAIRE (coloree sous zero) — jamais un synonyme cote libelle ni
 * cote code, cf. `t("tresorerieTroisSeriesChart.*")`.
 *
 * CAVEAT NON FILTRABLE (ADR-053 §15.1(b), §15.8(a)) : la serie RÉEL (et
 * donc la Reprevision sur ses mois REEL) est STRUCTURELLEMENT BIAISEE A LA
 * BAISSE des qu'un apport/subvention/pret a ete reellement encaisse (aucun
 * modele domaine reel pour ce cas, reporte sine die). Ce composant
 * n'AFFICHE PAS lui-meme ce caveat en texte (responsabilite de
 * `tresorerie-tab.tsx`, qui l'affiche une seule fois, lisiblement,
 * au-dessus du graphique) — mais il ne doit JAMAIS laisser croire, par son
 * seul rendu graphique, a un solde reel complet.
 */
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { ChartTooltip, ChartCrosshair } from "@/components/ui/chart-tooltip";
import { formatMontantPrevision } from "@/lib/previsions/format-previsions";
import { libelleMoisCalendaire } from "@/lib/previsions/tableau-de-bord-helpers";
import { calculerOffsetGradientSousZero } from "@/lib/previsions-presentation/gradient-tresorerie";
import type { MoisTresorerieTroisSeriesDTO, MoisReprevisionGlissanteDTO } from "@/components/previsions/tresorerie-types";

const ResponsiveContainer = dynamic(() => import("recharts").then((m) => m.ResponsiveContainer), { ssr: false });
const ComposedChart = dynamic(() => import("recharts").then((m) => m.ComposedChart), { ssr: false });
const Area = dynamic(() => import("recharts").then((m) => m.Area), { ssr: false });
const Line = dynamic(() => import("recharts").then((m) => m.Line), { ssr: false });
const XAxis = dynamic(() => import("recharts").then((m) => m.XAxis), { ssr: false });
const YAxis = dynamic(() => import("recharts").then((m) => m.YAxis), { ssr: false });
const CartesianGrid = dynamic(() => import("recharts").then((m) => m.CartesianGrid), { ssr: false });
const Tooltip = dynamic(() => import("recharts").then((m) => m.Tooltip), { ssr: false });
const ReferenceLine = dynamic(() => import("recharts").then((m) => m.ReferenceLine), { ssr: false });
const Legend = dynamic(() => import("recharts").then((m) => m.Legend), { ssr: false });

interface TresorerieTroisSeriesChartPoint {
  moisAbsolu: number;
  libelleMois: string;
  budgetInitial: number | null;
  previsionActualisee: number;
  reel: number;
  reprevision: number;
  primaire: number;
  bandeBase: number;
  bandeEcart: number;
}

interface TresorerieTroisSeriesChartProps {
  /** ISO string ou Date — `ScenarioPrevision.dateDebutPlan`. */
  dateDebutPlan: string | Date;
  series: MoisTresorerieTroisSeriesDTO[];
  reprevisionGlissante: MoisReprevisionGlissanteDTO[];
  /** `false` -> le scenario n'a jamais ete active : aucune courbe BUDGET INITIAL n'est tracee (jamais une courbe a zero trompeuse). */
  budgetInitialDisponible: boolean;
  /** Bascule "Reprevision" (§6.5) : `true` -> la courbe primaire coloree est la Reprevision glissante (reel substitue sur les mois clos), `false` -> la Prevision Actualisee. */
  reprevisionActive: boolean;
}

export function TresorerieTroisSeriesChart({
  dateDebutPlan,
  series,
  reprevisionGlissante,
  budgetInitialDisponible,
  reprevisionActive,
}: TresorerieTroisSeriesChartProps) {
  const t = useTranslations("previsions");

  if (series.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        {t("tresorerieTroisSeriesChart.noData")}
      </p>
    );
  }

  const dateDebut = typeof dateDebutPlan === "string" ? new Date(dateDebutPlan) : dateDebutPlan;
  const reprevisionParMois = new Map(reprevisionGlissante.map((m) => [m.moisAbsolu, m.soldeCumuleFCFA]));

  const data: TresorerieTroisSeriesChartPoint[] = series.map((m) => {
    const reprevision = reprevisionParMois.get(m.moisAbsolu) ?? m.previsionActualiseeFCFA;
    const primaire = reprevisionActive ? reprevision : m.previsionActualiseeFCFA;
    const bandeBase = Math.min(primaire, m.reelFCFA);
    const bandeEcart = Math.abs(m.reelFCFA - primaire);
    return {
      moisAbsolu: m.moisAbsolu,
      libelleMois: libelleMoisCalendaire(dateDebut, m.moisAbsolu),
      budgetInitial: budgetInitialDisponible ? m.budgetInitialFCFA : null,
      previsionActualisee: m.previsionActualiseeFCFA,
      reel: m.reelFCFA,
      reprevision,
      primaire,
      bandeBase,
      bandeEcart,
    };
  });

  const primaires = data.map((d) => d.primaire);
  const maxSolde = Math.max(...primaires, 0);
  const minSolde = Math.min(...primaires, 0);
  const offset = calculerOffsetGradientSousZero(maxSolde, minSolde);

  const libellePrimaire = reprevisionActive
    ? t("tresorerieTroisSeriesChart.series.reprevision")
    : t("tresorerieTroisSeriesChart.series.previsionActualisee");

  return (
    <figure aria-label={t("tresorerieTroisSeriesChart.ariaLabel")}>
      <div className="h-[300px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
            <defs>
              <linearGradient id="gradTresorerie3Series" x1="0" y1="0" x2="0" y2="1">
                <stop offset={0} stopColor="var(--success)" stopOpacity={0.3} />
                <stop offset={offset} stopColor="var(--success)" stopOpacity={0.3} />
                <stop offset={offset} stopColor="var(--danger)" stopOpacity={0.3} />
                <stop offset={1} stopColor="var(--danger)" stopOpacity={0.3} />
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
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <ReferenceLine y={0} stroke="var(--muted-foreground)" strokeDasharray="4 4" />

            {/* Bande d'ecart entre la courbe primaire et RÉEL — base invisible + bande visible empilees. */}
            <Area
              dataKey="bandeBase"
              stackId="bande"
              stroke="none"
              fill="transparent"
              legendType="none"
              isAnimationActive={false}
            />
            <Area
              dataKey="bandeEcart"
              stackId="bande"
              stroke="none"
              fill="var(--warning)"
              fillOpacity={0.25}
              name={t("tresorerieTroisSeriesChart.series.bandeEcart")}
              isAnimationActive={false}
            />

            {/* Courbe primaire (coloree sous zero) — PRÉVISION ACTUALISÉE ou Reprevision selon la bascule. */}
            <Area
              type="monotone"
              dataKey="primaire"
              name={libellePrimaire}
              stroke="var(--primary)"
              strokeWidth={2}
              fill="url(#gradTresorerie3Series)"
              isAnimationActive={false}
            />

            {/* RÉEL — ligne de comparaison, toujours affichee. */}
            <Line
              type="monotone"
              dataKey="reel"
              name={t("tresorerieTroisSeriesChart.series.reel")}
              stroke="var(--accent-blue)"
              strokeWidth={2}
              strokeDasharray="2 3"
              dot={false}
              isAnimationActive={false}
            />

            {/* BUDGET INITIAL — fige, ligne pointillee, absente si jamais active. */}
            {budgetInitialDisponible && (
              <Line
                type="monotone"
                dataKey="budgetInitial"
                name={t("tresorerieTroisSeriesChart.series.budgetInitial")}
                stroke="var(--muted-foreground)"
                strokeWidth={2}
                strokeDasharray="6 3"
                dot={false}
                connectNulls
                isAnimationActive={false}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </figure>
  );
}
