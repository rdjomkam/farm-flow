"use client";

import { useState, useEffect, useMemo } from "react";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { SheetClose } from "@/components/ui/sheet";
import { MultiSelect } from "@/components/ui/multi-select";
import { SavedFiltersSection } from "@/components/filters/saved-filters-section";
import { StatutDepense, CategorieDepense } from "@/types";

export interface DepenseFilterValues {
  search?: string;
  statut?: string;
  categorie?: string;
  vagueId?: string;
  commandeId?: string;
  dateFrom?: string;
  dateTo?: string;
  montantMin?: string;
  montantMax?: string;
}

interface Props {
  current: DepenseFilterValues;
  vagues: { id: string; code: string }[];
  commandes: { id: string; numero: string }[];
  onApply: (filters: DepenseFilterValues) => void;
  onClear: () => void;
  activeCount: number;
}

function csvToArray(csv?: string): string[] {
  return csv ? csv.split(",").filter(Boolean) : [];
}

function arrayToCsv(arr: string[]): string | undefined {
  return arr.length > 0 ? arr.join(",") : undefined;
}

export function DepensesFilterSheet({
  current,
  vagues,
  commandes,
  onApply,
  onClear,
  activeCount,
}: Props) {
  const t = useTranslations("depenses");
  const tCommon = useTranslations("common");

  const [localSearch, setLocalSearch] = useState(current.search ?? "");
  const [localStatuts, setLocalStatuts] = useState<string[]>(csvToArray(current.statut));
  const [localCategories, setLocalCategories] = useState<string[]>(csvToArray(current.categorie));
  const [localVagueIds, setLocalVagueIds] = useState<string[]>(csvToArray(current.vagueId));
  const [localCommandeIds, setLocalCommandeIds] = useState<string[]>(csvToArray(current.commandeId));
  const [localDateFrom, setLocalDateFrom] = useState(current.dateFrom ?? "");
  const [localDateTo, setLocalDateTo] = useState(current.dateTo ?? "");
  const [localMontantMin, setLocalMontantMin] = useState(current.montantMin ?? "");
  const [localMontantMax, setLocalMontantMax] = useState(current.montantMax ?? "");

  function loadIntoForm(f: DepenseFilterValues) {
    setLocalSearch(f.search ?? "");
    setLocalStatuts(csvToArray(f.statut));
    setLocalCategories(csvToArray(f.categorie));
    setLocalVagueIds(csvToArray(f.vagueId));
    setLocalCommandeIds(csvToArray(f.commandeId));
    setLocalDateFrom(f.dateFrom ?? "");
    setLocalDateTo(f.dateTo ?? "");
    setLocalMontantMin(f.montantMin ?? "");
    setLocalMontantMax(f.montantMax ?? "");
  }

  useEffect(() => {
    loadIntoForm(current);
  }, [current]);

  const formFilters = useMemo<DepenseFilterValues>(() => {
    const f: DepenseFilterValues = {};
    if (localSearch) f.search = localSearch;
    const statutCsv = arrayToCsv(localStatuts);
    if (statutCsv) f.statut = statutCsv;
    const categorieCsv = arrayToCsv(localCategories);
    if (categorieCsv) f.categorie = categorieCsv;
    const vagueCsv = arrayToCsv(localVagueIds);
    if (vagueCsv) f.vagueId = vagueCsv;
    const commandeCsv = arrayToCsv(localCommandeIds);
    if (commandeCsv) f.commandeId = commandeCsv;
    if (localDateFrom) f.dateFrom = localDateFrom;
    if (localDateTo) f.dateTo = localDateTo;
    if (localMontantMin) f.montantMin = localMontantMin;
    if (localMontantMax) f.montantMax = localMontantMax;
    return f;
  }, [localSearch, localStatuts, localCategories, localVagueIds, localCommandeIds, localDateFrom, localDateTo, localMontantMin, localMontantMax]);

  function handleApply() {
    onApply(formFilters);
  }

  const statutOptions = Object.values(StatutDepense).map((s) => ({
    value: s,
    label: t(`statuts.${s}` as Parameters<typeof t>[0]),
  }));

  const categorieOptions = Object.values(CategorieDepense).map((c) => ({
    value: c,
    label: t(`categories.${c}` as Parameters<typeof t>[0]),
  }));

  const vagueOptions = vagues.map((v) => ({ value: v.id, label: v.code }));
  const commandeOptions = commandes.map((c) => ({ value: c.id, label: c.numero }));

  return (
    <div className="flex flex-col h-full">
      <div
        className="shrink-0 flex items-center justify-between px-4 border-b border-border"
        style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))", paddingBottom: "0.75rem" }}
      >
        <h2 className="text-base font-semibold">{t("filtres.titre")}</h2>
        <div className="flex items-center gap-2">
          {activeCount > 0 && (
            <button
              type="button"
              onClick={onClear}
              className="text-sm text-muted-foreground hover:text-foreground underline"
            >
              {t("filtres.effacer")}
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
        page="depenses"
        currentFilters={formFilters}
        onLoadFilter={(filters) => loadIntoForm(filters as DepenseFilterValues)}
        hasActiveFilters={activeCount > 0}
      />

      <div className="flex-1 overflow-y-auto overflow-x-hidden px-4 py-4 space-y-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium">{t("filtres.recherche")}</label>
          <input
            type="text"
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            placeholder={t("filtres.recherchePlaceholder")}
            className="h-10 rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium">{t("filtres.statut")}</label>
          <MultiSelect
            options={statutOptions}
            selected={localStatuts}
            onChange={setLocalStatuts}
            placeholder={t("filtres.tousStatuts")}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium">{t("filtres.categorie")}</label>
          <MultiSelect
            options={categorieOptions}
            selected={localCategories}
            onChange={setLocalCategories}
            placeholder={t("filtres.toutesCategories")}
          />
        </div>

        {vagues.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">{t("filtres.vague")}</label>
            <MultiSelect
              options={vagueOptions}
              selected={localVagueIds}
              onChange={setLocalVagueIds}
              placeholder={t("filtres.toutesVagues")}
            />
          </div>
        )}

        {commandes.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">{t("filtres.commande")}</label>
            <MultiSelect
              options={commandeOptions}
              selected={localCommandeIds}
              onChange={setLocalCommandeIds}
              placeholder={t("filtres.toutesCommandes")}
            />
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium">{t("filtres.periode")}</label>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground w-5">{t("filtres.du")}</span>
            <input
              type="date"
              value={localDateFrom}
              onChange={(e) => setLocalDateFrom(e.target.value)}
              className="flex-1 min-w-0 h-10 rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground w-5">{t("filtres.au")}</span>
            <input
              type="date"
              value={localDateTo}
              onChange={(e) => setLocalDateTo(e.target.value)}
              className="flex-1 min-w-0 h-10 rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium">{t("filtres.montant")}</label>
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
          {t("filtres.effacer")}
        </button>
        <button
          type="button"
          onClick={handleApply}
          className="flex-1 h-10 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          {activeCount > 0
            ? t("filtres.appliquer", { count: activeCount })
            : t("filtres.appliquerSimple")}
        </button>
      </div>
    </div>
  );
}
