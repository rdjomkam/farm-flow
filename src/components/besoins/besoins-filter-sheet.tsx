"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { SheetClose } from "@/components/ui/sheet";
import { MultiSelect } from "@/components/ui/multi-select";
import { SavedFiltersSection } from "@/components/filters/saved-filters-section";
import { StatutBesoins } from "@/types";

export interface BesoinsFilterValues {
  statut?: string;
  search?: string;
  produitId?: string;
  demandeurId?: string;
  valideurId?: string;
  vagueId?: string;
  dateFrom?: string;
  dateTo?: string;
  dateLimiteFrom?: string;
  dateLimiteTo?: string;
  montantEstimeMin?: string;
  montantEstimeMax?: string;
  enRetard?: boolean;
  hasCommande?: boolean;
}

interface Props {
  current: BesoinsFilterValues;
  users: { id: string; name: string }[];
  produits: { id: string; nom: string }[];
  vagues: { id: string; code: string }[];
  onApply: (filters: BesoinsFilterValues) => void;
  onClear: () => void;
  activeCount: number;
}

function csvToArray(csv?: string): string[] {
  return csv ? csv.split(",").filter(Boolean) : [];
}

function arrayToCsv(arr: string[]): string | undefined {
  return arr.length > 0 ? arr.join(",") : undefined;
}

