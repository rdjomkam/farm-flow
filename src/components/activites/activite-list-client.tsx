"use client";

import { useState, useMemo } from "react";
import { useTranslations } from "next-intl";
import { ClipboardCheck, AlertTriangle, CalendarDays, Filter, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { EmptyState } from "@/components/ui/empty-state";
import { ActiviteCard } from "@/components/activites/activite-card";
import {
  TypeActivite,
  StatutActivite,
  Permission,
} from "@/types";
import type { ActiviteWithRelations } from "@/types";

// ---------------------------------------------------------------------------
// Types des filtres
// ---------------------------------------------------------------------------

interface Filters {
  typeActivite: TypeActivite | "TOUS";
  statut: StatutActivite | "TOUS";
  priorite: "1" | "2" | "3" | "TOUS";
}

// ---------------------------------------------------------------------------
// Tri : priorite desc, puis dateDebut asc
// ---------------------------------------------------------------------------

function sortActivites(items: ActiviteWithRelations[]): ActiviteWithRelations[] {
  return [...items].sort((a, b) => {
    const pa = a.priorite ?? 1;
    const pb = b.priorite ?? 1;
    if (pb !== pa) return pb - pa;
    return new Date(a.dateDebut).getTime() - new Date(b.dateDebut).getTime();
  });
}

// ---------------------------------------------------------------------------
// Calcul résumé quotidien
// ---------------------------------------------------------------------------

function getDailySummary(activites: ActiviteWithRelations[]) {
  const today = new Date();
  const startOfDay = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
    0,
    0,
    0
  );
  const endOfDay = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
    23,
    59,
    59
  );

  const todayActivites = activites.filter((a) => {
    const d = new Date(a.dateDebut);
    return (
      d >= startOfDay &&
      d <= endOfDay &&
      a.statut !== StatutActivite.TERMINEE &&
      a.statut !== StatutActivite.ANNULEE
    );
  });

  const urgentes = todayActivites.filter((a) => (a.priorite ?? 1) >= 3);

  return { count: todayActivites.length, urgentes: urgentes.length };
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ActiviteListClientProps {
  activites: ActiviteWithRelations[];
  permissions: Permission[];
}

// ---------------------------------------------------------------------------
// Composant principal
// ---------------------------------------------------------------------------

