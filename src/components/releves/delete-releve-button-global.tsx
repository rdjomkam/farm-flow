"use client";

import { memo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Link2, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { useReleveService } from "@/services";
import { TypeReleve } from "@/types";

interface DeleteReleveButtonGlobalProps {
  releveId: string;
  typeReleve: TypeReleve;
  vagueId?: string;
  transfertGroupeId?: string | null;
  arrivageId?: string | null;
  venteId?: string | null;
  calibrageId?: string | null;
}

/**
 * Bouton de suppression de releve pour la page globale /releves.
 * Identique a DeleteReleveButton mais sans react-query (router.refresh() seul).
 * Si le releve est lie a une operation parente, affiche un lien vers cette operation
 * plutot que le bouton supprimer.
 */
export const DeleteReleveButtonGlobal = memo(function DeleteReleveButtonGlobal({
  releveId,
  typeReleve,
  vagueId,
  transfertGroupeId,
  arrivageId,
  venteId,
  calibrageId,
}: DeleteReleveButtonGlobalProps) {
  const t = useTranslations("releves");
  const router = useRouter();
  const { toast } = useToast();
  const releveService = useReleveService();
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Determine parent link if this releve is locked
  const parentLink = (() => {
    if (transfertGroupeId && vagueId) return `/vagues/${vagueId}/transfert`;
    if (arrivageId && vagueId) return `/vagues/${vagueId}/arrivage`;
    if (venteId) return `/ventes/${venteId}`;
    if (calibrageId && vagueId) return `/vagues/${vagueId}/calibrages`;
    return null;
  })();

  const parentTypeLabel = (() => {
    if (transfertGroupeId) return t("linkedTo.transfert");
    if (arrivageId) return t("linkedTo.arrivage");
    if (venteId) return t("linkedTo.vente");
    if (calibrageId) return t("linkedTo.calibrage");
    return null;
  })();

  const isProtectedType = [
    TypeReleve.TRANSFERT,
    TypeReleve.ARRIVAGE,
    TypeReleve.VENTE,
  ].includes(typeReleve);

  const isLocked =
    (isProtectedType && !!(transfertGroupeId || arrivageId || venteId)) ||
    !!calibrageId;

  if (isLocked && parentTypeLabel) {
    return (
      <Link
        href={parentLink ?? "#"}
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
        title={parentTypeLabel}
      >
        <Link2 className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">{parentTypeLabel}</span>
      </Link>
    );
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await releveService.remove(releveId);
      toast({ title: t("list.deleteSuccess"), variant: "success" });
      setOpen(false);
      router.refresh();
    } catch {
      // Toast gere par la couche service
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          aria-label={t("list.deleteTitle")}
          title={t("list.deleteTitle")}
          className="h-7 w-7 px-0 text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("list.deleteTitle")}</DialogTitle>
          <DialogDescription>{t("list.deleteDescription")}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={deleting}>
            {t("list.deleteCancel")}
          </Button>
          <Button variant="danger" onClick={handleDelete} disabled={deleting}>
            {deleting ? t("list.deleting") : t("list.deleteConfirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
});
