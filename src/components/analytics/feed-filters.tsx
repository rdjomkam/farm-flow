"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { useTransition, useState, useEffect } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PhaseElevage, TailleGranule, FormeAliment } from "@/types";

// Validation whitelist — E6 pattern
function isValidPhase(value: string): value is PhaseElevage {
  return Object.values(PhaseElevage).includes(value as PhaseElevage);
}
function isValidTaille(value: string): value is TailleGranule {
  return Object.values(TailleGranule).includes(value as TailleGranule);
}
function isValidForme(value: string): value is FormeAliment {
  return Object.values(FormeAliment).includes(value as FormeAliment);
}
function isValidSaison(value: string): value is "SECHE" | "PLUIES" {
  return value === "SECHE" || value === "PLUIES";
}

const ALL_VALUE = "__all__";

export function FeedFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const tAnalytics = useTranslations("analytics");
  const tSettings = useTranslations("settings");

  // État LOCAL qui reflète immédiatement le choix de l'utilisateur
  // sans attendre la réponse serveur.
  const [localPhase, setLocalPhase] = useState(searchParams.get("phase") ?? "");
  const [localTaille, setLocalTaille] = useState(searchParams.get("taille") ?? "");
  const [localForme, setLocalForme] = useState(searchParams.get("forme") ?? "");
  const [localSaison, setLocalSaison] = useState(searchParams.get("saison") ?? "");

  // Synchroniser l'état local quand les searchParams changent (ex : retour navigateur)
  useEffect(() => {
    setLocalPhase(searchParams.get("phase") ?? "");
    setLocalTaille(searchParams.get("taille") ?? "");
    setLocalForme(searchParams.get("forme") ?? "");
    setLocalSaison(searchParams.get("saison") ?? "");
  }, [searchParams]);

  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (!value || value === ALL_VALUE) {
      params.delete(key);
    } else {
      params.set(key, value);
    }
    // useTransition : la navigation est non-bloquante
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  }

  function handlePhaseChange(value: string) {
    if (value === ALL_VALUE || isValidPhase(value)) {
      setLocalPhase(value === ALL_VALUE ? "" : value); // mise à jour locale immédiate
      updateParam("phase", value);
    }
  }
  function handleTailleChange(value: string) {
    if (value === ALL_VALUE || isValidTaille(value)) {
      setLocalTaille(value === ALL_VALUE ? "" : value);
      updateParam("taille", value);
    }
  }
  function handleFormeChange(value: string) {
    if (value === ALL_VALUE || isValidForme(value)) {
      setLocalForme(value === ALL_VALUE ? "" : value);
      updateParam("forme", value);
    }
  }
  function handleSaisonChange(value: string) {
    if (value === ALL_VALUE || isValidSaison(value)) {
      setLocalSaison(value === ALL_VALUE ? "" : value);
      updateParam("saison", value);
    }
  }

  return (
    <div className={`grid grid-cols-2 gap-2 md:grid-cols-4 transition-opacity ${isPending ? "opacity-60" : ""}`}>
      {/* Phase d'elevage */}
      <Select
        value={isValidPhase(localPhase) ? localPhase : ALL_VALUE}
        onValueChange={handlePhaseChange}
      >
        <SelectTrigger label={tAnalytics("filtres.phase")}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL_VALUE}>{tAnalytics("filtres.toutes")}</SelectItem>
          {Object.values(PhaseElevage).map((phase) => (
            <SelectItem key={phase} value={phase}>
              {tSettings(`phases.${phase}`)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Taille granule */}
      <Select
        value={isValidTaille(localTaille) ? localTaille : ALL_VALUE}
        onValueChange={handleTailleChange}
      >
        <SelectTrigger label={tAnalytics("filtres.taille")}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL_VALUE}>{tAnalytics("filtres.toutes")}</SelectItem>
          {Object.values(TailleGranule).map((taille) => (
            <SelectItem key={taille} value={taille}>
              {tAnalytics(`tailleGranule.${taille}`)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Forme aliment */}
      <Select
        value={isValidForme(localForme) ? localForme : ALL_VALUE}
        onValueChange={handleFormeChange}
      >
        <SelectTrigger label={tAnalytics("filtres.forme")}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL_VALUE}>{tAnalytics("filtres.toutes")}</SelectItem>
          {Object.values(FormeAliment).map((forme) => (
            <SelectItem key={forme} value={forme}>
              {tAnalytics(`formeAliment.${forme}`)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Saison */}
      <Select
        value={isValidSaison(localSaison) ? localSaison : ALL_VALUE}
        onValueChange={handleSaisonChange}
      >
        <SelectTrigger label={tAnalytics("filtres.saison")}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL_VALUE}>{tAnalytics("filtres.toutes")}</SelectItem>
          <SelectItem value="SECHE">{tAnalytics("filtres.saisonSeche")}</SelectItem>
          <SelectItem value="PLUIES">{tAnalytics("filtres.saisonPluies")}</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
