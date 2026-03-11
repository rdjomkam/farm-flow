"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
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
import { useToast } from "@/components/ui/toast";
import { TypeActivite, Recurrence } from "@/types";

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
  { value: "none", label: "Aucune (ponctuel)" },
  { value: Recurrence.QUOTIDIEN, label: "Quotidien" },
  { value: Recurrence.HEBDOMADAIRE, label: "Hebdomadaire" },
  { value: Recurrence.BIMENSUEL, label: "Bimensuel (2x/semaine)" },
  { value: Recurrence.MENSUEL, label: "Mensuel" },
  { value: Recurrence.PERSONNALISE, label: "Personnalise" },
];

interface NouvelleActiviteFormProps {
  vagues: { id: string; code: string }[];
  bacs: { id: string; nom: string }[];
  members?: { userId: string; userName: string }[];
}

interface FormErrors {
  titre?: string;
  typeActivite?: string;
  dateDebut?: string;
}

export function NouvelleActiviteForm({ vagues, bacs, members = [] }: NouvelleActiviteFormProps) {
  const { toast } = useToast();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Valeur par defaut : aujourd'hui a 08h00 (locale)
  const now = new Date();
  const defaultDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}T08:00`;

  const [titre, setTitre] = useState("");
  const [typeActivite, setTypeActivite] = useState<string>("");
  const [dateDebut, setDateDebut] = useState(defaultDate);
  const [dateFin, setDateFin] = useState("");
  const [recurrence, setRecurrence] = useState("none");
  const [vagueId, setVagueId] = useState("none");
  const [bacId, setBacId] = useState("none");
  const [assigneAId, setAssigneAId] = useState("__none__");
  const [description, setDescription] = useState("");
  const [errors, setErrors] = useState<FormErrors>({});

  function validate(): boolean {
    const newErrors: FormErrors = {};
    if (!titre.trim()) newErrors.titre = "Le titre est obligatoire";
    if (!typeActivite) newErrors.typeActivite = "Le type d'activite est obligatoire";
    if (!dateDebut) newErrors.dateDebut = "La date de debut est obligatoire";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    const payload: Record<string, string | undefined> = {
      titre: titre.trim(),
      typeActivite,
      dateDebut: new Date(dateDebut).toISOString(),
      dateFin: dateFin ? new Date(dateFin).toISOString() : undefined,
      recurrence: recurrence && recurrence !== "none" ? recurrence : undefined,
      vagueId: vagueId && vagueId !== "none" ? vagueId : undefined,
      bacId: bacId && bacId !== "none" ? bacId : undefined,
      assigneAId: assigneAId && assigneAId !== "__none__" ? assigneAId : undefined,
      description: description.trim() || undefined,
    };

    try {
      const res = await fetch("/api/activites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        toast({ title: "Activite planifiee avec succes", variant: "success" });
        startTransition(() => {
          router.push("/planning");
          router.refresh();
        });
      } else {
        const err = await res.json();
        toast({
          title: err.message ?? "Erreur lors de la creation",
          variant: "error",
        });
      }
    } catch {
      toast({ title: "Erreur reseau", variant: "error" });
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      {/* Titre */}
      <Input
        label="Titre *"
        placeholder="Ex: Alimentation bac 1"
        value={titre}
        onChange={(e) => setTitre(e.target.value)}
        error={errors.titre}
      />

      {/* Type d'activite */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-foreground">
          Type d'activite *
        </label>
        <Select value={typeActivite} onValueChange={setTypeActivite}>
          <SelectTrigger error={errors.typeActivite}>
            <SelectValue placeholder="Choisir un type..." />
          </SelectTrigger>
          <SelectContent>
            {typeActiviteOptions.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.typeActivite && (
          <p className="text-sm text-danger">{errors.typeActivite}</p>
        )}
      </div>

      {/* Date debut */}
      <Input
        type="datetime-local"
        label="Date de debut *"
        value={dateDebut}
        onChange={(e) => setDateDebut(e.target.value)}
        error={errors.dateDebut}
      />

      {/* Date fin */}
      <Input
        type="datetime-local"
        label="Date de fin (optionnel)"
        value={dateFin}
        onChange={(e) => setDateFin(e.target.value)}
      />

      {/* Recurrence */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-foreground">
          Recurrence
        </label>
        <Select value={recurrence} onValueChange={setRecurrence}>
          <SelectTrigger>
            <SelectValue placeholder="Aucune (ponctuel)" />
          </SelectTrigger>
          <SelectContent>
            {recurrenceOptions.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Vague (optionnel) */}
      {vagues.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-foreground">
            Vague (optionnel)
          </label>
          <Select value={vagueId} onValueChange={setVagueId}>
            <SelectTrigger>
              <SelectValue placeholder="Aucune vague" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Aucune vague</SelectItem>
              {vagues.map((v) => (
                <SelectItem key={v.id} value={v.id}>
                  {v.code}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Bac (optionnel) */}
      {bacs.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-foreground">
            Bac (optionnel)
          </label>
          <Select value={bacId} onValueChange={setBacId}>
            <SelectTrigger>
              <SelectValue placeholder="Aucun bac" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Aucun bac</SelectItem>
              {bacs.map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.nom}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Assignee */}
      {members.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-foreground">
            Assigner a (optionnel)
          </label>
          <Select value={assigneAId} onValueChange={setAssigneAId}>
            <SelectTrigger>
              <SelectValue placeholder="Non assigne" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">Non assigne</SelectItem>
              {members.map((m) => (
                <SelectItem key={m.userId} value={m.userId}>
                  {m.userName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Description */}
      <Textarea
        label="Description (optionnel)"
        placeholder="Details de l'activite..."
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        rows={3}
      />

      {/* Boutons */}
      <div className="flex flex-col gap-2 sm:flex-row-reverse">
        <Button
          type="submit"
          disabled={isPending}
          className="flex-1"
        >
          {isPending ? "Planification..." : "Planifier l'activite"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          disabled={isPending}
          className="flex-1"
        >
          Annuler
        </Button>
      </div>
    </form>
  );
}
