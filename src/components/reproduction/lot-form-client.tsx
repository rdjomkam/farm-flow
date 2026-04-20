"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { PhaseLot } from "@/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PonteOption {
  id: string;
  code: string;
}

interface BacOption {
  id: string;
  nom: string;
}

interface Props {
  pontes: PonteOption[];
  bacs: BacOption[];
}

interface FormData {
  code: string;
  ponteId: string;
  nombreInitial: string;
  phase: string;
  bacId: string;
  poidsMoyen: string;
  notes: string;
}

interface FormErrors {
  code?: string;
  ponteId?: string;
  nombreInitial?: string;
  server?: string;
}

// Phases that make sense as initial phase (exclude SORTI and PERDU)
const INITIAL_PHASES = [
  PhaseLot.INCUBATION,
  PhaseLot.LARVAIRE,
  PhaseLot.NURSERIE,
  PhaseLot.ALEVINAGE,
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function LotFormClient({ pontes, bacs }: Props) {
  const router = useRouter();
  const t = useTranslations("reproduction.lots.form");
  const tPhases = useTranslations("reproduction.lots.phases");

  const [form, setForm] = useState<FormData>({
    code: "",
    ponteId: "",
    nombreInitial: "",
    phase: "",
    bacId: "",
    poidsMoyen: "",
    notes: "",
  });

  const [errors, setErrors] = useState<FormErrors>({});
  const [loading, setLoading] = useState(false);
  const [nombreInitialPrefilled, setNombreInitialPrefilled] = useState(false);

  // ---- helpers ----

  function updateField(field: keyof FormData, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    // Clear field error on change
    if (errors[field as keyof FormErrors]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
    // When ponte changes, fetch incubations to pre-fill nombreInitial
    if (field === "ponteId" && value) {
      fetchIncubationForPonte(value);
    }
    if (field === "nombreInitial") {
      setNombreInitialPrefilled(false);
    }
  }

  async function fetchIncubationForPonte(ponteId: string) {
    try {
      const res = await fetch(`/api/reproduction/incubations?ponteId=${ponteId}&limit=1`);
      if (!res.ok) return;
      const data = await res.json() as { data?: Array<{ nombreLarvesViables?: number | null; nombreLarvesEcloses?: number | null }> };
      const incubations = data.data ?? [];
      if (incubations.length > 0) {
        const inc = incubations[0];
        const suggested = inc.nombreLarvesViables ?? inc.nombreLarvesEcloses ?? null;
        if (suggested !== null && suggested > 0) {
          setForm((prev) => ({ ...prev, nombreInitial: String(suggested) }));
          setNombreInitialPrefilled(true);
        }
      }
    } catch {
      // Silently ignore — pre-fill is best effort
    }
  }

  function validate(): boolean {
    const errs: FormErrors = {};

    if (!form.code.trim()) {
      errs.code = t("errors.codeRequired");
    }
    if (!form.ponteId) {
      errs.ponteId = t("errors.ponteRequired");
    }
    const n = parseInt(form.nombreInitial, 10);
    if (!form.nombreInitial.trim()) {
      errs.nombreInitial = t("errors.nombreRequired");
    } else if (isNaN(n) || n <= 0) {
      errs.nombreInitial = t("errors.nombrePositif");
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    setErrors({});

    const body: Record<string, unknown> = {
      code: form.code.trim(),
      ponteId: form.ponteId,
      nombreInitial: parseInt(form.nombreInitial, 10),
    };

    if (form.phase) body.phase = form.phase;
    if (form.bacId) body.bacId = form.bacId;
    if (form.poidsMoyen.trim()) body.poidsMoyen = parseFloat(form.poidsMoyen);
    if (form.notes.trim()) body.notes = form.notes.trim();

    try {
      const res = await fetch("/api/reproduction/lots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setErrors({ server: data?.error || t("errors.serverError") });
        setLoading(false);
        return;
      }

      const lot = await res.json();
      router.push(`/reproduction/lots/${lot.id}`);
    } catch {
      setErrors({ server: t("errors.serverError") });
      setLoading(false);
    }
  }

  // ---- render ----

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-lg mx-auto">
      {errors.server && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {errors.server}
        </div>
      )}

      <Card>
        <CardContent className="pt-6 space-y-4">
          {/* Code */}
          <div className="space-y-1.5">
            <label htmlFor="code" className="text-sm font-medium">
              {t("code")} *
            </label>
            <Input
              id="code"
              value={form.code}
              onChange={(e) => updateField("code", e.target.value)}
              placeholder={t("codePlaceholder")}
              className="min-h-[44px]"
            />
            {errors.code && (
              <p className="text-sm text-destructive">{errors.code}</p>
            )}
          </div>

          {/* Ponte */}
          <div className="space-y-1.5">
            <label htmlFor="ponteId" className="text-sm font-medium">
              {t("ponte")} *
            </label>
            <Select
              value={form.ponteId}
              onValueChange={(v) => updateField("ponteId", v)}
            >
              <SelectTrigger id="ponteId" className="min-h-[44px]">
                <SelectValue placeholder={t("pontePlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                {pontes.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.code}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.ponteId && (
              <p className="text-sm text-destructive">{errors.ponteId}</p>
            )}
          </div>

          {/* Nombre initial */}
          <div className="space-y-1.5">
            <label htmlFor="nombreInitial" className="text-sm font-medium">
              {t("nombreInitial")} *
            </label>
            <Input
              id="nombreInitial"
              type="number"
              min="1"
              value={form.nombreInitial}
              onChange={(e) => updateField("nombreInitial", e.target.value)}
              placeholder={t("placeholderExample", { value: "5000" })}
              className="min-h-[44px]"
            />
            {nombreInitialPrefilled && !errors.nombreInitial && (
              <p className="text-xs text-muted-foreground">{t("nombreInitialPrefilled")}</p>
            )}
            {errors.nombreInitial && (
              <p className="text-sm text-destructive">{errors.nombreInitial}</p>
            )}
          </div>

          {/* Phase */}
          <div className="space-y-1.5">
            <label htmlFor="phase" className="text-sm font-medium">
              {t("phase")}
            </label>
            <Select
              value={form.phase}
              onValueChange={(v) => updateField("phase", v)}
            >
              <SelectTrigger id="phase" className="min-h-[44px]">
                <SelectValue placeholder={t("phasePlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                {INITIAL_PHASES.map((p) => (
                  <SelectItem key={p} value={p}>
                    {tPhases(p)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Bac */}
          <div className="space-y-1.5">
            <label htmlFor="bacId" className="text-sm font-medium">
              {t("bac")}
            </label>
            <Select
              value={form.bacId}
              onValueChange={(v) => updateField("bacId", v)}
            >
              <SelectTrigger id="bacId" className="min-h-[44px]">
                <SelectValue placeholder={t("bacPlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                {bacs.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.nom}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Poids moyen */}
          <div className="space-y-1.5">
            <label htmlFor="poidsMoyen" className="text-sm font-medium">
              {t("poidsMoyen")}
            </label>
            <Input
              id="poidsMoyen"
              type="number"
              min="0"
              step="0.01"
              value={form.poidsMoyen}
              onChange={(e) => updateField("poidsMoyen", e.target.value)}
              placeholder={t("placeholderExample", { value: "0.5" })}
              className="min-h-[44px]"
            />
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <label htmlFor="notes" className="text-sm font-medium">
              {t("notes")}
            </label>
            <Textarea
              id="notes"
              value={form.notes}
              onChange={(e) => updateField("notes", e.target.value)}
              placeholder={t("notesPlaceholder")}
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      {/* Submit */}
      <Button
        type="submit"
        disabled={loading}
        className="w-full min-h-[48px] text-base"
      >
        {loading ? "..." : t("submit")}
      </Button>
    </form>
  );
}
