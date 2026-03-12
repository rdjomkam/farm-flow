"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, Package, AlertTriangle, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
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
import { EmptyState } from "@/components/ui/empty-state";
import { CategorieProduit, UniteStock, Permission } from "@/types";

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
  _count: { mouvements: number };
}

interface Props {
  produits: ProduitData[];
  fournisseurs: { id: string; nom: string }[];
  permissions: Permission[];
}

export function ProduitsListClient({ produits, fournisseurs, permissions }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [tab, setTab] = useState("tous");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  // Form state
  const [nom, setNom] = useState("");
  const [categorie, setCategorie] = useState<string>(CategorieProduit.ALIMENT);
  const [unite, setUnite] = useState<string>(UniteStock.KG);
  const [prixUnitaire, setPrixUnitaire] = useState("");
  const [seuilAlerte, setSeuilAlerte] = useState("");
  const [fournisseurId, setFournisseurId] = useState("");
  const [dualUnit, setDualUnit] = useState(false);
  const [uniteAchat, setUniteAchat] = useState<string>("");
  const [contenance, setContenance] = useState("");

  const filtered =
    tab === "tous"
      ? produits
      : tab === "alerte"
        ? produits.filter((p) => p.stockActuel <= p.seuilAlerte)
        : produits.filter((p) => p.categorie === tab);

  const alerteCount = produits.filter(
    (p) => p.stockActuel <= p.seuilAlerte
  ).length;

  function resetForm() {
    setNom("");
    setCategorie(CategorieProduit.ALIMENT);
    setUnite(UniteStock.KG);
    setPrixUnitaire("");
    setSeuilAlerte("");
    setFournisseurId("");
    setDualUnit(false);
    setUniteAchat("");
    setContenance("");
  }

  async function handleCreate() {
    if (!nom.trim()) return;

    setCreating(true);
    try {
      const res = await fetch("/api/produits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nom: nom.trim(),
          categorie,
          unite,
          prixUnitaire: parseFloat(prixUnitaire) || 0,
          seuilAlerte: parseFloat(seuilAlerte) || 0,
          ...(fournisseurId && { fournisseurId }),
          ...(dualUnit && uniteAchat && { uniteAchat }),
          ...(dualUnit && contenance && { contenance: parseFloat(contenance) }),
        }),
      });

      if (res.ok) {
        toast({ title: "Produit cree", variant: "success" });
        setDialogOpen(false);
        resetForm();
        router.refresh();
      } else {
        const data = await res.json();
        toast({ title: data.message || "Erreur", variant: "error" });
      }
    } catch {
      toast({ title: "Erreur reseau", variant: "error" });
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Link
        href="/stock"
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors w-fit"
      >
        <ArrowLeft className="h-4 w-4" />
        Stock
      </Link>

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {produits.length} produit{produits.length > 1 ? "s" : ""}
        </p>
        {permissions.includes(Permission.STOCK_GERER) && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-1" />
                Nouveau
              </Button>
            </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Ajouter un produit</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-4 py-2">
              <Input
                label="Nom du produit"
                placeholder="Ex: Aliment Raanan 3mm"
                value={nom}
                onChange={(e) => setNom(e.target.value)}
                autoFocus
              />
              <Select value={categorie} onValueChange={setCategorie}>
                <SelectTrigger label="Categorie">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(categorieLabels).map(([val, label]) => (
                    <SelectItem key={val} value={val}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={unite} onValueChange={setUnite}>
                <SelectTrigger label="Unite de base">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(uniteLabels).map(([val, label]) => (
                    <SelectItem key={val} value={val}>
                      {label}
                    </SelectItem>
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
                          <SelectItem key={val} value={val}>
                            {label}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  <Input
                    label={`Contenance (${uniteLabels[unite as UniteStock] ?? unite} par ${uniteAchat ? (uniteLabels[uniteAchat as UniteStock] ?? uniteAchat) : "unite d'achat"})`}
                    type="number"
                    placeholder="Ex: 25"
                    value={contenance}
                    onChange={(e) => setContenance(e.target.value)}
                  />
                </>
              )}
              <Input
                label="Prix unitaire (FCFA)"
                type="number"
                placeholder="0"
                value={prixUnitaire}
                onChange={(e) => setPrixUnitaire(e.target.value)}
              />
              <Input
                label="Seuil d'alerte"
                type="number"
                placeholder="0"
                value={seuilAlerte}
                onChange={(e) => setSeuilAlerte(e.target.value)}
              />
              {fournisseurs.length > 0 && (
                <Select value={fournisseurId} onValueChange={setFournisseurId}>
                  <SelectTrigger label="Fournisseur (optionnel)">
                    <SelectValue placeholder="Aucun" />
                  </SelectTrigger>
                  <SelectContent>
                    {fournisseurs.map((f) => (
                      <SelectItem key={f.id} value={f.id}>
                        {f.nom}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">Annuler</Button>
              </DialogClose>
              <Button onClick={handleCreate} disabled={creating || !nom.trim()}>
                {creating ? "Creation..." : "Creer"}
              </Button>
            </DialogFooter>
          </DialogContent>
          </Dialog>
        )}
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <div className="overflow-x-auto -mx-4 px-4">
          <TabsList className="w-max">
            <TabsTrigger value="tous">Tous</TabsTrigger>
            {Object.entries(categorieLabels).map(([val, label]) => (
              <TabsTrigger key={val} value={val}>
                {label}
              </TabsTrigger>
            ))}
            {alerteCount > 0 && (
              <TabsTrigger value="alerte">
                Alertes ({alerteCount})
              </TabsTrigger>
            )}
          </TabsList>
        </div>
        <TabsContent value={tab}>
          {filtered.length === 0 ? (
            <EmptyState
              icon={<Package className="h-7 w-7" />}
              title="Aucun produit"
              description="Ajoutez un produit pour gerer votre stock."
            />
          ) : (
            <div className="flex flex-col gap-2">
              {filtered.map((p) => {
                const isAlerte = p.stockActuel <= p.seuilAlerte;
                return (
                  <Link key={p.id} href={`/stock/produits/${p.id}`}>
                    <Card className="hover:ring-1 hover:ring-primary/30 transition-all">
                      <CardContent className="flex items-center gap-3 p-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-medium truncate">{p.nom}</p>
                            {isAlerte && (
                              <AlertTriangle className="h-4 w-4 text-warning shrink-0" />
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="default">
                              {categorieLabels[p.categorie as CategorieProduit] ?? p.categorie}
                            </Badge>
                            {p.fournisseur && (
                              <span className="text-xs text-muted-foreground truncate">
                                {p.fournisseur.nom}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-bold">
                            {p.stockActuel} {uniteLabels[p.unite as UniteStock] ?? p.unite}
                          </p>
                          {p.uniteAchat && p.contenance && p.contenance > 0 && (
                            <p className="text-xs text-muted-foreground">
                              1 {uniteLabels[p.uniteAchat as UniteStock] ?? p.uniteAchat} = {p.contenance} {uniteLabels[p.unite as UniteStock] ?? p.unite}
                            </p>
                          )}
                          <p className="text-xs text-muted-foreground">
                            {p.prixUnitaire.toLocaleString("fr-FR")} FCFA
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
