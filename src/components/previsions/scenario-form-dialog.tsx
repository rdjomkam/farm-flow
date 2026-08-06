"use client";

/**
 * src/components/previsions/scenario-form-dialog.tsx
 *
 * Dialog de creation d'un ScenarioPrevision complet (ScenarioPrevision +
 * ParametresPrevision 1-1 obligatoire, ADR-053 §3.3). R5 : `DialogTrigger
 * asChild`. Etat local par champ (string), converti en number a la
 * soumission — patron `step-groupes.tsx`/`calibrage-form-client.tsx` (pas de
 * react-hook-form/zod cote client dans ce depot).
 *
 * ADR-053 §18 (amendement 2026-08-06) — DEUX ETAPES : apres la saisie des
 * champs ci-dessus (etape "form"), une seconde etape ("produits") liste les
 * `Produit` ALIMENT actifs du site (`GET
 * /api/previsions/produits-alimentaires-eligibles`, calcule
 * `eligible`/`raisonsInvalidite` cote serveur — jamais recalcule ici) : les
 * produits valides sont PRE-COCHES, les invalides restent VISIBLES,
 * verrouilles, avec la ou les raisons ecrites (ERR-173/ERR-185 : les
 * masquer serait un mensonge par omission). Une selection vide est
 * autorisee (le scenario se cree alors sans aucun calibre) — mention
 * explicite a l'ecran, jamais un silence.
 */
import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormSection } from "@/components/ui/form-section";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
} from "@/components/ui/dialog";
import { Plus, AlertTriangle, Loader2, ExternalLink } from "lucide-react";
import { usePrevisionsApi } from "@/hooks/use-previsions-api";
import { useDialogCloseGuard } from "@/hooks/use-dialog-close-guard";
import { formatMontantPrevision } from "@/lib/previsions/format-previsions";
import { RaisonInvaliditeProduitPrevision } from "@/types";
import type { ProduitAlimentaireEligibleDTO } from "@/types";
import type {
  ScenarioPrevisionSummaryDTO,
  ScenarioPrevisionDetailDTO,
} from "@/components/previsions/api-types";

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

type Step = "form" | "produits" | "confirmation";

