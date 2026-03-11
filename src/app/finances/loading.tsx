import { KPICardSkeleton, ChartSkeleton } from "@/components/ui/skeleton-patterns";
import { Skeleton } from "@/components/ui/skeleton";

export default function FinancesLoading() {
  return (
    <div className="flex flex-col gap-4 p-4">
      <Skeleton className="h-8 w-48" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <KPICardSkeleton key={i} />
        ))}
      </div>
      <ChartSkeleton />
    </div>
  );
}
