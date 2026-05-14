"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useTranslations, useLocale } from "next-intl";
import { Plus, ClipboardList, Calendar, User, AlertCircle, Clock, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { StatutBesoins } from "@/types";
import { useBesoinsList } from "@/hooks/queries/use-depenses-queries";
import type { ListeBesoinsWithRelations } from "@/types";
import { BesoinsFilterSheet } from "./besoins-filter-sheet";
import type { BesoinsFilterValues } from "./besoins-filter-sheet";
import { SavedFiltersChips } from "@/components/filters/saved-filters-chips";

const statutVariants: Record<
  StatutBesoins,
  "default" | "info" | "en_cours" | "terminee" | "annulee" | "warning"
> = {
  [StatutBesoins.SOUMISE]: "info",
  [StatutBesoins.APPROUVEE]: "en_cours",
  [StatutBesoins.TRAITEE]: "warning",
  [StatutBesoins.CLOTUREE]: "terminee",
  [StatutBesoins.REJETEE]: "annulee",
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ListeBesoinsData {
  id: string;
  numero: string;
  titre: string;
  statut: string;
  montantEstime: number;
  montantReel: number | null;
  dateLimite: string | null;
  createdAt: string;
  demandeur: { id: string; name: string } | null;
  valideur: { id: string; name: string } | null;
  /** Vagues associees avec ratios (multi-vague) */
  vagues?: { id: string; vagueId: string; ratio: number; vague?: { id: string; code: string } | null }[];
  _count: { lignes: number };
}

interface Props {
  listesBesoins: ListeBesoinsData[];
  produits: { id: string; nom: string }[];
  canCreate: boolean;
  canApprove: boolean;
  canProcess: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatMontant(n: number, locale: string) {
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

function formatDate(dateStr: string, locale: string) {
  return new Date(dateStr).toLocaleDateString(locale, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

const STATUTS_TERMINAUX = [StatutBesoins.TRAITEE, StatutBesoins.CLOTUREE, StatutBesoins.REJETEE];

function getDateLimiteStatus(dateLimite: string | null, statut: string): "retard" | "proche" | "ok" | null {
  if (!dateLimite) return null;
  if (STATUTS_TERMINAUX.includes(statut as StatutBesoins)) return null;
  const limite = new Date(dateLimite);
  const now = new Date();
  if (limite < now) return "retard";
  const deuxJours = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
  if (limite <= deuxJours) return "proche";
  return "ok";
}

function countActiveFilters(filters: BesoinsFilterValues): number {
  return Object.values(filters).filter(Boolean).length;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function BesoinsListClient({
  listesBesoins: initialListesBesoins,
  produits,
  canCreate,
}: Props) {
  const t = useTranslations("besoins");
  const locale = useLocale();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [filters, setFilters] = useState<BesoinsFilterValues>({});

  const queryFilters = useMemo(() => {
    const combined: Record<string, string | number | boolean | undefined> = {};
    if (filters.statut) combined.statut = filters.statut;
    if (filters.search) combined.search = filters.search;
    if (filters.produitId) combined.produitId = filters.produitId;
    if (filters.demandeurId) combined.demandeurId = filters.demandeurId;
    if (filters.valideurId) combined.valideurId = filters.valideurId;
    if (filters.vagueId) combined.vagueId = filters.vagueId;
    if (filters.dateFrom) combined.dateFrom = filters.dateFrom;
    if (filters.dateTo) combined.dateTo = filters.dateTo;
    if (filters.dateLimiteFrom) combined.dateLimiteFrom = filters.dateLimiteFrom;
    if (filters.dateLimiteTo) combined.dateLimiteTo = filters.dateLimiteTo;
    if (filters.montantEstimeMin) combined.montantEstimeMin = filters.montantEstimeMin;
    if (filters.montantEstimeMax) combined.montantEstimeMax = filters.montantEstimeMax;
    if (filters.enRetard) combined.enRetard = true;
    if (filters.hasCommande) combined.hasCommande = true;
    return Object.keys(combined).length > 0 ? combined : undefined;
  }, [filters]);

  const { data: listesBesoinsRaw = initialListesBesoins } = useBesoinsList(queryFilters, {
    initialData: initialListesBesoins as unknown as ListeBesoinsWithRelations[],
  });
  const listesBesoins = listesBesoinsRaw as unknown as ListeBesoinsData[];

  // Extract unique users and vagues from the full initial data for filter options
  const users = useMemo(() => {
    const map = new Map<string, string>();
    for (const lb of initialListesBesoins) {
      if (lb.demandeur) map.set(lb.demandeur.id, lb.demandeur.name);
      if (lb.valideur) map.set(lb.valideur.id, lb.valideur.name);
    }
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [initialListesBesoins]);

  const vagues = useMemo(() => {
    const map = new Map<string, string>();
    for (const lb of initialListesBesoins) {
      if (lb.vagues) {
        for (const v of lb.vagues) {
          if (v.vague) map.set(v.vague.id, v.vague.code);
        }
      }
    }
    return Array.from(map.entries()).map(([id, code]) => ({ id, code }));
  }, [initialListesBesoins]);

  function handleApplyFilters(newFilters: BesoinsFilterValues) {
    setFilters(newFilters);
    setSheetOpen(false);
  }

  function handleClearFilters() {
    setFilters({});
    setSheetOpen(false);
  }

  const activeFilterCount = countActiveFilters(filters);

  return (
    <div className="p-4 max-w-2xl mx-auto">
      {/* Header actions */}
      <div className="flex items-center justify-between mb-4 gap-2">
        <p className="text-sm text-muted-foreground">
          {t("list.count", { count: listesBesoins.length })}
        </p>
        <div className="flex items-center gap-2">
          {/* Filter button */}
          <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
            <SheetTrigger asChild>
              <button
                type="button"
                className="relative inline-flex items-center gap-2 h-9 px-3 rounded-md border border-border bg-background text-sm font-medium hover:bg-accent transition-colors"
              >
                <SlidersHorizontal className="h-4 w-4" />
                {activeFilterCount > 0 && (
                  <span
                    className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full text-xs flex items-center justify-center font-bold text-primary-foreground"
                    style={{ backgroundColor: "var(--primary)" }}
                  >
                    {activeFilterCount}
                  </span>
                )}
              </button>
            </SheetTrigger>
            <SheetContent
              className="!left-auto !right-0 !inset-y-0 !w-full sm:!w-96 !p-0 flex flex-col data-[state=open]:!slide-in-from-right data-[state=closed]:!slide-out-to-right"
              hideCloseButton
            >
              <BesoinsFilterSheet
                current={filters}
                users={users}
                produits={produits}
                vagues={vagues}
                onApply={handleApplyFilters}
                onClear={handleClearFilters}
                activeCount={activeFilterCount}
              />
            </SheetContent>
          </Sheet>

          {canCreate && (
            <Button asChild variant="primary" size="sm">
              <Link href="/besoins/nouveau">
                <Plus className="h-4 w-4 mr-1" />
                {t("list.nouvelle")}
              </Link>
            </Button>
          )}
        </div>
      </div>

      <SavedFiltersChips
        page="besoins"
        onLoadFilter={(f) => setFilters(f as BesoinsFilterValues)}
      />

      {listesBesoins.length === 0 ? (
        <div className="text-center py-12">
          <ClipboardList className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground text-sm">
            {t("list.empty")}
          </p>
          {canCreate && activeFilterCount === 0 && (
            <Button asChild variant="primary" className="mt-4">
              <Link href="/besoins/nouveau">
                <Plus className="h-4 w-4 mr-1" />
                {t("list.creer")}
              </Link>
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {listesBesoins.map((lb) => (
                <Link key={lb.id} href={`/besoins/${lb.id}`}>
                  <Card className="hover:shadow-md transition-shadow cursor-pointer my-4">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-muted-foreground font-mono">
                            {lb.numero}
                          </p>
                          <p className="font-medium text-sm leading-snug mt-0.5 truncate">
                            {lb.titre}
                          </p>
                        </div>
                        <Badge
                          variant={
                            statutVariants[lb.statut as StatutBesoins] ??
                            "default"
                          }
                          className="flex-shrink-0"
                        >
                          {t(`statuts.${lb.statut as StatutBesoins}` as Parameters<typeof t>[0]) ??
                            lb.statut}
                        </Badge>
                      </div>

                      {/* Meta info */}
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground mt-2">
                        {lb.demandeur && (
                          <span className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {lb.demandeur.name}
                          </span>
                        )}
                        {lb.vagues && lb.vagues.length === 1 && lb.vagues[0].vague && (
                          <span className="text-primary">
                            {lb.vagues[0].vague.code}
                          </span>
                        )}
                        {lb.vagues && lb.vagues.length > 1 && lb.vagues[0].vague && (
                          <span className="text-primary">
                            {lb.vagues[0].vague.code}{" "}
                            <span className="text-xs opacity-70">
                              +{lb.vagues.length - 1}
                            </span>
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {formatDate(lb.createdAt, locale)}
                        </span>
                        <span>
                          {lb._count.lignes !== 1
                            ? t("list.card.lignesPlural", { count: lb._count.lignes })
                            : t("list.card.lignesSingular", { count: lb._count.lignes })}
                        </span>
                      </div>

                      {/* Date limite */}
                      {lb.dateLimite && (() => {
                        const dlStatus = getDateLimiteStatus(lb.dateLimite, lb.statut);
                        if (!dlStatus) return null;
                        return (
                          <div className="mt-2 flex items-center gap-1.5">
                            {dlStatus === "retard" ? (
                              <span className="flex items-center gap-1 text-xs font-medium text-destructive">
                                <AlertCircle className="h-3.5 w-3.5" />
                                {t("list.card.enRetard", { date: formatDate(lb.dateLimite, locale) })}
                              </span>
                            ) : dlStatus === "proche" ? (
                              <span className="flex items-center gap-1 text-xs font-medium text-warning">
                                <Clock className="h-3.5 w-3.5" />
                                {t("list.card.echeanceProche", { date: formatDate(lb.dateLimite, locale) })}
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Clock className="h-3.5 w-3.5" />
                                {t("list.card.limite", { date: formatDate(lb.dateLimite, locale) })}
                              </span>
                            )}
                          </div>
                        );
                      })()}

                      {/* Montant */}
                      <div className="mt-3 flex items-center justify-between">
                        <div>
                          <p className="text-xs text-muted-foreground">
                            {t("list.card.montantEstime")}
                          </p>
                          <p className="text-base font-semibold">
                            {formatMontant(lb.montantEstime, locale)} FCFA
                          </p>
                        </div>
                        {lb.montantReel !== null && (
                          <div className="text-right">
                            <p className="text-xs text-muted-foreground">
                              {t("list.card.montantReel")}
                            </p>
                            <p className="text-base font-semibold text-primary">
                              {formatMontant(lb.montantReel, locale)} FCFA
                            </p>
                          </div>
                        )}
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
