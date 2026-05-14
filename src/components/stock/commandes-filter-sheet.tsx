"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { SheetClose } from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const ALL_VALUE = "__all__";

export interface CommandeFilterValues {
  search?: string;
  fournisseurId?: string;
  userId?: string;
  produitId?: string;
  dateFrom?: string;
  dateTo?: string;
  montantMin?: string;
  montantMax?: string;
  hasFacture?: boolean;
  hasListeBesoins?: boolean;
}

interface Props {
  current: CommandeFilterValues;
  fournisseurs: { id: string; nom: string }[];
  users: { id: string; name: string }[];
  produits: { id: string; nom: string }[];
  onApply: (filters: CommandeFilterValues) => void;
  onClear: () => void;
  activeCount: number;
}

export function CommandesFilterSheet({
  current,
  fournisseurs,
  users,
  produits,
  onApply,
  onClear,
  activeCount,
}: Props) {
  const t = useTranslations("stock");
  const tCommon = useTranslations("common");

  const [localSearch, setLocalSearch] = useState(current.search ?? "");
  const [localFournisseurId, setLocalFournisseurId] = useState(current.fournisseurId ?? ALL_VALUE);
  const [localUserId, setLocalUserId] = useState(current.userId ?? ALL_VALUE);
  const [localProduitId, setLocalProduitId] = useState(current.produitId ?? ALL_VALUE);
  const [localDateFrom, setLocalDateFrom] = useState(current.dateFrom ?? "");
  const [localDateTo, setLocalDateTo] = useState(current.dateTo ?? "");
  const [localMontantMin, setLocalMontantMin] = useState(current.montantMin ?? "");
  const [localMontantMax, setLocalMontantMax] = useState(current.montantMax ?? "");
  const [localHasFacture, setLocalHasFacture] = useState(current.hasFacture ?? false);
  const [localHasListeBesoins, setLocalHasListeBesoins] = useState(current.hasListeBesoins ?? false);

  // Sync with current filters on external change
  useEffect(() => {
    setLocalSearch(current.search ?? "");
    setLocalFournisseurId(current.fournisseurId ?? ALL_VALUE);
    setLocalUserId(current.userId ?? ALL_VALUE);
    setLocalProduitId(current.produitId ?? ALL_VALUE);
    setLocalDateFrom(current.dateFrom ?? "");
    setLocalDateTo(current.dateTo ?? "");
    setLocalMontantMin(current.montantMin ?? "");
    setLocalMontantMax(current.montantMax ?? "");
    setLocalHasFacture(current.hasFacture ?? false);
    setLocalHasListeBesoins(current.hasListeBesoins ?? false);
  }, [current]);

  function handleApply() {
    const filters: CommandeFilterValues = {};
    if (localSearch) filters.search = localSearch;
    if (localFournisseurId !== ALL_VALUE) filters.fournisseurId = localFournisseurId;
    if (localUserId !== ALL_VALUE) filters.userId = localUserId;
    if (localProduitId !== ALL_VALUE) filters.produitId = localProduitId;
    if (localDateFrom) filters.dateFrom = localDateFrom;
    if (localDateTo) filters.dateTo = localDateTo;
    if (localMontantMin) filters.montantMin = localMontantMin;
    if (localMontantMax) filters.montantMax = localMontantMax;
    if (localHasFacture) filters.hasFacture = true;
    if (localHasListeBesoins) filters.hasListeBesoins = true;
    onApply(filters);
  }

  return (
    <div className="flex flex-col h-full">

      {/* Header fixe */}
      <div
        className="shrink-0 flex items-center justify-between px-4 border-b border-border"
        style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))", paddingBottom: "0.75rem" }}
      >
        <h2 className="text-base font-semibold">{t("commandes.filtres.titre")}</h2>
        <div className="flex items-center gap-2">
          {activeCount > 0 && (
            <button
              type="button"
              onClick={onClear}
              className="text-sm text-muted-foreground hover:text-foreground underline"
            >
              {t("commandes.filtres.effacer")}
            </button>
          )}
          <SheetClose asChild>
            <button
              type="button"
              className="h-10 w-10 flex items-center justify-center rounded-md hover:bg-accent transition-colors"
            >
              <X className="h-5 w-5" />
              <span className="sr-only">{tCommon("buttons.close")}</span>
            </button>
          </SheetClose>
        </div>
      </div>

      {/* Corps scrollable */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden px-4 py-4 space-y-4">

        {/* Recherche */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium">{t("commandes.filtres.recherche")}</label>
          <input
            type="text"
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            placeholder={t("commandes.filtres.recherchePlaceholder")}
            className="h-10 rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        {/* Fournisseur */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium">{t("commandes.filtres.fournisseur")}</label>
          <Select value={localFournisseurId} onValueChange={setLocalFournisseurId}>
            <SelectTrigger>
              <SelectValue placeholder={t("commandes.filtres.tousFournisseurs")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_VALUE}>{t("commandes.filtres.tousFournisseurs")}</SelectItem>
              {fournisseurs.map((f) => (
                <SelectItem key={f.id} value={f.id}>
                  {f.nom}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Cree par */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium">{t("commandes.filtres.creePar")}</label>
          <Select value={localUserId} onValueChange={setLocalUserId}>
            <SelectTrigger>
              <SelectValue placeholder={t("commandes.filtres.tousUtilisateurs")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_VALUE}>{t("commandes.filtres.tousUtilisateurs")}</SelectItem>
              {users.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Produit */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium">{t("commandes.filtres.produit")}</label>
          <Select value={localProduitId} onValueChange={setLocalProduitId}>
            <SelectTrigger>
              <SelectValue placeholder={t("commandes.filtres.tousProduits")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_VALUE}>{t("commandes.filtres.tousProduits")}</SelectItem>
              {produits.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.nom}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Periode */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium">{t("commandes.filtres.periode")}</label>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground w-5">{t("commandes.filtres.du")}</span>
            <input
              type="date"
              value={localDateFrom}
              onChange={(e) => setLocalDateFrom(e.target.value)}
              className="flex-1 min-w-0 h-10 rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground w-5">{t("commandes.filtres.au")}</span>
            <input
              type="date"
              value={localDateTo}
              onChange={(e) => setLocalDateTo(e.target.value)}
              className="flex-1 min-w-0 h-10 rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>

        {/* Montant */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium">{t("commandes.filtres.montant")}</label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min="0"
              step="any"
              value={localMontantMin}
              onChange={(e) => setLocalMontantMin(e.target.value)}
              placeholder={tCommon("placeholders.min")}
              className="flex-1 min-w-0 h-10 rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <span className="text-sm text-muted-foreground shrink-0">–</span>
            <input
              type="number"
              min="0"
              step="any"
              value={localMontantMax}
              onChange={(e) => setLocalMontantMax(e.target.value)}
              placeholder={tCommon("placeholders.max")}
              className="flex-1 min-w-0 h-10 rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>

        {/* Checkboxes */}
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={localHasFacture}
            onChange={(e) => setLocalHasFacture(e.target.checked)}
            className="h-4 w-4 rounded border-border accent-primary cursor-pointer"
          />
          <span className="text-sm">{t("commandes.filtres.hasFacture")}</span>
        </label>

        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={localHasListeBesoins}
            onChange={(e) => setLocalHasListeBesoins(e.target.checked)}
            className="h-4 w-4 rounded border-border accent-primary cursor-pointer"
          />
          <span className="text-sm">{t("commandes.filtres.hasListeBesoins")}</span>
        </label>

      </div>

      {/* Footer fixe */}
      <div
        className="shrink-0 flex gap-2 px-4 pt-3 border-t border-border"
        style={{
          paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))",
          paddingRight: "max(1rem, env(safe-area-inset-right))",
        }}
      >
        <button
          type="button"
          onClick={onClear}
          className="flex-1 h-10 rounded-md border border-border bg-background text-sm font-medium text-muted-foreground hover:bg-accent transition-colors"
        >
          {t("commandes.filtres.effacer")}
        </button>
        <button
          type="button"
          onClick={handleApply}
          className="flex-1 h-10 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          {activeCount > 0
            ? t("commandes.filtres.appliquer", { count: activeCount })
            : t("commandes.filtres.appliquerSimple")}
        </button>
      </div>

    </div>
  );
}
