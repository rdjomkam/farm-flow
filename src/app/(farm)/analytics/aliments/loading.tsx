import { NavigationLoader } from "@/components/ui/navigation-loader";
import { Header } from "@/components/layout/header";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <>
      <NavigationLoader />
      <Header title="Analytiques aliments" />
      <div className="flex flex-col gap-4 p-4">
        {/* Skeleton filtres */}
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          <Skeleton className="h-10 rounded-lg" />
          <Skeleton className="h-10 rounded-lg" />
          <Skeleton className="h-10 rounded-lg" />
          <Skeleton className="h-10 rounded-lg" />
        </div>
        {/* Skeleton cards */}
        <Skeleton className="h-24 rounded-lg" />
        <Skeleton className="h-24 rounded-lg" />
        <Skeleton className="h-24 rounded-lg" />
      </div>
    </>
  );
}
