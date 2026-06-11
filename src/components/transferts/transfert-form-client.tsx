"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Plus, Trash2, AlertTriangle, CheckCircle2, ArrowRight } from "lucide-react";
import { ModeTransfert } from "@/types";
import type { CreateTransfertDTO } from "@/types";
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

export interface BacSourceInfo {
  id: string;
  nom: string;
  vivants: number;
  poidsMoyenG: number;
}

export interface BacDestInfo {
  id: string;
  nom: string;
}

export interface VagueDestInfo {
  id: string;
  code: string;
  nombreInitial: number;
  poidsMoyenInitial: number;
}

export interface UniteProductionOption {
  id: string;
  code: string;
  nom: string;
}

export interface BacsParVague {
  [vagueId: string]: BacDestInfo[];
}

interface TransfertFormClientProps {
  vagueSourceId: string;
  vagueSourceCode: string;
  bacsSource: BacSourceInfo[];
  vaguesGrossissementEnCours: VagueDestInfo[];
  unitesProduction: UniteProductionOption[];
  /** Bacs libres (non assignés) disponibles comme destination en mode A et B */
  bacsLibres: BacDestInfo[];
  /** Bacs déjà assignés à chaque vague dest (keyed par vagueId), pour le mode B */
  bacsParVague?: BacsParVague;
}

// ---------------------------------------------------------------------------
// Form state
// ---------------------------------------------------------------------------

interface GroupeForm {
  bacSourceId: string;
  nombrePoissons: string;
  poidsMoyenG: string;
  nombreMorts: string;
  bacDestId: string;
}

interface NouvelleVagueForm {
  code: string;
  dateDebut: string;
  poidsObjectifKg: string;
  uniteProductionId: string;
  notes: string;
}

const todayISO = () => new Date().toISOString().slice(0, 10);

const DEFAULT_GROUPE: GroupeForm = {
  bacSourceId: "",
  nombrePoissons: "",
  poidsMoyenG: "",
  nombreMorts: "0",
  bacDestId: "",
};

