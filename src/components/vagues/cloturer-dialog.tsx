"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
  const router = useRouter();
  const vagueService = useVagueService();
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = controlledOnOpenChange ?? setInternalOpen;
  const [dateFin, setDateFin] = useState(new Date().toISOString().split("T")[0]);

  async function handleCloturer() {
    if (!dateFin) return;

    const result = await vagueService.cloture(vagueId, { dateFin });

    if (result.ok) {
      setOpen(false);
      router.refresh();
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
          <Button variant="danger" onClick={handleCloturer}>
            Confirmer la clôture
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
