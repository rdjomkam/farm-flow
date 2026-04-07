import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Header } from "@/components/layout/header";
import { AnalyticsDashboardClient } from "@/components/analytics/analytics-dashboard-client";
import { getServerSession, checkPagePermission } from "@/lib/auth";
import { getAnalyticsDashboard } from "@/lib/queries/analytics";
import { AccessDenied } from "@/components/ui/access-denied";
import { Permission } from "@/types";

export default async function AnalyticsPage() {
  const session = await getServerSession();
  if (!session) redirect("/login");
  if (!session.activeSiteId) redirect("/settings/sites");

  try {
    const [t, permissions] = await Promise.all([
      getTranslations("analytics"),
      checkPagePermission(session, Permission.DASHBOARD_VOIR),
    ]);
    if (!permissions) return <AccessDenied />;

    const dashboard = await getAnalyticsDashboard(session.activeSiteId);

    return (
      <>
        <Header title={t("page.title")} />
        <AnalyticsDashboardClient dashboard={dashboard} />
      </>
    );
  } catch (error: unknown) {
    const digest = error instanceof Error && "digest" in error ? (error as Record<string, unknown>).digest : undefined;
    if (typeof digest === "string" && /^[A-Z_]/.test(digest)) throw error;
    console.error("[AnalyticsPage]", error);
    throw error;
  }
}
