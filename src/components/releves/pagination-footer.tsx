"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { ChevronDown, CheckCircle } from "lucide-react";
import { RELEVES_PAGE_LIMIT } from "@/lib/releve-search-params";

interface PaginationFooterProps {
  /** Nombre d'elements actuellement affiches */
  shown: number;
  /** Total d'elements dans la DB (apres filtres) */
  total: number;
  /** Nombre max d'elements par page */
  limit?: number;
  /** Offset courant */
  offset: number;
  /** Label singulier/pluriel pour le type d'element */
  itemLabel?: { singular: string; plural: string };
}

export function PaginationFooter({
  shown,
  total,
  limit = RELEVES_PAGE_LIMIT,
  offset,
  itemLabel = { singular: "relevé", plural: "relevés" },
}: PaginationFooterProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const remaining = total - shown;
  const nextBatch = Math.min(limit, remaining);
  const progress = total > 0 ? Math.min(100, (shown / total) * 100) : 100;
  const isComplete = remaining <= 0;
  const isLastBatch = remaining > 0 && remaining <= limit;

  const totalLabel = total === 1 ? itemLabel.singular : itemLabel.plural;

  function handleLoadMore() {
    const params = new URLSearchParams(searchParams.toString());
    params.set("offset", String(offset + limit));
    startTransition(() => {
      router.push(`?${params.toString()}`);
    });
  }

  return (
    <div className="mt-4 flex flex-col gap-3">

      {/* Barre de progression */}
      <div className="flex flex-col gap-1.5">
        <div
          className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-valuenow={Math.round(progress)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${shown} sur ${total} ${totalLabel} chargés`}
        >
          <div
            className="h-full rounded-full bg-primary/40 transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Texte informatif */}
        <p className="text-xs text-muted-foreground text-center">
          {isComplete ? (
            <span className="flex items-center justify-center gap-1.5">
              <CheckCircle className="h-3.5 w-3.5 text-primary" />
              Tous les {total} {totalLabel} affichés
            </span>
          ) : (
            <>
              Affichage{" "}
              <span className="font-medium text-foreground">{shown}</span>{" "}
              sur{" "}
              <span className="font-medium text-foreground">{total}</span>{" "}
              {totalLabel}
            </>
          )}
        </p>
      </div>

      {/* Bouton "Charger plus" — masque si tout est charge */}
      {!isComplete && (
        <button
          type="button"
          onClick={handleLoadMore}
          disabled={isPending}
          className="
            w-full flex items-center justify-center gap-2
            rounded-lg border border-border
            py-3 px-4
            text-sm font-medium
            text-muted-foreground
            hover:bg-accent hover:text-foreground hover:border-primary/30
            active:scale-[0.98]
            transition-all duration-150
            disabled:opacity-50 disabled:cursor-not-allowed
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50
          "
        >
          {isPending ? (
            <>
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-muted-foreground border-t-primary" />
              Chargement…
            </>
          ) : (
            <>
              <ChevronDown className="h-4 w-4 shrink-0" />
              {isLastBatch
                ? `Charger les ${nextBatch} derniers`
                : `Charger ${nextBatch} de plus`}
            </>
          )}
        </button>
      )}

    </div>
  );
}
