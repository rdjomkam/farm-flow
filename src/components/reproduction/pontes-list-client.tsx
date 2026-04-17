"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Egg, ArrowLeft } from "lucide-react";
import { useTranslations, useLocale } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { StatutPonte } from "@/types";
import { formatNumber } from "@/lib/format";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PonteSummaryItem {
  id: string;
  code: string;
  datePonte: string;
  statut: StatutPonte;
  femelleId: string;
  femelleCode: string | null;
  lotGeniteursFemellId: string | null;
  lotGeniteursFemellCode: string | null;
  nombreOeufsEstime: number | null;
  tauxFecondation: number | null;
  tauxEclosion: number | null;
  nombreLarvesViables: number | null;
  coutTotal: number | null;
  _count: { lots: number; incubations: number };
}

interface PontesListClientProps {
  pontes: PonteSummaryItem[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function statutBadgeClass(statut: StatutPonte): string {
  switch (statut) {
    case StatutPonte.EN_COURS:
      return "bg-[var(--accent-blue-muted,#dbeafe)] text-[var(--accent-blue,#1d4ed8)]";
    case StatutPonte.TERMINEE:
      return "bg-[var(--accent-green-muted,#dcfce7)] text-[var(--accent-green,#15803d)]";
    case StatutPonte.ECHOUEE:
      return "bg-[var(--accent-red-muted,#fee2e2)] text-[var(--accent-red,#b91c1c)]";
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PontesListClient({ pontes }: PontesListClientProps) {
  const t = useTranslations("reproduction");
  const locale = useLocale();
  const router = useRouter();
  const [tab, setTab] = useState("toutes");
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const statutLabels: Record<StatutPonte, string> = {
    [StatutPonte.EN_COURS]: t("pontes.statuts.EN_COURS"),
    [StatutPonte.TERMINEE]: t("pontes.statuts.TERMINEE"),
    [StatutPonte.ECHOUEE]: t("pontes.statuts.ECHOUEE"),
  };

  const filtered = useMemo(() => {
    return pontes.filter((p) => {
      // Tab filter
      if (tab === "enCours" && p.statut !== StatutPonte.EN_COURS) return false;
      if (tab === "terminees" && p.statut !== StatutPonte.TERMINEE) return false;
      if (tab === "echouees" && p.statut !== StatutPonte.ECHOUEE) return false;

      // Search filter
      if (search.trim()) {
        const q = search.toLowerCase();
        const codeMatch = p.code.toLowerCase().includes(q);
        const femelleMatch =
          (p.femelleCode ?? "").toLowerCase().includes(q) ||
          (p.lotGeniteursFemellCode ?? "").toLowerCase().includes(q);
        if (!codeMatch && !femelleMatch) return false;
      }

      // Date range filter
      if (dateFrom) {
        const from = new Date(dateFrom);
        const ponte = new Date(p.datePonte);
        if (ponte < from) return false;
      }
      if (dateTo) {
        const to = new Date(dateTo);
        to.setHours(23, 59, 59, 999);
        const ponte = new Date(p.datePonte);
        if (ponte > to) return false;
      }

      return true;
    });
  }, [pontes, tab, search, dateFrom, dateTo]);

  const femelleName = (p: PonteSummaryItem): string => {
    if (p.femelleCode) return p.femelleCode;
    if (p.lotGeniteursFemellCode) return p.lotGeniteursFemellCode;
    return "—";
  };

  const femelleLabel = (p: PonteSummaryItem): string => {
    if (p.femelleCode) return t("pontes.card.femelle");
    return t("pontes.card.lotFemelle");
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Back link */}
      <Link
        href="/reproduction"
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors w-fit"
      >
        <ArrowLeft className="h-4 w-4" />
        {t("pontes.backToReproduction")}
      </Link>

      {/* Count */}
      <p className="text-sm text-muted-foreground">
        {pontes.length === 1
          ? t("pontes.count", { count: pontes.length })
          : t("pontes.countPlural", { count: pontes.length })}
      </p>

      {/* Search */}
      <Input
        placeholder={t("pontes.search")}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {/* Date range */}
      <div className="grid grid-cols-2 gap-3">
        <div className="min-w-0">
          <Input
            label={t("pontes.dateFrom")}
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
          />
        </div>
        <div className="min-w-0">
          <Input
            label={t("pontes.dateTo")}
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
          />
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={setTab}>
        <div className="overflow-x-auto -mx-4 px-4">
          <TabsList className="w-max">
            <TabsTrigger value="toutes">{t("pontes.tabs.toutes")}</TabsTrigger>
            <TabsTrigger value="enCours">{t("pontes.tabs.enCours")}</TabsTrigger>
            <TabsTrigger value="terminees">{t("pontes.tabs.terminees")}</TabsTrigger>
            <TabsTrigger value="echouees">{t("pontes.tabs.echouees")}</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value={tab}>
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Egg className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">{t("pontes.aucune")}</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2 mt-2">
              {filtered.map((p) => (
                <Link key={p.id} href={`/reproduction/pontes/${p.id}`}>
                  <Card className="hover:ring-1 hover:ring-primary/30 transition-all cursor-pointer">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-2">
                        {/* Left: code + statut + details */}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-semibold">{p.code}</p>
                            <span
                              className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statutBadgeClass(p.statut as StatutPonte)}`}
                            >
                              {statutLabels[p.statut as StatutPonte] ?? p.statut}
                            </span>
                          </div>

                          {/* Femelle source */}
                          <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-muted-foreground">
                            <span>
                              {femelleLabel(p)} : <span className="font-medium text-foreground">{femelleName(p)}</span>
                            </span>
                          </div>

                          {/* Key metrics */}
                          {(p.nombreOeufsEstime !== null ||
                            p.tauxFecondation !== null ||
                            p.tauxEclosion !== null) && (
                            <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-muted-foreground">
                              {p.nombreOeufsEstime !== null && (
                                <span>
                                  {formatNumber(p.nombreOeufsEstime)} {t("pontes.card.oeufs")}
                                </span>
                              )}
                              {p.tauxFecondation !== null && (
                                <span>
                                  {p.tauxFecondation}% {t("pontes.card.fecondation")}
                                </span>
                              )}
                              {p.tauxEclosion !== null && (
                                <span>
                                  {p.tauxEclosion}% {t("pontes.card.eclosion")}
                                </span>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Right: date + counts */}
                        <div className="text-right text-xs text-muted-foreground shrink-0">
                          <p>
                            {new Date(p.datePonte).toLocaleDateString(locale)}
                          </p>
                          {p._count.incubations > 0 && (
                            <p className="mt-0.5">
                              {p._count.incubations} {t("pontes.card.incubations")}
                            </p>
                          )}
                          <p className="mt-0.5">
                            {p._count.lots} {t("pontes.card.lots")}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* FAB — link to nouvelle ponte */}
      <Link
        href="/reproduction/pontes/nouvelle"
        className="fixed bottom-[calc(6rem+env(safe-area-inset-bottom))] right-4 z-40 md:bottom-6 md:right-6"
      >
        <Button
          className="h-14 w-14 rounded-full shadow-lg p-0"
          aria-label={t("pontes.nouvelle")}
        >
          <Plus className="h-6 w-6" />
        </Button>
      </Link>
    </div>
  );
}
