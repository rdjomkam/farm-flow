"use client";

/**
 * Composant Projections — Section "Projections" du dashboard client.
 *
 * Affiche pour chaque vague active :
 * - Badge de fiabilite Gompertz (HIGH/MEDIUM/LOW/INSUFFICIENT_DATA)
 * - SGR requis vs actuel (vert si en avance, rouge si en retard)
 * - Date de recolte estimee (SGR + Gompertz si disponible)
 * - Parametres Gompertz en langage metier (W∞, K, ti)
 * - Section "Details techniques" repliable (INGENIEUR/ADMIN uniquement)
 * - Aliment total restant estimé
 * - Revenu attendu (si prixVenteKg renseigné)
 * - Graphique Recharts : courbe de croissance projetee vs reelle
 *
 * Sprint 22 (S16-5) — Mobile first 360px
 * Story G2.3 — Extension Gompertz badges + date recolte
 */

import dynamic from "next/dynamic";
import { TrendingUp, TrendingDown, Calendar, Leaf, DollarSign, ChevronDown, ChevronUp } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ProjectionVague } from "@/types";
import type { ProjectionVagueV2 } from "@/types/calculs";
import { Role } from "@/types";
import { evaluerKGompertz } from "@/lib/benchmarks";
import { useState } from "react";
import { useTranslations } from "next-intl";

