"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { formatNumber } from "@/lib/format";
import { Plus, ShoppingCart, ArrowLeft, Calendar, Trash2 } from "lucide-react";
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
import { StatutCommande, UniteStock, Permission } from "@/types";
import type { CommandeListResponse } from "@/types";
import { useCreateCommande, useCommandesList } from "@/hooks/queries/use-stock-queries";

const statutVariants: Record<StatutCommande, "default" | "info" | "en_cours" | "warning"> = {
  [StatutCommande.BROUILLON]: "default",
  [StatutCommande.ENVOYEE]: "info",
  [StatutCommande.LIVREE]: "en_cours",
  [StatutCommande.ANNULEE]: "warning",
};

interface CommandeData {
  id: string;
  numero: string;
  statut: string;
  dateCommande: string;
  dateLivraison: string | null;
  montantTotal: number;
  fournisseur: { id: string; nom: string };
  user: { id: string; name: string };
  _count: { lignes: number };
}

interface LigneForm {
  produitId: string;
  quantite: string;
  prixUnitaire: string;
}

interface Props {
  commandes: CommandeData[];
  fournisseurs: { id: string; nom: string }[];
  produits: { id: string; nom: string; unite: string; uniteAchat: string | null; contenance: number | null; prixUnitaire: number }[];
  permissions: Permission[];
}

