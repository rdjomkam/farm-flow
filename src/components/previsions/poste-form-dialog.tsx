"use client";

/**
 * src/components/previsions/poste-form-dialog.tsx
 *
 * Dialog de creation d'un PostePrevision (referentiel parametrable des
 * postes de charges — PAS un enum code en dur, ADR-053 §3.8).
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
import { TypePostePrevision } from "@/types";
import { usePrevisionsApi } from "@/hooks/use-previsions-api";
import { useDialogCloseGuard } from "@/hooks/use-dialog-close-guard";
import type { PostePrevisionDTO } from "@/components/previsions/api-types";

interface PosteFormDialogProps {
  scenarioId: string;
  ordreSuivant: number;
  onCreated: (poste: PostePrevisionDTO) => void;
}

export function PosteFormDialog({ scenarioId, ordreSuivant, onCreated }: PosteFormDialogProps) {
  const t = useTranslations("previsions");
  const tCommon = useTranslations("common");
  const TYPE_LABELS: Record<TypePostePrevision, string> = {
    [TypePostePrevision.LOGISTIQUE]: t("posteForm.types.LOGISTIQUE"),
    [TypePostePrevision.CHARGE_EXPLOITATION]: t("posteForm.types.CHARGE_EXPLOITATION"),
  };
  const { post } = usePrevisionsApi();
  const [open, setOpen] = useState(false);
  const [libelle, setLibelle] = useState("");
  const [type, setType] = useState<TypePostePrevision>(TypePostePrevision.CHARGE_EXPLOITATION);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);
  const { onInteractOutside, onEscapeKeyDown } = useDialogCloseGuard(touched);

  function resetForm() {
    setLibelle("");
    setType(TypePostePrevision.CHARGE_EXPLOITATION);
    setError(null);
    setTouched(false);
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) resetForm();
  }

  async function handleSubmit() {
    if (!libelle.trim()) {
      setError(t("posteForm.errors.libelleRequired"));
      return;
    }
    setSubmitting(true);
    try {
      const result = await post<PostePrevisionDTO>(`/api/previsions/scenarios/${scenarioId}/postes`, {
        libelle: libelle.trim(),
        type,
        ordre: ordreSuivant,
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
        <Button variant="outline" size="sm">
          <Plus className="h-4 w-4" />
          {t("posteForm.triggerButton")}
        </Button>
      </DialogTrigger>
      <DialogContent onInteractOutside={onInteractOutside} onEscapeKeyDown={onEscapeKeyDown}>
        <DialogHeader>
          <DialogTitle>{t("posteForm.dialogTitle")}</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <div className="flex flex-col gap-3">
            <Input
              label={t("posteForm.fields.libelle.label")}
              required
              placeholder={t("posteForm.fields.libelle.placeholder")}
              value={libelle}
              onChange={(e) => {
                setLibelle(e.target.value);
                setTouched(true);
              }}
              error={error ?? undefined}
            />
            <Select
              value={type}
              onValueChange={(v) => {
                setType(v as TypePostePrevision);
                setTouched(true);
              }}
            >
              <SelectTrigger label={t("posteForm.fields.type.label")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.values(TypePostePrevision).map((typeValue) => (
                  <SelectItem key={typeValue} value={typeValue}>
                    {TYPE_LABELS[typeValue]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={submitting}>
            {tCommon("buttons.cancel")}
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? t("posteForm.submitting") : t("posteForm.submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
