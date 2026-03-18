"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronUp, Info, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  TypeActivite,
  TypeDeclencheur,
  PhaseElevage,
} from "@/types";
import type { CreateRegleActiviteDTO } from "@/types/api";
import {
  KNOWN_PLACEHOLDERS,
  TYPE_ACTIVITE_LABELS,
  TYPE_DECLENCHEUR_LABELS,
  PHASE_ELEVAGE_LABELS,
  PHASE_ELEVAGE_ORDER,
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

interface FormState {
  typeActivite: TypeActivite | "";
  typeDeclencheur: TypeDeclencheur | "";
  intervalleJours: string;
  conditionValeur: string;
  conditionValeur2: string;
  nom: string;
  titreTemplate: string;
  descriptionTemplate: string;
  instructionsTemplate: string;
  priorite: string;
  phaseMin: PhaseElevage | "";
  phaseMax: PhaseElevage | "";
}

interface FormErrors {
  typeActivite?: string;
  typeDeclencheur?: string;
  intervalleJours?: string;
  conditionValeur?: string;
  conditionValeur2?: string;
  nom?: string;
  titreTemplate?: string;
  phaseMin?: string;
  phaseMax?: string;
}

const INITIAL_STATE: FormState = {
  typeActivite: "",
  typeDeclencheur: "",
  intervalleJours: "",
  conditionValeur: "",
  conditionValeur2: "",
  nom: "",
  titreTemplate: "",
  descriptionTemplate: "",
  instructionsTemplate: "",
  priorite: "5",
  phaseMin: "",
  phaseMax: "",
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
  const [expanded, setExpanded] = useState(false);

  const visible = expanded
    ? KNOWN_PLACEHOLDERS
    : KNOWN_PLACEHOLDERS.slice(0, DEFAULT_PLACEHOLDER_COUNT);

  return (
    <div className="rounded-lg border border-border bg-muted/30 p-3 flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Info className="h-4 w-4 text-muted-foreground shrink-0" />
        <span className="text-sm font-medium text-foreground">
          Placeholders disponibles
        </span>
        <span className="text-xs text-muted-foreground ml-auto">
          Cliquez pour inserer
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
              Afficher moins
            </>
          ) : (
            <>
              <ChevronDown className="h-3 w-3" />
              Voir tous ({KNOWN_PLACEHOLDERS.length - DEFAULT_PLACEHOLDER_COUNT}{" "}
              de plus)
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
  const { toast } = useToast();

  // Form state
  const [form, setForm] = useState<FormState>(INITIAL_STATE);
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);

  // Section accordeon state (open by default on desktop, closed on mobile handled via CSS)
  const [section1Open, setSection1Open] = useState(true);
  const [section2Open, setSection2Open] = useState(true);
  const [section3Open, setSection3Open] = useState(false);
  const [placeholderOpen, setPlaceholderOpen] = useState(false);

  // Refs for textarea insertion
  const titreRef = useRef<HTMLTextAreaElement | null>(null);
  const descriptionRef = useRef<HTMLTextAreaElement | null>(null);
  const instructionsRef = useRef<HTMLTextAreaElement | null>(null);
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

  // Derived
  const declencheur = form.typeDeclencheur as TypeDeclencheur | "";
  const needsConditionValeur =
    declencheur !== "" && NEEDS_CONDITION_VALEUR.has(declencheur);
  const needsIntervalleJours = declencheur === TypeDeclencheur.RECURRENT;
  const needsConditionValeur2 = declencheur === TypeDeclencheur.SEUIL_QUALITE;

  // Labels for conditionValeur based on typeDeclencheur
  const conditionValeurLabel = (() => {
    switch (declencheur) {
      case TypeDeclencheur.SEUIL_POIDS:
        return "Poids moyen declencheur (g)";
      case TypeDeclencheur.SEUIL_QUALITE:
        return "Valeur minimale (ex: pH min)";
      case TypeDeclencheur.SEUIL_MORTALITE:
        return "Taux de mortalite declencheur (%)";
      case TypeDeclencheur.FCR_ELEVE:
        return "FCR declencheur";
      case TypeDeclencheur.STOCK_BAS:
        return "Quantite de stock minimal";
      case TypeDeclencheur.JALON:
        return "Seuil du jalon (% du cycle)";
      default:
        return "Valeur de seuil";
    }
  })();

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
    if (!form.typeDeclencheur) errs.typeDeclencheur = "Requis";

    if (needsIntervalleJours) {
      const val = Number(form.intervalleJours);
      if (!form.intervalleJours || isNaN(val) || val <= 0) {
        errs.intervalleJours = "Doit etre un entier superieur a 0";
      }
    }

    if (needsConditionValeur) {
      const val = Number(form.conditionValeur);
      if (!form.conditionValeur || isNaN(val)) {
        errs.conditionValeur = "Requis";
      }
    }

    if (needsConditionValeur2) {
      const val1 = Number(form.conditionValeur);
      const val2 = Number(form.conditionValeur2);
      if (!form.conditionValeur2 || isNaN(val2)) {
        errs.conditionValeur2 = "Requis";
      } else if (!isNaN(val1) && val2 <= val1) {
        errs.conditionValeur2 = "La valeur max doit etre superieure a la valeur min";
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
        errs.phaseMin = "La phase minimale doit preceder la phase maximale";
      }
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  }, [form, needsIntervalleJours, needsConditionValeur, needsConditionValeur2]);

  // Submit
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) {
      // Open sections with errors
      if (errors.typeActivite || errors.typeDeclencheur || errors.intervalleJours || errors.conditionValeur || errors.conditionValeur2) {
        setSection1Open(true);
      }
      if (errors.nom || errors.titreTemplate) {
        setSection2Open(true);
      }
      return;
    }

    setSubmitting(true);

    const dto: CreateRegleActiviteDTO = {
      nom: form.nom.trim(),
      typeActivite: form.typeActivite as TypeActivite,
      typeDeclencheur: form.typeDeclencheur as TypeDeclencheur,
      titreTemplate: form.titreTemplate.trim(),
    };

    if (form.descriptionTemplate.trim()) {
      dto.descriptionTemplate = form.descriptionTemplate.trim();
    }
    if (form.instructionsTemplate.trim()) {
      dto.instructionsTemplate = form.instructionsTemplate.trim();
    }
    if (needsIntervalleJours && form.intervalleJours) {
      dto.intervalleJours = Number(form.intervalleJours);
    }
    if (needsConditionValeur && form.conditionValeur) {
      dto.conditionValeur = Number(form.conditionValeur);
    }
    if (needsConditionValeur2 && form.conditionValeur2) {
      dto.conditionValeur2 = Number(form.conditionValeur2);
    }
    if (form.phaseMin) dto.phaseMin = form.phaseMin as PhaseElevage;
    if (form.phaseMax) dto.phaseMax = form.phaseMax as PhaseElevage;

    const prioriteNum = Number(form.priorite);
    if (!isNaN(prioriteNum) && prioriteNum >= 1 && prioriteNum <= 10) {
      dto.priorite = prioriteNum;
    }

    try {
      const res = await fetch("/api/regles-activites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dto),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(
          data.error ?? `Erreur ${res.status}`
        );
      }

      const created = await res.json();
      toast({
        title: "Regle creee",
        description: `"${dto.nom}" a ete enregistree avec succes.`,
        variant: "success",
      });
      router.push(`/settings/regles-activites/${created.regle.id}`);
    } catch (err) {
      toast({
        title: "Erreur",
        description: err instanceof Error ? err.message : "Impossible de creer la regle.",
        variant: "error",
      });
    } finally {
      setSubmitting(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, validate, needsIntervalleJours, needsConditionValeur, needsConditionValeur2, router, toast]);

  // Re-run validation after errors change (to update section open state)
  useEffect(() => {
    // no-op — section toggling is in handleSubmit
  }, [errors]);

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 max-w-2xl">
      {/* Banner info */}
      <div className="flex items-start gap-3 rounded-lg border border-primary/30 bg-primary/5 p-3">
        <Info className="h-4 w-4 text-primary mt-0.5 shrink-0" />
        <p className="text-sm text-muted-foreground">
          Les types de declencheur sont definis par DKFarm. Contactez l&apos;equipe
          technique pour ajouter un nouveau type.
        </p>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Section 1 — Type & Declencheur */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex flex-col gap-2">
        <SectionHeader
          title="Type et declencheur"
          open={section1Open}
          onToggle={() => setSection1Open(!section1Open)}
          badge="requis"
        />
        {section1Open && (
          <div className="flex flex-col gap-4 p-4 rounded-lg border border-border">
            {/* typeActivite */}
            <Select
              value={form.typeActivite}
              onValueChange={(v) => setField("typeActivite", v as TypeActivite)}
            >
              <SelectTrigger
                label="Type d'activite"
                error={errors.typeActivite}
              >
                <SelectValue placeholder="Choisir un type d'activite..." />
              </SelectTrigger>
              <SelectContent>
                {Object.values(TypeActivite).map((val) => (
                  <SelectItem key={val} value={val}>
                    {TYPE_ACTIVITE_LABELS[val]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* typeDeclencheur */}
            <Select
              value={form.typeDeclencheur}
              onValueChange={(v) => {
                setField("typeDeclencheur", v as TypeDeclencheur);
                // Reset conditional fields when trigger type changes
                setField("intervalleJours", "");
                setField("conditionValeur", "");
                setField("conditionValeur2", "");
              }}
            >
              <SelectTrigger
                label="Type de declencheur"
                error={errors.typeDeclencheur}
              >
                <SelectValue placeholder="Choisir un declencheur..." />
              </SelectTrigger>
              <SelectContent>
                {Object.values(TypeDeclencheur).map((val) => (
                  <SelectItem key={val} value={val}>
                    {TYPE_DECLENCHEUR_LABELS[val]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Conditional — RECURRENT */}
            {needsIntervalleJours && (
              <Input
                label="Intervalle en jours"
                type="number"
                min={1}
                step={1}
                value={form.intervalleJours}
                onChange={(e) => setField("intervalleJours", e.target.value)}
                placeholder="Ex: 7"
                error={errors.intervalleJours}
              />
            )}

            {/* Conditional — conditionValeur (tous les SEUIL_* + FCR + STOCK + JALON) */}
            {needsConditionValeur && (
              <Input
                label={conditionValeurLabel}
                type="number"
                step="any"
                value={form.conditionValeur}
                onChange={(e) => setField("conditionValeur", e.target.value)}
                placeholder="Ex: 200"
                error={errors.conditionValeur}
              />
            )}

            {/* Conditional — conditionValeur2 (SEUIL_QUALITE uniquement) */}
            {needsConditionValeur2 && (
              <Input
                label="Valeur maximale (ex: pH max)"
                type="number"
                step="any"
                value={form.conditionValeur2}
                onChange={(e) => setField("conditionValeur2", e.target.value)}
                placeholder="Ex: 9"
                error={errors.conditionValeur2}
              />
            )}
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Section 2 — Identite & Templates */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex flex-col gap-2">
        <SectionHeader
          title="Identite et templates"
          open={section2Open}
          onToggle={() => setSection2Open(!section2Open)}
          badge="requis"
        />
        {section2Open && (
          <div className="flex flex-col gap-4 p-4 rounded-lg border border-border">
            {/* nom */}
            <Input
              label="Nom de la regle"
              value={form.nom}
              onChange={(e) => setField("nom", e.target.value)}
              placeholder="Ex: Alimentation renforcee phase finition"
              error={errors.nom}
              required
              maxLength={100}
            />

            {/* titreTemplate */}
            <div className="flex flex-col gap-1.5">
              <TemplateField
                id="titreTemplate"
                label="Titre de l'activite"
                value={form.titreTemplate}
                onChange={(v) => setField("titreTemplate", v)}
                placeholder="Ex: Distribuer {quantite_calculee}kg de granule en {bac}"
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
              label="Description (optionnel)"
              value={form.descriptionTemplate}
              onChange={(v) => setField("descriptionTemplate", v)}
              placeholder="Ex: Poids moyen {poids_moyen}g — semaine {semaine} du cycle"
              rows={3}
              textareaRef={descriptionRef}
              onFocus={() => setActive(descriptionRef)}
            />

            {/* instructionsTemplate */}
            <TemplateField
              id="instructionsTemplate"
              label="Instructions detaillees (optionnel)"
              value={form.instructionsTemplate}
              onChange={(v) => setField("instructionsTemplate", v)}
              placeholder={"1. Premiere etape\n2. Deuxieme etape\n3. Verifier le resultat"}
              rows={8}
              hint="Format recommande : 1. Premiere etape\n2. Deuxieme etape"
              textareaRef={instructionsRef}
              onFocus={() => setActive(instructionsRef)}
            />

            {/* Placeholder helper panel (mobile: collapsible) */}
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
                Afficher les placeholders disponibles
              </button>
              {placeholderOpen && (
                <PlaceholderPanel onInsert={insertPlaceholder} />
              )}
            </div>
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Section 3 — Parametres */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex flex-col gap-2">
        <SectionHeader
          title="Parametres avances"
          open={section3Open}
          onToggle={() => setSection3Open(!section3Open)}
          badge="optionnel"
        />
        {section3Open && (
          <div className="flex flex-col gap-4 p-4 rounded-lg border border-border">
            {/* priorite */}
            <Input
              label="Priorite (1=urgente, 10=basse)"
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
                label="Phase minimale d'application (optionnel)"
                error={errors.phaseMin}
              >
                <SelectValue placeholder="Toutes les phases" />
              </SelectTrigger>
              <SelectContent>
                {PHASE_ELEVAGE_ORDER.map((val) => (
                  <SelectItem key={val} value={val}>
                    {PHASE_ELEVAGE_LABELS[val]}
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
                label="Phase maximale d'application (optionnel)"
                error={errors.phaseMax}
              >
                <SelectValue placeholder="Toutes les phases" />
              </SelectTrigger>
              <SelectContent>
                {PHASE_ELEVAGE_ORDER.map((val) => (
                  <SelectItem key={val} value={val}>
                    {PHASE_ELEVAGE_LABELS[val]}
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
          disabled={submitting}
        >
          {submitting ? "Enregistrement..." : "Creer la regle"}
        </Button>
      </div>
    </form>
  );
}
