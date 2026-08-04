"use client";

/**
 * src/components/previsions/scenarios-list-client.tsx
 *
 * Liste des scenarios de prevision — cartes empilees mobile-first (pas de
 * tableau brut sur mobile, cf. CLAUDE.md). Permission passee en prop depuis
 * le Server Component (patron `vagues-list-client.tsx`, pre-analyse PR2.3
 * §6) : aucun hook de garde dedie n'existe dans le depot.
 */
import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { FileText, Archive, PlayCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Permission, StatutScenarioPrevision } from "@/types";
import { usePrevisionsApi } from "@/hooks/use-previsions-api";
import { ScenarioFormDialog } from "@/components/previsions/scenario-form-dialog";
import { formatEntierPrevision } from "@/lib/previsions/format-previsions";
import type { ScenarioPrevisionSummaryDTO } from "@/components/previsions/api-types";

const STATUT_BADGE_VARIANT: Record<StatutScenarioPrevision, "info" | "success" | "default"> = {
  [StatutScenarioPrevision.BROUILLON]: "info",
  [StatutScenarioPrevision.ACTIF]: "success",
  [StatutScenarioPrevision.ARCHIVE]: "default",
};

interface ScenariosListClientProps {
  initialScenarios: ScenarioPrevisionSummaryDTO[];
  permissions: Permission[];
}

export function ScenariosListClient({ initialScenarios, permissions }: ScenariosListClientProps) {
  const t = useTranslations("previsions");
  const { post } = usePrevisionsApi();
  const [scenarios, setScenarios] = useState(initialScenarios);
  const [busyId, setBusyId] = useState<string | null>(null);

  const peutGerer = permissions.includes(Permission.PREVISIONS_GERER);

  async function handleTransition(id: string, action: "activer" | "archiver") {
    setBusyId(id);
    try {
      const result = await post<ScenarioPrevisionSummaryDTO>(
        `/api/previsions/scenarios/${id}/${action}`,
        {}
      );
      if (result.ok && result.data) {
        setScenarios((prev) => prev.map((s) => (s.id === id ? result.data! : s)));
      }
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {peutGerer && (
        <div className="flex justify-end">
          <ScenarioFormDialog onCreated={(s) => setScenarios((prev) => [s, ...prev])} />
        </div>
      )}

      {scenarios.length === 0 ? (
        <EmptyState
          icon={<FileText className="h-8 w-8" />}
          title={t("list.emptyTitle")}
          description={t("list.emptyDescription")}
        />
      ) : (
        <div className="flex flex-col gap-3">
          {scenarios.map((s) => {
            const variant = STATUT_BADGE_VARIANT[s.statut];
            return (
              <div key={s.id} className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold truncate">{s.nom}</p>
                      <Badge variant={variant}>{t(`list.statuts.${s.statut}`)}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground truncate">{s.code}</p>
                    {s.description && (
                      <p className="mt-1 text-sm text-muted-foreground">{s.description}</p>
                    )}
                    <p className="mt-2 text-xs text-muted-foreground">
                      {t("list.cycleLabel", {
                        count: formatEntierPrevision(s.dureeCycleMois),
                        date: new Date(s.dateDebutPlan).toLocaleDateString("fr-FR"),
                      })}
                    </p>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <Link href={`/previsions/scenarios/${s.id}`} className="flex-1 min-w-[140px]">
                    <Button variant="outline" size="sm" className="w-full">
                      {t("list.open")}
                    </Button>
                  </Link>
                  {peutGerer && s.statut === StatutScenarioPrevision.BROUILLON && (
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={busyId === s.id}
                      onClick={() => handleTransition(s.id, "activer")}
                    >
                      <PlayCircle className="h-4 w-4" />
                      {t("list.activate")}
                    </Button>
                  )}
                  {peutGerer && s.statut !== StatutScenarioPrevision.ARCHIVE && (
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={busyId === s.id}
                      onClick={() => handleTransition(s.id, "archiver")}
                    >
                      <Archive className="h-4 w-4" />
                      {t("list.archive")}
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