const STEP_LABELS = ["etapes.mode", "etapes.vague", "etapes.groupes", "etapes.confirmation"] as const;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TransfertFormClient({
  vagueSourceId,
  vagueSourceCode,
  bacsSource,
  vaguesGrossissementEnCours,
  unitesProduction,
  bacsLibres,
  bacsParVague = {},
}: TransfertFormClientProps) {
  const t = useTranslations("transferts");
  const router = useRouter();
  const { toast } = useToast();

  const [step, setStep] = useState(1);
  const [mode, setMode] = useState<ModeTransfert | null>(null);
  const [nouvelleVague, setNouvelleVague] = useState<NouvelleVagueForm>({
    code: "",
    dateDebut: todayISO(),
    poidsObjectifKg: "",
    uniteProductionId: "",
    notes: "",
  });
  const [vagueDestId, setVagueDestId] = useState("");
  const [groupes, setGroupes] = useState<GroupeForm[]>([{ ...DEFAULT_GROUPE }]);
  const [notesGlobales, setNotesGlobales] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ---------------------------------------------------------------------------
  // Stepper
  // ---------------------------------------------------------------------------

  const maxStep = 4;

  function clearErrors() {
    setErrors({});
  }

  // ---------------------------------------------------------------------------
  // Step 1 — Mode validation
  // ---------------------------------------------------------------------------

  function validateStep1(): boolean {
    if (!mode) {
      setErrors({ mode: t("validation.modeRequis") });
      return false;
    }
    return true;
  }

  function handleStep1Next() {
    clearErrors();
    if (validateStep1()) setStep(2);
  }

  // ---------------------------------------------------------------------------
  // Step 2 — Vague info validation
  // ---------------------------------------------------------------------------

  function validateStep2(): boolean {
    const errs: Record<string, string> = {};
    if (mode === ModeTransfert.CREATE_NEW) {
      if (!nouvelleVague.code.trim()) errs["nv_code"] = t("validation.codeRequis");
      if (!nouvelleVague.dateDebut) errs["nv_dateDebut"] = t("validation.datDebutRequise");
    } else {
      if (!vagueDestId) errs["vagueDestId"] = t("validation.vagueDestRequise");
      else if (vagueDestId === vagueSourceId) errs["vagueDestId"] = t("validation.vagueDestMemeQueSource");
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function handleStep2Next() {
    clearErrors();
    if (validateStep2()) setStep(3);
  }

  // ---------------------------------------------------------------------------
  // Step 3 — Groupes validation
  // ---------------------------------------------------------------------------

  function validateStep3(): boolean {
    const errs: Record<string, string> = {};
    if (groupes.length === 0) {
      errs["groupes"] = t("validation.auMoinsUnGroupe");
    }
    groupes.forEach((g, i) => {
      if (!g.bacSourceId) errs[`g${i}_bacSourceId`] = t("validation.bacSourceRequis");
      if (!g.bacDestId) errs[`g${i}_bacDestId`] = t("validation.bacDestRequis");
      const nb = Number(g.nombrePoissons);
      if (!g.nombrePoissons || isNaN(nb) || nb <= 0) {
        errs[`g${i}_nombrePoissons`] = t("validation.nombrePoissonsPositif");
      } else {
        // Check overflow vs vivants
        const bac = bacsSource.find((b) => b.id === g.bacSourceId);
        if (bac && nb > bac.vivants) {
          errs[`g${i}_nombrePoissons`] = t("validation.depassementVivants");
        }
      }
      const pm = Number(g.poidsMoyenG);
      if (!g.poidsMoyenG || isNaN(pm) || pm <= 0) {
        errs[`g${i}_poidsMoyenG`] = t("validation.poidsMoyenPositif");
      }
      const morts = Number(g.nombreMorts);
      if (isNaN(morts) || morts < 0) {
        errs[`g${i}_nombreMorts`] = t("validation.nombreMortsPositif");
      }
    });
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function handleStep3Next() {
    clearErrors();
    if (validateStep3()) setStep(4);
  }

  // ---------------------------------------------------------------------------
  // Groupes helpers
  // ---------------------------------------------------------------------------

  function updateGroupe(index: number, field: keyof GroupeForm, value: string) {
    setGroupes((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      // Auto-fill poidsMoyenG from bac source selection
      if (field === "bacSourceId" && value) {
        const bac = bacsSource.find((b) => b.id === value);
        if (bac && bac.poidsMoyenG > 0 && !next[index].poidsMoyenG) {
          next[index].poidsMoyenG = String(bac.poidsMoyenG);
        }
      }
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
  // Submit
  // ---------------------------------------------------------------------------

  async function handleSubmit() {
    setIsSubmitting(true);
    try {
      let dto: CreateTransfertDTO;
      const groupesDto = groupes.map((g) => ({
        vagueSourceId,
        bacSourceId: g.bacSourceId || null,
        bacDestId: g.bacDestId, // garanti non-vide par validateStep3
        nombrePoissons: Number(g.nombrePoissons),
        poidsMoyenG: Number(g.poidsMoyenG),
        nombreMorts: Number(g.nombreMorts) || 0,
      }));

      if (mode === ModeTransfert.CREATE_NEW) {
        dto = {
          mode: ModeTransfert.CREATE_NEW,
          nouvelleVague: {
            code: nouvelleVague.code.trim(),
            dateDebut: new Date(nouvelleVague.dateDebut).toISOString(),
            poidsObjectifKg: nouvelleVague.poidsObjectifKg ? Number(nouvelleVague.poidsObjectifKg) : null,
            uniteProductionId: nouvelleVague.uniteProductionId || null,
            notes: nouvelleVague.notes.trim() || null,
          },
          groupes: groupesDto,
          notes: notesGlobales.trim() || null,
        };
      } else {
        dto = {
          mode: ModeTransfert.USE_EXISTING,
          vagueDestId,
          groupes: groupesDto,
          notes: notesGlobales.trim() || null,
        };
      }

      const res = await fetch("/api/transferts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dto),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        if (res.status === 409) {
          toast({ title: t("error.conservation"), variant: "error" });
        } else if (res.status === 400) {
          toast({ title: t("error.validation"), description: body?.message, variant: "error" });
        } else {
          toast({ title: t("error.generic"), variant: "error" });
        }
        return;
      }

      const data = await res.json();
      toast({ title: t("success"), variant: "success" });

      // Redirect: if mode A, go to new vague; else go back to source
      if (mode === ModeTransfert.CREATE_NEW && data?.vagueDest?.id) {
        router.push(`/vagues/${data.vagueDest.id}`);
      } else {
        router.push(`/vagues/${vagueSourceId}`);
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Derived
  // ---------------------------------------------------------------------------

  const totalTransfere = groupes.reduce((sum, g) => sum + (Number(g.nombrePoissons) || 0), 0);
  const totalMorts = groupes.reduce((sum, g) => sum + (Number(g.nombreMorts) || 0), 0);

  // Bac destination list :
  // - Mode A (nouvelle vague) : bacs libres uniquement
  // - Mode B (vague existante) : bacs libres + bacs déjà assignés à la vague dest (dédupliqués)
  const bacsDestDisplay: BacDestInfo[] = (() => {
    if (mode === ModeTransfert.USE_EXISTING && vagueDestId) {
      const bacsVagueDest = bacsParVague[vagueDestId] ?? [];
      const seen = new Set<string>();
      const merged: BacDestInfo[] = [];
      for (const b of [...bacsLibres, ...bacsVagueDest]) {
        if (!seen.has(b.id)) {
          seen.add(b.id);
          merged.push(b);
        }
      }
      return merged;
    }
    return bacsLibres;
  })();

  const vagueDestInfo = vaguesGrossissementEnCours.find((v) => v.id === vagueDestId);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="flex flex-col gap-4 pb-40 sm:pb-24">
      {/* Stepper */}
      <div className="flex items-center gap-1">
        {STEP_LABELS.map((labelKey, i) => {
          const stepNum = i + 1;
          const isActive = stepNum === step;
          const isDone = stepNum < step;
          return (
            <div key={i} className="flex items-center gap-1 flex-1 min-w-0">
              <div
                className={`flex items-center justify-center rounded-full text-xs font-semibold h-6 w-6 shrink-0 transition-colors ${
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : isDone
                    ? "bg-success text-white"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {isDone ? "✓" : stepNum}
              </div>
              <span
                className={`text-xs hidden sm:block truncate ${
                  isActive ? "font-semibold text-foreground" : "text-muted-foreground"
                }`}
              >
                {t(labelKey)}
              </span>
              {i < STEP_LABELS.length - 1 && (
                <div className={`flex-1 h-px mx-1 shrink-0 ${isDone ? "bg-success" : "bg-border"}`} />
              )}
            </div>
          );
        })}
      </div>

      {/* Step 1 — Mode */}
      {step === 1 && (
        <StepMode
          t={t}
          mode={mode}
          onModeChange={(m) => { setMode(m); clearErrors(); }}
          error={errors["mode"]}
          onNext={handleStep1Next}
        />
      )}

      {/* Step 2A — Nouvelle vague */}
      {step === 2 && mode === ModeTransfert.CREATE_NEW && (
        <StepNouvelleVague
          t={t}
          values={nouvelleVague}
          onChange={(field, value) => setNouvelleVague((prev) => ({ ...prev, [field]: value }))}
          unitesProduction={unitesProduction}
          errors={errors}
          onBack={() => setStep(1)}
          onNext={handleStep2Next}
        />
      )}

      {/* Step 2B — Vague existante */}
      {step === 2 && mode === ModeTransfert.USE_EXISTING && (
        <StepVagueExistante
          t={t}
          vagueDestId={vagueDestId}
          vagues={vaguesGrossissementEnCours}
          error={errors["vagueDestId"]}
          onVagueChange={(id) => { setVagueDestId(id); clearErrors(); }}
          onBack={() => setStep(1)}
          onNext={handleStep2Next}
        />
      )}

      {/* Step 3 — Groupes */}
      {step === 3 && (
        <StepGroupes
          t={t}
          groupes={groupes}
          bacsSource={bacsSource}
          bacsDest={bacsDestDisplay}
          showBacDest={true}
          errors={errors}
          totalTransfere={totalTransfere}
          onUpdate={updateGroupe}
          onAdd={addGroupe}
          onRemove={removeGroupe}
          onBack={() => setStep(2)}
          onNext={handleStep3Next}
        />
      )}

      {/* Step 4 — Confirmation */}
      {step === 4 && (
        <StepConfirmation
          t={t}
          mode={mode!}
          vagueSourceCode={vagueSourceCode}
          vagueDestCode={
            mode === ModeTransfert.CREATE_NEW
              ? nouvelleVague.code
              : (vagueDestInfo?.code ?? vagueDestId)
          }
          groupes={groupes}
          bacsSource={bacsSource}
          bacsDest={bacsDestDisplay}
          totalTransfere={totalTransfere}
          totalMorts={totalMorts}
          notes={notesGlobales}
          onNotesChange={setNotesGlobales}
          onBack={() => setStep(3)}
          onSubmit={handleSubmit}
          isSubmitting={isSubmitting}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

type TFn = ReturnType<typeof useTranslations<"transferts">>;

// Step 1 — Mode selection
function StepMode({
  t,
  mode,
  onModeChange,
  error,
  onNext,
}: {
  t: TFn;
  mode: ModeTransfert | null;
  onModeChange: (m: ModeTransfert) => void;
  error?: string;
  onNext: () => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-base font-semibold">{t("stepMode.title")}</h2>
        <p className="text-sm text-muted-foreground mt-1">{t("stepMode.description")}</p>
      </div>

      <div className="flex flex-col gap-3">
        <button
          type="button"
          onClick={() => onModeChange(ModeTransfert.CREATE_NEW)}
          className={`w-full text-left rounded-xl border-2 p-4 transition-colors ${
            mode === ModeTransfert.CREATE_NEW
              ? "border-primary bg-primary/5"
              : "border-border hover:border-primary/40"
          }`}
        >
          <div className="flex items-start gap-3">
            <div className={`mt-0.5 h-4 w-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
              mode === ModeTransfert.CREATE_NEW ? "border-primary" : "border-muted-foreground"
            }`}>
              {mode === ModeTransfert.CREATE_NEW && (
                <div className="h-2 w-2 rounded-full bg-primary" />
              )}
            </div>
            <div>
              <p className="font-semibold text-sm">{t("stepMode.modeA.titre")}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{t("stepMode.modeA.description")}</p>
            </div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => onModeChange(ModeTransfert.USE_EXISTING)}
          className={`w-full text-left rounded-xl border-2 p-4 transition-colors ${
            mode === ModeTransfert.USE_EXISTING
              ? "border-primary bg-primary/5"
              : "border-border hover:border-primary/40"
          }`}
        >
          <div className="flex items-start gap-3">
            <div className={`mt-0.5 h-4 w-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
              mode === ModeTransfert.USE_EXISTING ? "border-primary" : "border-muted-foreground"
            }`}>
              {mode === ModeTransfert.USE_EXISTING && (
                <div className="h-2 w-2 rounded-full bg-primary" />
              )}
            </div>
            <div>
              <p className="font-semibold text-sm">{t("stepMode.modeB.titre")}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{t("stepMode.modeB.description")}</p>
            </div>
          </div>
        </button>
      </div>

      {error && (
        <p className="text-sm text-danger flex items-center gap-1.5">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {error}
        </p>
      )}

      <StickyBar onNext={onNext} nextLabel={t("stepMode.suivant")} />
    </div>
  );
}

// Step 2A — Nouvelle vague form
function StepNouvelleVague({
  t,
  values,
  onChange,
  unitesProduction,
  errors,
  onBack,
  onNext,
}: {
  t: TFn;
  values: NouvelleVagueForm;
  onChange: (field: keyof NouvelleVagueForm, value: string) => void;
  unitesProduction: UniteProductionOption[];
  errors: Record<string, string>;
  onBack: () => void;
  onNext: () => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-base font-semibold">{t("stepNouvelleVague.title")}</h2>
        <p className="text-sm text-muted-foreground mt-1">{t("stepNouvelleVague.description")}</p>
      </div>

      <div className="flex flex-col gap-4">
        <Input
          label={t("stepNouvelleVague.code")}
          required
          placeholder={t("stepNouvelleVague.codePlaceholder")}
          value={values.code}
          onChange={(e) => onChange("code", e.target.value)}
          error={errors["nv_code"]}
        />

        <Input
          label={t("stepNouvelleVague.dateDebut")}
          required
          type="date"
          value={values.dateDebut}
          onChange={(e) => onChange("dateDebut", e.target.value)}
          error={errors["nv_dateDebut"]}
        />

        <Input
          label={t("stepNouvelleVague.poidsObjectif")}
          type="number"
          min="0"
          step="0.1"
          value={values.poidsObjectifKg}
          onChange={(e) => onChange("poidsObjectifKg", e.target.value)}
        />

        {unitesProduction.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-foreground">{t("stepNouvelleVague.uniteProduction")}</label>
            <Select
              value={values.uniteProductionId}
              onValueChange={(v) => onChange("uniteProductionId", v)}
            >
              <SelectTrigger>
                <SelectValue placeholder={t("stepNouvelleVague.uniteProductionPlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                {unitesProduction.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.code} — {u.nom}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <Textarea
          label={t("stepNouvelleVague.notes")}
          placeholder={t("stepNouvelleVague.notesPlaceholder")}
          value={values.notes}
          onChange={(e) => onChange("notes", e.target.value)}
          rows={3}
        />
      </div>

      <StickyBar onBack={onBack} onNext={onNext} nextLabel={t("stepNouvelleVague.suivant")} backLabel={t("stepNouvelleVague.retour")} />
    </div>
  );
}

// Step 2B — Vague existante selection
function StepVagueExistante({
  t,
  vagueDestId,
  vagues,
  error,
  onVagueChange,
  onBack,
  onNext,
}: {
  t: TFn;
  vagueDestId: string;
  vagues: VagueDestInfo[];
  error?: string;
  onVagueChange: (id: string) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-base font-semibold">{t("stepVagueExistante.title")}</h2>
        <p className="text-sm text-muted-foreground mt-1">{t("stepVagueExistante.description")}</p>
      </div>

      {vagues.length === 0 ? (
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">{t("stepVagueExistante.aucuneVague")}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {vagues.map((v) => {
            const isSelected = vagueDestId === v.id;
            const isEmpty = v.nombreInitial === 0;
            return (
              <button
                key={v.id}
                type="button"
                onClick={() => onVagueChange(v.id)}
                className={`w-full text-left rounded-xl border-2 p-4 transition-colors ${
                  isSelected ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`h-4 w-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                    isSelected ? "border-primary" : "border-muted-foreground"
                  }`}>
                    {isSelected && <div className="h-2 w-2 rounded-full bg-primary" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm">{v.code}</span>
                      {isEmpty && (
                        <span className="text-xs bg-muted text-muted-foreground rounded-full px-2 py-0.5">
                          {t("stepVagueExistante.vagueVide")}
                        </span>
                      )}
                    </div>
                    {!isEmpty && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {t("stepVagueExistante.poissonsInitiaux", { count: v.nombreInitial })}
                        {v.poidsMoyenInitial > 0 && (
                          <> — {t("stepVagueExistante.poidsMoyen", { poids: v.poidsMoyenInitial.toFixed(0) })}</>
                        )}
                      </p>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {vagueDestId && (
        <div className="flex items-start gap-2 rounded-xl border border-primary/30 bg-primary/5 p-3">
          <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" />
          <p className="text-xs text-primary">{t("stepVagueExistante.noteRecalcul")}</p>
        </div>
      )}

      {error && (
        <p className="text-sm text-danger flex items-center gap-1.5">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {error}
        </p>
      )}

      <StickyBar onBack={onBack} onNext={onNext} nextLabel={t("stepVagueExistante.suivant")} backLabel={t("stepVagueExistante.retour")} />
    </div>
  );
}

// Step 3 — Groupes
function StepGroupes({
  t,
  groupes,
  bacsSource,
  bacsDest,
  showBacDest,
  errors,
  totalTransfere,
  onUpdate,
  onAdd,
  onRemove,
  onBack,
  onNext,
}: {
  t: TFn;
  groupes: GroupeForm[];
  bacsSource: BacSourceInfo[];
  bacsDest: BacDestInfo[];
  showBacDest: boolean;
  errors: Record<string, string>;
  totalTransfere: number;
  onUpdate: (i: number, f: keyof GroupeForm, v: string) => void;
  onAdd: () => void;
  onRemove: (i: number) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const totalSourceVivants = bacsSource.reduce((sum, b) => sum + b.vivants, 0);
  const isOverflow = totalTransfere > totalSourceVivants;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-base font-semibold">{t("stepGroupes.title")}</h2>
        <p className="text-sm text-muted-foreground mt-1">{t("stepGroupes.description")}</p>
      </div>

      {/* Summary bar */}
      <div className={`rounded-xl border p-3 flex items-center gap-2 ${
        isOverflow ? "border-danger/30 bg-danger/5 text-danger" : "border-border bg-muted/30"
      }`}>
        {isOverflow ? (
          <AlertTriangle className="h-4 w-4 shrink-0" />
        ) : (
          <CheckCircle2 className="h-4 w-4 shrink-0 text-muted-foreground" />
        )}
        <div className="text-xs">
          <span className="font-semibold">{t("stepGroupes.totalTransfere", { count: totalTransfere })}</span>
          {" / "}
          <span>{t("stepGroupes.totalSource", { vivants: totalSourceVivants })}</span>
          {isOverflow && (
            <span className="ml-1 font-semibold">
              ({t("stepGroupes.depassement", { count: totalTransfere - totalSourceVivants })})
            </span>
          )}
        </div>
      </div>

      {errors["groupes"] && (
        <p className="text-sm text-danger">{errors["groupes"]}</p>
      )}

      {/* Groupes list — cards on mobile */}
      <div className="flex flex-col gap-3">
        {groupes.map((g, i) => {
          const sourceBac = bacsSource.find((b) => b.id === g.bacSourceId);
          return (
            <Card key={i}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">{t("stepGroupes.groupeLabel", { index: i + 1 })}</CardTitle>
                  {groupes.length > 1 && (
                    <button
                      type="button"
                      onClick={() => onRemove(i)}
                      className="text-muted-foreground hover:text-danger p-1 rounded-lg transition-colors"
                      aria-label={t("stepGroupes.supprimerGroupe")}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col gap-3">
                  {/* Bac source */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-foreground">
                      {t("stepGroupes.bacSource")}
                      <span className="text-destructive ml-0.5">*</span>
                    </label>
                    <Select
                      value={g.bacSourceId}
                      onValueChange={(v) => onUpdate(i, "bacSourceId", v)}
                    >
                      <SelectTrigger error={errors[`g${i}_bacSourceId`]}>
                        <SelectValue placeholder={t("stepGroupes.choisirBacSource")} />
                      </SelectTrigger>
                      <SelectContent>
                        {bacsSource.map((b) => (
                          <SelectItem key={b.id} value={b.id}>
                            {b.nom} — {b.vivants} vivants
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {sourceBac && (
                      <p className="text-xs text-muted-foreground">
                        {t("stepGroupes.bacSourceHint", { vivants: sourceBac.vivants })}
                      </p>
                    )}
                  </div>

                  {/* Nombre poissons + poids moyen — side by side on md+ */}
                  <div className="grid grid-cols-2 gap-3">
                    <Input
                      label={t("stepGroupes.nombrePoissons")}
                      required
                      type="number"
                      min="1"
                      step="1"
                      value={g.nombrePoissons}
                      onChange={(e) => onUpdate(i, "nombrePoissons", e.target.value)}
                      error={errors[`g${i}_nombrePoissons`]}
                    />
                    <Input
                      label={t("stepGroupes.poidsMoyenG")}
                      required
                      type="number"
                      min="0.1"
                      step="0.1"
                      value={g.poidsMoyenG}
                      onChange={(e) => onUpdate(i, "poidsMoyenG", e.target.value)}
                      error={errors[`g${i}_poidsMoyenG`]}
                    />
                  </div>

                  {/* Morts */}
                  <Input
                    label={t("stepGroupes.nombreMorts")}
                    type="number"
                    min="0"
                    step="1"
                    value={g.nombreMorts}
                    onChange={(e) => onUpdate(i, "nombreMorts", e.target.value)}
                    error={errors[`g${i}_nombreMorts`]}
                  />

                  {/* Bac destination — obligatoire dans tous les modes */}
                  {showBacDest && (
                    <div className="flex flex-col gap-1.5">
                      <label className="text-sm font-medium text-foreground">
                        {t("stepGroupes.bacDest")}
                        <span className="text-destructive ml-0.5">*</span>
                      </label>
                      {bacsDest.length === 0 ? (
                        <p className="text-sm text-muted-foreground rounded-lg border border-border bg-muted/30 px-3 py-2">
                          {t("stepGroupes.aucunBacDest")}
                        </p>
                      ) : (
                        <Select
                          value={g.bacDestId}
                          onValueChange={(v) => onUpdate(i, "bacDestId", v)}
                        >
                          <SelectTrigger error={errors[`g${i}_bacDestId`]}>
                            <SelectValue placeholder={t("stepGroupes.choisirBacDest")} />
                          </SelectTrigger>
                          <SelectContent>
                            {bacsDest.map((b) => (
                              <SelectItem key={b.id} value={b.id}>
                                {b.nom}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                      {errors[`g${i}_bacDestId`] && (
                        <p className="text-xs text-destructive flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3 shrink-0" />
                          {errors[`g${i}_bacDestId`]}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Button variant="outline" type="button" onClick={onAdd} className="w-full">
        <Plus className="h-4 w-4" />
        {t("stepGroupes.ajouterGroupe")}
      </Button>

      <StickyBar onBack={onBack} onNext={onNext} nextLabel={t("stepGroupes.suivant")} backLabel={t("stepGroupes.retour")} />
    </div>
  );
}

// Step 4 — Confirmation
function StepConfirmation({
  t,
  mode,
  vagueSourceCode,
  vagueDestCode,
  groupes,
  bacsSource,
  bacsDest,
  totalTransfere,
  totalMorts,
  notes,
  onNotesChange,
  onBack,
  onSubmit,
  isSubmitting,
}: {
  t: TFn;
  mode: ModeTransfert;
  vagueSourceCode: string;
  vagueDestCode: string;
  groupes: GroupeForm[];
  bacsSource: BacSourceInfo[];
  bacsDest: BacDestInfo[];
  totalTransfere: number;
  totalMorts: number;
  notes: string;
  onNotesChange: (v: string) => void;
  onBack: () => void;
  onSubmit: () => void;
  isSubmitting: boolean;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-base font-semibold">{t("stepConfirmation.title")}</h2>
        <p className="text-sm text-muted-foreground mt-1">{t("stepConfirmation.description")}</p>
      </div>

      {/* Source → Destination */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex flex-col">
              <span className="text-xs text-muted-foreground">{t("stepConfirmation.source")}</span>
              <span className="font-semibold text-sm">{vagueSourceCode}</span>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
            <div className="flex flex-col">
              <span className="text-xs text-muted-foreground">{t("stepConfirmation.destination")}</span>
              <span className="font-semibold text-sm">
                {mode === ModeTransfert.CREATE_NEW
                  ? t("stepConfirmation.modeA", { code: vagueDestCode })
                  : t("stepConfirmation.modeB", { code: vagueDestCode })}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Groupes */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">{t("stepConfirmation.groupes")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col divide-y divide-border">
            {groupes.map((g, i) => {
              const srcBac = bacsSource.find((b) => b.id === g.bacSourceId);
              const dstBac = bacsDest.find((b) => b.id === g.bacDestId);
              return (
                <div key={i} className="py-2 first:pt-0 last:pb-0">
                  <p className="text-sm font-medium">
                    {srcBac && dstBac
                      ? t("stepConfirmation.groupeResume", {
                          source: srcBac.nom,
                          dest: dstBac.nom,
                          poissons: g.nombrePoissons,
                          poids: g.poidsMoyenG,
                        })
                      : t("stepConfirmation.groupeResumeNoBacs", {
                          poissons: g.nombrePoissons,
                          poids: g.poidsMoyenG,
                        })}
                  </p>
                  {srcBac && !dstBac && (
                    <p className="text-xs text-muted-foreground">{srcBac.nom}</p>
                  )}
                  {Number(g.nombreMorts) > 0 && (
                    <p className="text-xs text-danger mt-0.5">
                      {t("stepConfirmation.mortsTotal", { count: g.nombreMorts })}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Totaux */}
      <div className="flex gap-3">
        <div className="flex-1 rounded-xl border border-border bg-muted/30 p-3 text-center">
          <p className="text-xs text-muted-foreground">{t("stepConfirmation.total")}</p>
          <p className="font-bold text-base">{t("stepConfirmation.poissonsTotal", { count: totalTransfere })}</p>
        </div>
        {totalMorts > 0 && (
          <div className="flex-1 rounded-xl border border-danger/30 bg-danger/5 p-3 text-center">
            <p className="text-xs text-danger/70">{t("stepConfirmation.mortsTotal", { count: "" }).trim()}</p>
            <p className="font-bold text-base text-danger">{totalMorts}</p>
          </div>
        )}
      </div>

      {/* Notes globales */}
      <Textarea
        label={t("stepConfirmation.notes")}
        placeholder={t("stepConfirmation.notesPlaceholder")}
        value={notes}
        onChange={(e) => onNotesChange(e.target.value)}
        rows={3}
      />

      <StickyBar
        onBack={onBack}
        onNext={onSubmit}
        nextLabel={isSubmitting ? t("stepConfirmation.confirmation") : t("stepConfirmation.confirmer")}
        backLabel={t("stepConfirmation.retour")}
        nextDisabled={isSubmitting}
      />
    </div>
  );
}

// Sticky bottom navigation bar
function StickyBar({
  onBack,
  onNext,
  nextLabel,
  backLabel,
  nextDisabled = false,
}: {
  onBack?: () => void;
  onNext: () => void;
  nextLabel: string;
  backLabel?: string;
  nextDisabled?: boolean;
}) {
  return (
    <div className="fixed bottom-[calc(64px+env(safe-area-inset-bottom))] md:bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur border-t border-border p-4 flex gap-3 sm:static sm:bg-transparent sm:backdrop-blur-none sm:border-0 sm:p-0 sm:mt-2">
      {onBack && backLabel && (
        <Button variant="outline" type="button" onClick={onBack} className="flex-1 sm:flex-none">
          {backLabel}
        </Button>
      )}
      <Button
        type="button"
        onClick={onNext}
        disabled={nextDisabled}
        className="flex-1 sm:flex-none sm:ml-auto"
      >
        {nextLabel}
      </Button>
    </div>
  );
}
