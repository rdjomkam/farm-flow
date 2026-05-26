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
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { useVagueService } from "@/services";

interface ModifierVagueDialogProps {
  vagueId: string;
  dateDebut: string | Date;
  dateFin?: string | Date | null;
  nombreInitial: number;
  poidsMoyenInitial: number;
  origineAlevins: string | null;
  configElevageId: string | null;
  configElevages: { id: string; nom: string }[];
  unitesProduction: { id: string; code: string; nom: string; type: string }[];
  uniteProductionId: string | null;
  poidsObjectifKg: number | null;
  permissions: Permission[];
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function ModifierVagueDialog({
  vagueId,
  dateDebut,
  dateFin,
  nombreInitial,
  poidsMoyenInitial,
  origineAlevins,
  configElevageId,
  configElevages,
  unitesProduction,
  uniteProductionId,
  poidsObjectifKg,
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
  // Format date pour input type="date" : YYYY-MM-DD
  const initialDateStr = new Date(dateDebut).toISOString().slice(0, 10);
  const [dateDebutStr, setDateDebutStr] = useState(initialDateStr);
  const [nombre, setNombre] = useState(String(nombreInitial));
  const [poids, setPoids] = useState(String(poidsMoyenInitial));
  const [origine, setOrigine] = useState(origineAlevins ?? "");
  const [configId, setConfigId] = useState(configElevageId ?? "");
  const [objectif, setObjectif] = useState(poidsObjectifKg != null ? String(poidsObjectifKg) : "");
  const [uniteId, setUniteId] = useState(uniteProductionId ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});

  function resetForm() {
    setDateDebutStr(initialDateStr);
    setNombre(String(nombreInitial));
    setPoids(String(poidsMoyenInitial));
    setOrigine(origineAlevins ?? "");
    setConfigId(configElevageId ?? "");
    setObjectif(poidsObjectifKg != null ? String(poidsObjectifKg) : "");
    setUniteId(uniteProductionId ?? "");
    setErrors({});
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!dateDebutStr || isNaN(Date.parse(dateDebutStr))) {
      errs.dateDebut = t("form.errors.dateDebut");
    } else if (dateFin) {
      // Cross-validation : dateDebut doit etre antérieure à dateFin
      const newDateDebut = new Date(dateDebutStr);
      const dateFinDate = new Date(dateFin);
      if (newDateDebut >= dateFinDate) {
        errs.dateDebut = t("form.errors.dateDebutAvantDateFin");
      }
    }
    if (!nombre || Number(nombre) <= 0 || !Number.isInteger(Number(nombre)))
      errs.nombreInitial = t("form.errors.nombreInitialEdit");
    if (!poids || Number(poids) <= 0)
      errs.poidsMoyenInitial = t("form.errors.poidsMoyenInitialEdit");
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }

    setErrors({});

    // N'envoyer dateDebut que si elle a changé
    const dateDebutChanged = dateDebutStr !== initialDateStr;

    const result = await vagueService.update(vagueId, {
      ...(dateDebutChanged && { dateDebut: new Date(dateDebutStr).toISOString() }),
      nombreInitial: Number(nombre),
      poidsMoyenInitial: Number(poids),
      origineAlevins: origine.trim() || null,
      ...(configId && { configElevageId: configId }),
      uniteProductionId: uniteId || null,
      poidsObjectifKg: objectif ? Number(objectif) : null,
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
            id="dateDebut"
            label={t("form.fields.dateDebut")}
            type="date"
            value={dateDebutStr}
            onChange={(e) => setDateDebutStr(e.target.value)}
            error={errors.dateDebut}
          />
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
          <Input
            id="poidsObjectifKg"
            label={t("form.fields.poidsObjectifKg")}
            type="number"
            min="0"
            step="0.1"
            placeholder={t("form.fields.poidsObjectifKgPlaceholder")}
            value={objectif}
            onChange={(e) => setObjectif(e.target.value)}
          />
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">{t("form.fields.configElevage")}</label>
            <Select value={configId} onValueChange={setConfigId}>
              <SelectTrigger>
                <SelectValue placeholder={t("form.fields.configElevagePlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                {configElevages.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.nom}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {unitesProduction.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">{t("form.fields.uniteProduction")}</label>
              <Select value={uniteId || "__aucune"} onValueChange={(v) => setUniteId(v === "__aucune" ? "" : v)}>
                <SelectTrigger>
                  <SelectValue placeholder={t("form.fields.uniteProductionPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__aucune">{t("form.fields.uniteProductionPlaceholder")}</SelectItem>
                  {unitesProduction.map((u) => (
                    <SelectItem key={u.id} value={u.id}>{u.nom} ({u.code})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
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
