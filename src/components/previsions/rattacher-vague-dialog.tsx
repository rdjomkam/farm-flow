"use client";

/**
 * src/components/previsions/rattacher-vague-dialog.tsx
 *
 * Dialog de rattachement d'une vague reelle a une VaguePrevue (ADR-053
 * decision 2). Intercepte specifiquement `code === "VAGUE_PREVUE_DEJA_RATTACHEE"`
 * (409) — patron `gerer-ressources-client.tsx` (fetch brut + lecture de
 * `data.code`, PAS `useApi`/service : la reponse d'erreur porte un corps
 * enrichi que `useApi` ne route pas vers l'appelant en cas d'echec) — et
 * declenche IMMEDIATEMENT le flux de scission (exigence ADR-053, pas une
 * option) plutot que de se contenter d'un toast d'echec.
 */
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
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
import { Link2 } from "lucide-react";
import { useDialogCloseGuard } from "@/hooks/use-dialog-close-guard";
import { estErreurVaguePrevueDejaRattachee } from "@/components/previsions/api-types";
import type { VaguePrevueListItemDTO, VagueCandidateDTO } from "@/components/previsions/api-types";

interface RattacherVagueDialogProps {
  vaguePrevue: VaguePrevueListItemDTO;
  vaguesCandidates: VagueCandidateDTO[];
  onRattachee: (vaguePrevueId: string) => void;
  onDejaRattachee: (vaguePrevueId: string) => void;
}

export function RattacherVagueDialog({
  vaguePrevue,
  vaguesCandidates,
  onRattachee,
  onDejaRattachee,
}: RattacherVagueDialogProps) {
  const t = useTranslations("previsions");
  const tCommon = useTranslations("common");
  const [open, setOpen] = useState(false);
  const [vagueId, setVagueId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Seul champ = un Select (pas de saisie libre) — "touche" des que
  // l'utilisateur a choisi une vague candidate (pre-analyse PR2ter.2 §2,
  // impact faible mais meme correction que les autres dialogues).
  const { onInteractOutside, onEscapeKeyDown } = useDialogCloseGuard(vagueId !== "");

  const candidatesLibres = vaguesCandidates.filter((v) => v.vaguePrevueId === null);

  function resetForm() {
    setVagueId("");
    setError(null);
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) resetForm();
  }

  async function handleSubmit() {
    if (!vagueId) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/previsions/vagues-prevues/${vaguePrevue.id}/rattacher`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vagueId }),
      });
      const data = await res.json().catch(() => null);

      if (!res.ok) {
        if (estErreurVaguePrevueDejaRattachee(data)) {
          handleOpenChange(false);
          onDejaRattachee(data.vaguePrevueId);
          return;
        }
        setError(data?.message ?? t("rattacherVagueDialog.errors.generic"));
        return;
      }

      onRattachee(vaguePrevue.id);
      handleOpenChange(false);
    } catch {
      setError(t("rattacherVagueDialog.errors.network"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Link2 className="h-4 w-4" />
          {t("rattacherVagueDialog.triggerButton")}
        </Button>
      </DialogTrigger>
      <DialogContent onInteractOutside={onInteractOutside} onEscapeKeyDown={onEscapeKeyDown}>
        <DialogHeader>
          <DialogTitle>{t("rattacherVagueDialog.dialogTitle", { code: vaguePrevue.code })}</DialogTitle>
          <DialogDescription>
            {t("rattacherVagueDialog.description")}
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          <div className="flex flex-col gap-3">
            <Select value={vagueId} onValueChange={setVagueId}>
              <SelectTrigger label={t("rattacherVagueDialog.selectLabel")}>
                <SelectValue placeholder={t("rattacherVagueDialog.selectPlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                {candidatesLibres.length === 0 ? (
                  <div className="px-3 py-2 text-sm text-muted-foreground">
                    {t("rattacherVagueDialog.noneAvailable")}
                  </div>
                ) : (
                  candidatesLibres.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.code} ({v.statut})
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            {error && <p className="text-sm text-danger">{error}</p>}
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={submitting}>
            {tCommon("buttons.cancel")}
          </Button>
          <Button onClick={handleSubmit} disabled={submitting || !vagueId}>
            {submitting ? t("rattacherVagueDialog.submitting") : t("rattacherVagueDialog.submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
