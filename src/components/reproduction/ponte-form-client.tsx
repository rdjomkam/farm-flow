"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Check, ChevronRight, AlertTriangle } from "lucide-react";
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
import { cn } from "@/lib/utils";
import {
  TypeHormone,
  QualiteOeufs,
  MethodeExtractionMale,
  MotiliteSperme,
  CauseEchecPonte,
} from "@/types";
import {
  getLatenceTheoriqueH,
  estimerNombreOeufs,
} from "@/lib/reproduction/calculs";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface GenericOption {
  id: string;
  code: string;
  nom?: string;
}

interface Props {
  lotsFemelles: GenericOption[];
  lotsMales: GenericOption[];
  femelles: GenericOption[];
  males: GenericOption[];
}

type SourceMode = "lot" | "individuel";
type Step = 1 | 2 | 3 | 4;

interface Step1Data {
  femelleSrcMode: SourceMode;
  femelleId: string;
  lotGeniteursFemellId: string;
  maleSrcMode: SourceMode;
  maleId: string;
  lotGeniteursMaleId: string;
  datePonte: string;
  typeHormone: string;
  doseHormone: string;
  coutHormone: string;
  heureInjection: string;
  temperatureEauC: string;
  notes: string;
}

interface Step2Data {
  heureStripping: string;
  poidsOeufsPontesG: string;
  qualiteOeufs: string;
  methodeMale: string;
  motiliteSperme: string;
  notes: string;
}

interface Step3Data {
  tauxFecondation: string;
  tauxEclosion: string;
  nombreLarvesViables: string;
  coutTotal: string;
  notes: string;
  isEchec: boolean;
  causeEchec: string;
  echecNotes: string;
}

// ---------------------------------------------------------------------------
// Stepper UI
// ---------------------------------------------------------------------------

function Stepper({
  currentStep,
  maxReachedStep,
}: {
  currentStep: Step;
  maxReachedStep: Step;
}) {
  const t = useTranslations("reproduction.pontes.form");

  const steps: { label: string; num: Step }[] = [
    { label: t("steps.injection"), num: 1 },
    { label: t("steps.stripping"), num: 2 },
    { label: t("steps.resultat"), num: 3 },
    { label: t("steps.confirmation"), num: 4 },
  ];

  return (
    <div className="mb-6">
      {/* Mobile: compact dots + label */}
      <div className="flex items-center justify-between gap-1 md:hidden">
        {steps.map((step, i) => (
          <div key={step.num} className="flex items-center flex-1">
            <div
              className={cn(
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold border-2 transition-all",
                currentStep === step.num &&
                  "border-primary bg-primary text-primary-foreground",
                currentStep > step.num &&
                  "border-primary bg-primary text-primary-foreground",
                currentStep < step.num &&
                  maxReachedStep >= step.num &&
                  "border-primary/50 bg-primary/10 text-primary",
                currentStep < step.num &&
                  maxReachedStep < step.num &&
                  "border-border bg-muted text-muted-foreground"
              )}
              aria-current={currentStep === step.num ? "step" : undefined}
            >
              {currentStep > step.num ? (
                <Check className="h-3 w-3" aria-hidden />
              ) : (
                step.num
              )}
            </div>
            {i < steps.length - 1 && (
              <div
                className={cn(
                  "h-0.5 flex-1 mx-1 transition-all",
                  currentStep > step.num ? "bg-primary" : "bg-border"
                )}
              />
            )}
          </div>
        ))}
      </div>
      <p className="mt-2 text-sm font-semibold text-center md:hidden text-primary">
        {steps.find((s) => s.num === currentStep)?.label}
      </p>

      {/* Desktop: full horizontal stepper with labels */}
      <nav
        className="hidden md:flex items-center"
        aria-label={t("steps.injection")}
      >
        {steps.map((step, i) => (
          <div key={step.num} className="flex items-center flex-1">
            <div className="flex items-center gap-2 shrink-0">
              <div
                className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold border-2 transition-all",
                  currentStep === step.num &&
                    "border-primary bg-primary text-primary-foreground shadow-sm",
                  currentStep > step.num &&
                    "border-primary bg-primary text-primary-foreground",
                  currentStep < step.num &&
                    maxReachedStep >= step.num &&
                    "border-primary/50 bg-primary/10 text-primary",
                  currentStep < step.num &&
                    maxReachedStep < step.num &&
                    "border-border bg-muted text-muted-foreground"
                )}
                aria-current={currentStep === step.num ? "step" : undefined}
              >
                {currentStep > step.num ? (
                  <Check className="h-4 w-4" aria-hidden />
                ) : (
                  step.num
                )}
              </div>
              <span
                className={cn(
                  "text-sm font-medium whitespace-nowrap",
                  currentStep === step.num
                    ? "text-primary"
                    : "text-muted-foreground"
                )}
              >
                {step.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div
                className={cn(
                  "h-0.5 flex-1 mx-3 transition-all",
                  currentStep > step.num ? "bg-primary" : "bg-border"
                )}
              />
            )}
          </div>
        ))}
      </nav>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SourceToggle — Lot vs Individuel button group
