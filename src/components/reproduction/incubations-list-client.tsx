"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { FlaskConical } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { StatutIncubation, Permission } from "@/types";
import { formatDate } from "@/lib/format";

// ---------------------------------------------------------------------------
// Types locaux — miroir de ce que listIncubations retourne via Prisma
// ---------------------------------------------------------------------------

export interface IncubationListItem {
  id: string;
  code: string;
  statut: string;
  substrat: string;
  temperatureEauC: number | null;
  nombreOeufsPlaces: number | null;
  dateDebutIncubation: string | null;
  dateEclosionPrevue: string | null;
  dateEclosionReelle: string | null;
  nombreLarvesEcloses: number | null;
  createdAt: string;
  ponte: {
    id: string;
    code: string;
    datePonte: string;
    statut: string;
  } | null;
  _count: {
    traitements: number;
    lotAlevins: number;
  };
}

interface IncubationsListClientProps {
  incubations: IncubationListItem[];
  permissions: Permission[];
}

// ---------------------------------------------------------------------------
// Badge helpers
// ---------------------------------------------------------------------------

function statutBadgeClass(statut: string): string {
  switch (statut) {
    case StatutIncubation.EN_COURS:
      return "bg-accent-blue-muted text-accent-blue";
    case StatutIncubation.ECLOSION_EN_COURS:
      return "bg-accent-amber-muted text-accent-amber";
    case StatutIncubation.TERMINEE:
      return "bg-accent-green-muted text-accent-green";
    case StatutIncubation.ECHOUEE:
      return "bg-accent-red-muted text-accent-red";
    default:
      return "bg-muted text-muted-foreground";
  }
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function IncubationsListClient({
  incubations,
  permissions,
}: IncubationsListClientProps) {
  const t = useTranslations("reproduction");
  const router = useRouter();

  const [tab, setTab] = useState("tous");
  const [search, setSearch] = useState("");

  const statutLabels: Record<string, string> = {
    [StatutIncubation.EN_COURS]: t("statuts.incubation.EN_COURS"),
    [StatutIncubation.ECLOSION_EN_COURS]: t(
      "statuts.incubation.ECLOSION_EN_COURS"
    ),
    [StatutIncubation.TERMINEE]: t("statuts.incubation.TERMINEE"),
    [StatutIncubation.ECHOUEE]: t("statuts.incubation.ECHOUEE"),
  };

  const filteredIncubations = useMemo(() => {
    return incubations.filter((inc) => {
      const matchTab =
        tab === "tous"
          ? true
          : tab === "en_cours"
            ? inc.statut === StatutIncubation.EN_COURS
            : tab === "eclosion"
              ? inc.statut === StatutIncubation.ECLOSION_EN_COURS
              : tab === "terminees"
                ? inc.statut === StatutIncubation.TERMINEE
                : tab === "echouees"
                  ? inc.statut === StatutIncubation.ECHOUEE
                  : true;

      const q = search.trim().toLowerCase();
      const matchSearch =
        !q ||
        inc.code.toLowerCase().includes(q) ||
        (inc.ponte?.code ?? "").toLowerCase().includes(q);

      return matchTab && matchSearch;
    });
  }, [incubations, tab, search]);

  const isEmpty = filteredIncubations.length === 0;

  const countLabel =
    incubations.length === 1
      ? t("incubations.count", { count: incubations.length })
      : t("incubations.countPlural", { count: incubations.length });

  return (
    <div className="flex flex-col gap-4">
      {/* Header: count + bouton action si permissions */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-sm text-muted-foreground">{countLabel}</p>
        {permissions.includes(Permission.INCUBATIONS_GERER) && (
          <Link
            href="/reproduction/pontes"
            className="inline-flex items-center gap-1 text-sm text-primary hover:underline font-medium min-h-[44px]"
          >
            <FlaskConical className="h-4 w-4" />
            {t("incubations.lancerIncubation")}
          </Link>
        )}
      </div>

      {/* Search */}
      <Input
        placeholder={t("incubations.search")}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {/* Tabs by statut */}
      <Tabs value={tab} onValueChange={setTab}>
        <div className="overflow-x-auto -mx-4 px-4">
          <TabsList className="w-max">
            <TabsTrigger value="tous">{t("incubations.tabs.tous")}</TabsTrigger>
            <TabsTrigger value="en_cours">
              {t("incubations.tabs.en_cours")}
            </TabsTrigger>
            <TabsTrigger value="eclosion">
              {t("incubations.tabs.eclosion")}
            </TabsTrigger>
            <TabsTrigger value="terminees">
              {t("incubations.tabs.terminees")}
            </TabsTrigger>
            <TabsTrigger value="echouees">
              {t("incubations.tabs.echouees")}
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value={tab}>
          {isEmpty ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <FlaskConical
                className="h-12 w-12 text-muted-foreground mb-4"
                aria-hidden="true"
              />
              <p className="text-muted-foreground">
                {t("incubations.aucune")}
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-2 mt-2">
              {filteredIncubations.map((inc) => (
                <Card
                  key={inc.id}
                  className="hover:ring-1 hover:ring-primary/30 transition-all cursor-pointer"
                  onClick={() =>
                    router.push(`/reproduction/incubations/${inc.id}`)
                  }
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        {/* Code + badge statut */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold truncate">{inc.code}</p>
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statutBadgeClass(inc.statut)}`}
                          >
                            {statutLabels[inc.statut] ?? inc.statut}
                          </span>
                        </div>

                        {/* Ponte liée */}
                        {inc.ponte && (
                          <p className="text-sm text-muted-foreground mt-1">
                            {t("incubations.card.ponte")} :{" "}
                            <span className="font-medium text-foreground">
                              {inc.ponte.code}
                            </span>
                          </p>
                        )}

                        {/* Stats row */}
                        <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-muted-foreground">
                          {inc.dateDebutIncubation && (
                            <span>
                              {t("incubations.card.debut")} :{" "}
                              {formatDate(inc.dateDebutIncubation)}
                            </span>
                          )}
                          {inc.dateEclosionPrevue && (
                            <span>
                              {t("incubations.card.eclosionPrevue")} :{" "}
                              {formatDate(inc.dateEclosionPrevue)}
                            </span>
                          )}
                          {inc.nombreOeufsPlaces !== null && (
                            <span>
                              {inc.nombreOeufsPlaces.toLocaleString("fr-FR")}{" "}
                              {t("incubations.card.oeufs")}
                            </span>
                          )}
                          {inc.nombreLarvesEcloses !== null && (
                            <span className="text-accent-green font-medium">
                              {inc.nombreLarvesEcloses.toLocaleString("fr-FR")}{" "}
                              {t("incubations.card.larves")}
                            </span>
                          )}
                        </div>

                        {/* Counts row */}
                        {(inc._count.traitements > 0 ||
                          inc._count.lotAlevins > 0) && (
                          <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-muted-foreground">
                            {inc._count.traitements > 0 && (
                              <span>
                                {inc._count.traitements}{" "}
                                {t("incubations.card.traitements")}
                              </span>
                            )}
                            {inc._count.lotAlevins > 0 && (
                              <span>
                                {inc._count.lotAlevins}{" "}
                                {t("incubations.card.lots")}
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Chevron */}
                      <FlaskConical
                        className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5"
                        aria-hidden="true"
                      />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
