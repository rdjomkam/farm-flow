"use client";

/**
 * src/components/previsions/reporter-charge-dialog.tsx
 *
 * Dialogue de report en lot d'une charge mensuelle sur plusieurs mois
 * consecutifs (Sprint PR2-ter, story PR2ter.1). Scope a UN SEUL poste (la
 * granularite de la base — `@@unique([posteId, moisAbsolu])` — et de la
 * route existante sont deja par poste, pre-analyse section 2).
 *
 * Flux en 2 etapes DANS le meme dialogue, calque sur `generer-plan-dialog.tsx` :
 *   1. Saisie du montant + choix de la plage de mois.
 *   2. Apercu AVANT toute ecriture — jamais un ecrasement silencieux
 *      (pre-analyse section 4). Particularite de CE dialogue : l'apercu ne
 *      necessite AUCUN appel reseau — `ChargesTab` a deja charge toutes les
 *      `ChargeMensuellePrevue` du scenario (`initialCharges`), l'apercu se
 *      calcule entierement a partir de la prop `charges` deja en memoire.
 * La confirmation appelle `POST .../postes/{posteId}/charges/reporter`
 * (une seule transaction cote serveur, R4).
 */
import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { CalendarRange } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogFooter,
} from "@/components/ui/dialog";
import { usePrevisionsApi } from "@/hooks/use-previsions-api";
import { useDialogCloseGuard } from "@/hooks/use-dialog-close-guard";
import { formatMontantPrevision } from "@/lib/previsions/format-previsions";
import { libelleMoisCalendaire } from "@/lib/previsions/tableau-de-bord-helpers";
import type { ChargeMensuellePrevueDTO } from "@/components/previsions/api-types";

interface ReporterChargeDialogProps {
  posteId: string;
  libelle: string;
  /** Mois actuellement affiche dans `ChargesTab` — borne basse de l'option "depuis ce mois". */
  moisCourant: number;
  /** Horizon complet du plan (nombre de mois, `mois[]` couvre 0..horizonMois-1). */
  horizonMois: number;
  /** Non-null si la projection a leve une exception — desactive alors ce dialogue entier. */
  erreurProjection: string | null;
  /** Toutes les ChargeMensuellePrevue du scenario, deja chargees par `ChargesTab` (aucun refetch necessaire pour l'apercu). */
  charges: ChargeMensuellePrevueDTO[];
  dateDebutPlan: string;
  onReported: (lignes: ChargeMensuellePrevueDTO[]) => void;
}

type Etape = "saisie" | "apercu";
type Plage = "depuisMoisCourant" | "tousLesMois";

interface Plan {
  moisDebutAbsolu: number;
  moisFinAbsolu: number;
}

