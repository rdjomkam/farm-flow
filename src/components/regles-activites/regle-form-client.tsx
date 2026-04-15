"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ChevronDown, ChevronUp, Info, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useConfigService } from "@/services";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ActionRegle,
  SeveriteAlerte,
  TypeActivite,
  TypeDeclencheur,
  PhaseElevage,
  OperateurCondition,
  LogiqueCondition,
} from "@/types";
import type { CreateRegleActiviteDTO } from "@/types/api";
import {
  ACTION_REGLE_LABELS,
  ACTION_PAYLOAD_TYPE_LABELS,
  KNOWN_PLACEHOLDERS,
  SEVERITE_ALERTE_LABELS,
  TYPE_ACTIVITE_LABELS,
  TYPE_DECLENCHEUR_LABELS,
  PHASE_ELEVAGE_LABELS,
  PHASE_ELEVAGE_ORDER,
  OPERATEUR_CONDITION_LABELS,
  LOGIQUE_CONDITION_LABELS,
} from "@/lib/regles-activites-constants";
// ---------------------------------------------------------------------------
// Helpers — résolution du preview avec valeurs d'exemple
// ---------------------------------------------------------------------------

const EXAMPLE_VALUES: Record<string, string> = {
  quantite_calculee: "1,25",
  taille: "12,5",
  poids_moyen: "185,3",
  stock: "50,00",
  taux: "3,50",
  valeur: "1,42",
  semaine: "8",
  produit: "Granule 3mm Pro",
  seuil: "200,00",
  jours_restants: "45",
  quantite_recommandee: "25,00",
  bac: "Bac 3",
  biomasse: "124,50",
  vague: "V2026-03",
  jours_ecoules: "55",
  valeur_marchande: "1 244 500",
};

function resolvePreview(template: string): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => {
    return EXAMPLE_VALUES[key] ?? "[donnee non disponible]";
  });
}

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

/** Declencheurs qui necessitent conditionValeur */
const NEEDS_CONDITION_VALEUR = new Set<TypeDeclencheur>([
  TypeDeclencheur.SEUIL_POIDS,
  TypeDeclencheur.SEUIL_QUALITE,
  TypeDeclencheur.SEUIL_MORTALITE,
  TypeDeclencheur.FCR_ELEVE,
  TypeDeclencheur.STOCK_BAS,
  TypeDeclencheur.JALON,
]);

/** Placeholders affichés par défaut (6 premiers) */
const DEFAULT_PLACEHOLDER_COUNT = 6;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ConditionRow {
  typeDeclencheur: TypeDeclencheur | "";
  operateur: OperateurCondition | "";
  conditionValeur: string;
  conditionValeur2: string;
}

interface FormState {
  typeActivite: TypeActivite | "";
  intervalleJours: string;
  nom: string;
  titreTemplate: string;
  descriptionTemplate: string;
  instructionsTemplate: string;
  priorite: string;
  phaseMin: PhaseElevage | "";
  phaseMax: PhaseElevage | "";
  // Conditions de declenchement (primaire)
  logique: LogiqueCondition;
  conditions: ConditionRow[];
  // Action (Sprint 29)
  actionType: ActionRegle;
  severite: SeveriteAlerte | "";
  titreNotificationTemplate: string;
  descriptionNotificationTemplate: string;
  actionPayloadType: string;
}

interface FormErrors {
  typeActivite?: string;
  conditions?: string;
  intervalleJours?: string;
  nom?: string;
  titreTemplate?: string;
  phaseMin?: string;
  phaseMax?: string;
  severite?: string;
  titreNotificationTemplate?: string;
}

const INITIAL_STATE: FormState = {
  typeActivite: "",
  intervalleJours: "",
  nom: "",
  titreTemplate: "",
  descriptionTemplate: "",
  instructionsTemplate: "",
  priorite: "5",
  phaseMin: "",
  phaseMax: "",
  logique: LogiqueCondition.ET,
  conditions: [],
  // Action (Sprint 29)
  actionType: ActionRegle.ACTIVITE,
  severite: "",
  titreNotificationTemplate: "",
  descriptionNotificationTemplate: "",
  actionPayloadType: "",
};

// ---------------------------------------------------------------------------
// TemplateField — textarea avec chips de placeholders
// ---------------------------------------------------------------------------

