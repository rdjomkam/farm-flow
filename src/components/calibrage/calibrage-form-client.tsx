"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/toast";
import { CategorieCalibrage } from "@/types";
import type { BacResponse, CreateCalibrageDTO } from "@/types";
import { StepSources } from "./step-sources";
import { StepGroupes } from "./step-groupes";
import { StepMortalite } from "./step-mortalite";
import { StepRecap } from "./step-recap";

export interface GroupeForm {
  categorie: string;
  destinationBacId: string;
  nombrePoissons: string;
  poidsMoyen: string;
  tailleMoyenne: string;
}

interface CalibrageFormClientProps {
  vagueId: string;
  bacs: BacResponse[];
  onSuccess?: () => void;
}

const INITIAL_GROUPES: GroupeForm[] = [
  {
    categorie: "",
    destinationBacId: "",
    nombrePoissons: "",
    poidsMoyen: "",
    tailleMoyenne: "",
  },
  {
    categorie: "",
    destinationBacId: "",
    nombrePoissons: "",
    poidsMoyen: "",
    tailleMoyenne: "",
  },
];

const STEP_LABELS = [
  "Sources",
  "Groupes",
  "Mortalite",
  "Recapitulatif",
];

export function CalibrageFormClient({
  vagueId,
  bacs,
  onSuccess,
}: CalibrageFormClientProps) {
  const router = useRouter();
  const { toast } = useToast();

  const [step, setStep] = useState(1);
  const [selectedBacIds, setSelectedBacIds] = useState<string[]>([]);
  const [groupes, setGroupes] = useState<GroupeForm[]>(INITIAL_GROUPES);
  const [nombreMorts, setNombreMorts] = useState("0");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sourceError, setSourceError] = useState("");
  const [groupeErrors, setGroupeErrors] = useState<Record<string, string>>({});

  const sourceBacs = bacs.filter((b) => selectedBacIds.includes(b.id));
  const totalSourcePoissons = sourceBacs.reduce(
    (sum, b) => sum + (b.nombrePoissons ?? 0),
    0
  );
  const totalGroupePoissons = groupes.reduce(
    (sum, g) => sum + (Number(g.nombrePoissons) || 0),
    0
  );

  function toggleBac(bacId: string) {
    setSelectedBacIds((prev) =>
      prev.includes(bacId) ? prev.filter((id) => id !== bacId) : [...prev, bacId]
    );
    setSourceError("");
  }

  function validateSources(): boolean {
    if (selectedBacIds.length === 0) {
      setSourceError("Selectionnez au moins un bac source.");
      return false;
    }
    if (totalSourcePoissons === 0) {
      setSourceError(
        "Les bacs selectionnes ne contiennent aucun poisson."
      );
      return false;
    }
    return true;
  }

  function validateGroupes(): boolean {
    const errors: Record<string, string> = {};
    for (let i = 0; i < groupes.length; i++) {
      const g = groupes[i];
      if (!g.categorie) {
        errors[`groupe_${i}_categorie`] = "Requis.";
      }
      if (!g.destinationBacId) {
        errors[`groupe_${i}_destinationBacId`] = "Requis.";
      }
      if (!g.nombrePoissons || Number(g.nombrePoissons) <= 0) {
        errors[`groupe_${i}_nombrePoissons`] = "Requis (> 0).";
      }
      if (!g.poidsMoyen || Number(g.poidsMoyen) <= 0) {
        errors[`groupe_${i}_poidsMoyen`] = "Requis (> 0).";
      }
    }
    setGroupeErrors(errors);
    return Object.keys(errors).length === 0;
  }

  function handleNextFromSources() {
    if (validateSources()) setStep(2);
  }

  function handleNextFromGroupes() {
    if (validateGroupes()) setStep(3);
  }

  function handleNextFromMortalite() {
    const morts = Number(nombreMorts) || 0;
    const isBalanced = totalGroupePoissons + morts === totalSourcePoissons;
    if (isBalanced) setStep(4);
  }

  async function handleSubmit() {
    setSubmitting(true);
    try {
      const validGroupes = groupes.filter(
        (g) =>
          g.categorie &&
          g.destinationBacId &&
          Number(g.nombrePoissons) > 0 &&
          Number(g.poidsMoyen) > 0
      );

      const body: CreateCalibrageDTO = {
        vagueId,
        sourceBacIds: selectedBacIds,
        nombreMorts: Number(nombreMorts) || 0,
        notes: notes.trim() || undefined,
        groupes: validGroupes.map((g) => ({
          categorie: g.categorie as CategorieCalibrage,
          destinationBacId: g.destinationBacId,
          nombrePoissons: Number(g.nombrePoissons),
          poidsMoyen: Number(g.poidsMoyen),
          tailleMoyenne: g.tailleMoyenne ? Number(g.tailleMoyenne) : undefined,
        })),
      };

      const res = await fetch("/api/calibrages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        toast({
          title: data.message || "Erreur lors de la creation.",
          variant: "error",
        });
        return;
      }

      toast({ title: "Calibrage enregistre !", variant: "success" });
      if (onSuccess) {
        onSuccess();
      } else {
        router.push(`/vagues/${vagueId}`);
        router.refresh();
      }
    } catch {
      toast({ title: "Erreur reseau.", variant: "error" });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Indicateur d'etapes */}
      <div className="flex items-center gap-1">
        {STEP_LABELS.map((label, i) => {
          const stepNum = i + 1;
          const isActive = stepNum === step;
          const isDone = stepNum < step;
          return (
            <div key={i} className="flex items-center gap-1 flex-1">
              <div
                className={`flex items-center justify-center rounded-full text-xs font-semibold h-6 w-6 shrink-0 ${
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : isDone
                    ? "bg-success text-white"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {isDone ? "✓" : stepNum}
              </div>
              <span
                className={`text-xs hidden sm:block ${
                  isActive ? "font-semibold text-foreground" : "text-muted-foreground"
                }`}
              >
                {label}
              </span>
              {i < STEP_LABELS.length - 1 && (
                <div
                  className={`flex-1 h-px mx-1 ${
                    isDone ? "bg-success" : "bg-border"
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Contenu de l'etape */}
      {step === 1 && (
        <StepSources
          bacs={bacs}
          selectedBacIds={selectedBacIds}
          onToggle={toggleBac}
          onNext={handleNextFromSources}
          error={sourceError}
        />
      )}
      {step === 2 && (
        <StepGroupes
          bacs={bacs}
          groupes={groupes}
          totalSourcePoissons={totalSourcePoissons}
          onChange={setGroupes}
          onNext={handleNextFromGroupes}
          onBack={() => setStep(1)}
          errors={groupeErrors}
        />
      )}
      {step === 3 && (
        <StepMortalite
          nombreMorts={nombreMorts}
          notes={notes}
          totalSourcePoissons={totalSourcePoissons}
          totalGroupePoissons={totalGroupePoissons}
          onChangeMorts={setNombreMorts}
          onChangeNotes={setNotes}
          onNext={handleNextFromMortalite}
          onBack={() => setStep(2)}
        />
      )}
      {step === 4 && (
        <StepRecap
          bacs={bacs}
          selectedBacIds={selectedBacIds}
          groupes={groupes}
          nombreMorts={nombreMorts}
          notes={notes}
          onBack={() => setStep(3)}
          onSubmit={handleSubmit}
          submitting={submitting}
        />
      )}
    </div>
  );
}
