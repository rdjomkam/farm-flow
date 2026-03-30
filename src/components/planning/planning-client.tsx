"use client";

import { useState, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { queryKeys } from "@/lib/query-keys";
import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Calendar,
  Trash2,
  ClipboardCheck,
  AlertTriangle,
  Info,
  FileText,
  Package,
  User,
  Bot,
  Utensils,
  Scale,
  Droplets,
  Hash,
  Sparkles,
  Wrench,
  ShoppingCart,
  ArrowLeftRight,
  Pill,
  MoreHorizontal,
} from "lucide-react";
import { InstructionSteps } from "@/components/activites/instruction-steps";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useActiviteService } from "@/services";
import { CompleterActiviteDialog } from "@/components/planning/completer-activite-dialog";
import { ModifierActiviteDialog } from "@/components/planning/modifier-activite-dialog";
import { TypeActivite, StatutActivite, TypeReleve, Permission, Recurrence, PhaseElevage } from "@/types";
import type { ActiviteWithRelations } from "@/types";
import { typeActiviteLabels } from "@/lib/labels/activite";

/** Labels abreges pour les types de releve (utilises dans le badge du dialog) */
const typeReleveLabels: Record<TypeReleve, string> = {
  [TypeReleve.BIOMETRIE]: "Biométrie",
  [TypeReleve.MORTALITE]: "Mortalité",
  [TypeReleve.ALIMENTATION]: "Alimentation",
  [TypeReleve.QUALITE_EAU]: "Qualité eau",
  [TypeReleve.COMPTAGE]: "Comptage",
  [TypeReleve.OBSERVATION]: "Observation",
  [TypeReleve.RENOUVELLEMENT]: "Renouvellement",
};

const typeActiviteColors: Record<TypeActivite, string> = {
  [TypeActivite.ALIMENTATION]: "bg-accent-green",
  [TypeActivite.BIOMETRIE]: "bg-accent-blue",
  [TypeActivite.QUALITE_EAU]: "bg-accent-cyan",
  [TypeActivite.COMPTAGE]: "bg-accent-purple",
  [TypeActivite.NETTOYAGE]: "bg-accent-orange",
  [TypeActivite.TRAITEMENT]: "bg-accent-red",
  [TypeActivite.RECOLTE]: "bg-primary",
  [TypeActivite.TRI]: "bg-accent-orange",
  [TypeActivite.MEDICATION]: "bg-accent-red",
  [TypeActivite.RENOUVELLEMENT]: "bg-accent-cyan", // Sprint 27-28
  [TypeActivite.AUTRE]: "bg-muted-foreground",
};

const statutVariants: Record<StatutActivite, "en_cours" | "terminee" | "annulee" | "default"> = {
  [StatutActivite.PLANIFIEE]: "en_cours",
  [StatutActivite.TERMINEE]: "terminee",
  [StatutActivite.ANNULEE]: "annulee",
  [StatutActivite.EN_RETARD]: "default",
};

// ---------------------------------------------------------------------------
// Constants for the dialog redesign
// ---------------------------------------------------------------------------

const typeActiviteIcons: Record<TypeActivite, React.ReactNode> = {
  [TypeActivite.ALIMENTATION]: <Utensils className="h-4 w-4" />,
  [TypeActivite.BIOMETRIE]: <Scale className="h-4 w-4" />,
  [TypeActivite.QUALITE_EAU]: <Droplets className="h-4 w-4" />,
  [TypeActivite.COMPTAGE]: <Hash className="h-4 w-4" />,
  [TypeActivite.NETTOYAGE]: <Sparkles className="h-4 w-4" />,
  [TypeActivite.TRAITEMENT]: <Wrench className="h-4 w-4" />,
  [TypeActivite.RECOLTE]: <ShoppingCart className="h-4 w-4" />,
  [TypeActivite.TRI]: <ArrowLeftRight className="h-4 w-4" />,
  [TypeActivite.MEDICATION]: <Pill className="h-4 w-4" />,
  [TypeActivite.RENOUVELLEMENT]: <Droplets className="h-4 w-4" />,
  [TypeActivite.AUTRE]: <MoreHorizontal className="h-4 w-4" />,
};