interface TemplateFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  rows?: number;
  required?: boolean;
  error?: string;
  hint?: string;
  /** Ref exposé pour l'insertion de placeholders */
  textareaRef?: React.RefObject<HTMLTextAreaElement | null>;
  onFocus?: () => void;
}

function TemplateField({
  id,
  label,
  value,
  onChange,
  placeholder,
  rows = 3,
  required,
  error,
  hint,
  textareaRef,
  onFocus,
}: TemplateFieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-foreground">
        {label}
        {required && <span className="text-danger ml-1">*</span>}
      </label>
      <textarea
        id={id}
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={onFocus}
        rows={rows}
        placeholder={placeholder}
        className={[
          "w-full rounded-lg border bg-transparent px-3 py-2.5 text-base resize-y",
          "placeholder:text-muted-foreground",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "min-h-[44px]",
          error ? "border-danger" : "border-border",
        ].join(" ")}
      />
      {error && <p className="text-sm text-danger">{error}</p>}
      {hint && <p className="text-sm text-muted-foreground">{hint}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// PlaceholderPanel — chips cliquables
// ---------------------------------------------------------------------------

interface PlaceholderPanelProps {
  /** Insère {key} dans le champ actif */
  onInsert: (key: string) => void;
}

function PlaceholderPanel({ onInsert }: PlaceholderPanelProps) {
  const t = useTranslations("settings.rules.placeholders");
  const [expanded, setExpanded] = useState(false);

  const visible = expanded
    ? KNOWN_PLACEHOLDERS
    : KNOWN_PLACEHOLDERS.slice(0, DEFAULT_PLACEHOLDER_COUNT);

  return (
    <div className="rounded-lg border border-border bg-muted/30 p-3 flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Info className="h-4 w-4 text-muted-foreground shrink-0" />
        <span className="text-sm font-medium text-foreground">
          {t("available")}
        </span>
        <span className="text-xs text-muted-foreground ml-auto">
          {t("clickToInsert")}
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {visible.map((p) => (
          <button
            key={p.key}
            type="button"
            title={p.description}
            onClick={() => onInsert(p.key)}
            className={[
              "inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-mono",
              "border border-border bg-card hover:bg-muted",
              "transition-colors min-h-[32px]",
            ].join(" ")}
          >
            <Plus className="h-3 w-3 opacity-60" />
            {"{" + p.key + "}"}
          </button>
        ))}
      </div>
      {KNOWN_PLACEHOLDERS.length > DEFAULT_PLACEHOLDER_COUNT && (
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="inline-flex items-center gap-1 text-xs text-primary hover:underline self-start min-h-[32px]"
        >
          {expanded ? (
            <>
              <ChevronUp className="h-3 w-3" />
              {t("showLess")}
            </>
          ) : (
            <>
              <ChevronDown className="h-3 w-3" />
              {t("showMore", { count: KNOWN_PLACEHOLDERS.length - DEFAULT_PLACEHOLDER_COUNT })}
            </>
          )}
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// SectionHeader — accordeon de section
// ---------------------------------------------------------------------------

interface SectionHeaderProps {
  title: string;
  open: boolean;
  onToggle: () => void;
  badge?: string;
}

function SectionHeader({ title, open, onToggle, badge }: SectionHeaderProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={[
        "w-full flex items-center justify-between py-3 px-4",
        "rounded-lg border border-border bg-card",
        "text-left font-medium text-foreground",
        "hover:bg-muted transition-colors min-h-[44px]",
      ].join(" ")}
    >
      <span className="flex items-center gap-2">
        {title}
        {badge && (
          <span className="text-xs font-normal text-muted-foreground">
            {badge}
          </span>
        )}
      </span>
      {open ? (
        <ChevronUp className="h-4 w-4 text-muted-foreground" />
      ) : (
        <ChevronDown className="h-4 w-4 text-muted-foreground" />
      )}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Preview du titre
// ---------------------------------------------------------------------------

function TitrePreview({ titreTemplate }: { titreTemplate: string }) {
  const resolved = resolvePreview(titreTemplate);
  if (!titreTemplate.trim()) return null;

  return (
    <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
      <p className="text-xs text-muted-foreground mb-1">
        Apercu avec donnees exemple :
      </p>
      <p className="text-sm font-medium text-foreground">{resolved}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function RegleFormClient() {
  const router = useRouter();
  const configService = useConfigService();
  const t = useTranslations("settings");

  // Form state
  const [form, setForm] = useState<FormState>(INITIAL_STATE);
  const [errors, setErrors] = useState<FormErrors>({});

  // Section accordeon state
  const [sectionTypeOpen, setSectionTypeOpen] = useState(true);
  const [sectionConditionsOpen, setSectionConditionsOpen] = useState(true);
  const [sectionActionOpen, setSectionActionOpen] = useState(true);
  const [sectionIdentiteOpen, setSectionIdentiteOpen] = useState(true);
  const [sectionAvancesOpen, setSectionAvancesOpen] = useState(false);
  const [placeholderOpen, setPlaceholderOpen] = useState(false);

  // Refs for textarea insertion
  const titreRef = useRef<HTMLTextAreaElement | null>(null);
  const descriptionRef = useRef<HTMLTextAreaElement | null>(null);
  const instructionsRef = useRef<HTMLTextAreaElement | null>(null);
  const titreNotifRef = useRef<HTMLTextAreaElement | null>(null);
  const descriptionNotifRef = useRef<HTMLTextAreaElement | null>(null);
  const activeTextareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Track which textarea is active for placeholder insertion
  const setActive = useCallback((ref: React.RefObject<HTMLTextAreaElement | null>) => {
    activeTextareaRef.current = ref.current;
  }, []);

  // Update a single field
  const setField = useCallback(<K extends keyof FormState>(key: K, val: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: val }));
    // Clear field error on change
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  }, []);

  // Derived — check if any condition uses RECURRENT trigger
  const hasRecurrentCondition = form.conditions.some(
    (c) => c.typeDeclencheur === TypeDeclencheur.RECURRENT
  );

  // Insert placeholder at cursor in active textarea
  const insertPlaceholder = useCallback((key: string) => {
    const textarea = activeTextareaRef.current;
    if (!textarea) {
      // Default: insert into titreTemplate
      const pos = titreRef.current?.selectionStart ?? form.titreTemplate.length;
      const val = form.titreTemplate;
      const newVal = val.slice(0, pos) + "{" + key + "}" + val.slice(pos);
      setField("titreTemplate", newVal);
      return;
    }
    const start = textarea.selectionStart ?? textarea.value.length;
    const end = textarea.selectionEnd ?? start;
    const inserted = "{" + key + "}";
    const newVal =
      textarea.value.slice(0, start) + inserted + textarea.value.slice(end);

    // Find which field this textarea maps to
    if (textarea === titreRef.current) {
      setField("titreTemplate", newVal);
    } else if (textarea === descriptionRef.current) {
      setField("descriptionTemplate", newVal);
    } else if (textarea === instructionsRef.current) {
      setField("instructionsTemplate", newVal);
    } else if (textarea === titreNotifRef.current) {
      setField("titreNotificationTemplate", newVal);
    } else if (textarea === descriptionNotifRef.current) {
      setField("descriptionNotificationTemplate", newVal);
    }

    // Restore focus + cursor position
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + inserted.length, start + inserted.length);
    }, 0);
  }, [form.titreTemplate, setField]);

  // Validation
  const validate = useCallback((): boolean => {
    const errs: FormErrors = {};

    if (!form.typeActivite) errs.typeActivite = "Requis";

    // At least one valid condition required
    const validConditions = form.conditions.filter(
      (c) => c.typeDeclencheur !== "" && c.operateur !== ""
    );
    if (validConditions.length === 0) {
      errs.conditions = t("rules.form.validation.conditionsRequises");
    }

    // intervalleJours required when a RECURRENT condition exists
    if (hasRecurrentCondition) {
      const val = Number(form.intervalleJours);
      if (!form.intervalleJours || isNaN(val) || val <= 0) {
        errs.intervalleJours = "Doit etre un entier superieur a 0 (requis pour le declencheur Recurrent)";
      }
    }

    if (!form.nom || form.nom.trim().length < 3) {
      errs.nom = "Minimum 3 caracteres requis";
    } else if (form.nom.trim().length > 100) {
      errs.nom = "Maximum 100 caracteres";
    }

    if (!form.titreTemplate || form.titreTemplate.trim().length < 5) {
      errs.titreTemplate = "Minimum 5 caracteres requis";
    } else if (form.titreTemplate.trim().length > 200) {
      errs.titreTemplate = "Maximum 200 caracteres";
    }

    // Phase validation
    if (form.phaseMin && form.phaseMax) {
      const idxMin = PHASE_ELEVAGE_ORDER.indexOf(form.phaseMin as PhaseElevage);
      const idxMax = PHASE_ELEVAGE_ORDER.indexOf(form.phaseMax as PhaseElevage);
      if (idxMin > idxMax) {
        errs.phaseMin = t("rules.form.validation.phaseOrdreInvalide");
      }
    }

    // Action notification validation
    const needsNotif = form.actionType === ActionRegle.NOTIFICATION || form.actionType === ActionRegle.LES_DEUX;
    if (needsNotif) {
      if (!form.severite) {
        errs.severite = t("rules.form.validation.severiteRequise");
      }
      if (!form.titreNotificationTemplate || form.titreNotificationTemplate.trim().length < 5) {
        errs.titreNotificationTemplate = "Minimum 5 caracteres requis";
      } else if (form.titreNotificationTemplate.trim().length > 200) {
        errs.titreNotificationTemplate = "Maximum 200 caracteres";
      }
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  }, [form, hasRecurrentCondition]);

  // Submit
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) {
      // Open sections with errors
      if (errors.typeActivite) {
        setSectionTypeOpen(true);
      }
      if (errors.conditions || errors.intervalleJours) {
        setSectionConditionsOpen(true);
      }
      if (errors.nom || errors.titreTemplate) {
        setSectionIdentiteOpen(true);
      }
      return;
    }

    // Build valid conditions list
    const validConditions = form.conditions.filter(
      (c) => c.typeDeclencheur !== "" && c.operateur !== ""
    );

    // Derive typeDeclencheur from first valid condition (required by API)
    const derivedTypeDeclencheur =
      validConditions.length > 0
        ? (validConditions[0].typeDeclencheur as TypeDeclencheur)
        : TypeDeclencheur.RECURRENT;

    const dto: CreateRegleActiviteDTO = {
      nom: form.nom.trim(),
      typeActivite: form.typeActivite as TypeActivite,
      typeDeclencheur: derivedTypeDeclencheur,
      titreTemplate: form.titreTemplate.trim(),
    };

    if (form.descriptionTemplate.trim()) {
      dto.descriptionTemplate = form.descriptionTemplate.trim();
    }
    if (form.instructionsTemplate.trim()) {
      dto.instructionsTemplate = form.instructionsTemplate.trim();
    }
    if (hasRecurrentCondition && form.intervalleJours) {
      dto.intervalleJours = Number(form.intervalleJours);
    }
    if (form.phaseMin) dto.phaseMin = form.phaseMin as PhaseElevage;
    if (form.phaseMax) dto.phaseMax = form.phaseMax as PhaseElevage;

    const prioriteNum = Number(form.priorite);
    if (!isNaN(prioriteNum) && prioriteNum >= 1 && prioriteNum <= 10) {
      dto.priorite = prioriteNum;
    }

    // Conditions de declenchement
    dto.logique = form.logique;
    dto.conditions = validConditions.map((c, idx) => ({
      typeDeclencheur: c.typeDeclencheur as TypeDeclencheur,
      operateur: c.operateur as OperateurCondition,
      conditionValeur: c.conditionValeur !== "" ? Number(c.conditionValeur) : null,
      conditionValeur2: c.conditionValeur2 !== "" ? Number(c.conditionValeur2) : null,
      ordre: idx,
    }));

    // Action (Sprint 29)
    dto.actionType = form.actionType;
    const needsNotif = form.actionType === ActionRegle.NOTIFICATION || form.actionType === ActionRegle.LES_DEUX;
    if (needsNotif) {
      if (form.severite) dto.severite = form.severite as SeveriteAlerte;
      if (form.titreNotificationTemplate.trim()) dto.titreNotificationTemplate = form.titreNotificationTemplate.trim();
      if (form.descriptionNotificationTemplate.trim()) dto.descriptionNotificationTemplate = form.descriptionNotificationTemplate.trim();
    }
    dto.actionPayloadType = form.actionPayloadType || null;

    const result = await configService.createRegle(dto);
    if (result.ok && result.data) {
      const created = result.data as { id?: string; regle?: { id: string } };
      const id = created.id ?? (created.regle as { id: string } | undefined)?.id;
      if (id) {
        router.push(`/settings/regles-activites/${id}`);
      } else {
        router.push("/settings/regles-activites");
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, validate, hasRecurrentCondition, router, configService]);

  // Re-run validation after errors change (to update section open state)
  useEffect(() => {
    // no-op — section toggling is in handleSubmit
  }, [errors]);

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 max-w-2xl">
      {/* ------------------------------------------------------------------ */}
      {/* Section 1 — Type d'activite */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex flex-col gap-2">
        <SectionHeader
          title={t("rules.form.typeActiviteSection")}
          open={sectionTypeOpen}
          onToggle={() => setSectionTypeOpen(!sectionTypeOpen)}
          badge="requis"
        />
        {sectionTypeOpen && (
          <div className="flex flex-col gap-4 p-4 rounded-lg border border-border">
            <Select
              value={form.typeActivite}
              onValueChange={(v) => setField("typeActivite", v as TypeActivite)}
            >
              <SelectTrigger
                label="Type d'activite"
                error={errors.typeActivite}
              >
                <SelectValue placeholder={t("rules.form.typeActivitePlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                {Object.values(TypeActivite).map((val) => (
                  <SelectItem key={val} value={val}>
                    {t(TYPE_ACTIVITE_LABELS[val])}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Section 2 — Conditions de declenchement */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex flex-col gap-2">
        <SectionHeader
          title={t("rules.form.conditionsSection")}
          open={sectionConditionsOpen}
          onToggle={() => setSectionConditionsOpen(!sectionConditionsOpen)}
          badge="requis"
        />
        {sectionConditionsOpen && (
          <div className="flex flex-col gap-4 p-4 rounded-lg border border-border">
            {/* Info banner */}
            <div className="flex items-start gap-2 rounded-lg border border-primary/20 bg-primary/5 p-3">
              <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground">
                {t("rules.form.conditionsBannerText")}
              </p>
            </div>

            {/* Error message */}
            {errors.conditions && (
              <p className="text-sm text-danger">{errors.conditions}</p>
            )}

            {/* Logique ET/OU — visible seulement si plus d'une condition */}
            {form.conditions.length > 1 && (
              <Select
                value={form.logique}
                onValueChange={(v) => setField("logique", v as LogiqueCondition)}
              >
                <SelectTrigger label={t("rules.detail.logiqueCombinaisonLabel")}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.values(LogiqueCondition).map((val) => (
                    <SelectItem key={val} value={val}>
                      {t(LOGIQUE_CONDITION_LABELS[val])}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {/* Liste des conditions */}
            {form.conditions.length > 0 && (
              <div className="flex flex-col gap-3">
                {form.conditions.map((cond, idx) => (
                  <div key={idx} className="flex flex-col gap-2 p-3 rounded-lg border border-border bg-muted/20">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-muted-foreground">
                        {t("rules.detail.condition", { idx: idx + 1 })}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setField(
                            "conditions",
                            form.conditions.filter((_, i) => i !== idx)
                          );
                        }}
                        className="inline-flex items-center justify-center h-8 w-8 rounded-md text-danger hover:bg-danger/10 transition-colors"
                        aria-label={t("rules.buttons.deleteCondition")}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>

                    {/* TypeDeclencheur */}
                    <Select
                      value={cond.typeDeclencheur}
                      onValueChange={(v) => {
                        const updated = [...form.conditions];
                        updated[idx] = { ...updated[idx], typeDeclencheur: v as TypeDeclencheur };
                        setField("conditions", updated);
                      }}
                    >
                      <SelectTrigger label={t("rules.detail.typeDeclencheurLabel")}>
                        <SelectValue placeholder={t("rules.form.choosePlaceholder")} />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.values(TypeDeclencheur).map((val) => (
                          <SelectItem key={val} value={val}>
                            {t(TYPE_DECLENCHEUR_LABELS[val])}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {/* Operateur */}
                    <Select
                      value={cond.operateur}
                      onValueChange={(v) => {
                        const updated = [...form.conditions];
                        updated[idx] = {
                          ...updated[idx],
                          operateur: v as OperateurCondition,
                          // Reset conditionValeur2 if no longer ENTRE
                          conditionValeur2: v !== OperateurCondition.ENTRE ? "" : updated[idx].conditionValeur2,
                        };
                        setField("conditions", updated);
                      }}
                    >
                      <SelectTrigger label={t("rules.detail.operateurLabel")}>
                        <SelectValue placeholder={t("rules.form.choosePlaceholder")} />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.values(OperateurCondition).map((val) => (
                          <SelectItem key={val} value={val}>
                            {t(OPERATEUR_CONDITION_LABELS[val])}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {/* Valeur primaire */}
                    {cond.typeDeclencheur !== "" && NEEDS_CONDITION_VALEUR.has(cond.typeDeclencheur as TypeDeclencheur) && (
                      <Input
                        label={(() => {
                          switch (cond.typeDeclencheur as TypeDeclencheur) {
                            case TypeDeclencheur.SEUIL_POIDS: return t("rules.form.conditionLabels.poidsDeclencheur");
                            case TypeDeclencheur.SEUIL_QUALITE: return t("rules.form.conditionLabels.valeurQualiteMin");
                            case TypeDeclencheur.SEUIL_MORTALITE: return t("rules.form.conditionLabels.tauxMortalite");
                            case TypeDeclencheur.FCR_ELEVE: return t("rules.form.conditionLabels.icaDeclencheur");
                            case TypeDeclencheur.STOCK_BAS: return t("rules.form.conditionLabels.stockMinimal");
                            case TypeDeclencheur.JALON: return t("rules.form.conditionLabels.seuilJalon");
                            default: return t("rules.form.conditionLabels.valeur");
                          }
                        })()}
                        type="number"
                        step="any"
                        value={cond.conditionValeur}
                        onChange={(e) => {
                          const updated = [...form.conditions];
                          updated[idx] = { ...updated[idx], conditionValeur: e.target.value };
                          setField("conditions", updated);
                        }}
                        placeholder={t("rules.form.placeholderEx200")}
                      />
                    )}

                    {/* Valeur secondaire — ENTRE uniquement */}
                    {cond.operateur === OperateurCondition.ENTRE && (
                      <Input
                        label={t("rules.detail.valeurMaxLabel")}
                        type="number"
                        step="any"
                        value={cond.conditionValeur2}
                        onChange={(e) => {
                          const updated = [...form.conditions];
                          updated[idx] = { ...updated[idx], conditionValeur2: e.target.value };
                          setField("conditions", updated);
                        }}
                        placeholder={t("rules.form.placeholderEx300")}
                      />
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Bouton ajouter */}
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setField("conditions", [
                  ...form.conditions,
                  {
                    typeDeclencheur: "",
                    operateur: "",
                    conditionValeur: "",
                    conditionValeur2: "",
                  },
                ]);
              }}
              className="w-full min-h-[44px]"
            >
              <Plus className="h-4 w-4 mr-2" />
              {t("rules.form.addCondition")}
            </Button>
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Section 3 — Action au declenchement */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex flex-col gap-2">
        <SectionHeader
          title={t("rules.detail.triggerAction")}
          open={sectionActionOpen}
          onToggle={() => setSectionActionOpen(!sectionActionOpen)}
          badge="requis"
        />
        {sectionActionOpen && (
          <div className="flex flex-col gap-4 p-4 rounded-lg border border-border">
            {/* actionType */}
            <Select
              value={form.actionType}
              onValueChange={(v) => setField("actionType", v as ActionRegle)}
            >
              <SelectTrigger label={t("rules.detail.actionType")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.values(ActionRegle).map((val) => (
                  <SelectItem key={val} value={val}>
                    {t(ACTION_REGLE_LABELS[val])}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Activite section — visible si ACTIVITE ou LES_DEUX */}
            {(form.actionType === ActionRegle.ACTIVITE || form.actionType === ActionRegle.LES_DEUX) && (
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
                <p className="text-xs font-medium text-primary mb-1">{t("rules.form.activitySection")}</p>
                <p className="text-xs text-muted-foreground">
                  {t("rules.form.activitySectionDesc")}
                </p>
              </div>
            )}

            {/* Notification section — visible si NOTIFICATION ou LES_DEUX */}
            {(form.actionType === ActionRegle.NOTIFICATION || form.actionType === ActionRegle.LES_DEUX) && (
              <div className="flex flex-col gap-3">
                <div className="flex items-start gap-2 rounded-lg border border-accent-amber/20 bg-accent-amber/5 p-3">
                  <Info className="h-4 w-4 text-accent-amber shrink-0 mt-0.5" />
                  <p className="text-xs text-muted-foreground">
                    {t("rules.form.notifBannerText")}
                  </p>
                </div>

                {/* Severite */}
                <Select
                  value={form.severite}
                  onValueChange={(v) => {
                    setField("severite", v as SeveriteAlerte);
                    setErrors((prev) => ({ ...prev, severite: undefined }));
                  }}
                >
                  <SelectTrigger
                    label={t("rules.detail.severiteLabel")}
                    error={errors.severite}
                  >
                    <SelectValue placeholder={t("rules.form.severiteChoosePlaceholder")} />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.values(SeveriteAlerte).map((val) => (
                      <SelectItem key={val} value={val}>
                        {t(SEVERITE_ALERTE_LABELS[val])}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Titre notification template */}
                <TemplateField
                  id="titreNotificationTemplate"
                  label={t("rules.detail.titreAlerteLabel")}
                  value={form.titreNotificationTemplate}
                  onChange={(v) => setField("titreNotificationTemplate", v)}
                  placeholder={t("rules.form.placeholderTitreNotif")}
                  rows={2}
                  required
                  error={errors.titreNotificationTemplate}
                  textareaRef={titreNotifRef}
                  onFocus={() => setActive(titreNotifRef)}
                />

                {/* Description notification template */}
                <TemplateField
                  id="descriptionNotificationTemplate"
                  label={t("rules.detail.descriptionAlerteLabel")}
                  value={form.descriptionNotificationTemplate}
                  onChange={(v) => setField("descriptionNotificationTemplate", v)}
                  placeholder={t("rules.form.placeholderDescNotif")}
                  rows={3}
                  textareaRef={descriptionNotifRef}
                  onFocus={() => setActive(descriptionNotifRef)}
                />

                {/* actionPayloadType */}
                <Select
                  value={form.actionPayloadType}
                  onValueChange={(v) => setField("actionPayloadType", v === "__none__" ? "" : v)}
                >
                  <SelectTrigger label={t("rules.detail.actionPayloadLabel")}>
                    <SelectValue placeholder={t("rules.actions.none")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">
                      {t(ACTION_PAYLOAD_TYPE_LABELS[""])}
                    </SelectItem>
                    {(["CREER_RELEVE", "MODIFIER_BAC", "VOIR_VAGUE", "VOIR_STOCK"] as const).map((val) => (
                      <SelectItem key={val} value={val}>
                        {t(ACTION_PAYLOAD_TYPE_LABELS[val])}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Section 4 — Identite & Templates */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex flex-col gap-2">
        <SectionHeader
          title={form.actionType === ActionRegle.NOTIFICATION ? t("rules.form.identiteNotifSection") : t("rules.form.identiteSection")}
          open={sectionIdentiteOpen}
          onToggle={() => setSectionIdentiteOpen(!sectionIdentiteOpen)}
          badge="requis"
        />
        {sectionIdentiteOpen && (
          <div className="flex flex-col gap-4 p-4 rounded-lg border border-border">
            {/* nom */}
            <Input
              label={t("rules.form.nomRegleLabel")}
              value={form.nom}
              onChange={(e) => setField("nom", e.target.value)}
              placeholder={t("rules.form.placeholderNomRegle")}
              error={errors.nom}
              required
              maxLength={100}
            />

            {/* Templates activite — visibles seulement si ACTIVITE ou LES_DEUX */}
            {(form.actionType === ActionRegle.ACTIVITE || form.actionType === ActionRegle.LES_DEUX) && (
              <>
                {/* titreTemplate */}
                <div className="flex flex-col gap-1.5">
                  <TemplateField
                    id="titreTemplate"
                    label={t("rules.detail.titreActiviteLabel")}
                    value={form.titreTemplate}
                    onChange={(v) => setField("titreTemplate", v)}
                    placeholder={t("rules.form.placeholderTitreTemplate")}
                    rows={2}
                    required
                    error={errors.titreTemplate}
                    textareaRef={titreRef}
                    onFocus={() => setActive(titreRef)}
                  />
                  {/* Preview titre */}
                  <TitrePreview titreTemplate={form.titreTemplate} />
                </div>

                {/* descriptionTemplate */}
                <TemplateField
                  id="descriptionTemplate"
                  label={t("rules.detail.descriptionActiviteLabel")}
                  value={form.descriptionTemplate}
                  onChange={(v) => setField("descriptionTemplate", v)}
                  placeholder={t("rules.form.placeholderDescTemplate")}
                  rows={3}
                  textareaRef={descriptionRef}
                  onFocus={() => setActive(descriptionRef)}
                />

                {/* instructionsTemplate */}
                <TemplateField
                  id="instructionsTemplate"
                  label={t("rules.detail.instructionsLabel")}
                  value={form.instructionsTemplate}
                  onChange={(v) => setField("instructionsTemplate", v)}
                  placeholder={t("rules.form.placeholderInstructions")}
                  rows={8}
                  hint={t("rules.form.instructionsHint")}
                  textareaRef={instructionsRef}
                  onFocus={() => setActive(instructionsRef)}
                />
              </>
            )}

            {/* titreTemplate minimal requis pour les notifications (utilise comme fallback) */}
            {form.actionType === ActionRegle.NOTIFICATION && (
              <Input
                label={t("rules.detail.nomInterneLabel")}
                value={form.titreTemplate}
                onChange={(e) => setField("titreTemplate", e.target.value)}
                placeholder={t("rules.form.placeholderNomInterne")}
                error={errors.titreTemplate}
                required
                maxLength={200}
              />
            )}

            {/* Placeholder helper panel (mobile: collapsible) */}
            {(form.actionType === ActionRegle.ACTIVITE || form.actionType === ActionRegle.LES_DEUX) && (
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => setPlaceholderOpen(!placeholderOpen)}
                  className="inline-flex items-center gap-2 text-sm text-primary hover:underline min-h-[44px]"
                >
                  {placeholderOpen ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                  {t("rules.detail.afficherPlaceholders")}
                </button>
                {placeholderOpen && (
                  <PlaceholderPanel onInsert={insertPlaceholder} />
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Section 5 — Parametres avances */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex flex-col gap-2">
        <SectionHeader
          title={t("rules.form.avancesSection")}
          open={sectionAvancesOpen}
          onToggle={() => setSectionAvancesOpen(!sectionAvancesOpen)}
          badge="optionnel"
        />
        {sectionAvancesOpen && (
          <div className="flex flex-col gap-4 p-4 rounded-lg border border-border">
            {/* intervalleJours */}
            <div className="flex flex-col gap-1">
              <Input
                label={t("rules.form.intervalleLabel")}
                type="number"
                min={1}
                step={1}
                value={form.intervalleJours}
                onChange={(e) => setField("intervalleJours", e.target.value)}
                placeholder={t("rules.form.placeholderEx7")}
                error={errors.intervalleJours}
              />
              <p className="text-xs text-muted-foreground">
                {t("rules.detail.recurrentHint")}
              </p>
            </div>

            {/* priorite */}
            <Input
              label={t("rules.form.prioriteLabel")}
              type="number"
              min={1}
              max={10}
              step={1}
              value={form.priorite}
              onChange={(e) => setField("priorite", e.target.value)}
              placeholder="5"
            />

            {/* phaseMin */}
            <Select
              value={form.phaseMin}
              onValueChange={(v) => setField("phaseMin", v as PhaseElevage)}
            >
              <SelectTrigger
                label={t("rules.form.phaseMinLabel")}
                error={errors.phaseMin}
              >
                <SelectValue placeholder={t("rules.form.allPhases")} />
              </SelectTrigger>
              <SelectContent>
                {PHASE_ELEVAGE_ORDER.map((val) => (
                  <SelectItem key={val} value={val}>
                    {t(PHASE_ELEVAGE_LABELS[val])}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* phaseMax */}
            <Select
              value={form.phaseMax}
              onValueChange={(v) => setField("phaseMax", v as PhaseElevage)}
            >
              <SelectTrigger
                label={t("rules.form.phaseMaxLabel")}
                error={errors.phaseMax}
              >
                <SelectValue placeholder={t("rules.form.allPhases")} />
              </SelectTrigger>
              <SelectContent>
                {PHASE_ELEVAGE_ORDER.map((val) => (
                  <SelectItem key={val} value={val}>
                    {t(PHASE_ELEVAGE_LABELS[val])}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Submit bar — sticky on mobile */}
      {/* ------------------------------------------------------------------ */}
      <div className="sticky bottom-0 bg-background pt-3 pb-safe border-t border-border mt-2 -mx-4 px-4 sm:static sm:border-0 sm:px-0 sm:pt-0 sm:pb-0 sm:mt-0">
        <Button
          type="submit"
          variant="primary"
          size="lg"
          className="w-full"
        >
          {t("rules.form.createRule")}
        </Button>
      </div>
    </form>
  );
}
