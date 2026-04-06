"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { queryKeys } from "@/lib/query-keys";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { ObservationForm } from "@/components/observations/observation-form";

interface ObservationDialogProps {
  vagues: { id: string; code: string }[];
}

export function ObservationDialog({ vagues }: ObservationDialogProps) {
  const queryClient = useQueryClient();
  const t = useTranslations("notes.observationDialog");
  const [open, setOpen] = useState(false);

  function handleSuccess() {
    setOpen(false);
    queryClient.invalidateQueries({ queryKey: queryKeys.notes.all });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="w-full h-12 text-base flex items-center gap-2">
          <AlertTriangle className="h-4 w-4" aria-hidden="true" />
          {t("trigger")}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogTitle>{t("title")}</DialogTitle>
        <ObservationForm vagues={vagues} onSuccess={handleSuccess} />
      </DialogContent>
    </Dialog>
  );
}
