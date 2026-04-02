"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  ArrowLeft,
  Calendar,
  CreditCard,
  FileText,
  Upload,
  ExternalLink,
  Trash2,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import { CategorieDepense, ModePaiement, StatutDepense } from "@/types";
import { useDepenseService } from "@/services";
import { useToast } from "@/components/ui/toast";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

const statutVariants: Record<
  StatutDepense,
  "default" | "warning" | "info" | "en_cours"
> = {
  [StatutDepense.NON_PAYEE]: "warning",
  [StatutDepense.PAYEE_PARTIELLEMENT]: "info",
  [StatutDepense.PAYEE]: "en_cours",
};

interface PaiementDepenseData {
  id: string;
  montant: number;
  mode: string;
  reference: string | null;
  date: string;
  user: { id: string; name: string };
}

interface DepenseData {
  id: string;
  numero: string;
  description: string;
  categorieDepense: string;
  montantTotal: number;
  montantPaye: number;
  statut: string;
  date: string;
  dateEcheance: string | null;
  factureUrl: string | null;
  notes: string | null;
  commandeId: string | null;
  vagueId: string | null;
  listeBesoinsId?: string | null;
  commande: { id: string; numero: string; statut: string } | null;
  vague: { id: string; code: string } | null;
  listeBesoins?: { id: string; numero: string; titre: string } | null;
  user: { id: string; name: string };
  paiements: PaiementDepenseData[];
}

interface Props {
  depense: DepenseData;
  canManage: boolean;
  canPay: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatMontant(montant: number): string {
  return new Intl.NumberFormat("fr-FR").format(Math.round(montant)) + " FCFA";
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DepenseDetailClient({ depense, canManage, canPay }: Props) {
  const t = useTranslations("depenses");
  const depenseService = useDepenseService();
  const { toast } = useToast();

  const [currentDepense, setCurrentDepense] = useState(depense);
  const [paiements, setPaiements] = useState<PaiementDepenseData[]>(
    depense.paiements
  );

  // Paiement form state
  const [paiementOpen, setPaiementOpen] = useState(false);
  const [paiementMontant, setPaiementMontant] = useState("");
  const [paiementMode, setPaiementMode] = useState<ModePaiement>(
    ModePaiement.ESPECES
  );
  const [paiementRef, setPaiementRef] = useState("");
  const [paiementPending, setPaiementPending] = useState(false);

  // Upload facture state
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);

  // Delete facture
  const [deleteFactureOpen, setDeleteFactureOpen] = useState(false);

  const statut = currentDepense.statut as StatutDepense;
  const categorie = currentDepense.categorieDepense as CategorieDepense;
  const resteAPayer = currentDepense.montantTotal - currentDepense.montantPaye;
  const pctPaye =
    currentDepense.montantTotal > 0
      ? Math.min(
          100,
          Math.round(
            (currentDepense.montantPaye / currentDepense.montantTotal) * 100
          )
        )
      : 0;

  const canAddPaiement = canPay && statut !== StatutDepense.PAYEE;

  // -------------------------------------------------------------------------
  // Handlers
  // -------------------------------------------------------------------------

  async function handlePaiement() {
    const montant = parseFloat(paiementMontant);
    if (isNaN(montant) || montant <= 0) {
      toast({ title: "Montant invalide", variant: "error" });
      return;
    }
    if (montant > resteAPayer) {
      toast({
        title: "Le montant dépasse le reste à payer",
        variant: "error",
      });
      return;
    }

    setPaiementPending(true);
    try {
      const result = await depenseService.addPaiementDepense(currentDepense.id, {
        montant,
        mode: paiementMode,
        reference: paiementRef.trim() || undefined,
      });
      if (result.ok && result.data) {
        setPaiements((prev) => [
          result.data!.paiement as unknown as PaiementDepenseData,
          ...prev,
        ]);
        setCurrentDepense((prev) => ({
          ...prev,
          montantPaye: result.data!.montantPaye,
          statut: result.data!.statut,
        }));
        setPaiementOpen(false);
        setPaiementMontant("");
        setPaiementRef("");
      }
    } finally {
      setPaiementPending(false);
    }
  }

  async function handleUploadFacture() {
    if (!uploadFile) return;
    const result = await depenseService.uploadFactureDepense(
      currentDepense.id,
      uploadFile
    );
    if (result.ok) {
      setCurrentDepense((prev) => ({
        ...prev,
        factureUrl: "uploaded",
      }));
      setUploadOpen(false);
      setUploadFile(null);
    }
  }

  async function handleVoirFacture() {
    const result = await depenseService.getFactureDepenseUrl(currentDepense.id);
    if (result.ok && result.data) {
      window.open(result.data.url, "_blank");
    }
  }

  async function handleDeleteFacture() {
    const result = await depenseService.deleteFactureDepense(currentDepense.id);
    if (result.ok) {
      setCurrentDepense((prev) => ({ ...prev, factureUrl: null }));
      setDeleteFactureOpen(false);
    }
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Back link */}
      <Link
        href="/depenses"
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        {t("detail.retour")}
      </Link>

      {/* Info card */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <CardTitle className="text-base">
                {currentDepense.numero}
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-0.5">
                {currentDepense.description}
              </p>
            </div>
            <Badge variant={statutVariants[statut]}>
              {t(`statuts.${statut}`)}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {/* Categorie */}
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              {t("detail.categorie")}
            </span>
            <Badge variant="default">{t(`categories.${categorie}`)}</Badge>
          </div>

          {/* Date */}
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" />
              {t("detail.date")}
            </span>
            <span>{formatDate(currentDepense.date)}</span>
          </div>

          {/* Echeance */}
          {currentDepense.dateEcheance && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" />
                {t("detail.echeance")}
              </span>
              <span>{formatDate(currentDepense.dateEcheance)}</span>
            </div>
          )}

          {/* Commande */}
          {currentDepense.commande && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {t("detail.commande")}
              </span>
              <Link
                href={`/stock/commandes/${currentDepense.commande.id}`}
                className="text-primary hover:underline flex items-center gap-1"
              >
                {currentDepense.commande.numero}
                <ExternalLink className="h-3.5 w-3.5" />
              </Link>
            </div>
          )}

