"use client";

/**
 * Composant Projections — Section "Projections" du dashboard client.
 *
 * Affiche pour chaque vague active :
 * - SGR requis vs actuel (vert si en avance, rouge si en retard)
 * - Date de recolte estimee
 * - Aliment total restant estimé
 * - Revenu attendu (si prixVenteKg renseigné)
 * - Graphique Recharts : courbe de croissance projetee vs reelle
 *
 * Sprint 22 (S16-5) — Mobile first 360px
 */

import dynamic from "next/dynamic";
import { TrendingUp, TrendingDown, Calendar, Leaf, DollarSign, ChevronDown, ChevronUp } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { ProjectionVague } from "@/types";
import { useState } from "react";

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
  projections: ProjectionVague[];
}

interface ProjectionCardProps {
  projection: ProjectionVague;
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
  if (sgrActuel === null || sgrRequis === null) {
    return (
      <span className="text-xs text-muted-foreground">
        Pas assez de donnees biometriques
      </span>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2 flex-wrap">
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
            SGR actuel : {sgrActuel}%/j
          </span>
        </div>
        <span className="text-xs text-muted-foreground">
          (requis : {sgrRequis}%/j)
        </span>
      </div>
      <p
        className={cn(
          "text-xs font-medium",
          enAvance ? "text-success" : "text-destructive"
        )}
      >
        {enAvance
          ? "En avance sur l'objectif de croissance"
          : "En retard sur l'objectif de croissance"}
      </p>
    </div>
  );
}

/**
 * Graphique de croissance projetee vs reelle.
 */
function CourbeProjectionChart({ projection }: { projection: ProjectionVague }) {
  const { courbeProjection, joursEcoules, poidsObjectif } = projection;

  if (courbeProjection.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        Aucune donnee biometrique pour generer la projection.
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
            formatter={(value) =>
              value === "poidsReel" ? "Reel" : "Projete"
            }
          />
          {/* Ligne verticale au jour courant */}
          <ReferenceLine
            x={joursEcoules}
            stroke="var(--muted-foreground)"
            strokeDasharray="4 4"
            label={{ value: "Aujourd'hui", fontSize: 10, fill: "var(--muted-foreground)" }}
          />
          {/* Ligne horizontale objectif */}
          <ReferenceLine
            y={poidsObjectif}
            stroke="var(--accent-amber)"
            strokeDasharray="4 4"
            label={{ value: `Objectif ${poidsObjectif}g`, fontSize: 10, fill: "var(--accent-amber)" }}
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
          {/* Courbe projetee */}
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
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

/**
 * Carte de projection pour une vague.
 */
function ProjectionCard({ projection }: ProjectionCardProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base">{projection.vagueCode}</CardTitle>
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            aria-label={expanded ? "Masquer le graphique" : "Voir le graphique"}
          >
            {expanded ? (
              <>
                Masquer <ChevronUp className="h-3.5 w-3.5" />
              </>
            ) : (
              <>
                Graphique <ChevronDown className="h-3.5 w-3.5" />
              </>
            )}
          </button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* SGR actuel vs requis */}
        <div className="rounded-lg p-3 border border-border bg-muted/30">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
            Croissance (SGR)
          </p>
          <SGRBadge
            sgrActuel={projection.sgrActuel}
            sgrRequis={projection.sgrRequis}
            enAvance={projection.enAvance}
          />
          {projection.poidsMoyenActuel !== null && (
            <p className="mt-1.5 text-xs text-muted-foreground">
              Poids actuel : {projection.poidsMoyenActuel} g
              {" / "}
              Objectif : {projection.poidsObjectif} g
            </p>
          )}
        </div>

        {/* Grille de KPIs */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {/* Date de recolte */}
          <div className="flex flex-col gap-1 rounded-lg border border-border p-2.5 bg-card">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Calendar className="h-3.5 w-3.5" />
              <span className="text-[11px] font-medium">Recolte estimee</span>
            </div>
            {projection.dateRecolteEstimee !== null ? (
              <>
                <p className="text-sm font-semibold leading-tight">
                  {formatDate(projection.dateRecolteEstimee)}
                </p>
                <p className="text-xs text-muted-foreground">
                  dans {projection.joursRestantsEstimes} j
                </p>
              </>
            ) : (
              <p className="text-xs text-muted-foreground mt-1">
                Donnees insuffisantes
              </p>
            )}
          </div>

          {/* Aliment restant */}
          <div className="flex flex-col gap-1 rounded-lg border border-border p-2.5 bg-card">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Leaf className="h-3.5 w-3.5" />
              <span className="text-[11px] font-medium">Aliment restant</span>
            </div>
            {projection.alimentRestantEstime !== null ? (
              <p className="text-sm font-semibold">
                {projection.alimentRestantEstime} kg
              </p>
            ) : (
              <p className="text-xs text-muted-foreground mt-1">
                Donnees insuffisantes
              </p>
            )}
          </div>

          {/* Revenu attendu */}
          {projection.revenuAttendu !== null && (
            <div className="flex flex-col gap-1 rounded-lg border border-border p-2.5 bg-card col-span-2 sm:col-span-1">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <DollarSign className="h-3.5 w-3.5" />
                <span className="text-[11px] font-medium">Revenu attendu</span>
              </div>
              <p className="text-sm font-semibold">
                {formatCFA(projection.revenuAttendu)}
              </p>
            </div>
          )}
        </div>

        {/* Graphique — affiche si expanded */}
        {expanded && (
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              Courbe de croissance
            </p>
            <CourbeProjectionChart projection={projection} />
            <p className="text-[10px] text-muted-foreground mt-1 text-center">
              Ligne continue = mesures reelles · Pointilles = projection SGR actuel
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
export function Projections({ projections }: ProjectionsProps) {
  if (projections.length === 0) return null;

  return (
    <section>
      <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
        Projections de performance
      </h2>
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {projections.map((projection, index) => (
          <div
            key={projection.vagueId}
            className="animate-fade-in-up opacity-0"
            style={{ animationDelay: `${index * 80}ms` }}
          >
            <ProjectionCard projection={projection} />
          </div>
        ))}
      </div>
    </section>
  );
}
