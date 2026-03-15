"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Calendar,
  Trash2,
  ClipboardCheck,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { CompleterActiviteDialog } from "@/components/planning/completer-activite-dialog";
import { ModifierActiviteDialog } from "@/components/planning/modifier-activite-dialog";
import { TypeActivite, StatutActivite, TypeReleve, Permission } from "@/types";
import type { ActiviteWithRelations } from "@/types";

/** Labels abreges pour les types de releve (utilises dans le badge du dialog) */
const typeReleveLabels: Record<TypeReleve, string> = {
  [TypeReleve.BIOMETRIE]: "Biométrie",
  [TypeReleve.MORTALITE]: "Mortalité",
  [TypeReleve.ALIMENTATION]: "Alimentation",
  [TypeReleve.QUALITE_EAU]: "Qualité eau",
  [TypeReleve.COMPTAGE]: "Comptage",
  [TypeReleve.OBSERVATION]: "Observation",
};

// Labels
const typeActiviteLabels: Record<TypeActivite, string> = {
  [TypeActivite.ALIMENTATION]: "Alimentation",
  [TypeActivite.BIOMETRIE]: "Biometrie",
  [TypeActivite.QUALITE_EAU]: "Qualite eau",
  [TypeActivite.COMPTAGE]: "Comptage",
  [TypeActivite.NETTOYAGE]: "Nettoyage",
  [TypeActivite.TRAITEMENT]: "Traitement",
  [TypeActivite.RECOLTE]: "Recolte",
  [TypeActivite.TRI]: "Tri",
  [TypeActivite.MEDICATION]: "Medication",
  [TypeActivite.AUTRE]: "Autre",
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
  [TypeActivite.AUTRE]: "bg-muted-foreground",
};

const statutLabels: Record<StatutActivite, string> = {
  [StatutActivite.PLANIFIEE]: "Planifiee",
  [StatutActivite.TERMINEE]: "Terminee",
  [StatutActivite.ANNULEE]: "Annulee",
  [StatutActivite.EN_RETARD]: "En retard",
};

