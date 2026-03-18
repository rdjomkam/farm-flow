"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Calendar,
  User,
  CheckCircle,
  XCircle,
  Settings,
  CheckCheck,
  Package,
  ChevronRight,
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
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { StatutBesoins } from "@/types";
import { ModifierBesoinDialog } from "./modifier-besoin-dialog";

// ---------------------------------------------------------------------------
// Labels & variants
// ---------------------------------------------------------------------------

const statutLabels: Record<StatutBesoins, string> = {
  [StatutBesoins.SOUMISE]: "Soumise",
  [StatutBesoins.APPROUVEE]: "Approuvee",
  [StatutBesoins.TRAITEE]: "Traitee",
  [StatutBesoins.CLOTUREE]: "Cloturee",
  [StatutBesoins.REJETEE]: "Rejetee",
};

const statutVariants: Record<
  StatutBesoins,
  "default" | "info" | "en_cours" | "terminee" | "annulee" | "warning"
> = {
  [StatutBesoins.SOUMISE]: "info",
  [StatutBesoins.APPROUVEE]: "en_cours",
  [StatutBesoins.TRAITEE]: "warning",
  [StatutBesoins.CLOTUREE]: "terminee",
  [StatutBesoins.REJETEE]: "annulee",
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface LigneBesoinData {
  id: string;
  designation: string;
  produitId: string | null;
  quantite: number;
  unite: string | null;
  prixEstime: number;
  prixReel: number | null;
  commandeId: string | null;
  produit: { id: string; nom: string; unite: string } | null;
  commande: { id: string; numero: string; statut: string } | null;
}

interface ListeBesoinsDetailData {
  id: string;
  numero: string;
  titre: string;
  statut: string;
  montantEstime: number;
  montantReel: number | null;
  motifRejet: string | null;
  notes: string | null;
  dateLimite: string | null;
  vagueId: string | null;
  createdAt: string;
  demandeur: { id: string; name: string } | null;
  valideur: { id: string; name: string } | null;
  vague: { id: string; code: string } | null;
  lignes: LigneBesoinData[];
  depenses: {
    id: string;
    numero: string;
    montantTotal: number;
    statut: string;
  }[];
}

interface Props {
  listeBesoins: ListeBesoinsDetailData;
  canApprove: boolean;
  canProcess: boolean;
  canEdit?: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatMontant(n: number) {
  return new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function BesoinsDetailClient({
  listeBesoins: initial,
  canApprove,
  canProcess,
  canEdit = false,
}: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [liste, setListe] = useState(initial);
  const [loading, setLoading] = useState(false);

  // Dialog states
  const [rejectOpen, setRejectOpen] = useState(false);
  const [motifRejet, setMotifRejet] = useState("");
  const [traitOpen, setTraitOpen] = useState(false);
  const [clotureOpen, setClotureOpen] = useState(false);

  // Traitement: action per ligne
  const [ligneActions, setLigneActions] = useState<
    Record<string, "COMMANDE" | "LIBRE">
  >(() =>
    Object.fromEntries(
      initial.lignes.map((l) => [
        l.id,
        l.produitId ? "COMMANDE" : "LIBRE",
      ])
    )
  );

  // Cloture: prixReel per ligne
  const [lignesPrixReel, setLignesPrixReel] = useState<Record<string, string>>(
    () =>
      Object.fromEntries(
        initial.lignes.map((l) => [
          l.id,
          l.prixReel !== null ? String(l.prixReel) : String(l.prixEstime),
        ])
      )
  );

  const statut = liste.statut as StatutBesoins;

  async function handleApprouver() {
    setLoading(true);
    try {
      const res = await fetch(`/api/besoins/${liste.id}/approuver`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message);
      }
      const data = await res.json();
      setListe(data);
      toast({ title: "Liste approuvee", variant: "success" });
      router.refresh();
    } catch (err) {
      toast({
        title: "Erreur",
        description: err instanceof Error ? err.message : "Erreur serveur.",
        variant: "error",
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleRejeter() {
    setLoading(true);
    try {
      const res = await fetch(`/api/besoins/${liste.id}/rejeter`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ motif: motifRejet }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message);
      }
      const data = await res.json();
      setListe(data);
      setRejectOpen(false);
      setMotifRejet("");
      toast({ title: "Liste rejetee", variant: "success" });
      router.refresh();
    } catch (err) {
      toast({
        title: "Erreur",
        description: err instanceof Error ? err.message : "Erreur serveur.",
        variant: "error",
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleTraiter() {
    setLoading(true);
    try {
      const ligneActionsArr = Object.entries(ligneActions).map(
        ([ligneBesoinId, action]) => ({ ligneBesoinId, action })
      );
      const res = await fetch(`/api/besoins/${liste.id}/traiter`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ligneActions: ligneActionsArr }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message);
      }
      const data = await res.json();
      setListe(data);
      setTraitOpen(false);
      toast({ title: "Liste traitee, depense et commandes creees", variant: "success" });
      router.refresh();
    } catch (err) {
      toast({
        title: "Erreur",
        description: err instanceof Error ? err.message : "Erreur serveur.",
        variant: "error",
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleCloturer() {
    setLoading(true);
    try {
      const lignesReelles = liste.lignes.map((l) => ({
        ligneBesoinId: l.id,
        prixReel: parseFloat(lignesPrixReel[l.id] ?? String(l.prixEstime)) || 0,
      }));
      const res = await fetch(`/api/besoins/${liste.id}/cloturer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lignesReelles }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message);
      }
      const data = await res.json();
      setListe(data);
      setClotureOpen(false);
      toast({ title: "Liste cloturee", variant: "success" });
      router.refresh();
    } catch (err) {
      toast({
        title: "Erreur",
        description: err instanceof Error ? err.message : "Erreur serveur.",
        variant: "error",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-4 pb-24 max-w-2xl mx-auto">
      {/* Back nav */}
      <Link
        href="/besoins"
        className="flex items-center gap-1 text-sm text-muted-foreground mb-4"
      >
        <ArrowLeft className="h-4 w-4" />
        Retour aux besoins
      </Link>

      {/* Header card */}
      <Card className="mb-4">
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-2 mb-3">
            <div>
              <p className="text-xs text-muted-foreground font-mono">
                {liste.numero}
              </p>
              <h1 className="text-lg font-bold mt-0.5">{liste.titre}</h1>
            </div>
            <Badge
              variant={statutVariants[statut] ?? "default"}
              className="flex-shrink-0 mt-1"
            >
              {statutLabels[statut] ?? statut}
            </Badge>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            {liste.demandeur && (
              <div>
                <p className="text-xs text-muted-foreground">Demandeur</p>
                <p className="flex items-center gap-1">
                  <User className="h-3 w-3" />
                  {liste.demandeur.name}
                </p>
              </div>
            )}
            {liste.valideur && (
              <div>
                <p className="text-xs text-muted-foreground">Valideur</p>
                <p className="flex items-center gap-1">
                  <User className="h-3 w-3" />
                  {liste.valideur.name}
                </p>
              </div>
            )}
            {liste.vague && (
              <div>
                <p className="text-xs text-muted-foreground">Vague</p>
                <p className="text-primary font-medium">{liste.vague.code}</p>
              </div>
            )}
            <div>
              <p className="text-xs text-muted-foreground">Creee le</p>
              <p className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {formatDate(liste.createdAt)}
              </p>
            </div>
            {liste.dateLimite && (() => {
              const limite = new Date(liste.dateLimite);
              const now = new Date();
              const enRetard = limite < now && ![StatutBesoins.TRAITEE, StatutBesoins.CLOTUREE, StatutBesoins.REJETEE].includes(statut);
              return (
                <div className="col-span-2">
                  <p className="text-xs text-muted-foreground">Date limite</p>
                  <p className={`flex items-center gap-1 text-sm font-medium ${enRetard ? "text-destructive" : ""}`}>
                    <Calendar className="h-3 w-3" />
                    {formatDate(liste.dateLimite)}
                    {enRetard && (
                      <span className="ml-1 text-xs bg-destructive/10 text-destructive px-1.5 py-0.5 rounded-full">
                        En retard
                      </span>
                    )}
                  </p>
                </div>
              );
            })()}
          </div>

          {/* Montants */}
          <div className="mt-3 pt-3 flex gap-4">
            <div>
              <p className="text-xs text-muted-foreground">Montant estime</p>
              <p className="text-base font-semibold">
                {formatMontant(liste.montantEstime)} FCFA
              </p>
            </div>
            {liste.montantReel !== null && (
              <div>
                <p className="text-xs text-muted-foreground">Montant reel</p>
                <p className="text-base font-semibold text-primary">
                  {formatMontant(liste.montantReel)} FCFA
                </p>
              </div>
            )}
          </div>

          {/* Motif rejet */}
          {liste.motifRejet && (
            <div className="mt-3 pt-3">
              <p className="text-xs text-muted-foreground mb-1">Motif de rejet</p>
              <p className="text-sm text-destructive">{liste.motifRejet}</p>
            </div>
          )}

          {/* Notes */}
          {liste.notes && (
            <div className="mt-3 pt-3">
              <p className="text-xs text-muted-foreground mb-1">Notes</p>
              <p className="text-sm">{liste.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Bouton Modifier — seulement si statut SOUMISE et canEdit */}
      {canEdit && statut === StatutBesoins.SOUMISE && (
        <div className="mb-4 flex justify-end">
          <ModifierBesoinDialog
            liste={liste}
            onSuccess={(updated) => {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              setListe(updated as any);
            }}
          />
        </div>
      )}

      {/* Actions workflow */}
      {canApprove && statut === StatutBesoins.SOUMISE && (
        <div className="flex gap-2 mb-4">
          <Button
            variant="primary"
            className="flex-1"
            disabled={loading}
            onClick={handleApprouver}
          >
            <CheckCircle className="h-4 w-4 mr-1" />
            Approuver
          </Button>
          <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
            <DialogTrigger asChild>
              <Button variant="danger" className="flex-1" disabled={loading}>
                <XCircle className="h-4 w-4 mr-1" />
                Rejeter
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Rejeter la liste de besoins</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div>
                  <label className="text-sm font-medium">
                    Motif de rejet (optionnel)
                  </label>
                  <Textarea
                    value={motifRejet}
                    onChange={(e) => setMotifRejet(e.target.value)}
                    placeholder="Expliquer pourquoi la liste est rejetee..."
                    className="mt-1"
                    rows={3}
                  />
                </div>
              </div>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="ghost">Annuler</Button>
                </DialogClose>
                <Button
                  variant="danger"
                  onClick={handleRejeter}
                  disabled={loading}
                >
                  Confirmer le rejet
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      )}

      {canProcess && statut === StatutBesoins.APPROUVEE && (
        <Dialog open={traitOpen} onOpenChange={setTraitOpen}>
          <DialogTrigger asChild>
            <Button variant="primary" className="w-full mb-4" disabled={loading}>
              <Settings className="h-4 w-4 mr-1" />
              Traiter la liste
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Traiter la liste de besoins</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 py-2 max-h-80 overflow-y-auto">
              <p className="text-sm text-muted-foreground">
                Choisissez le mode de traitement pour chaque ligne :
              </p>
              {liste.lignes.map((l) => (
                <div key={l.id} className="border rounded p-3 space-y-2">
                  <p className="text-sm font-medium">{l.designation}</p>
                  <p className="text-xs text-muted-foreground">
                    {l.quantite} {l.unite ?? (l.produit?.unite ?? "")} &times;{" "}
                    {formatMontant(l.prixEstime)} FCFA
                  </p>
                  <Select
                    value={ligneActions[l.id] ?? (l.produitId ? "COMMANDE" : "LIBRE")}
                    onValueChange={(v) =>
                      setLigneActions((prev) => ({
                        ...prev,
                        [l.id]: v as "COMMANDE" | "LIBRE",
                      }))
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="COMMANDE" disabled={!l.produitId}>
                        Commande fournisseur{!l.produitId ? " (produit requis)" : ""}
                      </SelectItem>
                      <SelectItem value="LIBRE">Achat direct / libre</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="ghost">Annuler</Button>
              </DialogClose>
              <Button
                variant="primary"
                onClick={handleTraiter}
                disabled={loading}
              >
                Confirmer le traitement
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {canProcess && statut === StatutBesoins.TRAITEE && (
        <Dialog open={clotureOpen} onOpenChange={setClotureOpen}>
          <DialogTrigger asChild>
            <Button variant="primary" className="w-full mb-4" disabled={loading}>
              <CheckCheck className="h-4 w-4 mr-1" />
              Cloturer la liste
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Cloturer la liste de besoins</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 py-2 max-h-80 overflow-y-auto">
              <p className="text-sm text-muted-foreground">
                Saisissez le prix reel par ligne :
              </p>
              {liste.lignes.map((l) => (
                <div key={l.id} className="border rounded p-3 space-y-2">
                  <p className="text-sm font-medium">{l.designation}</p>
                  <p className="text-xs text-muted-foreground">
                    Quantite : {l.quantite} {l.unite ?? (l.produit?.unite ?? "")}
                  </p>
                  <div>
                    <label className="text-xs text-muted-foreground">
                      Prix reel unitaire (FCFA)
                    </label>
                    <Input
                      type="number"
                      min="0"
                      value={lignesPrixReel[l.id] ?? ""}
                      onChange={(e) =>
                        setLignesPrixReel((prev) => ({
                          ...prev,
                          [l.id]: e.target.value,
                        }))
                      }
                      className="mt-1"
                    />
                  </div>
                </div>
              ))}
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="ghost">Annuler</Button>
              </DialogClose>
              <Button
                variant="primary"
                onClick={handleCloturer}
                disabled={loading}
              >
                Confirmer la cloture
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Lignes de besoin */}
      <Card className="mb-4">
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-base">
            Lignes de besoin ({liste.lignes.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          {liste.lignes.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Aucune ligne de besoin
            </p>
          ) : (
            <div className="space-y-2">
              {liste.lignes.map((l) => (
                <div key={l.id}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{l.designation}</p>
                      {l.produit && (
                        <p className="text-xs text-muted-foreground">
                          Produit : {l.produit.nom}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {l.quantite} {l.unite ?? (l.produit?.unite ?? "")}
                        {" "}×{" "}
                        {formatMontant(l.prixEstime)} FCFA
                        {" = "}
                        <span className="font-medium">
                          {formatMontant(l.quantite * l.prixEstime)} FCFA
                        </span>
                      </p>
                      {l.prixReel !== null && (
                        <p className="text-xs text-primary mt-0.5">
                          Reel : {l.quantite} × {formatMontant(l.prixReel)} ={" "}
                          {formatMontant(l.quantite * l.prixReel)} FCFA
                        </p>
                      )}
                    </div>
                    {l.commande && (
                      <Link
                        href={`/stock/commandes/${l.commande.id}`}
                        className="flex-shrink-0"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Badge variant="info" className="text-xs">
                          <Package className="h-3 w-3 mr-1" />
                          {l.commande.numero}
                          <ChevronRight className="h-3 w-3 ml-0.5" />
                        </Badge>
                      </Link>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Depenses liees */}
      {liste.depenses.length > 0 && (
        <Card>
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-base">
              Depenses liees ({liste.depenses.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="space-y-2">
              {liste.depenses.map((d) => (
                <Link
                  key={d.id}
                  href={`/depenses/${d.id}`}
                  className="flex items-center justify-between p-2 border rounded hover:bg-accent transition-colors"
                >
                  <div>
                    <p className="text-xs font-mono text-muted-foreground">
                      {d.numero}
                    </p>
                    <p className="text-sm font-medium">
                      {formatMontant(d.montantTotal)} FCFA
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
