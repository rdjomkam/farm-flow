"use client";

import { useTranslations } from "next-intl";
import { Info } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
  DialogBody,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { GompertzPanelData } from "@/lib/gompertz-panel";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDateFr(isoDate: string): string {
  const d = new Date(isoDate);
  return d.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function r2Explanation(r2: number): string {
  if (r2 > 0.95) {
    return "Excellent — le modele reproduit tres fidelement la croissance observee.";
  }
  if (r2 > 0.85) {
    return "Bon — le modele suit bien la tendance generale.";
  }
  if (r2 > 0.70) {
    return "Acceptable — le modele donne une approximation utile.";
  }
  return "Faible — le modele a du mal a reproduire vos donnees, les projections sont a prendre avec precaution.";
}

function confidenceBadgeVariant(
  level: string
): "terminee" | "warning" | "default" {
  if (level === "HIGH") return "terminee";
  if (level === "MEDIUM") return "warning";
  return "default";
}

function confidenceBadgeLabel(level: string): string {
  const map: Record<string, string> = {
    HIGH: "Haute fiabilite",
    MEDIUM: "Fiabilite moyenne",
    LOW: "Faible fiabilite",
    INSUFFICIENT_DATA: "Donnees insuffisantes",
  };
  return map[level] ?? level;
}

function ecartColor(ecartPct: number): string {
  const abs = Math.abs(ecartPct);
  if (abs < 5) return "text-[var(--success)]";
  if (abs < 15) return "text-[var(--warning)]";
  return "text-[var(--danger)]";
}

function kComment(k: number): { label: string; color: string } {
  if (k < 0.02) {
    return { label: "(croissance lente)", color: "text-[var(--warning)]" };
  }
  if (k > 0.06) {
    return { label: "(croissance rapide)", color: "text-[var(--success)]" };
  }
  return { label: "(croissance normale)", color: "text-muted-foreground" };
}

// ─── Sub-sections ─────────────────────────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-sm font-semibold text-foreground border-b border-border pb-1 mb-3">
      {children}
    </h3>
  );
}

// ─── Section 1: Statut ────────────────────────────────────────────────────────

function StatutSection({ data }: { data: GompertzPanelData }) {
  return (
    <div>
      <SectionTitle>Statut du modele</SectionTitle>
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <Badge variant={confidenceBadgeVariant(data.confidenceLevel)}>
          {confidenceBadgeLabel(data.confidenceLevel)}
        </Badge>
      </div>
      <dl className="space-y-2 text-sm">
        <div>
          <dt className="font-medium">
            R<sup>2</sup> = {data.r2.toFixed(3)}
          </dt>
          <dd className="text-muted-foreground mt-0.5">{r2Explanation(data.r2)}</dd>
        </div>
        <div>
          <dt className="font-medium">RMSE = {data.rmse.toFixed(1)} g</dt>
          <dd className="text-muted-foreground mt-0.5">
            Erreur moyenne de &plusmn;{Math.round(data.rmse)} g sur les predictions.
          </dd>
        </div>
        <div>
          <dt className="font-medium">{data.biometrieCount} seances de biometrie</dt>
          <dd className="text-muted-foreground mt-0.5">
            Dates uniques de pesee utilisees pour calibrer le modele.
          </dd>
        </div>
      </dl>
    </div>
  );
}

// ─── Section 2: Paramètres ────────────────────────────────────────────────────

