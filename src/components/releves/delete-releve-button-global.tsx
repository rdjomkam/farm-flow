"use client";

import { memo, useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
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

/**
 * Bouton de suppression de releve pour la page globale /releves.
 * Identique a DeleteReleveButton mais sans react-query (router.refresh() seul).
 */
export const DeleteReleveButtonGlobal = memo(function DeleteReleveButtonGlobal({
  releveId,
}: {
  releveId: string;
}) {
  const t = useTranslations("releves");
  const router = useRouter();
  const { toast } = useToast();
  const releveService = useReleveService();
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

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
