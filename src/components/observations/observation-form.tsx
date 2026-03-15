"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
import { useToast } from "@/components/ui/toast";

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

const TYPE_LABELS: Record<TypeObservation, string> = {
  mortalite: "Mortalite anormale",
  eau: "Qualite de l'eau",
  comportement: "Comportement des poissons",
  alimentation: "Probleme d'alimentation",
  autre: "Autre observation",
};

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
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

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
        message: "Veuillez choisir un type d'observation.",
      });
    }

    if (!observationTexte.trim()) {
      clientErrors.push({
        field: "observationTexte",
        message: "Le texte de l'observation est obligatoire.",
      });
    } else if (observationTexte.trim().length < 10) {
      clientErrors.push({
        field: "observationTexte",
        message: "L'observation doit contenir au moins 10 caracteres.",
      });
    }

    if (clientErrors.length > 0) {
      setSubmitErrors(clientErrors);
      return;
    }
    setSubmitErrors([]);

    setLoading(true);
    try {
      const res = await fetch("/api/mes-observations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          observationTexte: observationTexte.trim(),
          vagueId: vagueId || undefined,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        if (err.errors) {
          setSubmitErrors(err.errors);
          return;
        }
        throw new Error(err.message ?? "Erreur serveur");
      }

      toast({
        title: "Observation envoyee",
        description: "Votre observation a ete transmise a l'equipe DKFarm.",
      });

      // Reinitialiser le formulaire
      setType("");
      setObservationTexte("");
      setVagueId("");

      if (onSuccess) {
        onSuccess();
      } else {
        router.refresh();
      }
    } catch (err) {
      toast({
        title: err instanceof Error ? err.message : "Erreur serveur",
        variant: "error",
      });
    } finally {
      setLoading(false);
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
              Envoyer une observation
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Signalez un probleme ou une observation a l&apos;equipe DKFarm.
              Nous vous repondrons rapidement.
            </p>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {/* Type d'observation */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="type" className="text-sm font-medium">
                Type d&apos;observation{" "}
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
                  <SelectValue placeholder="Choisir un type" />
                </SelectTrigger>
                <SelectContent>
                  {TYPES_OBSERVATION.map((t) => (
                    <SelectItem key={t} value={t}>
                      {TYPE_LABELS[t]}
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
                Description <span className="text-destructive">*</span>
              </label>
              <Textarea
                id="observationTexte"
                value={observationTexte}
                onChange={(e) => setObservationTexte(e.target.value)}
                placeholder="Decrivez votre observation en detail : ce que vous avez observe, quand, dans quel bac..."
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
                {observationTexte.length} / 2000 caracteres
              </p>
            </div>

            {/* Vague associee (optionnel) */}
            {vagues.length > 0 && (
              <div className="flex flex-col gap-1.5">
                <label htmlFor="vague" className="text-sm font-medium">
                  Vague concernee{" "}
                  <span className="text-muted-foreground text-xs font-normal">
                    (optionnel)
                  </span>
                </label>
                <Select
                  value={vagueId || "__aucune"}
                  onValueChange={(v) =>
                    setVagueId(v === "__aucune" ? "" : v)
                  }
                >
                  <SelectTrigger id="vague">
                    <SelectValue placeholder="Aucune vague" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__aucune">
                      Aucune vague specifique
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
          disabled={loading}
          className="w-full h-12 text-base"
        >
          {loading ? "Envoi en cours..." : "Envoyer l'observation"}
        </Button>
      </form>
    </div>
  );
}
