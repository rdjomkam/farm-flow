"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { AlertTriangle } from "lucide-react";
import { queryKeys } from "@/lib/query-keys";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useVagueService } from "@/services";

interface SupprimerVagueDialogProps {
  vagueId: string;
  vagueCode: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SupprimerVagueDialog({
  vagueId,
  vagueCode,
  open,
  onOpenChange,
}: SupprimerVagueDialogProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const vagueService = useVagueService();
  const t = useTranslations("vagues.delete");
  const [confirmation, setConfirmation] = useState("");
  const [loading, setLoading] = useState(false);

  const isConfirmed = confirmation === vagueCode;

  async function handleSupprimer() {
    if (!isConfirmed) return;

    setLoading(true);
    const result = await vagueService.remove(vagueId);
    setLoading(false);

    if (result.ok) {
      onOpenChange(false);
      setConfirmation("");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.vagues.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.bacs.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all }),
      ]);
      router.push("/vagues");
    }
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      setConfirmation("");
    }
    onOpenChange(nextOpen);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5 shrink-0" />
            {t("title", { code: vagueCode })}
          </DialogTitle>
          <DialogDescription>
            {t("description")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            {t("confirmPrompt")}&nbsp;
            <strong className="text-foreground">{vagueCode}</strong>
          </p>
          <Input
            id="confirmation"
            label={t("inputLabel")}
            placeholder={vagueCode}
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)}
            autoComplete="off"
            autoFocus
          />
        </div>

        <DialogFooter>
          <Button
            variant="secondary"
            onClick={() => handleOpenChange(false)}
            disabled={loading}
          >
            {t("cancel")}
          </Button>
          <Button
            variant="danger"
            onClick={handleSupprimer}
            disabled={!isConfirmed || loading}
          >
            {loading ? t("submitting") : t("submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
