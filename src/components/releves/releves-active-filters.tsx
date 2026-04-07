"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { TypeReleve, CauseMortalite, TypeAliment, ComportementAlimentaire, MethodeComptage } from "@/types";
import {
  countActiveFilters,
  formatDateChip,
  ALL_VALUE,
} from "@/lib/releve-search-params";
import type { ReleveSearchParams } from "@/lib/releve-search-params";

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
  /** Nom du produit alimentaire pour affichage du chip (charge cote serveur) */
  produitNom?: string;
}

export function RelevesActiveFilters({ current, vagueCode, bacNom, produitNom }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();
  const t = useTranslations("releves");

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
      label: vagueCode ? t("global.filtresActifs.vague", { code: vagueCode }) : t("global.filtresActifs.vagueFiltered"),
    });
  }
  if (current.bacId) {
    chips.push({
      key: "bacId",
      label: bacNom ? t("global.filtresActifs.bac", { nom: bacNom }) : t("global.filtresActifs.bacFiltered"),
    });
  }
  if (current.typeReleve && current.typeReleve !== ALL_VALUE) {
    const label = t(`types.${current.typeReleve}` as Parameters<typeof t>[0]) ?? current.typeReleve;
    chips.push({ key: "typeReleve", label });
  }
  if (current.dateFrom && current.dateTo) {
    chips.push({
      key: "dates",
      label: `${formatDateChip(current.dateFrom)} → ${formatDateChip(current.dateTo)}`,
    });
  } else if (current.dateFrom) {
    chips.push({ key: "dateFrom", label: t("global.filtresActifs.periode.du", { date: formatDateChip(current.dateFrom) }) });
  } else if (current.dateTo) {
    chips.push({ key: "dateTo", label: t("global.filtresActifs.periode.au", { date: formatDateChip(current.dateTo) }) });
  }
  if (current.modifie === "true") {
    chips.push({ key: "modifie", label: t("global.filtresActifs.modifie") });
  }

  // Filtres specifiques BIOMETRIE
  if (current.poidsMoyenMin || current.poidsMoyenMax) {
    chips.push({
      key: ["poidsMoyenMin", "poidsMoyenMax"],
      label: `${t("global.filtresActifs.poids")} : ${formatRange(current.poidsMoyenMin, current.poidsMoyenMax, "g")}`,
    });
  }
  if (current.tailleMoyenneMin || current.tailleMoyenneMax) {
    chips.push({
      key: ["tailleMoyenneMin", "tailleMoyenneMax"],
      label: `${t("global.filtresActifs.taille")} : ${formatRange(current.tailleMoyenneMin, current.tailleMoyenneMax, "cm")}`,
    });
  }

  // Filtres specifiques MORTALITE
  if (current.causeMortalite) {
    const label = t(`form.mortalite.causes.${current.causeMortalite}` as Parameters<typeof t>[0]) ?? current.causeMortalite;
    chips.push({ key: "causeMortalite", label: `${t("global.filtresActifs.cause")} : ${label}` });
  }
  if (current.nombreMortsMin || current.nombreMortsMax) {
    chips.push({
      key: ["nombreMortsMin", "nombreMortsMax"],
      label: `${t("global.filtresActifs.morts")} : ${formatRange(current.nombreMortsMin, current.nombreMortsMax)}`,
    });
  }

  // Filtres specifiques ALIMENTATION
  if (current.typeAliment) {
    const label = t(`form.alimentation.types.${current.typeAliment}` as Parameters<typeof t>[0]) ?? current.typeAliment;
    chips.push({ key: "typeAliment", label: `${t("global.filtresActifs.aliment")} : ${label}` });
  }
  if (current.comportementAlim) {
    const label = t(`form.alimentation.comportementAlim.${current.comportementAlim}` as Parameters<typeof t>[0]) ?? current.comportementAlim;
    chips.push({ key: "comportementAlim", label: `${t("global.filtresActifs.comportement")} : ${label}` });
  }
  if (current.frequenceAlimentMin || current.frequenceAlimentMax) {
    chips.push({
      key: ["frequenceAlimentMin", "frequenceAlimentMax"],
      label: `${t("global.filtresActifs.frequence")} : ${formatRange(current.frequenceAlimentMin, current.frequenceAlimentMax, t("global.filtresActifs.frequenceUnit"))}`,
    });
  }
  if (current.produitId) {
    chips.push({
      key: "produitId",
      label: produitNom ? `${t("global.filtresActifs.produit")} : ${produitNom}` : t("global.filtresActifs.produitFiltered"),
    });
  }

  // Filtres specifiques QUALITE_EAU
  if (current.temperatureMin || current.temperatureMax) {
    chips.push({
      key: ["temperatureMin", "temperatureMax"],
      label: `${t("global.filtresActifs.temperature")} : ${formatRange(current.temperatureMin, current.temperatureMax, "°C")}`,
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
    const label = t(`form.comptage.methodes.${current.methodeComptage}` as Parameters<typeof t>[0]) ?? current.methodeComptage;
    chips.push({ key: "methodeComptage", label: `${t("global.filtresActifs.methode")} : ${label}` });
  }

  // Filtres specifiques OBSERVATION
  if (current.descriptionSearch) {
    chips.push({ key: "descriptionSearch", label: `${t("global.filtresActifs.recherche")} : "${current.descriptionSearch}"` });
  }

  // Filtres specifiques RENOUVELLEMENT
  if (current.pourcentageMin || current.pourcentageMax) {
    chips.push({
      key: ["pourcentageMin", "pourcentageMax"],
      label: `${t("global.filtresActifs.renouvellement")} : ${formatRange(current.pourcentageMin, current.pourcentageMax, "%")}`,
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
        {t("global.filtres.effacer")}
      </button>
    </div>
  );
}
