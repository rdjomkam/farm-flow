"use client";

import { useTranslations } from "next-intl";
import { ClipboardCheck, Calendar, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { CompleterActiviteDialog } from "@/components/planning/completer-activite-dialog";
import { TypeActivite, StatutActivite, Permission } from "@/types";
import type { ActiviteWithRelations } from "@/types";

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
  [TypeActivite.RENOUVELLEMENT]: "bg-accent-cyan",
  [TypeActivite.AUTRE]: "bg-muted-foreground",
};

interface MesTachesClientProps {
  activites: ActiviteWithRelations[];
  permissions: Permission[];
}

export function MesTachesClient({ activites, permissions }: MesTachesClientProps) {
  const t = useTranslations("planning");
  const tActivites = useTranslations("activites");

  // Group: EN_RETARD first, then PLANIFIEE by date
  const enRetard = activites.filter((a) => a.statut === StatutActivite.EN_RETARD);
  const planifiees = activites.filter((a) => a.statut === StatutActivite.PLANIFIEE);

  if (activites.length === 0) {
    return (
      <EmptyState
        icon={<ClipboardCheck className="h-8 w-8" />}
        title={t("emptyState.noTasks")}
        description={tActivites("emptyState.noTasksAssigned")}
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* EN_RETARD */}
      {enRetard.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="h-4 w-4 text-danger" />
            <h2 className="text-sm font-semibold text-danger">
              {tActivites("sections.late", { count: enRetard.length })}
            </h2>
          </div>
          <div className="flex flex-col gap-2">
            {enRetard.map((a) => (
              <TaskCard key={a.id} activite={a} permissions={permissions} t={t} tActivites={tActivites} />
            ))}
          </div>
        </section>
      )}

      {/* PLANIFIEE */}
      {planifiees.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold text-muted-foreground">
              {tActivites("sections.planned", { count: planifiees.length })}
            </h2>
          </div>
          <div className="flex flex-col gap-2">
            {planifiees.map((a) => (
              <TaskCard key={a.id} activite={a} permissions={permissions} t={t} tActivites={tActivites} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function TaskCard({
  activite,
  permissions,
  t,
  tActivites,
}: {
  activite: ActiviteWithRelations;
  permissions: Permission[];
  t: ReturnType<typeof useTranslations>;
  tActivites: ReturnType<typeof useTranslations>;
}) {
  const colorDot = typeActiviteColors[activite.typeActivite as TypeActivite] ?? "bg-muted-foreground";
  const isEnRetard = activite.statut === StatutActivite.EN_RETARD;

  return (
    <div className={`rounded-xl border p-4 transition-all ${isEnRetard ? "border-danger/30 bg-danger/5" : "border-border bg-card"}`}>
      <div className="flex items-start gap-3">
        <div className={`h-2.5 w-2.5 mt-1.5 rounded-full shrink-0 ${colorDot}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <p className="font-medium text-sm leading-tight">{activite.titre}</p>
            <Badge variant={isEnRetard ? "default" : "en_cours"}>
              {isEnRetard ? tActivites("statuses.late") : t("statuts.PLANIFIEE")}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            {tActivites(`filters.types.${activite.typeActivite}`) ?? activite.typeActivite}
            {activite.vague && ` · ${activite.vague.code}`}
            {activite.bac && ` · ${activite.bac.nom}`}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {new Date(activite.dateDebut).toLocaleDateString("fr-FR", {
              weekday: "short",
              day: "numeric",
              month: "short",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
          {activite.user && (
            <p className="text-xs text-muted-foreground mt-0.5">
              {t("creePar", { name: activite.user.name })}
            </p>
          )}
        </div>
      </div>
      {permissions.includes(Permission.PLANNING_GERER) && (
        <div className="mt-3 flex justify-end">
          <CompleterActiviteDialog activite={activite} />
        </div>
      )}
    </div>
  );
}
