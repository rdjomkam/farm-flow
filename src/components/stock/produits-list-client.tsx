"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Plus, Package, AlertTriangle, ArrowLeft } from "lucide-react";
import { formatXAF, formatNum } from "@/lib/format";
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
import { EmptyState } from "@/components/ui/empty-state";
import { CategorieProduit, UniteStock, Permission } from "@/types";
import { useCreateProduit } from "@/hooks/queries/use-stock-queries";

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
  const t = useTranslations("stock");
  const createProduitMutation = useCreateProduit();
  const [tab, setTab] = useState("tous");
  const [dialogOpen, setDialogOpen] = useState(false);

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

    try {
      await createProduitMutation.mutateAsync({
        nom: nom.trim(),
        categorie: categorie as import("@/types").CategorieProduit,
        unite: unite as import("@/types").UniteStock,
        prixUnitaire: parseFloat(prixUnitaire) || 0,
        seuilAlerte: parseFloat(seuilAlerte) || 0,
        ...(fournisseurId && { fournisseurId }),
        ...(dualUnit && uniteAchat && { uniteAchat: uniteAchat as import("@/types").UniteStock }),
        ...(dualUnit && contenance && { contenance: parseFloat(contenance) }),
      });
      setDialogOpen(false);
      resetForm();
    } catch {
      // Error already handled by useApi toast
    }
  }

  const uniteLabel = (u: string) => t(`unites.${u}` as Parameters<typeof t>[0]) || u;
  const categorieLabel = (c: string) => t(`categories.${c}` as Parameters<typeof t>[0]) || c;

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
          {t("produits.count", { count: produits.length })}
        </p>
        {permissions.includes(Permission.STOCK_GERER) && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-1" />
                {t("produits.new")}
              </Button>
            </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("produits.add")}</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-4 py-2">
              <Input
                label={t("produits.fields.name")}
                placeholder={t("produits.fields.namePlaceholder")}
                value={nom}
                onChange={(e) => setNom(e.target.value)}
                autoFocus
              />
              <Select value={categorie} onValueChange={setCategorie}>
                <SelectTrigger label={t("produits.fields.categorie")}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.values(CategorieProduit).map((val) => (
                    <SelectItem key={val} value={val}>
                      {categorieLabel(val)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={unite} onValueChange={setUnite}>
                <SelectTrigger label={t("produits.fields.uniteBase")}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.values(UniteStock).map((val) => (
                    <SelectItem key={val} value={val}>
                      {uniteLabel(val)}
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
                {t("produits.fields.dualUnit")}
              </label>
              {dualUnit && (
                <>
                  <Select value={uniteAchat} onValueChange={setUniteAchat}>
                    <SelectTrigger label={t("produits.fields.uniteAchat")}>
                      <SelectValue placeholder={t("commandes.fields.choix")} />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.values(UniteStock)
                        .filter((val) => val !== unite)
                        .map((val) => (
                          <SelectItem key={val} value={val}>
                            {uniteLabel(val)}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  <Input
                    label={t("produits.fields.contenance", {
                      baseUnit: uniteLabel(unite),
                      achatUnit: uniteAchat ? uniteLabel(uniteAchat) : t("produits.fields.contenanceUnit"),
                    })}
                    type="number"
                    placeholder="Ex: 25"
                    value={contenance}
                    onChange={(e) => setContenance(e.target.value)}
                  />
                </>
              )}
              <Input
                label={t("produits.fields.prixUnitaire")}
                type="number"
                placeholder="0"
                value={prixUnitaire}
                onChange={(e) => setPrixUnitaire(e.target.value)}
              />
              <Input
                label={t("produits.fields.seuilAlerte")}
                type="number"
                placeholder="0"
                value={seuilAlerte}
                onChange={(e) => setSeuilAlerte(e.target.value)}
              />
              {fournisseurs.length > 0 && (
                <Select value={fournisseurId} onValueChange={setFournisseurId}>
                  <SelectTrigger label={t("produits.fields.fournisseur")}>
                    <SelectValue placeholder={t("produits.fields.fournisseurNone")} />
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
                <Button variant="outline">{t("actions.cancel")}</Button>
              </DialogClose>
              <Button onClick={handleCreate} disabled={!nom.trim()}>
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
            <TabsTrigger value="tous">{t("produits.tabs.all")}</TabsTrigger>
            {Object.values(CategorieProduit).map((val) => (
              <TabsTrigger key={val} value={val}>
                {categorieLabel(val)}
              </TabsTrigger>
            ))}
            {alerteCount > 0 && (
              <TabsTrigger value="alerte">
                {t("produits.tabs.alerts", { count: alerteCount })}
              </TabsTrigger>
            )}
          </TabsList>
        </div>
        <TabsContent value={tab}>
          {filtered.length === 0 ? (
            <EmptyState
              icon={<Package className="h-7 w-7" />}
              title={t("produits.empty")}
              description={t("produits.emptyDescription")}
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
                              {categorieLabel(p.categorie)}
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
                            {formatNum(p.stockActuel)} {uniteLabel(p.unite)}
                          </p>
                          {p.uniteAchat && p.contenance && p.contenance > 0 && (
                            <p className="text-xs text-muted-foreground">
                              1 {uniteLabel(p.uniteAchat)} = {p.contenance} {uniteLabel(p.unite)}
                            </p>
                          )}
                          <p className="text-xs text-muted-foreground">
                            {formatXAF(p.prixUnitaire)}
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
