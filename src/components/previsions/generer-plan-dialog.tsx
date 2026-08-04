"use client";

/**
 * src/components/previsions/generer-plan-dialog.tsx
 *
 * Dialog de generation en masse du plan d'empoissonnement (ADR-053 section 4,
 * `genererPlanEmpoissonnement`) — Sprint PR2bis, story PR2bis.2.
 *
 * Seul `horizonMois` est saisi (les autres parametres du moteur sont deja
 * persistes sur le scenario, jamais resaisis — pre-analyse PR2bis.2 section
 * 2). Flux en 2 etapes DANS le meme dialogue :
 *   1. Saisie de l'horizon + choix du mode ("ajouter" | "remplacer").
 *   2. Apercu chiffre (dry-run, `GET .../vagues/generer`) affiche AVANT toute
 *      ecriture — jamais un ajout/remplacement silencieux (arbitrage PM).
 * La confirmation appelle ensuite `POST .../vagues/generer`.
 */
import { useState } from "react";
import { useTranslations } from "next-intl";
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
import { Sparkles } from "lucide-react";
import { usePrevisionsApi } from "@/hooks/use-previsions-api";
import { useDialogCloseGuard } from "@/hooks/use-dialog-close-guard";
import { formatEntierPrevision } from "@/lib/previsions/format-previsions";
import type {
  ApercuGenerationPlanDTO,
  ModeGenerationPlanDTO,
  VaguePrevueListItemDTO,
} from "@/components/previsions/api-types";

interface GenererPlanDialogProps {
  scenarioId: string;
  onGenerated: (nouvelles: VaguePrevueListItemDTO[]) => void;
}

type Etape = "saisie" | "apercu";

