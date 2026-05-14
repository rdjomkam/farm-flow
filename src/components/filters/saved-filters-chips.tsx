"use client";

import { useState } from "react";
import { Bookmark } from "lucide-react";
import { useSavedFilters } from "@/hooks/queries/use-saved-filters-queries";
import type { SavedFilterPage } from "@/types";

interface SavedFiltersChipsProps {
  page: SavedFilterPage;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onLoadFilter: (filters: any) => void;
}

export function SavedFiltersChips({ page, onLoadFilter }: SavedFiltersChipsProps) {
  const { data: savedFilters = [] } = useSavedFilters(page);
  const [activeId, setActiveId] = useState<string | null>(null);

  if (savedFilters.length === 0) return null;

  function handleClick(id: string, filters: unknown) {
    if (activeId === id) {
      setActiveId(null);
      onLoadFilter({});
    } else {
      setActiveId(id);
      onLoadFilter(filters);
    }
  }

  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none -mx-4 px-4">
      {savedFilters.map((sf) => {
        const isActive = activeId === sf.id;
        return (
          <button
            key={sf.id}
            type="button"
            onClick={() => handleClick(sf.id, sf.filters)}
            className={`shrink-0 inline-flex items-center gap-1.5 h-8 px-3 rounded-full border text-xs font-medium transition-colors ${
              isActive
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-background hover:bg-accent"
            }`}
          >
            <Bookmark className={`h-3 w-3 ${isActive ? "text-primary-foreground" : "text-primary"}`} />
            <span className="truncate max-w-[120px]">{sf.name}</span>
          </button>
        );
      })}
    </div>
  );
}
