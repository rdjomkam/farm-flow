"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { queryKeys } from "@/lib/query-keys";
import { useTranslations, useLocale } from "next-intl";
import { formatNumber } from "@/lib/format";
import {
  ArrowLeft,
  Calendar,
  Users,
  CreditCard,
  Plus,
  Waves,
  RefreshCw,
  Trash2,
  MoreVertical,
  Download,
  Send,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import { StatutFacture, ModePaiement, Permission } from "@/types";
import { useVenteService, useExportService } from "@/services";

const statutVariants: Record<StatutFacture, "default" | "info" | "warning" | "terminee" | "annulee"> = {
  [StatutFacture.BROUILLON]: "default",
  [StatutFacture.ENVOYEE]: "info",
  [StatutFacture.PAYEE_PARTIELLEMENT]: "warning",
  [StatutFacture.PAYEE]: "terminee",
  [StatutFacture.ANNULEE]: "annulee",
};

interface PaiementData {
  id: string;
  montant: number;
  mode: string;
  reference: string | null;
  date: string;
  user: { id: string; name: string };
}

interface FactureData {
  id: string;
  numero: string;
  statut: string;
  dateEmission: string;
  dateEcheance: string | null;
  montantTotal: number;
  montantPaye: number;
  notes: string | null;
  vente: {
    id: string;
    numero: string;
    quantitePoissons: number;
    poidsTotalKg: number;
    prixUnitaireKg: number;
    montantTotal: number;
    client: {
      id: string;
      nom: string;
      telephone: string | null;
      email: string | null;
    };
    vague: { id: string; code: string };
  };
  user: { id: string; name: string };
  paiements: PaiementData[];
}

interface Props {
  facture: FactureData;
  permissions: Permission[];
}

export function FactureDetailClient({ facture, permissions }: Props) {
  const t = useTranslations("ventes");
  const locale = useLocale();
  const queryClient = useQueryClient();
  const router = useRouter();
  const venteService = useVenteService();
  const [paiementOpen, setPaiementOpen] = useState(false);
  const [deletePaiementId, setDeletePaiementId] = useState<string | null>(null);

  const [montant, setMontant] = useState("");
  const [mode, setMode] = useState("");
  const [reference, setReference] = useState("");

  const statut = facture.statut as StatutFacture;
  const resteAPayer = facture.montantTotal - facture.montantPaye;
  const canAddPaiement = statut !== StatutFacture.ANNULEE;

  const statutLabel = (s: string) =>
    t(`factures.statuts.${s}` as Parameters<typeof t>[0]) || s;
  const modeLabel = (m: string) =>
    t(`paiements.modes.${m}` as Parameters<typeof t>[0]) || m;

  function resetPaiementForm() {
    setMontant("");
    setMode("");
    setReference("");
  }

  async function handlePaiement() {
    if (!montant || !mode) return;

    const result = await venteService.addPaiement(facture.id, {
      montant: parseFloat(montant),
      mode: mode as import("@/types").ModePaiement,
      ...(reference.trim() && { reference: reference.trim() }),
    });
    if (result.ok) {
      setPaiementOpen(false);
      resetPaiementForm();
      await queryClient.invalidateQueries({ queryKey: queryKeys.factures.all });
      await queryClient.invalidateQueries({ queryKey: queryKeys.ventes.all });
      router.refresh();
    }
  }

  async function handleEnvoyer() {
    const result = await venteService.updateFacture(facture.id, { statut: StatutFacture.ENVOYEE });
    if (result.ok) {
      await queryClient.invalidateQueries({ queryKey: queryKeys.factures.all });
      await queryClient.invalidateQueries({ queryKey: queryKeys.ventes.all });
      router.refresh();
    }
  }

  async function handleRegenerer() {
    const result = await venteService.regenererFacture(facture.id);
    if (result.ok) {
      await queryClient.invalidateQueries({ queryKey: queryKeys.factures.all });
      await queryClient.invalidateQueries({ queryKey: queryKeys.ventes.all });
      router.refresh();
    }
  }

  async function handleConfirmDeletePaiement() {
    if (!deletePaiementId) return;
    const result = await venteService.deletePaiement(facture.id, deletePaiementId);
    if (result.ok) {
      setDeletePaiementId(null);
      await queryClient.invalidateQueries({ queryKey: queryKeys.factures.all });
      await queryClient.invalidateQueries({ queryKey: queryKeys.ventes.all });
      router.refresh();
    }
  }

  const canDeletePaiement =
    statut !== StatutFacture.ANNULEE &&
    permissions.includes(Permission.PAIEMENTS_SUPPRIMER);

  const montantDesync = facture.montantTotal !== facture.vente.montantTotal;
  const exportService = useExportService();

  const canManage = permissions.includes(Permission.FACTURES_GERER) && statut !== StatutFacture.ANNULEE;
  const canExport = permissions.includes(Permission.EXPORT_DONNEES);
  const canSend = statut === StatutFacture.BROUILLON && permissions.includes(Permission.FACTURES_GERER);
  const canPay = canAddPaiement && permissions.includes(Permission.PAIEMENTS_CREER);
  const hasMenuItems = canExport || canManage || canSend || canPay;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <Link
          href="/factures"
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors w-fit"
        >
          <ArrowLeft className="h-4 w-4" />
          {t("factures.detail.back")}
        </Link>
        {hasMenuItems && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-9 w-9 p-0">
                <MoreVertical className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {canPay && (
                <DropdownMenuItem onSelect={() => setPaiementOpen(true)}>
                  <Plus className="h-4 w-4" />
                  {t("paiements.add")}
                </DropdownMenuItem>
              )}
              {canSend && (
                <DropdownMenuItem onSelect={handleEnvoyer}>
                  <Send className="h-4 w-4" />
                  {t("factures.detail.envoyer")}
                </DropdownMenuItem>
              )}
              {canManage && (
                <DropdownMenuItem onSelect={handleRegenerer}>
                  <RefreshCw className="h-4 w-4" />
                  {t("factures.detail.regenerer")}
                </DropdownMenuItem>
              )}
              {canExport && (canPay || canSend || canManage) && <DropdownMenuSeparator />}
              {canExport && (
                <DropdownMenuItem
                  onSelect={(e) => {
                    e.preventDefault();
                    exportService.facturePdf(facture.id, facture.numero);
                  }}
                >
                  <Download className="h-4 w-4" />
                  PDF
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Header */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-lg">{facture.numero}</h2>
            <Badge variant={statutVariants[statut]}>
              {statutLabel(statut)}
            </Badge>
          </div>

          <div className="flex flex-col gap-2 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Users className="h-4 w-4 shrink-0" />
              <span>{facture.vente.client.nom}</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Waves className="h-4 w-4 shrink-0" />
              <span>{facture.vente.vague.code} — {facture.vente.numero}</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Calendar className="h-4 w-4 shrink-0" />
              <span>
                {t("factures.detail.emission", {
                  date: new Date(facture.dateEmission).toLocaleDateString(locale),
                })}
              </span>
            </div>
            {facture.dateEcheance && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Calendar className="h-4 w-4 shrink-0" />
                <span>
                  {t("factures.detail.echeance", {
                    date: new Date(facture.dateEcheance).toLocaleDateString(locale),
                  })}
                </span>
              </div>
            )}
          </div>

          {/* Amounts */}
          <div className="grid grid-cols-2 gap-2 mt-3">
            <div className="rounded-lg bg-muted/50 p-3 text-center">
              <p className="text-lg font-bold">
                {formatNumber(facture.montantTotal)} F
              </p>
              <p className="text-xs text-muted-foreground">{t("factures.detail.total")}</p>
            </div>
            <div className="rounded-lg bg-muted/50 p-3 text-center">
              <p className="text-lg font-bold">
                {formatNumber(facture.montantPaye)} F
              </p>
              <p className="text-xs text-muted-foreground">{t("factures.detail.paye")}</p>
            </div>
          </div>

          {resteAPayer > 0 && statut !== StatutFacture.ANNULEE && (
            <div className="rounded-lg bg-accent-amber-muted border border-accent-amber/30 p-3 text-center mt-2">
              <p className="text-lg font-bold text-accent-amber">
                {formatNumber(resteAPayer)} F
              </p>
              <p className="text-xs text-accent-amber">{t("factures.detail.resteAPayer")}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Desync warning */}
      {montantDesync && permissions.includes(Permission.FACTURES_GERER) && statut !== StatutFacture.ANNULEE && (
        <div className="rounded-lg border border-orange-300 bg-orange-50 p-3 flex items-center justify-between gap-2">
          <p className="text-sm text-orange-800">
            {t("factures.detail.montantDesync", {
              factureTotal: formatNumber(facture.montantTotal),
              venteTotal: formatNumber(facture.vente.montantTotal),
            })}
          </p>
          <Button variant="outline" size="sm" onClick={handleRegenerer} className="shrink-0">
            <RefreshCw className="h-4 w-4 mr-1" />
            {t("factures.detail.regenerer")}
          </Button>
        </div>
      )}

      {/* Payment dialog */}
      <Dialog
        open={paiementOpen}
        onOpenChange={(open) => {
          setPaiementOpen(open);
          if (!open) resetPaiementForm();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("paiements.register")}</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <div className="flex flex-col gap-4 py-2">
              <Input
                label={t("paiements.fields.montant", { max: formatNumber(resteAPayer) })}
                type="number"
                min="1"
                max={resteAPayer}
                placeholder={t("paiements.fields.montantPlaceholder")}
                value={montant}
                onChange={(e) => setMontant(e.target.value)}
                autoFocus
              />
              <Select value={mode} onValueChange={setMode}>
                <SelectTrigger label={t("paiements.fields.mode")}>
                  <SelectValue placeholder={t("paiements.fields.modePlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {Object.values(ModePaiement).map((value) => (
                    <SelectItem key={value} value={value}>{modeLabel(value)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                label={t("paiements.fields.reference")}
                placeholder={t("paiements.fields.referencePlaceholder")}
                value={reference}
                onChange={(e) => setReference(e.target.value)}
              />
            </div>
          </DialogBody>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">{t("paiements.cancel")}</Button>
            </DialogClose>
            <Button
              onClick={handlePaiement}
              disabled={!montant || !mode}
            >
              {t("paiements.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete payment confirmation dialog */}
      <Dialog
        open={deletePaiementId !== null}
        onOpenChange={(open) => { if (!open) setDeletePaiementId(null); }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-destructive">
              {t("paiements.deleteTitle")}
            </DialogTitle>
            <DialogDescription>
              {t("paiements.deleteDescription", {
                montant: formatNumber(
                  facture.paiements.find((p) => p.id === deletePaiementId)?.montant ?? 0
                ),
              })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">{t("paiements.cancel")}</Button>
            </DialogClose>
            <Button variant="danger" onClick={handleConfirmDeletePaiement}>
              {t("paiements.deleteConfirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Sale details */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">{t("factures.detail.detailVente")}</CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <div className="flex flex-col gap-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("factures.detail.poissons")}</span>
              <span>{facture.vente.quantitePoissons}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("factures.detail.poidsTotalKg")}</span>
              <span>{facture.vente.poidsTotalKg} kg</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("factures.detail.prixKg")}</span>
              <span>{formatNumber(facture.vente.prixUnitaireKg)} F</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Payments */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">
            {t("factures.detail.paiements", { count: facture.paiements.length })}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {facture.paiements.length === 0 ? (
            <p className="text-sm text-muted-foreground px-4 pb-4">
              {t("factures.detail.aucunPaiement")}
            </p>
          ) : (
            <div className="divide-y divide-border">
              {facture.paiements.map((p) => (
                <div key={p.id} className="flex items-center justify-between px-4 py-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <CreditCard className="h-4 w-4 text-accent-green shrink-0" />
                      <span className="text-sm font-medium">
                        {modeLabel(p.mode)}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {new Date(p.date).toLocaleDateString(locale)}
                      {p.reference && ` — ${p.reference}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <p className="text-sm font-semibold">
                      {formatNumber(p.montant)} F
                    </p>
                    {canDeletePaiement && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                        onClick={() => setDeletePaiementId(p.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {facture.notes && (
        <p className="text-sm text-muted-foreground italic">{facture.notes}</p>
      )}

      <p className="text-xs text-muted-foreground text-center mb-2">
        {t("factures.detail.creePar", { name: facture.user.name })}
      </p>
    </div>
  );
}