export function GenererPlanDialog({ scenarioId, onGenerated }: GenererPlanDialogProps) {
  const t = useTranslations("previsions");
  const tCommon = useTranslations("common");
  const { get, post } = usePrevisionsApi();

  const [open, setOpen] = useState(false);
  const [etape, setEtape] = useState<Etape>("saisie");
  const [horizonMois, setHorizonMois] = useState("");
  const [mode, setMode] = useState<ModeGenerationPlanDTO>("ajouter");
  const [apercu, setApercu] = useState<ApercuGenerationPlanDTO | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingApercu, setLoadingApercu] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  // Bug A (pre-analyse PR2ter.2 section 2) : ce dialogue n'a que 1-2 champs
  // et aucune ecriture n'a lieu avant confirmation — impact pratique faible,
  // mais le garde est ajoute par cohesion avec les 9 autres dialogues.
  const [touched, setTouched] = useState(false);
  const { onInteractOutside, onEscapeKeyDown } = useDialogCloseGuard(touched);

  function reset() {
    setEtape("saisie");
    setHorizonMois("");
    setMode("ajouter");
    setApercu(null);
    setError(null);
    setTouched(false);
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) reset();
  }

  async function handleVoirApercu() {
    setError(null);
    if (!horizonMois.trim() || Number(horizonMois) < 0 || !Number.isInteger(Number(horizonMois))) {
      setError(t("genererPlanDialog.errors.horizonInvalide"));
      return;
    }
    setLoadingApercu(true);
    try {
      const params = new URLSearchParams({ horizonMois: horizonMois.trim(), mode });
      const result = await get<ApercuGenerationPlanDTO>(
        `/api/previsions/scenarios/${scenarioId}/vagues/generer?${params.toString()}`
      );
      if (result.ok && result.data) {
        setApercu(result.data);
        setEtape("apercu");
      } else {
        setError(result.error ?? t("genererPlanDialog.errors.generic"));
      }
    } finally {
      setLoadingApercu(false);
    }
  }

  async function handleConfirmer() {
    setSubmitting(true);
    setError(null);
    try {
      const result = await post<{ data: VaguePrevueListItemDTO[] }>(
        `/api/previsions/scenarios/${scenarioId}/vagues/generer`,
        { horizonMois: Number(horizonMois), mode }
      );
      if (result.ok && result.data) {
        onGenerated(result.data.data);
        setOpen(false);
        reset();
      } else {
        setError(result.error ?? t("genererPlanDialog.errors.generic"));
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full md:w-auto">
          <Sparkles className="h-4 w-4" />
          {t("genererPlanDialog.triggerButton")}
        </Button>
      </DialogTrigger>
      <DialogContent onInteractOutside={onInteractOutside} onEscapeKeyDown={onEscapeKeyDown}>
        <DialogHeader>
          <DialogTitle>{t("genererPlanDialog.dialogTitle")}</DialogTitle>
          <DialogDescription>{t("genererPlanDialog.description")}</DialogDescription>
        </DialogHeader>
        <DialogBody>
          {etape === "saisie" ? (
            <div className="flex flex-col gap-3">
              <Input
                label={t("genererPlanDialog.fields.horizonMois.label")}
                type="number"
                inputMode="numeric"
                min={0}
                step={1}
                required
                placeholder={t("genererPlanDialog.fields.horizonMois.placeholder")}
                value={horizonMois}
                onChange={(e) => {
                  setHorizonMois(e.target.value);
                  setTouched(true);
                }}
              />
              <Select
                value={mode}
                onValueChange={(v) => {
                  setMode(v as ModeGenerationPlanDTO);
                  setTouched(true);
                }}
              >
                <SelectTrigger label={t("genererPlanDialog.fields.mode.label")}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ajouter">{t("genererPlanDialog.mode.ajouter")}</SelectItem>
                  <SelectItem value="remplacer">{t("genererPlanDialog.mode.remplacer")}</SelectItem>
                </SelectContent>
              </Select>
              {error && <p className="text-sm text-danger">{error}</p>}
            </div>
          ) : apercu ? (
            <div className="flex flex-col gap-2 text-sm">
              <p className="font-semibold">{t("genererPlanDialog.apercu.title")}</p>
              <ul className="flex flex-col gap-1 list-disc pl-5">
                <li>
                  {t("genererPlanDialog.apercu.rattachees", {
                    count: formatEntierPrevision(apercu.nombreVaguesRattacheesConservees),
                  })}
                </li>
                {apercu.mode === "remplacer" && (
                  <li>
                    {t("genererPlanDialog.apercu.annulees", {
                      count: formatEntierPrevision(apercu.nombreVaguesAnnuleesEtRemplacees),
                    })}
                  </li>
                )}
                <li>
                  {t("genererPlanDialog.apercu.nouvelles", {
                    count: formatEntierPrevision(apercu.nombreNouvellesVagues),
                  })}
                </li>
              </ul>
              {apercu.nombreNouvellesVagues > 0 ? (
                <p className="text-muted-foreground">
                  {t("genererPlanDialog.apercu.periode", {
                    debut: apercu.premiereDateStockagePrevue
                      ? new Date(apercu.premiereDateStockagePrevue).toLocaleDateString("fr-FR")
                      : "–",
                    fin: apercu.derniereDateStockagePrevue
                      ? new Date(apercu.derniereDateStockagePrevue).toLocaleDateString("fr-FR")
                      : "–",
                  })}
                </p>
              ) : (
                <p className="text-muted-foreground">{t("genererPlanDialog.apercu.aucuneNouvelle")}</p>
              )}
              {apercu.codesGeneres.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  {t("genererPlanDialog.apercu.codesNote", {
                    codes: apercu.codesGeneres.join(", "),
                  })}
                </p>
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
              <Button onClick={handleVoirApercu} disabled={loadingApercu}>
                {loadingApercu ? t("genererPlanDialog.previewing") : t("genererPlanDialog.previewButton")}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setEtape("saisie")} disabled={submitting}>
                {t("genererPlanDialog.backButton")}
              </Button>
              <Button
                onClick={handleConfirmer}
                disabled={submitting || (apercu?.nombreNouvellesVagues ?? 0) === 0}
              >
                {submitting ? t("genererPlanDialog.confirming") : t("genererPlanDialog.confirmButton")}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
