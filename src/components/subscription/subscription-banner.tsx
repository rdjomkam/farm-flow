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
import { getTranslations } from "next-intl/server";
import { getSubscriptionStatus, isReadOnlyMode } from "@/lib/abonnements/check-subscription";
import { StatutAbonnement } from "@/types";
import { isPlatformSite } from "@/lib/queries/sites";

interface SubscriptionBannerProps {
  siteId: string;
}

export async function SubscriptionBanner({ siteId }: SubscriptionBannerProps) {
  const isPlat = await isPlatformSite(siteId);
  if (isPlat) return null;

  const t = await getTranslations("abonnements");
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
          ? "bg-accent-amber-muted border-b border-accent-amber text-accent-amber"
          : "bg-accent-red-muted border-b border-accent-red text-accent-red",
      ].join(" ")}
    >
      <span className="font-medium">
        {isGrace
          ? t("banner.graceMessage", { days: daysRemaining ?? 0 })
          : t("banner.suspendedMessage")}
      </span>
      <Link
        href="/mon-abonnement/renouveler"
        className={[
          "shrink-0 text-xs font-semibold underline underline-offset-2",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1",
          isGrace
            ? "text-accent-amber hover:text-warning focus-visible:ring-warning"
            : "text-accent-red hover:text-danger focus-visible:ring-danger",
        ].join(" ")}
      >
        {t("banner.renewButton")}
      </Link>
    </div>
  );
}
