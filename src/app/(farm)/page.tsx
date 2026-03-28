import { Suspense } from "react";
import { redirect } from "next/navigation";
import { Header } from "@/components/layout/header";
import { QuickActions } from "@/components/dashboard/quick-actions";
import { AccessDenied } from "@/components/ui/access-denied";
import { getServerSession, checkPagePermission } from "@/lib/auth";
import { Permission, Role } from "@/types";
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
import { IngenieurDashboardMultiFarm } from "@/components/ingenieur/ingenieur-dashboard-multi-farm";
import { IngenieurDashboardSingleFarm } from "@/components/ingenieur/ingenieur-dashboard-single-farm";
import { prisma } from "@/lib/db";

/**
 * Unified dashboard page — entry point for both (farm) and (ingenieur) route groups.
 *
 * - ADMIN/GERANT/PISCICULTEUR → farm dashboard
 * - INGENIEUR → dual-mode dashboard:
 *     * Multi-farm (hub) mode: when activeSiteId is the engineer's vendeur/DKFarm site
 *     * Single-farm mode: when activeSiteId is a client site
 *
 * Per ADR-ingenieur-interface: engineers stay in the ingenieur layout at all times.
 * Sprint ID — Stories ID.1
 */
export default async function FarmDashboardPage() {
  const session = await getServerSession();
  if (!session) redirect("/login");

  if (!session.activeSiteId) redirect("/settings/sites");

  // -------------------------------------------------------------------------
  // Ingénieur — dual-mode dashboard
  // -------------------------------------------------------------------------
  if (session.role === Role.INGENIEUR) {
    const permissions = await checkPagePermission(
      session,
      Permission.DASHBOARD_VOIR
    );
    if (!permissions) return <AccessDenied />;

    const activeSiteId = session.activeSiteId;

    // Determine mode: is the active site a vendeur (hub) site?
    // A vendeur site has PackActivations where siteId = activeSiteId.
    const vendeurActivationCount = await prisma.packActivation.count({
      where: { siteId: activeSiteId },
    });

    const isHubMode = vendeurActivationCount > 0 || activeSiteId !== null;

    if (isHubMode && vendeurActivationCount > 0) {
      // Multi-farm (hub) mode — engineer sees all supervised clients
      return (
        <>
          <Header title="Accueil" />
          <Suspense
            fallback={
              <div className="flex flex-col gap-6 p-4">
                <div className="h-28 rounded-2xl bg-muted animate-pulse" />
                <div className="grid grid-cols-2 gap-3">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="h-20 rounded-xl bg-muted animate-pulse" />
                  ))}
                </div>
              </div>
            }
          >
            <IngenieurDashboardMultiFarm
              vendeurSiteId={activeSiteId}
              userId={session.userId}
              sessionName={session.name}
            />
          </Suspense>
        </>
      );
    }

    // Single-farm mode — engineer scoped to a client site
    // Find vendeur site from PackActivations where clientSiteId = activeSiteId
    const clientActivation = await prisma.packActivation.findFirst({
      where: { clientSiteId: activeSiteId },
      select: { siteId: true },
      orderBy: { dateActivation: "desc" },
    });

    if (!clientActivation) {
      // Fallback: treat as hub mode with no clients yet
      return (
        <>
          <Header title="Accueil" />
          <Suspense
            fallback={
              <div className="flex flex-col gap-6 p-4">
                <div className="h-28 rounded-2xl bg-muted animate-pulse" />
              </div>
            }
          >
            <IngenieurDashboardMultiFarm
              vendeurSiteId={activeSiteId}
              userId={session.userId}
              sessionName={session.name}
            />
          </Suspense>
        </>
      );
    }

    return (
      <>
        <Header title="Accueil" />
        <Suspense
          fallback={
            <div className="flex flex-col gap-6 p-4">
              <div className="h-28 rounded-2xl bg-muted animate-pulse" />
              <div className="grid grid-cols-2 gap-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-20 rounded-xl bg-muted animate-pulse" />
                ))}
              </div>
            </div>
          }
        >
          <IngenieurDashboardSingleFarm
            vendeurSiteId={clientActivation.siteId}
            clientSiteId={activeSiteId}
            userId={session.userId}
            sessionName={session.name}
          />
        </Suspense>
      </>
    );
  }

  // -------------------------------------------------------------------------
  // Farm roles — ADMIN, GERANT, PISCICULTEUR
  // -------------------------------------------------------------------------
  const permissions = await checkPagePermission(
    session,
    Permission.DASHBOARD_VOIR
  );
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
