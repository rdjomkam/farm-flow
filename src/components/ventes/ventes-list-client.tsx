"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { formatNumber } from "@/lib/format";
import { Plus, ShoppingCart, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { useVentesList } from "@/hooks/queries/use-ventes-queries";
import type { VenteWithRelations } from "@/types";

const statutVariants: Record<string, "default" | "info" | "en_cours" | "terminee" | "warning" | "annulee"> = {
  [StatutFacture.BROUILLON]: "default",
  [StatutFacture.ENVOYEE]: "info",
  [StatutFacture.PAYEE_PARTIELLEMENT]: "warning",
  [StatutFacture.PAYEE]: "terminee",
  [StatutFacture.ANNULEE]: "annulee",
};

interface Props {
  initialVentes: VenteWithRelations[];
  clients: { id: string; nom: string }[];
  vagues: { id: string; code: string }[];
  permissions: Permission[];
}

export function VentesListClient({ initialVentes, clients, vagues, permissions }: Props) {
  const t = useTranslations("ventes");
  const [filterClient, setFilterClient] = useState<string>("all");
  const [filterVague, setFilterVague] = useState<string>("all");

  const { data: ventes = initialVentes } = useVentesList(undefined, initialVentes);

  const filtered = ventes.filter((v) => {
    if (filterClient !== "all" && v.client.id !== filterClient) return false;
    if (filterVague !== "all" && v.vague.id !== filterVague) return false;
    return true;
  });

  const statutLabel = (s: string) =>
    t(`factures.statuts.${s}` as Parameters<typeof t>[0]) || s;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {t("ventes.count", { count: filtered.length })}
        </p>
        {permissions.includes(Permission.VENTES_CREER) && (
          <Link href="/ventes/nouvelle">
            <Button size="sm">
              <Plus className="h-4 w-4 mr-1" />
              {t("ventes.new")}
            </Button>
          </Link>
        )}
      </div>

      {/* Filters */}
      {(clients.length > 1 || vagues.length > 1) && (
        <div className="flex gap-2 items-center">
          <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
          <div className="flex-1">
            <Select value={filterClient} onValueChange={setFilterClient}>
              <SelectTrigger>
                <SelectValue placeholder={t("clients.title")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("ventes.filters.tousClients")}</SelectItem>
                {clients.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.nom}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1">
            <Select value={filterVague} onValueChange={setFilterVague}>
              <SelectTrigger>
                <SelectValue placeholder="Vague" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("ventes.filters.toutesVagues")}</SelectItem>
                {vagues.map((v) => (
                  <SelectItem key={v.id} value={v.id}>{v.code}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {filtered.length === 0 ? (
        <EmptyState
          icon={<ShoppingCart className="h-7 w-7" />}
          title={t("ventes.empty")}
          description={t("ventes.emptyDescription")}
        />
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map((v) => (
            <Link key={v.id} href={`/ventes/${v.id}`}>
              <Card className="hover:ring-1 hover:ring-primary/30 transition-all">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="min-w-0">
                      <p className="font-semibold">{v.numero}</p>
                      <p className="text-sm text-muted-foreground truncate">
                        {v.client.nom} — {v.vague.code}
                      </p>
                    </div>
                    {v.facture ? (
                      <Badge variant={statutVariants[v.facture.statut] ?? "default"}>
                        {statutLabel(v.facture.statut)}
                      </Badge>
                    ) : (
                      <Badge variant="default">{t("ventes.sansFature")}</Badge>
                    )}
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      {v.quantitePoissons} {t("ventes.detail.poissons")} — {v.poidsTotalKg} kg
                    </span>
                    <span className="font-semibold">
                      {formatNumber(v.montantTotal)} F
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {new Date(v.createdAt).toLocaleDateString("fr-FR")}
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