export function CommandesListClient({ commandes: initialCommandes, fournisseurs, produits, permissions }: Props) {
  const t = useTranslations("stock");
  const createCommandeMutation = useCreateCommande();
  const { data: commandesRaw = initialCommandes } = useCommandesList({
    initialData: initialCommandes as unknown as CommandeListResponse["commandes"],
  });
  const commandes = commandesRaw as unknown as CommandeData[];
  const [tab, setTab] = useState("tous");
  const [dialogOpen, setDialogOpen] = useState(false);

  // Form state
  const [fournisseurId, setFournisseurId] = useState("");
  const [dateCommande, setDateCommande] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [lignes, setLignes] = useState<LigneForm[]>([
    { produitId: "", quantite: "", prixUnitaire: "" },
  ]);

  const filtered =
    tab === "tous"
      ? commandes
      : commandes.filter((c) => c.statut === tab);

  function resetForm() {
    setFournisseurId("");
    setDateCommande(new Date().toISOString().split("T")[0]);
    setLignes([{ produitId: "", quantite: "", prixUnitaire: "" }]);
  }

  function addLigne() {
    setLignes([...lignes, { produitId: "", quantite: "", prixUnitaire: "" }]);
  }

  function removeLigne(index: number) {
    if (lignes.length <= 1) return;
    setLignes(lignes.filter((_, i) => i !== index));
  }

  function updateLigne(index: number, field: keyof LigneForm, value: string) {
    const updated = [...lignes];
    updated[index] = { ...updated[index], [field]: value };

    // Auto-fill price when product selected
    if (field === "produitId") {
      const produit = produits.find((p) => p.id === value);
      if (produit) {
        updated[index].prixUnitaire = String(produit.prixUnitaire);
      }
    }

    setLignes(updated);
  }

  const montantTotal = lignes.reduce((sum, l) => {
    return sum + (parseFloat(l.quantite) || 0) * (parseFloat(l.prixUnitaire) || 0);
  }, 0);

  const isValid =
    fournisseurId &&
    dateCommande &&
    lignes.every((l) => l.produitId && parseFloat(l.quantite) > 0 && parseFloat(l.prixUnitaire) >= 0);

  async function handleCreate() {
    if (!isValid) return;

    try {
      await createCommandeMutation.mutateAsync({
        fournisseurId,
        dateCommande,
        lignes: lignes.map((l) => ({
          produitId: l.produitId,
          quantite: parseFloat(l.quantite),
          prixUnitaire: parseFloat(l.prixUnitaire),
        })),
      });
      setDialogOpen(false);
      resetForm();
    } catch {
      // Error already handled by useApi toast
    }
  }

  const uniteLabel = (u: string) => t(`unites.${u}` as Parameters<typeof t>[0]) || u;
  const statutLabel = (s: string) => t(`statuts.${s}` as Parameters<typeof t>[0]) || s;

  return (
    <div className="flex flex-col gap-4">
      <Link
        href="/stock"
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors w-fit"
      >
        <ArrowLeft className="h-4 w-4" />
        {t("actions.back")}
      </Link>

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {t("commandes.count", { count: commandes.length })}
        </p>
        {permissions.includes(Permission.APPROVISIONNEMENT_GERER) && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-1" />
                {t("commandes.new")}
              </Button>
            </DialogTrigger>
          <DialogContent className="max-h-[90dvh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{t("commandes.add")}</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-4 py-2">
              <Select value={fournisseurId} onValueChange={setFournisseurId}>
                <SelectTrigger label={t("commandes.fields.fournisseur")}>
                  <SelectValue placeholder={t("commandes.fields.choix")} />
                </SelectTrigger>
                <SelectContent>
                  {fournisseurs.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.nom}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                label={t("commandes.fields.date")}
                type="date"
                value={dateCommande}
                onChange={(e) => setDateCommande(e.target.value)}
              />

              <div className="space-y-3">
                <p className="text-sm font-medium">{t("commandes.fields.lignes")}</p>
                {lignes.map((ligne, i) => {
                  const selectedProduit = produits.find(
                    (p) => p.id === ligne.produitId
                  );
                  const unite = selectedProduit
                    ? (selectedProduit.uniteAchat
                        ? uniteLabel(selectedProduit.uniteAchat)
                        : uniteLabel(selectedProduit.unite))
                    : "";
                  return (
                    <Card key={i}>
                      <CardContent className="p-3 flex flex-col gap-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">
                            {t("commandes.fields.ligne", { n: i + 1 })}
                          </span>
                          {lignes.length > 1 && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => removeLigne(i)}
                            >
                              <Trash2 className="h-3 w-3 text-danger" />
                            </Button>
                          )}
                        </div>
                        <Select
                          value={ligne.produitId}
                          onValueChange={(v) => updateLigne(i, "produitId", v)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder={t("commandes.fields.produit")} />
                          </SelectTrigger>
                          <SelectContent>
                            {produits.map((p) => (
                              <SelectItem key={p.id} value={p.id}>
                                {p.nom}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <div className="grid grid-cols-2 gap-2">
                          <Input
                            type="number"
                            placeholder={unite
                              ? t("commandes.lignes.qteWithUnit", { unit: unite })
                              : t("commandes.lignes.qtePlaceholder")}
                            value={ligne.quantite}
                            onChange={(e) =>
                              updateLigne(i, "quantite", e.target.value)
                            }
                          />
                          <Input
                            type="number"
                            placeholder={t("commandes.lignes.prixPlaceholder")}
                            value={ligne.prixUnitaire}
                            onChange={(e) =>
                              updateLigne(i, "prixUnitaire", e.target.value)
                            }
                          />
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={addLigne}
                  className="w-full"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  {t("commandes.lignes.add")}
                </Button>
              </div>

              {montantTotal > 0 && (
                <div className="text-right font-semibold">
                  {t("commandes.fields.total", { montant: formatNumber(montantTotal) })}
                </div>
              )}
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">{t("actions.cancel")}</Button>
              </DialogClose>
              <Button onClick={handleCreate} disabled={!isValid}>
                {t("actions.create")}
              </Button>
            </DialogFooter>
          </DialogContent>
          </Dialog>
        )}
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <div className="overflow-x-auto -mx-4 px-4">
          <TabsList className="w-max">
            <TabsTrigger value="tous">{t("commandes.tabs.all")}</TabsTrigger>
            {Object.values(StatutCommande).map((val) => (
              <TabsTrigger key={val} value={val}>
                {statutLabel(val)}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
        <TabsContent value={tab}>
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <ShoppingCart className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">{t("commandes.empty")}</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {filtered.map((c) => (
                <Link key={c.id} href={`/stock/commandes/${c.id}`}>
                  <Card className="hover:ring-1 hover:ring-primary/30 transition-all">
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between mb-2">
                        <p className="font-medium text-sm">{c.numero}</p>
                        <Badge variant={statutVariants[c.statut as StatutCommande]}>
                          {statutLabel(c.statut)}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground truncate">
                          {c.fournisseur.nom}
                        </span>
                        <span className="font-semibold shrink-0">
                          {formatNumber(c.montantTotal)} FCFA
                        </span>
                      </div>
                      <div className="flex items-center justify-between mt-1 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {new Date(c.dateCommande).toLocaleDateString("fr-FR")}
                        </div>
                        <span>
                          {c._count.lignes} ligne{c._count.lignes > 1 ? "s" : ""}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
