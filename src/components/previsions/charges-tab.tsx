"use client";

import { useState, useMemo } from "react";
import { useTranslations } from "next-intl";
import { ChevronLeft, ChevronRight, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { EmptyState } from "@/components/ui/empty-state";
import { Permission } from "@/types";
import { usePrevisionsApi } from "@/hooks/use-previsions-api";
import { PosteFormDialog } from "@/components/previsions/poste-form-dialog";
import { ReporterChargeDialog } from "@/components/previsions/reporter-charge-dialog";
import { ValeurCalculee } from "@/components/previsions/valeur-calculee";
import { PosteRattachementLigne } from "@/components/previsions/poste-rattachement-badge";
import { formatMontantPrevision } from "@/lib/previsions/format-previsions";
import type { PostePrevisionDTO, ChargeMensuellePrevueDTO } from "@/components/previsions/api-types";
import Link from "next/link";
import { ExternalLink } from "lucide-react";

interface ChargesTabProps {
  scenarioId: string;
  dateDebutPlan: string;
  initialPostes: PostePrevisionDTO[];
  initialCharges: ChargeMensuellePrevueDTO[];
  permissions: Permission[];
  horizonMois: number;
  erreurProjection: string | null;
  onDataChanged?: () => void;
}

function libelleMois(dateDebutPlan: string, moisAbsolu: number): string {
  const debut = new Date(dateDebutPlan);
  const d = new Date(debut.getFullYear(), debut.getMonth() + moisAbsolu, 1);
  return d.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
}

export function ChargesTab({
  scenarioId,
  dateDebutPlan,
  initialPostes,
  initialCharges,
  permissions,
  horizonMois,
  erreurProjection,
  onDataChanged,
}: ChargesTabProps) {
  const t = useTranslations("previsions");
  const { put, post: apiPost } = usePrevisionsApi();
  const [postes, setPostes] = useState(initialPostes);
  const [charges, setCharges] = useState(initialCharges);
  const [moisAbsolu, setMoisAbsolu] = useState(0);
  const [valeurs, setValeurs] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);
  const peutParametrer = permissions.includes(Permission.PREVISIONS_PARAMETRER);
  const peutGerer = permissions.includes(Permission.PREVISIONS_GERER);

  const chargesDuMois = useMemo(() => {
    const map = new Map<string, ChargeMensuellePrevueDTO>();
    for (const c of charges) {
      if (c.moisAbsolu === moisAbsolu) map.set(c.posteId, c);
    }
    return map;
  }, [charges, moisAbsolu]);

  const totalMois = postes
    .filter((p) => p.actif !== false)
    .reduce((sum, p) => {
      const c = chargesDuMois.get(p.id);
      return sum + (c ? Number(c.montantFCFA) : 0);
    }, 0);

  const detailTotalMois = useMemo(
    () =>
      postes
        .filter((p) => p.actif !== false)
        .map((p) => {
          const c = chargesDuMois.get(p.id);
          return { label: p.libelle, valeur: formatMontantPrevision(c ? Number(c.montantFCFA) : 0) };
        }),
    [postes, chargesDuMois]
  );

  function valeurAffichee(posteId: string): string {
    if (valeurs[posteId] !== undefined) return valeurs[posteId];
    const c = chargesDuMois.get(posteId);
    return c ? String(c.montantFCFA) : "";
  }

  async function handleSave(posteId: string) {
    const raw = valeurAffichee(posteId);
    const montant = Number(raw) || 0;
    setSaving(posteId);
    try {
      const result = await put<ChargeMensuellePrevueDTO>(`/api/previsions/postes/${posteId}/charges`, {
        moisAbsolu,
        montantFCFA: montant,
      });
      if (result.ok && result.data) {
        const charge = result.data;
        setCharges((prev) => [
          ...prev.filter((c) => !(c.posteId === posteId && c.moisAbsolu === moisAbsolu)),
          charge,
        ]);
        setValeurs((prev) => {
          const next = { ...prev };
          delete next[posteId];
          return next;
        });
        onDataChanged?.();
      }
    } finally {
      setSaving(null);
    }
  }

  function handleReported(posteId: string, lignes: ChargeMensuellePrevueDTO[]) {
    const moisReportes = new Set(lignes.map((l) => l.moisAbsolu));
    setCharges((prev) => [
      ...prev.filter((c) => !(c.posteId === posteId && moisReportes.has(c.moisAbsolu))),
      ...lignes,
    ]);
    onDataChanged?.();
  }

  async function handleToggleActif(posteId: string, actif: boolean) {
    setToggling(posteId);
    try {
      const result = await apiPost<PostePrevisionDTO>(`/api/previsions/postes/${posteId}/toggle-actif`, { actif });
      if (result.ok && result.data) {
        setPostes((prev) => prev.map((p) => (p.id === posteId ? { ...p, actif: result.data!.actif } : p)));
        onDataChanged?.();
      }
    } finally {
      setToggling(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between rounded-xl border border-border bg-card p-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setMoisAbsolu((m) => Math.max(0, m - 1))}
          disabled={moisAbsolu === 0}
          aria-label={t("chargesTab.prevMonth")}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="text-center">
          <p className="text-sm font-semibold capitalize">{libelleMois(dateDebutPlan, moisAbsolu)}</p>
          <p className="text-xs text-muted-foreground">{t("chargesTab.monthIndex", { count: moisAbsolu })}</p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setMoisAbsolu((m) => m + 1)}
          aria-label={t("chargesTab.nextMonth")}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {peutParametrer && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Link
            href="/previsions/postes-referentiel"
            className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            {t("chargesTab.gererReferentielLink")}
            <ExternalLink className="h-3 w-3" aria-hidden="true" />
          </Link>
          <PosteFormDialog
            scenarioId={scenarioId}
            ordreSuivant={postes.length}
            onCreated={(p) => {
              setPostes((prev) => [...prev, p]);
              onDataChanged?.();
            }}
          />
        </div>
      )}

      {postes.length === 0 ? (
        <EmptyState
          icon={<Wallet className="h-8 w-8" />}
          title={t("chargesTab.emptyTitle")}
          description={t("chargesTab.emptyDescription")}
        />
      ) : (
        <>
          <div className="flex flex-col gap-3">
            {postes.map((p) => {
              const isInactif = p.actif === false;
              return (
                <div
                  key={p.id}
                  className={`rounded-xl border border-border bg-card p-4 ${isInactif ? "opacity-50" : ""}`}
                >
                  <div className="flex items-end gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        {isInactif && (
                          <Badge variant="secondary" className="text-xs">
                            {t("chargesTab.inactifBadge")}
                          </Badge>
                        )}
                      </div>
                      <Input
                        label={p.libelle}
                        type="number"
                        inputMode="decimal"
                        min={0}
                        disabled={!peutGerer || isInactif}
                        placeholder="0"
                        value={valeurAffichee(p.id)}
                        onChange={(e) => setValeurs((prev) => ({ ...prev, [p.id]: e.target.value }))}
                      />
                    </div>
                    {peutGerer && !isInactif && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleSave(p.id)}
                        disabled={saving === p.id}
                      >
                        {saving === p.id ? t("chargesTab.saving") : t("chargesTab.saveButton")}
                      </Button>
                    )}
                  </div>
                  <PosteRattachementLigne libelleScenario={p.libelle} posteReferentiel={p.posteReferentiel} />
                  {!p.inclusBaseRepartition && !isInactif && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {t("chargesTab.excludedFromBase")}
                    </p>
                  )}
                  {isInactif && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {t("chargesTab.inactifHint")}
                    </p>
                  )}
                  <div className="mt-2 flex items-center justify-between">
                    {peutGerer && (
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={!isInactif}
                          onCheckedChange={(checked) => handleToggleActif(p.id, checked)}
                          disabled={toggling === p.id}
                          aria-label={isInactif ? t("chargesTab.reactiver") : t("chargesTab.desactiver")}
                        />
                        <span className="text-xs text-muted-foreground">
                          {isInactif ? t("chargesTab.reactiver") : t("chargesTab.desactiver")}
                        </span>
                      </div>
                    )}
                    {peutGerer && !isInactif && (
                      <ReporterChargeDialog
                        posteId={p.id}
                        libelle={p.libelle}
                        moisCourant={moisAbsolu}
                        horizonMois={horizonMois}
                        erreurProjection={erreurProjection}
                        charges={charges}
                        dateDebutPlan={dateDebutPlan}
                        onReported={(lignes) => handleReported(p.id, lignes)}
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-end rounded-xl border border-border bg-muted p-3">
            <span className="mr-2 text-sm text-muted-foreground">{t("chargesTab.totalLabel")}</span>
            <ValeurCalculee
              value={formatMontantPrevision(totalMois)}
              formule={t("chargesTab.totalFormule")}
              explication={detailTotalMois}
              ariaLabel={t("chargesTab.totalAria")}
            />
          </div>
        </>
      )}
    </div>
  );
}
