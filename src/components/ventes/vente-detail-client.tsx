"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Users,
  Waves,
  Calendar,
  FileText,
  ShoppingCart,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { StatutFacture, Permission } from "@/types";

const statutLabels: Record<string, string> = {
  [StatutFacture.BROUILLON]: "Brouillon",
  [StatutFacture.ENVOYEE]: "Envoyee",
  [StatutFacture.PAYEE_PARTIELLEMENT]: "Partielle",
  [StatutFacture.PAYEE]: "Payee",
  [StatutFacture.ANNULEE]: "Annulee",
};

const statutVariants: Record<string, "default" | "info" | "warning" | "terminee" | "annulee"> = {
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
  client: {
    id: string;
    nom: string;
    telephone: string | null;
    email: string | null;
    adresse: string | null;
  };
  vague: { id: string; code: string; statut: string };
  user: { id: string; name: string };
  facture: {
    id: string;
    numero: string;
    statut: string;
    montantPaye: number;
    montantTotal: number;
    paiements: { id: string; montant: number; mode: string; date: string }[];
  } | null;
}

interface Props {
  vente: VenteData;
  permissions: Permission[];
}

export function VenteDetailClient({ vente, permissions }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  async function handleCreateFacture() {
    setLoading(true);
    try {
      const res = await fetch("/api/factures", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ venteId: vente.id }),
      });

      if (res.ok) {
        const data = await res.json();
        toast({ title: `Facture ${data.numero} creee`, variant: "success" });
        router.refresh();
      } else {
        const data = await res.json();
        toast({ title: data.message || "Erreur", variant: "error" });
      }
    } catch {
      toast({ title: "Erreur reseau", variant: "error" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Link
        href="/ventes"
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors w-fit"
      >
        <ArrowLeft className="h-4 w-4" />
        Ventes
      </Link>

      {/* Header */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-lg">{vente.numero}</h2>
            {vente.facture ? (
              <Badge variant={statutVariants[vente.facture.statut] ?? "default"}>
                {statutLabels[vente.facture.statut] ?? vente.facture.statut}
              </Badge>
            ) : (
              <Badge variant="default">Sans facture</Badge>
            )}
          </div>

          <div className="flex flex-col gap-2 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Users className="h-4 w-4 shrink-0" />
              <span>{vente.client.nom}</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Waves className="h-4 w-4 shrink-0" />
              <span>{vente.vague.code}</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Calendar className="h-4 w-4 shrink-0" />
              <span>
                {new Date(vente.createdAt).toLocaleDateString("fr-FR")}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Details */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Detail de la vente</CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <div className="flex flex-col gap-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Poissons</span>
              <span>{vente.quantitePoissons}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Poids total</span>
              <span>{vente.poidsTotalKg} kg</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Prix/kg</span>
              <span>{vente.prixUnitaireKg.toLocaleString("fr-FR")} F</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Total */}
      <div className="rounded-lg bg-muted/50 p-4 text-center">
        <p className="text-2xl font-bold">
          {vente.montantTotal.toLocaleString("fr-FR")} FCFA
        </p>
        <p className="text-xs text-muted-foreground">Montant total</p>
      </div>

      {/* Facture section */}
      {vente.facture ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Facture associee</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <Link
              href={`/factures/${vente.facture.id}`}
              className="flex items-center justify-between hover:bg-muted/50 -mx-2 px-2 py-2 rounded-lg transition-colors"
            >
              <div>
                <p className="font-semibold text-sm">{vente.facture.numero}</p>
                <p className="text-xs text-muted-foreground">
                  Paye : {vente.facture.montantPaye.toLocaleString("fr-FR")} / {vente.facture.montantTotal.toLocaleString("fr-FR")} F
                </p>
              </div>
              <Badge variant={statutVariants[vente.facture.statut] ?? "default"}>
                {statutLabels[vente.facture.statut] ?? vente.facture.statut}
              </Badge>
            </Link>
          </CardContent>
        </Card>
      ) : permissions.includes(Permission.VENTES_CREER) ? (
        <Button onClick={handleCreateFacture} disabled={loading} className="w-full min-h-[48px]">
          <FileText className="h-4 w-4 mr-2" />
          {loading ? "Creation..." : "Generer la facture"}
        </Button>
      ) : null}

      {/* Client info */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Client</CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <div className="flex flex-col gap-1 text-sm">
            <p className="font-medium">{vente.client.nom}</p>
            {vente.client.telephone && (
              <p className="text-muted-foreground">{vente.client.telephone}</p>
            )}
            {vente.client.email && (
              <p className="text-muted-foreground">{vente.client.email}</p>
            )}
            {vente.client.adresse && (
              <p className="text-muted-foreground">{vente.client.adresse}</p>
            )}
          </div>
        </CardContent>
      </Card>

      {vente.notes && (
        <p className="text-sm text-muted-foreground italic">{vente.notes}</p>
      )}

      <p className="text-xs text-muted-foreground text-center">
        Cree par {vente.user.name}
      </p>
    </div>
  );
}