// ---------------------------------------------------------------------------

function SourceToggle({
  value,
  onChange,
  label,
}: {
  value: SourceMode;
  onChange: (v: SourceMode) => void;
  label: string;
}) {
  const t = useTranslations("reproduction.pontes.form");
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm font-medium">{label}</span>
      <div className="flex rounded-lg border border-border overflow-hidden">
        <button
          type="button"
          onClick={() => onChange("lot")}
          className={cn(
            "px-3 py-1.5 text-sm font-medium transition-colors min-h-[36px]",
            value === "lot"
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-muted"
          )}
        >
          {t("sourceToggle.lot")}
        </button>
        <button
          type="button"
          onClick={() => onChange("individuel")}
          className={cn(
            "px-3 py-1.5 text-sm font-medium transition-colors min-h-[36px]",
            value === "individuel"
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-muted"
          )}
        >
          {t("sourceToggle.individuel")}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Error banner
// ---------------------------------------------------------------------------

function ErrorBanner({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div
      role="alert"
      aria-live="polite"
      className="flex items-start gap-2 rounded-lg border border-danger/30 bg-danger/5 p-3"
    >
      <AlertTriangle
        className="h-4 w-4 text-danger mt-0.5 shrink-0"
        aria-hidden
      />
      <p className="text-sm text-danger">{message}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 1 — Injection hormonale
// ---------------------------------------------------------------------------

function Step1Injection({
  data,
  lotsFemelles,
  lotsMales,
  femelles,
  males,
  error,
  loading,
  onChange,
  onSubmit,
}: {
  data: Step1Data;
  lotsFemelles: GenericOption[];
  lotsMales: GenericOption[];
  femelles: GenericOption[];
  males: GenericOption[];
  error: string | null;
  loading: boolean;
  onChange: (patch: Partial<Step1Data>) => void;
  onSubmit: () => void;
}) {
  const t = useTranslations("reproduction.pontes.form");
  const tHormone = useTranslations("reproduction.pontes.hormone");

  const latenceH =
    data.temperatureEauC !== "" && !isNaN(parseFloat(data.temperatureEauC))
      ? getLatenceTheoriqueH(parseFloat(data.temperatureEauC))
      : null;

  return (
    <div className="space-y-5">
      {/* Femelle */}
      <div className="space-y-2">
        <SourceToggle
          value={data.femelleSrcMode}
          onChange={(v) =>
            onChange({ femelleSrcMode: v, femelleId: "", lotGeniteursFemellId: "" })
          }
          label={t("femelle.label")}
        />
        {data.femelleSrcMode === "lot" ? (
          <Select
            value={data.lotGeniteursFemellId}
            onValueChange={(v) =>
              onChange({ lotGeniteursFemellId: v, femelleId: "" })
            }
          >
            <SelectTrigger required aria-label={t("femelle.label")}>
              <SelectValue placeholder={t("femelle.lotPlaceholder")} />
            </SelectTrigger>
            <SelectContent>
              {lotsFemelles.map((lot) => (
                <SelectItem key={lot.id} value={lot.id}>
                  {lot.code}{lot.nom ? ` — ${lot.nom}` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <Select
            value={data.femelleId}
            onValueChange={(v) =>
              onChange({ femelleId: v, lotGeniteursFemellId: "" })
            }
          >
            <SelectTrigger required aria-label={t("femelle.label")}>
              <SelectValue placeholder={t("femelle.individuelPlaceholder")} />
            </SelectTrigger>
            <SelectContent>
              {femelles.map((f) => (
                <SelectItem key={f.id} value={f.id}>
                  {f.code}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Male (optionnel) */}
      <div className="space-y-2">
        <SourceToggle
          value={data.maleSrcMode}
          onChange={(v) =>
            onChange({ maleSrcMode: v, maleId: "", lotGeniteursMaleId: "" })
          }
          label={t("male.label")}
        />
        {data.maleSrcMode === "lot" ? (
          <Select
            value={data.lotGeniteursMaleId}
            onValueChange={(v) =>
              onChange({ lotGeniteursMaleId: v, maleId: "" })
            }
          >
            <SelectTrigger aria-label={t("male.label")}>
              <SelectValue placeholder={t("male.lotPlaceholder")} />
            </SelectTrigger>
            <SelectContent>
              {lotsMales.map((lot) => (
                <SelectItem key={lot.id} value={lot.id}>
                  {lot.code}{lot.nom ? ` — ${lot.nom}` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <Select
            value={data.maleId}
            onValueChange={(v) =>
              onChange({ maleId: v, lotGeniteursMaleId: "" })
            }
          >
            <SelectTrigger aria-label={t("male.label")}>
              <SelectValue placeholder={t("male.individuelPlaceholder")} />
            </SelectTrigger>
            <SelectContent>
              {males.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.code}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Date ponte */}
      <Input
        label={t("datePonte")}
        type="date"
        value={data.datePonte}
        onChange={(e) => onChange({ datePonte: e.target.value })}
        required
      />

      {/* Hormone */}
      <Select
        value={data.typeHormone}
        onValueChange={(v) => onChange({ typeHormone: v })}
      >
        <SelectTrigger
          label={t("typeHormoneLabel")}
          aria-label={t("typeHormoneLabel")}
        >
          <SelectValue placeholder={t("typeHormonePlaceholder")} />
        </SelectTrigger>
        <SelectContent>
          {Object.values(TypeHormone).map((h) => (
            <SelectItem key={h} value={h}>
              {tHormone(h)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Dose + cout */}
      <div className="grid grid-cols-2 gap-3">
        <Input
          label={t("doseHormone")}
          type="number"
          min="0"
          step="0.1"
          value={data.doseHormone}
          onChange={(e) => onChange({ doseHormone: e.target.value })}
          placeholder="0"
        />
        <Input
          label={t("coutHormone")}
          type="number"
          min="0"
          step="100"
          value={data.coutHormone}
          onChange={(e) => onChange({ coutHormone: e.target.value })}
          placeholder="0"
        />
      </div>

      {/* Heure injection */}
      <Input
        label={t("heureInjection")}
        type="datetime-local"
        value={data.heureInjection}
        onChange={(e) => onChange({ heureInjection: e.target.value })}
      />

      {/* Temperature + latence auto */}
      <Input
        label={t("temperatureEauC")}
        type="number"
        min="15"
        max="40"
        step="0.5"
        value={data.temperatureEauC}
        onChange={(e) => onChange({ temperatureEauC: e.target.value })}
        placeholder="27"
        hint={
          latenceH !== null
            ? t("latenceHint", { heures: latenceH })
            : undefined
        }
      />

      {/* Notes */}
      <Textarea
        label={t("notes")}
        value={data.notes}
        onChange={(e) => onChange({ notes: e.target.value })}
        placeholder={t("notesPlaceholder")}
      />

      <ErrorBanner message={error} />

      <Button
        type="button"
        variant="primary"
        size="lg"
        className="w-full"
        disabled={loading}
        onClick={onSubmit}
      >
        {loading ? t("actions.loading") : t("actions.suivant")}
        {!loading && <ChevronRight className="h-4 w-4" aria-hidden />}
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 2 — Stripping
// ---------------------------------------------------------------------------

function Step2Stripping({
  data,
  error,
  loading,
  onChange,
  onSubmit,
  onBack,
}: {
  data: Step2Data;
  error: string | null;
  loading: boolean;
  onChange: (patch: Partial<Step2Data>) => void;
  onSubmit: () => void;
  onBack: () => void;
}) {
  const t = useTranslations("reproduction.pontes.form");
  const tQualite = useTranslations("reproduction.pontes.qualiteOeufs");
  const tMethode = useTranslations("reproduction.pontes.methodeMale");
  const tMotilite = useTranslations("reproduction.pontes.motilite");

  const poidsVal = parseFloat(data.poidsOeufsPontesG);
  const nombreOeufsEstime =
    data.poidsOeufsPontesG !== "" && !isNaN(poidsVal) && poidsVal > 0
      ? estimerNombreOeufs(poidsVal)
      : null;

  return (
    <div className="space-y-5">
      <Input
        label={t("heureStripping")}
        type="datetime-local"
        value={data.heureStripping}
        onChange={(e) => onChange({ heureStripping: e.target.value })}
        required
      />

      <Input
        label={t("poidsOeufsLabel")}
        type="number"
        min="0"
        step="0.1"
        value={data.poidsOeufsPontesG}
        onChange={(e) => onChange({ poidsOeufsPontesG: e.target.value })}
        placeholder="0"
        hint={
          nombreOeufsEstime !== null
            ? t("nombreOeufsHint", {
                count: nombreOeufsEstime.toLocaleString("fr-FR"),
              })
            : undefined
        }
      />

      <Select
        value={data.qualiteOeufs}
        onValueChange={(v) => onChange({ qualiteOeufs: v })}
      >
        <SelectTrigger
          label={t("qualiteOeufsLabel")}
          aria-label={t("qualiteOeufsLabel")}
        >
          <SelectValue placeholder={t("qualiteOeufsPlaceholder")} />
        </SelectTrigger>
        <SelectContent>
          {Object.values(QualiteOeufs).map((q) => (
            <SelectItem key={q} value={q}>
              {tQualite(q)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={data.methodeMale}
        onValueChange={(v) => onChange({ methodeMale: v })}
      >
        <SelectTrigger
          label={t("methodeMaleLabel")}
          aria-label={t("methodeMaleLabel")}
        >
          <SelectValue placeholder={t("methodeMalePlaceholder")} />
        </SelectTrigger>
        <SelectContent>
          {Object.values(MethodeExtractionMale).map((m) => (
            <SelectItem key={m} value={m}>
              {tMethode(m)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={data.motiliteSperme}
        onValueChange={(v) => onChange({ motiliteSperme: v })}
      >
        <SelectTrigger
          label={t("motiliteSpermeLabel")}
          aria-label={t("motiliteSpermeLabel")}
        >
          <SelectValue placeholder={t("motiliteSpermePlaceholder")} />
        </SelectTrigger>
        <SelectContent>
          {Object.values(MotiliteSperme).map((m) => (
            <SelectItem key={m} value={m}>
              {tMotilite(m)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Textarea
        label={t("strippingNotes")}
        value={data.notes}
        onChange={(e) => onChange({ notes: e.target.value })}
        placeholder={t("notesPlaceholder")}
      />

      <ErrorBanner message={error} />

      <div className="flex gap-3">
        <Button
          type="button"
          variant="outline"
          size="lg"
          className="flex-1"
          onClick={onBack}
        >
          {t("actions.precedent")}
        </Button>
        <Button
          type="button"
          variant="primary"
          size="lg"
          className="flex-1"
          disabled={loading}
          onClick={onSubmit}
        >
          {loading ? t("actions.loading") : t("actions.suivant")}
          {!loading && <ChevronRight className="h-4 w-4" aria-hidden />}
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 3 — Resultat (success or failure)
// ---------------------------------------------------------------------------

function Step3Resultat({
  data,
  error,
  loading,
  onChange,
  onSubmit,
  onEchec,
  onBack,
}: {
  data: Step3Data;
  error: string | null;
  loading: boolean;
  onChange: (patch: Partial<Step3Data>) => void;
  onSubmit: () => void;
  onEchec: () => void;
  onBack: () => void;
}) {
  const t = useTranslations("reproduction.pontes.form");
  const tCause = useTranslations("reproduction.pontes.causeEchec");

  if (data.isEchec) {
    return (
      <div className="space-y-5">
        <div className="rounded-lg border border-danger/30 bg-danger/5 p-3">
          <p className="text-sm font-semibold text-danger">{t("marquerEchec")}</p>
        </div>

        <Select
          value={data.causeEchec}
          onValueChange={(v) => onChange({ causeEchec: v })}
        >
          <SelectTrigger
            label={t("causeEchecLabel")}
            required
            aria-label={t("causeEchecLabel")}
          >
            <SelectValue placeholder={t("causeEchecPlaceholder")} />
          </SelectTrigger>
          <SelectContent>
            {Object.values(CauseEchecPonte).map((c) => (
              <SelectItem key={c} value={c}>
                {tCause(c)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Textarea
          label={t("resultatNotes")}
          value={data.echecNotes}
          onChange={(e) => onChange({ echecNotes: e.target.value })}
          placeholder={t("notesPlaceholder")}
        />

        <ErrorBanner message={error} />

        <div className="flex gap-3">
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="flex-1"
            onClick={() =>
              onChange({ isEchec: false, causeEchec: "", echecNotes: "" })
            }
          >
            {t("actions.precedent")}
          </Button>
          <Button
            type="button"
            variant="danger"
            size="lg"
            className="flex-1"
            disabled={loading}
            onClick={onEchec}
          >
            {loading ? t("actions.loading") : t("actions.marquerEchec")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3">
        <Input
          label={t("tauxFecondation")}
          type="number"
          min="0"
          max="100"
          step="1"
          value={data.tauxFecondation}
          onChange={(e) => onChange({ tauxFecondation: e.target.value })}
          placeholder="0"
        />
        <Input
          label={t("tauxEclosion")}
          type="number"
          min="0"
          max="100"
          step="1"
          value={data.tauxEclosion}
          onChange={(e) => onChange({ tauxEclosion: e.target.value })}
          placeholder="0"
        />
      </div>

      <Input
        label={t("nombreLarves")}
        type="number"
        min="1"
        step="1"
        value={data.nombreLarvesViables}
        onChange={(e) => onChange({ nombreLarvesViables: e.target.value })}
        placeholder="0"
      />

      <Input
        label={t("coutTotal")}
        type="number"
        min="0"
        step="100"
        value={data.coutTotal}
        onChange={(e) => onChange({ coutTotal: e.target.value })}
        placeholder="0"
      />

      <Textarea
        label={t("resultatNotes")}
        value={data.notes}
        onChange={(e) => onChange({ notes: e.target.value })}
        placeholder={t("notesPlaceholder")}
      />

      <ErrorBanner message={error} />

      {/* Failure link */}
      <button
        type="button"
        onClick={() => onChange({ isEchec: true })}
        className="w-full text-sm text-danger hover:underline underline-offset-2 min-h-[44px] flex items-center justify-center"
      >
        {t("marquerEchec")}
      </button>

      <div className="flex gap-3">
        <Button
          type="button"
          variant="outline"
          size="lg"
          className="flex-1"
          onClick={onBack}
        >
          {t("actions.precedent")}
        </Button>
        <Button
          type="button"
          variant="primary"
          size="lg"
          className="flex-1"
          disabled={loading}
          onClick={onSubmit}
        >
          {loading ? t("actions.loading") : t("actions.suivant")}
          {!loading && <ChevronRight className="h-4 w-4" aria-hidden />}
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 4 — Confirmation / Summary
// ---------------------------------------------------------------------------

function SummaryRow({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  if (!value) return null;
  return (
    <div className="flex justify-between items-start gap-3 py-2 border-b border-border/40 last:border-0">
      <span className="text-sm text-muted-foreground shrink-0">{label}</span>
      <span className="text-sm font-medium text-right">{value}</span>
    </div>
  );
}

function Step4Confirmation({
  step1,
  step2,
  step3,
  ponteId,
  lotsFemelles,
  lotsMales,
  femelles,
  males,
  onBack,
}: {
  step1: Step1Data;
  step2: Step2Data;
  step3: Step3Data;
  ponteId: string;
  lotsFemelles: GenericOption[];
  lotsMales: GenericOption[];
  femelles: GenericOption[];
  males: GenericOption[];
  onBack: () => void;
}) {
  const t = useTranslations("reproduction.pontes.form");
  const tHormone = useTranslations("reproduction.pontes.hormone");
  const tQualite = useTranslations("reproduction.pontes.qualiteOeufs");
  const tMethode = useTranslations("reproduction.pontes.methodeMale");
  const tMotilite = useTranslations("reproduction.pontes.motilite");
  const tCause = useTranslations("reproduction.pontes.causeEchec");
  const router = useRouter();

  // Resolve display names from options
  const femelleName =
    step1.femelleSrcMode === "lot"
      ? (() => {
          const lot = lotsFemelles.find(
            (l) => l.id === step1.lotGeniteursFemellId
          );
          return lot
            ? `${lot.code}${lot.nom ? ` — ${lot.nom}` : ""}`
            : null;
        })()
      : femelles.find((f) => f.id === step1.femelleId)?.code ?? null;

  const maleName =
    step1.maleSrcMode === "lot"
      ? (() => {
          const lot = lotsMales.find(
            (l) => l.id === step1.lotGeniteursMaleId
          );
          return lot
            ? `${lot.code}${lot.nom ? ` — ${lot.nom}` : ""}`
            : null;
        })()
      : males.find((m) => m.id === step1.maleId)?.code ?? null;

  const poidsVal = parseFloat(step2.poidsOeufsPontesG);
  const nombreOeufsEstime =
    step2.poidsOeufsPontesG !== "" && !isNaN(poidsVal) && poidsVal > 0
      ? estimerNombreOeufs(poidsVal)
      : null;

  const latenceH =
    step1.temperatureEauC !== "" && !isNaN(parseFloat(step1.temperatureEauC))
      ? getLatenceTheoriqueH(parseFloat(step1.temperatureEauC))
      : null;

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-base font-semibold mb-3">{t("summary.title")}</h3>
          {/* Injection */}
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2 mt-1">
            {t("summary.sectionInjection")}
          </p>
          <div className="mb-4">
            <SummaryRow
              label={t("summary.femelle")}
              value={femelleName ?? t("summary.nonSpecifie")}
            />
            {maleName && (
              <SummaryRow label={t("summary.male")} value={maleName} />
            )}
            <SummaryRow
              label={t("summary.datePonte")}
              value={
                step1.datePonte
                  ? new Date(step1.datePonte).toLocaleDateString("fr-FR")
                  : null
              }
            />
            <SummaryRow
              label={t("summary.hormone")}
              value={
                step1.typeHormone
                  ? tHormone(step1.typeHormone as keyof typeof TypeHormone)
                  : null
              }
            />
            <SummaryRow
              label={t("summary.dose")}
              value={step1.doseHormone ? `${step1.doseHormone} ml` : null}
            />
            <SummaryRow
              label={t("summary.coutHormone")}
              value={
                step1.coutHormone
                  ? `${Number(step1.coutHormone).toLocaleString("fr-FR")} FCFA`
                  : null
              }
            />
            <SummaryRow
              label={t("summary.heureInjection")}
              value={
                step1.heureInjection
                  ? new Date(step1.heureInjection).toLocaleString("fr-FR")
                  : null
              }
            />
            <SummaryRow
              label={t("summary.temperature")}
              value={
                step1.temperatureEauC
                  ? `${step1.temperatureEauC} °C`
                  : null
              }
            />
            <SummaryRow
              label={t("summary.latence")}
              value={latenceH !== null ? `${latenceH} h` : null}
            />
          </div>

          {/* Stripping */}
          {step2.heureStripping && (
            <>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                {t("summary.sectionStripping")}
              </p>
              <div className="mb-4">
                <SummaryRow
                  label={t("summary.heureStripping")}
                  value={new Date(step2.heureStripping).toLocaleString("fr-FR")}
                />
                <SummaryRow
                  label={t("summary.poids")}
                  value={
                    step2.poidsOeufsPontesG
                      ? `${step2.poidsOeufsPontesG} g${nombreOeufsEstime ? ` (~${nombreOeufsEstime.toLocaleString("fr-FR")} oeufs)` : ""}`
                      : null
                  }
                />
                <SummaryRow
                  label={t("summary.qualite")}
                  value={
                    step2.qualiteOeufs
                      ? tQualite(
                          step2.qualiteOeufs as keyof typeof QualiteOeufs
                        )
                      : null
                  }
                />
                <SummaryRow
                  label={t("summary.methodeMale")}
                  value={
                    step2.methodeMale
                      ? tMethode(
                          step2.methodeMale as keyof typeof MethodeExtractionMale
                        )
                      : null
                  }
                />
                <SummaryRow
                  label={t("summary.motilite")}
                  value={
                    step2.motiliteSperme
                      ? tMotilite(
                          step2.motiliteSperme as keyof typeof MotiliteSperme
                        )
                      : null
                  }
                />
              </div>
            </>
          )}

          {/* Resultat */}
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
            {t("summary.sectionResultat")}
          </p>
          <div>
            {step3.isEchec ? (
              <>
                <div className="py-2 border-b border-border/40">
                  <span className="text-sm font-semibold text-danger">
                    {t("marquerEchec")}
                  </span>
                </div>
                <SummaryRow
                  label={t("causeEchecLabel")}
                  value={
                    step3.causeEchec
                      ? tCause(
                          step3.causeEchec as keyof typeof CauseEchecPonte
                        )
                      : null
                  }
                />
              </>
            ) : (
              <>
                <SummaryRow
                  label={t("summary.fecondation")}
                  value={
                    step3.tauxFecondation ? `${step3.tauxFecondation} %` : null
                  }
                />
                <SummaryRow
                  label={t("summary.eclosion")}
                  value={
                    step3.tauxEclosion ? `${step3.tauxEclosion} %` : null
                  }
                />
                <SummaryRow
                  label={t("summary.larves")}
                  value={
                    step3.nombreLarvesViables
                      ? Number(
                          step3.nombreLarvesViables
                        ).toLocaleString("fr-FR")
                      : null
                  }
                />
                <SummaryRow
                  label={t("summary.coutTotal")}
                  value={
                    step3.coutTotal
                      ? `${Number(step3.coutTotal).toLocaleString("fr-FR")} FCFA`
                      : null
                  }
                />
              </>
            )}
          </div>
      </div>

      <div className="flex gap-3">
        <Button
          type="button"
          variant="outline"
          size="lg"
          className="flex-1"
          onClick={onBack}
        >
          {t("actions.precedent")}
        </Button>
        <Button
          type="button"
          variant="primary"
          size="lg"
          className="flex-1"
          onClick={() => router.push(`/alevins/pontes/${ponteId}`)}
        >
          {t("actions.voirPonte")}
          <ChevronRight className="h-4 w-4" aria-hidden />
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Default state
// ---------------------------------------------------------------------------

const DEFAULT_STEP1: Step1Data = {
  femelleSrcMode: "lot",
  femelleId: "",
  lotGeniteursFemellId: "",
  maleSrcMode: "lot",
  maleId: "",
  lotGeniteursMaleId: "",
  datePonte: new Date().toISOString().split("T")[0],
  typeHormone: "",
  doseHormone: "",
  coutHormone: "",
  heureInjection: "",
  temperatureEauC: "",
  notes: "",
};

const DEFAULT_STEP2: Step2Data = {
  heureStripping: "",
  poidsOeufsPontesG: "",
  qualiteOeufs: "",
  methodeMale: "",
  motiliteSperme: "",
  notes: "",
};

const DEFAULT_STEP3: Step3Data = {
  tauxFecondation: "",
  tauxEclosion: "",
  nombreLarvesViables: "",
  coutTotal: "",
  notes: "",
  isEchec: false,
  causeEchec: "",
  echecNotes: "",
};

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export function PonteFormClient({
  lotsFemelles,
  lotsMales,
  femelles,
  males,
}: Props) {
  const t = useTranslations("reproduction.pontes.form");

  const [currentStep, setCurrentStep] = useState<Step>(1);
  const [maxReachedStep, setMaxReachedStep] = useState<Step>(1);
  const [step1, setStep1] = useState<Step1Data>(DEFAULT_STEP1);
  const [step2, setStep2] = useState<Step2Data>(DEFAULT_STEP2);
  const [step3, setStep3] = useState<Step3Data>(DEFAULT_STEP3);
  const [ponteId, setPonteId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const goToStep = useCallback(
    (step: Step) => {
      setCurrentStep(step);
      setMaxReachedStep((prev) => (step > prev ? step : prev));
      setError(null);
    },
    []
  );

  // ---------------------------------------------------------------------------
  // Step 1 submit — POST /api/reproduction/pontes
  // ---------------------------------------------------------------------------
  const handleStep1Submit = useCallback(async () => {
    const hasFemelle =
      step1.femelleSrcMode === "lot"
        ? Boolean(step1.lotGeniteursFemellId)
        : Boolean(step1.femelleId);

    if (!hasFemelle) {
      setError(t("errors.femelleRequired"));
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const body: Record<string, unknown> = {
        datePonte: step1.datePonte
          ? new Date(step1.datePonte).toISOString()
          : new Date().toISOString(),
      };

      if (step1.femelleSrcMode === "lot") {
        body.lotGeniteursFemellId = step1.lotGeniteursFemellId;
      } else {
        body.femelleId = step1.femelleId;
      }

      if (step1.maleSrcMode === "lot" && step1.lotGeniteursMaleId) {
        body.lotGeniteursMaleId = step1.lotGeniteursMaleId;
      } else if (step1.maleSrcMode === "individuel" && step1.maleId) {
        body.maleId = step1.maleId;
      }

      if (step1.typeHormone) body.typeHormone = step1.typeHormone;
      if (step1.doseHormone)
        body.doseHormone = parseFloat(step1.doseHormone);
      if (step1.coutHormone)
        body.coutHormone = parseFloat(step1.coutHormone);
      if (step1.heureInjection)
        body.heureInjection = new Date(step1.heureInjection).toISOString();
      if (step1.temperatureEauC)
        body.temperatureEauC = parseFloat(step1.temperatureEauC);
      if (step1.notes.trim()) body.notes = step1.notes.trim();

      const res = await fetch("/api/reproduction/pontes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const json = await res.json();
        setError(
          (json as { message?: string }).message ?? t("errors.genericError")
        );
        return;
      }

      const json = await res.json();
      setPonteId((json as { id: string }).id);
      goToStep(2);
    } catch {
      setError(t("errors.genericError"));
    } finally {
      setLoading(false);
    }
  }, [step1, t, goToStep]);

  // ---------------------------------------------------------------------------
  // Step 2 submit — PATCH /api/reproduction/pontes/[id]/stripping
  // ---------------------------------------------------------------------------
  const handleStep2Submit = useCallback(async () => {
    if (!ponteId) return;

    if (!step2.heureStripping) {
      setError(t("errors.heureStrippingRequired"));
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const body: Record<string, unknown> = {
        heureStripping: new Date(step2.heureStripping).toISOString(),
      };

      const poids = parseFloat(step2.poidsOeufsPontesG);
      if (step2.poidsOeufsPontesG !== "" && !isNaN(poids) && poids > 0) {
        body.poidsOeufsPontesG = poids;
      }
      if (step2.qualiteOeufs) body.qualiteOeufs = step2.qualiteOeufs;
      if (step2.methodeMale) body.methodeMale = step2.methodeMale;
      if (step2.motiliteSperme) body.motiliteSperme = step2.motiliteSperme;
      if (step2.notes.trim()) body.notes = step2.notes.trim();

      const res = await fetch(
        `/api/reproduction/pontes/${ponteId}/stripping`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      );

      if (!res.ok) {
        const json = await res.json();
        setError(
          (json as { message?: string }).message ?? t("errors.genericError")
        );
        return;
      }

      goToStep(3);
    } catch {
      setError(t("errors.genericError"));
    } finally {
      setLoading(false);
    }
  }, [ponteId, step2, t, goToStep]);

  // ---------------------------------------------------------------------------
  // Step 3 submit — PATCH /api/reproduction/pontes/[id]/resultat
  // ---------------------------------------------------------------------------
  const handleStep3Submit = useCallback(async () => {
    if (!ponteId) return;

    setLoading(true);
    setError(null);

    try {
      const body: Record<string, unknown> = {};

      if (step3.tauxFecondation)
        body.tauxFecondation = parseFloat(step3.tauxFecondation);
      if (step3.tauxEclosion)
        body.tauxEclosion = parseFloat(step3.tauxEclosion);
      if (step3.nombreLarvesViables)
        body.nombreLarvesViables = parseInt(step3.nombreLarvesViables, 10);
      if (step3.coutTotal) body.coutTotal = parseFloat(step3.coutTotal);
      if (step3.notes.trim()) body.notes = step3.notes.trim();

      const res = await fetch(`/api/reproduction/pontes/${ponteId}/resultat`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const json = await res.json();
        setError(
          (json as { message?: string }).message ?? t("errors.genericError")
        );
        return;
      }

      goToStep(4);
    } catch {
      setError(t("errors.genericError"));
    } finally {
      setLoading(false);
    }
  }, [ponteId, step3, t, goToStep]);

  // ---------------------------------------------------------------------------
  // Echec submit — PATCH /api/reproduction/pontes/[id]/echec
  // ---------------------------------------------------------------------------
  const handleEchecSubmit = useCallback(async () => {
    if (!ponteId) return;

    if (!step3.causeEchec) {
      setError(t("errors.causeEchecRequired"));
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const body: Record<string, unknown> = {
        causeEchec: step3.causeEchec,
      };
      if (step3.echecNotes.trim()) body.notes = step3.echecNotes.trim();

      const res = await fetch(`/api/reproduction/pontes/${ponteId}/echec`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const json = await res.json();
        setError(
          (json as { message?: string }).message ?? t("errors.genericError")
        );
        return;
      }

      goToStep(4);
    } catch {
      setError(t("errors.genericError"));
    } finally {
      setLoading(false);
    }
  }, [ponteId, step3, t, goToStep]);

  return (
    <div className="max-w-2xl mx-auto">
      <Stepper currentStep={currentStep} maxReachedStep={maxReachedStep} />

      <Card>
        <CardContent className="pt-5">
          {currentStep === 1 && (
            <Step1Injection
              data={step1}
              lotsFemelles={lotsFemelles}
              lotsMales={lotsMales}
              femelles={femelles}
              males={males}
              error={error}
              loading={loading}
              onChange={(patch) => setStep1((prev) => ({ ...prev, ...patch }))}
              onSubmit={handleStep1Submit}
            />
          )}

          {currentStep === 2 && (
            <Step2Stripping
              data={step2}
              error={error}
              loading={loading}
              onChange={(patch) => setStep2((prev) => ({ ...prev, ...patch }))}
              onSubmit={handleStep2Submit}
              onBack={() => goToStep(1)}
            />
          )}

          {currentStep === 3 && (
            <Step3Resultat
              data={step3}
              error={error}
              loading={loading}
              onChange={(patch) => setStep3((prev) => ({ ...prev, ...patch }))}
              onSubmit={handleStep3Submit}
              onEchec={handleEchecSubmit}
              onBack={() => goToStep(2)}
            />
          )}

          {currentStep === 4 && ponteId && (
            <Step4Confirmation
              step1={step1}
              step2={step2}
              step3={step3}
              ponteId={ponteId}
              lotsFemelles={lotsFemelles}
              lotsMales={lotsMales}
              femelles={femelles}
              males={males}
              onBack={() => goToStep(3)}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
