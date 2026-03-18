"use client";

import Link from "next/link";
import { ChevronRight, Scissors } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { CalibrageCard } from "./calibrage-card";
import type { CalibrageWithRelations } from "@/types";

interface CalibragesListProps {
  calibrages: CalibrageWithRelations[];
  limit?: number;
  vagueId?: string;
}

export function CalibragesList({ calibrages, limit, vagueId }: CalibragesListProps) {
  if (calibrages.length === 0) {
    return (
      <EmptyState
        icon={<Scissors className="h-7 w-7" />}
        title="Aucun calibrage"
        description="Le premier calibrage de cette vague apparaitra ici."
      />
    );
  }

  const hasMore = limit != null && calibrages.length > limit;
  const displayed = hasMore ? calibrages.slice(0, limit) : calibrages;

  return (
    <div className="flex flex-col gap-2">
      {displayed.map((c) => (
        <CalibrageCard key={c.id} calibrage={c} />
      ))}
      {hasMore && vagueId && (
        <Link
          href={`/vagues/${vagueId}/calibrages`}
          className="flex items-center justify-center gap-1 rounded-md border border-border py-2 text-sm font-medium text-primary hover:bg-accent transition-colors"
        >
          Voir tout ({calibrages.length})
          <ChevronRight className="h-4 w-4" />
        </Link>
      )}
    </div>
  );
}
