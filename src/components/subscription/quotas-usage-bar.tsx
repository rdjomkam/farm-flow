/**
 * src/components/subscription/quotas-usage-bar.tsx
 *
 * Composant Server — Affiche les barres de progression des quotas de ressources.
 *
 * Story 36.4 — Sprint 36
 * R6 : CSS variables du thème (var(--primary), var(--destructive))
 * R8 : siteId obligatoire
 * Mobile first : 360px d'abord
 *
 * Affiche une barre de progression pour chaque ressource (bacs, vagues).
 * Rouge si la limite est atteinte, avec un bouton "Mettre à niveau" vers /tarifs.
 */
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { getQuotasUsageWithCounts, isQuotaAtteint } from "@/lib/abonnements/check-quotas";
import type { QuotaRessource } from "@/lib/abonnements/check-quotas";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface QuotasUsageBarProps {
  siteId: string;
  /** Pre-computed bacs count — skips DB query when provided */
  precomputedBacsCount?: number;
  /** Pre-computed active vagues count — skips DB query when provided */
  precomputedVaguesCount?: number;
}

// ---------------------------------------------------------------------------
// Sous-composant pur — rendu d'une ressource
// ---------------------------------------------------------------------------

interface RessourceBarProps {
  label: string;
  ressource: QuotaRessource;
}

function RessourceBar({ label, ressource, unlimitedLabel, usedLabel, usedPluralLabel, ariaLabelTemplate }: RessourceBarProps & { unlimitedLabel: string; usedLabel: string; usedPluralLabel: string; ariaLabelTemplate: (params: Record<string, string | number>) => string }) {
  const { actuel, limite } = ressource;
  const atteint = isQuotaAtteint(ressource);

  // Si illimité : pas de barre de progression
  if (limite === null) {
    return (
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">{actuel} / {unlimitedLabel}</span>
      </div>
    );
  }

  const pourcentage = Math.min(100, Math.round((actuel / limite) * 100));

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span
          className={[
            "font-semibold text-xs",
            atteint ? "text-destructive" : "text-foreground",
          ].join(" ")}
        >
          {actuel}/{limite} {actuel > 1 ? usedPluralLabel : usedLabel}
        </span>
      </div>
      {/* Barre de progression */}
      <div
        className="h-2 w-full rounded-full bg-muted overflow-hidden"
        role="progressbar"
        aria-valuenow={actuel}
        aria-valuemin={0}
        aria-valuemax={limite}
        aria-label={ariaLabelTemplate({ label, current: actuel, limit: limite })}
      >
        <div
          className={[
            "h-full rounded-full transition-all duration-300",
            atteint
              ? "bg-destructive"
              : pourcentage >= 80
                ? "bg-warning"
                : "bg-primary",
          ].join(" ")}
          style={{ width: `${pourcentage}%` }}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Composant principal (Server Component)
// ---------------------------------------------------------------------------

export async function QuotasUsageBar({ siteId, precomputedBacsCount, precomputedVaguesCount }: QuotasUsageBarProps) {
  const [quotas, t] = await Promise.all([
    getQuotasUsageWithCounts(siteId, {
      bacsCount: precomputedBacsCount,
      vaguesCount: precomputedVaguesCount,
    }),
    getTranslations("abonnements"),
  ]);

  // Aucun abonnement actif → message d'invitation
  if (!quotas) {
    return (
      <div className="rounded-lg border bg-card p-4 flex flex-col gap-3">
        <h3 className="text-sm font-semibold">{t("quotas.planUsage")}</h3>
        <p className="text-sm text-muted-foreground">
          {t("quotas.noSubscription")}{" "}
          <Link href="/tarifs" className="underline underline-offset-2 font-medium text-primary">
            {t("quotas.subscribe")}
          </Link>{" "}
          {t("quotas.toManageResources")}
        </p>
      </div>
    );
  }

  const bacsAtteint = isQuotaAtteint(quotas.bacs);
  const vaguesAtteint = isQuotaAtteint(quotas.vagues);
  const limiteAtteinte = bacsAtteint || vaguesAtteint;

  const sharedProps = {
    unlimitedLabel: t("quotas.unlimited"),
    usedLabel: t("quotas.used"),
    usedPluralLabel: t("quotas.usedPlural"),
    ariaLabelTemplate: (params: Record<string, string | number>) => t("quotas.ariaLabel", params),
  };

  return (
    <div className="rounded-lg border bg-card p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">{t("quotas.planUsage")}</h3>
        {limiteAtteinte && (
          <Link
            href="/tarifs"
            className={[
              "shrink-0 text-xs font-semibold px-2 py-1 rounded",
              "bg-destructive text-destructive-foreground",
              "hover:opacity-90 transition-opacity",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-destructive focus-visible:ring-offset-1",
            ].join(" ")}
          >
            {t("quotas.upgrade")}
          </Link>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <RessourceBar label={t("quotas.bacsLabel")} ressource={quotas.bacs} {...sharedProps} />
        <RessourceBar label={t("quotas.vaguesLabel")} ressource={quotas.vagues} {...sharedProps} />
      </div>

      {limiteAtteinte && (
        <p className="text-xs text-destructive">
          {t("quotas.limitReached")}{" "}
          <Link href="/tarifs" className="underline underline-offset-2 font-medium">
            {t("quotas.upgradeLink")}
          </Link>{" "}
          {t("quotas.createMoreResources")}
        </p>
      )}
    </div>
  );
}
