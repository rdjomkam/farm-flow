"use client";

import { useState } from "react";
import { Bookmark, Plus, X, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useSavedFilters, useCreateSavedFilter, useDeleteSavedFilter } from "@/hooks/queries/use-saved-filters-queries";
import type { SavedFilterPage } from "@/types";

interface SavedFiltersSectionProps {
  page: SavedFilterPage;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  currentFilters: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onLoadFilter: (filters: any) => void;
  hasActiveFilters: boolean;
}

export function SavedFiltersSection({
  page,
  currentFilters,
  onLoadFilter,
  hasActiveFilters,
}: SavedFiltersSectionProps) {
  const t = useTranslations("common.savedFilters");
  const { data: savedFilters = [], isLoading } = useSavedFilters(page);
  const createMutation = useCreateSavedFilter();
  const deleteMutation = useDeleteSavedFilter();

  const [showInput, setShowInput] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState("");

  async function handleSave() {
    const trimmed = name.trim();
    if (!trimmed) {
      setError(t("nameRequired"));
      return;
    }
    try {
      await createMutation.mutateAsync({ name: trimmed, page, filters: currentFilters });
      setName("");
      setShowInput(false);
      setError("");
    } catch {
      setError(t("duplicate"));
    }
  }

  function handleDelete(id: string) {
    deleteMutation.mutate({ id, page });
  }

  if (isLoading && savedFilters.length === 0) return null;

  return (
    <div className="border-b border-border px-4 py-3 space-y-2">
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        <button
          type="button"
          onClick={() => {
            if (showInput) {
              setShowInput(false);
              setName("");
              setError("");
            } else {
              setShowInput(true);
            }
          }}
          disabled={!hasActiveFilters && !showInput}
          className="shrink-0 inline-flex items-center gap-1 h-8 px-3 rounded-full border border-dashed border-border text-xs font-medium text-muted-foreground hover:bg-accent transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {showInput ? <X className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
          {t("save")}
        </button>

        {savedFilters.map((sf) => (
          <button
            key={sf.id}
            type="button"
            onClick={() => onLoadFilter(sf.filters)}
            className="group shrink-0 inline-flex items-center gap-1.5 h-8 px-3 rounded-full border border-border bg-background text-xs font-medium hover:bg-accent transition-colors"
          >
            <Bookmark className="h-3 w-3 text-primary" />
            <span className="truncate max-w-[120px]">{sf.name}</span>
            <span
              role="button"
              onClick={(e) => {
                e.stopPropagation();
                handleDelete(sf.id);
              }}
              className="hidden group-hover:inline-flex items-center justify-center h-4 w-4 rounded-full hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
            >
              <X className="h-2.5 w-2.5" />
            </span>
          </button>
        ))}
      </div>

      {showInput && (
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setError("");
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSave();
              if (e.key === "Escape") {
                setShowInput(false);
                setName("");
                setError("");
              }
            }}
            placeholder={t("namePlaceholder")}
            autoFocus
            maxLength={50}
            className="flex-1 h-8 rounded-md border border-border bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <button
            type="button"
            onClick={handleSave}
            disabled={createMutation.isPending || !name.trim()}
            className="shrink-0 h-8 px-3 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {createMutation.isPending ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              t("save")
            )}
          </button>
        </div>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
