"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { useTranslations, useLocale } from "next-intl";
import Link from "next/link";
import {
  ArrowLeft,
  Pencil,
  Trash2,
  RotateCcw,
  X,
  Check,
  Info,
  AlertTriangle,
  Globe,
  Building2,
  Zap,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { useConfigService } from "@/services";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { TemplateEditor } from "@/components/regles-activites/template-editor";
import { TemplatePreview } from "@/components/regles-activites/template-preview";
import { InstructionSteps } from "@/components/activites/instruction-steps";
import {
  ACTION_PAYLOAD_TYPE_LABELS,
  ACTION_REGLE_LABELS,
  SEVERITE_ALERTE_LABELS,
  TYPE_ACTIVITE_LABELS,
  TYPE_DECLENCHEUR_LABELS,
  PHASE_ELEVAGE_LABELS,
  PHASE_ELEVAGE_ORDER,
  SEUIL_TYPES_FIREDONCE,
  OPERATEUR_CONDITION_LABELS,
  LOGIQUE_CONDITION_LABELS,
} from "@/lib/regles-activites-constants";
import { ActionRegle, SeveriteAlerte, TypeDeclencheur, PhaseElevage, OperateurCondition, LogiqueCondition } from "@/types";
import type { RegleActiviteWithRelations, ConditionRegle } from "@/types";
// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Props {
  regle: RegleActiviteWithRelations;
  canManage: boolean;
  canManageGlobal: boolean;
  customPlaceholders?: { key: string; label: string; description: string | null; example: string }[];
}

// Edit form state
interface ConditionRow {
  id?: string;
  typeDeclencheur: TypeDeclencheur | "";
  operateur: OperateurCondition | "";
  conditionValeur: string;
  conditionValeur2: string;
}

interface EditForm {
  nom: string;
  description: string;
  priorite: number;
  intervalleJours: number | null;
  conditionValeur: number | null;
  conditionValeur2: number | null;
  phaseMin: PhaseElevage | null;
  phaseMax: PhaseElevage | null;
  titreTemplate: string;
  descriptionTemplate: string;
  instructionsTemplate: string;
  isActive: boolean;
  logique: LogiqueCondition;
  conditions: ConditionRow[];
  // Action (Sprint 29)
  actionType: ActionRegle;
  severite: SeveriteAlerte | null;
  titreNotificationTemplate: string;
  descriptionNotificationTemplate: string;
  actionPayloadType: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isSeuilType(t: string): boolean {
  return SEUIL_TYPES_FIREDONCE.includes(t as TypeDeclencheur);
}

function InfoRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-3 py-2 border-b border-border last:border-0">
      <span className="text-xs text-muted-foreground sm:w-40 sm:shrink-0 pt-0.5">
        {label}
      </span>
      <span className="text-sm text-foreground">{children}</span>
    </div>
  );
}

function SectionCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-2">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// RegleDetailClient
// ---------------------------------------------------------------------------

