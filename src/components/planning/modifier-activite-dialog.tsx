"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { queryKeys } from "@/lib/query-keys";
import { Pencil, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogFooter,
} from "@/components/ui/dialog";
import { useActiviteService } from "@/services";
import { TypeActivite, Recurrence, StatutActivite, Permission } from "@/types";
import type { ActiviteWithRelations } from "@/types";
import { typeActiviteLabels } from "@/lib/labels/activite";

const recurrenceValues = [
  { value: "__none__" },
  { value: Recurrence.QUOTIDIEN },
  { value: Recurrence.HEBDOMADAIRE },
  { value: Recurrence.BIMENSUEL },
  { value: Recurrence.MENSUEL },
  { value: Recurrence.PERSONNALISE },
];

const typeActiviteValues: TypeActivite[] = [
  TypeActivite.ALIMENTATION,
  TypeActivite.BIOMETRIE,
  TypeActivite.QUALITE_EAU,
  TypeActivite.COMPTAGE,
  TypeActivite.NETTOYAGE,
  TypeActivite.TRAITEMENT,
  TypeActivite.RECOLTE,
  TypeActivite.AUTRE,
];

interface ModifierActiviteDialogProps {
  activite: ActiviteWithRelations;
  permissions: Permission[];
  vagues: { id: string; code: string }[];
  bacs: { id: string; nom: string }[];
  members: { userId: string; userName: string }[];
}

