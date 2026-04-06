"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { X } from "lucide-react";
import { TypeReleve, CauseMortalite, TypeAliment, ComportementAlimentaire, MethodeComptage } from "@/types";
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

const causeMortaliteLabels: Record<CauseMortalite, string> = {
  [CauseMortalite.MALADIE]: "Maladie",
  [CauseMortalite.QUALITE_EAU]: "Qualité eau",
  [CauseMortalite.STRESS]: "Stress",
  [CauseMortalite.PREDATION]: "Prédation",
  [CauseMortalite.CANNIBALISME]: "Cannibalisme",
  [CauseMortalite.INCONNUE]: "Inconnue",
  [CauseMortalite.AUTRE]: "Autre",
};

const typeAlimentLabels: Record<TypeAliment, string> = {
  [TypeAliment.ARTISANAL]: "Artisanal",
  [TypeAliment.COMMERCIAL]: "Commercial",
  [TypeAliment.MIXTE]: "Mixte",
};

const comportementAlimLabels: Record<ComportementAlimentaire, string> = {
  [ComportementAlimentaire.VORACE]: "Vorace",
  [ComportementAlimentaire.NORMAL]: "Normal",
  [ComportementAlimentaire.FAIBLE]: "Faible",
  [ComportementAlimentaire.REFUSE]: "Refus",
};

const methodeComptageLabels: Record<MethodeComptage, string> = {
  [MethodeComptage.DIRECT]: "Direct",
  [MethodeComptage.ESTIMATION]: "Estimation",
  [MethodeComptage.ECHANTILLONNAGE]: "Échantillonnage",
};

/** Formate un label de plage min/max */
function formatRange(min: string | undefined, max: string | undefined, unit?: string): string {
  const u = unit ? ` ${unit}` : "";
  if (min && max) return `${min}–${max}${u}`;
  if (min) return `≥ ${min}${u}`;
  return `≤ ${max}${u}`;
}

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

  function removeParam(key: string | string[]) {
    const params = new URLSearchParams(searchParams.toString());
    if (Array.isArray(key)) {
      key.forEach((k) => params.delete(k));
    } else if (key === "dates") {
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

  const chips: { key: string | string[]; label: string }[] = [];

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

  // Filtres specifiques BIOMETRIE
  if (current.poidsMoyenMin || current.poidsMoyenMax) {
    chips.push({
      key: ["poidsMoyenMin", "poidsMoyenMax"],
      label: `Poids : ${formatRange(current.poidsMoyenMin, current.poidsMoyenMax, "g")}`,
    });
  }
  if (current.tailleMoyenneMin || current.tailleMoyenneMax) {
    chips.push({
      key: ["tailleMoyenneMin", "tailleMoyenneMax"],
      label: `Taille : ${formatRange(current.tailleMoyenneMin, current.tailleMoyenneMax, "cm")}`,
    });
  }

  // Filtres specifiques MORTALITE
  if (current.causeMortalite) {
    const label = causeMortaliteLabels[current.causeMortalite as CauseMortalite] ?? current.causeMortalite;
    chips.push({ key: "causeMortalite", label: `Cause : ${label}` });
  }
  if (current.nombreMortsMin || current.nombreMortsMax) {
    chips.push({
      key: ["nombreMortsMin", "nombreMortsMax"],
      label: `Morts : ${formatRange(current.nombreMortsMin, current.nombreMortsMax)}`,
    });
  }

  // Filtres specifiques ALIMENTATION
  if (current.typeAliment) {
    const label = typeAlimentLabels[current.typeAliment as TypeAliment] ?? current.typeAliment;
    chips.push({ key: "typeAliment", label: `Aliment : ${label}` });
  }
  if (current.comportementAlim) {
    const label = comportementAlimLabels[current.comportementAlim as ComportementAlimentaire] ?? current.comportementAlim;
    chips.push({ key: "comportementAlim", label: `Comportement : ${label}` });
  }
  if (current.frequenceAlimentMin || current.frequenceAlimentMax) {
    chips.push({
      key: ["frequenceAlimentMin", "frequenceAlimentMax"],
      label: `Fréquence : ${formatRange(current.frequenceAlimentMin, current.frequenceAlimentMax, "fois/j")}`,
    });
  }

  // Filtres specifiques QUALITE_EAU
  if (current.temperatureMin || current.temperatureMax) {
    chips.push({
      key: ["temperatureMin", "temperatureMax"],
      label: `T° : ${formatRange(current.temperatureMin, current.temperatureMax, "°C")}`,
    });
  }
  if (current.phMin || current.phMax) {
    chips.push({
      key: ["phMin", "phMax"],
      label: `pH : ${formatRange(current.phMin, current.phMax)}`,
    });
  }

  // Filtres specifiques COMPTAGE
  if (current.methodeComptage) {
    const label = methodeComptageLabels[current.methodeComptage as MethodeComptage] ?? current.methodeComptage;
    chips.push({ key: "methodeComptage", label: `Méthode : ${label}` });
  }

  // Filtres specifiques OBSERVATION
  if (current.descriptionSearch) {
    chips.push({ key: "descriptionSearch", label: `Recherche : "${current.descriptionSearch}"` });
  }

  // Filtres specifiques RENOUVELLEMENT
  if (current.pourcentageMin || current.pourcentageMax) {
    chips.push({
      key: ["pourcentageMin", "pourcentageMax"],
      label: `Renouvellement : ${formatRange(current.pourcentageMin, current.pourcentageMax, "%")}`,
    });
  }

  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-1 -mx-4 px-4">
      {chips.map((chip) => (
        <button
          key={Array.isArray(chip.key) ? chip.key.join(",") : chip.key}
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
