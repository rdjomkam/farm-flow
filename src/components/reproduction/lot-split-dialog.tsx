"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Plus, Trash2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { useApi } from "@/hooks/use-api";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SousLotInput {
  id: string; // local key only
  code: string;
  nombrePoissons: string;
  bacId: string;
  notes: string;
}

interface ParentLotInfo {
  id: string;
  code: string;
  nombreActuel: number;
}

interface LotSplitDialogProps {
  lot: ParentLotInfo;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (sousLots: unknown[]) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function createEmptySousLot(): SousLotInput {
  return {
    id: crypto.randomUUID(),
    code: "",
    nombrePoissons: "",
    bacId: "",
    notes: "",
  };
}

export function LotSplitDialog({
  lot,
  open,
  onOpenChange,
  onSuccess,
}: LotSplitDialogProps) {
  const t = useTranslations("reproduction.lots");
  const { call } = useApi();

  const [sousLots, setSousLots] = useState<SousLotInput[]>([
    createEmptySousLot(),
  ]);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Compute total poissons assigned
  const totalAssigned = sousLots.reduce((acc, sl) => {
    const n = parseInt(sl.nombrePoissons, 10);
    return acc + (isNaN(n) ? 0 : n);
  }, 0);

  const remaining = lot.nombreActuel - totalAssigned;
  const isOverflow = totalAssigned > lot.nombreActuel;

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  function addSousLot() {
    setSousLots((prev) => [...prev, createEmptySousLot()]);
  }

  function removeSousLot(id: string) {
    setSousLots((prev) => prev.filter((sl) => sl.id !== id));
  }

  function updateSousLot(id: string, field: keyof SousLotInput, value: string) {
    setSousLots((prev) =>
      prev.map((sl) => (sl.id === id ? { ...sl, [field]: value } : sl))
    );
    // Clear related error
    setErrors((prev) => {
      const next = { ...prev };
      delete next[`${id}.${field}`];
      return next;
    });
  }

  function validate(): boolean {
    const newErrors: Record<string, string> = {};

    if (isOverflow) {
      newErrors.global = t("split.erreurDepassement", {
        total: totalAssigned,
        max: lot.nombreActuel,
      });
    }

    sousLots.forEach((sl, index) => {
      const n = parseInt(sl.nombrePoissons, 10);
      if (!sl.nombrePoissons.trim() || isNaN(n) || n <= 0) {
        newErrors[`${sl.id}.nombrePoissons`] = t("split.erreurNombrePoissons", {
          index: index + 1,
        });
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit() {
    if (!validate()) return;

    setLoading(true);
    const payload = {
      sousLots: sousLots.map((sl) => ({
        nombrePoissons: parseInt(sl.nombrePoissons, 10),
        code: sl.code.trim() || undefined,
        bacId: sl.bacId.trim() || undefined,
        notes: sl.notes.trim() || undefined,
      })),
    };

    const result = await call<{ data: unknown[]; total: number }>(
      `/api/reproduction/lots/${lot.id}/split`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
      { successMessage: t("split.successMessage") }
    );

    setLoading(false);
    if (result.ok && result.data) {
      handleReset();
      onSuccess(result.data.data);
    }
  }

  function handleReset() {
    setSousLots([createEmptySousLot()]);
    setErrors({});
  }

  function handleOpenChange(isOpen: boolean) {
    if (!isOpen) handleReset();
    onOpenChange(isOpen);
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("split.title")}</DialogTitle>
        </DialogHeader>

        {/* Parent lot info */}
        <div className="rounded-lg bg-muted/50 px-4 py-3 text-sm flex flex-col gap-1">
          <p>
            <span className="text-muted-foreground">{t("split.lotParent")}: </span>
            <span className="font-semibold">{lot.code}</span>
          </p>
          <p>
            <span className="text-muted-foreground">
              {t("split.poissonsDisponibles")}:{" "}
            </span>
            <span className="font-semibold">{lot.nombreActuel}</span>
          </p>
        </div>

        {/* Live counter */}
        <div
          className={`rounded-lg px-4 py-3 text-sm font-medium ${
            isOverflow
              ? "bg-accent-red-muted text-accent-red"
              : "bg-accent-green-muted text-accent-green"
          }`}
        >
          {isOverflow ? (
            <span className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
              {t("split.depassement", {
                total: totalAssigned,
                max: lot.nombreActuel,
              })}
            </span>
          ) : (
            <span>
              {t("split.restants", { count: remaining })}
            </span>
          )}
        </div>

        {/* Global error */}
        {errors.global && (
          <p className="text-sm text-accent-red">{errors.global}</p>
        )}

        {/* Sous-lots form */}
        <div className="flex flex-col gap-4 py-1">
          {sousLots.map((sl, index) => (
            <div
              key={sl.id}
              className="rounded-lg border border-border p-4 flex flex-col gap-3"
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">
                  {t("split.sousLot")} {index + 1}
                </p>
                {sousLots.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeSousLot(sl.id)}
                    aria-label={t("split.supprimer")}
                    className="p-1 rounded text-muted-foreground hover:text-destructive transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </button>
                )}
              </div>

              {/* nombrePoissons — required */}
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium">
                  {t("split.nombrePoissons")}{" "}
                  <span className="text-accent-red" aria-hidden="true">*</span>
                </label>
                <Input
                  type="number"
                  min={1}
                  placeholder={t("split.nombrePoissonsPlaceholder")}
                  value={sl.nombrePoissons}
                  onChange={(e) =>
                    updateSousLot(sl.id, "nombrePoissons", e.target.value)
                  }
                  className={
                    errors[`${sl.id}.nombrePoissons`]
                      ? "border-destructive"
                      : ""
                  }
                />
                {errors[`${sl.id}.nombrePoissons`] && (
                  <p className="text-xs text-accent-red">
                    {errors[`${sl.id}.nombrePoissons`]}
                  </p>
                )}
              </div>

              {/* code — optional */}
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium">
                  {t("split.code")}
                </label>
                <Input
                  placeholder={t("split.codePlaceholder", {
                    parent: lot.code,
                    suffix: "ABCDEFGHIJKLMNOPQRSTUVWXYZ"[index] ?? String(index + 1),
                  })}
                  value={sl.code}
                  onChange={(e) => updateSousLot(sl.id, "code", e.target.value)}
                />
              </div>

              {/* notes — optional */}
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium">
                  {t("split.notes")}
                </label>
                <textarea
                  className="min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
                  placeholder={t("split.notesPlaceholder")}
                  value={sl.notes}
                  onChange={(e) => updateSousLot(sl.id, "notes", e.target.value)}
                />
              </div>
            </div>
          ))}
        </div>

        {/* Add sous-lot button */}
        <Button
          type="button"
          variant="outline"
          onClick={addSousLot}
          className="w-full min-h-[44px]"
        >
          <Plus className="h-4 w-4 mr-2" aria-hidden="true" />
          {t("split.ajouterSousLot")}
        </Button>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" className="min-h-[44px]">
              {t("split.annuler")}
            </Button>
          </DialogClose>
          <Button
            onClick={handleSubmit}
            disabled={loading || isOverflow || sousLots.length === 0}
            className="min-h-[44px]"
          >
            {loading ? t("split.loading") : t("split.fractionner")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