export function ScenarioFormDialog({ onCreated }: ScenarioFormDialogProps) {
  const t = useTranslations("previsions");
  const tCommon = useTranslations("common");
  const tStock = useTranslations("stock");
  const { post, get } = usePrevisionsApi();
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

  // ADR-053 §18 — etape 2 : selection des produits alimentaires a copier.
  const [step, setStep] = useState<Step>("form");
  const [produits, setProduits] = useState<ProduitAlimentaireEligibleDTO[] | null>(null);
  const [chargementProduits, setChargementProduits] = useState(false);
  const [erreurProduits, setErreurProduits] = useState(false);
  const [selectionIds, setSelectionIds] = useState<Set<string>>(new Set());
  const [nombreCalibresCrees, setNombreCalibresCrees] = useState<number | null>(null);

  function update(field: keyof FormState, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
    setTouched(true);
  }

  function resetForm() {
    setForm(EMPTY_STATE);
    setErrors({});
    setTouched(false);
    setStep("form");
    setProduits(null);
    setChargementProduits(false);
    setErreurProduits(false);
    setSelectionIds(new Set());
    setNombreCalibresCrees(null);
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

  /**
   * Charge la liste des produits alimentaires eligibles (ADR-053 §18.1) et
   * pre-coche tous les produits `eligible: true` — les invalides restent
   * decoches et verrouilles (jamais retires de la liste, ERR-173/ERR-185).
   */
  async function chargerProduits() {
    setChargementProduits(true);
    setErreurProduits(false);
    try {
      const result = await get<{ data: ProduitAlimentaireEligibleDTO[] }>(
        "/api/previsions/produits-alimentaires-eligibles"
      );
      if (result.ok && result.data) {
        setProduits(result.data.data);
        setSelectionIds(
          new Set(result.data.data.filter((p) => p.eligible).map((p) => p.id))
        );
      } else {
        setErreurProduits(true);
      }
    } catch {
      setErreurProduits(true);
    } finally {
      setChargementProduits(false);
    }
  }

  async function handleNext() {
    if (!validate()) return;
    setStep("produits");
    if (produits === null) await chargerProduits();
  }

  function toggleProduit(id: string) {
    setSelectionIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleSubmit() {
    setSubmitting(true);
    try {
      const optionalNumber = (v: string) => (v.trim() ? Number(v) : undefined);
      const result = await post<ScenarioPrevisionDetailDTO>("/api/previsions/scenarios", {
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
        // ADR-053 §18.4 : tableau EXPLICITE (jamais `undefined` depuis cet
        // ecran, qui charge toujours la liste avant de soumettre) — `[]`
        // possible si l'utilisateur decoche tout, autorise (arbitrage c).
        produitIds: Array.from(selectionIds),
      });
      if (result.ok && result.data) {
        onCreated(result.data);
        // ADR-053 §18.2(b) — jamais un silence apres redirection : si aucun
        // calibre n'a ete cree, le dialogue reste ouvert sur une
        // confirmation explicite plutot que de se fermer silencieusement.
        if (result.data.nombreCalibresAlimentsCrees === 0) {
          setNombreCalibresCrees(0);
          setStep("confirmation");
        } else {
          handleOpenChange(false);
        }
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
          {step === "form" && (
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
          )}

          {step === "produits" && (
            <div className="flex flex-col gap-4">
              <div>
                <p className="text-sm font-semibold">{t("scenarioForm.produits.title")}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {t("scenarioForm.produits.description")}
                </p>
              </div>

              {chargementProduits && (
                <div className="flex items-center gap-2 py-8 justify-center text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  {tCommon("loading.text")}
                </div>
              )}

              {!chargementProduits && erreurProduits && (
                <div
                  role="alert"
                  className="flex flex-col items-start gap-2 rounded-lg border border-danger/40 bg-danger/10 p-3 text-xs text-danger"
                >
                  <p>{t("scenarioForm.produits.loadError")}</p>
                  <Button variant="outline" size="sm" onClick={chargerProduits}>
                    {tCommon("buttons.retry")}
                  </Button>
                </div>
              )}

              {!chargementProduits && !erreurProduits && produits !== null && produits.length === 0 && (
                <EmptyState
                  title={t("scenarioForm.produits.emptyState.title")}
                  description={t("scenarioForm.produits.emptyState.description")}
                  action={
                    <Link
                      href="/stock/produits"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-sm font-medium text-primary underline"
                    >
                      {t("scenarioForm.produits.emptyState.stockLink")}
                      <ExternalLink className="h-3 w-3" aria-hidden="true" />
                    </Link>
                  }
                />
              )}

              {!chargementProduits && !erreurProduits && produits !== null && produits.length > 0 && (
                <>
                  <p className="text-xs text-muted-foreground">
                    {t("scenarioForm.produits.eligibleCount", {
                      count: produits.filter((p) => p.eligible).length,
                      total: produits.length,
                    })}
                  </p>

                  <div className="flex flex-col gap-2">
                    {produits.map((produit) => {
                      const checked = selectionIds.has(produit.id);
                      return (
                        <div
                          key={produit.id}
                          className="flex flex-col gap-1 rounded-lg border border-border bg-surface-2 p-3"
                        >
                          <div className="flex items-start gap-2">
                            <input
                              type="checkbox"
                              id={`produit-${produit.id}`}
                              checked={checked}
                              disabled={!produit.eligible}
                              onChange={() => toggleProduit(produit.id)}
                              className="mt-0.5 h-4 w-4 shrink-0 rounded border-border disabled:opacity-40"
                            />
                            <label htmlFor={`produit-${produit.id}`} className="min-w-0 flex-1 text-sm">
                              <span className="font-medium">{produit.nom}</span>
                              <span className="ml-2 text-xs text-muted-foreground">
                                {produit.tailleGranule
                                  ? tStock(`produits.taillesGranule.${produit.tailleGranule}`)
                                  : "—"}
                                {" · "}
                                {produit.contenance !== null ? `${produit.contenance} kg` : "—"}
                                {" · "}
                                {formatMontantPrevision(produit.prixUnitaire)}
                              </span>
                            </label>
                          </div>

                          {!produit.eligible && (
                            <div className="ml-6 flex flex-col gap-1 text-xs text-warning">
                              <div className="flex items-start gap-1">
                                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                                <ul className="list-disc pl-4">
                                  {produit.raisonsInvalidite.map((raison) => (
                                    <li key={raison}>
                                      {t(
                                        `scenarioForm.produits.raisons.${raison}` as `scenarioForm.produits.raisons.${RaisonInvaliditeProduitPrevision}`
                                      )}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                              <Link
                                href={`/stock/produits/${produit.id}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 font-medium text-primary underline"
                              >
                                {t("scenarioForm.produits.corrigerLink")}
                                <ExternalLink className="h-3 w-3" aria-hidden="true" />
                              </Link>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {selectionIds.size === 0 && (
                    <div
                      role="alert"
                      className="flex items-start gap-2 rounded-lg border border-warning/40 bg-accent-amber-muted p-3 text-xs text-warning"
                    >
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                      <p>{t("scenarioForm.produits.selectionVideWarning")}</p>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {step === "confirmation" && nombreCalibresCrees === 0 && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-lg border border-warning/40 bg-accent-amber-muted p-3 text-sm text-warning"
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <p>{t("scenarioForm.calibresCreesZeroBanner")}</p>
            </div>
          )}
        </DialogBody>
        <DialogFooter>
          {step === "form" && (
            <>
              <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={submitting}>
                {tCommon("buttons.cancel")}
              </Button>
              <Button onClick={handleNext} disabled={submitting}>
                {t("scenarioForm.next")}
              </Button>
            </>
          )}
          {step === "produits" && (
            <>
              <Button variant="outline" onClick={() => setStep("form")} disabled={submitting}>
                {t("scenarioForm.back")}
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={submitting || chargementProduits || erreurProduits}
              >
                {submitting ? t("scenarioForm.submitting") : t("scenarioForm.submit")}
              </Button>
            </>
          )}
          {step === "confirmation" && (
            <Button onClick={() => handleOpenChange(false)}>{tCommon("buttons.close")}</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
