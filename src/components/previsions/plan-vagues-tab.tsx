"use client";

/**
 * src/components/previsions/plan-vagues-tab.tsx
 *
 * Onglet Plan des vagues — VaguePrevue : creation, rattachement d'une vague
 * reelle, scission (ADR-053 decision 2, exigence non negociable), annulation.
 * Cartes empilees mobile-first.
 */
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Waves, Split, XCircle, Pencil } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Permission, StatutVaguePrevue } from "@/types";
import { usePrevisionsApi } from "@/hooks/use-previsions-api";
import { ValeurCalculee } from "@/components/previsions/valeur-calculee";
import { VaguePrevueFormDialog } from "@/components/previsions/vague-prevue-form-dialog";
import { RattacherVagueDialog } from "@/components/previsions/rattacher-vague-dialog";
import { ScissionDialog } from "@/components/previsions/scission-dialog";
import { GenererPlanDialog } from "@/components/previsions/generer-plan-dialog";
import { formatMontantPrevision, formatEntierPrevision } from "@/lib/previsions/format-previsions";
import type {
  VaguePrevueListItemDTO,
  VagueCandidateDTO,
  ParametresPrevisionDTO,
} from "@/components/previsions/api-types";

const STATUT_BADGE_VARIANT: Record<StatutVaguePrevue, "info" | "success" | "default" | "terminee" | "annulee"> = {
  [StatutVaguePrevue.PLANIFIEE]: "info",
  [StatutVaguePrevue.EN_COURS]: "success",
  [StatutVaguePrevue.REALISEE]: "terminee",
  [StatutVaguePrevue.NON_REALISEE]: "default",
  [StatutVaguePrevue.ANNULEE]: "annulee",
};

interface PlanVaguesTabProps {
  scenarioId: string;
  vaguesPrevues: VaguePrevueListItemDTO[];
  onVaguesPrevuesChange: (updater: (prev: VaguePrevueListItemDTO[]) => VaguePrevueListItemDTO[]) => void;
  vaguesCandidates: VagueCandidateDTO[];
  permissions: Permission[];
  /**
   * `ParametresPrevision` du scenario — relation optionnelle (ADR-053 §3.3).
   * `null` = le bouton "Generer un plan" doit etre desactive avec un motif
   * explicite (pre-analyse PR2bis.2 section 2), jamais un bouton qui echoue
   * au clic.
   */
  parametres: ParametresPrevisionDTO | null;
  /** Affiche seulement — deja persiste, jamais resaisi (story PR2bis.2). */
  dateDebutPlan: string;
  /** Affiche seulement — deja persiste, jamais resaisi (story PR2bis.2). */
  dureeCycleMois: number;
  /** Cf. `parametres-tab.tsx` — declenche le refresh de la projection. */
  onDataChanged?: () => void;
}

