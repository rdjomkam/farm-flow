"use client";

import { useState } from "react";
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
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="h-4 w-4" />
          Nouvelle note
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nouvelle note</DialogTitle>
          <DialogDescription>
            Redigez une note pour ce client. Les notes publiques seront visibles par le pisciculteur.
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
