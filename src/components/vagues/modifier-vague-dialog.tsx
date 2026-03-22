"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Pencil } from "lucide-react";
import { queryKeys } from "@/lib/query-keys";
import { useTranslations } from "next-intl";
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
import { Permission } from "@/types";
import { useVagueService } from "@/services";

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
  const queryClient = useQueryClient();
  const vagueService = useVagueService();
  const t = useTranslations("vagues");
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = controlledOnOpenChange ?? setInternalOpen;
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
      errs.nombreInitial = t("form.errors.nombreInitialEdit");
    if (!poids || Number(poids) <= 0)
      errs.poidsMoyenInitial = t("form.errors.poidsMoyenInitialEdit");
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }

    setErrors({});

    const result = await vagueService.update(vagueId, {
      nombreInitial: Number(nombre),
      poidsMoyenInitial: Number(poids),
      origineAlevins: origine.trim() || null,
    });

    if (result.ok) {
      setOpen(false);
      queryClient.invalidateQueries({ queryKey: queryKeys.vagues.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all });
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
            {t("form.edit.trigger")}
          </Button>
        </DialogTrigger>
      )}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("form.edit.title")}</DialogTitle>
          <DialogDescription>
            {t("form.edit.description")}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input
            id="nombreInitial"
            label={t("form.fields.nombreInitial")}
            type="number"
            min="1"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            error={errors.nombreInitial}
          />
          <Input
            id="poidsMoyenInitial"
            label={t("form.fields.poidsMoyenInitial")}
            type="number"
            min="0.1"
            step="0.1"
            value={poids}
            onChange={(e) => setPoids(e.target.value)}
            error={errors.poidsMoyenInitial}
          />
          <Input
            id="origineAlevins"
            label={t("form.fields.origineAlevins")}
            placeholder={t("form.fields.origineAlevinsFr")}
            value={origine}
            onChange={(e) => setOrigine(e.target.value)}
          />
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              {t("form.cancel")}
            </Button>
            <Button type="submit">
              {t("form.edit.submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
