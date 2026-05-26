"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Plus, Trash2, AlertTriangle, Package } from "lucide-react";
import type { CreateArrivageDTO } from "@/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BacDisponibleInfo {
  id: string;
  nom: string;
  /** true si le bac est déjà assigné à cette vague (sinon bac libre) */
  dejaAssigne: boolean;
}

interface ArrivageFormClientProps {
  vagueId: string;
  vagueCode: string;
  bacsDisponibles: BacDisponibleInfo[];
}

// ---------------------------------------------------------------------------
// Form state
// ---------------------------------------------------------------------------

interface GroupeForm {
  destinationBacId: string;
  nombrePoissons: string;
  poidsMoyen: string;
}

const todayISO = () => new Date().toISOString().slice(0, 10);

const DEFAULT_GROUPE: GroupeForm = {
  destinationBacId: "",
  nombrePoissons: "",
  poidsMoyen: "",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ArrivageFormClient({
  vagueId,
  vagueCode,
  bacsDisponibles,
}: ArrivageFormClientProps) {
  const t = useTranslations("arrivages");
  const router = useRouter();
  const { toast } = useToast();

  const [date, setDate] = useState(todayISO());
  const [origine, setOrigine] = useState("");
  const [notes, setNotes] = useState("");
  const [groupes, setGroupes] = useState<GroupeForm[]>([{ ...DEFAULT_GROUPE }]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ---------------------------------------------------------------------------
  // Groupes helpers
  // ---------------------------------------------------------------------------

  function updateGroupe(index: number, field: keyof GroupeForm, value: string) {
    setGroupes((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  }

  function addGroupe() {
    setGroupes((prev) => [...prev, { ...DEFAULT_GROUPE }]);
  }

  function removeGroupe(index: number) {
    setGroupes((prev) => prev.filter((_, i) => i !== index));
  }

  // ---------------------------------------------------------------------------
  // Validation
  // ---------------------------------------------------------------------------

  function validate(): boolean {
    const errs: Record<string, string> = {};

    if (groupes.length === 0) {
      errs["groupes"] = t("errors.minDestination");
    }

    const usedBacs = new Set<string>();

    groupes.forEach((g, i) => {
      if (!g.destinationBacId) {
        errs[`g${i}_bac`] = t("errors.minDestination");
      } else {
        if (usedBacs.has(g.destinationBacId)) {
          errs[`g${i}_bac`] = t("errors.duplicateBac");
        }
        usedBacs.add(g.destinationBacId);
      }

      const qty = Number(g.nombrePoissons);
      if (!g.nombrePoissons || isNaN(qty) || qty <= 0) {
        errs[`g${i}_qty`] = t("errors.qtyInvalid");
      }

      const pm = Number(g.poidsMoyen);
      if (!g.poidsMoyen || isNaN(pm) || pm <= 0) {
        errs[`g${i}_poids`] = t("errors.poidsInvalid");
      }
    });

    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  // ---------------------------------------------------------------------------
  // Submit
  // ---------------------------------------------------------------------------

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      const dto: CreateArrivageDTO = {
        vagueId,
        date: date ? new Date(date).toISOString() : undefined,
        origine: origine.trim() || undefined,
        notes: notes.trim() || undefined,
        groupes: groupes.map((g) => ({
          destinationBacId: g.destinationBacId,
          nombrePoissons: Number(g.nombrePoissons),
          poidsMoyen: Number(g.poidsMoyen),
        })),
      };

      const response = await fetch("/api/arrivages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dto),
      });

      if (response.status === 201) {
        toast({ title: t("success"), variant: "success" });
        router.push(`/vagues/${vagueId}`);
      } else {
        const err = await response.json().catch(() => ({}));
        toast({
          title: err.message ?? t("error.generic"),
          variant: "error",
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Derived — recap
  // ---------------------------------------------------------------------------

  const totalPoissons = groupes.reduce((sum, g) => sum + (Number(g.nombrePoissons) || 0), 0);
  const totalPondere = groupes.reduce(
    (sum, g) => sum + (Number(g.nombrePoissons) || 0) * (Number(g.poidsMoyen) || 0),
    0
  );
  const poidsMoyenPondere = totalPoissons > 0 ? totalPondere / totalPoissons : 0;
  const biomasseTotaleKg = totalPondere / 1000;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6 pb-40 sm:pb-24">

      {/* Section 1 — Informations générales */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Package className="h-4 w-4 text-primary" />
            {t("page.subtitle")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4">
            <Input
              label={t("form.date")}
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />

            <Input
              label={t("form.origine")}
              placeholder={t("form.originePlaceholder")}
              value={origine}
              onChange={(e) => setOrigine(e.target.value)}
            />

            <Textarea
              label={t("form.notes")}
              placeholder=""
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      {/* Section 2 — Destinations */}
      <div className="flex flex-col gap-3">
        <h2 className="text-base font-semibold">{t("form.destinations")}</h2>

        {errors["groupes"] && (
          <p className="text-sm text-danger flex items-center gap-1.5">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {errors["groupes"]}
          </p>
        )}

        <div className="flex flex-col gap-3">
          {groupes.map((g, i) => (
            <Card key={i}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">
                    {t("form.destinationLabel")} {i + 1}
                  </CardTitle>
                  {groupes.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeGroupe(i)}
                      className="text-muted-foreground hover:text-danger p-1 rounded-lg transition-colors"
                      aria-label={t("form.removeDestination")}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col gap-3">
                  {/* Bac destination */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-foreground">
                      {t("form.destinationLabel")}
                      <span className="text-destructive ml-0.5">*</span>
                    </label>
                    <Select
                      value={g.destinationBacId}
                      onValueChange={(v) => updateGroupe(i, "destinationBacId", v)}
                    >
                      <SelectTrigger error={errors[`g${i}_bac`]}>
                        <SelectValue placeholder={t("form.destinationLabel")} />
                      </SelectTrigger>
                      <SelectContent>
                        {bacsDisponibles.length === 0 ? (
                          <SelectItem value="__empty__" disabled>
                            Aucun bac disponible
                          </SelectItem>
                        ) : (
                          bacsDisponibles.map((b) => (
                            <SelectItem key={b.id} value={b.id}>
                              {b.nom}
                              {b.dejaAssigne ? " (assigné à cette vague)" : " (libre)"}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                    {errors[`g${i}_bac`] && (
                      <p className="text-xs text-danger flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3 shrink-0" />
                        {errors[`g${i}_bac`]}
                      </p>
                    )}
                  </div>

                  {/* Nombre poissons + poids moyen */}
                  <div className="grid grid-cols-2 gap-3">
                    <Input
                      label={t("form.nombrePoissonsLabel")}
                      required
                      type="number"
                      min="1"
                      step="1"
                      value={g.nombrePoissons}
                      onChange={(e) => updateGroupe(i, "nombrePoissons", e.target.value)}
                      error={errors[`g${i}_qty`]}
                    />
                    <Input
                      label={t("form.poidsMoyenLabel")}
                      required
                      type="number"
                      min="0.1"
                      step="0.1"
                      value={g.poidsMoyen}
                      onChange={(e) => updateGroupe(i, "poidsMoyen", e.target.value)}
                      error={errors[`g${i}_poids`]}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Button
          variant="outline"
          type="button"
          onClick={addGroupe}
          className="w-full min-h-[44px]"
        >
          <Plus className="h-4 w-4" />
          {t("form.addDestination")}
        </Button>
      </div>

      {/* Section 3 — Récapitulatif */}
      {totalPoissons > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">{t("form.recap")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="flex flex-col gap-0.5">
                <span className="text-xs text-muted-foreground">{t("form.totalPoissons")}</span>
                <span className="font-bold text-base">{totalPoissons.toLocaleString("fr-FR")}</span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-xs text-muted-foreground">{t("form.poidsMoyenPondere")}</span>
                <span className="font-bold text-base">{poidsMoyenPondere.toFixed(1)} g</span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-xs text-muted-foreground">{t("form.biomasseTotale")}</span>
                <span className="font-bold text-base">{biomasseTotaleKg.toFixed(2)} kg</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Sticky action bar */}
      <div className="fixed bottom-[calc(64px+env(safe-area-inset-bottom))] md:bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur border-t border-border p-4 flex gap-3 sm:static sm:bg-transparent sm:backdrop-blur-none sm:border-0 sm:p-0 sm:mt-2">
        <Button
          variant="outline"
          type="button"
          onClick={() => router.push(`/vagues/${vagueId}`)}
          className="flex-1 sm:flex-none min-h-[44px]"
        >
          {t("form.cancel")}
        </Button>
        <Button
          type="submit"
          disabled={isSubmitting}
          className="flex-1 sm:flex-none sm:ml-auto min-h-[44px]"
        >
          {isSubmitting ? "Enregistrement..." : t("form.submit")}
        </Button>
      </div>
    </form>
  );
}
