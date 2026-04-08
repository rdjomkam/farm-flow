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

interface PonteCompleterData {
  id: string;
  code: string;
  statut: string;
  // Step 1 — Injection
  typeHormone: string | null;
  doseHormone: number | null;
  doseMgKg: number | null;
  coutHormone: number | null;
  heureInjection: string | null;
  temperatureEauC: number | null;
  latenceTheorique: number | null;
  notes: string | null;
  // Step 2 — Stripping
  heureStripping: string | null;
  poidsOeufsPontesG: number | null;
  nombreOeufsEstime: number | null;
  qualiteOeufs: string | null;
  methodeMale: string | null;
  motiliteSperme: string | null;
  // Step 3 — Resultat
  tauxFecondation: number | null;
  tauxEclosion: number | null;
  nombreLarvesViables: number | null;
  coutTotal: number | null;
}

interface Props {
  ponte: PonteCompleterData;
  initialStep: 1 | 2 | 3;
}

// ---------------------------------------------------------------------------
// Helpers — conversion types pour les inputs
// ---------------------------------------------------------------------------

function numToStr(val: number | null | undefined): string {
  if (val === null || val === undefined) return "";
  return String(val);
}

function isoToDatetimeLocal(val: string | null | undefined): string {
  if (!val) return "";
  try {
    return new Date(val).toISOString().slice(0, 16);
  } catch {
    return "";
  }
}

// ---------------------------------------------------------------------------
// Stepper — 3 steps uniquement (pas de confirmation en mode edition)
// ---------------------------------------------------------------------------

type CompleterStep = 1 | 2 | 3;

