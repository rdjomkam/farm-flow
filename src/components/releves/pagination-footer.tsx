"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { RELEVES_PAGE_LIMIT } from "@/lib/releve-search-params";

interface PaginationFooterProps {
  /** Total d'elements dans la DB (apres filtres) */
  total: number;
  /** Offset courant (0-based) */
  offset: number;
  /** Nombre d'elements par page */
  limit?: number;
  /** Label singulier/pluriel pour le type d'element */
  itemLabel?: { singular: string; plural: string };
}

export function PaginationFooter({
  total,
  offset,
  limit = RELEVES_PAGE_LIMIT,
  itemLabel,
}: PaginationFooterProps) {
  const t = useTranslations("common.pagination");
  const router = useRouter();
  const searchParams = useSearchParams();
  const resolvedItemLabel = itemLabel ?? { singular: t("defaultSingular"), plural: t("defaultPlural") };
  const [isPending, startTransition] = useTransition();

  // Cas bord : rien a afficher si total est 0
  if (total === 0) return null;

  const currentPage = Math.floor(offset / limit) + 1;
  const totalPages = Math.ceil(total / limit);
  const hasPrev = offset > 0;
  const hasNext = offset + limit < total;

  const totalLabel = total === 1 ? resolvedItemLabel.singular : resolvedItemLabel.plural;

  function gotoPrev() {
    const params = new URLSearchParams(searchParams.toString());
    const newOffset = Math.max(0, offset - limit);
    if (newOffset === 0) {
      params.delete("offset");
    } else {
      params.set("offset", String(newOffset));
    }
    startTransition(() => {
      router.push(`?${params.toString()}`);
    });
  }

  function gotoNext() {
    const params = new URLSearchParams(searchParams.toString());
    params.set("offset", String(offset + limit));
    startTransition(() => {
      router.push(`?${params.toString()}`);
    });
  }

  return (
    <div className={`mt-4 flex flex-col gap-2 transition-opacity ${isPending ? "opacity-60" : ""}`}>
      {/* Indicateur total */}
      <p className="text-xs text-center text-muted-foreground">
        {t("total", { count: total, label: totalLabel })}
      </p>

      {/* Controles de navigation — uniquement si plusieurs pages */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between gap-2">
          {/* Bouton Precedent */}
          <button
            type="button"
            onClick={gotoPrev}
            disabled={!hasPrev || isPending}
            className="
              min-h-[44px] px-4 rounded-md
              flex items-center gap-1.5
              text-sm font-medium
              bg-primary text-primary-foreground
              hover:bg-primary/90
              disabled:opacity-40 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground
              transition-colors
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring
            "
          >
            <ChevronLeft className="h-4 w-4 shrink-0" />
            {t("previous")}
          </button>

          {/* Indicateur de page */}
          <span className="text-sm font-medium text-foreground whitespace-nowrap">
            {t("pageIndicator", { current: currentPage, total: totalPages })}
          </span>

          {/* Bouton Suivant */}
          <button
            type="button"
            onClick={gotoNext}
            disabled={!hasNext || isPending}
            className="
              min-h-[44px] px-4 rounded-md
              flex items-center gap-1.5
              text-sm font-medium
              bg-primary text-primary-foreground
              hover:bg-primary/90
              disabled:opacity-40 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground
              transition-colors
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring
            "
          >
            {t("next")}
            <ChevronRight className="h-4 w-4 shrink-0" />
          </button>
        </div>
      )}
    </div>
  );
}
