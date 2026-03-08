"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { FormBiometrie } from "./form-biometrie";
import { FormMortalite } from "./form-mortalite";
import { FormAlimentation } from "./form-alimentation";
import { FormQualiteEau } from "./form-qualite-eau";
import { FormComptage } from "./form-comptage";
import { FormObservation } from "./form-observation";
import { TypeReleve } from "@/types";
import type { BacResponse } from "@/types";

const typeLabels: Record<TypeReleve, string> = {
  [TypeReleve.BIOMETRIE]: "Biométrie",
  [TypeReleve.MORTALITE]: "Mortalité",
  [TypeReleve.ALIMENTATION]: "Alimentation",
  [TypeReleve.QUALITE_EAU]: "Qualité de l'eau",
  [TypeReleve.COMPTAGE]: "Comptage",
  [TypeReleve.OBSERVATION]: "Observation",
};

interface ReleveFormClientProps {
  vagues: { id: string; code: string }[];
}

export function ReleveFormClient({ vagues }: ReleveFormClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const [vagueId, setVagueId] = useState(searchParams.get("vagueId") ?? "");
  const [bacId, setBacId] = useState("");
  const [typeReleve, setTypeReleve] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [notes, setNotes] = useState("");
  const [bacs, setBacs] = useState<BacResponse[]>([]);
  const [loadingBacs, setLoadingBacs] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Type-specific field values
  const [fields, setFields] = useState<Record<string, string>>({});

  function updateField(field: string, value: string) {
    setFields((prev) => ({ ...prev, [field]: value }));
  }

  // Load bacs when vague changes
  useEffect(() => {
    if (!vagueId) {
      setBacs([]);
      setBacId("");
      return;
    }
    setLoadingBacs(true);
    setBacId("");
    fetch(`/api/bacs?vagueId=${vagueId}`)
      .then((res) => res.json())
      .then((data) => {
        const vagueBacs = (data.bacs ?? []).filter(
          (b: BacResponse) => b.vagueId === vagueId
        );
        setBacs(vagueBacs);
      })
      .catch(() => setBacs([]))
      .finally(() => setLoadingBacs(false));
  }, [vagueId]);

  // Reset type-specific fields when type changes
  useEffect(() => {
    setFields({});
  }, [typeReleve]);

  function validate(): Record<string, string> {
    const errs: Record<string, string> = {};
    if (!vagueId) errs.vagueId = "Sélectionnez une vague.";
    if (!bacId) errs.bacId = "Sélectionnez un bac.";
    if (!typeReleve) errs.typeReleve = "Sélectionnez un type de relevé.";
    if (!date) errs.date = "La date est obligatoire.";

    if (typeReleve === TypeReleve.BIOMETRIE) {
      if (!fields.poidsMoyen || Number(fields.poidsMoyen) <= 0)
        errs.poidsMoyen = "Requis (> 0).";
      if (!fields.tailleMoyenne || Number(fields.tailleMoyenne) <= 0)
        errs.tailleMoyenne = "Requis (> 0).";
      if (!fields.echantillonCount || Number(fields.echantillonCount) <= 0)
        errs.echantillonCount = "Requis (> 0).";
    }
    if (typeReleve === TypeReleve.MORTALITE) {
      if (fields.nombreMorts == null || fields.nombreMorts === "" || Number(fields.nombreMorts) < 0)
        errs.nombreMorts = "Requis (>= 0).";
      if (!fields.causeMortalite) errs.causeMortalite = "Requis.";
    }
    if (typeReleve === TypeReleve.ALIMENTATION) {
      if (!fields.quantiteAliment || Number(fields.quantiteAliment) <= 0)
        errs.quantiteAliment = "Requis (> 0).";
      if (!fields.typeAliment) errs.typeAliment = "Requis.";
      if (!fields.frequenceAliment || Number(fields.frequenceAliment) <= 0)
        errs.frequenceAliment = "Requis (> 0).";
    }
    if (typeReleve === TypeReleve.COMPTAGE) {
      if (fields.nombreCompte == null || fields.nombreCompte === "" || Number(fields.nombreCompte) < 0)
        errs.nombreCompte = "Requis (>= 0).";
      if (!fields.methodeComptage) errs.methodeComptage = "Requis.";
    }
    if (typeReleve === TypeReleve.OBSERVATION) {
      if (!fields.description?.trim()) errs.description = "Requis.";
    }
    return errs;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }

    setSubmitting(true);
    setErrors({});

    const body: Record<string, unknown> = {
      date,
      vagueId,
      bacId,
      typeReleve,
      ...(notes.trim() && { notes: notes.trim() }),
    };

    // Add type-specific numeric fields
    const numericFields = [
      "poidsMoyen", "tailleMoyenne", "echantillonCount",
      "nombreMorts", "quantiteAliment", "frequenceAliment",
      "nombreCompte", "temperature", "ph", "oxygene", "ammoniac",
    ];
    for (const f of numericFields) {
      if (fields[f] !== undefined && fields[f] !== "") {
        body[f] = Number(fields[f]);
      }
    }
    // String fields
    const stringFields = ["causeMortalite", "typeAliment", "methodeComptage", "description"];
    for (const f of stringFields) {
      if (fields[f]) {
        body[f] = f === "description" ? fields[f].trim() : fields[f];
      }
    }

    try {
      const res = await fetch("/api/releves", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        toast({ title: data.message || "Erreur lors de la création.", variant: "error" });
        return;
      }

      toast({ title: "Relevé enregistré !", variant: "success" });
      router.push(`/vagues/${vagueId}`);
      router.refresh();
    } catch {
      toast({ title: "Erreur réseau.", variant: "error" });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Saisir un relevé</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Vague */}
          <Select value={vagueId} onValueChange={setVagueId}>
            <SelectTrigger label="Vague" error={errors.vagueId}>
              <SelectValue placeholder="Sélectionner une vague" />
            </SelectTrigger>
            <SelectContent>
              {vagues.map((v) => (
                <SelectItem key={v.id} value={v.id}>
                  {v.code}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Bac */}
          <Select value={bacId} onValueChange={setBacId} disabled={!vagueId || loadingBacs}>
            <SelectTrigger label="Bac" error={errors.bacId}>
              <SelectValue
                placeholder={
                  loadingBacs ? "Chargement..." : !vagueId ? "Sélectionnez d'abord une vague" : "Sélectionner un bac"
                }
              />
            </SelectTrigger>
            <SelectContent>
              {bacs.map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.nom} ({b.volume}L)
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Date */}
          <Input
            id="date"
            label="Date du relevé"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            error={errors.date}
          />

          {/* Type */}
          <Select value={typeReleve} onValueChange={setTypeReleve}>
            <SelectTrigger label="Type de relevé" error={errors.typeReleve}>
              <SelectValue placeholder="Sélectionner un type" />
            </SelectTrigger>
            <SelectContent>
              {Object.values(TypeReleve).map((t) => (
                <SelectItem key={t} value={t}>
                  {typeLabels[t]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Dynamic fields */}
          {typeReleve === TypeReleve.BIOMETRIE && (
            <FormBiometrie
              values={{
                poidsMoyen: fields.poidsMoyen ?? "",
                tailleMoyenne: fields.tailleMoyenne ?? "",
                echantillonCount: fields.echantillonCount ?? "",
              }}
              onChange={updateField}
              errors={errors}
            />
          )}
          {typeReleve === TypeReleve.MORTALITE && (
            <FormMortalite
              values={{
                nombreMorts: fields.nombreMorts ?? "",
                causeMortalite: fields.causeMortalite ?? "",
              }}
              onChange={updateField}
              errors={errors}
            />
          )}
          {typeReleve === TypeReleve.ALIMENTATION && (
            <FormAlimentation
              values={{
                quantiteAliment: fields.quantiteAliment ?? "",
                typeAliment: fields.typeAliment ?? "",
                frequenceAliment: fields.frequenceAliment ?? "",
              }}
              onChange={updateField}
              errors={errors}
            />
          )}
          {typeReleve === TypeReleve.QUALITE_EAU && (
            <FormQualiteEau
              values={{
                temperature: fields.temperature ?? "",
                ph: fields.ph ?? "",
                oxygene: fields.oxygene ?? "",
                ammoniac: fields.ammoniac ?? "",
              }}
              onChange={updateField}
            />
          )}
          {typeReleve === TypeReleve.COMPTAGE && (
            <FormComptage
              values={{
                nombreCompte: fields.nombreCompte ?? "",
                methodeComptage: fields.methodeComptage ?? "",
              }}
              onChange={updateField}
              errors={errors}
            />
          )}
          {typeReleve === TypeReleve.OBSERVATION && (
            <FormObservation
              values={{ description: fields.description ?? "" }}
              onChange={updateField}
              errors={errors}
            />
          )}

          {/* Notes */}
          <Input
            id="notes"
            label="Notes (optionnel)"
            placeholder="Remarques complémentaires..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />

          {/* Submit */}
          <Button type="submit" disabled={submitting} className="mt-2">
            {submitting ? "Enregistrement..." : "Enregistrer le relevé"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
