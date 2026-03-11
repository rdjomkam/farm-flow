import { ListItemSkeleton } from "@/components/ui/skeleton-patterns";
import { Skeleton } from "@/components/ui/skeleton";

export default function StockLoading() {
  return (
    <div className="flex flex-col gap-4 p-4">
      <Skeleton className="h-8 w-20" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <ListItemSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
