"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
} from "@/components/ui/dialog";
import { usePrevisionsApi } from "@/hooks/use-previsions-api";
import { useDialogCloseGuard } from "@/hooks/use-dialog-close-guard";
import type { AlimentPrevisionDTO } from "@/components/previsions/api-types";

interface AlimentEditDialogProps {
  aliment: AlimentPrevisionDTO;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: (aliment: AlimentPrevisionDTO) => void;
}

export function AlimentEditDialog({
  aliment,
  open,
  onOpenChange,
  onUpdated,
}: AlimentEditDialogProps) {
  const t = useTranslations("previsions");
  const tCommon = useTranslations("common");
  const { patch } = usePrevisionsApi();
  const [libelle, setLibelle] = useState(aliment.libelle);
  const [poidsSacKg, setPoidsSacKg] = useState(String(aliment.poidsSacKg));
  const [prixSacFCFA, setPrixSacFCFA] = useState(String(aliment.prixSacFCFA));
  const [sacsParTonneStandard, setSacsParTonneStandard] = useState(
    aliment.sacsParTonneStandard !== null ? String(aliment.sacsParTonneStandard) : ""
  );
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState(false);
  const { onInteractOutside, onEscapeKeyDown } = useDialogCloseGuard(touched);

  function resetForm() {
    setLibelle(aliment.libelle);
    setPoidsSacKg(String(aliment.poidsSacKg));
    setPrixSacFCFA(String(aliment.prixSacFCFA));
    setSacsParTonneStandard(
      aliment.sacsParTonneStandard !== null ? String(aliment.sacsParTonneStandard) : ""
    );
    setErrors({});
    setTouched(false);
  }

  function handleOpenChange(next: boolean) {
    onOpenChange(next);
    if (!next) resetForm();
  }

  function validate(): boolean {
    const next: Record<string, string> = {};
    if (!libelle.trim()) next.libelle = t("alimentForm.errors.libelleRequired");
    if (!poidsSacKg.trim() || Number(poidsSacKg) <= 0) next.poidsSacKg = t("alimentForm.errors.poidsSacKgPositive");
    if (!prixSacFCFA.trim()) next.prixSacFCFA = t("alimentForm.errors.required");
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit() {
    if (!validate()) return;
    setSubmitting(true);
    try {
      const result = await patch<AlimentPrevisionDTO>(`/api/previsions/aliments/${aliment.id}`, {
        libelle: libelle.trim(),
        poidsSacKg: Number(poidsSacKg),
        prixSacFCFA: Number(prixSacFCFA),
        sacsParTonneStandard: sacsParTonneStandard.trim() ? Number(sacsParTonneStandard) : null,
      });
      if (result.ok && result.data) {
        onUpdated(result.data);
        handleOpenChange(false);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent onInteractOutside={onInteractOutside} onEscapeKeyDown={onEscapeKeyDown}>
        <DialogHeader>
          <DialogTitle>{t("alimentEditForm.dialogTitle")}</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <div className="flex flex-col gap-3">
            <Input
              label={t("alimentForm.fields.libelle.label")}
              required
              placeholder={t("alimentForm.fields.libelle.placeholder")}
              value={libelle}
              onChange={(e) => { setLibelle(e.target.value); setTouched(true); }}
              error={errors.libelle}
            />
            <Input
              label={t("alimentForm.fields.poidsSacKg.label")}
              type="number"
              inputMode="decimal"
              min={0.1}
              step={0.1}
              required
              value={poidsSacKg}
              onChange={(e) => { setPoidsSacKg(e.target.value); setTouched(true); }}
              error={errors.poidsSacKg}
            />
            <Input
              label={t("alimentForm.fields.prixSacFCFA.label")}
              type="number"
              inputMode="decimal"
              min={0}
              required
              value={prixSacFCFA}
              onChange={(e) => { setPrixSacFCFA(e.target.value); setTouched(true); }}
              error={errors.prixSacFCFA}
            />
            <Input
              label={t("alimentForm.fields.sacsParTonneStandard.label")}
              type="number"
              inputMode="decimal"
              min={0.1}
              step={0.1}
              value={sacsParTonneStandard}
              onChange={(e) => { setSacsParTonneStandard(e.target.value); setTouched(true); }}
              hint={t("alimentForm.fields.sacsParTonneStandard.hint")}
            />
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={submitting}>
            {tCommon("buttons.cancel")}
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? t("alimentEditForm.submitting") : t("alimentEditForm.submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
