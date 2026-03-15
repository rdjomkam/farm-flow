"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, ClipboardList, Calendar, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { StatutBesoins } from "@/types";

// ---------------------------------------------------------------------------
// Labels & variants
// ---------------------------------------------------------------------------

const statutLabels: Record<StatutBesoins, string> = {
  [StatutBesoins.SOUMISE]: "Soumise",
  [StatutBesoins.APPROUVEE]: "Approuvee",
  [StatutBesoins.TRAITEE]: "Traitee",
  [StatutBesoins.CLOTUREE]: "Cloturee",
  [StatutBesoins.REJETEE]: "Rejetee",
};

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
  createdAt: string;
  demandeur: { id: string; name: string } | null;
  valideur: { id: string; name: string } | null;
  vague: { id: string; code: string } | null;
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

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function BesoinsListClient({
  listesBesoins,
  canCreate,
}: Props) {
  const [activeTab, setActiveTab] = useState("toutes");

  const tabs: { value: string; label: string; statuts: string[] | null }[] = [
    { value: "toutes", label: "Toutes", statuts: null },
    { value: "soumises", label: "Soumises", statuts: [StatutBesoins.SOUMISE] },
    {
      value: "approuvees",
      label: "Approuvees",
      statuts: [StatutBesoins.APPROUVEE],
    },
    { value: "traitees", label: "Traitees", statuts: [StatutBesoins.TRAITEE] },
    {
      value: "cloturees",
      label: "Cloturees",
      statuts: [StatutBesoins.CLOTUREE],
    },
    { value: "rejetees", label: "Rejetees", statuts: [StatutBesoins.REJETEE] },
  ];

  const filteredListes = tabs
    .find((t) => t.value === activeTab)
    ?.statuts
    ? listesBesoins.filter((lb) =>
        tabs.find((t) => t.value === activeTab)!.statuts!.includes(lb.statut)
      )
    : listesBesoins;

  return (
    <div className="p-4 pb-24 max-w-2xl mx-auto">
      {/* Header actions */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-muted-foreground">
          {listesBesoins.length} liste{listesBesoins.length !== 1 ? "s" : ""}
        </p>
        {canCreate && (
          <Button asChild variant="primary" size="sm">
            <Link href="/besoins/nouveau">
              <Plus className="h-4 w-4 mr-1" />
              Nouvelle liste
            </Link>
          </Button>
        )}
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full overflow-x-auto flex mb-4">
          {tabs.map((tab) => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className="flex-1 text-xs whitespace-nowrap"
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

        {tabs.map((tab) => (
          <TabsContent key={tab.value} value={tab.value}>
            {filteredListes.length === 0 ? (
              <div className="text-center py-12">
                <ClipboardList className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                <p className="text-muted-foreground text-sm">
                  Aucune liste de besoins dans cet onglet
                </p>
                {canCreate && tab.value === "toutes" && (
                  <Button asChild variant="primary" className="mt-4">
                    <Link href="/besoins/nouveau">
                      <Plus className="h-4 w-4 mr-1" />
                      Creer une liste
                    </Link>
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {filteredListes.map((lb) => (
                  <Link key={lb.id} href={`/besoins/${lb.id}`}>
                    <Card className="hover:shadow-md transition-shadow cursor-pointer">
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
                            {statutLabels[lb.statut as StatutBesoins] ??
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
                          {lb.vague && (
                            <span className="text-primary">
                              {lb.vague.code}
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {formatDate(lb.createdAt)}
                          </span>
                          <span>
                            {lb._count.lignes} ligne
                            {lb._count.lignes !== 1 ? "s" : ""}
                          </span>
                        </div>

                        {/* Montant */}
                        <div className="mt-3 flex items-center justify-between">
                          <div>
                            <p className="text-xs text-muted-foreground">
                              Montant estime
                            </p>
                            <p className="text-base font-semibold">
                              {formatMontant(lb.montantEstime)} FCFA
                            </p>
                          </div>
                          {lb.montantReel !== null && (
                            <div className="text-right">
                              <p className="text-xs text-muted-foreground">
                                Montant reel
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
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
