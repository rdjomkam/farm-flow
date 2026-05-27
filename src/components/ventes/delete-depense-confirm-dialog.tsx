"use client";

/**
 * DeleteDepenseConfirmDialog — Confirmation avant suppression d'une dépense de vente.
 *
 * Submit → DELETE /api/depenses/[depenseId]
 * Invalide la query React Query du détail vente après succès + reload page.
 *
 * Règles :
 * - R5 : DialogTrigger asChild
 * - R6 : variant destructive via Tailwind
 * - Mobile first : bouton icône h-8 w-8
 */

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { queryKeys } from "@/lib/query-keys";

interface DeleteDepenseConfirmDialogProps {
  depenseId: string;
  venteId: string;
  description: string;
}

export function DeleteDepenseConfirmDialog({
  depenseId,
  venteId,
  description,
}: DeleteDepenseConfirmDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const queryClient = useQueryClient();
  const t = useTranslations("ventes.depenses");
  const { toast } = useToast();

  async function handleDelete() {
    setLoading(true);
    try {
      const res = await fetch(`/api/depenses/${depenseId}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast({
          title: err.error ?? t("delete.error"),
          variant: "error",
        });
        return;
      }
      toast({
        title: t("delete.success"),
        variant: "success",
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.ventes.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.ventes.detail(venteId) });
      setOpen(false);
      // Reload page data (server component)
      window.location.reload();
    } catch {
      toast({
        title: t("delete.error"),
        variant: "error",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0 text-destructive hover:text-destructive"
          aria-label={t("deleteAria")}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("delete.title")}</DialogTitle>
          <DialogDescription>
            {t("delete.confirm", { description })}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={loading}
          >
            {t("delete.cancel")}
          </Button>
          <Button
            variant="danger"
            onClick={handleDelete}
            disabled={loading}
          >
            {loading ? t("delete.loading") : t("delete.submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
