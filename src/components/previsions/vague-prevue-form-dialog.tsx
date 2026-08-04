"use client";

/**
 * src/components/previsions/vague-prevue-form-dialog.tsx
 *
 * Dialog de creation/edition d'une VaguePrevue (plan d'empoissonnement,
 * ADR-053 §3.6). R5 : `DialogTrigger asChild`.
 *
 * Mode edition (`existant` fourni) : suit le meme patron que
 * `journal-form-dialog.tsx` (`existant?` + `trigger` fourni par l'appelant,
 * PUT sur la ressource existante au lieu d'un POST de creation). C'est
 * l'appelant (`plan-vagues-tab.tsx`) qui decide QUAND l'action "Modifier"
 * est proposee (restriction de statut) — ce dialogue reste, lui,
 * inconditionnel : s'il est monte, il edite les 4 champs editables de
 * `UpdateVaguePrevueDTO` (`code`, `dateStockagePrevue`,
 * `effectifAlevinsPrevu`, `poidsMoyenInitialG`), jamais `dureeCycleMoisFigee`
 * (gelee, ADR-053 decision 1).
 */
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
} from "@/components/ui/dialog";
import { Plus } from "lucide-react";
import { usePrevisionsApi } from "@/hooks/use-previsions-api";
import { useDialogCloseGuard } from "@/hooks/use-dialog-close-guard";
import type { VaguePrevueListItemDTO } from "@/components/previsions/api-types";

interface VaguePrevueFormDialogProps {
  scenarioId: string;
  codeSuggere: string;
  /** Fournie en mode edition uniquement — declenche un PUT au lieu d'un POST. */
  existant?: VaguePrevueListItemDTO;
  /**
   * Defaut du scenario (`ParametresPrevisionDTO.alevinsAchetesParDefaut`,
   * ADR-053 §14) — pre-remplit la case a cocher en mode CREATION. En mode
   * EDITION, la valeur propre a `existant.alevinsAchetes` prevaut toujours
   * (voir `useState` ci-dessous), ce prop n'est alors pas utilise.
   */
  alevinsAchetesParDefaut?: boolean;
  onCreated?: (vaguePrevue: VaguePrevueListItemDTO) => void;
  onUpdated?: (vaguePrevue: VaguePrevueListItemDTO) => void;
  /**
   * Element declencheur personnalise (mode edition, ex. bouton "Modifier"
   * avec icone Pencil sur la carte de la vague). Si absent, le bouton de
   * creation par defaut ("Nouvelle vague planifiee") est utilise — cas
   * historique, toujours pris en charge pour ne pas casser l'appel existant.
   */
  trigger?: React.ReactNode;
}