function Stepper({
  currentStep,
  maxReachedStep,
}: {
  currentStep: CompleterStep;
  maxReachedStep: CompleterStep;
}) {
  const t = useTranslations("reproduction.pontes.form");

  const steps: { label: string; num: CompleterStep }[] = [
    { label: t("steps.injection"), num: 1 },
    { label: t("steps.stripping"), num: 2 },
    { label: t("steps.resultat"), num: 3 },
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

      {/* Desktop: full horizontal stepper */}
      <nav className="hidden md:flex items-center" aria-label="Etapes">
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
// ErrorBanner
// ---------------------------------------------------------------------------

function ErrorBanner({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div
      role="alert"
      aria-live="polite"
      className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3"
    >
      <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" aria-hidden />
      <p className="text-sm text-destructive">{message}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 1 — Injection hormonale (edition)
// ---------------------------------------------------------------------------

interface Step1State {
  typeHormone: string;
  doseHormone: string;
  doseMgKg: string;
  coutHormone: string;
  heureInjection: string;
  temperatureEauC: string;
  latenceTheorique: string;
  notes: string;
}

function Step1InjectionEdit({
  data,
  error,
  loading,
  onChange,
  onSubmit,
}: {
  data: Step1State;
  error: string | null;
  loading: boolean;
  onChange: (patch: Partial<Step1State>) => void;
  onSubmit: () => void;
}) {
  const t = useTranslations("reproduction.pontes.form");
  const tHormone = useTranslations("reproduction.pontes.hormone");

  const tempVal = parseFloat(data.temperatureEauC);
  const latenceH =
    data.temperatureEauC !== "" && !isNaN(tempVal)
      ? getLatenceTheoriqueH(tempVal)
      : null;

  return (
    <div className="space-y-5">
      {/* Hormone */}
      <Select
        value={data.typeHormone}
        onValueChange={(v) => onChange({ typeHormone: v })}
      >
        <SelectTrigger label={t("typeHormoneLabel")} aria-label={t("typeHormoneLabel")}>
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

      {/* Dose + doseMgKg + cout */}
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
          label={t("doseMgKg")}
          type="number"
          min="0"
          step="0.1"
          value={data.doseMgKg}
          onChange={(e) => onChange({ doseMgKg: e.target.value })}
          placeholder="Ex: 4.0"
        />
      </div>

      <Input
        label={t("coutHormone")}
        type="number"
        min="0"
        step="100"
        value={data.coutHormone}
        onChange={(e) => onChange({ coutHormone: e.target.value })}
        placeholder="0"
      />

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
// Step 2 — Stripping (edition)
// ---------------------------------------------------------------------------

interface Step2State {
  heureStripping: string;
  poidsOeufsPontesG: string;
  qualiteOeufs: string;
  methodeMale: string;
  motiliteSperme: string;
  notes: string;
}

function Step2StrippingEdit({
  data,
  error,
  loading,
  onChange,
  onSubmit,
  onBack,
}: {
  data: Step2State;
  error: string | null;
  loading: boolean;
  onChange: (patch: Partial<Step2State>) => void;
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
        <SelectTrigger label={t("qualiteOeufsLabel")} aria-label={t("qualiteOeufsLabel")}>
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
        <SelectTrigger label={t("methodeMaleLabel")} aria-label={t("methodeMaleLabel")}>
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
        <SelectTrigger label={t("motiliteSpermeLabel")} aria-label={t("motiliteSpermeLabel")}>
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
// Step 3 — Resultat (edition)
// ---------------------------------------------------------------------------

interface Step3State {
  tauxFecondation: string;
  tauxEclosion: string;
  nombreLarvesViables: string;
  coutTotal: string;
  notes: string;
  isEchec: boolean;
  causeEchec: string;
  echecNotes: string;
}

function Step3ResultatEdit({
  data,
  error,
  loading,
  onChange,
  onSubmit,
  onEchec,
  onBack,
}: {
  data: Step3State;
  error: string | null;
  loading: boolean;
  onChange: (patch: Partial<Step3State>) => void;
  onSubmit: () => void;
  onEchec: () => void;
  onBack: () => void;
}) {
  const t = useTranslations("reproduction.pontes.form");
  const tCause = useTranslations("reproduction.pontes.causeEchec");

  if (data.isEchec) {
    return (
      <div className="space-y-5">
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
          <p className="text-sm font-semibold text-destructive">{t("marquerEchec")}</p>
        </div>

        <Select
          value={data.causeEchec}
          onValueChange={(v) => onChange({ causeEchec: v })}
        >
          <SelectTrigger label={t("causeEchecLabel")} required aria-label={t("causeEchecLabel")}>
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
            onClick={() => onChange({ isEchec: false, causeEchec: "", echecNotes: "" })}
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

      {/* Lien echec */}
      <button
        type="button"
        onClick={() => onChange({ isEchec: true })}
        className="w-full text-sm text-destructive hover:underline underline-offset-2 min-h-[44px] flex items-center justify-center"
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
          {loading ? t("actions.loading") : t("actions.terminer")}
          {!loading && <ChevronRight className="h-4 w-4" aria-hidden />}
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export function PonteCompleterClient({ ponte, initialStep }: Props) {
  const t = useTranslations("reproduction.pontes.form");
  const router = useRouter();

  const [currentStep, setCurrentStep] = useState<CompleterStep>(initialStep);
  const [maxReachedStep, setMaxReachedStep] = useState<CompleterStep>(initialStep);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Step states pré-remplis depuis les données de la ponte
  const [step1, setStep1] = useState<Step1State>({
    typeHormone: ponte.typeHormone ?? "",
    doseHormone: numToStr(ponte.doseHormone),
    doseMgKg: numToStr(ponte.doseMgKg),
    coutHormone: numToStr(ponte.coutHormone),
    heureInjection: isoToDatetimeLocal(ponte.heureInjection),
    temperatureEauC: numToStr(ponte.temperatureEauC),
    latenceTheorique: numToStr(ponte.latenceTheorique),
    notes: ponte.notes ?? "",
  });

  const [step2, setStep2] = useState<Step2State>({
    heureStripping: isoToDatetimeLocal(ponte.heureStripping),
    poidsOeufsPontesG: numToStr(ponte.poidsOeufsPontesG),
    qualiteOeufs: ponte.qualiteOeufs ?? "",
    methodeMale: ponte.methodeMale ?? "",
    motiliteSperme: ponte.motiliteSperme ?? "",
    notes: "",
  });

  const [step3, setStep3] = useState<Step3State>({
    tauxFecondation: numToStr(ponte.tauxFecondation),
    tauxEclosion: numToStr(ponte.tauxEclosion),
    nombreLarvesViables: numToStr(ponte.nombreLarvesViables),
    coutTotal: numToStr(ponte.coutTotal),
    notes: "",
    isEchec: false,
    causeEchec: "",
    echecNotes: "",
  });

  const goToStep = useCallback((step: CompleterStep) => {
    setCurrentStep(step);
    setMaxReachedStep((prev) => (step > prev ? step : prev));
    setError(null);
  }, []);

  // ---------------------------------------------------------------------------
  // Step 1 submit — PATCH /api/reproduction/pontes/[id]
  // ---------------------------------------------------------------------------
  const handleStep1Submit = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const body: Record<string, unknown> = {};

      if (step1.typeHormone) body.typeHormone = step1.typeHormone;
      if (step1.doseHormone) body.doseHormone = parseFloat(step1.doseHormone);
      if (step1.doseMgKg) body.doseMgKg = parseFloat(step1.doseMgKg);
      if (step1.coutHormone) body.coutHormone = parseFloat(step1.coutHormone);
      if (step1.heureInjection)
        body.heureInjection = new Date(step1.heureInjection).toISOString();
      if (step1.temperatureEauC)
        body.temperatureEauC = parseFloat(step1.temperatureEauC);
      if (step1.notes.trim()) body.notes = step1.notes.trim();

      const res = await fetch(`/api/reproduction/pontes/${ponte.id}`, {
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

      // Passer au step suivant ou rediriger si step 2 ou 3 pas encore fait
      goToStep(2);
    } catch {
      setError(t("errors.genericError"));
    } finally {
      setLoading(false);
    }
  }, [step1, ponte.id, t, goToStep]);

  // ---------------------------------------------------------------------------
  // Step 2 submit — PATCH /api/reproduction/pontes/[id]/stripping
  // ---------------------------------------------------------------------------
  const handleStep2Submit = useCallback(async () => {
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
        `/api/reproduction/pontes/${ponte.id}/stripping`,
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

      // Si on vient du step 2 directement depuis le détail, aller au step 3 ou rediriger
      goToStep(3);
    } catch {
      setError(t("errors.genericError"));
    } finally {
      setLoading(false);
    }
  }, [step2, ponte.id, t, goToStep]);

  // ---------------------------------------------------------------------------
  // Step 3 submit — PATCH /api/reproduction/pontes/[id]/resultat
  // ---------------------------------------------------------------------------
  const handleStep3Submit = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const body: Record<string, unknown> = {};

      const tauxF = parseFloat(step3.tauxFecondation);
      if (step3.tauxFecondation !== "" && !isNaN(tauxF))
        body.tauxFecondation = tauxF;

      const tauxE = parseFloat(step3.tauxEclosion);
      if (step3.tauxEclosion !== "" && !isNaN(tauxE))
        body.tauxEclosion = tauxE;

      const nbLarves = parseInt(step3.nombreLarvesViables, 10);
      if (step3.nombreLarvesViables !== "" && !isNaN(nbLarves) && nbLarves > 0)
        body.nombreLarvesViables = nbLarves;

      const cout = parseFloat(step3.coutTotal);
      if (step3.coutTotal !== "" && !isNaN(cout) && cout >= 0)
        body.coutTotal = cout;

      if (step3.notes.trim()) body.notes = step3.notes.trim();

      const res = await fetch(
        `/api/reproduction/pontes/${ponte.id}/resultat`,
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

      // Rediriger vers le détail de la ponte
      router.push(`/reproduction/pontes/${ponte.id}`);
    } catch {
      setError(t("errors.genericError"));
    } finally {
      setLoading(false);
    }
  }, [step3, ponte.id, t, router]);

  // ---------------------------------------------------------------------------
  // Step 3 echec — PATCH /api/reproduction/pontes/[id]/echec
  // ---------------------------------------------------------------------------
  const handleEchec = useCallback(async () => {
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

      const res = await fetch(`/api/reproduction/pontes/${ponte.id}/echec`, {
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

      router.push(`/reproduction/pontes/${ponte.id}`);
    } catch {
      setError(t("errors.genericError"));
    } finally {
      setLoading(false);
    }
  }, [step3, ponte.id, t, router]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const stepTitles: Record<CompleterStep, string> = {
    1: t("steps.injection"),
    2: t("steps.stripping"),
    3: t("steps.resultat"),
  };

  return (
    <div className="flex flex-col gap-4 max-w-lg mx-auto pb-8">
      <Card>
        <CardContent className="pt-6">
          <Stepper currentStep={currentStep} maxReachedStep={maxReachedStep} />

          {currentStep === 1 && (
            <Step1InjectionEdit
              data={step1}
              error={error}
              loading={loading}
              onChange={(patch) =>
                setStep1((prev) => ({ ...prev, ...patch }))
              }
              onSubmit={handleStep1Submit}
            />
          )}

          {currentStep === 2 && (
            <Step2StrippingEdit
              data={step2}
              error={error}
              loading={loading}
              onChange={(patch) =>
                setStep2((prev) => ({ ...prev, ...patch }))
              }
              onSubmit={handleStep2Submit}
              onBack={() => goToStep(1)}
            />
          )}

          {currentStep === 3 && (
            <Step3ResultatEdit
              data={step3}
              error={error}
              loading={loading}
              onChange={(patch) =>
                setStep3((prev) => ({ ...prev, ...patch }))
              }
              onSubmit={handleStep3Submit}
              onEchec={handleEchec}
              onBack={() => goToStep(2)}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
