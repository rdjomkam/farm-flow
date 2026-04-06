"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition, useState, useEffect } from "react";
import { SlidersHorizontal } from "lucide-react";
import { TypeReleve, StatutVague } from "@/types";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";
import { RelevesFilterSheet } from "./releves-filter-sheet";
import { countActiveFilters, ALL_VALUE, ALL_FILTER_PARAMS } from "@/lib/releve-search-params";
import type { ReleveSearchParams } from "@/lib/releve-search-params";

interface BacOption {
  id: string;
  nom: string;
}

interface VagueOption {
  id: string;
  code: string;
  statut: StatutVague;
}

// Validation whitelist pour TypeReleve
function isValidTypeReleve(value: string): value is TypeReleve {
  return Object.values(TypeReleve).includes(value as TypeReleve);
}

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
  vagues: VagueOption[];
}

export function ReleveFilterBar({ current, vagues }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [sheetOpen, setSheetOpen] = useState(false);

  // Etat local synchronise avec les searchParams
  const [localVagueId, setLocalVagueId] = useState(current.vagueId ?? "");
  const [localBacId, setLocalBacId] = useState(current.bacId ?? "");
  const [localType, setLocalType] = useState(current.typeReleve ?? "");
  const [localDateFrom, setLocalDateFrom] = useState(current.dateFrom ?? "");
  const [localDateTo, setLocalDateTo] = useState(current.dateTo ?? "");
  const [localModifie, setLocalModifie] = useState(current.modifie === "true");

  // Bacs charges dynamiquement pour la barre desktop
  const [bacs, setBacs] = useState<BacOption[]>([]);
  const [bacsLoading, setBacsLoading] = useState(false);

  // Synchroniser avec les searchParams (retour navigateur)
  useEffect(() => {
    setLocalVagueId(searchParams.get("vagueId") ?? "");
    setLocalBacId(searchParams.get("bacId") ?? "");
    setLocalType(searchParams.get("typeReleve") ?? "");
    setLocalDateFrom(searchParams.get("dateFrom") ?? "");
    setLocalDateTo(searchParams.get("dateTo") ?? "");
    setLocalModifie(searchParams.get("modifie") === "true");
  }, [searchParams]);

  // Charger les bacs pour la barre desktop
  useEffect(() => {
    if (!localVagueId) {
      setBacs([]);
      setLocalBacId("");
      return;
    }
    setBacsLoading(true);
    fetch(`/api/bacs?vagueId=${localVagueId}`)
      .then((r) => r.json())
      .then((d: { data?: BacOption[] }) => setBacs(d.data ?? []))
      .catch(() => setBacs([]))
      .finally(() => setBacsLoading(false));
  }, [localVagueId]);

  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (!value || value === ALL_VALUE) {
      params.delete(key);
    } else {
      params.set(key, value);
    }
    params.delete("offset"); // reset pagination a chaque changement de filtre
    startTransition(() => {
      router.push(`/releves?${params.toString()}`);
    });
  }

  function updateMultipleParams(updates: Partial<ReleveSearchParams>) {
    const params = new URLSearchParams(searchParams.toString());
    // Reset TOUS les filtres (y compris les filtres specifiques) via ALL_FILTER_PARAMS
    ALL_FILTER_PARAMS.forEach((k) => params.delete(k));
    params.delete("offset");
    // Appliquer les nouvelles valeurs
    Object.entries(updates).forEach(([k, v]) => {
      if (v) params.set(k, v);
    });
    startTransition(() => {
      router.push(`/releves?${params.toString()}`);
    });
  }

  function resetAllFilters() {
    startTransition(() => {
      router.push("/releves");
    });
  }

  function handleVagueChange(value: string) {
    if (value === ALL_VALUE || !value) {
      setLocalVagueId("");
      setLocalBacId("");
      const params = new URLSearchParams(searchParams.toString());
      params.delete("vagueId");
      params.delete("bacId");
      params.delete("offset");
      startTransition(() => router.push(`/releves?${params.toString()}`));
    } else {
      setLocalVagueId(value);
      setLocalBacId("");
      const params = new URLSearchParams(searchParams.toString());
      params.set("vagueId", value);
      params.delete("bacId");
      params.delete("offset");
      startTransition(() => router.push(`/releves?${params.toString()}`));
    }
  }

  function handleBacChange(value: string) {
    setLocalBacId(value === ALL_VALUE ? "" : value);
    updateParam("bacId", value);
  }

  function handleTypeChange(value: string) {
    if (value === ALL_VALUE || isValidTypeReleve(value)) {
      setLocalType(value === ALL_VALUE ? "" : value);
      updateParam("typeReleve", value);
    }
  }

  function handleDateFromChange(value: string) {
    setLocalDateFrom(value);
    updateParam("dateFrom", value);
  }

  function handleDateToChange(value: string) {
    setLocalDateTo(value);
    updateParam("dateTo", value);
  }

  function handleModifieChange(checked: boolean) {
    setLocalModifie(checked);
    updateParam("modifie", checked ? "true" : "");
  }

  const activeCount = countActiveFilters({
    vagueId: localVagueId || undefined,
    bacId: localBacId || undefined,
    typeReleve: localType || undefined,
    dateFrom: localDateFrom || undefined,
    dateTo: localDateTo || undefined,
    modifie: localModifie ? "true" : undefined,
  });

  return (
    <div className={`transition-opacity ${isPending ? "opacity-60" : ""}`}>
      {/* Mobile : bouton "Filtres" + Sheet */}
      <div className="flex items-center justify-between gap-2 md:hidden">
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetTrigger asChild>
            <button
              type="button"
              className="inline-flex items-center gap-2 h-10 px-4 rounded-md border border-border bg-background text-sm font-medium hover:bg-accent transition-colors"
            >
              <SlidersHorizontal className="h-4 w-4" />
              Filtres
              {activeCount > 0 && (
                <span
                  className="inline-flex items-center justify-center rounded-full w-5 h-5 text-xs font-bold text-primary-foreground"
                  style={{ backgroundColor: "var(--primary)" }}
                >
                  {activeCount}
                </span>
              )}
            </button>
          </SheetTrigger>
          <SheetContent className="!left-auto !right-0 !inset-y-0 !w-full sm:!w-96 !p-0 flex flex-col" hideCloseButton>
            <RelevesFilterSheet
              current={{
                vagueId: localVagueId || undefined,
                bacId: localBacId || undefined,
                typeReleve: localType || undefined,
                dateFrom: localDateFrom || undefined,
                dateTo: localDateTo || undefined,
                modifie: localModifie ? "true" : undefined,
              }}
              vagues={vagues}
              onApply={(params) => { updateMultipleParams(params); setSheetOpen(false); }}
              onClear={() => { resetAllFilters(); setSheetOpen(false); }}
              activeCount={activeCount}
            />
          </SheetContent>
        </Sheet>
      </div>

      {/* Desktop (>= md) : barre inline */}
      <div className="hidden md:flex items-center gap-2 flex-wrap">
        {/* Vague */}
        <Select
          value={localVagueId || ALL_VALUE}
          onValueChange={handleVagueChange}
        >
          <SelectTrigger className="w-44" label="Vague">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_VALUE}>Toutes les vagues</SelectItem>
            {vagues.map((v) => (
              <SelectItem key={v.id} value={v.id}>
                {v.code}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Bac — desactive si pas de vague */}
        <Select
          value={localBacId || ALL_VALUE}
          onValueChange={handleBacChange}
          disabled={!localVagueId || bacsLoading}
        >
          <SelectTrigger className="w-36" label="Bac">
            <SelectValue placeholder={bacsLoading ? "..." : "Tous les bacs"} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_VALUE}>Tous les bacs</SelectItem>
            {bacs.map((b) => (
              <SelectItem key={b.id} value={b.id}>
                {b.nom}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Type */}
        <Select
          value={(localType && isValidTypeReleve(localType) ? localType : null) ?? ALL_VALUE}
          onValueChange={handleTypeChange}
        >
          <SelectTrigger className="w-44" label="Type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_VALUE}>Tous les types</SelectItem>
            {Object.values(TypeReleve).map((type) => (
              <SelectItem key={type} value={type}>
                {typeLabels[type]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Du */}
        <div className="flex items-center gap-1">
          <span className="text-sm text-muted-foreground">Du</span>
          <input
            type="date"
            value={localDateFrom}
            onChange={(e) => handleDateFromChange(e.target.value)}
            className="h-10 rounded-md border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        {/* Au */}
        <div className="flex items-center gap-1">
          <span className="text-sm text-muted-foreground">Au</span>
          <input
            type="date"
            value={localDateTo}
            onChange={(e) => handleDateToChange(e.target.value)}
            className="h-10 rounded-md border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        {/* Modifies */}
        <label className="flex items-center gap-2 cursor-pointer ml-1">
          <input
            type="checkbox"
            checked={localModifie}
            onChange={(e) => handleModifieChange(e.target.checked)}
            className="h-4 w-4 rounded border-border accent-primary cursor-pointer"
          />
          <span className="text-sm text-muted-foreground">Modifiés</span>
        </label>

        {/* Reset */}
        {activeCount > 0 && (
          <button
            type="button"
            onClick={resetAllFilters}
            className="text-sm text-muted-foreground hover:text-foreground underline ml-auto"
          >
            Effacer
          </button>
        )}
      </div>
    </div>
  );
}
