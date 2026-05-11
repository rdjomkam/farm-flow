"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
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
            Supprimer la vague {vagueCode}
          </DialogTitle>
          <DialogDescription>
            Cette action est irréversible. Tous les relevés,
            calibrages, ventes, factures, paiements, mouvements de stock et
            activités associés à cette vague seront définitivement supprimés.
            Les bacs assignés seront libérés (non supprimés).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            Pour confirmer, tapez le code de la vague&nbsp;:&nbsp;
            <strong className="text-foreground">{vagueCode}</strong>
          </p>
          <Input
            id="confirmation"
            label="Code de la vague"
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
            Annuler
          </Button>
          <Button
            variant="danger"
            onClick={handleSupprimer}
            disabled={!isConfirmed || loading}
          >
            {loading ? "Suppression..." : "Supprimer définitivement"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
