/**
 * src/components/abonnements/paiements-history-list.tsx
 *
 * Liste des paiements d'abonnement — historique.
 * Server Component — pas d'interactivité requise.
 * Mobile-first : cartes empilées (pas de tableau).
 *
 * Story 33.3 — Sprint 33
 * R2 : enums importés depuis @/types
 * R6 : CSS variables du thème
 */
import { getTranslations } from "next-intl/server";
import { StatutPaiementAbo, FournisseurPaiement } from "@/types";
import type { PaiementAbonnement } from "@/types";
import { Badge } from "@/components/ui/badge";
import { FOURNISSEUR_LABELS } from "@/lib/abonnements-constants";
import { formatXAF } from "@/lib/format";

interface PaiementsHistoryListProps {
  paiements: PaiementAbonnement[];
}

function statutPaiementVariant(
  statut: StatutPaiementAbo
): "en_cours" | "terminee" | "annulee" | "warning" | "default" {
  switch (statut) {
    case StatutPaiementAbo.CONFIRME:
      return "terminee";
    case StatutPaiementAbo.INITIE:
    case StatutPaiementAbo.EN_ATTENTE:
      return "en_cours";
    case StatutPaiementAbo.ECHEC:
    case StatutPaiementAbo.EXPIRE:
      return "annulee";
    case StatutPaiementAbo.REMBOURSE:
      return "warning";
    default:
      return "default";
  }
}

function statutPaiementLabel(statut: StatutPaiementAbo): string {
  switch (statut) {
    case StatutPaiementAbo.EN_ATTENTE:
      return "En attente";
    case StatutPaiementAbo.INITIE:
      return "Initié";
    case StatutPaiementAbo.CONFIRME:
      return "Confirmé";
    case StatutPaiementAbo.ECHEC:
      return "Échoué";
    case StatutPaiementAbo.REMBOURSE:
      return "Remboursé";
    case StatutPaiementAbo.EXPIRE:
      return "Expiré";
    default:
      return statut;
  }
}

function truncateRef(ref: string | null): string {
  if (!ref) return "-";
  if (ref.length <= 16) return ref;
  return `${ref.substring(0, 8)}...${ref.substring(ref.length - 4)}`;
}

export async function PaiementsHistoryList({ paiements }: PaiementsHistoryListProps) {
  const t = await getTranslations("abonnements");
  if (paiements.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-4">
        Aucun paiement enregistré.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {paiements.map((paiement) => (
        <div
          key={paiement.id}
          className="bg-card border border-border rounded-lg p-3"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-semibold text-foreground">
                  {formatXAF(paiement.montant)}
                </span>
                <Badge
                  variant={statutPaiementVariant(paiement.statut)}
                  aria-label={`Statut : ${statutPaiementLabel(paiement.statut)}`}
                >
                  {statutPaiementLabel(paiement.statut)}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {FOURNISSEUR_LABELS[paiement.fournisseur as FournisseurPaiement]
                  ? t(FOURNISSEUR_LABELS[paiement.fournisseur as FournisseurPaiement])
                  : paiement.fournisseur}
              </p>
              {paiement.referenceExterne && (
                <p className="text-xs text-muted-foreground mt-0.5 font-mono">
                  Réf : {truncateRef(paiement.referenceExterne)}
                </p>
              )}
            </div>
            <div className="text-right shrink-0">
              <p className="text-xs text-muted-foreground">
                {new Date(paiement.dateInitiation).toLocaleDateString("fr-FR")}
              </p>
              {paiement.dateConfirmation && (
                <p className="text-xs text-success mt-0.5">
                  Confirmé le {new Date(paiement.dateConfirmation).toLocaleDateString("fr-FR")}
                </p>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
