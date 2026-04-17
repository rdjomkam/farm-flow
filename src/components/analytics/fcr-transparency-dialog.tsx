"use client";

import { useState, useCallback, useEffect } from "react";
import { Info, ChevronDown, RefreshCw, Loader2, AlertTriangle, FlaskConical, Users, TrendingUp } from "lucide-react";
import { useTranslations, useLocale } from "next-intl";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { FCRBacPeriode, FCRByFeedResult, FCRByFeedVague } from "@/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const fmt = (n: number, d = 2) => n.toFixed(d);
const fmtInt = (n: number, locale: string) => Math.round(n).toLocaleString(locale);
const fmtDate = (d: Date | string, locale: string) =>
  new Date(d).toLocaleDateString(locale, { day: "2-digit", month: "2-digit" });

function ConfidenceBadge({ level }: { level: string }) {
  const t = useTranslations("analytics.fcrTrace.confidence");
  const classNames: Record<string, string> = {
    HIGH: "bg-emerald-100 text-emerald-700",
    MEDIUM: "bg-amber-100 text-amber-700",
    LOW: "bg-orange-100 text-orange-700",
    INSUFFICIENT_DATA: "bg-gray-100 text-gray-600",
  };
  const className = classNames[level] ?? classNames.LOW;
  const label = (["HIGH", "MEDIUM", "LOW", "INSUFFICIENT_DATA"] as const).includes(level as "HIGH" | "MEDIUM" | "LOW" | "INSUFFICIENT_DATA")
    ? t(level as "HIGH" | "MEDIUM" | "LOW" | "INSUFFICIENT_DATA")
    : level;
  return (
    <span className={cn("inline-block rounded-full px-1.5 py-0.5 text-[10px] font-semibold", className)}>
      {label}
    </span>
  );
}

function FlagBadge({ type }: { type: "LOW_CONFIDENCE" | "HIGH_FCR" | "INSUFFICIENT_DATA" }) {
  const t = useTranslations("analytics.fcrTrace.confidence");
  const configs = {
    LOW_CONFIDENCE: { label: "R² < 0.85", className: "bg-amber-100 text-amber-700" },
    HIGH_FCR: { label: "ICA > 3.0", className: "bg-red-100 text-red-700" },
    INSUFFICIENT_DATA: { label: t("INSUFFICIENT_DATA"), className: "bg-gray-100 text-gray-600" },
  };
  const { label, className } = configs[type];
  return (
    <span className={cn("inline-block rounded-full px-1.5 py-0.5 text-[10px] font-semibold", className)}>
      {label}
    </span>
  );
}

function LabelValue({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className={cn("font-semibold tabular-nums text-xs", mono && "font-mono")}>{value}</p>
    </div>
  );
}

function PopMethodeBadge({ methode }: { methode: string }) {
  const t = useTranslations("analytics.fcrTrace");
  const isComptage = methode === "COMPTAGE_ANCRAGE";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-medium",
        isComptage ? "bg-blue-50 text-blue-700" : "bg-slate-100 text-slate-600"
      )}
    >
      <Users className="h-2.5 w-2.5" />
      {isComptage ? t("comptage") : t("proportionnel")}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Per-bac period row — full detail
// ---------------------------------------------------------------------------

