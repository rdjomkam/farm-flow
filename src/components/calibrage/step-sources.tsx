"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CheckCircle2, Circle, Fish } from "lucide-react";
import type { BacResponse } from "@/types";

interface StepSourcesProps {
  bacs: BacResponse[];
  selectedBacIds: string[];
  onToggle: (bacId: string) => void;
  onNext: () => void;
  error?: string;
}

export function StepSources({
  bacs,
  selectedBacIds,
  onToggle,
  onNext,
  error,
}: StepSourcesProps) {
  const selectedBacs = bacs.filter((b) => selectedBacIds.includes(b.id));
  const totalPoissons = selectedBacs.reduce(
    (sum, b) => sum + (b.nombrePoissons ?? 0),
    0
  );

  const bacsAvecPoissons = bacs.filter((b) => (b.nombrePoissons ?? 0) > 0);
  const bacsVides = bacs.filter((b) => (b.nombrePoissons ?? 0) === 0);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-base font-semibold">Bacs sources</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Selectionnez les bacs dont les poissons seront calibres.
        </p>
      </div>

      {bacsAvecPoissons.length === 0 && (
        <div className="rounded-xl border border-border bg-muted/50 p-4 text-sm text-muted-foreground text-center">
          Aucun bac de cette vague ne contient de poissons.
        </div>
      )}

      <div className="flex flex-col gap-2">
        {bacsAvecPoissons.map((bac) => {
          const isSelected = selectedBacIds.includes(bac.id);
          return (
            <button
              key={bac.id}
              type="button"
              onClick={() => onToggle(bac.id)}
              className={cn(
                "flex items-center gap-3 w-full rounded-xl border p-4 text-left transition-colors min-h-[56px]",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
                isSelected
                  ? "border-primary bg-primary/5"
                  : "border-border bg-card hover:border-primary/30"
              )}
            >
              {isSelected ? (
                <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
              ) : (
                <Circle className="h-5 w-5 text-muted-foreground shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">{bac.nom}</p>
                <p className="text-xs text-muted-foreground">
                  {bac.nombrePoissons ?? 0} poissons — {bac.volume} L
                </p>
              </div>
            </button>
          );
        })}

        {bacsVides.map((bac) => (
          <div
            key={bac.id}
            className="flex items-center gap-3 w-full rounded-xl border border-border/50 bg-muted/30 p-4 opacity-50"
          >
            <Circle className="h-5 w-5 text-muted-foreground shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm">{bac.nom}</p>
              <p className="text-xs text-muted-foreground">
                Vide — {bac.volume} L
              </p>
            </div>
          </div>
        ))}
      </div>

      {selectedBacIds.length > 0 && (
        <div className="flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/5 p-3">
          <Fish className="h-4 w-4 text-primary shrink-0" />
          <p className="text-sm text-primary font-medium">
            {totalPoissons} poissons a calibrer ({selectedBacIds.length} bac
            {selectedBacIds.length > 1 ? "s" : ""} selectionne
            {selectedBacIds.length > 1 ? "s" : ""})
          </p>
        </div>
      )}

      {error && <p className="text-sm text-danger">{error}</p>}

      <Button
        type="button"
        onClick={onNext}
        disabled={selectedBacIds.length === 0 || totalPoissons === 0}
        className="w-full"
      >
        Suivant
      </Button>
    </div>
  );
}
