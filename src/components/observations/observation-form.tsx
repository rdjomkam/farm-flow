"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import { useNoteService } from "@/services";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

const TYPES_OBSERVATION = [
  "mortalite",
  "eau",
  "comportement",
  "alimentation",
  "autre",
] as const;

type TypeObservation = (typeof TYPES_OBSERVATION)[number];

interface VagueOption {
  id: string;
  code: string;
}

interface Props {
  /** Liste des vagues actives du site (optionnel — pour le lien vague) */
  vagues?: VagueOption[];
  /** Callback apres creation reussie */
  onSuccess?: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ObservationForm({ vagues = [], onSuccess }: Props) {
  const t = useTranslations("observations");
  const queryClient = useQueryClient();
  const noteService = useNoteService();

  // Champs du formulaire
  const [type, setType] = useState<TypeObservation | "">("");
  const [observationTexte, setObservationTexte] = useState("");
  const [vagueId, setVagueId] = useState<string>("");

  const [submitErrors, setSubmitErrors] = useState<
    { field: string; message: string }[]
  >([]);

  function getFieldError(field: string) {
    return submitErrors.find((e) => e.field === field)?.message;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    // Validation cote client
    const clientErrors: { field: string; message: string }[] = [];

    if (!type) {
      clientErrors.push({
        field: "type",
        message: t("form.erreurs.typeRequis"),
      });
    }

    if (!observationTexte.trim()) {
      clientErrors.push({
        field: "observationTexte",
        message: t("form.erreurs.descriptionRequise"),
      });
    } else if (observationTexte.trim().length < 10) {
      clientErrors.push({
        field: "observationTexte",
        message: t("form.erreurs.descriptionTropCourte"),
      });
    }

    if (clientErrors.length > 0) {
      setSubmitErrors(clientErrors);
      return;
    }
    setSubmitErrors([]);

    const result = await noteService.createObservation({
      type: type as string,
      observationTexte: observationTexte.trim(),
      vagueId: vagueId || undefined,
    });

    if (result.ok) {
      setType("");
      setObservationTexte("");
      setVagueId("");

      if (onSuccess) {
        onSuccess();
      } else {
        queryClient.invalidateQueries({ queryKey: queryKeys.notes.all });
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="flex flex-col gap-4 p-4 w-full max-w-lg mx-auto">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {/* Carte principale */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              {t("form.title")}
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              {t("form.description")}
            </p>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {/* Type d'observation */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="type" className="text-sm font-medium">
                {t("form.typeLabel")}{" "}
                <span className="text-destructive">*</span>
              </label>
              <Select
                value={type}
                onValueChange={(v) => setType(v as TypeObservation)}
              >
                <SelectTrigger
                  id="type"
                  className={
                    getFieldError("type") ? "border-destructive" : ""
                  }
                >
                  <SelectValue placeholder={t("form.typePlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {TYPES_OBSERVATION.map((observationType) => (
                    <SelectItem key={observationType} value={observationType}>
                      {t(`types.${observationType}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {getFieldError("type") && (
                <p className="text-xs text-destructive">
                  {getFieldError("type")}
                </p>
              )}
            </div>

            {/* Texte de l'observation */}
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="observationTexte"
                className="text-sm font-medium"
              >
                {t("form.descriptionLabel")} <span className="text-destructive">*</span>
              </label>
              <Textarea
                id="observationTexte"
                value={observationTexte}
                onChange={(e) => setObservationTexte(e.target.value)}
                placeholder={t("form.descriptionPlaceholder")}
                rows={5}
                className={
                  getFieldError("observationTexte")
                    ? "border-destructive"
                    : ""
                }
              />
              {getFieldError("observationTexte") && (
                <p className="text-xs text-destructive">
                  {getFieldError("observationTexte")}
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                {t("form.descriptionCount", { count: observationTexte.length })}
              </p>
            </div>

            {/* Vague associee (optionnel) */}
            {vagues.length > 0 && (
              <div className="flex flex-col gap-1.5">
                <label htmlFor="vague" className="text-sm font-medium">
                  {t("form.vagueLabel")}
                </label>
                <Select
                  value={vagueId || "__aucune"}
                  onValueChange={(v) =>
                    setVagueId(v === "__aucune" ? "" : v)
                  }
                >
                  <SelectTrigger id="vague">
                    <SelectValue placeholder={t("form.vagueAucune")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__aucune">
                      {t("form.vagueAucune")}
                    </SelectItem>
                    {vagues.map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        {v.code}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Erreurs globales */}
        {submitErrors.length > 0 &&
          !submitErrors.some((e) =>
            ["type", "observationTexte", "vagueId"].includes(e.field)
          ) && (
            <div className="text-sm text-destructive bg-destructive/10 rounded p-3">
              {submitErrors[0].message}
            </div>
          )}

        {/* Bouton de soumission */}
        <Button
          type="submit"
          className="w-full h-12 text-base"
        >
          {t("form.submit")}
        </Button>
      </form>
    </div>
  );
}
