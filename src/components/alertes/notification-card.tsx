"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Bell, AlertTriangle, AlertCircle, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SeveriteAlerte, TypeReleve } from "@/types";
import type { NotificationActionPayload } from "@/types/notifications";

interface NotificationCardProps {
  id: string;
  titre: string;
  message: string;
  severite: SeveriteAlerte;
  createdAt: string | Date;
  lu: boolean;
  lien?: string | null;
  actionPayload?: Record<string, unknown> | null;
  onMarkRead?: (id: string) => void;
}

const SEVERITE_STYLES: Record<
  SeveriteAlerte,
  {
    bg: string;
    border: string;
    iconColor: string;
    badgeBg: string;
    badgeText: string;
    severiteKey: string;
    Icon: React.ComponentType<{ className?: string }>;
  }
> = {
  [SeveriteAlerte.CRITIQUE]: {
    bg: "bg-accent-red-muted",
    border: "border-accent-red/30",
    iconColor: "text-accent-red",
    badgeBg: "bg-accent-red/10",
    badgeText: "text-accent-red",
    severiteKey: "CRITIQUE",
    Icon: AlertCircle,
  },
  [SeveriteAlerte.AVERTISSEMENT]: {
    bg: "bg-accent-amber-muted",
    border: "border-accent-amber/30",
    iconColor: "text-accent-amber",
    badgeBg: "bg-accent-amber/10",
    badgeText: "text-accent-amber",
    severiteKey: "AVERTISSEMENT",
    Icon: AlertTriangle,
  },
  [SeveriteAlerte.INFO]: {
    bg: "bg-primary/5",
    border: "border-primary/20",
    iconColor: "text-primary",
    badgeBg: "bg-primary/10",
    badgeText: "text-primary",
    severiteKey: "INFO",
    Icon: Bell,
  },
};

/**
 * Carte de notification mobile-first.
 *
 * Affiche la notification avec un style visuel adapte a sa severite :
 * - CRITIQUE → fond rouge
 * - AVERTISSEMENT → fond orange
 * - INFO → fond bleu/primary
 *
 * Inclut un bouton CTA si actionPayload est renseigne, avec navigation
 * construite dynamiquement selon le type d'action.
 */
export function NotificationCard({
  id,
  titre,
  message,
  severite,
  createdAt,
  lu,
  lien,
  actionPayload,
  onMarkRead,
}: NotificationCardProps) {
  const t = useTranslations("alertes");
  const router = useRouter();
  const styles = SEVERITE_STYLES[severite] ?? SEVERITE_STYLES[SeveriteAlerte.INFO];
  const { Icon } = styles;

  const date = new Date(createdAt);
  const dateFormatted = date.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

  function buildCtaUrl(payload: NotificationActionPayload): string | null {
    switch (payload.type) {
      case "CREER_RELEVE":
        return `/releves/new?vagueId=${payload.vagueId}&bacId=${payload.bacId}&typeReleve=${payload.typeReleve}`;
      case "MODIFIER_BAC":
        return `/bacs?edit=${payload.bacId}`;
      case "VOIR_VAGUE":
        return `/vagues/${payload.vagueId}`;
      case "VOIR_STOCK":
        return payload.produitId ? `/stock?produit=${payload.produitId}` : `/stock`;
      default:
        return null;
    }
  }

  function buildCtaLabel(payload: NotificationActionPayload): string {
    switch (payload.type) {
      case "CREER_RELEVE": {
        const typeReleve = payload.typeReleve as TypeReleve;
        const knownTypes: TypeReleve[] = [
          TypeReleve.QUALITE_EAU,
          TypeReleve.RENOUVELLEMENT,
          TypeReleve.BIOMETRIE,
          TypeReleve.ALIMENTATION,
          TypeReleve.MORTALITE,
          TypeReleve.COMPTAGE,
          TypeReleve.OBSERVATION,
        ];
        if (knownTypes.includes(typeReleve)) {
          return t(`card.ctaLabels.CREER_RELEVE.${typeReleve}`);
        }
        return t("card.ctaLabels.CREER_RELEVE.default");
      }
      case "MODIFIER_BAC":
        return t("card.ctaLabels.MODIFIER_BAC");
      case "VOIR_VAGUE":
        return t("card.ctaLabels.VOIR_VAGUE");
      case "VOIR_STOCK":
        return t("card.ctaLabels.VOIR_STOCK");
      default:
        return t("card.ctaLabels.default");
    }
  }

  const payload = actionPayload as NotificationActionPayload | null;
  const ctaUrl = payload ? buildCtaUrl(payload) : lien ?? null;
  const ctaLabel = payload ? buildCtaLabel(payload) : t("card.ctaLabels.default");

  function handleCta() {
    if (onMarkRead) onMarkRead(id);
    if (ctaUrl) router.push(ctaUrl);
  }

  return (
    <div
      className={`rounded-xl border p-3 flex flex-col gap-2 transition-opacity ${styles.bg} ${styles.border} ${lu ? "opacity-60" : ""}`}
    >
      {/* Header */}
      <div className="flex items-start gap-2">
        <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${styles.iconColor}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={`text-xs font-semibold rounded-full px-1.5 py-0.5 ${styles.badgeBg} ${styles.badgeText}`}
            >
              {t(`severites.${styles.severiteKey}`)}
            </span>
            {!lu && (
              <span className="h-2 w-2 rounded-full bg-primary shrink-0" title={t("card.nonLu")} />
            )}
          </div>
          <p className="text-sm font-semibold mt-1 leading-tight">{titre}</p>
        </div>
      </div>

      {/* Message */}
      <p className="text-xs text-foreground/80 leading-relaxed">{message}</p>

      {/* Footer */}
      <div className="flex items-center justify-between gap-2 mt-1">
        <span className="text-xs text-muted-foreground">{dateFormatted}</span>
        {ctaUrl && (
          <Button
            size="sm"
            variant="secondary"
            className="h-7 text-xs gap-1 shrink-0"
            onClick={handleCta}
          >
            <ExternalLink className="h-3 w-3" />
            {ctaLabel}
          </Button>
        )}
      </div>
    </div>
  );
}