export function BesoinsFilterSheet({
  current,
  users,
  produits,
  vagues,
  onApply,
  onClear,
  activeCount,
}: Props) {
  const t = useTranslations("besoins");
  const tCommon = useTranslations("common");

  const [localStatuts, setLocalStatuts] = useState<string[]>(csvToArray(current.statut));
  const [localSearch, setLocalSearch] = useState(current.search ?? "");
  const [localProduitIds, setLocalProduitIds] = useState<string[]>(csvToArray(current.produitId));
  const [localDemandeurIds, setLocalDemandeurIds] = useState<string[]>(csvToArray(current.demandeurId));
  const [localValideurIds, setLocalValideurIds] = useState<string[]>(csvToArray(current.valideurId));
  const [localVagueIds, setLocalVagueIds] = useState<string[]>(csvToArray(current.vagueId));
  const [localDateFrom, setLocalDateFrom] = useState(current.dateFrom ?? "");
  const [localDateTo, setLocalDateTo] = useState(current.dateTo ?? "");
  const [localDateLimiteFrom, setLocalDateLimiteFrom] = useState(current.dateLimiteFrom ?? "");
  const [localDateLimiteTo, setLocalDateLimiteTo] = useState(current.dateLimiteTo ?? "");
  const [localMontantMin, setLocalMontantMin] = useState(current.montantEstimeMin ?? "");
  const [localMontantMax, setLocalMontantMax] = useState(current.montantEstimeMax ?? "");
  const [localEnRetard, setLocalEnRetard] = useState(current.enRetard ?? false);
  const [localHasCommande, setLocalHasCommande] = useState(current.hasCommande ?? false);

  useEffect(() => {
    setLocalStatuts(csvToArray(current.statut));
    setLocalSearch(current.search ?? "");
    setLocalProduitIds(csvToArray(current.produitId));
    setLocalDemandeurIds(csvToArray(current.demandeurId));
    setLocalValideurIds(csvToArray(current.valideurId));
    setLocalVagueIds(csvToArray(current.vagueId));
    setLocalDateFrom(current.dateFrom ?? "");
    setLocalDateTo(current.dateTo ?? "");
    setLocalDateLimiteFrom(current.dateLimiteFrom ?? "");
    setLocalDateLimiteTo(current.dateLimiteTo ?? "");
    setLocalMontantMin(current.montantEstimeMin ?? "");
    setLocalMontantMax(current.montantEstimeMax ?? "");
    setLocalEnRetard(current.enRetard ?? false);
    setLocalHasCommande(current.hasCommande ?? false);
  }, [current]);

  function handleApply() {
    const filters: BesoinsFilterValues = {
      statut: arrayToCsv(localStatuts),
      search: localSearch || undefined,
      produitId: arrayToCsv(localProduitIds),
      demandeurId: arrayToCsv(localDemandeurIds),
      valideurId: arrayToCsv(localValideurIds),
      vagueId: arrayToCsv(localVagueIds),
      dateFrom: localDateFrom || undefined,
      dateTo: localDateTo || undefined,
      dateLimiteFrom: localDateLimiteFrom || undefined,
      dateLimiteTo: localDateLimiteTo || undefined,
      montantEstimeMin: localMontantMin || undefined,
      montantEstimeMax: localMontantMax || undefined,
      enRetard: localEnRetard || undefined,
      hasCommande: localHasCommande || undefined,
    };
    onApply(filters);
  }

  const statutOptions = Object.values(StatutBesoins).map((s) => ({
    value: s,
    label: t(`statuts.${s}` as Parameters<typeof t>[0]),
  }));

  const userOptions = users.map((u) => ({ value: u.id, label: u.name }));
  const produitOptions = produits.map((p) => ({ value: p.id, label: p.nom }));
  const vagueOptions = vagues.map((v) => ({ value: v.id, label: v.code }));

  return (
    <div className="flex flex-col h-full">

      {/* Fixed header with title and close button */}
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

      {/* Saved filters */}
      <SavedFiltersSection
        page="besoins"
        currentFilters={current}
        onLoadFilter={(filters) => onApply(filters as BesoinsFilterValues)}
        hasActiveFilters={activeCount > 0}
      />

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden px-4 py-4 space-y-4">

        {/* Search */}
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

        {/* Statut */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium">{t("filtres.statut")}</label>
          <MultiSelect
            options={statutOptions}
            selected={localStatuts}
            onChange={setLocalStatuts}
            placeholder={t("filtres.tousStatuts")}
          />
        </div>

        {/* Demandeur */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium">{t("filtres.demandeur")}</label>
          <MultiSelect
            options={userOptions}
            selected={localDemandeurIds}
            onChange={setLocalDemandeurIds}
            placeholder={t("filtres.tousUtilisateurs")}
          />
        </div>

        {/* Valideur */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium">{t("filtres.valideur")}</label>
          <MultiSelect
            options={userOptions}
            selected={localValideurIds}
            onChange={setLocalValideurIds}
            placeholder={t("filtres.tousUtilisateurs")}
          />
        </div>

        {/* Produit */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium">{t("filtres.produit")}</label>
          <MultiSelect
            options={produitOptions}
            selected={localProduitIds}
            onChange={setLocalProduitIds}
            placeholder={t("filtres.tousProduits")}
          />
        </div>

        {/* Vague */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium">{t("filtres.vague")}</label>
          <MultiSelect
            options={vagueOptions}
            selected={localVagueIds}
            onChange={setLocalVagueIds}
            placeholder={t("filtres.toutesVagues")}
          />
        </div>

        {/* Date de création range */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium">{t("filtres.dateCreation")}</label>
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

        {/* Date limite range */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium">{t("filtres.dateLimite")}</label>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground w-5">{t("filtres.du")}</span>
            <input
              type="date"
              value={localDateLimiteFrom}
              onChange={(e) => setLocalDateLimiteFrom(e.target.value)}
              className="flex-1 min-w-0 h-10 rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground w-5">{t("filtres.au")}</span>
            <input
              type="date"
              value={localDateLimiteTo}
              onChange={(e) => setLocalDateLimiteTo(e.target.value)}
              className="flex-1 min-w-0 h-10 rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>

        {/* Montant estimé range */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium">{t("filtres.montantEstime")}</label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min="0"
              step="1"
              value={localMontantMin}
              onChange={(e) => setLocalMontantMin(e.target.value)}
              placeholder={tCommon("placeholders.min")}
              className="flex-1 min-w-0 h-10 rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <span className="text-sm text-muted-foreground shrink-0">–</span>
            <input
              type="number"
              min="0"
              step="1"
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
            checked={localEnRetard}
            onChange={(e) => setLocalEnRetard(e.target.checked)}
            className="h-4 w-4 rounded border-border accent-primary cursor-pointer"
          />
          <span className="text-sm">{t("filtres.enRetard")}</span>
        </label>

        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={localHasCommande}
            onChange={(e) => setLocalHasCommande(e.target.checked)}
            className="h-4 w-4 rounded border-border accent-primary cursor-pointer"
          />
          <span className="text-sm">{t("filtres.hasCommande")}</span>
        </label>

      </div>

      {/* Fixed footer */}
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
