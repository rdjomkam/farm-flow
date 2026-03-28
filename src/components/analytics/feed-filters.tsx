"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
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
  const tAnalytics = useTranslations("analytics");
  const tSettings = useTranslations("settings");

  const currentPhase = searchParams.get("phase") ?? "";
  const currentTaille = searchParams.get("taille") ?? "";
  const currentForme = searchParams.get("forme") ?? "";
  const currentSaison = searchParams.get("saison") ?? "";

  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (!value || value === ALL_VALUE) {
      params.delete(key);
    } else {
      params.set(key, value);
    }
    router.push(`${pathname}?${params.toString()}`);
  }

  function handlePhaseChange(value: string) {
    if (value === ALL_VALUE || isValidPhase(value)) {
      updateParam("phase", value);
    }
  }
  function handleTailleChange(value: string) {
    if (value === ALL_VALUE || isValidTaille(value)) {
      updateParam("taille", value);
    }
  }
  function handleFormeChange(value: string) {
    if (value === ALL_VALUE || isValidForme(value)) {
      updateParam("forme", value);
    }
  }
  function handleSaisonChange(value: string) {
    if (value === ALL_VALUE || isValidSaison(value)) {
      updateParam("saison", value);
    }
  }

  return (
    <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
      {/* Phase d'elevage */}
      <Select
        value={isValidPhase(currentPhase) ? currentPhase : ALL_VALUE}
        onValueChange={handlePhaseChange}
      >
        <SelectTrigger label={tAnalytics("filtres.phase")} />
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
        value={isValidTaille(currentTaille) ? currentTaille : ALL_VALUE}
        onValueChange={handleTailleChange}
      >
        <SelectTrigger label={tAnalytics("filtres.taille")} />
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
        value={isValidForme(currentForme) ? currentForme : ALL_VALUE}
        onValueChange={handleFormeChange}
      >
        <SelectTrigger label={tAnalytics("filtres.forme")} />
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
        value={isValidSaison(currentSaison) ? currentSaison : ALL_VALUE}
        onValueChange={handleSaisonChange}
      >
        <SelectTrigger label={tAnalytics("filtres.saison")} />
        <SelectContent>
          <SelectItem value={ALL_VALUE}>{tAnalytics("filtres.toutes")}</SelectItem>
          <SelectItem value="SECHE">{tAnalytics("filtres.saisonSeche")}</SelectItem>
          <SelectItem value="PLUIES">{tAnalytics("filtres.saisonPluies")}</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
