"use client";

import { useTransition } from "react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { queryKeys } from "@/lib/query-keys";
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
import { TypeActivite, Recurrence } from "@/types";
import { useActiviteService } from "@/services";
import { typeActiviteLabels } from "@/lib/labels/activite";

const recurrenceValues = [
  { value: "none" },
  { value: Recurrence.QUOTIDIEN },
  { value: Recurrence.HEBDOMADAIRE },
  { value: Recurrence.BIMENSUEL },
  { value: Recurrence.MENSUEL },
  { value: Recurrence.PERSONNALISE },
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
  const t = useTranslations("planning");
  const recurrenceLabels: Record<string, string> = {
    [Recurrence.QUOTIDIEN]: t("recurrences.QUOTIDIEN"),
    [Recurrence.HEBDOMADAIRE]: t("recurrences.HEBDOMADAIRE"),
    [Recurrence.BIMENSUEL]: t("recurrences.BIMENSUEL_DETAIL"),
    [Recurrence.MENSUEL]: t("recurrences.MENSUEL"),
    [Recurrence.PERSONNALISE]: t("recurrences.PERSONNALISE"),
  };
  const router = useRouter();
  const queryClient = useQueryClient();
  const [isPending, startTransition] = useTransition();
  const activiteService = useActiviteService();

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
    if (!titre.trim()) newErrors.titre = t("nouvelleActivite.erreurs.titreRequis");
    if (!typeActivite) newErrors.typeActivite = t("nouvelleActivite.erreurs.typeRequis");
    if (!dateDebut) newErrors.dateDebut = t("nouvelleActivite.erreurs.dateDebutRequise");
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    const payload = {
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

    const result = await activiteService.create(payload as Parameters<typeof activiteService.create>[0]);
    if (result.ok) {
      queryClient.invalidateQueries({ queryKey: queryKeys.planning.activites() });
      startTransition(() => {
        router.push("/planning");
      });
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      {/* Titre */}
      <Input
        label={t("nouvelleActivite.titre")}
        placeholder={t("nouvelleActivite.titrePlaceholder")}
        value={titre}
        onChange={(e) => setTitre(e.target.value)}
        error={errors.titre}
      />

      {/* Type d'activite */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-foreground">
          {t("nouvelleActivite.typeActivite")}
        </label>
        <Select value={typeActivite} onValueChange={setTypeActivite}>
          <SelectTrigger error={errors.typeActivite}>
            <SelectValue placeholder={t("nouvelleActivite.typeActivitePlaceholder")} />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(typeActiviteLabels) as TypeActivite[])
              .filter((k) => [
                TypeActivite.ALIMENTATION,
                TypeActivite.BIOMETRIE,
                TypeActivite.QUALITE_EAU,
                TypeActivite.COMPTAGE,
                TypeActivite.NETTOYAGE,
                TypeActivite.TRAITEMENT,
                TypeActivite.RECOLTE,
                TypeActivite.AUTRE,
              ].includes(k))
              .map((value) => (
                <SelectItem key={value} value={value}>
                  {typeActiviteLabels[value]}
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
        label={t("nouvelleActivite.dateDebut")}
        value={dateDebut}
        onChange={(e) => setDateDebut(e.target.value)}
        error={errors.dateDebut}
      />

      {/* Date fin */}
      <Input
        type="datetime-local"
        label={t("nouvelleActivite.dateFin")}
        value={dateFin}
        onChange={(e) => setDateFin(e.target.value)}
      />

      {/* Recurrence */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-foreground">
          {t("nouvelleActivite.recurrence")}
        </label>
        <Select value={recurrence} onValueChange={setRecurrence}>
          <SelectTrigger>
            <SelectValue placeholder={t("nouvelleActivite.recurrenceAucune")} />
          </SelectTrigger>
          <SelectContent>
            {recurrenceValues.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.value === "none"
                  ? t("options.noneOneTime")
                  : recurrenceLabels[opt.value]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Vague (optionnel) */}
      {vagues.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-foreground">
            {t("nouvelleActivite.vague")}
          </label>
          <Select value={vagueId} onValueChange={setVagueId}>
            <SelectTrigger>
              <SelectValue placeholder={t("nouvelleActivite.vagueAucune")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">{t("nouvelleActivite.vagueAucune")}</SelectItem>
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
            {t("nouvelleActivite.bac")}
          </label>
          <Select value={bacId} onValueChange={setBacId}>
            <SelectTrigger>
              <SelectValue placeholder={t("nouvelleActivite.bacAucun")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">{t("nouvelleActivite.bacAucun")}</SelectItem>
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
            {t("nouvelleActivite.assigneA")}
          </label>
          <Select value={assigneAId} onValueChange={setAssigneAId}>
            <SelectTrigger>
              <SelectValue placeholder={t("nouvelleActivite.assigneAucun")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">{t("nouvelleActivite.assigneAucun")}</SelectItem>
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
        label={t("nouvelleActivite.description")}
        placeholder={t("nouvelleActivite.descriptionPlaceholder")}
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
          {isPending ? t("nouvelleActivite.submitting") : t("nouvelleActivite.submit")}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          disabled={isPending}
          className="flex-1"
        >
          {t("nouvelleActivite.annuler")}
        </Button>
      </div>
    </form>
  );
}
