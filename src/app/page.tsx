import { Suspense } from "react";
import { redirect } from "next/navigation";
import { Header } from "@/components/layout/header";
import { QuickActions } from "@/components/dashboard/quick-actions";
import { AccessDenied } from "@/components/ui/access-denied";
import { getServerSession, checkPagePermission } from "@/lib/auth";
import { Permission } from "@/types";
import { DashboardHeroSection } from "@/components/dashboard/dashboard-hero-section";
import { IndicateursSection } from "@/components/dashboard/indicateurs-section";
import { ProjectionsSection } from "@/components/dashboard/projections-section";
import { RecentActivitySection } from "@/components/dashboard/recent-activity-section";
import {
  HeroSectionSkeleton,
  IndicateursSkeleton,
  ProjectionsSkeleton,
  RecentActivitySkeleton,
} from "@/components/dashboard/section-skeletons";

export default async function DashboardPage() {
  const session = await getServerSession();
  if (!session) redirect("/login");
  if (!session.activeSiteId) redirect("/settings/sites");

  const permissions = await checkPagePermission(session, Permission.DASHBOARD_VOIR);
  if (!permissions) return <AccessDenied />;

  const siteId = session.activeSiteId;

  return (
    <>
      <Header title="Dashboard" />
      <div className="flex flex-col gap-4 p-4">
        <Suspense fallback={<HeroSectionSkeleton />}>
          <DashboardHeroSection siteId={siteId} sessionName={session.name} />
        </Suspense>

        <QuickActions permissions={permissions} />

        <Suspense fallback={<IndicateursSkeleton />}>
          <IndicateursSection siteId={siteId} />
        </Suspense>

        <Suspense fallback={<ProjectionsSkeleton />}>
          <ProjectionsSection siteId={siteId} />
        </Suspense>

        <Suspense fallback={<RecentActivitySkeleton />}>
          <RecentActivitySection siteId={siteId} />
        </Suspense>
      </div>
    </>
  );
}
