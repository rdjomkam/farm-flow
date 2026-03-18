"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import { CategorieCalibrage } from "@/types";
import type { BacResponse } from "@/types";
import type { GroupeForm } from "./calibrage-form-client";

const categorieLabels: Record<CategorieCalibrage, string> = {
  [CategorieCalibrage.PETIT]: "Petit",
  [CategorieCalibrage.MOYEN]: "Moyen",
  [CategorieCalibrage.GROS]: "Gros",
  [CategorieCalibrage.TRES_GROS]: "Tres gros",
};

interface StepGroupesProps {
  bacs: BacResponse[];
  groupes: GroupeForm[];
  totalSourcePoissons: number;
  onChange: (groupes: GroupeForm[]) => void;
  onNext: () => void;
  onBack: () => void;
  errors: Record<string, string>;
}

export function StepGroupes({
  bacs,
  groupes,
  totalSourcePoissons,
  onChange,
  onNext,
  onBack,
  errors,
}: StepGroupesProps) {
  const totalReparti = groupes.reduce(
    (sum, g) => sum + (Number(g.nombrePoissons) || 0),
    0
  );
  const isBalanced = totalReparti <= totalSourcePoissons;
  const pourcentage =
    totalSourcePoissons > 0
      ? Math.min(100, Math.round((totalReparti / totalSourcePoissons) * 100))
      : 0;

  function addGroupe() {
    if (groupes.length >= 4) return;
    onChange([
      ...groupes,
      {
        categorie: "",
        destinationBacId: "",
        nombrePoissons: "",
        poidsMoyen: "",
        tailleMoyenne: "",
      },
    ]);
  }

  function removeGroupe(index: number) {
    if (groupes.length <= 2) return;
    onChange(groupes.filter((_, i) => i !== index));
  }

  function updateGroupe(
    index: number,
    field: keyof GroupeForm,
    value: string
  ) {
    onChange(
      groupes.map((g, i) => (i === index ? { ...g, [field]: value } : g))
    );
  }

  const hasErrors = Object.keys(errors).some((k) => k.startsWith("groupe_"));

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-base font-semibold">Groupes de redistribution</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Definissez les groupes par categorie de taille.
        </p>
      </div>

      {/* Compteur de repartition */}
      <div className="rounded-xl border border-border bg-card p-3">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-medium">Repartition</p>
          <p
            className={
              isBalanced
                ? "text-sm font-semibold text-success"
                : "text-sm font-semibold text-danger"
            }
          >
            {totalReparti} / {totalSourcePoissons}
          </p>
        </div>
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              totalReparti > totalSourcePoissons
                ? "bg-danger"
                : totalReparti === totalSourcePoissons
                ? "bg-success"
                : "bg-primary"
            }`}
            style={{ width: `${pourcentage}%` }}
          />
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          {totalSourcePoissons - totalReparti > 0
            ? `${totalSourcePoissons - totalReparti} poissons restants a repartir`
            : totalReparti > totalSourcePoissons
            ? `${totalReparti - totalSourcePoissons} poissons en trop`
            : "Tous les poissons sont repartis"}
        </p>
      </div>

      {/* Groupes */}
      <div className="flex flex-col gap-4">
        {groupes.map((groupe, index) => (
          <div
            key={index}
            className="rounded-xl border border-border bg-card p-4"
          >
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold">Groupe {index + 1}</p>
              {groupes.length > 2 && (
                <button
                  type="button"
                  onClick={() => removeGroupe(index)}
                  className="flex items-center gap-1 text-xs text-danger hover:text-danger/80 min-h-[44px] min-w-[44px] justify-center"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>

            <div className="flex flex-col gap-3">
              <Select
                value={groupe.categorie}
                onValueChange={(v) => updateGroupe(index, "categorie", v)}
              >
                <SelectTrigger
                  label="Categorie"
                  error={errors[`groupe_${index}_categorie`]}
                >
                  <SelectValue placeholder="Choisir une categorie" />
                </SelectTrigger>
                <SelectContent>
                  {Object.values(CategorieCalibrage).map((c) => (
                    <SelectItem key={c} value={c}>
                      {categorieLabels[c]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={groupe.destinationBacId}
                onValueChange={(v) =>
                  updateGroupe(index, "destinationBacId", v)
                }
              >
                <SelectTrigger
                  label="Bac de destination"
                  error={errors[`groupe_${index}_destinationBacId`]}
                >
                  <SelectValue placeholder="Choisir un bac" />
                </SelectTrigger>
                <SelectContent>
                  {bacs.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.nom} ({b.volume} L)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Input
                label="Nombre de poissons"
                type="number"
                inputMode="numeric"
                min={1}
                placeholder="0"
                value={groupe.nombrePoissons}
                onChange={(e) =>
                  updateGroupe(index, "nombrePoissons", e.target.value)
                }
                error={errors[`groupe_${index}_nombrePoissons`]}
              />

              <Input
                label="Poids moyen (g)"
                type="number"
                inputMode="decimal"
                min={0.1}
                step={0.1}
                placeholder="0.0"
                value={groupe.poidsMoyen}
                onChange={(e) =>
                  updateGroupe(index, "poidsMoyen", e.target.value)
                }
                error={errors[`groupe_${index}_poidsMoyen`]}
              />

              <Input
                label="Taille moyenne (cm) — optionnel"
                type="number"
                inputMode="decimal"
                min={0.1}
                step={0.1}
                placeholder="—"
                value={groupe.tailleMoyenne}
                onChange={(e) =>
                  updateGroupe(index, "tailleMoyenne", e.target.value)
                }
              />
            </div>
          </div>
        ))}
      </div>

      {groupes.length < 4 && (
        <Button
          type="button"
          variant="outline"
          onClick={addGroupe}
          className="w-full"
        >
          <Plus className="h-4 w-4" />
          Ajouter un groupe
        </Button>
      )}

      {hasErrors && (
        <p className="text-sm text-danger">
          Veuillez corriger les erreurs avant de continuer.
        </p>
      )}

      <div className="flex gap-3">
        <Button type="button" variant="outline" onClick={onBack} className="flex-1">
          Retour
        </Button>
        <Button type="button" onClick={onNext} className="flex-1">
          Suivant
        </Button>
      </div>
    </div>
  );
}
