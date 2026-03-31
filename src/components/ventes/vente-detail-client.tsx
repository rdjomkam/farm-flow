"use client";

import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { queryKeys } from "@/lib/query-keys";
import { useTranslations } from "next-intl";
import { formatNumber } from "@/lib/format";
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
import { StatutFacture, Permission } from "@/types";
import { useVenteService } from "@/services";

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
  const t = useTranslations("ventes");
  const queryClient = useQueryClient();
  const venteService = useVenteService();

  const statutLabel = (s: string) =>
    t(`factures.statuts.${s}` as Parameters<typeof t>[0]) || s;

  async function handleCreateFacture() {
    const result = await venteService.createFacture(vente.id);
    if (result.ok) {
      queryClient.invalidateQueries({ queryKey: queryKeys.ventes.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.factures.all });
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Link
        href="/ventes"
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors w-fit"
      >
        <ArrowLeft className="h-4 w-4" />
        {t("ventes.detail.back")}
      </Link>

      {/* Header */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-lg">{vente.numero}</h2>
            {vente.facture ? (
              <Badge variant={statutVariants[vente.facture.statut] ?? "default"}>
                {statutLabel(vente.facture.statut)}
              </Badge>
            ) : (
              <Badge variant="default">{t("ventes.sansFature")}</Badge>
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
          <CardTitle className="text-sm">{t("ventes.detail.detailVente")}</CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <div className="flex flex-col gap-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("ventes.detail.poissons")}</span>
              <span>{vente.quantitePoissons}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("ventes.detail.poidsTotalKg")}</span>
              <span>{vente.poidsTotalKg} kg</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("ventes.detail.prixKg")}</span>
              <span>{formatNumber(vente.prixUnitaireKg)} F</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Total */}
      <div className="rounded-lg bg-muted/50 p-4 text-center">
        <p className="text-2xl font-bold">
          {formatNumber(vente.montantTotal)} FCFA
        </p>
        <p className="text-xs text-muted-foreground">{t("ventes.detail.montantTotal")}</p>
      </div>

      {/* Facture section */}
      {vente.facture ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">{t("ventes.detail.factureAssociee")}</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <Link
              href={`/factures/${vente.facture.id}`}
              className="flex items-center justify-between hover:bg-muted/50 -mx-2 px-2 py-2 rounded-lg transition-colors"
            >
              <div>
                <p className="font-semibold text-sm">{vente.facture.numero}</p>
                <p className="text-xs text-muted-foreground">
                  {t("ventes.detail.payeLabel", {
                    paye: formatNumber(vente.facture.montantPaye),
                    total: formatNumber(vente.facture.montantTotal),
                  })}
                </p>
              </div>
              <Badge variant={statutVariants[vente.facture.statut] ?? "default"}>
                {statutLabel(vente.facture.statut)}
              </Badge>
            </Link>
          </CardContent>
        </Card>
      ) : permissions.includes(Permission.VENTES_CREER) ? (
        <Button onClick={handleCreateFacture} className="w-full min-h-[48px]">
          <FileText className="h-4 w-4 mr-2" /> {t("ventes.detail.genererFacture")}
        </Button>
      ) : null}

      {/* Client info */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">{t("ventes.detail.client")}</CardTitle>
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
        {t("ventes.detail.creePar", { name: vente.user.name })}
      </p>
    </div>
  );
}