const recurrenceLabels: Record<Recurrence, string> = {
  [Recurrence.QUOTIDIEN]: "Quotidienne",
  [Recurrence.HEBDOMADAIRE]: "Hebdomadaire",
  [Recurrence.BIMENSUEL]: "Bimensuelle",
  [Recurrence.MENSUEL]: "Mensuelle",
  [Recurrence.PERSONNALISE]: "Personnalisee",
};

interface PrioriteConfig {
  iconBgClass: string;
  iconTextClass: string;
  badgeBgClass: string;
  badgeTextClass: string;
  dotClass: string;
  label: string;
}

function getPrioriteConfig(priorite: number): PrioriteConfig {
  if (priorite >= 3) {
    return {
      iconBgClass: "bg-danger/10",
      iconTextClass: "text-danger",
      badgeBgClass: "bg-danger/10",
      badgeTextClass: "text-danger",
      dotClass: "bg-danger",
      label: "Urgente",
    };
  }
  if (priorite === 2) {
    return {
      iconBgClass: "bg-warning/10",
      iconTextClass: "text-warning",
      badgeBgClass: "bg-warning/10",
      badgeTextClass: "text-warning",
      dotClass: "bg-warning",
      label: "Moyenne",
    };
  }
  return {
    iconBgClass: "bg-accent-blue/10",
    iconTextClass: "text-accent-blue",
    badgeBgClass: "bg-accent-blue/10",
    badgeTextClass: "text-accent-blue",
    dotClass: "bg-accent-blue",
    label: "Basse",
  };
}

const DAYS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const MONTHS = [
  "Janvier", "Fevrier", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Aout", "Septembre", "Octobre", "Novembre", "Decembre",
];

function getMonthDays(year: number, month: number) {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  // Adjust so Monday = 0
  const startDow = (firstDay.getDay() + 6) % 7;
  const days: (number | null)[] = Array(startDow).fill(null);
  for (let d = 1; d <= lastDay.getDate(); d++) {
    days.push(d);
  }
  // Pad to complete last week
  while (days.length % 7 !== 0) days.push(null);
  return days;
}

interface PlanningClientProps {
  activites: ActiviteWithRelations[];
  permissions: Permission[];
  vagues?: { id: string; code: string }[];
  bacs?: { id: string; nom: string }[];
  members?: { userId: string; userName: string }[];
}

