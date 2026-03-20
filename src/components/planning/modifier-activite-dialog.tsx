"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Lock } from "lucide-react";
import { FishLoader } from "@/components/ui/fish-loader";
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
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { TypeActivite, Recurrence, StatutActivite, Permission } from "@/types";
import type { ActiviteWithRelations } from "@/types";

const typeActiviteOptions: { value: TypeActivite; label: string }[] = [
  { value: TypeActivite.ALIMENTATION, label: "Alimentation" },
  { value: TypeActivite.BIOMETRIE, label: "Biometrie" },
  { value: TypeActivite.QUALITE_EAU, label: "Qualite eau" },
  { value: TypeActivite.COMPTAGE, label: "Comptage" },
  { value: TypeActivite.NETTOYAGE, label: "Nettoyage" },
  { value: TypeActivite.TRAITEMENT, label: "Traitement" },
  { value: TypeActivite.RECOLTE, label: "Recolte" },
  { value: TypeActivite.AUTRE, label: "Autre" },
];

const recurrenceOptions: { value: string; label: string }[] = [
  { value: "__none__", label: "Aucune (ponctuel)" },
  { value: Recurrence.QUOTIDIEN, label: "Quotidien" },
  { value: Recurrence.HEBDOMADAIRE, label: "Hebdomadaire" },
  { value: Recurrence.BIMENSUEL, label: "Bimensuel" },
  { value: Recurrence.MENSUEL, label: "Mensuel" },
  { value: Recurrence.PERSONNALISE, label: "Personnalise" },
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
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

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
    setSubmitting(true);

    try {
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

      const res = await fetch(`/api/activites/${activite.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        toast({ title: data.message || "Erreur lors de la modification.", variant: "error" });
        return;
      }

      toast({ title: "Activite modifiee", variant: "success" });
      setOpen(false);
      router.refresh();
    } catch {
      toast({ title: "Erreur reseau.", variant: "error" });
    } finally {
      setSubmitting(false);
    }
  }

  if (!permissions.includes(Permission.PLANNING_GERER)) return null;

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) resetForm(); }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Pencil className="h-3.5 w-3.5" />
          Modifier
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Modifier l'activite
            {isLocked && <Lock className="h-4 w-4 text-muted-foreground" />}
          </DialogTitle>
          <DialogDescription>
            {isLocked
              ? "Activite terminee ou annulee — seuls la description et la note sont modifiables."
              : "Modifiez les parametres de l'activite."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Titre */}
          <Input
            label="Titre"
            value={titre}
            onChange={(e) => setTitre(e.target.value)}
            disabled={isLocked}
          />

          {/* Type */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-foreground">Type</label>
            <Select value={typeAct} onValueChange={(v) => setTypeAct(v as TypeActivite)} disabled={isLocked}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {typeActiviteOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Date debut */}
          <Input
            type="datetime-local"
            label="Date de debut"
            value={dateDebut}
            onChange={(e) => setDateDebut(e.target.value)}
            disabled={isLocked}
          />

          {/* Date fin */}
          <Input
            type="datetime-local"
            label="Date de fin"
            value={dateFin}
            onChange={(e) => setDateFin(e.target.value)}
            disabled={isLocked}
          />

          {/* Recurrence */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-foreground">Recurrence</label>
            <Select value={recurrence} onValueChange={setRecurrence} disabled={isLocked}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {recurrenceOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Vague */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-foreground">Vague</label>
            <Select value={vagueId} onValueChange={setVagueId} disabled={isLocked}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Aucune vague</SelectItem>
                {vagues.map((v) => (
                  <SelectItem key={v.id} value={v.id}>{v.code}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Bac */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-foreground">Bac</label>
            <Select value={bacId} onValueChange={setBacId} disabled={isLocked}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Aucun bac</SelectItem>
                {bacs.map((b) => (
                  <SelectItem key={b.id} value={b.id}>{b.nom}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Assignee */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-foreground">Assigner a</label>
            <Select value={assigneAId} onValueChange={setAssigneAId} disabled={isLocked}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Non assigne</SelectItem>
                {members.map((m) => (
                  <SelectItem key={m.userId} value={m.userId}>{m.userName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Description */}
          <Textarea
            label="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
          />

          {/* Note de completion (visible si locked) */}
          {isLocked && (
            <Textarea
              label="Note de completion"
              value={noteCompletion}
              onChange={(e) => setNoteCompletion(e.target.value)}
              rows={3}
            />
          )}

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
