"use client";

/**
 * src/components/previsions/apport-form-dialog.tsx
 *
 * Dialog de creation d'un ApportCapital (CAPITAL ou CREDIT — un credit
 * encaisse est un apport de tresorerie, jamais un investissement, ADR-053
 * §3.1/§7). Pas d'edition/suppression cote API pour ce modele (PR2.2 :
 * seules `GET`/`POST /scenarios/[id]/apports` existent) — creation
 * uniquement, coherent avec la surface reelle de l'API.
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
import { Plus } from "lucide-react";
import { TypeApportCapital } from "@/types";
import { usePrevisionsApi } from "@/hooks/use-previsions-api";
import { useDialogCloseGuard } from "@/hooks/use-dialog-close-guard";
import type { ApportCapitalDTO } from "@/components/previsions/api-types";

interface ApportFormDialogProps {
  scenarioId: string;
  onCreated: (apport: ApportCapitalDTO) => void;
}

export function ApportFormDialog({ scenarioId, onCreated }: ApportFormDialogProps) {
  const t = useTranslations("previsions");
  const tCommon = useTranslations("common");
  const TYPE_LABELS: Record<TypeApportCapital, string> = {
    [TypeApportCapital.CAPITAL]: t("apportForm.types.CAPITAL"),
    [TypeApportCapital.CREDIT]: t("apportForm.types.CREDIT"),
  };
  const { post } = usePrevisionsApi();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState("");
  const [libelle, setLibelle] = useState("");
  const [montantFCFA, setMontantFCFA] = useState("");
  const [type, setType] = useState<TypeApportCapital>(TypeApportCapital.CAPITAL);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);
  const { onInteractOutside, onEscapeKeyDown } = useDialogCloseGuard(touched);

  function resetForm() {
    setDate("");
    setLibelle("");
    setMontantFCFA("");
    setType(TypeApportCapital.CAPITAL);
    setError(null);
    setTouched(false);
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) resetForm();
  }

  async function handleSubmit() {
    if (!date || !libelle.trim()) {
      setError(t("apportForm.errors.dateAndLibelleRequired"));
      return;
    }
    setSubmitting(true);
    try {
      const result = await post<ApportCapitalDTO>(`/api/previsions/scenarios/${scenarioId}/apports`, {
        date: new Date(date).toISOString(),
        libelle: libelle.trim(),
        montantFCFA: Number(montantFCFA) || 0,
        type,
      });
      if (result.ok && result.data) {
        onCreated(result.data);
        handleOpenChange(false);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button className="w-full md:w-auto">
          <Plus className="h-4 w-4" />
          {t("apportForm.triggerButton")}
        </Button>
      </DialogTrigger>
      <DialogContent onInteractOutside={onInteractOutside} onEscapeKeyDown={onEscapeKeyDown}>
        <DialogHeader>
          <DialogTitle>{t("apportForm.dialogTitle")}</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <div className="flex flex-col gap-3">
            <Input
              label={t("apportForm.fields.date.label")}
              type="date"
              required
              value={date}
              onChange={(e) => {
                setDate(e.target.value);
                setTouched(true);
              }}
            />
            <Input
              label={t("apportForm.fields.libelle.label")}
              required
              value={libelle}
              onChange={(e) => {
                setLibelle(e.target.value);
                setTouched(true);
              }}
            />
            <Input
              label={t("apportForm.fields.montantFCFA.label")}
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
              value={type}
              onValueChange={(v) => {
                setType(v as TypeApportCapital);
                setTouched(true);
              }}
            >
              <SelectTrigger label={t("apportForm.fields.type.label")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.values(TypeApportCapital).map((typeValue) => (
                  <SelectItem key={typeValue} value={typeValue}>
                    {TYPE_LABELS[typeValue]}
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
            {submitting ? t("apportForm.submitting") : t("apportForm.submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
