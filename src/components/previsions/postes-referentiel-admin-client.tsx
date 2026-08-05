"use client";

/**
 * src/components/previsions/postes-referentiel-admin-client.tsx
 *
 * Ecran d'administration du referentiel des postes de charges (ADR-053
 * §16.12, story A.5). Liste TOUTES les entrees du site (actives ET
 * inactives), renommer/desactiver/reactiver — aucune route DELETE (§16.5).
 *
 * Mobile-first (360px d'abord) : cartes empilees, pas de tableau (regle
 * projet). R5 : `DialogTrigger asChild`. R6 : classes du design system.
 */
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Pencil, Ban, RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
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
import type { PosteReferentielDTO } from "@/components/previsions/api-types";

interface PostesReferentielAdminClientProps {
  initialEntries: PosteReferentielDTO[];
}

function RenameDialog({
  entry,
  onRenamed,
}: {
  entry: PosteReferentielDTO;
  onRenamed: (entry: PosteReferentielDTO) => void;
}) {
  const t = useTranslations("previsions");
  const tCommon = useTranslations("common");
  const { patch } = usePrevisionsApi();
  const [open, setOpen] = useState(false);
  const [libelle, setLibelle] = useState(entry.libelle);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [touched, setTouched] = useState(false);
  const { onInteractOutside, onEscapeKeyDown } = useDialogCloseGuard(touched);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      setLibelle(entry.libelle);
      setError(null);
      setTouched(false);
    }
  }

  async function handleSubmit() {
    if (!libelle.trim()) {
      setError(t("posteReferentielAdmin.errors.libelleRequired"));
      return;
    }
    setSubmitting(true);
    try {
      const result = await patch<PosteReferentielDTO>(`/api/previsions/postes-referentiel/${entry.id}`, {
        libelle: libelle.trim(),
      });
      if (result.ok && result.data) {
        onRenamed(result.data);
        handleOpenChange(false);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Pencil className="h-4 w-4" aria-hidden="true" />
          {t("posteReferentielAdmin.actions.renommer")}
        </Button>
      </DialogTrigger>
      <DialogContent onInteractOutside={onInteractOutside} onEscapeKeyDown={onEscapeKeyDown}>
        <DialogHeader>
          <DialogTitle>{t("posteReferentielAdmin.renameDialog.title")}</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <Input
            label={t("posteReferentielAdmin.renameDialog.fields.libelle.label")}
            required
            value={libelle}
            onChange={(e) => {
              setLibelle(e.target.value);
              setTouched(true);
              setError(null);
            }}
            error={error ?? undefined}
          />
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={submitting}>
            {tCommon("buttons.cancel")}
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting
              ? t("posteReferentielAdmin.renameDialog.submitting")
              : t("posteReferentielAdmin.renameDialog.submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function StatutToggleDialog({
  entry,
  onToggled,
}: {
  entry: PosteReferentielDTO;
  onToggled: (entry: PosteReferentielDTO) => void;
}) {
  const t = useTranslations("previsions");
  const tCommon = useTranslations("common");
  const { post } = usePrevisionsApi();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const action = entry.actif ? "desactiver" : "reactiver";
  const dialogTexts = entry.actif
    ? {
        title: t("posteReferentielAdmin.desactiverDialog.confirmTitle"),
        description: t("posteReferentielAdmin.desactiverDialog.confirmDescription"),
        button: t("posteReferentielAdmin.desactiverDialog.confirmButton"),
      }
    : {
        title: t("posteReferentielAdmin.reactiverDialog.confirmTitle"),
        description: t("posteReferentielAdmin.reactiverDialog.confirmDescription"),
        button: t("posteReferentielAdmin.reactiverDialog.confirmButton"),
      };

  async function handleConfirm() {
    setSubmitting(true);
    try {
      const result = await post<PosteReferentielDTO>(
        `/api/previsions/postes-referentiel/${entry.id}/${action}`,
        {}
      );
      if (result.ok && result.data) {
        onToggled(result.data);
        setOpen(false);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          {entry.actif ? (
            <Ban className="h-4 w-4" aria-hidden="true" />
          ) : (
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
          )}
          {entry.actif
            ? t("posteReferentielAdmin.actions.desactiver")
            : t("posteReferentielAdmin.actions.reactiver")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{dialogTexts.title}</DialogTitle>
          <DialogDescription>{dialogTexts.description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={submitting}>
            {tCommon("buttons.cancel")}
          </Button>
          <Button
            variant={entry.actif ? "danger" : "primary"}
            onClick={handleConfirm}
            disabled={submitting}
          >
            {dialogTexts.button}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function PostesReferentielAdminClient({ initialEntries }: PostesReferentielAdminClientProps) {
  const t = useTranslations("previsions");
  const [entries, setEntries] = useState(initialEntries);

  function handleUpdated(updated: PosteReferentielDTO) {
    setEntries((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
  }

  if (entries.length === 0) {
    return (
      <EmptyState
        icon={<Pencil className="h-8 w-8" />}
        title={t("posteReferentielAdmin.empty")}
        description={t("posteReferentielAdmin.pageDescription")}
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {entries.map((entry) => (
        <div key={entry.id} className="rounded-xl border border-border bg-card p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-semibold text-foreground">{entry.libelle}</span>
              <span className="text-xs text-muted-foreground">
                {t("posteReferentielAdmin.columns.code")} : {entry.code}
              </span>
            </div>
            <Badge variant={entry.actif ? "success" : "default"}>
              {entry.actif ? t("posteReferentielAdmin.badges.actif") : t("posteReferentielAdmin.badges.inactif")}
            </Badge>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <RenameDialog entry={entry} onRenamed={handleUpdated} />
            <StatutToggleDialog entry={entry} onToggled={handleUpdated} />
          </div>
        </div>
      ))}
    </div>
  );
}