// Recharts chargés dynamiquement (SSR disabled)
const ResponsiveContainer = dynamic(
  () => import("recharts").then((mod) => mod.ResponsiveContainer),
  { ssr: false }
);
const ComposedChart = dynamic(
  () => import("recharts").then((mod) => mod.ComposedChart),
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
const ReferenceLine = dynamic(
  () => import("recharts").then((mod) => mod.ReferenceLine),
  { ssr: false }
);
const Legend = dynamic(
  () => import("recharts").then((mod) => mod.Legend),
  { ssr: false }
);

interface ProjectionsProps {
  projections: ProjectionVagueV2[];
  userRole?: Role;
}

interface ProjectionCardProps {
  projection: ProjectionVagueV2;
  userRole?: Role;
}

/** Formate un nombre en CFA avec separateur de milliers */
function formatCFA(montant: number): string {
  return montant.toLocaleString("fr-FR") + " CFA";
}

/** Formate une date en francais */
function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/**
 * Badge de fiabilite du modele Gompertz.
 * Ne s'affiche que si gompertzConfidence est present.
 */
function GompertzBadge({ confidence }: { confidence: string | null | undefined }) {
  const tAnalytics = useTranslations("analytics");

  if (!confidence) return null;

  if (confidence === "INSUFFICIENT_DATA") {
    return (
      <span className="text-[11px] text-muted-foreground italic">
        {tAnalytics("projections.gompertzBadge.INSUFFICIENT_DATA")}
      </span>
    );
  }

  if (confidence === "HIGH") {
    return (
      <Badge variant="terminee">
        {tAnalytics("projections.gompertzBadge.HIGH")}
      </Badge>
    );
  }

  if (confidence === "MEDIUM") {
    return (
      <Badge variant="warning">
        {tAnalytics("projections.gompertzBadge.MEDIUM")}
      </Badge>
    );
  }

  // LOW
  return (
    <Badge variant="default">
      {tAnalytics("projections.gompertzBadge.LOW")}
    </Badge>
  );
}

/**
 * Badge de comparaison SGR.
 * Vert si en avance (actuel >= requis), rouge si en retard, gris si donnees insuffisantes.
 */
function SGRBadge({
  sgrActuel,
  sgrRequis,
  enAvance,
}: {
  sgrActuel: number | null;
  sgrRequis: number | null;
  enAvance: boolean | null;
}) {
  const tAnalytics = useTranslations("analytics");

  if (sgrActuel === null || sgrRequis === null) {
    return (
      <span className="text-xs text-muted-foreground">
        {tAnalytics("projections.notEnoughData")}
      </span>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-col min-[400px]:flex-row min-[400px]:items-center gap-1 min-[400px]:gap-2">
        <div className="flex items-center gap-1.5">
          {enAvance ? (
            <TrendingUp className="h-4 w-4 text-success" />
          ) : (
            <TrendingDown className="h-4 w-4 text-destructive" />
          )}
          <span
            className={cn(
              "text-sm font-semibold",
              enAvance ? "text-success" : "text-destructive"
            )}
          >
            {tAnalytics("labels.sgrActuel")} : {sgrActuel}{tAnalytics("labels.sgrUnit")}
          </span>
        </div>
        <span className="text-xs text-muted-foreground">
          ({tAnalytics("labels.sgrRequis")} : {sgrRequis}{tAnalytics("labels.sgrUnit")})
        </span>
      </div>
      <p
        className={cn(
          "text-xs font-medium",
          enAvance ? "text-success" : "text-destructive"
        )}
      >
        {enAvance
          ? tAnalytics("labels.enAvanceSurObjectif")
          : tAnalytics("labels.enRetardSurObjectif")}
      </p>
    </div>
  );
}

/**
 * Bloc dates de recolte : SGR + Gompertz cote a cote.
 * Si Gompertz est present, les deux dates sont affichees et labellisees.
 */
function HarvestDateBlock({ projection }: { projection: ProjectionVagueV2 }) {
  const tAnalytics = useTranslations("analytics");
  const hasGompertz =
    typeof projection.dateRecolteGompertz === "number" &&
    projection.dateRecolteGompertz !== null;

  return (
    <div className="flex flex-col gap-1 rounded-lg border border-border p-2.5 bg-card">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <Calendar className="h-3.5 w-3.5" />
        <span className="text-[11px] font-medium">{tAnalytics("projections.estimatedHarvest")}</span>
      </div>

      {/* SGR harvest date */}
      {projection.dateRecolteEstimee !== null ? (
        <div className="flex flex-col gap-0.5">
          {hasGompertz && (
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {tAnalytics("projections.sgrHarvest")}
            </span>
          )}
          <p className="text-sm font-semibold leading-tight break-words">
            {formatDate(projection.dateRecolteEstimee)}
          </p>
          <p className="text-xs text-muted-foreground">
            {projection.joursRestantsEstimes !== null
              ? tAnalytics("projections.inDays", { count: projection.joursRestantsEstimes })
              : null}
          </p>
        </div>
      ) : (
        !hasGompertz && (
          <p className="text-xs text-muted-foreground mt-1">
            {tAnalytics("projections.insufficientData")}
          </p>
        )
      )}

      {/* Gompertz harvest date */}
      {hasGompertz && (
        <div className="flex flex-col gap-0.5 mt-1 pt-1 border-t border-border/50">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {tAnalytics("projections.gompertzHarvest")}
          </span>
          <p className="text-sm font-semibold text-primary">
            {tAnalytics("projections.harvestInDays", {
              count: Math.round(projection.dateRecolteGompertz as number),
            })}
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * Parametres Gompertz en langage metier pour les pisciculteurs.
 * W∞ → "Poids plafond : X g"
 * K → "Vitesse : Rapide/Normale/Lente"
 * ti → "Pic de croissance : jour X"
 */
function GompertzParamsMetier({ projection }: { projection: ProjectionVagueV2 }) {
  const tAnalytics = useTranslations("analytics");
  const { gompertzParams, gompertzConfidence } = projection;

  if (!gompertzParams || gompertzConfidence === "INSUFFICIENT_DATA") return null;

  const kLevel = evaluerKGompertz(gompertzParams.k);
  const speedLabel =
    kLevel === "EXCELLENT"
      ? tAnalytics("projections.gompertzParams.speedRapide")
      : kLevel === "BON"
        ? tAnalytics("projections.gompertzParams.speedNormale")
        : tAnalytics("projections.gompertzParams.speedLente");

  return (
    <div className="rounded-lg border border-border p-2.5 bg-card">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
        {tAnalytics("projections.gompertzParams.title")}
      </p>
      <dl className="grid grid-cols-1 min-[360px]:grid-cols-3 gap-1.5">
        <div className="flex flex-col gap-0.5">
          <dt className="text-[10px] text-muted-foreground">
            {tAnalytics("projections.gompertzParams.ceilingWeight")}
          </dt>
          <dd className="text-xs font-semibold">
            {Math.round(gompertzParams.wInfinity)} g
          </dd>
        </div>
        <div className="flex flex-col gap-0.5">
          <dt className="text-[10px] text-muted-foreground">
            {tAnalytics("projections.gompertzParams.speedLabel")}
          </dt>
          <dd className="text-xs font-semibold">{speedLabel}</dd>
        </div>
        <div className="flex flex-col gap-0.5">
          <dt className="text-[10px] text-muted-foreground">
            {tAnalytics("projections.gompertzParams.growthPeak")}
          </dt>
          <dd className="text-xs font-semibold">
            {tAnalytics("projections.gompertzParams.dayUnit", {
              day: Math.round(gompertzParams.ti),
            })}
          </dd>
        </div>
      </dl>
    </div>
  );
}

/**
 * Section "Details techniques" repliable — INGENIEUR/ADMIN uniquement.
 * Affiche les valeurs brutes W∞, K, ti, R².
 */
function TechnicalDetailsSection({ projection }: { projection: ProjectionVagueV2 }) {
  const tAnalytics = useTranslations("analytics");
  const [open, setOpen] = useState(false);
  const { gompertzParams, gompertzR2, gompertzConfidence } = projection;

  if (!gompertzParams || gompertzConfidence === "INSUFFICIENT_DATA") return null;

  return (
    <div className="rounded-lg border border-border bg-muted/20">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-3 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
        aria-expanded={open}
      >
        <span className="font-medium">
          {tAnalytics("projections.technicalDetails.title")}
        </span>
        {open ? (
          <ChevronUp className="h-3.5 w-3.5" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5" />
        )}
      </button>

      {open && (
        <div className="px-3 pb-3">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5">
            <div>
              <dt className="text-[10px] text-muted-foreground">
                {tAnalytics("projections.technicalDetails.wInfinity")}
              </dt>
              <dd className="text-xs font-mono font-semibold">
                {gompertzParams.wInfinity.toFixed(1)} g
              </dd>
            </div>
            <div>
              <dt className="text-[10px] text-muted-foreground">
                {tAnalytics("projections.technicalDetails.kRate")}
              </dt>
              <dd className="text-xs font-mono font-semibold">
                {gompertzParams.k.toFixed(4)} j⁻¹
              </dd>
            </div>
            <div>
              <dt className="text-[10px] text-muted-foreground">
                {tAnalytics("projections.technicalDetails.tiInflection")}
              </dt>
              <dd className="text-xs font-mono font-semibold">
                {gompertzParams.ti.toFixed(1)} j
              </dd>
            </div>
            {gompertzR2 !== null && gompertzR2 !== undefined && (
              <div>
                <dt className="text-[10px] text-muted-foreground">
                  {tAnalytics("projections.technicalDetails.r2")}
                </dt>
                <dd className="text-xs font-mono font-semibold">
                  {gompertzR2.toFixed(3)}
                </dd>
              </div>
            )}
          </dl>
        </div>
      )}
    </div>
  );
}

/**
 * Graphique de croissance projetee vs reelle.
 */
function CourbeProjectionChart({ projection }: { projection: ProjectionVagueV2 }) {
  const tAnalytics = useTranslations("analytics");
  const { courbeProjection, joursEcoules, poidsObjectif, gompertzParams, gompertzConfidence } = projection;

  const hasGompertzCurve =
    gompertzParams != null && gompertzConfidence !== "INSUFFICIENT_DATA";

  if (courbeProjection.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        {tAnalytics("projections.noDataMessage")}
      </p>
    );
  }

  return (
    <div className="h-[200px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={courbeProjection} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis
            dataKey="jour"
            tick={{ fontSize: 11 }}
            tickFormatter={(v) => `J${v}`}
          />
          <YAxis
            tick={{ fontSize: 10 }}
            tickFormatter={(v) => `${v}g`}
            width={44}
          />
          <Tooltip
            content={({ active, payload, label }) => {
              if (!active || !payload || payload.length === 0) return null;
              return (
                <div className="rounded-lg border border-border bg-card p-2 shadow text-xs">
                  <p className="font-medium mb-1">Jour {label}</p>
                  {payload.map((p) => (
                    <p key={p.name} style={{ color: p.color }}>
                      {p.name} : {p.value}g
                    </p>
                  ))}
                </div>
              );
            }}
          />
          <Legend
            wrapperStyle={{ fontSize: "11px" }}
            formatter={(value) => {
              if (value === "poidsReel") return "Reel";
              if (value === "poidsGompertz") return "Gompertz";
              return "Projete";
            }}
          />
          {/* Ligne verticale au jour courant */}
          <ReferenceLine
            x={joursEcoules}
            stroke="var(--muted-foreground)"
            strokeDasharray="4 4"
            label={{ value: "Auj.", fontSize: 10, fill: "var(--muted-foreground)" }}
          />
          {/* Ligne horizontale objectif */}
          <ReferenceLine
            y={poidsObjectif}
            stroke="var(--accent-amber)"
            strokeDasharray="4 4"
            label={{ value: `Obj. ${poidsObjectif}g`, fontSize: 10, fill: "var(--accent-amber)" }}
          />
          {/* Courbe reelle */}
          <Line
            type="monotone"
            dataKey="poidsReel"
            name="poidsReel"
            stroke="var(--primary)"
            strokeWidth={2}
            dot={{ r: 3, fill: "var(--primary)" }}
            activeDot={{ r: 5 }}
            connectNulls={false}
          />
          {/* Courbe projetee (SGR) */}
          <Line
            type="monotone"
            dataKey="poidsProjecte"
            name="poidsProjecte"
            stroke="var(--accent-blue)"
            strokeWidth={2}
            strokeDasharray="6 3"
            dot={false}
            activeDot={{ r: 4 }}
            connectNulls={false}
          />
          {/* Courbe Gompertz — affichee uniquement si le modele est calibre */}
          {hasGompertzCurve && (
            <Line
              type="monotone"
              dataKey="poidsGompertz"
              name="poidsGompertz"
              stroke="var(--accent-green, #22c55e)"
              strokeWidth={1.5}
              strokeDasharray="3 3"
              dot={false}
              activeDot={{ r: 3 }}
              connectNulls={true}
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

/**
 * Carte de projection pour une vague.
 * Accepte ProjectionVagueV2 (champs Gompertz optionnels, null si non calibre).
 */
function ProjectionCard({ projection, userRole }: ProjectionCardProps) {
  const [chartExpanded, setChartExpanded] = useState(false);
  const tAnalytics = useTranslations("analytics");

  const hasGompertz =
    projection.gompertzParams != null && projection.gompertzConfidence !== "INSUFFICIENT_DATA";

  // Seuls ADMIN et INGENIEUR voient les details techniques bruts
  const canSeeTechnicalDetails =
    userRole === Role.ADMIN || userRole === Role.INGENIEUR;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-col gap-1">
            <CardTitle className="text-base">{projection.vagueCode}</CardTitle>
            {/* Badge fiabilite Gompertz */}
            <GompertzBadge confidence={projection.gompertzConfidence} />
          </div>
          <button
            type="button"
            onClick={() => setChartExpanded((v) => !v)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors shrink-0"
            aria-label={chartExpanded ? tAnalytics("projections.hide") : tAnalytics("projections.chart")}
          >
            {chartExpanded ? (
              <>
                {tAnalytics("projections.hide")} <ChevronUp className="h-3.5 w-3.5" />
              </>
            ) : (
              <>
                {tAnalytics("projections.chart")} <ChevronDown className="h-3.5 w-3.5" />
              </>
            )}
          </button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* SGR actuel vs requis */}
        <div className="rounded-lg p-3 border border-border bg-muted/30">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
            {tAnalytics("labels.croissance")}
          </p>
          <SGRBadge
            sgrActuel={projection.sgrActuel}
            sgrRequis={projection.sgrRequis}
            enAvance={projection.enAvance}
          />
          {projection.poidsMoyenActuel !== null && (
            <p className="mt-1.5 text-xs text-muted-foreground">
              {tAnalytics("projections.currentWeight")} : {projection.poidsMoyenActuel} g
              {" / "}
              {tAnalytics("projections.target")} : {projection.poidsObjectif} g
            </p>
          )}
        </div>

        {/* Grille de KPIs */}
        <div className="grid grid-cols-1 min-[400px]:grid-cols-2 gap-2 sm:grid-cols-3">
          {/* Date de recolte (SGR + Gompertz) */}
          <HarvestDateBlock projection={projection} />

          {/* Aliment restant */}
          <div className="flex flex-col gap-1 rounded-lg border border-border p-2.5 bg-card">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Leaf className="h-3.5 w-3.5" />
              <span className="text-[11px] font-medium">{tAnalytics("projections.remainingFeed")}</span>
            </div>
            {projection.alimentRestantEstime !== null ? (
              <p className="text-sm font-semibold">
                {projection.alimentRestantEstime} kg
              </p>
            ) : (
              <p className="text-xs text-muted-foreground mt-1">
                {tAnalytics("projections.insufficientData")}
              </p>
            )}
          </div>

          {/* Revenu attendu */}
          {projection.revenuAttendu !== null && (
            <div className="flex flex-col gap-1 rounded-lg border border-border p-2.5 bg-card col-span-2 sm:col-span-1">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <DollarSign className="h-3.5 w-3.5" />
                <span className="text-[11px] font-medium">{tAnalytics("projections.expectedRevenue")}</span>
              </div>
              <p className="text-sm font-semibold break-words">
                {formatCFA(projection.revenuAttendu)}
              </p>
            </div>
          )}
        </div>

        {/* Parametres Gompertz en langage metier */}
        {hasGompertz && <GompertzParamsMetier projection={projection} />}

        {/* Details techniques — INGENIEUR/ADMIN uniquement */}
        {hasGompertz && canSeeTechnicalDetails && (
          <TechnicalDetailsSection projection={projection} />
        )}

        {/* Graphique — affiche si chartExpanded */}
        {chartExpanded && (
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              {tAnalytics("projections.growthCurve")}
            </p>
            <CourbeProjectionChart projection={projection} />
            <p className="text-[10px] text-muted-foreground mt-1 text-center">
              {tAnalytics("projections.chartLegend")}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Section Projections du dashboard.
 * Affiche une ProjectionCard par vague active.
 */
export function Projections({ projections, userRole }: ProjectionsProps) {
  const tAnalytics = useTranslations("analytics");

  if (projections.length === 0) return null;

  return (
    <section>
      <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
        {tAnalytics("projections.title")}
      </h2>
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {projections.map((projection, index) => (
          <div
            key={projection.vagueId}
            className="animate-fade-in-up opacity-0"
            style={{ animationDelay: `${index * 80}ms` }}
          >
            <ProjectionCard projection={projection} userRole={userRole} />
          </div>
        ))}
      </div>
    </section>
  );
}
