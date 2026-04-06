"use client";

import { useState, useEffect } from "react";
import { TypeReleve, StatutVague } from "@/types";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ALL_VALUE } from "@/lib/releve-search-params";
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
  onApply: (params: Partial<ReleveSearchParams>) => void;
  onClear: () => void;
  activeCount: number;
}

export function RelevesFilterSheet({
  current,
  vagues,
  onApply,
  onClear,
  activeCount,
}: Props) {
  // Etat local du sheet : les modifications ne s'appliquent qu'au clic "Appliquer"
  const [localVagueId, setLocalVagueId] = useState(current.vagueId ?? ALL_VALUE);
  const [localBacId, setLocalBacId] = useState(current.bacId ?? ALL_VALUE);
  const [localType, setLocalType] = useState(current.typeReleve ?? ALL_VALUE);
  const [localDateFrom, setLocalDateFrom] = useState(current.dateFrom ?? "");
  const [localDateTo, setLocalDateTo] = useState(current.dateTo ?? "");
  const [localModifie, setLocalModifie] = useState(current.modifie === "true");

  // Bacs charges dynamiquement selon la vague selectionnee
  const [bacs, setBacs] = useState<BacOption[]>([]);
  const [bacsLoading, setBacsLoading] = useState(false);

  // Synchroniser avec les filtres actuels quand ils changent (retour navigateur)
  useEffect(() => {
    setLocalVagueId(current.vagueId ?? ALL_VALUE);
    setLocalBacId(current.bacId ?? ALL_VALUE);
    setLocalType(current.typeReleve ?? ALL_VALUE);
    setLocalDateFrom(current.dateFrom ?? "");
    setLocalDateTo(current.dateTo ?? "");
    setLocalModifie(current.modifie === "true");
  }, [current]);

  // Charger les bacs quand la vague locale change
  useEffect(() => {
    if (!localVagueId || localVagueId === ALL_VALUE) {
      setBacs([]);
      setLocalBacId(ALL_VALUE);
      return;
    }
    setBacsLoading(true);
    fetch(`/api/bacs?vagueId=${localVagueId}`)
      .then((r) => r.json())
      .then((d: { data?: BacOption[] }) => {
        setBacs(d.data ?? []);
      })
      .catch(() => setBacs([]))
      .finally(() => setBacsLoading(false));
  }, [localVagueId]);

  function handleVagueChange(value: string) {
    setLocalVagueId(value);
    setLocalBacId(ALL_VALUE); // reset bac quand vague change
  }

  function handleApply() {
    onApply({
      vagueId: localVagueId !== ALL_VALUE ? localVagueId : undefined,
      bacId: localBacId !== ALL_VALUE ? localBacId : undefined,
      typeReleve: localType !== ALL_VALUE ? localType : undefined,
      dateFrom: localDateFrom || undefined,
      dateTo: localDateTo || undefined,
      modifie: localModifie ? "true" : undefined,
    });
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Vague */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium">Vague</label>
        <Select value={localVagueId} onValueChange={handleVagueChange}>
          <SelectTrigger>
            <SelectValue placeholder="Toutes les vagues" />
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
      </div>

      {/* Bac — desactive si pas de vague selectionnee */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium">Bac</label>
        <Select
          value={localBacId}
          onValueChange={setLocalBacId}
          disabled={localVagueId === ALL_VALUE || bacsLoading}
        >
          <SelectTrigger>
            <SelectValue
              placeholder={
                localVagueId === ALL_VALUE
                  ? "Sélectionnez d'abord une vague"
                  : bacsLoading
                  ? "Chargement..."
                  : "Tous les bacs"
              }
            />
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
      </div>

      {/* Type de releve */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium">Type de relevé</label>
        <Select value={localType} onValueChange={setLocalType}>
          <SelectTrigger>
            <SelectValue placeholder="Tous les types" />
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
      </div>

      {/* Periode */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium">Période</label>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground w-5">Du</span>
          <input
            type="date"
            value={localDateFrom}
            onChange={(e) => setLocalDateFrom(e.target.value)}
            className="flex-1 h-10 rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground w-5">Au</span>
          <input
            type="date"
            value={localDateTo}
            onChange={(e) => setLocalDateTo(e.target.value)}
            className="flex-1 h-10 rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      </div>

      {/* Modifies seulement — checkbox native (pas de Switch Radix disponible) */}
      <label className="flex items-center gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={localModifie}
          onChange={(e) => setLocalModifie(e.target.checked)}
          className="h-4 w-4 rounded border-input accent-primary cursor-pointer"
        />
        <span className="text-sm">Relevés modifiés seulement</span>
      </label>

      {/* Boutons */}
      <div className="flex gap-2 pt-2">
        <button
          type="button"
          onClick={onClear}
          className="flex-1 h-10 rounded-md border border-border bg-background text-sm font-medium text-muted-foreground hover:bg-accent transition-colors"
        >
          Effacer tout
        </button>
        <button
          type="button"
          onClick={handleApply}
          className="flex-1 h-10 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          Appliquer{activeCount > 0 ? ` (${activeCount})` : ""}
        </button>
      </div>
    </div>
  );
}
