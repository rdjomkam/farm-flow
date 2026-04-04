"use client";

/**
 * ExonerationFormDialog — formulaire de création d'une exonération (backoffice).
 *
 * Ouvre un Dialog Radix avec un formulaire pour accorder un accès gratuit à un
 * utilisateur (userId + siteId + motif + dateFin optionnelle).
 *
 * NOTE TEMPORAIRE (Sprint 51) :
 * Le champ siteId est requis car Abonnement.siteId est encore NOT NULL dans le
 * schéma Prisma. Au Sprint 52 (Story 52.1), ce champ sera rendu nullable pour
 * les abonnements user-level (dont EXONERATION). Ce formulaire sera mis à jour
 * à ce moment pour supprimer le champ siteId du formulaire.
 *
 * R5 : DialogTrigger asChild
 * R6 : CSS variables du thème (pas de couleurs Tailwind directes)
 * R2 : enums importés depuis @/types (non nécessaire ici — validation côté API)
 *
 * Story 51.2 — Sprint 51
 */

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

interface ExonerationFormDialogProps {
  trigger: React.ReactNode;
  onSuccess?: () => void;
}

export function ExonerationFormDialog({ trigger, onSuccess }: ExonerationFormDialogProps) {
  const t = useTranslations("backoffice.exonerations.form");
  const { toast } = useToast();

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState("");
  const [siteId, setSiteId] = useState("");
  const [motif, setMotif] = useState("");
  const [dateFin, setDateFin] = useState("");

  function resetForm() {
    setUserId("");
    setSiteId("");
    setMotif("");
    setDateFin("");
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) resetForm();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;

    setLoading(true);
    try {
      const body: Record<string, unknown> = {
        userId: userId.trim(),
        siteId: siteId.trim(),
        motif: motif.trim(),
      };
      if (dateFin.trim()) {
        body.dateFin = dateFin.trim();
      }

      const res = await fetch("/api/backoffice/exonerations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const msg =
          data?.errors?.[0]?.message ??
          data?.message ??
          t("errorDefault");
        throw new Error(msg);
      }

      toast({ title: t("successTitle"), description: t("successDesc") });
      setOpen(false);
      onSuccess?.();
    } catch (err) {
      toast({
        title: t("errorTitle"),
        description: err instanceof Error ? err.message : t("errorDefault"),
        variant: "error",
      });
    } finally {
      setLoading(false);
    }
  }

  const canSubmit =
    userId.trim().length > 0 &&
    siteId.trim().length > 0 &&
    motif.trim().length > 0 &&
    !loading;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {/* R5 — DialogTrigger asChild */}
      <DialogTrigger asChild>{trigger}</DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* userId */}
          <div className="space-y-1.5">
            <label
              htmlFor="exo-userId"
              className="text-sm font-medium text-foreground"
            >
              {t("userIdLabel")} <span className="text-danger">*</span>
            </label>
            <input
              id="exo-userId"
              type="text"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              placeholder={t("userIdPlaceholder")}
              required
              className="w-full rounded-lg border border-border bg-input px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          {/* siteId — temporaire jusqu'au Sprint 52 */}
          <div className="space-y-1.5">
            <label
              htmlFor="exo-siteId"
              className="text-sm font-medium text-foreground"
            >
              {t("siteIdLabel")} <span className="text-danger">*</span>
            </label>
            <input
              id="exo-siteId"
              type="text"
              value={siteId}
              onChange={(e) => setSiteId(e.target.value)}
              placeholder={t("siteIdPlaceholder")}
              required
              className="w-full rounded-lg border border-border bg-input px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <p className="text-xs text-muted-foreground">
              Requis temporairement (Sprint 51). Sera supprime au Sprint 52.
            </p>
          </div>

          {/* motif */}
          <div className="space-y-1.5">
            <label
              htmlFor="exo-motif"
              className="text-sm font-medium text-foreground"
            >
              {t("motifLabel")} <span className="text-danger">*</span>
            </label>
            <textarea
              id="exo-motif"
              value={motif}
              onChange={(e) => setMotif(e.target.value)}
              placeholder={t("motifPlaceholder")}
              rows={3}
              required
              className="w-full rounded-lg border border-border bg-input px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
            />
          </div>

          {/* dateFin (optionnel) */}
          <div className="space-y-1.5">
            <label
              htmlFor="exo-dateFin"
              className="text-sm font-medium text-foreground"
            >
              {t("dateFinLabel")}
            </label>
            <input
              id="exo-dateFin"
              type="date"
              value={dateFin}
              onChange={(e) => setDateFin(e.target.value)}
              min={new Date().toISOString().split("T")[0]}
              className="w-full rounded-lg border border-border bg-input px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={loading}
            >
              {t("cancel")}
            </Button>
            <Button type="submit" disabled={!canSubmit}>
              {loading ? t("submitting") : t("submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
