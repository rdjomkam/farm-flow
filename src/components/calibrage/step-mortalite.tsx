"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CheckCircle2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface StepMortaliteProps {
  nombreMorts: string;
  notes: string;
  date: string;
  totalSourcePoissons: number;
  totalGroupePoissons: number;
  onChangeMorts: (value: string) => void;
  onChangeNotes: (value: string) => void;
  onChangeDate: (value: string) => void;
  onNext: () => void;
  onBack: () => void;
}

export function StepMortalite({
  nombreMorts,
  notes,
  date,
  totalSourcePoissons,
  totalGroupePoissons,
  onChangeMorts,
  onChangeNotes,
  onChangeDate,
  onNext,
  onBack,
}: StepMortaliteProps) {
  const morts = Number(nombreMorts) || 0;
  const total = totalGroupePoissons + morts;
  const isBalanced = total === totalSourcePoissons;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-base font-semibold">Mortalite</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Indiquez le nombre de poissons morts lors du calibrage.
        </p>
      </div>

      {/* Equation visuelle */}
      <div
        className={cn(
          "rounded-xl border p-4",
          isBalanced
            ? "border-success/30 bg-success/5"
            : "border-danger/30 bg-danger/5"
        )}
      >
        <div className="flex items-center gap-2 mb-2">
          {isBalanced ? (
            <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
          ) : (
            <XCircle className="h-4 w-4 text-danger shrink-0" />
          )}
          <p
            className={`text-sm font-semibold ${
              isBalanced ? "text-success" : "text-danger"
            }`}
          >
            {isBalanced ? "Conservation respectee" : "Conservation non respectee"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm font-mono">
          <span className="bg-card rounded px-2 py-0.5 border border-border">
            Source : {totalSourcePoissons}
          </span>
          <span className="text-muted-foreground">=</span>
          <span className="bg-card rounded px-2 py-0.5 border border-border">
            Groupes : {totalGroupePoissons}
          </span>
          <span className="text-muted-foreground">+</span>
          <span
            className={cn(
              "rounded px-2 py-0.5 border",
              morts > 0
                ? "bg-danger/10 border-danger/30 text-danger"
                : "bg-card border-border"
            )}
          >
            Morts : {morts}
          </span>
          <span className="text-muted-foreground">=</span>
          <span
            className={cn(
              "rounded px-2 py-0.5 border font-semibold",
              isBalanced
                ? "bg-success/10 border-success/30 text-success"
                : "bg-danger/10 border-danger/30 text-danger"
            )}
          >
            {total}
          </span>
        </div>
        {!isBalanced && (
          <p className="text-xs text-danger mt-2">
            {total < totalSourcePoissons
              ? `Il manque ${totalSourcePoissons - total} poissons.`
              : `${total - totalSourcePoissons} poissons en trop.`}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-foreground">
          Date et heure du calibrage
        </label>
        <input
          type="datetime-local"
          className={cn(
            "flex w-full rounded-lg border border-border bg-transparent px-3 py-2.5 text-base",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
          )}
          value={date}
          onChange={(e) => onChangeDate(e.target.value)}
        />
      </div>

      <Input
        label="Nombre de morts"
        type="number"
        inputMode="numeric"
        min={0}
        placeholder="0"
        value={nombreMorts}
        onChange={(e) => onChangeMorts(e.target.value)}
      />

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-foreground">
          Notes (optionnel)
        </label>
        <textarea
          className={cn(
            "flex min-h-[88px] w-full rounded-lg border border-border bg-transparent px-3 py-2.5 text-base",
            "placeholder:text-muted-foreground",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
            "disabled:cursor-not-allowed disabled:opacity-50",
            "resize-none"
          )}
          placeholder="Observations, conditions du calibrage..."
          value={notes}
          onChange={(e) => onChangeNotes(e.target.value)}
          rows={3}
        />
      </div>

      <div className="flex gap-3">
        <Button type="button" variant="outline" onClick={onBack} className="flex-1">
          Retour
        </Button>
        <Button
          type="button"
          onClick={onNext}
          disabled={!isBalanced}
          className="flex-1"
        >
          Suivant
        </Button>
      </div>
    </div>
  );
}
