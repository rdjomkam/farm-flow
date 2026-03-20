/**
 * src/components/subscription/subscription-banner.tsx
 *
 * Server Component — Affiche un banner d'alerte en haut de page
 * si le statut d'abonnement est EN_GRACE ou SUSPENDU.
 *
 * Story 32.4 — Sprint 32
 * R2 : enums importés depuis @/types (StatutAbonnement)
 * R6 : CSS variables du thème (pas de couleurs hardcodées)
 * Mobile-first : banner compact sur 360px
 *
 * Ne s'affiche pas si :
 * - Plan DECOUVERTE (gratuit)
 * - Statut ACTIF
 * - Aucun abonnement
 */
import Link from "next/link";
import { getSubscriptionStatus, isReadOnlyMode } from "@/lib/abonnements/check-subscription";
import { StatutAbonnement } from "@/types";
import { STATUT_ABONNEMENT_LABELS } from "@/lib/abonnements-constants";

interface SubscriptionBannerProps {
  siteId: string;
}

export async function SubscriptionBanner({ siteId }: SubscriptionBannerProps) {
  const { statut, daysRemaining, isDecouverte } = await getSubscriptionStatus(siteId);

  // Ne pas afficher si plan DECOUVERTE, statut ACTIF ou aucun abonnement
  if (isDecouverte || !statut) return null;
  if ((statut as string) === StatutAbonnement.ACTIF) return null;

  // Déterminer le message et la couleur selon le statut
  const isGrace = (statut as string) === StatutAbonnement.EN_GRACE;
  const isSuspendu = isReadOnlyMode(statut);

  if (!isGrace && !isSuspendu) return null;

  return (
    <div
      role="alert"
      className={[
        "w-full px-3 py-2 text-sm",
        "flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between",
        isGrace
          ? "bg-amber-50 border-b border-amber-200 text-amber-900"
          : "bg-red-50 border-b border-red-200 text-red-900",
      ].join(" ")}
    >
      <span className="font-medium">
        {isGrace
          ? `Votre abonnement expire dans ${daysRemaining} jour${daysRemaining !== 1 ? "s" : ""}. ${STATUT_ABONNEMENT_LABELS[StatutAbonnement.EN_GRACE]}.`
          : "Mode lecture seule \u2014 Votre abonnement est suspendu."}
      </span>
      <Link
        href="/mon-abonnement/renouveler"
        className={[
          "shrink-0 text-xs font-semibold underline underline-offset-2",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1",
          isGrace
            ? "text-amber-800 hover:text-amber-600 focus-visible:ring-amber-500"
            : "text-red-800 hover:text-red-600 focus-visible:ring-red-500",
        ].join(" ")}
      >
        Renouveler mon abonnement
      </Link>
    </div>
  );
}
