"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Calendar,
  Users,
  CreditCard,
  Plus,
  FileText,
  Waves,
} from "lucide-react";
import { FishLoader } from "@/components/ui/fish-loader";
import { Button } from "@/components/ui/button";
import { ExportButton } from "@/components/ui/export-button";
import { Input } from "@/components/ui/input";
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
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { StatutFacture, ModePaiement, Permission } from "@/types";

const statutLabels: Record<StatutFacture, string> = {
  [StatutFacture.BROUILLON]: "Brouillon",
  [StatutFacture.ENVOYEE]: "Envoyee",
  [StatutFacture.PAYEE_PARTIELLEMENT]: "Partielle",
  [StatutFacture.PAYEE]: "Payee",
  [StatutFacture.ANNULEE]: "Annulee",
};

const statutVariants: Record<StatutFacture, "default" | "info" | "warning" | "terminee" | "annulee"> = {
  [StatutFacture.BROUILLON]: "default",
  [StatutFacture.ENVOYEE]: "info",
  [StatutFacture.PAYEE_PARTIELLEMENT]: "warning",
  [StatutFacture.PAYEE]: "terminee",
  [StatutFacture.ANNULEE]: "annulee",
};

const modeLabels: Record<ModePaiement, string> = {
  [ModePaiement.ESPECES]: "Especes",
  [ModePaiement.MOBILE_MONEY]: "Mobile Money",
  [ModePaiement.VIREMENT]: "Virement",
  [ModePaiement.CHEQUE]: "Cheque",
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
  const router = useRouter();
  const { toast } = useToast();
  const [paiementOpen, setPaiementOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const [montant, setMontant] = useState("");
  const [mode, setMode] = useState("");
  const [reference, setReference] = useState("");

  const statut = facture.statut as StatutFacture;
  const resteAPayer = facture.montantTotal - facture.montantPaye;
  const canAddPaiement =
    statut !== StatutFacture.PAYEE && statut !== StatutFacture.ANNULEE;

  function resetPaiementForm() {
    setMontant("");
    setMode("");
    setReference("");
  }

  async function handlePaiement() {
    if (!montant || !mode) return;
    setLoading(true);

    try {
      const res = await fetch(`/api/factures/${facture.id}/paiements`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          montant: parseFloat(montant),
          mode,
          ...(reference.trim() && { reference: reference.trim() }),
        }),
      });

      if (res.ok) {
        toast({ title: "Paiement enregistre", variant: "success" });
        setPaiementOpen(false);
        resetPaiementForm();
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

  async function handleEnvoyer() {
    setLoading(true);
    try {
      const res = await fetch(`/api/factures/${facture.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ statut: StatutFacture.ENVOYEE }),
      });

      if (res.ok) {
        toast({ title: "Facture envoyee", variant: "success" });
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
        href="/factures"
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors w-fit"
      >
        <ArrowLeft className="h-4 w-4" />
        Factures
      </Link>

      {/* Header */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-lg">{facture.numero}</h2>
            <Badge variant={statutVariants[statut]}>
              {statutLabels[statut]}
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
                Emission : {new Date(facture.dateEmission).toLocaleDateString("fr-FR")}
              </span>
            </div>
            {facture.dateEcheance && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Calendar className="h-4 w-4 shrink-0" />
                <span>
                  Echeance : {new Date(facture.dateEcheance).toLocaleDateString("fr-FR")}
                </span>
              </div>
            )}
          </div>

          {/* Amounts */}
          <div className="grid grid-cols-2 gap-2 mt-3">
            <div className="rounded-lg bg-muted/50 p-3 text-center">
              <p className="text-lg font-bold">
                {facture.montantTotal.toLocaleString("fr-FR")} F
              </p>
              <p className="text-xs text-muted-foreground">Total</p>
            </div>
            <div className="rounded-lg bg-muted/50 p-3 text-center">
              <p className="text-lg font-bold">
                {facture.montantPaye.toLocaleString("fr-FR")} F
              </p>
              <p className="text-xs text-muted-foreground">Paye</p>
            </div>
          </div>

          {resteAPayer > 0 && statut !== StatutFacture.ANNULEE && (
            <div className="rounded-lg bg-accent-amber-muted border border-accent-amber/30 p-3 text-center mt-2">
              <p className="text-lg font-bold text-accent-amber">
                {resteAPayer.toLocaleString("fr-FR")} F
              </p>
              <p className="text-xs text-accent-amber">Reste a payer</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        {/* Bouton export PDF */}
        {permissions.includes(Permission.EXPORT_DONNEES) && (
          <ExportButton
            href={`/api/export/facture/${facture.id}`}
            filename={`facture-${facture.numero}.pdf`}
            label="PDF"
            variant="outline"
          />
        )}
        {statut === StatutFacture.BROUILLON && permissions.includes(Permission.FACTURES_GERER) && (
          <Button
            className="flex-1"
            onClick={handleEnvoyer}
            disabled={loading}
          >
            <FileText className="h-4 w-4 mr-1" />
            {loading ? "Envoi..." : "Envoyer"}
          </Button>
        )}
        {canAddPaiement && permissions.includes(Permission.PAIEMENTS_CREER) && (
          <Dialog
            open={paiementOpen}
            onOpenChange={(open) => {
              setPaiementOpen(open);
              if (!open) resetPaiementForm();
            }}
          >
            <DialogTrigger asChild>
              <Button className="flex-1" variant={statut === StatutFacture.BROUILLON ? "outline" : "primary"}>
                <Plus className="h-4 w-4 mr-1" />
                Ajouter un paiement
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Enregistrer un paiement</DialogTitle>
              </DialogHeader>
              <div className="flex flex-col gap-4 py-2">
                <Input
                  label={`Montant (max ${resteAPayer.toLocaleString("fr-FR")} F)`}
                  type="number"
                  min="1"
                  max={resteAPayer}
                  placeholder="Ex: 50000"
                  value={montant}
                  onChange={(e) => setMontant(e.target.value)}
                  autoFocus
                />
                <Select value={mode} onValueChange={setMode}>
                  <SelectTrigger label="Mode de paiement">
                    <SelectValue placeholder="Selectionner" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(modeLabels).map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  label="Reference (optionnel)"
                  placeholder="Ex: MTN-20260310-001"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                />
              </div>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline">Annuler</Button>
                </DialogClose>
                <Button
                  onClick={handlePaiement}
                  disabled={loading || !montant || !mode}
                >
                  {loading ? <><FishLoader size="sm" /> Enregistrement...</> : "Confirmer"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Vente details */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Detail de la vente</CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <div className="flex flex-col gap-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Poissons</span>
              <span>{facture.vente.quantitePoissons}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Poids total</span>
              <span>{facture.vente.poidsTotalKg} kg</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Prix/kg</span>
              <span>{facture.vente.prixUnitaireKg.toLocaleString("fr-FR")} F</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Paiements */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">
            Paiements ({facture.paiements.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {facture.paiements.length === 0 ? (
            <p className="text-sm text-muted-foreground px-4 pb-4">
              Aucun paiement enregistre.
            </p>
          ) : (
            <div className="divide-y divide-border">
              {facture.paiements.map((p) => (
                <div key={p.id} className="flex items-center justify-between px-4 py-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <CreditCard className="h-4 w-4 text-accent-green shrink-0" />
                      <span className="text-sm font-medium">
                        {modeLabels[p.mode as ModePaiement] ?? p.mode}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {new Date(p.date).toLocaleDateString("fr-FR")}
                      {p.reference && ` — ${p.reference}`}
                    </p>
                  </div>
                  <p className="text-sm font-semibold shrink-0">
                    {p.montant.toLocaleString("fr-FR")} F
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {facture.notes && (
        <p className="text-sm text-muted-foreground italic">{facture.notes}</p>
      )}

      <p className="text-xs text-muted-foreground text-center">
        Cree par {facture.user.name}
      </p>
    </div>
  );
}
