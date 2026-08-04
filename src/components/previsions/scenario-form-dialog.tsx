"use client";

/**
 * src/components/previsions/scenario-form-dialog.tsx
 *
 * Dialog de creation d'un ScenarioPrevision complet (ScenarioPrevision +
 * ParametresPrevision 1-1 obligatoire, ADR-053 §3.3). R5 : `DialogTrigger
 * asChild`. Etat local par champ (string), converti en number a la
 * soumission — patron `step-groupes.tsx`/`calibrage-form-client.tsx` (pas de
 * react-hook-form/zod cote client dans ce depot).
 */
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormSection } from "@/components/ui/form-section";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
} from "@/components/ui/dialog";
import { Plus } from "lucide-react";
import { usePrevisionsApi } from "@/hooks/use-previsions-api";
import { useDialogCloseGuard } from "@/hooks/use-dialog-close-guard";
import type { ScenarioPrevisionSummaryDTO } from "@/components/previsions/api-types";

interface FormState {
  code: string;
  nom: string;
  description: string;
  dureeCycleMois: string;
  dateDebutPlan: string;
  effectifAlevinsParVague: string;
  margeSecuriteAlevinsPct: string;
  poidsMoyenInitialG: string;
  poidsObjectifG: string;
  prixAlevinUnitaireFCFA: string;
  prixVenteKgFCFA: string;
  nombreBacsSimultanesCible: string;
  frequenceStockageMois: string;
  capaciteTransportAlimentsSacs: string;
  coutTransportAlimentsFCFA: string;
  capaciteTransportPoissonsKg: string;
  coutTransportPoissonsFCFA: string;
  capaciteTransportAlevinsNb: string;
  coutTransportAlevinsFCFA: string;
}

const EMPTY_STATE: FormState = {
  code: "",
  nom: "",
  description: "",
  dureeCycleMois: "3",
  dateDebutPlan: "",
  effectifAlevinsParVague: "",
  margeSecuriteAlevinsPct: "",
  poidsMoyenInitialG: "",
  poidsObjectifG: "",
  prixAlevinUnitaireFCFA: "",
  prixVenteKgFCFA: "",
  nombreBacsSimultanesCible: "",
  frequenceStockageMois: "",
  capaciteTransportAlimentsSacs: "",
  coutTransportAlimentsFCFA: "",
  capaciteTransportPoissonsKg: "",
  coutTransportPoissonsFCFA: "",
  capaciteTransportAlevinsNb: "",
  coutTransportAlevinsFCFA: "",
};

const REQUIRED_FIELDS: (keyof FormState)[] = [
  "code",
  "nom",
  "dateDebutPlan",
  "effectifAlevinsParVague",
  "margeSecuriteAlevinsPct",
  "poidsMoyenInitialG",
  "poidsObjectifG",
  "prixAlevinUnitaireFCFA",
  "prixVenteKgFCFA",
  "nombreBacsSimultanesCible",
  "frequenceStockageMois",
];

interface ScenarioFormDialogProps {
  onCreated: (scenario: ScenarioPrevisionSummaryDTO) => void;
}

