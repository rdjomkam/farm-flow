"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { queryKeys } from "@/lib/query-keys";
import { useTranslations } from "next-intl";
import { formatNum } from "@/lib/format";
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
import { CategorieProduit, UniteStock, TypeMouvement } from "@/types";
import { useStockService } from "@/services";

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
  const t = useTranslations("stock");
  const queryClient = useQueryClient();
  const stockService = useStockService();
  const [editOpen, setEditOpen] = useState(false);

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
  const uniteLabel = (u: string) => t(`unites.${u}` as Parameters<typeof t>[0]) || u;
  const categorieLabel = (c: string) => t(`categories.${c}` as Parameters<typeof t>[0]) || c;
  const baseUniteLabel = uniteLabel(produit.unite);

  async function handleSave() {
    const result = await stockService.updateProduit(produit.id, {
      nom: nom.trim(),
      categorie: categorie as import("@/types").CategorieProduit,
      unite: unite as import("@/types").UniteStock,
      prixUnitaire: parseFloat(prixUnitaire) || 0,
      seuilAlerte: parseFloat(seuilAlerte) || 0,
      fournisseurId: fournisseurId || null,
      uniteAchat: dualUnit && uniteAchat ? uniteAchat as import("@/types").UniteStock : null,
      contenance: dualUnit && contenance ? parseFloat(contenance) : null,
    });
    if (result.ok) {
      setEditOpen(false);
      queryClient.invalidateQueries({ queryKey: queryKeys.produits.all });
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Link
        href="/stock/produits"
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors w-fit"
      >
        <ArrowLeft className="h-4 w-4" />
        {t("produits.title")}
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
                  {categorieLabel(produit.categorie)}
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
                  <DialogTitle>{t("produits.edit")}</DialogTitle>
                </DialogHeader>
                <div className="flex flex-col gap-4 py-2">
                  <Input
                    label={t("produits.fields.name")}
                    value={nom}
                    onChange={(e) => setNom(e.target.value)}
                  />
                  <Select value={categorie} onValueChange={setCategorie}>
                    <SelectTrigger label={t("produits.fields.categorie")}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.values(CategorieProduit).map((val) => (
                        <SelectItem key={val} value={val}>{categorieLabel(val)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={unite} onValueChange={setUnite}>
                    <SelectTrigger label={t("produits.fields.uniteBase")}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.values(UniteStock).map((val) => (
                        <SelectItem key={val} value={val}>{uniteLabel(val)}</SelectItem>
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
                              <SelectItem key={val} value={val}>{uniteLabel(val)}</SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                      <div>
                        <Input
                          label={t("produits.fields.contenance", {
                            baseUnit: uniteLabel(unite),
                            achatUnit: uniteAchat ? uniteLabel(uniteAchat) : t("produits.fields.contenanceUnit"),
                          })}
                          type="number"
                          placeholder="Ex: 25"
                          value={contenance}
                          onChange={(e) => setContenance(e.target.value)}
                          disabled={contenanceDisabled}
                        />
                        {contenanceDisabled && (
                          <p className="text-xs text-warning mt-1">
                            {t("produits.detail.contenanceNotEditable")}
                          </p>
                        )}
                      </div>
                    </>
                  )}
                  <Input
                    label={t("produits.fields.prixUnitaire")}
                    type="number"
                    value={prixUnitaire}
                    onChange={(e) => setPrixUnitaire(e.target.value)}
                  />
                  <Input
                    label={t("produits.fields.seuilAlerte")}
                    type="number"
                    value={seuilAlerte}
                    onChange={(e) => setSeuilAlerte(e.target.value)}
                  />
                  <Select value={fournisseurId} onValueChange={setFournisseurId}>
                    <SelectTrigger label={t("produits.fields.fournisseurRequired")}>
                      <SelectValue placeholder={t("produits.fields.fournisseurNone")} />
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
                    <Button variant="outline">{t("actions.cancel")}</Button>
                  </DialogClose>
                  <Button onClick={handleSave} disabled={!nom.trim()}>
                    {t("actions.save")}
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
              <p className="text-xs text-muted-foreground">
                {t("produits.detail.inStock", { unit: baseUniteLabel })}
              </p>
              {produit.uniteAchat && produit.contenance && produit.contenance > 0 && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  {"\u2248 "}{Math.round((produit.stockActuel / produit.contenance) * 10) / 10} {uniteLabel(produit.uniteAchat)}
                </p>
              )}
            </div>
            <div className="rounded-lg bg-muted/50 p-3 text-center">
              <p className="text-2xl font-bold">
                {formatNum(produit.prixUnitaire)}
              </p>
              <p className="text-xs text-muted-foreground">FCFA / {baseUniteLabel}</p>
            </div>
          </div>

          {isAlerte && (
            <div className="mt-3 flex items-center gap-2 rounded-lg bg-warning/10 p-2 text-sm text-warning">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {t("produits.detail.alerteMessage", { seuil: produit.seuilAlerte, unit: baseUniteLabel })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Mouvements recents */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">{t("produits.detail.derniersMovements")}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {produit.mouvements.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">
              {t("produits.detail.noMovement")}
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
                        {isEntree ? "+" : "-"}{m.quantite} {baseUniteLabel}
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
                        {new Date(m.date).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}
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
          {t("produits.detail.voirMovements")}
        </Button>
      </Link>
    </div>
  );
}
