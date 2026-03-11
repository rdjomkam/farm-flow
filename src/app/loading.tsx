import { HeroSkeleton, KPICardSkeleton, VagueCardSkeleton, SectionHeaderSkeleton } from "@/components/ui/skeleton-patterns";
import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardLoading() {
  return (
    <div className="flex flex-col gap-4 p-4">
      <Skeleton className="h-8 w-32" />
      <HeroSkeleton />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <KPICardSkeleton key={i} />
        ))}
      </div>
      <SectionHeaderSkeleton />
      <div className="flex gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-40 rounded-xl shrink-0" />
        ))}
      </div>
      <SectionHeaderSkeleton />
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <VagueCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