export function ScenarioFormDialog({ onCreated }: ScenarioFormDialogProps) {
  const t = useTranslations("previsions");
  const tCommon = useTranslations("common");
  const { post } = usePrevisionsApi();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_STATE);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  // Bug B (pre-analyse PR2ter.2) : le composant n'est jamais demonte entre
  // deux ouvertures (monte statiquement par le parent) — `touched` + le
  // reset dans `handleOpenChange` garantissent qu'aucune ancienne valeur ne
  // survit a la reouverture, quel que soit le chemin de fermeture.
  const [touched, setTouched] = useState(false);
  const { onInteractOutside, onEscapeKeyDown } = useDialogCloseGuard(touched);

  function update(field: keyof FormState, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
    setTouched(true);
  }

  function resetForm() {
    setForm(EMPTY_STATE);
    setErrors({});
    setTouched(false);
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) resetForm();
  }

  function validate(): boolean {
    const next: Record<string, string> = {};
    for (const field of REQUIRED_FIELDS) {
      if (!form[field].trim()) next[field] = t("scenarioForm.requiredError");
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit() {
    if (!validate()) return;
    setSubmitting(true);
    try {
      const optionalNumber = (v: string) => (v.trim() ? Number(v) : undefined);
      const result = await post<ScenarioPrevisionSummaryDTO>("/api/previsions/scenarios", {
        code: form.code.trim(),
        nom: form.nom.trim(),
        description: form.description.trim() || null,
        dureeCycleMois: Number(form.dureeCycleMois) || 3,
        dateDebutPlan: new Date(form.dateDebutPlan).toISOString(),
        parametres: {
          effectifAlevinsParVague: Number(form.effectifAlevinsParVague),
          margeSecuriteAlevinsPct: Number(form.margeSecuriteAlevinsPct),
          poidsMoyenInitialG: Number(form.poidsMoyenInitialG),
          poidsObjectifG: Number(form.poidsObjectifG),
          prixAlevinUnitaireFCFA: Number(form.prixAlevinUnitaireFCFA),
          prixVenteKgFCFA: Number(form.prixVenteKgFCFA),
          nombreBacsSimultanesCible: Number(form.nombreBacsSimultanesCible),
          frequenceStockageMois: Number(form.frequenceStockageMois),
          capaciteTransportAlimentsSacs: optionalNumber(form.capaciteTransportAlimentsSacs),
          coutTransportAlimentsFCFA: optionalNumber(form.coutTransportAlimentsFCFA),
          capaciteTransportPoissonsKg: optionalNumber(form.capaciteTransportPoissonsKg),
          coutTransportPoissonsFCFA: optionalNumber(form.coutTransportPoissonsFCFA),
          capaciteTransportAlevinsNb: optionalNumber(form.capaciteTransportAlevinsNb),
          coutTransportAlevinsFCFA: optionalNumber(form.coutTransportAlevinsFCFA),
        },
      });
      if (result.ok && result.data) {
        onCreated(result.data);
        handleOpenChange(false);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button className="w-full md:w-auto">
          <Plus className="h-4 w-4" />
          {t("scenarioForm.triggerButton")}
        </Button>
      </DialogTrigger>
      <DialogContent onInteractOutside={onInteractOutside} onEscapeKeyDown={onEscapeKeyDown}>
        <DialogHeader>
          <DialogTitle>{t("scenarioForm.dialogTitle")}</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <div className="flex flex-col gap-4">
            <FormSection title={t("scenarioForm.sections.identification.title")}>
              <Input
                label={t("scenarioForm.fields.code.label")}
                required
                placeholder={t("scenarioForm.fields.code.placeholder")}
                value={form.code}
                onChange={(e) => update("code", e.target.value)}
                error={errors.code}
              />
              <Input
                label={t("scenarioForm.fields.nom.label")}
                required
                placeholder={t("scenarioForm.fields.nom.placeholder")}
                value={form.nom}
                onChange={(e) => update("nom", e.target.value)}
                error={errors.nom}
              />
              <Input
                label={t("scenarioForm.fields.description.label")}
                value={form.description}
                onChange={(e) => update("description", e.target.value)}
              />
              <Input
                label={t("scenarioForm.fields.dureeCycleMois.label")}
                type="number"
                inputMode="numeric"
                min={1}
                step={1}
                value={form.dureeCycleMois}
                onChange={(e) => update("dureeCycleMois", e.target.value)}
                hint={t("scenarioForm.fields.dureeCycleMois.hint")}
              />
              <Input
                label={t("scenarioForm.fields.dateDebutPlan.label")}
                type="date"
                required
                value={form.dateDebutPlan}
                onChange={(e) => update("dateDebutPlan", e.target.value)}
                error={errors.dateDebutPlan}
              />
            </FormSection>

            <FormSection
              title={t("scenarioForm.sections.parametres.title")}
              description={t("scenarioForm.sections.parametres.description")}
            >
              <Input
                label={t("scenarioForm.fields.effectifAlevinsParVague.label")}
                type="number"
                inputMode="numeric"
                min={1}
                step={1}
                required
                value={form.effectifAlevinsParVague}
                onChange={(e) => update("effectifAlevinsParVague", e.target.value)}
                error={errors.effectifAlevinsParVague}
              />
              <Input
                label={t("scenarioForm.fields.margeSecuriteAlevinsPct.label")}
                type="number"
                inputMode="decimal"
                min={0}
                required
                value={form.margeSecuriteAlevinsPct}
                onChange={(e) => update("margeSecuriteAlevinsPct", e.target.value)}
                error={errors.margeSecuriteAlevinsPct}
                hint={t("scenarioForm.fields.margeSecuriteAlevinsPct.hint")}
              />
              <Input
                label={t("scenarioForm.fields.poidsMoyenInitialG.label")}
                type="number"
                inputMode="decimal"
                min={0}
                required
                value={form.poidsMoyenInitialG}
                onChange={(e) => update("poidsMoyenInitialG", e.target.value)}
                error={errors.poidsMoyenInitialG}
              />
              <Input
                label={t("scenarioForm.fields.poidsObjectifG.label")}
                type="number"
                inputMode="decimal"
                min={0}
                required
                value={form.poidsObjectifG}
                onChange={(e) => update("poidsObjectifG", e.target.value)}
                error={errors.poidsObjectifG}
              />
              <Input
                label={t("scenarioForm.fields.prixAlevinUnitaireFCFA.label")}
                type="number"
                inputMode="decimal"
                min={0}
                required
                value={form.prixAlevinUnitaireFCFA}
                onChange={(e) => update("prixAlevinUnitaireFCFA", e.target.value)}
                error={errors.prixAlevinUnitaireFCFA}
              />
              <Input
                label={t("scenarioForm.fields.prixVenteKgFCFA.label")}
                type="number"
                inputMode="decimal"
                min={0}
                required
                value={form.prixVenteKgFCFA}
                onChange={(e) => update("prixVenteKgFCFA", e.target.value)}
                error={errors.prixVenteKgFCFA}
              />
              <Input
                label={t("scenarioForm.fields.nombreBacsSimultanesCible.label")}
                type="number"
                inputMode="numeric"
                min={1}
                step={1}
                required
                value={form.nombreBacsSimultanesCible}
                onChange={(e) => update("nombreBacsSimultanesCible", e.target.value)}
                error={errors.nombreBacsSimultanesCible}
                hint={t("scenarioForm.fields.nombreBacsSimultanesCible.hint")}
              />
              <Input
                label={t("scenarioForm.fields.frequenceStockageMois.label")}
                type="number"
                inputMode="decimal"
                min={0.1}
                step={0.1}
                required
                value={form.frequenceStockageMois}
                onChange={(e) => update("frequenceStockageMois", e.target.value)}
                error={errors.frequenceStockageMois}
                hint={t("scenarioForm.fields.frequenceStockageMois.hint")}
              />
            </FormSection>

            <FormSection
              title={t("scenarioForm.sections.transport.title")}
              description={t("scenarioForm.sections.transport.description")}
            >
              <Input
                label={t("scenarioForm.fields.capaciteTransportAlimentsSacs.label")}
                type="number"
                inputMode="numeric"
                min={0}
                step={1}
                value={form.capaciteTransportAlimentsSacs}
                onChange={(e) => update("capaciteTransportAlimentsSacs", e.target.value)}
              />
              <Input
                label={t("scenarioForm.fields.coutTransportAlimentsFCFA.label")}
                type="number"
                inputMode="decimal"
                min={0}
                value={form.coutTransportAlimentsFCFA}
                onChange={(e) => update("coutTransportAlimentsFCFA", e.target.value)}
              />
              <Input
                label={t("scenarioForm.fields.capaciteTransportPoissonsKg.label")}
                type="number"
                inputMode="numeric"
                min={0}
                step={1}
                value={form.capaciteTransportPoissonsKg}
                onChange={(e) => update("capaciteTransportPoissonsKg", e.target.value)}
              />
              <Input
                label={t("scenarioForm.fields.coutTransportPoissonsFCFA.label")}
                type="number"
                inputMode="decimal"
                min={0}
                value={form.coutTransportPoissonsFCFA}
                onChange={(e) => update("coutTransportPoissonsFCFA", e.target.value)}
              />
              <Input
                label={t("scenarioForm.fields.capaciteTransportAlevinsNb.label")}
                type="number"
                inputMode="numeric"
                min={0}
                step={1}
                value={form.capaciteTransportAlevinsNb}
                onChange={(e) => update("capaciteTransportAlevinsNb", e.target.value)}
              />
              <Input
                label={t("scenarioForm.fields.coutTransportAlevinsFCFA.label")}
                type="number"
                inputMode="decimal"
                min={0}
                value={form.coutTransportAlevinsFCFA}
                onChange={(e) => update("coutTransportAlevinsFCFA", e.target.value)}
              />
            </FormSection>
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={submitting}>
            {tCommon("buttons.cancel")}
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? t("scenarioForm.submitting") : t("scenarioForm.submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
