import { redirect } from "next/navigation";
import { Header } from "@/components/layout/header";
import { AnalyticsDashboardClient } from "@/components/analytics/analytics-dashboard-client";
import { getServerSession, checkPagePermission } from "@/lib/auth";
import { getAnalyticsDashboard } from "@/lib/queries/analytics";
import { AccessDenied } from "@/components/ui/access-denied";
import { Permission } from "@/types";

export default async function AnalyticsPage() {
  const session = await getServerSession();
  if (!session) redirect("/login");
  if (!session.activeSiteId) redirect("/sites");

  const permissions = await checkPagePermission(session, Permission.DASHBOARD_VOIR);
  if (!permissions) return <AccessDenied />;

  const dashboard = await getAnalyticsDashboard(session.activeSiteId);

  return (
    <>
      <Header title="Analytiques" />
      <AnalyticsDashboardClient dashboard={dashboard} />
    </>
  );
}
