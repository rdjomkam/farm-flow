"use client";

/**
 * src/components/previsions/scission-dialog.tsx
 *
 * Dialog de scission d'une VaguePrevue (ex. V7 -> V7a + V7b,
 * `vaguePrevueParentId`, ADR-053 decision 2) — EXIGENCE de l'ADR, pas une
 * option : declenchee soit REACTIVEMENT (rejet 409
 * "VAGUE_PREVUE_DEJA_RATTACHEE" du dialog de rattachement), soit
 * PREVENTIVEMENT (bouton "Scinder" independant, sans rejet prealable).
 *
 * Fully-controlled (prop `open`/`onOpenChange`, pas de `DialogTrigger`) :
 * c'est la seule facon de faire fonctionner les DEUX chemins de
 * declenchement (clic bouton ET reponse API asynchrone) avec le MEME
 * composant Dialog — R5 (`DialogTrigger asChild`) s'applique aux triggers
 * non-controles ; ce Dialog n'en a volontairement aucun.
 *
 * Minimum 2 enfants (l'API l'exige, `scinderVaguePrevueSchema.min(2)`) —
 * pre-rempli avec 2 lignes par defaut, code suggere `${parent.code}a`/
 * `${parent.code}b`, effectif reparti moitie-moitie (pre-analyse PR2.3 §4).
 * L'API n'impose PAS que la somme des effectifs enfants egale l'effectif du
 * parent (verifie dans les schemas Zod) — decision de cette story (pre-
 * analyse §8 point 4) : l'UI affiche le total reparti vs l'effectif du
 * parent a TITRE INFORMATIF (indicateur colore, patron step-groupes), mais
 * NE BLOQUE PAS la soumission sur cette base — seule la contrainte reelle de
 * l'API (minimum 2 lignes, champs obligatoires) bloque le bouton.
 */
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogFooter,
} from "@/components/ui/dialog";
import { Plus, Trash2 } from "lucide-react";
import { usePrevisionsApi } from "@/hooks/use-previsions-api";
import { useDialogCloseGuard } from "@/hooks/use-dialog-close-guard";
import type { VaguePrevueListItemDTO } from "@/components/previsions/api-types";

interface LigneScission {
  code: string;
  dateStockagePrevue: string;
  effectifAlevinsPrevu: string;
  poidsMoyenInitialG: string;
}

interface ScissionDialogProps {
  parent: VaguePrevueListItemDTO | null;
  onOpenChange: (open: boolean) => void;
  onScinde: (enfants: VaguePrevueListItemDTO[], parentId: string) => void;
}

function lignesParDefaut(parent: VaguePrevueListItemDTO): LigneScission[] {
  const moitie = Math.floor(parent.effectifAlevinsPrevu / 2);
  const reste = parent.effectifAlevinsPrevu - moitie;
  const date = parent.dateStockagePrevue.slice(0, 10);
  const poids = String(parent.poidsMoyenInitialG);
  return [
    { code: `${parent.code}a`, dateStockagePrevue: date, effectifAlevinsPrevu: String(moitie), poidsMoyenInitialG: poids },
    { code: `${parent.code}b`, dateStockagePrevue: date, effectifAlevinsPrevu: String(reste), poidsMoyenInitialG: poids },
  ];
}

