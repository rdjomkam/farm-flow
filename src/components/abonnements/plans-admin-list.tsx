"use client";

/**
 * src/components/abonnements/plans-admin-list.tsx
 *
 * Liste admin des plans d'abonnement avec filtres et actions.
 * Client Component — filtres interactifs.
 * Mobile-first : cartes empilées sur mobile, tableau sur desktop.
 *
 * Story 38.1 — Sprint 38
 * Story 38.3 — Toggle actif/inactif + confirmation dialog
 * R2 : enums importés depuis @/types
 * R5 : DialogTrigger asChild — OBLIGATOIRE
 * R6 : CSS variables du thème
 */
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { useTranslations } from "next-intl";
import { Filter, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { TypePlan, SiteModule } from "@/types";
import { PLAN_LABELS } from "@/lib/abonnements-constants";
import { SITE_MODULES_CONFIG } from "@/lib/site-modules-config";
import { formatXAFOrFree } from "@/lib/format";
import { PlanFormDialog, type PlanAdminItem } from "@/components/abonnements/plan-form-dialog";

// ---------------------------------------------------------------------------
// Module badge helper — resolves icon and short label from SITE_MODULES_CONFIG
// ---------------------------------------------------------------------------

function getModuleConfig(module: SiteModule) {
  return SITE_MODULES_CONFIG.find((c) => c.value === module) ?? null;
}

// ---------------------------------------------------------------------------
// ModuleBadgeList — affiche une liste de badges de modules compacts
// ---------------------------------------------------------------------------

interface ModuleBadgeListProps {
  modules: SiteModule[];
  noModulesLabel: string;
}

function ModuleBadgeList({ modules, noModulesLabel }: ModuleBadgeListProps) {
  if (modules.length === 0) {
    return <span className="text-xs text-muted-foreground">{noModulesLabel}</span>;
  }

  return (
    <div className="flex flex-wrap gap-1">
      {modules.map((mod) => {
        const config = getModuleConfig(mod);
        const Icon = config?.icon ?? null;
        const label = config?.labelKey ?? mod;

        return (
          <span
            key={mod}
            className="inline-flex items-center gap-1 rounded-md border border-border bg-muted/50 px-1.5 py-0.5 text-xs text-foreground"
          >
            {Icon && <Icon className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden />}
            <span className="leading-none">{label}</span>
          </span>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PlansAdminListProps {
  plans: PlanAdminItem[];
}

// ---------------------------------------------------------------------------
// Helpers (stateless, no i18n needed)
// ---------------------------------------------------------------------------

/** Renvoie le variant Badge selon le statut actif/inactif */
function statutVariant(isActif: boolean): "terminee" | "annulee" {
  return isActif ? "terminee" : "annulee";
}

// ---------------------------------------------------------------------------
// Composant ToggleButton — bouton toggle avec confirmation dialog si abonnés actifs
// ---------------------------------------------------------------------------

interface ToggleButtonProps {
  plan: PlanAdminItem;
  onToggle: (planId: string) => Promise<void>;
  isLoading: boolean;
  errorMessage: string | null;
  className?: string;
}

function TogglePlanButton({
  plan,
  onToggle,
  isLoading,
  errorMessage,
  className = "",
}: ToggleButtonProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const t = useTranslations("abonnements");
  const needsConfirm = plan.isActif && plan._count.abonnements > 0;

  const handleDirectToggle = async () => {
    await onToggle(plan.id);
  };

  const handleConfirmedToggle = async () => {
    setConfirmOpen(false);
    await onToggle(plan.id);
  };

  const buttonLabel = plan.isActif ? t("admin.toggleDeactivate") : t("admin.toggleActivate");
  const ariaLabel = `${buttonLabel} le plan ${plan.nom}`;

  if (needsConfirm) {
    return (
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        {/* R5 : DialogTrigger asChild — OBLIGATOIRE */}
        <DialogTrigger asChild>
          <Button
            variant="outline"
            className={`min-h-[44px] px-2 text-xs ${className}`}
            disabled={isLoading}
            aria-label={ariaLabel}
          >
            {isLoading ? "..." : buttonLabel}
          </Button>
        </DialogTrigger>

        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("admin.toggleDeactivateTitle")}</DialogTitle>
            <DialogDescription>
              Le plan <strong>{plan.nom}</strong> a{" "}
              <strong>{plan._count.abonnements}</strong> abonné
              {plan._count.abonnements > 1 ? "s" : ""} actif
              {plan._count.abonnements > 1 ? "s" : ""}. Les abonnés existants
              conserveront leur accès jusqu&apos;à expiration, mais aucun
              nouvel abonnement ne sera possible.
            </DialogDescription>
          </DialogHeader>

          {errorMessage && (
            <div className="rounded-lg bg-destructive/10 text-destructive px-3 py-2 text-sm">
              {errorMessage}
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              className="min-h-[44px]"
              onClick={() => setConfirmOpen(false)}
            >
              {t("admin.dialogCancel")}
            </Button>
            <Button
              variant="outline"
              className="min-h-[44px] text-destructive border-destructive hover:bg-destructive/10"
              disabled={isLoading}
              onClick={handleConfirmedToggle}
            >
              {isLoading ? t("admin.toggleDeactivating") : t("admin.toggleDeactivateConfirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Button
      variant="outline"
      className={`min-h-[44px] px-2 text-xs ${className}`}
      disabled={isLoading}
      onClick={handleDirectToggle}
      aria-label={ariaLabel}
    >
      {isLoading ? "..." : buttonLabel}
    </Button>
  );
}

// ---------------------------------------------------------------------------
// Composant principal
// ---------------------------------------------------------------------------

export function PlansAdminList({ plans: initialPlans }: PlansAdminListProps) {
  const queryClient = useQueryClient();
  const t = useTranslations("abonnements");
  const [plans, setPlans] = useState<PlanAdminItem[]>(initialPlans);
  const [filterType, setFilterType] = useState<TypePlan | "">("");
  const [filterStatut, setFilterStatut] = useState<"actif" | "inactif" | "">("");
  // Map planId -> loading state
  const [loadingIds, setLoadingIds] = useState<Set<string>>(new Set());
  // Map planId -> error message
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validTypes = Object.values(TypePlan);

  // ---------------------------------------------------------------------------
  // Helpers with i18n — defined inside component to access `t` closure
  // ---------------------------------------------------------------------------

  /** Formate une limite : 999 = t("admin.unlimited"), sinon affiche le nombre */
  function formatLimite(val: number | null): string {
    if (val === null) return t("admin.unlimited");
    if (val >= 999) return t("admin.unlimited");
    return String(val);
  }

  /** Formate les 3 prix d'un plan sur une ligne concise */
  function formatPrixResume(
    mensuel: number | null,
    trimestriel: number | null,
    annuel: number | null
  ): string {
    const parts: string[] = [];
    if (mensuel !== null) parts.push(formatXAFOrFree(mensuel) + "/mois");
    if (trimestriel !== null) parts.push(formatXAFOrFree(trimestriel) + "/trim.");
    if (annuel !== null) parts.push(formatXAFOrFree(annuel) + "/an");
    return parts.length > 0 ? parts.join(" · ") : t("admin.onQuote");
  }

  // Filtrage
  const filtered = plans.filter((p) => {
    if (filterType && p.typePlan !== filterType) return false;
    if (filterStatut === "actif" && !p.isActif) return false;
    if (filterStatut === "inactif" && p.isActif) return false;
    return true;
  });

  const hasFilter = filterType !== "" || filterStatut !== "";

  /** Toggle optimiste : flip local, appel API, rollback sur erreur */
  async function handleToggle(planId: string) {
    // Nettoyer l'éventuelle erreur précédente
    setErrors((prev) => {
      const next = { ...prev };
      delete next[planId];
      return next;
    });

    // Optimistic update : flip isActif dans le state local
    const previousPlans = plans;
    setPlans((prev) =>
      prev.map((p) => (p.id === planId ? { ...p, isActif: !p.isActif } : p))
    );

    setLoadingIds((prev) => new Set(prev).add(planId));

    try {
      const res = await fetch(`/api/backoffice/plans/${planId}/toggle`, {
        method: "PATCH",
      });

      if (!res.ok) {
        // Rollback
        setPlans(previousPlans);

        const data = await res.json().catch(() => ({}));

        if (res.status === 409) {
          const nb = data.abonnesActifs ?? 0;
          setErrors((prev) => ({
            ...prev,
            [planId]: `Impossible de désactiver un plan avec ${nb} abonné${nb > 1 ? "s" : ""} actif${nb > 1 ? "s" : ""}.`,
          }));
        } else {
          setErrors((prev) => ({
            ...prev,
            [planId]: data.message ?? "Erreur lors du changement de statut.",
          }));
        }
        return;
      }

      // Succès — rafraîchir les données du serveur en arrière-plan
      queryClient.invalidateQueries({ queryKey: queryKeys.abonnements.plans() });
    } catch {
      // Rollback sur erreur réseau
      setPlans(previousPlans);
      setErrors((prev) => ({
        ...prev,
        [planId]: "Erreur réseau. Veuillez réessayer.",
      }));
    } finally {
      setLoadingIds((prev) => {
        const next = new Set(prev);
        next.delete(planId);
        return next;
      });
    }
  }

  return (
    <div className="space-y-4">
      {/* Barre d'actions */}
      <div className="flex flex-wrap gap-2 items-center justify-between">
        <div className="flex flex-wrap gap-2 items-center">
          <Filter className="h-4 w-4 text-muted-foreground" />
          {/* Filtre par type */}
          <select
            className="text-sm border border-border rounded-lg px-3 py-2 bg-card text-foreground min-h-[44px]"
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as TypePlan | "")}
            aria-label="Filtrer par type de plan"
          >
            <option value="">{t("admin.allTypes")}</option>
            {validTypes.map((typePlan) => (
              <option key={typePlan} value={typePlan}>
                {t(PLAN_LABELS[typePlan])}
              </option>
            ))}
          </select>
          {/* Filtre par statut */}
          <select
            className="text-sm border border-border rounded-lg px-3 py-2 bg-card text-foreground min-h-[44px]"
            value={filterStatut}
            onChange={(e) =>
              setFilterStatut(e.target.value as "actif" | "inactif" | "")
            }
            aria-label="Filtrer par statut"
          >
            <option value="">{t("admin.allStatuses")}</option>
            <option value="actif">{t("admin.active")}</option>
            <option value="inactif">{t("admin.inactive")}</option>
          </select>
          {hasFilter && (
            <Button
              variant="outline"
              className="text-xs min-h-[44px]"
              onClick={() => {
                setFilterType("");
                setFilterStatut("");
              }}
            >
              {t("admin.reset")}
            </Button>
          )}
        </div>
        {/* Nouveau plan — Story 38.2 */}
        <PlanFormDialog>
          <Button className="min-h-[44px] gap-2" aria-label="Créer un nouveau plan">
            <Plus className="h-4 w-4" />
            {t("admin.newPlan")}
          </Button>
        </PlanFormDialog>
      </div>

      {/* Tableau desktop */}
      <div className="hidden md:block overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/50">
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t("admin.columns.plan")}</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t("admin.columns.type")}</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t("admin.columns.price")}</th>
              <th className="px-4 py-3 text-center font-medium text-muted-foreground">{t("admin.columns.sites")}</th>
              <th className="px-4 py-3 text-center font-medium text-muted-foreground">{t("admin.columns.tanks")}</th>
              <th className="px-4 py-3 text-center font-medium text-muted-foreground">{t("admin.columns.waves")}</th>
              <th className="px-4 py-3 text-center font-medium text-muted-foreground">{t("admin.columns.engineer")}</th>
              <th className="px-4 py-3 text-center font-medium text-muted-foreground">{t("admin.columns.subscribers")}</th>
              <th className="px-4 py-3 text-center font-medium text-muted-foreground">{t("admin.columns.status")}</th>
              <th className="px-4 py-3 text-center font-medium text-muted-foreground">{t("admin.columns.visibility")}</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t("admin.columns.modules")}</th>
              <th className="px-4 py-3 text-center font-medium text-muted-foreground">{t("admin.columns.actions")}</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p, i) => (
              <tr
                key={p.id}
                className={`${i % 2 === 0 ? "bg-card" : "bg-muted/10"} ${
                  !p.isActif ? "opacity-60" : ""
                }`}
              >
                <td className="px-4 py-3">
                  <p className="font-medium text-foreground">{p.nom}</p>
                  {p.description && (
                    <p className="text-xs text-muted-foreground line-clamp-1">{p.description}</p>
                  )}
                </td>
                <td className="px-4 py-3">
                  <Badge variant="default" className="text-xs">
                    {t(PLAN_LABELS[p.typePlan])}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-foreground text-xs whitespace-nowrap">
                  {formatPrixResume(p.prixMensuel, p.prixTrimestriel, p.prixAnnuel)}
                </td>
                <td className="px-4 py-3 text-center text-foreground">
                  {formatLimite(p.limitesSites)}
                </td>
                <td className="px-4 py-3 text-center text-foreground">
                  {formatLimite(p.limitesBacs)}
                </td>
                <td className="px-4 py-3 text-center text-foreground">
                  {formatLimite(p.limitesVagues)}
                </td>
                <td className="px-4 py-3 text-center text-muted-foreground text-xs">
                  {p.limitesIngFermes !== null ? `${p.limitesIngFermes} fermes` : "—"}
                </td>
                <td className="px-4 py-3 text-center font-medium text-foreground">
                  {p._count.abonnements}
                </td>
                <td className="px-4 py-3 text-center">
                  <Badge variant={statutVariant(p.isActif)}>
                    {p.isActif ? t("admin.active") : t("admin.inactive")}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-center">
                  <Badge variant={p.isPublic ? "en_cours" : "default"}>
                    {p.isPublic ? t("admin.public") : t("admin.private")}
                  </Badge>
                </td>
                <td className="px-4 py-3 max-w-[220px]">
                  <ModuleBadgeList
                    modules={p.modulesInclus}
                    noModulesLabel={t("admin.noModules")}
                  />
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-col items-center gap-1">
                    <div className="flex justify-center gap-1">
                      {/* Story 38.2 — dialog modifier */}
                      <PlanFormDialog plan={p}>
                        <Button
                          variant="outline"
                          className="min-h-[44px] px-2 text-xs"
                          aria-label={`Modifier le plan ${p.nom}`}
                        >
                          {t("admin.edit")}
                        </Button>
                      </PlanFormDialog>
                      {/* Story 38.3 — toggle actif */}
                      <TogglePlanButton
                        plan={p}
                        onToggle={handleToggle}
                        isLoading={loadingIds.has(p.id)}
                        errorMessage={errors[p.id] ?? null}
                      />
                    </div>
                    {errors[p.id] && (
                      <p className="text-xs text-destructive text-center max-w-[180px]">
                        {errors[p.id]}
                      </p>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={12} className="px-4 py-8 text-center text-muted-foreground">
                  {t("admin.noPlanFound")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Cartes mobile */}
      <div className="space-y-3 md:hidden">
        {filtered.length === 0 && (
          <p className="text-center text-sm text-muted-foreground py-8">
            {t("admin.noPlanFound")}
          </p>
        )}
        {filtered.map((p) => (
          <div
            key={p.id}
            className={`bg-card border border-border rounded-xl p-4 space-y-3 ${
              !p.isActif ? "opacity-70" : ""
            }`}
          >
            {/* En-tête */}
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold text-foreground">{p.nom}</p>
                <Badge variant="default" className="text-xs mt-1">
                  {t(PLAN_LABELS[p.typePlan])}
                </Badge>
              </div>
              <div className="flex flex-col items-end gap-1">
                <Badge variant={statutVariant(p.isActif)}>
                  {p.isActif ? t("admin.active") : t("admin.inactive")}
                </Badge>
                <Badge variant={p.isPublic ? "en_cours" : "default"} className="text-xs">
                  {p.isPublic ? t("admin.public") : t("admin.private")}
                </Badge>
              </div>
            </div>

            {/* Prix */}
            <div className="text-xs text-muted-foreground">
              <p className="font-medium text-foreground text-sm">{t("admin.columns.price")}</p>
              <div className="mt-1 space-y-0.5">
                {p.prixMensuel !== null && (
                  <p>{t("admin.monthlyPrice")} <span className="font-medium text-foreground">{formatXAFOrFree(p.prixMensuel)}</span></p>
                )}
                {p.prixTrimestriel !== null && (
                  <p>{t("admin.quarterlyPrice")} <span className="font-medium text-foreground">{formatXAFOrFree(p.prixTrimestriel)}</span></p>
                )}
                {p.prixAnnuel !== null && (
                  <p>{t("admin.annualPrice")} <span className="font-medium text-foreground">{formatXAFOrFree(p.prixAnnuel)}</span></p>
                )}
                {p.prixMensuel === null && p.prixTrimestriel === null && p.prixAnnuel === null && (
                  <p className="font-medium text-foreground">{t("admin.onQuote")}</p>
                )}
              </div>
            </div>

            {/* Limites */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <p className="text-muted-foreground">Sites max</p>
                <p className="font-medium text-foreground">{formatLimite(p.limitesSites)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Bacs max</p>
                <p className="font-medium text-foreground">{formatLimite(p.limitesBacs)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Vagues max</p>
                <p className="font-medium text-foreground">{formatLimite(p.limitesVagues)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Fermes ingénieur</p>
                <p className="font-medium text-foreground">
                  {p.limitesIngFermes !== null ? `${p.limitesIngFermes}` : "—"}
                </p>
              </div>
            </div>

            {/* Modules */}
            <div>
              <p className="text-xs text-muted-foreground mb-1">{t("admin.columns.modules")}</p>
              <ModuleBadgeList
                modules={p.modulesInclus}
                noModulesLabel={t("admin.noModules")}
              />
            </div>

            {/* Erreur toggle */}
            {errors[p.id] && (
              <div className="rounded-lg bg-destructive/10 text-destructive px-3 py-2 text-xs">
                {errors[p.id]}
              </div>
            )}

            {/* Abonnés + actions */}
            <div className="flex items-center justify-between pt-2 border-t border-border">
              <p className="text-xs text-muted-foreground">
                <span className="font-semibold text-foreground">{p._count.abonnements}</span> abonné{p._count.abonnements > 1 ? "s" : ""}
              </p>
              <div className="flex gap-2">
                {/* Story 38.2 — dialog modifier */}
                <PlanFormDialog plan={p}>
                  <Button
                    variant="outline"
                    className="min-h-[44px] text-xs px-3"
                    aria-label={`Modifier le plan ${p.nom}`}
                  >
                    {t("admin.edit")}
                  </Button>
                </PlanFormDialog>
                {/* Story 38.3 — toggle actif */}
                <TogglePlanButton
                  plan={p}
                  onToggle={handleToggle}
                  isLoading={loadingIds.has(p.id)}
                  errorMessage={errors[p.id] ?? null}
                  className="px-3"
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