export function ReporterChargeDialog({
  posteId,
  libelle,
  moisCourant,
  horizonMois,
  erreurProjection,
  charges,
  dateDebutPlan,
  onReported,
}: ReporterChargeDialogProps) {
  const t = useTranslations("previsions");
  const tCommon = useTranslations("common");
  const { post } = usePrevisionsApi();

  const [open, setOpen] = useState(false);
  const [etape, setEtape] = useState<Etape>("saisie");
  const [montant, setMontant] = useState("");
  const [plage, setPlage] = useState<Plage>("depuisMoisCourant");
  const [error, setError] = useState<string | null>(null);
  const [loadingApercu, setLoadingApercu] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [touched, setTouched] = useState(false);
  const { onInteractOutside, onEscapeKeyDown } = useDialogCloseGuard(touched);

  const debutDate = useMemo(() => new Date(dateDebutPlan), [dateDebutPlan]);

  // `horizonMois` couvre 0..horizonMois-1 (pre-analyse section 4). Une
  // projection en erreur ou un horizon vide interdit toute plage fiable —
  // jamais une valeur par defaut arbitraire.
  const horizonFiable = erreurProjection === null && horizonMois > 0;

  function planPourPlage(p: Plage): Plan | null {
    if (!horizonFiable) return null;
    const moisFinAbsolu = horizonMois - 1;
    const moisDebutAbsolu = p === "tousLesMois" ? 0 : moisCourant;
    if (moisDebutAbsolu > moisFinAbsolu) return null;
    return { moisDebutAbsolu, moisFinAbsolu };
  }

  function reset() {
    setEtape("saisie");
    setMontant("");
    setPlage("depuisMoisCourant");
    setError(null);
    setTouched(false);
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) reset();
  }

  const apercu = useMemo(() => {
    const plan = planPourPlage(plage);
    if (!plan) return null;
    const { moisDebutAbsolu, moisFinAbsolu } = plan;
    const moisConcernes = Array.from(
      { length: moisFinAbsolu - moisDebutAbsolu + 1 },
      (_, i) => moisDebutAbsolu + i
    );
    const lignesExistantes = moisConcernes
      .map((moisAbsolu) => ({
        moisAbsolu,
        charge: charges.find((c) => c.posteId === posteId && c.moisAbsolu === moisAbsolu),
      }))
      .filter((x): x is { moisAbsolu: number; charge: ChargeMensuellePrevueDTO } => x.charge !== undefined);
    return {
      moisDebutAbsolu,
      moisFinAbsolu,
      totalMois: moisConcernes.length,
      moisEcrases: lignesExistantes,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plage, charges, posteId, horizonFiable, horizonMois, moisCourant]);

  async function handleVoirApercu() {
    setError(null);
    const montantNombre = Number(montant);
    if (montant.trim() === "" || Number.isNaN(montantNombre) || montantNombre < 0) {
      setError(t("reporterChargeDialog.errors.montantInvalide"));
      return;
    }
    if (!horizonFiable || apercu === null) {
      setError(t("reporterChargeDialog.errors.horizonIndisponible"));
      return;
    }
    setLoadingApercu(true);
    try {
      setEtape("apercu");
    } finally {
      setLoadingApercu(false);
    }
  }

  async function handleConfirmer() {
    if (apercu === null) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await post<{ data: ChargeMensuellePrevueDTO[] }>(
        `/api/previsions/postes/${posteId}/charges/reporter`,
        {
          montantFCFA: Number(montant),
          moisDebutAbsolu: apercu.moisDebutAbsolu,
          moisFinAbsolu: apercu.moisFinAbsolu,
        }
      );
      if (result.ok && result.data) {
        onReported(result.data.data);
        handleOpenChange(false);
      } else {
        setError(result.error ?? t("reporterChargeDialog.errors.generic"));
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <CalendarRange className="h-4 w-4" />
          {t("reporterChargeDialog.triggerButton")}
        </Button>
      </DialogTrigger>
      <DialogContent onInteractOutside={onInteractOutside} onEscapeKeyDown={onEscapeKeyDown}>
        <DialogHeader>
          <DialogTitle>{t("reporterChargeDialog.dialogTitle", { libelle })}</DialogTitle>
          <DialogDescription>{t("reporterChargeDialog.description")}</DialogDescription>
        </DialogHeader>
        <DialogBody>
          {etape === "saisie" ? (
            <div className="flex flex-col gap-3">
              <Input
                label={t("reporterChargeDialog.fields.montant.label")}
                type="number"
                inputMode="decimal"
                min={0}
                required
                placeholder={t("reporterChargeDialog.fields.montant.placeholder")}
                value={montant}
                onChange={(e) => {
                  setMontant(e.target.value);
                  setTouched(true);
                }}
              />
              <Select
                value={plage}
                onValueChange={(v) => {
                  setPlage(v as Plage);
                  setTouched(true);
                }}
              >
                <SelectTrigger label={t("reporterChargeDialog.fields.plage.label")}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="depuisMoisCourant">
                    {t("reporterChargeDialog.plage.depuisMoisCourant")}
                  </SelectItem>
                  <SelectItem value="tousLesMois">{t("reporterChargeDialog.plage.tousLesMois")}</SelectItem>
                </SelectContent>
              </Select>
              {!horizonFiable && (
                <p className="text-sm text-danger">{t("reporterChargeDialog.errors.horizonIndisponible")}</p>
              )}
              {error && <p className="text-sm text-danger">{error}</p>}
            </div>
          ) : apercu ? (
            <div className="flex flex-col gap-2 text-sm">
              <p className="font-semibold">{t("reporterChargeDialog.apercu.title")}</p>
              <p>
                {t("reporterChargeDialog.apercu.moisConcernes", {
                  count: apercu.totalMois,
                  debut: libelleMoisCalendaire(debutDate, apercu.moisDebutAbsolu),
                  fin: libelleMoisCalendaire(debutDate, apercu.moisFinAbsolu),
                })}
              </p>
              {apercu.moisEcrases.length === 0 ? (
                <p className="text-muted-foreground">{t("reporterChargeDialog.apercu.aucunEcrasement")}</p>
              ) : (
                <>
                  <p className="text-warning">
                    {t("reporterChargeDialog.apercu.moisEcrases", { count: apercu.moisEcrases.length })}
                  </p>
                  <ul className="flex flex-col gap-1 list-disc pl-5 text-muted-foreground">
                    {apercu.moisEcrases.map(({ moisAbsolu, charge }) => (
                      <li key={moisAbsolu}>
                        {t("reporterChargeDialog.apercu.detailEcraseligne", {
                          mois: libelleMoisCalendaire(debutDate, moisAbsolu),
                          ancien: formatMontantPrevision(charge.montantFCFA),
                          nouveau: formatMontantPrevision(Number(montant)),
                        })}
                      </li>
                    ))}
                  </ul>
                </>
              )}
              {error && <p className="text-sm text-danger">{error}</p>}
            </div>
          ) : null}
        </DialogBody>
        <DialogFooter>
          {etape === "saisie" ? (
            <>
              <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={loadingApercu}>
                {tCommon("buttons.cancel")}
              </Button>
              <Button onClick={handleVoirApercu} disabled={loadingApercu || !horizonFiable}>
                {loadingApercu ? t("reporterChargeDialog.previewing") : t("reporterChargeDialog.previewButton")}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setEtape("saisie")} disabled={submitting}>
                {t("reporterChargeDialog.backButton")}
              </Button>
              <Button onClick={handleConfirmer} disabled={submitting || apercu === null}>
                {submitting ? t("reporterChargeDialog.confirming") : t("reporterChargeDialog.confirmButton")}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
