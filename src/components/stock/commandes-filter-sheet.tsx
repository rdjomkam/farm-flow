"use client";

import { useState, useEffect, useMemo } from "react";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { SheetClose } from "@/components/ui/sheet";
import { MultiSelect } from "@/components/ui/multi-select";
import { SavedFiltersSection } from "@/components/filters/saved-filters-section";
import { StatutCommande } from "@/types";

export interface CommandeFilterValues {
  statut?: string;
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

function csvToArray(csv?: string): string[] {
  return csv ? csv.split(",").filter(Boolean) : [];
}

function arrayToCsv(arr: string[]): string | undefined {
  return arr.length > 0 ? arr.join(",") : undefined;
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

  const [localStatuts, setLocalStatuts] = useState<string[]>(csvToArray(current.statut));
  const [localSearch, setLocalSearch] = useState(current.search ?? "");
  const [localFournisseurIds, setLocalFournisseurIds] = useState<string[]>(csvToArray(current.fournisseurId));
  const [localUserIds, setLocalUserIds] = useState<string[]>(csvToArray(current.userId));
  const [localProduitIds, setLocalProduitIds] = useState<string[]>(csvToArray(current.produitId));
  const [localDateFrom, setLocalDateFrom] = useState(current.dateFrom ?? "");
  const [localDateTo, setLocalDateTo] = useState(current.dateTo ?? "");
  const [localMontantMin, setLocalMontantMin] = useState(current.montantMin ?? "");
  const [localMontantMax, setLocalMontantMax] = useState(current.montantMax ?? "");
  const [localHasFacture, setLocalHasFacture] = useState(current.hasFacture ?? false);
  const [localHasListeBesoins, setLocalHasListeBesoins] = useState(current.hasListeBesoins ?? false);

  function loadIntoForm(f: CommandeFilterValues) {
    setLocalStatuts(csvToArray(f.statut));
    setLocalSearch(f.search ?? "");
    setLocalFournisseurIds(csvToArray(f.fournisseurId));
    setLocalUserIds(csvToArray(f.userId));
    setLocalProduitIds(csvToArray(f.produitId));
    setLocalDateFrom(f.dateFrom ?? "");
    setLocalDateTo(f.dateTo ?? "");
    setLocalMontantMin(f.montantMin ?? "");
    setLocalMontantMax(f.montantMax ?? "");
    setLocalHasFacture(f.hasFacture ?? false);
    setLocalHasListeBesoins(f.hasListeBesoins ?? false);
  }

  useEffect(() => {
    loadIntoForm(current);
  }, [current]);

  const formFilters = useMemo<CommandeFilterValues>(() => {
    const f: CommandeFilterValues = {};
    const statutCsv = arrayToCsv(localStatuts);
    if (statutCsv) f.statut = statutCsv;
    if (localSearch) f.search = localSearch;
    const fournisseurCsv = arrayToCsv(localFournisseurIds);
    if (fournisseurCsv) f.fournisseurId = fournisseurCsv;
    const userCsv = arrayToCsv(localUserIds);
    if (userCsv) f.userId = userCsv;
    const produitCsv = arrayToCsv(localProduitIds);
    if (produitCsv) f.produitId = produitCsv;
    if (localDateFrom) f.dateFrom = localDateFrom;
    if (localDateTo) f.dateTo = localDateTo;
    if (localMontantMin) f.montantMin = localMontantMin;
    if (localMontantMax) f.montantMax = localMontantMax;
    if (localHasFacture) f.hasFacture = true;
    if (localHasListeBesoins) f.hasListeBesoins = true;
    return f;
  }, [localStatuts, localSearch, localFournisseurIds, localUserIds, localProduitIds, localDateFrom, localDateTo, localMontantMin, localMontantMax, localHasFacture, localHasListeBesoins]);

  function handleApply() {
    onApply(formFilters);
  }

  const statutOptions = Object.values(StatutCommande).map((s) => ({
    value: s,
    label: t(`statuts.${s}` as Parameters<typeof t>[0]),
  }));

  const fournisseurOptions = fournisseurs.map((f) => ({ value: f.id, label: f.nom }));
  const userOptions = users.map((u) => ({ value: u.id, label: u.name }));
  const produitOptions = produits.map((p) => ({ value: p.id, label: p.nom }));

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

      {/* Saved filters */}
      <SavedFiltersSection
        page="commandes"
        currentFilters={formFilters}
        onLoadFilter={(filters) => loadIntoForm(filters as CommandeFilterValues)}
        hasActiveFilters={activeCount > 0}
      />

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

        {/* Statut */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium">{t("commandes.filtres.statut")}</label>
          <MultiSelect
            options={statutOptions}
            selected={localStatuts}
            onChange={setLocalStatuts}
            placeholder={t("commandes.filtres.tousStatuts")}
          />
        </div>

        {/* Fournisseur */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium">{t("commandes.filtres.fournisseur")}</label>
          <MultiSelect
            options={fournisseurOptions}
            selected={localFournisseurIds}
            onChange={setLocalFournisseurIds}
            placeholder={t("commandes.filtres.tousFournisseurs")}
          />
        </div>

        {/* Cree par */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium">{t("commandes.filtres.creePar")}</label>
          <MultiSelect
            options={userOptions}
            selected={localUserIds}
            onChange={setLocalUserIds}
            placeholder={t("commandes.filtres.tousUtilisateurs")}
          />
        </div>

        {/* Produit */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium">{t("commandes.filtres.produit")}</label>
          <MultiSelect
            options={produitOptions}
            selected={localProduitIds}
            onChange={setLocalProduitIds}
            placeholder={t("commandes.filtres.tousProduits")}
          />
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
