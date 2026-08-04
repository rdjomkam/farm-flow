"use client";

/**
 * src/components/previsions/charges-tab.tsx
 *
 * Onglet Charges — la matrice PostePrevision x ChargeMensuellePrevue
 * (poste x mois) est le point signale comme reellement difficile par la
 * pre-analyse PR2.3 §5 : aucun precedent dans le depot ne resout une
 * matrice 2D authentique en cartes empilees a 360px.
 *
 * DECISION TRANCHEE ICI (pre-analyse §5, deux options presentees) :
 * navigation MOIS-PRIMAIRE — un selecteur de mois (precedent/suivant), puis
 * toutes les charges de CE mois en cartes empilees verticales (une carte par
 * poste). Justification :
 * 1. Coherence avec PR2.4 (vue mensuelle deja prevue "tableau mois x
 *    indicateurs") — le meme repere temporel (mois absolu) structure les deux
 *    ecrans, l'utilisateur retrouve le meme axe de navigation.
 * 2. Coherence avec la logique metier : la tresorerie et le point bas se
 *    raisonnent mois par mois (ADR-053 §7.2), pas poste par poste.
 * 3. Le cout (saisie initiale "remplir toute l'annee pour un poste" plus
 *    fastidieuse, un changement de mois par poste) est juge acceptable car
 *    la saisie INITIALE complete sur 21 mois se fait typiquement au clavier
 *    physique (desktop, ou la contrainte 360px ne s'applique pas) — le
 *    mobile sert surtout a la consultation/l'ajustement ponctuel d'un mois
 *    donne, pas a la saisie exhaustive initiale.
 * L'alternative poste-primaire (une carte par poste, mois empiles dedans)
 * aurait rendu la vue "tous les postes d'un mois donne" indirecte — exactement
 * le scenario le plus frequent en cours d'exploitation (cloturer/ajuster un
 * mois).
 */
import { useState, useMemo } from "react";
import { useTranslations } from "next-intl";
import { ChevronLeft, ChevronRight, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { Permission } from "@/types";
import { usePrevisionsApi } from "@/hooks/use-previsions-api";
import { PosteFormDialog } from "@/components/previsions/poste-form-dialog";
import { ReporterChargeDialog } from "@/components/previsions/reporter-charge-dialog";
import { ValeurCalculee } from "@/components/previsions/valeur-calculee";
import { formatMontantPrevision } from "@/lib/previsions/format-previsions";
import type { PostePrevisionDTO, ChargeMensuellePrevueDTO } from "@/components/previsions/api-types";

interface ChargesTabProps {
  scenarioId: string;
  dateDebutPlan: string;
  initialPostes: PostePrevisionDTO[];
  initialCharges: ChargeMensuellePrevueDTO[];
  permissions: Permission[];
  /**
   * Horizon complet du plan (nombre de mois, `mois[]` couvre 0..horizonMois-1
   * cote moteur) — necessaire pour l'option "jusqu'a la fin du plan" du
   * dialogue de report (story PR2ter.1). Deja disponible au niveau du shell
   * (`projection.horizonMois`), transmis ici (pre-analyse PR2ter.1 section 7).
   */
  horizonMois: number;
  /**
   * Message d'erreur reel si la projection a leve une exception — si non
   * `null`, `horizonMois` peut ne pas etre fiable : le dialogue de report
   * doit alors desactiver l'option "jusqu'a la fin du plan" explicitement
   * (pre-analyse PR2ter.1 section 4, risque 2).
   */
  erreurProjection: string | null;
  /** Cf. `parametres-tab.tsx` — declenche le refresh de la projection. */
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
  const { put } = usePrevisionsApi();
  const [postes, setPostes] = useState(initialPostes);
  const [charges, setCharges] = useState(initialCharges);
  const [moisAbsolu, setMoisAbsolu] = useState(0);
  const [valeurs, setValeurs] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const peutParametrer = permissions.includes(Permission.PREVISIONS_PARAMETRER);
  const peutGerer = permissions.includes(Permission.PREVISIONS_GERER);

  const chargesDuMois = useMemo(() => {
    const map = new Map<string, ChargeMensuellePrevueDTO>();
    for (const c of charges) {
      if (c.moisAbsolu === moisAbsolu) map.set(c.posteId, c);
    }
    return map;
  }, [charges, moisAbsolu]);

  const totalMois = postes.reduce((sum, p) => {
    const c = chargesDuMois.get(p.id);
    return sum + (c ? Number(c.montantFCFA) : 0);
  }, 0);

  const detailTotalMois = useMemo(
    () =>
      postes.map((p) => {
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

  /**
   * Fusionne les lignes retournees par un report reussi (potentiellement
   * plusieurs mois pour UN SEUL poste) dans l'etat local, sans dupliquer ni
   * perdre de lignes existantes pour d'autres postes/mois (pre-analyse
   * PR2ter.1, risque 5).
   */
  function handleReported(posteId: string, lignes: ChargeMensuellePrevueDTO[]) {
    const moisReportes = new Set(lignes.map((l) => l.moisAbsolu));
    setCharges((prev) => [
      ...prev.filter((c) => !(c.posteId === posteId && moisReportes.has(c.moisAbsolu))),
      ...lignes,
    ]);
    onDataChanged?.();
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
        <div className="flex justify-end">
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
            {postes.map((p) => (
              <div key={p.id} className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-end gap-3">
                  <div className="flex-1">
                    <Input
                      label={p.libelle}
                      type="number"
                      inputMode="decimal"
                      min={0}
                      disabled={!peutGerer}
                      placeholder="0"
                      value={valeurAffichee(p.id)}
                      onChange={(e) => setValeurs((prev) => ({ ...prev, [p.id]: e.target.value }))}
                    />
                  </div>
                  {peutGerer && (
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
                {!p.inclusBaseRepartition && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t("chargesTab.excludedFromBase")}
                  </p>
                )}
                {peutGerer && (
                  <div className="mt-2 flex justify-end">
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
                  </div>
                )}
              </div>
            ))}
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