export function ModifierActiviteDialog({
  activite,
  permissions,
  vagues,
  bacs,
  members,
}: ModifierActiviteDialogProps) {
  const t = useTranslations("planning");
  const recurrenceLabels: Record<string, string> = {
    [Recurrence.QUOTIDIEN]: t("recurrences.QUOTIDIEN"),
    [Recurrence.HEBDOMADAIRE]: t("recurrences.HEBDOMADAIRE"),
    [Recurrence.BIMENSUEL]: t("recurrences.BIMENSUEL"),
    [Recurrence.MENSUEL]: t("recurrences.MENSUEL"),
    [Recurrence.PERSONNALISE]: t("recurrences.PERSONNALISE"),
  };
  const queryClient = useQueryClient();
  const activiteService = useActiviteService();
  const [open, setOpen] = useState(false);

  const isLocked =
    activite.statut === StatutActivite.TERMINEE ||
    activite.statut === StatutActivite.ANNULEE;

  // Form state
  const formatDateLocal = (d: Date | string) => {
    const dt = new Date(d);
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}T${String(dt.getHours()).padStart(2, "0")}:${String(dt.getMinutes()).padStart(2, "0")}`;
  };

  const [titre, setTitre] = useState(activite.titre);
  const [description, setDescription] = useState(activite.description ?? "");
  const [noteCompletion, setNoteCompletion] = useState(activite.noteCompletion ?? "");
  const [typeAct, setTypeAct] = useState(activite.typeActivite);
  const [dateDebut, setDateDebut] = useState(formatDateLocal(activite.dateDebut));
  const [dateFin, setDateFin] = useState(activite.dateFin ? formatDateLocal(activite.dateFin) : "");
  const [recurrence, setRecurrence] = useState(activite.recurrence ?? "__none__");
  const [vagueId, setVagueId] = useState(activite.vagueId ?? "__none__");
  const [bacId, setBacId] = useState(activite.bacId ?? "__none__");
  const [assigneAId, setAssigneAId] = useState(activite.assigneAId ?? "__none__");

  function resetForm() {
    setTitre(activite.titre);
    setDescription(activite.description ?? "");
    setNoteCompletion(activite.noteCompletion ?? "");
    setTypeAct(activite.typeActivite);
    setDateDebut(formatDateLocal(activite.dateDebut));
    setDateFin(activite.dateFin ? formatDateLocal(activite.dateFin) : "");
    setRecurrence(activite.recurrence ?? "__none__");
    setVagueId(activite.vagueId ?? "__none__");
    setBacId(activite.bacId ?? "__none__");
    setAssigneAId(activite.assigneAId ?? "__none__");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const body: Record<string, unknown> = {};

    if (isLocked) {
      // Only description and noteCompletion editable
      if (description !== (activite.description ?? "")) {
        body.description = description.trim() || null;
      }
      if (noteCompletion !== (activite.noteCompletion ?? "")) {
        body.noteCompletion = noteCompletion.trim() || null;
      }
    } else {
      body.titre = titre.trim();
      body.description = description.trim() || null;
      body.typeActivite = typeAct;
      body.dateDebut = new Date(dateDebut).toISOString();
      body.dateFin = dateFin ? new Date(dateFin).toISOString() : null;
      body.recurrence = recurrence !== "__none__" ? recurrence : null;
      body.vagueId = vagueId !== "__none__" ? vagueId : null;
      body.bacId = bacId !== "__none__" ? bacId : null;
      body.assigneAId = assigneAId !== "__none__" ? assigneAId : null;
    }

    const result = await activiteService.update(activite.id, body);
    if (result.ok) {
      setOpen(false);
      queryClient.invalidateQueries({ queryKey: queryKeys.planning.activites() });
    }
  }

  if (!permissions.includes(Permission.PLANNING_GERER)) return null;

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) resetForm(); }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Pencil className="h-3.5 w-3.5" />
          {t("modifierActivite.trigger")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {t("modifierActivite.title")}
            {isLocked && <Lock className="h-4 w-4 text-muted-foreground" />}
          </DialogTitle>
          <DialogDescription>
            {isLocked
              ? t("modifierActivite.termineeOuAnnulee")
              : t("modifierActivite.description")}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col min-h-0">
          <DialogBody className="flex flex-col gap-4">
          {/* Titre */}
          <Input
            label={t("modifierActivite.labelTitre")}
            value={titre}
            onChange={(e) => setTitre(e.target.value)}
            disabled={isLocked}
          />

          {/* Type */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-foreground">{t("editDialog.type")}</label>
            <Select value={typeAct} onValueChange={(v) => setTypeAct(v as TypeActivite)} disabled={isLocked}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {typeActiviteValues.map((value) => (
                  <SelectItem key={value} value={value}>
                    {typeActiviteLabels[value]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Date debut */}
          <Input
            type="datetime-local"
            label={t("editDialog.dateDebut")}
            value={dateDebut}
            onChange={(e) => setDateDebut(e.target.value)}
            disabled={isLocked}
          />

          {/* Date fin */}
          <Input
            type="datetime-local"
            label={t("editDialog.dateFin")}
            value={dateFin}
            onChange={(e) => setDateFin(e.target.value)}
            disabled={isLocked}
          />

          {/* Recurrence */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-foreground">{t("editDialog.recurrence")}</label>
            <Select value={recurrence} onValueChange={setRecurrence} disabled={isLocked}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {recurrenceValues.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.value === "__none__"
                      ? t("options.noneOneTime")
                      : recurrenceLabels[opt.value]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Vague */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-foreground">{t("editDialog.batch")}</label>
            <Select value={vagueId} onValueChange={setVagueId} disabled={isLocked}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">{t("nouvelleActivite.vagueAucune")}</SelectItem>
                {vagues.map((v) => (
                  <SelectItem key={v.id} value={v.id}>{v.code}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Bac */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-foreground">{t("editDialog.tank")}</label>
            <Select value={bacId} onValueChange={setBacId} disabled={isLocked}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">{t("nouvelleActivite.bacAucun")}</SelectItem>
                {bacs.map((b) => (
                  <SelectItem key={b.id} value={b.id}>{b.nom}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Assignee */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-foreground">{t("editDialog.assignTo")}</label>
            <Select value={assigneAId} onValueChange={setAssigneAId} disabled={isLocked}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">{t("nouvelleActivite.assigneAucun")}</SelectItem>
                {members.map((m) => (
                  <SelectItem key={m.userId} value={m.userId}>{m.userName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Description */}
          <Textarea
            label={t("modifierActivite.labelDescription")}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
          />

          {/* Note de completion (visible si locked) */}
          {isLocked && (
            <Textarea
              label={t("modifierActivite.noteCompletion")}
              value={noteCompletion}
              onChange={(e) => setNoteCompletion(e.target.value)}
              rows={3}
            />
          )}

          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              {t("modifierActivite.annuler")}
            </Button>
            <Button type="submit">
              {t("modifierActivite.enregistrer")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
