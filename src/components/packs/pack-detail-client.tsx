"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Plus, Trash2, Package, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { Permission, StatutActivation } from "@/types";

const statutActivationLabels: Record<StatutActivation, string> = {
  [StatutActivation.ACTIVE]: "Active",
  [StatutActivation.EXPIREE]: "Expiree",
  [StatutActivation.SUSPENDUE]: "Suspendue",
};

const statutActivationVariants: Record<StatutActivation, "en_cours" | "default" | "warning"> = {
  [StatutActivation.ACTIVE]: "en_cours",
  [StatutActivation.EXPIREE]: "default",
  [StatutActivation.SUSPENDUE]: "warning",
};

interface ProduitOption {
  id: string;
  nom: string;
  categorie: string;
  unite: string;
  stockActuel: number;
}

interface PackProduitData {
  id: string;
  quantite: number;
  produit: { id: string; nom: string; categorie: string; unite: string; prixUnitaire: number };
}

interface ActivationData {
  id: string;
  code: string;
  statut: string;
  dateActivation: string;
  dateExpiration: string | null;
  clientSite: { id: string; name: string };
  user: { id: string; name: string };
}

interface PackDetailData {
  id: string;
  nom: string;
  description: string | null;
  nombreAlevins: number;
  poidsMoyenInitial: number;
  prixTotal: number;
  isActive: boolean;
  configElevage: { id: string; nom: string } | null;
  user: { id: string; name: string };
  produits: PackProduitData[];
  activations: ActivationData[];
}

interface Props {
  pack: PackDetailData;
  produits: ProduitOption[];
  permissions: Permission[];
}

export function PackDetailClient({ pack, produits, permissions }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [ajoutOpen, setAjoutOpen] = useState(false);
  const [ajoutLoading, setAjoutLoading] = useState(false);
  const [produitId, setProduitId] = useState("");
  const [quantite, setQuantite] = useState("");

  const canManage = permissions.includes(Permission.GERER_PACKS);
  const canActivate = permissions.includes(Permission.ACTIVER_PACKS);

  function resetAjoutForm() {
    setProduitId("");
    setQuantite("");
  }

  async function handleAjoutProduit() {
    if (!produitId) {
      toast({ title: "Erreur", description: "Selectionnez un produit.", variant: "error" });
      return;
    }
    const qty = parseFloat(quantite);
    if (isNaN(qty) || qty <= 0) {
      toast({ title: "Erreur", description: "La quantite doit etre superieure a 0.", variant: "error" });
      return;
    }

    setAjoutLoading(true);
    try {
      const res = await fetch(`/api/packs/${pack.id}/produits`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ produitId, quantite: qty }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Erreur lors de l'ajout.");
      }
      toast({ title: "Produit ajoute", description: "Le produit a ete ajoute au pack." });
      setAjoutOpen(false);
      resetAjoutForm();
      router.refresh();
    } catch (err) {
      toast({
        title: "Erreur",
        description: err instanceof Error ? err.message : "Erreur inconnue.",
        variant: "error",
      });
    } finally {
      setAjoutLoading(false);
    }
  }

  async function handleRetirerProduit(packProduitProduitId: string, produitNom: string) {
    if (!confirm(`Retirer "${produitNom}" du pack ?`)) return;

    try {
      const res = await fetch(`/api/packs/${pack.id}/produits?produitId=${packProduitProduitId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Erreur lors de la suppression.");
      }
      toast({ title: "Produit retire", description: `"${produitNom}" a ete retire du pack.` });
      router.refresh();
    } catch (err) {
      toast({
        title: "Erreur",
        description: err instanceof Error ? err.message : "Erreur inconnue.",
        variant: "error",
      });
    }
  }

  // Produits pas encore dans le pack
  const produitsDisponibles = produits.filter(
    (p) => !pack.produits.some((pp) => pp.produit.id === p.id)
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/packs">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Retour
          </Link>
        </Button>
      </div>

      {/* Pack info */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-2">
            <div>
              <CardTitle className="text-xl">{pack.nom}</CardTitle>
              {pack.description && (
                <p className="text-sm text-muted-foreground mt-1">{pack.description}</p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={pack.isActive ? "en_cours" : "default"}>
                {pack.isActive ? "Actif" : "Inactif"}
              </Badge>
              {canActivate && pack.isActive && (
                <Button asChild size="sm">
                  <Link href={`/packs/${pack.id}/activer`}>Activer pour un client</Link>
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3 text-sm">
            <div>
              <dt className="text-muted-foreground">Alevins</dt>
              <dd className="font-medium">{pack.nombreAlevins.toLocaleString()}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Poids initial</dt>
              <dd className="font-medium">{pack.poidsMoyenInitial} g/alevin</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Prix total</dt>
              <dd className="font-medium">{pack.prixTotal.toLocaleString()} FCFA</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Config elevage</dt>
              <dd className="font-medium">{pack.configElevage?.nom ?? "Non assignee"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Cree par</dt>
              <dd className="font-medium">{pack.user.name}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Activations</dt>
              <dd className="font-medium flex items-center gap-1">
                <Users className="h-3.5 w-3.5" />
                {pack.activations.length}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      {/* Produits inclus */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Produits inclus</CardTitle>
            {canManage && produitsDisponibles.length > 0 && (
              <Dialog open={ajoutOpen} onOpenChange={setAjoutOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" variant="outline">
                    <Plus className="h-4 w-4 mr-1" />
                    Ajouter
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Ajouter un produit au pack</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-2">
                    <div>
                      <label className="text-sm font-medium">Produit *</label>
                      <Select value={produitId} onValueChange={setProduitId}>
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="Selectionnez un produit..." />
                        </SelectTrigger>
                        <SelectContent>
                          {produitsDisponibles.map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.nom} ({p.unite})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-sm font-medium">Quantite *</label>
                      <Input
                        type="number"
                        min={0.001}
                        step={0.001}
                        value={quantite}
                        onChange={(e) => setQuantite(e.target.value)}
                        placeholder="Ex: 10"
                        className="mt-1"
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <DialogClose asChild>
                      <Button variant="outline" onClick={resetAjoutForm}>Annuler</Button>
                    </DialogClose>
                    <Button onClick={handleAjoutProduit} disabled={ajoutLoading}>
                      {ajoutLoading ? "Ajout..." : "Ajouter"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {pack.produits.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Aucun produit dans ce pack.
            </p>
          ) : (
            <div className="space-y-2">
              {pack.produits.map((pp) => (
                <div key={pp.id} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div>
                    <p className="font-medium text-sm">{pp.produit.nom}</p>
                    <p className="text-xs text-muted-foreground">
                      Quantite : {pp.quantite} {pp.produit.unite} — {pp.produit.prixUnitaire.toLocaleString()} FCFA/{pp.produit.unite}
                    </p>
                  </div>
                  {canManage && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:text-destructive"
                      onClick={() => handleRetirerProduit(pp.produit.id, pp.produit.nom)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Historique des activations */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Historique des activations</CardTitle>
        </CardHeader>
        <CardContent>
          {pack.activations.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Aucune activation pour ce pack.
            </p>
          ) : (
            <div className="space-y-2">
              {pack.activations.map((act) => (
                <div key={act.id} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div>
                    <p className="font-mono text-sm font-medium">{act.code}</p>
                    <p className="text-xs text-muted-foreground">
                      {act.clientSite.name} — {new Date(act.dateActivation).toLocaleDateString("fr-FR")}
                    </p>
                  </div>
                  <Badge variant={statutActivationVariants[act.statut as StatutActivation]}>
                    {statutActivationLabels[act.statut as StatutActivation]}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
