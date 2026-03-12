"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Calendar,
  Pencil,
} from "lucide-react";
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
import { CategorieProduit, UniteStock, TypeMouvement } from "@/types";

const categorieLabels: Record<CategorieProduit, string> = {
  [CategorieProduit.ALIMENT]: "Aliment",
  [CategorieProduit.INTRANT]: "Intrant",
  [CategorieProduit.EQUIPEMENT]: "Equipement",
};

const uniteLabels: Record<UniteStock, string> = {
  [UniteStock.GRAMME]: "g",
  [UniteStock.KG]: "kg",
  [UniteStock.MILLILITRE]: "mL",
  [UniteStock.LITRE]: "L",
  [UniteStock.UNITE]: "unite",
  [UniteStock.SACS]: "sacs",
};

interface MouvementData {
  id: string;
  type: string;
  quantite: number;
  prixTotal: number | null;
  date: string;
  notes: string | null;
  user: { id: string; name: string };
}

interface ProduitData {
  id: string;
  nom: string;
  categorie: string;
  unite: string;
  uniteAchat: string | null;
  contenance: number | null;
  prixUnitaire: number;
  stockActuel: number;
  seuilAlerte: number;
  fournisseur: { id: string; nom: string } | null;
  mouvements: MouvementData[];
}

interface Props {
  produit: ProduitData;
  fournisseurs: { id: string; nom: string }[];
}