export function ActiviteListClient({
  activites,
  permissions,
}: ActiviteListClientProps) {
  const t = useTranslations("activites");

  const [filters, setFilters] = useState<Filters>({
    typeActivite: "TOUS",
    statut: "TOUS",
    priorite: "TOUS",
  });
  const [showFilters, setShowFilters] = useState(false);

  // Resume quotidien (sur toutes les activites, pas filtrées)
  const { count: todayCount, urgentes: todayUrgentes } =
    getDailySummary(activites);

  // Filtrage + tri
  const filtered = useMemo(() => {
    let result = activites;

    if (filters.typeActivite !== "TOUS") {
      result = result.filter(
        (a) => a.typeActivite === filters.typeActivite
      );
    }
    if (filters.statut !== "TOUS") {
      result = result.filter((a) => a.statut === filters.statut);
    }
    if (filters.priorite !== "TOUS") {
      const p = Number(filters.priorite);
      result = result.filter((a) => (a.priorite ?? 1) === p);
    }

    return sortActivites(result);
  }, [activites, filters]);

  // Groupes : EN_RETARD en premier, puis PLANIFIEE, puis reste
  const enRetard = filtered.filter(
    (a) => a.statut === StatutActivite.EN_RETARD
  );
  const planifiees = filtered.filter(
    (a) => a.statut === StatutActivite.PLANIFIEE
  );
  const autres = filtered.filter(
    (a) =>
      a.statut !== StatutActivite.EN_RETARD &&
      a.statut !== StatutActivite.PLANIFIEE
  );

  const hasActiveFilters =
    filters.typeActivite !== "TOUS" ||
    filters.statut !== "TOUS" ||
    filters.priorite !== "TOUS";

  function resetFilters() {
    setFilters({ typeActivite: "TOUS", statut: "TOUS", priorite: "TOUS" });
  }

  // Filter options built from enums + translations
  const typeActiviteOptions: { value: TypeActivite | "TOUS"; label: string }[] = [
    { value: "TOUS", label: t("filters.allTypes") },
    { value: TypeActivite.ALIMENTATION, label: t("filters.types.ALIMENTATION") },
    { value: TypeActivite.BIOMETRIE, label: t("filters.types.BIOMETRIE") },
    { value: TypeActivite.QUALITE_EAU, label: t("filters.types.QUALITE_EAU") },
    { value: TypeActivite.COMPTAGE, label: t("filters.types.COMPTAGE") },
    { value: TypeActivite.NETTOYAGE, label: t("filters.types.NETTOYAGE") },
    { value: TypeActivite.TRAITEMENT, label: t("filters.types.TRAITEMENT") },
    { value: TypeActivite.RECOLTE, label: t("filters.types.RECOLTE") },
    { value: TypeActivite.TRI, label: t("filters.types.TRI") },
    { value: TypeActivite.MEDICATION, label: t("filters.types.MEDICATION") },
    { value: TypeActivite.RENOUVELLEMENT, label: t("filters.types.RENOUVELLEMENT") },
    { value: TypeActivite.AUTRE, label: t("filters.types.AUTRE") },
  ];

  const statutOptions: { value: StatutActivite | "TOUS"; label: string }[] = [
    { value: "TOUS", label: t("filters.allStatuses") },
    { value: StatutActivite.PLANIFIEE, label: t("filters.statuses.PLANIFIEE") },
    { value: StatutActivite.EN_RETARD, label: t("filters.statuses.EN_RETARD") },
    { value: StatutActivite.TERMINEE, label: t("filters.statuses.TERMINEE") },
    { value: StatutActivite.ANNULEE, label: t("filters.statuses.ANNULEE") },
  ];

  const prioriteOptions: { value: "1" | "2" | "3" | "TOUS"; label: string }[] = [
    { value: "TOUS", label: t("filters.allPriorities") },
    { value: "3", label: t("filters.priorities.URGENTE") },
    { value: "2", label: t("filters.priorities.MOYENNE") },
    { value: "1", label: t("filters.priorities.BASSE") },
  ];

  // -------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------

  return (
    <div className="flex flex-col gap-4">
      {/* Resume quotidien */}
      {todayCount > 0 && (
        <div
          className={[
            "rounded-xl border px-4 py-3",
            todayUrgentes > 0
              ? "border-danger/30 bg-danger/5"
              : "border-primary/20 bg-primary/5",
          ].join(" ")}
        >
          <div className="flex items-center gap-2">
            {todayUrgentes > 0 ? (
              <AlertTriangle className="h-4 w-4 text-danger shrink-0" />
            ) : (
              <CalendarDays className="h-4 w-4 text-primary shrink-0" />
            )}
            <p
              className={[
                "text-sm font-medium",
                todayUrgentes > 0 ? "text-danger" : "text-primary",
              ].join(" ")}
            >
              {todayCount > 1
                ? t("summary.tasksTodayPlural", { count: todayCount })
                : t("summary.tasksToday", { count: todayCount })}
              {todayUrgentes > 0 && (
                <span className="ml-1">
                  &mdash; {todayUrgentes}{" "}
                  {todayUrgentes > 1
                    ? t("summary.urgentPlural")
                    : t("summary.urgent")}
                </span>
              )}
            </p>
          </div>
        </div>
      )}

      {/* Barre filtres */}
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {filtered.length} activite{filtered.length > 1 ? "s" : ""}
          {hasActiveFilters && " (filtre)"}
        </p>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setShowFilters((v) => !v)}
          className="gap-1.5"
        >
          <Filter className="h-4 w-4" />
          {t("buttons.filters")}
          {hasActiveFilters && (
            <span className="ml-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground">
              {[
                filters.typeActivite !== "TOUS",
                filters.statut !== "TOUS",
                filters.priorite !== "TOUS",
              ].filter(Boolean).length}
            </span>
          )}
        </Button>
      </div>

      {/* Panneau de filtres (expansible) */}
      {showFilters && (
        <div className="rounded-xl border border-border bg-card p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">{t("filterPanel.title")}</p>
            {hasActiveFilters && (
              <button
                onClick={resetFilters}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                <X className="h-3 w-3" />
                {t("buttons.resetFilters")}
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {/* Filtre type */}
            <Select
              value={filters.typeActivite}
              onValueChange={(v) =>
                setFilters((f) => ({
                  ...f,
                  typeActivite: v as TypeActivite | "TOUS",
                }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {typeActiviteOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Filtre statut */}
            <Select
              value={filters.statut}
              onValueChange={(v) =>
                setFilters((f) => ({
                  ...f,
                  statut: v as StatutActivite | "TOUS",
                }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {statutOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Filtre priorite */}
            <Select
              value={filters.priorite}
              onValueChange={(v) =>
                setFilters((f) => ({
                  ...f,
                  priorite: v as "1" | "2" | "3" | "TOUS",
                }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {prioriteOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {/* Aucune activite */}
      {filtered.length === 0 && (
        <EmptyState
          icon={<ClipboardCheck className="h-8 w-8" />}
          title={t("emptyState.noActivities")}
          description={
            hasActiveFilters
              ? t("emptyState.noActivitiesFiltered")
              : t("emptyState.noTasksAssigned")
          }
        />
      )}

      {/* Section EN_RETARD */}
      {enRetard.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="h-4 w-4 text-danger" />
            <h2 className="text-sm font-semibold text-danger">
              {t("sections.late", { count: enRetard.length })}
            </h2>
          </div>
          <div className="flex flex-col gap-3">
            {enRetard.map((a) => (
              <ActiviteCard key={a.id} activite={a} permissions={permissions} />
            ))}
          </div>
        </section>
      )}

      {/* Section PLANIFIEE */}
      {planifiees.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold text-muted-foreground">
              {t("sections.planned", { count: planifiees.length })}
            </h2>
          </div>
          <div className="flex flex-col gap-3">
            {planifiees.map((a) => (
              <ActiviteCard key={a.id} activite={a} permissions={permissions} />
            ))}
          </div>
        </section>
      )}

      {/* Section autres statuts (TERMINEE, ANNULEE si inclus via filtre) */}
      {autres.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <ClipboardCheck className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold text-muted-foreground">
              {t("sections.other", { count: autres.length })}
            </h2>
          </div>
          <div className="flex flex-col gap-3">
            {autres.map((a) => (
              <ActiviteCard key={a.id} activite={a} permissions={permissions} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
