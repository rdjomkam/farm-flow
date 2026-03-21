"use client";
/**
 * src/components/commissions/portefeuille-summary.tsx
 *
 * Résumé du portefeuille ingénieur : solde disponible, en attente, total gagné.
 * Mobile-first : cartes empilées à 360px.
 *
 * Story 34.3 — Sprint 34
 * R5 : DialogTrigger asChild
 * R6 : CSS variables du thème
 */
import { Wallet, Clock, TrendingUp } from "lucide-react";
import { RetraitDialog } from "./retrait-dialog";
import { useTranslations } from "next-intl";

interface PortefeuilleSummaryProps {
  solde: number;
  soldePending: number;
  totalGagne: number;
  totalPaye: number;
}

function formatXAF(amount: number) {
  return new Intl.NumberFormat("fr-CM", {
    style: "currency",
    currency: "XAF",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function PortefeuilleSummary({
  solde,
  soldePending,
  totalGagne,
}: PortefeuilleSummaryProps) {
  const t = useTranslations("commissions");

  return (
    <div className="space-y-4">
      {/* Solde disponible — carte principale */}
      <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
            <Wallet className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">
              {t("portefeuille.soldeDisponible")}
            </p>
            <p className="text-2xl font-bold text-foreground">
              {formatXAF(solde)}
            </p>
          </div>
        </div>
        {solde > 0 && <RetraitDialog soldeDisponible={solde} />}
        {solde === 0 && (
          <p className="text-xs text-muted-foreground">
            {t("portefeuille.aucunMontant")}
          </p>
        )}
      </div>

      {/* Cartes secondaires */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="h-4 w-4 text-warning" />
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">
              {t("portefeuille.enAttente")}
            </p>
          </div>
          <p className="text-lg font-semibold text-foreground">
            {formatXAF(soldePending)}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {t("portefeuille.disponibleDans30Jours")}
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="h-4 w-4 text-success" />
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">
              {t("portefeuille.totalGagne")}
            </p>
          </div>
          <p className="text-lg font-semibold text-foreground">
            {formatXAF(totalGagne)}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {t("portefeuille.depuisLeDebut")}
          </p>
        </div>
      </div>
    </div>
  );
}