export function ProduitDetailClient({ produit, fournisseurs }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Edit form
  const [nom, setNom] = useState(produit.nom);
  const [categorie, setCategorie] = useState(produit.categorie);
  const [unite, setUnite] = useState(produit.unite);
  const [prixUnitaire, setPrixUnitaire] = useState(String(produit.prixUnitaire));
  const [seuilAlerte, setSeuilAlerte] = useState(String(produit.seuilAlerte));
  const [fournisseurId, setFournisseurId] = useState(produit.fournisseur?.id ?? "");
  const [dualUnit, setDualUnit] = useState(!!produit.uniteAchat);
  const [uniteAchat, setUniteAchat] = useState(produit.uniteAchat ?? "");
  const [contenance, setContenance] = useState(produit.contenance ? String(produit.contenance) : "");
  const contenanceDisabled = produit.stockActuel > 0;

  const isAlerte = produit.stockActuel <= produit.seuilAlerte;
  const uniteLabel = uniteLabels[produit.unite as UniteStock] ?? produit.unite;

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch(`/api/produits/${produit.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nom: nom.trim(),
          categorie,
          unite,
          prixUnitaire: parseFloat(prixUnitaire) || 0,
          seuilAlerte: parseFloat(seuilAlerte) || 0,
          fournisseurId: fournisseurId || null,
          uniteAchat: dualUnit && uniteAchat ? uniteAchat : null,
          contenance: dualUnit && contenance ? parseFloat(contenance) : null,
        }),
      });

      if (res.ok) {
        toast({ title: "Produit mis a jour", variant: "success" });
        setEditOpen(false);
        router.refresh();
      } else {
        const data = await res.json();
        toast({ title: data.message || "Erreur", variant: "error" });
      }
    } catch {
      toast({ title: "Erreur reseau", variant: "error" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Link
        href="/stock/produits"
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors w-fit"
      >
        <ArrowLeft className="h-4 w-4" />
        Produits
      </Link>

      {/* Info card */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-start justify-between mb-3">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-semibold text-lg">{produit.nom}</h2>
                {isAlerte && <AlertTriangle className="h-5 w-5 text-warning" />}
              </div>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="default">
                  {categorieLabels[produit.categorie as CategorieProduit]}
                </Badge>
                {produit.fournisseur && (
                  <span className="text-sm text-muted-foreground">
                    {produit.fournisseur.nom}
                  </span>
                )}
              </div>
            </div>
            <Dialog open={editOpen} onOpenChange={setEditOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline">
                  <Pencil className="h-4 w-4" />
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Modifier le produit</DialogTitle>
                </DialogHeader>
                <div className="flex flex-col gap-4 py-2">
                  <Input
                    label="Nom"
                    value={nom}
                    onChange={(e) => setNom(e.target.value)}
                  />
                  <Select value={categorie} onValueChange={setCategorie}>
                    <SelectTrigger label="Categorie">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(categorieLabels).map(([val, label]) => (
                        <SelectItem key={val} value={val}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={unite} onValueChange={setUnite}>
                    <SelectTrigger label="Unite de base">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(uniteLabels).map(([val, label]) => (
                        <SelectItem key={val} value={val}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={dualUnit}
                      onChange={(e) => {
                        setDualUnit(e.target.checked);
                        if (!e.target.checked) {
                          setUniteAchat("");
                          setContenance("");
                        }
                      }}
                      className="rounded border-border"
                    />
                    Unite d&apos;achat differente
                  </label>
                  {dualUnit && (
                    <>
                      <Select value={uniteAchat} onValueChange={setUniteAchat}>
                        <SelectTrigger label="Unite d'achat">
                          <SelectValue placeholder="Choisir" />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(uniteLabels)
                            .filter(([val]) => val !== unite)
                            .map(([val, label]) => (
                              <SelectItem key={val} value={val}>{label}</SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                      <div>
                        <Input
                          label={`Contenance (${uniteLabels[unite as UniteStock] ?? unite} par ${uniteAchat ? (uniteLabels[uniteAchat as UniteStock] ?? uniteAchat) : "unite d'achat"})`}
                          type="number"
                          placeholder="Ex: 25"
                          value={contenance}
                          onChange={(e) => setContenance(e.target.value)}
                          disabled={contenanceDisabled}
                        />
                        {contenanceDisabled && (
                          <p className="text-xs text-warning mt-1">
                            Non modifiable (stock &gt; 0)
                          </p>
                        )}
                      </div>
                    </>
                  )}
                  <Input
                    label="Prix unitaire (FCFA)"
                    type="number"
                    value={prixUnitaire}
                    onChange={(e) => setPrixUnitaire(e.target.value)}
                  />
                  <Input
                    label="Seuil d'alerte"
                    type="number"
                    value={seuilAlerte}
                    onChange={(e) => setSeuilAlerte(e.target.value)}
                  />
                  <Select value={fournisseurId} onValueChange={setFournisseurId}>
                    <SelectTrigger label="Fournisseur">
                      <SelectValue placeholder="Aucun" />
                    </SelectTrigger>
                    <SelectContent>
                      {fournisseurs.map((f) => (
                        <SelectItem key={f.id} value={f.id}>{f.nom}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button variant="outline">Annuler</Button>
                  </DialogClose>
                  <Button onClick={handleSave} disabled={saving || !nom.trim()}>
                    {saving ? "Enregistrement..." : "Enregistrer"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-muted/50 p-3 text-center">
              <p className="text-2xl font-bold">
                {produit.stockActuel}
              </p>
              <p className="text-xs text-muted-foreground">{uniteLabel} en stock</p>
              {produit.uniteAchat && produit.contenance && produit.contenance > 0 && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  {"\u2248 "}{Math.round((produit.stockActuel / produit.contenance) * 10) / 10} {uniteLabels[produit.uniteAchat as UniteStock] ?? produit.uniteAchat}
                </p>
              )}
            </div>
            <div className="rounded-lg bg-muted/50 p-3 text-center">
              <p className="text-2xl font-bold">
                {produit.prixUnitaire.toLocaleString("fr-FR")}
              </p>
              <p className="text-xs text-muted-foreground">FCFA / {uniteLabel}</p>
            </div>
          </div>

          {isAlerte && (
            <div className="mt-3 flex items-center gap-2 rounded-lg bg-warning/10 p-2 text-sm text-warning">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              Stock en dessous du seuil d&apos;alerte ({produit.seuilAlerte} {uniteLabel})
            </div>
          )}
        </CardContent>
      </Card>

      {/* Mouvements recents */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Derniers mouvements</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {produit.mouvements.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">
              Aucun mouvement
            </p>
          ) : (
            <div className="divide-y divide-border">
              {produit.mouvements.map((m) => {
                const isEntree = m.type === TypeMouvement.ENTREE;
                return (
                  <div key={m.id} className="flex items-center gap-3 px-4 py-3">
                    <div className={`flex h-8 w-8 items-center justify-center rounded-full shrink-0 ${
                      isEntree ? "bg-success/10" : "bg-danger/10"
                    }`}>
                      {isEntree ? (
                        <TrendingUp className="h-4 w-4 text-success" />
                      ) : (
                        <TrendingDown className="h-4 w-4 text-danger" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">
                        {isEntree ? "+" : "-"}{m.quantite} {uniteLabel}
                      </p>
                      {m.notes && (
                        <p className="text-xs text-muted-foreground truncate">
                          {m.notes}
                        </p>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        {new Date(m.date).toLocaleDateString("fr-FR")}
                      </div>
                      <p className="text-xs text-muted-foreground">{m.user.name}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Link href="/stock/mouvements" className="w-full">
        <Button variant="outline" className="w-full">
          Voir tous les mouvements
        </Button>
      </Link>
    </div>
  );
}
