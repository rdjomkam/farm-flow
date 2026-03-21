"use client";
/**
 * src/components/commissions/retraits-list.tsx
 *
 * Historique des retraits du portefeuille ingénieur.
 * Mobile-first : cartes empilées à 360px.
 *
 * Story 34.3 — Sprint 34
 * R6 : CSS variables du thème
 */
import { StatutPaiementAbo } from "@/types";

interface Retrait {
  id: string;
  montant: number;
  fournisseur: string;
  phoneNumber: string;
  statut: string;
  referenceExterne?: string | null;
  createdAt: Date | string;
  dateTraitement?: Date | string | null;
}

interface RetraitsListProps {
  retraits: Retrait[];
}

const STATUT_COLORS: Record<string, string> = {
  [StatutPaiementAbo.EN_ATTENTE]: "bg-warning/10 text-warning",
  [StatutPaiementAbo.CONFIRME]: "bg-success/10 text-success",
  [StatutPaiementAbo.ECHEC]: "bg-destructive/10 text-destructive",
  [StatutPaiementAbo.EXPIRE]: "bg-muted text-muted-foreground",
};

const STATUT_LABELS: Record<string, string> = {
  [StatutPaiementAbo.EN_ATTENTE]: "En attente",
  [StatutPaiementAbo.CONFIRME]: "Confirmé",
  [StatutPaiementAbo.ECHEC]: "Échoué",
  [StatutPaiementAbo.EXPIRE]: "Expiré",
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
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

export function RetraitsList({ retraits }: RetraitsListProps) {
  if (retraits.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground text-sm">
        Aucun retrait effectué pour le moment.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {retraits.map((retrait) => (
        <div
          key={retrait.id}
          className="rounded-xl border border-border bg-card p-4 shadow-sm"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="font-medium text-foreground text-sm">
                {retrait.fournisseur.replace("_", " ")}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {retrait.phoneNumber}
              </p>
              {retrait.referenceExterne && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  Réf. : {retrait.referenceExterne}
                </p>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                Demandé le {formatDate(retrait.createdAt)}
              </p>
              {retrait.dateTraitement && (
                <p className="text-xs text-muted-foreground">
                  Traité le {formatDate(retrait.dateTraitement)}
                </p>
              )}
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-base font-bold text-foreground">
                {formatXAF(retrait.montant)}
              </p>
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium mt-1 ${
                  STATUT_COLORS[retrait.statut] ?? "bg-muted text-muted-foreground"
                }`}
              >
                {STATUT_LABELS[retrait.statut] ?? retrait.statut}
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
