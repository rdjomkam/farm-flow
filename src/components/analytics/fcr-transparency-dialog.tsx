"use client";

import { useState, useCallback, useEffect } from "react";
import { Info, ChevronDown, RefreshCw, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
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
import type {
  FCRTrace,
  FCRTraceVague,
  FCRTracePeriode,
  FCRTraceEstimationDetail,
} from "@/types";

// ---------------------------------------------------------------------------
// Method badge
// ---------------------------------------------------------------------------

type MethodeEstimation =
  | "BIOMETRIE_EXACTE"
  | "GOMPERTZ_VAGUE"
  | "INTERPOLATION_LINEAIRE"
  | "VALEUR_INITIALE";

function MethodeBadge({ methode }: { methode: MethodeEstimation }) {
  const t = useTranslations("analytics.fcrTrace");

  const config: Record<MethodeEstimation, { label: string; className: string }> = {
    BIOMETRIE_EXACTE: {
      label: t("biometrieExacte"),
      className: "bg-green-100 text-green-700",
    },
    GOMPERTZ_VAGUE: {
      label: t("gompertzVague"),
      className: "bg-sky-100 text-sky-700",
    },
    INTERPOLATION_LINEAIRE: {
      label: t("interpolationLineaire"),
      className: "bg-amber-100 text-amber-700",
    },
    VALEUR_INITIALE: {
      label: t("valeurInitiale"),
      className: "bg-gray-100 text-gray-600",
    },
  };

  const { label, className } = config[methode] ?? config.VALEUR_INITIALE;

  return (
    <span
      className={cn(
        "inline-block rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
        className
      )}
    >
      {label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Estimation detail block
// ---------------------------------------------------------------------------

function EstimationDetailBlock({ detail }: { detail: FCRTraceEstimationDetail | null }) {
  const t = useTranslations("analytics.fcrTrace");

  if (!detail) return null;

  if (detail.methode === "BIOMETRIE_EXACTE") {
    return (
      <p className="text-xs text-muted-foreground mt-0.5">
        {new Date(detail.dateBiometrie).toLocaleDateString("fr-FR", {
          day: "2-digit",
          month: "2-digit",
        })}
        {" : "}
        {detail.poidsMesureG.toFixed(1)} g
      </p>
    );
  }

  if (detail.methode === "INTERPOLATION_LINEAIRE") {
    return (
      <div className="text-xs text-muted-foreground mt-0.5 space-y-0.5">
        {detail.pointAvant && (
          <p>
            ↑{" "}
            {new Date(detail.pointAvant.date).toLocaleDateString("fr-FR", {
              day: "2-digit",
              month: "2-digit",
            })}
            {" : "}
            {detail.pointAvant.poidsMoyenG.toFixed(1)} g
          </p>
        )}
        {detail.pointApres && (
          <p>
            ↓{" "}
            {new Date(detail.pointApres.date).toLocaleDateString("fr-FR", {
              day: "2-digit",
              month: "2-digit",
            })}
            {" : "}
            {detail.pointApres.poidsMoyenG.toFixed(1)} g
          </p>
        )}
        {detail.ratio !== null && (
          <p>ratio : {detail.ratio.toFixed(2)}</p>
        )}
      </div>
    );
  }

  if (detail.methode === "GOMPERTZ_VAGUE") {
    const p = detail.params;
    const formuleLine = `W(${detail.tJours.toFixed(1)}) = ${p.wInfinity} × exp(−exp(−${p.k.toFixed(4)} × (${detail.tJours.toFixed(1)} − ${p.ti.toFixed(1)}))) = ${detail.resultatG.toFixed(1)} g`;
    return (
      <div className="mt-0.5 space-y-0.5">
        <code className="block text-[10px] font-mono bg-muted rounded px-1.5 py-0.5 text-foreground break-all">
          {formuleLine}
        </code>
        <p className="text-[10px] text-muted-foreground">
          {t("r2Label")} = {p.r2.toFixed(3)} · {p.biometrieCount} bio.
        </p>
      </div>
    );
  }

  if (detail.methode === "VALEUR_INITIALE") {
    return (
      <p className="text-xs text-muted-foreground mt-0.5">
        {detail.poidsMoyenInitialG.toFixed(1)} g
      </p>
    );
  }

  return null;
}

// ---------------------------------------------------------------------------
// Periode row (collapsible)
// ---------------------------------------------------------------------------

function PeriodeRow({ periode, defaultOpen }: { periode: FCRTracePeriode; defaultOpen?: boolean }) {
  const t = useTranslations("analytics.fcrTrace");

  const formatDate = (d: Date | string) =>
    new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });

  const title = `${t("bac")} ${periode.bacNom}  ${formatDate(periode.dateDebut)} → ${formatDate(periode.dateFin)}  (${periode.dureeJours}${t("joursUnit")})`;

  return (
    <details className="group border border-border rounded-lg overflow-hidden" open={defaultOpen}>
      <summary className="flex items-center justify-between px-3 py-2 cursor-pointer select-none list-none bg-muted/40 hover:bg-muted/60 transition-colors">
        <span className="text-xs font-medium truncate pr-2">{title}</span>
        <div className="flex items-center gap-2 shrink-0">
          {periode.fcrPeriode !== null && (
            <span className="text-xs font-semibold text-primary tabular-nums">
              ICA {periode.fcrPeriode}
            </span>
          )}
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground transition-transform group-open:rotate-180" />
        </div>
      </summary>

      <div className="px-3 py-2 space-y-3 text-sm">
        {/* Feed quantity */}
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">{t("aliment")}</span>
          <span className="font-semibold tabular-nums">{periode.quantiteKg.toFixed(2)} kg</span>
        </div>

        {/* Weight estimations */}
        <div className="grid grid-cols-2 gap-2">
          {/* Debut */}
          <div className="space-y-1">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{t("debut")}</p>
            <MethodeBadge methode={periode.methodeDebut as MethodeEstimation} />
            {periode.poidsMoyenDebut !== null && (
              <p className="text-xs font-semibold">{periode.poidsMoyenDebut.toFixed(1)} g</p>
            )}
            <EstimationDetailBlock detail={periode.detailEstimationDebut} />
          </div>
          {/* Fin */}
          <div className="space-y-1">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{t("fin")}</p>
            <MethodeBadge methode={periode.methodeFin as MethodeEstimation} />
            {periode.poidsMoyenFin !== null && (
              <p className="text-xs font-semibold">{periode.poidsMoyenFin.toFixed(1)} g</p>
            )}
            <EstimationDetailBlock detail={periode.detailEstimationFin} />
          </div>
        </div>

        {/* Biomass */}
        {periode.nombreVivants !== null && (
          <div className="rounded-lg bg-muted/50 px-3 py-2 space-y-1 text-xs">
            <p className="font-medium text-muted-foreground uppercase tracking-wide text-[10px] mb-1">
              {t("biomasse")}
            </p>
            {periode.biomasseDebutKg !== null && (
              <p className="flex justify-between">
                <span className="text-muted-foreground">{t("biomasseDebut")}</span>
                <span className="tabular-nums font-semibold">{periode.biomasseDebutKg.toFixed(2)} kg</span>
              </p>
            )}
            {periode.biomasseFinKg !== null && (
              <p className="flex justify-between">
                <span className="text-muted-foreground">{t("biomasseFin")}</span>
                <span className="tabular-nums font-semibold">{periode.biomasseFinKg.toFixed(2)} kg</span>
              </p>
            )}
            <p className="flex justify-between">
              <span className="text-muted-foreground">{t("nombreVivants")}</span>
              <span className="tabular-nums font-semibold">
                {periode.nombreVivants.toLocaleString("fr-FR")}
              </span>
            </p>
            {periode.gainNegatifExclu && (
              <p className="text-amber-600 text-[10px] font-medium">{t("gainNegatifExclu")}</p>
            )}
            {!periode.gainNegatifExclu && periode.gainBiomasseKg !== null && (
              <p className="flex justify-between border-t border-border pt-1 mt-1">
                <span className="text-muted-foreground">{t("gainBiomasse")}</span>
                <span className="tabular-nums font-semibold text-primary">
                  +{periode.gainBiomasseKg.toFixed(2)} kg
                </span>
              </p>
            )}
          </div>
        )}

        {/* FCR période */}
        {periode.fcrPeriode !== null ? (
          <div className="text-xs flex justify-between items-center border-t border-border pt-2">
            <span className="text-muted-foreground">{t("fcrPeriode")}</span>
            <code className="font-mono font-semibold text-primary">
              {periode.quantiteKg.toFixed(2)} / {periode.gainBiomasseKg?.toFixed(2) ?? "?"} = {periode.fcrPeriode}
            </code>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground border-t border-border pt-2">
            {t("fcrPeriode")} : —
          </p>
        )}
      </div>
    </details>
  );
}

// ---------------------------------------------------------------------------
// Vague section (collapsible)
// ---------------------------------------------------------------------------

function VagueSection({ vague, defaultOpen }: { vague: FCRTraceVague; defaultOpen?: boolean }) {
  const t = useTranslations("analytics.fcrTrace");

  const formatDate = (d: Date | string | null) =>
    d
      ? new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "2-digit" })
      : "—";

  return (
    <details className="group border border-border rounded-xl overflow-hidden" open={defaultOpen}>
      <summary className="flex items-center justify-between px-4 py-3 cursor-pointer select-none list-none bg-muted/30 hover:bg-muted/50 transition-colors">
        <div className="min-w-0">
          <p className="text-sm font-semibold truncate">{t("vague")} {vague.vagueCode}</p>
          <p className="text-xs text-muted-foreground">
            {formatDate(vague.dateDebut)} → {formatDate(vague.dateFin)}
            {" · "}
            {vague.periodes.length} {t("periodesDuBac")}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {vague.fcrVague !== null && (
            <span className="text-sm font-bold text-primary tabular-nums">
              ICA {vague.fcrVague}
            </span>
          )}
          <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180" />
        </div>
      </summary>

      <div className="px-4 py-3 space-y-2">
        {/* Vague summary metrics */}
        <div className="grid grid-cols-2 gap-2 text-xs mb-3">
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{t("aliment")}</p>
            <p className="font-semibold tabular-nums">{vague.quantiteKg.toFixed(2)} kg</p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{t("gainBiomasse")}</p>
            <p className="font-semibold tabular-nums">
              {vague.gainBiomasseKg !== null ? `+${vague.gainBiomasseKg.toFixed(2)} kg` : "—"}
            </p>
          </div>
        </div>

        {vague.modeLegacy && (
          <p className="text-[10px] text-amber-600 font-medium mb-2">{t("modeLegacy")}</p>
        )}

        {/* Periods */}
        {vague.periodes.length === 0 ? (
          <p className="text-xs text-muted-foreground">{t("noData")}</p>
        ) : (
          <div className="space-y-2">
            {vague.periodes.map((periode, idx) => (
              <PeriodeRow
                key={`${periode.bacId}-${periode.dateDebut}-${idx}`}
                periode={periode}
                defaultOpen={idx === 0 && vague.periodes.length === 1}
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

function AggregationSection({ trace }: { trace: FCRTrace }) {
  const t = useTranslations("analytics.fcrTrace");

  return (
    <div className="rounded-xl border border-border bg-muted/20 px-4 py-3 space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {t("aggregationTitle")}
      </p>
      <code className="block text-xs font-mono text-muted-foreground">
        {t("aggregationFormule")}
      </code>
      <div className="grid grid-cols-2 gap-2 text-xs pt-1">
        <div>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{t("totalAliment")}</p>
          <p className="font-semibold tabular-nums">{trace.quantiteTotaleFinal.toFixed(2)} kg</p>
        </div>
        <div>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{t("totalGain")}</p>
          <p className="font-semibold tabular-nums">
            {trace.gainBiomasseTotalFinal !== null
              ? `+${trace.gainBiomasseTotalFinal.toFixed(2)} kg`
              : "—"}
          </p>
        </div>
      </div>
      {trace.fcrMoyenFinal !== null && trace.gainBiomasseTotalFinal !== null && (
        <div className="border-t border-border pt-2 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">{t("fcrFinal")}</span>
          <code className="font-mono text-sm font-bold text-primary">
            {trace.quantiteTotaleFinal.toFixed(2)} / {trace.gainBiomasseTotalFinal.toFixed(2)} ={" "}
            <span>{trace.fcrMoyenFinal}</span>
          </code>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main dialog content
// ---------------------------------------------------------------------------

function FCRTraceContent({ produitId, produitNom }: { produitId: string; produitNom: string }) {
  const t = useTranslations("analytics.fcrTrace");
  const [traceData, setTraceData] = useState<FCRTrace | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const loadTrace = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/analytics/aliments/${produitId}/fcr-trace`);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data: FCRTrace = await res.json();
      setTraceData(data);
      setLoaded(true);
    } catch {
      setError(t("error"));
    } finally {
      setLoading(false);
    }
  }, [produitId, t]);

  // Fetch on mount (when dialog opens and this component is rendered)
  useEffect(() => {
    loadTrace();
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
        <Button variant="outline" size="sm" onClick={loadTrace}>
          <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
          {t("retry")}
        </Button>
      </div>
    );
  }

  if (!traceData) {
    return (
      <p className="text-sm text-muted-foreground py-8 text-center">{t("noData")}</p>
    );
  }

  const strategieLabel =
    traceData.strategieInterpolation === "GOMPERTZ_VAGUE"
      ? t("stratGOMPERTZ_VAGUE")
      : t("stratLINEAIRE");

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      <div className="rounded-xl border border-border bg-muted/30 px-4 py-3 space-y-1">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground">{t("strategie")}</p>
            <p className="text-sm font-semibold">{strategieLabel}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">{t("fcrFinal")}</p>
            <p className="text-2xl font-bold text-primary tabular-nums">
              {traceData.fcrMoyenFinal ?? "—"}
            </p>
          </div>
        </div>
      </div>

      {/* Aggregation */}
      <AggregationSection trace={traceData} />

      {/* Per-vague sections */}
      {traceData.parVague.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center">{t("noData")}</p>
      ) : (
        <div className="space-y-3">
          {traceData.parVague.map((vague, idx) => (
            <VagueSection
              key={vague.vagueId}
              vague={vague}
              defaultOpen={idx === 0}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Public component: trigger + dialog
// ---------------------------------------------------------------------------

interface FCRTransparencyDialogProps {
  produitId: string;
  produitNom: string;
  fcrMoyen: number | null;
}

export function FCRTransparencyDialog({
  produitId,
  produitNom,
  fcrMoyen,
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
          <FCRTraceContent produitId={produitId} produitNom={produitNom} />
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
