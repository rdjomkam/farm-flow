"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Calendar,
  Truck,
  Send,
  PackageCheck,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { StatutCommande, UniteStock, Permission } from "@/types";

const statutLabels: Record<StatutCommande, string> = {
  [StatutCommande.BROUILLON]: "Brouillon",
  [StatutCommande.ENVOYEE]: "Envoyee",
  [StatutCommande.LIVREE]: "Livree",
  [StatutCommande.ANNULEE]: "Annulee",
};

const statutVariants: Record<StatutCommande, "default" | "info" | "en_cours" | "warning"> = {
  [StatutCommande.BROUILLON]: "default",
  [StatutCommande.ENVOYEE]: "info",
  [StatutCommande.LIVREE]: "en_cours",
  [StatutCommande.ANNULEE]: "warning",
};

const uniteLabels: Record<string, string> = {
  [UniteStock.KG]: "kg",
  [UniteStock.LITRE]: "L",
  [UniteStock.UNITE]: "unite",
  [UniteStock.SACS]: "sacs",
};

interface LigneData {
  id: string;
  quantite: number;
  prixUnitaire: number;
  produit: { id: string; nom: string; unite: string };
}

interface CommandeData {
  id: string;
  numero: string;
  statut: string;
  dateCommande: string;
  dateLivraison: string | null;
  montantTotal: number;
  fournisseur: {
    id: string;
    nom: string;
    telephone: string | null;
    email: string | null;
  };
  user: { id: string; name: string };
  lignes: LigneData[];
}

interface Props {
  commande: CommandeData;
  permissions: Permission[];
}

export function CommandeDetailClient({ commande, permissions }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [recevoirOpen, setRecevoirOpen] = useState(false);
  const [dateLivraison, setDateLivraison] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [loading, setLoading] = useState<string | null>(null);

  const statut = commande.statut as StatutCommande;

  async function handleAction(action: string) {
    setLoading(action);
    try {
      const url =
        action === "recevoir"
          ? `/api/commandes/${commande.id}/recevoir`
          : `/api/commandes/${commande.id}/${action}`;

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          action === "recevoir" ? { dateLivraison } : {}
        ),
      });

      if (res.ok) {
        const messages: Record<string, string> = {
          envoyer: "Commande envoyee",
          recevoir: "Commande receptionnee",
          annuler: "Commande annulee",
        };
        toast({ title: messages[action] || "Action effectuee", variant: "success" });
        setRecevoirOpen(false);
        router.refresh();
      } else {
        const data = await res.json();
        toast({ title: data.message || "Erreur", variant: "error" });
      }
    } catch {
      toast({ title: "Erreur reseau", variant: "error" });
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Link
        href="/stock/commandes"
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors w-fit"
      >
        <ArrowLeft className="h-4 w-4" />
        Commandes
      </Link>

      {/* Header info */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-lg">{commande.numero}</h2>
            <Badge variant={statutVariants[statut]}>
              {statutLabels[statut]}
            </Badge>
          </div>

          <div className="flex flex-col gap-2 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Truck className="h-4 w-4 shrink-0" />
              <span>{commande.fournisseur.nom}</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Calendar className="h-4 w-4 shrink-0" />
              <span>
                Commande : {new Date(commande.dateCommande).toLocaleDateString("fr-FR")}
              </span>
            </div>
            {commande.dateLivraison && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <PackageCheck className="h-4 w-4 shrink-0" />
                <span>
                  Livraison : {new Date(commande.dateLivraison).toLocaleDateString("fr-FR")}
                </span>
              </div>
            )}
          </div>

          <div className="mt-3 rounded-lg bg-muted/50 p-3 text-center">
            <p className="text-2xl font-bold">
              {commande.montantTotal.toLocaleString("fr-FR")} FCFA
            </p>
            <p className="text-xs text-muted-foreground">Montant total</p>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      {permissions.includes(Permission.APPROVISIONNEMENT_GERER) && (statut === StatutCommande.BROUILLON || statut === StatutCommande.ENVOYEE) && (
        <div className="flex gap-2">
          {statut === StatutCommande.BROUILLON && (
            <Button
              className="flex-1"
              onClick={() => handleAction("envoyer")}
              disabled={loading !== null}
            >
              <Send className="h-4 w-4 mr-1" />
              {loading === "envoyer" ? "Envoi..." : "Envoyer"}
            </Button>
          )}
          {statut === StatutCommande.ENVOYEE && (
            <>
              <Button
                className="flex-1"
                onClick={() => setRecevoirOpen(true)}
                disabled={loading !== null}
              >
                <PackageCheck className="h-4 w-4 mr-1" />
                Receptionner
              </Button>
              <Dialog open={recevoirOpen} onOpenChange={setRecevoirOpen}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Receptionner la commande</DialogTitle>
                    <DialogDescription>
                      Cette action va creer des mouvements d&apos;entree et mettre a jour le stock.
                    </DialogDescription>
                  </DialogHeader>
                  <Input
                    label="Date de livraison"
                    type="date"
                    value={dateLivraison}
                    onChange={(e) => setDateLivraison(e.target.value)}
                  />
                  <DialogFooter>
                    <DialogClose asChild>
                      <Button variant="outline">Annuler</Button>
                    </DialogClose>
                    <Button
                      onClick={() => handleAction("recevoir")}
                      disabled={loading === "recevoir"}
                    >
                      {loading === "recevoir" ? "Reception..." : "Confirmer la reception"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </>
          )}
          <Button
            variant="danger"
            onClick={() => handleAction("annuler")}
            disabled={loading !== null}
          >
            <X className="h-4 w-4 mr-1" />
            {loading === "annuler" ? "..." : "Annuler"}
          </Button>
        </div>
      )}

      {/* Lignes */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">
            Lignes ({commande.lignes.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-border">
            {commande.lignes.map((ligne) => {
              const unite = uniteLabels[ligne.produit.unite] ?? ligne.produit.unite;
              const sousTotal = ligne.quantite * ligne.prixUnitaire;
              return (
                <div key={ligne.id} className="flex items-center justify-between px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">
                      {ligne.produit.nom}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {ligne.quantite} {unite} x {ligne.prixUnitaire.toLocaleString("fr-FR")} FCFA
                    </p>
                  </div>
                  <p className="text-sm font-semibold shrink-0">
                    {sousTotal.toLocaleString("fr-FR")} FCFA
                  </p>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground text-center">
        Cree par {commande.user.name}
      </p>
    </div>
  );
}
