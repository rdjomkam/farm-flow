import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Bell } from "lucide-react";
import { Header } from "@/components/layout/header";
import { NotificationsListClient } from "@/components/alertes/notifications-list-client";
import { getServerSession, checkPagePermission } from "@/lib/auth";
import { getNotifications } from "@/lib/queries";
import { AccessDenied } from "@/components/ui/access-denied";
import { Permission } from "@/types";

export default async function NotificationsPage() {
  const session = await getServerSession();
  if (!session) redirect("/login");
  if (!session.activeSiteId) redirect("/settings/sites");

  try {
    const [t, permissions] = await Promise.all([
      getTranslations("alertes"),
      checkPagePermission(session, Permission.ALERTES_VOIR),
    ]);
    if (!permissions) return <AccessDenied />;

    const notifications = await getNotifications(session.activeSiteId, session.userId);

    return (
      <>
        <Header title={t("page.title")}>
          <Bell className="h-5 w-5 text-muted-foreground" />
        </Header>
        <div className="p-4">
          <NotificationsListClient notifications={JSON.parse(JSON.stringify(notifications))} />
        </div>
      </>
    );
  } catch (error: unknown) {
    const digest = error instanceof Error && "digest" in error ? (error as Record<string, unknown>).digest : undefined;
    if (typeof digest === "string" && /^[A-Z_]/.test(digest)) throw error;
    console.error("[NotificationsPage]", error);
    throw error;
  }
}
