"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
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
import { useToast } from "@/components/ui/toast";
import { CategorieDepense, ModePaiement, StatutDepense } from "@/types";

// ---------------------------------------------------------------------------
// Labels
// ---------------------------------------------------------------------------

const statutLabels: Record<StatutDepense, string> = {
  [StatutDepense.NON_PAYEE]: "Non payee",
  [StatutDepense.PAYEE_PARTIELLEMENT]: "Partiellement payee",
  [StatutDepense.PAYEE]: "Payee",
};

const statutVariants: Record<
  StatutDepense,
  "default" | "warning" | "info" | "en_cours"
> = {
  [StatutDepense.NON_PAYEE]: "warning",
  [StatutDepense.PAYEE_PARTIELLEMENT]: "info",
  [StatutDepense.PAYEE]: "en_cours",
};

const categorieLabels: Record<CategorieDepense, string> = {
  [CategorieDepense.ALIMENT]: "Aliment",
  [CategorieDepense.INTRANT]: "Intrant",
  [CategorieDepense.EQUIPEMENT]: "Equipement",
  [CategorieDepense.ELECTRICITE]: "Electricite",
  [CategorieDepense.EAU]: "Eau",
  [CategorieDepense.LOYER]: "Loyer",
  [CategorieDepense.SALAIRE]: "Salaire",
  [CategorieDepense.TRANSPORT]: "Transport",
  [CategorieDepense.VETERINAIRE]: "Veterinaire",
  [CategorieDepense.REPARATION]: "Reparation",
  [CategorieDepense.INVESTISSEMENT]: "Investissement",
  [CategorieDepense.AUTRE]: "Autre",
};

