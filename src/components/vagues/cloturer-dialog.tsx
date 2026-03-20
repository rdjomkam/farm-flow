"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FishLoader } from "@/components/ui/fish-loader";
import { StatutVague } from "@/types";
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
  const router = useRouter();
  const { toast } = useToast();
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = controlledOnOpenChange ?? setInternalOpen;
  const [dateFin, setDateFin] = useState(new Date().toISOString().split("T")[0]);
  const [submitting, setSubmitting] = useState(false);

  async function handleCloturer() {
    if (!dateFin) return;
    setSubmitting(true);

    try {
      const res = await fetch(`/api/vagues/${vagueId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ statut: StatutVague.TERMINEE, dateFin }),
      });

      if (!res.ok) {
        const data = await res.json();
        toast({ title: data.message || "Erreur lors de la clôture.", variant: "error" });
        return;
      }

      toast({ title: `Vague ${vagueCode} clôturée.`, variant: "success" });
      setOpen(false);
      router.refresh();
    } catch {
      toast({ title: "Erreur réseau.", variant: "error" });
    } finally {
      setSubmitting(false);
    }
  }

  const isControlled = controlledOpen !== undefined;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!isControlled && (
        <DialogTrigger asChild>
          <Button variant="danger" size="sm">
            Clôturer
          </Button>
        </DialogTrigger>
      )}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Clôturer la vague {vagueCode}</DialogTitle>
          <DialogDescription>
            Cette action est irréversible. Les bacs seront libérés et la vague passera en statut "Terminée".
          </DialogDescription>
        </DialogHeader>
        <Input
          id="dateFin"
          label="Date de fin du cycle"
          type="date"
          value={dateFin}
          onChange={(e) => setDateFin(e.target.value)}
        />
        <DialogFooter>
          <Button variant="secondary" onClick={() => setOpen(false)}>
            Annuler
          </Button>
          <Button variant="danger" onClick={handleCloturer} disabled={submitting}>
            {submitting ? <><FishLoader size="sm" /> Clôture...</> : "Confirmer la clôture"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