export function VaguePrevueFormDialog({
  scenarioId,
  codeSuggere,
  existant,
  alevinsAchetesParDefaut = false,
  onCreated,
  onUpdated,
  trigger,
}: VaguePrevueFormDialogProps) {
  const t = useTranslations("previsions");
  const tCommon = useTranslations("common");
  const { post, put } = usePrevisionsApi();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState(existant?.code ?? codeSuggere);
  const [dateStockagePrevue, setDateStockagePrevue] = useState(existant?.dateStockagePrevue.slice(0, 10) ?? "");
  const [effectifAlevinsPrevu, setEffectifAlevinsPrevu] = useState(
    existant ? String(existant.effectifAlevinsPrevu) : ""
  );
  const [poidsMoyenInitialG, setPoidsMoyenInitialG] = useState(
    existant ? String(existant.poidsMoyenInitialG) : ""
  );
  // Creation : pre-rempli depuis le defaut du scenario. Edition : reprend la
  // valeur propre a la vague (ADR-053 §14, jamais le defaut du scenario, qui
  // pourrait avoir change depuis la creation de cette vague).
  const [alevinsAchetes, setAlevinsAchetes] = useState(
    existant ? existant.alevinsAchetes : alevinsAchetesParDefaut
  );
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState(false);
  const { onInteractOutside, onEscapeKeyDown } = useDialogCloseGuard(touched);

  // Restaure `codeSuggere` en creation (pas une chaine vide) : c'est la
  // valeur initiale du champ a l'ouverture, pas un formulaire vierge
  // (pre-analyse PR2ter.2 point 1). En edition, restaure `existant` — meme
  // logique, appliquee a la ressource editee plutot qu'a une suggestion.
  function resetForm() {
    setCode(existant?.code ?? codeSuggere);
    setDateStockagePrevue(existant?.dateStockagePrevue.slice(0, 10) ?? "");
    setEffectifAlevinsPrevu(existant ? String(existant.effectifAlevinsPrevu) : "");
    setPoidsMoyenInitialG(existant ? String(existant.poidsMoyenInitialG) : "");
    setAlevinsAchetes(existant ? existant.alevinsAchetes : alevinsAchetesParDefaut);
    setErrors({});
    setTouched(false);
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) resetForm();
  }

  function validate(): boolean {
    const next: Record<string, string> = {};
    if (!code.trim()) next.code = t("vaguePrevueForm.errors.codeRequired");
    if (!dateStockagePrevue) next.dateStockagePrevue = t("vaguePrevueForm.errors.dateRequired");
    if (!effectifAlevinsPrevu.trim() || Number(effectifAlevinsPrevu) <= 0)
      next.effectifAlevinsPrevu = t("vaguePrevueForm.errors.effectifPositive");
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit() {
    if (!validate()) return;
    setSubmitting(true);
    try {
      const payload = {
        code: code.trim(),
        dateStockagePrevue: new Date(dateStockagePrevue).toISOString(),
        effectifAlevinsPrevu: Number(effectifAlevinsPrevu),
        poidsMoyenInitialG: Number(poidsMoyenInitialG) || 0,
        alevinsAchetes,
      };
      const result = existant
        ? await put<VaguePrevueListItemDTO>(`/api/previsions/vagues-prevues/${existant.id}`, payload)
        : await post<VaguePrevueListItemDTO>(`/api/previsions/scenarios/${scenarioId}/vagues`, payload);
      if (result.ok && result.data) {
        if (existant) {
          onUpdated?.(result.data);
        } else {
          onCreated?.(result.data);
        }
        setOpen(false);
        if (existant) {
          // L'instance d'edition reste montee (meme patron que
          // journal-form-dialog.tsx) : `existant` ne sera mis a jour qu'au
          // prochain rendu du parent — on reinitialise depuis la reponse
          // fraiche de l'API, jamais depuis l'ancien `existant`, sous peine
          // de reafficher les valeurs D'AVANT cette edition a la reouverture.
          setCode(result.data.code);
          setDateStockagePrevue(result.data.dateStockagePrevue.slice(0, 10));
          setEffectifAlevinsPrevu(String(result.data.effectifAlevinsPrevu));
          setPoidsMoyenInitialG(String(result.data.poidsMoyenInitialG));
          setAlevinsAchetes(result.data.alevinsAchetes);
          setErrors({});
          setTouched(false);
        } else {
          resetForm();
        }
      }
      // Echec (validation serveur 400/422, conflit 409, etc.) : `useApi`
      // affiche deja un toast avec le message renvoye par l'API — jamais un
      // 500 muet (P2002 sur `@@unique([scenarioId, code])` -> 409 traduit en
      // route, cf. handleApiError). Le dialogue reste ouvert, saisie
      // conservee, pas de reset ici.
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button className="w-full md:w-auto">
            <Plus className="h-4 w-4" />
            {t("vaguePrevueForm.triggerButton")}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent onInteractOutside={onInteractOutside} onEscapeKeyDown={onEscapeKeyDown}>
        <DialogHeader>
          <DialogTitle>
            {existant ? t("vaguePrevueForm.dialogTitleEdit") : t("vaguePrevueForm.dialogTitle")}
          </DialogTitle>
        </DialogHeader>
        <DialogBody>
          <div className="flex flex-col gap-3">
            <Input
              label={t("vaguePrevueForm.fields.code.label")}
              required
              placeholder={t("vaguePrevueForm.fields.code.placeholder")}
              value={code}
              onChange={(e) => {
                setCode(e.target.value);
                setTouched(true);
              }}
              error={errors.code}
            />
            <Input
              label={t("vaguePrevueForm.fields.dateStockagePrevue.label")}
              type="date"
              required
              value={dateStockagePrevue}
              onChange={(e) => {
                setDateStockagePrevue(e.target.value);
                setTouched(true);
              }}
              error={errors.dateStockagePrevue}
            />
            <Input
              label={t("vaguePrevueForm.fields.effectifAlevinsPrevu.label")}
              type="number"
              inputMode="numeric"
              min={1}
              step={1}
              required
              value={effectifAlevinsPrevu}
              onChange={(e) => {
                setEffectifAlevinsPrevu(e.target.value);
                setTouched(true);
              }}
              error={errors.effectifAlevinsPrevu}
            />
            <Input
              label={t("vaguePrevueForm.fields.poidsMoyenInitialG.label")}
              type="number"
              inputMode="decimal"
              min={0}
              value={poidsMoyenInitialG}
              onChange={(e) => {
                setPoidsMoyenInitialG(e.target.value);
                setTouched(true);
              }}
            />
            <label className="flex min-h-[44px] items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={alevinsAchetes}
                onChange={(e) => {
                  setAlevinsAchetes(e.target.checked);
                  setTouched(true);
                }}
                className="rounded border-input"
              />
              <span className="text-sm">{t("vaguePrevueForm.fields.alevinsAchetes.label")}</span>
            </label>
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={submitting}>
            {tCommon("buttons.cancel")}
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {existant
              ? submitting
                ? t("vaguePrevueForm.submittingEdit")
                : t("vaguePrevueForm.submitEdit")
              : submitting
                ? t("vaguePrevueForm.submitting")
                : t("vaguePrevueForm.submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
