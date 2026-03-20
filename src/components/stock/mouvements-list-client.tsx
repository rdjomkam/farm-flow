"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Plus,
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  Calendar,
  ArrowUpDown,
} from "lucide-react";
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
import { TypeMouvement, UniteStock, Permission } from "@/types";
import { useStockService } from "@/services";

const uniteLabels: Record<string, string> = {
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
  produit: { id: string; nom: string; unite: string; uniteAchat: string | null; contenance: number | null };
  user: { id: string; name: string };
  vague: { id: string; code: string } | null;
  commande: { id: string; numero: string } | null;
}

interface Props {
  mouvements: MouvementData[];
  produits: { id: string; nom: string; unite: string }[];
  vagues: { id: string; code: string }[];
  permissions: Permission[];
}

export function MouvementsListClient({ mouvements, produits, vagues, permissions }: Props) {
  const router = useRouter();
  const stockService = useStockService();
  const [tab, setTab] = useState("tous");
  const [dialogOpen, setDialogOpen] = useState(false);

  // Form state
  const [produitId, setProduitId] = useState("");
  const [type, setType] = useState<string>(TypeMouvement.ENTREE);
  const [quantite, setQuantite] = useState("");
  const [prixTotal, setPrixTotal] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [vagueId, setVagueId] = useState("");
  const [notes, setNotes] = useState("");

  const filtered =
    tab === "tous"
      ? mouvements
      : mouvements.filter((m) => m.type === tab);

  function resetForm() {
    setProduitId("");
    setType(TypeMouvement.ENTREE);
    setQuantite("");
    setPrixTotal("");
    setDate(new Date().toISOString().split("T")[0]);
    setVagueId("");
    setNotes("");
  }

  async function handleCreate() {
    if (!produitId || !quantite) return;

    const result = await stockService.createMouvement({
      produitId,
      type: type as import("@/types").TypeMouvement,
      quantite: parseFloat(quantite),
      date,
      ...(prixTotal && { prixTotal: parseFloat(prixTotal) }),
      ...(vagueId && { vagueId }),
      ...(notes.trim() && { notes: notes.trim() }),
    });
    if (result.ok) {
      setDialogOpen(false);
      resetForm();
      router.refresh();
    }
  }

  const selectedProduit = produits.find((p) => p.id === produitId);

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
          {mouvements.length} mouvement{mouvements.length > 1 ? "s" : ""}
        </p>
        {permissions.includes(Permission.STOCK_GERER) && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-1" />
                Mouvement
              </Button>
            </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nouveau mouvement</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-4 py-2">
              <Select value={produitId} onValueChange={setProduitId}>
                <SelectTrigger label="Produit">
                  <SelectValue placeholder="Choisir un produit" />
                </SelectTrigger>
                <SelectContent>
                  {produits.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.nom}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger label="Type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={TypeMouvement.ENTREE}>Entree</SelectItem>
                  <SelectItem value={TypeMouvement.SORTIE}>Sortie</SelectItem>
                </SelectContent>
              </Select>
              <Input
                label={`Quantite${selectedProduit ? ` (${uniteLabels[selectedProduit.unite] ?? selectedProduit.unite})` : ""}`}
                type="number"
                placeholder="0"
                value={quantite}
                onChange={(e) => setQuantite(e.target.value)}
              />
              <Input
                label="Prix total (FCFA, optionnel)"
                type="number"
                placeholder="0"
                value={prixTotal}
                onChange={(e) => setPrixTotal(e.target.value)}
              />
              <Input
                label="Date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
              {vagues.length > 0 && (
                <Select value={vagueId} onValueChange={setVagueId}>
                  <SelectTrigger label="Vague (optionnel)">
                    <SelectValue placeholder="Aucune" />
                  </SelectTrigger>
                  <SelectContent>
                    {vagues.map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        {v.code}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <Input
                label="Notes (optionnel)"
                placeholder="Ex: Alimentation semaine 3"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">Annuler</Button>
              </DialogClose>
              <Button
                onClick={handleCreate}
                disabled={!produitId || !quantite}
              >
                Enregistrer
              </Button>
            </DialogFooter>
          </DialogContent>
          </Dialog>
        )}
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="tous">Tous</TabsTrigger>
          <TabsTrigger value={TypeMouvement.ENTREE}>Entrees</TabsTrigger>
          <TabsTrigger value={TypeMouvement.SORTIE}>Sorties</TabsTrigger>
        </TabsList>
        <TabsContent value={tab}>
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <ArrowUpDown className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Aucun mouvement</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {filtered.map((m) => {
                const isEntree = m.type === TypeMouvement.ENTREE;
                const uniteBase = uniteLabels[m.produit.unite] ?? m.produit.unite;
                const hasAchat = isEntree && m.produit.uniteAchat && m.produit.contenance;
                const displayUnite = hasAchat
                  ? (uniteLabels[m.produit.uniteAchat!] ?? m.produit.uniteAchat!)
                  : uniteBase;
                const equivalence = hasAchat
                  ? `${m.quantite * m.produit.contenance!} ${uniteBase}`
                  : null;
                return (
                  <Card key={m.id}>
                    <CardContent className="flex items-center gap-3 p-3">
                      <div className={`flex h-9 w-9 items-center justify-center rounded-full shrink-0 ${
                        isEntree ? "bg-success/10" : "bg-danger/10"
                      }`}>
                        {isEntree ? (
                          <TrendingUp className="h-4 w-4 text-success" />
                        ) : (
                          <TrendingDown className="h-4 w-4 text-danger" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm truncate">
                          {m.produit.nom}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Badge variant={isEntree ? "en_cours" : "warning"}>
                            {isEntree ? "+" : "-"}{m.quantite} {displayUnite}
                            {equivalence && ` (${equivalence})`}
                          </Badge>
                          {m.vague && (
                            <span className="text-xs text-muted-foreground">
                              {m.vague.code}
                            </span>
                          )}
                          {m.commande && (
                            <span className="text-xs text-muted-foreground">
                              {m.commande.numero}
                            </span>
                          )}
                        </div>
                        {m.notes && (
                          <p className="text-xs text-muted-foreground mt-0.5 truncate">
                            {m.notes}
                          </p>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          {new Date(m.date).toLocaleDateString("fr-FR")}
                        </div>
                        {m.prixTotal != null && (
                          <p className="text-xs text-muted-foreground">
                            {m.prixTotal.toLocaleString("fr-FR")} FCFA
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground">
                          {m.user.name}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
