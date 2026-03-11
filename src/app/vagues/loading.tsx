import { ListItemSkeleton } from "@/components/ui/skeleton-patterns";
import { Skeleton } from "@/components/ui/skeleton";

export default function VaguesLoading() {
  return (
    <div className="flex flex-col gap-4 p-4">
      <Skeleton className="h-8 w-24" />
      <Skeleton className="h-10 w-full rounded-lg" />
      <div className="flex flex-col gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <ListItemSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
