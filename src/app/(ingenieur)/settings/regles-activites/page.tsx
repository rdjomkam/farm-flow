import { redirect } from "next/navigation";
import Link from "next/link";
import { Zap, Variable } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Header } from "@/components/layout/header";
import { getServerSession, checkPagePermission } from "@/lib/auth";
import { AccessDenied } from "@/components/ui/access-denied";
import { Permission } from "@/types";
import { getReglesActivites } from "@/lib/queries/regles-activites";
import { ReglesListClient } from "@/components/regles-activites/regles-list-client";

export default async function ReglesActivitesPage() {
  const session = await getServerSession();
  if (!session) redirect("/login");
  if (!session.activeSiteId) redirect("/settings/sites");

  const permissions = await checkPagePermission(
    session,
    Permission.REGLES_ACTIVITES_VOIR
  );
  if (!permissions) return <AccessDenied />;

  const regles = await getReglesActivites(session.activeSiteId);
  const t = await getTranslations("settings.page");

  return (
    <>
      <Header title={t("activityRules")}>
        <Zap className="h-5 w-5 text-muted-foreground" />
      </Header>
      <div className="p-4">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-muted-foreground flex-1">
            {t("reglesDescription")}
          </p>
          {permissions.includes(Permission.GERER_REGLES_GLOBALES) && (
            <Link
              href="/settings/regles-activites/placeholders"
              className="inline-flex items-center gap-1.5 text-sm text-primary hover:text-primary/80 transition-colors ml-4 shrink-0"
            >
              <Variable className="h-4 w-4" />
              {t("placeholders")}
            </Link>
          )}
        </div>
        <ReglesListClient
          regles={JSON.parse(JSON.stringify(regles))}
          canManage={permissions.includes(Permission.GERER_REGLES_ACTIVITES)}
          canManageGlobal={permissions.includes(Permission.GERER_REGLES_GLOBALES)}
        />
      </div>
    </>
  );
}
