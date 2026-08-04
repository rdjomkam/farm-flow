"use client";

/**
 * src/components/previsions/journal-form-dialog.tsx
 *
 * Dialog de creation/edition d'une ligne de journal de depenses prevues.
 * `vaguePrevueId` null = depense GENERALE (entre dans base_repartition si
 * OPERATIONNEL et poste inclus) ; non-null = affectee nominativement a une
 * vague (EXCLUE de base_repartition, ADR-053 decision 6 — evite le double
 * comptage).
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
  DialogBody,
  DialogFooter,
} from "@/components/ui/dialog";
import { CategorieJournalPrevu } from "@/types";
import { usePrevisionsApi } from "@/hooks/use-previsions-api";
import { useDialogCloseGuard } from "@/hooks/use-dialog-close-guard";
import type { JournalDepensePrevueDTO, VaguePrevueListItemDTO } from "@/components/previsions/api-types";

const AUCUNE_VAGUE = "__aucune__";

interface JournalFormDialogProps {
  scenarioId: string;
  vaguesPrevues: VaguePrevueListItemDTO[];
  existant?: JournalDepensePrevueDTO;
  onSaved: (ligne: JournalDepensePrevueDTO) => void;
  trigger: React.ReactNode;
}

export function JournalFormDialog({ scenarioId, vaguesPrevues, existant, onSaved, trigger }: JournalFormDialogProps) {
  const t = useTranslations("previsions");
  const tCommon = useTranslations("common");
  const CATEGORIE_LABELS: Record<CategorieJournalPrevu, string> = {
    [CategorieJournalPrevu.OPERATIONNEL]: t("journalForm.categories.OPERATIONNEL"),
    [CategorieJournalPrevu.INVESTISSEMENT]: t("journalForm.categories.INVESTISSEMENT"),
  };
  const { post, put } = usePrevisionsApi();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(existant?.date.slice(0, 10) ?? "");
  const [libelle, setLibelle] = useState(existant?.libelle ?? "");
  const [categorie, setCategorie] = useState<CategorieJournalPrevu>(
    existant?.categorie ?? CategorieJournalPrevu.OPERATIONNEL
  );
  const [montantFCFA, setMontantFCFA] = useState(existant ? String(existant.montantFCFA) : "");
  const [vaguePrevueId, setVaguePrevueId] = useState(existant?.vaguePrevueId ?? AUCUNE_VAGUE);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);
  const { onInteractOutside, onEscapeKeyDown } = useDialogCloseGuard(touched);

  /**
   * Restaure les valeurs de `existant` en mode edition (pas un formulaire
   * vide) — Bug B aggrave sur ce dialogue (pre-analyse PR2ter.2 section 2) :
   * aucun reset n'existait meme apres un succes. `existant` est lu depuis la
   * fermeture du composant courant (props a jour au moment de l'appel).
   */
  function resetForm() {
    setDate(existant?.date.slice(0, 10) ?? "");
    setLibelle(existant?.libelle ?? "");
    setCategorie(existant?.categorie ?? CategorieJournalPrevu.OPERATIONNEL);
    setMontantFCFA(existant ? String(existant.montantFCFA) : "");
    setVaguePrevueId(existant?.vaguePrevueId ?? AUCUNE_VAGUE);
    setError(null);
    setTouched(false);
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) resetForm();
  }

  async function handleSubmit() {
    if (!date || !libelle.trim()) {
      setError(t("journalForm.errors.dateAndLibelleRequired"));
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        date: new Date(date).toISOString(),
        libelle: libelle.trim(),
        categorie,
        montantFCFA: Number(montantFCFA) || 0,
        vaguePrevueId: vaguePrevueId === AUCUNE_VAGUE ? null : vaguePrevueId,
      };
      const result = existant
        ? await put<JournalDepensePrevueDTO>(`/api/previsions/journal/${existant.id}`, payload)
        : await post<JournalDepensePrevueDTO>(`/api/previsions/scenarios/${scenarioId}/journal`, payload);
      if (result.ok && result.data) {
        onSaved(result.data);
        setOpen(false);
        if (existant) {
          // L'instance d'edition reste montee (meme `key` que la ligne,
          // pre-analyse PR2ter.2 section 2) : le prop `existant` ne sera mis
          // a jour qu'au prochain rendu du parent, encore stale ici. On
          // reinitialise donc explicitement depuis la reponse fraiche de
          // l'API, pas depuis l'ancien `existant`, sous peine de reafficher
          // les valeurs D'AVANT cette edition a une reouverture ulterieure.
          setDate(result.data.date.slice(0, 10));
          setLibelle(result.data.libelle);
          setCategorie(result.data.categorie);
          setMontantFCFA(String(result.data.montantFCFA));
          setVaguePrevueId(result.data.vaguePrevueId ?? AUCUNE_VAGUE);
          setError(null);
          setTouched(false);
        } else {
          resetForm();
        }
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent onInteractOutside={onInteractOutside} onEscapeKeyDown={onEscapeKeyDown}>
        <DialogHeader>
          <DialogTitle>{existant ? t("journalForm.dialogTitleEdit") : t("journalForm.dialogTitleCreate")}</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <div className="flex flex-col gap-3">
            <Input
              label={t("journalForm.fields.date.label")}
              type="date"
              required
              value={date}
              onChange={(e) => {
                setDate(e.target.value);
                setTouched(true);
              }}
            />
            <Input
              label={t("journalForm.fields.libelle.label")}
              required
              value={libelle}
              onChange={(e) => {
                setLibelle(e.target.value);
                setTouched(true);
              }}
            />
            <Select
              value={categorie}
              onValueChange={(v) => {
                setCategorie(v as CategorieJournalPrevu);
                setTouched(true);
              }}
            >
              <SelectTrigger label={t("journalForm.fields.categorie.label")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.values(CategorieJournalPrevu).map((c) => (
                  <SelectItem key={c} value={c}>
                    {CATEGORIE_LABELS[c]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              label={t("journalForm.fields.montantFCFA.label")}
              type="number"
              inputMode="decimal"
              min={0}
              value={montantFCFA}
              onChange={(e) => {
                setMontantFCFA(e.target.value);
                setTouched(true);
              }}
            />
            <Select
              value={vaguePrevueId}
              onValueChange={(v) => {
                setVaguePrevueId(v);
                setTouched(true);
              }}
            >
              <SelectTrigger
                label={t("journalForm.fields.affectation.label")}
                hint={t("journalForm.fields.affectation.hint")}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={AUCUNE_VAGUE}>{t("journalForm.noneOption")}</SelectItem>
                {vaguesPrevues.map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    {t("journalForm.assignedOption", { code: v.code })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {error && <p className="text-sm text-danger">{error}</p>}
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={submitting}>
            {tCommon("buttons.cancel")}
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? t("journalForm.saving") : existant ? t("journalForm.submitEdit") : t("journalForm.submitCreate")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
