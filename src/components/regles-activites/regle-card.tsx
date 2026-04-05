"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { Lock, Globe, Building2, Activity, Bell, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ActionRegle, TypeDeclencheur, TypeActivite, LogiqueCondition } from "@/types";
import type { RegleActiviteWithCount } from "@/types";
import {
  ACTION_REGLE_LABELS,
  TYPE_ACTIVITE_LABELS,
  TYPE_DECLENCHEUR_LABELS,
  SEUIL_TYPES_FIREDONCE,
} from "@/lib/regles-activites-constants";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Determine the TypeActivite badge variant for coloring. */
function getActiviteBadgeVariant(
  type: TypeActivite
): "en_cours" | "terminee" | "annulee" | "info" | "warning" | "default" {
  switch (type) {
    case TypeActivite.ALIMENTATION:
      return "info";
    case TypeActivite.BIOMETRIE:
      return "en_cours";
    case TypeActivite.QUALITE_EAU:
      return "terminee";
    case TypeActivite.TRAITEMENT:
    case TypeActivite.MEDICATION:
      return "annulee";
    case TypeActivite.RECOLTE:
      return "warning";
    default:
      return "default";
  }
}

const SEUIL_TYPES = new Set(SEUIL_TYPES_FIREDONCE);

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface RegleCardProps {
  regle: RegleActiviteWithCount;
  onToggle: (id: string) => Promise<void>;
  isToggling: boolean;
  canManage: boolean;
  canManageGlobal: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function RegleCard({ regle, onToggle, isToggling, canManage, canManageGlobal }: RegleCardProps) {
  const t = useTranslations("settings");
  const isGlobal = regle.siteId === null;
  const activiteBadgeVariant = getActiviteBadgeVariant(
    regle.typeActivite as TypeActivite
  );
  const hasCompoundConditions = regle.conditions && regle.conditions.length > 0;
  const showCondition =
    !hasCompoundConditions &&
    SEUIL_TYPES.has(regle.typeDeclencheur as TypeDeclencheur) &&
    regle.conditionValeur !== null;
  const showIntervalle =
    regle.typeDeclencheur === TypeDeclencheur.RECURRENT &&
    regle.intervalleJours !== null;

  return (
    <Link href={`/settings/regles-activites/${regle.id}`} className="block">
    <div
      className={[
        "border rounded-lg p-4 bg-card transition-all cursor-pointer hover:ring-1 hover:ring-primary/30",
        regle.isActive
          ? "border-border hover:bg-muted/30"
          : "border-border/50 bg-card/60 opacity-75",
      ].join(" ")}
    >
      {/* ---- Header row ---- */}
      <div className="flex items-start justify-between gap-3 mb-3">
        {/* Name + badges */}
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-sm leading-snug mb-1.5 truncate">
            {regle.nom}
          </h3>
          <div className="flex flex-wrap items-center gap-1.5">
            {/* TypeActivite */}
            <Badge variant={activiteBadgeVariant} className="text-xs">
              {TYPE_ACTIVITE_LABELS[regle.typeActivite as TypeActivite]
                ? t(TYPE_ACTIVITE_LABELS[regle.typeActivite as TypeActivite])
                : regle.typeActivite}
            </Badge>

            {/* TypeDeclencheur */}
            <Badge variant="default" className="text-xs">
              {TYPE_DECLENCHEUR_LABELS[regle.typeDeclencheur as TypeDeclencheur]
                ? t(TYPE_DECLENCHEUR_LABELS[regle.typeDeclencheur as TypeDeclencheur])
                : regle.typeDeclencheur}
            </Badge>

            {/* ActionRegle badge */}
            {regle.actionType && regle.actionType !== ActionRegle.ACTIVITE && (
              <span className={[
                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
                regle.actionType === ActionRegle.NOTIFICATION
                  ? "bg-accent-amber-muted text-accent-amber"
                  : "bg-primary/10 text-primary",
              ].join(" ")}>
                {regle.actionType === ActionRegle.NOTIFICATION ? (
                  <Bell className="h-3 w-3" />
                ) : (
                  <Zap className="h-3 w-3" />
                )}
                {ACTION_REGLE_LABELS[regle.actionType as ActionRegle]
                  ? t(ACTION_REGLE_LABELS[regle.actionType as ActionRegle])
                  : regle.actionType}
              </span>
            )}

            {/* Scope */}
            {isGlobal ? (
              <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-primary/10 text-primary">
                <Globe className="h-3 w-3" />
                Globale DKFarm
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-muted text-muted-foreground">
                <Building2 className="h-3 w-3" />
                Ce site
              </span>
            )}

            {/* firedOnce indicator */}
            {regle.firedOnce && (
              <span
                title="Cette regle s'est deja declenchee une fois (one-shot). Elle ne se declenchera pas a nouveau tant que firedOnce n'est pas reinitialise."
                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-accent-amber-muted text-accent-amber cursor-help"
              >
                <Lock className="h-3 w-3" />
                Declenchee
              </span>
            )}
          </div>
        </div>

        {/* Toggle switch — only for users with manage permission (global rules need GERER_REGLES_GLOBALES) */}
        {canManage && (!isGlobal || canManageGlobal) ? (
          <button
            type="button"
            role="switch"
            aria-checked={regle.isActive}
            aria-label={regle.isActive ? "Desactiver la regle" : "Activer la regle"}
            disabled={isToggling}
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggle(regle.id); }}
            className={[
              "relative inline-flex shrink-0 h-6 w-11 items-center rounded-full transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              "min-h-[44px] min-w-[44px] justify-center",
              regle.isActive ? "bg-primary" : "bg-muted-foreground/30",
            ].join(" ")}
            style={{ minHeight: "44px", minWidth: "44px" }}
          >
            <span
              className={[
                "pointer-events-none block h-4 w-4 rounded-full bg-white shadow-sm ring-0 transition-transform",
                regle.isActive ? "translate-x-2.5" : "-translate-x-2.5",
              ].join(" ")}
            />
          </button>
        ) : (
          <span
            className={[
              "inline-flex items-center rounded-full px-2 py-1 text-xs font-medium",
              regle.isActive
                ? "bg-primary/10 text-primary"
                : "bg-muted text-muted-foreground",
            ].join(" ")}
          >
            {regle.isActive ? "Active" : t("rules.detail.inactive")}
          </span>
        )}
      </div>

      {/* ---- Metadata row ---- */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground mb-3">
        {/* Activites count */}
        <span className="inline-flex items-center gap-1">
          <Activity className="h-3 w-3" />
          {regle._count.activites} activite
          {regle._count.activites !== 1 ? "s" : ""} generee
          {regle._count.activites !== 1 ? "s" : ""}
        </span>

        {/* Priorite */}
        <span>{t("rules.card.priority", { priority: regle.priorite })}</span>

        {/* intervalleJours */}
        {showIntervalle && (
          <span>
            Tous les {regle.intervalleJours} jour
            {regle.intervalleJours !== 1 ? "s" : ""}
          </span>
        )}

        {/* conditionValeur */}
        {showCondition && (
          <span>{t("rules.card.threshold", { value: regle.conditionValeur ?? 0 })}</span>
        )}

        {/* Conditions composees */}
        {hasCompoundConditions && (
          <span className="inline-flex items-center gap-1">
            {regle.conditions!.length} condition{regle.conditions!.length > 1 ? "s" : ""}
            <Badge variant="default" className="text-xs py-0 px-1.5">
              {(regle.logique as LogiqueCondition) === LogiqueCondition.OU ? "OU" : "ET"}
            </Badge>
          </span>
        )}
      </div>

      {/* ---- Description ---- */}
      {regle.description && (
        <p className="text-xs text-muted-foreground mb-3 line-clamp-2">
          {regle.description}
        </p>
      )}

    </div>
    </Link>
  );
}