const modeLabels: Record<ModePaiement, string> = {
  [ModePaiement.ESPECES]: "Especes",
  [ModePaiement.MOBILE_MONEY]: "Mobile Money",
  [ModePaiement.VIREMENT]: "Virement",
  [ModePaiement.CHEQUE]: "Cheque",
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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
  commande: { id: string; numero: string; statut: string } | null;
  vague: { id: string; code: string } | null;
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
  const router = useRouter();
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
  const [paiementLoading, setPaiementLoading] = useState(false);

  // Upload facture state
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadLoading, setUploadLoading] = useState(false);

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

  const canAddPaiement =
    canPay &&
    statut !== StatutDepense.PAYEE;

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
        title: `Montant trop eleve. Reste a payer : ${formatMontant(resteAPayer)}`,
        variant: "error",
      });
      return;
    }

    setPaiementLoading(true);
    try {
      const res = await fetch(`/api/depenses/${currentDepense.id}/paiements`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          montant,
          mode: paiementMode,
          reference: paiementRef.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message ?? "Erreur");
      }

      const result = await res.json();
      setPaiements((prev) => [result.paiement, ...prev]);
      setCurrentDepense((prev) => ({
        ...prev,
        montantPaye: result.montantPaye,
        statut: result.statut,
      }));
      setPaiementOpen(false);
      setPaiementMontant("");
      setPaiementRef("");
      toast({ title: "Paiement enregistre avec succes" });
    } catch (err) {
      toast({
        title: err instanceof Error ? err.message : "Erreur",
        variant: "error",
      });
    } finally {
      setPaiementLoading(false);
    }
  }

  async function handleUploadFacture() {
    if (!uploadFile) return;
    setUploadLoading(true);
    try {
      const formData = new FormData();
      formData.append("file", uploadFile);

      const res = await fetch(`/api/depenses/${currentDepense.id}/upload`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message ?? "Erreur");
      }

      setCurrentDepense((prev) => ({
        ...prev,
        factureUrl: "uploaded", // placeholder — actual key stored in DB
      }));
      setUploadOpen(false);
      setUploadFile(null);
      toast({ title: "Facture uploadee avec succes" });
    } catch (err) {
      toast({
        title: err instanceof Error ? err.message : "Erreur upload",
        variant: "error",
      });
    } finally {
      setUploadLoading(false);
    }
  }

  async function handleVoirFacture() {
    try {
      const res = await fetch(`/api/depenses/${currentDepense.id}/upload`);
      if (!res.ok) throw new Error("Impossible de recuperer la facture");
      const { url } = await res.json();
      window.open(url, "_blank");
    } catch (err) {
      toast({
        title: err instanceof Error ? err.message : "Erreur",
        variant: "error",
      });
    }
  }

  async function handleDeleteFacture() {
    try {
      const res = await fetch(`/api/depenses/${currentDepense.id}/upload`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Erreur lors de la suppression");
      setCurrentDepense((prev) => ({ ...prev, factureUrl: null }));
      setDeleteFactureOpen(false);
      toast({ title: "Facture supprimee" });
    } catch (err) {
      toast({
        title: err instanceof Error ? err.message : "Erreur",
        variant: "error",
      });
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
        Retour aux depenses
      </Link>

      {/* Info card */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <CardTitle className="text-base">{currentDepense.numero}</CardTitle>
              <p className="text-sm text-muted-foreground mt-0.5">
                {currentDepense.description}
              </p>
            </div>
            <Badge variant={statutVariants[statut]}>
              {statutLabels[statut]}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {/* Categorie */}
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Categorie</span>
            <Badge variant="default">
              {categorieLabels[categorie]}
            </Badge>
          </div>

          {/* Date */}
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" />
              Date
            </span>
            <span>{formatDate(currentDepense.date)}</span>
          </div>

          {/* Echeance */}
          {currentDepense.dateEcheance && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" />
                Echeance
              </span>
              <span>{formatDate(currentDepense.dateEcheance)}</span>
            </div>
          )}

          {/* Commande */}
          {currentDepense.commande && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Commande</span>
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
              <span className="text-muted-foreground">Vague</span>
              <Link
                href={`/vagues/${currentDepense.vague.id}`}
                className="text-primary hover:underline flex items-center gap-1"
              >
                {currentDepense.vague.code}
                <ExternalLink className="h-3.5 w-3.5" />
              </Link>
            </div>
          )}

          {/* Notes */}
          {currentDepense.notes && (
            <div className="text-sm">
              <span className="text-muted-foreground block mb-1">Notes</span>
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
              <span className="text-muted-foreground">Montant total</span>
              <span className="font-semibold">
                {formatMontant(currentDepense.montantTotal)}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Deja paye</span>
              <span className="font-semibold text-primary">
                {formatMontant(currentDepense.montantPaye)}
              </span>
            </div>
            {statut !== StatutDepense.PAYEE && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Reste a payer</span>
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
                  Ajouter un paiement
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Enregistrer un paiement</DialogTitle>
                </DialogHeader>
                <div className="flex flex-col gap-4 py-2">
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="paiement-montant" className="text-sm font-medium">Montant (FCFA)</label>
                    <Input
                      id="paiement-montant"
                      type="number"
                      min={1}
                      max={resteAPayer}
                      value={paiementMontant}
                      onChange={(e) => setPaiementMontant(e.target.value)}
                      placeholder={`Max : ${formatMontant(resteAPayer)}`}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="paiement-mode" className="text-sm font-medium">Mode de paiement</label>
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
                            {modeLabels[mode]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="paiement-ref" className="text-sm font-medium">
                      Reference (optionnel)
                    </label>
                    <Input
                      id="paiement-ref"
                      value={paiementRef}
                      onChange={(e) => setPaiementRef(e.target.value)}
                      placeholder="N° de recu, transaction..."
                    />
                  </div>
                </div>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button variant="outline" disabled={paiementLoading}>
                      Annuler
                    </Button>
                  </DialogClose>
                  <Button
                    onClick={handlePaiement}
                    disabled={paiementLoading || !paiementMontant}
                  >
                    {paiementLoading ? "Enregistrement..." : "Confirmer"}
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
              Facture fournisseur
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
                    Voir la facture
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
                        Supprimer
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Supprimer la facture ?</DialogTitle>
                      </DialogHeader>
                      <p className="text-sm text-muted-foreground">
                        Cette action est irreversible. Le fichier sera
                        definitivement supprime.
                      </p>
                      <DialogFooter>
                        <DialogClose asChild>
                          <Button variant="outline">Annuler</Button>
                        </DialogClose>
                        <Button
                          variant="danger"
                          onClick={handleDeleteFacture}
                        >
                          Supprimer
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
                    Joindre une facture
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Upload facture</DialogTitle>
                  </DialogHeader>
                  <div className="flex flex-col gap-3 py-2">
                    <p className="text-sm text-muted-foreground">
                      Formats acceptes : PDF, JPG, PNG — max 10 Mo
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
                      <Button variant="outline" disabled={uploadLoading}>
                        Annuler
                      </Button>
                    </DialogClose>
                    <Button
                      onClick={handleUploadFacture}
                      disabled={uploadLoading || !uploadFile}
                    >
                      {uploadLoading ? "Upload en cours..." : "Envoyer"}
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
            Historique des paiements ({paiements.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {paiements.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Aucun paiement enregistre
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
                      {modeLabels[p.mode as ModePaiement]} •{" "}
                      {p.user.name}
                    </span>
                    {p.reference && (
                      <span className="text-xs text-muted-foreground">
                        Ref : {p.reference}
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
