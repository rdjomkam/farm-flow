"use client";

import { useState, useCallback, useEffect } from "react";
import { Info, ChevronDown, RefreshCw, Loader2, AlertTriangle } from "lucide-react";
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
import type { DetailAlimentVague, FCRBacPeriode, FCRByFeedResult } from "@/types";

// ---------------------------------------------------------------------------
// Flag badges
// ---------------------------------------------------------------------------

function FlagBadge({
  type,
}: {
  type: "LOW_CONFIDENCE" | "HIGH_FCR" | "INSUFFICIENT_DATA";
}) {
  const configs = {
    LOW_CONFIDENCE: {
      label: "Confiance faible (R² < 0.85)",
      className: "bg-amber-100 text-amber-700",
    },
    HIGH_FCR: {
      label: "FCR elevé (> 3.0)",
      className: "bg-red-100 text-red-700",
    },
    INSUFFICIENT_DATA: {
      label: "Donnees insuffisantes",
      className: "bg-gray-100 text-gray-600",
    },
  };

  const { label, className } = configs[type];

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
// Per-bac period row (ADR-036)
// ---------------------------------------------------------------------------

function PeriodeBacRow({
  periode,
  index,
}: {
  periode: FCRBacPeriode;
  index: number;
}) {
  const formatDate = (d: Date | string) =>
    new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });

  const title = `${periode.bacNom} · ${formatDate(periode.dateDebut)} → ${formatDate(periode.dateFin)} (${periode.dureeJours}j)`;

  return (
    <details className="group border border-border rounded-lg overflow-hidden">
      <summary className="flex items-center justify-between px-3 py-2 cursor-pointer select-none list-none bg-muted/40 hover:bg-muted/60 transition-colors">
        <span className="text-xs font-medium truncate pr-2">{title}</span>
        <div className="flex items-center gap-2 shrink-0">
          {periode.fcr !== null && (
            <span className="text-xs font-semibold text-primary tabular-nums">
              ICA {periode.fcr.toFixed(2)}
            </span>
          )}
          {periode.flagHighFCR && (
            <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0" />
          )}
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground transition-transform group-open:rotate-180" />
        </div>
      </summary>

      <div className="px-3 py-2 space-y-2 text-xs">
        {/* Feed and gain row */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Aliment</p>
            <p className="font-semibold tabular-nums">{periode.qtyAlimentKg.toFixed(2)} kg</p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Gain biomasse</p>
            <p className="font-semibold tabular-nums text-primary">
              {periode.gainBiomasseKg > 0 ? `+${periode.gainBiomasseKg.toFixed(2)} kg` : "—"}
            </p>
          </div>
        </div>

        {/* Population and growth row */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Poissons moy.</p>
            <p className="font-semibold tabular-nums">{Math.round(periode.avgFishCount).toLocaleString("fr-FR")}</p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Gain/poisson</p>
            <p className="font-semibold tabular-nums">{periode.gainParPoissonG.toFixed(1)} g</p>
          </div>
        </div>

        {/* FCR formula */}
        {periode.fcr !== null && (
          <div className="border-t border-border pt-2 flex items-center justify-between">
            <span className="text-muted-foreground">ICA</span>
            <code className="font-mono font-semibold text-primary text-xs">
              {periode.qtyAlimentKg.toFixed(2)} / {periode.gainBiomasseKg.toFixed(2)} = {periode.fcr.toFixed(2)}
            </code>
          </div>
        )}

        {/* Flags */}
        <div className="flex flex-wrap gap-1">
          {periode.flagHighFCR && <FlagBadge type="HIGH_FCR" />}
        </div>
      </div>
    </details>
  );
}

// ---------------------------------------------------------------------------
// Vague section — per-bac breakdown (ADR-036)
// ---------------------------------------------------------------------------

function VagueSection({
  vague,
  defaultOpen,
}: {
  vague: DetailAlimentVague;
  defaultOpen?: boolean;
}) {
  const formatDate = (d: Date | string | null) =>
    d
      ? new Date(d).toLocaleDateString("fr-FR", {
          day: "2-digit",
          month: "2-digit",
          year: "2-digit",
        })
      : "—";

  const periodesBac = vague.periodesBac ?? [];

  return (
    <details className="group border border-border rounded-xl overflow-hidden" open={defaultOpen}>
      <summary className="flex items-center justify-between px-4 py-3 cursor-pointer select-none list-none bg-muted/30 hover:bg-muted/50 transition-colors">
        <div className="min-w-0">
          <p className="text-sm font-semibold truncate">Vague {vague.vagueCode}</p>
          <p className="text-xs text-muted-foreground">
            {formatDate(vague.periode.debut)} {"->"} {formatDate(vague.periode.fin)}
            {" · "}
            {periodesBac.length} periode{periodesBac.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {vague.fcr !== null && (
            <span className="text-sm font-bold text-primary tabular-nums">
              ICA {vague.fcr}
            </span>
          )}
          <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180" />
        </div>
      </summary>

      <div className="px-4 py-3 space-y-2">
        {/* Vague summary */}
        <div className="grid grid-cols-2 gap-2 text-xs mb-2">
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Aliment total</p>
            <p className="font-semibold tabular-nums">{vague.quantite.toFixed(2)} kg</p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Bacs / periodes</p>
            <p className="font-semibold tabular-nums">
              {periodesBac.length} periode{periodesBac.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>

        {/* Flags */}
        <div className="flex flex-wrap gap-1 mb-2">
          {vague.flagLowConfidence && <FlagBadge type="LOW_CONFIDENCE" />}
        </div>

        {/* Per-bac periods */}
        {periodesBac.length === 0 ? (
          <p className="text-xs text-muted-foreground">Aucune periode de consommation trouvee.</p>
        ) : (
          <div className="space-y-2">
            {periodesBac.map((periode, idx) => (
              <PeriodeBacRow
                key={`${periode.bacId}-${periode.dateDebut}-${idx}`}
                periode={periode}
                index={idx}
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
}: {
  fcrGlobal: number | null;
  totalAlimentKg: number;
  totalGainBiomasseKg: number;
}) {
  return (
    <div className="rounded-xl border border-border bg-muted/20 px-4 py-3 space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Agregation globale
      </p>
      <code className="block text-xs font-mono text-muted-foreground">
        ICA = Σ aliment (valide) / Σ gain biomasse
      </code>
      <div className="grid grid-cols-2 gap-2 text-xs pt-1">
        <div>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Total aliment</p>
          <p className="font-semibold tabular-nums">{totalAlimentKg.toFixed(2)} kg</p>
        </div>
        <div>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Total gain</p>
          <p className="font-semibold tabular-nums">
            {totalGainBiomasseKg > 0 ? `+${totalGainBiomasseKg.toFixed(2)} kg` : "—"}
          </p>
        </div>
      </div>
      {fcrGlobal !== null && totalGainBiomasseKg > 0 && (
        <div className="border-t border-border pt-2 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">ICA final</span>
          <code className="font-mono text-sm font-bold text-primary">
            {totalAlimentKg.toFixed(2)} / {totalGainBiomasseKg.toFixed(2)} ={" "}
            <span>{fcrGlobal.toFixed(2)}</span>
          </code>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Content when data is pre-loaded (from detail page)
// ---------------------------------------------------------------------------

function FCRByFeedContentFromParVague({
  parVague,
  produitNom,
}: {
  parVague: DetailAlimentVague[];
  produitNom: string;
}) {
  // Compute aggregated totals from parVague
  const totalAlimentKg = parVague.reduce((s, v) => s + v.quantite, 0);
  const totalGainBiomasseKg = parVague
    .flatMap((v) => v.periodesBac ?? [])
    .filter((p) => p.gainBiomasseKg > 0)
    .reduce((s, p) => s + p.gainBiomasseKg, 0);

  // fcrGlobal = weighted ratio from high-confidence vagues only
  const fcrGlobal =
    totalGainBiomasseKg > 0 ? totalAlimentKg / totalGainBiomasseKg : null;

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      <div className="rounded-xl border border-border bg-muted/30 px-4 py-3">
        <div className="text-right">
          <p className="text-xs text-muted-foreground">ICA final</p>
          <p className="text-2xl font-bold text-primary tabular-nums">
            {fcrGlobal !== null ? fcrGlobal.toFixed(2) : "—"}
          </p>
        </div>
      </div>

      {/* Aggregation */}
      <AggregationSection
        fcrGlobal={fcrGlobal}
        totalAlimentKg={totalAlimentKg}
        totalGainBiomasseKg={totalGainBiomasseKg}
      />

      {/* Per-vague sections */}
      {parVague.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center">Aucune donnee disponible.</p>
      ) : (
        <div className="space-y-3">
          {parVague.map((vague, idx) => (
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
// Content when fetching lazily from API (from list page)
// ---------------------------------------------------------------------------

function FCRByFeedContentLazy({
  produitId,
  produitNom,
}: {
  produitId: string;
  produitNom: string;
}) {
  const [data, setData] = useState<FCRByFeedResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/analytics/aliments/${produitId}/fcr-by-feed`);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const json: FCRByFeedResult = await res.json();
      setData(json);
    } catch {
      setError("Erreur lors du chargement des donnees FCR. Veuillez reessayer.");
    } finally {
      setLoading(false);
    }
  }, [produitId]);

  useEffect(() => {
    loadData();
  }, [produitId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Calcul en cours...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3">
        <p className="text-sm text-muted-foreground text-center">{error}</p>
        <Button variant="outline" size="sm" onClick={loadData}>
          <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
          Reessayer
        </Button>
      </div>
    );
  }

  if (!data) {
    return (
      <p className="text-sm text-muted-foreground py-8 text-center">Aucune donnee disponible.</p>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      <div className="rounded-xl border border-border bg-muted/30 px-4 py-3">
        <div className="text-right">
          <p className="text-xs text-muted-foreground">ICA final</p>
          <p className="text-2xl font-bold text-primary tabular-nums">
            {data.fcrGlobal !== null ? data.fcrGlobal.toFixed(2) : "—"}
          </p>
        </div>
      </div>

      {/* Aggregation */}
      <AggregationSection
        fcrGlobal={data.fcrGlobal}
        totalAlimentKg={data.totalAlimentKg}
        totalGainBiomasseKg={data.totalGainBiomasseKg}
      />

      {/* Per-vague sections using FCRByFeedVague directly */}
      {data.parVague.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center">Aucune donnee disponible.</p>
      ) : (
        <div className="space-y-3">
          {data.parVague.map((fcrVague, idx) => {
            // Build a DetailAlimentVague-like object for VagueSection
            const vagueForDisplay: DetailAlimentVague = {
              vagueId: fcrVague.vagueId,
              vagueCode: fcrVague.vagueCode,
              quantite: fcrVague.totalAlimentKg,
              fcr: fcrVague.fcrVague !== null
                ? Math.round(fcrVague.fcrVague * 100) / 100
                : null,
              sgr: null,
              coutParKgGain: null,
              periode: { debut: fcrVague.dateDebut, fin: fcrVague.dateFin },
              adg: null,
              per: null,
              tauxMortaliteAssocie: null,
              periodesBac: fcrVague.periodesBac,
              flagLowConfidence: fcrVague.flagLowConfidence,
            };
            return (
              <VagueSection
                key={fcrVague.vagueId}
                vague={vagueForDisplay}
                defaultOpen={idx === 0}
              />
            );
          })}
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
  /** Pre-loaded per-vague data (from detail page). If absent, lazy-fetched from API. */
  parVague?: DetailAlimentVague[];
}

export function FCRTransparencyDialog({
  produitId,
  produitNom,
  fcrMoyen,
  parVague,
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
          {parVague ? (
            <FCRByFeedContentFromParVague parVague={parVague} produitNom={produitNom} />
          ) : (
            <FCRByFeedContentLazy produitId={produitId} produitNom={produitNom} />
          )}
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
