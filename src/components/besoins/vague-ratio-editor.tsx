"use client";

import { useTranslations } from "next-intl";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface VagueRatioItem {
  vagueId: string;
  ratio: number;
}

interface VagueOption {
  id: string;
  code: string;
}

interface VagueRatioEditorProps {
  /** Vagues disponibles sur le site */
  vagues: VagueOption[];
  /** Valeur courante (tableau de paires vagueId/ratio) */
  value: VagueRatioItem[];
  /** Callback de mise a jour */
  onChange: (value: VagueRatioItem[]) => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Convertit un ratio [0,1] en pourcentage [0,100] affiche */
function ratioPct(ratio: number): string {
  return String(Math.round(ratio * 1000) / 10);
}

/** Convertit un pourcentage saisi en ratio [0,1] */
function pctToRatio(pct: string): number {
  const n = parseFloat(pct);
  if (isNaN(n)) return 0;
  return Math.min(1, Math.max(0, n / 100));
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function VagueRatioEditor({ vagues, value, onChange }: VagueRatioEditorProps) {
  const t = useTranslations("besoins");

  const totalPct = Math.round(value.reduce((acc, v) => acc + v.ratio, 0) * 1000) / 10;
  const isValid = value.length === 0 || Math.abs(totalPct - 100) < 0.1;

  // IDs deja selectionnes pour eviter les doublons
  const selectedIds = new Set(value.map((v) => v.vagueId));

  function addVague() {
    // Ajouter la premiere vague non encore selectionnee
    const available = vagues.find((v) => !selectedIds.has(v.id));
    if (!available) return;
    const newEntry: VagueRatioItem = {
      vagueId: available.id,
      ratio: value.length === 0 ? 1.0 : 0,
    };
    onChange([...value, newEntry]);
  }

  function removeVague(index: number) {
    const updated = value.filter((_, i) => i !== index);
    onChange(updated);
  }

  function updateVagueId(index: number, vagueId: string) {
    onChange(
      value.map((item, i) => (i === index ? { ...item, vagueId } : item))
    );
  }

  function updateRatio(index: number, pct: string) {
    onChange(
      value.map((item, i) =>
        i === index ? { ...item, ratio: pctToRatio(pct) } : item
      )
    );
  }

  function autoBalance() {
    if (value.length === 0) return;
    const base = Math.floor((100 / value.length) * 10) / 10;
    const totalBase = base * (value.length - 1);
    const last = Math.round((100 - totalBase) * 10) / 10;
    onChange(
      value.map((item, i) => ({
        ...item,
        ratio: i === value.length - 1 ? last / 100 : base / 100,
      }))
    );
  }

  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{t("vagueEditor.titre")}</span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 px-2 text-xs"
          onClick={addVague}
          disabled={value.length >= vagues.length}
        >
          <Plus className="h-3 w-3 mr-1" />
          {t("vagueEditor.ajouter")}
        </Button>
      </div>

      {/* Empty state */}
      {value.length === 0 && (
        <p className="text-xs text-muted-foreground italic py-1">
          {t("vagueEditor.aucuneVague")}
        </p>
      )}

      {/* Rows */}
      {value.length > 0 && (
        <div className="space-y-2">
          {value.map((item, index) => (
            <div
              key={index}
              className="flex items-center gap-2"
            >
              {/* Vague select */}
              <div className="flex-1 min-w-0">
                <Select
                  value={item.vagueId}
                  onValueChange={(v) => updateVagueId(index, v)}
                >
                  <SelectTrigger className="h-9 text-sm w-full">
                    <SelectValue placeholder={t("vagueEditor.selectVague")} />
                  </SelectTrigger>
                  <SelectContent>
                    {vagues.map((v) => (
                      <SelectItem
                        key={v.id}
                        value={v.id}
                        disabled={selectedIds.has(v.id) && v.id !== item.vagueId}
                      >
                        {v.code}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Ratio % input */}
              <div className="w-20 flex items-center gap-1">
                <Input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={ratioPct(item.ratio)}
                  onChange={(e) => updateRatio(index, e.target.value)}
                  className="h-9 text-sm text-right pr-1"
                />
                <span className="text-xs text-muted-foreground">%</span>
              </div>

              {/* Delete */}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-9 w-9 p-0 text-destructive hover:text-destructive hover:bg-destructive/10 flex-shrink-0"
                onClick={() => removeVague(index)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}

          {/* Footer: total + auto-balance */}
          <div className="flex items-center justify-between pt-1">
            <span
              className={`text-xs font-medium ${
                isValid ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"
              }`}
            >
              {t("vagueEditor.total")} {totalPct.toFixed(1)} %
              {isValid ? " ✓" : " ✗"}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
              onClick={autoBalance}
            >
              {t("vagueEditor.equilibrer")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