export function RegleDetailClient({ regle, canManage, canManageGlobal, customPlaceholders = [] }: Props) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const configService = useConfigService();
  const t = useTranslations("settings");
  const locale = useLocale();
  const tCommon = useTranslations("common");

  const [editMode, setEditMode] = useState(false);

  const isGlobal = regle.siteId === null;
  const activitesCount = regle._count?.activites ?? 0;
  const canDelete = !isGlobal && activitesCount === 0;
  const showFiredOnce = regle.firedOnce && isSeuilType(regle.typeDeclencheur);

  function conditionsToRows(conditions: ConditionRegle[]): ConditionRow[] {
    return conditions.map((c) => ({
      id: c.id,
      typeDeclencheur: c.typeDeclencheur as TypeDeclencheur,
      operateur: c.operateur as OperateurCondition,
      conditionValeur: c.conditionValeur !== null ? String(c.conditionValeur) : "",
      conditionValeur2: c.conditionValeur2 !== null ? String(c.conditionValeur2) : "",
    }));
  }

  const [form, setForm] = useState<EditForm>({
    nom: regle.nom,
    description: regle.description ?? "",
    priorite: regle.priorite,
    intervalleJours: regle.intervalleJours,
    conditionValeur: regle.conditionValeur,
    conditionValeur2: regle.conditionValeur2,
    phaseMin: regle.phaseMin as PhaseElevage | null,
    phaseMax: regle.phaseMax as PhaseElevage | null,
    titreTemplate: regle.titreTemplate,
    descriptionTemplate: regle.descriptionTemplate ?? "",
    instructionsTemplate: regle.instructionsTemplate ?? "",
    isActive: regle.isActive,
    logique: (regle.logique as LogiqueCondition) ?? LogiqueCondition.ET,
    conditions: conditionsToRows(regle.conditions ?? []),
    // Sprint 29
    actionType: (regle.actionType as ActionRegle) ?? ActionRegle.ACTIVITE,
    severite: (regle.severite as SeveriteAlerte) ?? null,
    titreNotificationTemplate: regle.titreNotificationTemplate ?? "",
    descriptionNotificationTemplate: regle.descriptionNotificationTemplate ?? "",
    actionPayloadType: regle.actionPayloadType ?? "",
  });

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  async function handleSave() {
    const validConditions = form.conditions.filter(
      (c) => c.typeDeclencheur !== "" && c.operateur !== ""
    );

    // Derive typeDeclencheur from first valid condition (required by API schema)
    const derivedTypeDeclencheur =
      validConditions.length > 0
        ? (validConditions[0].typeDeclencheur as TypeDeclencheur)
        : regle.typeDeclencheur as TypeDeclencheur;

    const body = {
      nom: form.nom.trim(),
      description: form.description.trim() || null,
      priorite: form.priorite,
      intervalleJours: form.intervalleJours,
      phaseMin: form.phaseMin,
      phaseMax: form.phaseMax,
      typeDeclencheur: derivedTypeDeclencheur,
      titreTemplate: form.titreTemplate.trim(),
      descriptionTemplate: form.descriptionTemplate.trim() || null,
      instructionsTemplate: form.instructionsTemplate.trim() || null,
      isActive: form.isActive,
      logique: form.logique,
      conditions: validConditions.map((c, idx) => ({
        typeDeclencheur: c.typeDeclencheur as TypeDeclencheur,
        operateur: c.operateur as OperateurCondition,
        conditionValeur: c.conditionValeur !== "" ? Number(c.conditionValeur) : null,
        conditionValeur2: c.conditionValeur2 !== "" ? Number(c.conditionValeur2) : null,
        ordre: idx,
      })),
      // Sprint 29 — action fields
      actionType: form.actionType,
      severite: form.severite || null,
      titreNotificationTemplate: form.titreNotificationTemplate.trim() || null,
      descriptionNotificationTemplate: form.descriptionNotificationTemplate.trim() || null,
      actionPayloadType: form.actionPayloadType || null,
    };

    const result = await configService.updateRegle(regle.id, body as Parameters<typeof configService.updateRegle>[1]);
    if (result.ok) {
      setEditMode(false);
      queryClient.invalidateQueries({ queryKey: queryKeys.planning.regles() });
    }
  }

  async function handleDelete() {
    const result = await configService.deleteRegle(regle.id);
    if (result.ok) {
      router.push("/settings/regles-activites");
    }
  }

  async function handleResetFiredOnce() {
    const result = await configService.resetRegle(regle.id);
    if (result.ok) {
      queryClient.invalidateQueries({ queryKey: queryKeys.planning.regles() });
    }
  }

  function handleCancel() {
    // Reset form to original values
    setForm({
      nom: regle.nom,
      description: regle.description ?? "",
      priorite: regle.priorite,
      intervalleJours: regle.intervalleJours,
      conditionValeur: regle.conditionValeur,
      conditionValeur2: regle.conditionValeur2,
      phaseMin: regle.phaseMin as PhaseElevage | null,
      phaseMax: regle.phaseMax as PhaseElevage | null,
      titreTemplate: regle.titreTemplate,
      descriptionTemplate: regle.descriptionTemplate ?? "",
      instructionsTemplate: regle.instructionsTemplate ?? "",
      isActive: regle.isActive,
      logique: (regle.logique as LogiqueCondition) ?? LogiqueCondition.ET,
      conditions: conditionsToRows(regle.conditions ?? []),
      // Sprint 29
      actionType: (regle.actionType as ActionRegle) ?? ActionRegle.ACTIVITE,
      severite: (regle.severite as SeveriteAlerte) ?? null,
      titreNotificationTemplate: regle.titreNotificationTemplate ?? "",
      descriptionNotificationTemplate: regle.descriptionNotificationTemplate ?? "",
      actionPayloadType: regle.actionPayloadType ?? "",
    });
    setEditMode(false);
  }

  // ---------------------------------------------------------------------------
  // Read mode
  // ---------------------------------------------------------------------------

  if (!editMode) {
    return (
      <div className="space-y-4 max-w-3xl">
        <Link
          href="/settings/regles-activites"
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          {t("rules.backToRules")}
        </Link>

        {/* Global rule banner */}
        {isGlobal && (
          <div className="flex items-start gap-3 rounded-lg border border-accent-blue/30 bg-accent-blue/10 p-3">
            <Globe className="h-4 w-4 text-accent-blue shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-accent-blue">
                {t("rules.globalRuleTitle")}
              </p>
              <p className="text-xs text-accent-blue/80 mt-0.5">
                {canManageGlobal
                  ? t("rules.globalRuleDescGlobal")
                  : t("rules.globalRuleDescReadOnly")}
              </p>
            </div>
          </div>
        )}

        {/* firedOnce banner */}
        {showFiredOnce && (
          <div className="flex items-start gap-3 rounded-lg border border-warning/30 bg-warning/10 p-3">
            <Zap className="h-4 w-4 text-warning shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-warning">
                {t("rules.firedOnceBanner")}
              </p>
              <p className="text-xs text-warning/80 mt-0.5">
                {t("rules.firedOnceDescription")}
              </p>
            </div>
          </div>
        )}

        {/* Header section */}
        <SectionCard title={t("rules.sections.identity")}>
          <InfoRow label={t("rules.detail.nom")}>{regle.nom}</InfoRow>
          {regle.description && (
            <InfoRow label={t("rules.detail.description")}>{regle.description}</InfoRow>
          )}
          <InfoRow label={t("rules.detail.typeActiviteLabel")}>
            <Badge variant="en_cours">
              {TYPE_ACTIVITE_LABELS[regle.typeActivite as keyof typeof TYPE_ACTIVITE_LABELS]
                ? t(TYPE_ACTIVITE_LABELS[regle.typeActivite as keyof typeof TYPE_ACTIVITE_LABELS])
                : regle.typeActivite}
            </Badge>
          </InfoRow>
          <InfoRow label={t("rules.detail.actionLabel")}>
            <span className="inline-flex items-center gap-1.5">
              <Badge variant={
                (regle.actionType as ActionRegle) === ActionRegle.NOTIFICATION ? "warning" :
                (regle.actionType as ActionRegle) === ActionRegle.LES_DEUX ? "en_cours" : "default"
              }>
                {ACTION_REGLE_LABELS[(regle.actionType as ActionRegle) ?? ActionRegle.ACTIVITE]
                  ? t(ACTION_REGLE_LABELS[(regle.actionType as ActionRegle) ?? ActionRegle.ACTIVITE])
                  : regle.actionType}
              </Badge>
              {regle.severite && (
                <Badge variant={
                  regle.severite === SeveriteAlerte.CRITIQUE ? "annulee" :
                  regle.severite === SeveriteAlerte.AVERTISSEMENT ? "warning" : "info"
                }>
                  {SEVERITE_ALERTE_LABELS[regle.severite as SeveriteAlerte]
                    ? t(SEVERITE_ALERTE_LABELS[regle.severite as SeveriteAlerte])
                    : regle.severite}
                </Badge>
              )}
            </span>
          </InfoRow>
          <InfoRow label={t("rules.detail.declencheurLabel")}>
            <Badge variant="default">
              {TYPE_DECLENCHEUR_LABELS[regle.typeDeclencheur as keyof typeof TYPE_DECLENCHEUR_LABELS]
                ? t(TYPE_DECLENCHEUR_LABELS[regle.typeDeclencheur as keyof typeof TYPE_DECLENCHEUR_LABELS])
                : regle.typeDeclencheur}
            </Badge>
          </InfoRow>
          <InfoRow label={t("rules.detail.perimetreLabel")}>
            {isGlobal ? (
              <span className="inline-flex items-center gap-1 text-accent-blue">
                <Globe className="h-3.5 w-3.5" />
                {t("rules.detail.scopeGlobal")}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-muted-foreground">
                <Building2 className="h-3.5 w-3.5" />
                {t("rules.detail.scopeSite")}
              </span>
            )}
          </InfoRow>
          <InfoRow label={t("rules.detail.statutLabel")}>
            {regle.isActive ? (
              <span className="inline-flex items-center gap-1 text-success">
                <Check className="h-3.5 w-3.5" />
                {t("rules.detail.active")}
              </span>
            ) : (
              <span className="text-muted-foreground">{t("rules.detail.inactive")}</span>
            )}
          </InfoRow>
          {showFiredOnce && (
            <InfoRow label={t("rules.detail.firedOnceLabel")}>
              <Badge variant="warning">{t("rules.firedOnceBadge")}</Badge>
            </InfoRow>
          )}
          <InfoRow label={t("rules.detail.activitesGenerees")}>
            <span className="font-mono text-sm">{activitesCount}</span>
          </InfoRow>
        </SectionCard>

        {/* Declencheur params */}
        <SectionCard title={t("rules.sections.triggerParams")}>
          <InfoRow label={t("rules.detail.priorite")}>{regle.priorite} / 10</InfoRow>
          {regle.intervalleJours != null && (
            <InfoRow label={t("rules.detail.intervalleJours")}>
              {regle.intervalleJours} jour{regle.intervalleJours > 1 ? "s" : ""}
            </InfoRow>
          )}
          {regle.phaseMin && (
            <InfoRow label={t("rules.detail.phaseMin")}>
              {PHASE_ELEVAGE_LABELS[regle.phaseMin as PhaseElevage]
                ? t(PHASE_ELEVAGE_LABELS[regle.phaseMin as PhaseElevage])
                : regle.phaseMin}
            </InfoRow>
          )}
          {regle.phaseMax && (
            <InfoRow label={t("rules.detail.phaseMax")}>
              {PHASE_ELEVAGE_LABELS[regle.phaseMax as PhaseElevage]
                ? t(PHASE_ELEVAGE_LABELS[regle.phaseMax as PhaseElevage])
                : regle.phaseMax}
            </InfoRow>
          )}
        </SectionCard>

        {/* Conditions de declenchement */}
        <SectionCard title={`${t("rules.sections.triggerConditions")}${regle.conditions && regle.conditions.length > 0 ? ` (${regle.conditions.length})` : ""}`}>
          {regle.conditions && regle.conditions.length > 0 ? (
            <>
              {regle.conditions.length > 1 && (
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs text-muted-foreground">{t("rules.detail.logic")}</span>
                  <Badge variant="default">
                    {t(LOGIQUE_CONDITION_LABELS[(regle.logique as LogiqueCondition) ?? LogiqueCondition.ET])}
                  </Badge>
                </div>
              )}
              <div className="space-y-2">
                {regle.conditions.map((c, idx) => (
                  <div
                    key={c.id ?? idx}
                    className="flex flex-col gap-0.5 rounded-md bg-muted/40 px-3 py-2 text-sm"
                  >
                    <span className="text-xs text-muted-foreground font-medium">
                      {t("rules.detail.condition", { idx: idx + 1 })}
                    </span>
                    <span className="text-foreground">
                      <span className="font-medium">
                        {TYPE_DECLENCHEUR_LABELS[c.typeDeclencheur as TypeDeclencheur]
                          ? t(TYPE_DECLENCHEUR_LABELS[c.typeDeclencheur as TypeDeclencheur])
                          : c.typeDeclencheur}
                      </span>
                      {" "}
                      <span className="text-muted-foreground">
                        {OPERATEUR_CONDITION_LABELS[c.operateur as OperateurCondition]
                          ? t(OPERATEUR_CONDITION_LABELS[c.operateur as OperateurCondition])
                          : c.operateur}
                      </span>
                      {" "}
                      {c.conditionValeur !== null && (
                        <span className="font-mono">{c.conditionValeur}</span>
                      )}
                      {c.operateur === OperateurCondition.ENTRE && c.conditionValeur2 !== null && (
                        <span className="text-muted-foreground"> et <span className="font-mono text-foreground">{c.conditionValeur2}</span></span>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">{t("rules.noConditionSimple")} {TYPE_DECLENCHEUR_LABELS[regle.typeDeclencheur as keyof typeof TYPE_DECLENCHEUR_LABELS] ? t(TYPE_DECLENCHEUR_LABELS[regle.typeDeclencheur as keyof typeof TYPE_DECLENCHEUR_LABELS]) : regle.typeDeclencheur}</p>
          )}
        </SectionCard>

        {/* Templates activite — visibles si ACTIVITE ou LES_DEUX */}
        {((regle.actionType as ActionRegle) === ActionRegle.ACTIVITE || (regle.actionType as ActionRegle) === ActionRegle.LES_DEUX || !regle.actionType) && (
          <SectionCard title={t("rules.sections.activityTemplates")}>
            <div className="space-y-4">
              <div>
                <p className="text-xs text-muted-foreground mb-1">{t("rules.detail.templateTitle")}</p>
                <p className="text-sm font-mono bg-muted/50 rounded-md px-3 py-2 break-all">
                  {regle.titreTemplate}
                </p>
              </div>
              {regle.descriptionTemplate && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">{t("rules.detail.templateDescription")}</p>
                  <p className="text-sm font-mono bg-muted/50 rounded-md px-3 py-2 break-all whitespace-pre-wrap">
                    {regle.descriptionTemplate}
                  </p>
                </div>
              )}
              {regle.instructionsTemplate && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">{t("rules.detail.templateInstructions")}</p>
                  <div className="bg-muted/50 rounded-md px-3 py-3">
                    <InstructionSteps text={regle.instructionsTemplate} />
                  </div>
                </div>
              )}
            </div>
          </SectionCard>
        )}

        {/* Templates notification — visibles si NOTIFICATION ou LES_DEUX */}
        {((regle.actionType as ActionRegle) === ActionRegle.NOTIFICATION || (regle.actionType as ActionRegle) === ActionRegle.LES_DEUX) && (
          <SectionCard title={t("rules.notificationTemplates")}>
            <div className="space-y-3">
              {regle.titreNotificationTemplate && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">{t("rules.titreAlerte")}</p>
                  <p className="text-sm font-mono bg-muted/50 rounded-md px-3 py-2 break-all">
                    {regle.titreNotificationTemplate}
                  </p>
                </div>
              )}
              {regle.descriptionNotificationTemplate && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">{t("rules.descriptionAlerte")}</p>
                  <p className="text-sm font-mono bg-muted/50 rounded-md px-3 py-2 break-all whitespace-pre-wrap">
                    {regle.descriptionNotificationTemplate}
                  </p>
                </div>
              )}
              {regle.actionPayloadType && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">{t("rules.detail.actionButton")}</p>
                  <p className="text-sm">{ACTION_PAYLOAD_TYPE_LABELS[regle.actionPayloadType] ? t(ACTION_PAYLOAD_TYPE_LABELS[regle.actionPayloadType]) : regle.actionPayloadType}</p>
                </div>
              )}
            </div>
          </SectionCard>
        )}

        {/* Preview */}
        <TemplatePreview
          titreTemplate={regle.titreTemplate}
          descriptionTemplate={regle.descriptionTemplate ?? ""}
          instructionsTemplate={regle.instructionsTemplate ?? ""}
          customPlaceholders={customPlaceholders}
        />

        {/* Recent activities */}
        {regle.activites && regle.activites.length > 0 && (
          <SectionCard title={t("rules.detail.activitesRecentes", { count: activitesCount })}>
            <div className="space-y-2">
              {regle.activites.map((a) => (
                <div
                  key={a.id}
                  className="flex items-center justify-between gap-2 py-1.5 border-b border-border last:border-0"
                >
                  <span className="text-sm text-foreground line-clamp-1">
                    {a.titre}
                  </span>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {new Date(a.dateDebut).toLocaleDateString(locale)}
                  </span>
                </div>
              ))}
            </div>
          </SectionCard>
        )}

        {/* Actions — only visible to users with manage permission */}
        {canManage && (
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            {/* Modifier — allowed for global rules only with GERER_REGLES_GLOBALES */}
            {(!isGlobal || canManageGlobal) && (
              <Button
                variant="primary"
                onClick={() => setEditMode(true)}
                className="flex-1 sm:flex-none"
              >
                <Pencil className="h-4 w-4" />
                {t("rules.modifier")}
              </Button>
            )}

            {/* Reset firedOnce */}
            {showFiredOnce && (
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="outline" className="flex-1 sm:flex-none">
                    <RotateCcw className="h-4 w-4" />
                    {t("rules.reinitialiserFiredOnce")}
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{t("rules.dialogs.resetFiredOnce")}</DialogTitle>
                    <DialogDescription>
                      {t("rules.resetFiredOnceDescription")}
                    </DialogDescription>
                  </DialogHeader>
                  <DialogFooter>
                    <DialogClose asChild>
                      <Button variant="outline">{tCommon("buttons.cancel")}</Button>
                    </DialogClose>
                    <Button
                      variant="primary"
                      onClick={handleResetFiredOnce}
                    >
                      {t("rules.confirmer")}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}

            {/* Supprimer */}
            {canDelete && (
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="danger" className="flex-1 sm:flex-none">
                    <Trash2 className="h-4 w-4" />
                    {t("rules.supprimer")}
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{t("rules.dialogs.deleteRule")}</DialogTitle>
                    <DialogDescription>
                      {t("rules.detail.deleteConfirmation", { nom: regle.nom })}
                    </DialogDescription>
                  </DialogHeader>
                  <div className="flex items-start gap-2 rounded-lg bg-danger/10 border border-danger/20 p-3">
                    <AlertTriangle className="h-4 w-4 text-danger shrink-0 mt-0.5" />
                    <p className="text-sm text-danger">
                      {t("rules.detail.deleteNoActivities")}
                    </p>
                  </div>
                  <DialogFooter>
                    <DialogClose asChild>
                      <Button variant="outline">{tCommon("buttons.cancel")}</Button>
                    </DialogClose>
                    <Button
                      variant="danger"
                      onClick={handleDelete}
                    >
                      {t("rules.supprimer")}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}

            {/* Info: cannot delete if linked */}
            {!isGlobal && activitesCount > 0 && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Info className="h-3.5 w-3.5 shrink-0" />
                {t("rules.detail.deleteBlocked", { count: activitesCount })}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Edit mode
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-4 max-w-3xl">
      <Link
        href="/settings/regles-activites"
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        {t("rules.backToRules")}
      </Link>

    <form
      onSubmit={(e) => {
        e.preventDefault();
        handleSave();
      }}
      className="space-y-4"
    >
      {/* Global rule info banner */}
      {isGlobal && (
        <div className="flex items-start gap-3 rounded-lg border border-accent-blue/30 bg-accent-blue/10 p-3">
          <Globe className="h-4 w-4 text-accent-blue shrink-0 mt-0.5" />
          <p className="text-sm text-accent-blue">
            {t("rules.globalRuleTitle")}. {t("rules.globalRuleDescGlobal")}
          </p>
        </div>
      )}

      {/* Section Identite */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-4">
        <h3 className="text-sm font-semibold text-foreground">{t("rules.sections.identity")}</h3>

        <div>
          <label className="block text-sm font-medium text-foreground mb-1">
            {t("rules.detail.nom")} <span className="text-danger">*</span>
          </label>
          <Input
            value={form.nom}
            onChange={(e) => setForm((f) => ({ ...f, nom: e.target.value }))}
            required
            minLength={3}
            maxLength={100}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-1">
            {t("rules.detail.description")}
          </label>
          <Textarea
            value={form.description}
            onChange={(e) =>
              setForm((f) => ({ ...f, description: e.target.value }))
            }
            rows={2}
            maxLength={500}
            className="min-h-[44px]"
            placeholder={t("rules.detail.descriptionMetierPlaceholder")}
          />
          <p className="text-xs text-muted-foreground text-right mt-0.5">
            {form.description.length}/500
          </p>
        </div>

        {/* isActive toggle */}
        <label className="flex items-center gap-3 cursor-pointer">
          <div className="relative">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) =>
                setForm((f) => ({ ...f, isActive: e.target.checked }))
              }
              className="sr-only peer"
            />
            <div className="w-10 h-6 bg-muted rounded-full peer peer-checked:bg-primary transition-colors" />
            <div className="absolute left-1 top-1 h-4 w-4 rounded-full bg-white transition-transform peer-checked:translate-x-4" />
          </div>
          <span className="text-sm font-medium text-foreground">
            {form.isActive ? t("rules.detail.active") : t("rules.detail.inactive")}
          </span>
        </label>
      </div>

      {/* Section Declencheur */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-4">
        <h3 className="text-sm font-semibold text-foreground">
          {t("rules.sections.triggerParams")}
        </h3>

        {/* Priorite */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">
            {t("rules.detail.priorite")}
          </label>
          <Input
            type="number"
            value={form.priorite}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                priorite: Math.min(10, Math.max(1, parseInt(e.target.value) || 5)),
              }))
            }
            min={1}
            max={10}
            step={1}
          />
        </div>

        {/* intervalleJours — toujours visible avec note RECURRENT */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">
            {t("rules.detail.intervalleJours")}
          </label>
          <Input
            type="number"
            value={form.intervalleJours ?? ""}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                intervalleJours: parseInt(e.target.value) || null,
              }))
            }
            min={1}
            step={1}
          />
          <p className="text-xs text-muted-foreground mt-1">
            {t("rules.detail.intervalleJoursHint")}
          </p>
        </div>

        {/* phaseMin / phaseMax */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              {t("rules.detail.phaseMin")}
            </label>
            <Select
              value={form.phaseMin ?? "__none__"}
              onValueChange={(v) =>
                setForm((f) => ({
                  ...f,
                  phaseMin: v === "__none__" ? null : (v as PhaseElevage),
                }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder={t("rules.phases.allPhases")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">{t("rules.phases.allPhases")}</SelectItem>
                {PHASE_ELEVAGE_ORDER.map((phase) => (
                  <SelectItem key={phase} value={phase}>
                    {t(PHASE_ELEVAGE_LABELS[phase])}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              {t("rules.detail.phaseMax")}
            </label>
            <Select
              value={form.phaseMax ?? "__none__"}
              onValueChange={(v) =>
                setForm((f) => ({
                  ...f,
                  phaseMax: v === "__none__" ? null : (v as PhaseElevage),
                }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder={t("rules.phases.allPhases")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">{t("rules.phases.allPhases")}</SelectItem>
                {PHASE_ELEVAGE_ORDER.map((phase) => (
                  <SelectItem key={phase} value={phase}>
                    {t(PHASE_ELEVAGE_LABELS[phase])}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Section Conditions de declenchement */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-4">
        <h3 className="text-sm font-semibold text-foreground">{t("rules.sections.triggerConditions")}</h3>

        <div className="flex items-start gap-2 rounded-lg border border-primary/20 bg-primary/5 p-3">
          <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground">
            {t("rules.form.conditionsBannerText")}
          </p>
        </div>

        {/* Logique */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">
            {t("rules.detail.logiqueCombinaisonLabel")}
          </label>
          <Select
            value={form.logique}
            onValueChange={(v) => setForm((f) => ({ ...f, logique: v as LogiqueCondition }))}
          >
            <SelectTrigger>
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
        </div>

        {/* Conditions list */}
        {form.conditions.length > 0 && (
          <div className="flex flex-col gap-3">
            {form.conditions.map((cond, idx) => (
              <div key={idx} className="flex flex-col gap-2 p-3 rounded-lg border border-border bg-muted/20">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">{t("rules.detail.condition", { idx: idx + 1 })}</span>
                  <button
                    type="button"
                    onClick={() =>
                      setForm((f) => ({
                        ...f,
                        conditions: f.conditions.filter((_, i) => i !== idx),
                      }))
                    }
                    className="inline-flex items-center justify-center h-8 w-8 rounded-md text-danger hover:bg-danger/10 transition-colors"
                    aria-label={t("rules.buttons.deleteCondition")}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                {/* TypeDeclencheur */}
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">
                    {t("rules.detail.typeDeclencheurLabel")}
                  </label>
                  <Select
                    value={cond.typeDeclencheur}
                    onValueChange={(v) =>
                      setForm((f) => {
                        const updated = [...f.conditions];
                        updated[idx] = { ...updated[idx], typeDeclencheur: v as TypeDeclencheur };
                        return { ...f, conditions: updated };
                      })
                    }
                  >
                    <SelectTrigger>
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
                </div>

                {/* Operateur */}
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">
                    {t("rules.detail.operateurLabel")}
                  </label>
                  <Select
                    value={cond.operateur}
                    onValueChange={(v) =>
                      setForm((f) => {
                        const updated = [...f.conditions];
                        updated[idx] = {
                          ...updated[idx],
                          operateur: v as OperateurCondition,
                          conditionValeur2: v !== OperateurCondition.ENTRE ? "" : updated[idx].conditionValeur2,
                        };
                        return { ...f, conditions: updated };
                      })
                    }
                  >
                    <SelectTrigger>
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
                </div>

                {/* Valeur */}
                <Input
                  label={t("rules.detail.valeurLabel")}
                  type="number"
                  step="any"
                  value={cond.conditionValeur}
                  onChange={(e) =>
                    setForm((f) => {
                      const updated = [...f.conditions];
                      updated[idx] = { ...updated[idx], conditionValeur: e.target.value };
                      return { ...f, conditions: updated };
                    })
                  }
                  placeholder={t("rules.form.placeholderEx200")}
                />

                {/* Valeur2 — ENTRE uniquement */}
                {cond.operateur === OperateurCondition.ENTRE && (
                  <Input
                    label={t("rules.detail.valeurMaxLabel")}
                    type="number"
                    step="any"
                    value={cond.conditionValeur2}
                    onChange={(e) =>
                      setForm((f) => {
                        const updated = [...f.conditions];
                        updated[idx] = { ...updated[idx], conditionValeur2: e.target.value };
                        return { ...f, conditions: updated };
                      })
                    }
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
          onClick={() =>
            setForm((f) => ({
              ...f,
              conditions: [
                ...f.conditions,
                { typeDeclencheur: "", operateur: "", conditionValeur: "", conditionValeur2: "" },
              ],
            }))
          }
          className="w-full min-h-[44px]"
        >
          <Plus className="h-4 w-4 mr-2" />
          {t("rules.form.addCondition")}
        </Button>
      </div>

      {/* Section Action */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-4">
        <h3 className="text-sm font-semibold text-foreground">{t("rules.detail.triggerAction")}</h3>

        <div>
          <label className="block text-sm font-medium text-foreground mb-1">{t("rules.detail.actionType")}</label>
          <Select
            value={form.actionType}
            onValueChange={(v) => setForm((f) => ({ ...f, actionType: v as ActionRegle }))}
          >
            <SelectTrigger>
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
        </div>

        {/* Notification fields */}
        {(form.actionType === ActionRegle.NOTIFICATION || form.actionType === ActionRegle.LES_DEUX) && (
          <div className="space-y-4">
            <div className="rounded-lg border border-accent-amber/20 bg-accent-amber/5 p-3">
              <p className="text-xs text-muted-foreground">
                {t("rules.form.notifConfigBannerText")}
              </p>
            </div>

            {/* Severite */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                {t("rules.detail.severiteLabel")} <span className="text-danger">*</span>
              </label>
              <Select
                value={form.severite ?? "__none__"}
                onValueChange={(v) => setForm((f) => ({ ...f, severite: v === "__none__" ? null : v as SeveriteAlerte }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("rules.form.choosePlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {Object.values(SeveriteAlerte).map((val) => (
                    <SelectItem key={val} value={val}>
                      {t(SEVERITE_ALERTE_LABELS[val])}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* titreNotificationTemplate */}
            <TemplateEditor
              label={t("rules.detail.titreAlerteLabel")}
              name="titreNotificationTemplate"
              value={form.titreNotificationTemplate}
              onChange={(v) => setForm((f) => ({ ...f, titreNotificationTemplate: v }))}
              required
              maxLength={200}
              rows={2}
              placeholder={t("rules.form.placeholderTitreNotif")}
              customPlaceholders={customPlaceholders}
            />

            {/* descriptionNotificationTemplate */}
            <TemplateEditor
              label={t("rules.detail.descriptionAlerteLabel")}
              name="descriptionNotificationTemplate"
              value={form.descriptionNotificationTemplate}
              onChange={(v) => setForm((f) => ({ ...f, descriptionNotificationTemplate: v }))}
              maxLength={500}
              rows={3}
              placeholder={t("rules.form.placeholderDescNotif")}
              customPlaceholders={customPlaceholders}
            />

            {/* actionPayloadType */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                {t("rules.detail.actionPayloadLabel")}
              </label>
              <Select
                value={form.actionPayloadType || "__none__"}
                onValueChange={(v) => setForm((f) => ({ ...f, actionPayloadType: v === "__none__" ? "" : v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">{t(ACTION_PAYLOAD_TYPE_LABELS[""])}</SelectItem>
                  {(["CREER_RELEVE", "MODIFIER_BAC", "VOIR_VAGUE", "VOIR_STOCK"] as const).map((val) => (
                    <SelectItem key={val} value={val}>
                      {t(ACTION_PAYLOAD_TYPE_LABELS[val])}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
      </div>

      {/* Section Templates activite */}
      {(form.actionType === ActionRegle.ACTIVITE || form.actionType === ActionRegle.LES_DEUX) && (
      <div className="rounded-xl border border-border bg-card p-4 space-y-5">
        <h3 className="text-sm font-semibold text-foreground">{t("rules.sections.activityTemplates")}</h3>

        <TemplateEditor
          label={t("rules.detail.titreActiviteLabel")}
          name="titreTemplate"
          value={form.titreTemplate}
          onChange={(v) => setForm((f) => ({ ...f, titreTemplate: v }))}
          required
          maxLength={200}
          rows={2}
          placeholder={t("rules.form.placeholderTitreActivite")}
          customPlaceholders={customPlaceholders}
        />

        <TemplateEditor
          label={t("rules.detail.description")}
          name="descriptionTemplate"
          value={form.descriptionTemplate}
          onChange={(v) => setForm((f) => ({ ...f, descriptionTemplate: v }))}
          maxLength={500}
          rows={3}
          placeholder={t("rules.form.placeholderDescActivite")}
          customPlaceholders={customPlaceholders}
        />

        <TemplateEditor
          label={t("rules.detail.instructionsLabel")}
          name="instructionsTemplate"
          value={form.instructionsTemplate}
          onChange={(v) => setForm((f) => ({ ...f, instructionsTemplate: v }))}
          maxLength={5000}
          rows={6}
          placeholder={t("rules.form.placeholderInstructions")}
          customPlaceholders={customPlaceholders}
        />
      </div>
      )}

      {/* Section Templates NOTIFICATION only — titre template = internal name */}
      {form.actionType === ActionRegle.NOTIFICATION && (
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <h3 className="text-sm font-semibold text-foreground">{t("rules.sections.internalIdentity")}</h3>
        <Input
          label={t("rules.detail.titreInterneLabel")}
          value={form.titreTemplate}
          onChange={(e) => setForm((f) => ({ ...f, titreTemplate: e.target.value }))}
          placeholder={t("rules.form.placeholderNomInterne")}
          required
          maxLength={200}
        />
      </div>
      )}

      {/* Template preview — updates in real time */}
      <TemplatePreview
        titreTemplate={form.titreTemplate}
        descriptionTemplate={form.descriptionTemplate}
        instructionsTemplate={form.instructionsTemplate}
        customPlaceholders={customPlaceholders}
      />

      {/* Sticky actions on mobile */}
      <div className="sticky bottom-0 bg-background pb-4 pt-2 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end border-t border-border mt-4">
        <Button
          type="button"
          variant="outline"
          onClick={handleCancel}
          className="flex-1 sm:flex-none"
        >
          <X className="h-4 w-4" />
          {tCommon("buttons.cancel")}
        </Button>

        {/* Delete from edit mode (same conditions) */}
        {canDelete && (
          <Dialog>
            <DialogTrigger asChild>
              <Button
                type="button"
                variant="danger"
                className="flex-1 sm:flex-none"
              >
                <Trash2 className="h-4 w-4" />
                {t("rules.supprimer")}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t("rules.dialogs.deleteRule")}</DialogTitle>
                <DialogDescription>
                  {t("rules.detail.deleteConfirmation", { nom: regle.nom })}
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline">{tCommon("buttons.cancel")}</Button>
                </DialogClose>
                <Button
                  variant="danger"
                  onClick={handleDelete}
                >
                  {t("rules.supprimer")}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}

        <Button
          type="submit"
          variant="primary"
          className="flex-1 sm:flex-none"
        >
          <Check className="h-4 w-4" /> {tCommon("buttons.save")}
        </Button>
      </div>
    </form>
    </div>
  );
}