function PeriodeBacRow({ periode }: { periode: FCRBacPeriode }) {
  const t = useTranslations("analytics.fcrTrace");
  const locale = useLocale();
  const title = `${periode.bacNom} · ${fmtDate(periode.dateDebut, locale)} → ${fmtDate(periode.dateFin, locale)} (${periode.dureeJours}j)`;

  return (
    <details className="group border border-border rounded-lg overflow-hidden">
      <summary className="flex items-center justify-between px-3 py-2 cursor-pointer select-none list-none bg-muted/40 hover:bg-muted/60 transition-colors">
        <span className="text-xs font-medium truncate pr-2">{title}</span>
        <div className="flex items-center gap-2 shrink-0">
          {periode.fcr !== null && (
            <span className="text-xs font-semibold text-primary tabular-nums">
              ICA {fmt(periode.fcr)}
            </span>
          )}
          {periode.flagHighFCR && <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0" />}
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground transition-transform group-open:rotate-180" />
        </div>
      </summary>

      <div className="px-3 py-2 space-y-2.5 text-xs">
        {/* Row 1: Feed + Biomass gain */}
        <div className="grid grid-cols-2 gap-2">
          <LabelValue label={t("feedConsumed")} value={`${fmt(periode.qtyAlimentKg)} kg`} />
          <LabelValue
            label={t("biomassGain")}
            value={periode.gainBiomasseKg > 0 ? `+${fmt(periode.gainBiomasseKg)} kg` : "—"}
          />
        </div>

        {/* Row 2: Weight start → end */}
        <div className="grid grid-cols-2 gap-2">
          <LabelValue label={t("poidsDebutGompertz")} value={`${fmt(periode.poidsDebutG, 1)} g`} />
          <LabelValue label={t("poidsFinGompertz")} value={`${fmt(periode.poidsFinG, 1)} g`} />
        </div>

        {/* Row 3: Population */}
        <div className="flex items-start gap-3">
          <div className="flex-1 grid grid-cols-3 gap-2">
            <LabelValue label={t("popDebut")} value={fmtInt(periode.populationDebut, locale)} />
            <LabelValue label={t("popFin")} value={fmtInt(periode.populationFin, locale)} />
            <LabelValue label={t("popMoyenne")} value={fmtInt(periode.avgFishCount, locale)} />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <PopMethodeBadge methode={periode.populationMethode} />
          <span className="text-[10px] text-muted-foreground">
            {t("joursExclusifs", { count: periode.joursExclusifs })}{periode.joursMixtes > 0 ? ` + ${t("joursMixtes", { count: periode.joursMixtes })}` : ""}
          </span>
        </div>

        {/* Row 4: Gain per fish + biomass formula */}
        <div className="grid grid-cols-2 gap-2">
          <LabelValue label={t("gainParPoisson")} value={`${fmt(periode.gainParPoissonG, 2)} g`} />
          <LabelValue
            label={t("biomassGain")}
            value={`${fmt(periode.gainParPoissonG, 2)}g × ${fmtInt(periode.avgFishCount, locale)} / 1000 = ${fmt(periode.gainBiomasseKg)}`}
            mono
          />
        </div>

        {/* FCR formula */}
        {periode.fcr !== null && (
          <div className="border-t border-border pt-2 flex items-center justify-between">
            <span className="text-muted-foreground">ICA</span>
            <code className="font-mono font-semibold text-primary text-xs">
              {fmt(periode.qtyAlimentKg)} / {fmt(periode.gainBiomasseKg)} = {fmt(periode.fcr)}
            </code>
          </div>
        )}

        {/* Flags */}
        {periode.flagHighFCR && (
          <div className="flex flex-wrap gap-1">
            <FlagBadge type="HIGH_FCR" />
          </div>
        )}
      </div>
    </details>
  );
}

// ---------------------------------------------------------------------------
// Gompertz section per vague
// ---------------------------------------------------------------------------

function GompertzSection({ gompertz }: { gompertz: FCRByFeedVague["gompertz"] }) {
  const t = useTranslations("analytics.fcrTrace");
  if (!gompertz) return null;

  return (
    <div className="rounded-lg border border-border bg-muted/20 px-3 py-2 space-y-1.5">
      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground uppercase tracking-wide font-semibold">
        <FlaskConical className="h-3 w-3" />
        {t("modeleGompertz")}
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
        <LabelValue label={t("wInfinityLabel")} value={`${fmt(gompertz.wInfinity, 0)} g`} />
        <LabelValue label={t("kLabel")} value={fmt(gompertz.k, 6)} mono />
        <LabelValue label={t("tiLabel")} value={`jour ${fmt(gompertz.ti, 1)}`} />
        <LabelValue label={t("r2QualiteLabel")} value={fmt(gompertz.r2, 4)} mono />
      </div>
      <div className="flex items-center gap-2 pt-0.5">
        <ConfidenceBadge level={gompertz.confidenceLevel} />
        <span className="text-[10px] text-muted-foreground">
          {gompertz.biometrieCount !== 1 ? t("biometriePointsPlural", { count: gompertz.biometrieCount }) : t("biometriePoints", { count: gompertz.biometrieCount })}
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Vague section
// ---------------------------------------------------------------------------

function VagueSection({ vague, defaultOpen }: { vague: FCRByFeedVague; defaultOpen?: boolean }) {
  const t = useTranslations("analytics.fcrTrace");
  const locale = useLocale();
  const periodesBac = vague.periodesBac ?? [];

  return (
    <details className="group border border-border rounded-xl overflow-hidden" open={defaultOpen}>
      <summary className="flex items-center justify-between px-4 py-3 cursor-pointer select-none list-none bg-muted/30 hover:bg-muted/50 transition-colors">
        <div className="min-w-0">
          <p className="text-sm font-semibold truncate">{t("vagueCode", { code: vague.vagueCode })}</p>
          <p className="text-xs text-muted-foreground">
            {fmtDate(vague.dateDebut, locale)} → {vague.dateFin ? fmtDate(vague.dateFin, locale) : t("enCours")}
            {" · "}
            {periodesBac.length !== 1 ? t("periodeCountPlural", { count: periodesBac.length }) : t("periodeCount", { count: periodesBac.length })}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {vague.fcrVague !== null && (
            <span className="text-sm font-bold text-primary tabular-nums">
              ICA {fmt(vague.fcrVague)}
            </span>
          )}
          {vague.insufficientData && <FlagBadge type="INSUFFICIENT_DATA" />}
          <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180" />
        </div>
      </summary>

      <div className="px-4 py-3 space-y-3">
        {/* Gompertz details */}
        <GompertzSection gompertz={vague.gompertz} />

        {/* Vague summary */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <LabelValue label={t("totalFeed")} value={`${fmt(vague.totalAlimentKg)} kg`} />
          <LabelValue
            label={t("biomassGainTotal")}
            value={vague.totalGainBiomasseKg > 0 ? `+${fmt(vague.totalGainBiomasseKg)} kg` : "—"}
          />
        </div>

        {/* FCR formula for vague */}
        {vague.fcrVague !== null && (
          <div className="rounded-lg border border-border bg-muted/20 px-3 py-2 flex items-center justify-between text-xs">
            <span className="text-muted-foreground">{t("icaVague")}</span>
            <code className="font-mono font-semibold text-primary">
              {fmt(vague.totalAlimentKg)} / {fmt(vague.totalGainBiomasseKg)} = {fmt(vague.fcrVague)}
            </code>
          </div>
        )}

        {/* Flags */}
        <div className="flex flex-wrap gap-1">
          {vague.flagLowConfidence && <FlagBadge type="LOW_CONFIDENCE" />}
          {vague.insufficientData && <FlagBadge type="INSUFFICIENT_DATA" />}
        </div>

        {/* Per-bac periods */}
        {periodesBac.length === 0 ? (
          <p className="text-xs text-muted-foreground">{t("noPeriods")}</p>
        ) : (
          <div className="space-y-2">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-semibold flex items-center gap-1">
              <TrendingUp className="h-3 w-3" />
              {t("detailParBacEtPeriode")}
            </p>
            {periodesBac.map((periode, idx) => (
              <PeriodeBacRow
                key={`${periode.bacId}-${String(periode.dateDebut)}-${idx}`}
                periode={periode}
              />
            ))}
          </div>
        )}
      </div>
    </details>
  );
}

// ---------------------------------------------------------------------------
// Aggregation section
// ---------------------------------------------------------------------------

function AggregationSection({
  fcrGlobal,
  totalAlimentKg,
  totalGainBiomasseKg,
  nombreVaguesIncluses,
  nombreVaguesIgnorees,
  params,
}: {
  fcrGlobal: number | null;
  totalAlimentKg: number;
  totalGainBiomasseKg: number;
  nombreVaguesIncluses: number;
  nombreVaguesIgnorees: number;
  params: { minPoints: number; wInfinity: number | null };
}) {
  const t = useTranslations("analytics.fcrTrace");
  return (
    <div className="rounded-xl border border-border bg-muted/20 px-4 py-3 space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {t("agregationGlobale")}
      </p>
      <code className="block text-xs font-mono text-muted-foreground">
        ICA = Σ aliment (vagues valides) / Σ gain biomasse
      </code>
      <div className="grid grid-cols-2 gap-2 text-xs pt-1">
        <LabelValue label={t("totalAliment")} value={`${fmt(totalAlimentKg)} kg`} />
        <LabelValue
          label={t("totalGainLabel")}
          value={totalGainBiomasseKg > 0 ? `+${fmt(totalGainBiomasseKg)} kg` : "—"}
        />
        <LabelValue label={t("vaguesIncluses")} value={String(nombreVaguesIncluses)} />
        <LabelValue label={t("vaguesIgnorees")} value={String(nombreVaguesIgnorees)} />
      </div>
      <div className="flex items-center gap-2 text-[10px] text-muted-foreground pt-1">
        <span>{t("paramsMinPoints", { count: params.minPoints })}</span>
        {params.wInfinity !== null && <span>W∞={params.wInfinity}g</span>}
      </div>
      {fcrGlobal !== null && totalGainBiomasseKg > 0 && (
        <div className="border-t border-border pt-2 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">{t("fcrFinalShort")}</span>
          <code className="font-mono text-sm font-bold text-primary">
            {fmt(totalAlimentKg)} / {fmt(totalGainBiomasseKg)} ={" "}
            <span>{fmt(fcrGlobal)}</span>
          </code>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main content — works with full FCRByFeedResult
// ---------------------------------------------------------------------------

function FCRByFeedContent({ data }: { data: FCRByFeedResult }) {
  const t = useTranslations("analytics.fcrTrace");
  return (
    <div className="space-y-4">
      {/* Summary bar */}
      <div className="rounded-xl border border-border bg-muted/30 px-4 py-3 flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground">{t("produitLabel")}</p>
          <p className="text-sm font-semibold">{data.produitNom}</p>
          {data.fournisseurNom && (
            <p className="text-xs text-muted-foreground">{data.fournisseurNom}</p>
          )}
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">{t("icaFinal")}</p>
          <p className="text-2xl font-bold text-primary tabular-nums">
            {data.fcrGlobal !== null ? fmt(data.fcrGlobal) : "—"}
          </p>
        </div>
      </div>

      {/* Aggregation */}
      <AggregationSection
        fcrGlobal={data.fcrGlobal}
        totalAlimentKg={data.totalAlimentKg}
        totalGainBiomasseKg={data.totalGainBiomasseKg}
        nombreVaguesIncluses={data.nombreVaguesIncluses}
        nombreVaguesIgnorees={data.nombreVaguesIgnorees}
        params={data.params}
      />

      {/* Per-vague sections */}
      {data.parVague.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center">{t("noData")}</p>
      ) : (
        <div className="space-y-3">
          {data.parVague.map((vague, idx) => (
            <VagueSection key={vague.vagueId} vague={vague} defaultOpen={idx === 0} />
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Lazy fetch wrapper
// ---------------------------------------------------------------------------

function FCRByFeedContentLazy({ produitId }: { produitId: string }) {
  const t = useTranslations("analytics.fcrTrace");
  const [data, setData] = useState<FCRByFeedResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/analytics/aliments/${produitId}/fcr-by-feed`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: FCRByFeedResult = await res.json();
      setData(json);
    } catch {
      setError(t("error"));
    } finally {
      setLoading(false);
    }
  }, [produitId, t]);

  useEffect(() => {
    loadData();
  }, [produitId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">{t("loading")}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3">
        <p className="text-sm text-muted-foreground text-center">{error}</p>
        <Button variant="outline" size="sm" onClick={loadData}>
          <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
          {t("retry")}
        </Button>
      </div>
    );
  }

  if (!data) {
    return (
      <p className="text-sm text-muted-foreground py-8 text-center">{t("noData")}</p>
    );
  }

  return <FCRByFeedContent data={data} />;
}

// ---------------------------------------------------------------------------
// Public component: trigger + dialog
// ---------------------------------------------------------------------------

interface FCRTransparencyDialogProps {
  produitId: string;
  produitNom: string;
  fcrMoyen: number | null;
  /** Pre-loaded full result (optional). If absent, lazy-fetched from API. */
  fcrByFeedResult?: FCRByFeedResult;
}

export function FCRTransparencyDialog({
  produitId,
  produitNom,
  fcrMoyen,
  fcrByFeedResult,
}: FCRTransparencyDialogProps) {
  const t = useTranslations("analytics.fcrTrace");

  if (fcrMoyen === null) return null;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground gap-1"
        >
          <Info className="h-3.5 w-3.5" />
          {t("triggerLabel")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {t("title")} — {produitNom}
          </DialogTitle>
        </DialogHeader>
        <DialogBody>
          {fcrByFeedResult ? (
            <FCRByFeedContent data={fcrByFeedResult} />
          ) : (
            <FCRByFeedContentLazy produitId={produitId} />
          )}
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