const statutVariants: Record<StatutActivite, "en_cours" | "terminee" | "annulee" | "default"> = {
  [StatutActivite.PLANIFIEE]: "en_cours",
  [StatutActivite.TERMINEE]: "terminee",
  [StatutActivite.ANNULEE]: "annulee",
  [StatutActivite.EN_RETARD]: "default",
};

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
  const { toast } = useToast();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [selectedActivite, setSelectedActivite] = useState<ActiviteWithRelations | null>(null);
  const [filterStatut, setFilterStatut] = useState<string>("toutes");

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear((y) => y - 1); }
    else setViewMonth((m) => m - 1);
  }

  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear((y) => y + 1); }
    else setViewMonth((m) => m + 1);
  }

  // Filtrer les activites selon le statut
  const filteredActivites = activites.filter((a) => {
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
    try {
      const res = await fetch(`/api/activites/${activite.id}`, { method: "DELETE" });
      if (res.ok) {
        toast({ title: "Activite supprimee", variant: "success" });
        startTransition(() => router.refresh());
        setSelectedActivite(null);
      } else {
        toast({ title: "Erreur lors de la suppression", variant: "error" });
      }
    } catch {
      toast({ title: "Erreur reseau", variant: "error" });
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
                    title="Relevé lié"
                  >
                    <ClipboardCheck className="h-2.5 w-2.5" />
                    Relevé
                  </span>
                )}
                <Badge variant={statutVariants[activite.statut as StatutActivite] ?? "default"}>
                  {statutLabels[activite.statut as StatutActivite] ?? activite.statut}
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
                Cree par {activite.user.name}
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
          <Button variant="outline" size="sm" onClick={prevMonth} className="h-10 w-10 p-0">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-semibold min-w-[120px] text-center">
            {MONTHS[viewMonth]} {viewYear}
          </span>
          <Button variant="outline" size="sm" onClick={nextMonth} className="h-10 w-10 p-0">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        {permissions.includes(Permission.PLANNING_GERER) && (
          <Link href="/planning/nouvelle">
            <Button size="sm" className="gap-1.5">
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Nouvelle</span>
            </Button>
          </Link>
        )}
      </div>

      {/* Filtre statuts */}
      <Tabs value={filterStatut} onValueChange={setFilterStatut}>
        <TabsList className="w-full">
          <TabsTrigger value="toutes">Toutes</TabsTrigger>
          <TabsTrigger value={StatutActivite.PLANIFIEE}>Planifiees</TabsTrigger>
          <TabsTrigger value={StatutActivite.TERMINEE}>Terminees</TabsTrigger>
          <TabsTrigger value={StatutActivite.EN_RETARD}>En retard</TabsTrigger>
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
                  <p className="text-sm text-muted-foreground">Aucune activite ce jour</p>
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
                <p className="text-sm text-muted-foreground">Aucune activite ce mois</p>
                {permissions.includes(Permission.PLANNING_GERER) && (
                  <Link href="/planning/nouvelle" className="mt-3">
                    <Button size="sm" variant="outline">Planifier une activite</Button>
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
      {selectedActivite && (
        <Dialog open={!!selectedActivite} onOpenChange={(open) => { if (!open) setSelectedActivite(null); }}>
          <DialogContent>
            <DialogTitle>{selectedActivite.titre}</DialogTitle>
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-2">
                <Badge variant={statutVariants[selectedActivite.statut as StatutActivite] ?? "default"}>
                  {statutLabels[selectedActivite.statut as StatutActivite] ?? selectedActivite.statut}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  {typeActiviteLabels[selectedActivite.typeActivite as TypeActivite] ?? selectedActivite.typeActivite}
                </span>
              </div>

              <div className="grid gap-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Date debut</span>
                  <span className="font-medium">
                    {new Date(selectedActivite.dateDebut).toLocaleDateString("fr-FR", {
                      weekday: "short", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
                    })}
                  </span>
                </div>
                {selectedActivite.dateFin && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Date fin</span>
                    <span className="font-medium">
                      {new Date(selectedActivite.dateFin).toLocaleDateString("fr-FR", {
                        weekday: "short", day: "numeric", month: "short",
                      })}
                    </span>
                  </div>
                )}
                {selectedActivite.vague && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Vague</span>
                    <span className="font-medium">{selectedActivite.vague.code}</span>
                  </div>
                )}
                {selectedActivite.description && (
                  <div>
                    <p className="text-muted-foreground mb-1">Description</p>
                    <p className="text-sm bg-muted rounded-lg p-3">{selectedActivite.description}</p>
                  </div>
                )}

                {/* Releve lie */}
                {selectedActivite.releve && (
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Relevé lié</span>
                    <Link
                      href={`/vagues/${selectedActivite.vagueId}#releve-${selectedActivite.releve.id}`}
                      className="flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
                      onClick={() => setSelectedActivite(null)}
                    >
                      <ClipboardCheck className="h-3.5 w-3.5" />
                      {typeReleveLabels[selectedActivite.releve.typeReleve as TypeReleve] ?? selectedActivite.releve.typeReleve}
                      {" · "}
                      {new Date(selectedActivite.releve.date).toLocaleDateString("fr-FR", {
                        day: "numeric", month: "short", year: "numeric",
                      })}
                    </Link>
                  </div>
                )}
              </div>

              {/* Creator info */}
              {selectedActivite.user && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Cree par</span>
                  <span className="font-medium">{selectedActivite.user.name}</span>
                </div>
              )}

              {/* Assignee info */}
              {selectedActivite.assigneA && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Assigne a</span>
                  <span className="font-medium">{selectedActivite.assigneA.name}</span>
                </div>
              )}

              {/* Note de completion */}
              {selectedActivite.noteCompletion && (
                <div>
                  <p className="text-muted-foreground text-sm mb-1">Note de completion</p>
                  <p className="text-sm bg-muted rounded-lg p-3">{selectedActivite.noteCompletion}</p>
                </div>
              )}

              {/* Date completion */}
              {selectedActivite.dateTerminee && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Completee le</span>
                  <span className="font-medium">
                    {new Date(selectedActivite.dateTerminee).toLocaleDateString("fr-FR", {
                      day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
                    })}
                  </span>
                </div>
              )}

              <div className="flex gap-2 pt-2">
                {(selectedActivite.statut === StatutActivite.PLANIFIEE || selectedActivite.statut === StatutActivite.EN_RETARD) && permissions.includes(Permission.PLANNING_GERER) && (
                  <CompleterActiviteDialog
                    activite={selectedActivite}
                    onCompleted={() => setSelectedActivite(null)}
                  />
                )}
                {permissions.includes(Permission.PLANNING_GERER) && (
                  <ModifierActiviteDialog
                    activite={selectedActivite}
                    permissions={permissions}
                    vagues={vagues}
                    bacs={bacs}
                    members={members}
                  />
                )}
                {permissions.includes(Permission.PLANNING_GERER) && (
                  <Button
                    variant="danger"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => supprimerActivite(selectedActivite)}
                    disabled={isPending}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Supprimer
                  </Button>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
