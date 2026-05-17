"use client";

import { useState, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { queryKeys } from "@/lib/query-keys";
import { useTranslations } from "next-intl";
import { formatNumber, formatDateTime } from "@/lib/format";
import {
  Plus,
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  Calendar,
  ArrowUpDown,
  SlidersHorizontal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import { TypeMouvement, Permission } from "@/types";
import { useStockService } from "@/services";
import { MouvementsFilterSheet } from "./mouvements-filter-sheet";
import type { MouvementFilterValues } from "./mouvements-filter-sheet";
import { SavedFiltersChips } from "@/components/filters/saved-filters-chips";

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
  const t = useTranslations("stock");
  const queryClient = useQueryClient();
  const stockService = useStockService();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [filters, setFilters] = useState<MouvementFilterValues>({});

  // Form state
  const [produitId, setProduitId] = useState("");
  const [type, setType] = useState<string>(TypeMouvement.ENTREE);
  const [quantite, setQuantite] = useState("");
  const [prixTotal, setPrixTotal] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [vagueId, setVagueId] = useState("");
  const [notes, setNotes] = useState("");

  const activeFilterCount = Object.entries(filters).filter(
    ([, val]) => val !== undefined && val !== "" && val !== false
  ).length;

  const filtered = useMemo(() => {
    let result = mouvements;

    if (filters.search) {
      const q = filters.search.toLowerCase();
      result = result.filter(
        (m) =>
          m.produit.nom.toLowerCase().includes(q) ||
          (m.notes && m.notes.toLowerCase().includes(q)) ||
          (m.vague && m.vague.code.toLowerCase().includes(q)) ||
          (m.commande && m.commande.numero.toLowerCase().includes(q))
      );
    }

    if (filters.type) {
      const types = filters.type.split(",");
      result = result.filter((m) => types.includes(m.type));
    }

    if (filters.produitId) {
      const ids = filters.produitId.split(",");
      result = result.filter((m) => ids.includes(m.produit.id));
    }

    if (filters.vagueId) {
      const ids = filters.vagueId.split(",");
      result = result.filter((m) => m.vague && ids.includes(m.vague.id));
    }

    if (filters.dateFrom) {
      const from = new Date(filters.dateFrom).getTime();
      result = result.filter((m) => new Date(m.date).getTime() >= from);
    }

    if (filters.dateTo) {
      const to = new Date(filters.dateTo).getTime() + 86400000;
      result = result.filter((m) => new Date(m.date).getTime() < to);
    }

    if (filters.montantMin) {
      const min = parseFloat(filters.montantMin);
      result = result.filter((m) => m.prixTotal != null && m.prixTotal >= min);
    }

    if (filters.montantMax) {
      const max = parseFloat(filters.montantMax);
      result = result.filter((m) => m.prixTotal != null && m.prixTotal <= max);
    }

    if (filters.hasCommande) {
      result = result.filter((m) => m.commande != null);
    }

    return result;
  }, [mouvements, filters]);

  function handleApplyFilters(sheetFilters: MouvementFilterValues) {
    setFilters(sheetFilters);
    setSheetOpen(false);
  }

  function handleClearFilters() {
    setFilters({});
    setSheetOpen(false);
  }

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
      queryClient.invalidateQueries({ queryKey: queryKeys.stock.mouvements() });
      queryClient.invalidateQueries({ queryKey: queryKeys.produits.all });
    }
  }

  const selectedProduit = produits.find((p) => p.id === produitId);
  const uniteLabel = (u: string) => t(`unites.${u}` as Parameters<typeof t>[0]) || u;

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
          {t("mouvements.count", { count: filtered.length })}
        </p>
        <div className="flex items-center gap-2">
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
              <MouvementsFilterSheet
                current={filters}
                produits={produits.map((p) => ({ id: p.id, nom: p.nom }))}
                vagues={vagues}
                onApply={handleApplyFilters}
                onClear={handleClearFilters}
                activeCount={activeFilterCount}
              />
            </SheetContent>
          </Sheet>

          {permissions.includes(Permission.STOCK_GERER) && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-1" />
                {t("mouvements.new")}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t("mouvements.add")}</DialogTitle>
              </DialogHeader>
              <DialogBody>
              <div className="flex flex-col gap-4 py-2">
              <Select value={produitId} onValueChange={setProduitId}>
                <SelectTrigger label={t("mouvements.fields.produit")}>
                  <SelectValue placeholder={t("mouvements.fields.produitPlaceholder")} />
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
                <SelectTrigger label={t("mouvements.fields.type")}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={TypeMouvement.ENTREE}>{t("types.ENTREE")}</SelectItem>
                  <SelectItem value={TypeMouvement.SORTIE}>{t("types.SORTIE")}</SelectItem>
                </SelectContent>
              </Select>
              <Input
                label={selectedProduit
                  ? t("mouvements.fields.quantiteWithUnit", { unit: uniteLabel(selectedProduit.unite) })
                  : t("mouvements.fields.quantite")}
                type="number"
                placeholder="0"
                value={quantite}
                onChange={(e) => setQuantite(e.target.value)}
              />
              <Input
                label={t("mouvements.fields.prixTotal")}
                type="number"
                placeholder="0"
                value={prixTotal}
                onChange={(e) => setPrixTotal(e.target.value)}
              />
              <Input
                label={t("mouvements.fields.date")}
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
              {vagues.length > 0 && (
                <Select value={vagueId} onValueChange={setVagueId}>
                  <SelectTrigger label={t("mouvements.fields.vague")}>
                    <SelectValue placeholder={t("mouvements.fields.vagueNone")} />
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
                label={t("mouvements.fields.notes")}
                placeholder={t("mouvements.fields.notesPlaceholder")}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
              </div>
              </DialogBody>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline">{t("actions.cancel")}</Button>
                </DialogClose>
                <Button
                  onClick={handleCreate}
                  disabled={!produitId || !quantite}
                >
                  {t("mouvements.save")}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          )}
        </div>
      </div>

      <SavedFiltersChips
        page="mouvements"
        onLoadFilter={(f) => setFilters(f as MouvementFilterValues)}
      />

      {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <ArrowUpDown className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">{t("mouvements.empty")}</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {filtered.map((m) => {
                const isEntree = m.type === TypeMouvement.ENTREE;
                const uniteBase = uniteLabel(m.produit.unite);
                const hasAchat = isEntree && m.produit.uniteAchat && m.produit.contenance;
                const displayUnite = hasAchat
                  ? uniteLabel(m.produit.uniteAchat!)
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
                        <p className="font-medium text-sm break-words">
                          {m.produit.nom}
                        </p>
                        <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                          <Badge variant={isEntree ? "en_cours" : "warning"}>
                            {isEntree ? "+" : "-"}{m.quantite} {displayUnite}
                            {equivalence && ` (${equivalence})`}
                          </Badge>
                          {m.vague && (
                            <Badge variant="default" className="text-xs">
                              {m.vague.code}
                            </Badge>
                          )}
                          {m.commande && (
                            <Badge variant="info" className="text-xs">
                              {m.commande.numero}
                            </Badge>
                          )}
                        </div>
                        {m.notes && (
                          <p className="text-xs text-muted-foreground mt-0.5 break-words line-clamp-2">
                            {m.notes}
                          </p>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          {formatDateTime(m.date)}
                        </div>
                        {m.prixTotal != null && (
                          <p className="text-xs text-muted-foreground">
                            {formatNumber(m.prixTotal)} FCFA
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
    </div>
  );
}
