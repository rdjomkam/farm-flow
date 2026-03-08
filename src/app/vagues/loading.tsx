import { Skeleton } from "@/components/ui/skeleton";

export default function VaguesLoading() {
  return (
    <div className="flex flex-col gap-4 p-4">
      <Skeleton className="h-14 w-full" />
      <div className="flex items-center justify-between">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-9 w-36" />
      </div>
      <Skeleton className="h-11 w-full" />
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
    </div>
  );
}