export function ScissionDialog({ parent, onOpenChange, onScinde }: ScissionDialogProps) {
  const t = useTranslations("previsions");
  const tCommon = useTranslations("common");
  const { post } = usePrevisionsApi();
  const [lignes, setLignes] = useState<LigneScission[]>(() => (parent ? lignesParDefaut(parent) : []));
  const [submitting, setSubmitting] = useState(false);
  const [touched, setTouched] = useState(false);
  const { onInteractOutside, onEscapeKeyDown } = useDialogCloseGuard(touched);

  // Re-initialise les lignes quand une nouvelle VaguePrevue devient la cible.
  const [derniereCibleId, setDerniereCibleId] = useState<string | null>(null);
  if (parent && parent.id !== derniereCibleId) {
    setDerniereCibleId(parent.id);
    setLignes(lignesParDefaut(parent));
    setTouched(false);
  } else if (!parent && derniereCibleId !== null) {
    // Bug B variante (pre-analyse PR2ter.2 section 2) : ce composant n'est
    // jamais demonte (il rend `null` quand `parent` devient null, mais reste
    // monte). Sans ceci, rouvrir la MEME cible apres un Annuler ne
    // reinitialise jamais les lignes (la condition ci-dessus ne se
    // redeclenche que sur un CHANGEMENT de cible) — on efface donc la
    // derniere cible connue a la fermeture pour forcer le recalcul au
    // prochain montage, meme sur la meme VaguePrevue.
    setDerniereCibleId(null);
  }

  if (!parent) return null;

  const totalReparti = lignes.reduce((sum, l) => sum + (Number(l.effectifAlevinsPrevu) || 0), 0);
  const equilibre = totalReparti === parent.effectifAlevinsPrevu;

  function updateLigne(index: number, field: keyof LigneScission, value: string) {
    setLignes((prev) => prev.map((l, i) => (i === index ? { ...l, [field]: value } : l)));
    setTouched(true);
  }

  function addLigne() {
    setLignes((prev) => [
      ...prev,
      { code: "", dateStockagePrevue: parent!.dateStockagePrevue.slice(0, 10), effectifAlevinsPrevu: "", poidsMoyenInitialG: String(parent!.poidsMoyenInitialG) },
    ]);
    setTouched(true);
  }

  function removeLigne(index: number) {
    if (lignes.length <= 2) return;
    setLignes((prev) => prev.filter((_, i) => i !== index));
    setTouched(true);
  }

  const lignesValides = lignes.every(
    (l) => l.code.trim() && l.dateStockagePrevue && Number(l.effectifAlevinsPrevu) > 0
  );

  async function handleSubmit() {
    setSubmitting(true);
    try {
      const result = await post<VaguePrevueListItemDTO[]>(
        `/api/previsions/vagues-prevues/${parent!.id}/scinder`,
        {
          scissions: lignes.map((l) => ({
            code: l.code.trim(),
            dateStockagePrevue: new Date(l.dateStockagePrevue).toISOString(),
            effectifAlevinsPrevu: Number(l.effectifAlevinsPrevu),
            poidsMoyenInitialG: Number(l.poidsMoyenInitialG),
          })),
        }
      );
      if (result.ok && result.data) {
        onScinde(result.data, parent!.id);
        onOpenChange(false);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent onInteractOutside={onInteractOutside} onEscapeKeyDown={onEscapeKeyDown}>
        <DialogHeader>
          <DialogTitle>{t("scissionDialog.dialogTitle", { code: parent.code })}</DialogTitle>
          <DialogDescription>
            {t("scissionDialog.description", { code: parent.code })}
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          <div className="flex flex-col gap-4">
            <div className="rounded-xl border border-border bg-card p-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">{t("scissionDialog.totalLabel")}</p>
                <p className={equilibre ? "text-sm font-semibold text-success" : "text-sm font-semibold text-warning"}>
                  {t("scissionDialog.totalValue", { reparti: totalReparti, total: parent.effectifAlevinsPrevu })}
                </p>
              </div>
              {!equilibre && (
                <p className="text-xs text-muted-foreground mt-1">
                  {t("scissionDialog.imbalanceHint")}
                </p>
              )}
            </div>

            {lignes.map((l, i) => (
              <div key={i} className="rounded-lg border border-border bg-card p-3">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-semibold">{t("scissionDialog.childLabel", { index: i + 1 })}</p>
                  {lignes.length > 2 && (
                    <button
                      type="button"
                      onClick={() => removeLigne(i)}
                      className="flex h-11 w-11 items-center justify-center text-danger"
                      aria-label={t("scissionDialog.removeAria", { index: i + 1 })}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <div className="flex flex-col gap-3">
                  <Input
                    label={t("scissionDialog.fields.code.label")}
                    required
                    value={l.code}
                    onChange={(e) => updateLigne(i, "code", e.target.value)}
                  />
                  <Input
                    label={t("scissionDialog.fields.dateStockagePrevue.label")}
                    type="date"
                    required
                    value={l.dateStockagePrevue}
                    onChange={(e) => updateLigne(i, "dateStockagePrevue", e.target.value)}
                  />
                  <Input
                    label={t("scissionDialog.fields.effectifAlevinsPrevu.label")}
                    type="number"
                    inputMode="numeric"
                    min={1}
                    step={1}
                    required
                    value={l.effectifAlevinsPrevu}
                    onChange={(e) => updateLigne(i, "effectifAlevinsPrevu", e.target.value)}
                  />
                  <Input
                    label={t("scissionDialog.fields.poidsMoyenInitialG.label")}
                    type="number"
                    inputMode="decimal"
                    min={0}
                    value={l.poidsMoyenInitialG}
                    onChange={(e) => updateLigne(i, "poidsMoyenInitialG", e.target.value)}
                  />
                </div>
              </div>
            ))}

            <Button variant="outline" onClick={addLigne}>
              <Plus className="h-4 w-4" />
              {t("scissionDialog.addButton")}
            </Button>
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            {tCommon("buttons.cancel")}
          </Button>
          <Button onClick={handleSubmit} disabled={submitting || !lignesValides}>
            {submitting ? t("scissionDialog.submitting") : t("scissionDialog.submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
