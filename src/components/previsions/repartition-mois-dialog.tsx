"use client";

/**
 * src/components/previsions/repartition-mois-dialog.tsx
 *
 * Dialog de repartition d'une granulometrie sur les mois du cycle
 * (`RepartitionMoisAliment`, somme = 100%, ADR-053 §3.5). Transpose le
 * patron de `src/components/calibrage/step-groupes.tsx` (repartition a
 * somme contrainte, cartes empilees, indicateur de progression colore) —
 * ici le nombre de lignes est FIXE (1..dureeCycleMois), pas ajoutable/
 * supprimable librement, puisque le nombre de mois du cycle est fixe par le
 * scenario (pre-analyse PR2.3 §5).
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
import { usePrevisionsApi } from "@/hooks/use-previsions-api";
import { useDialogCloseGuard } from "@/hooks/use-dialog-close-guard";
import type { RepartitionMoisAlimentDTO } from "@/components/previsions/api-types";

interface RepartitionMoisDialogProps {
  alimentPrevisionId: string;
  libelle: string;
  dureeCycleMois: number;
  repartitions: RepartitionMoisAlimentDTO[];
  onSaved: (repartitions: RepartitionMoisAlimentDTO[]) => void;
  trigger: React.ReactNode;
}

export function RepartitionMoisDialog({
  alimentPrevisionId,
  libelle,
  dureeCycleMois,
  repartitions,
  onSaved,
  trigger,
}: RepartitionMoisDialogProps) {
  const t = useTranslations("previsions");
  const tCommon = useTranslations("common");
  const { put } = usePrevisionsApi();
  const [open, setOpen] = useState(false);

  function calculerValeursInitiales(): string[] {
    const parMois = new Map(repartitions.map((r) => [r.moisCycle, r.pourcentage]));
    return Array.from({ length: dureeCycleMois }, (_, i) => {
      const v = parMois.get(i + 1);
      return v !== undefined ? String(v) : "";
    });
  }

  const [valeurs, setValeurs] = useState<string[]>(calculerValeursInitiales);
  const [saving, setSaving] = useState(false);
  const [touched, setTouched] = useState(false);
  const { onInteractOutside, onEscapeKeyDown } = useDialogCloseGuard(touched);

  /**
   * Bug B variante (pre-analyse PR2ter.2 section 2) : `valeurs` n'etait
   * initialise que par lazy `useState` au tout premier montage — jamais
   * reinitialise sur Annuler ni clic exterieur. Une saisie abandonnee puis
   * une reouverture reaffichait l'edition abandonnee, pas la valeur
   * enregistree (`repartitions`, source de verite cote serveur).
   */
  function resetForm() {
    setValeurs(calculerValeursInitiales());
    setTouched(false);
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) resetForm();
  }

  const total = valeurs.reduce((sum, v) => sum + (Number(v) || 0), 0);
  const arrondi = Math.round(total * 10) / 10;
  const equilibre = arrondi === 100;

  async function handleSave() {
    setSaving(true);
    try {
      const result = await put<RepartitionMoisAlimentDTO[]>(
        `/api/previsions/aliments/${alimentPrevisionId}/repartitions`,
        {
          repartitions: valeurs.map((v, i) => ({
            moisCycle: i + 1,
            pourcentage: Number(v) || 0,
          })),
        }
      );
      if (result.ok && result.data) {
        onSaved(result.data);
        // `valeurs` reflete deja exactement ce qui vient d'etre enregistre —
        // ne PAS appeler `resetForm()` ici : `repartitions` (prop) est encore
        // l'ancienne valeur tant que le parent n'a pas re-rendu avec la
        // reponse fraiche, un reset ecraserait `valeurs` par l'ancien etat.
        setOpen(false);
        setTouched(false);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent onInteractOutside={onInteractOutside} onEscapeKeyDown={onEscapeKeyDown}>
        <DialogHeader>
          <DialogTitle>{t("repartitionDialog.dialogTitle", { libelle })}</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <div className="flex flex-col gap-4">
            <div className="rounded-xl border border-border bg-card p-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium">{t("repartitionDialog.totalLabel")}</p>
                <p className={equilibre ? "text-sm font-semibold text-success" : "text-sm font-semibold text-danger"}>
                  {t("repartitionDialog.totalValue", { value: arrondi })}
                </p>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    arrondi > 100 ? "bg-danger" : arrondi === 100 ? "bg-success" : "bg-primary"
                  }`}
                  style={{ width: `${Math.min(100, arrondi)}%` }}
                />
              </div>
              {!equilibre && (
                <p className="text-xs text-muted-foreground mt-1">
                  {t("repartitionDialog.imbalanceHint")}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-3">
              {valeurs.map((v, i) => (
                <Input
                  key={i}
                  label={t("repartitionDialog.monthLabel", { count: i + 1 })}
                  type="number"
                  inputMode="decimal"
                  min={0}
                  max={100}
                  placeholder="0"
                  value={v}
                  onChange={(e) => {
                    setValeurs((prev) => prev.map((p, idx) => (idx === i ? e.target.value : p)));
                    setTouched(true);
                  }}
                />
              ))}
            </div>
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={saving}>
            {tCommon("buttons.cancel")}
          </Button>
          <Button onClick={handleSave} disabled={saving || !equilibre}>
            {saving ? t("repartitionDialog.saving") : t("repartitionDialog.submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