export function PlanningClient({ activites, permissions, vagues = [], bacs = [], members = [] }: PlanningClientProps) {
  const t = useTranslations("planning");
  const activiteService = useActiviteService();
  const queryClient = useQueryClient();
  const [isPending, setIsPending] = useState(false);

  // Derived label helpers
  function getStatutLabel(statut: StatutActivite): string {
    return t(`statuts.${statut}`);
  }
  function getRecurrenceLabel(rec: string): string {
    return recurrenceLabels[rec as Recurrence] ?? rec;
  }
  function getPhaseLabel(phase: PhaseElevage): string {
    return t(`phases.${phase}`);
  }
  function getPrioriteLabel(priorite: number): string {
    if (priorite >= 3) return t("priorites.HAUTE");
    if (priorite === 2) return t("priorites.MOYENNE");
    return t("priorites.BASSE");
  }

  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [selectedActivite, setSelectedActivite] = useState<ActiviteWithRelations | null>(null);
  const [filterStatut, setFilterStatut] = useState<string>("toutes");

  // Cache des activites par mois (cle: "YYYY-M")
  const monthCacheRef = useRef<Map<string, ActiviteWithRelations[]>>(new Map());
  // Initialiser le cache avec les donnees SSR du mois courant
  const initialCacheKey = `${now.getFullYear()}-${now.getMonth()}`;
  if (!monthCacheRef.current.has(initialCacheKey)) {
    monthCacheRef.current.set(initialCacheKey, activites);
  }

  const [activitesData, setActivitesData] = useState<ActiviteWithRelations[]>(activites);
  const [isFetchingMonth, setIsFetchingMonth] = useState(false);

  async function fetchMonth(year: number, month: number) {
    const cacheKey = `${year}-${month}`;
    // Utiliser le cache si disponible
    if (monthCacheRef.current.has(cacheKey)) {
      setActivitesData(monthCacheRef.current.get(cacheKey)!);
      return;
    }
    setIsFetchingMonth(true);
    try {
      const dateDebut = new Date(year, month, 1).toISOString();
      const dateFin = new Date(year, month + 1, 0, 23, 59, 59).toISOString();
      const res = await activiteService.list({ dateDebut, dateFin });
      if (res.ok && res.data) {
        const fetched = res.data.activites ?? [];
        monthCacheRef.current.set(cacheKey, fetched);
        setActivitesData(fetched);
      }
    } finally {
      setIsFetchingMonth(false);
    }
  }

  function prevMonth() {
    const newMonth = viewMonth === 0 ? 11 : viewMonth - 1;
    const newYear = viewMonth === 0 ? viewYear - 1 : viewYear;
    setViewMonth(newMonth);
    setViewYear(newYear);
    setSelectedDay(null);
    void fetchMonth(newYear, newMonth);
  }

  function nextMonth() {
    const newMonth = viewMonth === 11 ? 0 : viewMonth + 1;
    const newYear = viewMonth === 11 ? viewYear + 1 : viewYear;
    setViewMonth(newMonth);
    setViewYear(newYear);
    setSelectedDay(null);
    void fetchMonth(newYear, newMonth);
  }

  // Filtrer les activites selon le statut
  const filteredActivites = activitesData.filter((a) => {
    if (filterStatut === "toutes") return true;
    return a.statut === filterStatut;
  });

  // Grouper par date (format YYYY-MM-DD)
  function dateKey(d: Date | string): string {
    const dt = typeof d === "string" ? new Date(d) : d;
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
  }

  const activitesByDate = new Map<string, ActiviteWithRelations[]>();
  for (const a of filteredActivites) {
    const key = dateKey(a.dateDebut);
    const arr = activitesByDate.get(key) ?? [];
    arr.push(a);
    activitesByDate.set(key, arr);
  }

  // Jours du mois visualise
  const monthDays = getMonthDays(viewYear, viewMonth);

  // Activites du mois courant + du jour selectionne
  const activitesMoisCourant = filteredActivites.filter((a) => {
    const dt = new Date(a.dateDebut);
    return dt.getFullYear() === viewYear && dt.getMonth() === viewMonth;
  });

  // Grouper les activites du mois par jour (numero)
  const activitesDuJour = selectedDay
    ? (activitesByDate.get(
        `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(selectedDay).padStart(2, "0")}`
      ) ?? [])
    : [];

  // Activites groupees par date (pour la vue mobile en liste)
  const groupesParDate: { dateLabel: string; items: ActiviteWithRelations[] }[] = [];
  const datesSorted = Array.from(activitesByDate.entries())
    .filter(([key]) => {
      const [y, m] = key.split("-").map(Number);
      return y === viewYear && m === viewMonth + 1;
    })
    .sort(([a], [b]) => a.localeCompare(b));

  for (const [key, items] of datesSorted) {
    const dt = new Date(key);
    const label = dt.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
    groupesParDate.push({ dateLabel: label, items });
  }

  async function supprimerActivite(activite: ActiviteWithRelations) {
    setIsPending(true);
    const result = await activiteService.remove(activite.id);
    setIsPending(false);
    if (result.ok) {
      queryClient.invalidateQueries({ queryKey: queryKeys.planning.activites() });
      setSelectedActivite(null);
    }
  }

  function ActiviteCard({ activite }: { activite: ActiviteWithRelations }) {
    const colorDot = typeActiviteColors[activite.typeActivite as TypeActivite] ?? "bg-muted-foreground";
    const hasReleve = !!activite.releve;
    return (
      <button
        onClick={() => setSelectedActivite(activite)}
        className="w-full text-left rounded-xl border border-border bg-card hover:shadow-sm transition-all p-4"
      >
        <div className="flex items-start gap-3">
          <div className={`h-2.5 w-2.5 mt-1.5 rounded-full shrink-0 ${colorDot}`} />
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 mb-1">
              <p className="font-medium text-sm leading-tight">{activite.titre}</p>
              <div className="flex items-center gap-1.5 shrink-0">
                {hasReleve && (
                  <span
                    className="inline-flex items-center gap-0.5 rounded-full bg-accent-green/15 px-2 py-0.5 text-[10px] font-medium text-accent-green"
                    title={t("badges.releve")}
                  >
                    <ClipboardCheck className="h-2.5 w-2.5" />
                    {t("badges.releve")}
                  </span>
                )}
                <Badge variant={statutVariants[activite.statut as StatutActivite] ?? "default"}>
                  {getStatutLabel(activite.statut as StatutActivite)}
                </Badge>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              {typeActiviteLabels[activite.typeActivite as TypeActivite] ?? activite.typeActivite}
              {activite.vague && ` · ${activite.vague.code}`}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {new Date(activite.dateDebut).toLocaleDateString("fr-FR", {
                day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
              })}
            </p>
            {activite.user && (
              <p className="text-xs text-muted-foreground mt-0.5">
                {t("creePar", { name: activite.user.name })}
              </p>
            )}
          </div>
        </div>
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Header navigation mois + bouton nouvelle activite */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={prevMonth} disabled={isFetchingMonth} className="h-10 w-10 p-0">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-semibold min-w-[120px] text-center">
            {isFetchingMonth ? (
              <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                <svg
                  className="h-3.5 w-3.5 animate-spin"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                {t("chargement")}
              </span>
            ) : (
              `${MONTHS[viewMonth]} ${viewYear}`
            )}
          </span>
          <Button variant="outline" size="sm" onClick={nextMonth} disabled={isFetchingMonth} className="h-10 w-10 p-0">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        {permissions.includes(Permission.PLANNING_GERER) && (
          <Link href="/planning/nouvelle">
            <Button size="sm" className="gap-1.5">
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">{t("nouvelle")}</span>
            </Button>
          </Link>
        )}
      </div>

      {/* Filtre statuts */}
      <Tabs value={filterStatut} onValueChange={setFilterStatut}>
        <TabsList className="w-full">
          <TabsTrigger value="toutes">{t("tabs.toutes")}</TabsTrigger>
          <TabsTrigger value={StatutActivite.PLANIFIEE}>{t("tabs.planifiees")}</TabsTrigger>
          <TabsTrigger value={StatutActivite.TERMINEE}>{t("tabs.terminees")}</TabsTrigger>
          <TabsTrigger value={StatutActivite.EN_RETARD}>{t("tabs.enRetard")}</TabsTrigger>
        </TabsList>

        <TabsContent value={filterStatut}>
          {/* Vue Desktop : calendrier */}
          <div className="hidden md:block">
            {/* Grille calendrier */}
            <div className="grid grid-cols-7 border-l border-t border-border rounded-lg overflow-hidden">
              {DAYS.map((d) => (
                <div key={d} className="border-r border-b border-border bg-muted/30 px-2 py-1 text-center text-xs font-semibold text-muted-foreground">
                  {d}
                </div>
              ))}
              {monthDays.map((day, i) => {
                if (day === null) {
                  return <div key={`empty-${i}`} className="border-r border-b border-border bg-muted/10 min-h-[72px]" />;
                }
                const key = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                const dayActivites = activitesByDate.get(key) ?? [];
                const isToday = day === now.getDate() && viewMonth === now.getMonth() && viewYear === now.getFullYear();
                const isSelected = day === selectedDay;

                return (
                  <button
                    key={key}
                    onClick={() => setSelectedDay(day === selectedDay ? null : day)}
                    className={`border-r border-b border-border min-h-[72px] p-1.5 text-left transition-colors hover:bg-muted/50 ${
                      isSelected ? "bg-primary/5" : isToday ? "bg-primary/3" : ""
                    }`}
                  >
                    <div className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium mb-1 ${
                      isToday ? "bg-primary text-primary-foreground" : "text-foreground"
                    }`}>
                      {day}
                    </div>
                    <div className="flex flex-wrap gap-0.5">
                      {dayActivites.slice(0, 3).map((a) => {
                        const colorDot = typeActiviteColors[a.typeActivite as TypeActivite] ?? "bg-muted-foreground";
                        return (
                          <div
                            key={a.id}
                            className={`h-1.5 w-1.5 rounded-full ${colorDot}`}
                            title={a.titre}
                          />
                        );
                      })}
                      {dayActivites.length > 3 && (
                        <span className="text-[9px] text-muted-foreground">+{dayActivites.length - 3}</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Detail du jour selectionne */}
            {selectedDay && (
              <div className="mt-4">
                <h3 className="text-sm font-semibold mb-2">
                  {selectedDay} {MONTHS[viewMonth]} {viewYear}
                  {activitesDuJour.length > 0 && ` · ${activitesDuJour.length} activite${activitesDuJour.length > 1 ? "s" : ""}`}
                </h3>
                {activitesDuJour.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t("empty.ceJour")}</p>
                ) : (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {activitesDuJour.map((a) => (
                      <ActiviteCard key={a.id} activite={a} />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Vue Mobile : liste par jour */}
          <div className="md:hidden flex flex-col gap-4">
            {groupesParDate.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Calendar className="h-10 w-10 text-muted-foreground/30 mb-3" />
                <p className="text-sm text-muted-foreground">{t("empty.ceMois")}</p>
                {permissions.includes(Permission.PLANNING_GERER) && (
                  <Link href="/planning/nouvelle" className="mt-3">
                    <Button size="sm" variant="outline">{t("planifier")}</Button>
                  </Link>
                )}
              </div>
            ) : (
              groupesParDate.map(({ dateLabel, items }) => (
                <div key={dateLabel}>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 capitalize">
                    {dateLabel}
                  </p>
                  <div className="flex flex-col gap-2">
                    {items.map((a) => (
                      <ActiviteCard key={a.id} activite={a} />
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Legende types */}
      <div className="flex flex-wrap gap-2 pt-2">
        {Object.entries(typeActiviteLabels).map(([type, label]) => {
          const colorDot = typeActiviteColors[type as TypeActivite] ?? "bg-muted-foreground";
          return (
            <div key={type} className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <div className={`h-2 w-2 rounded-full ${colorDot}`} />
              {label}
            </div>
          );
        })}
      </div>

      {/* Dialog detail activite */}
      {selectedActivite && (() => {
        const a = selectedActivite;
        const statut = a.statut as StatutActivite;
        const typeActivite = a.typeActivite as TypeActivite;
        const priorite = a.priorite ?? 1;
        const config = getPrioriteConfig(priorite);
        const icon = typeActiviteIcons[typeActivite] ?? <MoreHorizontal className="h-4 w-4" />;
        const isTerminee = statut === StatutActivite.TERMINEE;
        const isEnRetard = statut === StatutActivite.EN_RETARD;
        const canManage = permissions.includes(Permission.PLANNING_GERER);
        const canComplete = canManage && (statut === StatutActivite.PLANIFIEE || isEnRetard);

        return (
          <Dialog open={!!selectedActivite} onOpenChange={(open) => { if (!open) setSelectedActivite(null); }}>
            <DialogContent>
              {/* Accessible title — visually hidden, Section 1 provides the visible title */}
              <DialogTitle className="sr-only">{a.titre}</DialogTitle>
              {/* Accessible description for screen readers */}
              <DialogDescription className="sr-only">
                {typeActiviteLabels[typeActivite] ?? typeActivite} — {getStatutLabel(statut)}
              </DialogDescription>

              <div className="flex flex-col gap-4">

                {/* Section 1 — Header Card */}
                <div className="rounded-xl bg-surface-0 p-4">
                  {/* pr-10 keeps badge clear of the dialog close button */}
                  <div className="flex items-start justify-between gap-3 mb-3 pr-10">
                    <div className="flex items-start gap-2.5 flex-1 min-w-0">
                      {/* Type icon with priority-colored background */}
                      <div className={["rounded-md p-1.5 shrink-0", config.iconBgClass, config.iconTextClass].join(" ")}>
                        {icon}
                      </div>
                      <div className="min-w-0">
                        <h2 className="text-base font-semibold leading-snug break-words">{a.titre}</h2>
                        {a.description && (
                          <p className="mt-1 text-sm text-muted-foreground leading-relaxed">{a.description}</p>
                        )}
                      </div>
                    </div>
                    <div className="shrink-0">
                      <Badge variant={statutVariants[statut] ?? "default"}>
                        {isEnRetard && <AlertTriangle className="h-3 w-3 mr-1" />}
                        {getStatutLabel(statut)}
                      </Badge>
                    </div>
                  </div>

                  {/* Meta pills */}
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span className="rounded-full bg-muted px-2 py-0.5">
                      {typeActiviteLabels[typeActivite] ?? typeActivite}
                    </span>
                    {a.vague && (
                      <span className="rounded-full bg-muted px-2 py-0.5">{a.vague.code}</span>
                    )}
                    {a.bac && (
                      <span className="rounded-full bg-muted px-2 py-0.5">{a.bac.nom}</span>
                    )}
                    {a.phaseElevage && (
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-primary">
                        {getPhaseLabel(a.phaseElevage as PhaseElevage)}
                      </span>
                    )}
                    {a.isAutoGenerated && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-accent-purple/10 px-2 py-0.5 text-accent-purple">
                        <Bot className="h-3 w-3" />
                        Auto
                      </span>
                    )}
                    {priorite >= 2 && (
                      <span className={["inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium", config.badgeBgClass, config.badgeTextClass].join(" ")}>
                        <span className={["h-1.5 w-1.5 rounded-full", config.dotClass].join(" ")} />
                        {getPrioriteLabel(priorite)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Section 2 — EN RETARD Banner */}
                {isEnRetard && (
                  <div className="rounded-xl bg-danger/10 p-3">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-danger shrink-0" />
                      <p className="text-sm text-danger font-medium">
                        {t("detail.enRetardBanner")}
                      </p>
                    </div>
                  </div>
                )}

                {/* Section 3 — Dates & Context */}
                <div className="rounded-xl bg-surface-0 p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Calendar className="h-4 w-4 text-primary shrink-0" />
                    <h3 className="text-sm font-semibold text-foreground">{t("detail.planification")}</h3>
                  </div>
                  <div className="flex flex-col gap-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{t("detail.dateDebut")}</span>
                      <span className="font-medium">
                        {new Date(a.dateDebut).toLocaleDateString("fr-FR", {
                          weekday: "short", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
                        })}
                      </span>
                    </div>
                    {a.dateFin && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">{t("detail.dateFin")}</span>
                        <span className="font-medium">
                          {new Date(a.dateFin).toLocaleDateString("fr-FR", {
                            weekday: "short", day: "numeric", month: "short",
                          })}
                        </span>
                      </div>
                    )}
                    {a.recurrence && (
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground">{t("detail.recurrence")}</span>
                        <Badge variant="info">
                          {getRecurrenceLabel(a.recurrence as Recurrence)}
                        </Badge>
                      </div>
                    )}
                    {a.vague && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">{t("detail.vague")}</span>
                        <Link
                          href={`/vagues/${a.vagueId}`}
                          className="font-medium text-primary hover:underline"
                          onClick={() => setSelectedActivite(null)}
                        >
                          {a.vague.code}
                        </Link>
                      </div>
                    )}
                    {a.bac && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">{t("detail.bac")}</span>
                        <span className="font-medium">{a.bac.nom}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Section 4 — Conseil IA */}
                {a.conseilIA && (
                  <div className="rounded-xl bg-warning/10 p-4">
                    <div className="flex items-start gap-2.5">
                      <Info className="h-4 w-4 text-warning mt-0.5 shrink-0" />
                      <div>
                        <p className="text-xs font-semibold text-warning mb-1">{t("detail.conseilIA")}</p>
                        <p className="text-sm text-warning leading-relaxed">{a.conseilIA}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Section 5 — Instructions detaillees */}
                {a.instructionsDetaillees && (
                  <div className="rounded-xl bg-surface-0 p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <FileText className="h-4 w-4 text-primary shrink-0" />
                      <h3 className="text-sm font-semibold text-foreground">{t("detail.instructions")}</h3>
                    </div>
                    <InstructionSteps text={a.instructionsDetaillees} />
                  </div>
                )}

                {/* Section 6 — Produit recommande */}
                {a.produitRecommande && (
                  <div className="rounded-xl bg-surface-0 p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Package className="h-4 w-4 text-primary shrink-0" />
                      <h3 className="text-sm font-semibold text-foreground">{t("detail.produitRecommande")}</h3>
                    </div>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{a.produitRecommande.nom}</p>
                        {a.quantiteRecommandee != null && (
                          <p className="text-sm text-muted-foreground mt-0.5">
                            {t("detail.quantiteRecommandee")}{" "}
                            <span className="font-semibold text-foreground">
                              {a.quantiteRecommandee} {a.produitRecommande.unite}
                            </span>
                          </p>
                        )}
                        {a.produitRecommande.stockActuel != null && (
                          <p className={[
                            "text-xs mt-1",
                            a.quantiteRecommandee != null && a.produitRecommande.stockActuel < a.quantiteRecommandee
                              ? "text-danger font-medium"
                              : "text-muted-foreground",
                          ].join(" ")}>
                            {t("detail.stockActuel")} {a.produitRecommande.stockActuel} {a.produitRecommande.unite}
                            {a.quantiteRecommandee != null && a.produitRecommande.stockActuel < a.quantiteRecommandee && (
                              <span className="ml-1 inline-flex items-center gap-0.5">
                                <AlertTriangle className="h-3 w-3" />
                                {t("detail.stockInsuffisant")}
                              </span>
                            )}
                          </p>
                        )}
                      </div>
                      <Link
                        href={`/stock/${a.produitRecommande.id}`}
                        className="shrink-0 inline-flex items-center gap-1 rounded-lg bg-muted px-3 py-2 text-xs font-medium text-foreground hover:bg-muted/70 transition-colors min-h-[44px]"
                        onClick={() => setSelectedActivite(null)}
                      >
                        {t("detail.voirStock")}
                      </Link>
                    </div>
                  </div>
                )}

                {/* Section 7 — Releve lie */}
                {a.releve && (
                  <div className="rounded-xl bg-surface-0 p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <ClipboardCheck className="h-4 w-4 text-primary shrink-0" />
                        <span className="text-sm font-semibold text-foreground">{t("detail.releveLie")}</span>
                      </div>
                      <Link
                        href={`/vagues/${a.vagueId}#releve-${a.releve.id}`}
                        className="flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
                        onClick={() => setSelectedActivite(null)}
                      >
                        {typeReleveLabels[a.releve.typeReleve as TypeReleve] ?? a.releve.typeReleve}
                        {" · "}
                        {new Date(a.releve.date).toLocaleDateString("fr-FR", {
                          day: "numeric", month: "short", year: "numeric",
                        })}
                      </Link>
                    </div>
                  </div>
                )}

                {/* Section 8 — Intervenants */}
                {(a.user || a.assigneA) && (
                  <div className="rounded-xl bg-surface-0 p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <User className="h-4 w-4 text-primary shrink-0" />
                      <h3 className="text-sm font-semibold text-foreground">{t("detail.intervenants")}</h3>
                    </div>
                    <div className="flex flex-col gap-2">
                      {a.user && (
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">{t("detail.creePar")}</span>
                          <span className="font-medium">{a.user.name}</span>
                        </div>
                      )}
                      {a.assigneA && (
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">{t("detail.assigneA")}</span>
                          <span className="font-medium">{a.assigneA.name}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Section 9 — Note de completion */}
                {isTerminee && a.noteCompletion && (
                  <div className="rounded-xl bg-success/10 p-4">
                    <p className="text-xs font-semibold text-success mb-1">{t("detail.noteCompletion")}</p>
                    <p className="text-sm text-success leading-relaxed">{a.noteCompletion}</p>
                    {a.dateTerminee && (
                      <p className="text-xs text-success/70 mt-1.5">
                        {t("detail.termineeLe")}{" "}
                        {new Date(a.dateTerminee).toLocaleDateString("fr-FR", {
                          day: "numeric", month: "long", year: "numeric",
                        })}
                      </p>
                    )}
                  </div>
                )}

                {/* Section 10 — Actions */}
                {canManage && (
                  <div className="flex flex-wrap gap-2 pt-2">
                    {canComplete && (
                      <div className="w-full sm:w-auto">
                        <CompleterActiviteDialog
                          activite={a}
                          onCompleted={() => setSelectedActivite(null)}
                        />
                      </div>
                    )}
                    <ModifierActiviteDialog
                      activite={a}
                      permissions={permissions}
                      vagues={vagues}
                      bacs={bacs}
                      members={members}
                    />
                    <Button
                      variant="danger"
                      size="sm"
                      className="gap-1.5 min-h-[44px]"
                      onClick={() => supprimerActivite(a)}
                      disabled={isPending}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      {t("detail.supprimer")}
                    </Button>
                  </div>
                )}

              </div>
            </DialogContent>
          </Dialog>
        );
      })()}
    </div>
  );
}
