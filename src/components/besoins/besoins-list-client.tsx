"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Plus, ClipboardList, Calendar, User, AlertCircle, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { StatutBesoins } from "@/types";
import { useBesoinsList } from "@/hooks/queries/use-depenses-queries";
import type { ListeBesoinsWithRelations } from "@/types";

const statutVariants: Record<
  StatutBesoins,
  "default" | "info" | "en_cours" | "terminee" | "annulee" | "warning"
> = {
  [StatutBesoins.SOUMISE]: "info",
  [StatutBesoins.APPROUVEE]: "en_cours",
  [StatutBesoins.TRAITEE]: "warning",
  [StatutBesoins.CLOTUREE]: "terminee",
  [StatutBesoins.REJETEE]: "annulee",
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ListeBesoinsData {
  id: string;
  numero: string;
  titre: string;
  statut: string;
  montantEstime: number;
  montantReel: number | null;
  dateLimite: string | null;
  createdAt: string;
  demandeur: { id: string; name: string } | null;
  valideur: { id: string; name: string } | null;
  /** Vagues associees avec ratios (multi-vague) */
  vagues?: { id: string; vagueId: string; ratio: number; vague?: { id: string; code: string } | null }[];
  _count: { lignes: number };
}

interface Props {
  listesBesoins: ListeBesoinsData[];
  canCreate: boolean;
  canApprove: boolean;
  canProcess: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatMontant(n: number) {
  return new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

const STATUTS_TERMINAUX = [StatutBesoins.TRAITEE, StatutBesoins.CLOTUREE, StatutBesoins.REJETEE];

function getDateLimiteStatus(dateLimite: string | null, statut: string): "retard" | "proche" | "ok" | null {
  if (!dateLimite) return null;
  if (STATUTS_TERMINAUX.includes(statut as StatutBesoins)) return null;
  const limite = new Date(dateLimite);
  const now = new Date();
  if (limite < now) return "retard";
  const deuxJours = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
  if (limite <= deuxJours) return "proche";
  return "ok";
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function BesoinsListClient({
  listesBesoins: initialListesBesoins,
  canCreate,
}: Props) {
  const t = useTranslations("besoins");
  const { data: listesBesoinsRaw = initialListesBesoins } = useBesoinsList(undefined, {
    initialData: initialListesBesoins as unknown as ListeBesoinsWithRelations[],
  });
  const listesBesoins = listesBesoinsRaw as unknown as ListeBesoinsData[];
  const [activeTab, setActiveTab] = useState("toutes");

  const tabs: { value: string; label: string; statuts: string[] | null }[] = [
    { value: "toutes", label: t("list.tabs.toutes"), statuts: null },
    { value: "soumises", label: t("list.tabs.soumises"), statuts: [StatutBesoins.SOUMISE] },
    { value: "approuvees", label: t("list.tabs.approuvees"), statuts: [StatutBesoins.APPROUVEE] },
    { value: "traitees", label: t("list.tabs.traitees"), statuts: [StatutBesoins.TRAITEE] },
    { value: "cloturees", label: t("list.tabs.cloturees"), statuts: [StatutBesoins.CLOTUREE] },
    { value: "rejetees", label: t("list.tabs.rejetees"), statuts: [StatutBesoins.REJETEE] },
  ];

  // filteredListes is computed inside the single TabsContent render below

  return (
    <div className="p-4 max-w-2xl mx-auto">
      {/* Header actions */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-muted-foreground">
          {t("list.count", { count: listesBesoins.length })}
        </p>
        {canCreate && (
          <Button asChild variant="primary" size="sm">
            <Link href="/besoins/nouveau">
              <Plus className="h-4 w-4 mr-1" />
              {t("list.nouvelle")}
            </Link>
          </Button>
        )}
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="overflow-x-auto -mx-4 px-4">
          <TabsList className="w-max mb-4">
          {tabs.map((tab) => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className="text-xs whitespace-nowrap"
            >
              {tab.label}
              {tab.statuts && (
                <span className="ml-1 text-xs opacity-70">
                  (
                  {
                    listesBesoins.filter((lb) =>
                      tab.statuts!.includes(lb.statut)
                    ).length
                  }
                  )
                </span>
              )}
            </TabsTrigger>
          ))}
          </TabsList>
        </div>

        {/* UN SEUL TabsContent — valeur dynamique liée à activeTab (Pattern C2) */}
        <TabsContent value={activeTab}>
          {(() => {
            const activeTabDef = tabs.find((t) => t.value === activeTab);
            const currentList = activeTabDef?.statuts
              ? listesBesoins.filter((lb) => activeTabDef.statuts!.includes(lb.statut))
              : listesBesoins;

            return currentList.length === 0 ? (
              <div className="text-center py-12">
                <ClipboardList className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                <p className="text-muted-foreground text-sm">
                  {t("list.empty")}
                </p>
                {canCreate && activeTab === "toutes" && (
                  <Button asChild variant="primary" className="mt-4">
                    <Link href="/besoins/nouveau">
                      <Plus className="h-4 w-4 mr-1" />
                      {t("list.creer")}
                    </Link>
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {currentList.map((lb) => (
                  <Link key={lb.id} href={`/besoins/${lb.id}`}>
                    <Card className="hover:shadow-md transition-shadow cursor-pointer my-4">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-muted-foreground font-mono">
                              {lb.numero}
                            </p>
                            <p className="font-medium text-sm leading-snug mt-0.5 truncate">
                              {lb.titre}
                            </p>
                          </div>
                          <Badge
                            variant={
                              statutVariants[lb.statut as StatutBesoins] ??
                              "default"
                            }
                            className="flex-shrink-0"
                          >
                            {t(`statuts.${lb.statut as StatutBesoins}` as Parameters<typeof t>[0]) ??
                              lb.statut}
                          </Badge>
                        </div>

                        {/* Meta info */}
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground mt-2">
                          {lb.demandeur && (
                            <span className="flex items-center gap-1">
                              <User className="h-3 w-3" />
                              {lb.demandeur.name}
                            </span>
                          )}
                          {lb.vagues && lb.vagues.length === 1 && lb.vagues[0].vague && (
                            <span className="text-primary">
                              {lb.vagues[0].vague.code}
                            </span>
                          )}
                          {lb.vagues && lb.vagues.length > 1 && lb.vagues[0].vague && (
                            <span className="text-primary">
                              {lb.vagues[0].vague.code}{" "}
                              <span className="text-xs opacity-70">
                                +{lb.vagues.length - 1}
                              </span>
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {formatDate(lb.createdAt)}
                          </span>
                          <span>
                            {lb._count.lignes !== 1
                              ? t("list.card.lignesPlural", { count: lb._count.lignes })
                              : t("list.card.lignesSingular", { count: lb._count.lignes })}
                          </span>
                        </div>

                        {/* Date limite */}
                        {lb.dateLimite && (() => {
                          const dlStatus = getDateLimiteStatus(lb.dateLimite, lb.statut);
                          if (!dlStatus) return null;
                          return (
                            <div className="mt-2 flex items-center gap-1.5">
                              {dlStatus === "retard" ? (
                                <span className="flex items-center gap-1 text-xs font-medium text-destructive">
                                  <AlertCircle className="h-3.5 w-3.5" />
                                  {t("list.card.enRetard", { date: formatDate(lb.dateLimite) })}
                                </span>
                              ) : dlStatus === "proche" ? (
                                <span className="flex items-center gap-1 text-xs font-medium text-warning">
                                  <Clock className="h-3.5 w-3.5" />
                                  {t("list.card.echeanceProche", { date: formatDate(lb.dateLimite) })}
                                </span>
                              ) : (
                                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                  <Clock className="h-3.5 w-3.5" />
                                  {t("list.card.limite", { date: formatDate(lb.dateLimite) })}
                                </span>
                              )}
                            </div>
                          );
                        })()}

                        {/* Montant */}
                        <div className="mt-3 flex items-center justify-between">
                          <div>
                            <p className="text-xs text-muted-foreground">
                              {t("list.card.montantEstime")}
                            </p>
                            <p className="text-base font-semibold">
                              {formatMontant(lb.montantEstime)} FCFA
                            </p>
                          </div>
                          {lb.montantReel !== null && (
                            <div className="text-right">
                              <p className="text-xs text-muted-foreground">
                                {t("list.card.montantReel")}
                              </p>
                              <p className="text-base font-semibold text-primary">
                                {formatMontant(lb.montantReel)} FCFA
                              </p>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            );
          })()}
        </TabsContent>
      </Tabs>
    </div>
  );
}
