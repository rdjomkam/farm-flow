"use client";
/**
 * src/components/commissions/commissions-list.tsx
 *
 * Liste des commissions avec onglets par statut.
 * Mobile-first : cartes empilées à 360px.
 *
 * Story 34.3 — Sprint 34
 * R6 : CSS variables du thème
 */
import { useState } from "react";
import { StatutCommissionIng } from "@/types";
import { useTranslations } from "next-intl";

interface Commission {
  id: string;
  montant: number;
  taux: number;
  statut: string;
  periodeDebut: Date | string;
  periodeFin: Date | string;
  createdAt: Date | string;
  siteClient?: {
    id: string;
    name: string;
  };
  abonnement?: {
    plan?: {
      nom: string;
    };
  };
}

interface CommissionsListProps {
  commissions: Commission[];
}

const STATUT_COLORS: Record<string, string> = {
  [StatutCommissionIng.EN_ATTENTE]: "bg-warning/10 text-warning",
  [StatutCommissionIng.DISPONIBLE]: "bg-success/10 text-success",
  [StatutCommissionIng.DEMANDEE]: "bg-primary/10 text-primary",
  [StatutCommissionIng.PAYEE]: "bg-muted text-muted-foreground",
  [StatutCommissionIng.ANNULEE]: "bg-destructive/10 text-destructive",
};

function formatXAF(amount: number) {
  return new Intl.NumberFormat("fr-CM", {
    style: "currency",
    currency: "XAF",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(date: Date | string) {
  return new Intl.DateTimeFormat("fr-CM", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(date));
}

export function CommissionsList({ commissions }: CommissionsListProps) {
  const t = useTranslations("commissions");
  const [activeTab, setActiveTab] = useState<string>("ALL");

  const TABS = [
    { label: t("commissions.tabs.enAttente"), value: StatutCommissionIng.EN_ATTENTE },
    { label: t("commissions.tabs.disponibles"), value: StatutCommissionIng.DISPONIBLE },
    { label: t("commissions.tabs.payees"), value: StatutCommissionIng.PAYEE },
    { label: t("commissions.tabs.toutes"), value: "ALL" },
  ] as const;

  const STATUT_LABELS: Record<string, string> = {
    [StatutCommissionIng.EN_ATTENTE]: t("commissions.statuts.EN_ATTENTE"),
    [StatutCommissionIng.DISPONIBLE]: t("commissions.statuts.DISPONIBLE"),
    [StatutCommissionIng.DEMANDEE]: t("commissions.statuts.DEMANDEE"),
    [StatutCommissionIng.PAYEE]: t("commissions.statuts.PAYEE"),
    [StatutCommissionIng.ANNULEE]: t("commissions.statuts.ANNULEE"),
  };

  const filtered = activeTab === "ALL"
    ? commissions
    : commissions.filter((c) => c.statut === activeTab);

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto pb-1">
        {TABS.map((tab) => {
          const count = tab.value === "ALL"
            ? commissions.length
            : commissions.filter((c) => c.statut === tab.value).length;
          return (
            <button
              key={tab.value}
              type="button"
              onClick={() => setActiveTab(tab.value)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                activeTab === tab.value
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {tab.label} ({count})
            </button>
          );
        })}
      </div>

      {/* Liste */}
      {filtered.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground text-sm">
          {t("commissions.aucune")}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((commission) => (
            <div
              key={commission.id}
              className="rounded-xl border border-border bg-card p-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-foreground text-sm truncate">
                    {commission.siteClient?.name ?? t("commissions.fermeInconnue")}
                  </p>
                  {commission.abonnement?.plan?.nom && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {commission.abonnement.plan.nom}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatDate(commission.periodeDebut)} — {formatDate(commission.periodeFin)}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-base font-bold text-foreground">
                    {formatXAF(commission.montant)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t("commissions.taux", { rate: (commission.taux * 100).toFixed(0) })}
                  </p>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                    STATUT_COLORS[commission.statut] ?? "bg-muted text-muted-foreground"
                  }`}
                >
                  {STATUT_LABELS[commission.statut] ?? commission.statut}
                </span>
                {commission.statut === StatutCommissionIng.EN_ATTENTE && (
                  <span className="text-xs text-muted-foreground">
                    {t("commissions.disponibleLe", {
                      date: formatDate(
                        new Date(new Date(commission.createdAt).getTime() + 30 * 24 * 60 * 60 * 1000)
                      )
                    })}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
