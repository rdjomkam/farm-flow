"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useTranslations, useLocale } from "next-intl";
import { formatNumber } from "@/lib/format";
import { Plus, ShoppingCart, ArrowLeft, Calendar, Trash2, SlidersHorizontal, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
// Tabs removed — status filtering moved into the filter sheet
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
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
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { StatutCommande, Permission } from "@/types";
import type { Commande } from "@/types";
import { useCreateCommande, useCommandesList } from "@/hooks/queries/use-stock-queries";
import { useBesoinsForCommandeSelector } from "@/hooks/queries/use-depenses-queries";
import { CommandesFilterSheet } from "./commandes-filter-sheet";
import type { CommandeFilterValues } from "./commandes-filter-sheet";
import { SavedFiltersChips } from "@/components/filters/saved-filters-chips";

const statutVariants: Record<StatutCommande, "default" | "info" | "en_cours" | "warning"> = {
  [StatutCommande.BROUILLON]: "default",
  [StatutCommande.ENVOYEE]: "info",
  [StatutCommande.LIVREE_PARTIELLEMENT]: "warning",
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
  users: { id: string; name: string }[];
}

export function CommandesListClient({ commandes: initialCommandes, fournisseurs, produits, permissions, users }: Props) {
  const t = useTranslations("stock");
  const locale = useLocale();
  const createCommandeMutation = useCreateCommande();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [filters, setFilters] = useState<Record<string, string | number | boolean | undefined>>({});

  const { data: commandesRaw = initialCommandes } = useCommandesList({
    initialData: initialCommandes as unknown as Commande[],
    filters,
  });
  const commandes = commandesRaw as unknown as CommandeData[];

  // Besoins selector data
  const { data: besoinsForSelector = [] } = useBesoinsForCommandeSelector();

  // Form state
  const [selectedBesoinId, setSelectedBesoinId] = useState("");
  const [fournisseurId, setFournisseurId] = useState("");
  const [dateCommande, setDateCommande] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [lignes, setLignes] = useState<LigneForm[]>([
    { produitId: "", quantite: "", prixUnitaire: "" },
  ]);

  // Derived: selected besoin and linking mode
  const selectedBesoin = besoinsForSelector.find((b) => b.id === selectedBesoinId);
  const isLinkingMode = selectedBesoin && selectedBesoin.depenses.length > 0;

  // Auto-fill when besoin is selected
  useEffect(() => {
    if (!selectedBesoin) return;
    const newLignes = selectedBesoin.lignes
      .filter((lb) => lb.produitId && lb.produit)
      .map((lb) => ({
        produitId: lb.produitId!,
        quantite: String(lb.quantite),
        prixUnitaire: String(lb.prixEstime),
      }));
    if (newLignes.length > 0) setLignes(newLignes);
    // Auto-set fournisseur from first product
    const firstFournisseur = selectedBesoin.lignes[0]?.produit?.fournisseurId;
    if (firstFournisseur) setFournisseurId(firstFournisseur);
  }, [selectedBesoinId]); // eslint-disable-line react-hooks/exhaustive-deps

  const activeFilterCount = Object.entries(filters).filter(
    ([, val]) => val !== undefined && val !== ""
  ).length;

  const currentFilterValues: CommandeFilterValues = {
    statut: filters.statut as string | undefined,
    search: filters.search as string | undefined,
    fournisseurId: filters.fournisseurId as string | undefined,
    userId: filters.userId as string | undefined,
    produitId: filters.produitId as string | undefined,
    dateFrom: filters.dateFrom as string | undefined,
    dateTo: filters.dateTo as string | undefined,
    montantMin: filters.montantMin !== undefined ? String(filters.montantMin) : undefined,
    montantMax: filters.montantMax !== undefined ? String(filters.montantMax) : undefined,
    hasFacture: filters.hasFacture as boolean | undefined,
    hasListeBesoins: filters.hasListeBesoins as boolean | undefined,
  };

  function handleApplyFilters(sheetFilters: CommandeFilterValues) {
    const newFilters: Record<string, string | number | boolean | undefined> = {};
    if (sheetFilters.statut) newFilters.statut = sheetFilters.statut;
    if (sheetFilters.search) newFilters.search = sheetFilters.search;
    if (sheetFilters.fournisseurId) newFilters.fournisseurId = sheetFilters.fournisseurId;
    if (sheetFilters.userId) newFilters.userId = sheetFilters.userId;
    if (sheetFilters.produitId) newFilters.produitId = sheetFilters.produitId;
    if (sheetFilters.dateFrom) newFilters.dateFrom = sheetFilters.dateFrom;
    if (sheetFilters.dateTo) newFilters.dateTo = sheetFilters.dateTo;
    if (sheetFilters.montantMin) newFilters.montantMin = parseFloat(sheetFilters.montantMin);
    if (sheetFilters.montantMax) newFilters.montantMax = parseFloat(sheetFilters.montantMax);
    if (sheetFilters.hasFacture) newFilters.hasFacture = true;
    if (sheetFilters.hasListeBesoins) newFilters.hasListeBesoins = true;
    setFilters(newFilters);
    setSheetOpen(false);
  }

  function handleClearFilters() {
    setFilters({});
    setSheetOpen(false);
  }

  function resetForm() {
    setSelectedBesoinId("");
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
    selectedBesoinId &&
    fournisseurId &&
    dateCommande &&
    lignes.every((l) => l.produitId && parseFloat(l.quantite) > 0 && parseFloat(l.prixUnitaire) >= 0);

  async function handleCreate() {
    if (!isValid) return;

    try {
      await createCommandeMutation.mutateAsync({
        listeBesoinsId: selectedBesoinId,
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

      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {t("commandes.count", { count: commandes.length })}
        </p>
        <div className="flex items-center gap-2">
          {/* Filter button */}
          <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="sm" className="relative">
                <SlidersHorizontal className="h-4 w-4" />
                {activeFilterCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center">
                    {activeFilterCount}
                  </span>
                )}
              </Button>
            </SheetTrigger>
            <SheetContent
              className="!left-auto !right-0 !inset-y-0 !w-full sm:!w-96 !p-0 flex flex-col data-[state=open]:!slide-in-from-right data-[state=closed]:!slide-out-to-right"
              hideCloseButton
            >
              <CommandesFilterSheet
                current={currentFilterValues}
                fournisseurs={fournisseurs}
                users={users}
                produits={produits.map((p) => ({ id: p.id, nom: p.nom }))}
                onApply={handleApplyFilters}
                onClear={handleClearFilters}
                activeCount={activeFilterCount}
              />
            </SheetContent>
          </Sheet>

          {/* Create button */}
          {permissions.includes(Permission.APPROVISIONNEMENT_GERER) && (
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-1" />
                  {t("commandes.new")}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{t("commandes.add")}</DialogTitle>
                </DialogHeader>
                <DialogBody className="flex flex-col gap-4 py-2">
                  {/* Needs selector — required */}
                  <Select value={selectedBesoinId} onValueChange={setSelectedBesoinId}>
                    <SelectTrigger label={t("commandes.fields.besoin")}>
                      <SelectValue placeholder={t("commandes.fields.besoinPlaceholder")} />
                    </SelectTrigger>
                    <SelectContent>
                      {besoinsForSelector.length === 0 ? (
                        <div className="px-3 py-2 text-sm text-muted-foreground">
                          {t("commandes.fields.aucunBesoin")}
                        </div>
                      ) : (
                        besoinsForSelector.map((b) => (
                          <SelectItem key={b.id} value={b.id}>
                            <div className="flex flex-col">
                              <span className="font-medium">{b.numero} — {b.titre}</span>
                              <span className="text-xs text-muted-foreground">
                                {b._count.lignes} {b._count.lignes === 1 ? "ligne" : "lignes"} · ~{formatNumber(b.montantEstime)} F
                                {b.depenses.length > 0 && " · Achat direct"}
                              </span>
                            </div>
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>

                  {/* Linking mode banner */}
                  {isLinkingMode && (
                    <div className="flex items-start gap-2 rounded-md bg-accent-blue-muted/50 border border-accent-blue/20 px-3 py-2">
                      <Info className="h-4 w-4 text-accent-blue mt-0.5 shrink-0" />
                      <p className="text-xs text-accent-blue">
                        {t("commandes.linkingMode")}
                      </p>
                    </div>
                  )}

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
                </DialogBody>
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
      </div>

      <SavedFiltersChips
        page="commandes"
        onLoadFilter={(f) => handleApplyFilters(f as CommandeFilterValues)}
      />

      {commandes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <ShoppingCart className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">{t("commandes.empty")}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {commandes.map((c) => (
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
                      {new Date(c.dateCommande).toLocaleDateString(locale)}
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
    </div>
  );
}
