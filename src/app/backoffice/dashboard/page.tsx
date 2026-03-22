/**
 * src/app/backoffice/dashboard/page.tsx
 *
 * Dashboard backoffice — KPIs analytics plateforme.
 * Server Component — guard checkBackofficeAccess().
 *
 * Story C.5 — ADR-022 Backoffice
 * R2 : enums importes depuis @/types
 */

import { redirect } from "next/navigation";
import { checkBackofficeAccess } from "@/lib/auth/backoffice";
import { getPlatformKPIs } from "@/lib/queries/admin-analytics";
import { AdminAnalyticsDashboard } from "@/components/admin/analytics/admin-analytics-dashboard";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dashboard",
};

// ISR 5 minutes
export const revalidate = 300;

export default async function BackofficeDashboardPage() {
  const session = await checkBackofficeAccess();
  if (!session) redirect("/login");

  const initialKPIs = await getPlatformKPIs();

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-foreground">Analytics Plateforme</h1>
        <p className="text-sm text-muted-foreground">
          KPIs consolides de toute la plateforme DKFarm
        </p>
      </div>
      <AdminAnalyticsDashboard initialKPIs={initialKPIs} apiBase="/api/backoffice/analytics" />
    </div>
  );
}