export function PlanVaguesTab({
  scenarioId,
  vaguesPrevues,
  onVaguesPrevuesChange,
  vaguesCandidates,
  permissions,
  parametres,
  dateDebutPlan,
  dureeCycleMois,
  onDataChanged,
}: PlanVaguesTabProps) {
  const t = useTranslations("previsions");
  const { post } = usePrevisionsApi();
  const [rattachees, setRattachees] = useState<Set<string>>(new Set());
  const [scissionCible, setScissionCible] = useState<VaguePrevueListItemDTO | null>(null);
  const peutGerer = permissions.includes(Permission.PREVISIONS_GERER);
  const peutGenererPlan = peutGerer && parametres !== null;

  const codeSuggere = `V${vaguesPrevues.length + 1}`;

  async function handleAnnuler(id: string) {
    const result = await post(`/api/previsions/vagues-prevues/${id}/annuler`, {});
    if (result.ok) {
      onVaguesPrevuesChange((prev) =>
        prev.map((v) => (v.id === id ? { ...v, statut: StatutVaguePrevue.ANNULEE } : v))
      );
      onDataChanged?.();
    }
  }

  function handleScinde(enfants: VaguePrevueListItemDTO[], parentId: string) {
    onVaguesPrevuesChange((prev) => [
      ...prev.map((v) => (v.id === parentId ? { ...v, statut: StatutVaguePrevue.ANNULEE } : v)),
      ...enfants,
    ]);
    setScissionCible(null);
    onDataChanged?.();
  }

  return (
    <div className="flex flex-col gap-4">
      {peutGerer && (
        <div className="flex flex-col items-end gap-2">
          <p className="self-start text-xs text-muted-foreground">
            {t("planVaguesTab.planInfo", {
              date: new Date(dateDebutPlan).toLocaleDateString("fr-FR"),
              dureeCycleMois,
            })}
          </p>
          <div className="flex w-full flex-col gap-2 md:w-auto md:flex-row md:justify-end">
            {peutGenererPlan ? (
              <GenererPlanDialog
                scenarioId={scenarioId}
                onGenerated={(nouvelles) => {
                  onVaguesPrevuesChange((prev) => [...prev, ...nouvelles]);
                  onDataChanged?.();
                }}
              />
            ) : (
              <div className="flex flex-col items-end gap-1">
                <Button variant="outline" className="w-full md:w-auto" disabled>
                  {t("genererPlanDialog.triggerButton")}
                </Button>
                <p className="text-xs text-danger">{t("planVaguesTab.genererPlanDesactiveMotif")}</p>
              </div>
            )}
            <VaguePrevueFormDialog
              scenarioId={scenarioId}
              codeSuggere={codeSuggere}
              alevinsAchetesParDefaut={parametres?.alevinsAchetesParDefaut ?? false}
              onCreated={(v) => {
                onVaguesPrevuesChange((prev) => [...prev, v]);
                onDataChanged?.();
              }}
            />
          </div>
        </div>
      )}

      {vaguesPrevues.length === 0 ? (
        <EmptyState
          icon={<Waves className="h-8 w-8" />}
          title={t("planVaguesTab.emptyTitle")}
          description={t("planVaguesTab.emptyDescription")}
        />
      ) : (
        <div className="flex flex-col gap-3">
          {vaguesPrevues.map((v) => {
            const variant = STATUT_BADGE_VARIANT[v.statut];
            const alimentsParMois = v.alimentsParMois ?? [];
            const totalSacs = alimentsParMois.reduce(
              (sum, a) => sum + (a.sacsSaisis ?? a.sacsCalcules),
              0
            );
            const totalCout = alimentsParMois.reduce((sum, a) => sum + Number(a.coutCalculeFCFA), 0);
            const dejaTraitee = rattachees.has(v.id);
            const peutRattacher =
              peutGerer &&
              !dejaTraitee &&
              (v.statut === StatutVaguePrevue.PLANIFIEE || v.statut === StatutVaguePrevue.EN_COURS);
            const peutAnnuler = peutGerer && v.statut !== StatutVaguePrevue.ANNULEE;
            const peutScinder = peutGerer && v.statut !== StatutVaguePrevue.ANNULEE;
            // Modifier les champs prevus (effectif, date, poids) n'a de sens
            // que tant que rien n'a ete compare a un reel : une fois une
            // vague reelle rattachee (dejaTraitee, meme source que
            // peutRattacher ci-dessus) ou une fois le statut sorti de
            // PLANIFIEE (EN_COURS/REALISEE/NON_REALISEE/ANNULEE), changer
            // l'effectif prevu changerait retroactivement le sens d'une
            // comparaison prevu/reel deja etablie. Restriction volontairement
            // binaire (tout ou rien), pas un desactivage champ par champ :
            // le motif est affiche a l'ecran plutot que le bouton simplement
            // masque (cf. story), sauf en l'absence de permission (aucune
            // action de gestion n'est jamais affichee sans PREVISIONS_GERER).
            const peutModifier =
              peutGerer && !dejaTraitee && v.statut === StatutVaguePrevue.PLANIFIEE;
            const modifierIndisponibleMotif =
              peutGerer && !peutModifier
                ? dejaTraitee
                  ? t("planVaguesTab.modifierIndisponibleRattachee")
                  : t("planVaguesTab.modifierIndisponibleStatut")
                : null;

            return (
              <div key={v.id} className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold truncate">{v.code}</p>
                      <Badge variant={variant}>{t(`planVaguesTab.statuts.${v.statut}`)}</Badge>
                      <Badge variant="default">
                        {v.alevinsAchetes
                          ? t("planVaguesTab.badgeAlevinsAchetes")
                          : t("planVaguesTab.badgeProductionInterne")}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {t("planVaguesTab.stockageLabel", {
                        date: new Date(v.dateStockagePrevue).toLocaleDateString("fr-FR"),
                        count: formatEntierPrevision(v.effectifAlevinsPrevu),
                      })}
                    </p>
                    {v.vaguePrevueParentId && (
                      <p className="text-xs text-muted-foreground mt-1">{t("planVaguesTab.fromScission")}</p>
                    )}
                  </div>
                </div>

                {alimentsParMois.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <ValeurCalculee
                      value={`${totalSacs} sacs`}
                      formule={t("planVaguesTab.totalSacsFormule")}
                      explication={alimentsParMois.map((a) => ({
                        label: t("planVaguesTab.monthLabel", { count: a.moisCycle }),
                        valeur: `${a.sacsSaisis ?? a.sacsCalcules} sacs`,
                      }))}
                      ariaLabel={t("planVaguesTab.totalSacsAria", { code: v.code })}
                    />
                    <ValeurCalculee
                      value={formatMontantPrevision(totalCout)}
                      formule={t("planVaguesTab.totalCoutFormule")}
                      explication={alimentsParMois.map((a) => ({
                        label: t("planVaguesTab.monthLabel", { count: a.moisCycle }),
                        valeur: formatMontantPrevision(a.coutCalculeFCFA),
                      }))}
                      ariaLabel={t("planVaguesTab.totalCoutAria", { code: v.code })}
                    />
                  </div>
                )}

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {peutModifier && (
                    <VaguePrevueFormDialog
                      scenarioId={scenarioId}
                      codeSuggere={v.code}
                      existant={v}
                      onUpdated={(updated) => {
                        onVaguesPrevuesChange((prev) =>
                          prev.map((x) => (x.id === updated.id ? { ...x, ...updated } : x))
                        );
                        onDataChanged?.();
                      }}
                      trigger={
                        <Button variant="outline" size="sm">
                          <Pencil className="h-4 w-4" />
                          {t("planVaguesTab.modifierButton")}
                        </Button>
                      }
                    />
                  )}
                  {peutRattacher && (
                    <RattacherVagueDialog
                      vaguePrevue={v}
                      vaguesCandidates={vaguesCandidates}
                      onRattachee={(id) => {
                        setRattachees((prev) => new Set(prev).add(id));
                        onDataChanged?.();
                      }}
                      onDejaRattachee={() => setScissionCible(v)}
                    />
                  )}
                  {peutScinder && (
                    <Button variant="outline" size="sm" onClick={() => setScissionCible(v)}>
                      <Split className="h-4 w-4" />
                      {t("planVaguesTab.scinderButton")}
                    </Button>
                  )}
                  {peutAnnuler && (
                    <Button variant="ghost" size="sm" onClick={() => handleAnnuler(v.id)}>
                      <XCircle className="h-4 w-4" />
                      {t("planVaguesTab.annulerButton")}
                    </Button>
                  )}
                  {modifierIndisponibleMotif && (
                    <p className="text-xs text-muted-foreground">{modifierIndisponibleMotif}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ScissionDialog
        parent={scissionCible}
        onOpenChange={(open) => {
          if (!open) setScissionCible(null);
        }}
        onScinde={handleScinde}
      />
    </div>
  );
}
