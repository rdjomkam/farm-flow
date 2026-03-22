"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { FileText, Filter } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/ui/empty-state";
import { StatutFacture, Permission } from "@/types";
import { useFacturesList } from "@/hooks/queries/use-ventes-queries";
import type { FactureWithRelations } from "@/types";

const statutVariants: Record<StatutFacture, "default" | "info" | "warning" | "terminee" | "annulee"> = {
  [StatutFacture.BROUILLON]: "default",
  [StatutFacture.ENVOYEE]: "info",
  [StatutFacture.PAYEE_PARTIELLEMENT]: "warning",
  [StatutFacture.PAYEE]: "terminee",
  [StatutFacture.ANNULEE]: "annulee",
};

interface FactureData {
  id: string;
  numero: string;
  statut: string;
  dateEmission: string | Date;
  dateEcheance: string | Date | null;
  montantTotal: number;
  montantPaye: number;
  vente: {
    id: string;
    numero: string;
    montantTotal: number;
    client: { id: string; nom: string };
  };
  user: { id: string; name: string };
  _count: { paiements: number };
}

interface Props {
  initialFactures: FactureWithRelations[];
  permissions: Permission[];
}

export function FacturesListClient({ initialFactures, permissions: _permissions }: Props) {
  const t = useTranslations("ventes");
  const [filterStatut, setFilterStatut] = useState<string>("all");

  const { data: rawFactures = initialFactures } = useFacturesList(undefined, initialFactures);
  const factures = rawFactures as unknown as FactureData[];

  const filtered = factures.filter((f) => {
    if (filterStatut !== "all" && f.statut !== filterStatut) return false;
    return true;
  });

  const statutLabel = (s: string) =>
    t(`factures.statuts.${s}` as Parameters<typeof t>[0]) || s;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {t("factures.count", { count: filtered.length })}
        </p>
      </div>

      {/* Filter */}
      <div className="flex gap-2 items-end">
        <Filter className="h-4 w-4 text-muted-foreground shrink-0 mb-2.5" />
        <div className="flex-1">
          <Select value={filterStatut} onValueChange={setFilterStatut}>
            <SelectTrigger>
              <SelectValue placeholder={t("factures.filters.statut")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("factures.filters.tousStatuts")}</SelectItem>
              {Object.values(StatutFacture).map((value) => (
                <SelectItem key={value} value={value}>{statutLabel(value)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<FileText className="h-7 w-7" />}
          title={t("factures.empty")}
          description={t("factures.emptyDescription")}
        />
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map((f) => {
            const statut = f.statut as StatutFacture;
            const resteAPayer = f.montantTotal - f.montantPaye;
            return (
              <Link key={f.id} href={`/factures/${f.id}`}>
                <Card className="hover:border-primary/30 transition-colors">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="min-w-0">
                        <p className="font-semibold">{f.numero}</p>
                        <p className="text-sm text-muted-foreground truncate">
                          {f.vente.client.nom} — {f.vente.numero}
                        </p>
                      </div>
                      <Badge variant={statutVariants[statut]}>
                        {statutLabel(statut)}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">
                        {new Date(f.dateEmission).toLocaleDateString("fr-FR")}
                      </span>
                      <span className="font-semibold">
                        {f.montantTotal.toLocaleString("fr-FR")} F
                      </span>
                    </div>
                    {resteAPayer > 0 && statut !== StatutFacture.ANNULEE && (
                      <p className="text-xs text-accent-amber mt-1">
                        {t("factures.resteAPayer", { montant: resteAPayer.toLocaleString("fr-FR") })}
                      </p>
                    )}
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
