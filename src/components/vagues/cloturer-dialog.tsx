"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { queryKeys } from "@/lib/query-keys";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useVagueService } from "@/services";

interface CloturerDialogProps {
  vagueId: string;
  vagueCode: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function CloturerDialog({
  vagueId,
  vagueCode,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: CloturerDialogProps) {
  const queryClient = useQueryClient();
  const vagueService = useVagueService();
  const t = useTranslations("vagues");
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = controlledOnOpenChange ?? setInternalOpen;
  const [dateFin, setDateFin] = useState(new Date().toISOString().split("T")[0]);

  async function handleCloturer() {
    if (!dateFin) return;

    const result = await vagueService.cloture(vagueId, { dateFin });

    if (result.ok) {
      setOpen(false);
      queryClient.invalidateQueries({ queryKey: queryKeys.vagues.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.bacs.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all });
    }
  }

  const isControlled = controlledOpen !== undefined;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!isControlled && (
        <DialogTrigger asChild>
          <Button variant="danger" size="sm">
            {t("form.close.trigger")}
          </Button>
        </DialogTrigger>
      )}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("form.close.title", { code: vagueCode })}</DialogTitle>
          <DialogDescription>
            {t("form.close.description")}
          </DialogDescription>
        </DialogHeader>
        <Input
          id="dateFin"
          label={t("form.close.dateLabel")}
          type="date"
          value={dateFin}
          onChange={(e) => setDateFin(e.target.value)}
        />
        <DialogFooter>
          <Button variant="secondary" onClick={() => setOpen(false)}>
            {t("form.cancel")}
          </Button>
          <Button variant="danger" onClick={handleCloturer}>
            {t("form.close.submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