function ParamsSection({ data }: { data: GompertzPanelData }) {
  const t = useTranslations("vagues");
  const { wInfinity, k, ti } = data.params;
  const kInfo = kComment(k);

  return (
    <div>
      <SectionTitle>{t("gompertz.modelParams")}</SectionTitle>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {/* W∞ */}
        <Card>
          <CardContent className="p-3">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
              Poids maximum (W&infin;)
            </p>
            <p className="text-xl font-bold mb-2">{Math.round(wInfinity)} g</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Le poids theorique maximal que vos poissons peuvent atteindre dans les
              conditions actuelles d&apos;elevage. Ce n&apos;est pas un objectif mais une
              limite biologique estimee par le modele.
            </p>
          </CardContent>
        </Card>

        {/* k */}
        <Card>
          <CardContent className="p-3">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
              Vitesse de croissance (k)
            </p>
            <p className="text-xl font-bold mb-1">{k.toFixed(4)}</p>
            <p className={cn("text-xs font-medium mb-2", kInfo.color)}>
              {kInfo.label}
            </p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Plus cette valeur est elevee, plus vos poissons grossissent rapidement. Une
              valeur typique pour le silure se situe entre 0,02 et 0,06.
            </p>
          </CardContent>
        </Card>

        {/* ti */}
        <Card>
          <CardContent className="p-3">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
              Point d&apos;inflexion (ti)
            </p>
            <p className="text-xl font-bold mb-2">Jour {Math.round(ti)}</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Le jour ou la croissance est la plus rapide. Avant ce jour, la croissance
              accelere. Apres, elle ralentit progressivement jusqu&apos;au poids maximum.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ─── Section 3: Prédictions vs Réalité ────────────────────────────────────────

function ComparaisonSection({ data }: { data: GompertzPanelData }) {
  const t = useTranslations("vagues");
  const rows = data.comparaison;

  if (rows.length === 0) {
    return (
      <div>
        <SectionTitle>Predictions vs Realite</SectionTitle>
        <p className="text-sm text-muted-foreground">{t("gompertz.noBiometricData")}</p>
      </div>
    );
  }

  return (
    <div>
      <SectionTitle>Predictions vs Realite</SectionTitle>

      {/* Mobile: stacked cards */}
      <div className="flex flex-col gap-2 md:hidden">
        {rows.map((row) => {
          const color = ecartColor(row.ecartPct);
          const sign = row.ecartG >= 0 ? "+" : "";
          return (
            <Card key={row.jour}>
              <CardContent className="p-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                <div className="col-span-2 flex items-center justify-between mb-1">
                  <span className="font-medium">{formatDateFr(row.date)}</span>
                  <span className="text-muted-foreground text-xs">J{row.jour}</span>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Reel</p>
                  <p className="font-medium">{row.poidsReel} g</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Predit</p>
                  <p className="font-medium">{row.poidsPredits} g</p>
                </div>
                <div className="col-span-2">
                  <p className="text-xs text-muted-foreground">Ecart</p>
                  <p className={cn("font-medium", color)}>
                    {sign}{row.ecartG} g ({sign}{row.ecartPct} %)
                  </p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Desktop: table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-border text-muted-foreground text-left">
              <th className="py-2 pr-4 font-medium">Date</th>
              <th className="py-2 pr-4 font-medium">Jour</th>
              <th className="py-2 pr-4 font-medium text-right">Reel</th>
              <th className="py-2 pr-4 font-medium text-right">Predit</th>
              <th className="py-2 font-medium text-right">Ecart</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const color = ecartColor(row.ecartPct);
              const sign = row.ecartG >= 0 ? "+" : "";
              return (
                <tr key={row.jour} className="border-b border-border/50 last:border-0">
                  <td className="py-2 pr-4">{formatDateFr(row.date)}</td>
                  <td className="py-2 pr-4 text-muted-foreground">J{row.jour}</td>
                  <td className="py-2 pr-4 text-right font-medium">{row.poidsReel} g</td>
                  <td className="py-2 pr-4 text-right text-muted-foreground">{row.poidsPredits} g</td>
                  <td className={cn("py-2 text-right font-medium", color)}>
                    {sign}{row.ecartG} g ({sign}{row.ecartPct} %)
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Section 4: Projections ───────────────────────────────────────────────────

function ProjectionsSection({ data }: { data: GompertzPanelData }) {
  const { projections, poidsObjectif, joursAvantObjectif, dateObjectif, params } = data;
  const gainJ7 = projections.j7 - projections.poidsActuel;
  const gainJ14 = projections.j14 - projections.poidsActuel;
  const gainJ30 = projections.j30 - projections.poidsActuel;

  return (
    <div>
      <SectionTitle>Projections</SectionTitle>

      {/* Short-term projections */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 mb-4">
        {[
          { label: "Dans 7 jours", poids: projections.j7, gain: gainJ7 },
          { label: "Dans 14 jours", poids: projections.j14, gain: gainJ14 },
          { label: "Dans 30 jours", poids: projections.j30, gain: gainJ30 },
        ].map(({ label, poids, gain }) => (
          <Card key={label}>
            <CardContent className="p-3 text-center">
              <p className="text-xs text-muted-foreground mb-1">{label}</p>
              <p className="text-xl font-bold">{poids} g</p>
              <p className="text-xs text-[var(--success)] mt-1">
                +{Math.round(gain)} g vs aujourd&apos;hui
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Target weight card */}
      <Card>
        <CardContent className="p-4">
          {dateObjectif !== null && joursAvantObjectif !== null ? (
            <div>
              <p className="text-sm font-semibold mb-1">
                Objectif de {poidsObjectif} g estim&eacute; le{" "}
                <span className="text-primary">{formatDateFr(dateObjectif)}</span>
              </p>
              <p className="text-sm text-muted-foreground">
                Dans environ{" "}
                <strong>{joursAvantObjectif}</strong> jour
                {joursAvantObjectif !== 1 ? "s" : ""}
              </p>
            </div>
          ) : (
            <div>
              <p className="text-sm font-semibold text-[var(--warning)] mb-1">
                Objectif hors de portee
              </p>
              <p className="text-sm text-muted-foreground">
                Le poids objectif de {poidsObjectif} g d&eacute;passe le poids maximum
                th&eacute;orique (W&infin; = {Math.round(params.wInfinity)} g). V&eacute;rifiez
                les conditions d&apos;&eacute;levage ou ajustez l&apos;objectif.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface GompertzInfoPanelProps {
  data: GompertzPanelData;
}

export function GompertzInfoPanel({ data }: GompertzInfoPanelProps) {
  return (
    <Dialog>
      {/* R5: DialogTrigger asChild */}
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 shrink-0"
          aria-label="Détails du modèle Gompertz"
        >
          <Info className="h-4 w-4" />
              </Button>
      </DialogTrigger>

      <DialogContent className="md:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Analyse du modele Gompertz</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Parametres, predictions et projections du modele de croissance
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="flex flex-col gap-6">
          <StatutSection data={data} />
          <ParamsSection data={data} />
          <ComparaisonSection data={data} />
          <ProjectionsSection data={data} />
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
