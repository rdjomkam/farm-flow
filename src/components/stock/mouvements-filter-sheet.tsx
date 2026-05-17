"use client";

import { useState, useEffect, useMemo } from "react";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { SheetClose } from "@/components/ui/sheet";
import { MultiSelect } from "@/components/ui/multi-select";
import { SavedFiltersSection } from "@/components/filters/saved-filters-section";
import { TypeMouvement } from "@/types";

export interface MouvementFilterValues {
  search?: string;
  type?: string;
  produitId?: string;
  vagueId?: string;
  dateFrom?: string;
  dateTo?: string;
  montantMin?: string;
  montantMax?: string;
  hasCommande?: boolean;
}

interface Props {
  current: MouvementFilterValues;
  produits: { id: string; nom: string }[];
  vagues: { id: string; code: string }[];
  onApply: (filters: MouvementFilterValues) => void;
  onClear: () => void;
  activeCount: number;
}

function csvToArray(csv?: string): string[] {
  return csv ? csv.split(",").filter(Boolean) : [];
}

function arrayToCsv(arr: string[]): string | undefined {
  return arr.length > 0 ? arr.join(",") : undefined;
}

export function MouvementsFilterSheet({
  current,
  produits,
  vagues,
  onApply,
  onClear,
  activeCount,
}: Props) {
  const t = useTranslations("stock");
  const tCommon = useTranslations("common");

  const [localSearch, setLocalSearch] = useState(current.search ?? "");
  const [localTypes, setLocalTypes] = useState<string[]>(csvToArray(current.type));
  const [localProduitIds, setLocalProduitIds] = useState<string[]>(csvToArray(current.produitId));
  const [localVagueIds, setLocalVagueIds] = useState<string[]>(csvToArray(current.vagueId));
  const [localDateFrom, setLocalDateFrom] = useState(current.dateFrom ?? "");
  const [localDateTo, setLocalDateTo] = useState(current.dateTo ?? "");
  const [localMontantMin, setLocalMontantMin] = useState(current.montantMin ?? "");
  const [localMontantMax, setLocalMontantMax] = useState(current.montantMax ?? "");
  const [localHasCommande, setLocalHasCommande] = useState(current.hasCommande ?? false);

  function loadIntoForm(f: MouvementFilterValues) {
    setLocalSearch(f.search ?? "");
    setLocalTypes(csvToArray(f.type));
    setLocalProduitIds(csvToArray(f.produitId));
    setLocalVagueIds(csvToArray(f.vagueId));
    setLocalDateFrom(f.dateFrom ?? "");
    setLocalDateTo(f.dateTo ?? "");
    setLocalMontantMin(f.montantMin ?? "");
    setLocalMontantMax(f.montantMax ?? "");
    setLocalHasCommande(f.hasCommande ?? false);
  }

  useEffect(() => {
    loadIntoForm(current);
  }, [current]);

  const formFilters = useMemo<MouvementFilterValues>(() => {
    const f: MouvementFilterValues = {};
    if (localSearch) f.search = localSearch;
    const typeCsv = arrayToCsv(localTypes);
    if (typeCsv) f.type = typeCsv;
    const produitCsv = arrayToCsv(localProduitIds);
    if (produitCsv) f.produitId = produitCsv;
    const vagueCsv = arrayToCsv(localVagueIds);
    if (vagueCsv) f.vagueId = vagueCsv;
    if (localDateFrom) f.dateFrom = localDateFrom;
    if (localDateTo) f.dateTo = localDateTo;
    if (localMontantMin) f.montantMin = localMontantMin;
    if (localMontantMax) f.montantMax = localMontantMax;
    if (localHasCommande) f.hasCommande = true;
    return f;
  }, [localSearch, localTypes, localProduitIds, localVagueIds, localDateFrom, localDateTo, localMontantMin, localMontantMax, localHasCommande]);

  function handleApply() {
    onApply(formFilters);
  }

  const typeOptions = Object.values(TypeMouvement).map((s) => ({
    value: s,
    label: t(`types.${s}` as Parameters<typeof t>[0]),
  }));

  const produitOptions = produits.map((p) => ({ value: p.id, label: p.nom }));
  const vagueOptions = vagues.map((v) => ({ value: v.id, label: v.code }));

  return (
    <div className="flex flex-col h-full">
      <div
        className="shrink-0 flex items-center justify-between px-4 border-b border-border"
        style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))", paddingBottom: "0.75rem" }}
      >
        <h2 className="text-base font-semibold">{t("mouvements.filtres.titre")}</h2>
        <div className="flex items-center gap-2">
          {activeCount > 0 && (
            <button
              type="button"
              onClick={onClear}
              className="text-sm text-muted-foreground hover:text-foreground underline"
            >
              {t("mouvements.filtres.effacer")}
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

      <SavedFiltersSection
        page="mouvements"
        currentFilters={formFilters}
        onLoadFilter={(filters) => loadIntoForm(filters as MouvementFilterValues)}
        hasActiveFilters={activeCount > 0}
      />

      <div className="flex-1 overflow-y-auto overflow-x-hidden px-4 py-4 space-y-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium">{t("mouvements.filtres.recherche")}</label>
          <input
            type="text"
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            placeholder={t("mouvements.filtres.recherchePlaceholder")}
            className="h-10 rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium">{t("mouvements.filtres.type")}</label>
          <MultiSelect
            options={typeOptions}
            selected={localTypes}
            onChange={setLocalTypes}
            placeholder={t("mouvements.filtres.tousTypes")}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium">{t("mouvements.filtres.produit")}</label>
          <MultiSelect
            options={produitOptions}
            selected={localProduitIds}
            onChange={setLocalProduitIds}
            placeholder={t("mouvements.filtres.tousProduits")}
          />
        </div>

        {vagues.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">{t("mouvements.filtres.vague")}</label>
            <MultiSelect
              options={vagueOptions}
              selected={localVagueIds}
              onChange={setLocalVagueIds}
              placeholder={t("mouvements.filtres.toutesVagues")}
            />
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium">{t("mouvements.filtres.periode")}</label>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground w-5">{t("mouvements.filtres.du")}</span>
            <input
              type="date"
              value={localDateFrom}
              onChange={(e) => setLocalDateFrom(e.target.value)}
              className="flex-1 min-w-0 h-10 rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground w-5">{t("mouvements.filtres.au")}</span>
            <input
              type="date"
              value={localDateTo}
              onChange={(e) => setLocalDateTo(e.target.value)}
              className="flex-1 min-w-0 h-10 rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium">{t("mouvements.filtres.montant")}</label>
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

        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={localHasCommande}
            onChange={(e) => setLocalHasCommande(e.target.checked)}
            className="h-4 w-4 rounded border-border accent-primary cursor-pointer"
          />
          <span className="text-sm">{t("mouvements.filtres.hasCommande")}</span>
        </label>
      </div>

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
          {t("mouvements.filtres.effacer")}
        </button>
        <button
          type="button"
          onClick={handleApply}
          className="flex-1 h-10 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          {activeCount > 0
            ? t("mouvements.filtres.appliquer", { count: activeCount })
            : t("mouvements.filtres.appliquerSimple")}
        </button>
      </div>
    </div>
  );
}