          {/* Vague */}
          {currentDepense.vague && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{t("detail.vague")}</span>
              <Link
                href={`/vagues/${currentDepense.vague.id}`}
                className="text-primary hover:underline flex items-center gap-1"
              >
                {currentDepense.vague.code}
                <ExternalLink className="h-3.5 w-3.5" />
              </Link>
            </div>
          )}

          {/* Liste de besoins */}
          {currentDepense.listeBesoins && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                Liste de besoins
              </span>
              <Link
                href={`/besoins/${currentDepense.listeBesoins.id}`}
                className="text-primary hover:underline flex items-center gap-1"
              >
                {currentDepense.listeBesoins.numero}
                <ExternalLink className="h-3.5 w-3.5" />
              </Link>
            </div>
          )}

          {/* Notes */}
          {currentDepense.notes && (
            <div className="text-sm">
              <span className="text-muted-foreground block mb-1">
                {t("detail.notes")}
              </span>
              <p className="text-sm bg-muted/50 rounded p-2">
                {currentDepense.notes}
              </p>
            </div>
          )}

          {/* Separateur */}
          <div className="border-t" />

          {/* Montants */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {t("detail.montantTotal")}
              </span>
              <span className="font-semibold">
                {formatMontant(currentDepense.montantTotal)}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {t("detail.dejaPaye")}
              </span>
              <span className="font-semibold text-primary">
                {formatMontant(currentDepense.montantPaye)}
              </span>
            </div>
            {statut !== StatutDepense.PAYEE && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {t("detail.resteAPayer")}
                </span>
                <span className="font-semibold text-warning">
                  {formatMontant(resteAPayer)}
                </span>
              </div>
            )}
          </div>

          {/* Barre de progression */}
          {statut !== StatutDepense.NON_PAYEE && (
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${pctPaye}%` }}
                />
              </div>
              <span className="text-xs text-muted-foreground shrink-0">
                {pctPaye}%
              </span>
            </div>
          )}

          {/* CTA paiement */}
          {canAddPaiement && (
            <Dialog open={paiementOpen} onOpenChange={setPaiementOpen}>
              <DialogTrigger asChild>
                <Button className="w-full gap-2">
                  <Plus className="h-4 w-4" />
                  {t("detail.ajouterPaiement")}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{t("detail.paiementTitle")}</DialogTitle>
                </DialogHeader>
                <div className="flex flex-col gap-4 py-2">
                  <div className="flex flex-col gap-1.5">
                    <label
                      htmlFor="paiement-montant"
                      className="text-sm font-medium"
                    >
                      {t("detail.montantLabel")}
                    </label>
                    <Input
                      id="paiement-montant"
                      type="number"
                      min={1}
                      max={resteAPayer}
                      value={paiementMontant}
                      onChange={(e) => setPaiementMontant(e.target.value)}
                      placeholder={t("detail.montantMax", {
                        max: formatMontant(resteAPayer),
                      })}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label
                      htmlFor="paiement-mode"
                      className="text-sm font-medium"
                    >
                      {t("detail.modeLabel")}
                    </label>
                    <Select
                      value={paiementMode}
                      onValueChange={(v) => setPaiementMode(v as ModePaiement)}
                    >
                      <SelectTrigger id="paiement-mode">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.values(ModePaiement).map((mode) => (
                          <SelectItem key={mode} value={mode}>
                            {t(`modes.${mode}`)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label
                      htmlFor="paiement-ref"
                      className="text-sm font-medium"
                    >
                      {t("detail.referenceLabel")}
                    </label>
                    <Input
                      id="paiement-ref"
                      value={paiementRef}
                      onChange={(e) => setPaiementRef(e.target.value)}
                      placeholder={t("detail.referencePlaceholder")}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button variant="outline">{t("detail.annuler")}</Button>
                  </DialogClose>
                  <Button
                    onClick={handlePaiement}
                    disabled={
                      paiementPending ||
                      !paiementMontant ||
                      parseFloat(paiementMontant) <= 0 ||
                      parseFloat(paiementMontant) > resteAPayer
                    }
                  >
                    {paiementPending
                      ? t("detail.enCours")
                      : t("detail.confirmer")}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </CardContent>
      </Card>

      {/* Facture fournisseur */}
      {canManage && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <FileText className="h-4 w-4" />
              {t("detail.factureFournisseur")}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {currentDepense.factureUrl ? (
              <div className="flex flex-col gap-2">
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 gap-1.5"
                    onClick={handleVoirFacture}
                  >
                    <ExternalLink className="h-4 w-4" />
                    {t("detail.voirFacture")}
                  </Button>
                  <Dialog
                    open={deleteFactureOpen}
                    onOpenChange={setDeleteFactureOpen}
                  >
                    <DialogTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5 text-danger border-danger/30 hover:bg-danger/5"
                      >
                        <Trash2 className="h-4 w-4" />
                        {t("detail.supprimer")}
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>
                          {t("detail.supprimerTitle")}
                        </DialogTitle>
                      </DialogHeader>
                      <p className="text-sm text-muted-foreground">
                        {t("detail.supprimerFactureDescription")}
                      </p>
                      <DialogFooter>
                        <DialogClose asChild>
                          <Button variant="outline">
                            {t("detail.annuler")}
                          </Button>
                        </DialogClose>
                        <Button variant="danger" onClick={handleDeleteFacture}>
                          {t("detail.supprimer")}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
            ) : (
              <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-1.5">
                    <Upload className="h-4 w-4" />
                    {t("detail.joindreFacture")}
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{t("detail.uploadLabel")}</DialogTitle>
                  </DialogHeader>
                  <div className="flex flex-col gap-3 py-2">
                    <p className="text-sm text-muted-foreground">
                      {t("detail.uploadHint")}
                    </p>
                    <Input
                      type="file"
                      accept="application/pdf,image/jpeg,image/png"
                      onChange={(e) =>
                        setUploadFile(e.target.files?.[0] ?? null)
                      }
                    />
                  </div>
                  <DialogFooter>
                    <DialogClose asChild>
                      <Button variant="outline">{t("detail.annuler")}</Button>
                    </DialogClose>
                    <Button onClick={handleUploadFacture} disabled={!uploadFile}>
                      {t("detail.envoyer")}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </CardContent>
        </Card>
      )}

      {/* Historique des paiements */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <CreditCard className="h-4 w-4" />
            {t("detail.historiqueTitle", { count: paiements.length })}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {paiements.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              {t("detail.aucunPaiement")}
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {paiements.map((p) => (
                <div
                  key={p.id}
                  className="flex items-start justify-between gap-2 text-sm border-b last:border-b-0 pb-3 last:pb-0"
                >
                  <div className="flex flex-col gap-0.5">
                    <span className="font-semibold">
                      {formatMontant(p.montant)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {t(`modes.${p.mode as ModePaiement}`)} •{" "}
                      {p.user.name}
                    </span>
                    {p.reference && (
                      <span className="text-xs text-muted-foreground">
                        {t("detail.reference")} {p.reference}
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {formatDate(p.date)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
