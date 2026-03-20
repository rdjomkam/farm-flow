"use client";

import { useState } from "react";
import Link from "next/link";
import { Calendar, ChevronRight, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { EmptyState } from "@/components/ui/empty-state";
import { ModifierReleveDialog } from "@/components/releves/modifier-releve-dialog";
import { TypeReleve, Permission } from "@/types";
import type { Releve } from "@/types";
import type { ProduitOption } from "@/components/releves/consommation-fields";

const typeLabels: Record<TypeReleve, string> = {
  [TypeReleve.BIOMETRIE]: "Biométrie",
  [TypeReleve.MORTALITE]: "Mortalité",
  [TypeReleve.ALIMENTATION]: "Alimentation",
  [TypeReleve.QUALITE_EAU]: "Qualité eau",
  [TypeReleve.COMPTAGE]: "Comptage",
  [TypeReleve.OBSERVATION]: "Observation",
  [TypeReleve.RENOUVELLEMENT]: "Renouvellement",
};

const typeVariants: Record<TypeReleve, "info" | "warning" | "default"> = {
  [TypeReleve.BIOMETRIE]: "info",
  [TypeReleve.MORTALITE]: "warning",
  [TypeReleve.ALIMENTATION]: "default",
  [TypeReleve.QUALITE_EAU]: "info",
  [TypeReleve.COMPTAGE]: "default",
  [TypeReleve.OBSERVATION]: "default",
  [TypeReleve.RENOUVELLEMENT]: "default",
};

function ReleveDetails({ releve }: { releve: Releve }) {
  const type = releve.typeReleve as TypeReleve;
  switch (type) {
    case TypeReleve.BIOMETRIE:
      return (
        <div className="text-sm text-muted-foreground">
          Poids : {releve.poidsMoyen}g{releve.tailleMoyenne != null ? ` | Taille : ${releve.tailleMoyenne}cm` : ""} | Éch. : {releve.echantillonCount}
        </div>
      );
    case TypeReleve.MORTALITE:
      return (
        <div className="text-sm text-muted-foreground">
          {releve.nombreMorts} mort{(releve.nombreMorts ?? 0) > 1 ? "s" : ""} — {releve.causeMortalite}
        </div>
      );
    case TypeReleve.ALIMENTATION:
      return (
        <div className="text-sm text-muted-foreground">
          {releve.quantiteAliment}kg ({releve.typeAliment}) | {releve.frequenceAliment}x/jour
        </div>
      );
    case TypeReleve.QUALITE_EAU:
      return (
        <div className="text-sm text-muted-foreground">
          {releve.temperature != null && `T: ${releve.temperature}°C `}
          {releve.ph != null && `pH: ${releve.ph} `}
          {releve.oxygene != null && `O₂: ${releve.oxygene}mg/L `}
          {releve.ammoniac != null && `NH₃: ${releve.ammoniac}mg/L`}
        </div>
      );
    case TypeReleve.COMPTAGE:
      return (
        <div className="text-sm text-muted-foreground">
          {releve.nombreCompte} poissons ({releve.methodeComptage})
        </div>
      );
    case TypeReleve.OBSERVATION:
      return (
        <div className="text-sm text-muted-foreground">{releve.description}</div>
      );
  }
}

interface RelevesListProps {
  releves: Releve[];
  produits?: ProduitOption[];
  permissions: Permission[];
  limit?: number;
  vagueId?: string;
}

export function RelevesList({ releves, produits = [], permissions, limit, vagueId }: RelevesListProps) {
  const [tab, setTab] = useState("tous");

  const isLimited = limit != null;
  const hasMore = isLimited && releves.length > limit;

  // In limited mode, show most recent N (already sorted by date desc from API)
  const displayReleves = hasMore ? releves.slice(0, limit) : releves;

  const filtered = tab === "tous"
    ? displayReleves
    : displayReleves.filter((r) => r.typeReleve === tab);

  const typeCounts = Object.values(TypeReleve).reduce(
    (acc, t) => {
      acc[t] = displayReleves.filter((r) => r.typeReleve === t).length;
      return acc;
    },
    {} as Record<TypeReleve, number>
  );

  const releveItems = (items: Releve[]) => (
    <div className="flex flex-col gap-2">
      {items.map((r) => (
        <div key={r.id} id={`releve-${r.id}`}>
          <div className="flex flex-col gap-1 p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Badge variant={typeVariants[r.typeReleve as TypeReleve]}>
                  {typeLabels[r.typeReleve as TypeReleve]}
                </Badge>
                {(r as { modifie?: boolean }).modifie && (
                  <Badge variant="warning">Modifie</Badge>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Calendar className="h-3 w-3" />
                  {new Date(r.date).toLocaleString("fr-FR", { dateStyle: "long", timeStyle: "short" })}
                </span>
                <ModifierReleveDialog releve={r} produits={produits} permissions={permissions} />
              </div>
            </div>
            <ReleveDetails releve={r} />
            {r.consommations && r.consommations.length > 0 && (
              <div className="mt-0.5 flex flex-wrap gap-x-2 gap-y-0.5">
                {r.consommations.map((c) => (
                  <span key={c.id} className="text-xs text-muted-foreground">
                    <span className="font-medium">{c.produit.nom}</span>{" "}
                    {c.quantite}{" "}
                    {c.produit.unite.toLowerCase()}
                  </span>
                ))}
              </div>
            )}
            {r.notes && (
              <p className="text-xs italic text-muted-foreground">{r.notes}</p>
            )}
          </div>
          {/* Separator */}
          <div className="border-t border-border" />
        </div>
      ))}
    </div>
  );

  return (
    <section>
      <h2 className="mb-3 text-base font-semibold">
        Relevés ({releves.length})
      </h2>
      {isLimited ? (
        // Limited mode: no tabs, just show items + "Voir tout" link
        <>
          {displayReleves.length === 0 ? (
            <EmptyState
              icon={<FileText className="h-7 w-7" />}
              title="Aucun relevé"
              description="Les relevés apparaîtront ici au fur et à mesure du suivi."
            />
          ) : (
            releveItems(displayReleves)
          )}
          {hasMore && vagueId && (
            <Link
              href={`/vagues/${vagueId}/releves`}
              className="mt-2 flex items-center justify-center gap-1 rounded-md border border-border py-2 text-sm font-medium text-primary hover:bg-accent transition-colors"
            >
              Voir tout ({releves.length})
              <ChevronRight className="h-4 w-4" />
            </Link>
          )}
        </>
      ) : (
        // Full mode: tabbed UI
        <Tabs value={tab} onValueChange={setTab}>
          <div className="overflow-x-auto -mx-4 px-4">
            <TabsList className="w-max">
              <TabsTrigger value="tous">Tous</TabsTrigger>
              {Object.values(TypeReleve).map((t) =>
                typeCounts[t] > 0 ? (
                  <TabsTrigger key={t} value={t}>
                    {typeLabels[t]} ({typeCounts[t]})
                  </TabsTrigger>
                ) : null
              )}
            </TabsList>
          </div>
          <TabsContent value={tab}>
            {filtered.length === 0 ? (
              <EmptyState
                icon={<FileText className="h-7 w-7" />}
                title="Aucun relevé"
                description="Les relevés apparaîtront ici au fur et à mesure du suivi."
              />
            ) : (
              releveItems(filtered)
            )}
          </TabsContent>
        </Tabs>
      )}
    </section>
  );
}
