"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { NoteForm } from "@/components/notes/note-form";

interface NouvelleNoteDialogProps {
  siteId: string;
  clientSiteId: string;
  vagues?: { id: string; code: string }[];
}

export function NouvelleNoteDialog({
  siteId,
  clientSiteId,
  vagues,
}: NouvelleNoteDialogProps) {
  const t = useTranslations("notes.nouvelleNote");
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="h-4 w-4" />
          {t("button")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>
            {t("description")}
          </DialogDescription>
        </DialogHeader>
        <NoteForm
          siteId={siteId}
          clientSiteId={clientSiteId}
          vagues={vagues}
          onSuccess={() => {
            setOpen(false);
            queryClient.invalidateQueries({ queryKey: queryKeys.notes.all });
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
