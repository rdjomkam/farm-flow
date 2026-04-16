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

function useR2Explanation() {
  const t = useTranslations("vagues.gompertz");
  return (r2: number): string => {
    if (r2 > 0.95) return t("r2Excellent");
    if (r2 > 0.85) return t("r2Good");
    if (r2 > 0.70) return t("r2Acceptable");
    return t("r2Weak");
  };
}

function confidenceBadgeVariant(
  level: string
): "terminee" | "warning" | "default" {
  if (level === "HIGH") return "terminee";
  if (level === "MEDIUM") return "warning";
  return "default";
}

function useConfidenceBadgeLabel() {
  const t = useTranslations("vagues.gompertz.confidence");
  return (level: string): string => {
    const knownLevels = ["HIGH", "MEDIUM", "LOW", "INSUFFICIENT_DATA"] as const;
    if ((knownLevels as readonly string[]).includes(level)) {
      return t(level as (typeof knownLevels)[number]);
    }
    return level;
  };
}

function ecartColor(ecartPct: number): string {
  const abs = Math.abs(ecartPct);
  if (abs < 5) return "text-[var(--success)]";
  if (abs < 15) return "text-[var(--warning)]";
  return "text-[var(--danger)]";
}

function useKComment() {
  const t = useTranslations("vagues.gompertz");
  return (k: number): { label: string; color: string } => {
    if (k < 0.02) return { label: t("kSlow"), color: "text-[var(--warning)]" };
    if (k > 0.06) return { label: t("kFast"), color: "text-[var(--success)]" };
    return { label: t("kNormal"), color: "text-muted-foreground" };
  };
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
  const t = useTranslations("vagues");
  const tG = useTranslations("vagues.gompertz");
  const getConfidenceLabel = useConfidenceBadgeLabel();
  const getR2Explanation = useR2Explanation();
  return (
    <div>
      <SectionTitle>{t("gompertz.modelStatus")}</SectionTitle>
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <Badge variant={confidenceBadgeVariant(data.confidenceLevel)}>
          {getConfidenceLabel(data.confidenceLevel)}
        </Badge>
      </div>
      <dl className="space-y-2 text-sm">
        <div>
          <dt className="font-medium">
            R<sup>2</sup> = {data.r2.toFixed(3)}
          </dt>
          <dd className="text-muted-foreground mt-0.5">{getR2Explanation(data.r2)}</dd>
        </div>
        <div>
          <dt className="font-medium">RMSE = {data.rmse.toFixed(1)} g</dt>
          <dd className="text-muted-foreground mt-0.5">
            {tG("rmseDescription", { rmse: String(Math.round(data.rmse)) })}
          </dd>
        </div>
        <div>
          <dt className="font-medium">{tG("biometrieCount", { count: data.biometrieCount })}</dt>
          <dd className="text-muted-foreground mt-0.5">
            {tG("biometrieCountDescription")}
          </dd>
        </div>
      </dl>
    </div>
  );
}

// ─── Section 2: Paramètres ────────────────────────────────────────────────────

function ParamsSection({ data }: { data: GompertzPanelData }) {
  const t = useTranslations("vagues");
  const tG = useTranslations("vagues.gompertz");
  const { wInfinity, k, ti } = data.params;
  const getKComment = useKComment();
  const kInfo = getKComment(k);

  return (
    <div>
      <SectionTitle>{t("gompertz.modelParams")}</SectionTitle>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {/* W∞ */}
        <Card>
          <CardContent className="p-3">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
              {tG("wInfinityLabel")}
            </p>
            <p className="text-xl font-bold mb-2">{Math.round(wInfinity)} g</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {tG("wInfinityDescription")}
            </p>
          </CardContent>
        </Card>

        {/* k */}
        <Card>
          <CardContent className="p-3">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
              {tG("kLabel")}
            </p>
            <p className="text-xl font-bold mb-1">{k.toFixed(4)}</p>
            <p className={cn("text-xs font-medium mb-2", kInfo.color)}>
              {kInfo.label}
            </p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {tG("kDescription")}
            </p>
          </CardContent>
        </Card>

        {/* ti */}
        <Card>
          <CardContent className="p-3">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
              {tG("tiLabel")}
            </p>
            <p className="text-xl font-bold mb-2">{t("gompertz.day", { day: Math.round(ti) })}</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {tG("tiDescription")}
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
        <SectionTitle>{t("gompertz.predictionsVsReality")}</SectionTitle>
        <p className="text-sm text-muted-foreground">{t("gompertz.noBiometricData")}</p>
      </div>
    );
  }

  return (
    <div>
      <SectionTitle>{t("gompertz.predictionsVsReality")}</SectionTitle>

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
                  <p className="text-xs text-muted-foreground">{t("gompertz.actual")}</p>
                  <p className="font-medium">{row.poidsReel} g</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{t("gompertz.predicted")}</p>
                  <p className="font-medium">{row.poidsPredits} g</p>
                </div>
                <div className="col-span-2">
                  <p className="text-xs text-muted-foreground">{t("gompertz.deviation")}</p>
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
              <th className="py-2 pr-4 font-medium">{t("gompertz.dateHeader")}</th>
              <th className="py-2 pr-4 font-medium">{t("gompertz.dayHeader")}</th>
              <th className="py-2 pr-4 font-medium text-right">{t("gompertz.actual")}</th>
              <th className="py-2 pr-4 font-medium text-right">{t("gompertz.predicted")}</th>
              <th className="py-2 font-medium text-right">{t("gompertz.deviation")}</th>
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
  const t = useTranslations("vagues");
  const tG = useTranslations("vagues.gompertz");
  const { projections, poidsObjectif, joursAvantObjectif, dateObjectif, params } = data;
  const gainJ7 = projections.j7 - projections.poidsActuel;
  const gainJ14 = projections.j14 - projections.poidsActuel;
  const gainJ30 = projections.j30 - projections.poidsActuel;

  return (
    <div>
      <SectionTitle>{t("gompertz.projections")}</SectionTitle>

      {/* Short-term projections */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 mb-4">
        {[
          { days: 7, poids: projections.j7, gain: gainJ7 },
          { days: 14, poids: projections.j14, gain: gainJ14 },
          { days: 30, poids: projections.j30, gain: gainJ30 },
        ].map(({ days, poids, gain }) => (
          <Card key={days}>
            <CardContent className="p-3 text-center">
              <p className="text-xs text-muted-foreground mb-1">{tG("inDays", { count: days })}</p>
              <p className="text-xl font-bold">{poids} g</p>
              <p className="text-xs text-[var(--success)] mt-1">
                {tG("vsToday", { gain: String(Math.round(gain)) })}
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
                {tG("objectifReached", { poids: poidsObjectif, date: formatDateFr(dateObjectif) })}
              </p>
              <p className="text-sm text-muted-foreground">
                {tG("objectifDays", { count: joursAvantObjectif })}
              </p>
            </div>
          ) : (
            <div>
              <p className="text-sm font-semibold text-[var(--warning)] mb-1">
                {tG("objectifUnreachable")}
              </p>
              <p className="text-sm text-muted-foreground">
                {tG("objectifUnreachableDescription", { poids: poidsObjectif, wInfinity: Math.round(params.wInfinity) })}
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
  const t = useTranslations("vagues.gompertz");
  return (
    <Dialog>
      {/* R5: DialogTrigger asChild */}
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 shrink-0"
          aria-label={t("ariaLabelDetails")}
        >
          <Info className="h-4 w-4" />
              </Button>
      </DialogTrigger>

      <DialogContent className="md:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("dialogTitle")}</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            {t("dialogDescription")}
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
