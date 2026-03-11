"use client";

import { useState } from "react";
import Link from "next/link";
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

const statutLabels: Record<string, string> = {
  [StatutFacture.BROUILLON]: "Brouillon",
  [StatutFacture.ENVOYEE]: "Envoyee",
  [StatutFacture.PAYEE_PARTIELLEMENT]: "Partielle",
  [StatutFacture.PAYEE]: "Payee",
  [StatutFacture.ANNULEE]: "Annulee",
};

const statutVariants: Record<string, "default" | "info" | "en_cours" | "terminee" | "warning" | "annulee"> = {
  [StatutFacture.BROUILLON]: "default",
  [StatutFacture.ENVOYEE]: "info",
  [StatutFacture.PAYEE_PARTIELLEMENT]: "warning",
  [StatutFacture.PAYEE]: "terminee",
  [StatutFacture.ANNULEE]: "annulee",
};

interface VenteData {
  id: string;
  numero: string;
  quantitePoissons: number;
  poidsTotalKg: number;
  prixUnitaireKg: number;
  montantTotal: number;
  notes: string | null;
  createdAt: string;
  client: { id: string; nom: string };
  vague: { id: string; code: string };
  user: { id: string; name: string };
  facture: { id: string; numero: string; statut: string; montantPaye: number } | null;
}

interface Props {
  ventes: VenteData[];
  clients: { id: string; nom: string }[];
  vagues: { id: string; code: string }[];
  permissions: Permission[];
}

export function VentesListClient({ ventes, clients, vagues, permissions }: Props) {
  const [filterClient, setFilterClient] = useState<string>("all");
  const [filterVague, setFilterVague] = useState<string>("all");

  const filtered = ventes.filter((v) => {
    if (filterClient !== "all" && v.client.id !== filterClient) return false;
    if (filterVague !== "all" && v.vague.id !== filterVague) return false;
    return true;
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {filtered.length} vente{filtered.length > 1 ? "s" : ""}
        </p>
        {permissions.includes(Permission.VENTES_CREER) && (
          <Link href="/ventes/nouvelle">
            <Button size="sm">
              <Plus className="h-4 w-4 mr-1" />
              Nouvelle vente
            </Button>
          </Link>
        )}
      </div>

      {/* Filters */}
      {(clients.length > 1 || vagues.length > 1) && (
        <div className="flex gap-2 items-end">
          <Filter className="h-4 w-4 text-muted-foreground shrink-0 mb-2.5" />
          <div className="flex-1">
            <Select value={filterClient} onValueChange={setFilterClient}>
              <SelectTrigger>
                <SelectValue placeholder="Client" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les clients</SelectItem>
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
                <SelectItem value="all">Toutes les vagues</SelectItem>
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
          title="Aucune vente"
          description="Enregistrez une vente de poissons."
        />
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map((v) => (
            <Link key={v.id} href={`/ventes/${v.id}`}>
              <Card className="hover:border-primary/30 transition-colors">
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
                        {statutLabels[v.facture.statut] ?? v.facture.statut}
                      </Badge>
                    ) : (
                      <Badge variant="default">Sans facture</Badge>
                    )}
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      {v.quantitePoissons} poissons — {v.poidsTotalKg} kg
                    </span>
                    <span className="font-semibold">
                      {v.montantTotal.toLocaleString("fr-FR")} F
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
