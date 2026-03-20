"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FishLoader } from "@/components/ui/fish-loader";
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
import { Permission } from "@/types";

interface ModifierVagueDialogProps {
  vagueId: string;
  nombreInitial: number;
  poidsMoyenInitial: number;
  origineAlevins: string | null;
  permissions: Permission[];
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function ModifierVagueDialog({
  vagueId,
  nombreInitial,
  poidsMoyenInitial,
  origineAlevins,
  permissions,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: ModifierVagueDialogProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = controlledOnOpenChange ?? setInternalOpen;
  const [submitting, setSubmitting] = useState(false);
  const [nombre, setNombre] = useState(String(nombreInitial));
  const [poids, setPoids] = useState(String(poidsMoyenInitial));
  const [origine, setOrigine] = useState(origineAlevins ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});

  function resetForm() {
    setNombre(String(nombreInitial));
    setPoids(String(poidsMoyenInitial));
    setOrigine(origineAlevins ?? "");
    setErrors({});
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!nombre || Number(nombre) <= 0 || !Number.isInteger(Number(nombre)))
      errs.nombreInitial = "Entier superieur a 0.";
    if (!poids || Number(poids) <= 0)
      errs.poidsMoyenInitial = "Superieur a 0.";
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }

    setSubmitting(true);
    setErrors({});

    try {
      const body: Record<string, unknown> = {
        nombreInitial: Number(nombre),
        poidsMoyenInitial: Number(poids),
        origineAlevins: origine.trim() || null,
      };
      const res = await fetch(`/api/vagues/${vagueId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json();
        toast({ title: data.message || "Erreur lors de la modification.", variant: "error" });
        return;
      }
      toast({ title: "Vague modifiee !", variant: "success" });
      setOpen(false);
      router.refresh();
    } catch {
      toast({ title: "Erreur reseau.", variant: "error" });
    } finally {
      setSubmitting(false);
    }
  }

  if (!permissions.includes(Permission.VAGUES_MODIFIER)) return null;

  const isControlled = controlledOpen !== undefined;

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) resetForm(); }}>
      {!isControlled && (
        <DialogTrigger asChild>
          <Button variant="outline" size="sm">
            <Pencil className="h-4 w-4" />
            Modifier
          </Button>
        </DialogTrigger>
      )}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Modifier la vague</DialogTitle>
          <DialogDescription>
            Modifiez les parametres initiaux de la vague.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input
            id="nombreInitial"
            label="Nombre initial d'alevins"
            type="number"
            min="1"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            error={errors.nombreInitial}
          />
          <Input
            id="poidsMoyenInitial"
            label="Poids moyen initial (g)"
            type="number"
            min="0.1"
            step="0.1"
            value={poids}
            onChange={(e) => setPoids(e.target.value)}
            error={errors.poidsMoyenInitial}
          />
          <Input
            id="origineAlevins"
            label="Origine des alevins (optionnel)"
            placeholder="Ex : Ecloserie locale"
            value={origine}
            onChange={(e) => setOrigine(e.target.value)}
          />
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? <><FishLoader size="sm" /> Modification...</> : "Enregistrer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
