import { NavigationLoader } from "@/components/ui/navigation-loader";
import { Header } from "@/components/layout/header";
import { Skeleton } from "@/components/ui/skeleton";
import { getTranslations } from "next-intl/server";

export default async function Loading() {
  const t = await getTranslations("analytics.page");
  return (
    <>
      <NavigationLoader />
      <Header title={t("alimAnalytics")} />
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
