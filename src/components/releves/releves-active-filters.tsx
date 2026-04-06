"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { X } from "lucide-react";
import { TypeReleve } from "@/types";
import {
  countActiveFilters,
  formatDateChip,
  ALL_VALUE,
} from "@/lib/releve-search-params";
import type { ReleveSearchParams } from "@/lib/releve-search-params";

const typeLabels: Record<TypeReleve, string> = {
  [TypeReleve.BIOMETRIE]: "Biométrie",
  [TypeReleve.MORTALITE]: "Mortalité",
  [TypeReleve.ALIMENTATION]: "Alimentation",
  [TypeReleve.QUALITE_EAU]: "Qualité eau",
  [TypeReleve.COMPTAGE]: "Comptage",
  [TypeReleve.OBSERVATION]: "Observation",
  [TypeReleve.RENOUVELLEMENT]: "Renouvellement eau",
};

interface Props {
  current: ReleveSearchParams;
  /** Nom de la vague pour affichage du chip (charge cote serveur) */
  vagueCode?: string;
  /** Nom du bac pour affichage du chip (charge cote serveur) */
  bacNom?: string;
}

export function RelevesActiveFilters({ current, vagueCode, bacNom }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const activeCount = countActiveFilters(current);
  if (activeCount === 0) return null;

  function removeParam(key: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (key === "dates") {
      params.delete("dateFrom");
      params.delete("dateTo");
    } else {
      params.delete(key);
    }
    params.delete("offset"); // reset pagination
    startTransition(() => {
      router.push(`/releves?${params.toString()}`);
    });
  }

  function clearAll() {
    startTransition(() => {
      router.push("/releves");
    });
  }

  const chips: { key: string; label: string }[] = [];

  if (current.vagueId) {
    chips.push({
      key: "vagueId",
      label: vagueCode ? `Vague : ${vagueCode}` : "Vague filtrée",
    });
  }
  if (current.bacId) {
    chips.push({
      key: "bacId",
      label: bacNom ? `Bac : ${bacNom}` : "Bac filtré",
    });
  }
  if (current.typeReleve && current.typeReleve !== ALL_VALUE) {
    const label = typeLabels[current.typeReleve as TypeReleve] ?? current.typeReleve;
    chips.push({ key: "typeReleve", label });
  }
  if (current.dateFrom && current.dateTo) {
    chips.push({
      key: "dates",
      label: `${formatDateChip(current.dateFrom)} → ${formatDateChip(current.dateTo)}`,
    });
  } else if (current.dateFrom) {
    chips.push({ key: "dateFrom", label: `Du ${formatDateChip(current.dateFrom)}` });
  } else if (current.dateTo) {
    chips.push({ key: "dateTo", label: `→ ${formatDateChip(current.dateTo)}` });
  }
  if (current.modifie === "true") {
    chips.push({ key: "modifie", label: "Modifiés seulement" });
  }

  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-1 -mx-4 px-4">
      {chips.map((chip) => (
        <button
          key={chip.key}
          type="button"
          onClick={() => removeParam(chip.key)}
          className="inline-flex items-center gap-1 shrink-0 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary hover:bg-primary/20 transition-colors"
        >
          {chip.label}
          <X className="h-3 w-3" />
        </button>
      ))}
      <button
        type="button"
        onClick={clearAll}
        className="shrink-0 text-xs text-muted-foreground hover:text-foreground underline transition-colors ml-1"
      >
        Tout effacer
      </button>
    </div>
  );
}
