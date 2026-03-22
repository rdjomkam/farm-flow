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

function RessourceBar({ label, ressource }: RessourceBarProps) {
  const { actuel, limite } = ressource;
  const atteint = isQuotaAtteint(ressource);

  // Si illimité : pas de barre de progression
  if (limite === null) {
    return (
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">{actuel} / illimité</span>
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
          {actuel}/{limite} utilisé{actuel > 1 ? "s" : ""}
        </span>
      </div>
      {/* Barre de progression */}
      <div
        className="h-2 w-full rounded-full bg-muted overflow-hidden"
        role="progressbar"
        aria-valuenow={actuel}
        aria-valuemin={0}
        aria-valuemax={limite}
        aria-label={`${label} : ${actuel} sur ${limite}`}
      >
        <div
          className={[
            "h-full rounded-full transition-all duration-300",
            atteint
              ? "bg-destructive"
              : pourcentage >= 80
                ? "bg-amber-500"
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
  const quotas = await getQuotasUsageWithCounts(siteId, {
    bacsCount: precomputedBacsCount,
    vaguesCount: precomputedVaguesCount,
  });

  const bacsAtteint = isQuotaAtteint(quotas.bacs);
  const vaguesAtteint = isQuotaAtteint(quotas.vagues);
  const limiteAtteinte = bacsAtteint || vaguesAtteint;

  return (
    <div className="rounded-lg border bg-card p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">Utilisation de votre plan</h3>
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
            Mettre à niveau
          </Link>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <RessourceBar label="Bacs" ressource={quotas.bacs} />
        <RessourceBar label="Vagues en cours" ressource={quotas.vagues} />
      </div>

      {limiteAtteinte && (
        <p className="text-xs text-destructive">
          Vous avez atteint la limite de votre plan actuel.{" "}
          <Link href="/tarifs" className="underline underline-offset-2 font-medium">
            Passez à un plan supérieur
          </Link>{" "}
          pour creer davantage de ressources.
        </p>
      )}
    </div>
  );
}
